import { PrismaClient, UserRole, MatchStatus } from '@prisma/client';

const prisma = new PrismaClient();

export interface CorrelationSignal {
  type: string;
  weight: number;
  description: string;
  entityId?: string;
  evidenceId?: string;
  provenance?: string;
}

export interface CorrelationResult {
  id?: string;
  sourceCaseId: string;
  targetCaseId: string;
  score: number;
  confidence: number;
  signals: CorrelationSignal[];
  conflictingSignals: CorrelationSignal[];
  status: string;
}

export class CorrelationEngineService {
  /**
   * Run cross-case correlation algorithm
   */
  static async runCorrelation(targetCaseId?: string): Promise<{ processedCount: number; correlations: CorrelationResult[] }> {
    // 1. Get all cases (or target case and all other cases)
    const cases = await prisma.case.findMany({
      select: { id: true, caseNumber: true, title: true },
    });

    if (cases.length < 2) {
      return { processedCount: 0, correlations: [] };
    }

    const casesToCorrelate = targetCaseId ? cases.filter((c) => c.id === targetCaseId) : cases;
    const allCorrelations: CorrelationResult[] = [];
    let processedCount = 0;

    for (const c1 of casesToCorrelate) {
      // 2. Fetch entities for Case 1
      const c1Entities = await prisma.caseEntity.findMany({
        where: { caseId: c1.id },
        include: { entity: true },
      });

      if (c1Entities.length === 0) continue;

      const c1EntityIds = c1Entities.map((ce) => ce.entityId);
      const c1Values = c1Entities.map((ce) => ce.entity.normalizedValue);

      // Indexed/Blocking candidate generation: find other cases sharing normalized entity values or confirmed matches
      const candidateCases = cases.filter((c) => c.id !== c1.id);

      for (const c2 of candidateCases) {
        // Enforce consistent ordering to avoid duplicate pairs (source < target lexicographically)
        if (targetCaseId ? false : c1.id >= c2.id) continue;

        const c2Entities = await prisma.caseEntity.findMany({
          where: { caseId: c2.id },
          include: { entity: true },
        });

        if (c2Entities.length === 0) continue;

        const signals: CorrelationSignal[] = [];
        const conflictingSignals: CorrelationSignal[] = [];
        let score = 0;

        // Signal 1: Shared Confirmed Entities
        for (const ce1 of c1Entities) {
          for (const ce2 of c2Entities) {
            // Direct entity ID match or normalized value match
            if (ce1.entityId === ce2.entityId || (ce1.entity.normalizedValue === ce2.entity.normalizedValue && ce1.entity.type === ce2.entity.type)) {
              let weight = 0.15;
              if (['PHONE', 'EMAIL', 'ACCOUNT', 'DEVICE'].includes(ce1.entity.type)) weight = 0.35;
              else if (ce1.entity.type === 'PERSON') weight = 0.25;
              else if (['LOCATION', 'DOMAIN', 'IP_ADDRESS'].includes(ce1.entity.type)) weight = 0.15;

              score += weight;
              signals.push({
                type: 'SHARED_CONFIRMED_ENTITY',
                weight,
                description: `Both cases contain ${ce1.entity.type} entity "${ce1.entity.displayName}" (${ce1.entity.canonicalValue})`,
                entityId: ce1.entityId,
                provenance: `Case ${c1.id} & Case ${c2.id} both reference Entity ${ce1.entityId}`,
              });
            }
          }
        }

        // Signal 2: Confirmed Entity Resolution Matches between entities of Case 1 and Case 2
        const c2EntityIds = c2Entities.map((ce) => ce.entityId);
        const confirmedMatches = await prisma.entityMatch.findMany({
          where: {
            status: MatchStatus.CONFIRMED,
            OR: [
              { sourceEntityId: { in: c1EntityIds }, targetEntityId: { in: c2EntityIds } },
              { sourceEntityId: { in: c2EntityIds }, targetEntityId: { in: c1EntityIds } },
            ],
          },
        });

        for (const match of confirmedMatches) {
          const weight = 0.40;
          score += weight;
          signals.push({
            type: 'CONFIRMED_ENTITY_RESOLUTION',
            weight,
            description: `Confirmed entity resolution match between entities (${match.sourceEntityId} ↔ ${match.targetEntityId}) with similarity ${match.similarityScore}`,
            provenance: `EntityMatch ID ${match.id} (CONFIRMED)`,
          });
        }

        // Signal 3: Shared Events or Locations
        const c1Events = await prisma.event.findMany({ where: { caseId: c1.id } });
        const c2Events = await prisma.event.findMany({ where: { caseId: c2.id } });

        for (const ev1 of c1Events) {
          for (const ev2 of c2Events) {
            // Temporal overlap check (events within 24 hours of each other)
            const timeDiffHours = Math.abs(ev1.timestamp.getTime() - ev2.timestamp.getTime()) / (1000 * 60 * 60);
            if (timeDiffHours <= 24) {
              const weight = 0.10;
              score += weight;
              signals.push({
                type: 'TEMPORAL_OVERLAP',
                weight,
                description: `Events occurred within ${Math.round(timeDiffHours)} hours of each other (${ev1.type} vs ${ev2.type})`,
                provenance: `Event ${ev1.id} (${ev1.timestamp.toISOString()}) & Event ${ev2.id} (${ev2.timestamp.toISOString()})`,
              });
            }
          }
        }

        // Check for Conflicting Signals (e.g. Alibi contradiction across cases)
        const contradictions = await prisma.contradiction.findMany({
          where: { caseId: { in: [c1.id, c2.id] } },
        });
        if (contradictions.length > 0) {
          conflictingSignals.push({
            type: 'CONTRADICTION_FLAGGED',
            weight: -0.15,
            description: `Active contradiction registered in participating cases`,
            provenance: `Contradiction ID ${contradictions[0].id}`,
          });
          score = Math.max(0, score - 0.15);
        }

        // Cap score normalized to 0.0-1.0 range
        const finalScore = Math.min(1.0, Math.max(0.0, Number(score.toFixed(2))));

        // Only record meaningful correlations (score > 0)
        if (signals.length > 0) {
          // Store/upsert in PostgreSQL
          const correlation = await prisma.caseCorrelation.upsert({
            where: {
              sourceCaseId_targetCaseId: {
                sourceCaseId: c1.id,
                targetCaseId: c2.id,
              },
            },
            update: {
              score: finalScore,
              confidence: 0.9,
              signals: signals as any,
              conflictingSignals: conflictingSignals as any,
              status: 'ACTIVE',
            },
            create: {
              sourceCaseId: c1.id,
              targetCaseId: c2.id,
              score: finalScore,
              confidence: 0.9,
              signals: signals as any,
              conflictingSignals: conflictingSignals as any,
              status: 'ACTIVE',
            },
          });

          processedCount++;
          allCorrelations.push({
            id: correlation.id,
            sourceCaseId: c1.id,
            targetCaseId: c2.id,
            score: finalScore,
            confidence: 0.9,
            signals,
            conflictingSignals,
            status: correlation.status,
          });
        }
      }
    }

    return { processedCount, correlations: allCorrelations };
  }

