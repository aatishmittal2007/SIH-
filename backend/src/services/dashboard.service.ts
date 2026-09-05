import { UserRole, CaseStatus, ContradictionStatus, MatchStatus } from '@prisma/client';
import { prisma } from '../db/prisma';

export interface DashboardSummaryResponse {
  user: {
    id: string;
    role: UserRole;
  };
  metrics: {
    totalCases: number;
    openCases: number;
    activeCases: number;
    closedCases: number;
    totalEvidence: number;
    pendingEntityMatches: number;
    activeCorrelations: number;
    activeContradictions: number;
    activeFindings: number;
    activeAlerts: number;
  };
  assignedCases: Array<{
    id: string;
    caseNumber: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    createdAt: Date;
    updatedAt: Date;
    evidenceCount?: number;
    contradictionCount?: number;
  }>;
  recentEvidence: Array<{
    id: string;
    caseId: string;
    caseNumber?: string;
    caseTitle?: string;
    title: string;
    type: string;
    sourceName?: string;
    processingStatus: string;
    createdAt: Date;
    label: 'CONFIRMED DATA';
  }>;
  pendingEntityMatches: Array<{
    id: string;
    sourceEntity: { id: string; displayName: string; type: string };
    targetEntity: { id: string; displayName: string; type: string };
    similarityScore: number;
    matchType: string;
    reason: string;
    status: string;
    createdAt: Date;
    label: 'CANDIDATE';
  }>;
  correlationCandidates: Array<{
    id: string;
    sourceCase: { id: string; caseNumber: string; title: string };
    targetCase: { id: string; caseNumber: string; title: string };
    score: number;
    confidence: number;
    signals: any;
    status: string;
    createdAt: Date;
    label: 'ANALYTICAL SIGNAL';
  }>;
  anomaliesAndPatterns: Array<{
    id: string;
    caseId: string | null;
    caseNumber?: string;
    caseTitle?: string;
    patternType: string;
    severity: string;
    score: number;
    explanation: string;
    detectedAt: Date;
    label: 'ANALYTICAL SIGNAL';
  }>;
  contradictions: Array<{
    id: string;
    caseId: string;
    caseNumber?: string;
    caseTitle?: string;
    type: string;
    description: string;
    severity: string;
    status: string;
    claimsCount: number;
    createdAt: Date;
    label: 'CONTRADICTION';
  }>;
  intelligenceFindings: Array<{
    id: string;
    caseId: string | null;
    caseNumber?: string;
    caseTitle?: string;
    findingType: string;
    title: string;
    summary: string;
    confidence: number;
    severity: string;
    status: string;
    createdAt: Date;
    label: 'ANALYTICAL SIGNAL';
  }>;
  recentActivity: Array<{
    id: string;
    action: string;
    resourceType: string;
    resourceId: string | null;
    userName?: string;
    createdAt: Date;
  }>;
  alerts: Array<{
    id: string;
    type: string;
    severity: string;
    title: string;
    description: string;
    caseId: string | null;
    caseNumber?: string;
    status: string;
    createdAt: Date;
    label: 'ANALYTICAL SIGNAL';
  }>;
}

