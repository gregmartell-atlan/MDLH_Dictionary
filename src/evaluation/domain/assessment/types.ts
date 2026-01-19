/**
 * Hierarchical Assessment Types
 *
 * Types for scope-aware assessment at any level of the data hierarchy
 * with flexible rollup dimensions.
 */

import type { SignalType, TriState, UseCaseProfile, MethodologyType } from '../catalog/types';
import type { TenantConfiguration } from '../discovery/types';

// =============================================================================
// HIERARCHY LEVELS
// =============================================================================

/**
 * Hierarchy levels in Atlan's data model
 */
export type HierarchyLevel =
  | 'tenant'
  | 'connection'
  | 'database'
  | 'schema'
  | 'table'
  | 'column'
  | 'domain'
  | 'glossary';

/**
 * Rollup dimension - how to aggregate results
 */
export type RollupDimension =
  | 'connection'      // Group by source connection
  | 'database'        // Group by database
  | 'schema'          // Group by schema
  | 'domain'          // Group by data domain
  | 'owner'           // Group by owner
  | 'certification'   // Group by certification status
  | 'asset_type'      // Group by asset type (Table, View, etc.)
  | 'classification'; // Group by classification tags

// =============================================================================
// ASSESSMENT SCOPE
// =============================================================================

/**
 * Assessment scope specification
 */
export interface AssessmentScope {
  /** Level of hierarchy to assess */
  level: HierarchyLevel;

  /** Identifier for the scope (qualified name, domain ID, etc.) */
  scopeId: string;

  /** Human-readable name */
  displayName?: string;

  /** Filter criteria within scope */
  filters?: ScopeFilter[];

  /** Asset types to include (default: all) */
  assetTypes?: string[];

  /** Maximum assets to sample (for large scopes) */
  sampleSize?: number;
}

/**
 * Filter criteria for scope refinement
 */
export interface ScopeFilter {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'in' | 'notIn' | 'exists' | 'notExists';
  value?: string | string[] | boolean;
}

// =============================================================================
// ASSESSMENT REQUEST
// =============================================================================

/**
 * Complete assessment request
 */
export interface AssessmentRequest {
  /** Unique request ID */
  requestId: string;

  /** Tenant configuration to use */
  tenantConfig: TenantConfiguration;

  /** Scope to assess */
  scope: AssessmentScope;

  /** Use cases to evaluate (default: all applicable) */
  useCases?: string[];

  /** Rollup dimensions for aggregation */
  rollupDimensions?: RollupDimension[];

  /** Scoring methodology to use */
  methodology?: MethodologyType;

  /** Include evidence in results */
  includeEvidence?: boolean;

  /** Include recommendations */
  includeRecommendations?: boolean;
}

// =============================================================================
// ASSET DATA
// =============================================================================

/**
 * Asset data from Atlan
 */
export interface AssetRecord {
  /** Unique asset GUID */
  guid: string;

  /** Asset type (Table, Column, etc.) */
  typeName: string;

  /** Qualified name for hierarchy */
  qualifiedName: string;

  /** Display name */
  displayName?: string;

  /** Native attributes */
  attributes: Record<string, unknown>;

  /** Custom metadata */
  customMetadata?: Record<string, Record<string, unknown>>;

  /** Classification tags */
  classifications?: string[];

  /** Hierarchy path */
  hierarchy?: HierarchyPath;
}

/**
 * Hierarchy path for an asset
 */
export interface HierarchyPath {
  connectionQualifiedName?: string;
  connectionName?: string;
  databaseQualifiedName?: string;
  databaseName?: string;
  schemaQualifiedName?: string;
  schemaName?: string;
  domainGuid?: string;
  domainName?: string;
}

// =============================================================================
// FIELD EVALUATION RESULTS
// =============================================================================

/**
 * Result of evaluating a single field on an asset
 */
export interface FieldResult {
  fieldId: string;
  fieldName: string;
  present: TriState;
  value?: unknown;
  source?: string;
  error?: string;
}

/**
 * Result of evaluating all fields on an asset
 */
export interface AssetFieldResults {
  assetGuid: string;
  assetType: string;
  qualifiedName: string;
  fields: FieldResult[];
  evaluatedAt: string;
}

// =============================================================================
// SIGNAL RESULTS
// =============================================================================

/**
 * Result of composing a signal from field results
 */
export interface SignalResult {
  signal: SignalType;
  present: TriState;
  score: number;           // 0.0 - 1.0
  confidence: number;      // 0.0 - 1.0
  contributingFields: Array<{
    fieldId: string;
    present: TriState;
    weight: number;
  }>;
}

/**
 * Complete signal profile for an asset
 */
export interface AssetSignalResults {
  assetGuid: string;
  assetType: string;
  qualifiedName: string;
  signals: SignalResult[];
  overallScore: number;
  evaluatedAt: string;
}

// =============================================================================
// USE CASE ASSESSMENT
// =============================================================================

/**
 * Assessment result for a single use case
 */
export interface UseCaseResult {
  useCaseId: string;
  useCaseName: string;
  readinessScore: number;    // 0.0 - 1.0
  readinessLevel: 'NOT_READY' | 'PARTIAL' | 'READY' | 'EXCELLENT';
  requiredSignalsMet: number;
  requiredSignalsTotal: number;
  signalScores: Array<{
    signal: SignalType;
    weight: number;
    required: boolean;
    score: number;
    met: boolean;
  }>;
  gaps: UseCaseGap[];
}

