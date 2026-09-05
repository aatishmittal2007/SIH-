import { getNeo4jSession } from '../db/neo4j';
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

export interface CentralityMetric {
  entityId: string;
  degreeCentrality: number;
  betweennessCentrality: number;
  influenceScore: number; // PageRank proxy
  descriptor: string; // NEUTRAL descriptor e.g. "highly connected", "bridge entity", "central node"
  algorithm: string;
  graphScope: string;
  provenance: string;
  calculationTimestamp: string;
}

export interface NetworkPathResult {
  sourceEntityId: string;
  targetEntityId: string;
  hopCount: number;
  pathNodes: Array<{ id: string; labels: string[]; properties: any }>;
  pathRelationships: Array<{ type: string; properties: any }>;
  provenance: string;
}

export class NetworkAnalysisService {
  /**
   * Check if user is authorized to access entity graph (via case assignment or admin)
   */
  private static async checkEntityAuthorization(entityId: string, userRole: string, userId: string): Promise<boolean> {
    if (userRole === UserRole.ADMIN) return true;

    // Check if user is assigned to any case containing this entity
    const caseEntities = await prisma.caseEntity.findMany({
      where: { entityId },
      select: { caseId: true },
    });

    if (caseEntities.length === 0) return true; // Unassigned standalone entity

    const caseIds = caseEntities.map((ce) => ce.caseId);
    const assignment = await prisma.caseAssignment.findFirst({
      where: {
        userId,
        caseId: { in: caseIds },
      },
    });

    return !!assignment;
  }

  /**
   * Helper to get assigned case IDs for investigator
   */
  private static async getAssignedCaseIds(userId: string): Promise<string[]> {
    const assignments = await prisma.caseAssignment.findMany({
      where: { userId },
      select: { caseId: true },
    });
    return assignments.map((a) => a.caseId);
  }

  /**
   * Calculate degree, betweenness, and influence centrality for an entity
   */
  static async getEntityCentrality(entityId: string, userRole: string, userId: string): Promise<CentralityMetric> {
    const isAuthorized = await this.checkEntityAuthorization(entityId, userRole, userId);
    if (!isAuthorized) {
      throw new Error('FORBIDDEN');
    }

    const session = getNeo4jSession();
    try {
      // 1. Degree Centrality Query
      const degreeRes = await session.run(
        `MATCH (e:Entity { id: $entityId })-[r]-(neighbor)
         RETURN count(r) AS degreeCount`,
        { entityId }
      );
      const degree = degreeRes.records[0] ? degreeRes.records[0].get('degreeCount').toNumber() : 0;

      // 2. Betweenness & Bridge proxy query (count 2-hop shortest paths through this node)
      const betweennessRes = await session.run(
        `MATCH (a:Entity)-[r1]-(e:Entity { id: $entityId })-[r2]-(b:Entity)
         WHERE a <> b
         RETURN count(DISTINCT [a, b]) AS bridgeCount`,
        { entityId }
      );
      const bridgeCount = betweennessRes.records[0] ? betweennessRes.records[0].get('bridgeCount').toNumber() : 0;

      // Calculate neutral scores
      const betweennessScore = Math.min(1.0, bridgeCount / 20);
      const influenceScore = Math.min(1.0, degree / 15);

      // Determine neutral descriptor
      let descriptor = 'connected node';
      if (degree >= 5) descriptor = 'highly connected';
      else if (bridgeCount >= 3) descriptor = 'bridge entity';
      else if (degree >= 3) descriptor = 'central node';

      return {
        entityId,
        degreeCentrality: degree,
        betweennessCentrality: betweennessScore,
        influenceScore,
        descriptor,
        algorithm: 'DEGREE_AND_BETWEENNESS_CENTRALITY',
        graphScope: 'GLOBAL_ENTITY_GRAPH',
        provenance: `Neo4j Cypher query on Entity ${entityId}`,
        calculationTimestamp: new Date().toISOString(),
      };
    } catch {
      // Fallback if Neo4j is offline
      const ceCount = await prisma.caseEntity.count({ where: { entityId } });
      const mCount = await prisma.entityMention.count({ where: { entityId } });
      const totalCount = ceCount + mCount;

      return {
        entityId,
        degreeCentrality: totalCount,
        betweennessCentrality: Math.min(1.0, totalCount / 10),
        influenceScore: Math.min(1.0, totalCount / 5),
        descriptor: totalCount > 3 ? 'highly connected' : 'connected node',
        algorithm: 'RELATIONAL_CO_OCCURRENCE',
        graphScope: 'CASE_SCOPED',
        provenance: `PostgreSQL Entity ${entityId}`,
        calculationTimestamp: new Date().toISOString(),
      };
    } finally {
      await session.close().catch(() => {});
    }
  }

