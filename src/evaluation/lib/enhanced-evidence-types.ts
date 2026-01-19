/**
 * Enhanced Evidence Types
 *
 * Types for tenant-aware assessment results with full signal context.
 * These types extend the base evidence types to include:
 * - Which Atlan field(s) were checked
 * - Raw values from Atlan
 * - Failure reasons for debugging
 */

import type { SignalType } from './pivot-types';

// =============================================================================
// FAILURE REASONS
// =============================================================================

/**
 * Why a signal check failed
 */
export type FailureReason =
  | 'null'                // Field was null
  | 'undefined'           // Field was undefined
  | 'empty_string'        // Field was empty string
  | 'empty_array'         // Field was empty array
  | 'empty_object'        // Field was empty object
  | 'not_mapped'          // No tenant mapping for this field
  | 'cm_not_found'        // Custom metadata attribute doesn't exist
  | 'classification_none' // No matching classifications
  | 'threshold_not_met'   // Value exists but below threshold
  | 'evaluation_error'    // Error during evaluation
  | 'unknown';            // Could not determine

/**
 * Determine failure reason from a raw value
 */
export function determineFailureReason(value: unknown): FailureReason | undefined {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string' && value.trim() === '') return 'empty_string';
  if (Array.isArray(value) && value.length === 0) return 'empty_array';
  if (typeof value === 'object' && Object.keys(value as object).length === 0) return 'empty_object';
  // Value is present and non-empty
  return undefined;
}

// =============================================================================
// ENHANCED SIGNAL RESULTS
// =============================================================================

/**
 * Enhanced signal result with full context
 */
export interface EnhancedSignalResult {
  /** Tri-state value */
  value: boolean | 'UNKNOWN';

  /** Source that was used (from tenant config or default) */
  sourceUsed: string;  // e.g., "native:ownerUsers" or "cm:DataGovernance.steward"

  /** Human-readable source description */
  sourceLabel?: string;  // e.g., "Owner Users (native)"

  /** Alternative sources that could be used */
  alternativeSources?: string[];

  /** Raw value from Atlan (for debugging/verification) */
  rawValue?: unknown;

  /** Why the check failed (if value is false) */
  failureReason?: FailureReason;

  /** Confidence in the result (0-1) */
  confidence?: number;

  /** Whether this used tenant config mapping vs default */
  usedTenantMapping?: boolean;
}

/**
 * Create an enhanced signal result
 */
export function createEnhancedSignalResult(
  value: boolean | 'UNKNOWN',
  sourceUsed: string,
  rawValue?: unknown,
  options?: {
    sourceLabel?: string;
    alternativeSources?: string[];
    confidence?: number;
    usedTenantMapping?: boolean;
  }
): EnhancedSignalResult {
  const result: EnhancedSignalResult = {
    value,
    sourceUsed,
    rawValue,
    ...options,
  };

  // Auto-determine failure reason if value is false
  if (value === false) {
    result.failureReason = determineFailureReason(rawValue);
  }

  return result;
}

// =============================================================================
// ENHANCED ASSET EVIDENCE
// =============================================================================

/**
 * All signal types with enhanced results
 */
export interface EnhancedSignals {
  ownership: EnhancedSignalResult;
  semantics: EnhancedSignalResult;
  lineage: EnhancedSignalResult;
  sensitivity: EnhancedSignalResult;
  access: EnhancedSignalResult;
  usage: EnhancedSignalResult;
  freshness: EnhancedSignalResult;
}

/**
 * Field examination record for audit/debugging
 */
export interface FieldExamination {
  /** Path to the field (e.g., "attributes.ownerUsers") */
  fieldPath: string;
  /** Raw value found */
  rawValue: unknown;
  /** Whether this value was used in the signal calculation */
  used: boolean;
  /** Source type (native, cm, classification, etc.) */
  sourceType?: string;
}

/**
 * Evaluation metadata for debugging
 */
export interface EvaluationMetadata {
  /** When the evaluation was performed */
  evaluatedAt: string;
  /** Version of tenant config used (for cache invalidation) */
  tenantConfigVersion?: string;
  /** All fields that were examined during evaluation */
  fieldsExamined: FieldExamination[];
}

/**
 * Enhanced asset evidence with full signal context
 */
export interface EnhancedAssetEvidence {
  /** Asset GUID from Atlan */
  assetId: string;
  /** Display name */
  assetName?: string;
  /** Asset type (Table, Column, View, etc.) */
  assetType: string;
  /** Full qualified name */
  qualifiedName: string;

  /** Hierarchy attributes for rollup grouping */
  connectionName?: string;
  connectorName?: string;
  databaseName?: string;
  schemaName?: string;
  domainGUIDs?: string[];
  domainName?: string;

  /** Raw attributes from Atlan (for drill-down inspection) */
  rawAttributes?: Record<string, unknown>;

  /** Enhanced signals with full context */
  signals: EnhancedSignals;

  /** Gap counts for rollup */
  gapCount: number;
  highSeverityGaps: number;

  /** Metadata about the evaluation process */
  evaluationMetadata?: EvaluationMetadata;
}

// =============================================================================
// SIGNAL BREAKDOWN FOR ROLLUPS
// =============================================================================

/**
 * Breakdown of a signal across assets
 */
export interface SignalBreakdown {
  /** Which signal this is for */
  signal: SignalType;

  /** Total assets evaluated */
  total: number;
  /** Assets passing the signal */
  passing: number;
  /** Assets failing the signal */
  failing: number;
  /** Assets with unknown status */
  unknown: number;

