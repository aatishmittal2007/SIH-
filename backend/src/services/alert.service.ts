import { AlertStatus, AlertType, PrismaClient, SeverityLevel, UserRole } from '@prisma/client';
import { prisma } from '../db/prisma';
import { createAuditLog } from '../utils/audit';

export interface AlertFilterOpts {
  status?: AlertStatus;
  severity?: SeverityLevel;
  type?: AlertType;
  caseId?: string;
  entityId?: string;
  limit?: number;
  offset?: number;
}

export class AlertService {
  /**
   * Evaluates existing intelligence signals across PostgreSQL tables and generates neutral alerts.
   * Deduplicates active alerts by checking source signal metadata.
   */
  static async generateAlertsFromSignals(caseId?: string): Promise<{ createdCount: number }> {
    let createdCount = 0;

    // 1. High-severity detected patterns/anomalies
    const patternWhere: any = {
      severity: { in: [SeverityLevel.HIGH, SeverityLevel.CRITICAL] },
      status: 'ACTIVE',
    };
    if (caseId) patternWhere.caseId = caseId;

    const highPatterns = await prisma.detectedPattern.findMany({
      where: patternWhere,
      take: 50,
    });

    for (const pattern of highPatterns) {
      const signalId = pattern.id;
      const signalType = 'DETECTED_PATTERN';

      const existing = await prisma.alert.findFirst({
        where: {
          status: AlertStatus.ACTIVE,
          caseId: pattern.caseId || undefined,
          sourceSignal: {
            path: ['signalId'],
            equals: signalId,
          },
        },
      });

      if (!existing) {
        const newAlert = await prisma.alert.create({
          data: {
            type: pattern.patternType.toLowerCase().includes('anomaly') ? AlertType.ANOMALY : AlertType.HIGH_RISK,
            severity: pattern.severity,
            title: `Unusual activity pattern detected (${pattern.patternType})`,
            description: `Pattern detected with score ${pattern.score}: ${pattern.explanation}`,
            caseId: pattern.caseId,
            entityId: pattern.entityId,
            sourceSignal: { signalType, signalId, score: pattern.score },
            status: AlertStatus.ACTIVE,
          },
        });
        createdCount++;
        await createAuditLog({
          action: 'ALERT_GENERATED',
          resourceType: 'ALERT',
          resourceId: newAlert.id,
          metadata: { caseId: pattern.caseId, signalType, signalId },
        });
      }
    }

    // 2. Active contradictions
    const contradictionWhere: any = {
      status: { in: ['ACTIVE', 'INVESTIGATING'] },
    };
    if (caseId) contradictionWhere.caseId = caseId;

    const contradictions = await prisma.contradiction.findMany({
      where: contradictionWhere,
      take: 50,
    });

    for (const contra of contradictions) {
      const signalId = contra.id;
      const signalType = 'CONTRADICTION';

      const existing = await prisma.alert.findFirst({
        where: {
          status: AlertStatus.ACTIVE,
          caseId: contra.caseId,
          sourceSignal: {
            path: ['signalId'],
            equals: signalId,
          },
        },
      });

      if (!existing) {
        const newAlert = await prisma.alert.create({
          data: {
            type: AlertType.CONTRADICTION,
            severity: contra.severity,
            title: `Contradictory claims identified (${contra.type})`,
            description: `Contradiction identified in case evidence: ${contra.description}`,
            caseId: contra.caseId,
            sourceSignal: { signalType, signalId },
            status: AlertStatus.ACTIVE,
          },
        });
        createdCount++;
        await createAuditLog({
          action: 'ALERT_GENERATED',
          resourceType: 'ALERT',
          resourceId: newAlert.id,
          metadata: { caseId: contra.caseId, signalType, signalId },
        });
      }
    }

    // 3. Strong cross-case correlations (score >= 0.7)
    const correlationWhere: any = {
      score: { gte: 0.7 },
      status: 'ACTIVE',
    };
    if (caseId) {
      correlationWhere.OR = [{ sourceCaseId: caseId }, { targetCaseId: caseId }];
    }

    const correlations = await prisma.caseCorrelation.findMany({
      where: correlationWhere,
      include: {
        sourceCase: { select: { caseNumber: true } },
        targetCase: { select: { caseNumber: true } },
      },
      take: 50,
    });

    for (const corr of correlations) {
      const signalId = corr.id;
      const signalType = 'CASE_CORRELATION';

      const targetAlertCaseId = caseId || corr.sourceCaseId;

      const existing = await prisma.alert.findFirst({
        where: {
          status: AlertStatus.ACTIVE,
          caseId: targetAlertCaseId,
          sourceSignal: {
            path: ['signalId'],
            equals: signalId,
          },
        },
      });

      if (!existing) {
        const severity = corr.score >= 0.85 ? SeverityLevel.HIGH : SeverityLevel.MEDIUM;
        const newAlert = await prisma.alert.create({
          data: {
            type: AlertType.NEW_CONNECTION,
            severity,
            title: `Potential cross-case correlation detected`,
            description: `Correlation score of ${corr.score} detected between Case ${corr.sourceCase.caseNumber} and Case ${corr.targetCase.caseNumber}.`,
            caseId: targetAlertCaseId,
            sourceSignal: { signalType, signalId, score: corr.score, targetCaseId: corr.targetCaseId },
            status: AlertStatus.ACTIVE,
          },
        });
        createdCount++;
        await createAuditLog({
          action: 'ALERT_GENERATED',
          resourceType: 'ALERT',
          resourceId: newAlert.id,
          metadata: { caseId: targetAlertCaseId, signalType, signalId },
        });
      }
    }

    // 4. Pending high-confidence Entity Resolution matches (similarityScore >= 0.85)
    const matchWhere: any = {
      status: 'PENDING',
      similarityScore: { gte: 0.85 },
    };

    const entityMatches = await prisma.entityMatch.findMany({
      where: matchWhere,
      include: {
        sourceEntity: { select: { displayName: true, type: true } },
        targetEntity: { select: { displayName: true, type: true } },
      },
      take: 50,
    });

    for (const match of entityMatches) {
      const signalId = match.id;
      const signalType = 'ENTITY_MATCH';

      const existing = await prisma.alert.findFirst({
        where: {
          status: AlertStatus.ACTIVE,
          entityId: match.sourceEntityId,
          sourceSignal: {
            path: ['signalId'],
            equals: signalId,
          },
        },
      });

      if (!existing) {
        const severity = match.similarityScore >= 0.95 ? SeverityLevel.HIGH : SeverityLevel.MEDIUM;
        const newAlert = await prisma.alert.create({
          data: {
            type: AlertType.NEW_CONNECTION,
            severity,
            title: `Potential entity match candidate identified`,
            description: `High-confidence entity match candidate detected between "${match.sourceEntity.displayName}" and "${match.targetEntity.displayName}" (Similarity: ${match.similarityScore}).`,
            entityId: match.sourceEntityId,
            sourceSignal: { signalType, signalId, targetEntityId: match.targetEntityId, score: match.similarityScore },
            status: AlertStatus.ACTIVE,
          },
        });
        createdCount++;
        await createAuditLog({
          action: 'ALERT_GENERATED',
          resourceType: 'ALERT',
          resourceId: newAlert.id,
          metadata: { entityId: match.sourceEntityId, signalType, signalId },
        });
      }
    }

    return { createdCount };
  }

