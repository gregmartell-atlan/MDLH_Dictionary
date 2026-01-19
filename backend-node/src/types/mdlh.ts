/**
 * MDLH Column Types and Mappings
 * Single source of truth for MDLH schema
 */

// ============================================
// MDLH COLUMN CONSTANTS
// ============================================

export const MDLH_COLUMNS = {
  GUID: 'GUID',
  NAME: 'ASSET_NAME',
  TYPE: 'ASSET_TYPE',
  QUALIFIED_NAME: 'ASSET_QUALIFIED_NAME',
  CONNECTOR: 'CONNECTOR_NAME',
  OWNER_USERS: 'OWNER_USERS',
  // OWNER_GROUPS not available in ATLAN_GOLD.PUBLIC.ASSETS
  DESCRIPTION: 'DESCRIPTION',
  TAGS: 'TAGS',
  TERM_GUIDS: 'TERM_GUIDS',
  HAS_LINEAGE: 'HAS_LINEAGE',
  CERTIFICATE: 'CERTIFICATE_STATUS',
  POPULARITY: 'POPULARITY_SCORE',
  README_GUID: 'README_GUID',
  // QUERY_COUNT, QUERY_USER_COUNT, SOURCE_READ_AT not in ASSETS table
  SOURCE_UPDATED_AT: 'SOURCE_UPDATED_AT',
  STATUS: 'STATUS',
} as const;

export type MdlhColumnKey = keyof typeof MDLH_COLUMNS;
export type MdlhColumnValue = typeof MDLH_COLUMNS[MdlhColumnKey];

// ============================================
// MDLH ASSET ROW (from Snowflake query)
// ============================================

export interface MdlhAssetRow {
  GUID: string;
  ASSET_NAME: string | null;
  ASSET_TYPE: string | null;
  ASSET_QUALIFIED_NAME: string | null;
  CONNECTOR_NAME: string | null;
  OWNER_USERS: string[] | string | null; // Can be array or JSON string
  DESCRIPTION: string | null;
  README_GUID: string | null;
  TERM_GUIDS: string[] | string | null; // Can be array or JSON string
  TAGS: string[] | string | null; // Can be array or JSON string
  HAS_LINEAGE: boolean | null;
  CERTIFICATE_STATUS: string | null;
  POPULARITY_SCORE: number | null;
  SOURCE_UPDATED_AT: string | null;
}

// ============================================
// CANONICAL ASSET (normalized)
// ============================================

export interface AssetAttributes {
  ownerUsers: string[];
  description: string | null;
  tags: string[];
  termGuids: string[];
  hasLineage: boolean;
  certificateStatus: string | null;
  popularityScore: number | null;
  readmeGuid: string | null;
}

export interface Asset {
  guid: string;
  name: string;
  typeName: string;
  qualifiedName: string;
  connector: string;
  attributes: AssetAttributes;
}

// ============================================
// SIGNAL TYPES
// ============================================

export type SignalValue = boolean | 'UNKNOWN';

export interface CanonicalSignals {
  OWNERSHIP: SignalValue;
  SEMANTICS: SignalValue;
  LINEAGE: SignalValue;
  SENSITIVITY: SignalValue;
  ACCESS: SignalValue;
  QUALITY: SignalValue;
  FRESHNESS: SignalValue;
  USAGE: SignalValue;
  AI_READY: SignalValue;
  TRUST: SignalValue;
}

export type SignalKey = keyof CanonicalSignals;
