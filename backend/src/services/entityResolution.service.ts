import { MatchStatus, EntityType } from '@prisma/client';
import { prisma } from '../db/prisma';
import { CandidateGenerator } from './entityResolution/candidateGenerator.service';
import { MatchingSignalService } from './entityResolution/matchingSignal.service';
import { EntityResolutionExplanationService } from './entityResolution/explanation.service';
import { Neo4jSyncService } from './neo4jSync.service';
import { createAuditLog } from '../utils/audit';

export interface GetCandidatesOptions {
  status?: MatchStatus;
  caseId?: string;
  entityType?: EntityType;
  page?: number;
  limit?: number;
}

export class EntityResolutionService {
  /**
   * Run candidate generation and signal evaluation pipeline across entities.
   * Stores candidate pairs as PENDING match records.
   */
  static async generateAndSaveCandidates(options?: {
    caseId?: string;
    entityId?: string;
    threshold?: number;
  }) {
    const threshold = options?.threshold ?? 0.60; // minimum score threshold to surface candidate
    const candidatePairs = await CandidateGenerator.generateCandidates({
      caseId: options?.caseId,
      entityId: options?.entityId,
      limit: 200,
    });

    const savedMatches = [];

    for (const pair of candidatePairs) {
      const evaluation = await MatchingSignalService.evaluatePair(pair.sourceEntity, pair.targetEntity);

      if (evaluation.similarityScore >= threshold) {
        const explanation = EntityResolutionExplanationService.generateExplanation(
          pair.sourceEntity,
          pair.targetEntity,
          evaluation
        );

        // Save or update pending candidate in EntityMatch table
        const match = await prisma.entityMatch.upsert({
          where: {
            sourceEntityId_targetEntityId: {
              sourceEntityId: pair.sourceEntity.id,
              targetEntityId: pair.targetEntity.id,
            },
          },
          update: {
            matchType: evaluation.matchType,
            similarityScore: evaluation.similarityScore,
            status: MatchStatus.PENDING,
            reason: evaluation.reason,
            metadata: JSON.parse(JSON.stringify(explanation)),
          },
          create: {
            sourceEntityId: pair.sourceEntity.id,
            targetEntityId: pair.targetEntity.id,
            matchType: evaluation.matchType,
            similarityScore: evaluation.similarityScore,
            status: MatchStatus.PENDING,
            reason: evaluation.reason,
            metadata: JSON.parse(JSON.stringify(explanation)),
          },
          include: {
            sourceEntity: true,
            targetEntity: true,
          },
        });

        savedMatches.push(match);
      }
    }

    return savedMatches;
  }

  /**
   * Retrieve list of candidate matches for investigator review dashboard
   */
  static async getCandidates(options?: GetCandidatesOptions) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (options?.status) {
      where.status = options.status;
    }

    if (options?.entityType) {
      where.OR = [
        { sourceEntity: { type: options.entityType } },
        { targetEntity: { type: options.entityType } },
      ];
    }

    if (options?.caseId) {
      // Filter candidates where source or target entity belongs to the given case
      const caseEntities = await prisma.caseEntity.findMany({
        where: { caseId: options.caseId },
        select: { entityId: true },
      });
      const entityIds = caseEntities.map((ce) => ce.entityId);

      where.AND = [
        {
          OR: [
            { sourceEntityId: { in: entityIds } },
            { targetEntityId: { in: entityIds } },
          ],
        },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.entityMatch.findMany({
        where,
        skip,
        take: limit,
        orderBy: { similarityScore: 'desc' },
        include: {
          sourceEntity: true,
          targetEntity: true,
          reviewedBy: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      }),
      prisma.entityMatch.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Confirm an entity match candidate (Investigator Action)
   */
  static async confirmCandidateMatch(matchId: string, userId: string, comment?: string) {
    const match = await prisma.entityMatch.findUnique({
      where: { id: matchId },
      include: { sourceEntity: true, targetEntity: true },
    });

    if (!match) {
      throw new Error(`Candidate match record with ID ${matchId} not found.`);
    }

    if (match.status !== MatchStatus.PENDING) {
      throw new Error(`Candidate match ${matchId} is already ${match.status}. Only PENDING matches can be confirmed.`);
    }

    const updatedMatch = await prisma.entityMatch.update({
      where: { id: matchId },
      data: {
        status: MatchStatus.CONFIRMED,
        reviewedById: userId,
        reviewedAt: new Date(),
        reviewComment: comment || 'Confirmed by investigator review.',
      },
      include: {
        sourceEntity: true,
        targetEntity: true,
        reviewedBy: { select: { id: true, name: true, email: true } },
      },
    });

    // Synchronize SAME_ENTITY_AS identity edge in Neo4j
    await Neo4jSyncService.syncConfirmedEntityMatch({
      sourceEntityId: match.sourceEntityId,
      targetEntityId: match.targetEntityId,
      matchType: match.matchType,
      similarityScore: match.similarityScore,
      reviewedById: userId,
      reviewedAt: updatedMatch.reviewedAt,
    });

    // Audit Log Entry
    await createAuditLog({
      userId,
      action: 'ENTITY_MATCH_CONFIRMED',
      resourceType: 'EntityMatch',
      resourceId: matchId,
      metadata: {
        sourceEntityId: match.sourceEntityId,
        sourceDisplayName: match.sourceEntity.displayName,
        targetEntityId: match.targetEntityId,
        targetDisplayName: match.targetEntity.displayName,
        similarityScore: match.similarityScore,
        comment,
      },
    });

    return updatedMatch;
  }

  /**
   * Reject an entity match candidate (Investigator Action)
   */
  static async rejectCandidateMatch(matchId: string, userId: string, comment?: string) {
    const match = await prisma.entityMatch.findUnique({
      where: { id: matchId },
      include: { sourceEntity: true, targetEntity: true },
    });

    if (!match) {
      throw new Error(`Candidate match record with ID ${matchId} not found.`);
    }

    if (match.status !== MatchStatus.PENDING) {
      throw new Error(`Candidate match ${matchId} is already ${match.status}. Only PENDING matches can be rejected.`);
    }

    const updatedMatch = await prisma.entityMatch.update({
      where: { id: matchId },
      data: {
        status: MatchStatus.REJECTED,
        reviewedById: userId,
        reviewedAt: new Date(),
        reviewComment: comment || 'Rejected by investigator review.',
      },
      include: {
        sourceEntity: true,
        targetEntity: true,
        reviewedBy: { select: { id: true, name: true, email: true } },
      },
    });

    // Audit Log Entry
    await createAuditLog({
      userId,
      action: 'ENTITY_MATCH_REJECTED',
      resourceType: 'EntityMatch',
      resourceId: matchId,
      metadata: {
        sourceEntityId: match.sourceEntityId,
        sourceDisplayName: match.sourceEntity.displayName,
        targetEntityId: match.targetEntityId,
        targetDisplayName: match.targetEntity.displayName,
        similarityScore: match.similarityScore,
        comment,
      },
    });

    return updatedMatch;
  }

  /**
   * Get single match candidate details with full explanation
   */
  static async getCandidateById(matchId: string) {
    const match = await prisma.entityMatch.findUnique({
      where: { id: matchId },
      include: {
        sourceEntity: true,
        targetEntity: true,
        reviewedBy: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    if (!match) {
      throw new Error(`Candidate match ${matchId} not found.`);
    }

    return match;
  }
}
