import { describe, it, expect } from 'vitest';
import { NetworkAnalysisService } from '../services/networkAnalysis.service';
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

describe('Phase 11: Network Analysis Engine', () => {
  it('should calculate entity centrality metrics with neutral terminology', async () => {
    const entity = await prisma.entity.findFirst();
    if (entity) {
      const centrality = await NetworkAnalysisService.getEntityCentrality(entity.id, UserRole.ADMIN, 'admin-id');
      expect(centrality).toBeDefined();
      expect(centrality.entityId).toBe(entity.id);
      expect(typeof centrality.degreeCentrality).toBe('number');
      expect(typeof centrality.descriptor).toBe('string');
      expect(['connected node', 'highly connected', 'bridge entity', 'central node']).toContain(centrality.descriptor);
    }
  });

  it('should fetch case network structure', async () => {
    const caseObj = await prisma.case.findFirst();
    if (caseObj) {
      const network = await NetworkAnalysisService.getCaseNetwork(caseObj.id, UserRole.ADMIN, 'admin-id');
      expect(network).toBeDefined();
      expect(network.caseId).toBe(caseObj.id);
      expect(Array.isArray(network.nodes)).toBe(true);
    }
  });

  it('should fetch interactive graph structure with filters', async () => {
    const graph = await NetworkAnalysisService.getInteractiveGraph({
      entityType: 'PERSON',
      limit: 10,
    }, UserRole.ADMIN, 'admin-id');
    expect(graph).toBeDefined();
    expect(graph.nodes).toBeDefined();
    expect(graph.edges).toBeDefined();
  });

  it('should expand node neighborhood', async () => {
    const graph = await NetworkAnalysisService.expandNode('ent-person-001', 1, 10, UserRole.ADMIN, 'admin-id');
    expect(graph).toBeDefined();
  });

  it('should fetch detailed metadata for a node', async () => {
    const entity = await prisma.entity.findFirst();
    if (entity) {
      const details = await NetworkAnalysisService.getNodeDetails(entity.id, UserRole.ADMIN, 'admin-id');
      expect(details).toBeDefined();
      expect(details.entityId || details.id).toBe(entity.id);
      expect(details.properties).toBeDefined();
    }
  });

  it('should fetch relationship details between nodes', async () => {
    const rels = await NetworkAnalysisService.getRelationshipDetails('node-1', 'node-2', undefined, UserRole.ADMIN, 'admin-id');
    expect(rels).toBeDefined();
    expect(rels.sourceId).toBe('node-1');
    expect(rels.targetId).toBe('node-2');
  });
});
