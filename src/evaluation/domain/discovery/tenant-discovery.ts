/**
 * Tenant Discovery Service
 *
 * Discovers the schema of a customer's Atlan instance:
 * - Entity types and their attributes
 * - Custom metadata definitions
 * - Classifications
 * - Domains
 * - Glossaries
 * - Field population statistics
 */

import type {
  TenantSchemaSnapshot,
  EntityTypeDefinition,
  CustomMetadataDefinition,
  ClassificationDefinition,
  DomainDefinition,
  GlossaryDefinition,
  FieldPopulationStats,
  DiscoveryOptions,
} from './types';

// =============================================================================
// ATLAN API TYPES
// =============================================================================

interface AtlanTypeDefsResponse {
  entityDefs?: Array<{
    name: string;
    displayName?: string;
    description?: string;
    attributeDefs?: Array<{ name: string; typeName?: string }>;
    relationshipAttributeDefs?: Array<{ name: string }>;
    superTypes?: string[];
  }>;
  businessMetadataDefs?: Array<{
    name: string;
    displayName?: string;
    description?: string;
    attributeDefs?: Array<{
      name: string;
      displayName?: string;
      typeName?: string;
      options?: {
        enumType?: string;
        multiValueSelect?: string;
        isEnum?: string;
        applicableEntityTypes?: string;
      };
    }>;
  }>;
  classificationDefs?: Array<{
    name: string;
    displayName?: string;
    description?: string;
    superTypes?: string[];
    entityTypes?: string[];
  }>;
}

interface AtlanSearchResponse {
  approximateCount?: number;
  entities?: Array<{
    guid?: string;
    typeName?: string;
    attributes?: Record<string, unknown>;
    relationshipAttributes?: Record<string, unknown>;
  }>;
}

// =============================================================================
// DEFAULT OPTIONS
// =============================================================================

const DEFAULT_DISCOVERY_OPTIONS: Required<DiscoveryOptions> = {
  includeEntityTypes: true,
  includeCustomMetadata: true,
  includeClassifications: true,
  includeDomains: true,
  includeGlossaries: true,
  sampleFieldPopulation: true,
  sampleSize: 100,
  sampleAssetTypes: ['Table', 'View', 'Column'],
  entityTypeFilter: [],
  customMetadataFilter: [],
  useCache: true,
  cacheTtlMs: 5 * 60 * 1000, // 5 minutes
};

// =============================================================================
// DISCOVERY FUNCTIONS
// =============================================================================

/**
 * Discover entity type definitions from Atlan
 */
