import { getNeo4jSession } from '../db/neo4j';

export class Neo4jSyncService {
  /**
   * Sync Case node to Neo4j
   */
  static async syncCase(caseData: { id: string; caseNumber: string; title: string; status: string; priority: string; createdAt: Date }) {
    const session = getNeo4jSession();
    try {
      await session.run(
        `MERGE (c:Case { id: $id })
         SET c.caseNumber = $caseNumber,
             c.title = $title,
             c.status = $status,
             c.priority = $priority,
             c.createdAt = $createdAt`,
        {
          id: caseData.id,
          caseNumber: caseData.caseNumber,
          title: caseData.title,
          status: caseData.status,
          priority: caseData.priority,
          createdAt: caseData.createdAt.toISOString(),
        }
      );
    } catch (error) {
      console.error(`[Neo4jSync] Failed to sync Case ${caseData.id}:`, error);
    } finally {
      await session.close();
    }
  }

  /**
   * Sync Source node to Neo4j
   */
  static async syncSource(sourceData: { id: string; name: string; type: string; reliability: string }) {
    const session = getNeo4jSession();
    try {
      await session.run(
        `MERGE (s:Source { id: $id })
         SET s.name = $name,
             s.type = $type,
             s.reliability = $reliability`,
        {
          id: sourceData.id,
          name: sourceData.name,
          type: sourceData.type,
          reliability: sourceData.reliability,
        }
      );
    } catch (error) {
      console.error(`[Neo4jSync] Failed to sync Source ${sourceData.id}:`, error);
    } finally {
      await session.close();
    }
  }

  /**
   * Sync Evidence node and (:Case)-[:HAS_EVIDENCE]->(:Evidence) relationship
   */
  static async syncEvidence(evidenceData: { id: string; caseId: string; title: string; type: string; fileName: string; hash?: string | null }) {
    const session = getNeo4jSession();
    try {
      await session.run(
        `MERGE (e:Evidence { id: $id })
         SET e.title = $title,
             e.type = $type,
             e.fileName = $fileName,
             e.hash = $hash
         WITH e
         MATCH (c:Case { id: $caseId })
         MERGE (c)-[:HAS_EVIDENCE]->(e)`,
        {
          id: evidenceData.id,
          caseId: evidenceData.caseId,
          title: evidenceData.title,
          type: evidenceData.type,
          fileName: evidenceData.fileName,
          hash: evidenceData.hash || '',
        }
      );
    } catch (error) {
      console.error(`[Neo4jSync] Failed to sync Evidence ${evidenceData.id}:`, error);
    } finally {
      await session.close();
    }
  }

  /**
   * Sync Entity node to Neo4j
   */
  static async syncEntity(entityData: { id: string; type: string; canonicalValue: string; displayName: string; normalizedValue: string }) {
    const session = getNeo4jSession();
    try {
      await session.run(
        `MERGE (e:Entity { id: $id })
         SET e.type = $type,
             e.canonicalValue = $canonicalValue,
             e.displayName = $displayName,
             e.normalizedValue = $normalizedValue`,
        {
          id: entityData.id,
          type: entityData.type,
          canonicalValue: entityData.canonicalValue,
          displayName: entityData.displayName,
          normalizedValue: entityData.normalizedValue,
        }
      );
    } catch (error) {
      console.error(`[Neo4jSync] Failed to sync Entity ${entityData.id}:`, error);
    } finally {
      await session.close();
    }
  }

  /**
   * Sync (:Case)-[:INVOLVES {role, confidence}]->(:Entity) relationship
   */
  static async syncCaseEntity(caseId: string, entityId: string, role: string, confidence: number) {
    const session = getNeo4jSession();
    try {
      await session.run(
        `MATCH (c:Case { id: $caseId })
         MATCH (e:Entity { id: $entityId })
         MERGE (c)-[r:INVOLVES { role: $role }]->(e)
         SET r.confidence = $confidence`,
        {
          caseId,
          entityId,
          role,
          confidence,
        }
      );
    } catch (error) {
      console.error(`[Neo4jSync] Failed to sync CaseEntity link (${caseId} -> ${entityId}):`, error);
    } finally {
      await session.close();
    }
  }

  /**
   * Sync (:Evidence)-[:MENTIONS {originalText, extractionMethod}]->(:Entity) relationship
   */
  static async syncEntityMention(evidenceId: string, entityId: string, originalText: string, extractionMethod: string) {
    const session = getNeo4jSession();
    try {
      await session.run(
        `MATCH (ev:Evidence { id: $evidenceId })
         MATCH (e:Entity { id: $entityId })
         MERGE (ev)-[r:MENTIONS]->(e)
         SET r.originalText = $originalText,
             r.extractionMethod = $extractionMethod`,
        {
          evidenceId,
          entityId,
          originalText,
          extractionMethod,
        }
      );
    } catch (error) {
      console.error(`[Neo4jSync] Failed to sync EntityMention (${evidenceId} -> ${entityId}):`, error);
    } finally {
      await session.close();
    }
  }

  /**
   * Sync Event node and (:Case)-[:HAS_EVENT]->(:Event) & optional location relationship
   */
  static async syncEvent(eventData: { id: string; caseId: string; type: string; description: string; timestamp: Date; locationEntityId?: string | null }) {
    const session = getNeo4jSession();
    try {
      await session.run(
        `MERGE (ev:Event { id: $id })
         SET ev.type = $type,
             ev.description = $description,
             ev.timestamp = $timestamp
         WITH ev
         MATCH (c:Case { id: $caseId })
         MERGE (c)-[:HAS_EVENT]->(ev)`,
        {
          id: eventData.id,
          caseId: eventData.caseId,
          type: eventData.type,
          description: eventData.description,
          timestamp: eventData.timestamp.toISOString(),
        }
      );

      if (eventData.locationEntityId) {
        await session.run(
          `MATCH (ev:Event { id: $id })
           MATCH (loc:Entity { id: $locationEntityId })
           MERGE (ev)-[:OCCURRED_AT]->(loc)`,
          {
            id: eventData.id,
            locationEntityId: eventData.locationEntityId,
          }
        );
      }
    } catch (error) {
      console.error(`[Neo4jSync] Failed to sync Event ${eventData.id}:`, error);
    } finally {
      await session.close();
    }
  }

  /**
   * Sync confirmed SAME_ENTITY_AS relationship between two resolved entities
   */
  static async syncConfirmedEntityMatch(data: {
    sourceEntityId: string;
    targetEntityId: string;
    matchType: string;
    similarityScore: number;
    reviewedById?: string | null;
    reviewedAt?: Date | null;
  }) {
    const session = getNeo4jSession();
    try {
      await session.run(
        `MATCH (e1:Entity { id: $sourceEntityId })
         MATCH (e2:Entity { id: $targetEntityId })
         MERGE (e1)-[r:SAME_ENTITY_AS]->(e2)
         SET r.matchType = $matchType,
             r.similarityScore = $similarityScore,
             r.reviewedBy = $reviewedById,
             r.reviewedAt = $reviewedAt,
             r.status = 'CONFIRMED'`,
        {
          sourceEntityId: data.sourceEntityId,
          targetEntityId: data.targetEntityId,
          matchType: data.matchType,
          similarityScore: data.similarityScore,
          reviewedById: data.reviewedById || '',
          reviewedAt: (data.reviewedAt || new Date()).toISOString(),
        }
      );
    } catch (error) {
      console.error(`[Neo4jSync] Failed to sync SAME_ENTITY_AS (${data.sourceEntityId} -> ${data.targetEntityId}):`, error);
    } finally {
      await session.close();
    }
  }
}
