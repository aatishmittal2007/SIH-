import { UserRole, EntityType, ExtractionMethod, MatchType, MatchStatus, CaseStatus, CasePriority, SourceType, SourceReliability, EvidenceType, ProcessingStatus } from '@prisma/client';
import { prisma } from '../db/prisma';
import { AppError } from '../utils/errors';
import { createAuditLog } from '../utils/audit';
import { CaseService } from '../modules/cases/case.service';

export interface UserContext {
  userId: string;
  role: UserRole;
  ipAddress?: string;
}

export class ProvenanceService {
  /**
   * Get complete provenance for a specific Entity:
   * Source -> Evidence -> Chunk -> EntityMention -> Entity -> Case + Entity Resolution History
   */
  static async getEntityProvenance(entityId: string, userContext: UserContext) {
    const entity = await prisma.entity.findUnique({
      where: { id: entityId },
      include: {
        mentions: {
          include: {
            evidence: {
              include: {
                source: true,
                case: {
                  select: { id: true, caseNumber: true, title: true, status: true, priority: true },
                },
              },
            },
            chunk: true,
            case: {
              select: { id: true, caseNumber: true, title: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        caseEntities: {
          include: {
            case: {
              select: { id: true, caseNumber: true, title: true, status: true, priority: true },
            },
          },
        },
        sourceMatches: {
          include: {
            targetEntity: {
              select: { id: true, displayName: true, canonicalValue: true, type: true },
            },
            reviewedBy: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        targetMatches: {
          include: {
            sourceEntity: {
              select: { id: true, displayName: true, canonicalValue: true, type: true },
            },
            reviewedBy: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        contradictionClaims: {
          include: {
            contradiction: {
              include: {
                case: { select: { id: true, caseNumber: true, title: true } },
              },
            },
            evidence: {
              select: { id: true, title: true, fileName: true },
            },
          },
        },
        eventLocations: {
          include: {
            case: { select: { id: true, caseNumber: true, title: true } },
            source: true,
          },
        },
      },
    });

    if (!entity) {
      throw AppError.notFound(`Entity with ID '${entityId}' not found`);
    }

    // Determine all case IDs linked to this entity
    const caseIdsSet = new Set<string>();
    entity.mentions.forEach((m: any) => caseIdsSet.add(m.caseId));
    entity.caseEntities.forEach((ce: any) => caseIdsSet.add(ce.caseId));

    const associatedCaseIds = Array.from(caseIdsSet);

    // Authorization check: User must have access to at least one associated case (if any exist)
    if (userContext.role !== UserRole.ADMIN && associatedCaseIds.length > 0) {
      let hasAccessToAnyCase = false;
      for (const cId of associatedCaseIds) {
        try {
          await CaseService.checkCaseAccess(cId, userContext.userId, userContext.role);
          hasAccessToAnyCase = true;
          break;
        } catch {
          // Continue checking next case
        }
      }

      if (!hasAccessToAnyCase) {
        throw AppError.forbidden('Access denied: You do not have permission to view provenance for cases containing this entity');
      }
    }

    // Filter mentions & cases if user is restricted (non-Admin gets only cases they have access to)
    const accessibleCaseIds = new Set<string>();
    if (userContext.role === UserRole.ADMIN) {
      associatedCaseIds.forEach((id) => accessibleCaseIds.add(id));
    } else {
      for (const cId of associatedCaseIds) {
        try {
          await CaseService.checkCaseAccess(cId, userContext.userId, userContext.role);
          accessibleCaseIds.add(cId);
        } catch {
          // Restricted
        }
      }
    }

    const filteredMentions = entity.mentions.filter((m: any) => accessibleCaseIds.has(m.caseId));
    const filteredCaseEntities = entity.caseEntities.filter((ce: any) => accessibleCaseIds.has(ce.caseId));

    // Audit log access
    await createAuditLog({
      userId: userContext.userId,
      action: 'PROVENANCE_ACCESSED',
      resourceType: 'Entity',
      resourceId: entityId,
      metadata: { associatedCaseCount: associatedCaseIds.length, mentionsCount: filteredMentions.length },
      ipAddress: userContext.ipAddress,
    });

    // Format Lineage Chain
    const lineage = filteredMentions.map((mention: any) => ({
      mentionId: mention.id,
      originalText: mention.originalText,
      context: mention.context,
      extractionMethod: mention.extractionMethod,
      extractionConfidence: mention.extractionConfidence,
      startOffset: mention.startOffset,
      endOffset: mention.endOffset,
      createdAt: mention.createdAt,
      chunk: mention.chunk
        ? {
            id: mention.chunk.id,
            chunkIndex: mention.chunk.chunkIndex,
            pageNumber: mention.chunk.pageNumber,
            startOffset: mention.chunk.startOffset,
            endOffset: mention.chunk.endOffset,
          }
        : null,
      evidence: {
        id: mention.evidence.id,
        title: mention.evidence.title,
        type: mention.evidence.type,
        fileName: mention.evidence.fileName,
        hash: mention.evidence.hash,
        processingStatus: mention.evidence.processingStatus,
      },
      source: mention.evidence.source
        ? {
            id: mention.evidence.source.id,
            name: mention.evidence.source.name,
            type: mention.evidence.source.type,
            reliability: mention.evidence.source.reliability,
          }
        : null,
      case: {
        id: mention.evidence.case.id,
        caseNumber: mention.evidence.case.caseNumber,
        title: mention.evidence.case.title,
        status: mention.evidence.case.status,
      },
    }));

    // Format Resolution History (source & target matches)
    const resolutionHistory = [
      ...entity.sourceMatches.map((match: any) => ({
        matchId: match.id,
        direction: 'OUTGOING' as const,
        peerEntity: match.targetEntity,
        matchType: match.matchType,
        similarityScore: match.similarityScore,
        status: match.status,
        reason: match.reason,
        reviewComment: match.reviewComment,
        metadata: match.metadata,
        reviewedBy: match.reviewedBy,
        reviewedAt: match.reviewedAt,
        createdAt: match.createdAt,
      })),
      ...entity.targetMatches.map((match: any) => ({
        matchId: match.id,
        direction: 'INCOMING' as const,
        peerEntity: match.sourceEntity,
        matchType: match.matchType,
        similarityScore: match.similarityScore,
        status: match.status,
        reason: match.reason,
        reviewComment: match.reviewComment,
        metadata: match.metadata,
        reviewedBy: match.reviewedBy,
        reviewedAt: match.reviewedAt,
        createdAt: match.createdAt,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      entity: {
        id: entity.id,
        type: entity.type,
        canonicalValue: entity.canonicalValue,
        displayName: entity.displayName,
        normalizedValue: entity.normalizedValue,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      },
      lineage,
      cases: filteredCaseEntities.map((ce: any) => ({
        caseId: ce.case.id,
        caseNumber: ce.case.caseNumber,
        title: ce.case.title,
        status: ce.case.status,
        priority: ce.case.priority,
        role: ce.role,
        confidence: ce.confidence,
        firstSeenAt: ce.firstSeenAt,
        lastSeenAt: ce.lastSeenAt,
      })),
      resolutionHistory,
      relationships: {
        events: entity.eventLocations.map((ev: any) => ({
          id: ev.id,
          type: ev.type,
          description: ev.description,
          timestamp: ev.timestamp,
          case: ev.case,
          source: ev.source ? { id: ev.source.id, name: ev.source.name } : null,
        })),
        contradictionClaims: entity.contradictionClaims.map((claim: any) => ({
          id: claim.id,
          claimText: claim.claimText,
          value: claim.value,
          timestamp: claim.timestamp,
          case: claim.contradiction.case,
          evidence: claim.evidence,
        })),
      },
    };
  }

  /**
   * Get complete provenance for specific Evidence:
   * Source -> Evidence -> Document & Chunks -> Extracted Entity Mentions -> Canonical Entities -> Case
   */
  static async getEvidenceProvenance(evidenceId: string, userContext: UserContext) {
    const evidence = await prisma.evidence.findUnique({
      where: { id: evidenceId },
      include: {
        source: true,
        case: {
          select: { id: true, caseNumber: true, title: true, status: true, priority: true },
        },
        document: {
          include: {
            chunks: {
              orderBy: { chunkIndex: 'asc' },
            },
          },
        },
        entityMentions: {
          include: {
            entity: true,
            chunk: true,
          },
          orderBy: { startOffset: 'asc' },
        },
      },
    });

    if (!evidence) {
      throw AppError.notFound(`Evidence with ID '${evidenceId}' not found`);
    }

    // Check case access permission
    await CaseService.checkCaseAccess(evidence.caseId, userContext.userId, userContext.role);

    // Audit log
    await createAuditLog({
      userId: userContext.userId,
      action: 'PROVENANCE_ACCESSED',
      resourceType: 'Evidence',
      resourceId: evidenceId,
      metadata: { caseId: evidence.caseId, mentionsCount: evidence.entityMentions.length },
      ipAddress: userContext.ipAddress,
    });

    // Group mentions by canonical Entity
    const entityMap = new Map<string, { entity: any; mentions: any[] }>();

    for (const mention of evidence.entityMentions) {
      if (!entityMap.has(mention.entityId)) {
        entityMap.set(mention.entityId, {
          entity: {
            id: mention.entity.id,
            type: mention.entity.type,
            canonicalValue: mention.entity.canonicalValue,
            displayName: mention.entity.displayName,
            normalizedValue: mention.entity.normalizedValue,
          },
          mentions: [],
        });
      }

      entityMap.get(mention.entityId)!.mentions.push({
        mentionId: mention.id,
        originalText: mention.originalText,
        context: mention.context,
        extractionMethod: mention.extractionMethod,
        extractionConfidence: mention.extractionConfidence,
        startOffset: mention.startOffset,
        endOffset: mention.endOffset,
        createdAt: mention.createdAt,
        chunk: mention.chunk
          ? {
              id: mention.chunk.id,
              chunkIndex: mention.chunk.chunkIndex,
              pageNumber: mention.chunk.pageNumber,
            }
          : null,
      });
    }

    return {
      evidence: {
        id: evidence.id,
        caseId: evidence.caseId,
        title: evidence.title,
        type: evidence.type,
        description: evidence.description,
        fileName: evidence.fileName,
        storagePath: evidence.storagePath,
        mimeType: evidence.mimeType,
        hash: evidence.hash,
        processingStatus: evidence.processingStatus,
        textExtractionStatus: evidence.textExtractionStatus,
        nlpStatus: evidence.nlpStatus,
        processingError: evidence.processingError,
        collectedAt: evidence.collectedAt,
        createdAt: evidence.createdAt,
        updatedAt: evidence.updatedAt,
      },
      source: evidence.source
        ? {
            id: evidence.source.id,
            name: evidence.source.name,
            type: evidence.source.type,
            reliability: evidence.source.reliability,
            description: evidence.source.description,
          }
        : null,
      case: evidence.case,
      document: evidence.document
        ? {
            id: evidence.document.id,
            pageCount: evidence.document.pageCount,
            characterCount: evidence.document.characterCount,
            wordCount: evidence.document.wordCount,
            language: evidence.document.language,
            extractionMethod: evidence.document.extractionMethod,
            extractionVersion: evidence.document.extractionVersion,
            totalChunks: evidence.document.chunks.length,
            chunksSummary: evidence.document.chunks.map((c: any) => ({
              id: c.id,
              chunkIndex: c.chunkIndex,
              pageNumber: c.pageNumber,
              startOffset: c.startOffset,
              endOffset: c.endOffset,
              characterCount: c.text.length,
            })),
          }
        : null,
      extractedEntities: Array.from(entityMap.values()),
      totalMentionsCount: evidence.entityMentions.length,
    };
  }

  /**
   * Get complete provenance overview for an entire Case:
   * Sources -> Evidence List -> Entity Roster -> Entity Resolution Matches -> Audit Trail Summary
   */
  static async getCaseProvenance(caseId: string, userContext: UserContext) {
    // Check case access permission
    await CaseService.checkCaseAccess(caseId, userContext.userId, userContext.role);

    const caseItem = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        evidence: {
          include: {
            source: true,
            _count: {
              select: { entityMentions: true, chunks: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        caseEntities: {
          include: {
            entity: {
              include: {
                _count: {
                  select: { mentions: { where: { caseId } } },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        events: {
          include: {
            source: true,
            locationEntity: true,
          },
          orderBy: { timestamp: 'desc' },
        },
        contradictions: {
          include: {
            claims: true,
          },
        },
      },
    });

    if (!caseItem) {
      throw AppError.notFound(`Case with ID '${caseId}' not found`);
    }

    // Collect all entity IDs in this case
    const entityIds = caseItem.caseEntities.map((ce: any) => ce.entityId);

    // Fetch entity matches involving entities in this case
    const entityMatches = await prisma.entityMatch.findMany({
      where: {
        OR: [
          { sourceEntityId: { in: entityIds } },
          { targetEntityId: { in: entityIds } },
        ],
      },
      include: {
        sourceEntity: { select: { id: true, displayName: true, type: true } },
        targetEntity: { select: { id: true, displayName: true, type: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Unique sources involved in this case
    const sourceMap = new Map<string, any>();
    caseItem.evidence.forEach((ev: any) => {
      if (ev.source && !sourceMap.has(ev.source.id)) {
        sourceMap.set(ev.source.id, {
          id: ev.source.id,
          name: ev.source.name,
          type: ev.source.type,
          reliability: ev.source.reliability,
          description: ev.source.description,
        });
      }
    });

    // Audit log
    await createAuditLog({
      userId: userContext.userId,
      action: 'PROVENANCE_ACCESSED',
      resourceType: 'Case',
      resourceId: caseId,
      metadata: {
        evidenceCount: caseItem.evidence.length,
        entityCount: caseItem.caseEntities.length,
        matchesCount: entityMatches.length,
      },
      ipAddress: userContext.ipAddress,
    });

    return {
      case: {
        id: caseItem.id,
        caseNumber: caseItem.caseNumber,
        title: caseItem.title,
        description: caseItem.description,
        status: caseItem.status,
        priority: caseItem.priority,
        createdAt: caseItem.createdAt,
        createdBy: caseItem.createdBy,
      },
      sources: Array.from(sourceMap.values()),
      evidence: caseItem.evidence.map((ev: any) => ({
        id: ev.id,
        title: ev.title,
        type: ev.type,
        fileName: ev.fileName,
        hash: ev.hash,
        processingStatus: ev.processingStatus,
        source: ev.source ? { id: ev.source.id, name: ev.source.name, type: ev.source.type } : null,
        mentionsCount: ev._count.entityMentions,
        chunksCount: ev._count.chunks,
        createdAt: ev.createdAt,
      })),
      entities: caseItem.caseEntities.map((ce: any) => ({
        entityId: ce.entity.id,
        displayName: ce.entity.displayName,
        canonicalValue: ce.entity.canonicalValue,
        type: ce.entity.type,
        role: ce.role,
        confidence: ce.confidence,
        firstSeenAt: ce.firstSeenAt,
        lastSeenAt: ce.lastSeenAt,
        mentionsCountInCase: ce.entity._count.mentions,
      })),
      resolutionDecisions: entityMatches.map((m: any) => ({
        matchId: m.id,
        sourceEntity: m.sourceEntity,
        targetEntity: m.targetEntity,
        matchType: m.matchType,
        similarityScore: m.similarityScore,
        status: m.status,
        reason: m.reason,
        reviewComment: m.reviewComment,
        reviewedBy: m.reviewedBy,
        createdAt: m.createdAt,
      })),
      eventsCount: caseItem.events.length,
      contradictionsCount: caseItem.contradictions.length,
    };
  }
}