  /**
   * Get all correlations with RBAC filtering
   */
  static async getCorrelations(userRole: string, userId: string, minScore: number = 0): Promise<any[]> {
    const normalizedMinScore = minScore > 1.0 ? minScore / 100 : minScore;
    let whereClause: any = { score: { gte: normalizedMinScore } };

    if (userRole !== UserRole.ADMIN) {
      const userAssignments = await prisma.caseAssignment.findMany({
        where: { userId },
        select: { caseId: true },
      });
      const assignedCaseIds = userAssignments.map((a) => a.caseId);

      whereClause = {
        ...whereClause,
        OR: [{ sourceCaseId: { in: assignedCaseIds } }, { targetCaseId: { in: assignedCaseIds } }],
      };
    }

    return prisma.caseCorrelation.findMany({
      where: whereClause,
      include: {
        sourceCase: { select: { id: true, caseNumber: true, title: true, priority: true, status: true } },
        targetCase: { select: { id: true, caseNumber: true, title: true, priority: true, status: true } },
      },
      orderBy: { score: 'desc' },
    });
  }

  /**
   * Get correlation by ID
   */
  static async getCorrelationById(id: string, userRole: string, userId: string): Promise<any> {
    const correlation = await prisma.caseCorrelation.findUnique({
      where: { id },
      include: {
        sourceCase: { select: { id: true, caseNumber: true, title: true } },
        targetCase: { select: { id: true, caseNumber: true, title: true } },
      },
    });

    if (!correlation) return null;

    if (userRole !== UserRole.ADMIN) {
      const assignment = await prisma.caseAssignment.findFirst({
        where: {
          userId,
          caseId: { in: [correlation.sourceCaseId, correlation.targetCaseId] },
        },
      });
      if (!assignment) {
        throw new Error('FORBIDDEN');
      }
    }

    return correlation;
  }

  /**
   * Get correlations for a specific case ID
   */
  static async getCaseCorrelations(caseId: string, userRole: string, userId: string): Promise<any[]> {
    if (userRole !== UserRole.ADMIN) {
      const assignment = await prisma.caseAssignment.findUnique({
        where: { caseId_userId: { caseId, userId } },
      });
      if (!assignment) {
        throw new Error('FORBIDDEN');
      }
    }

    return prisma.caseCorrelation.findMany({
      where: {
        OR: [{ sourceCaseId: caseId }, { targetCaseId: caseId }],
      },
      include: {
        sourceCase: { select: { id: true, caseNumber: true, title: true } },
        targetCase: { select: { id: true, caseNumber: true, title: true } },
      },
      orderBy: { score: 'desc' },
    });
  }
}
