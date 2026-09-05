import { UserRole, EntityType, CaseEntityRole, ExtractionMethod, Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { AppError } from '../../utils/errors';
import { createAuditLog } from '../../utils/audit';
import { Neo4jSyncService } from '../../services/neo4jSync.service';
import { CaseService } from '../cases/case.service';
import {
  CreateEntityInput,
  UpdateEntityInput,
  LinkEntityToCaseInput,
  CreateEntityMentionInput,
  GetEntitiesQueryInput,
} from './entity.schema';

export class EntityService {
  /**
   * Helper to compute normalized value for entity canonical value
   */
  private static normalizeValue(type: EntityType, value: string): string {
    const trimmed = value.trim();
    switch (type) {
      case EntityType.PHONE:
        return trimmed.replace(/[^\d+]/g, '');
      case EntityType.EMAIL:
        return trimmed.toLowerCase();
      default:
        return trimmed.toLowerCase();
    }
  }

  /**
   * Create or retrieve existing Entity record by type & normalized value
   */
  static async createOrGetEntity(input: CreateEntityInput, userId: string, ipAddress?: string) {
    const normalizedValue = this.normalizeValue(input.type as EntityType, input.canonicalValue);
    const displayName = input.displayName || input.canonicalValue;

    // Check if entity with same type & normalized value exists
    let entity = await prisma.entity.findFirst({
      where: {
        type: input.type as EntityType,
        normalizedValue,
      },
    });

    if (!entity) {
      entity = await prisma.entity.create({
        data: {
          type: input.type as EntityType,
          canonicalValue: input.canonicalValue,
          displayName,
          normalizedValue,
        },
      });

      // Sync new Entity node to Neo4j
      await Neo4jSyncService.syncEntity(entity);

      await createAuditLog({
        userId,
        action: 'CREATE_ENTITY',
        resourceType: 'Entity',
        resourceId: entity.id,
        metadata: { type: entity.type, canonicalValue: entity.canonicalValue, normalizedValue },
        ipAddress,
      });
    }

    return entity;
  }

  /**
   * Link an Entity to a Case
   */
  static async linkEntityToCase(input: LinkEntityToCaseInput, userId: string, role: UserRole, ipAddress?: string) {
    await CaseService.checkCaseAccess(input.caseId, userId, role);

    const entity = await prisma.entity.findUnique({ where: { id: input.entityId } });
    if (!entity) {
      throw AppError.notFound('Entity not found');
    }

    const entityRole = (input.role || 'SUSPECT') as CaseEntityRole;

    const caseEntity = await prisma.caseEntity.upsert({
      where: {
        caseId_entityId_role: {
          caseId: input.caseId,
          entityId: input.entityId,
          role: entityRole,
        },
      },
      update: {
        confidence: input.confidence,
      },
      create: {
        caseId: input.caseId,
        entityId: input.entityId,
        role: entityRole,
        confidence: input.confidence,
      },
      include: {
        entity: true,
        case: { select: { id: true, caseNumber: true, title: true } },
      },
    });

    // Synchronize CaseEntity relationship in Neo4j
    await Neo4jSyncService.syncCaseEntity(input.caseId, input.entityId, entityRole, input.confidence);

    await createAuditLog({
      userId,
      action: 'LINK_ENTITY_CASE',
      resourceType: 'CaseEntity',
      resourceId: `${input.caseId}:${input.entityId}`,
      metadata: { caseId: input.caseId, entityId: input.entityId, role: entityRole },
      ipAddress,
    });

    return caseEntity;
  }

  /**
   * Add Entity Mention in Evidence
   */
  static async createEntityMention(input: CreateEntityMentionInput, userId: string, role: UserRole, ipAddress?: string) {
    const evidence = await prisma.evidence.findUnique({ where: { id: input.evidenceId } });
    if (!evidence) {
      throw AppError.notFound('Evidence record not found');
    }

    await CaseService.checkCaseAccess(evidence.caseId, userId, role);

    const entity = await prisma.entity.findUnique({ where: { id: input.entityId } });
    if (!entity) {
      throw AppError.notFound('Entity not found');
    }

    const extractionMethod = (input.extractionMethod || 'MANUAL') as ExtractionMethod;

    const mention = await prisma.entityMention.create({
      data: {
        evidenceId: input.evidenceId,
        entityId: input.entityId,
        caseId: evidence.caseId,
        originalText: input.originalText,
        extractionConfidence: input.confidence ?? 1.0,
        extractionMethod,
        context: input.contextSnippet,
      },
      include: {
        entity: true,
        evidence: { select: { id: true, title: true, caseId: true } },
      },
    });

    // Also auto-link entity to the evidence's case if not already linked
    await this.linkEntityToCase(
      {
        caseId: evidence.caseId,
        entityId: input.entityId,
        role: 'MENTIONED',
        confidence: input.confidence,
      },
      userId,
      role,
      ipAddress
    );

    // Sync EntityMention relationship to Neo4j
    await Neo4jSyncService.syncEntityMention(
      input.evidenceId,
      input.entityId,
      input.originalText,
      extractionMethod
    );

    await createAuditLog({
      userId,
      action: 'CREATE_ENTITY_MENTION',
      resourceType: 'EntityMention',
      resourceId: mention.id,
      metadata: { evidenceId: input.evidenceId, entityId: input.entityId },
      ipAddress,
    });

    return mention;
  }

  /**
   * List Entities with pagination and filters
   */
  static async listEntities(queryParams: GetEntitiesQueryInput, userId: string, role: UserRole) {
    const { page, limit, type, search, caseId } = queryParams;
    const skip = (page - 1) * limit;

    let caseWhereFilter: Prisma.EntityWhereInput = {};
    if (caseId) {
      await CaseService.checkCaseAccess(caseId, userId, role);
      caseWhereFilter = {
        caseEntities: {
          some: { caseId },
        },
      };
    }

    const whereCondition: Prisma.EntityWhereInput = {
      ...caseWhereFilter,
      ...(type ? { type: type as EntityType } : {}),
      ...(search
        ? {
            OR: [
              { displayName: { contains: search, mode: 'insensitive' } },
              { canonicalValue: { contains: search, mode: 'insensitive' } },
              { normalizedValue: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, entities] = await Promise.all([
      prisma.entity.count({ where: whereCondition }),
      prisma.entity.findMany({
        where: whereCondition,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          caseEntities: {
            include: { case: { select: { id: true, caseNumber: true, title: true } } },
          },
          _count: { select: { mentions: true, caseEntities: true } },
        },
      }),
    ]);

    return {
      entities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get single Entity by ID
   */
  static async getEntityById(id: string) {
    const entity = await prisma.entity.findUnique({
      where: { id },
      include: {
        caseEntities: {
          include: { case: { select: { id: true, caseNumber: true, title: true, status: true } } },
        },
        mentions: {
          take: 20,
          include: { evidence: { select: { id: true, title: true, caseId: true } } },
        },
        _count: { select: { mentions: true, caseEntities: true } },
      },
    });

    if (!entity) {
      throw AppError.notFound('Entity not found');
    }

    return entity;
  }

  /**
   * Update Entity displayName
   */
  static async updateEntity(id: string, input: UpdateEntityInput, userId: string, ipAddress?: string) {
    const existing = await prisma.entity.findUnique({ where: { id } });
    if (!existing) {
      throw AppError.notFound('Entity not found');
    }

    const updated = await prisma.entity.update({
      where: { id },
      data: {
        ...(input.displayName ? { displayName: input.displayName } : {}),
      },
    });

    await Neo4jSyncService.syncEntity(updated);

    await createAuditLog({
      userId,
      action: 'UPDATE_ENTITY',
      resourceType: 'Entity',
      resourceId: id,
      metadata: { updatedFields: Object.keys(input) },
      ipAddress,
    });

    return updated;
  }
}
