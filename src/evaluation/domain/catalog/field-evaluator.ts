/**
 * Field Evaluator
 *
 * Evaluates field presence on assets based on the unified field catalog.
 * Handles all source types: native, custom_metadata, classification, relationship, derived.
 */

import type {
  UnifiedField,
  FieldSource,
  TriState,
  TenantFieldConfiguration,
  TenantFieldMapping,
} from './types';
import { UNIFIED_FIELD_CATALOG, getFieldById } from './unified-fields';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Result of evaluating a field on an asset
 */
export interface FieldEvaluationResult {
  fieldId: string;
  present: TriState;
  value?: unknown;
  source?: string;  // Which attribute/path provided the value
}

/**
 * Asset data structure for evaluation
 * This is a generic object representing an Atlan asset's attributes
 */
export type AssetData = Record<string, unknown>;

/**
 * Evaluation context including tenant configuration
 */
export interface EvaluationContext {
  tenantConfig?: TenantFieldConfiguration;
  assetType?: string;
}

// =============================================================================
// CORE EVALUATION FUNCTIONS
// =============================================================================

/**
 * Check if a value is "present" (non-null, non-empty)
 */
export function isValuePresent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return !isNaN(value);
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

/**
 * Evaluate a native source (single attribute)
 */
function evaluateNativeSource(
  source: { type: 'native'; attribute: string },
  asset: AssetData
): { present: TriState; value?: unknown; source?: string } {
  const value = asset[source.attribute];
  if (value === undefined) {
    return { present: 'UNKNOWN' };
  }
  return {
    present: isValuePresent(value),
    value,
    source: source.attribute,
  };
}

/**
 * Evaluate a native_any source (multiple attributes, ANY match)
 */
function evaluateNativeAnySource(
  source: { type: 'native_any'; attributes: string[] },
  asset: AssetData
): { present: TriState; value?: unknown; source?: string } {
  let foundValue: unknown = undefined;
  let foundSource: string | undefined = undefined;
  let allUnknown = true;

  for (const attr of source.attributes) {
    const value = asset[attr];
    if (value !== undefined) {
      allUnknown = false;
      if (isValuePresent(value)) {
        foundValue = value;
        foundSource = attr;
        break;
      }
    }
  }

  if (foundValue !== undefined) {
    return { present: true, value: foundValue, source: foundSource };
  }
  if (allUnknown) {
    return { present: 'UNKNOWN' };
  }
  return { present: false };
}

/**
 * Evaluate a custom metadata source
 */
function evaluateCustomMetadataSource(
  source: { type: 'custom_metadata'; businessAttribute: string; attribute: string },
  asset: AssetData
): { present: TriState; value?: unknown; source?: string } {
  // Custom metadata is stored in businessAttributes
  const businessAttributes = asset['businessAttributes'] as Record<string, Record<string, unknown>> | undefined;
  if (!businessAttributes) {
    return { present: 'UNKNOWN' };
  }

  const cmGroup = businessAttributes[source.businessAttribute];
  if (!cmGroup) {
    return { present: 'UNKNOWN' };
  }

  const value = cmGroup[source.attribute];
  if (value === undefined) {
    return { present: 'UNKNOWN' };
  }

  return {
    present: isValuePresent(value),
    value,
    source: `businessAttributes.${source.businessAttribute}.${source.attribute}`,
  };
}

/**
 * Evaluate a classification source
 */
