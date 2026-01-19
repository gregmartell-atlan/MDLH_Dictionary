/**
 * Signal Composer
 *
 * Composes signals from field evaluation results using the signal definitions.
 * Handles aggregation methods: any, all, weighted_threshold.
 */

import type {
  SignalType,
  TriState,
  SignalDefinition,
  SignalContribution,
  UseCaseProfile,
} from './types';
import type { FieldEvaluationResult, AssetEvaluationResult } from './field-evaluator';
import { UNIFIED_FIELD_CATALOG, getFieldsForSignal } from './unified-fields';
import { SIGNAL_DEFINITIONS, getSignalById } from './signal-definitions';
import { getUseCaseById } from './use-case-profiles';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Result of composing a signal from fields
 */
export interface SignalCompositionResult {
  signal: SignalType;
  present: TriState;
  score: number;                        // 0-1 score based on contributing fields
  contributingFields: Array<{
    fieldId: string;
    present: TriState;
    weight: number;
    contribution: number;               // Weighted contribution to signal
  }>;
}

/**
 * Complete signal profile for an asset
 */
export interface AssetSignalProfile {
  assetId: string;
  signals: SignalCompositionResult[];
  overallScore: number;                 // Average of all signal scores
}

/**
 * Use case assessment result
 */
export interface UseCaseAssessmentResult {
  useCaseId: string;
  readiness: TriState;
  score: number;
  readinessLevel: 'ready' | 'partial' | 'not_ready';
  signals: Array<{
    signal: SignalType;
    weight: number;
    required: boolean;
    present: TriState;
    score: number;
    contribution: number;
  }>;
  blockers: SignalType[];               // Required signals that are not present
}

// =============================================================================
// SIGNAL COMPOSITION
// =============================================================================

/**
 * Get field contributions for a signal
 */
export function getFieldContributionsForSignal(signalId: SignalType): Array<{
  fieldId: string;
  weight: number;
  required: boolean;
  negative: boolean;
}> {
  const contributions: Array<{
    fieldId: string;
    weight: number;
    required: boolean;
    negative: boolean;
  }> = [];

  for (const field of UNIFIED_FIELD_CATALOG) {
    for (const contribution of field.contributesToSignals) {
      if (contribution.signal === signalId) {
        contributions.push({
          fieldId: field.id,
          weight: contribution.weight,
          required: contribution.required ?? false,
          negative: contribution.negative ?? false,
        });
      }
    }
  }

  return contributions;
}

/**
 * Compose a signal from field evaluation results
 */
export function composeSignal(
  signalId: SignalType,
  fieldResults: FieldEvaluationResult[]
): SignalCompositionResult {
  const signalDef = getSignalById(signalId);
  const fieldContributions = getFieldContributionsForSignal(signalId);

  if (!signalDef || fieldContributions.length === 0) {
    return {
      signal: signalId,
      present: 'UNKNOWN',
      score: 0,
      contributingFields: [],
    };
  }

  // Create a map of field results for quick lookup
  const fieldResultMap = new Map(fieldResults.map(r => [r.fieldId, r]));

  // Calculate contributions
  const contributions: SignalCompositionResult['contributingFields'] = [];
  let totalWeight = 0;
  let weightedSum = 0;
  let hasAnyPresent = false;
  let hasAnyAbsent = false;
  let allUnknown = true;

  for (const fc of fieldContributions) {
    const fieldResult = fieldResultMap.get(fc.fieldId);
    const present = fieldResult?.present ?? 'UNKNOWN';

    if (present !== 'UNKNOWN') {
      allUnknown = false;
    }

    // Calculate contribution
    let contribution = 0;
    if (present === true) {
      hasAnyPresent = true;
      contribution = fc.negative ? -fc.weight : fc.weight;
    } else if (present === false) {
      hasAnyAbsent = true;
      contribution = fc.negative ? fc.weight : 0;  // Negative field absent is good
    }

    totalWeight += Math.abs(fc.weight);
    weightedSum += contribution;

    contributions.push({
      fieldId: fc.fieldId,
      present,
      weight: fc.weight,
      contribution,
    });
  }

  // Calculate score (normalized to 0-1)
  const score = totalWeight > 0 ? Math.max(0, Math.min(1, weightedSum / totalWeight)) : 0;

  // Determine presence based on aggregation method
  let present: TriState;

  if (allUnknown) {
    present = 'UNKNOWN';
  } else {
    switch (signalDef.aggregation.method) {
      case 'any':
        present = hasAnyPresent;
        break;
      case 'all':
        present = !hasAnyAbsent && hasAnyPresent;
        break;
      case 'weighted_threshold':
        present = score >= signalDef.aggregation.threshold;
        break;
      default:
        present = hasAnyPresent;
    }
  }

  return {
    signal: signalId,
    present,
    score,
    contributingFields: contributions,
  };
}

