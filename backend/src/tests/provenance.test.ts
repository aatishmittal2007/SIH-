import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../index';
import { prisma } from '../db/prisma';
import { ProvenanceService } from '../services/provenance.service';
import { Neo4jSyncService } from '../services/neo4jSync.service';
import { UserRole, EntityType, SourceType, SourceReliability, EvidenceType, ProcessingStatus, ExtractionMethod, CaseEntityRole } from '@prisma/client';
import { getNeo4jSession } from '../db/neo4j';
import { hashPassword } from '../utils/password';

describe('TRACE-X Phase 7 Provenance & Evidence Linking Suite', () => {
  let adminToken: string;
  let investigatorToken: string;
  let unauthorizedToken: string;

  let adminUser: any;
  let investigatorUser: any;
  let unauthorizedUser: any;
 
  let testCaseId: string;
  let unassignedCaseId: string;
  let testSourceId: string;
  let testEvidenceId: string;
  let testEntityId: string;
  let isolatedEntityId: string;
  let testMentionId: string;

  afterAll(async () => {
    // Clean up created test entities, cases, and evidence to restore DB seed state
    const caseIds = [testCaseId, unassignedCaseId].filter(Boolean);
    const entityIds = [testEntityId, isolatedEntityId].filter(Boolean);

    if (caseIds.length > 0) {
      await prisma.entityMention.deleteMany({ where: { caseId: { in: caseIds } } });
      await prisma.caseEntity.deleteMany({ where: { caseId: { in: caseIds } } });
      await prisma.evidenceChunk.deleteMany({ where: { evidence: { caseId: { in: caseIds } } } });
      await prisma.evidenceDocument.deleteMany({ where: { evidence: { caseId: { in: caseIds } } } });
      await prisma.evidence.deleteMany({ where: { caseId: { in: caseIds } } });
      await prisma.caseAssignment.deleteMany({ where: { caseId: { in: caseIds } } });
      await prisma.case.deleteMany({ where: { id: { in: caseIds } } });
    }

    if (testSourceId) {
      await prisma.source.deleteMany({ where: { id: testSourceId } });
    }

    if (entityIds.length > 0) {
      await prisma.entity.deleteMany({ where: { id: { in: entityIds } } });
      const session = getNeo4jSession();
      try {
        await session.run(`MATCH (e:Entity) WHERE e.id IN $ids DETACH DELETE e`, { ids: entityIds });
      } catch (err) {
        // ignore if not present
      } finally {
        await session.close();
      }
    }

    await prisma.user.deleteMany({
      where: { email: { in: ['admin.prov@tracex.gov', 'investigator.prov@tracex.gov', 'unauth.prov@tracex.gov'] } },
    });
  });

  beforeAll(async () => {
    const defaultPasswordHash = await hashPassword('AdminPassword123!');

    // 1. Setup Admin user
    adminUser = await prisma.user.findFirst({ where: { email: 'admin.prov@tracex.gov' } });
    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          email: 'admin.prov@tracex.gov',
          passwordHash: defaultPasswordHash,
          name: 'Admin Provenance Tester',
          role: UserRole.ADMIN,
        },
      });
    }

    // 2. Setup Investigator user
    investigatorUser = await prisma.user.findFirst({ where: { email: 'investigator.prov@tracex.gov' } });
    if (!investigatorUser) {
      investigatorUser = await prisma.user.create({
        data: {
          email: 'investigator.prov@tracex.gov',
          passwordHash: defaultPasswordHash,
          name: 'Investigator Provenance Tester',
          role: UserRole.INVESTIGATOR,
        },
      });
    }

    // 3. Setup Unauthorized Investigator
    unauthorizedUser = await prisma.user.findFirst({ where: { email: 'unauth.prov@tracex.gov' } });
    if (!unauthorizedUser) {
      unauthorizedUser = await prisma.user.create({
        data: {
          email: 'unauth.prov@tracex.gov',
          passwordHash: defaultPasswordHash,
          name: 'Unauthorized Investigator Tester',
          role: UserRole.INVESTIGATOR,
        },
      });
    }

    // Login users to acquire JWT tokens
    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'admin.prov@tracex.gov',
      password: 'AdminPassword123!',
    });
    adminToken = adminLogin.body.data?.token || adminLogin.body.token;

    const invLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'investigator.prov@tracex.gov',
      password: 'AdminPassword123!',
    });
    investigatorToken = invLogin.body.data?.token || invLogin.body.token;

    const unauthLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'unauth.prov@tracex.gov',
      password: 'AdminPassword123!',
    });
    unauthorizedToken = unauthLogin.body.data?.token || unauthLogin.body.token;

    // 4. Create Source
    const source = await prisma.source.create({
      data: {
        name: 'INTERPOL Red Notice Database',
        type: SourceType.POLICE_REPORT,
        reliability: SourceReliability.HIGH,
        description: 'Synthetic database dump for provenance testing',
      },
    });
    testSourceId = source.id;

    // 5. Create Test Case
    const caseNum = `PROV-CASE-${Date.now().toString().slice(-6)}`;
    const testCase = await prisma.case.create({
      data: {
        caseNumber: caseNum,
        title: 'Operation Shadow Provenance',
        description: 'Test case for provenance tracking',
        status: 'OPEN',
        priority: 'HIGH',
        createdById: investigatorUser.id,
      },
    });
    testCaseId = testCase.id;

    // Assign investigatorUser to testCase
    await prisma.caseAssignment.create({
      data: {
        caseId: testCaseId,
        userId: investigatorUser.id,
      },
    });

    // Create Unassigned Case (for RBAC testing)
    const unassignedCaseNum = `PROV-UNASSIGNED-${Date.now().toString().slice(-6)}`;
    const unassignedCase = await prisma.case.create({
      data: {
        caseNumber: unassignedCaseNum,
        title: 'Restricted Provenance Case',
        description: 'Case not assigned to unauthorizedUser',
        status: 'OPEN',
        priority: 'MEDIUM',
        createdById: adminUser.id,
      },
    });
    unassignedCaseId = unassignedCase.id;

    // 6. Create Evidence item
    const evidence = await prisma.evidence.create({
      data: {
        caseId: testCaseId,
        sourceId: testSourceId,
        type: EvidenceType.DOCUMENT,
        title: 'Wiretap Log #9042',
        description: 'Intercepted communications record',
        fileName: 'wiretap_9042.txt',
        storagePath: '/storage/test/wiretap_9042.txt',
        mimeType: 'text/plain',
        hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        processingStatus: ProcessingStatus.COMPLETED,
        textExtractionStatus: 'COMPLETED',
        nlpStatus: 'COMPLETED',
      },
    });
    testEvidenceId = evidence.id;

    // 7. Create Document & Chunk
    const doc = await prisma.evidenceDocument.create({
      data: {
        evidenceId: testEvidenceId,
        originalText: 'Subject Victor Rostov met contact Elena Vance at Sector 7.',
        normalizedText: 'subject victor rostov met contact elena vance at sector 7.',
        characterCount: 57,
        wordCount: 9,
      },
    });

    const chunk = await prisma.evidenceChunk.create({
      data: {
        documentId: doc.id,
        evidenceId: testEvidenceId,
        chunkIndex: 0,
        text: 'Subject Victor Rostov met contact Elena Vance at Sector 7.',
        startOffset: 0,
        endOffset: 57,
        pageNumber: 1,
      },
    });

    // 8. Create Entity & Mention
    const entity = await prisma.entity.create({
      data: {
        type: EntityType.PERSON,
        canonicalValue: 'Victor Rostov',
        displayName: 'Victor Rostov',
        normalizedValue: 'victor rostov',
      },
    });
    testEntityId = entity.id;
    await Neo4jSyncService.syncEntity(entity);

    const mention = await prisma.entityMention.create({
      data: {
        entityId: testEntityId,
        evidenceId: testEvidenceId,
        caseId: testCaseId,
        chunkId: chunk.id,
        originalText: 'Victor Rostov',
        context: 'Subject Victor Rostov met contact',
        extractionMethod: ExtractionMethod.NER,
        extractionConfidence: 0.96,
        startOffset: 8,
        endOffset: 21,
      },
    });
    testMentionId = mention.id;

    // 9. Link Entity to Case
    await prisma.caseEntity.create({
      data: {
        caseId: testCaseId,
        entityId: testEntityId,
        role: CaseEntityRole.SUBJECT,
        confidence: 0.95,
      },
    });
    await Neo4jSyncService.syncCaseEntity(testCaseId, testEntityId, CaseEntityRole.SUBJECT, 0.95);
  });

  describe('1. Entity Provenance Retrieval', () => {
    it('should retrieve full provenance chain for an entity as Admin', async () => {
      const res = await request(app)
        .get(`/api/v1/entities/${testEntityId}/provenance`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.entity.id).toBe(testEntityId);
      expect(res.body.entity.displayName).toBe('Victor Rostov');

      // Verify Lineage Chain (Evidence -> Source -> Case -> Chunk)
      expect(res.body.lineage.length).toBeGreaterThan(0);
      const lineageItem = res.body.lineage[0];
      expect(lineageItem.evidence.id).toBe(testEvidenceId);
      expect(lineageItem.source.id).toBe(testSourceId);
      expect(lineageItem.case.id).toBe(testCaseId);
      expect(lineageItem.chunk.id).toBeDefined();

      // Verify Case linking
      expect(res.body.cases.length).toBeGreaterThan(0);
      expect(res.body.cases[0].caseId).toBe(testCaseId);
    });

    it('should allow assigned investigator to retrieve entity provenance', async () => {
      const res = await request(app)
        .get(`/api/v1/entities/${testEntityId}/provenance`)
        .set('Authorization', `Bearer ${investigatorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.entity.id).toBe(testEntityId);
    });

    it('should deny unauthorized investigator access if not assigned to any containing case', async () => {
      // Create isolated entity in unassigned case
      const isolatedEntity = await prisma.entity.create({
        data: {
          type: EntityType.PERSON,
          canonicalValue: 'Isolated Secret Target',
          displayName: 'Isolated Secret Target',
          normalizedValue: 'isolated secret target',
        },
      });
      isolatedEntityId = isolatedEntity.id;
      await Neo4jSyncService.syncEntity(isolatedEntity);

      const isolatedEvidence = await prisma.evidence.create({
        data: {
          caseId: unassignedCaseId,
          type: EvidenceType.DOCUMENT,
          title: 'Classified File',
          fileName: 'classified.txt',
          storagePath: '/storage/classified.txt',
          mimeType: 'text/plain',
        },
      });

      await prisma.entityMention.create({
        data: {
          entityId: isolatedEntity.id,
          evidenceId: isolatedEvidence.id,
          caseId: unassignedCaseId,
          originalText: 'Isolated Secret Target',
        },
      });

      const res = await request(app)
        .get(`/api/v1/entities/${isolatedEntity.id}/provenance`)
        .set('Authorization', `Bearer ${unauthorizedToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('2. Evidence Provenance Retrieval', () => {
    it('should retrieve complete provenance for evidence item', async () => {
      const res = await request(app)
        .get(`/api/v1/evidence/${testEvidenceId}/provenance`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.evidence.id).toBe(testEvidenceId);
      expect(res.body.source.id).toBe(testSourceId);
      expect(res.body.source.name).toBe('INTERPOL Red Notice Database');

      // Verify Document and Chunks
      expect(res.body.document).toBeDefined();
      expect(res.body.document.totalChunks).toBe(1);

      // Verify Extracted Entities
      expect(res.body.extractedEntities.length).toBeGreaterThan(0);
      expect(res.body.totalMentionsCount).toBe(1);
    });

    it('should return 404 for non-existent evidence ID', async () => {
      const res = await request(app)
        .get('/api/v1/evidence/00000000-0000-0000-0000-000000000000/provenance')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('3. Case Provenance Overview Retrieval', () => {
    it('should retrieve case provenance overview for assigned investigator', async () => {
      const res = await request(app)
        .get(`/api/v1/cases/${testCaseId}/provenance`)
        .set('Authorization', `Bearer ${investigatorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.case.id).toBe(testCaseId);

      // Check Sources list
      expect(res.body.sources.length).toBeGreaterThan(0);
      expect(res.body.sources[0].id).toBe(testSourceId);

      // Check Evidence list
      expect(res.body.evidence.length).toBeGreaterThan(0);
      expect(res.body.evidence[0].id).toBe(testEvidenceId);

      // Check Entities list
      expect(res.body.entities.length).toBeGreaterThan(0);
      expect(res.body.entities[0].entityId).toBe(testEntityId);
    });

    it('should forbid case provenance retrieval for unassigned investigator', async () => {
      const res = await request(app)
        .get(`/api/v1/cases/${unassignedCaseId}/provenance`)
        .set('Authorization', `Bearer ${unauthorizedToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('4. Audit Trail Logging', () => {
    it('should record audit log when provenance is accessed', async () => {
      await ProvenanceService.getEntityProvenance(testEntityId, {
        userId: investigatorUser.id,
        role: UserRole.INVESTIGATOR,
        ipAddress: '127.0.0.1',
      });

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'PROVENANCE_ACCESSED',
          resourceId: testEntityId,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.userId).toBe(investigatorUser.id);
      expect(auditLog?.resourceType).toBe('Entity');
    });
  });
});
