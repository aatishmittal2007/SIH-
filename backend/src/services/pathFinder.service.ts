import { UserRole } from '@prisma/client';
import { prisma } from '../db/prisma';
import { getNeo4jDriver } from '../db/neo4j';

export interface PathFinderResult {
  sourceEntity: { id: string; name: string; type: string };
  targetEntity: { id: string; name: string; type: string };
  pathFound: boolean;
  length?: number;
  pathNodes: Array<{ id: string; label: string; name: string; type: string }>;
  pathRelationships: Array<{ type: string; properties?: any }>;
  provenanceSummary: Array<{
    step: number;
    from: string;
    relationship: string;
    to: string;
    evidenceIds?: string[];
  }>;
}

export class PathFinderService {
  /**
   * Find shortest path between two entities in Neo4j (or PostgreSQL fallback)
   */
  static async findPath(
    sourceEntityId: string,
    targetEntityId: string,
    maxDepth: number = 5,
    userRole: string,
    userId: string
  ): Promise<PathFinderResult> {
    const sourceEntity = await prisma.entity.findUnique({
      where: { id: sourceEntityId },
      include: { caseEntities: true },
    });

    const targetEntity = await prisma.entity.findUnique({
      where: { id: targetEntityId },
      include: { caseEntities: true },
    });

    if (!sourceEntity || !targetEntity) {
      throw new Error('NOT_FOUND');
    }

    // RBAC check: user must be assigned to at least one case associated with source or target entity
    if (userRole !== UserRole.ADMIN) {
      const caseIds = [
        ...sourceEntity.caseEntities.map((ce) => ce.caseId),
        ...targetEntity.caseEntities.map((ce) => ce.caseId),
      ];

      if (caseIds.length > 0) {
        const assignmentCount = await prisma.caseAssignment.count({
          where: {
            userId,
            caseId: { in: caseIds },
          },
        });
        if (assignmentCount === 0) {
          throw new Error('FORBIDDEN');
        }
      }
    }

    const effectiveMaxDepth = Math.min(Math.max(1, maxDepth), 6);

    // Try Neo4j graph path search
    const neo4jDriver = getNeo4jDriver();
    if (neo4jDriver) {
      try {
        const session = neo4jDriver.session();
        try {
          const cypher = `
            MATCH (source:Entity {id: $sourceEntityId}), (target:Entity {id: $targetEntityId})
            MATCH path = shortestPath((source)-[*..${effectiveMaxDepth}]-(target))
            RETURN path, nodes(path) as pathNodes, relationships(path) as pathRels
          `;

          const result = await session.run(cypher, {
            sourceEntityId,
            targetEntityId,
          });

          if (result.records.length > 0) {
            const record = result.records[0];
            const rawNodes = record.get('pathNodes');
            const rawRels = record.get('pathRels');

            const pathNodes = rawNodes.map((node: any) => ({
              id: node.properties.id || node.properties.entityId || node.identity.toString(),
              label: node.labels[0] || 'Entity',
              name: node.properties.name || node.properties.displayName || node.properties.id || 'Entity',
              type: node.properties.type || node.labels[0] || 'ENTITY',
            }));

            const pathRelationships = rawRels.map((rel: any) => ({
              type: rel.type,
              properties: rel.properties,
            }));

            const provenanceSummary: Array<{
              step: number;
              from: string;
              relationship: string;
              to: string;
              evidenceIds?: string[];
            }> = [];

            for (let i = 0; i < pathRelationships.length; i++) {
              const fromNode = pathNodes[i];
              const toNode = pathNodes[i + 1];
              const rel = pathRelationships[i];
              provenanceSummary.push({
                step: i + 1,
                from: fromNode.name,
                relationship: rel.type,
                to: toNode ? toNode.name : 'Target',
                evidenceIds: rel.properties?.evidenceId ? [rel.properties.evidenceId] : [],
              });
            }

            return {
              sourceEntity: {
                id: sourceEntity.id,
                name: sourceEntity.displayName,
                type: sourceEntity.type,
              },
              targetEntity: {
                id: targetEntity.id,
                name: targetEntity.displayName,
                type: targetEntity.type,
              },
              pathFound: true,
              length: pathRelationships.length,
              pathNodes,
              pathRelationships,
              provenanceSummary,
            };
          }
        } finally {
          await session.close();
        }
      } catch (err) {
        // Fall back to Relational Co-occurrence Path Search
      }
    }

    // Fallback: Check direct shared cases in PostgreSQL
    const sharedCaseEntities = await prisma.caseEntity.findMany({
      where: {
        entityId: { in: [sourceEntityId, targetEntityId] },
      },
    });

    const casesByEntity: Record<string, string[]> = {
      [sourceEntityId]: [],
      [targetEntityId]: [],
    };

    for (const ce of sharedCaseEntities) {
      if (casesByEntity[ce.entityId]) {
        casesByEntity[ce.entityId].push(ce.caseId);
      }
    }

    const commonCases = casesByEntity[sourceEntityId].filter((cId) =>
      casesByEntity[targetEntityId].includes(cId)
    );

    if (commonCases.length > 0) {
      const commonCase = await prisma.case.findUnique({
        where: { id: commonCases[0] },
      });

      return {
        sourceEntity: {
          id: sourceEntity.id,
          name: sourceEntity.displayName,
          type: sourceEntity.type,
        },
        targetEntity: {
          id: targetEntity.id,
          name: targetEntity.displayName,
          type: targetEntity.type,
        },
        pathFound: true,
        length: 2,
        pathNodes: [
          {
            id: sourceEntity.id,
            label: 'Entity',
            name: sourceEntity.displayName,
            type: sourceEntity.type,
          },
          {
            id: commonCase?.id || commonCases[0],
            label: 'Case',
            name: commonCase ? `Case ${commonCase.caseNumber}` : 'Shared Case',
            type: 'CASE',
          },
          {
            id: targetEntity.id,
            label: 'Entity',
            name: targetEntity.displayName,
            type: targetEntity.type,
          },
        ],
        pathRelationships: [
          { type: 'CO_OCCURS_IN_CASE' },
          { type: 'CO_OCCURS_IN_CASE' },
        ],
        provenanceSummary: [
          {
            step: 1,
            from: sourceEntity.displayName,
            relationship: 'CO_OCCURS_IN_CASE',
            to: commonCase ? `Case ${commonCase.caseNumber}` : 'Shared Case',
          },
          {
            step: 2,
            from: commonCase ? `Case ${commonCase.caseNumber}` : 'Shared Case',
            relationship: 'INVOLVES_ENTITY',
            to: targetEntity.displayName,
          },
        ],
      };
    }

    return {
      sourceEntity: {
        id: sourceEntity.id,
        name: sourceEntity.displayName,
        type: sourceEntity.type,
      },
      targetEntity: {
        id: targetEntity.id,
        name: targetEntity.displayName,
        type: targetEntity.type,
      },
      pathFound: false,
      length: 0,
      pathNodes: [],
      pathRelationships: [],
      provenanceSummary: [],
    };
  }
}
