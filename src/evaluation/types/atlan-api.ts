/**
 * Atlan API Types
 *
 * Centralized type definitions for Atlan REST API interactions.
 * These types are used by the atlanApi service and related modules.
 */

// ============================================
// API CONFIGURATION
// ============================================

export interface AtlanApiConfig {
  baseUrl: string;
  apiKey: string;
}

// ============================================
// CONNECTION TYPES
// ============================================

export interface ConnectionStatus {
  connected: boolean;
  username?: string;
  email?: string;
  tenantId?: string;
  error?: string;
}

export interface ConnectorInfo {
  id: string;
  name: string;
  icon?: string;
  assetCount: number;
  isActive: boolean;
}

// ============================================
// ENTITY & RELATIONSHIP TYPES
// ============================================

export interface AtlanRelationship {
  guid: string;
  typeName: string;
  displayText?: string;
  qualifiedName?: string;
}

export interface AtlanAssetSummary {
  guid: string;
  name: string;
  qualifiedName: string;
  typeName: string;
  connectorName?: string;
  // Hierarchy info
  databaseName?: string;
  databaseQualifiedName?: string;
  schemaName?: string;
  schemaQualifiedName?: string;
  // All attributes
  attributes: AtlanEntityAttributes;
  // Relationships (from relationAttributes)
  relationships?: AtlanAssetRelationships;
}

export interface AtlanEntityAttributes {
  name?: string;
  qualifiedName?: string;
  description?: string;
  userDescription?: string;
  ownerUsers?: string[];
  ownerGroups?: string[];
  certificateStatus?: string;
  connectorName?: string;
  connectionName?: string;
  __hasLineage?: boolean;
  meanings?: Array<{ guid: string; displayText: string }>;
  atlanTags?: Array<{ typeName: string }>;
  [key: string]: unknown;
}

export interface AtlanAssetRelationships {
  columns?: AtlanRelationship[];
  tables?: AtlanRelationship[];
  views?: AtlanRelationship[];
  schemas?: AtlanRelationship[];
  database?: AtlanRelationship;
  schema?: AtlanRelationship;
  table?: AtlanRelationship;
  view?: AtlanRelationship;
  // Lineage relationships
  inputs?: AtlanRelationship[];
  outputs?: AtlanRelationship[];
  inputToProcesses?: AtlanRelationship[];
  outputFromProcesses?: AtlanRelationship[];
}

// ============================================
// HIERARCHY TYPES
// ============================================

export interface HierarchyItem {
  guid: string;
  name: string;
  qualifiedName: string;
  typeName: string;
  level: 'database' | 'schema' | 'table' | 'view' | 'column';
  connectorName?: string;
  parent?: string;
  children?: HierarchyItem[];
  // Additional metadata
  attributes?: AtlanEntityAttributes;
}

// ============================================
// BATCH FETCH TYPES
// ============================================

export interface BatchFetchOptions {
  guids: string[];
  batchSize?: number;
  concurrency?: number;
  retryAttempts?: number;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

// ============================================
// SEARCH TYPES
// ============================================

export interface AtlanSearchRequest {
  dsl: {
    from?: number;
    size?: number;
    query: Record<string, unknown>;
    aggregations?: Record<string, unknown>;
    sort?: Array<Record<string, unknown>>;
  };
  attributes?: string[];
  relationAttributes?: string[];
}

export interface AtlanSearchResponse {
  entities?: AtlanEntity[];
  approximateCount?: number;
  aggregations?: Record<string, { buckets: Array<{ key: string; doc_count: number }> }>;
}

export interface AtlanEntity {
  guid: string;
  typeName: string;
  attributes: AtlanEntityAttributes;
}

// ============================================
// AUDIT TYPES
// ============================================

export interface AuditFieldConfig {
  field: string;
  label: string;
  weight: number;
  category: 'ownership' | 'documentation' | 'governance' | 'classification' | 'lineage';
}
