/**
 * Reconciliation Engine
 *
 * Matches canonical fields from the field catalog to discovered tenant schema.
 * Produces field mappings with confidence scores and status.
 */

import {
  MappingStatus,
  ReconciliationStatus,
  TenantFieldMapping,
  TenantConfig,
  SchemaSnapshot,
  FieldSource,
} from './tenant-config-types';
import { FIELD_ATTRIBUTE_OVERRIDES, FIELD_ALIAS_GROUPS, toAtlanAttributeCandidates } from './atlan-compatibility';
import { fieldCatalog, signalCatalog } from './field-catalog';

// =============================================================================
// Types
// =============================================================================

interface CanonicalField {
  id: string;
  name: string;
  description?: string;
  coreVsRecommended?: string;
  assetTypes?: string[];
}

interface MatchResult {
  source: FieldSource;
  confidence: number;
  reconciliationStatus: ReconciliationStatus;
  reason: string;
}

// =============================================================================
// Canonical Field Extraction
// =============================================================================

/**
 * Extract canonical fields from the field catalog
 */
export function getCanonicalFields(): CanonicalField[] {
  const fields: CanonicalField[] = [];
  const library = (fieldCatalog as Record<string, unknown>).fieldLibrary as Record<string, {
    description?: string;
    coreVsRecommended?: string;
    assetTypes?: string[];
  }> | undefined;

  if (library) {
    for (const [id, def] of Object.entries(library)) {
      fields.push({
        id,
        name: id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        description: def.description,
        coreVsRecommended: def.coreVsRecommended,
        assetTypes: def.assetTypes,
      });
    }
  }

  return fields;
}

// =============================================================================
// Attribute Matching
// =============================================================================

/**
 * Common native attributes that exist on most Atlan assets
 * This list is used to validate camelCase conversions
 */
const COMMON_NATIVE_ATTRIBUTES = [
  // Core identity
  'name', 'displayName', 'qualifiedName', 'description', 'userDescription',
  // Ownership
  'ownerUsers', 'ownerGroups', 'adminUsers', 'adminGroups', 'adminRoles',
  // Access control (viewers)
  'viewerUsers', 'viewerGroups',
  // Governance
  'certificateStatus', 'certificateUpdatedAt', 'certificateUpdatedBy',
  'readme', 'classificationNames', '__classificationNames', 'meanings',
  // Announcements
  'announcementTitle', 'announcementMessage', 'announcementType', 'announcementUpdatedAt', 'announcementUpdatedBy',
  // Timestamps - key Atlan attributes for freshness/auditing
  'sourceCreatedAt', 'sourceUpdatedAt', 'sourceCreatedBy', 'sourceUpdatedBy',
  '__createdBy', '__modifiedBy', '__modificationTimestamp', '__timestamp',
  'createTime', 'updateTime', 'lastSyncRunAt', 'lastSyncRun',
  // Usage and popularity - from HAR indexsearch response
  'popularityScore', 'viewsCount', 'queryCount', 'queryCountUpdatedAt',
  'sourceReadCount', 'sourceReadUserCount', 'sourceLastReadAt', 'sourceReadRecentUserList',
  'starredBy', 'starredCount', // Favorites
  // Policies
  'assetPoliciesCount', 'assetPolicyGUIDs',
  // Domains
  'domainGUIDs', '__domainGUIDs',
  // Lineage
  'inputToProcesses', 'outputFromProcesses', '__hasLineage', 'hasLineage',
  // Data quality
  'dqScore', 'dqScoreUpdatedAt',
  // Badge fields
  'badgeName', 'badgeDescription', 'badgePriority', 'badgeConditions', 'badgeMetadataAttribute',
  // Column-level attributes
  'isPrimary', 'isForeign', 'isNullable', 'isPartition', 'isClustered', 'isSort', 'isDist',
  'dataType', 'subDataType', 'rawDataTypeDefinition', 'precision', 'numericScale',
  'maxLength', 'defaultValue', 'order', 'nestedColumnCount',
  // Profiling
  'isProfiled', 'lastProfiledAt',
  // Products
  'productGUIDs', 'outputProductGUIDs',
];

/**
 * Try to find a native attribute match for a canonical field
 * @param fieldId - The canonical field ID to match
 * @param discoveredAttributes - Optional list of dynamically discovered native attributes from the tenant
 */
