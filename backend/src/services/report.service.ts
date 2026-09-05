import { PrismaClient, UserRole } from '@prisma/client';
import { prisma } from '../db/prisma';
import { createAuditLog } from '../utils/audit';
import { NetworkAnalysisService } from './networkAnalysis.service';

export interface ReportFilterOpts {
  caseId?: string;
  limit?: number;
  offset?: number;
}

export class ReportService {
  /**
   * Deterministically generate a comprehensive case investigation report from REAL backend data.
   */
  static async generateCaseReport(
    caseId: string,
    userId: string,
    userRole: string,
    format: string = 'JSON'
  ): Promise<any> {
    // 1. RBAC Case Authorization Check
    if (userRole !== UserRole.ADMIN) {
      const assignment = await prisma.caseAssignment.findUnique({
        where: { caseId_userId: { caseId, userId } },
      });
      if (!assignment) {
        const c = await prisma.case.findUnique({ where: { id: caseId } });
        if (!c || c.createdById !== userId) {
          throw new Error('FORBIDDEN');
        }
      }
    }

    // 2. Aggregate REAL Case Data
    const caseDetails = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        assignments: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
      },
    });

    if (!caseDetails) {
      throw new Error('NOT_FOUND');
    }

    // Fetch Evidence & Sources
    const evidenceList = await prisma.evidence.findMany({
      where: { caseId },
      include: {
        source: true,
        document: { select: { characterCount: true, wordCount: true, pageCount: true, language: true } },
        entityMentions: {
          take: 20,
          select: { id: true, originalText: true, extractionConfidence: true, entityId: true },
        },
      },
    });

    // Fetch Case Entities
    const caseEntities = await prisma.caseEntity.findMany({
      where: { caseId },
      include: {
        entity: true,
      },
    });

    const entityIds = caseEntities.map((ce) => ce.entityId);

    // Fetch Confirmed & Candidate Entity Resolution Matches
    const entityMatches = entityIds.length > 0
      ? await prisma.entityMatch.findMany({
          where: {
            OR: [
              { sourceEntityId: { in: entityIds } },
              { targetEntityId: { in: entityIds } },
            ],
          },
          include: {
            sourceEntity: { select: { id: true, displayName: true, type: true } },
            targetEntity: { select: { id: true, displayName: true, type: true } },
          },
        })
      : [];

    const confirmedMatches = entityMatches.filter((m) => m.status === 'CONFIRMED');
    const candidateMatches = entityMatches.filter((m) => m.status === 'PENDING');

    // Fetch Events & Timeline
    const events = await prisma.event.findMany({
      where: { caseId },
      orderBy: { timestamp: 'asc' },
      include: {
        source: { select: { name: true } },
        locationEntity: { select: { displayName: true } },
      },
    });

    // Fetch Cross-Case Correlations
    const correlations = await prisma.caseCorrelation.findMany({
      where: {
        OR: [{ sourceCaseId: caseId }, { targetCaseId: caseId }],
      },
      include: {
        sourceCase: { select: { id: true, caseNumber: true, title: true } },
        targetCase: { select: { id: true, caseNumber: true, title: true } },
      },
    });

    // Fetch Anomalies & Patterns
    const detectedPatterns = await prisma.detectedPattern.findMany({
      where: { caseId },
    });

    // Fetch Contradictions & Claims
    const contradictions = await prisma.contradiction.findMany({
      where: { caseId },
      include: {
        claims: {
          include: {
            evidence: { select: { title: true } },
            entity: { select: { displayName: true } },
          },
        },
      },
    });

    // Fetch Intelligence Findings
    const intelligenceFindings = await prisma.intelligenceFinding.findMany({
      where: { caseId },
    });

    // Fetch Investigator Feedbacks
    const feedbacks = await prisma.investigatorFeedback.findMany({
      where: { caseId },
      include: {
        user: { select: { name: true, role: true } },
      },
    });

    // Network Findings (Safe evaluation)
    let networkSummary: any = { nodeCount: entityIds.length, edgeCount: 0, centralEntities: [] };
    try {
      const netResult = await NetworkAnalysisService.getInteractiveGraph({ caseId }, userRole, userId);
      networkSummary = {
        nodeCount: netResult.nodes.length,
        edgeCount: netResult.edges.length,
        centralEntities: netResult.nodes.slice(0, 5).map((n: any) => ({
          id: n.id,
          label: n.label,
          type: n.type,
        })),
      };
    } catch (err) {
      // Gracefully handle if network service returns empty or errors
    }

    // Identify Limitations & Uncertainty Caveats
    const unverifiedSources = evidenceList
      .filter((e) => e.source && (e.source.reliability === 'UNVERIFIED' || e.source.reliability === 'LOW'))
      .map((e) => ({
        evidenceTitle: e.title,
        sourceName: e.source?.name,
        reliability: e.source?.reliability,
      }));

    const activeContradictions = contradictions.filter((c) => c.status === 'ACTIVE' || c.status === 'INVESTIGATING');
    const lowConfidenceEvidence = evidenceList.filter((e) => e.nlpStatus === 'FAILED' || e.processingStatus === 'FAILED');

    // 3. Assemble Structured Report Content
    const reportContent = {
      reportHeader: {
        generatedAt: new Date().toISOString(),
        caseNumber: caseDetails.caseNumber,
        caseTitle: caseDetails.title,
        classificationLevel: 'RESTRICTED / INVESTIGATION CONFIDENTIAL',
        generator: {
          id: userId,
          role: userRole,
        },
      },
      section1_caseInformation: {
        id: caseDetails.id,
        caseNumber: caseDetails.caseNumber,
        title: caseDetails.title,
        description: caseDetails.description,
        status: caseDetails.status,
        priority: caseDetails.priority,
        createdAt: caseDetails.createdAt.toISOString(),
        updatedAt: caseDetails.updatedAt.toISOString(),
        createdBy: caseDetails.createdBy,
        investigators: caseDetails.assignments.map((a) => ({
          userId: a.user.id,
          name: a.user.name,
          email: a.user.email,
          role: a.user.role,
          assignedAt: a.assignedAt.toISOString(),
        })),
      },
      section2_establishedSourceData: {
        evidenceCount: evidenceList.length,
        items: evidenceList.map((e) => ({
          id: e.id,
          title: e.title,
          type: e.type,
          fileName: e.fileName,
          storagePath: e.storagePath,
          mimeType: e.mimeType,
          hash: e.hash,
          processingStatus: e.processingStatus,
          textExtractionStatus: e.textExtractionStatus,
          sourceName: e.source?.name || 'UNKNOWN',
          sourceReliability: e.source?.reliability || 'UNVERIFIED',
          documentStats: e.document
            ? {
                characterCount: e.document.characterCount,
                wordCount: e.document.wordCount,
                pageCount: e.document.pageCount,
              }
            : null,
          mentionCount: e.entityMentions.length,
        })),
      },
      section3_entitiesAndRoles: {
        entityCount: caseEntities.length,
        entities: caseEntities.map((ce) => ({
          entityId: ce.entityId,
          displayName: ce.entity.displayName,
          canonicalValue: ce.entity.canonicalValue,
          type: ce.entity.type,
          caseRole: ce.role,
          confidence: ce.confidence,
          firstSeenAt: ce.firstSeenAt ? ce.firstSeenAt.toISOString() : null,
          lastSeenAt: ce.lastSeenAt ? ce.lastSeenAt.toISOString() : null,
        })),
      },
      section4_confirmedRelationships: {
        confirmedMatchesCount: confirmedMatches.length,
        confirmedMatches: confirmedMatches.map((m) => ({
          id: m.id,
          sourceEntity: m.sourceEntity,
          targetEntity: m.targetEntity,
          similarityScore: m.similarityScore,
          matchType: m.matchType,
          reason: m.reason,
        })),
      },
      section5_candidateRelationships: {
        candidateMatchesCount: candidateMatches.length,
        candidateMatches: candidateMatches.map((m) => ({
          id: m.id,
          sourceEntity: m.sourceEntity,
          targetEntity: m.targetEntity,
          similarityScore: m.similarityScore,
          matchType: m.matchType,
          reason: m.reason,
          status: 'PENDING_REVIEW',
        })),
      },
      section6_analyticalSignals: {
        detectedPatternsCount: detectedPatterns.length,
        detectedPatterns: detectedPatterns.map((p) => ({
          id: p.id,
          patternType: p.patternType,
          severity: p.severity,
          score: p.score,
          explanation: p.explanation,
          detectedAt: p.detectedAt.toISOString(),
        })),
        crossCaseCorrelationsCount: correlations.length,
        crossCaseCorrelations: correlations.map((c) => ({
          id: c.id,
          sourceCase: c.sourceCase,
          targetCase: c.targetCase,
          score: c.score,
          confidence: c.confidence,
        })),
        networkAnalysis: networkSummary,
      },
      section7_unresolvedContradictions: {
        contradictionCount: contradictions.length,
        items: contradictions.map((c) => ({
          id: c.id,
          type: c.type,
          severity: c.severity,
          status: c.status,
          description: c.description,
          claims: c.claims.map((cl) => ({
            claimText: cl.claimText,
            value: cl.value,
            timestamp: cl.timestamp.toISOString(),
            evidenceTitle: cl.evidence?.title,
            entityName: cl.entity?.displayName,
          })),
        })),
      },
      section8_intelligenceFindings: {
        findingsCount: intelligenceFindings.length,
        items: intelligenceFindings.map((f) => ({
          id: f.id,
          findingType: f.findingType,
          title: f.title,
          summary: f.summary,
          confidence: f.confidence,
          severity: f.severity,
          status: f.status,
        })),
      },
      section9_investigatorReviewedConclusions: {
        feedbackCount: feedbacks.length,
        conclusions: feedbacks.map((f) => ({
          id: f.id,
          action: f.action,
          targetType: f.targetType,
          targetId: f.targetId,
          comment: f.comment,
          investigatorName: f.user.name,
          createdAt: f.createdAt.toISOString(),
        })),
      },
      section10_limitationsAndUncertainty: {
        unverifiedSourcesCount: unverifiedSources.length,
        unverifiedSources,
        activeContradictionsCount: activeContradictions.length,
        unresolvedCandidatesCount: candidateMatches.length,
        processingWarningsCount: lowConfidenceEvidence.length,
        disclaimer:
          'This investigation report contains automated analytical signals, unconfirmed candidate matches, and ongoing contradiction flags. Conclusions should be verified by assigned investigators.',
      },
    };

    // 4. Save Report Record in Database
    const reportTitle = `Investigation Report: ${caseDetails.caseNumber} - ${caseDetails.title}`;
    const dbReport = await prisma.report.create({
      data: {
        caseId,
        title: reportTitle,
        type: 'CASE_INVESTIGATION',
        generatedById: userId,
        content: reportContent as any,
        format: format.toUpperCase(),
        filePath: `/reports/${caseId}_${Date.now()}.${format.toLowerCase()}`,
      },
      include: {
        case: { select: { caseNumber: true, title: true } },
        generatedBy: { select: { name: true, email: true } },
      },
    });

    // 5. Create Audit Log
    await createAuditLog({
      userId,
      action: 'REPORT_GENERATED',
      resourceType: 'REPORT',
      resourceId: dbReport.id,
      metadata: { caseId, format, reportTitle },
    });

    return {
      id: dbReport.id,
      caseId: dbReport.caseId,
      title: dbReport.title,
      type: dbReport.type,
      format: dbReport.format,
      generatedBy: dbReport.generatedBy,
      createdAt: dbReport.createdAt.toISOString(),
      content: reportContent,
    };
  }

  /**
   * List reports with RBAC case-authorization scoping.
   */
  static async listReports(
    opts: ReportFilterOpts,
    userId: string,
    userRole: string
  ): Promise<{ reports: any[]; total: number }> {
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
    if (opts.caseId) {
      where.caseId = opts.caseId;
    } else if (allowedCaseIds !== null) {
      where.caseId = { in: allowedCaseIds };
    }

    const limit = opts.limit && opts.limit > 0 ? Math.min(Number(opts.limit), 100) : 50;
    const offset = opts.offset && opts.offset >= 0 ? Number(opts.offset) : 0;

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          case: { select: { id: true, caseNumber: true, title: true } },
          generatedBy: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.report.count({ where }),
    ]);

    const formatted = reports.map((r) => ({
      id: r.id,
      caseId: r.caseId,
      caseNumber: r.case.caseNumber,
      caseTitle: r.case.title,
      title: r.title,
      type: r.type,
      format: r.format,
      generatedById: r.generatedById,
      generatedBy: r.generatedBy,
      createdAt: r.createdAt.toISOString(),
    }));

    return { reports: formatted, total };
  }

  /**
   * Fetch single report with RBAC verification & audit logging.
   */
  static async getReport(reportId: string, userId: string, userRole: string): Promise<any> {
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        case: { select: { id: true, caseNumber: true, title: true } },
        generatedBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!report) {
      throw new Error('NOT_FOUND');
    }

    if (userRole !== UserRole.ADMIN) {
      const assignment = await prisma.caseAssignment.findUnique({
        where: { caseId_userId: { caseId: report.caseId, userId } },
      });
      if (!assignment) {
        throw new Error('FORBIDDEN');
      }
    }

    await createAuditLog({
      userId,
      action: 'REPORT_ACCESSED',
      resourceType: 'REPORT',
      resourceId: reportId,
      metadata: { caseId: report.caseId },
    });

    return {
      id: report.id,
      caseId: report.caseId,
      caseNumber: report.case.caseNumber,
      caseTitle: report.case.title,
      title: report.title,
      type: report.type,
      format: report.format,
      generatedBy: report.generatedBy,
      createdAt: report.createdAt.toISOString(),
      content: report.content,
    };
  }

  /**
   * Download report payload with authentication & authorization verification.
   */
  static async downloadReport(reportId: string, userId: string, userRole: string): Promise<any> {
    const reportData = await this.getReport(reportId, userId, userRole);

    await createAuditLog({
      userId,
      action: 'REPORT_DOWNLOADED',
      resourceType: 'REPORT',
      resourceId: reportId,
      metadata: { caseId: reportData.caseId, format: reportData.format },
    });

    return {
      id: reportData.id,
      fileName: `${reportData.caseNumber}_Investigation_Report.${reportData.format.toLowerCase()}`,
      format: reportData.format,
      mimeType: reportData.format === 'JSON' ? 'application/json' : 'text/plain',
      data: reportData.content,
    };
  }
}
