// ============================================
// ATLAN REST API SERVICE
// Calls Atlan API through local proxy to avoid CORS
// ============================================

import type { FieldCoverage, AuditResult, AssetBreakdown } from '../types/priority';
import type { BoundaryRule } from '../types/domains';

// ============================================
// CONFIGURATION
// ============================================

// Proxy server URL (runs alongside Vite dev server)
const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'http://localhost:3002';
const SAVED_BASE_URL_KEY = 'atlan_base_url';

export interface AtlanApiConfig {
  baseUrl: string;
  apiKey: string;
}

let config: AtlanApiConfig | null = null;

/**
 * Configure the Atlan API client
 */
export function configureAtlanApi(newConfig: AtlanApiConfig) {
  const previousBaseUrl = config?.baseUrl;
  config = newConfig;
  // Store in sessionStorage for persistence (not localStorage for security)
  sessionStorage.setItem(SAVED_BASE_URL_KEY, newConfig.baseUrl);
  // Don't store API key in storage - keep in memory only

  // Reset caches when switching tenants / credentials
  if (!previousBaseUrl || previousBaseUrl !== newConfig.baseUrl) {
    clearCache();
    resetAtlanAssetCache();
  }
}

/**
 * Get current configuration
 */
export function getAtlanConfig(): AtlanApiConfig | null {
  return config;
}

/**
 * Clear configuration (logout)
 */
export function clearAtlanConfig() {
  config = null;
  sessionStorage.removeItem(SAVED_BASE_URL_KEY);
  clearCache();
  resetAtlanAssetCache();
}

/**
 * Check if configured
 */
export function isConfigured(): boolean {
  return config !== null && !!config.baseUrl && !!config.apiKey;
}

/**
 * Get the last-used Atlan base URL (API key is never stored).
 */
export function getSavedAtlanBaseUrl(): string | null {
  try {
    return sessionStorage.getItem(SAVED_BASE_URL_KEY);
  } catch {
    return null;
  }
}

// ============================================
// RESPONSE CACHE
// ============================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL = 60_000; // 60 seconds

/**
 * Get cached response if still valid
 */
function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data as T;
  }
  cache.delete(key);
  return null;
}

/**
 * Store response in cache
 */
function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

/**
 * Clear all cache entries
 */
export function clearCache(): void {
  cache.clear();
}

// ============================================
// API HELPERS
// ============================================

interface AtlanApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

/**
 * Make an authenticated request to Atlan API via proxy
 * The proxy handles CORS by making server-side requests
 * @param signal - Optional AbortController signal for request cancellation
 */
