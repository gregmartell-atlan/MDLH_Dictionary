/**
 * Consolidated Field Mappings
 *
 * SINGLE SOURCE OF TRUTH for all field mappings in the assessment system.
 *
 * Previously scattered across:
 * - measures/canonical.ts (MEASURE_TO_EVIDENCE_FIELD)
 * - bindings.ts (binding matrix)
 * - evidence/route.ts (getMeasureEvidenceField)
 * - tenant-aware-evaluator.ts (DEFAULT_FIELD_SOURCES)
 *
 * Now consolidated here for consistency and maintainability.
 */

import type { SignalType } from './pivot-types';

// ============================================================================
// Measure ID → Evidence Field Mapping
// ============================================================================

/**
 * Maps measure IDs to their corresponding AssetEvidence field names.
 *
 * This is used for:
 * 1. Computing measure values from evidence
 * 2. Generating human-readable explanations
 * 3. Asset-level drill-down in UI
 */
export const MEASURE_TO_EVIDENCE_FIELD: Record<string, string> = {
  // Coverage measures
  'coverage.owner': 'ownerPresent',
  'coverage.asset_description': 'descriptionPresent',
  'coverage.runbook': 'runbookPresent',
  'coverage.certified': 'certified',
  'coverage.lineage': 'lineagePresent',
  'coverage.relationships': 'relationshipsPresent', // DEPRECATED - use lineage
  'coverage.joinability': 'joinabilityPresent',
  'coverage.dq_signals': 'dqSignalsPresent',
  'coverage.retention_policy': 'retentionPolicyPresent',
  'coverage.usage_telemetry': 'usageTelemetryPresent',

  // Policy/protection measures
  'policy.classified_protected': 'classifiedFieldsProtected',
  'policy.protection': 'classifiedFieldsProtected',
  'policy.has_classified': 'hasClassifiedFields',

  // Quality measures
  'quality.freshness_sla': 'freshnessSlaPass',
  'quality.incident_free': 'incidentCount', // NOTE: Was incorrectly 'incidents30d'
  'quality.low_volatility': 'schemaVolatility30d',

  // Data Product measures
  'coverage.dp_criticality': 'dataProductCriticalityPresent',
  'coverage.dp_sensitivity': 'dataProductSensitivityPresent',
  'coverage.dp_visibility': 'dataProductVisibilityPresent',
  'coverage.dp_status': 'dataProductStatusPresent',
  'coverage.dp_score': 'dataProductScorePresent',
};

/**
 * Get the evidence field for a measure ID
 */
export function getMeasureEvidenceField(measureId: string): string | undefined {
  return MEASURE_TO_EVIDENCE_FIELD[measureId];
}

/**
 * Get measure description for UI display
 */
export function getMeasureDescription(measureId: string): string {
  const descriptions: Record<string, string> = {
    'coverage.owner': 'Percentage of assets with assigned owners',
    'coverage.asset_description': 'Percentage of assets with descriptions',
    'coverage.runbook': 'Percentage of assets with runbook/readme documentation',
    'coverage.certified': 'Percentage of assets with certification status',
    'coverage.lineage': 'Percentage of assets with lineage information',
    'coverage.relationships': 'Percentage of assets with relationships (deprecated)',
    'coverage.joinability': 'Percentage of assets with joinability information',
    'coverage.dq_signals': 'Percentage of assets with data quality signals',
    'coverage.retention_policy': 'Percentage of assets with retention policies',
    'coverage.usage_telemetry': 'Percentage of assets with usage data',
    'policy.classified_protected': 'Percentage of classified fields protected by policies',
    'policy.protection': 'Percentage of sensitive data protected',
    'policy.has_classified': 'Percentage of assets with classifications',
    'quality.freshness_sla': 'Percentage of assets meeting freshness SLA',
    'quality.incident_free': 'Percentage of assets with zero incidents',
    'quality.low_volatility': 'Percentage of assets with low schema volatility',
    'coverage.dp_criticality': 'Percentage of data products with criticality defined',
    'coverage.dp_sensitivity': 'Percentage of data products with sensitivity defined',
    'coverage.dp_visibility': 'Percentage of data products with visibility defined',
    'coverage.dp_status': 'Percentage of data products with status defined',
    'coverage.dp_score': 'Percentage of data products with quality score',
  };

  return descriptions[measureId] || `Coverage for ${measureId}`;
}

// ============================================================================
// Signal Type → Evidence Fields Mapping
// ============================================================================

/**
 * Maps signal types to their evidence fields and evaluation logic.
 * Used by the tenant-aware evaluator and signal breakdown generation.
 */
export interface SignalFieldMapping {
  /** Primary evidence field (Tri-state boolean) */
  primaryField: string;
  /** Alternative/fallback fields */
  alternativeFields?: string[];
  /** Raw attribute fields for detailed evaluation */
  rawFields?: string[];
  /** Human-readable signal name */
  displayName: string;
  /** Description of what this signal measures */
  description: string;
}