/**
 * Compose all signals from field evaluation results
 */
export function composeAllSignals(
  fieldResults: FieldEvaluationResult[]
): SignalCompositionResult[] {
  return SIGNAL_DEFINITIONS.map(signalDef =>
    composeSignal(signalDef.id, fieldResults)
  );
}

/**
 * Create a complete signal profile for an asset
 */
export function createSignalProfile(
  assetId: string,
  fieldResults: FieldEvaluationResult[]
): AssetSignalProfile {
  const signals = composeAllSignals(fieldResults);

  // Calculate overall score
  const validScores = signals.filter(s => s.present !== 'UNKNOWN').map(s => s.score);
  const overallScore = validScores.length > 0
    ? validScores.reduce((a, b) => a + b, 0) / validScores.length
    : 0;

  return {
    assetId,
    signals,
    overallScore,
  };
}

// =============================================================================
// USE CASE ASSESSMENT
// =============================================================================

/**
 * Assess an asset against a use case profile
 */
export function assessUseCase(
  useCaseId: string,
  signalResults: SignalCompositionResult[]
): UseCaseAssessmentResult {
  const useCase = getUseCaseById(useCaseId);

  if (!useCase) {
    return {
      useCaseId,
      readiness: 'UNKNOWN',
      score: 0,
      readinessLevel: 'not_ready',
      signals: [],
      blockers: [],
    };
  }

  // Create signal result map
  const signalResultMap = new Map(signalResults.map(r => [r.signal, r]));

  // Calculate use case score
  const signalAssessments: UseCaseAssessmentResult['signals'] = [];
  const blockers: SignalType[] = [];
  let totalWeight = 0;
  let weightedSum = 0;

  for (const signalWeight of useCase.signals) {
    const signalResult = signalResultMap.get(signalWeight.signal);
    const present = signalResult?.present ?? 'UNKNOWN';
    const score = signalResult?.score ?? 0;

    // Calculate contribution
    const contribution = present === true || present === 'UNKNOWN'
      ? score * signalWeight.weight
      : 0;

    totalWeight += signalWeight.weight;
    weightedSum += contribution;

    signalAssessments.push({
      signal: signalWeight.signal,
      weight: signalWeight.weight,
      required: signalWeight.required ?? false,
      present,
      score,
      contribution,
    });

    // Check for blockers (required signals that aren't present)
    if (signalWeight.required && present === false) {
      blockers.push(signalWeight.signal);
    }
  }

  // Calculate final score
  const score = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // Determine readiness level
  let readinessLevel: 'ready' | 'partial' | 'not_ready';
  let readiness: TriState;

  if (blockers.length > 0) {
    readinessLevel = 'not_ready';
    readiness = false;
  } else if (score >= useCase.thresholds.ready) {
    readinessLevel = 'ready';
    readiness = true;
  } else if (score >= useCase.thresholds.partial) {
    readinessLevel = 'partial';
    readiness = false;
  } else {
    readinessLevel = 'not_ready';
    readiness = false;
  }

  return {
    useCaseId,
    readiness,
    score,
    readinessLevel,
    signals: signalAssessments,
    blockers,
  };
}

/**
 * Assess an asset against all use cases
 */