export async function discoverEntityTypes(
  baseUrl: string,
  apiToken: string,
  options?: { filter?: string[] }
): Promise<Record<string, EntityTypeDefinition>> {
  const response = await fetch(`${baseUrl}/api/meta/types/typedefs?type=entity`, {
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch entity types: ${response.status}`);
  }

  const data = await response.json() as AtlanTypeDefsResponse;
  const entityDefs = data.entityDefs || [];

  // Build lookup map for inheritance resolution
  const defMap = new Map(entityDefs.map(def => [def.name, def]));

  // Collect all attributes including inherited ones
  const collectAttributes = (typeName: string, seen: Set<string>): string[] => {
    const def = defMap.get(typeName);
    if (!def || seen.has(typeName)) return [];
    seen.add(typeName);

    const attrs: string[] = [];
    // Add own attributes
    (def.attributeDefs || []).forEach(attr => attrs.push(attr.name));
    // Add inherited attributes
    (def.superTypes || []).forEach(parent => {
      attrs.push(...collectAttributes(parent, seen));
    });
    return attrs;
  };

  const collectRelationshipAttributes = (typeName: string, seen: Set<string>): string[] => {
    const def = defMap.get(typeName);
    if (!def || seen.has(typeName)) return [];
    seen.add(typeName);

    const attrs: string[] = [];
    (def.relationshipAttributeDefs || []).forEach(attr => attrs.push(attr.name));
    (def.superTypes || []).forEach(parent => {
      attrs.push(...collectRelationshipAttributes(parent, seen));
    });
    return attrs;
  };

  // Build result
  const result: Record<string, EntityTypeDefinition> = {};
  for (const def of entityDefs) {
    // Apply filter if provided
    if (options?.filter && options.filter.length > 0) {
      if (!options.filter.includes(def.name)) continue;
    }

    result[def.name] = {
      name: def.name,
      displayName: def.displayName || def.name,
      description: def.description,
      attributes: [...new Set(collectAttributes(def.name, new Set()))],
      relationshipAttributes: [...new Set(collectRelationshipAttributes(def.name, new Set()))],
      superTypes: def.superTypes || [],
    };
  }

  return result;
}

/**
 * Discover custom metadata definitions from Atlan
 */
export async function discoverCustomMetadata(
  baseUrl: string,
  apiToken: string,
  options?: { filter?: string[] }
): Promise<Record<string, CustomMetadataDefinition>> {
  const response = await fetch(`${baseUrl}/api/meta/types/typedefs?type=business_metadata`, {
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    // Business metadata might not be available in all instances
    if (response.status === 404) {
      return {};
    }
    throw new Error(`Failed to fetch custom metadata: ${response.status}`);
  }

  const data = await response.json() as AtlanTypeDefsResponse;
  const cmDefs = data.businessMetadataDefs || [];

  const result: Record<string, CustomMetadataDefinition> = {};
  for (const def of cmDefs) {
    // Apply filter if provided
    if (options?.filter && options.filter.length > 0) {
      if (!options.filter.includes(def.name)) continue;
    }

    const attributes = (def.attributeDefs || []).map(attr => {
      // Parse type from typeName
      let type: 'string' | 'boolean' | 'number' | 'date' | 'enum' | 'user' | 'group' | 'asset' = 'string';
      const typeName = attr.typeName?.toLowerCase() || '';
      if (typeName.includes('boolean')) type = 'boolean';
      else if (typeName.includes('int') || typeName.includes('float') || typeName.includes('double') || typeName.includes('long')) type = 'number';
      else if (typeName.includes('date')) type = 'date';
      else if (attr.options?.isEnum === 'true') type = 'enum';

      // Parse applicable entity types
      let applicableTypes: string[] = [];
      if (attr.options?.applicableEntityTypes) {
        try {
          applicableTypes = JSON.parse(attr.options.applicableEntityTypes);
        } catch {
          // Ignore parse errors
        }
      }

      return {
        name: attr.name,
        displayName: attr.displayName || attr.name,
        type,
        enumValues: type === 'enum' ? [] : undefined, // Would need additional fetch
        multiValued: attr.options?.multiValueSelect === 'true',
      };
    });

    result[def.name] = {
      name: def.name,
      displayName: def.displayName || def.name,
      description: def.description,
      applicableTypes: [], // Would need to aggregate from attributes
      attributes,
    };
  }

  return result;
}

/**
 * Discover classifications from Atlan
 */
export async function discoverClassifications(
  baseUrl: string,
  apiToken: string
): Promise<ClassificationDefinition[]> {
  const response = await fetch(`${baseUrl}/api/meta/types/typedefs?type=classification`, {
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch classifications: ${response.status}`);
  }

  const data = await response.json() as AtlanTypeDefsResponse;
  const classificationDefs = data.classificationDefs || [];

  return classificationDefs.map(def => ({
    name: def.name,
    displayName: def.displayName || def.name,
    description: def.description,
    superTypes: def.superTypes || [],
    entityTypes: def.entityTypes,
  }));
}

/**
 * Discover domains from Atlan
 */