/**
 * Gap identified in use case readiness
 */
export interface UseCaseGap {
  signal: SignalType;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  remediation: string;
  affectedFields: string[];
  estimatedEffort?: 'LOW' | 'MEDIUM' | 'HIGH';
}

/**
 * Complete use case assessment for an asset
 */
export interface AssetUseCaseResults {
  assetGuid: string;
  assetType: string;
  qualifiedName: string;
  useCases: UseCaseResult[];
  bestReadyUseCase?: string;
  worstGapUseCase?: string;
  evaluatedAt: string;
}

// =============================================================================
// ROLLUP RESULTS
// =============================================================================

/**
 * Rollup node in the hierarchy
 */
export interface RollupNode {
  /** Node identifier */
  id: string;

  /** Node display name */
  name: string;

  /** Dimension this node belongs to */
  dimension: RollupDimension;

  /** Value for this dimension */
  dimensionValue: string;

  /** Number of assets in this node */
  assetCount: number;

  /** Aggregated signal scores */
  signals: Record<SignalType, SignalAggregation>;

  /** Aggregated use case scores */
  useCases: Record<string, UseCaseAggregation>;

  /** Overall completeness score */
  completenessScore: number;

  /** Child nodes (for nested rollups) */
  children?: RollupNode[];
}

/**
 * Aggregated signal statistics
 */
export interface SignalAggregation {
  signal: SignalType;
  presentCount: number;
  absentCount: number;
  unknownCount: number;
  presenceRate: number;      // 0.0 - 1.0
  averageScore: number;      // 0.0 - 1.0
  distribution: {
    excellent: number;       // score >= 0.9
    good: number;            // score >= 0.7
    fair: number;            // score >= 0.5
    poor: number;            // score < 0.5
  };
}

/**
 * Aggregated use case statistics
 */
export interface UseCaseAggregation {
  useCaseId: string;
  useCaseName: string;
  readyCount: number;
  partialCount: number;
  notReadyCount: number;
  readinessRate: number;     // 0.0 - 1.0
  averageScore: number;      // 0.0 - 1.0
  topGaps: Array<{
    signal: SignalType;
    affectedCount: number;
    percentAffected: number;
  }>;
}

// =============================================================================
// COMPLETE ASSESSMENT RESULT
// =============================================================================

/**
 * Complete assessment result
 */
export interface AssessmentResult {
  /** Request that generated this result */
  request: AssessmentRequest;

  /** Assessment metadata */
  metadata: {
    assessedAt: string;
    durationMs: number;
    totalAssets: number;
    sampledAssets: number;
    scope: AssessmentScope;
  };

  /** Summary statistics */
  summary: {
    overallScore: number;
    signalCoverage: Record<SignalType, number>;
    useCaseReadiness: Record<string, number>;
    topGaps: UseCaseGap[];
    adoptionPhase: 'FOUNDATION' | 'EXPANSION' | 'OPTIMIZATION' | 'EXCELLENCE';
  };

  /** Rollup results by dimension */
  rollups: Record<RollupDimension, RollupNode[]>;

  /** Detailed asset results (if requested) */
  assetDetails?: AssetUseCaseResults[];

  /** Recommendations (if requested) */
  recommendations?: AssessmentRecommendation[];
}

/**
 * Assessment recommendation
 */
export interface AssessmentRecommendation {
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'SIGNAL_GAP' | 'USE_CASE_GAP' | 'COVERAGE_GAP' | 'CONFIGURATION';
  title: string;
  description: string;
  affectedSignals?: SignalType[];
  affectedUseCases?: string[];
  estimatedImpact: {
    assetsAffected: number;
    scoreImprovement: number;
  };
  remediation: {
    steps: string[];
    effort: 'LOW' | 'MEDIUM' | 'HIGH';
    owner?: string;
  };
}

// =============================================================================
// ASSET FETCHER INTERFACE
// =============================================================================

/**
 * Interface for fetching assets from Atlan
 * Implementations can use different strategies (API, cache, mock)
 */
export interface AssetFetcher {
  /**
   * Fetch assets within a scope
   */
  fetchAssets(
    scope: AssessmentScope,
    tenantConfig: TenantConfiguration
  ): Promise<AssetRecord[]>;

  /**
   * Fetch a single asset by GUID
   */
  fetchAsset(
    guid: string,
    tenantConfig: TenantConfiguration
  ): Promise<AssetRecord | null>;

  /**
   * Get total count of assets in scope (for sampling decisions)
   */
  countAssets(
    scope: AssessmentScope,
    tenantConfig: TenantConfiguration
  ): Promise<number>;
}

// =============================================================================
// ASSESSMENT OPTIONS
// =============================================================================

/**
 * Options for assessment execution
 */
export interface AssessmentOptions {
  /** Parallel asset evaluation batch size */
  batchSize?: number;

  /** Timeout per batch in ms */
  batchTimeoutMs?: number;

  /** Progress callback */
  onProgress?: (progress: AssessmentProgress) => void;

  /** Error handling strategy */
  onError?: 'fail' | 'skip' | 'warn';
}

/**
 * Assessment progress update
 */
export interface AssessmentProgress {
  phase: 'FETCHING' | 'EVALUATING' | 'COMPOSING' | 'ROLLING_UP' | 'COMPLETE';
  assetsProcessed: number;
  assetsTotal: number;
  percentComplete: number;
  currentBatch?: number;
  totalBatches?: number;
  elapsedMs: number;
  estimatedRemainingMs?: number;
}