  /**
   * Get case subgraph network metrics (degree, component counts, entities)
   */
  static async getCaseNetwork(caseId: string, userRole: string, userId: string): Promise<any> {
    if (userRole !== UserRole.ADMIN) {
      const assignment = await prisma.caseAssignment.findUnique({
        where: { caseId_userId: { caseId, userId } },
      });
      if (!assignment) {
        throw new Error('FORBIDDEN');
      }
    }

    const session = getNeo4jSession();
    try {
      const result = await session.run(
        `MATCH (c:Case { id: $caseId })-[:INVOLVES]->(e:Entity)
         OPTIONAL MATCH (e)-[r]-(other:Entity)
         RETURN e.id AS entityId, e.displayName AS name, e.type AS type, count(r) AS connectionCount`,
        { caseId }
      );

      const nodes = result.records.map((rec) => {
        const connCount = rec.get('connectionCount').toNumber();
        let descriptor = 'connected node';
        if (connCount >= 5) descriptor = 'highly connected';
        else if (connCount >= 3) descriptor = 'central node';

        return {
          entityId: rec.get('entityId'),
          name: rec.get('name'),
          type: rec.get('type'),
          connectionCount: connCount,
          descriptor,
        };
      });

      return {
        caseId,
        totalNodes: nodes.length,
        graphDescriptor: nodes.length > 5 ? 'connected component' : 'small component',
        nodes,
        provenance: `Neo4j Case Network Query for Case ${caseId}`,
        calculationTimestamp: new Date().toISOString(),
      };
    } catch {
      // PostgreSQL Fallback
      const caseEntities = await prisma.caseEntity.findMany({
        where: { caseId },
        include: { entity: true },
      });
      const nodes = caseEntities.map((ce) => ({
        entityId: ce.entityId,
        name: ce.entity.displayName,
        type: ce.entity.type,
        connectionCount: 1,
        descriptor: 'connected node',
      }));
      return {
        caseId,
        totalNodes: nodes.length,
        graphDescriptor: 'connected component',
        nodes,
        provenance: `PostgreSQL Fallback for Case ${caseId}`,
        calculationTimestamp: new Date().toISOString(),
      };
    } finally {
      await session.close().catch(() => {});
    }
  }

