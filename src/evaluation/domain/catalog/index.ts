/**
 * Unified Field Catalog Module
 *
 * This module provides a single source of truth for all assessable metadata fields.
 * It unifies definitions from the binding matrix, completeness scoring, metadata model,
 * and Atlan compatibility layers into a cohesive catalog.
 *
 * Key exports:
 * - UNIFIED_FIELD_CATALOG: Complete field catalog
 * - SIGNAL_DEFINITIONS: Canonical signal definitions
 * - USE_CASE_PROFILES: Assessment profiles for use cases
 * - Field evaluation and signal composition utilities
 */

// Types
export type {
  // Core types
  SignalType,
  TriState,
  FieldCategory,
  MethodologyType,

  // Field types
  FieldSource,
  NativeSource,
  NativeAnySource,
  CustomMetadataSource,
  ClassificationSource,
  RelationshipSource,
  DerivedSource,
  SignalContribution,
  UnifiedField,

  // Signal types
  SignalAggregation,
  SignalDefinition,

  // Use case types
  UseCaseSignalWeight,
  UseCaseProfile,

  // Tenant configuration types (local versions - discovery module has more complete versions)
  ClassificationMapping,
  TenantFieldConfiguration,

  // Assessment types
  AssessmentScope,
  RollupConfig,
  AssessmentRequest,
  AssessmentGap,
  RollupNode,
} from './types';

// Unified Field Catalog
export {
  UNIFIED_FIELD_CATALOG,
  getFieldById,
  getFieldsByCategory,
  getFieldsForSignal,
  getFieldsForUseCase,
  getCoreFieldsForUseCase,
  getFieldsForAssetType,
  getCompletenessFields,
  getMeasureFields,
  getActiveFields,
  createFieldMap,
} from './unified-fields';

// Signal Definitions
export {
  SIGNAL_DEFINITIONS,
  getSignalById,
  getSignalsByWorkstream,
  getSignalsBySeverity,
  getAllSignalIds,
  createSignalMap,
  WORKSTREAM_DEFINITIONS,
  getWorkstreamForSignal,
  SEVERITY_TO_PRIORITY,
  getSignalPriority,
} from './signal-definitions';

// Use Case Profiles
export {
  USE_CASE_PROFILES,
  getUseCaseById,
  getUseCasesForAssetType,
  getUseCasesRequiringSignal,
  getUseCasesByMethodology,
  getAllUseCaseIds,
  createUseCaseMap,
  USE_CASE_CATEGORIES,
  getUseCasesByCategory,
} from './use-case-profiles';

// Field Evaluator
export type {
  FieldEvaluationResult,
  AssetData,
  EvaluationContext,
  AssetEvaluationResult,
} from './field-evaluator';

export {
  isValuePresent,
  evaluateSource,
  evaluateField,
  evaluateFieldById,
  evaluateFields,
  evaluateAllFields,
  evaluateFieldsForAssetType,
  evaluateAssets,
  aggregateFieldPresence,
  calculateFieldCoverage,
} from './field-evaluator';

// Signal Composer
export type {
  SignalCompositionResult,
  AssetSignalProfile,
  UseCaseAssessmentResult,
} from './signal-composer';

export {
  getFieldContributionsForSignal,
  composeSignal,
  composeAllSignals,
  createSignalProfile,
  assessUseCase,
  assessAllUseCases,
  createSignalProfiles,
  aggregateSignalPresence,
  calculateSignalCoverage,
  calculateCompletenessScore,
  getAdoptionPhase,
} from './signal-composer';
