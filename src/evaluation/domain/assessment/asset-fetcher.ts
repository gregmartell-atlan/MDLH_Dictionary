/**
 * Asset Fetcher
 *
 * Abstractions for fetching assets from Atlan.
 * Provides implementations for API-based fetching and mock/cached data.
 */

import type {
  AssessmentScope,
  AssetRecord,
  AssetFetcher,
  HierarchyPath,
} from './types';
import type { TenantConfiguration } from '../discovery/types';
import { buildScopeFilter, enrichAssetHierarchy, getDefaultAssetTypes } from './scope-resolver';

// =============================================================================
// ATLAN API FETCHER
// =============================================================================

/**
 * Atlan Search API response
 */
interface AtlanSearchResponse {
  approximateCount: number;
  entities: AtlanEntity[];
}

/**
 * Atlan entity from API
 */
interface AtlanEntity {
  guid: string;
  typeName: string;
  attributes: Record<string, unknown>;
  classificationNames?: string[];
  meanings?: Array<{ displayText: string; termGuid: string }>;
  businessAttributes?: Record<string, Record<string, unknown>>;
}

/**
 * API-based asset fetcher
 */
export class AtlanApiFetcher implements AssetFetcher {
  private baseUrl: string;
  private apiToken: string;

  constructor(baseUrl: string, apiToken: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiToken = apiToken;
  }

  async fetchAssets(
    scope: AssessmentScope,
    tenantConfig: TenantConfiguration
  ): Promise<AssetRecord[]> {
    const assetTypes = scope.assetTypes || getDefaultAssetTypes(scope.level);
    const filter = buildScopeFilter(scope);
    const limit = scope.sampleSize || 1000;

    // Build search request
    const searchRequest = {
      dsl: {
        from: 0,
        size: limit,
        query: this.buildQuery(filter, assetTypes),
        sort: [{ 'createTime': { order: 'desc' } }],
      },
      attributes: this.getRequiredAttributes(tenantConfig),
      relationAttributes: ['meanings'],
    };

    const response = await this.executeSearch(searchRequest);
    return response.entities.map(e => this.mapToAssetRecord(e));
  }

