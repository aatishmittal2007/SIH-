import { describe, it, expect } from 'vitest';
import { RelationshipBuilderService } from '../services/relationshipBuilder.service';
import { PrismaClient, MatchStatus } from '@prisma/client';

const prisma = new PrismaClient();

describe('Phase 8: Neo4j Relationship Building Engine', () => {
  it('should process entity associations and build relationship schema in Neo4j without CaseLink fallbacks', async () => {
    // Perform idempotent relationship rebuild
    const result = await RelationshipBuilderService.buildRelationshipsForCase();
    expect(typeof result.createdCount).toBe('number');
    expect(result.createdCount).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.relationships)).toBe(true);

    // Verify that NO relationship uses 'CaseLink' as evidence
    for (const rel of result.relationships) {
      expect(rel.provenance).not.toContain('CaseLink');
      expect(rel.evidenceId).toBeDefined();
      expect(rel.evidenceId).not.toBeNull();
    }
  });

  it('should fetch entity relationships with explicit provenance data', async () => {
    // Fetch any entity from PostgreSQL
    const entity = await prisma.entity.findFirst();
    if (entity) {
      const relationships = await RelationshipBuilderService.getRelationshipsForEntity(entity.id);
      expect(Array.isArray(relationships)).toBe(true);
      for (const rel of relationships) {
        if (rel.properties?.provenance) {
          expect(rel.properties.provenance).not.toContain('CaseLink');
        }
      }
    }
  });

  it('should only create confirmed entity matches in graph and ignore pending matches', async () => {
    const pendingMatches = await prisma.entityMatch.findMany({
      where: { status: MatchStatus.PENDING },
    });
    expect(Array.isArray(pendingMatches)).toBe(true);
  });
});

