import { Entity, MatchType } from '@prisma/client';
import { MatchingEvaluation, SignalResult } from './matchingSignal.service';

export interface ResolutionExplanation {
  candidatePair: {
    sourceEntityId: string;
    sourceDisplayName: string;
    targetEntityId: string;
    targetDisplayName: string;
    entityType: string;
  };
  overallConfidenceScore: number;
  confidenceCategory: 'HIGH' | 'MEDIUM' | 'LOW';
  matchType: MatchType;
  primaryReason: string;
  supportingSignals: Array<{
    title: string;
    score: number;
    description: string;
  }>;
  conflictingSignals: Array<{
    title: string;
    score: number;
    description: string;
  }>;
  hasConflicts: boolean;
  recommendedAction: string;
}

export class EntityResolutionExplanationService {
  /**
   * Format structured explanation for entity match candidates
   */
  static generateExplanation(
    source: Entity,
    target: Entity,
    evaluation: MatchingEvaluation
  ): ResolutionExplanation {
    const confidenceCategory =
      evaluation.similarityScore >= 0.85
        ? 'HIGH'
        : evaluation.similarityScore >= 0.65
        ? 'MEDIUM'
        : 'LOW';

    let recommendedAction = 'Investigator Review Recommended.';
    if (evaluation.conflictingSignals.length > 0) {
      recommendedAction = 'CAUTION: Conflicting signals detected. Verify associated email/phone before confirming match.';
    } else if (confidenceCategory === 'HIGH') {
      recommendedAction = 'High confidence candidate match. Confirm to link graph identities.';
    } else if (confidenceCategory === 'LOW') {
      recommendedAction = 'Low confidence candidate. Review context mentions before merging identity.';
    }

    return {
      candidatePair: {
        sourceEntityId: source.id,
        sourceDisplayName: source.displayName,
        targetEntityId: target.id,
        targetDisplayName: target.displayName,
        entityType: source.type,
      },
      overallConfidenceScore: evaluation.similarityScore,
      confidenceCategory,
      matchType: evaluation.matchType,
      primaryReason: evaluation.reason,
      supportingSignals: evaluation.supportingSignals.map((s) => ({
        title: s.name,
        score: s.score,
        description: s.description,
      })),
      conflictingSignals: evaluation.conflictingSignals.map((c) => ({
        title: c.name,
        score: c.score,
        description: c.description,
      })),
      hasConflicts: evaluation.conflictingSignals.length > 0,
      recommendedAction,
    };
  }
}
