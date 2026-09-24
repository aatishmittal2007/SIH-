import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import {
  UserRole,
  CaseStatus,
  CasePriority,
  SourceType,
  SourceReliability,
  EvidenceType,
  EntityType,
  CaseEntityRole,
  EventType,
  SeverityLevel,
  AlertStatus,
  AlertType,
  MatchStatus,
  MatchType,
  ContradictionStatus,
  ProcessingStatus,
  ExtractionMethod,
} from '@prisma/client';
import { prisma } from '../db/prisma';
import { getNeo4jSession, initNeo4jConstraints, closeNeo4j } from '../db/neo4j';
import { StorageService } from '../services/storage.service';
import { TextNormalizationService } from '../services/textNormalization.service';
import { config } from '../config/env';

// ============================================================================
// CSV HELPER
// ============================================================================
function parseCsv<T = Record<string, string>>(content: string): T[] {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim());
  const rows: T[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple robust CSV parser handling potential quotes
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        values.push(current.trim().replace(/^"(.*)"$/, '$1'));
        current = '';
      } else {
        current += ch;
      }
    }
    values.push(current.trim().replace(/^"(.*)"$/, '$1'));

    const obj: any = {};
    headers.forEach((header, idx) => {
      obj[header] = values[idx] !== undefined ? values[idx] : '';
    });
    rows.push(obj as T);
  }

  return rows;
}

// ============================================================================
// DATASET DIRECTORY RESOLVER
// ============================================================================
function findDatasetDir(): string {
  const possiblePaths = [
    path.resolve(process.cwd(), 'data/synthetic'),
    path.resolve(process.cwd(), '../data/synthetic'),
    path.resolve(__dirname, '../../../data/synthetic'),
    path.resolve(process.cwd(), 'demo-data/synthetic'),
    path.resolve(process.cwd(), '../demo-data/synthetic'),
    '/home/aatish/Documents/SIH/tracex/data/synthetic',
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p) && fs.existsSync(path.join(p, 'cases.csv'))) {
      return p;
    }
  }

  throw new Error(`Synthetic demo dataset directory could not be located in any of: ${possiblePaths.join(', ')}`);
}

// ============================================================================
// RESET DEMO DATA
// ============================================================================
export async function resetDemoData() {
  console.log('==================================================');
  console.log('        TRACE-X DEMO DATA RESET INITIATED         ');
  console.log('==================================================\n');

  const demoCaseIds = ['CASE-001', 'CASE-002', 'CASE-003'];
  const demoEntityIds = [
    'ENT-001', 'ENT-002', 'ENT-003', 'ENT-004', 'ENT-005',
    'ENT-006', 'ENT-007', 'ENT-008', 'ENT-009', 'ENT-010',
    'ENT-011', 'ENT-012', 'ENT-013', 'ENT-014', 'ENT-015',
    'ENT-016', 'ENT-017', 'ENT-018',
  ];
  const demoSourceIds = [
    'SRC-001', 'SRC-002', 'SRC-003', 'SRC-004', 'SRC-005',
    'SRC-006', 'SRC-007', 'SRC-008', 'SRC-009',
  ];
  const demoEvidenceIds = [
    'EVD-001', 'EVD-002', 'EVD-003', 'EVD-004', 'EVD-005',
    'EVD-006', 'EVD-007', 'EVD-008', 'EVD-009',
  ];

  console.log('[PostgreSQL] Removing demo records...');

  // Contradiction Claims
  await prisma.contradictionClaim.deleteMany({
    where: {
      OR: [
        { evidenceId: { in: demoEvidenceIds } },
        { entityId: { in: demoEntityIds } },
        { contradiction: { caseId: { in: demoCaseIds } } },
      ],
    },
  });

  // Contradictions
  await prisma.contradiction.deleteMany({
    where: { caseId: { in: demoCaseIds } },
  });

  // Detected Patterns
  await prisma.detectedPattern.deleteMany({
    where: {
      OR: [
        { caseId: { in: demoCaseIds } },
        { entityId: { in: demoEntityIds } },
      ],
    },
  });

  // Intelligence Findings
  await prisma.intelligenceFinding.deleteMany({
    where: { caseId: { in: demoCaseIds } },
  });

  // Alerts
  await prisma.alert.deleteMany({
    where: {
      OR: [
        { caseId: { in: demoCaseIds } },
        { entityId: { in: demoEntityIds } },
      ],
    },
  });

  // Case Correlations
  await prisma.caseCorrelation.deleteMany({
    where: {
      OR: [
        { sourceCaseId: { in: demoCaseIds } },
        { targetCaseId: { in: demoCaseIds } },
      ],
    },
  });

  // Entity Matches
  await prisma.entityMatch.deleteMany({
    where: {
      OR: [
        { sourceEntityId: { in: demoEntityIds } },
        { targetEntityId: { in: demoEntityIds } },
      ],
    },
  });

  // Events
  await prisma.event.deleteMany({
    where: { caseId: { in: demoCaseIds } },
  });

  // Entity Mentions
  await prisma.entityMention.deleteMany({
    where: {
      OR: [
        { caseId: { in: demoCaseIds } },
        { evidenceId: { in: demoEvidenceIds } },
        { entityId: { in: demoEntityIds } },
      ],
    },
  });

  // Evidence Chunks
  await prisma.evidenceChunk.deleteMany({
    where: { evidenceId: { in: demoEvidenceIds } },
  });

  // Evidence Documents
  await prisma.evidenceDocument.deleteMany({
    where: { evidenceId: { in: demoEvidenceIds } },
  });

  // Evidence
  await prisma.evidence.deleteMany({
    where: { id: { in: demoEvidenceIds } },
  });

  // Case Entities
  await prisma.caseEntity.deleteMany({
    where: { caseId: { in: demoCaseIds } },
  });

  // Locations for demo entities
  await prisma.location.deleteMany({
    where: { entityId: { in: demoEntityIds } },
  });

  // Entities
  await prisma.entity.deleteMany({
    where: { id: { in: demoEntityIds } },
  });

  // Sources
  await prisma.source.deleteMany({
    where: { id: { in: demoSourceIds } },
  });

  // Case Assignments
  await prisma.caseAssignment.deleteMany({
    where: { caseId: { in: demoCaseIds } },
  });

  // Cases
  await prisma.case.deleteMany({
    where: { id: { in: demoCaseIds } },
  });

  console.log('  ✓ PostgreSQL demo records cleanly removed.');

  // Neo4j cleanup for demo items
  console.log('[Neo4j] Removing demo nodes and relationships...');
  const session = getNeo4jSession();
  try {
    await session.run(
      `MATCH (n)
       WHERE (n:Case AND n.id IN $demoCaseIds)
          OR (n:Evidence AND n.id IN $demoEvidenceIds)
          OR (n:Entity AND n.id IN $demoEntityIds)
          OR (n:Source AND n.id IN $demoSourceIds)
          OR (n:Event AND n.id STARTS WITH 'EVT-')
          OR (n:Location AND n.id STARTS WITH 'loc-ENT-')
       DETACH DELETE n`,
      { demoCaseIds, demoEvidenceIds, demoEntityIds, demoSourceIds }
    );
    console.log('  ✓ Neo4j demo graph elements cleanly removed.');
  } finally {
    await session.close();
  }

  // Physical files cleanup
  console.log('[Storage] Cleaning physical demo evidence files...');
  for (const cId of demoCaseIds) {
    const caseStorageDir = path.join(process.cwd(), 'storage', 'evidence', cId);
    if (fs.existsSync(caseStorageDir)) {
      fs.rmSync(caseStorageDir, { recursive: true, force: true });
    }
  }
  console.log('  ✓ Storage evidence files cleaned.\n');

  console.log('==================================================');
  console.log('        DEMO DATA RESET COMPLETED CLEANLY         ');
  console.log('==================================================');
}

