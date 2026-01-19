/**
 * Unified Field Catalog - Type Definitions
 *
 * This module defines the core types for the unified field catalog system.
 * All assessable properties map to Atlan attributes, custom metadata,
 * classifications, or derived computations.
 */

// =============================================================================
// SIGNAL TYPES
// =============================================================================

/**
 * Canonical signal types for metadata assessment
 * These represent the high-level dimensions of metadata health
 */
export type SignalType =
  | 'OWNERSHIP'       // Assets have assigned owners
  | 'SEMANTICS'       // Documentation and context present
  | 'LINEAGE'         // Data flow relationships documented
  | 'SENSITIVITY'     // Classification and sensitivity markers
  | 'ACCESS'          // Access policies defined
  | 'QUALITY'         // DQ monitoring configured
  | 'FRESHNESS'       // Timeliness monitoring configured
  | 'USAGE'           // Usage telemetry available
  | 'AI_READY'        // AI/ML use approved
  | 'TRUST';          // Certification and trust markers

/**
 * Tri-state value for signal/field presence
 */
export type TriState = true | false | 'UNKNOWN';

// =============================================================================
// FIELD SOURCE TYPES
// =============================================================================

/**
 * Native Atlan attribute source
 * Maps directly to a single attribute on an entity type
 */
export interface NativeSource {
  type: 'native';
  attribute: string;  // e.g., 'ownerUsers'
}

/**
 * Native Atlan attribute source with multiple candidates (ANY match)
 * Field is present if ANY of the attributes has a value
 */
export interface NativeAnySource {
  type: 'native_any';
  attributes: string[];  // e.g., ['description', 'userDescription']
}

/**
 * Custom metadata source
 * Maps to a business attribute in Atlan
 */
export interface CustomMetadataSource {
  type: 'custom_metadata';
  businessAttribute: string;  // e.g., 'Privacy'
  attribute: string;          // e.g., 'piiFlag'
}

/**
 * Classification source
 * Checks for presence of classification tags
 */
export interface ClassificationSource {
  type: 'classification';
  pattern?: string;     // Regex pattern, e.g., '^PII.*'
  anyOf?: string[];     // Exact matches, e.g., ['PII', 'PHI', 'PCI']
}

/**
 * Relationship source
 * Checks for presence of relationship links
 */
export interface RelationshipSource {
  type: 'relationship';
  relation: string;     // e.g., 'meanings', 'inputToProcesses'
  direction?: 'upstream' | 'downstream' | 'any';
  countThreshold?: number;  // Minimum count to be "present"
}

/**
 * Derived field source
 * Complex logic that requires computation
 */
export interface DerivedSource {
  type: 'derived';
  derivation: string;   // Human-readable derivation rule
  // Actual compute function is registered separately
}

/**
 * Union type for all field sources
 */
export type FieldSource =
  | NativeSource
  | NativeAnySource
  | CustomMetadataSource
  | ClassificationSource
  | RelationshipSource
  | DerivedSource;

// =============================================================================
// FIELD CATEGORIES
// =============================================================================

/**
 * Categories for organizing fields
 */
export type FieldCategory =
  | 'identity'          // Name, qualified name, type
  | 'ownership'         // Owners, stewards, accountable parties
  | 'documentation'     // Description, readme, glossary terms
  | 'lineage'           // Upstream/downstream, PK/FK
  | 'classification'    // Tags, classifications, sensitivity
  | 'quality'           // DQ signals, freshness, incidents
  | 'usage'             // Popularity, query counts
  | 'governance'        // Policies, access control
  | 'hierarchy'         // Connection, database, schema
  | 'lifecycle'         // Status, retirement, lifecycle stage
  | 'custom';           // Tenant-specific extensions

// =============================================================================
// UNIFIED FIELD DEFINITION
// =============================================================================

/**
 * Signal contribution definition
 * Specifies how a field contributes to a signal
 */
export interface SignalContribution {
  signal: SignalType;
  weight: number;         // 0-1, contribution weight
  required?: boolean;     // If true, signal requires this field
  negative?: boolean;     // If true, presence is a negative indicator
}

/**
 * Unified field definition
 * The core building block of the field catalog
 */
export interface UnifiedField {
  // Identity
  id: string;                           // Canonical field ID, e.g., 'owner_users'
  displayName: string;                  // Human-readable name
  description: string;                  // Field description
  category: FieldCategory;              // Organization category

  // Source mapping
  source: FieldSource;                  // How to get this field's value

  // Applicability
  supportedAssetTypes: string[];        // ['Table', 'View', 'Column', '*']

  // Signal contribution
  contributesToSignals: SignalContribution[];

  // Measure mapping (from binding matrix)
  measureId?: string;                   // e.g., 'coverage.owner'

  // Completeness scoring
  completenessWeight?: number;          // Weight in completeness formula

  // Use case metadata
  useCases: string[];                   // Which use cases care about this
  coreForUseCases: string[];            // Which use cases consider it "core"

  // Atlan documentation
  atlanDocsUrl?: string;
  atlanApiHint?: string;                // API hint for fetching

