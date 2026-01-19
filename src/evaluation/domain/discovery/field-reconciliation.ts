/**
 * Field Reconciliation Engine
 *
 * Maps canonical fields from the unified catalog to tenant-specific
 * Atlan attributes, custom metadata, and classifications.
 */

import type {
  TenantSchemaSnapshot,
  FieldReconciliationResult,
  ReconciliationReport,
  FieldMatch,
  ReconciliationStatus,
  ReconciliationOptions,
} from './types';
import type { UnifiedField, FieldSource } from '../catalog/types';
import { UNIFIED_FIELD_CATALOG, getActiveFields } from '../catalog/unified-fields';
import {
  attributeExistsInSchema,
  findCustomMetadataWithAttribute,
  getPopulationRate,
} from './tenant-discovery';

// =============================================================================
// ALIAS MAPPINGS
// =============================================================================

/**
 * Common alias transformations (snake_case → camelCase, etc.)
 */
const ALIAS_TRANSFORMATIONS: Record<string, string[]> = {
  owner_users: ['ownerUsers', 'owners', 'owner'],
  owner_groups: ['ownerGroups', 'ownerTeams', 'teams'],
  description: ['description', 'userDescription', 'assetDescription'],
  readme: ['readme', 'documentation', 'readme_content'],
  certificate_status: ['certificateStatus', 'certification', 'certStatus'],
  classifications: ['classificationNames', 'classifications', 'tags', 'atlanTags'],
  has_lineage: ['__hasLineage', 'hasLineage', 'lineagePresent'],
  policy_count: ['assetPoliciesCount', 'policyCount', 'policiesCount'],
  popularity_score: ['popularityScore', 'popularity', 'usageScore'],
  query_count: ['queryCount', 'queries', 'queryTotal'],
  domain_guids: ['domainGUIDs', '__domainGUIDs', 'domains'],
  glossary_terms: ['meanings', 'glossaryTerms', 'assignedTerms', 'terms'],
};

/**
 * Transform a canonical field name to potential Atlan attribute names
 */
function getAttributeCandidates(fieldId: string): string[] {
  const candidates = new Set<string>();

  // Check explicit aliases
  if (ALIAS_TRANSFORMATIONS[fieldId]) {
    ALIAS_TRANSFORMATIONS[fieldId].forEach(a => candidates.add(a));
  }

  // Snake case → camelCase
  const camelCase = fieldId.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
  candidates.add(camelCase);

  // Original
  candidates.add(fieldId);

  // Without underscores
  candidates.add(fieldId.replace(/_/g, ''));

  return Array.from(candidates);
}

// =============================================================================
// MATCHING FUNCTIONS
// =============================================================================

/**
 * Try to match a field via native attributes
 */
function matchNativeAttribute(
  field: UnifiedField,
  snapshot: TenantSchemaSnapshot
): FieldMatch | undefined {
  const candidates = getAttributeCandidates(field.id);

  for (const candidate of candidates) {
    if (attributeExistsInSchema(snapshot, candidate)) {
      const populationRate = getPopulationRate(snapshot, candidate);

      return {
        type: 'attribute',
        path: candidate,
        confidence: candidate === field.id ? 1.0 : 0.9,
        populationRate,
        reason: candidate === field.id
          ? 'Exact attribute match'
          : `Alias match: ${field.id} → ${candidate}`,
      };
    }
  }

  return undefined;
}

/**
 * Try to match a field via custom metadata
 */