  /**
   * Get full interactive graph data with filtering and RBAC security
   */
  static async getInteractiveGraph(
    params: {
      caseId?: string;
      entityType?: string;
      relationshipType?: string;
      searchQuery?: string;
      limit?: number;
    },
    userRole: string,
    userId: string
  ): Promise<{
    nodes: Array<{
      id: string;
      label: string;
      type: string;
      displayName: string;
      canonicalValue?: string;
      properties: any;
      caseIds?: string[];
    }>;
    edges: Array<{
      id: string;
      source: string;
      target: string;
      type: string;
      confidence?: number;
      evidenceId?: string;
      provenance?: string;
      properties: any;
    }>;
    totalNodes: number;
    totalEdges: number;
    graphScope: string;
  }> {
    const limit = Math.min(300, Math.max(10, params.limit || 150));
    let allowedCaseIds: string[] = [];

    if (userRole !== UserRole.ADMIN) {
      allowedCaseIds = await this.getAssignedCaseIds(userId);
      if (params.caseId) {
        if (!allowedCaseIds.includes(params.caseId)) {
          throw new Error('FORBIDDEN');
        }
        allowedCaseIds = [params.caseId];
      } else if (allowedCaseIds.length === 0) {
        return {
          nodes: [],
          edges: [],
          totalNodes: 0,
          totalEdges: 0,
          graphScope: 'CASE_SCOPED',
        };
      }
    } else if (params.caseId) {
      allowedCaseIds = [params.caseId];
    }

    const session = getNeo4jSession();
    try {
      const cypherCaseFilter = allowedCaseIds.length > 0 ? `WHERE c.id IN $caseIds` : ``;

      const cypher = `
        MATCH (c:Case) ${cypherCaseFilter}
        MATCH (c)-[cr:INVOLVES|HAS_EVIDENCE|HAS_EVENT]->(n)
        OPTIONAL MATCH (n)-[r]-(neighbor)
        RETURN c.id AS caseId, c.caseNumber AS caseNumber, c.title AS caseTitle,
               n, labels(n) AS nLabels,
               r, type(r) AS rType, neighbor, labels(neighbor) AS neighborLabels
        LIMIT ${limit}
      `;

      const result = await session.run(cypher, { caseIds: allowedCaseIds });

      const nodeMap = new Map<string, any>();
      const edgeMap = new Map<string, any>();

      for (const record of result.records) {
        const cId = record.get('caseId');
        const cNumber = record.get('caseNumber');
        const cTitle = record.get('caseTitle');

        if (cId && !nodeMap.has(cId)) {
          nodeMap.set(cId, {
            id: cId,
            label: 'Case',
            type: 'CASE',
            displayName: `Case ${cNumber}: ${cTitle}`,
            canonicalValue: cNumber,
            properties: { caseNumber: cNumber, title: cTitle },
            caseIds: [cId],
          });
        }

        const mainNode = record.get('n');
        if (mainNode && mainNode.properties) {
          const props = mainNode.properties;
          const id = props.id;
          const labels: string[] = record.get('nLabels') || [];
          const primaryLabel = labels.find((l) => l !== 'Entity') || labels[0] || 'Entity';
          const type = props.type || (primaryLabel === 'Case' ? 'CASE' : primaryLabel.toUpperCase());
          const name = props.displayName || props.title || props.name || props.canonicalValue || id;

          if (id && !nodeMap.has(id)) {
            nodeMap.set(id, {
              id,
              label: primaryLabel,
              type,
              displayName: name,
              canonicalValue: props.canonicalValue || props.caseNumber || name,
              properties: props,
              caseIds: [cId],
            });

            const caseEdgeId = `${cId}_INVOLVES_${id}`;
            if (!edgeMap.has(caseEdgeId)) {
              edgeMap.set(caseEdgeId, {
                id: caseEdgeId,
                source: cId,
                target: id,
                type: 'INVOLVES',
                confidence: 1.0,
                provenance: `Case ${cNumber} association`,
                properties: { caseId: cId },
              });
            }
          } else if (id && nodeMap.has(id)) {
            const existing = nodeMap.get(id);
            if (!existing.caseIds.includes(cId)) {
              existing.caseIds.push(cId);
            }
          }
        }

        const rel = record.get('r');
        const neighbor = record.get('neighbor');
        if (rel && neighbor && neighbor.properties) {
          const nProps = neighbor.properties;
          const nId = nProps.id;
          const nLabels: string[] = record.get('neighborLabels') || [];
          const nPrimaryLabel = nLabels.find((l) => l !== 'Entity') || nLabels[0] || 'Entity';
          const nType = nProps.type || (nPrimaryLabel === 'Case' ? 'CASE' : nPrimaryLabel.toUpperCase());
          const nName = nProps.displayName || nProps.title || nProps.name || nProps.canonicalValue || nId;

          if (nId && !nodeMap.has(nId)) {
            nodeMap.set(nId, {
              id: nId,
              label: nPrimaryLabel,
              type: nType,
              displayName: nName,
              canonicalValue: nProps.canonicalValue || nProps.caseNumber || nName,
              properties: nProps,
              caseIds: [cId],
            });
          }

          const rType = record.get('rType');
          const edgeId = `${mainNode.properties.id}_${rType}_${nId}`;

          if (!edgeMap.has(edgeId)) {
            edgeMap.set(edgeId, {
              id: edgeId,
              source: mainNode.properties.id,
              target: nId,
              type: rType,
              confidence: rel.properties?.confidence || 0.9,
              evidenceId: rel.properties?.evidenceId || null,
              provenance: rel.properties?.provenance || `Relationship ${rType}`,
              properties: rel.properties || {},
            });
          }
        }
      }

      let nodes = Array.from(nodeMap.values());
      let edges = Array.from(edgeMap.values());

      if (params.entityType && params.entityType !== 'ALL') {
        nodes = nodes.filter((n) => n.type.toUpperCase() === params.entityType!.toUpperCase() || n.label.toUpperCase() === params.entityType!.toUpperCase());
        const validNodeIds = new Set(nodes.map((n) => n.id));
        edges = edges.filter((e) => validNodeIds.has(e.source) && validNodeIds.has(e.target));
      }

      if (params.relationshipType && params.relationshipType !== 'ALL') {
        edges = edges.filter((e) => e.type.toUpperCase() === params.relationshipType!.toUpperCase());
      }

      if (params.searchQuery && params.searchQuery.trim()) {
        const q = params.searchQuery.toLowerCase().trim();
        nodes = nodes.filter(
          (n) =>
            n.displayName.toLowerCase().includes(q) ||
            (n.canonicalValue && n.canonicalValue.toLowerCase().includes(q)) ||
            n.type.toLowerCase().includes(q) ||
            n.id.toLowerCase().includes(q)
        );
        const validNodeIds = new Set(nodes.map((n) => n.id));
        edges = edges.filter((e) => validNodeIds.has(e.source) && validNodeIds.has(e.target));
      }

      return {
        nodes,
        edges,
        totalNodes: nodes.length,
        totalEdges: edges.length,
        graphScope: allowedCaseIds.length > 0 ? 'CASE_SCOPED' : 'GLOBAL_CROSS_CASE',
      };
    } catch {
      // PostgreSQL Relational Fallback when Neo4j is offline or empty
      const whereCase = allowedCaseIds.length > 0 ? { id: { in: allowedCaseIds } } : {};
      const cases = await prisma.case.findMany({
        where: whereCase,
        include: {
          caseEntities: { include: { entity: true } },
          evidence: { include: { entityMentions: { include: { entity: true } }, source: true } },
          events: true,
        },
        take: 20,
      });

      const nodeMap = new Map<string, any>();
      const edgeMap = new Map<string, any>();

      for (const c of cases) {
        nodeMap.set(c.id, {
          id: c.id,
          label: 'Case',
          type: 'CASE',
          displayName: `Case ${c.caseNumber}: ${c.title}`,
          canonicalValue: c.caseNumber,
          properties: { caseNumber: c.caseNumber, title: c.title, status: c.status, priority: c.priority },
          caseIds: [c.id],
        });

        for (const ce of c.caseEntities) {
          const e = ce.entity;
          if (!nodeMap.has(e.id)) {
            nodeMap.set(e.id, {
              id: e.id,
              label: 'Entity',
              type: e.type,
              displayName: e.displayName || e.canonicalValue,
              canonicalValue: e.canonicalValue,
              properties: { type: e.type, canonicalValue: e.canonicalValue, normalizedValue: e.normalizedValue },
              caseIds: [c.id],
            });
          }
          const edgeId = `${c.id}_INVOLVES_${e.id}`;
          edgeMap.set(edgeId, {
            id: edgeId,
            source: c.id,
            target: e.id,
            type: 'INVOLVES',
            confidence: ce.confidence,
            provenance: `Role: ${ce.role}`,
            properties: { role: ce.role },
          });
        }

        for (const ev of c.evidence) {
          if (!nodeMap.has(ev.id)) {
            nodeMap.set(ev.id, {
              id: ev.id,
              label: 'Evidence',
              type: 'EVIDENCE',
              displayName: ev.title,
              canonicalValue: ev.fileName,
              properties: { fileName: ev.fileName, type: ev.type, hash: ev.hash, source: ev.source?.name },
              caseIds: [c.id],
            });
          }
          const evEdgeId = `${c.id}_HAS_EVIDENCE_${ev.id}`;
          edgeMap.set(evEdgeId, {
            id: evEdgeId,
            source: c.id,
            target: ev.id,
            type: 'HAS_EVIDENCE',
            confidence: 1.0,
            provenance: `Evidence record ${ev.title}`,
            properties: {},
          });

          for (const m of ev.entityMentions) {
            const e = m.entity;
            if (!nodeMap.has(e.id)) {
              nodeMap.set(e.id, {
                id: e.id,
                label: 'Entity',
                type: e.type,
                displayName: e.displayName || e.canonicalValue,
                canonicalValue: e.canonicalValue,
                properties: { type: e.type, canonicalValue: e.canonicalValue },
                caseIds: [c.id],
              });
            }
            const mEdgeId = `${ev.id}_MENTIONS_${e.id}`;
            edgeMap.set(mEdgeId, {
              id: mEdgeId,
              source: ev.id,
              target: e.id,
              type: 'MENTIONS',
              confidence: m.extractionConfidence,
              evidenceId: ev.id,
              provenance: `Extracted text snippet: ${m.originalText}`,
              properties: { originalText: m.originalText },
            });
          }
        }

        for (const evt of c.events) {
          if (!nodeMap.has(evt.id)) {
            nodeMap.set(evt.id, {
              id: evt.id,
              label: 'Event',
              type: 'EVENT',
              displayName: `${evt.type}: ${evt.description.slice(0, 30)}...`,
              canonicalValue: evt.description,
              properties: { type: evt.type, description: evt.description, timestamp: evt.timestamp.toISOString() },
              caseIds: [c.id],
            });
          }
          const evtEdgeId = `${c.id}_HAS_EVENT_${evt.id}`;
          edgeMap.set(evtEdgeId, {
            id: evtEdgeId,
            source: c.id,
            target: evt.id,
            type: 'HAS_EVENT',
            confidence: 1.0,
            provenance: `Event timeline record`,
            properties: {},
          });
        }
      }

      let nodes = Array.from(nodeMap.values());
      let edges = Array.from(edgeMap.values());

      if (params.entityType && params.entityType !== 'ALL') {
        nodes = nodes.filter((n) => n.type.toUpperCase() === params.entityType!.toUpperCase());
        const validNodeIds = new Set(nodes.map((n) => n.id));
        edges = edges.filter((e) => validNodeIds.has(e.source) && validNodeIds.has(e.target));
      }

      if (params.relationshipType && params.relationshipType !== 'ALL') {
        edges = edges.filter((e) => e.type.toUpperCase() === params.relationshipType!.toUpperCase());
      }

      if (params.searchQuery && params.searchQuery.trim()) {
        const q = params.searchQuery.toLowerCase().trim();
        nodes = nodes.filter(
          (n) =>
            n.displayName.toLowerCase().includes(q) ||
            (n.canonicalValue && n.canonicalValue.toLowerCase().includes(q)) ||
            n.type.toLowerCase().includes(q) ||
            n.id.toLowerCase().includes(q)
        );
        const validNodeIds = new Set(nodes.map((n) => n.id));
        edges = edges.filter((e) => validNodeIds.has(e.source) && validNodeIds.has(e.target));
      }

      return {
        nodes,
        edges,
        totalNodes: nodes.length,
        totalEdges: edges.length,
        graphScope: allowedCaseIds.length > 0 ? 'CASE_SCOPED' : 'GLOBAL_CROSS_CASE',
      };
    } finally {
      await session.close().catch(() => {});
    }
  }