function evaluateClassificationSource(
  source: { type: 'classification'; pattern?: string; anyOf?: string[] },
  asset: AssetData
): { present: TriState; value?: unknown; source?: string } {
  // Classifications can be in classificationNames or classifications
  const classificationNames = asset['classificationNames'] as string[] | undefined;
  const classifications = asset['classifications'] as Array<{ typeName: string }> | undefined;

  let names: string[] = [];
  if (classificationNames && Array.isArray(classificationNames)) {
    names = [...classificationNames];
  }
  if (classifications && Array.isArray(classifications)) {
    names.push(...classifications.map(c => c.typeName).filter(Boolean));
  }

  if (names.length === 0) {
    // Check if we have access to classification data
    if (classificationNames === undefined && classifications === undefined) {
      return { present: 'UNKNOWN' };
    }
    return { present: false };
  }

  // Check pattern match
  if (source.pattern) {
    const regex = new RegExp(source.pattern);
    const matched = names.find(n => regex.test(n));
    if (matched) {
      return { present: true, value: matched, source: 'classificationNames' };
    }
    return { present: false };
  }

  // Check anyOf match
  if (source.anyOf && source.anyOf.length > 0) {
    const matched = names.find(n => source.anyOf!.includes(n));
    if (matched) {
      return { present: true, value: matched, source: 'classificationNames' };
    }
    return { present: false };
  }

  // No filter specified - any classification counts
  return { present: true, value: names, source: 'classificationNames' };
}

/**
 * Evaluate a relationship source
 */
function evaluateRelationshipSource(
  source: { type: 'relationship'; relation: string; direction?: string; countThreshold?: number },
  asset: AssetData
): { present: TriState; value?: unknown; source?: string } {
  // Relationships can be in relationshipAttributes or directly on the asset
  const relationshipAttributes = asset['relationshipAttributes'] as Record<string, unknown> | undefined;

  let value = asset[source.relation];
  if (value === undefined && relationshipAttributes) {
    value = relationshipAttributes[source.relation];
  }

  if (value === undefined) {
    return { present: 'UNKNOWN' };
  }

  // Check count threshold
  const threshold = source.countThreshold ?? 1;
  if (Array.isArray(value)) {
    return {
      present: value.length >= threshold,
      value: value.length,
      source: source.relation,
    };
  }

  return {
    present: isValuePresent(value),
    value,
    source: source.relation,
  };
}

/**
 * Evaluate a derived source
 */
function evaluateDerivedSource(
  source: { type: 'derived'; derivation: string },
  asset: AssetData,
  fieldId: string
): { present: TriState; value?: unknown; source?: string } {
  // Handle known derived fields
  switch (fieldId) {
    case 'mc_incident_count': {
      const incidents = asset['assetMcIncidentQualifiedNames'] as string[] | undefined;
      if (incidents === undefined) {
        return { present: 'UNKNOWN' };
      }
      const count = incidents.length;
      // For incident count, "present" means NO incidents (incident-free)
      return { present: count === 0, value: count, source: 'assetMcIncidentQualifiedNames' };
    }
    default:
      // Unknown derived field - return UNKNOWN
      return { present: 'UNKNOWN' };
  }
}

/**
 * Evaluate a field source on an asset
 */
export function evaluateSource(
  source: FieldSource,
  asset: AssetData,
  fieldId: string
): { present: TriState; value?: unknown; source?: string } {
  switch (source.type) {
    case 'native':
      return evaluateNativeSource(source, asset);
    case 'native_any':
      return evaluateNativeAnySource(source, asset);
    case 'custom_metadata':
      return evaluateCustomMetadataSource(source, asset);
    case 'classification':
      return evaluateClassificationSource(source, asset);
    case 'relationship':
      return evaluateRelationshipSource(source, asset);
    case 'derived':
      return evaluateDerivedSource(source, asset, fieldId);
    default:
      return { present: 'UNKNOWN' };
  }
}

// =============================================================================
// HIGH-LEVEL EVALUATION FUNCTIONS
// =============================================================================

/**
 * Evaluate a single field on an asset
 */