function matchCustomMetadata(
  field: UnifiedField,
  snapshot: TenantSchemaSnapshot
): FieldMatch | undefined {
  // Check if field source is CM
  if (field.source.type === 'custom_metadata') {
    const cmSource = field.source;
    const cmDef = snapshot.customMetadata[cmSource.businessAttribute];

    if (cmDef) {
      const attr = cmDef.attributes.find(a =>
        a.name === cmSource.attribute ||
        a.name.toLowerCase() === cmSource.attribute.toLowerCase()
      );

      if (attr) {
        return {
          type: 'custom_metadata',
          path: `cm.${cmSource.businessAttribute}.${attr.name}`,
          displayName: `${cmDef.displayName} → ${attr.displayName}`,
          confidence: 1.0,
          reason: 'Exact custom metadata match',
        };
      }
    }
  }

  // Try fuzzy matching by field name
  const fieldNameLower = field.id.toLowerCase().replace(/_/g, '');
  const displayNameLower = field.displayName.toLowerCase().replace(/\s/g, '');

  for (const [cmName, cmDef] of Object.entries(snapshot.customMetadata)) {
    for (const attr of cmDef.attributes) {
      const attrNameLower = attr.name.toLowerCase();
      const attrDisplayLower = attr.displayName.toLowerCase().replace(/\s/g, '');

      // Check for name similarity
      if (attrNameLower.includes(fieldNameLower) ||
          fieldNameLower.includes(attrNameLower) ||
          attrDisplayLower.includes(displayNameLower) ||
          displayNameLower.includes(attrDisplayLower)) {
        return {
          type: 'custom_metadata',
          path: `cm.${cmName}.${attr.name}`,
          displayName: `${cmDef.displayName} → ${attr.displayName}`,
          confidence: 0.7,
          reason: `Fuzzy match: ${field.displayName} ≈ ${attr.displayName}`,
        };
      }
    }
  }

  return undefined;
}

/**
 * Try to match a field via classifications
 */
function matchClassification(
  field: UnifiedField,
  snapshot: TenantSchemaSnapshot
): FieldMatch | undefined {
  // Check if field source is classification
  if (field.source.type === 'classification') {
    const classSource = field.source;

    // Check pattern match
    if (classSource.pattern) {
      const regex = new RegExp(classSource.pattern, 'i');
      const matching = snapshot.classifications.filter(c => regex.test(c.name));

      if (matching.length > 0) {
        return {
          type: 'classification',
          path: `classification:${classSource.pattern}`,
          displayName: matching.map(c => c.displayName).join(', '),
          confidence: 0.9,
          reason: `Pattern match: ${matching.length} classification(s)`,
        };
      }
    }

    // Check anyOf match
    if (classSource.anyOf && classSource.anyOf.length > 0) {
      const matching = snapshot.classifications.filter(c =>
        classSource.anyOf!.some(name =>
          c.name.toLowerCase() === name.toLowerCase()
        )
      );

      if (matching.length > 0) {
        return {
          type: 'classification',
          path: `classification:anyOf(${classSource.anyOf.join(',')})`,
          displayName: matching.map(c => c.displayName).join(', '),
          confidence: 1.0,
          reason: `Exact classification match: ${matching.length} found`,
        };
      }
    }
  }

  // Try matching by field name for sensitivity-related fields
  if (field.category === 'classification' || field.id.includes('pii') || field.id.includes('phi')) {
    const fieldNameLower = field.id.toLowerCase();

    for (const classification of snapshot.classifications) {
      const classNameLower = classification.name.toLowerCase();
      if (classNameLower.includes(fieldNameLower) || fieldNameLower.includes(classNameLower)) {
        return {
          type: 'classification',
          path: `classification:${classification.name}`,
          displayName: classification.displayName,
          confidence: 0.6,
          reason: `Inferred classification: ${classification.displayName}`,
        };
      }
    }
  }

  return undefined;
}

/**
 * Try to match a field via relationships
 */
function matchRelationship(
  field: UnifiedField,
  snapshot: TenantSchemaSnapshot
): FieldMatch | undefined {
  if (field.source.type !== 'relationship') return undefined;

  const relSource = field.source;

  // Check if relationship exists in any entity type
  for (const entityType of Object.values(snapshot.entityTypes)) {
    if (entityType.relationshipAttributes.includes(relSource.relation)) {
      return {
        type: 'relationship',
        path: relSource.relation,
        confidence: 1.0,
        reason: 'Exact relationship match',
      };
    }
  }

  // Try alias candidates
  const candidates = getAttributeCandidates(relSource.relation);
  for (const candidate of candidates) {
    for (const entityType of Object.values(snapshot.entityTypes)) {
      if (entityType.relationshipAttributes.includes(candidate)) {
        return {
          type: 'relationship',
          path: candidate,
          confidence: 0.9,
          reason: `Alias match: ${relSource.relation} → ${candidate}`,
        };
      }
    }
  }

  return undefined;
}