function findNativeMatch(fieldId: string, discoveredAttributes?: string[]): MatchResult | null {
  // Combine static and discovered attributes
  const allNativeAttributes = new Set([
    ...COMMON_NATIVE_ATTRIBUTES,
    ...(discoveredAttributes || []),
  ]);

  // Get the override if one exists
  const override = FIELD_ATTRIBUTE_OVERRIDES[fieldId];
  if (override) {
    // Verify the override exists in known attributes (higher confidence if discovered)
    const isDiscovered = discoveredAttributes?.includes(override);
    return {
      source: { type: 'native', attribute: override },
      confidence: isDiscovered ? 1.0 : 1.0, // Always high confidence for explicit overrides
      reconciliationStatus: 'MATCHED',
      reason: isDiscovered
        ? `Direct attribute override (discovered): ${override}`
        : `Direct attribute override: ${override}`,
    };
  }

  // Get alias candidates
  const aliases = FIELD_ALIAS_GROUPS[fieldId];
  if (aliases && aliases.length > 0) {
    // Check which aliases exist in discovered attributes
    const discoveredAliases = aliases.filter(a => discoveredAttributes?.includes(a));

    if (discoveredAliases.length === 1) {
      return {
        source: { type: 'native', attribute: discoveredAliases[0] },
        confidence: 0.98, // Higher confidence because we verified it exists
        reconciliationStatus: 'MATCHED',
        reason: `Alias match (discovered): ${discoveredAliases[0]}`,
      };
    } else if (discoveredAliases.length > 1) {
      return {
        source: { type: 'native_any', attributes: discoveredAliases },
        confidence: 0.95,
        reconciliationStatus: 'ALIAS_MATCHED',
        reason: `Multiple aliases (discovered): ${discoveredAliases.join(', ')}`,
      };
    } else if (aliases.length === 1) {
      // Fall back to static alias
      return {
        source: { type: 'native', attribute: aliases[0] },
        confidence: 0.95,
        reconciliationStatus: 'ALIAS_MATCHED',
        reason: `Alias match: ${aliases[0]}`,
      };
    } else {
      return {
        source: { type: 'native_any', attributes: aliases },
        confidence: 0.9,
        reconciliationStatus: 'ALIAS_MATCHED',
        reason: `Multiple aliases: ${aliases.join(', ')}`,
      };
    }
  }

  // Try camelCase conversion against all known attributes
  const candidates = toAtlanAttributeCandidates(fieldId);
  for (const candidate of candidates) {
    // Check discovered attributes first (higher confidence)
    if (discoveredAttributes?.includes(candidate)) {
      return {
        source: { type: 'native', attribute: candidate },
        confidence: 0.95,
        reconciliationStatus: 'MATCHED',
        reason: `CamelCase match (discovered): ${candidate}`,
      };
    }
    // Fall back to static list
    if (COMMON_NATIVE_ATTRIBUTES.includes(candidate)) {
      return {
        source: { type: 'native', attribute: candidate },
        confidence: 0.85,
        reconciliationStatus: 'MATCHED',
        reason: `CamelCase match: ${candidate}`,
      };
    }
  }

  return null;
}

/**
 * Try to find a custom metadata match for a canonical field
 */
function findCustomMetadataMatch(
  fieldId: string,
  customMetadata: SchemaSnapshot['customMetadata']
): MatchResult | null {
  // Normalize the field ID for comparison
  const normalizedId = fieldId.toLowerCase().replace(/_/g, '');

  for (const cm of customMetadata) {
    for (const attr of cm.attributes) {
      const normalizedAttrName = attr.name.toLowerCase().replace(/_/g, '');
      const normalizedDisplayName = attr.displayName.toLowerCase().replace(/_/g, '');

      // Check for exact match
      if (normalizedAttrName === normalizedId || normalizedDisplayName === normalizedId) {
        return {
          source: {
            type: 'custom_metadata',
            businessAttribute: cm.name,
            attribute: attr.name,
          },
          confidence: 0.9,
          reconciliationStatus: 'CM_MATCHED',
          reason: `Custom metadata match: ${cm.displayName}.${attr.displayName}`,
        };
      }

      // Check for partial match (contains)
      if (normalizedAttrName.includes(normalizedId) || normalizedId.includes(normalizedAttrName)) {
        return {
          source: {
            type: 'custom_metadata',
            businessAttribute: cm.name,
            attribute: attr.name,
          },
          confidence: 0.6,
          reconciliationStatus: 'CM_SUGGESTED',
          reason: `Possible custom metadata match: ${cm.displayName}.${attr.displayName}`,
        };
      }
    }
  }

  return null;
}

/**
 * Try to find a classification match for a canonical field
 *
 * Note: In Atlan, classification names are stored as hashed strings internally.
 * The `tag` field contains the hashed name (for API queries), and `displayName`
 * contains the human-readable name (for UI display).
 */
