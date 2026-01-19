/**
 * Tenant Configuration Storage
 *
 * Manages persistence and retrieval of tenant-specific field mappings
 * and configuration overrides.
 */

import type {
  TenantConfiguration,
  TenantFieldMapping,
  TenantCustomField,
  TenantClassificationMapping,
  ReconciliationReport,
  FieldReconciliationResult,
  MappingStatus,
} from './types';
import type { FieldSource, SignalContribution } from '../catalog/types';
import { toFieldMapping } from './field-reconciliation';

// =============================================================================
// CONFIGURATION CREATION
// =============================================================================

/**
 * Create initial tenant configuration from reconciliation report
 */
export function createInitialConfiguration(
  tenantId: string,
  baseUrl: string,
  reconciliationReport: ReconciliationReport
): TenantConfiguration {
  const now = new Date().toISOString();

  // Convert reconciliation results to field mappings
  const fieldMappings: TenantFieldMapping[] = [];

  for (const result of reconciliationReport.results) {
    const tenantSource = toFieldMapping(result);

    if (tenantSource) {
      const status: MappingStatus =
        result.status === 'MATCHED' ? 'auto' :
        result.status === 'ALIAS_MATCHED' ? 'auto' :
        result.status === 'CM_MATCHED' ? 'auto' :
        result.status === 'CM_SUGGESTED' ? 'pending' :
        result.status === 'AMBIGUOUS' ? 'pending' :
        'pending';

      fieldMappings.push({
        canonicalFieldId: result.canonicalFieldId,
        tenantSource,
        status,
        confidence: result.match?.confidence,
      });
    }
  }

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
    lastSnapshotAt: reconciliationReport.generatedAt,
  };
}

// =============================================================================
// CONFIGURATION UPDATES
// =============================================================================

/**
 * Confirm a pending field mapping
 */
export function confirmFieldMapping(
  config: TenantConfiguration,
  canonicalFieldId: string,
  confirmedBy?: string
): TenantConfiguration {
  const now = new Date().toISOString();

  const updatedMappings = config.fieldMappings.map(m => {
    if (m.canonicalFieldId === canonicalFieldId) {
      return {
        ...m,
        status: 'confirmed' as MappingStatus,
        confirmedAt: now,
        confirmedBy,
      };
    }
    return m;
  });

  return {
    ...config,
    fieldMappings: updatedMappings,
    updatedAt: now,
    updatedBy: confirmedBy,
    version: config.version + 1,
  };
}

/**
 * Reject a field mapping
 */
export function rejectFieldMapping(
  config: TenantConfiguration,
  canonicalFieldId: string,
  rejectedBy?: string,
  notes?: string
): TenantConfiguration {
  const now = new Date().toISOString();

  const updatedMappings = config.fieldMappings.map(m => {
    if (m.canonicalFieldId === canonicalFieldId) {
      return {
        ...m,
        status: 'rejected' as MappingStatus,
        confirmedAt: now,
        confirmedBy: rejectedBy,
        notes,
      };
    }
    return m;
  });

  return {
    ...config,
    fieldMappings: updatedMappings,
    updatedAt: now,
    updatedBy: rejectedBy,
    version: config.version + 1,
  };
}

/**
 * Override a field mapping with a custom source
 */
export function overrideFieldMapping(
  config: TenantConfiguration,
  canonicalFieldId: string,
  newSource: FieldSource,
  overriddenBy?: string,
  notes?: string
): TenantConfiguration {
  const now = new Date().toISOString();

  const existingIndex = config.fieldMappings.findIndex(
    m => m.canonicalFieldId === canonicalFieldId
  );

  const newMapping: TenantFieldMapping = {
    canonicalFieldId,
    tenantSource: newSource,
    status: 'confirmed',
    confidence: 1.0,
    confirmedAt: now,
    confirmedBy: overriddenBy,
    notes,
  };

  const updatedMappings = existingIndex >= 0
    ? [
        ...config.fieldMappings.slice(0, existingIndex),
        newMapping,
        ...config.fieldMappings.slice(existingIndex + 1),
      ]
    : [...config.fieldMappings, newMapping];

  return {
    ...config,
    fieldMappings: updatedMappings,
    updatedAt: now,
    updatedBy: overriddenBy,
    version: config.version + 1,
  };
}

/**
 * Add a tenant-defined custom field
 */
