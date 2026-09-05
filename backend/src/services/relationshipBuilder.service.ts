import { PrismaClient, MatchStatus } from '@prisma/client';
import { getNeo4jSession } from '../db/neo4j';

const prisma = new PrismaClient();

export interface RelationshipResult {
  sourceId: string;
  targetId: string;
  type: string;
  evidenceId?: string | null;
  confidence: number;
  provenance: string;
}

function determineRelationship(e1: any, e2: any): { sourceEntity: any; targetEntity: any; relType: string } {
  const usesTypes = ['PHONE', 'EMAIL', 'USERNAME', 'DEVICE'];

  if (e1.type === 'PERSON' && usesTypes.includes(e2.type)) {
    return { sourceEntity: e1, targetEntity: e2, relType: 'USES' };
  }
  if (e2.type === 'PERSON' && usesTypes.includes(e1.type)) {
    return { sourceEntity: e2, targetEntity: e1, relType: 'USES' };
  }
  if (e1.type === 'PERSON' && e2.type === 'ACCOUNT') {
    return { sourceEntity: e1, targetEntity: e2, relType: 'ASSOCIATED_WITH' };
  }
  if (e2.type === 'PERSON' && e1.type === 'ACCOUNT') {
    return { sourceEntity: e2, targetEntity: e1, relType: 'ASSOCIATED_WITH' };
  }
  if (e1.type === 'PERSON' && e2.type === 'ORGANIZATION') {
    return { sourceEntity: e1, targetEntity: e2, relType: 'WORKS_WITH' };
  }
  if (e2.type === 'PERSON' && e1.type === 'ORGANIZATION') {
    return { sourceEntity: e2, targetEntity: e1, relType: 'WORKS_WITH' };
  }
  if (e1.type === 'PERSON' && e2.type === 'LOCATION') {
    return { sourceEntity: e1, targetEntity: e2, relType: 'LOCATED_AT' };
  }
  if (e2.type === 'PERSON' && e1.type === 'LOCATION') {
    return { sourceEntity: e2, targetEntity: e1, relType: 'LOCATED_AT' };
  }

  // Default for all other pairs (e.g. PERSON-PERSON, ORG-LOCATION): canonical ordering by ID
  if (e1.id < e2.id) {
    return { sourceEntity: e1, targetEntity: e2, relType: 'ASSOCIATED_WITH' };
  } else {
    return { sourceEntity: e2, targetEntity: e1, relType: 'ASSOCIATED_WITH' };
  }
}

