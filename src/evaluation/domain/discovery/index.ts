/**
 * Tenant Discovery Module
 *
 * Auto-discovers tenant Atlan schema, reconciles fields against the
 * unified catalog, generates recommendations, and manages tenant
 * configuration.
 *
 * @example
 * ```typescript
 * import {
 *   discoverTenantSchema,
 *   reconcileAllFields,
 *   generateRecommendations,
 *   createInitialConfiguration,
 * } from '@atlan/domain/discovery';
 *
 * // 1. Discover tenant schema
 * const snapshot = await discoverTenantSchema(
 *   'https://tenant.atlan.com',
 *   'api-token',
 *   'tenant-123'
 * );
 *
 * // 2. Reconcile fields
 * const reconciliation = reconcileAllFields(snapshot);
 *
 * // 3. Generate recommendations
 * const recommendations = generateRecommendations(snapshot, reconciliation);
 *
 * // 4. Create initial configuration
 * const config = createInitialConfiguration(
 *   'tenant-123',
 *   'https://tenant.atlan.com',
 *   reconciliation
 * );
 * ```
 */

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type {
  // Schema types
  EntityTypeDefinition,
  CustomMetadataAttribute,
  CustomMetadataDefinition,
  ClassificationDefinition,
  DomainDefinition,
  GlossaryDefinition,
  FieldPopulationStats,
  TenantSchemaSnapshot,

  // Reconciliation types
  ReconciliationStatus,
  FieldMatch,
  FieldReconciliationResult,
  ReconciliationReport,

  // Recommendation types
  FieldRecommendation,
  RecommendationsReport,

  // Configuration types
  MappingStatus,
  TenantFieldMapping,
  TenantCustomField,
  TenantClassificationMapping,
  TenantConfiguration,

  // Options
  DiscoveryOptions,
  ReconciliationOptions,
} from './types';

// =============================================================================
// TENANT DISCOVERY
// =============================================================================

export {
  // Main discovery function
  discoverTenantSchema,

  // Component discovery
  discoverEntityTypes,
  discoverCustomMetadata,
  discoverClassifications,
  discoverDomains,
  discoverGlossaries,

  // Field population
  sampleFieldPopulation,

  // Utilities
  attributeExistsInSchema,
  findCustomMetadataWithAttribute,
  getPopulationRate,
} from './tenant-discovery';

// =============================================================================
// FIELD RECONCILIATION
// =============================================================================

export {
  // Main reconciliation
  reconcileField,
  reconcileAllFields,

  // Query functions
  getFieldsNeedingConfirmation,
  getMatchedFields,
  getUnmatchedFields,

  // Conversion
  toFieldMapping,
} from './field-reconciliation';

// =============================================================================
// RECOMMENDATIONS
// =============================================================================

export {
  // Generation
  generateRecommendations,

  // Queries
  getHighConfidenceRecommendations,
  getRecommendationsForSignal,
  getGapFillingRecommendations,

  // Suggestions
  generateImprovementSuggestions,
} from './recommendations';

// =============================================================================
// TENANT CONFIGURATION
// =============================================================================

export {
  // Creation
  createInitialConfiguration,

  // Field mapping operations
  confirmFieldMapping,
  rejectFieldMapping,
  overrideFieldMapping,

  // Custom field operations
  addCustomField,
  removeCustomField,

  // Classification mapping operations
  addClassificationMapping,
  removeClassificationMapping,

  // Field exclusion
  excludeField,
  includeField,

  // Queries
  getEffectiveFieldSource,
  getActiveMappings,
  getPendingMappings,
  getConfigurationCompleteness,

  // Merge and refresh
  mergeReconciliationResults,

  // Serialization
  serializeConfiguration,
  deserializeConfiguration,
  validateConfiguration,
} from './tenant-config';