  /**
   * Bounded graph expansion starting from a root node
   */
  static async expandNode(
    nodeId: string,
    maxDepth: number = 1,
    limit: number = 50,
    userRole: string,
    userId: string
  ): Promise<{
    rootNodeId: string;
    nodes: any[];
    edges: any[];
    depth: number;
    totalNodes: number;
    totalEdges: number;
  }> {
    const isAuthorized = await this.checkEntityAuthorization(nodeId, userRole, userId);
    if (!isAuthorized) {
      throw new Error('FORBIDDEN');
    }

    const cappedDepth = Math.min(6, Math.max(1, maxDepth));
    const cappedLimit = Math.min(200, Math.max(1, limit));

    let allowedCaseIds: string[] = [];
    if (userRole !== UserRole.ADMIN) {
      allowedCaseIds = await this.getAssignedCaseIds(userId);
    }

    const session = getNeo4jSession();
    try {
      const cypher = `
        MATCH (root { id: $nodeId })
        MATCH path = (root)-[*1..${cappedDepth}]-(neighbor)
        RETURN path
        LIMIT ${cappedLimit}
      `;

      const result = await session.run(cypher, { nodeId });

      const nodeMap = new Map<string, any>();
      const edgeMap = new Map<string, any>();

      for (const record of result.records) {
        const path = record.get('path');

        for (const segment of path.segments) {
          const startProps = segment.start.properties;
          const endProps = segment.end.properties;
          const relProps = segment.relationship.properties;
          const relType = segment.relationship.type;

          const startLabel = segment.start.labels[0] || 'Entity';
          const endLabel = segment.end.labels[0] || 'Entity';

          if (!nodeMap.has(startProps.id)) {
            nodeMap.set(startProps.id, {
              id: startProps.id,
              label: startLabel,
              type: startProps.type || startLabel.toUpperCase(),
              displayName: startProps.displayName || startProps.title || startProps.name || startProps.canonicalValue || startProps.id,
              canonicalValue: startProps.canonicalValue || startProps.caseNumber || startProps.id,
              properties: startProps,
            });
          }

          if (!nodeMap.has(endProps.id)) {
            nodeMap.set(endProps.id, {
              id: endProps.id,
              label: endLabel,
              type: endProps.type || endLabel.toUpperCase(),
              displayName: endProps.displayName || endProps.title || endProps.name || endProps.canonicalValue || endProps.id,
              canonicalValue: endProps.canonicalValue || endProps.caseNumber || endProps.id,
              properties: endProps,
            });
          }

          const edgeId = `${startProps.id}_${relType}_${endProps.id}`;
          if (!edgeMap.has(edgeId)) {
            edgeMap.set(edgeId, {
              id: edgeId,
              source: startProps.id,
              target: endProps.id,
              type: relType,
              confidence: relProps?.confidence || 0.9,
              evidenceId: relProps?.evidenceId || null,
              provenance: relProps?.provenance || `Expanded relationship ${relType}`,
              properties: relProps || {},
            });
          }
        }
      }

      const nodes = Array.from(nodeMap.values());
      const edges = Array.from(edgeMap.values());

      return {
        rootNodeId: nodeId,
        nodes,
        edges,
        depth: cappedDepth,
        totalNodes: nodes.length,
        totalEdges: edges.length,
      };
    } catch {
      // PostgreSQL Relational Expansion Fallback
      const entity = await prisma.entity.findUnique({
        where: { id: nodeId },
        include: {
          caseEntities: { include: { case: true } },
          mentions: { include: { evidence: true } },
        },
      });

      const nodeMap = new Map<string, any>();
      const edgeMap = new Map<string, any>();

      if (entity) {
        nodeMap.set(entity.id, {
          id: entity.id,
          label: 'Entity',
          type: entity.type,
          displayName: entity.displayName || entity.canonicalValue,
          canonicalValue: entity.canonicalValue,
          properties: { type: entity.type, canonicalValue: entity.canonicalValue },
        });

        for (const ce of entity.caseEntities) {
          if (userRole === UserRole.ADMIN || allowedCaseIds.includes(ce.caseId)) {
            nodeMap.set(ce.case.id, {
              id: ce.case.id,
              label: 'Case',
              type: 'CASE',
              displayName: `Case ${ce.case.caseNumber}: ${ce.case.title}`,
              canonicalValue: ce.case.caseNumber,
              properties: { caseNumber: ce.case.caseNumber, title: ce.case.title },
            });
            const edgeId = `${ce.case.id}_INVOLVES_${entity.id}`;
            edgeMap.set(edgeId, {
              id: edgeId,
              source: ce.case.id,
              target: entity.id,
              type: 'INVOLVES',
              confidence: ce.confidence,
              provenance: `Role: ${ce.role}`,
              properties: { role: ce.role },
            });
          }
        }
      }

      const nodes = Array.from(nodeMap.values());
      const edges = Array.from(edgeMap.values());

      return {
        rootNodeId: nodeId,
        nodes,
        edges,
        depth: cappedDepth,
        totalNodes: nodes.length,
        totalEdges: edges.length,
      };
    } finally {
      await session.close().catch(() => {});
    }
  }

