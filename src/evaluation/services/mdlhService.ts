// ============================================
// MDLH SERVICE
// Connect to Atlan's Metadata Lakehouse via backend API
// ============================================

import type { FieldCoverage, AuditResult, AssetBreakdown } from '../types/priority';
import { normalizeQueryRows } from '../../utils/queryResults';
import {
  FIELD_COVERAGE_QUERY,
  FIELD_COVERAGE_BY_TYPE_QUERY,
  ORPHAN_ASSETS_QUERY,
  COMPLETENESS_SCORE_QUERY,
  parseFieldCoverageResult,
  getGoldSchema,
} from './mdlhQueries';

// Configuration for MDLH backend
export interface MDLHConfig {
  apiUrl: string;
  database: string;
  schema: string;
}

// Default config - points to local MDLH backend
const DEFAULT_CONFIG: MDLHConfig = {
  apiUrl: import.meta.env.VITE_MDLH_API_URL || 'http://localhost:3002',
  database: import.meta.env.VITE_MDLH_DATABASE || '',
  schema: import.meta.env.VITE_MDLH_SCHEMA || 'PUBLIC',
};

let currentConfig: MDLHConfig = { ...DEFAULT_CONFIG };

/**
 * Set MDLH configuration
 */
export function setMDLHConfig(config: Partial<MDLHConfig>) {
  currentConfig = { ...currentConfig, ...config };
}

/**
 * Get current MDLH configuration
 */
export function getMDLHConfig(): MDLHConfig {
  return { ...currentConfig };
}

/**
 * Check if MDLH backend is reachable
 */
export async function checkConnection(): Promise<{
  connected: boolean;
  database?: string;
  schema?: string;
  error?: string;
}> {
  try {
    const response = await fetch(`${currentConfig.apiUrl}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      return { connected: false, error: 'Backend not responding' };
    }

    const data = await response.json();
    return {
      connected: data.snowflake_connected || false,
      database: data.database || currentConfig.database,
      schema: data.schema || currentConfig.schema,
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

/**
 * Execute a query against MDLH
 */
export async function executeQuery<T = Record<string, unknown>>(
  sql: string
): Promise<{ rows: T[]; columns: string[]; error?: string }> {
  try {
    const response = await fetch(`${currentConfig.apiUrl}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sql,
        database: currentConfig.database,
        schema: currentConfig.schema,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { rows: [], columns: [], error };
    }

    const data = await response.json();
    const normalizedRows = normalizeQueryRows(data);
    return {
      rows: normalizedRows as T[],
      columns: data.columns || [],
    };
  } catch (error) {
    return {
      rows: [],
      columns: [],
      error: error instanceof Error ? error.message : 'Query failed',
    };
  }
}

/**
 * Fetch field coverage data from MDLH
 */
export async function fetchFieldCoverage(): Promise<{
  coverage: FieldCoverage[];
  error?: string;
}> {
  const goldSchema = getGoldSchema(currentConfig.database, currentConfig.schema);
  const result = await executeQuery<Record<string, number>>(FIELD_COVERAGE_QUERY(goldSchema));

  if (result.error || result.rows.length === 0) {
    return {
      coverage: [],
      error: result.error || 'No data returned',
    };
  }

  const coverage = parseFieldCoverageResult(result.rows[0]);

  // Add accessPolicies and customMetadata with 0 coverage
  // (these require different queries or aren't in MDLH)
  coverage.push({
    field: 'accessPolicies',
    totalAssets: result.rows[0].total_assets || result.rows[0].TOTAL_ASSETS || 0,
    populatedAssets: 0,
    coveragePercent: 0,
  });
  coverage.push({
    field: 'customMetadata',
    totalAssets: result.rows[0].total_assets || result.rows[0].TOTAL_ASSETS || 0,
    populatedAssets: 0,
    coveragePercent: 0,
  });

  return { coverage };
}

/**
 * Fetch asset breakdown by type
 */
export async function fetchAssetBreakdown(): Promise<{
  breakdown: AssetBreakdown[];
  error?: string;
}> {
  const goldSchema = getGoldSchema(currentConfig.database, currentConfig.schema);
  const result = await executeQuery<{
    asset_type: string;
    ASSET_TYPE: string;
    total_assets: number;
    TOTAL_ASSETS: number;
    with_owner_users: number;
    WITH_OWNER_USERS: number;
    with_description: number;
    WITH_DESCRIPTION: number;
  }>(FIELD_COVERAGE_BY_TYPE_QUERY(goldSchema));

  if (result.error) {
    return { breakdown: [], error: result.error };
  }

  const breakdown: AssetBreakdown[] = result.rows.map((row) => {
    const total = row.total_assets || row.TOTAL_ASSETS || 0;
    const withOwner = row.with_owner_users || row.WITH_OWNER_USERS || 0;
    const withDesc = row.with_description || row.WITH_DESCRIPTION || 0;
    const avgCompleteness = total > 0 ? ((withOwner + withDesc) / (total * 2)) * 100 : 0;

    return {
      assetType: row.asset_type || row.ASSET_TYPE,
      count: total,
      avgCompleteness: Math.round(avgCompleteness),
    };
  });

  return { breakdown };
}