  /**
   * List alerts with RBAC enforcement and filtering options.
   */
  static async listAlerts(
    opts: AlertFilterOpts,
    userId: string,
    userRole: string
  ): Promise<{ alerts: any[]; total: number }> {
    let allowedCaseIds: string[] | null = null;
    if (userRole !== UserRole.ADMIN) {
      const assignments = await prisma.caseAssignment.findMany({
        where: { userId },
        select: { caseId: true },
      });
      allowedCaseIds = assignments.map((a) => a.caseId);

      if (opts.caseId) {
        if (!allowedCaseIds.includes(opts.caseId)) {
          throw new Error('FORBIDDEN');
        }
      }
    }

    const where: any = {};
    if (opts.status) where.status = opts.status;
    if (opts.severity) where.severity = opts.severity;
    if (opts.type) where.type = opts.type;
    if (opts.entityId) where.entityId = opts.entityId;

    if (opts.caseId) {
      where.caseId = opts.caseId;
    } else if (allowedCaseIds !== null) {
      where.OR = [
        { caseId: { in: allowedCaseIds } },
        { caseId: null },
      ];
    }

    const limit = opts.limit && opts.limit > 0 ? Math.min(Number(opts.limit), 100) : 50;
    const offset = opts.offset && opts.offset >= 0 ? Number(opts.offset) : 0;

    const [alerts, total] = await Promise.all([
      prisma.alert.findMany({
        where,
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
        include: {
          case: { select: { id: true, caseNumber: true, title: true } },
          entity: { select: { id: true, displayName: true, canonicalValue: true, type: true } },
          resolvedBy: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.alert.count({ where }),
    ]);

    const formatted = alerts.map((al) => ({
      id: al.id,
      type: al.type,
      severity: al.severity,
      title: al.title,
      description: al.description,
      caseId: al.caseId,
      case: al.case,
      entityId: al.entityId,
      entity: al.entity,
      sourceSignal: al.sourceSignal,
      status: al.status,
      createdAt: al.createdAt.toISOString(),
      resolvedAt: al.resolvedAt ? al.resolvedAt.toISOString() : null,
      resolutionComment: al.resolutionComment,
      resolvedBy: al.resolvedBy,
      navigation: {
        caseId: al.caseId,
        entityId: al.entityId,
        sourceSignal: al.sourceSignal,
      },
    }));

    return { alerts: formatted, total };
  }

  /**
   * Retrieve a single alert details with authorization check.
   */
  static async getAlertById(alertId: string, userId: string, userRole: string): Promise<any> {
    const alert = await prisma.alert.findUnique({
      where: { id: alertId },
      include: {
        case: { select: { id: true, caseNumber: true, title: true, status: true, priority: true } },
        entity: { select: { id: true, displayName: true, canonicalValue: true, type: true } },
        resolvedBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!alert) {
      throw new Error('NOT_FOUND');
    }

    if (userRole !== UserRole.ADMIN && alert.caseId) {
      const assignment = await prisma.caseAssignment.findUnique({
        where: { caseId_userId: { caseId: alert.caseId, userId } },
      });
      if (!assignment) {
        throw new Error('FORBIDDEN');
      }
    }

    return {
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      description: alert.description,
      caseId: alert.caseId,
      case: alert.case,
      entityId: alert.entityId,
      entity: alert.entity,
      sourceSignal: alert.sourceSignal,
      status: alert.status,
      createdAt: alert.createdAt.toISOString(),
      resolvedAt: alert.resolvedAt ? alert.resolvedAt.toISOString() : null,
      resolutionComment: alert.resolutionComment,
      resolutionMetadata: alert.resolutionMetadata,
      resolvedBy: alert.resolvedBy,
      navigationTarget: {
        caseId: alert.caseId,
        entityId: alert.entityId,
        sourceSignal: alert.sourceSignal,
      },
    };
  }

  /**
   * Update status of an alert (e.g. ACKNOWLEDGED, RESOLVED, DISMISSED) with investigator comments.
   */
  static async updateAlertStatus(
    alertId: string,
    status: AlertStatus,
    comment: string | undefined,
    userId: string,
    userRole: string
  ): Promise<any> {
    const alert = await prisma.alert.findUnique({
      where: { id: alertId },
    });

    if (!alert) {
      throw new Error('NOT_FOUND');
    }

    if (userRole !== UserRole.ADMIN && alert.caseId) {
      const assignment = await prisma.caseAssignment.findUnique({
        where: { caseId_userId: { caseId: alert.caseId, userId } },
      });
      if (!assignment) {
        throw new Error('FORBIDDEN');
      }
    }

    const isResolving = status === AlertStatus.RESOLVED || status === AlertStatus.DISMISSED;

    const updated = await prisma.alert.update({
      where: { id: alertId },
      data: {
        status,
        resolutionComment: comment || alert.resolutionComment,
        resolvedAt: isResolving ? new Date() : alert.resolvedAt,
        resolvedById: isResolving ? userId : alert.resolvedById,
      },
      include: {
        case: { select: { id: true, caseNumber: true, title: true } },
        entity: { select: { id: true, displayName: true, type: true } },
        resolvedBy: { select: { id: true, name: true } },
      },
    });

    await createAuditLog({
      userId,
      action: status === AlertStatus.RESOLVED ? 'ALERT_RESOLVED' : 'ALERT_REVIEWED',
      resourceType: 'ALERT',
      resourceId: alertId,
      metadata: { newStatus: status, comment, caseId: alert.caseId },
    });

    return updated;
  }
}