  /**
   * Get detailed metadata for a single node (Entity, Case, Evidence, Event)
   */
  static async getNodeDetails(nodeId: string, userRole: string, userId: string): Promise<any> {
    const isEntityAuth = await this.checkEntityAuthorization(nodeId, userRole, userId);
    if (!isEntityAuth) {
      throw new Error('FORBIDDEN');
    }

    const entity = await prisma.entity.findUnique({
      where: { id: nodeId },
      include: {
        caseEntities: { include: { case: true } },
        mentions: { include: { evidence: { include: { source: true } } } },
        sourceMatches: { include: { targetEntity: true } },
        targetMatches: { include: { sourceEntity: true } },
      },
    });

    if (entity) {
      const centrality = await this.getEntityCentrality(nodeId, userRole, userId).catch(() => null);

      return {
        id: entity.id,
        nodeType: 'ENTITY',
        entityId: entity.id,
        displayName: entity.displayName,
        canonicalValue: entity.canonicalValue,
        type: entity.type,
        normalizedValue: entity.normalizedValue,
        properties: ((entity as any).metadata as Record<string, any>) || {},
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
        cases: entity.caseEntities.map((ce: any) => ({
          caseId: ce.caseId,
          caseNumber: ce.case.caseNumber,
          title: ce.case.title,
          role: ce.role,
          confidence: ce.confidence,
        })),
        evidenceMentions: entity.mentions.map((m: any) => ({
          evidenceId: m.evidenceId,
          evidenceTitle: m.evidence.title,
          sourceName: m.evidence.source?.name,
          extractionConfidence: m.extractionConfidence,
          originalText: m.originalText,
        })),
        resolvedMatches: [
          ...entity.sourceMatches.map((m: any) => ({
            matchId: m.id,
            status: m.status,
            similarityScore: m.similarityScore,
            targetEntity: m.targetEntity.displayName || m.targetEntity.canonicalValue,
          })),
          ...entity.targetMatches.map((m: any) => ({
            matchId: m.id,
            status: m.status,
            similarityScore: m.similarityScore,
            sourceEntity: m.sourceEntity.displayName || m.sourceEntity.canonicalValue,
          })),
        ],
        centrality,
      };
    }

    const caseObj = await prisma.case.findUnique({
      where: { id: nodeId },
      include: {
        createdBy: { select: { name: true, email: true } },
        assignments: { include: { user: { select: { name: true, role: true } } } },
        _count: { select: { evidence: true, caseEntities: true, events: true } },
      },
    });

    if (caseObj) {
      if (userRole !== UserRole.ADMIN) {
        const isAssigned = caseObj.assignments.some((a: any) => a.userId === userId);
        if (!isAssigned) {
          throw new Error('FORBIDDEN');
        }
      }

      return {
        nodeType: 'CASE',
        caseId: caseObj.id,
        caseNumber: caseObj.caseNumber,
        title: caseObj.title,
        status: caseObj.status,
        priority: caseObj.priority,
        description: caseObj.description,
        createdBy: caseObj.createdBy,
        assignees: caseObj.assignments.map((a: any) => a.user),
        counts: caseObj._count,
        createdAt: caseObj.createdAt,
      };
    }

    const evidence = await prisma.evidence.findUnique({
      where: { id: nodeId },
      include: {
        source: true,
        case: true,
        entityMentions: { include: { entity: true } },
      },
    });

    if (evidence) {
      if (userRole !== UserRole.ADMIN) {
        const isAssigned = await prisma.caseAssignment.findUnique({
          where: { caseId_userId: { caseId: evidence.caseId, userId } },
        });
        if (!isAssigned) {
          throw new Error('FORBIDDEN');
        }
      }

      return {
        nodeType: 'EVIDENCE',
        evidenceId: evidence.id,
        title: evidence.title,
        type: evidence.type,
        fileName: evidence.fileName,
        hash: evidence.hash,
        source: evidence.source,
        case: { id: evidence.case.id, caseNumber: evidence.case.caseNumber, title: evidence.case.title },
        mentionsCount: evidence.entityMentions.length,
        createdAt: evidence.createdAt,
      };
    }

    const event = await prisma.event.findUnique({
      where: { id: nodeId },
      include: {
        source: true,
        case: true,
        locationEntity: true,
      },
    });

    if (event) {
      if (userRole !== UserRole.ADMIN) {
        const isAssigned = await prisma.caseAssignment.findUnique({
          where: { caseId_userId: { caseId: event.caseId, userId } },
        });
        if (!isAssigned) {
          throw new Error('FORBIDDEN');
        }
      }

      return {
        nodeType: 'EVENT',
        eventId: event.id,
        type: event.type,
        description: event.description,
        timestamp: event.timestamp,
        source: event.source,
        case: { id: event.case.id, caseNumber: event.case.caseNumber, title: event.case.title },
        locationEntity: event.locationEntity,
        createdAt: event.createdAt,
      };
    }

    throw new Error('NOT_FOUND');
  }

