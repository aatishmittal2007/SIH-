import { SeverityLevel, ContradictionStatus, UserRole } from '@prisma/client';
import { prisma } from '../db/prisma';

export class ContradictionDetectionService {
  /**
   * Run contradiction detection for a specified case or all assigned cases
   */
  static async detectContradictions(
    caseId: string,
    userRole: string,
    userId: string
  ): Promise<{ detectedCount: number; contradictions: any[] }> {
    // RBAC check
    if (userRole !== UserRole.ADMIN) {
      const assignment = await prisma.caseAssignment.findUnique({
        where: { caseId_userId: { caseId, userId } },
      });
      if (!assignment) {
        throw new Error('FORBIDDEN');
      }
    }

    let detectedCount = 0;
    const contradictions: any[] = [];

    // 1. Detect Event Timestamp Conflicts for the case
    const events = await prisma.event.findMany({
      where: { caseId },
      include: { source: true, locationEntity: true },
      orderBy: { timestamp: 'asc' },
    });

    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const e1 = events[i];
        const e2 = events[j];

        if (
          e1.locationEntityId &&
          e2.locationEntityId &&
          e1.locationEntityId === e2.locationEntityId
        ) {
          const timeDiffMs = Math.abs(e1.timestamp.getTime() - e2.timestamp.getTime());
          const timeDiffHours = timeDiffMs / (1000 * 60 * 60);

          if (timeDiffHours > 24 && e1.sourceId !== e2.sourceId) {
            const contradictionType = 'EVENT_TIMESTAMP_MISMATCH';
            const description = `Conflicting event timestamp statements recorded for location entity "${e1.locationEntity?.displayName || e1.locationEntityId}" between Source "${e1.source?.name || e1.sourceId}" (${e1.timestamp.toISOString()}) and Source "${e2.source?.name || e2.sourceId}" (${e2.timestamp.toISOString()}). Flagged for analytical verification.`;

            const existing = await prisma.contradiction.findFirst({
              where: {
                caseId,
                type: contradictionType,
                description,
              },
            });

            if (!existing) {
              const contradiction = await prisma.contradiction.create({
                data: {
                  caseId,
                  type: contradictionType,
                  description,
                  severity: SeverityLevel.HIGH,
                  status: ContradictionStatus.ACTIVE,
                  claims: {
                    create: [
                      {
                        entityId: e1.locationEntityId,
                        evidenceId: undefined,
                        claimText: `Event reported at ${e1.timestamp.toISOString()} by ${e1.source?.name || 'Source A'}`,
                        value: e1.timestamp.toISOString(),
                        timestamp: e1.timestamp,
                      },
                      {
                        entityId: e2.locationEntityId,
                        evidenceId: undefined,
                        claimText: `Event reported at ${e2.timestamp.toISOString()} by ${e2.source?.name || 'Source B'}`,
                        value: e2.timestamp.toISOString(),
                        timestamp: e2.timestamp,
                      },
                    ],
                  },
                },
                include: { claims: true },
              });
              contradictions.push(contradiction);
              detectedCount++;
            }
          }
        }
      }
    }

    // 2. Detect Location Contradictions
    const entityMentions = await prisma.entityMention.findMany({
      where: { caseId },
      include: { entity: true, evidence: { include: { source: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const mentionsByEntity: Record<string, typeof entityMentions> = {};
    for (const mention of entityMentions) {
      if (!mentionsByEntity[mention.entityId]) {
        mentionsByEntity[mention.entityId] = [];
      }
      mentionsByEntity[mention.entityId].push(mention);
    }

    for (const [entityId, mentions] of Object.entries(mentionsByEntity)) {
      if (mentions.length < 2) continue;

      for (let i = 0; i < mentions.length; i++) {
        for (let j = i + 1; j < mentions.length; j++) {
          const m1 = mentions[i];
          const m2 = mentions[j];

          if (
            m1.context &&
            m2.context &&
            m1.evidenceId !== m2.evidenceId &&
            m1.context.toLowerCase().includes('location') &&
            m2.context.toLowerCase().includes('location') &&
            m1.context !== m2.context
          ) {
            const contradictionType = 'LOCATION_STATEMENT_CONFLICT';
            const description = `Conflicting location descriptions identified for entity "${m1.entity.displayName}" between Evidence "${m1.evidence.title}" and Evidence "${m2.evidence.title}". Flagged for review.`;

            const existing = await prisma.contradiction.findFirst({
              where: { caseId, type: contradictionType, description },
            });

            if (!existing) {
              const contradiction = await prisma.contradiction.create({
                data: {
                  caseId,
                  type: contradictionType,
                  description,
                  severity: SeverityLevel.MEDIUM,
                  status: ContradictionStatus.ACTIVE,
                  claims: {
                    create: [
                      {
                        entityId,
                        evidenceId: m1.evidenceId,
                        claimText: `Context from ${m1.evidence.title}: "${m1.context}"`,
                        value: m1.originalText,
                        timestamp: m1.createdAt,
                      },
                      {
                        entityId,
                        evidenceId: m2.evidenceId,
                        claimText: `Context from ${m2.evidence.title}: "${m2.context}"`,
                        value: m2.originalText,
                        timestamp: m2.createdAt,
                      },
                    ],
                  },
                },
                include: { claims: true },
              });
              contradictions.push(contradiction);
              detectedCount++;
            }
          }
        }
      }
    }

    return { detectedCount, contradictions };
  }

  /**
   * Get contradictions for a case with RBAC
   */
  static async getContradictions(
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

    return prisma.contradiction.findMany({
      where: { caseId },
      include: {
        claims: {
          include: {
            evidence: { select: { id: true, title: true, type: true } },
            entity: { select: { id: true, displayName: true, type: true } },
          },
        },
        case: { select: { id: true, caseNumber: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get all contradictions across accessible cases for RBAC user
   */
  static async getAllContradictions(
    userRole: string,
    userId: string
  ): Promise<any[]> {
    let whereClause: any = {};
    if (userRole !== UserRole.ADMIN) {
      const assignments = await prisma.caseAssignment.findMany({
        where: { userId },
        select: { caseId: true },
      });
      const caseIds = assignments.map((a) => a.caseId);
      whereClause.caseId = { in: caseIds };
    }

    return prisma.contradiction.findMany({
      where: whereClause,
      include: {
        claims: {
          include: {
            evidence: { select: { id: true, title: true, type: true } },
            entity: { select: { id: true, displayName: true, type: true } },
          },
        },
        case: { select: { id: true, caseNumber: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get single contradiction details by ID with RBAC
   */
  static async getContradictionById(
    id: string,
    userRole: string,
    userId: string
  ): Promise<any | null> {
    const contradiction = await prisma.contradiction.findUnique({
      where: { id },
      include: {
        claims: {
          include: {
            evidence: { select: { id: true, title: true, type: true } },
            entity: { select: { id: true, displayName: true, type: true } },
          },
        },
        case: { select: { id: true, caseNumber: true, title: true } },
      },
    });

    if (!contradiction) return null;

    if (userRole !== UserRole.ADMIN) {
      const assignment = await prisma.caseAssignment.findUnique({
        where: { caseId_userId: { caseId: contradiction.caseId, userId } },
      });
      if (!assignment) {
        throw new Error('FORBIDDEN');
      }
    }

    return contradiction;
  }

  /**
   * Resolve a contradiction without erasing provenance
   */
  static async resolveContradiction(
    id: string,
    userRole: string,
    userId: string,
    resolutionNotes?: string
  ): Promise<any> {
    const contradiction = await prisma.contradiction.findUnique({
      where: { id },
    });

    if (!contradiction) {
      throw new Error('NOT_FOUND');
    }

    if (userRole !== UserRole.ADMIN) {
      const assignment = await prisma.caseAssignment.findUnique({
        where: { caseId_userId: { caseId: contradiction.caseId, userId } },
      });
      if (!assignment) {
        throw new Error('FORBIDDEN');
      }
    }

    const updated = await prisma.contradiction.update({
      where: { id },
      data: {
        status: ContradictionStatus.RESOLVED,
        resolvedAt: new Date(),
        description: resolutionNotes
          ? `${contradiction.description} [Resolved Notes: ${resolutionNotes}]`
          : contradiction.description,
      },
      include: { claims: true },
    });

    return updated;
  }
}