/**
 * Fetch full audit result from MDLH
 */
export async function fetchAuditResult(): Promise<{
  audit: AuditResult | null;
  error?: string;
}> {
  // Fetch coverage and breakdown in parallel
  const [coverageResult, breakdownResult] = await Promise.all([
    fetchFieldCoverage(),
    fetchAssetBreakdown(),
  ]);

  if (coverageResult.error) {
    return { audit: null, error: coverageResult.error };
  }

  const coverage = coverageResult.coverage;
  const totalAssets = coverage[0]?.totalAssets || 0;

  // Calculate summary
  const findCoverage = (field: string) =>
    coverage.find((c) => c.field === field)?.populatedAssets || 0;

  const summary = {
    totalAssets,
    assetsWithOwner: findCoverage('ownerUsers'),
    assetsWithDescription: findCoverage('description'),
    assetsWithTags: findCoverage('atlanTags'),
    assetsWithGlossary: findCoverage('glossaryTerms'),
    assetsWithLineage: findCoverage('lineage'),
    overallCompletenessScore: calculateOverallCompleteness(coverage),
  };

  const audit: AuditResult = {
    timestamp: new Date(),
    tenantId: currentConfig.database,
    summary,
    fieldCoverage: coverage,
    assetBreakdown: breakdownResult.breakdown,
  };

  return { audit };
}

/**
 * Calculate overall completeness score
 */
function calculateOverallCompleteness(coverage: FieldCoverage[]): number {
  const weights: Record<string, number> = {
    ownerUsers: 30,
    ownerGroups: 15,
    description: 20,
    certificateStatus: 25,
    atlanTags: 25,
    glossaryTerms: 15,
    lineage: 10,
  };

  let totalScore = 0;
  let totalWeight = 0;

  for (const c of coverage) {
    const weight = weights[c.field];
    if (weight) {
      totalScore += c.coveragePercent * weight;
      totalWeight += weight;
    }
  }

  return totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) : 0;
}

/**
 * Fetch orphan assets (no owner)
 */
export async function fetchOrphanAssets(): Promise<{
  assets: Array<{
    qualifiedName: string;
    name: string;
    assetType: string;
    connector: string;
  }>;
  error?: string;
}> {
  const goldSchema = getGoldSchema(currentConfig.database, currentConfig.schema);
  const result = await executeQuery<{
    qualifiedName: string;
    QUALIFIEDNAME: string;
    name: string;
    NAME: string;
    asset_type: string;
    ASSET_TYPE: string;
    connectorName: string;
    CONNECTORNAME: string;
  }>(ORPHAN_ASSETS_QUERY(goldSchema));

  if (result.error) {
    return { assets: [], error: result.error };
  }

  const assets = result.rows.map((row) => ({
    qualifiedName: row.qualifiedName || row.QUALIFIEDNAME,
    name: row.name || row.NAME,
    assetType: row.asset_type || row.ASSET_TYPE,
    connector: row.connectorName || row.CONNECTORNAME,
  }));

  return { assets };
}

/**
 * Fetch lowest completeness assets
 */
export async function fetchLowestCompletenessAssets(): Promise<{
  assets: Array<{
    qualifiedName: string;
    name: string;
    assetType: string;
    connector: string;
    completenessScore: number;
  }>;
  error?: string;
}> {
  const goldSchema = getGoldSchema(currentConfig.database, currentConfig.schema);
  const result = await executeQuery<{
    qualifiedName: string;
    QUALIFIEDNAME: string;
    name: string;
    NAME: string;
    asset_type: string;
    ASSET_TYPE: string;
    connectorName: string;
    CONNECTORNAME: string;
    completeness_score: number;
    COMPLETENESS_SCORE: number;
  }>(COMPLETENESS_SCORE_QUERY(goldSchema));

  if (result.error) {
    return { assets: [], error: result.error };
  }

  const assets = result.rows.map((row) => ({
    qualifiedName: row.qualifiedName || row.QUALIFIEDNAME,
    name: row.name || row.NAME,
    assetType: row.asset_type || row.ASSET_TYPE,
    connector: row.connectorName || row.CONNECTORNAME,
    completenessScore: row.completeness_score || row.COMPLETENESS_SCORE,
  }));

  return { assets };
}
