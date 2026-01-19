/**
 * Tenant Discovery Types
 *
 * Types for discovering and mapping tenant-specific Atlan schema
 * to the unified field catalog.
 */

import type { FieldSource, SignalType, SignalContribution } from '../catalog/types';

// =============================================================================
// TENANT SCHEMA SNAPSHOT
// =============================================================================

/**
 * Atlan entity type definition
 */
export interface EntityTypeDefinition {
  name: string;
  displayName?: string;
  description?: string;
  attributes: string[];
  relationshipAttributes: string[];
  superTypes: string[];
}

/**
 * Custom metadata attribute definition
 */
export interface CustomMetadataAttribute {
  name: string;
  displayName: string;
  description?: string;
  type: 'string' | 'boolean' | 'number' | 'date' | 'enum' | 'user' | 'group' | 'asset';
  enumValues?: string[];
  multiValued?: boolean;
  required?: boolean;
}

/**
 * Custom metadata (Business Attribute) definition
 */
export interface CustomMetadataDefinition {
  name: string;
  displayName: string;
  description?: string;
  applicableTypes: string[];
  attributes: CustomMetadataAttribute[];
}

/**
 * Classification definition
 */
export interface ClassificationDefinition {
  name: string;
  displayName: string;
  description?: string;
  superTypes: string[];
  entityTypes?: string[];  // Applicable entity types
}

/**
 * Domain definition
 */
export interface DomainDefinition {
  guid: string;
  name: string;
  qualifiedName: string;
  parentGuid: string | null;
  description?: string;
}

/**
 * Glossary definition
 */
export interface GlossaryDefinition {
  guid: string;
  name: string;
  qualifiedName: string;
  termCount: number;
  categoryCount: number;
}

/**
 * Field population statistics
 */
export interface FieldPopulationStats {
  attributeName: string;
  assetType: string;
  totalAssets: number;
  populatedAssets: number;
  populationRate: number;
  sampleValues?: string[];
}

/**
 * Complete tenant schema snapshot
 */
export interface TenantSchemaSnapshot {
  tenantId: string;
  baseUrl: string;
  discoveredAt: string;

  // Entity types and their attributes
  entityTypes: Record<string, EntityTypeDefinition>;

  // Custom metadata definitions
  customMetadata: Record<string, CustomMetadataDefinition>;

  // Classifications
  classifications: ClassificationDefinition[];

  // Domain hierarchy
  domains: DomainDefinition[];

  // Glossaries
  glossaries: GlossaryDefinition[];

  // Field population statistics (sampled)
  fieldPopulation: FieldPopulationStats[];

  // Discovery metadata
  discoveryStats: {
    entityTypeCount: number;
    customMetadataCount: number;
    classificationCount: number;
    domainCount: number;
    glossaryCount: number;
    totalAssetsSampled: number;
  };
}

// =============================================================================
// FIELD RECONCILIATION
// =============================================================================

/**
 * Reconciliation status
 */
export type ReconciliationStatus =
  | 'MATCHED'           // Direct attribute match
  | 'ALIAS_MATCHED'     // Matched via alias transformation
  | 'CM_MATCHED'        // Matched to custom metadata
  | 'CM_SUGGESTED'      // Custom metadata looks like a match (needs confirmation)
  | 'CLASSIFICATION'    // Could use classification
  | 'NOT_FOUND'         // No match found
  | 'AMBIGUOUS'         // Multiple possible matches
  | 'EXCLUDED';         // User excluded this field

/**
 * A potential match for a field
 */
export interface FieldMatch {
  type: 'attribute' | 'custom_metadata' | 'classification' | 'relationship';
  path: string;                         // e.g., "ownerUsers" or "cm.Privacy.piiFlag"
  displayName?: string;
  confidence: number;                   // 0-1
  populationRate?: number;              // % of assets with this field
  reason: string;                       // Why this match was suggested
}

/**
 * Reconciliation result for a single field
 */
export interface FieldReconciliationResult {
  canonicalFieldId: string;
  canonicalFieldName: string;
  status: ReconciliationStatus;

  // Best match (if any)
  match?: FieldMatch;

  // Alternative matches (for ambiguous cases)
  alternatives?: FieldMatch[];