  // Status
  status: 'active' | 'deprecated' | 'experimental';
}

// =============================================================================
// SIGNAL DEFINITION
// =============================================================================

/**
 * Signal aggregation method
 */
export type SignalAggregation =
  | { method: 'any' }                           // Present if ANY field has value
  | { method: 'all' }                           // Present only if ALL fields have value
  | { method: 'weighted_threshold'; threshold: number };  // Weighted sum >= threshold

/**
 * Signal definition
 * Defines how fields compose into signals
 */
export interface SignalDefinition {
  id: SignalType;
  displayName: string;
  description: string;

  // Aggregation rule
  aggregation: SignalAggregation;

  // Workstream for remediation
  workstream: string;

  // Severity for gap analysis
  severity: 'HIGH' | 'MED' | 'LOW';

  // Documentation
  guidanceUrl?: string;
}

// =============================================================================
// USE CASE PROFILE
// =============================================================================

/**
 * Methodology types for scoring
 */
export type MethodologyType =
  | 'WEIGHTED_MEASURES'
  | 'WEIGHTED_DIMENSIONS'
  | 'CHECKLIST'
  | 'QTRIPLET'
  | 'MATURITY';

/**
 * Signal weight in a use case
 */
export interface UseCaseSignalWeight {
  signal: SignalType;
  weight: number;           // 0-1
  required?: boolean;       // Must pass for use case readiness
}

/**
 * Use case profile
 * Defines assessment criteria for a specific use case
 */
export interface UseCaseProfile {
  id: string;
  displayName: string;
  description: string;

  // Signal weights
  signals: UseCaseSignalWeight[];

  // Applicable asset types
  relevantAssetTypes: string[];

  // Scoring thresholds
  thresholds: {
    ready: number;          // Score >= this = "Ready"
    partial: number;        // Score >= this = "Partially Ready"
  };

  // Default methodology
  defaultMethodology: MethodologyType;

  // Documentation
  guidanceUrl?: string;
}

// =============================================================================
// TENANT CONFIGURATION
// =============================================================================

/**
 * Reconciliation status for field mapping
 */
export type ReconciliationStatus =
  | 'MATCHED'           // Direct attribute match
  | 'ALIAS_MATCHED'     // Matched via alias transformation
  | 'CM_SUGGESTED'      // Custom metadata field looks like a match
  | 'CLASSIFICATION'    // Could use classification instead
  | 'NOT_FOUND'         // No match found in tenant
  | 'AMBIGUOUS';        // Multiple possible matches

/**
 * Tenant-specific field mapping
 */
export interface TenantFieldMapping {
  canonicalField: string;
  tenantSource: FieldSource;
  status: 'auto' | 'confirmed' | 'rejected';
  confidence?: number;
  confirmedAt?: string;
  confirmedBy?: string;
}

/**
 * Tenant-defined custom field
 */
export interface TenantCustomField {
  id: string;
  displayName: string;
  description?: string;
  tenantSource: FieldSource;
  contributesToSignals: SignalContribution[];
  completenessWeight?: number;
}

/**
 * Classification to signal mapping
 */
export interface ClassificationMapping {
  pattern: string;          // Regex or exact match
  signal: SignalType;
  indicatorType: 'positive' | 'negative';
}

/**
 * Complete tenant field configuration
 */
export interface TenantFieldConfiguration {
  tenantId: string;
  version: number;
  createdAt: string;
  updatedAt: string;

  // Canonical field mappings
  fieldMappings: TenantFieldMapping[];

  // Tenant-specific extensions
  customFields: TenantCustomField[];

  // Classification mappings
  classificationMappings: ClassificationMapping[];

  // Excluded fields
  excludedFields: string[];
}

// =============================================================================
// ASSESSMENT TYPES
// =============================================================================

/**
 * Assessment scope specification
 */
export interface AssessmentScope {
  level: 'tenant' | 'connection' | 'database' | 'schema' | 'domain' | 'asset_list';
  identifier?: string;        // qualifiedName for specific scope
  assetGuids?: string[];      // For asset_list type
}

/**
 * Rollup configuration
 */
export interface RollupConfig {
  groupBy: 'connection' | 'database' | 'schema' | 'domain' | 'owner' | 'type' | 'none';
  thenBy?: 'database' | 'schema' | 'type' | 'none';
  includeAssetDetails: boolean;
  includeGaps: boolean;
}

/**
 * Hierarchical assessment request
 */
export interface AssessmentRequest {
  useCaseId: string;
  methodology?: MethodologyType;
  scope: AssessmentScope;
  assessAtLevel: 'connection' | 'database' | 'schema' | 'table' | 'column';
  rollup: RollupConfig;
}

/**
 * Gap in assessment
 */
export interface AssessmentGap {
  signal: SignalType;
  field: string;
  assetCount: number;
  scope?: string;
  recommendation?: string;
}

/**
 * Rollup node in results
 */
export interface RollupNode {
  dimension: string;
  name: string;
  qualifiedName?: string;
  metrics: {
    score: number;
    assetCount: number;
    signalScores: Partial<Record<SignalType, number>>;
  };
  children?: RollupNode[];
}