function findClassificationMatch(
  fieldId: string,
  classifications: SchemaSnapshot['classifications']
): MatchResult | null {
  // Fields that map well to classifications
  const classificationFields = [
    'pii_flag', 'pii_type', 'sensitivity_classification',
    'regulatory_scope', 'data_subject_category', 'tags',
  ];

  if (!classificationFields.includes(fieldId)) {
    return null;
  }

  const normalizedId = fieldId.toLowerCase().replace(/_/g, '');

  for (const classification of classifications) {
    // Note: classification.name is the hashed string, displayName is human-readable
    const normalizedDisplay = classification.displayName.toLowerCase().replace(/_/g, '');

    if (normalizedDisplay.includes('pii') || normalizedDisplay.includes('sensitive')) {
      if (fieldId.includes('pii') || fieldId.includes('sensitive')) {
        return {
          source: {
            type: 'classification',
            tag: classification.name,           // Hashed name for API queries
            displayName: classification.displayName, // Human-readable for UI
            pattern: classification.displayName,     // Use display name for pattern matching
          },
          confidence: 0.75,
          reconciliationStatus: 'CLASSIFICATION',
          reason: `Classification match: ${classification.displayName} (${classification.name.substring(0, 8)}...)`,
        };
      }
    }

    // Also match regulatory/compliance-related classifications
    if (normalizedDisplay.includes('gdpr') || normalizedDisplay.includes('hipaa') ||
        normalizedDisplay.includes('pci') || normalizedDisplay.includes('sox')) {
      if (fieldId.includes('regulatory') || fieldId.includes('compliance')) {
        return {
          source: {
            type: 'classification',
            tag: classification.name,
            displayName: classification.displayName,
            pattern: classification.displayName,
          },
          confidence: 0.7,
          reconciliationStatus: 'CLASSIFICATION',
          reason: `Regulatory classification: ${classification.displayName}`,
        };
      }
    }
  }

  return null;
}

// =============================================================================
// Reconciliation
// =============================================================================

/**
 * Reconcile a single canonical field against the tenant schema
 */
export function reconcileField(
  field: CanonicalField,
  schema: SchemaSnapshot
): TenantFieldMapping {
  // Try native match first, using discovered attributes if available
  const nativeMatch = findNativeMatch(field.id, schema.nativeAttributes);
  if (nativeMatch) {
    const status: MappingStatus = nativeMatch.confidence >= 0.9 ? 'auto' : 'pending';
    return {
      canonicalFieldId: field.id,
      canonicalFieldName: field.name,
      tenantSource: nativeMatch.source,
      status,
      reconciliationStatus: nativeMatch.reconciliationStatus,
      confidence: nativeMatch.confidence,
      notes: nativeMatch.reason,
    };
  }

  // Try custom metadata match
  const cmMatch = findCustomMetadataMatch(field.id, schema.customMetadata);
  if (cmMatch) {
    const status: MappingStatus = cmMatch.confidence >= 0.8 ? 'auto' : 'pending';
    return {
      canonicalFieldId: field.id,
      canonicalFieldName: field.name,
      tenantSource: cmMatch.source,
      status,
      reconciliationStatus: cmMatch.reconciliationStatus,
      confidence: cmMatch.confidence,
      notes: cmMatch.reason,
    };
  }

  // Try classification match
  const classMatch = findClassificationMatch(field.id, schema.classifications);
  if (classMatch) {
    return {
      canonicalFieldId: field.id,
      canonicalFieldName: field.name,
      tenantSource: classMatch.source,
      status: 'pending',
      reconciliationStatus: classMatch.reconciliationStatus,
      confidence: classMatch.confidence,
      notes: classMatch.reason,
    };
  }

  // No match found
  return {
    canonicalFieldId: field.id,
    canonicalFieldName: field.name,
    tenantSource: undefined,
    status: 'pending',
    reconciliationStatus: 'NOT_FOUND',
    confidence: 0,
    notes: 'No automatic mapping found. Manual configuration required.',
  };
}

/**
 * Reconcile all canonical fields against the tenant schema
 */
export function reconcileSchema(schema: SchemaSnapshot): TenantFieldMapping[] {
  const canonicalFields = getCanonicalFields();
  return canonicalFields.map(field => reconcileField(field, schema));
}

/**
 * Create initial tenant configuration from schema discovery
 */
