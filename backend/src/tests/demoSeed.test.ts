import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '../db/prisma';
import { getNeo4jSession, closeNeo4j } from '../db/neo4j';
import { seedDemo } from '../seed/seed-demo';
import { MatchStatus, ProcessingStatus } from '@prisma/client';

describe('TRACE-X Synthetic Demo Dataset Integration & Idempotency', () => {
  const datasetDir = fs.existsSync(path.resolve(process.cwd(), 'data/synthetic'))
    ? path.resolve(process.cwd(), 'data/synthetic')
    : path.resolve(process.cwd(), '../data/synthetic');

  beforeAll(async () => {
    // Run initial demo seed
    await seedDemo();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await closeNeo4j();
  });

  it('should have all 13 CSV fixture files and 9 TXT evidence files present in data/synthetic', () => {
    expect(fs.existsSync(datasetDir)).toBe(true);

    const requiredCsvs = [
      'cases.csv', 'sources.csv', 'evidence.csv', 'entities.csv',
      'case_entities.csv', 'relationships.csv', 'events.csv', 'correlations.csv',
      'entity_resolution.csv', 'patterns.csv', 'contradictions.csv', 'findings.csv', 'alerts.csv'
    ];

    for (const csv of requiredCsvs) {
      const p = path.join(datasetDir, csv);
      expect(fs.existsSync(p), `Missing fixture file: ${csv}`).toBe(true);
      expect(fs.statSync(p).size).toBeGreaterThan(0);
    }

    const requiredTxts = [
      'account_activity_7712.txt', 'account_activity_7712_case3.txt',
      'cdr_demo_10001.txt', 'device_log_441.txt', 'location_note.txt',
      'night_relay_report.txt', 'red_circuit_report.txt', 'shadow_net_report.txt',
      'shared_device_441.txt'
    ];

    for (const txt of requiredTxts) {
      const p = path.join(datasetDir, txt);
      expect(fs.existsSync(p), `Missing evidence file: ${txt}`).toBe(true);
      expect(fs.statSync(p).size).toBeGreaterThan(0);
    }
  });

  it('should populate PostgreSQL with exact synthetic cases and assign permissions', async () => {
    const cases = await prisma.case.findMany({
      where: { id: { in: ['CASE-001', 'CASE-002', 'CASE-003'] } },
      include: { assignments: true },
    });

    expect(cases.length).toBe(3);
    const caseNumbers = cases.map((c) => c.caseNumber).sort();
    expect(caseNumbers).toEqual(['CASE-001', 'CASE-002', 'CASE-003']);

    // Check assignments for admin and investigator
    for (const c of cases) {
      expect(c.assignments.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('should store physical evidence files on disk with verifiable SHA-256 checksums', async () => {
    const evidenceList = await prisma.evidence.findMany({
      where: { id: { in: ['EVD-001', 'EVD-002', 'EVD-003', 'EVD-004', 'EVD-005', 'EVD-006', 'EVD-007', 'EVD-008', 'EVD-009'] } },
      include: { document: true, chunks: true, entityMentions: true },
    });

    expect(evidenceList.length).toBe(9);

    for (const ev of evidenceList) {
      expect(ev.processingStatus).toBe(ProcessingStatus.COMPLETED);
      expect(ev.hash).toBeDefined();
      expect(ev.hash!.length).toBe(64); // SHA-256 hex length

      const absPath = path.resolve(process.cwd(), ev.storagePath);
      expect(fs.existsSync(absPath)).toBe(true);

      const buffer = fs.readFileSync(absPath);
      const computedHash = crypto.createHash('sha256').update(buffer).digest('hex');
      expect(ev.hash).toBe(computedHash);

      // Verify text extraction & chunks
      expect(ev.document).toBeDefined();
      expect(ev.document!.characterCount).toBeGreaterThan(0);
      expect(ev.chunks.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('should populate 18 entities and 27 case-entity associations in PostgreSQL', async () => {
    const entities = await prisma.entity.findMany({
      where: { id: { startsWith: 'ENT-' } },
      include: { locations: true },
    });

    expect(entities.length).toBe(18);

    const caseEntities = await prisma.caseEntity.findMany({
      where: { caseId: { in: ['CASE-001', 'CASE-002', 'CASE-003'] } },
    });

    expect(caseEntities.length).toBe(27);

    // Locations for Bengaluru, Hyderabad, Mumbai
    const locations = await prisma.location.findMany({
      where: { entityId: { in: ['ENT-014', 'ENT-015', 'ENT-016'] } },
    });
    expect(locations.length).toBe(3);
  });

  it('should populate timeline events and entity resolution matches with correct review states', async () => {
    const events = await prisma.event.findMany({
      where: { id: { in: ['EVT-001', 'EVT-002', 'EVT-003', 'EVT-004', 'EVT-005', 'EVT-006', 'EVT-007', 'EVT-008', 'EVT-009', 'EVT-010'] } },
    });
    expect(events.length).toBe(10);

    const matches = await prisma.entityMatch.findMany({
      where: { id: { in: ['MATCH-001', 'MATCH-002', 'MATCH-003'] } },
    });
    expect(matches.length).toBe(3);

    const pending = matches.filter((m) => m.status === MatchStatus.PENDING);
    const confirmed = matches.filter((m) => m.status === MatchStatus.CONFIRMED);
    expect(pending.length).toBe(1); // MATCH-001 for investigator review UI
    expect(confirmed.length).toBe(2); // MATCH-002 & MATCH-003
  });

  it('should populate correlations, patterns, contradictions, intelligence findings, and alerts', async () => {
    const correlations = await prisma.caseCorrelation.findMany({
      where: { id: { startsWith: 'corr-CASE-' } },
    });
    expect(correlations.length).toBe(2); // Case pairs: CASE-001 <-> CASE-002 and CASE-001 <-> CASE-003

    const patterns = await prisma.detectedPattern.findMany({
      where: { id: { in: ['PAT-001', 'PAT-002', 'PAT-003'] } },
    });
    expect(patterns.length).toBe(3);

    const contradictions = await prisma.contradiction.findMany({
      where: { id: 'CON-001' },
      include: { claims: true },
    });
    expect(contradictions.length).toBe(1);
    expect(contradictions[0].claims.length).toBe(2);

    const findings = await prisma.intelligenceFinding.findMany({
      where: { id: { in: ['FND-001', 'FND-002'] } },
    });
    expect(findings.length).toBe(2);

    const alerts = await prisma.alert.findMany({
      where: { id: { in: ['ALT-001', 'ALT-002', 'ALT-003'] } },
    });
    expect(alerts.length).toBe(3);
  });

  it('should verify Neo4j contains all demo nodes, relationships, and provenance', async () => {
    const session = getNeo4jSession();
    try {
      const caseRes = await session.run(
        `MATCH (c:Case) WHERE c.id IN ['CASE-001', 'CASE-002', 'CASE-003'] RETURN count(c) as count`
      );
      expect(caseRes.records[0].get('count').toNumber()).toBe(3);

      const entRes = await session.run(
        `MATCH (e:Entity) WHERE e.id STARTS WITH 'ENT-' RETURN count(e) as count`
      );
      expect(entRes.records[0].get('count').toNumber()).toBe(18);

      const evdRes = await session.run(
        `MATCH (ev:Evidence) WHERE ev.id STARTS WITH 'EVD-' RETURN count(ev) as count`
      );
      expect(evdRes.records[0].get('count').toNumber()).toBe(9);

      const relRes = await session.run(
        `MATCH ()-[r:CONNECTED_TO]->() WHERE r.id STARTS WITH 'REL-' RETURN count(r) as count`
      );
      expect(relRes.records[0].get('count').toNumber()).toBe(14);

      const corrRes = await session.run(
        `MATCH ()-[r:CORRELATED_WITH]->() WHERE r.id STARTS WITH 'CORR-' RETURN count(r) as count`
      );
      expect(corrRes.records[0].get('count').toNumber()).toBe(3);

      const conRes = await session.run(
        `MATCH ()-[r:CONTRADICTS]->() WHERE r.id = 'CON-001' RETURN count(r) as count`
      );
      expect(conRes.records[0].get('count').toNumber()).toBe(2);
    } finally {
      await session.close();
    }
  });

  it('STRICT IDEMPOTENCY: running seedDemo a second time should produce zero duplicates', async () => {
    // Record counts before 2nd execution
    const casesBefore = await prisma.case.count({ where: { id: { in: ['CASE-001', 'CASE-002', 'CASE-003'] } } });
    const evidenceBefore = await prisma.evidence.count({ where: { id: { startsWith: 'EVD-' } } });
    const entitiesBefore = await prisma.entity.count({ where: { id: { startsWith: 'ENT-' } } });
    const caseEntitiesBefore = await prisma.caseEntity.count({ where: { caseId: { in: ['CASE-001', 'CASE-002', 'CASE-003'] } } });
    const eventsBefore = await prisma.event.count({ where: { id: { startsWith: 'EVT-' } } });
    const matchesBefore = await prisma.entityMatch.count({ where: { id: { startsWith: 'MATCH-' } } });
    const patternsBefore = await prisma.detectedPattern.count({ where: { id: { startsWith: 'PAT-' } } });
    const alertsBefore = await prisma.alert.count({ where: { id: { startsWith: 'ALT-' } } });
    const findingsBefore = await prisma.intelligenceFinding.count({ where: { id: { startsWith: 'FND-' } } });

    // Execute 2nd time
    await seedDemo();

    // Verify exact equality
    const casesAfter = await prisma.case.count({ where: { id: { in: ['CASE-001', 'CASE-002', 'CASE-003'] } } });
    const evidenceAfter = await prisma.evidence.count({ where: { id: { startsWith: 'EVD-' } } });
    const entitiesAfter = await prisma.entity.count({ where: { id: { startsWith: 'ENT-' } } });
    const caseEntitiesAfter = await prisma.caseEntity.count({ where: { caseId: { in: ['CASE-001', 'CASE-002', 'CASE-003'] } } });
    const eventsAfter = await prisma.event.count({ where: { id: { startsWith: 'EVT-' } } });
    const matchesAfter = await prisma.entityMatch.count({ where: { id: { startsWith: 'MATCH-' } } });
    const patternsAfter = await prisma.detectedPattern.count({ where: { id: { startsWith: 'PAT-' } } });
    const alertsAfter = await prisma.alert.count({ where: { id: { startsWith: 'ALT-' } } });
    const findingsAfter = await prisma.intelligenceFinding.count({ where: { id: { startsWith: 'FND-' } } });

    expect(casesAfter).toBe(casesBefore);
    expect(evidenceAfter).toBe(evidenceBefore);
    expect(entitiesAfter).toBe(entitiesBefore);
    expect(caseEntitiesAfter).toBe(caseEntitiesBefore);
    expect(eventsAfter).toBe(eventsBefore);
    expect(matchesAfter).toBe(matchesBefore);
    expect(patternsAfter).toBe(patternsBefore);
    expect(alertsAfter).toBe(alertsBefore);
    expect(findingsAfter).toBe(findingsBefore);
  });
});
