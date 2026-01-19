/**
 * Signal Mapper
 * Maps MDLH columns to canonical evaluation signals
 * Single source of truth for MDLH -> signal mapping
 */

import type { MdlhAssetRow, Asset, AssetAttributes, CanonicalSignals, SignalValue } from '../types/mdlh.js';

/**
 * MDLH Column to Signal Mapping
 * Updated for ATLAN_GOLD.PUBLIC.ASSETS schema
 */
export const SIGNAL_MAPPINGS = {
  OWNERSHIP: {
    description: 'Asset has assigned owners',
    columns: ['OWNER_USERS'],
    evaluate: (row: MdlhAssetRow): boolean => 
      arrayLen(parseArrayField(row.OWNER_USERS)) > 0,
  },
  SEMANTICS: {
    description: 'Asset has semantic enrichment (description or terms)',
    columns: ['DESCRIPTION', 'TERM_GUIDS'],
    evaluate: (row: MdlhAssetRow): boolean => 
      !!row.DESCRIPTION || arrayLen(parseArrayField(row.TERM_GUIDS)) > 0,
  },
  LINEAGE: {
    description: 'Asset has lineage information',
    columns: ['HAS_LINEAGE'],
    evaluate: (row: MdlhAssetRow): boolean => 
      row.HAS_LINEAGE === true,
  },
  SENSITIVITY: {
    description: 'Asset has classification tags',
    columns: ['TAGS'],
    evaluate: (row: MdlhAssetRow): boolean => 
      arrayLen(parseArrayField(row.TAGS)) > 0,
  },
  TRUST: {
    description: 'Asset has trust certification',
    columns: ['CERTIFICATE_STATUS'],
    evaluate: (row: MdlhAssetRow): boolean => 
      !!row.CERTIFICATE_STATUS && row.CERTIFICATE_STATUS !== 'NONE',
  },
  USAGE: {
    description: 'Asset has recorded usage/popularity',
    columns: ['POPULARITY_SCORE'],
    evaluate: (row: MdlhAssetRow): boolean => 
      (row.POPULARITY_SCORE || 0) > 0,
  },
  // These signals are not directly available in MDLH ASSETS table
  ACCESS: {
    description: 'Access controls defined (not in MDLH)',
    columns: [],
    evaluate: (): SignalValue => 'UNKNOWN',
  },
  QUALITY: {
    description: 'Data quality metrics (not in MDLH)',
    columns: [],
    evaluate: (): SignalValue => 'UNKNOWN',
  },
  FRESHNESS: {
    description: 'Data freshness tracking (not in MDLH)',
    columns: [],
    evaluate: (): SignalValue => 'UNKNOWN',
  },
  AI_READY: {
    description: 'AI/ML readiness (not in MDLH)',
    columns: [],
    evaluate: (): SignalValue => 'UNKNOWN',
  },
} as const;

/**
 * Evaluate all signals for an MDLH asset row
 */
export function evaluateSignalsFromMDLH(row: MdlhAssetRow): CanonicalSignals {
  return {
    OWNERSHIP: SIGNAL_MAPPINGS.OWNERSHIP.evaluate(row),
    SEMANTICS: SIGNAL_MAPPINGS.SEMANTICS.evaluate(row),
    LINEAGE: SIGNAL_MAPPINGS.LINEAGE.evaluate(row),
    SENSITIVITY: SIGNAL_MAPPINGS.SENSITIVITY.evaluate(row),
    ACCESS: SIGNAL_MAPPINGS.ACCESS.evaluate(),
    QUALITY: SIGNAL_MAPPINGS.QUALITY.evaluate(),
    FRESHNESS: SIGNAL_MAPPINGS.FRESHNESS.evaluate(),
    USAGE: SIGNAL_MAPPINGS.USAGE.evaluate(row),
    AI_READY: SIGNAL_MAPPINGS.AI_READY.evaluate(),
    TRUST: SIGNAL_MAPPINGS.TRUST.evaluate(row),
  };
}

/**
 * Convert MDLH row to canonical Asset format
 */
export function mdlhRowToAsset(row: MdlhAssetRow): Asset {
  const attributes: AssetAttributes = {
    ownerUsers: parseArrayField(row.OWNER_USERS),
    description: row.DESCRIPTION,
    tags: parseArrayField(row.TAGS),
    termGuids: parseArrayField(row.TERM_GUIDS),
    hasLineage: row.HAS_LINEAGE || false,
    certificateStatus: row.CERTIFICATE_STATUS,
    popularityScore: row.POPULARITY_SCORE,
    readmeGuid: row.README_GUID,
  };

  return {
    guid: row.GUID,
    name: row.ASSET_NAME || '',
    typeName: row.ASSET_TYPE || '',
    qualifiedName: row.ASSET_QUALIFIED_NAME || '',
    connector: row.CONNECTOR_NAME || 'Unknown',
    attributes,
  };
}

/**
 * Count number of true signals (excluding UNKNOWN)
 */
export function countKnownTrueSignals(signals: CanonicalSignals): number {
  return Object.values(signals).filter(v => v === true).length;
}

/**
 * Count number of known signals (not UNKNOWN)
 */
export function countKnownSignals(signals: CanonicalSignals): number {
  return Object.values(signals).filter(v => v !== 'UNKNOWN').length;
}

/**
 * Helper: Get array length safely
 */
function arrayLen(val: unknown): number {
  if (Array.isArray(val)) return val.length;
  return 0;
}

/**
 * Helper: Parse array field that might be JSON string or array
 */
function parseArrayField(val: string[] | string | null | undefined): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // Not JSON, might be comma-separated
      return val.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  return [];
}
