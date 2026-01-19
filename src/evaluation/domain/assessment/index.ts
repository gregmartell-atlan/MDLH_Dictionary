/**
 * Hierarchical Assessment Module
 *
 * Provides scope-aware assessment at any level of the data hierarchy
 * with flexible rollup dimensions.
 *
 * @example
 * ```typescript
 * import {
 *   runAssessment,
 *   createConnectionScope,
 *   createAssetFetcher,
 * } from '@atlan/domain/assessment';
 *
 * // Create assessment request
 * const request = {
 *   requestId: 'assessment-1',
 *   tenantConfig,
 *   scope: createConnectionScope('default/snowflake'),
 *   useCases: ['rag', 'ai_agents'],
 *   rollupDimensions: ['schema', 'owner'],
 *   includeRecommendations: true,
 * };
 *
 * // Run assessment
 * const fetcher = createAssetFetcher(tenantConfig);
 * const result = await runAssessment(request, fetcher);
 *
 * // Access results
 * console.log(`Overall score: ${result.summary.overallScore}`);
 * console.log(`Adoption phase: ${result.summary.adoptionPhase}`);
 * ```
 */

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type {
  // Hierarchy types
  HierarchyLevel,
  RollupDimension,

  // Scope types (renamed to avoid conflict with catalog)
  AssessmentScope as HierarchicalAssessmentScope,
  ScopeFilter,

  // Request types (renamed to avoid conflict with catalog)
  AssessmentRequest as HierarchicalAssessmentRequest,
  AssessmentOptions,
  AssessmentProgress,

  // Asset types
  AssetRecord,
  HierarchyPath,
  AssetFetcher,

  // Field result types
  FieldResult,
  AssetFieldResults,

  // Signal result types
  SignalResult,
  AssetSignalResults,

  // Use case result types
  UseCaseResult,
  UseCaseGap,
  AssetUseCaseResults,

  // Rollup types (renamed to avoid conflict with catalog)
  RollupNode as HierarchicalRollupNode,
  SignalAggregation as HierarchicalSignalAggregation,
  UseCaseAggregation,

  // Assessment result types
  AssessmentResult,
  AssessmentRecommendation,
} from './types';

// =============================================================================
// SCOPE RESOLVER
// =============================================================================

export {
  // Qualified name utilities
  parseQualifiedName,
  buildScopePrefix,
  buildScopeFilter,

  // Hierarchy utilities
  getParentLevel,
  getChildLevel,
  getAncestorLevels,
  getDescendantLevels,
  getDefaultAssetTypes,

  // Asset grouping
  groupAssetsByDimension,
  getDimensionValue,
  buildHierarchyPath,
  enrichAssetHierarchy,

  // Scope validation
  validateScope,

  // Scope factories
  createConnectionScope,
  createSchemaScope,
  createDomainScope,
  createTenantScope,
} from './scope-resolver';

// =============================================================================
// ASSET FETCHER
// =============================================================================

export {
  // Implementations
  AtlanApiFetcher,
  MockAssetFetcher,
  CachedAssetFetcher,

  // Factory
  createAssetFetcher,

  // Utilities
  createMockAsset,
  createMockAssets,
} from './asset-fetcher';

// =============================================================================
// ROLLUP ENGINE
// =============================================================================

export {
  // Aggregation
  aggregateSignals,
  aggregateUseCases,

  // Rollup creation
  createRollupNode,
  generateDimensionRollup,
  generateAllRollups,
  generateHierarchicalRollup,

  // Summary calculations (renamed to avoid conflict with catalog)
  calculateSignalCoverage as calculateRollupSignalCoverage,
  calculateUseCaseReadiness,
  identifyTopGaps,
  determineAdoptionPhase,

  // Comparison utilities
  compareRollupNodes,
  findLowestScoringNodes,
  findHighestGapNodes,
} from './rollup-engine';

// =============================================================================
// USE CASE ASSESSOR
// =============================================================================

export {
  // Field evaluation (renamed to avoid conflict with catalog)
  evaluateField as evaluateAssetField,
  evaluateAllFields as evaluateAssetFields,

  // Signal composition (renamed to avoid conflict with catalog)
  composeSignal as composeAssetSignal,
  composeAllSignals as composeAssetSignals,

  // Use case assessment (renamed to avoid conflict with catalog)
  assessUseCase as assessAssetUseCase,
  assessAllUseCases as assessAssetUseCases,

  // Full assessment
  runAssessment,
} from './use-case-assessor';
