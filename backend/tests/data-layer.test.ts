import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/db/prisma';
import { getNeo4jSession, closeNeo4j } from '../src/db/neo4j';

describe('TRACE-X Data Layer Integration Tests', () => {
  beforeAll(async () => {
    // Ensure connection
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await closeNeo4j();
  });

  // ---------------------------------------------------------
  // 1. POSTGRES DATA INTEGRITY & RELATIONSHIP TESTS
  // ---------------------------------------------------------
  describe('PostgreSQL Provenance & Relational Schema', () => {
    it('should retrieve cases with associated evidence, entities, and createdBy user', async () => {
      const caseOne = await prisma.case.findUnique({
        where: { caseNumber: 'TX-2024-001' },
        include: {
          createdBy: true,
          evidence: {
            include: {
              source: true,
              entityMentions: {
                include: {
                  entity: true,
                },
              },
            },
          },
          caseEntities: {
            include: {
              entity: true,
            },
          },
          contradictions: {
            include: {
              claims: true,
            },
          },
        },
      });

      expect(caseOne).not.toBeNull();
      expect(caseOne?.title).toBe('Operation Black Lotus');
      expect(caseOne?.createdBy.email).toContain('tracex.gov.in');
      expect(caseOne?.evidence.length).toBeGreaterThan(0);

      // Verify evidence provenance
      const firEvidence = caseOne?.evidence.find((e) => e.title.includes('FIR 402/2024'));
      expect(firEvidence).toBeDefined();
      expect(firEvidence?.source?.name).toContain('Mumbai Police');
      expect(firEvidence?.entityMentions.length).toBeGreaterThan(0);
    });

    it('should verify bridge entity (+919876543210) exists across multiple cases', async () => {
      const bridgeEntity = await prisma.entity.findFirst({
        where: { normalizedValue: '+919876543210' },
        include: {
          caseEntities: {
            include: {
              case: true,
            },
          },
          mentions: {
            include: {
              case: true,
              evidence: true,
            },
          },
        },
      });

      expect(bridgeEntity).not.toBeNull();
      expect(bridgeEntity?.type).toBe('PHONE');

      const caseIds = bridgeEntity?.caseEntities.map((ce) => ce.case.caseNumber);
      expect(caseIds).toContain('TX-2024-001');
      expect(caseIds).toContain('TX-2024-002');

      // Check evidence provenance on mentions
      expect(bridgeEntity?.mentions.length).toBeGreaterThanOrEqual(2);
    });

    it('should retrieve contradiction with evidence claims and timestamps', async () => {
      const contradictions = await prisma.contradiction.findMany({
        where: { status: 'ACTIVE' },
        include: {
          claims: {
            include: {
              evidence: true,
              entity: true,
            },
          },
        },
      });

      expect(contradictions.length).toBeGreaterThan(0);
      const travelContradiction = contradictions.find(
        (c) => c.type === 'IMPOSSIBLE_TRAVEL_TIMELINE'
      );
      expect(travelContradiction).toBeDefined();
      expect(travelContradiction?.claims.length).toBe(2);

      const claim1 = travelContradiction?.claims[0];
      const claim2 = travelContradiction?.claims[1];
      expect(claim1?.evidence).toBeDefined();
      expect(claim2?.evidence).toBeDefined();
    });
  });

  // ---------------------------------------------------------
  // 2. NEO4J GRAPH QUERY & PROVENANCE TESTS
  // ---------------------------------------------------------
  describe('Neo4j Graph Database & Topology', () => {
    it('should count all core nodes in Neo4j graph', async () => {
      const session = getNeo4jSession();
      try {
        const result = await session.run(
          `MATCH (n) RETURN labels(n) AS label, count(n) AS count`
        );

        const counts: Record<string, number> = {};
        result.records.forEach((record) => {
          const label = (record.get('label') as string[])[0];
          const count = record.get('count').toNumber();
          counts[label] = count;
        });

        expect(counts['Case']).toBeGreaterThanOrEqual(3);
        expect(counts['Evidence']).toBeGreaterThanOrEqual(6);
        expect(counts['Entity']).toBeGreaterThanOrEqual(12);
        expect(counts['Event']).toBeGreaterThanOrEqual(3);
        expect(counts['Location']).toBeGreaterThanOrEqual(2);
      } finally {
        await session.close();
      }
    });

    it('should query cross-case bridge entities via Cypher', async () => {
      const session = getNeo4jSession();
      try {
        const result = await session.run(
          `MATCH (e:Entity)-[:ASSOCIATED_WITH]->(c:Case)
           WITH e, count(DISTINCT c) AS caseCount, collect(DISTINCT c.caseNumber) AS cases
           WHERE caseCount > 1
           RETURN e.canonicalValue AS entityName, e.type AS type, cases`
        );

        expect(result.records.length).toBeGreaterThan(0);
        const bridgePhoneRecord = result.records.find(
          (r) => r.get('entityName') === '+919876543210'
        );
        expect(bridgePhoneRecord).toBeDefined();

        const cases = bridgePhoneRecord?.get('cases');
        expect(cases).toContain('TX-2024-001');
        expect(cases).toContain('TX-2024-002');
      } finally {
        await session.close();
      }
    });

    it('should verify provenance property on graph relationships', async () => {
      const session = getNeo4jSession();
      try {
        const result = await session.run(
          `MATCH (a:Entity)-[r:CONNECTED_TO]->(b:Entity)
           RETURN r.connectionType AS connType, r.caseId AS caseId, r.provenanceEvidenceId AS evId`
        );

        expect(result.records.length).toBeGreaterThan(0);
        for (const record of result.records) {
          expect(record.get('caseId')).toBeDefined();
          expect(record.get('evId')).toBeDefined();
        }
      } finally {
        await session.close();
      }
    });

    it('should query CONTRADICTS relationships in graph', async () => {
      const session = getNeo4jSession();
      try {
        const result = await session.run(
          `MATCH (e:Entity)-[r:CONTRADICTS]->(ev:Evidence)
           RETURN e.canonicalValue AS entityName, ev.title AS evidenceTitle, r.reason AS reason`
        );

        expect(result.records.length).toBeGreaterThan(0);
        const firstRecord = result.records[0];
        expect(firstRecord.get('entityName')).toBe('Vikram Malhotra');
        expect(firstRecord.get('reason')).toContain('Impossible travel timeline');
      } finally {
        await session.close();
      }
    });
  });

  // ---------------------------------------------------------
  // 3. CROSS-DATABASE CONSISTENCY TESTS
  // ---------------------------------------------------------
  describe('PostgreSQL and Neo4j Cross-Database Sync Validation', () => {
    it('should verify all Postgres entity IDs match Neo4j entity nodes', async () => {
      const pgEntities = await prisma.entity.findMany();
      const session = getNeo4jSession();
      try {
        const result = await session.run(`MATCH (e:Entity) RETURN e.id AS id`);
        const neo4jIds = result.records.map((r) => r.get('id'));

        expect(neo4jIds.length).toBe(pgEntities.length);
        for (const pgEnt of pgEntities) {
          expect(neo4jIds).toContain(pgEnt.id);
        }
      } finally {
        await session.close();
      }
    });
  });
});