  /**
   * Get detailed metadata for a relationship between nodes
   */
  static async getRelationshipDetails(
    sourceId: string,
    targetId: string,
    type?: string,
    userRole: string = UserRole.ADMIN,
    userId: string = ''
  ): Promise<any> {
    const auth1 = await this.checkEntityAuthorization(sourceId, userRole, userId);
    const auth2 = await this.checkEntityAuthorization(targetId, userRole, userId);
    if (!auth1 || !auth2) {
      throw new Error('FORBIDDEN');
    }

    const session = getNeo4jSession();
    try {
      const typeFilter = type ? `:${type}` : ``;
      const result = await session.run(
        `MATCH (a { id: $sourceId })-[r${typeFilter}]-(b { id: $targetId })
         RETURN type(r) AS relType, properties(r) AS properties, labels(a) AS aLabels, labels(b) AS bLabels`,
        { sourceId, targetId }
      );

      if (result.records.length > 0) {
        const rec = result.records[0];
        const properties = rec.get('properties');
        let evidenceDetails = null;

        if (properties.evidenceId) {
          evidenceDetails = await prisma.evidence.findUnique({
            where: { id: properties.evidenceId },
            include: { source: true },
          });
        }

        return {
          sourceId,
          targetId,
          relationshipType: rec.get('relType'),
          confidence: properties.confidence || 1.0,
          evidenceId: properties.evidenceId || null,
          evidenceDetails,
          provenance: properties.provenance || 'Evidence-backed network association',
          originalText: properties.originalText || null,
          createdAt: properties.createdAt || null,
          properties,
        };
      }
    } catch {
      // Fallback
    } finally {
      await session.close().catch(() => {});
    }

    return {
      sourceId,
      targetId,
      relationshipType: type || 'ASSOCIATED_WITH',
      confidence: 0.9,
      provenance: `Direct relationship between ${sourceId} and ${targetId}`,
      properties: {},
    };
  }