  /** Coverage percentage (passing / (total - unknown)) */
  coverage: number;

  /** Source(s) being evaluated */
  sourcesUsed: string[];

  /** Breakdown by failure reason */
  failureBreakdown: Partial<Record<FailureReason, number>>;

  /** Breakdown by asset type */
  byAssetType: Record<string, {
    total: number;
    passing: number;
    failing: number;
    unknown: number;
  }>;

  /** Sample failing assets for inspection */
  sampleFailingAssets?: Array<{
    assetId: string;
    assetName?: string;
    rawValue: unknown;
    failureReason?: FailureReason;
  }>;
}

/**
 * Create an empty signal breakdown
 */
export function createEmptySignalBreakdown(signal: SignalType): SignalBreakdown {
  return {
    signal,
    total: 0,
    passing: 0,
    failing: 0,
    unknown: 0,
    coverage: 0,
    sourcesUsed: [],
    failureBreakdown: {},
    byAssetType: {},
  };
}

/**
 * Aggregate signal breakdowns from enhanced assets
 */
export function aggregateSignalBreakdown(
  signal: SignalType,
  assets: EnhancedAssetEvidence[],
  maxSamples: number = 5
): SignalBreakdown {
  const breakdown = createEmptySignalBreakdown(signal);
  const sourcesSet = new Set<string>();
  const failingSamples: SignalBreakdown['sampleFailingAssets'] = [];

  for (const asset of assets) {
    const signalResult = asset.signals[signal];
    if (!signalResult) continue;

    breakdown.total++;
    sourcesSet.add(signalResult.sourceUsed);

    // Track by value
    if (signalResult.value === true) {
      breakdown.passing++;
    } else if (signalResult.value === false) {
      breakdown.failing++;

      // Track failure reason
      if (signalResult.failureReason) {
        breakdown.failureBreakdown[signalResult.failureReason] =
          (breakdown.failureBreakdown[signalResult.failureReason] || 0) + 1;
      }

      // Collect sample
      if (failingSamples.length < maxSamples) {
        failingSamples.push({
          assetId: asset.assetId,
          assetName: asset.assetName,
          rawValue: signalResult.rawValue,
          failureReason: signalResult.failureReason,
        });
      }
    } else {
      breakdown.unknown++;
    }

    // Track by asset type
    if (!breakdown.byAssetType[asset.assetType]) {
      breakdown.byAssetType[asset.assetType] = {
        total: 0,
        passing: 0,
        failing: 0,
        unknown: 0,
      };
    }
    const typeStats = breakdown.byAssetType[asset.assetType];
    typeStats.total++;
    if (signalResult.value === true) typeStats.passing++;
    else if (signalResult.value === false) typeStats.failing++;
    else typeStats.unknown++;
  }

  breakdown.sourcesUsed = Array.from(sourcesSet);
  breakdown.sampleFailingAssets = failingSamples;

  // Calculate coverage (excluding unknowns)
  const known = breakdown.total - breakdown.unknown;
  breakdown.coverage = known > 0 ? Math.round((breakdown.passing / known) * 100) : 0;

  return breakdown;
}

// =============================================================================
// ENHANCED ROLLUP NODE
// =============================================================================

/**
 * Enhanced rollup node with signal breakdowns
 */
export interface EnhancedRollupNode {
  /** Node identifier */
  id: string;
  /** Display name */
  name: string;
  /** Hierarchy level (connection, database, schema, type) */
  level: string;

  /** Standard metrics */
  metrics: {
    assetCount: number;
    signalCoverage: number;
    gapCount: number;
    highSeverityGaps: number;
    ownershipCoverage: number;
    lineageCoverage: number;
    semanticsCoverage: number;
    sensitivityCoverage: number;
    accessCoverage: number;
    usageCoverage: number;
    freshnessCoverage: number;
  };

  /** Detailed breakdowns per signal */
  signalBreakdowns: Partial<Record<SignalType, SignalBreakdown>>;

  /** Child nodes */
  children: EnhancedRollupNode[];

  /** Leaf assets (if at lowest level) */
  assets?: EnhancedAssetEvidence[];
}

// =============================================================================
// CONVERSION UTILITIES
// =============================================================================

/**
 * Convert legacy PivotAsset signals to enhanced format
 * Used during migration to preserve backward compatibility
 */
export function convertToEnhancedSignals(
  legacySignals: Record<SignalType, boolean | 'UNKNOWN'>,
  defaultSources: Record<SignalType, string>
): EnhancedSignals {
  const signals: Partial<EnhancedSignals> = {};

  for (const [signal, value] of Object.entries(legacySignals)) {
    const signalKey = signal as SignalType;
    signals[signalKey] = {
      value,
      sourceUsed: defaultSources[signalKey] || 'unknown',
      usedTenantMapping: false,
    };
  }

  return signals as EnhancedSignals;
}

/**
 * Default sources for each signal (used when tenant config not available)
 */
export const DEFAULT_SIGNAL_SOURCES: Record<SignalType, string> = {
  ownership: 'native:ownerUsers;ownerGroups',
  semantics: 'native:description;userDescription',
  lineage: 'native:__hasLineage',
  sensitivity: 'native:classificationNames',
  access: 'native:assetPoliciesCount',
  usage: 'native:popularityScore;queryCount',
  freshness: 'native:assetSodaDQStatus;assetMcIsMonitored',
};