export function addCustomField(
  config: TenantConfiguration,
  customField: Omit<TenantCustomField, 'id' | 'createdAt'>,
  createdBy?: string
): TenantConfiguration {
  const now = new Date().toISOString();

  // Generate unique ID
  const id = `tenant_${config.tenantId}_${Date.now()}`;

  const newField: TenantCustomField = {
    ...customField,
    id,
    createdAt: now,
    createdBy,
  };

  return {
    ...config,
    customFields: [...config.customFields, newField],
    updatedAt: now,
    updatedBy: createdBy,
    version: config.version + 1,
  };
}

/**
 * Remove a custom field
 */
export function removeCustomField(
  config: TenantConfiguration,
  customFieldId: string,
  removedBy?: string
): TenantConfiguration {
  const now = new Date().toISOString();

  return {
    ...config,
    customFields: config.customFields.filter(f => f.id !== customFieldId),
    updatedAt: now,
    updatedBy: removedBy,
    version: config.version + 1,
  };
}

/**
 * Add a classification mapping
 */
export function addClassificationMapping(
  config: TenantConfiguration,
  mapping: Omit<TenantClassificationMapping, 'confirmedAt'>,
  confirmedBy?: string
): TenantConfiguration {
  const now = new Date().toISOString();

  const newMapping: TenantClassificationMapping = {
    ...mapping,
    confirmedAt: now,
  };

  return {
    ...config,
    classificationMappings: [...config.classificationMappings, newMapping],
    updatedAt: now,
    updatedBy: confirmedBy,
    version: config.version + 1,
  };
}

/**
 * Remove a classification mapping
 */
export function removeClassificationMapping(
  config: TenantConfiguration,
  pattern: string,
  removedBy?: string
): TenantConfiguration {
  const now = new Date().toISOString();

  return {
    ...config,
    classificationMappings: config.classificationMappings.filter(
      m => m.pattern !== pattern
    ),
    updatedAt: now,
    updatedBy: removedBy,
    version: config.version + 1,
  };
}

/**
 * Exclude a field from assessment
 */
export function excludeField(
  config: TenantConfiguration,
  canonicalFieldId: string,
  excludedBy?: string
): TenantConfiguration {
  const now = new Date().toISOString();

  if (config.excludedFields.includes(canonicalFieldId)) {
    return config;
  }

  return {
    ...config,
    excludedFields: [...config.excludedFields, canonicalFieldId],
    updatedAt: now,
    updatedBy: excludedBy,
    version: config.version + 1,
  };
}

/**
 * Re-include a previously excluded field
 */
export function includeField(
  config: TenantConfiguration,
  canonicalFieldId: string,
  includedBy?: string
): TenantConfiguration {
  const now = new Date().toISOString();

  return {
    ...config,
    excludedFields: config.excludedFields.filter(f => f !== canonicalFieldId),
    updatedAt: now,
    updatedBy: includedBy,
    version: config.version + 1,
  };
}

// =============================================================================
// CONFIGURATION QUERIES
// =============================================================================

/**
 * Get effective field source for a canonical field
 */
export function getEffectiveFieldSource(
  config: TenantConfiguration,
  canonicalFieldId: string
): FieldSource | undefined {
  // Check if excluded
  if (config.excludedFields.includes(canonicalFieldId)) {
    return undefined;
  }

  // Check field mappings
  const mapping = config.fieldMappings.find(
    m => m.canonicalFieldId === canonicalFieldId
  );

  if (mapping && mapping.status !== 'rejected') {
    return mapping.tenantSource;
  }

  return undefined;
}

/**
 * Get all active field mappings (confirmed or auto)
 */
export function getActiveMappings(
  config: TenantConfiguration
): TenantFieldMapping[] {
  return config.fieldMappings.filter(
    m => m.status === 'confirmed' || m.status === 'auto'
  );
}

/**
 * Get mappings needing confirmation
 */
export function getPendingMappings(
  config: TenantConfiguration
): TenantFieldMapping[] {
  return config.fieldMappings.filter(m => m.status === 'pending');
}

/**
 * Get configuration completeness score
 */
export function getConfigurationCompleteness(
  config: TenantConfiguration,
  totalCanonicalFields: number
): {
  score: number;
  confirmed: number;
  auto: number;
  pending: number;
  rejected: number;
  excluded: number;
  unmapped: number;
} {
  const confirmed = config.fieldMappings.filter(m => m.status === 'confirmed').length;
  const auto = config.fieldMappings.filter(m => m.status === 'auto').length;
  const pending = config.fieldMappings.filter(m => m.status === 'pending').length;
  const rejected = config.fieldMappings.filter(m => m.status === 'rejected').length;
  const excluded = config.excludedFields.length;
  const mapped = confirmed + auto;
  const unmapped = totalCanonicalFields - mapped - excluded - rejected;

  const score = totalCanonicalFields > 0
    ? (mapped + excluded) / totalCanonicalFields
    : 0;

  return {
    score,
    confirmed,
    auto,
    pending,
    rejected,
    excluded,
    unmapped,
  };
}