// ============================================================================
// MAIN DEMO SEEDER
// ============================================================================
export async function seedDemo() {
  console.log('==================================================');
  console.log('     TRACE-X SYNTHETIC DEMO DATASET INGESTION     ');
  console.log('==================================================\n');

  const datasetDir = findDatasetDir();
  console.log(`[Provenance] Loading synthetic dataset from: ${datasetDir}`);

  // Read all CSV files
  const casesCsv = fs.readFileSync(path.join(datasetDir, 'cases.csv'), 'utf-8');
  const sourcesCsv = fs.readFileSync(path.join(datasetDir, 'sources.csv'), 'utf-8');
  const evidenceCsv = fs.readFileSync(path.join(datasetDir, 'evidence.csv'), 'utf-8');
  const entitiesCsv = fs.readFileSync(path.join(datasetDir, 'entities.csv'), 'utf-8');
  const caseEntitiesCsv = fs.readFileSync(path.join(datasetDir, 'case_entities.csv'), 'utf-8');
  const relationshipsCsv = fs.readFileSync(path.join(datasetDir, 'relationships.csv'), 'utf-8');
  const eventsCsv = fs.readFileSync(path.join(datasetDir, 'events.csv'), 'utf-8');
  const correlationsCsv = fs.readFileSync(path.join(datasetDir, 'correlations.csv'), 'utf-8');
  const entityResolutionCsv = fs.readFileSync(path.join(datasetDir, 'entity_resolution.csv'), 'utf-8');
  const patternsCsv = fs.readFileSync(path.join(datasetDir, 'patterns.csv'), 'utf-8');
  const contradictionsCsv = fs.readFileSync(path.join(datasetDir, 'contradictions.csv'), 'utf-8');
  const findingsCsv = fs.readFileSync(path.join(datasetDir, 'findings.csv'), 'utf-8');
  const alertsCsv = fs.readFileSync(path.join(datasetDir, 'alerts.csv'), 'utf-8');

  const casesData = parseCsv(casesCsv);
  const sourcesData = parseCsv(sourcesCsv);
  const evidenceData = parseCsv(evidenceCsv);
  const entitiesData = parseCsv(entitiesCsv);
  const caseEntitiesData = parseCsv(caseEntitiesCsv);
  const relationshipsData = parseCsv(relationshipsCsv);
  const eventsData = parseCsv(eventsCsv);
  const correlationsData = parseCsv(correlationsCsv);
  const entityResolutionData = parseCsv(entityResolutionCsv);
  const patternsData = parseCsv(patternsCsv);
  const contradictionsData = parseCsv(contradictionsCsv);
  const findingsData = parseCsv(findingsCsv);
  const alertsData = parseCsv(alertsCsv);

  console.log(`  ✓ Validated 13 CSV fixture files (${casesData.length} cases, ${sourcesData.length} sources, ${evidenceData.length} evidence, ${entitiesData.length} entities)\n`);

  // --------------------------------------------------------------------------
  // 1. ENSURE DEMO USERS (ADMIN & INVESTIGATOR)
  // --------------------------------------------------------------------------
  console.log('[PostgreSQL] Ensuring demo authorization accounts...');
  const adminPasswordHash = await bcrypt.hash(config.seedAdminPassword || 'AdminPass123!', 10);
  const invPasswordHash = await bcrypt.hash('Investigator123!', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: config.seedAdminEmail || 'admin@tracex.gov.in' },
    update: { role: UserRole.ADMIN, isActive: true },
    create: {
      id: 'usr-admin-001',
      name: 'Chief Inspector Rajesh Sharma',
      email: config.seedAdminEmail || 'admin@tracex.gov.in',
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  const invUser = await prisma.user.upsert({
    where: { email: 'priya.verma@tracex.gov.in' },
    update: { role: UserRole.INVESTIGATOR, isActive: true },
    create: {
      id: 'usr-inv-002',
      name: 'Senior Analyst Priya Verma',
      email: 'priya.verma@tracex.gov.in',
      passwordHash: invPasswordHash,
      role: UserRole.INVESTIGATOR,
      isActive: true,
    },
  });

  console.log(`  ✓ Demo Admin: ${adminUser.email} (${adminUser.id})`);
  console.log(`  ✓ Demo Investigator: ${invUser.email} (${invUser.id})\n`);

  // --------------------------------------------------------------------------
  // 2. CASES & CASE ASSIGNMENTS
  // --------------------------------------------------------------------------
  console.log('[PostgreSQL] Upserting Cases...');
  for (const c of casesData) {
    const priority = (c.priority?.toUpperCase() as CasePriority) || CasePriority.MEDIUM;
    const createdAt = c.created_at ? new Date(c.created_at) : new Date();

    await prisma.case.upsert({
      where: { id: c.case_id },
      update: {
        caseNumber: c.case_id,
        title: c.title,
        description: c.description,
        status: CaseStatus.OPEN,
        priority,
      },
      create: {
        id: c.case_id,
        caseNumber: c.case_id,
        title: c.title,
        description: c.description,
        status: CaseStatus.OPEN,
        priority,
        createdById: adminUser.id,
        createdAt,
      },
    });

    // Assign to Admin & Investigator
    await prisma.caseAssignment.upsert({
      where: { caseId_userId: { caseId: c.case_id, userId: adminUser.id } },
      update: {},
      create: {
        caseId: c.case_id,
        userId: adminUser.id,
        assignedById: adminUser.id,
      },
    });

    await prisma.caseAssignment.upsert({
      where: { caseId_userId: { caseId: c.case_id, userId: invUser.id } },
      update: {},
      create: {
        caseId: c.case_id,
        userId: invUser.id,
        assignedById: adminUser.id,
      },
    });
  }
  console.log(`  ✓ Populated Cases: ${casesData.length}`);

  // --------------------------------------------------------------------------
  // 3. SOURCES
  // --------------------------------------------------------------------------
  console.log('[PostgreSQL] Upserting Sources...');
  for (const s of sourcesData) {
    let type: SourceType = SourceType.OTHER;
    const lower = (s.source_type || '').toLowerCase();
    if (lower.includes('report')) type = SourceType.POLICE_REPORT;
    else if (lower.includes('cdr')) type = SourceType.CDR;
    else if (lower.includes('financial')) type = SourceType.FINANCIAL_RECORD;
    else if (lower.includes('log') || lower.includes('digital')) type = SourceType.OSINT;

    await prisma.source.upsert({
      where: { id: s.source_id },
      update: {
        name: s.title,
        type,
        reliability: SourceReliability.HIGH,
        description: `${s.source_type} | Ref: ${s.source_reference} | SYNTHETIC DEMO`,
      },
      create: {
        id: s.source_id,
        name: s.title,
        type,
        reliability: SourceReliability.HIGH,
        description: `${s.source_type} | Ref: ${s.source_reference} | SYNTHETIC DEMO`,
      },
    });
  }
  console.log(`  ✓ Populated Sources: ${sourcesData.length}`);

  // --------------------------------------------------------------------------
  // 4. ENTITIES & LOCATIONS
  // --------------------------------------------------------------------------
  console.log('[PostgreSQL] Upserting Entities & Locations...');
  const locationCoords: Record<string, { lat: number; lon: number; city: string; state: string }> = {
    'ENT-014': { lat: 12.9716, lon: 77.5946, city: 'Bengaluru', state: 'Karnataka' },
    'ENT-015': { lat: 17.3850, lon: 78.4867, city: 'Hyderabad', state: 'Telangana' },
    'ENT-016': { lat: 19.0760, lon: 72.8777, city: 'Mumbai', state: 'Maharashtra' },
  };

  for (const ent of entitiesData) {
    const type = (ent.type?.toUpperCase() as EntityType) || EntityType.OTHER;
    const canonicalValue = ent.value.trim();
    const normalizedValue = TextNormalizationService.normalizeEntityValue(canonicalValue, type);

    const entity = await prisma.entity.upsert({
      where: { id: ent.entity_id },
      update: {
        type,
        canonicalValue,
        displayName: canonicalValue,
        normalizedValue,
      },
      create: {
        id: ent.entity_id,
        type,
        canonicalValue,
        displayName: canonicalValue,
        normalizedValue,
      },
    });

    if (type === EntityType.LOCATION && locationCoords[ent.entity_id]) {
      const coords = locationCoords[ent.entity_id];
      await prisma.location.upsert({
        where: { id: `loc-${ent.entity_id}` },
        update: {
          latitude: coords.lat,
          longitude: coords.lon,
          city: coords.city,
          state: coords.state,
          country: 'India',
        },
        create: {
          id: `loc-${ent.entity_id}`,
          entityId: entity.id,
          latitude: coords.lat,
          longitude: coords.lon,
          city: coords.city,
          state: coords.state,
          country: 'India',
          address: `${coords.city}, ${coords.state}, India`,
        },
      });
    }
  }
  console.log(`  ✓ Populated Entities: ${entitiesData.length} (including 3 geo-coordinates)`);

  // --------------------------------------------------------------------------
  // 5. CASE ENTITIES
  // --------------------------------------------------------------------------
  console.log('[PostgreSQL] Linking Entities to Cases...');
  for (const ce of caseEntitiesData) {
    const entity = await prisma.entity.findUnique({ where: { id: ce.entity_id } });
    if (!entity) continue;

    let role: CaseEntityRole = CaseEntityRole.OTHER;
    if (entity.type === EntityType.PERSON) role = CaseEntityRole.SUBJECT;
    else if (entity.type === EntityType.LOCATION) role = CaseEntityRole.LOCATION;
    else if (entity.type === EntityType.ACCOUNT) role = CaseEntityRole.ACCOUNT;
    else if (entity.type === EntityType.DEVICE) role = CaseEntityRole.DEVICE;
    else if (entity.type === EntityType.PHONE || entity.type === EntityType.EMAIL) role = CaseEntityRole.CONTACT;

    await prisma.caseEntity.upsert({
      where: {
        caseId_entityId_role: {
          caseId: ce.case_id,
          entityId: ce.entity_id,
          role,
        },
      },
      update: { confidence: 1.0 },
      create: {
        id: `ce-${ce.case_id}-${ce.entity_id}`,
        caseId: ce.case_id,
        entityId: ce.entity_id,
        role,
        confidence: 1.0,
      },
    });
  }
  console.log(`  ✓ Populated Case-Entity Links: ${caseEntitiesData.length}`);

  // --------------------------------------------------------------------------
  // 6. EVIDENCE FILES, STORAGE, SHA-256 HASH & EXTRACTIONS
  // --------------------------------------------------------------------------
  console.log('[PostgreSQL + Storage] Ingesting physical evidence files & calculating SHA-256...');
  const evidenceMap = new Map<string, { id: string; caseId: string; title: string; text: string; hash: string }>();

  for (const ev of evidenceData) {
    const filePath = path.join(datasetDir, ev.filename);
    let fileBuffer: Buffer;
    if (fs.existsSync(filePath)) {
      fileBuffer = fs.readFileSync(filePath);
    } else {
      fileBuffer = Buffer.from(`SYNTHETIC DEMO EVIDENCE — NOT REAL DATA\nFilename: ${ev.filename}\nCase: ${ev.case_id}`);
    }

    // Save physical file via real StorageService
    const storageResult = StorageService.saveFile(
      ev.case_id,
      ev.evidence_id,
      ev.filename,
      fileBuffer,
      'text/plain'
    );

    let evType: EvidenceType = EvidenceType.DOCUMENT;
    const typeLower = (ev.type || '').toUpperCase();
    if (typeLower === 'REPORT') evType = EvidenceType.REPORT;
    else if (typeLower === 'DIGITAL_LOG' || typeLower === 'LOG') evType = EvidenceType.LOG;
    else if (typeLower === 'FINANCIAL') evType = EvidenceType.TRANSACTION;

    const capturedAt = ev.captured_at ? new Date(ev.captured_at) : new Date();
    const title = ev.filename.replace(/\.txt$/, '').replace(/_/g, ' ').toUpperCase();

    const evidenceRecord = await prisma.evidence.upsert({
      where: { id: ev.evidence_id },
      update: {
        title,
        type: evType,
        sourceId: ev.source_id,
        fileName: storageResult.fileName,
        storagePath: storageResult.storagePath,
        mimeType: storageResult.mimeType,
        hash: storageResult.hash,
        processingStatus: ProcessingStatus.COMPLETED,
        textExtractionStatus: 'COMPLETED',
        nlpStatus: 'COMPLETED',
      },
      create: {
        id: ev.evidence_id,
        caseId: ev.case_id,
        sourceId: ev.source_id,
        title,
        description: `Synthetic demo evidence for ${ev.case_id} (${ev.filename})`,
        type: evType,
        fileName: storageResult.fileName,
        storagePath: storageResult.storagePath,
        mimeType: storageResult.mimeType,
        hash: storageResult.hash,
        collectedAt: capturedAt,
        processingStatus: ProcessingStatus.COMPLETED,
        textExtractionStatus: 'COMPLETED',
        nlpStatus: 'COMPLETED',
      },
    });

    const rawText = fileBuffer.toString('utf-8');
    const normalizedText = TextNormalizationService.normalizeDocumentText(rawText);
    const words = rawText.split(/\s+/).filter(Boolean);

    // Upsert EvidenceDocument
    const doc = await prisma.evidenceDocument.upsert({
      where: { evidenceId: evidenceRecord.id },
      update: {
        originalText: rawText,
        normalizedText,
        characterCount: normalizedText.length,
        wordCount: words.length,
        pageCount: 1,
        extractionMethod: 'AUTO',
      },
      create: {
        evidenceId: evidenceRecord.id,
        originalText: rawText,
        normalizedText,
        characterCount: normalizedText.length,
        wordCount: words.length,
        pageCount: 1,
        extractionMethod: 'AUTO',
      },
    });

    // Remove stale chunks and create EvidenceChunk
    await prisma.evidenceChunk.deleteMany({ where: { evidenceId: evidenceRecord.id } });
    const chunk = await prisma.evidenceChunk.create({
      data: {
        documentId: doc.id,
        evidenceId: evidenceRecord.id,
        chunkIndex: 0,
        text: normalizedText,
        startOffset: 0,
        endOffset: normalizedText.length,
        pageNumber: 1,
      },
    });

    // Check entities mentioned in this evidence document
    for (const ent of entitiesData) {
      const val = ent.value.trim();
      const idx = rawText.indexOf(val);
      if (idx !== -1) {
        await prisma.entityMention.upsert({
          where: { id: `em-${ev.evidence_id}-${ent.entity_id}` },
          update: {
            startOffset: idx,
            endOffset: idx + val.length,
            context: rawText.substring(Math.max(0, idx - 20), Math.min(rawText.length, idx + val.length + 20)),
          },
          create: {
            id: `em-${ev.evidence_id}-${ent.entity_id}`,
            entityId: ent.entity_id,
            evidenceId: ev.evidence_id,
            caseId: ev.case_id,
            chunkId: chunk.id,
            originalText: val,
            context: rawText.substring(Math.max(0, idx - 20), Math.min(rawText.length, idx + val.length + 20)),
            extractionMethod: ExtractionMethod.IMPORT,
            extractionConfidence: 0.95,
            startOffset: idx,
            endOffset: idx + val.length,
          },
        });
      }
    }

    evidenceMap.set(ev.evidence_id, {
      id: evidenceRecord.id,
      caseId: ev.case_id,
      title,
      text: rawText,
      hash: storageResult.hash,
    });
  }
  console.log(`  ✓ Populated Evidence: ${evidenceData.length} items with real physical storage, SHA-256 & text extraction.`);

  // --------------------------------------------------------------------------
  // 7. EVENTS
  // --------------------------------------------------------------------------
  console.log('[PostgreSQL] Upserting Timeline Events...');
  const locationNameToEntity: Record<string, string> = {
    bengaluru: 'ENT-014',
    hyderabad: 'ENT-015',
    mumbai: 'ENT-016',
  };

  for (const evt of eventsData) {
    let evtType: EventType = EventType.OTHER;
    const rawType = (evt.event_type || '').toUpperCase();
    if (rawType.includes('REPORT')) evtType = EventType.INCIDENT;
    else if (rawType.includes('PHONE') || rawType.includes('CALL')) evtType = EventType.COMMUNICATION;
    else if (rawType.includes('DEVICE')) evtType = EventType.LOGIN;
    else if (rawType.includes('ACCOUNT')) evtType = EventType.TRANSACTION;
    else if (rawType.includes('LOCATION')) evtType = EventType.LOCATION_CHANGE;

    const locName = (evt.location || '').toLowerCase();
    const locEntityId = locationNameToEntity[locName] || null;
    const timestamp = evt.timestamp ? new Date(evt.timestamp) : new Date();

    await prisma.event.upsert({
      where: { id: evt.event_id },
      update: {
        type: evtType,
        description: `${evt.description}: ${evt.event_type} at ${evt.location}`,
        timestamp,
        locationEntityId: locEntityId,
        confidence: 1.0,
      },
      create: {
        id: evt.event_id,
        caseId: evt.case_id,
        type: evtType,
        description: `${evt.description}: ${evt.event_type} at ${evt.location}`,
        timestamp,
        locationEntityId: locEntityId,
        confidence: 1.0,
      },
    });
  }
  console.log(`  ✓ Populated Events: ${eventsData.length}`);

  // --------------------------------------------------------------------------
  // 8. ENTITY RESOLUTION MATCHES
  // --------------------------------------------------------------------------
  console.log('[PostgreSQL] Upserting Entity Resolution Matches...');
  for (const match of entityResolutionData) {
    const isConfirmed = (match.status || '').toUpperCase() === 'CONFIRMED';
    const status = isConfirmed ? MatchStatus.CONFIRMED : MatchStatus.PENDING;
    const score = parseFloat(match.score) || 0.9;

    await prisma.entityMatch.upsert({
      where: { id: match.match_id },
      update: {
        similarityScore: score,
        status,
        reason: match.signals,
        reviewedById: isConfirmed ? adminUser.id : null,
        reviewedAt: isConfirmed ? new Date() : null,
      },
      create: {
        id: match.match_id,
        sourceEntityId: match.source_entity_id,
        targetEntityId: match.candidate_entity_id,
        matchType: MatchType.EXACT,
        similarityScore: score,
        status,
        reason: match.signals,
        reviewedById: isConfirmed ? adminUser.id : null,
        reviewedAt: isConfirmed ? new Date() : null,
      },
    });
  }
  console.log(`  ✓ Populated Entity Matches: ${entityResolutionData.length} (1 PENDING for UI review, 2 CONFIRMED)`);

  // --------------------------------------------------------------------------
  // 9. CASE CORRELATIONS
  // --------------------------------------------------------------------------
  console.log('[PostgreSQL] Upserting Case Correlations...');
  // Group correlations by unique case pair (sourceCaseId < targetCaseId)
  const casePairMap = new Map<string, { source: string; target: string; maxScore: number; signals: any[] }>();

  for (const corr of correlationsData) {
    const [c1, c2] = corr.case_a < corr.case_b ? [corr.case_a, corr.case_b] : [corr.case_b, corr.case_a];
    const key = `${c1}__${c2}`;
    const score = parseFloat(corr.score) || 0.8;

    if (!casePairMap.has(key)) {
      casePairMap.set(key, { source: c1, target: c2, maxScore: score, signals: [] });
    }

    const pair = casePairMap.get(key)!;
    pair.maxScore = Math.max(pair.maxScore, score);
    pair.signals.push({
      correlationId: corr.correlation_id,
      entityA: corr.entity_a,
      entityB: corr.entity_b,
      explanation: corr.explanation,
      score,
    });
  }

  for (const [key, pair] of casePairMap.entries()) {
    await prisma.caseCorrelation.upsert({
      where: {
        sourceCaseId_targetCaseId: {
          sourceCaseId: pair.source,
          targetCaseId: pair.target,
        },
      },
      update: {
        score: pair.maxScore,
        confidence: 1.0,
        signals: pair.signals,
        status: 'ACTIVE',
      },
      create: {
        id: `corr-${pair.source}-${pair.target}`,
        sourceCaseId: pair.source,
        targetCaseId: pair.target,
        score: pair.maxScore,
        confidence: 1.0,
        signals: pair.signals,
        status: 'ACTIVE',
      },
    });
  }
  console.log(`  ✓ Populated Case Correlations: ${casePairMap.size} case pairs (${correlationsData.length} analytical signals)`);

  // --------------------------------------------------------------------------
  // 10. DETECTED PATTERNS
  // --------------------------------------------------------------------------
  console.log('[PostgreSQL] Upserting Detected Patterns...');
  for (const pat of patternsData) {
    const sev = (pat.severity?.toUpperCase() as SeverityLevel) || SeverityLevel.MEDIUM;
    const entityList = (pat.entity_ids || '').split(';').map((s) => s.trim()).filter(Boolean);

    await prisma.detectedPattern.upsert({
      where: { id: pat.pattern_id },
      update: {
        patternType: pat.pattern_type,
        severity: sev,
        score: 0.88,
        explanation: pat.description,
        signals: { entityIds: entityList, patternType: pat.pattern_type },
        evidenceReferences: { entityIds: entityList },
        status: 'ACTIVE',
      },
      create: {
        id: pat.pattern_id,
        caseId: pat.case_id,
        entityId: entityList[0] || null,
        patternType: pat.pattern_type,
        severity: sev,
        score: 0.88,
        explanation: pat.description,
        signals: { entityIds: entityList, patternType: pat.pattern_type },
        evidenceReferences: { entityIds: entityList },
        status: 'ACTIVE',
      },
    });
  }
  console.log(`  ✓ Populated Detected Patterns: ${patternsData.length}`);

  // --------------------------------------------------------------------------
  // 11. CONTRADICTIONS & CLAIMS
  // --------------------------------------------------------------------------
  console.log('[PostgreSQL] Upserting Contradictions & Claims...');
  for (const con of contradictionsData) {
    const contradiction = await prisma.contradiction.upsert({
      where: { id: con.contradiction_id },
      update: {
        caseId: con.case_id,
        type: con.type,
        description: con.description,
        severity: SeverityLevel.HIGH,
        status: ContradictionStatus.ACTIVE,
      },
      create: {
        id: con.contradiction_id,
        caseId: con.case_id,
        type: con.type,
        description: con.description,
        severity: SeverityLevel.HIGH,
        status: ContradictionStatus.ACTIVE,
      },
    });

    // Clean existing claims and recreate
    await prisma.contradictionClaim.deleteMany({ where: { contradictionId: contradiction.id } });

    // Claim A
    await prisma.contradictionClaim.create({
      data: {
        id: `clm-${con.contradiction_id}-A`,
        contradictionId: contradiction.id,
        entityId: con.entity_id,
        evidenceId: con.evidence_a,
        claimText: `Claimed location: ${con.claim_a} (${con.claim_time_a})`,
        value: con.claim_a,
        timestamp: new Date(con.claim_time_a),
      },
    });

    // Claim B
    const evBId = con.evidence_b || 'EVD-008';
    await prisma.contradictionClaim.create({
      data: {
        id: `clm-${con.contradiction_id}-B`,
        contradictionId: contradiction.id,
        entityId: con.entity_id,
        evidenceId: evBId,
        claimText: `Observed location: ${con.claim_b} (${con.claim_time_b})`,
        value: con.claim_b,
        timestamp: new Date(con.claim_time_b),
      },
    });
  }
  console.log(`  ✓ Populated Contradictions: ${contradictionsData.length} (with verified conflicting claims)`);

  // --------------------------------------------------------------------------
  // 12. INTELLIGENCE FINDINGS
  // --------------------------------------------------------------------------
  console.log('[PostgreSQL] Upserting Intelligence Findings...');
  for (const fnd of findingsData) {
    const conf = parseFloat(fnd.confidence) || 0.85;

    await prisma.intelligenceFinding.upsert({
      where: { id: fnd.finding_id },
      update: {
        findingType: fnd.type,
        title: fnd.summary,
        summary: fnd.summary,
        confidence: conf,
        severity: SeverityLevel.HIGH,
        signals: { supportingReference: fnd.supporting_reference },
        evidenceReferences: { reference: fnd.supporting_reference },
        limitations: { note: fnd.limitations },
        status: 'ACTIVE',
      },
      create: {
        id: fnd.finding_id,
        caseId: fnd.case_id,
        findingType: fnd.type,
        title: fnd.summary,
        summary: fnd.summary,
        confidence: conf,
        severity: SeverityLevel.HIGH,
        signals: { supportingReference: fnd.supporting_reference },
        evidenceReferences: { reference: fnd.supporting_reference },
        limitations: { note: fnd.limitations },
        status: 'ACTIVE',
      },
    });
  }
  console.log(`  ✓ Populated Intelligence Findings: ${findingsData.length}`);

  // --------------------------------------------------------------------------
  // 13. ALERTS
  // --------------------------------------------------------------------------
  console.log('[PostgreSQL] Upserting Alerts...');
  for (const alt of alertsData) {
    let alertType: AlertType = AlertType.NEW_CONNECTION;
    const rawType = (alt.type || '').toUpperCase();
    if (rawType.includes('CONTRADICTION')) alertType = AlertType.CONTRADICTION;
    else if (rawType.includes('ANOMALY')) alertType = AlertType.ANOMALY;
    else if (rawType.includes('CORRELATION')) alertType = AlertType.NEW_CONNECTION;

    const sev = (alt.severity?.toUpperCase() as SeverityLevel) || SeverityLevel.MEDIUM;

    await prisma.alert.upsert({
      where: { id: alt.alert_id },
      update: {
        severity: sev,
        type: alertType,
        title: alt.message,
        description: alt.message,
        status: AlertStatus.ACTIVE,
        sourceSignal: { alertType: alt.type, originalStatus: alt.status },
      },
      create: {
        id: alt.alert_id,
        caseId: alt.case_id,
        severity: sev,
        type: alertType,
        title: alt.message,
        description: alt.message,
        status: AlertStatus.ACTIVE,
        sourceSignal: { alertType: alt.type, originalStatus: alt.status },
      },
    });
  }
  console.log(`  ✓ Populated Alerts: ${alertsData.length}\n`);

  // --------------------------------------------------------------------------
  // 14. NEO4J GRAPH DB SYNCHRONIZATION
  // --------------------------------------------------------------------------
  console.log('[Neo4j] Synchronizing Graph Nodes and Relationships with Provenance...');
  await initNeo4jConstraints();

  const session = getNeo4jSession();
  try {
    // 14.1 Case Nodes
    for (const c of casesData) {
      await session.run(
        `MERGE (c:Case { id: $id })
         ON CREATE SET c.caseNumber = $caseNumber, c.title = $title, c.status = $status, c.priority = $priority
         ON MATCH SET c.caseNumber = $caseNumber, c.title = $title, c.status = $status, c.priority = $priority`,
        {
          id: c.case_id,
          caseNumber: c.case_id,
          title: c.title,
          status: 'OPEN',
          priority: c.priority || 'MEDIUM',
        }
      );
    }

    // 14.2 Source Nodes
    for (const s of sourcesData) {
      await session.run(
        `MERGE (src:Source { id: $id })
         ON CREATE SET src.name = $name, src.type = $type, src.reliability = $reliability
         ON MATCH SET src.name = $name, src.type = $type, src.reliability = $reliability`,
        {
          id: s.source_id,
          name: s.title,
          type: s.source_type,
          reliability: 'HIGH',
        }
      );
    }

    // 14.3 Evidence Nodes & Case Links
    for (const ev of evidenceData) {
      const stored = evidenceMap.get(ev.evidence_id);
      await session.run(
        `MERGE (e:Evidence { id: $id })
         ON CREATE SET e.title = $title, e.type = $type, e.fileName = $fileName, e.hash = $hash
         ON MATCH SET e.title = $title, e.type = $type, e.fileName = $fileName, e.hash = $hash
         WITH e
         MATCH (c:Case { id: $caseId })
         MERGE (c)-[:HAS_EVIDENCE]->(e)
         MERGE (e)-[:PART_OF { caseId: $caseId }]->(c)`,
        {
          id: ev.evidence_id,
          title: stored?.title || ev.filename,
          type: ev.type,
          fileName: ev.filename,
          hash: stored?.hash || '',
          caseId: ev.case_id,
        }
      );
    }

    // 14.4 Entity Nodes
    for (const ent of entitiesData) {
      const type = (ent.type?.toUpperCase() as EntityType) || EntityType.OTHER;
      const canonicalValue = ent.value.trim();
      const normalizedValue = TextNormalizationService.normalizeEntityValue(canonicalValue, type);

      await session.run(
        `MERGE (e:Entity { id: $id })
         ON CREATE SET e.type = $type, e.canonicalValue = $canonicalValue, e.displayName = $displayName, e.normalizedValue = $normalizedValue
         ON MATCH SET e.type = $type, e.canonicalValue = $canonicalValue, e.displayName = $displayName, e.normalizedValue = $normalizedValue`,
        {
          id: ent.entity_id,
          type,
          canonicalValue,
          displayName: canonicalValue,
          normalizedValue,
        }
      );

      if (type === EntityType.LOCATION && locationCoords[ent.entity_id]) {
        const coords = locationCoords[ent.entity_id];
        await session.run(
          `MERGE (l:Location { id: $id })
           ON CREATE SET l.latitude = $lat, l.longitude = $lon, l.city = $city, l.address = $city
           ON MATCH SET l.latitude = $lat, l.longitude = $lon, l.city = $city, l.address = $city`,
          {
            id: `loc-${ent.entity_id}`,
            lat: coords.lat,
            lon: coords.lon,
            city: coords.city,
          }
        );
      }
    }

    // 14.5 Case-Entity Relationships
    for (const ce of caseEntitiesData) {
      await session.run(
        `MATCH (c:Case { id: $caseId }), (e:Entity { id: $entityId })
         MERGE (c)-[r1:INVOLVES]->(e)
         SET r1.confidence = 1.0
         MERGE (e)-[r2:ASSOCIATED_WITH { caseId: $caseId }]->(c)
         SET r2.confidence = 1.0`,
        {
          caseId: ce.case_id,
          entityId: ce.entity_id,
        }
      );
    }

    // 14.6 Explicit Entity Connections (relationships.csv)
    for (const rel of relationshipsData) {
      const conf = parseFloat(rel.confidence) || 0.85;
      const prov = `Case ${rel.case_id}: Evidence ${rel.evidence_id} links ${rel.from_entity_id} to ${rel.to_entity_id} (${rel.relationship_type})`;

      // Generic CONNECTED_TO for universal network queries
      await session.run(
        `MATCH (a:Entity { id: $from }), (b:Entity { id: $to })
         MERGE (a)-[r:CONNECTED_TO { id: $relId }]->(b)
         SET r.connectionType = $relType,
             r.weight = $conf,
             r.confidence = $conf,
             r.caseId = $caseId,
             r.provenanceEvidenceId = $evidenceId,
             r.evidenceId = $evidenceId,
             r.provenance = $prov`,
        {
          from: rel.from_entity_id,
          to: rel.to_entity_id,
          relId: rel.relationship_id,
          relType: rel.relationship_type,
          conf,
          caseId: rel.case_id,
          evidenceId: rel.evidence_id,
          prov,
        }
      );

      // Typed relationship (USES_PHONE, USES_EMAIL, ASSOCIATED_WITH, etc.)
      await session.run(
        `MATCH (a:Entity { id: $from }), (b:Entity { id: $to })
         MERGE (a)-[r:${rel.relationship_type} { id: $relId }]->(b)
         SET r.confidence = $conf,
             r.weight = $conf,
             r.caseId = $caseId,
             r.evidenceId = $evidenceId,
             r.provenance = $prov`,
        {
          from: rel.from_entity_id,
          to: rel.to_entity_id,
          relId: rel.relationship_id,
          conf,
          caseId: rel.case_id,
          evidenceId: rel.evidence_id,
          prov,
        }
      );
    }

    // 14.7 Event Nodes & Links
    for (const evt of eventsData) {
      const locName = (evt.location || '').toLowerCase();
      const locEntityId = locationNameToEntity[locName] || null;

      await session.run(
        `MERGE (ev:Event { id: $id })
         ON CREATE SET ev.type = $type, ev.description = $desc, ev.timestamp = $ts, ev.caseId = $caseId
         ON MATCH SET ev.type = $type, ev.description = $desc, ev.timestamp = $ts, ev.caseId = $caseId
         WITH ev
         MATCH (c:Case { id: $caseId })
         MERGE (c)-[:HAS_EVENT]->(ev)
         WITH ev
         MATCH (ent:Entity { id: $entityId })
         MERGE (ev)-[:INVOLVES]->(ent)`,
        {
          id: evt.event_id,
          type: evt.event_type,
          desc: evt.description,
          ts: evt.timestamp,
          caseId: evt.case_id,
          entityId: evt.entity_id,
        }
      );

      if (locEntityId) {
        await session.run(
          `MATCH (ev:Event { id: $id }), (loc:Location { id: $locId })
           MERGE (ev)-[:OCCURRED_AT]->(loc)`,
          {
            id: evt.event_id,
            locId: `loc-${locEntityId}`,
          }
        );
      }
    }

    // 14.8 Cross-Case Correlations in Graph
    for (const corr of correlationsData) {
      const score = parseFloat(corr.score) || 0.85;
      await session.run(
        `MATCH (a:Entity { id: $entA }), (b:Entity { id: $entB })
         MERGE (a)-[r:CORRELATED_WITH { id: $id }]->(b)
         SET r.score = $score,
             r.reason = $explanation,
             r.caseIds = [$caseA, $caseB]`,
        {
          id: corr.correlation_id,
          entA: corr.entity_a,
          entB: corr.entity_b,
          score,
          explanation: corr.explanation,
          caseA: corr.case_a,
          caseB: corr.case_b,
        }
      );
    }

    // 14.9 Contradiction Link in Graph
    for (const con of contradictionsData) {
      const evA = con.evidence_a || 'EVD-007';
      const evB = con.evidence_b || 'EVD-008';
      await session.run(
        `MATCH (ent:Entity { id: $entId }), (evA:Evidence { id: $evA }), (evB:Evidence { id: $evB })
         MERGE (ent)-[r1:CONTRADICTS { id: $id, evidenceTarget: $evA }]->(evA)
         SET r1.reason = $desc, r1.caseId = $caseId, r1.severity = 'HIGH'
         MERGE (ent)-[r2:CONTRADICTS { id: $id, evidenceTarget: $evB }]->(evB)
         SET r2.reason = $desc, r2.caseId = $caseId, r2.severity = 'HIGH'`,
        {
          id: con.contradiction_id,
          entId: con.entity_id,
          evA,
          evB,
          desc: con.description,
          caseId: con.case_id,
        }
      );
    }

    console.log('  ✓ Neo4j graph nodes and relationships synchronized with full provenance.\n');
  } finally {
    await session.close();
  }

  // Audit Log
  await prisma.auditLog.create({
    data: {
      userId: adminUser.id,
      action: 'DEMO_SEED_COMPLETED',
      resourceType: 'DATABASE',
      metadata: {
        cases: casesData.length,
        sources: sourcesData.length,
        evidence: evidenceData.length,
        entities: entitiesData.length,
        events: eventsData.length,
        relationships: relationshipsData.length,
        status: 'SUCCESS',
        seededAt: new Date().toISOString(),
      },
      ipAddress: '127.0.0.1',
    },
  });

  console.log('==================================================');
  console.log('     DEMO DATASET INGESTION COMPLETED 100%!       ');
  console.log('==================================================\n');

  return {
    cases: casesData.length,
    sources: sourcesData.length,
    evidence: evidenceData.length,
    entities: entitiesData.length,
    caseEntities: caseEntitiesData.length,
    relationships: relationshipsData.length,
    events: eventsData.length,
    correlations: casePairMap.size,
    matches: entityResolutionData.length,
    patterns: patternsData.length,
    contradictions: contradictionsData.length,
    findings: findingsData.length,
    alerts: alertsData.length,
  };
}

// ============================================================================
// CLI ENTRYPOINT
// ============================================================================
if (require.main === module) {
  const isReset = process.argv.includes('--reset');
  const run = async () => {
    try {
      if (isReset) {
        await resetDemoData();
      } else {
        await seedDemo();
      }
    } catch (err) {
      console.error('❌ DEMO OPERATION FAILED:', err);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
      await closeNeo4j();
    }
  };
  run();
}