// =============================================================================
// RECONCILIATION ENGINE
// =============================================================================

/**
 * Reconcile a single field against the tenant schema
 */
export function reconcileField(
  field: UnifiedField,
  snapshot: TenantSchemaSnapshot,
  options?: ReconciliationOptions
): FieldReconciliationResult {
  const matches: FieldMatch[] = [];

  // Try different matching strategies in order of preference
  const nativeMatch = matchNativeAttribute(field, snapshot);
  if (nativeMatch) matches.push(nativeMatch);

  const cmMatch = matchCustomMetadata(field, snapshot);
  if (cmMatch) matches.push(cmMatch);

  const classMatch = matchClassification(field, snapshot);
  if (classMatch) matches.push(classMatch);

  const relMatch = matchRelationship(field, snapshot);
  if (relMatch) matches.push(relMatch);

  // Determine status and best match
  if (matches.length === 0) {
    return {
      canonicalFieldId: field.id,
      canonicalFieldName: field.displayName,
      status: 'NOT_FOUND',
      suggestions: generateSuggestions(field, snapshot),
    };
  }

  // Sort by confidence
  matches.sort((a, b) => b.confidence - a.confidence);
  const bestMatch = matches[0];

  // Determine status based on match type and confidence
  let status: ReconciliationStatus;
  if (bestMatch.confidence >= 1.0) {
    status = bestMatch.type === 'attribute' ? 'MATCHED' :
             bestMatch.type === 'custom_metadata' ? 'CM_MATCHED' :
             'MATCHED';
  } else if (bestMatch.confidence >= 0.8) {
    status = 'ALIAS_MATCHED';
  } else if (bestMatch.confidence >= 0.5) {
    status = bestMatch.type === 'custom_metadata' ? 'CM_SUGGESTED' : 'AMBIGUOUS';
  } else {
    status = 'AMBIGUOUS';
  }

  // If multiple high-confidence matches, mark as ambiguous
  if (matches.filter(m => m.confidence >= 0.8).length > 1) {
    status = 'AMBIGUOUS';
  }

  return {
    canonicalFieldId: field.id,
    canonicalFieldName: field.displayName,
    status,
    match: bestMatch,
    alternatives: matches.slice(1),
  };
}

/**
 * Generate suggestions for fields that couldn't be matched
 */
function generateSuggestions(
  field: UnifiedField,
  snapshot: TenantSchemaSnapshot
): FieldReconciliationResult['suggestions'] {
  const suggestions: FieldReconciliationResult['suggestions'] = [];

  // Suggest creating custom metadata
  if (field.category === 'custom' || field.source.type === 'custom_metadata') {
    const cmSource = field.source.type === 'custom_metadata' ? field.source : null;
    suggestions.push({
      action: 'create_cm',
      description: `Create custom metadata attribute "${field.displayName}"`,
      template: {
        businessAttribute: cmSource?.businessAttribute || 'DataGovernance',
        attribute: cmSource?.attribute || field.id.replace(/_/g, ''),
        type: 'string',
      },
    });
  }

  // Suggest mapping to existing similar fields
  const similarAttrs = findSimilarAttributes(field.id, snapshot);
  if (similarAttrs.length > 0) {
    suggestions.push({
      action: 'map_to_existing',
      description: `Map to existing attribute: ${similarAttrs.slice(0, 3).join(', ')}`,
    });
  }

  // Suggest using classification if sensitivity-related
  if (field.category === 'classification' || field.contributesToSignals.some(c => c.signal === 'SENSITIVITY')) {
    suggestions.push({
      action: 'use_classification',
      description: 'Use classification tags for this field',
    });
  }

  // Default: skip
  suggestions.push({
    action: 'skip',
    description: 'Skip this field (exclude from assessment)',
  });

  return suggestions;
}

/**
 * Find attributes with similar names
 */
