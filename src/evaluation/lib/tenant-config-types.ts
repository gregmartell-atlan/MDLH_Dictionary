// ============================================================================
// Tenant Configuration Types
// Types for tenant-specific field mappings and configuration
// ============================================================================

export type MappingStatus = 'auto' | 'confirmed' | 'rejected' | 'pending';

export type ReconciliationStatus =
  | 'MATCHED'
  | 'ALIAS_MATCHED'
  | 'CM_MATCHED'
  | 'CM_SUGGESTED'
  | 'CLASSIFICATION'
  | 'NOT_FOUND'
  | 'AMBIGUOUS';

export interface FieldSource {
  type: 'native' | 'native_any' | 'custom_metadata' | 'classification' | 'relationship' | 'derived';
  // Additional properties vary by type
  [key: string]: unknown;
}

export interface TenantFieldMapping {
  canonicalFieldId: string;
  canonicalFieldName: string;
  tenantSource?: FieldSource;
  status: MappingStatus;
  reconciliationStatus?: ReconciliationStatus;
  confidence?: number;
  confirmedAt?: string;
  confirmedBy?: string;
  notes?: string;
}

export interface TenantCustomField {
  id: string;
  displayName: string;
  description?: string;
  tenantSource: FieldSource;
  contributesToSignals: Array<{ signal: string; weight: number }>;
  createdAt: string;
  createdBy?: string;
}

export interface ClassificationMapping {
  pattern: string;
  signal: string;
  indicatorType: 'positive' | 'negative';
  confirmedAt?: string;
}

export interface TenantConfig {
  tenantId: string;
  baseUrl: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  fieldMappings: TenantFieldMapping[];
  customFields: TenantCustomField[];
  classificationMappings: ClassificationMapping[];
  excludedFields: string[];
  lastSnapshotAt?: string;
}

// Lookup maps for classification name translation (hashed ↔ display name)
export interface ClassificationNameMap {
  hashToDisplay: Record<string, string>;  // "Lq5Mzm8fUYBqOpzZ7gfirR" → "PII"
  displayToHash: Record<string, string>;  // "PII" → "Lq5Mzm8fUYBqOpzZ7gfirR"
}

export interface SchemaSnapshot {
  tenantId: string;
  discoveredAt: string;
  entityTypes: Array<{
    name: string;
    description?: string;
    superTypes: string[];
    attributes: Array<{
      name: string;
      typeName: string;
      description?: string;
      isOptional: boolean;
      cardinality: string;
    }>;
  }>;
  nativeAttributes: string[]; // Flattened list of discovered native attribute names
  customMetadata: Array<{
    name: string;
    displayName: string;
    attributes: Array<{
      name: string;
      displayName: string;
      type: string;
    }>;
  }>;
  classifications: Array<{
    name: string;        // Hashed internal name
    displayName: string; // Human-readable name
    description?: string;
  }>;
  classificationNameMap?: ClassificationNameMap; // Lookup maps for name translation
  domains: Array<{
    guid: string;
    name: string;
  }>;
}

export interface DiscoveryProgress {
  phase: 'idle' | 'discovering' | 'reconciling' | 'complete' | 'error';
  message?: string;
}

export interface ConfigCompleteness {
  score: number;
  confirmed: number;
  auto: number;
  pending: number;
  rejected: number;
  excluded: number;
}