export class DashboardService {
  /**
   * Fetch complete investigator dashboard data with RBAC and case-level authorization scoping.
   */
  static async getDashboardSummary(userId: string, role: UserRole): Promise<DashboardSummaryResponse> {
    // 1. Resolve authorized case IDs
    let authorizedCaseIds: string[] | null = null;

    if (role !== UserRole.ADMIN) {
      const userCases = await prisma.case.findMany({
        where: {
          OR: [
            { createdById: userId },
            { assignments: { some: { userId } } },
          ],
        },
        select: { id: true },
      });
      authorizedCaseIds = userCases.map((c) => c.id);
    }

    // Build reusable case filter clause
    const caseWhereClause = authorizedCaseIds !== null
      ? { id: { in: authorizedCaseIds } }
      : {};

    const caseIdRelationWhereClause = authorizedCaseIds !== null
      ? { caseId: { in: authorizedCaseIds } }
      : {};

    // Execute aggregated queries in parallel
    const [
      totalCases,
      openCases,
      activeCases,
      closedCases,
      totalEvidence,
      pendingEntityMatchesCount,
      activeCorrelationsCount,
      activeContradictionsCount,
      activeFindingsCount,
      activeAlertsCount,
      casesList,
      recentEvidenceRaw,
      pendingMatchesRaw,
      correlationsRaw,
      patternsRaw,
      contradictionsRaw,
      findingsRaw,
      recentActivityRaw,
      alertsRaw,
    ] = await Promise.all([
      // Counts
      prisma.case.count({ where: caseWhereClause }),
      prisma.case.count({ where: { ...caseWhereClause, status: CaseStatus.OPEN } }),
      prisma.case.count({ where: { ...caseWhereClause, status: CaseStatus.ACTIVE } }),
      prisma.case.count({ where: { ...caseWhereClause, status: CaseStatus.CLOSED } }),
      prisma.evidence.count({ where: caseIdRelationWhereClause }),
      prisma.entityMatch.count({ where: { status: MatchStatus.PENDING } }),
      prisma.caseCorrelation.count({
        where: authorizedCaseIds !== null
          ? {
              OR: [
                { sourceCaseId: { in: authorizedCaseIds } },
                { targetCaseId: { in: authorizedCaseIds } },
              ],
            }
          : {},
      }),
      prisma.contradiction.count({
        where: {
          ...caseIdRelationWhereClause,
          status: { in: [ContradictionStatus.ACTIVE, ContradictionStatus.INVESTIGATING] },
        },
      }),
      prisma.intelligenceFinding.count({
        where: authorizedCaseIds !== null
          ? { OR: [{ caseId: { in: authorizedCaseIds } }, { caseId: null }] }
          : {},
      }),
      prisma.alert.count({
        where: {
          status: 'ACTIVE',
          ...(authorizedCaseIds !== null
            ? { OR: [{ caseId: { in: authorizedCaseIds } }, { caseId: null }] }
            : {}),
        },
      }),

      // Case list (top 5 recent)
      prisma.case.findMany({
        where: caseWhereClause,
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          caseNumber: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              evidence: true,
              contradictions: true,
            },
          },
        },
      }),

      // Recent evidence (top 6)
      prisma.evidence.findMany({
        where: caseIdRelationWhereClause,
        orderBy: { createdAt: 'desc' },
        take: 6,
        include: {
          case: { select: { id: true, caseNumber: true, title: true } },
          source: { select: { name: true } },
        },
      }),

      // Pending Entity Matches (top 6)
      prisma.entityMatch.findMany({
        where: { status: MatchStatus.PENDING },
        orderBy: { similarityScore: 'desc' },
        take: 6,
        include: {
          sourceEntity: { select: { id: true, displayName: true, type: true } },
          targetEntity: { select: { id: true, displayName: true, type: true } },
        },
      }),

      // Correlations (top 5)
      prisma.caseCorrelation.findMany({
        where: authorizedCaseIds !== null
          ? {
              OR: [
                { sourceCaseId: { in: authorizedCaseIds } },
                { targetCaseId: { in: authorizedCaseIds } },
              ],
            }
          : {},
        orderBy: { score: 'desc' },
        take: 5,
        include: {
          sourceCase: { select: { id: true, caseNumber: true, title: true } },
          targetCase: { select: { id: true, caseNumber: true, title: true } },
        },
      }),

      // Anomalies & Patterns (top 5)
      prisma.detectedPattern.findMany({
        where: authorizedCaseIds !== null
          ? { OR: [{ caseId: { in: authorizedCaseIds } }, { caseId: null }] }
          : {},
        orderBy: { detectedAt: 'desc' },
        take: 5,
        include: {
          case: { select: { id: true, caseNumber: true, title: true } },
        },
      }),

      // Contradictions (top 5)
      prisma.contradiction.findMany({
        where: {
          ...caseIdRelationWhereClause,
          status: { in: [ContradictionStatus.ACTIVE, ContradictionStatus.INVESTIGATING] },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          case: { select: { id: true, caseNumber: true, title: true } },
          _count: { select: { claims: true } },
        },
      }),