function findSimilarAttributes(
  fieldName: string,
  snapshot: TenantSchemaSnapshot
): string[] {
  const fieldNameLower = fieldName.toLowerCase().replace(/_/g, '');
  const similar: string[] = [];

  for (const entityType of Object.values(snapshot.entityTypes)) {
    for (const attr of [...entityType.attributes, ...entityType.relationshipAttributes]) {
      const attrLower = attr.toLowerCase();
      if (attrLower.includes(fieldNameLower) || fieldNameLower.includes(attrLower)) {
        if (!similar.includes(attr)) {
          similar.push(attr);
        }
      }
    }
  }

  return similar;
}

// =============================================================================
// FULL RECONCILIATION
// =============================================================================

/**
 * Reconcile all catalog fields against tenant schema
 */
export function reconcileAllFields(
  snapshot: TenantSchemaSnapshot,
  options?: ReconciliationOptions
): ReconciliationReport {
  const fields = options?.includeExperimental
    ? UNIFIED_FIELD_CATALOG
    : getActiveFields();

  const filteredFields = options?.skipDeprecated
    ? fields.filter(f => f.status !== 'deprecated')
    : fields;

  const results = filteredFields.map(field =>
    reconcileField(field, snapshot, options)
  );

  // Calculate summary
  const summary = {
    total: results.length,
    matched: results.filter(r => r.status === 'MATCHED').length,
    aliasMatched: results.filter(r => r.status === 'ALIAS_MATCHED').length,
    cmMatched: results.filter(r => r.status === 'CM_MATCHED').length,
    suggested: results.filter(r => r.status === 'CM_SUGGESTED').length,
    notFound: results.filter(r => r.status === 'NOT_FOUND').length,
    ambiguous: results.filter(r => r.status === 'AMBIGUOUS').length,
  };

  // Calculate reconciliation score
  const reconciledCount = summary.matched + summary.aliasMatched + summary.cmMatched;
  const reconciliationScore = summary.total > 0 ? reconciledCount / summary.total : 0;

  return {
    tenantId: snapshot.tenantId,
    generatedAt: new Date().toISOString(),
    summary,
    results,
    reconciliationScore,
  };
}

/**
 * Get fields that need user confirmation
 */
export function getFieldsNeedingConfirmation(
  report: ReconciliationReport
): FieldReconciliationResult[] {
  return report.results.filter(r =>
    r.status === 'CM_SUGGESTED' ||
    r.status === 'AMBIGUOUS' ||
    (r.match && r.match.confidence < 1.0)
  );
}

/**
 * Get fields that are fully matched
 */
export function getMatchedFields(
  report: ReconciliationReport
): FieldReconciliationResult[] {
  return report.results.filter(r =>
    r.status === 'MATCHED' ||
    r.status === 'ALIAS_MATCHED' ||
    r.status === 'CM_MATCHED'
  );
}

/**
 * Get fields that couldn't be matched
 */
export function getUnmatchedFields(
  report: ReconciliationReport
): FieldReconciliationResult[] {
  return report.results.filter(r => r.status === 'NOT_FOUND');
}

/**
 * Convert reconciliation result to a tenant field mapping
 */
export function toFieldMapping(
  result: FieldReconciliationResult
): FieldSource | undefined {
  if (!result.match) return undefined;

  switch (result.match.type) {
    case 'attribute':
      return { type: 'native', attribute: result.match.path };

    case 'custom_metadata': {
      // Parse path: cm.BusinessAttribute.attribute
      const parts = result.match.path.replace('cm.', '').split('.');
      if (parts.length >= 2) {
        return {
          type: 'custom_metadata',
          businessAttribute: parts[0],
          attribute: parts[1],
        };
      }
      return undefined;
    }

    case 'classification': {
      // Parse path: classification:pattern or classification:anyOf(...)
      const path = result.match.path.replace('classification:', '');
      if (path.startsWith('anyOf(')) {
        const values = path.replace('anyOf(', '').replace(')', '').split(',');
        return { type: 'classification', anyOf: values };
      }
      return { type: 'classification', pattern: path };
    }

    case 'relationship':
      return { type: 'relationship', relation: result.match.path };

    default:
      return undefined;
  }
}