async function atlanFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  signal?: AbortSignal
): Promise<AtlanApiResponse<T>> {
  if (!config) {
    return { error: 'Not configured. Call configureAtlanApi first.', status: 0 };
  }

  // Route through proxy to avoid CORS
  // endpoint like "/api/me" becomes "http://localhost:3001/proxy/api/me"
  const proxyPath = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  const url = `${PROXY_URL}/proxy/${proxyPath}`;

  try {
    const response = await fetch(url, {
      ...options,
      signal, // Support request cancellation
      headers: {
        'Content-Type': 'application/json',
        // Pass Atlan URL and API key to proxy via headers
        'X-Atlan-URL': config.baseUrl,
        'X-Atlan-API-Key': config.apiKey,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `API error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        // Handle proxy's structured error response
        if (errorJson.hint) {
          errorMessage = `${errorJson.error}\n${errorJson.hint}`;
        } else {
          errorMessage = errorJson.message || errorJson.error || errorMessage;
        }
      } catch {
        // Check if we got HTML instead of JSON (common error page)
        if (errorText.includes('<!DOCTYPE') || errorText.includes('<html')) {
          // Extract meaningful text from HTML error
          const preMatch = errorText.match(/<pre>(.*?)<\/pre>/s);
          if (preMatch) {
            errorMessage = preMatch[1].trim();
          } else if (errorText.includes('Cannot POST') || errorText.includes('Cannot GET')) {
            errorMessage = 'Proxy server route not found. Make sure the proxy server is running correctly.';
          } else {
            errorMessage = 'Server returned an HTML error page. Check your Atlan URL and API key.';
          }
        } else {
          errorMessage = errorText || errorMessage;
        }
      }
      return {
        error: errorMessage,
        status: response.status,
      };
    }

    const data = await response.json();
    return { data, status: response.status };
  } catch (error) {
    // Check if request was aborted
    if (error instanceof DOMException && error.name === 'AbortError') {
      return {
        error: 'Request cancelled',
        status: 0,
      };
    }
    // Check if it's a network error (proxy not running)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        error: 'Proxy server not running. Start it with: npm run proxy',
        status: 0,
      };
    }
    return {
      error: error instanceof Error ? error.message : 'Request failed',
      status: 0,
    };
  }
}

// ============================================
// CONNECTION
// ============================================

export interface ConnectionStatus {
  connected: boolean;
  username?: string;
  email?: string;
  tenantId?: string;
  error?: string;
}

/**
 * Test connection by running a simple search query
 * Atlan doesn't have a /me endpoint, so we test with a minimal search
 */
export async function testConnection(): Promise<ConnectionStatus> {
  // Test connection with a minimal search query
  const response = await atlanFetch<{
    approximateCount?: number;
    entities?: Array<{ typeName: string }>;
  }>('/api/meta/search/indexsearch', {
    method: 'POST',
    body: JSON.stringify({
      dsl: {
        from: 0,
        size: 1,
        query: {
          match_all: {},
        },
      },
      attributes: ['name'],
    }),
  });

  if (response.error) {
    return { connected: false, error: response.error };
  }

  return {
    connected: true,
    username: 'API Token', // Atlan doesn't return user info from search
    tenantId: config?.baseUrl?.replace('https://', '').replace('.atlan.com', ''),
  };
}

// ============================================
// SEARCH API
// ============================================

interface SearchRequest {
  dsl: {
    from?: number;
    size?: number;
    query: Record<string, unknown>;
    aggregations?: Record<string, unknown>;
    sort?: Array<Record<string, unknown>>;
    _source?: string[];
  };
  attributes?: string[];
  relationAttributes?: string[];
}

interface SearchResponse {
  entities?: AtlanEntity[];
  approximateCount?: number;
  aggregations?: Record<string, { buckets: Array<{ key: string; doc_count: number }> }>;
}

interface AtlanEntity {
  guid: string;
  typeName: string;
  attributes: {
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
  };
}

// Relationship reference
export interface AtlanRelationship {
  guid: string;
  typeName: string;
  displayText?: string;
  qualifiedName?: string;
}

// Full asset summary with relationships for model canvas
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
  attributes: AtlanEntity['attributes'];
  // Relationships (from relationAttributes)
  relationships?: {
    columns?: AtlanRelationship[];
    tables?: AtlanRelationship[];
    views?: AtlanRelationship[];
    schemas?: AtlanRelationship[];
    database?: AtlanRelationship;
    schema?: AtlanRelationship;
    table?: AtlanRelationship;
    view?: AtlanRelationship;
  };
}

/**
 * Execute a search query
 */
async function search(request: SearchRequest): Promise<SearchResponse | null> {
  const response = await atlanFetch<SearchResponse>('/api/meta/search/indexsearch', {
    method: 'POST',
    body: JSON.stringify(request),
  });

  if (response.error) {
    console.error('Search error:', response.error);
    return null;
  }

  return response.data || null;
}

/**
 * Count assets matching a query
 */
async function countAssets(query: Record<string, unknown>): Promise<number> {
  const response = await search({
    dsl: {
      size: 0,
      query,
    },
  });

  return response?.approximateCount || 0;
}

/**
 * Get all Data Domains from Atlan
 */
export async function getDomains(keyword?: string): Promise<{ guid: string; name: string; qualifiedName: string }[]> {
  const must: any[] = [
    { term: { '__state': 'ACTIVE' } },
    { term: { '__typeName.keyword': 'DataDomain' } }
  ];

  if (keyword) {
    must.push({
      wildcard: {
        'name.keyword': `*${keyword}*`
      }
    });
  }

  const response = await search({
    dsl: {
      from: 0,
      size: 100,
      query: {
        bool: { must }
      },
      _source: ['name', 'qualifiedName', 'typeName', 'guid']
    }
  });

  if (!response?.entities) return [];

  return response.entities.map(entity => ({
    guid: entity.guid,
    name: entity.attributes.name || (entity.attributes.displayName as string) || entity.guid,
    qualifiedName: entity.attributes.qualifiedName || entity.guid
  }));
}

// ============================================
// DOMAIN ASSET SYNC
// ============================================

/**
 * Fetch assets matching domain boundary rules
 */
export async function fetchAssetsForDomain(rules: BoundaryRule[]): Promise<AtlanEntity[]> {
  if (!rules || rules.length === 0) return [];

  // Separate include and exclude rules
  const includeRules = rules.filter(r => r.isInclude);
  const excludeRules = rules.filter(r => !r.isInclude);

  if (includeRules.length === 0) return [];

  // Build SHOULD clauses for inclusion (OR logic)
  const shouldClauses = includeRules.map(rule => {
    switch (rule.type) {
      case 'connector':
        return { term: { 'connectorName.keyword': rule.pattern } };
      case 'database':
        return { term: { 'databaseName.keyword': rule.pattern } };
      case 'schema':
        return { term: { 'schemaName.keyword': rule.pattern } };
      case 'tag':
        return { term: { 'atlanTags.keyword': rule.pattern } };
      case 'path':
      case 'custom':
      default:
        return { wildcard: { 'qualifiedName': `*${rule.pattern}*` } };
    }
  });

  // Build MUST_NOT clauses for exclusion
  const mustNotClauses: Record<string, unknown>[] = excludeRules.map(rule => {
    switch (rule.type) {
      case 'connector':
        return { term: { 'connectorName.keyword': rule.pattern } };
      case 'database':
        return { term: { 'databaseName.keyword': rule.pattern } };
      case 'schema':
        return { term: { 'schemaName.keyword': rule.pattern } };
      case 'tag':
        return { term: { 'atlanTags.keyword': rule.pattern } };
      case 'path':
      case 'custom':
      default:
        return { wildcard: { 'qualifiedName': `*${rule.pattern}*` } };
    }
  });

  // Always exclude deleted and non-asset types
  mustNotClauses.push(
    { term: { '__state': 'DELETED' } },
    { terms: { '__typeName.keyword': ['AtlasGlossary', 'AtlasGlossaryTerm', 'AtlasGlossaryCategory', 'Persona', 'Purpose', 'AuthPolicy'] } }
  );

  const query = {
    bool: {
      minimum_should_match: 1,
      should: shouldClauses,
      must_not: mustNotClauses
    }
  };

  const response = await search({
    dsl: {
      from: 0,
      size: 100, // Limit for now
      query
    },
    attributes: [
      'name', 'qualifiedName', 'description', 'userDescription',
      'ownerUsers', 'ownerGroups', 'certificateStatus',
      'atlanTags', 'meanings', 'connectorName'
    ]
  });

  return response?.entities || [];
}

// ============================================
// QUERY BUILDERS
// ============================================

/**
 * Build a bool query with filters
 */
function buildBoolQuery(filters: {
  must?: Array<Record<string, unknown>>;
  mustNot?: Array<Record<string, unknown>>;
  filter?: Array<Record<string, unknown>>;
}): Record<string, unknown> {
  return {
    bool: {
      must: filters.must || [],
      must_not: filters.mustNot || [
        { term: { '__state': 'DELETED' } },
        { terms: { '__typeName.keyword': ['AtlasGlossary', 'AtlasGlossaryTerm', 'AtlasGlossaryCategory', 'Persona', 'Purpose', 'AuthPolicy'] } },
      ],
      filter: filters.filter || [],
    },
  };
}

/**
 * Build connector filter
 */
function connectorFilter(connector: string): Record<string, unknown> {
  return { term: { 'connectorName.keyword': connector } };
}

/**
 * Build asset type filter
 */
function assetTypeFilter(types: string[]): Record<string, unknown> {
  return { terms: { '__typeName.keyword': types } };
}

/**
 * Build "field exists" filter
 */
function fieldExistsFilter(field: string): Record<string, unknown> {
  // Handle array fields differently
  const arrayFields = ['ownerUsers', 'ownerGroups', 'meanings', 'atlanTags', 'starredBy', 'links'];

  if (arrayFields.includes(field)) {
    return {
      bool: {
        must: [
          { exists: { field } },
          { script: { script: `doc['${field}'].size() > 0` } },
        ],
      },
    };
  }

  if (field === '__hasLineage') {
    return { term: { '__hasLineage': true } };
  }

  return { exists: { field } };
}

// ============================================
// CONNECTOR DISCOVERY
// ============================================

export interface ConnectorInfo {
  id: string;
  name: string;
  icon?: string;
  assetCount: number;
  isActive: boolean;
}

/**
 * Get list of connections that have actual assets
 * First tries aggregation, then falls back to fetching sample assets
 * OPTIMIZED: Results cached for 60 seconds
 */
export async function getConnectors(): Promise<ConnectorInfo[]> {
  // Check cache first
  const cacheKey = `connectors:${config?.baseUrl || 'unknown'}`;
  const cached = getCached<ConnectorInfo[]>(cacheKey);
  if (cached) {
    return cached;
  }

  // First, let's find what asset types exist using a broader search
  // and aggregate by connectorName (which is reliably present)
  const response = await search({
    dsl: {
      size: 0,
      query: {
        bool: {
          must_not: [
            { term: { '__state': 'DELETED' } },
            // Exclude metadata types
            { terms: { '__typeName.keyword': ['AtlasGlossary', 'AtlasGlossaryTerm', 'AtlasGlossaryCategory', 'Persona', 'Purpose', 'AuthPolicy', 'Connection', 'Process', 'ColumnProcess'] } },
          ],
        },
      },
      aggregations: {
        // Aggregate by connectorName to find all connector types with assets
        connectors: {
          terms: {
            field: 'connectorName',
            size: 50,
          },
        },
      },
    },
  });

  // If aggregation works, use it
  const buckets = response?.aggregations?.connectors?.buckets;
  if (buckets && buckets.length > 0) {
    const result = buckets
      .filter((bucket: { key: string; doc_count: number }) => bucket.doc_count > 0)
      .map((bucket: { key: string; doc_count: number }) => ({
        id: bucket.key,
        name: bucket.key,
        assetCount: bucket.doc_count,
        isActive: true,
      }));
    setCache(cacheKey, result);
    return result;
  }

  // Fallback: fetch sample assets and extract unique connector names
  const sampleResponse = await search({
    dsl: {
      size: 500,
      query: {
        bool: {
          must_not: [
            { term: { '__state': 'DELETED' } },
            { terms: { '__typeName.keyword': ['AtlasGlossary', 'AtlasGlossaryTerm', 'AtlasGlossaryCategory', 'Persona', 'Purpose', 'AuthPolicy', 'Connection', 'Process', 'ColumnProcess'] } },
          ],
        },
      },
    },
    attributes: ['name', 'connectorName', 'connectionName', '__typeName'],
  });

  if (sampleResponse?.entities && sampleResponse.entities.length > 0) {
    const connectorMap = new Map<string, number>();

    sampleResponse.entities.forEach((entity) => {
      const connector = entity.attributes.connectorName as string;
      if (connector) {
        connectorMap.set(connector, (connectorMap.get(connector) || 0) + 1);
      }
    });

    const result = Array.from(connectorMap.entries()).map(([name, count]) => ({
      id: name,
      name,
      assetCount: count,
      isActive: true,
    }));
    setCache(cacheKey, result);
    return result;
  }

  return [];
}

// ============================================
// AUDIT FUNCTIONS
// ============================================

// Fields to audit
const AUDIT_FIELDS = [
  { field: 'ownerUsers', label: 'Owner (Users)', weight: 30, category: 'ownership' },
  { field: 'ownerGroups', label: 'Owner (Groups)', weight: 15, category: 'ownership' },
  { field: 'description', label: 'Description', weight: 20, category: 'documentation' },
  { field: 'userDescription', label: 'User Description', weight: 10, category: 'documentation' },
  { field: 'certificateStatus', label: 'Certificate', weight: 25, category: 'governance' },
  { field: 'atlanTags', label: 'Atlan Tags', weight: 25, category: 'classification' },
  { field: 'meanings', label: 'Glossary Terms', weight: 15, category: 'classification' },
  { field: '__hasLineage', label: 'Lineage', weight: 10, category: 'lineage' },
];

/**
 * Get field coverage for all audit fields
 * OPTIMIZED: Uses single multi-aggregation request instead of 8 sequential calls
 */
export async function getFieldCoverage(
  connector?: string,
  assetTypes?: string[]
): Promise<FieldCoverage[]> {
  // Build base query
  const baseFilters: Array<Record<string, unknown>> = [];
  if (connector) baseFilters.push(connectorFilter(connector));
  if (assetTypes?.length) baseFilters.push(assetTypeFilter(assetTypes));

  // Build aggregations for all fields in a single request
  const aggregations: Record<string, unknown> = {};

  for (const fieldInfo of AUDIT_FIELDS) {
    // Handle special cases for array fields and boolean fields
    const arrayFields = ['ownerUsers', 'ownerGroups', 'meanings', 'atlanTags', 'starredBy', 'links'];

    if (fieldInfo.field === '__hasLineage') {
      // Boolean field - count where true
      aggregations[fieldInfo.field] = {
        filter: { term: { '__hasLineage': true } },
      };
    } else if (arrayFields.includes(fieldInfo.field)) {
      // Array fields - need script to check non-empty
      aggregations[fieldInfo.field] = {
        filter: {
          bool: {
            must: [
              { exists: { field: fieldInfo.field } },
            ],
          },
        },
      };
    } else {
      // Simple exists check
      aggregations[fieldInfo.field] = {
        filter: { exists: { field: fieldInfo.field } },
      };
    }
  }

  // Single request with all aggregations
  const response = await search({
    dsl: {
      size: 0,
      query: buildBoolQuery({ filter: baseFilters }),
      aggregations,
    },
  });

  // Get total from approximate count
  const total = response?.approximateCount || 0;

  if (total === 0) {
    return AUDIT_FIELDS.map((f) => ({
      field: f.field as FieldCoverage['field'],
      label: f.label,
      totalAssets: 0,
      populatedAssets: 0,
      coveragePercent: 0,
    }));
  }

  // Parse aggregation results
  const coverage: FieldCoverage[] = [];

  for (const fieldInfo of AUDIT_FIELDS) {
    const aggResult = response?.aggregations?.[fieldInfo.field] as { doc_count?: number } | undefined;
    const populated = aggResult?.doc_count || 0;
    const percent = populated / total;

    coverage.push({
      field: fieldInfo.field as FieldCoverage['field'],
      totalAssets: total,
      populatedAssets: populated,
      coveragePercent: Math.round(percent * 1000) / 1000,
    });
  }

  return coverage;
}

/**
 * Get asset type breakdown
 */
export async function getAssetTypeBreakdown(
  connector?: string
): Promise<AssetBreakdown[]> {
  const baseFilters: Array<Record<string, unknown>> = [];
  if (connector) baseFilters.push(connectorFilter(connector));

  const response = await search({
    dsl: {
      size: 0,
      query: buildBoolQuery({ filter: baseFilters }),
      aggregations: {
        types: {
          terms: {
            field: '__typeName.keyword',
            size: 50,
          },
        },
      },
    },
  });

  if (!response?.aggregations?.types) {
    return [];
  }

  const breakdown: AssetBreakdown[] = [];

  for (const bucket of response.aggregations.types.buckets) {
    // Get completeness for this type
    const typeFilters = [...baseFilters, assetTypeFilter([bucket.key])];
    const withOwner = await countAssets(
      buildBoolQuery({ filter: [...typeFilters, fieldExistsFilter('ownerUsers')] })
    );
    const withDesc = await countAssets(
      buildBoolQuery({ filter: [...typeFilters, fieldExistsFilter('description')] })
    );

    const avgCompleteness =
      bucket.doc_count > 0
        ? ((withOwner + withDesc) / (bucket.doc_count * 2)) * 100
        : 0;

    breakdown.push({
      assetType: bucket.key,
      count: bucket.doc_count,
      avgCompleteness: Math.round(avgCompleteness),
    });
  }

  return breakdown.sort((a, b) => b.count - a.count);
}

/**
 * Get orphan assets (no owner)
 */
export async function getOrphanAssets(
  connector?: string,
  assetTypes?: string[],
  limit = 100
): Promise<Array<{
  guid: string;
  name: string;
  typeName: string;
  qualifiedName: string;
  connector: string;
}>> {
  const baseFilters: Array<Record<string, unknown>> = [];
  if (connector) baseFilters.push(connectorFilter(connector));
  if (assetTypes?.length) {
    baseFilters.push(assetTypeFilter(assetTypes));
  } else {
    // Default to major asset types
    baseFilters.push(assetTypeFilter(['Table', 'View', 'MaterializedView', 'Database', 'Schema']));
  }

  const response = await search({
    dsl: {
      size: limit,
      query: buildBoolQuery({
        filter: baseFilters,
        mustNot: [
          { term: { '__state': 'DELETED' } },
          { exists: { field: 'ownerUsers' } },
          { exists: { field: 'ownerGroups' } },
        ],
      }),
    },
    attributes: ['name', 'qualifiedName', 'connectorName'],
  });

  return (response?.entities || []).map((e) => ({
    guid: e.guid,
    name: e.attributes.name || '',
    typeName: e.typeName,
    qualifiedName: e.attributes.qualifiedName || '',
    connector: e.attributes.connectorName || '',
  }));
}

/**
 * Run a full audit
 * OPTIMIZED: Runs field coverage and asset breakdown in parallel
 */
export async function runFullAudit(
  connector?: string,
  assetTypes?: string[]
): Promise<AuditResult | null> {
  try {
    // Run both queries in parallel for better performance
    const [fieldCoverage, assetBreakdown] = await Promise.all([
      getFieldCoverage(connector, assetTypes),
      getAssetTypeBreakdown(connector),
    ]);

    // Calculate totals
    const total = fieldCoverage[0]?.totalAssets || 0;

    const findCoverage = (field: string) =>
      fieldCoverage.find((c) => c.field === field)?.populatedAssets || 0;

    // Calculate weighted completeness
    let weightedScore = 0;
    let totalWeight = 0;
    for (const fc of fieldCoverage) {
      const fieldInfo = AUDIT_FIELDS.find((f) => f.field === fc.field);
      if (fieldInfo) {
        weightedScore += fc.coveragePercent * fieldInfo.weight;
        totalWeight += fieldInfo.weight;
      }
    }
    const completeness = totalWeight > 0 ? weightedScore / totalWeight : 0;

    return {
      timestamp: new Date(),
      tenantId: connector || 'all',
      summary: {
        totalAssets: total,
        assetsWithOwner: findCoverage('ownerUsers'),
        assetsWithDescription: findCoverage('description'),
        assetsWithTags: findCoverage('atlanTags'),
        assetsWithGlossary: findCoverage('meanings'),
        assetsWithLineage: findCoverage('__hasLineage'),
        overallCompletenessScore: Math.round(completeness * 100), // 0-100 score
      },
      fieldCoverage,
      assetBreakdown,
    };
  } catch (error) {
    console.error('Audit failed:', error);
    return null;
  }
}

/**
 * Quick audit - just summary stats
 */
export async function runQuickAudit(
  connector?: string
): Promise<{
  totalAssets: number;
  completenessScore: number;
  ownerCoverage: number;
  descriptionCoverage: number;
  tagCoverage: number;
} | null> {
  const baseFilters: Array<Record<string, unknown>> = [];
  if (connector) baseFilters.push(connectorFilter(connector));

  const total = await countAssets(buildBoolQuery({ filter: baseFilters }));

  if (total === 0) {
    return { totalAssets: 0, completenessScore: 0, ownerCoverage: 0, descriptionCoverage: 0, tagCoverage: 0 };
  }

  const withOwner = await countAssets(
    buildBoolQuery({ filter: [...baseFilters, fieldExistsFilter('ownerUsers')] })
  );
  const withDesc = await countAssets(
    buildBoolQuery({ filter: [...baseFilters, fieldExistsFilter('description')] })
  );
  const withTags = await countAssets(
    buildBoolQuery({ filter: [...baseFilters, fieldExistsFilter('atlanTags')] })
  );

  const ownerPct = (withOwner / total) * 100;
  const descPct = (withDesc / total) * 100;
  const tagPct = (withTags / total) * 100;

  const completeness = ownerPct * 0.3 + descPct * 0.2 + tagPct * 0.25;

  return {
    totalAssets: total,
    completenessScore: Math.round(completeness),
    ownerCoverage: Math.round(ownerPct),
    descriptionCoverage: Math.round(descPct),
    tagCoverage: Math.round(tagPct),
  };
}

// ============================================
// MODEL IMPORT HELPERS
// ============================================

export interface FetchAssetsResult {
  assets: AtlanAssetSummary[];
  approximateCount?: number;
  hasMore: boolean;
}

export async function fetchAssetsForModel(options?: {
  connector?: string; // Connector name like "snowflake"
  connectionQualifiedName?: string; // Full connection path (optional)
  schemaQualifiedName?: string; // Filter to specific schema
  domainQualifiedName?: string; // Filter to specific domain
  assetTypes?: string[];
  size?: number;
  from?: number;
}): Promise<FetchAssetsResult> {
  const size = options?.size ?? 200;
  const from = options?.from ?? 0;
  const mustFilters: Array<Record<string, unknown>> = [];
  const mustNotFilters: Array<Record<string, unknown>> = [
    { term: { '__state': 'DELETED' } },
    // Exclude metadata/system types
    { terms: { '__typeName.keyword': ['AtlasGlossary', 'AtlasGlossaryTerm', 'AtlasGlossaryCategory', 'Persona', 'Purpose', 'AuthPolicy', 'Connection', 'Process', 'ColumnProcess', 'Task'] } },
  ];

  // Filter by connector name
  if (options?.connector) {
    mustFilters.push({ term: { 'connectorName': options.connector } });
  }

  // Also try connectionQualifiedName if provided
  if (options?.connectionQualifiedName) {
    mustFilters.push({ term: { 'connectionQualifiedName': options.connectionQualifiedName } });
  }

  // Filter by schema qualified name (for scoped imports)
  if (options?.schemaQualifiedName) {
    mustFilters.push({ term: { 'schemaQualifiedName': options.schemaQualifiedName } });
  }

  // Filter by domain qualified name
  if (options?.domainQualifiedName) {
    console.log('[AtlanAPI] Filtering by domain:', options.domainQualifiedName);
    mustFilters.push({ term: { '__atlanBoundary.keyword': options.domainQualifiedName } });
  }

  // Filter by asset types if specified
  if (options?.assetTypes?.length) {
    mustFilters.push(assetTypeFilter(options.assetTypes));
  }

  const response = await search({
    dsl: {
      from,
      size,
      query: {
        bool: {
          must: mustFilters.length > 0 ? mustFilters : [{ match_all: {} }],
          must_not: mustNotFilters,
        },
      },
      sort: [{ '__timestamp': { order: 'desc' } }],
    },
    // Full asset attributes
    attributes: [
      'name',
      'qualifiedName',
      'description',
      'userDescription',
      'connectorName',
      'connectionName',
      'connectionQualifiedName',
      'certificateStatus',
      'ownerUsers',
      'ownerGroups',
      'assignedTerms',
      'atlanTags',
      'meanings',
      '__typeName',
      // Hierarchy attributes
      'databaseName',
      'databaseQualifiedName',
      'schemaName',
      'schemaQualifiedName',
      'tableName',
      'tableQualifiedName',
      'viewName',
      'viewQualifiedName',
      // Counts
      'columnCount',
      'rowCount',
      'tableCount',
      'viewCount',
      'schemaCount',
      // Data types (for columns)
      'dataType',
      'order',
      'isNullable',
      'isPrimary',
    ],
    // Relationship attributes - for full assets
    relationAttributes: [
      'columns',
      'tables',
      'views',
      'schemas',
      'database',
      'schema',
      'table',
      'view',
      'inputToProcesses',
      'outputFromProcesses',
    ],
  });

  if (!response?.entities) {
    return {
      assets: [],
      approximateCount: 0,
      hasMore: false,
    };
  }

  const approximateCount = response.approximateCount;
  const hasMore = approximateCount ? (from + size) < approximateCount : response.entities.length === size;

  const assets = response.entities.map((e) => {
    // Safety check for missing attributes
    const attributes = e.attributes || {};
    const name = (attributes.name as string | undefined) || e.typeName || e.guid || 'Unknown';
    const qualifiedName = (attributes.qualifiedName as string | undefined) || name;
    
    return {
      guid: e.guid,
      name,
      qualifiedName,
      typeName: e.typeName || 'Unknown',
      connectorName: (attributes.connectorName as string | undefined) || (attributes.connectionName as string | undefined),
      // Hierarchy info
      databaseName: attributes.databaseName as string | undefined,
      databaseQualifiedName: attributes.databaseQualifiedName as string | undefined,
      schemaName: attributes.schemaName as string | undefined,
      schemaQualifiedName: attributes.schemaQualifiedName as string | undefined,
      attributes: attributes,
      // Map relationships if present
      relationships: {
        columns: attributes.columns as AtlanRelationship[] | undefined,
        tables: attributes.tables as AtlanRelationship[] | undefined,
        views: attributes.views as AtlanRelationship[] | undefined,
        schemas: attributes.schemas as AtlanRelationship[] | undefined,
        database: attributes.database as AtlanRelationship | undefined,
        schema: attributes.schema as AtlanRelationship | undefined,
        table: attributes.table as AtlanRelationship | undefined,
        view: attributes.view as AtlanRelationship | undefined,
      },
    };
  });

  return {
    assets,
    approximateCount,
    hasMore,
  };
}

/**
 * Backward-compatible wrapper that returns just the assets array
 * @deprecated Use fetchAssetsForModel directly to get pagination info
 */
export async function fetchAssetsForModelLegacy(options?: Parameters<typeof fetchAssetsForModel>[0]): Promise<AtlanAssetSummary[]> {
  const result = await fetchAssetsForModel(options);
  return result.assets;
}

// ============================================
// HIERARCHY FETCHING (for scope selector)
// ============================================

export interface HierarchyItem {
  guid: string;
  name: string;
  qualifiedName: string;
  typeName: string;
  childCount?: number;
}

/**
 * Get databases for a connector
 */
export async function getDatabases(connector: string): Promise<HierarchyItem[]> {
  const response = await search({
    dsl: {
      size: 100,
      query: {
        bool: {
          must: [
            { term: { 'connectorName': connector } },
            { terms: { '__typeName.keyword': ['Database', 'SnowflakeDatabase', 'DatabricksDatabase', 'BigQueryDataset', 'RedshiftDatabase'] } },
          ],
          must_not: [{ term: { '__state': 'DELETED' } }],
        },
      },
    },
    attributes: ['name', 'qualifiedName', 'schemaCount'],
  });

  return (response?.entities || []).map((e) => ({
    guid: e.guid,
    name: e.attributes.name as string || e.typeName,
    qualifiedName: e.attributes.qualifiedName as string || e.guid,
    typeName: e.typeName,
    childCount: e.attributes.schemaCount as number | undefined,
  }));
}

/**
 * Get schemas for a database
 */
export async function getSchemas(databaseQualifiedName: string): Promise<HierarchyItem[]> {
  const response = await search({
    dsl: {
      size: 100,
      query: {
        bool: {
          must: [
            { term: { 'databaseQualifiedName': databaseQualifiedName } },
            { terms: { '__typeName.keyword': ['Schema', 'SnowflakeSchema', 'DatabricksSchema', 'RedshiftSchema'] } },
          ],
          must_not: [{ term: { '__state': 'DELETED' } }],
        },
      },
    },
    attributes: ['name', 'qualifiedName', 'tableCount', 'viewCount'],
  });

  return (response?.entities || []).map((e) => ({
    guid: e.guid,
    name: e.attributes.name as string || e.typeName,
    qualifiedName: e.attributes.qualifiedName as string || e.guid,
    typeName: e.typeName,
    childCount: ((e.attributes.tableCount as number) || 0) + ((e.attributes.viewCount as number) || 0),
  }));
}

/**
 * Get tables/views for a schema (scoped fetch for canvas)
 */
export async function getTablesForSchema(schemaQualifiedName: string): Promise<AtlanAssetSummary[]> {
  const result = await fetchAssetsForModel({
    schemaQualifiedName,
    assetTypes: ['Table', 'View', 'MaterializedView', 'SnowflakeTable', 'SnowflakeView', 'SnowflakeDynamicTable', 'DatabricksTable', 'DatabricksView'],
    size: 200,
  });
  return result.assets;
}

// ============================================
// BATCH FETCHING WITH RETRY LOGIC
// Robust API calls for enrichment workflows
// ============================================

/**
 * Sleep utility that respects AbortSignal
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (!signal) return new Promise((r) => setTimeout(r, ms));
  if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Split array into chunks of given size
 */
function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Execute function with exponential backoff retry on retryable errors
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  options: { signal?: AbortSignal; maxAttempts: number; baseDelayMs: number }
): Promise<T> {
  const { signal, maxAttempts, baseDelayMs } = options;
  let attempt = 0;
  for (;;) {
    attempt += 1;
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      return await fn();
    } catch (err: unknown) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      const status = typeof (err as { status?: number })?.status === 'number'
        ? (err as { status: number }).status
        : undefined;
      const message = err instanceof Error ? err.message : '';
      const isRetryable = status === 429 || (typeof status === 'number' && status >= 500) || message.includes('Proxy server not running');
      const canRetry = isRetryable && attempt < maxAttempts;
      if (!canRetry) throw err;

      const jitter = 0.5 + Math.random(); // 0.5x..1.5x
      const delay = Math.round(baseDelayMs * Math.pow(2, attempt - 1) * jitter);
      await sleep(delay, signal);
    }
  }
}

// ============================================
// IN-MEMORY ASSET CACHE
// Avoids repeated fetches during enrichment
// ============================================

const assetCacheByGuid = new Map<string, AtlanAssetSummary>();
const assetNegativeGuid = new Set<string>();

/**
 * Reset the asset cache (call when starting fresh import)
 */
export function resetAtlanAssetCache(): void {
  assetCacheByGuid.clear();
  assetNegativeGuid.clear();
}

/**
 * Convert AtlanEntity to AtlanAssetSummary
 */
function toAssetSummary(e: AtlanEntity): AtlanAssetSummary {
  return {
    guid: e.guid,
    name: (e.attributes.name as string | undefined) || e.typeName || e.guid,
    qualifiedName:
      (e.attributes.qualifiedName as string | undefined) ||
      (e.attributes.name as string | undefined) ||
      e.guid,
    typeName: e.typeName,
    connectorName:
      (e.attributes.connectorName as string | undefined) ||
      (e.attributes.connectionName as string | undefined),
    databaseName: e.attributes.databaseName as string | undefined,
    databaseQualifiedName: e.attributes.databaseQualifiedName as string | undefined,
    schemaName: e.attributes.schemaName as string | undefined,
    schemaQualifiedName: e.attributes.schemaQualifiedName as string | undefined,
    attributes: e.attributes,
    relationships: {
      columns: e.attributes.columns as AtlanRelationship[] | undefined,
      tables: e.attributes.tables as AtlanRelationship[] | undefined,
      views: e.attributes.views as AtlanRelationship[] | undefined,
      schemas: e.attributes.schemas as AtlanRelationship[] | undefined,
      database: e.attributes.database as AtlanRelationship | undefined,
      schema: e.attributes.schema as AtlanRelationship | undefined,
      table: e.attributes.table as AtlanRelationship | undefined,
      view: e.attributes.view as AtlanRelationship | undefined,
    },
  };
}

/**
 * Fetch assets by their GUIDs
 */
export async function fetchAssetsByGuids(options: {
  guids: string[];
  attributes?: string[];
  relationAttributes?: string[];
  signal?: AbortSignal;
}): Promise<AtlanAssetSummary[]> {
  const guids = (options.guids || []).filter(Boolean);
  if (guids.length === 0) return [];

  const response = await search({
    dsl: {
      size: Math.min(guids.length, 2000),
      query: {
        bool: {
          must_not: [{ term: { '__state': 'DELETED' } }],
          // Try multiple potential guid fields
          should: [
            { terms: { guid: guids } },
            { terms: { 'guid.keyword': guids } },
            { terms: { __guid: guids } },
            { terms: { '__guid.keyword': guids } },
          ],
          minimum_should_match: 1,
        },
      },
    },
    attributes:
      options.attributes || [
        'name',
        'qualifiedName',
        'description',
        'userDescription',
        'connectorName',
        'connectionName',
        'connectionQualifiedName',
        'certificateStatus',
        'ownerUsers',
        'ownerGroups',
        'atlanTags',
        'meanings',
        '__typeName',
        'databaseName',
        'databaseQualifiedName',
        'schemaName',
        'schemaQualifiedName',
        'tableName',
        'tableQualifiedName',
        'viewName',
        'viewQualifiedName',
        'columnCount',
        'rowCount',
        'tableCount',
        'viewCount',
        'schemaCount',
        'dataType',
        'order',
        'isNullable',
        'isPrimary',
        '__hasLineage',
        'businessAttributes',
      ],
    relationAttributes:
      options.relationAttributes || [
        'columns',
        'tables',
        'views',
        'schemas',
        'database',
        'schema',
        'table',
        'view',
        'inputToProcesses',
        'outputFromProcesses',
      ],
  });

  if (!response?.entities) return [];
  return response.entities.map(toAssetSummary);
}

export interface BatchFetchOptions {
  guids: string[];
  attributes?: string[];
  relationAttributes?: string[];
  signal?: AbortSignal;
  /** Batch size for each API call (default: 150) */
  batchSize?: number;
  /** Number of concurrent batches (default: 3) */
  concurrency?: number;
  /** Max retry attempts per batch (default: 3) */
  maxAttempts?: number;
  /** Base delay for exponential backoff in ms (default: 300) */
  baseDelayMs?: number;
  /** Use in-memory cache (default: true) */
  useCache?: boolean;
  /** Progress callback */
  onBatchResult?: (info: { batchIndex: number; batchCount: number; fetchedCount: number }) => void;
}

/**
 * Fetch assets by GUIDs with batching, caching, and retry logic
 * Optimized for large enrichment workflows
 */
export async function fetchAssetsByGuidsBatched(options: BatchFetchOptions): Promise<AtlanAssetSummary[]> {
  const signal = options.signal;
  const norm = (s: string) => (s || '').toString().toLowerCase();

  const batchSize = options.batchSize ?? 150;
  const concurrency = options.concurrency ?? 3;
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 300;
  const useCache = options.useCache ?? true;

  const inputGuids = (options.guids || []).filter(Boolean);
  // Dedup for fetching while preserving original case
  const representativeByKey = new Map<string, string>();
  inputGuids.forEach((g) => {
    const key = norm(g);
    if (!key) return;
    if (!representativeByKey.has(key)) representativeByKey.set(key, g);
  });
  const uniqueKeys = Array.from(representativeByKey.keys());
  if (uniqueKeys.length === 0) return [];

  const results: AtlanAssetSummary[] = [];
  const toFetch: string[] = [];

  uniqueKeys.forEach((key) => {
    if (useCache) {
      if (assetCacheByGuid.has(key)) {
        results.push(assetCacheByGuid.get(key)!);
        return;
      }
      if (assetNegativeGuid.has(key)) return;
    }
    toFetch.push(representativeByKey.get(key)!);
  });

  if (toFetch.length === 0) return results;

  const batches = chunkArray(toFetch, batchSize);
  let nextIdx = 0;

  const worker = async () => {
    while (true) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const idx = nextIdx++;
      if (idx >= batches.length) return;
      const batch = batches[idx];

      const fetched = await withRetry(
        async () => {
          return await fetchAssetsByGuids({
            guids: batch,
            attributes: options.attributes,
            relationAttributes: options.relationAttributes,
            signal,
          });
        },
        { signal, maxAttempts, baseDelayMs }
      );

      const fetchedByGuid = new Map<string, AtlanAssetSummary>();
      fetched.forEach((a) => fetchedByGuid.set(norm(a.guid), a));

      batch.forEach((g) => {
        const a = fetchedByGuid.get(norm(g));
        if (useCache) {
          if (a) assetCacheByGuid.set(norm(g), a);
          else assetNegativeGuid.add(norm(g));
        }
      });

      results.push(...fetched);
      if (typeof options.onBatchResult === 'function') {
        options.onBatchResult({ batchIndex: idx, batchCount: batches.length, fetchedCount: fetched.length });
      }
    }
  };

  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, batches.length)) }, () => worker());
  await Promise.all(workers);

  // Dedup in case multiple inputs map to the same guid
  const seen = new Set<string>();
  return results.filter((a) => {
    const k = norm(a.guid);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ============================================
// LINEAGE API
// Fetch upstream/downstream lineage for assets
// See: https://developer.atlan.com/snippets/common-examples/lineage/traverse/
// ============================================

export interface LineageAsset {
  guid: string;
  typeName: string;
  qualifiedName: string;
  name: string;
  displayText?: string;
  attributes?: Record<string, unknown>;
  // Metadata coverage indicators
  hasDescription?: boolean;
  hasOwner?: boolean;
  hasTags?: boolean;
  hasTerms?: boolean;
  hasCertificate?: boolean;
  certificateStatus?: string;
  // Counts
  ownerCount?: number;
  tagCount?: number;
  termCount?: number;
}

export interface LineageResult {
  baseEntityGuid: string;
  upstream: LineageAsset[];
  downstream: LineageAsset[];
  hasMoreUpstream: boolean;
  hasMoreDownstream: boolean;
}

/**
 * Fetch lineage for an asset (upstream or downstream)
 * @param guid - The GUID of the asset to get lineage for
 * @param direction - 'INPUT' for upstream, 'OUTPUT' for downstream
 * @param depth - How many hops to traverse (default 3)
 * @param size - Number of results per page (default 50)
 */
export async function fetchLineage(
  guid: string,
  direction: 'INPUT' | 'OUTPUT',
  depth: number = 3,
  size: number = 50
): Promise<LineageAsset[]> {
  if (!config) {
    throw new Error('Atlan API not configured');
  }

  const body = {
    guid,
    depth,
    direction,
    from: 0,
    size,
    attributes: [
      'name',
      'qualifiedName',
      'description',
      'userDescription',
      'ownerUsers',
      'ownerGroups',
      'certificateStatus',
      'atlanTags',
      'meanings',
      '__hasLineage',
    ],
    immediateNeighbors: true,
  };

  console.log(`[AtlanAPI] Fetching ${direction === 'INPUT' ? 'upstream' : 'downstream'} lineage for:`, guid);

  const response = await fetch(`${PROXY_URL}/proxy/api/meta/lineage/list`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Atlan-URL': config.baseUrl,
      'X-Atlan-API-Key': config.apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[AtlanAPI] Lineage fetch failed:', response.status, errorText);
    throw new Error(`Lineage fetch failed: ${response.status}`);
  }

  const data = await response.json();

  // Parse lineage results
  const assets: LineageAsset[] = [];

  // The API returns entities in the response
  if (data.entities && Array.isArray(data.entities)) {
    data.entities.forEach((entity: Record<string, unknown>) => {
      if (entity.guid !== guid) { // Exclude the base entity
        const attrs = entity.attributes as Record<string, unknown> || {};

        // Extract metadata coverage info
        const description = attrs.description || attrs.userDescription;
        const ownerUsers = attrs.ownerUsers as string[] || [];
        const ownerGroups = attrs.ownerGroups as string[] || [];
        const atlanTags = attrs.atlanTags as unknown[] || [];
        const meanings = attrs.meanings as unknown[] || [];
        const certificateStatus = attrs.certificateStatus as string | undefined;

        assets.push({
          guid: entity.guid as string,
          typeName: entity.typeName as string,
          qualifiedName: attrs.qualifiedName as string || '',
          name: attrs.name as string || entity.displayText as string || '',
          displayText: entity.displayText as string,
          attributes: attrs,
          // Metadata coverage indicators
          hasDescription: !!description && String(description).trim().length > 0,
          hasOwner: ownerUsers.length > 0 || ownerGroups.length > 0,
          hasTags: atlanTags.length > 0,
          hasTerms: meanings.length > 0,
          hasCertificate: !!certificateStatus,
          certificateStatus,
          // Counts
          ownerCount: ownerUsers.length + ownerGroups.length,
          tagCount: atlanTags.length,
          termCount: meanings.length,
        });
      }
    });
  }

  console.log(`[AtlanAPI] Found ${assets.length} ${direction === 'INPUT' ? 'upstream' : 'downstream'} assets`);
  return assets;
}

/**
 * Fetch both upstream and downstream lineage for an asset
 */
export async function fetchFullLineage(
  guid: string,
  depth: number = 3,
  size: number = 50
): Promise<LineageResult> {
  const [upstream, downstream] = await Promise.all([
    fetchLineage(guid, 'INPUT', depth, size).catch((err) => {
      console.warn('[AtlanAPI] Failed to fetch upstream lineage:', err);
      return [];
    }),
    fetchLineage(guid, 'OUTPUT', depth, size).catch((err) => {
      console.warn('[AtlanAPI] Failed to fetch downstream lineage:', err);
      return [];
    }),
  ]);

  return {
    baseEntityGuid: guid,
    upstream,
    downstream,
    hasMoreUpstream: upstream.length >= size,
    hasMoreDownstream: downstream.length >= size,
  };
}

// ============================================
// POPULARITY / DISCOVERABILITY METRICS
// Fetch usage metrics for assets
// ============================================

export interface AssetPopularity {
  guid: string;
  viewCount?: number;
  queryCount?: number;
  userCount?: number;
  lastAccessedAt?: string;
  popularityScore?: number;
}

/**
 * Fetch popularity metrics for an asset
 * Note: Popularity data may not be available for all assets
 */
export async function fetchAssetPopularity(guid: string): Promise<AssetPopularity | null> {
  if (!config) {
    throw new Error('Atlan API not configured');
  }

  // Fetch the asset with popularity attributes
  const body = {
    dsl: {
      from: 0,
      size: 1,
      query: {
        bool: {
          filter: [
            { term: { __guid: guid } },
          ],
        },
      },
    },
    attributes: [
      'name',
      'popularityScore',
      'viewerUsers',
      'viewerGroups',
      'viewCount',
      'queryCount',
      'queryUserCount',
      'lastSyncRunAt',
      'sourceLastAccessedAt',
    ],
  };

  try {
    const response = await fetch(`${PROXY_URL}/proxy/api/meta/search/indexsearch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Atlan-URL': config.baseUrl,
        'X-Atlan-API-Key': config.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const entity = data.entities?.[0];

    if (!entity) {
      return null;
    }

    const attrs = entity.attributes || {};
    return {
      guid,
      viewCount: attrs.viewCount as number | undefined,
      queryCount: attrs.queryCount as number | undefined,
      userCount: attrs.queryUserCount as number | undefined,
      lastAccessedAt: attrs.sourceLastAccessedAt as string | undefined,
      popularityScore: attrs.popularityScore as number | undefined,
    };
  } catch (err) {
    console.warn('[AtlanAPI] Failed to fetch popularity:', err);
    return null;
  }
}