export function createInitialConfig(
  tenantId: string,
  baseUrl: string,
  schema: SchemaSnapshot
): TenantConfig {
  const now = new Date().toISOString();
  const fieldMappings = reconcileSchema(schema);

  return {
    tenantId,
    baseUrl,
    version: 1,
    createdAt: now,
    updatedAt: now,
    fieldMappings,
    customFields: [],
    classificationMappings: [],
    excludedFields: [],
    lastSnapshotAt: schema.discoveredAt,
  };
}

// =============================================================================
// Field Recommendations
// =============================================================================

interface FieldRecommendation {
  sourceType: 'custom_metadata' | 'classification';
  sourcePath: string;
  displayName: string;
  description?: string;
  suggestedSignal?: string;
  confidence: number;
  reason: string;
}

/**
 * Generate recommendations for tenant-specific fields that could enhance signals
 */
export function generateFieldRecommendations(
  schema: SchemaSnapshot,
  existingMappings: TenantFieldMapping[]
): FieldRecommendation[] {
  const recommendations: FieldRecommendation[] = [];
  const usedSources = new Set(
    existingMappings
      .filter(m => m.tenantSource)
      .map(m => {
        const src = m.tenantSource!;
        if (src.type === 'custom_metadata') {
          return `cm.${src.businessAttribute}.${src.attribute}`;
        }
        if (src.type === 'classification') {
          return `tag.${src.pattern || src.tag}`;
        }
        return `${src.type}.${src.attribute || ''}`;
      })
  );

  // Check custom metadata for potential enhancements
  for (const cm of schema.customMetadata) {
    for (const attr of cm.attributes) {
      const sourcePath = `cm.${cm.name}.${attr.name}`;

      // Skip if already mapped
      if (usedSources.has(sourcePath)) continue;

      // Detect potential signal contributions based on naming
      const nameLC = attr.name.toLowerCase();
      const displayLC = attr.displayName.toLowerCase();

      let suggestedSignal: string | undefined;
      let confidence = 0.5;

      if (nameLC.includes('owner') || nameLC.includes('steward')) {
        suggestedSignal = 'OWNERSHIP';
        confidence = 0.8;
      } else if (nameLC.includes('pii') || nameLC.includes('sensitive') || nameLC.includes('confidential')) {
        suggestedSignal = 'SENSITIVITY';
        confidence = 0.8;
      } else if (nameLC.includes('quality') || nameLC.includes('dq') || nameLC.includes('score')) {
        suggestedSignal = 'QUALITY';
        confidence = 0.7;
      } else if (nameLC.includes('fresh') || nameLC.includes('stale') || nameLC.includes('sla')) {
        suggestedSignal = 'FRESHNESS';
        confidence = 0.7;
      } else if (nameLC.includes('trust') || nameLC.includes('certif')) {
        suggestedSignal = 'TRUST';
        confidence = 0.7;
      } else if (nameLC.includes('description') || nameLC.includes('definition')) {
        suggestedSignal = 'SEMANTICS';
        confidence = 0.6;
      }

      if (suggestedSignal) {
        recommendations.push({
          sourceType: 'custom_metadata',
          sourcePath,
          displayName: `${cm.displayName} → ${attr.displayName}`,
          suggestedSignal,
          confidence,
          reason: `Field name suggests contribution to ${suggestedSignal} signal`,
        });
      }
    }
  }

  // Check classifications for potential enhancements
  for (const classification of schema.classifications) {
    const sourcePath = `tag.${classification.name}`;

    if (usedSources.has(sourcePath)) continue;

    const nameLC = classification.name.toLowerCase();
    const displayLC = classification.displayName.toLowerCase();

    let suggestedSignal: string | undefined;
    let confidence = 0.5;

    if (nameLC.includes('pii') || nameLC.includes('sensitive') || nameLC.includes('confidential')) {
      suggestedSignal = 'SENSITIVITY';
      confidence = 0.85;
    } else if (nameLC.includes('certified') || nameLC.includes('trusted') || nameLC.includes('verified')) {
      suggestedSignal = 'TRUST';
      confidence = 0.8;
    } else if (nameLC.includes('deprecated') || nameLC.includes('archived')) {
      suggestedSignal = 'TRUST';
      confidence = 0.6;
    }

    if (suggestedSignal) {
      recommendations.push({
        sourceType: 'classification',
        sourcePath,
        displayName: classification.displayName,
        description: classification.description,
        suggestedSignal,
        confidence,
        reason: `Classification suggests contribution to ${suggestedSignal} signal`,
      });
    }
  }

  // Sort by confidence
  return recommendations.sort((a, b) => b.confidence - a.confidence);
}

export type { CanonicalField, MatchResult, FieldRecommendation };