  async fetchAsset(
    guid: string,
    tenantConfig: TenantConfiguration
  ): Promise<AssetRecord | null> {
    const url = `${this.baseUrl}/api/meta/entity/guid/${guid}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch asset: ${response.statusText}`);
      }

      const data = await response.json() as { entity: AtlanEntity };
      return this.mapToAssetRecord(data.entity);
    } catch {
      // Asset fetch failed, return null
      return null;
    }
  }

  async countAssets(
    scope: AssessmentScope,
    tenantConfig: TenantConfiguration
  ): Promise<number> {
    const assetTypes = scope.assetTypes || getDefaultAssetTypes(scope.level);
    const filter = buildScopeFilter(scope);

    const searchRequest = {
      dsl: {
        from: 0,
        size: 0, // Count only
        query: this.buildQuery(filter, assetTypes),
      },
    };

    const response = await this.executeSearch(searchRequest);
    return response.approximateCount;
  }

  private buildQuery(
    filter: Record<string, unknown>,
    assetTypes: string[]
  ): Record<string, unknown> {
    const mustClauses: Array<Record<string, unknown>> = [];

    // Asset type filter
    mustClauses.push({
      terms: { '__typeName.keyword': assetTypes },
    });

    // Active assets only
    mustClauses.push({
      term: { '__state': 'ACTIVE' },
    });

    // Apply scope filters
    for (const [field, value] of Object.entries(filter)) {
      if (typeof value === 'object' && value !== null) {
        const v = value as Record<string, unknown>;
        if ('$in' in v) {
          mustClauses.push({ terms: { [`${field}.keyword`]: v['$in'] } });
        } else if ('$prefix' in v) {
          mustClauses.push({ prefix: { [`${field}.keyword`]: v['$prefix'] } });
        } else if ('$contains' in v) {
          mustClauses.push({ wildcard: { [`${field}.keyword`]: `*${v['$contains']}*` } });
        } else if ('$exists' in v) {
          mustClauses.push({ exists: { field } });
        }
      } else {
        mustClauses.push({ term: { [`${field}.keyword`]: value } });
      }
    }

    return {
      bool: { must: mustClauses },
    };
  }

  private getRequiredAttributes(tenantConfig: TenantConfiguration): string[] {
    // Base attributes always needed
    const attrs = [
      'qualifiedName',
      'name',
      'displayName',
      'description',
      'ownerUsers',
      'ownerGroups',
      'certificateStatus',
      'certificateStatusMessage',
      'userDescription',
      'readme',
      'createTime',
      'updateTime',
      'connectionQualifiedName',
      'databaseQualifiedName',
      'schemaQualifiedName',
    ];

    // Add mapped attributes from tenant config
    for (const mapping of tenantConfig.fieldMappings) {
      const source = mapping.tenantSource;
      if (source.type === 'native' || source.type === 'native_any') {
        if ('attribute' in source && !attrs.includes(source.attribute)) {
          attrs.push(source.attribute);
        }
        if ('attributes' in source) {
          for (const attr of source.attributes) {
            if (!attrs.includes(attr)) {
              attrs.push(attr);
            }
          }
        }
      }
    }

    return attrs;
  }

  private async executeSearch(
    request: Record<string, unknown>
  ): Promise<AtlanSearchResponse> {
    const url = `${this.baseUrl}/api/meta/search/indexsearch`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Search failed: ${response.statusText}`);
    }

    return response.json() as Promise<AtlanSearchResponse>;
  }

  private mapToAssetRecord(entity: AtlanEntity): AssetRecord {
    const attrs = entity.attributes;

    const record: AssetRecord = {
      guid: entity.guid,
      typeName: entity.typeName,
      qualifiedName: attrs['qualifiedName'] as string || '',
      displayName: attrs['displayName'] as string || attrs['name'] as string,
      attributes: attrs,
      classifications: entity.classificationNames || [],
      customMetadata: entity.businessAttributes || {},
    };

    // Build hierarchy path
    record.hierarchy = {
      connectionQualifiedName: attrs['connectionQualifiedName'] as string,
      connectionName: this.extractName(attrs['connectionQualifiedName'] as string),
      databaseQualifiedName: attrs['databaseQualifiedName'] as string,
      databaseName: this.extractName(attrs['databaseQualifiedName'] as string),
      schemaQualifiedName: attrs['schemaQualifiedName'] as string,
      schemaName: this.extractName(attrs['schemaQualifiedName'] as string),
    };

    return enrichAssetHierarchy(record);
  }

  private extractName(qualifiedName: string | undefined): string | undefined {
    if (!qualifiedName) return undefined;
    const parts = qualifiedName.split('/');
    return parts[parts.length - 1];
  }
}

// =============================================================================
// MOCK FETCHER (FOR TESTING)
// =============================================================================

/**
 * Mock asset fetcher for testing
 */
export class MockAssetFetcher implements AssetFetcher {
  private assets: AssetRecord[];

  constructor(assets: AssetRecord[] = []) {
    this.assets = assets;
  }

  /**
   * Add assets to the mock store
   */
  addAssets(assets: AssetRecord[]): void {
    this.assets.push(...assets);
  }

  /**
   * Clear all mock assets
   */
  clear(): void {
    this.assets = [];
  }

  async fetchAssets(
    scope: AssessmentScope,
    _tenantConfig: TenantConfiguration
  ): Promise<AssetRecord[]> {
    let filtered = this.assets;

    // Filter by asset types
    if (scope.assetTypes && scope.assetTypes.length > 0) {
      filtered = filtered.filter(a => scope.assetTypes!.includes(a.typeName));
    }

    // Filter by scope
    if (scope.level !== 'tenant' && scope.scopeId) {
      filtered = filtered.filter(a => {
        switch (scope.level) {
          case 'connection':
            return a.hierarchy?.connectionQualifiedName === scope.scopeId;
          case 'database':
            return a.hierarchy?.databaseQualifiedName === scope.scopeId;
          case 'schema':
            return a.hierarchy?.schemaQualifiedName === scope.scopeId;
          case 'table':
            return a.qualifiedName === scope.scopeId ||
                   a.qualifiedName.startsWith(scope.scopeId + '/');
          case 'domain':
            return a.hierarchy?.domainGuid === scope.scopeId;
          default:
            return true;
        }
      });
    }

    // Apply sample size
    if (scope.sampleSize && filtered.length > scope.sampleSize) {
      filtered = filtered.slice(0, scope.sampleSize);
    }

    return filtered;
  }

  async fetchAsset(
    guid: string,
    _tenantConfig: TenantConfiguration
  ): Promise<AssetRecord | null> {
    return this.assets.find(a => a.guid === guid) || null;
  }

  async countAssets(
    scope: AssessmentScope,
    tenantConfig: TenantConfiguration
  ): Promise<number> {
    const assets = await this.fetchAssets(scope, tenantConfig);
    return assets.length;
  }
}

// =============================================================================
// CACHED FETCHER (FOR PERFORMANCE)
// =============================================================================

/**
 * Caching wrapper around any fetcher
 */
export class CachedAssetFetcher implements AssetFetcher {
  private delegate: AssetFetcher;
  private cache: Map<string, { assets: AssetRecord[]; expires: number }>;
  private assetCache: Map<string, { asset: AssetRecord | null; expires: number }>;
  private ttlMs: number;

  constructor(delegate: AssetFetcher, ttlMs = 5 * 60 * 1000) {
    this.delegate = delegate;
    this.cache = new Map();
    this.assetCache = new Map();
    this.ttlMs = ttlMs;
  }

  async fetchAssets(
    scope: AssessmentScope,
    tenantConfig: TenantConfiguration
  ): Promise<AssetRecord[]> {
    const cacheKey = this.buildCacheKey(scope, tenantConfig);
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expires > Date.now()) {
      return cached.assets;
    }

    const assets = await this.delegate.fetchAssets(scope, tenantConfig);

    this.cache.set(cacheKey, {
      assets,
      expires: Date.now() + this.ttlMs,
    });

    return assets;
  }

  async fetchAsset(
    guid: string,
    tenantConfig: TenantConfiguration
  ): Promise<AssetRecord | null> {
    const cached = this.assetCache.get(guid);

    if (cached && cached.expires > Date.now()) {
      return cached.asset;
    }

    const asset = await this.delegate.fetchAsset(guid, tenantConfig);

    this.assetCache.set(guid, {
      asset,
      expires: Date.now() + this.ttlMs,
    });

    return asset;
  }

  async countAssets(
    scope: AssessmentScope,
    tenantConfig: TenantConfiguration
  ): Promise<number> {
    // Count is derived from fetchAssets for cached fetcher
    const assets = await this.fetchAssets(scope, tenantConfig);
    return assets.length;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
    this.assetCache.clear();
  }

  /**
   * Invalidate cache for a specific scope
   */
  invalidate(scope: AssessmentScope, tenantConfig: TenantConfiguration): void {
    const cacheKey = this.buildCacheKey(scope, tenantConfig);
    this.cache.delete(cacheKey);
  }

  private buildCacheKey(
    scope: AssessmentScope,
    tenantConfig: TenantConfiguration
  ): string {
    return JSON.stringify({
      tenantId: tenantConfig.tenantId,
      level: scope.level,
      scopeId: scope.scopeId,
      assetTypes: scope.assetTypes,
      sampleSize: scope.sampleSize,
      filters: scope.filters,
    });
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create an asset fetcher for a tenant
 */
export function createAssetFetcher(
  tenantConfig: TenantConfiguration,
  options?: {
    apiToken?: string;
    cache?: boolean;
    cacheTtlMs?: number;
  }
): AssetFetcher {
  const apiToken = options?.apiToken || '';

  if (!apiToken) {
    // No API token provided, return mock fetcher for testing
    return new MockAssetFetcher();
  }

  let fetcher: AssetFetcher = new AtlanApiFetcher(
    tenantConfig.baseUrl,
    apiToken
  );

  if (options?.cache !== false) {
    fetcher = new CachedAssetFetcher(fetcher, options?.cacheTtlMs);
  }

  return fetcher;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Create mock asset for testing
 */
export function createMockAsset(
  overrides: Partial<AssetRecord> & { guid: string }
): AssetRecord {
  return {
    typeName: 'Table',
    qualifiedName: `default/test/db/schema/${overrides.guid}`,
    displayName: `Test Asset ${overrides.guid}`,
    attributes: {},
    classifications: [],
    customMetadata: {},
    hierarchy: {
      connectionQualifiedName: 'default/test',
      connectionName: 'test',
      databaseQualifiedName: 'default/test/db',
      databaseName: 'db',
      schemaQualifiedName: 'default/test/db/schema',
      schemaName: 'schema',
    },
    ...overrides,
  };
}

/**
 * Create a batch of mock assets
 */
export function createMockAssets(count: number): AssetRecord[] {
  return Array.from({ length: count }, (_, i) =>
    createMockAsset({ guid: `asset-${i + 1}` })
  );
}
