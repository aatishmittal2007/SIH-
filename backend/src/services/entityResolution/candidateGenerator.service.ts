import { Entity, EntityType } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { TextNormalizationService } from '../textNormalization.service';

export interface CandidatePair {
  sourceEntity: Entity;
  targetEntity: Entity;
  blockingKey: string;
}

export class CandidateGenerator {
  /**
   * Generate potential matching candidate pairs using type-aware blocking strategies.
   * Avoids O(N^2) exhaustive comparisons across unrelated entities.
   */
  static async generateCandidates(options?: {
    entityId?: string;
    caseId?: string;
    limit?: number;
  }): Promise<CandidatePair[]> {
    const candidateMap = new Map<string, CandidatePair>();

    let sourceEntities: Entity[] = [];

    if (options?.entityId) {
      const entity = await prisma.entity.findUnique({ where: { id: options.entityId } });
      if (entity) sourceEntities = [entity];
    } else if (options?.caseId) {
      const caseEntities = await prisma.caseEntity.findMany({
        where: { caseId: options.caseId },
        include: { entity: true },
      });
      sourceEntities = caseEntities.map((ce) => ce.entity);
    } else {
      sourceEntities = await prisma.entity.findMany({
        take: options?.limit || 100,
        orderBy: { updatedAt: 'desc' },
      });
    }

    for (const source of sourceEntities) {
      const candidatesForSource = await this.getCandidatesForEntity(source);
      for (const target of candidatesForSource) {
        if (source.id === target.id) continue;
        if (source.type !== target.type) continue; // STRICT TYPE SAFETY

        // Canonical pair key to prevent duplicate (A,B) and (B,A)
        const [id1, id2] = source.id < target.id ? [source.id, target.id] : [target.id, source.id];
        const pairKey = `${id1}:${id2}`;

        if (!candidateMap.has(pairKey)) {
          const [sourceEnt, targetEnt] = source.id < target.id ? [source, target] : [target, source];
          candidateMap.set(pairKey, {
            sourceEntity: sourceEnt,
            targetEntity: targetEnt,
            blockingKey: source.type,
          });
        }
      }
    }

    // Filter out candidates that already exist in EntityMatch table
    const pairList = Array.from(candidateMap.values());
    const filteredPairs: CandidatePair[] = [];

    for (const pair of pairList) {
      const existing = await prisma.entityMatch.findFirst({
        where: {
          OR: [
            { sourceEntityId: pair.sourceEntity.id, targetEntityId: pair.targetEntity.id },
            { sourceEntityId: pair.targetEntity.id, targetEntityId: pair.sourceEntity.id },
          ],
        },
      });

      if (!existing) {
        filteredPairs.push(pair);
      }
    }

    return filteredPairs;
  }

  /**
   * Get candidate target entities for a single source entity based on type-aware blocking rules.
   */
  private static async getCandidatesForEntity(entity: Entity): Promise<Entity[]> {
    const normalized = TextNormalizationService.normalizeEntityValue(entity.canonicalValue, entity.type);

    switch (entity.type) {
      case EntityType.PERSON: {
        // Block by: exact normalized value, first token, or last token
        const tokens = normalized.split(/\s+/).filter((t) => t.length > 2);
        const orConditions: any[] = [{ normalizedValue: normalized }];

        if (tokens.length > 0) {
          orConditions.push({ normalizedValue: { contains: tokens[0] } });
        }
        if (tokens.length > 1) {
          orConditions.push({ normalizedValue: { contains: tokens[tokens.length - 1] } });
        }

        return prisma.entity.findMany({
          where: {
            type: EntityType.PERSON,
            id: { not: entity.id },
            OR: orConditions,
          },
          take: 50,
        });
      }

      case EntityType.EMAIL: {
        // Block by: exact email or local part
        const localPart = normalized.split('@')[0];
        return prisma.entity.findMany({
          where: {
            type: EntityType.EMAIL,
            id: { not: entity.id },
            OR: [
              { normalizedValue: normalized },
              { normalizedValue: { startsWith: localPart } },
            ],
          },
          take: 50,
        });
      }

      case EntityType.PHONE: {
        // Block by: exact phone or last 8 digits
        const digits = normalized.replace(/\D/g, '');
        const lastDigits = digits.length >= 8 ? digits.slice(-8) : digits;

        return prisma.entity.findMany({
          where: {
            type: EntityType.PHONE,
            id: { not: entity.id },
            OR: [
              { normalizedValue: normalized },
              { normalizedValue: { contains: lastDigits } },
            ],
          },
          take: 50,
        });
      }

      case EntityType.ORGANIZATION: {
        // Block by: normalized value or core org words
        const orgTokens = normalized
          .replace(/\b(pvt|ltd|private|limited|inc|corp|llp|group)\b/g, '')
          .split(/\s+/)
          .filter((t) => t.length > 2);

        const orConditions: any[] = [{ normalizedValue: normalized }];
        for (const token of orgTokens) {
          orConditions.push({ normalizedValue: { contains: token } });
        }

        return prisma.entity.findMany({
          where: {
            type: EntityType.ORGANIZATION,
            id: { not: entity.id },
            OR: orConditions,
          },
          take: 50,
        });
      }

      case EntityType.USERNAME: {
        return prisma.entity.findMany({
          where: {
            type: EntityType.USERNAME,
            id: { not: entity.id },
            normalizedValue: { contains: normalized.slice(0, 5) },
          },
          take: 50,
        });
      }

      case EntityType.IP_ADDRESS:
      case EntityType.DOMAIN:
      case EntityType.URL:
      case EntityType.ACCOUNT:
      case EntityType.DEVICE:
      case EntityType.LOCATION:
      case EntityType.TRANSACTION:
      default: {
        // Exact or prefix blocking for technical/identifying entities
        return prisma.entity.findMany({
          where: {
            type: entity.type,
            id: { not: entity.id },
            normalizedValue: { startsWith: normalized.slice(0, 10) },
          },
          take: 50,
        });
      }
    }
  }
}
