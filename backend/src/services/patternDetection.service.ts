import { PrismaClient, SeverityLevel, UserRole } from '@prisma/client';
import { CorrelationEngineService } from './correlationEngine.service';
import { TemporalAnalysisService } from './temporalAnalysis.service';

const prisma = new PrismaClient();

export class PatternDetectionService {
  /**
   * Run pattern and anomaly detection engine across cases and entities
   */
  static async runPatternDetection(caseId?: string): Promise<number> {
    let createdCount = 0;

    // 1. Detect Cross-Case Entity Recurrence
    const recurringEntities = await prisma.caseEntity.groupBy({
      by: ['entityId'],
      _count: { caseId: true },
      having: {
        caseId: { _count: { gt: 1 } },
      },
    });

    for (const group of recurringEntities) {
      const caseCount = group._count.caseId;
      const entity = await prisma.entity.findUnique({
        where: { id: group.entityId },
      });

      if (!entity) continue;

      const caseEntities = await prisma.caseEntity.findMany({
        where: { entityId: group.entityId },
        select: { caseId: true },
      });
      const caseIds = caseEntities.map((ce) => ce.caseId);

      // Filter if caseId parameter is specified
      if (caseId && !caseIds.includes(caseId)) continue;

      const patternType = 'CROSS_CASE_ENTITY_RECURRENCE';
      const severity = caseCount >= 3 ? SeverityLevel.HIGH : SeverityLevel.MEDIUM;
      const score = Math.min(1.0, 0.4 + caseCount * 0.2);
      const explanation = `Entity "${entity.displayName}" (${entity.type}) appears across ${caseCount} distinct active investigation cases. Flagged for analyst review.`;

      // Idempotent upsert logic
      const existing = await prisma.detectedPattern.findFirst({
        where: {
          entityId: entity.id,
          patternType,
        },
      });

      if (existing) {
        await prisma.detectedPattern.update({
          where: { id: existing.id },
          data: {
            score,
            severity,
            explanation,
            signals: { caseIds, caseCount },
            evidenceReferences: { provenance: `Entity ${entity.id} linkage to cases ${caseIds.join(', ')}` },
            updatedAt: new Date(),
          },
        });
      } else {
        await prisma.detectedPattern.create({
          data: {
            caseId: caseIds[0], // primary reference case
            entityId: entity.id,
            patternType,
            severity,
            score,
            explanation,
            signals: { caseIds, caseCount },
            evidenceReferences: { provenance: `Entity ${entity.id} linkage to cases ${caseIds.join(', ')}` },
          },
        });
        createdCount++;
      }
    }

    // 2. Detect Temporal Burst Anomalies
    const casesToAnalyze = caseId
      ? [caseId]
      : (await prisma.case.findMany({ select: { id: true } })).map((c) => c.id);

    for (const cId of casesToAnalyze) {
      try {
        const temporalRes = await TemporalAnalysisService.analyzeCaseTemporalPatterns(
          cId,
          UserRole.ADMIN,
          'SYSTEM'
        );

        if (temporalRes.overlappingEvents.length >= 3) {
          const patternType = 'TEMPORAL_BURST';
          const existing = await prisma.detectedPattern.findFirst({
            where: {
              caseId: cId,
              patternType,
            },
          });

          const explanation = `High-density temporal burst detected in Case ${cId}: ${temporalRes.overlappingEvents.length} event pairs occurred within a short time window (<= 2 hours). Flagged for timeline review.`;

          if (existing) {
            await prisma.detectedPattern.update({
              where: { id: existing.id },
              data: {
                score: 0.8,
                severity: SeverityLevel.HIGH,
                explanation,
                signals: temporalRes.overlappingEvents,
                evidenceReferences: { provenance: `Case ${cId} timeline analysis` },
              },
            });
          } else {
            await prisma.detectedPattern.create({
              data: {
                caseId: cId,
                patternType,
                severity: SeverityLevel.HIGH,
                score: 0.8,
                explanation,
                signals: temporalRes.overlappingEvents,
                evidenceReferences: { provenance: `Case ${cId} timeline analysis` },
              },
            });
            createdCount++;
          }
        }
      } catch (err) {
        // Skip errors for cases without permissions/events during bulk batch
      }
    }

    return createdCount;
  }

  /**
   * Get detected patterns filtered by RBAC
   */
  static async getPatterns(userRole: string, userId: string, minScore: number = 0): Promise<any[]> {
    const normalizedMinScore = minScore > 1.0 ? minScore / 100 : minScore;
    let whereClause: any = {
      score: { gte: normalizedMinScore },
    };

    if (userRole !== UserRole.ADMIN) {
      const assignments = await prisma.caseAssignment.findMany({
        where: { userId },
        select: { caseId: true },
      });
      const assignedCaseIds = assignments.map((a) => a.caseId);

      whereClause.OR = [
        { caseId: { in: assignedCaseIds } },
        { caseId: null }
      ];
    }

    return prisma.detectedPattern.findMany({
      where: whereClause,
      include: {
        case: { select: { id: true, caseNumber: true, title: true } },
        entity: { select: { id: true, displayName: true, type: true } },
      },
      orderBy: { score: 'desc' },
    });
  }

  /**
   * Get pattern by ID with RBAC check
   */
  static async getPatternById(id: string, userRole: string, userId: string): Promise<any | null> {
    const pattern = await prisma.detectedPattern.findUnique({
      where: { id },
      include: {
        case: { select: { id: true, caseNumber: true, title: true } },
        entity: { select: { id: true, displayName: true, type: true } },
      },
    });

    if (!pattern) return null;

    if (userRole !== UserRole.ADMIN && pattern.caseId) {
      const assignment = await prisma.caseAssignment.findUnique({
        where: { caseId_userId: { caseId: pattern.caseId, userId } },
      });
      if (!assignment) {
        throw new Error('FORBIDDEN');
      }
    }

    return pattern;
  }
}