  // Suggestions if not found
  suggestions?: Array<{
    action: 'create_cm' | 'map_to_existing' | 'use_classification' | 'skip';
    description: string;
    template?: {
      businessAttribute?: string;
      attribute?: string;
      type?: string;
    };
  }>;
}

/**
 * Complete reconciliation report
 */
export interface ReconciliationReport {
  tenantId: string;
  generatedAt: string;

  // Summary counts
  summary: {
    total: number;
    matched: number;
    aliasMatched: number;
    cmMatched: number;
    suggested: number;
    notFound: number;
    ambiguous: number;
  };

  // Per-field results
  results: FieldReconciliationResult[];

  // Overall reconciliation score (0-1)
  reconciliationScore: number;
}

// =============================================================================
// RECOMMENDATIONS
// =============================================================================

/**
 * Field recommendation
 */
export interface FieldRecommendation {
  // What we found in the tenant
  tenantField: {
    type: 'custom_metadata' | 'classification' | 'attribute';
    path: string;
    displayName: string;
    description?: string;
  };

  // Population stats
  populationStats: {
    totalAssets: number;
    populatedAssets: number;
    rate: number;
  };

  // Recommendation
  recommendation: {
    signal: SignalType;
    rationale: string;
    weight: number;
    action: 'add_to_model' | 'replace_existing' | 'supplement';
  };

  // Confidence
  confidence: number;
}

/**
 * Recommendations report
 */
export interface RecommendationsReport {
  tenantId: string;
  generatedAt: string;

  // Recommendations sorted by priority
  recommendations: FieldRecommendation[];

  // Summary
  summary: {
    totalRecommendations: number;
    bySignal: Record<SignalType, number>;
    byConfidenceLevel: {
      high: number;     // confidence >= 0.8
      medium: number;   // confidence >= 0.5
      low: number;      // confidence < 0.5
    };
  };
}

// =============================================================================
// TENANT CONFIGURATION
// =============================================================================

/**
 * Mapping status
 */
export type MappingStatus = 'auto' | 'confirmed' | 'rejected' | 'pending';

/**
 * Tenant-specific field mapping
 */
export interface TenantFieldMapping {
  canonicalFieldId: string;
  tenantSource: FieldSource;
  status: MappingStatus;
  confidence?: number;
  confirmedAt?: string;
  confirmedBy?: string;
  notes?: string;
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
  createdAt: string;
  createdBy?: string;
}

/**
 * Classification to signal mapping
 */
export interface TenantClassificationMapping {
  pattern: string;
  signal: SignalType;
  indicatorType: 'positive' | 'negative';
  confirmedAt?: string;
}

/**
 * Complete tenant configuration
 */
export interface TenantConfiguration {
  tenantId: string;
  baseUrl: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;

  // Field mappings from canonical fields to tenant sources
  fieldMappings: TenantFieldMapping[];

  // Tenant-defined extensions
  customFields: TenantCustomField[];

  // Classification mappings
  classificationMappings: TenantClassificationMapping[];

  // Fields explicitly excluded from assessment
  excludedFields: string[];

  // Snapshot reference
  lastSnapshotAt?: string;
}

// =============================================================================
// DISCOVERY OPTIONS
// =============================================================================

/**
 * Options for tenant discovery
 */
export interface DiscoveryOptions {
  // Which components to discover
  includeEntityTypes?: boolean;
  includeCustomMetadata?: boolean;
  includeClassifications?: boolean;
  includeDomains?: boolean;
  includeGlossaries?: boolean;

  // Field population sampling
  sampleFieldPopulation?: boolean;
  sampleSize?: number;
  sampleAssetTypes?: string[];

  // Filtering
  entityTypeFilter?: string[];        // Only include these types
  customMetadataFilter?: string[];    // Only include these CMs

  // Caching
  useCache?: boolean;
  cacheTtlMs?: number;
}

/**
 * Options for reconciliation
 */
export interface ReconciliationOptions {
  // Matching thresholds
  exactMatchOnly?: boolean;
  aliasMatchThreshold?: number;       // Minimum confidence for alias match
  cmMatchThreshold?: number;          // Minimum confidence for CM suggestion

  // Include/exclude
  includeExperimental?: boolean;      // Include experimental fields
  skipDeprecated?: boolean;           // Skip deprecated fields

  // Asset type context
  forAssetTypes?: string[];           // Only reconcile for these types
}