export async function discoverDomains(
  baseUrl: string,
  apiToken: string
): Promise<DomainDefinition[]> {
  const payload = {
    dsl: {
      from: 0,
      size: 100,
      query: {
        bool: {
          must: [
            { term: { '__typeName.keyword': 'DataDomain' } },
          ],
          must_not: [
            { term: { '__state': 'DELETED' } },
          ],
        },
      },
    },
    attributes: ['name', 'qualifiedName', 'parentDomainQualifiedName', 'description'],
  };

  const response = await fetch(`${baseUrl}/api/meta/search/indexsearch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken}`,
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    // Domains might not exist
    if (response.status === 404) {
      return [];
    }
    throw new Error(`Failed to fetch domains: ${response.status}`);
  }

  const data = await response.json() as AtlanSearchResponse;
  const entities = data.entities || [];

  return entities.map(entity => ({
    guid: entity.guid || '',
    name: entity.attributes?.name as string || '',
    qualifiedName: entity.attributes?.qualifiedName as string || '',
    parentGuid: entity.attributes?.parentDomainQualifiedName as string | null || null,
    description: entity.attributes?.description as string | undefined,
  }));
}

/**
 * Discover glossaries from Atlan
 */
export async function discoverGlossaries(
  baseUrl: string,
  apiToken: string
): Promise<GlossaryDefinition[]> {
  const payload = {
    dsl: {
      from: 0,
      size: 100,
      query: {
        bool: {
          must: [
            { term: { '__typeName.keyword': 'AtlasGlossary' } },
          ],
          must_not: [
            { term: { '__state': 'DELETED' } },
          ],
        },
      },
    },
    attributes: ['name', 'qualifiedName', 'termCount', 'categoryCount'],
  };

  const response = await fetch(`${baseUrl}/api/meta/search/indexsearch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken}`,
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    if (response.status === 404) {
      return [];
    }
    throw new Error(`Failed to fetch glossaries: ${response.status}`);
  }

  const data = await response.json() as AtlanSearchResponse;
  const entities = data.entities || [];

  return entities.map(entity => ({
    guid: entity.guid || '',
    name: entity.attributes?.name as string || '',
    qualifiedName: entity.attributes?.qualifiedName as string || '',
    termCount: entity.attributes?.termCount as number || 0,
    categoryCount: entity.attributes?.categoryCount as number || 0,
  }));
}

/**
 * Sample field population rates
 */
export async function sampleFieldPopulation(
  baseUrl: string,
  apiToken: string,
  assetTypes: string[],
  attributes: string[],
  sampleSize: number = 100
): Promise<FieldPopulationStats[]> {
  const results: FieldPopulationStats[] = [];

  for (const assetType of assetTypes) {
    // Get total count
    const countPayload = {
      dsl: {
        from: 0,
        size: 0,
        query: {
          bool: {
            must: [{ term: { '__typeName.keyword': assetType } }],
            must_not: [{ term: { '__state': 'DELETED' } }],
          },
        },
      },
    };

    const countResponse = await fetch(`${baseUrl}/api/meta/search/indexsearch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`,
        'Accept': 'application/json',
      },
      body: JSON.stringify(countPayload),
    });

    if (!countResponse.ok) continue;

    const countData = await countResponse.json() as AtlanSearchResponse;
    const totalAssets = countData.approximateCount || 0;

    // Sample for each attribute
    for (const attr of attributes) {
      const populatedPayload = {
        dsl: {
          from: 0,
          size: 0,
          query: {
            bool: {
              must: [
                { term: { '__typeName.keyword': assetType } },
                { exists: { field: attr } },
              ],
              must_not: [{ term: { '__state': 'DELETED' } }],
            },
          },
        },
      };

      const populatedResponse = await fetch(`${baseUrl}/api/meta/search/indexsearch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`,
          'Accept': 'application/json',
        },
        body: JSON.stringify(populatedPayload),
      });

      if (!populatedResponse.ok) continue;

      const populatedData = await populatedResponse.json() as AtlanSearchResponse;
      const populatedAssets = populatedData.approximateCount || 0;

      results.push({
        attributeName: attr,
        assetType,
        totalAssets,
        populatedAssets,
        populationRate: totalAssets > 0 ? populatedAssets / totalAssets : 0,
      });
    }
  }

  return results;
}

// =============================================================================
// MAIN DISCOVERY FUNCTION
// =============================================================================

