import { SeverityLevel, UserRole } from '@prisma/client';
import { prisma } from '../db/prisma';
import { NetworkAnalysisService } from './networkAnalysis.service';
import { TemporalAnalysisService } from './temporalAnalysis.service';

export class IntelligenceEngineService {
  /**
   * Synthesize intelligence findings for a given case across all intelligence engines
   */
  static async generateFindingsForCase(
    caseId: string,
    userRole: string,
    userId: string
  ): Promise<{ generatedCount: number; findings: any[] }> {
    // RBAC check
    if (userRole !== UserRole.ADMIN) {
      const assignment = await prisma.caseAssignment.findUnique({
        where: { caseId_userId: { caseId, userId } },
      });
      if (!assignment) {
        throw new Error('FORBIDDEN');
      }
    }

    let generatedCount = 0;
    const findings: any[] = [];

    const caseObj = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        caseEntities: { include: { entity: true } },
        events: true,
        evidence: true,
      },
    });

    if (!caseObj) {
      throw new Error('NOT_FOUND');
    }

    // 1. Cross-Case Correlation Findings
    const correlations = await prisma.caseCorrelation.findMany({
      where: {
        OR: [{ sourceCaseId: caseId }, { targetCaseId: caseId }],
        score: { gte: 0.5 },
      },
      include: {
        sourceCase: { select: { id: true, caseNumber: true, title: true } },
        targetCase: { select: { id: true, caseNumber: true, title: true } },
      },
    });

    for (const corr of correlations) {
      const otherCase = corr.sourceCaseId === caseId ? corr.targetCase : corr.sourceCase;
      const findingType = 'CROSS_CASE_CORRELATION_FINDING';
      const title = `Analytical Linkage: Case ${caseObj.caseNumber} ↔ Case ${otherCase.caseNumber}`;
      const summary = `Investigation Case ${caseObj.caseNumber} exhibits significant structural and entity overlap (Score: ${(corr.score * 100).toFixed(0)}%) with Case ${otherCase.caseNumber}.`;

      const signals = [
        `Correlation score: ${corr.score}`,
        `Signals identified: ${JSON.stringify(corr.signals)}`,
      ];

      const limitations = [
        'Correlation score is derived from automated match heuristics and shared entity references.',
        'Requires independent investigator validation of physical/digital case materials before taking official investigative action.',
      ];

      const existing = await prisma.intelligenceFinding.findFirst({
        where: { caseId, findingType, title },
      });

      if (!existing) {
        const finding = await prisma.intelligenceFinding.create({
          data: {
            caseId,
            findingType,
            title,
            summary,
            confidence: corr.confidence || 0.85,
            severity: corr.score >= 0.8 ? SeverityLevel.HIGH : SeverityLevel.MEDIUM,
            signals,
            evidenceReferences: { correlationId: corr.id, relatedCaseId: otherCase.id },
            limitations,
            status: 'ACTIVE',
          },
        });
        findings.push(finding);
        generatedCount++;
      }
    }

    // 2. Network Hub Findings
    try {
      const networkResult = await NetworkAnalysisService.getCaseNetwork(caseId, userRole, userId);
      const topHubs = (networkResult.nodes || []).filter((n: any) => n.connectionCount >= 3);

      for (const hub of topHubs) {
        const findingType = 'NETWORK_HUB_FINDING';
        const title = `Key Graph Hub Entity Identified: "${hub.name}" (${hub.type})`;
        const summary = `Entity "${hub.name}" connects to ${hub.connectionCount} distinct graph nodes within the case network. High centrality indicates this entity is a key structural point of contact.`;

        const signals = [
          `Connection count: ${hub.connectionCount}`,
          `Descriptor: ${hub.descriptor}`,
        ];

        const limitations = [
          'High graph centrality indicates frequency of recorded connections, not direct culpability.',
        ];

        const existing = await prisma.intelligenceFinding.findFirst({
          where: { caseId, findingType, title },
        });

        if (!existing) {
          const finding = await prisma.intelligenceFinding.create({
            data: {
              caseId,
              findingType,
              title,
              summary,
              confidence: 0.9,
              severity: SeverityLevel.MEDIUM,
              signals,
              evidenceReferences: { entityId: hub.entityId },
              limitations,
              status: 'ACTIVE',
            },
          });
          findings.push(finding);
          generatedCount++;
        }
      }
    } catch (err) {
      // Skip if graph query fails or no network nodes
    }

    // 3. Temporal Burst Findings
    try {
      const temporalRes = await TemporalAnalysisService.analyzeCaseTemporalPatterns(caseId, userRole, userId);
      if (temporalRes.overlappingEvents && temporalRes.overlappingEvents.length >= 2) {
        const findingType = 'TIMELINE_BURST_FINDING';
        const title = `High-Density Event Timeline Cluster Identified (${temporalRes.overlappingEvents.length} Event Pairs)`;
        const summary = `Timeline reconstruction identified a dense cluster of ${temporalRes.overlappingEvents.length} event pairs occurring within a <= 2 hour window.`;

        const signals = temporalRes.overlappingEvents.map(
          (pair: any) => `Event ${pair.event1Id} & Event ${pair.event2Id} (Delta: ${pair.timeDifferenceHours.toFixed(2)} hrs)`
        );

        const limitations = [
          'Temporal proximity demonstrates synchronized timing, not necessarily joint participation.',
        ];

        const existing = await prisma.intelligenceFinding.findFirst({
          where: { caseId, findingType, title },
        });

        if (!existing) {
          const finding = await prisma.intelligenceFinding.create({
            data: {
              caseId,
              findingType,
              title,
              summary,
              confidence: 0.88,
              severity: SeverityLevel.HIGH,
              signals,
              evidenceReferences: { eventCount: caseObj.events.length },
              limitations,
              status: 'ACTIVE',
            },
          });
          findings.push(finding);
          generatedCount++;
        }
      }
    } catch (err) {
      // Skip temporal failures
    }

    // 4. Unresolved Contradiction Findings
    const activeContradictions = await prisma.contradiction.findMany({
      where: { caseId, status: 'ACTIVE' },
      include: { claims: true },
    });

    if (activeContradictions.length > 0) {
      const findingType = 'CONTRADICTIONS_ALERT_FINDING';
      const title = `Active Information Conflicts Detected (${activeContradictions.length} Active Contradictions)`;
      const summary = `Case ${caseObj.caseNumber} contains ${activeContradictions.length} unresolved evidentiary contradictions requiring investigator review.`;

      const signals = activeContradictions.map((c) => `Contradiction [${c.type}]: ${c.description}`);
      const contradictionsList = activeContradictions.map((c) => ({
        id: c.id,
        type: c.type,
        claimCount: c.claims.length,
      }));

      const limitations = [
        'Conflicting statements represent divergent evidence data sources and require corroborating forensic analysis.',
      ];

      const existing = await prisma.intelligenceFinding.findFirst({
        where: { caseId, findingType, title },
      });

      if (!existing) {
        const finding = await prisma.intelligenceFinding.create({
          data: {
            caseId,
            findingType,
            title,
            summary,
            confidence: 0.95,
            severity: SeverityLevel.HIGH,
            signals,
            evidenceReferences: { contradictionCount: activeContradictions.length },
            contradictions: contradictionsList,
            limitations,
            status: 'ACTIVE',
          },
        });
        findings.push(finding);
        generatedCount++;
      }
    }

    return { generatedCount, findings };
  }

  /**
   * Get intelligence findings for a case with RBAC
   */
  static async getFindingsByCase(
    caseId: string,
    userRole: string,
    userId: string
  ): Promise<any[]> {
    if (userRole !== UserRole.ADMIN) {
      const assignment = await prisma.caseAssignment.findUnique({
        where: { caseId_userId: { caseId, userId } },
      });
      if (!assignment) {
        throw new Error('FORBIDDEN');
      }
    }

    return prisma.intelligenceFinding.findMany({
      where: { caseId },
      include: {
        case: { select: { id: true, caseNumber: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get single finding by ID with RBAC
   */
  static async getFindingById(
    id: string,
    userRole: string,
    userId: string
  ): Promise<any | null> {
    const finding = await prisma.intelligenceFinding.findUnique({
      where: { id },
      include: {
        case: { select: { id: true, caseNumber: true, title: true } },
      },
    });

    if (!finding) return null;

    if (userRole !== UserRole.ADMIN && finding.caseId) {
      const assignment = await prisma.caseAssignment.findUnique({
        where: { caseId_userId: { caseId: finding.caseId, userId } },
      });
      if (!assignment) {
        throw new Error('FORBIDDEN');
      }
    }

    return finding;
  }
}
