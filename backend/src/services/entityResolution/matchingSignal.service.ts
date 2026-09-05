import { Entity, EntityType, MatchType } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { SimilarityService } from './similarity.service';

export interface SignalResult {
  code: string;
  name: string;
  score: number;
  weight: number;
  description: string;
  isConflict?: boolean;
}

export interface MatchingEvaluation {
  similarityScore: number;
  matchType: MatchType;
  supportingSignals: SignalResult[];
  conflictingSignals: SignalResult[];
  reason: string;
}

export class MatchingSignalService {
  /**
   * Weights for signals per entity type
   */
  private static WEIGHTS: Record<string, { exact: number; stringFuzzy: number; token: number; context: number; coOccurrence: number }> = {
    PERSON: { exact: 0.90, stringFuzzy: 0.70, token: 0.65, context: 0.40, coOccurrence: 0.30 },
    ORGANIZATION: { exact: 0.95, stringFuzzy: 0.80, token: 0.85, context: 0.35, coOccurrence: 0.25 },
    EMAIL: { exact: 1.00, stringFuzzy: 0.00, token: 0.00, context: 0.30, coOccurrence: 0.20 },
    PHONE: { exact: 1.00, stringFuzzy: 0.00, token: 0.00, context: 0.30, coOccurrence: 0.20 },
    USERNAME: { exact: 0.95, stringFuzzy: 0.75, token: 0.50, context: 0.30, coOccurrence: 0.20 },
    IP_ADDRESS: { exact: 1.00, stringFuzzy: 0.00, token: 0.00, context: 0.20, coOccurrence: 0.20 },
    DOMAIN: { exact: 1.00, stringFuzzy: 0.50, token: 0.50, context: 0.30, coOccurrence: 0.20 },
    URL: { exact: 1.00, stringFuzzy: 0.50, token: 0.50, context: 0.30, coOccurrence: 0.20 },
    ACCOUNT: { exact: 1.00, stringFuzzy: 0.00, token: 0.00, context: 0.30, coOccurrence: 0.20 },
    DEVICE: { exact: 1.00, stringFuzzy: 0.00, token: 0.00, context: 0.30, coOccurrence: 0.20 },
    LOCATION: { exact: 0.90, stringFuzzy: 0.70, token: 0.60, context: 0.30, coOccurrence: 0.20 },
    TRANSACTION: { exact: 1.00, stringFuzzy: 0.00, token: 0.00, context: 0.30, coOccurrence: 0.20 },
    OTHER: { exact: 0.90, stringFuzzy: 0.60, token: 0.50, context: 0.30, coOccurrence: 0.20 },
  };

