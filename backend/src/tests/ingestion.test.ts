import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../index';
import { NlpService } from '../services/nlp.service';
import { EntityType } from '@prisma/client';

describe('TRACE-X Phase 5 Evidence Ingestion & NLP Pipeline', () => {
  let investigatorToken: string;
  let createdCaseId: string;
  let createdSourceId: string;
  let createdEvidenceId: string;

  beforeAll(async () => {
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

  it('1. NlpService preprocessDocument should format text and metrics', () => {
    const rawContent = 'Line 1: Suspect Vikram Singh call logged.\r\nLine 2: Email sent to target@syndicate.org\r\n';
    const processed = NlpService.preprocessDocument(Buffer.from(rawContent), 'text/plain', 'report.txt');

    expect(processed.fileName).toBe('report.txt');
    expect(processed.lineCount).toBe(2);
    expect(processed.wordCount).toBeGreaterThan(5);
    expect(processed.rawText).not.toContain('\r\n');
  });

  it('2. NlpService extractEntities should extract entities using Fallback Rule Engine', async () => {
    const sampleText = 'Inspector Rajesh interviewed Vikram Singh regarding syndicate transactions. Contact target@syndicate.org or call +1234567890. Crypto wallet: 0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
    const extracted = await NlpService.extractEntities(sampleText);

    expect(Array.isArray(extracted)).toBe(true);
    expect(extracted.length).toBeGreaterThan(0);

    const emailMatch = extracted.find(e => e.type === EntityType.EMAIL);
    expect(emailMatch).toBeDefined();
    expect(emailMatch?.text).toBe('target@syndicate.org');

    const phoneMatch = extracted.find(e => e.type === EntityType.PHONE);
    expect(phoneMatch).toBeDefined();
    expect(phoneMatch?.text).toContain('1234567890');

    const accountMatch = extracted.find(e => e.type === EntityType.ACCOUNT);
    expect(accountMatch).toBeDefined();
    expect(accountMatch?.text).toBe('0x71C7656EC7ab88b098defB751B7401B5f6d8976F');
  });

  it('3. API Endpoint /api/v1/evidence/process-raw should extract entities from raw text', async () => {
    if (!investigatorToken) return;

    // Create a temporary case for testing
    const caseNum = `CAS-INGEST-${Date.now().toString().slice(-6)}`;
    const caseRes = await request(app)
      .post('/api/v1/cases')
      .set('Authorization', `Bearer ${investigatorToken}`)
      .send({
        caseNumber: caseNum,
        title: 'Ingestion Pipeline Test Case',
        description: 'Testing live NLP extraction endpoints',
        status: 'OPEN',
        priority: 'MEDIUM',
      });

    expect(caseRes.status).toBe(201);
    createdCaseId = caseRes.body.id;

    // Call process-raw endpoint
    const rawRes = await request(app)
      .post('/api/v1/evidence/process-raw')
      .set('Authorization', `Bearer ${investigatorToken}`)
      .send({
        caseId: createdCaseId,
        text: 'Suspect John Doe accessed server at 192.168.1.100 and emailed handler at spy@network.org',
      });

    expect(rawRes.status).toBe(200);
    expect(rawRes.body.success).toBe(true);
    expect(rawRes.body.data.entitiesCount).toBeGreaterThan(0);
  });

  it('4. Upload Evidence document and execute full Automated Ingestion Pipeline', async () => {
    if (!investigatorToken || !createdCaseId) return;

    // Create source
    const sourceRes = await request(app)
      .post('/api/v1/sources')
      .set('Authorization', `Bearer ${investigatorToken}`)
      .send({
        name: `Intercept Node ${Date.now()}`,
        type: 'SIGINT',
        reliability: 'B_USUALLY_RELIABLE',
      });
    expect(sourceRes.status).toBe(201);
    createdSourceId = sourceRes.body.id;

    // Upload evidence document
    const docContent = `INVESTIGATION DOSSIER:
Target: Vikram Singh
Affiliation: Apex Logistics Corp
Email: vikram.singh@apexlogistics.com
Phone: +19876543210
IP Address: 10.0.4.15
Crypto Address: 0x1234567890123456789012345678901234567890`;

    const uploadRes = await request(app)
      .post('/api/v1/evidence/upload')
      .set('Authorization', `Bearer ${investigatorToken}`)
      .field('caseId', createdCaseId)
      .field('sourceId', createdSourceId)
      .field('title', 'Intercepted Dossier File')
      .field('type', 'DOCUMENT')
      .attach('file', Buffer.from(docContent), 'dossier.txt');

    expect(uploadRes.status).toBe(201);
    createdEvidenceId = uploadRes.body.id;

    // Trigger Ingestion Process
    const processRes = await request(app)
      .post(`/api/v1/evidence/${createdEvidenceId}/process`)
      .set('Authorization', `Bearer ${investigatorToken}`);

    expect(processRes.status).toBe(200);
    expect(processRes.body.success).toBe(true);
    expect(processRes.body.data.extractionSummary.totalEntitiesFound).toBeGreaterThan(0);
    expect(processRes.body.data.extractionSummary.mentionsCreated).toBeGreaterThan(0);
    expect(processRes.body.data.mentions.length).toBeGreaterThan(0);
  });
});