// =============================================================================
// MERGE AND REFRESH
// =============================================================================

/**
 * Merge new reconciliation results into existing configuration
 * Preserves user confirmations/rejections while adding new mappings
 */
export function mergeReconciliationResults(
  config: TenantConfiguration,
  newResults: ReconciliationReport,
  mergedBy?: string
): TenantConfiguration {
  const now = new Date().toISOString();

  // Index existing mappings by canonical field ID
  const existingByField = new Map<string, TenantFieldMapping>();
  for (const mapping of config.fieldMappings) {
    existingByField.set(mapping.canonicalFieldId, mapping);
  }

  // Process new results
  const updatedMappings: TenantFieldMapping[] = [];

  for (const result of newResults.results) {
    const existing = existingByField.get(result.canonicalFieldId);
    const newSource = toFieldMapping(result);

    if (!newSource) {
      // No mapping found in new results
      if (existing && existing.status !== 'rejected') {
        // Keep existing if it was confirmed or auto
        updatedMappings.push(existing);
      }
      continue;
    }

    if (!existing) {
      // New field, add with auto status
      updatedMappings.push({
        canonicalFieldId: result.canonicalFieldId,
        tenantSource: newSource,
        status: result.status === 'MATCHED' ? 'auto' : 'pending',
        confidence: result.match?.confidence,
      });
    } else if (existing.status === 'confirmed') {
      // User confirmed, keep their choice
      updatedMappings.push(existing);
    } else if (existing.status === 'rejected') {
      // User rejected, keep rejection
      updatedMappings.push(existing);
    } else {
      // Auto or pending, update with new result
      updatedMappings.push({
        ...existing,
        tenantSource: newSource,
        status: result.status === 'MATCHED' ? 'auto' : 'pending',
        confidence: result.match?.confidence,
      });
    }

    existingByField.delete(result.canonicalFieldId);
  }

  // Keep any remaining confirmed/rejected mappings
  for (const remaining of existingByField.values()) {
    if (remaining.status === 'confirmed' || remaining.status === 'rejected') {
      updatedMappings.push(remaining);
    }
  }

  return {
    ...config,
    fieldMappings: updatedMappings,
    updatedAt: now,
    updatedBy: mergedBy,
    version: config.version + 1,
    lastSnapshotAt: newResults.generatedAt,
  };
}

// =============================================================================
// SERIALIZATION
// =============================================================================

/**
 * Serialize configuration to JSON
 */
export function serializeConfiguration(config: TenantConfiguration): string {
  return JSON.stringify(config, null, 2);
}

/**
 * Deserialize configuration from JSON
 */
export function deserializeConfiguration(json: string): TenantConfiguration {
  const parsed = JSON.parse(json);

  // Validate required fields
  if (!parsed.tenantId || !parsed.baseUrl || !parsed.version) {
    throw new Error('Invalid tenant configuration: missing required fields');
  }

  // Ensure arrays exist
  return {
    ...parsed,
    fieldMappings: parsed.fieldMappings || [],
    customFields: parsed.customFields || [],
    classificationMappings: parsed.classificationMappings || [],
    excludedFields: parsed.excludedFields || [],
  };
}

/**
 * Validate configuration integrity
 */
export function validateConfiguration(config: TenantConfiguration): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!config.tenantId) errors.push('Missing tenantId');
  if (!config.baseUrl) errors.push('Missing baseUrl');
  if (typeof config.version !== 'number') errors.push('Invalid version');

  // Mapping validity
  const seenFields = new Set<string>();
  for (const mapping of config.fieldMappings) {
    if (!mapping.canonicalFieldId) {
      errors.push('Field mapping missing canonicalFieldId');
      continue;
    }

    if (seenFields.has(mapping.canonicalFieldId)) {
      warnings.push(`Duplicate mapping for field: ${mapping.canonicalFieldId}`);
    }
    seenFields.add(mapping.canonicalFieldId);

    if (!mapping.tenantSource) {
      errors.push(`Field mapping ${mapping.canonicalFieldId} missing tenantSource`);
    }
  }

  // Custom field validity
  const seenCustomIds = new Set<string>();
  for (const field of config.customFields) {
    if (!field.id) {
      errors.push('Custom field missing id');
      continue;
    }

    if (seenCustomIds.has(field.id)) {
      warnings.push(`Duplicate custom field id: ${field.id}`);
    }
    seenCustomIds.add(field.id);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
