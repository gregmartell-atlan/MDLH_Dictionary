/**
 * Import Analysis Utilities
 *
 * Functions for analyzing imported assets and generating suggestions
 * for pre-populating domain, taxonomy, and custom metadata structures.
 */

import type { CatalogAsset } from '../stores/catalogStore';

// Domain model types
export interface DomainSuggestion {
  id: string;
  name: string;
  description: string;
  assetCount: number;
  subDomains: DomainSuggestion[];
  qualifiedName?: string;
}

// Taxonomy types
export interface TaxonomySuggestion {
  name: string;
  typeName: string;
  count: number;
  children: TaxonomySuggestion[];
}

// Custom metadata schema types
export interface CustomMetadataAttributeSuggestion {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'enum';
  sampleValues: unknown[];
  count: number;
}

export interface CustomMetadataSchemaSuggestion {
  name: string;
  displayName: string;
  description: string;
  attributes: CustomMetadataAttributeSuggestion[];
  assetCount: number;
}

/**
 * Generate domain structure suggestions from asset hierarchy
 *
 * Creates a domain tree based on:
 * - Databases → top-level domains
 * - Schemas → sub-domains
 */
export function generateDomainSuggestions(assets: CatalogAsset[]): DomainSuggestion[] {
  const databaseMap = new Map<string, {
    name: string;
    qualifiedName?: string;
    assetCount: number;
    schemas: Map<string, { name: string; qualifiedName?: string; assetCount: number }>;
  }>();

  // Collect hierarchy information
  assets.forEach((asset) => {
    const dbName = asset.database || asset.databaseName;
    const dbQn = asset.databaseQualifiedName;
    const schemaName = asset.schema || asset.schemaName;
    const schemaQn = asset.schemaQualifiedName;

    if (dbName) {
      if (!databaseMap.has(dbName)) {
        databaseMap.set(dbName, {
          name: dbName,
          qualifiedName: dbQn,
          assetCount: 0,
          schemas: new Map(),
        });
      }

      const dbEntry = databaseMap.get(dbName)!;
      dbEntry.assetCount++;

      if (schemaName) {
        if (!dbEntry.schemas.has(schemaName)) {
          dbEntry.schemas.set(schemaName, {
            name: schemaName,
            qualifiedName: schemaQn,
            assetCount: 0,
          });
        }
        dbEntry.schemas.get(schemaName)!.assetCount++;
      }
    }
  });

  // Convert to domain suggestions
  const domains: DomainSuggestion[] = [];

  databaseMap.forEach((dbInfo, dbName) => {
    const subDomains: DomainSuggestion[] = [];

    dbInfo.schemas.forEach((schemaInfo, schemaName) => {
      subDomains.push({
        id: `domain-${dbName}-${schemaName}`.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        name: schemaName,
        description: `Assets from ${dbName}.${schemaName}`,
        assetCount: schemaInfo.assetCount,
        subDomains: [],
        qualifiedName: schemaInfo.qualifiedName,
      });
    });

    domains.push({
      id: `domain-${dbName}`.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      name: dbName,
      description: `Domain for ${dbName} database`,
      assetCount: dbInfo.assetCount,
      subDomains: subDomains.sort((a, b) => b.assetCount - a.assetCount),
      qualifiedName: dbInfo.qualifiedName,
    });
  });

  return domains.sort((a, b) => b.assetCount - a.assetCount);
}

/**
 * Generate taxonomy suggestions from existing tags
 *
 * Analyzes atlanTags attributes and builds a hierarchical taxonomy.
 * Tags with common prefixes are grouped together.
 */
export function generateTaxonomySuggestions(assets: CatalogAsset[]): TaxonomySuggestion[] {
  const tagMap = new Map<string, { typeName: string; count: number }>();

  // Collect all tags from attributes
  assets.forEach((asset) => {
    const tags = asset.attributes?.atlanTags;
    if (tags && Array.isArray(tags)) {
      tags.forEach((tag) => {
        const tagName = tag.typeName || 'Unknown';
        const existing = tagMap.get(tagName);
        tagMap.set(tagName, {
          typeName: tag.typeName || tagName,
          count: (existing?.count || 0) + 1,
        });
      });
    }
  });

  // Build hierarchy based on common prefixes
  const rootTags: TaxonomySuggestion[] = [];
  const processedTags = new Set<string>();

  // First pass: find potential parent tags (those that are prefixes of others)
  const tagNames = Array.from(tagMap.keys()).sort();

  tagNames.forEach((tagName) => {
    if (processedTags.has(tagName)) return;

    const tagInfo = tagMap.get(tagName)!;
    const children: TaxonomySuggestion[] = [];

    // Find tags that start with this tag name as a prefix
    tagNames.forEach((otherTag) => {
      if (otherTag !== tagName && (otherTag.startsWith(tagName + '-') || otherTag.startsWith(tagName + '_'))) {
        const otherInfo = tagMap.get(otherTag)!;
        children.push({
          name: otherTag.replace(new RegExp(`^${tagName}[-_]`), ''),
          typeName: otherInfo.typeName,
          count: otherInfo.count,
          children: [],
        });
        processedTags.add(otherTag);
      }
    });

    rootTags.push({
      name: tagName,
      typeName: tagInfo.typeName,
      count: tagInfo.count,
      children: children.sort((a, b) => b.count - a.count),
    });
    processedTags.add(tagName);
  });

  return rootTags.sort((a, b) => b.count - a.count);
}