  /**
   * Evaluate matching signals and conflicts between two entities.
   */
  static async evaluatePair(source: Entity, target: Entity): Promise<MatchingEvaluation> {
    if (source.type !== target.type) {
      return {
        similarityScore: 0.0,
        matchType: MatchType.POSSIBLE,
        supportingSignals: [],
        conflictingSignals: [
          {
            code: 'MISMATCHED_TYPE',
            name: 'Entity Type Mismatch',
            score: 0.0,
            weight: 1.0,
            description: `Entity A is ${source.type} while Entity B is ${target.type}`,
            isConflict: true,
          },
        ],
        reason: 'Entities have incompatible types.',
      };
    }

    const supportingSignals: SignalResult[] = [];
    const conflictingSignals: SignalResult[] = [];
    const weights = this.WEIGHTS[source.type] || this.WEIGHTS.OTHER;

    // 1. Exact Normalized Signal
    if (source.normalizedValue.toLowerCase() === target.normalizedValue.toLowerCase()) {
      supportingSignals.push({
        code: 'EXACT_NORMALIZED',
        name: 'Exact Normalized Match',
        score: 1.0,
        weight: weights.exact,
        description: `Exact normalized value match: "${source.normalizedValue}"`,
      });
    }

    // 2. Fuzzy String Signal (Only for text/name entity types!)
    const allowFuzzy = ['PERSON', 'ORGANIZATION', 'LOCATION', 'USERNAME', 'DOMAIN', 'URL', 'OTHER'].includes(source.type);
    if (allowFuzzy && source.normalizedValue.toLowerCase() !== target.normalizedValue.toLowerCase()) {
      const jaroScore = SimilarityService.jaroWinklerSimilarity(source.normalizedValue, target.normalizedValue);
      const levScore = SimilarityService.levenshteinSimilarity(source.normalizedValue, target.normalizedValue);
      const strScore = Math.max(jaroScore, levScore);

      if (strScore >= 0.70) {
        supportingSignals.push({
          code: 'FUZZY_STRING',
          name: 'String Similarity',
          score: Math.round(strScore * 100) / 100,
          weight: weights.stringFuzzy,
          description: `Fuzzy string similarity: ${Math.round(strScore * 100)}% ("${source.displayName}" vs "${target.displayName}")`,
        });
      }
    }

    // 3. Token Set / Abbreviation Signal (For PERSON / ORGANIZATION)
    if (['PERSON', 'ORGANIZATION'].includes(source.type)) {
      const tokenScore = SimilarityService.tokenSetSimilarity(source.displayName, target.displayName);
      if (tokenScore >= 0.75 && tokenScore < 1.0) {
        supportingSignals.push({
          code: 'TOKEN_SIMILARITY',
          name: 'Token Set Overlap',
          score: Math.round(tokenScore * 100) / 100,
          weight: weights.token,
          description: `High token set overlap (${Math.round(tokenScore * 100)}%) with normalized organization/name tokens.`,
        });
      }
    }

    // 4. Co-occurrence in Evidence & Cases
    const [sourceMentions, targetMentions] = await Promise.all([
      prisma.entityMention.findMany({ where: { entityId: source.id }, select: { caseId: true, evidenceId: true, context: true } }),
      prisma.entityMention.findMany({ where: { entityId: target.id }, select: { caseId: true, evidenceId: true, context: true } }),
    ]);

    const sourceCases = new Set(sourceMentions.map((m) => m.caseId));
    const targetCases = new Set(targetMentions.map((m) => m.caseId));
    const sharedCases = Array.from(sourceCases).filter((c) => targetCases.has(c));

    const sourceEv = new Set(sourceMentions.map((m) => m.evidenceId));
    const targetEv = new Set(targetMentions.map((m) => m.evidenceId));
    const sharedEvidence = Array.from(sourceEv).filter((e) => targetEv.has(e));

    if (sharedEvidence.length > 0) {
      supportingSignals.push({
        code: 'SHARED_EVIDENCE',
        name: 'Shared Evidence Co-occurrence',
        score: 0.90,
        weight: weights.coOccurrence,
        description: `Both entities are mentioned in ${sharedEvidence.length} identical evidence document(s).`,
      });
    } else if (sharedCases.length > 0) {
      supportingSignals.push({
        code: 'SHARED_CASE',
        name: 'Shared Case Context',
        score: 0.70,
        weight: weights.coOccurrence,
        description: `Both entities co-occur in ${sharedCases.length} common investigation case(s).`,
      });
    }

    // 5. Contextual Identifiers (Emails, Phones, Organizations mentioned in context)
    const extractEmails = (text: string) => text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    const extractPhones = (text: string) => text.match(/\+?\d[\d\s-]{7,}\d/g) || [];

    const sourceContextText = sourceMentions.map((m) => m.context || '').join(' ');
    const targetContextText = targetMentions.map((m) => m.context || '').join(' ');

    const sourceEmails = new Set(extractEmails(sourceContextText));
    const targetEmails = new Set(extractEmails(targetContextText));
    const sharedEmails = Array.from(sourceEmails).filter((e) => targetEmails.has(e));
    const conflictingEmails = Array.from(sourceEmails).filter((e) => targetEmails.size > 0 && !targetEmails.has(e));

    if (sharedEmails.length > 0) {
      supportingSignals.push({
        code: 'SHARED_EMAIL_CONTEXT',
        name: 'Shared Associated Email',
        score: 0.95,
        weight: weights.context,
        description: `Both entities are contextualized with email: ${sharedEmails.join(', ')}`,
      });
    } else if (sourceEmails.size > 0 && targetEmails.size > 0 && conflictingEmails.length > 0) {
      conflictingSignals.push({
        code: 'CONFLICTING_EMAIL',
        name: 'Conflicting Associated Emails',
        score: 0.80,
        weight: 0.40,
        description: `Entity A has email (${Array.from(sourceEmails).join(', ')}) while Entity B has email (${Array.from(targetEmails).join(', ')})`,
        isConflict: true,
      });
    }

    const sourcePhones = new Set(extractPhones(sourceContextText));
    const targetPhones = new Set(extractPhones(targetContextText));
    const sharedPhones = Array.from(sourcePhones).filter((p) => targetPhones.has(p));
    const conflictingPhones = Array.from(sourcePhones).filter((p) => targetPhones.size > 0 && !targetPhones.has(p));

    if (sharedPhones.length > 0) {
      supportingSignals.push({
        code: 'SHARED_PHONE_CONTEXT',
        name: 'Shared Associated Phone',
        score: 0.95,
        weight: weights.context,
        description: `Both entities are contextualized with phone: ${sharedPhones.join(', ')}`,
      });
    } else if (sourcePhones.size > 0 && targetPhones.size > 0 && conflictingPhones.length > 0) {
      conflictingSignals.push({
        code: 'CONFLICTING_PHONE',
        name: 'Conflicting Associated Phones',
        score: 0.80,
        weight: 0.40,
        description: `Entity A has phone (${Array.from(sourcePhones).join(', ')}) while Entity B has phone (${Array.from(targetPhones).join(', ')})`,
        isConflict: true,
      });
    }

    // 6. Calculate Score & Penalty
    let scoreSum = 0;
    let weightSum = 0;

    for (const sig of supportingSignals) {
      scoreSum += sig.score * sig.weight;
      weightSum += sig.weight;
    }

    let finalScore = weightSum > 0 ? scoreSum / weightSum : 0;

    // Apply conflict penalty
    if (conflictingSignals.length > 0) {
      const penalty = conflictingSignals.reduce((acc, c) => acc + c.score * c.weight, 0) * 0.25;
      finalScore = Math.max(0.10, finalScore - penalty);
    }

    finalScore = Math.round(finalScore * 100) / 100;

    // Determine Match Type
    let matchType: MatchType = MatchType.POSSIBLE;
    if (supportingSignals.some((s) => s.code === 'EXACT_NORMALIZED') && finalScore >= 0.90) {
      matchType = MatchType.EXACT;
    } else if (supportingSignals.some((s) => s.code === 'FUZZY_STRING' || s.code === 'TOKEN_SIMILARITY') && finalScore >= 0.75) {
      matchType = MatchType.FUZZY;
    } else if (supportingSignals.some((s) => s.code === 'SHARED_EVIDENCE' || s.code === 'SHARED_EMAIL_CONTEXT' || s.code === 'SHARED_PHONE_CONTEXT')) {
      matchType = MatchType.CONTEXTUAL;
    }

    // Deterministic summary reason
    const reasonParts: string[] = [];
    if (supportingSignals.length > 0) {
      reasonParts.push(`Supporting: ${supportingSignals.map((s) => s.name).join(', ')}.`);
    }
    if (conflictingSignals.length > 0) {
      reasonParts.push(`Conflicts: ${conflictingSignals.map((c) => c.name).join(', ')}.`);
    }

    return {
      similarityScore: finalScore,
      matchType,
      supportingSignals,
      conflictingSignals,
      reason: reasonParts.join(' ') || 'Candidate evaluated based on string and contextual similarity.',
    };
  }
}