export function evaluateField(
  field: UnifiedField,
  asset: AssetData,
  context?: EvaluationContext
): FieldEvaluationResult {
  // Check if field is supported for this asset type
  if (context?.assetType &&
      !field.supportedAssetTypes.includes('*') &&
      !field.supportedAssetTypes.includes(context.assetType)) {
    return { fieldId: field.id, present: 'UNKNOWN' };
  }

  // Check for tenant-specific mapping override
  if (context?.tenantConfig) {
    const mapping = context.tenantConfig.fieldMappings.find(
      m => m.canonicalField === field.id && m.status !== 'rejected'
    );
    if (mapping) {
      const result = evaluateSource(mapping.tenantSource, asset, field.id);
      return { fieldId: field.id, ...result };
    }
  }

  // Use default source from catalog
  const result = evaluateSource(field.source, asset, field.id);
  return { fieldId: field.id, ...result };
}

/**
 * Evaluate a field by ID
 */
export function evaluateFieldById(
  fieldId: string,
  asset: AssetData,
  context?: EvaluationContext
): FieldEvaluationResult {
  const field = getFieldById(fieldId);
  if (!field) {
    return { fieldId, present: 'UNKNOWN' };
  }
  return evaluateField(field, asset, context);
}

/**
 * Evaluate multiple fields on an asset
 */
export function evaluateFields(
  fields: UnifiedField[],
  asset: AssetData,
  context?: EvaluationContext
): FieldEvaluationResult[] {
  return fields.map(field => evaluateField(field, asset, context));
}

/**
 * Evaluate all catalog fields on an asset
 */
export function evaluateAllFields(
  asset: AssetData,
  context?: EvaluationContext
): FieldEvaluationResult[] {
  return evaluateFields(UNIFIED_FIELD_CATALOG, asset, context);
}

/**
 * Evaluate fields for a specific asset type
 */
export function evaluateFieldsForAssetType(
  asset: AssetData,
  assetType: string,
  context?: EvaluationContext
): FieldEvaluationResult[] {
  const ctx = { ...context, assetType };
  const applicableFields = UNIFIED_FIELD_CATALOG.filter(f =>
    f.supportedAssetTypes.includes('*') || f.supportedAssetTypes.includes(assetType)
  );
  return evaluateFields(applicableFields, asset, ctx);
}

// =============================================================================
// BATCH EVALUATION UTILITIES
// =============================================================================

/**
 * Result of evaluating an asset
 */
export interface AssetEvaluationResult {
  assetId: string;
  assetType?: string;
  fields: FieldEvaluationResult[];
}

/**
 * Evaluate fields on multiple assets
 */
export function evaluateAssets(
  assets: Array<{ id: string; type?: string; data: AssetData }>,
  fields?: UnifiedField[],
  context?: EvaluationContext
): AssetEvaluationResult[] {
  const fieldsToEvaluate = fields ?? UNIFIED_FIELD_CATALOG;

  return assets.map(asset => ({
    assetId: asset.id,
    assetType: asset.type,
    fields: evaluateFields(fieldsToEvaluate, asset.data, {
      ...context,
      assetType: asset.type,
    }),
  }));
}

/**
 * Aggregate field presence across multiple assets
 */
export function aggregateFieldPresence(
  results: AssetEvaluationResult[]
): Record<string, { present: number; absent: number; unknown: number }> {
  const aggregation: Record<string, { present: number; absent: number; unknown: number }> = {};

  for (const result of results) {
    for (const field of result.fields) {
      if (!aggregation[field.fieldId]) {
        aggregation[field.fieldId] = { present: 0, absent: 0, unknown: 0 };
      }
      if (field.present === true) {
        aggregation[field.fieldId].present++;
      } else if (field.present === false) {
        aggregation[field.fieldId].absent++;
      } else {
        aggregation[field.fieldId].unknown++;
      }
    }
  }

  return aggregation;
}

/**
 * Calculate field coverage rates
 */
export function calculateFieldCoverage(
  results: AssetEvaluationResult[]
): Record<string, number> {
  const aggregation = aggregateFieldPresence(results);
  const coverage: Record<string, number> = {};

  for (const [fieldId, counts] of Object.entries(aggregation)) {
    const total = counts.present + counts.absent;
    coverage[fieldId] = total > 0 ? counts.present / total : 0;
  }

  return coverage;
}