/**
 * Discover complete tenant schema
 */
export async function discoverTenantSchema(
  baseUrl: string,
  apiToken: string,
  tenantId: string,
  options: DiscoveryOptions = {}
): Promise<TenantSchemaSnapshot> {
  const opts = { ...DEFAULT_DISCOVERY_OPTIONS, ...options };

  // Parallel discovery of different components
  const [entityTypes, customMetadata, classifications, domains, glossaries] = await Promise.all([
    opts.includeEntityTypes
      ? discoverEntityTypes(baseUrl, apiToken, { filter: opts.entityTypeFilter })
      : Promise.resolve({}),
    opts.includeCustomMetadata
      ? discoverCustomMetadata(baseUrl, apiToken, { filter: opts.customMetadataFilter })
      : Promise.resolve({}),
    opts.includeClassifications
      ? discoverClassifications(baseUrl, apiToken)
      : Promise.resolve([]),
    opts.includeDomains
      ? discoverDomains(baseUrl, apiToken)
      : Promise.resolve([]),
    opts.includeGlossaries
      ? discoverGlossaries(baseUrl, apiToken)
      : Promise.resolve([]),
  ]);

  // Sample field population if requested
  let fieldPopulation: FieldPopulationStats[] = [];
  if (opts.sampleFieldPopulation) {
    // Get key attributes to sample
    const attributesToSample = [
      'ownerUsers', 'ownerGroups', 'description', 'userDescription',
      'readme', 'certificateStatus', '__hasLineage', 'classificationNames',
      'popularityScore', 'assetPoliciesCount',
    ];

    fieldPopulation = await sampleFieldPopulation(
      baseUrl,
      apiToken,
      opts.sampleAssetTypes,
      attributesToSample,
      opts.sampleSize
    );
  }

  return {
    tenantId,
    baseUrl,
    discoveredAt: new Date().toISOString(),
    entityTypes,
    customMetadata,
    classifications,
    domains,
    glossaries,
    fieldPopulation,
    discoveryStats: {
      entityTypeCount: Object.keys(entityTypes).length,
      customMetadataCount: Object.keys(customMetadata).length,
      classificationCount: classifications.length,
      domainCount: domains.length,
      glossaryCount: glossaries.length,
      totalAssetsSampled: fieldPopulation.reduce((sum, fp) => Math.max(sum, fp.totalAssets), 0),
    },
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if an attribute exists in any entity type
 */
export function attributeExistsInSchema(
  snapshot: TenantSchemaSnapshot,
  attributeName: string,
  entityTypes?: string[]
): boolean {
  const typesToCheck = entityTypes || Object.keys(snapshot.entityTypes);

  for (const typeName of typesToCheck) {
    const entityType = snapshot.entityTypes[typeName];
    if (!entityType) continue;

    if (entityType.attributes.includes(attributeName)) {
      return true;
    }
    if (entityType.relationshipAttributes.includes(attributeName)) {
      return true;
    }
  }

  return false;
}

/**
 * Find custom metadata containing an attribute
 */
export function findCustomMetadataWithAttribute(
  snapshot: TenantSchemaSnapshot,
  attributeName: string
): Array<{ cmName: string; attrName: string }> {
  const results: Array<{ cmName: string; attrName: string }> = [];

  for (const [cmName, cmDef] of Object.entries(snapshot.customMetadata)) {
    for (const attr of cmDef.attributes) {
      if (attr.name.toLowerCase() === attributeName.toLowerCase() ||
          attr.displayName.toLowerCase() === attributeName.toLowerCase()) {
        results.push({ cmName, attrName: attr.name });
      }
    }
  }

  return results;
}

/**
 * Get population rate for an attribute
 */
export function getPopulationRate(
  snapshot: TenantSchemaSnapshot,
  attributeName: string,
  assetType?: string
): number | undefined {
  const stats = snapshot.fieldPopulation.find(fp =>
    fp.attributeName === attributeName &&
    (!assetType || fp.assetType === assetType)
  );

  return stats?.populationRate;
}
