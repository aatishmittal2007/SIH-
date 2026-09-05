import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../index';

describe('TRACE-X Phase 4 Investigation Workflow API', () => {
  let adminToken: string;
  let investigatorToken: string;
  let createdSourceId: string;
  let createdCaseId: string;
  let createdEvidenceId: string;
  let createdEntityId: string;
  let createdEventId: string;

  beforeAll(async () => {
    // Login as Admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@tracex.gov',
        password: 'AdminPassword123!',
      });
    
    if (adminRes.status === 200) {
      adminToken = adminRes.body.token;
    }

    // Login as Investigator
    const invRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'investigator@tracex.gov',
        password: 'InvestigatorPassword123!',
      });

    if (invRes.status === 200) {
      investigatorToken = invRes.body.token;
    }
  });

  it('1. Admin should create a new intelligence Source', async () => {
    if (!adminToken) return;
    const res = await request(app)
      .post('/api/v1/sources')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Test CDR Log Provider ${Date.now()}`,
        type: 'CDR_LOGS',
        reliability: 'A_COMPLETELY_RELIABLE',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.type).toBe('CDR_LOGS');
    createdSourceId = res.body.id;
  });

  it('2. Investigator should create a new Case', async () => {
    if (!investigatorToken) return;
    const caseNum = `CAS-TEST-${Date.now().toString().slice(-6)}`;
    const res = await request(app)
      .post('/api/v1/cases')
      .set('Authorization', `Bearer ${investigatorToken}`)
      .send({
        caseNumber: caseNum,
        title: 'Operation Dark Cloud - Financial & Wiretap Analysis',
        description: 'Test investigation into illicit cross-border transfers.',
        status: 'OPEN',
        priority: 'HIGH',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.caseNumber).toBe(caseNum);
    createdCaseId = res.body.id;
  });

  it('3. Investigator should upload Evidence to Case with SHA-256 computation', async () => {
    if (!investigatorToken || !createdCaseId || !createdSourceId) return;

    const fileContent = Buffer.from('TIMESTAMP,CALLER,RECEIVER,DURATION\n2026-09-03 10:00,+1234567890,+9876543210,120');

    const res = await request(app)
      .post('/api/v1/evidence/upload')
      .set('Authorization', `Bearer ${investigatorToken}`)
      .field('caseId', createdCaseId)
      .field('sourceId', createdSourceId)
      .field('title', 'CDR Call Record Matrix')
      .field('type', 'CDR')
      .attach('file', fileContent, 'cdr_records.csv');

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('hash');
    expect(res.body.hash.length).toBe(64); // SHA-256 length
    createdEvidenceId = res.body.id;
  });

  it('4. Investigator should download Evidence file and verify SHA-256 header', async () => {
    if (!investigatorToken || !createdEvidenceId) return;

    const res = await request(app)
      .get(`/api/v1/evidence/${createdEvidenceId}/download`)
      .set('Authorization', `Bearer ${investigatorToken}`);

    expect(res.status).toBe(200);
    expect(res.headers).toHaveProperty('x-evidence-sha256');
    expect(res.headers).toHaveProperty('x-integrity-verified', 'true');
  });

  it('5. Investigator should create an Entity and normalize value', async () => {
    if (!investigatorToken) return;

    const res = await request(app)
      .post('/api/v1/entities')
      .set('Authorization', `Bearer ${investigatorToken}`)
      .send({
        type: 'PHONE',
        canonicalValue: '+1 (234) 567-890',
        displayName: 'Target Main Line',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.normalizedValue).toBe('+1234567890');
    createdEntityId = res.body.id;
  });

  it('6. Investigator should link Entity to Case', async () => {
    if (!investigatorToken || !createdCaseId || !createdEntityId) return;

    const res = await request(app)
      .post('/api/v1/entities/link-case')
      .set('Authorization', `Bearer ${investigatorToken}`)
      .send({
        caseId: createdCaseId,
        entityId: createdEntityId,
        role: 'PRIMARY_SUSPECT',
        confidence: 0.95,
      });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe('PRIMARY_SUSPECT');
  });

  it('7. Investigator should log Evidence Entity Mention', async () => {
    if (!investigatorToken || !createdEvidenceId || !createdEntityId) return;

    const res = await request(app)
      .post('/api/v1/entities/mentions')
      .set('Authorization', `Bearer ${investigatorToken}`)
      .send({
        evidenceId: createdEvidenceId,
        entityId: createdEntityId,
        originalText: '+1234567890',
        confidence: 0.98,
        extractionMethod: 'MANUAL_PARSING',
      });

    expect(res.status).toBe(201);
    expect(res.body.originalText).toBe('+1234567890');
  });

  it('8. Investigator should log an Event on the Case timeline', async () => {
    if (!investigatorToken || !createdCaseId || !createdSourceId) return;

    const res = await request(app)
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${investigatorToken}`)
      .send({
        caseId: createdCaseId,
        sourceId: createdSourceId,
        type: 'CDR_CALL_INTERCEPT',
        description: 'Call intercepted between target phone and foreign relay node',
        timestamp: new Date().toISOString(),
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    createdEventId = res.body.id;
  });

  it('9. Investigator should retrieve Case timeline with Event list', async () => {
    if (!investigatorToken || !createdCaseId) return;

    const res = await request(app)
      .get(`/api/v1/events?caseId=${createdCaseId}`)
      .set('Authorization', `Bearer ${investigatorToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('events');
    expect(Array.isArray(res.body.events)).toBe(true);
    expect(res.body.events.length).toBeGreaterThan(0);
  });
});
