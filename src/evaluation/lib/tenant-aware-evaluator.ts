/**
 * Tenant-Aware Field Evaluator
 *
 * Evaluates asset fields using tenant configuration to determine
 * the correct Atlan attributes to check. Produces enhanced evidence
 * with full context about what was checked and why.
 */

import type { TenantConfig, TenantFieldMapping, FieldSource } from './tenant-config-types';
import type {
  EnhancedAssetEvidence,
  EnhancedSignalResult,
  EnhancedSignals,
  FieldExamination,
  FailureReason,
} from './enhanced-evidence-types';
import { createEnhancedSignalResult, DEFAULT_SIGNAL_SOURCES } from './enhanced-evidence-types';
import type { SignalType } from './pivot-types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Raw asset data from Atlan API
 */
export interface AtlanAsset {
  guid: string;
  typeName: string;
  attributes: Record<string, unknown>;
  classifications?: Array<{ typeName: string; displayName?: string }>;
  relationshipAttributes?: Record<string, unknown>;
  // Hierarchy attributes
  connectionName?: string;
  connectorName?: string;
  databaseName?: string;
  schemaName?: string;
}

/**
 * Canonical field ID to signal type mapping
 */
const FIELD_TO_SIGNAL: Record<string, SignalType> = {
  // Ownership signal
  owner_users: 'ownership',
  owner_groups: 'ownership',
  steward_users: 'ownership',
  steward_groups: 'ownership',

  // Semantics signal
  description: 'semantics',
  readme: 'semantics',
  glossary_terms: 'semantics',

  // Lineage signal
  lineage: 'lineage',
  has_upstream: 'lineage',
  has_downstream: 'lineage',

  // Sensitivity signal
  pii_classification: 'sensitivity',
  sensitivity_classification: 'sensitivity',
  data_classification: 'sensitivity',

  // Access signal
  access_policies: 'access',
  masking_policies: 'access',

  // Usage signal
  popularity_score: 'usage',
  query_count: 'usage',
  view_count: 'usage',

  // Freshness signal
  dq_status: 'freshness',
  freshness_sla: 'freshness',
  incident_count: 'freshness',
};

/**
 * Signal to primary field IDs mapping
 */
const SIGNAL_PRIMARY_FIELDS: Record<SignalType, string[]> = {
  ownership: ['owner_users', 'owner_groups'],
  semantics: ['description', 'readme'],
  lineage: ['lineage'],
  sensitivity: ['pii_classification', 'sensitivity_classification'],
  access: ['access_policies'],
  usage: ['popularity_score', 'query_count'],
  freshness: ['dq_status'],
};

/**
 * Default field sources when no tenant mapping exists
 */
const DEFAULT_FIELD_SOURCES: Record<string, FieldSource> = {
  owner_users: { type: 'native', attribute: 'ownerUsers' },
  owner_groups: { type: 'native', attribute: 'ownerGroups' },
  steward_users: { type: 'native', attribute: 'adminUsers' },
  steward_groups: { type: 'native', attribute: 'adminGroups' },
  description: { type: 'native_any', attributes: ['userDescription', 'description'] },
  readme: { type: 'native', attribute: 'readme' },
  glossary_terms: { type: 'relationship', relation: 'meanings' },
  lineage: { type: 'native', attribute: '__hasLineage' },
  has_upstream: { type: 'relationship', relation: 'inputToProcesses' },
  has_downstream: { type: 'relationship', relation: 'outputFromProcesses' },
  pii_classification: { type: 'classification', pattern: 'PII.*' },
  sensitivity_classification: { type: 'classification', pattern: '.*' },
  data_classification: { type: 'classification', pattern: '.*' },
  access_policies: { type: 'native', attribute: 'assetPoliciesCount' },
  masking_policies: { type: 'native', attribute: 'assetPoliciesCount' },
  popularity_score: { type: 'native', attribute: 'popularityScore' },
  query_count: { type: 'native', attribute: 'queryCount' },
  view_count: { type: 'native', attribute: 'viewsCount' },
  dq_status: { type: 'native_any', attributes: ['assetSodaDQStatus', 'assetAnomaloDQStatus', 'assetMcIsMonitored'] },
  freshness_sla: { type: 'native', attribute: 'assetSodaLastScanAt' },
  incident_count: { type: 'native', attribute: 'assetMcIncidentStates' },
};