export class RelationshipBuilderService {
  /**
   * Build evidence-backed relationships for a specific case (or all cases if caseId omitted)
   * Relationships are created strictly when supported by explicit evidence co-occurrence,
   * events, or confirmed entity resolution matches. No "CaseLink" fallback relationships are created.
   */
  static async buildRelationshipsForCase(caseId?: string): Promise<{ createdCount: number; relationships: RelationshipResult[] }> {
    const session = getNeo4jSession();
    const relationships: RelationshipResult[] = [];
    let createdCount = 0;

    try {
      // Find cases to process
      const cases = await prisma.case.findMany({
        where: caseId ? { id: caseId } : {},
        select: { id: true },
      });

      for (const c of cases) {
        const cId = c.id;

        // 1. Fetch entity mentions in evidence for this case
        const mentions = await prisma.entityMention.findMany({
          where: { caseId: cId },
          include: {
            evidence: {
              include: { source: true },
            },
            entity: true,
          },
        });

        // Group mentions by evidenceId
        const evidenceMentionsMap = new Map<string, { evidence: any; mentions: typeof mentions }>();
        for (const m of mentions) {
          if (!m.evidenceId || !m.evidence) continue;
          if (!evidenceMentionsMap.has(m.evidenceId)) {
            evidenceMentionsMap.set(m.evidenceId, { evidence: m.evidence, mentions: [] });
          }
          evidenceMentionsMap.get(m.evidenceId)!.mentions.push(m);
        }

        // CaseEntity confidence map
        const caseEntities = await prisma.caseEntity.findMany({
          where: { caseId: cId },
        });
        const caseEntityConfMap = new Map<string, number>();
        for (const ce of caseEntities) {
          caseEntityConfMap.set(ce.entityId, ce.confidence);
        }

        const processedPairsInCase = new Set<string>();

        // Build relationships for entities mentioned in the SAME evidence document
        for (const [evId, { evidence, mentions: evMentions }] of evidenceMentionsMap.entries()) {
          const entityMap = new Map<string, typeof evMentions[0]>();
          for (const m of evMentions) {
            if (!entityMap.has(m.entityId)) {
              entityMap.set(m.entityId, m);
            }
          }

          const uniqueMentions = Array.from(entityMap.values());

          for (let i = 0; i < uniqueMentions.length; i++) {
            for (let j = i + 1; j < uniqueMentions.length; j++) {
              const m1 = uniqueMentions[i];
              const m2 = uniqueMentions[j];

              if (m1.entityId === m2.entityId) continue;

              const pairKey = `${evId}_${[m1.entityId, m2.entityId].sort().join('_')}`;
              if (processedPairsInCase.has(pairKey)) continue;
              processedPairsInCase.add(pairKey);

              const relInfo = determineRelationship(m1.entity, m2.entity);
              const conf1 = caseEntityConfMap.get(m1.entityId) ?? m1.extractionConfidence ?? 0.8;
              const conf2 = caseEntityConfMap.get(m2.entityId) ?? m2.extractionConfidence ?? 0.8;
              const conf = Math.min(conf1, conf2);

              const prov = `Case ${cId}: Evidence ${evId} (${evidence.fileName || evidence.title || 'Document'}) links ${relInfo.sourceEntity.displayName} to ${relInfo.targetEntity.displayName}`;

              await session.run(
                `MATCH (s:Entity { id: $sourceId })
                 MATCH (t:Entity { id: $targetId })
                 MERGE (s)-[r:${relInfo.relType}]->(t)
                 SET r.evidenceId = $evId,
                     r.sourceId = $sourceIdAttr,
                     r.caseId = $cId,
                     r.confidence = $conf,
                     r.provenance = $prov,
                     r.createdAt = datetime()`,
                {
                  sourceId: relInfo.sourceEntity.id,
                  targetId: relInfo.targetEntity.id,
                  evId,
                  sourceIdAttr: evidence.sourceId || evId,
                  cId,
                  conf,
                  prov,
                }
              );

              createdCount++;
              relationships.push({
                sourceId: relInfo.sourceEntity.id,
                targetId: relInfo.targetEntity.id,
                type: relInfo.relType,
                evidenceId: evId,
                confidence: conf,
                provenance: prov,
              });
            }
          }

          // EVIDENCE -> MENTIONS -> ENTITY graph links
          for (const m of evMentions) {
            await session.run(
              `MATCH (ev:Evidence { id: $evidenceId })
               MATCH (e:Entity { id: $entityId })
               MERGE (ev)-[r:MENTIONS]->(e)
               SET r.confidence = $conf,
                   r.originalText = $text,
                   r.caseId = $cId,
                   r.provenance = $prov`,
              {
                evidenceId: m.evidenceId,
                entityId: m.entityId,
                conf: m.extractionConfidence,
                text: m.originalText,
                cId,
                prov: `Evidence ${m.evidenceId} mentions entity ${m.entityId}`,
              }
            );
          }
        }

        // 2. Events: EVENT -> INVOLVES -> ENTITY & CASE -> HAS_EVENT -> EVENT
        const events = await prisma.event.findMany({
          where: { caseId: cId },
          include: { source: true },
        });

        for (const ev of events) {
          await session.run(
            `MATCH (c:Case { id: $cId })
             MERGE (e:Event { id: $eventId })
             ON CREATE SET e.type = $evType, e.description = $evDesc, e.timestamp = $ts, e.caseId = $cId
             MERGE (c)-[:HAS_EVENT]->(e)`,
            {
              cId,
              eventId: ev.id,
              evType: ev.type,
              evDesc: ev.description,
              ts: ev.timestamp.toISOString(),
            }
          );

          if (ev.locationEntityId) {
            await session.run(
              `MATCH (e:Event { id: $eventId })
               MATCH (loc:Entity { id: $locId })
               MERGE (loc)-[r:INVOLVES]->(e)
               SET r.confidence = $conf,
                   r.caseId = $cId,
                   r.sourceId = $sourceId,
                   r.provenance = $prov,
                   r.createdAt = datetime()`,
              {
                eventId: ev.id,
                locId: ev.locationEntityId,
                conf: ev.confidence,
                cId,
                sourceId: ev.sourceId || '',
                prov: `Event ${ev.id} occurred at Location entity ${ev.locationEntityId}`,
              }
            );
          }
        }
      }

      // 3. CONFIRMED Entity Matches ONLY (Ignore PENDING and REJECTED)
      const confirmedMatches = await prisma.entityMatch.findMany({
        where: { status: MatchStatus.CONFIRMED },
      });

      for (const match of confirmedMatches) {
        await session.run(
          `MATCH (e1:Entity { id: $sourceId })
           MATCH (e2:Entity { id: $targetId })
           MERGE (e1)-[r:SAME_ENTITY_AS]->(e2)
           SET r.similarityScore = $score,
               r.matchType = $type,
               r.status = 'CONFIRMED',
               r.provenance = $prov`,
          {
            sourceId: match.sourceEntityId,
            targetId: match.targetEntityId,
            score: match.similarityScore,
            type: match.matchType,
            prov: `Confirmed Entity Resolution Match ID ${match.id}`,
          }
        );
      }

      return { createdCount, relationships };
    } catch (error) {
      console.error('[RelationshipBuilder] Error building relationships:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Fetch explicit relationships for an entity from Neo4j
   */
  static async getRelationshipsForEntity(entityId: string): Promise<any[]> {
    const session = getNeo4jSession();
    try {
      const result = await session.run(
        `MATCH (e:Entity { id: $entityId })-[r]-(target)
         RETURN type(r) AS relationshipType, properties(r) AS properties, labels(target) AS targetLabels, properties(target) AS targetProperties`,
        { entityId }
      );

      return result.records.map((rec) => ({
        relationshipType: rec.get('relationshipType'),
        properties: rec.get('properties'),
        targetLabels: rec.get('targetLabels'),
        targetProperties: rec.get('targetProperties'),
      }));
    } finally {
      await session.close();
    }
  }
}
