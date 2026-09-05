import { prisma } from '../db/prisma';
import { getNeo4jSession, initNeo4jConstraints, clearNeo4jDatabase, closeNeo4j } from '../db/neo4j';
import {
  seedUsers,
  seedSources,
  seedCases,
  seedEvidence,
  seedEntities,
  seedLocations,
  seedEntityMentions,
  seedCaseEntities,
  seedEvents,
  seedEntityMatches,
  seedContradictions,
  seedContradictionClaims,
  seedAlerts,
  seedCaseAssignments,
} from './seedData';

export async function main() {
  console.log('==================================================');
  console.log('       TRACE-X DATA LAYER INITIALIZATION & SEED   ');
  console.log('==================================================\n');

  try {
    // ---------------------------------------------------------
    // 1. CLEAR POSTGRES DB
    // ---------------------------------------------------------
    console.log('[PostgreSQL] Cleaning existing database tables...');
    await prisma.caseAssignment.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.investigatorFeedback.deleteMany();
    await prisma.report.deleteMany();
    await prisma.alert.deleteMany();
    await prisma.contradictionClaim.deleteMany();
    await prisma.contradiction.deleteMany();
    await prisma.entityMatch.deleteMany();
    await prisma.event.deleteMany();
    await prisma.location.deleteMany();
    await prisma.caseEntity.deleteMany();
    await prisma.entityMention.deleteMany();
    await prisma.evidence.deleteMany();
    await prisma.entity.deleteMany();
    await prisma.case.deleteMany();
    await prisma.source.deleteMany();
    await prisma.user.deleteMany();
    console.log('[PostgreSQL] Database cleaned successfully.');

    // ---------------------------------------------------------
    // 2. SEED POSTGRES DB
    // ---------------------------------------------------------
    console.log('[PostgreSQL] Inserting seed records...');

    const preparedUsers = await seedUsers();
    for (const u of preparedUsers) {
      await prisma.user.create({ data: u });
    }
    console.log(`  ✓ Users created: ${preparedUsers.length}`);

    for (const s of seedSources) {
      await prisma.source.create({ data: s });
    }
    console.log(`  ✓ Sources created: ${seedSources.length}`);

    for (const c of seedCases) {
      await prisma.case.create({ data: c });
    }
    console.log(`  ✓ Cases created: ${seedCases.length}`);

    for (const ca of seedCaseAssignments) {
      await prisma.caseAssignment.create({ data: ca });
    }
    console.log(`  ✓ Case Assignments created: ${seedCaseAssignments.length}`);

    for (const ev of seedEvidence) {
      await prisma.evidence.create({ data: ev });
    }
    console.log(`  ✓ Evidence created: ${seedEvidence.length}`);

    for (const ent of seedEntities) {
      await prisma.entity.create({ data: ent });
    }
    console.log(`  ✓ Entities created: ${seedEntities.length}`);

    for (const loc of seedLocations) {
      await prisma.location.create({ data: loc });
    }
    console.log(`  ✓ Locations created: ${seedLocations.length}`);

    for (const em of seedEntityMentions) {
      await prisma.entityMention.create({ data: em });
    }
    console.log(`  ✓ Entity Mentions created: ${seedEntityMentions.length}`);

    for (const ce of seedCaseEntities) {
      await prisma.caseEntity.create({ data: ce });
    }
    console.log(`  ✓ Case Entities created: ${seedCaseEntities.length}`);

    for (const evt of seedEvents) {
      await prisma.event.create({ data: evt });
    }
    console.log(`  ✓ Events created: ${seedEvents.length}`);

    for (const ematch of seedEntityMatches) {
      await prisma.entityMatch.create({ data: ematch });
    }
    console.log(`  ✓ Entity Matches created: ${seedEntityMatches.length}`);

    for (const contra of seedContradictions) {
      await prisma.contradiction.create({ data: contra });
    }
    console.log(`  ✓ Contradictions created: ${seedContradictions.length}`);

    for (const claim of seedContradictionClaims) {
      await prisma.contradictionClaim.create({ data: claim });
    }
    console.log(`  ✓ Contradiction Claims created: ${seedContradictionClaims.length}`);

    for (const alert of seedAlerts) {
      await prisma.alert.create({ data: alert });
    }
    console.log(`  ✓ Alerts created: ${seedAlerts.length}`);

    // Audit log entry for seeding
    await prisma.auditLog.create({
      data: {
        userId: 'usr-admin-001',
        action: 'SYSTEM_SEED',
        resourceType: 'DATABASE',
        metadata: { status: 'SUCCESS', seededAt: new Date().toISOString() },
        ipAddress: '127.0.0.1',
      },
    });

    console.log('[PostgreSQL] Seed completed successfully.\n');

    // ---------------------------------------------------------
    // 3. SEED NEO4J GRAPH DB
    // ---------------------------------------------------------
    console.log('[Neo4j] Preparing Graph database...');
    await clearNeo4jDatabase();
    await initNeo4jConstraints();

    const session = getNeo4jSession();
    try {
      console.log('[Neo4j] Creating nodes...');

      // Create Case Nodes
      for (const c of seedCases) {
        await session.run(
          `CREATE (c:Case {
            id: $id,
            caseNumber: $caseNumber,
            title: $title,
            status: $status,
            priority: $priority
          })`,
          {
            id: c.id,
            caseNumber: c.caseNumber,
            title: c.title,
            status: c.status,
            priority: c.priority,
          }
        );
      }
      console.log(`  ✓ Case nodes: ${seedCases.length}`);

      // Create Evidence Nodes
      for (const ev of seedEvidence) {
        await session.run(
          `CREATE (e:Evidence {
            id: $id,
            type: $type,
            title: $title,
            fileName: $fileName,
            storagePath: $storagePath
          })`,
          {
            id: ev.id,
            type: ev.type,
            title: ev.title,
            fileName: ev.fileName,
            storagePath: ev.storagePath,
          }
        );
      }
      console.log(`  ✓ Evidence nodes: ${seedEvidence.length}`);

      // Create Entity Nodes
      for (const ent of seedEntities) {
        await session.run(
          `CREATE (e:Entity {
            id: $id,
            type: $type,
            canonicalValue: $canonicalValue,
            displayName: $displayName,
            normalizedValue: $normalizedValue
          })`,
          {
            id: ent.id,
            type: ent.type,
            canonicalValue: ent.canonicalValue,
            displayName: ent.displayName,
            normalizedValue: ent.normalizedValue,
          }
        );
      }
      console.log(`  ✓ Entity nodes: ${seedEntities.length}`);

      // Create Event Nodes
      for (const evt of seedEvents) {
        await session.run(
          `CREATE (e:Event {
            id: $id,
            type: $type,
            description: $description,
            timestamp: $timestamp
          })`,
          {
            id: evt.id,
            type: evt.type,
            description: evt.description,
            timestamp: evt.timestamp.toISOString(),
          }
        );
      }
      console.log(`  ✓ Event nodes: ${seedEvents.length}`);

      // Create Location Nodes
      for (const loc of seedLocations) {
        await session.run(
          `CREATE (l:Location {
            id: $id,
            latitude: $latitude,
            longitude: $longitude,
            address: $address,
            city: $city
          })`,
          {
            id: loc.id,
            latitude: loc.latitude,
            longitude: loc.longitude,
            address: loc.address || '',
            city: loc.city || '',
          }
        );
      }
      console.log(`  ✓ Location nodes: ${seedLocations.length}`);

      console.log('\n[Neo4j] Creating relationships with provenance...');

      // 1. Evidence PART_OF Case
      for (const ev of seedEvidence) {
        await session.run(
          `MATCH (e:Evidence { id: $evId }), (c:Case { id: $caseId })
           CREATE (e)-[:PART_OF { caseId: $caseId }]->(c)`,
          { evId: ev.id, caseId: ev.caseId }
        );
      }

      // 2. Entity MENTIONED_IN Evidence
      for (const em of seedEntityMentions) {
        await session.run(
          `MATCH (ent:Entity { id: $entityId }), (ev:Evidence { id: $evidenceId })
           CREATE (ent)-[:MENTIONED_IN {
             confidence: $confidence,
             extractionMethod: $method,
             caseId: $caseId,
             originalText: $originalText
           }]->(ev)`,
          {
            entityId: em.entityId,
            evidenceId: em.evidenceId,
            confidence: em.extractionConfidence,
            method: em.extractionMethod,
            caseId: em.caseId,
            originalText: em.originalText,
          }
        );
      }

      // 3. Entity ASSOCIATED_WITH Case
      for (const ce of seedCaseEntities) {
        await session.run(
          `MATCH (ent:Entity { id: $entityId }), (c:Case { id: $caseId })
           CREATE (ent)-[:ASSOCIATED_WITH {
             role: $role,
             confidence: $confidence,
             caseId: $caseId
           }]->(c)`,
          {
            entityId: ce.entityId,
            caseId: ce.caseId,
            role: ce.role,
            confidence: ce.confidence,
          }
        );
      }

      // 4. Graph Connected_To Entity-Entity Relationships
      const graphConnections = [
        {
          from: 'ent-person-001', // Vikram Malhotra
          to: 'ent-phone-001',   // +919876543210
          type: 'CONNECTED_TO',
          relType: 'USES_PHONE',
          weight: 0.95,
          caseId: 'case-001',
          provenanceEvidenceId: 'ev-002',
        },
        {
          from: 'ent-person-001', // Vikram Malhotra
          to: 'ent-org-001',     // Aether Holdings
          type: 'CONNECTED_TO',
          relType: 'DIRECTOR_OF',
          weight: 0.90,
          caseId: 'case-001',
          provenanceEvidenceId: 'ev-003',
        },
        {
          from: 'ent-phone-001', // +919876543210 (BRIDGE ENTITY)
          to: 'ent-ip-001',     // 45.132.228.12
          type: 'CONNECTED_TO',
          relType: 'REGISTERED_TO',
          weight: 0.92,
          caseId: 'case-002',
          provenanceEvidenceId: 'ev-004',
        },
        {
          from: 'ent-org-001',     // Aether Holdings
          to: 'ent-account-001', // Wallet 0x71C...
          type: 'CONNECTED_TO',
          relType: 'CONTROLS_WALLET',
          weight: 0.89,
          caseId: 'case-003',
          provenanceEvidenceId: 'ev-006',
        },
        {
          from: 'ent-person-002', // Ramesh Kumar
          to: 'ent-account-002', // HDFC A/C
          type: 'CONNECTED_TO',
          relType: 'KYC_HOLDER',
          weight: 0.98,
          caseId: 'case-001',
          provenanceEvidenceId: 'ev-003',
        },
      ];

      for (const gc of graphConnections) {
        await session.run(
          `MATCH (a:Entity { id: $from }), (b:Entity { id: $to })
           CREATE (a)-[:CONNECTED_TO {
             connectionType: $relType,
             weight: $weight,
             caseId: $caseId,
             provenanceEvidenceId: $provenanceEvidenceId
           }]->(b)`,
          gc
        );
      }

      // 5. Cross-Case Correlations
      await session.run(
        `MATCH (a:Entity { id: 'ent-phone-001' }), (b:Entity { id: 'ent-person-001' })
         CREATE (a)-[:CORRELATED_WITH {
           score: 0.98,
           reason: 'Cross-case bridge entity linking financial fraud (TX-2024-001) and SIM box network (TX-2024-002)',
           caseIds: ['case-001', 'case-002']
         }]->(b)`
      );

      // 6. Contradiction Links
      await session.run(
        `MATCH (ent:Entity { id: 'ent-person-001' }), (ev:Evidence { id: 'ev-005' })
         CREATE (ent)-[:CONTRADICTS {
           reason: 'Impossible travel timeline: CDR ping in BKC Mumbai conflicts with IGI Airport flight manifest to Dubai.',
           caseId: 'case-001',
           severity: 'CRITICAL'
         }]->(ev)`
      );

      // 7. Event & Location links
      for (const evt of seedEvents) {
        if (evt.locationEntityId) {
          await session.run(
            `MATCH (e:Event { id: $evtId }), (ent:Entity { id: $locEntId })
             CREATE (e)-[:OCCURRED_AT]->(ent)`,
            { evtId: evt.id, locEntId: evt.locationEntityId }
          );
        }
      }

      console.log('  ✓ Graph relationships seeded with full provenance.\n');
    } finally {
      await session.close();
    }

    console.log('==================================================');
    console.log('       SEED PROCESS COMPLETED SUCCESSFULLY!       ');
    console.log('==================================================');
  } catch (error) {
    console.error('❌ SEED FAILED WITH ERROR:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await closeNeo4j();
  }
}

if (require.main === module) {
  main();
}