// =============================================================================
// FIELD EVALUATION
// =============================================================================

/**
 * Get the effective source for a field from tenant config or default
 */
export function getEffectiveSource(
  tenantConfig: TenantConfig | null,
  canonicalFieldId: string
): { source: FieldSource; usedTenantMapping: boolean } {
  if (tenantConfig) {
    const mapping = tenantConfig.fieldMappings.find(
      m => m.canonicalFieldId === canonicalFieldId &&
           m.status !== 'rejected' &&
           m.tenantSource
    );

    if (mapping?.tenantSource) {
      return { source: mapping.tenantSource, usedTenantMapping: true };
    }
  }

  // Fall back to default
  const defaultSource = DEFAULT_FIELD_SOURCES[canonicalFieldId];
  if (defaultSource) {
    return { source: defaultSource, usedTenantMapping: false };
  }

  // No source available
  return {
    source: { type: 'native', attribute: canonicalFieldId },
    usedTenantMapping: false,
  };
}

/**
 * Format a source as a readable string
 */
export function formatSource(source: FieldSource): string {
  switch (source.type) {
    case 'native':
      return `native:${source.attribute}`;
    case 'native_any':
      return `native_any:[${(source.attributes as string[]).join(', ')}]`;
    case 'custom_metadata':
      return `cm:${source.businessAttribute}.${source.attribute}`;
    case 'classification':
      return `classification:${source.displayName || source.pattern || source.tag || '*'}`;
    case 'relationship':
      return `relationship:${source.relation}`;
    case 'derived':
      return `derived:${source.derivation || 'unknown'}`;
    default:
      return `unknown:${source.type}`;
  }
}

/**
 * Get a human-readable label for a source
 */
export function getSourceLabel(source: FieldSource): string {
  switch (source.type) {
    case 'native':
      return `${source.attribute} (native)`;
    case 'native_any':
      return `${(source.attributes as string[]).join(' or ')} (native)`;
    case 'custom_metadata':
      return `${source.businessAttribute}.${source.attribute} (custom metadata)`;
    case 'classification':
      return `${source.displayName || source.pattern || 'any'} (classification)`;
    case 'relationship':
      return `${source.relation} (relationship)`;
    case 'derived':
      return `${source.derivation || 'computed'} (derived)`;
    default:
      return 'Unknown source';
  }
}

/**
 * Evaluate a field source against an asset
 */
export function evaluateSource(
  source: FieldSource,
  asset: AtlanAsset
): { value: boolean | 'UNKNOWN'; rawValue: unknown; failureReason?: FailureReason } {
  try {
    switch (source.type) {
      case 'native': {
        const attr = source.attribute as string;
        const rawValue = asset.attributes[attr];
        const present = isValuePresent(rawValue);
        return {
          value: present,
          rawValue,
          failureReason: present === false ? determineFailureReasonFromValue(rawValue) : undefined,
        };
      }

      case 'native_any': {
        const attrs = source.attributes as string[];
        for (const attr of attrs) {
          const rawValue = asset.attributes[attr];
          if (isValuePresent(rawValue)) {
            return { value: true, rawValue };
          }
        }
        // None of the attributes had a value
        return {
          value: false,
          rawValue: attrs.map(a => asset.attributes[a]),
          failureReason: 'empty_array',
        };
      }

      case 'custom_metadata': {
        const ba = source.businessAttribute as string;
        const attr = source.attribute as string;
        const businessAttributes = asset.attributes.businessAttributes as Record<string, unknown> | undefined;

        if (!businessAttributes) {
          return { value: false, rawValue: undefined, failureReason: 'cm_not_found' };
        }

        const baData = businessAttributes[ba] as Record<string, unknown> | undefined;
        if (!baData) {
          return { value: false, rawValue: undefined, failureReason: 'cm_not_found' };
        }

        const rawValue = baData[attr];
        const present = isValuePresent(rawValue);
        return {
          value: present,
          rawValue,
          failureReason: present === false ? determineFailureReasonFromValue(rawValue) : undefined,
        };
      }

      case 'classification': {
        const classifications = asset.classifications || [];
        const attrClassifications = asset.attributes.classificationNames as string[] || [];
        const allClassifications = [
          ...classifications.map(c => c.displayName || c.typeName),
          ...attrClassifications,
        ];

        if (allClassifications.length === 0) {
          return { value: false, rawValue: [], failureReason: 'classification_none' };
        }

        // Check if any classification matches the pattern
        const pattern = source.pattern as string || source.tag as string || '.*';
        const regex = new RegExp(pattern, 'i');
        const matches = allClassifications.filter(c => regex.test(c));

        if (matches.length > 0) {
          return { value: true, rawValue: matches };
        }

        return {
          value: false,
          rawValue: allClassifications,
          failureReason: 'classification_none',
        };
      }

      case 'relationship': {
        const relation = source.relation as string;
        // Check in relationshipAttributes first
        const relValue = asset.relationshipAttributes?.[relation];
        if (relValue && (Array.isArray(relValue) ? relValue.length > 0 : true)) {
          return { value: true, rawValue: relValue };
        }

        // Check for count attribute
        const countAttr = `${relation}Count`;
        const count = asset.attributes[countAttr] as number | undefined;
        if (count !== undefined && count > 0) {
          return { value: true, rawValue: count };
        }

        // Check for presence flag
        const presenceAttr = `__has${relation.charAt(0).toUpperCase()}${relation.slice(1)}`;
        const hasRelation = asset.attributes[presenceAttr];
        if (hasRelation === true) {
          return { value: true, rawValue: true };
        }

        return { value: false, rawValue: undefined, failureReason: 'undefined' };
      }

      case 'derived':
        // Derived fields require custom logic - return UNKNOWN for now
        return { value: 'UNKNOWN', rawValue: undefined };

      default:
        return { value: 'UNKNOWN', rawValue: undefined };
    }
  } catch (error) {
    return {
      value: 'UNKNOWN',
      rawValue: undefined,
      failureReason: 'evaluation_error',
    };
  }
}

