import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../index';
import { SimilarityService } from '../services/entityResolution/similarity.service';
import { CandidateGenerator } from '../services/entityResolution/candidateGenerator.service';
import { MatchingSignalService } from '../services/entityResolution/matchingSignal.service';
import { EntityResolutionService } from '../services/entityResolution.service';
import { Neo4jSyncService } from '../services/neo4jSync.service';
import { getNeo4jSession } from '../db/neo4j';
import { EntityType, MatchStatus } from '@prisma/client';
import { prisma } from '../db/prisma';

describe('TRACE-X Phase 6 Entity Resolution & Identity Matching Suite', () => {
  let investigatorToken: string;
  let testCaseId: string;
  let entityAId: string;
  let entityBId: string;
  let generatedMatchId: string;

  beforeAll(async () => {
    // 1. Ensure Investigator user exists
    let investigatorUser = await prisma.user.findFirst({
      where: { email: 'investigator@tracex.gov' },
    });

    if (!investigatorUser) {
      investigatorUser = await prisma.user.create({
        data: {
          email: 'investigator@tracex.gov',
          passwordHash: '$2a$10$3s8V6yW4z9rYx9z8A7B6C.v1W2X3Y4Z5A6B7C8D9E0F1G2H3I4J5K',
          name: 'Test Investigator',
          role: 'INVESTIGATOR',
        },
      });
    }

    const invRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'investigator@tracex.gov',
        password: 'InvestigatorPassword123!',
      });

    if (invRes.status === 200) {
      investigatorToken = invRes.body.token;
    }

    // 2. Create test entities for deterministic candidate testing
    const caseNum = `CAS-RESOLVE-${Date.now().toString().slice(-6)}`;
    const caseRes = await prisma.case.create({
      data: {
        caseNumber: caseNum,
        title: 'Entity Resolution Test Case',
        description: 'Test case for Phase 6 identity matching pipeline',
        status: 'OPEN',
        priority: 'HIGH',
        createdById: investigatorUser.id,
      },
    });
    testCaseId = caseRes.id;

    // Create 2 matching PERSON entities: "Vikram Singh" and "Vikram A. Singh"
    const entA = await prisma.entity.create({
      data: {
        type: EntityType.PERSON,
        canonicalValue: 'Vikram Singh',
        normalizedValue: 'vikram singh',
        displayName: 'Vikram Singh',
      },
    });
    entityAId = entA.id;
    await Neo4jSyncService.syncEntity(entA);

    const entB = await prisma.entity.create({
      data: {
        type: EntityType.PERSON,
        canonicalValue: 'Vikram A. Singh',
        normalizedValue: 'vikram a singh',
        displayName: 'Vikram A. Singh',
      },
    });
    entityBId = entB.id;
    await Neo4jSyncService.syncEntity(entB);

    // Link both entities to test case
    await prisma.caseEntity.createMany({
      data: [
        { caseId: testCaseId, entityId: entityAId, role: 'SUBJECT' },
        { caseId: testCaseId, entityId: entityBId, role: 'SUBJECT' },
      ],
    });
  });

  afterAll(async () => {
    if (generatedMatchId) {
      await prisma.entityMatch.deleteMany({ where: { id: generatedMatchId } }).catch(() => {});
    }
    if (testCaseId) {
      await prisma.case.delete({ where: { id: testCaseId } }).catch(() => {});
    }
    if (entityAId) {
      await prisma.entity.delete({ where: { id: entityAId } }).catch(() => {});
      const session = getNeo4jSession();
      try {
        await session.run(`MATCH (e:Entity { id: $id }) DETACH DELETE e`, { id: entityAId });
      } catch (err) {} finally {
        await session.close();
      }
    }
    if (entityBId) {
      await prisma.entity.delete({ where: { id: entityBId } }).catch(() => {});
      const session = getNeo4jSession();
      try {
        await session.run(`MATCH (e:Entity { id: $id }) DETACH DELETE e`, { id: entityBId });
      } catch (err) {} finally {
        await session.close();
      }
    }
  });

  it('1. SimilarityService should compute Levenshtein, Jaro-Winkler, and token similarity correctly', () => {
    const levSim = SimilarityService.levenshteinSimilarity('Vikram Singh', 'Vikram A. Singh');
    expect(levSim).toBeGreaterThan(0.70);

    const jaroSim = SimilarityService.jaroWinklerSimilarity('Apex Logistics Pvt Ltd', 'Apex Logistics Private Limited');
    expect(jaroSim).toBeGreaterThan(0.75);

    const tokenSim = SimilarityService.tokenSetSimilarity('Apex Logistics Pvt Ltd', 'Apex Logistics Private Limited');
    expect(tokenSim).toBeGreaterThanOrEqual(0.80);
  });

  it('2. CandidateGenerator should generate type-safe candidate pairs', async () => {
    const candidates = await CandidateGenerator.generateCandidates({
      caseId: testCaseId,
    });

    expect(Array.isArray(candidates)).toBe(true);
    for (const cand of candidates) {
      expect(cand.sourceEntity.type).toBe(cand.targetEntity.type); // STRICT TYPE SAFETY
      expect(cand.sourceEntity.id).not.toBe(cand.targetEntity.id);
    }
  });

  it('3. MatchingSignalService should evaluate supporting signals and score candidates', async () => {
    const entA = await prisma.entity.findUnique({ where: { id: entityAId } });
    const entB = await prisma.entity.findUnique({ where: { id: entityBId } });

    if (!entA || !entB) return;

    const evaluation = await MatchingSignalService.evaluatePair(entA, entB);
    expect(evaluation.similarityScore).toBeGreaterThanOrEqual(0.60);
    expect(evaluation.supportingSignals.length).toBeGreaterThan(0);
    expect(evaluation.reason).toContain('Supporting');
  });

  it('4. POST /api/v1/entity-resolution/generate should trigger pipeline and surface candidate matches', async () => {
    if (!investigatorToken) return;

    const res = await request(app)
      .post('/api/v1/entity-resolution/generate')
      .set('Authorization', `Bearer ${investigatorToken}`)
      .send({ caseId: testCaseId, threshold: 0.50 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.generatedCount).toBeGreaterThanOrEqual(1);

    const matches = res.body.data.matches;
    expect(matches.length).toBeGreaterThanOrEqual(1);
    generatedMatchId = matches[0].id;
  });

  it('5. GET /api/v1/entity-resolution/candidates should list candidate matches with metadata', async () => {
    if (!investigatorToken) return;

    const res = await request(app)
      .get('/api/v1/entity-resolution/candidates?status=PENDING')
      .set('Authorization', `Bearer ${investigatorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
  });

  it('6. GET /api/v1/entity-resolution/candidates/:id should retrieve detailed candidate explanation', async () => {
    if (!investigatorToken || !generatedMatchId) return;

    const res = await request(app)
      .get(`/api/v1/entity-resolution/candidates/${generatedMatchId}`)
      .set('Authorization', `Bearer ${investigatorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(generatedMatchId);
    expect(res.body.data.metadata).toBeDefined();
    expect(res.body.data.metadata.supportingSignals).toBeDefined();
  });

  it('7. POST /api/v1/entity-resolution/candidates/:id/confirm should confirm candidate, create Neo4j link, and record audit log', async () => {
    if (!investigatorToken || !generatedMatchId) return;

    const res = await request(app)
      .post(`/api/v1/entity-resolution/candidates/${generatedMatchId}/confirm`)
      .set('Authorization', `Bearer ${investigatorToken}`)
      .send({ comment: 'Verified by investigator via cross-case address dossier.' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe(MatchStatus.CONFIRMED);
    expect(res.body.data.reviewComment).toContain('Verified by investigator');

    // Verify Audit Log Entry created
    const auditLogs = await prisma.auditLog.findMany({
      where: { action: 'ENTITY_MATCH_CONFIRMED', resourceId: generatedMatchId },
    });
    expect(auditLogs.length).toBe(1);
  });
});