      // Intelligence Findings (top 5)
      prisma.intelligenceFinding.findMany({
        where: authorizedCaseIds !== null
          ? { OR: [{ caseId: { in: authorizedCaseIds } }, { caseId: null }] }
          : {},
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          case: { select: { id: true, caseNumber: true, title: true } },
        },
      }),

      // Recent Activity (top 6)
      prisma.auditLog.findMany({
        where: role === UserRole.ADMIN
          ? {}
          : {
              OR: [
                { userId },
                ...(authorizedCaseIds && authorizedCaseIds.length > 0
                  ? [{ resourceId: { in: authorizedCaseIds } }]
                  : []),
              ],
            },
        orderBy: { createdAt: 'desc' },
        take: 6,
        include: {
          user: { select: { name: true } },
        },
      }),

      // Active Alerts (top 5)
      prisma.alert.findMany({
        where: {
          status: 'ACTIVE',
          ...(authorizedCaseIds !== null
            ? { OR: [{ caseId: { in: authorizedCaseIds } }, { caseId: null }] }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          case: { select: { caseNumber: true } },
        },
      }),
    ]);

    // Format & anonymize correlations for investigators if target case is restricted
    const formattedCorrelations = correlationsRaw.map((corr) => {
      const isSourceAuthorized = authorizedCaseIds === null || authorizedCaseIds.includes(corr.sourceCaseId);
      const isTargetAuthorized = authorizedCaseIds === null || authorizedCaseIds.includes(corr.targetCaseId);

      return {
        id: corr.id,
        sourceCase: isSourceAuthorized
          ? { id: corr.sourceCase.id, caseNumber: corr.sourceCase.caseNumber, title: corr.sourceCase.title }
          : { id: corr.sourceCase.id, caseNumber: 'RESTRICTED-CASE', title: 'Restricted Case File' },
        targetCase: isTargetAuthorized
          ? { id: corr.targetCase.id, caseNumber: corr.targetCase.caseNumber, title: corr.targetCase.title }
          : { id: corr.targetCase.id, caseNumber: 'RESTRICTED-CASE', title: 'Restricted Case File' },
        score: corr.score,
        confidence: corr.confidence,
        signals: corr.signals,
        status: corr.status,
        createdAt: corr.createdAt,
        label: 'ANALYTICAL SIGNAL' as const,
      };
    });

    return {
      user: {
        id: userId,
        role,
      },
      metrics: {
        totalCases,
        openCases,
        activeCases,
        closedCases,
        totalEvidence,
        pendingEntityMatches: pendingEntityMatchesCount,
        activeCorrelations: activeCorrelationsCount,
        activeContradictions: activeContradictionsCount,
        activeFindings: activeFindingsCount,
        activeAlerts: activeAlertsCount,
      },
      assignedCases: casesList.map((c) => ({
        id: c.id,
        caseNumber: c.caseNumber,
        title: c.title,
        description: c.description,
        status: c.status,
        priority: c.priority,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        evidenceCount: c._count.evidence,
        contradictionCount: c._count.contradictions,
      })),
      recentEvidence: recentEvidenceRaw.map((e) => ({
        id: e.id,
        caseId: e.caseId,
        caseNumber: e.case.caseNumber,
        caseTitle: e.case.title,
        title: e.title,
        type: e.type,
        sourceName: e.source?.name,
        processingStatus: e.processingStatus,
        createdAt: e.createdAt,
        label: 'CONFIRMED DATA',
      })),
      pendingEntityMatches: pendingMatchesRaw.map((m) => ({
        id: m.id,
        sourceEntity: m.sourceEntity,
        targetEntity: m.targetEntity,
        similarityScore: m.similarityScore,
        matchType: m.matchType,
        reason: m.reason,
        status: m.status,
        createdAt: m.createdAt,
        label: 'CANDIDATE',
      })),
      correlationCandidates: formattedCorrelations,
      anomaliesAndPatterns: patternsRaw.map((p) => ({
        id: p.id,
        caseId: p.caseId,
        caseNumber: p.case?.caseNumber,
        caseTitle: p.case?.title,
        patternType: p.patternType,
        severity: p.severity,
        score: p.score,
        explanation: p.explanation,
        detectedAt: p.detectedAt,
        label: 'ANALYTICAL SIGNAL',
      })),
      contradictions: contradictionsRaw.map((c) => ({
        id: c.id,
        caseId: c.caseId,
        caseNumber: c.case.caseNumber,
        caseTitle: c.case.title,
        type: c.type,
        description: c.description,
        severity: c.severity,
        status: c.status,
        claimsCount: c._count.claims,
        createdAt: c.createdAt,
        label: 'CONTRADICTION',
      })),
      intelligenceFindings: findingsRaw.map((f) => ({
        id: f.id,
        caseId: f.caseId,
        caseNumber: f.case?.caseNumber,
        caseTitle: f.case?.title,
        findingType: f.findingType,
        title: f.title,
        summary: f.summary,
        confidence: f.confidence,
        severity: f.severity,
        status: f.status,
        createdAt: f.createdAt,
        label: 'ANALYTICAL SIGNAL',
      })),
      recentActivity: recentActivityRaw.map((a) => ({
        id: a.id,
        action: a.action,
        resourceType: a.resourceType,
        resourceId: a.resourceId,
        userName: a.user?.name,
        createdAt: a.createdAt,
      })),
      alerts: alertsRaw.map((al) => ({
        id: al.id,
        type: al.type,
        severity: al.severity,
        title: al.title,
        description: al.description,
        caseId: al.caseId,
        caseNumber: al.case?.caseNumber,
        status: al.status,
        createdAt: al.createdAt,
        label: 'ANALYTICAL SIGNAL',
      })),
    };
  }
}