/**
 * Check if a value is considered "present"
 */
function isValuePresent(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  return true;
}

/**
 * Determine failure reason from raw value
 */
function determineFailureReasonFromValue(value: unknown): FailureReason {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string' && value.trim() === '') return 'empty_string';
  if (Array.isArray(value) && value.length === 0) return 'empty_array';
  if (typeof value === 'object' && Object.keys(value as object).length === 0) return 'empty_object';
  return 'unknown';
}

// =============================================================================
// SIGNAL COMPOSITION
// =============================================================================

/**
 * Evaluate a signal for an asset using tenant config
 */
export function evaluateSignal(
  signal: SignalType,
  asset: AtlanAsset,
  tenantConfig: TenantConfig | null,
  fieldsExamined: FieldExamination[]
): EnhancedSignalResult {
  const primaryFields = SIGNAL_PRIMARY_FIELDS[signal] || [];
  const sources: string[] = [];
  let anyTrue = false;
  let anyFalse = false;
  let lastRawValue: unknown;
  let lastFailureReason: FailureReason | undefined;

  for (const fieldId of primaryFields) {
    const { source, usedTenantMapping } = getEffectiveSource(tenantConfig, fieldId);
    const sourceStr = formatSource(source);
    sources.push(sourceStr);

    const result = evaluateSource(source, asset);

    // Track field examination
    fieldsExamined.push({
      fieldPath: sourceStr,
      rawValue: result.rawValue,
      used: result.value === true,
      sourceType: source.type,
    });

    if (result.value === true) {
      anyTrue = true;
      lastRawValue = result.rawValue;
    } else if (result.value === false) {
      anyFalse = true;
      lastRawValue = result.rawValue;
      lastFailureReason = result.failureReason;
    }
  }

  // Signal is true if ANY contributing field is true
  const value: boolean | 'UNKNOWN' = anyTrue ? true : (anyFalse ? false : 'UNKNOWN');

  return createEnhancedSignalResult(
    value,
    sources.join('; '),
    lastRawValue,
    {
      alternativeSources: sources.length > 1 ? sources : undefined,
      usedTenantMapping: tenantConfig !== null,
      confidence: anyTrue ? 1.0 : (anyFalse ? 1.0 : 0),
    }
  );
}

// =============================================================================
// MAIN EVALUATION FUNCTION
// =============================================================================

/**
 * Evaluate an asset and produce enhanced evidence
 */