  /**
   * Find bounded shortest path between two entities
   */
  static async findShortestPath(
    sourceEntityId: string,
    targetEntityId: string,
    maxDepth: number = 4,
    userRole: string,
    userId: string
  ): Promise<NetworkPathResult | null> {
    const auth1 = await this.checkEntityAuthorization(sourceEntityId, userRole, userId);
    const auth2 = await this.checkEntityAuthorization(targetEntityId, userRole, userId);
    if (!auth1 || !auth2) {
      throw new Error('FORBIDDEN');
    }

    // Cap maxDepth to 6 to prevent unbounded graph query execution
    const cappedDepth = Math.min(6, Math.max(1, maxDepth));

    const session = getNeo4jSession();
    try {
      const cypher = `
        MATCH (source:Entity { id: $sourceId }), (target:Entity { id: $targetId })
        MATCH path = shortestPath((source)-[*..${cappedDepth}]-(target))
        RETURN path
      `;

      const result = await session.run(cypher, {
        sourceId: sourceEntityId,
        targetId: targetEntityId,
      });

      if (result.records.length === 0) return null;

      const path = result.records[0].get('path');
      const nodes = path.segments.map((seg: any) => ({
        id: seg.end.properties.id,
        labels: seg.end.labels,
        properties: seg.end.properties,
      }));

      // Add start node
      nodes.unshift({
        id: path.start.properties.id,
        labels: path.start.labels,
        properties: path.start.properties,
      });

      const relationships = path.segments.map((seg: any) => ({
        type: seg.relationship.type,
        properties: seg.relationship.properties,
      }));

      return {
        sourceEntityId,
        targetEntityId,
        hopCount: path.length,
        pathNodes: nodes,
        pathRelationships: relationships,
        provenance: `Neo4j ShortestPath (maxDepth=${cappedDepth}) between ${sourceEntityId} and ${targetEntityId}`,
      };
    } finally {
      await session.close();
    }
  }
}