/**
 * Generate custom metadata schema suggestions from business attributes
 *
 * Analyzes businessAttributes on assets and infers schema structures
 * with attribute types based on sample values.
 */
export function generateCustomMetadataSuggestions(
  assets: CatalogAsset[]
): CustomMetadataSchemaSuggestion[] {
  const schemaMap = new Map<string, {
    attributes: Map<string, {
      values: unknown[];
      count: number;
    }>;
    assetCount: number;
  }>();

  // Collect business attributes from the attributes object
  assets.forEach((asset) => {
    // Business attributes might be stored in a specific way in the attributes
    // Check for any keys that look like business attribute sets
    const attrs = asset.attributes;
    if (!attrs) return;

    // Look for business attributes pattern (often stored as nested objects)
    Object.entries(attrs).forEach(([key, value]) => {
      // Skip known standard attributes
      if (['name', 'qualifiedName', 'description', 'userDescription', 'ownerUsers',
           'ownerGroups', 'certificateStatus', 'connectorName', 'connectionName',
           '__hasLineage', 'meanings', 'atlanTags'].includes(key)) {
        return;
      }

      // If value is an object, it might be a business attribute set
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const setName = key;
        if (!schemaMap.has(setName)) {
          schemaMap.set(setName, { attributes: new Map(), assetCount: 0 });
        }

        const schema = schemaMap.get(setName)!;
        schema.assetCount++;

        Object.entries(value as Record<string, unknown>).forEach(([attrName, attrValue]) => {
          if (!schema.attributes.has(attrName)) {
            schema.attributes.set(attrName, { values: [], count: 0 });
          }

          const attr = schema.attributes.get(attrName)!;
          attr.count++;

          // Keep up to 5 sample values
          if (attr.values.length < 5 && attrValue !== null && attrValue !== undefined) {
            if (!attr.values.includes(attrValue)) {
              attr.values.push(attrValue);
            }
          }
        });
      }
    });
  });

  // Convert to suggestions
  const suggestions: CustomMetadataSchemaSuggestion[] = [];

  schemaMap.forEach((schemaInfo, setName) => {
    const attributes: CustomMetadataAttributeSuggestion[] = [];

    schemaInfo.attributes.forEach((attrInfo, attrName) => {
      attributes.push({
        name: attrName,
        type: inferAttributeType(attrInfo.values),
        sampleValues: attrInfo.values,
        count: attrInfo.count,
      });
    });

    suggestions.push({
      name: setName,
      displayName: formatDisplayName(setName),
      description: `Custom metadata schema from ${setName}`,
      attributes: attributes.sort((a, b) => b.count - a.count),
      assetCount: schemaInfo.assetCount,
    });
  });

  return suggestions.sort((a, b) => b.assetCount - a.assetCount);
}

/**
 * Infer attribute type from sample values
 */
function inferAttributeType(
  values: unknown[]
): 'string' | 'number' | 'boolean' | 'date' | 'enum' {
  if (values.length === 0) return 'string';

  const types = values.map((v) => {
    if (typeof v === 'boolean') return 'boolean';
    if (typeof v === 'number') return 'number';
    if (typeof v === 'string') {
      // Check if it's a date
      if (/^\d{4}-\d{2}-\d{2}/.test(v)) return 'date';
      return 'string';
    }
    return 'string';
  });

  // If all values are the same type
  const uniqueTypes = [...new Set(types)];
  if (uniqueTypes.length === 1) {
    return uniqueTypes[0] as 'string' | 'number' | 'boolean' | 'date';
  }

  // If we have a small set of string values, it might be an enum
  if (types.every(t => t === 'string') && values.length <= 5) {
    const uniqueValues = [...new Set(values as string[])];
    if (uniqueValues.length <= 10) {
      return 'enum';
    }
  }

  return 'string';
}

/**
 * Format a camelCase or snake_case name as display name
 */
function formatDisplayName(name: string): string {
  return name
    // Insert space before capitals
    .replace(/([A-Z])/g, ' $1')
    // Replace underscores and hyphens with spaces
    .replace(/[_-]/g, ' ')
    // Capitalize first letter
    .replace(/^\s*/, '')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

/**
 * Calculate metadata health score for a set of assets
 *
 * Returns a score from 0-100 based on:
 * - Owner coverage (25%)
 * - Description coverage (25%)
 * - Tag coverage (25%)
 * - Glossary term coverage (25%)
 */
export function calculateHealthScore(assets: CatalogAsset[]): number {
  if (assets.length === 0) return 0;

  const metrics = {
    owners: 0,
    descriptions: 0,
    tags: 0,
    terms: 0,
  };

  assets.forEach((asset) => {
    const attrs = asset.attributes;
    if (!attrs) return;

    const owners = attrs.ownerUsers;
    if (owners && Array.isArray(owners) && owners.length > 0) {
      metrics.owners++;
    }

    const desc = attrs.description;
    if (desc && typeof desc === 'string' && desc.trim().length > 0) {
      metrics.descriptions++;
    }

    const tags = attrs.atlanTags;
    if (tags && Array.isArray(tags) && tags.length > 0) {
      metrics.tags++;
    }

    const terms = attrs.meanings;
    if (terms && Array.isArray(terms) && terms.length > 0) {
      metrics.terms++;
    }
  });

  const total = assets.length;
  const score =
    (metrics.owners / total) * 25 +
    (metrics.descriptions / total) * 25 +
    (metrics.tags / total) * 25 +
    (metrics.terms / total) * 25;

  return Math.round(score);
}