export function evaluateAsset(
  asset: AtlanAsset,
  tenantConfig: TenantConfig | null
): EnhancedAssetEvidence {
  const fieldsExamined: FieldExamination[] = [];

  // Evaluate all signals
  const signals: EnhancedSignals = {
    ownership: evaluateSignal('ownership', asset, tenantConfig, fieldsExamined),
    semantics: evaluateSignal('semantics', asset, tenantConfig, fieldsExamined),
    lineage: evaluateSignal('lineage', asset, tenantConfig, fieldsExamined),
    sensitivity: evaluateSignal('sensitivity', asset, tenantConfig, fieldsExamined),
    access: evaluateSignal('access', asset, tenantConfig, fieldsExamined),
    usage: evaluateSignal('usage', asset, tenantConfig, fieldsExamined),
    freshness: evaluateSignal('freshness', asset, tenantConfig, fieldsExamined),
  };

  // Count gaps (signals that are false)
  let gapCount = 0;
  let highSeverityGaps = 0;
  const highSeveritySignals: SignalType[] = ['ownership', 'semantics', 'lineage'];

  for (const [signal, result] of Object.entries(signals)) {
    if (result.value === false) {
      gapCount++;
      if (highSeveritySignals.includes(signal as SignalType)) {
        highSeverityGaps++;
      }
    }
  }

  return {
    assetId: asset.guid,
    assetName: asset.attributes.name as string | undefined,
    assetType: asset.typeName,
    qualifiedName: asset.attributes.qualifiedName as string || '',

    // Hierarchy
    connectionName: (asset.attributes.connectionName as string) || asset.connectionName,
    connectorName: (asset.attributes.connectorName as string) || asset.connectorName,
    databaseName: (asset.attributes.databaseName as string) || asset.databaseName,
    schemaName: (asset.attributes.schemaName as string) || asset.schemaName,
    domainGUIDs: asset.attributes.domainGUIDs as string[] || asset.attributes.__domainGUIDs as string[],

    // Preserve raw attributes for drill-down
    rawAttributes: asset.attributes,

    signals,
    gapCount,
    highSeverityGaps,

    evaluationMetadata: {
      evaluatedAt: new Date().toISOString(),
      tenantConfigVersion: tenantConfig?.version?.toString(),
      fieldsExamined,
    },
  };
}

/**
 * Evaluate multiple assets with tenant config
 */
export function evaluateAssets(
  assets: AtlanAsset[],
  tenantConfig: TenantConfig | null
): EnhancedAssetEvidence[] {
  return assets.map(asset => evaluateAsset(asset, tenantConfig));
}

// =============================================================================
// UTILITY: BUILD ATTRIBUTES LIST FOR ATLAN QUERY
// =============================================================================

/**
 * Build the list of attributes to request from Atlan based on tenant config
 */
export function buildAttributeList(tenantConfig: TenantConfig | null): string[] {
  const baseAttributes = [
    // Core identification
    'name',
    'qualifiedName',

    // Hierarchy
    'connectionName',
    'connectionQualifiedName',
    'connectorName',
    'databaseName',
    'databaseQualifiedName',
    'schemaName',
    'schemaQualifiedName',

    // Ownership
    'ownerUsers',
    'ownerGroups',
    'adminUsers',
    'adminGroups',

    // Semantics
    'description',
    'userDescription',
    'readme',

    // Lineage
    '__hasLineage',

    // Classification
    'classificationNames',
    'classifications',

    // Access/Policy
    'assetPoliciesCount',
    'assetPolicyGUIDs',

    // Usage
    'popularityScore',
    'queryCount',
    'viewsCount',

    // DQ/Freshness
    'assetSodaDQStatus',
    'assetSodaCheckCount',
    'assetAnomaloDQStatus',
    'assetMcIsMonitored',
    'assetMcIncidentStates',

    // Domain
    'domainGUIDs',
    '__domainGUIDs',

    // Custom metadata container
    'businessAttributes',
  ];

  if (!tenantConfig) {
    return baseAttributes;
  }

  // Add any additional attributes from tenant field mappings
  const additionalAttributes = new Set<string>();

  for (const mapping of tenantConfig.fieldMappings) {
    if (mapping.status === 'rejected' || !mapping.tenantSource) continue;

    const source = mapping.tenantSource;
    if (source.type === 'native' && source.attribute) {
      additionalAttributes.add(source.attribute as string);
    } else if (source.type === 'native_any' && source.attributes) {
      for (const attr of source.attributes as string[]) {
        additionalAttributes.add(attr);
      }
    }
  }

  return [...new Set([...baseAttributes, ...additionalAttributes])];
}