export function assessAllUseCases(
  signalResults: SignalCompositionResult[]
): UseCaseAssessmentResult[] {
  const useCaseIds = ['rag', 'ai_agents', 'text_to_sql', 'dsar_retention', 'data_governance', 'self_service_discovery'];
  return useCaseIds.map(id => assessUseCase(id, signalResults));
}

// =============================================================================
// BATCH SIGNAL COMPOSITION
// =============================================================================

/**
 * Create signal profiles for multiple assets
 */
export function createSignalProfiles(
  assetResults: AssetEvaluationResult[]
): AssetSignalProfile[] {
  return assetResults.map(result =>
    createSignalProfile(result.assetId, result.fields)
  );
}

/**
 * Aggregate signal presence across multiple assets
 */
export function aggregateSignalPresence(
  profiles: AssetSignalProfile[]
): Record<SignalType, { present: number; absent: number; unknown: number; avgScore: number }> {
  const aggregation: Record<string, { present: number; absent: number; unknown: number; totalScore: number; count: number }> = {};

  // Initialize all signals
  for (const signalDef of SIGNAL_DEFINITIONS) {
    aggregation[signalDef.id] = { present: 0, absent: 0, unknown: 0, totalScore: 0, count: 0 };
  }

  // Aggregate
  for (const profile of profiles) {
    for (const signal of profile.signals) {
      const agg = aggregation[signal.signal];
      if (!agg) continue;

      if (signal.present === true) {
        agg.present++;
      } else if (signal.present === false) {
        agg.absent++;
      } else {
        agg.unknown++;
      }
      agg.totalScore += signal.score;
      agg.count++;
    }
  }

  // Calculate averages
  const result: Record<SignalType, { present: number; absent: number; unknown: number; avgScore: number }> = {} as any;
  for (const [signalId, agg] of Object.entries(aggregation)) {
    result[signalId as SignalType] = {
      present: agg.present,
      absent: agg.absent,
      unknown: agg.unknown,
      avgScore: agg.count > 0 ? agg.totalScore / agg.count : 0,
    };
  }

  return result;
}

/**
 * Calculate signal coverage rates across assets
 */
export function calculateSignalCoverage(
  profiles: AssetSignalProfile[]
): Record<SignalType, number> {
  const aggregation = aggregateSignalPresence(profiles);
  const coverage: Record<string, number> = {};

  for (const [signalId, agg] of Object.entries(aggregation)) {
    const total = agg.present + agg.absent;
    coverage[signalId] = total > 0 ? agg.present / total : 0;
  }

  return coverage as Record<SignalType, number>;
}

// =============================================================================
// COMPLETENESS SCORING
// =============================================================================

/**
 * Calculate completeness score using the unified field weights
 */
export function calculateCompletenessScore(
  fieldResults: FieldEvaluationResult[]
): { score: number; maxScore: number; breakdown: Record<string, number> } {
  const fieldResultMap = new Map(fieldResults.map(r => [r.fieldId, r]));
  const breakdown: Record<string, number> = {};
  let score = 0;
  let maxScore = 0;

  // Find fields with completeness weights
  for (const field of UNIFIED_FIELD_CATALOG) {
    if (field.completenessWeight && field.completenessWeight > 0) {
      maxScore += field.completenessWeight;

      const result = fieldResultMap.get(field.id);
      if (result?.present === true) {
        score += field.completenessWeight;
        breakdown[field.id] = field.completenessWeight;
      } else {
        breakdown[field.id] = 0;
      }
    }
  }

  return { score, maxScore, breakdown };
}

/**
 * Get completeness adoption phase
 */
export function getAdoptionPhase(score: number): {
  phase: 'Seeding' | 'Gamification' | 'Operationalization';
  recommendation: string;
} {
  if (score < 20) {
    return {
      phase: 'Seeding',
      recommendation: 'Focus on automated enrichment - crawlers, AI descriptions, bulk imports',
    };
  }
  if (score < 50) {
    return {
      phase: 'Gamification',
      recommendation: 'Engage stewards with gamification and working sessions',
    };
  }
  return {
    phase: 'Operationalization',
    recommendation: 'Lock in gains with process changes and automation',
  };
}