export const SIGNAL_TO_EVIDENCE_FIELDS: Record<SignalType, SignalFieldMapping> = {
  ownership: {
    primaryField: 'ownerPresent',
    rawFields: ['ownerUsers', 'ownerGroups'],
    displayName: 'Ownership',
    description: 'Assets with assigned owners',
  },
  semantics: {
    primaryField: 'descriptionPresent',
    alternativeFields: ['runbookPresent'],
    rawFields: ['description', 'userDescription', 'readme'],
    displayName: 'Documentation',
    description: 'Assets with descriptions or documentation',
  },
  lineage: {
    primaryField: 'lineagePresent',
    alternativeFields: ['hasUpstream', 'hasDownstream', 'relationshipsPresent'],
    rawFields: ['__hasLineage'],
    displayName: 'Lineage',
    description: 'Assets with lineage information',
  },
  sensitivity: {
    primaryField: 'hasClassifiedFields',
    rawFields: ['classificationNames', 'classifications'],
    displayName: 'Sensitivity',
    description: 'Assets with classification/sensitivity tags',
  },
  access: {
    primaryField: 'classifiedFieldsProtected',
    rawFields: ['assetPoliciesCount'],
    displayName: 'Access Control',
    description: 'Classified assets protected by access policies',
  },
  usage: {
    primaryField: 'usageTelemetryPresent',
    rawFields: ['popularityScore', 'queryCount'],
    displayName: 'Usage',
    description: 'Assets with usage/popularity data',
  },
  freshness: {
    primaryField: 'freshnessSlaPass',
    alternativeFields: ['dqSignalsPresent'],
    rawFields: ['assetSodaDQStatus', 'assetAnomaloDQStatus', 'assetMcIsMonitored'],
    displayName: 'Freshness',
    description: 'Assets with data quality/freshness monitoring',
  },
};

/**
 * Get all evidence fields needed for a signal evaluation
 */
export function getSignalEvidenceFields(signal: SignalType): string[] {
  const mapping = SIGNAL_TO_EVIDENCE_FIELDS[signal];
  const fields = [mapping.primaryField];

  if (mapping.alternativeFields) {
    fields.push(...mapping.alternativeFields);
  }
  if (mapping.rawFields) {
    fields.push(...mapping.rawFields);
  }

  return fields;
}

// ============================================================================
// Atlan Native Field → Canonical Signal Mapping
// ============================================================================

/**
 * Maps Atlan native field names to canonical signal types.
 * Used for tenant configuration and field discovery.
 */
export const ATLAN_FIELD_TO_SIGNAL: Record<string, SignalType> = {
  // Ownership fields
  ownerUsers: 'ownership',
  ownerGroups: 'ownership',

  // Documentation fields
  description: 'semantics',
  userDescription: 'semantics',
  readme: 'semantics',

  // Lineage fields
  __hasLineage: 'lineage',
  inputToProcesses: 'lineage',
  outputFromProcesses: 'lineage',

  // Classification/Sensitivity fields
  classificationNames: 'sensitivity',
  classifications: 'sensitivity',
  atlanTags: 'sensitivity',

  // Policy fields
  assetPoliciesCount: 'access',
  assetPolicyGUIDs: 'access',

  // Usage fields
  popularityScore: 'usage',
  queryCount: 'usage',
  viewerUsers: 'usage',
  viewerGroups: 'usage',

  // Quality/Freshness fields
  assetSodaDQStatus: 'freshness',
  assetAnomaloDQStatus: 'freshness',
  assetMcIsMonitored: 'freshness',
  assetAnomaloCheckCount: 'freshness',

  // Certification
  certificateStatus: 'semantics', // Certification is part of documentation/semantics
};

/**
 * Get all Atlan fields that contribute to a signal
 */
export function getAtlanFieldsForSignal(signal: SignalType): string[] {
  return Object.entries(ATLAN_FIELD_TO_SIGNAL)
    .filter(([_, s]) => s === signal)
    .map(([field, _]) => field);
}

// ============================================================================
// Numeric Field Evaluation
// ============================================================================

/**
 * Fields that should be evaluated as numeric (not boolean)
 */
export const NUMERIC_EVIDENCE_FIELDS = new Set([
  'incidentCount',
  'schemaVolatility30d',
  'popularityScore',
  'queryCount',
  'assetPoliciesCount',
  'assetAnomaloCheckCount',
]);

/**
 * Evaluate a numeric field for measure computation.
 * - incidentCount: 0 = pass (incident-free), >0 = fail
 * - schemaVolatility30d: 0 = pass (low volatility), >0 = fail
 * - Others: >0 = pass (has data), 0 = fail
 */
export function evaluateNumericField(
  fieldName: string,
  value: number | undefined
): boolean | 'UNKNOWN' {
  if (value === undefined) return 'UNKNOWN';

  switch (fieldName) {
    case 'incidentCount':
    case 'schemaVolatility30d':
      // Zero is good for these fields
      return value === 0;

    case 'popularityScore':
    case 'queryCount':
    case 'assetPoliciesCount':
    case 'assetAnomaloCheckCount':
      // Non-zero is good for these fields
      return value > 0;

    default:
      return value > 0;
  }
}
