// ============================================
// ASSET CATALOG STORE
// Holds imported Atlan assets separately from the model canvas
// ============================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AtlanAssetSummary } from '../services/atlanApi';

// ============================================
// IMPORT SCOPE TRACKING
// ============================================

export interface ImportScopeInfo {
  connector: string;
  database?: string;
  databaseQualifiedName?: string;
  schema?: string;
  schemaQualifiedName?: string;
  importedAt: string;
  assetCount: number;
}

export interface ExtractedTag {
  name: string;
  typeName: string;
  count: number;
}

export interface ExtractedBusinessAttribute {
  setName: string;
  attributes: Array<{
    key: string;
    type: string;
    sampleValues: unknown[];
    count: number;
  }>;
}

// ============================================
// CATALOG ASSET
// ============================================

// Parsed hierarchy info for an asset
export interface CatalogAsset extends AtlanAssetSummary {
  // Hierarchy parsing
  database?: string;
  schema?: string;
  parentPath?: string;
  // Normalized category for filtering
  normalizedType: AssetTypeCategory;
  // UI state
  addedToCanvas?: boolean;
}

// High-level categories for filtering
export type AssetTypeCategory =
  | 'Database'
  | 'Schema'
  | 'Table'
  | 'View'
  | 'Column'
  | 'Query'
  | 'Dashboard'
  | 'Report'
  | 'Dataset'
  | 'API'
  | 'Pipeline'
  | 'Other';

// Map Atlan typeNames to our categories
const TYPE_CATEGORY_MAP: Record<string, AssetTypeCategory> = {
  // SQL
  'database': 'Database',
  'schema': 'Schema',
  'table': 'Table',
  'view': 'View',
  'materializedview': 'View',
  'column': 'Column',
  // Snowflake-specific
  'snowflakedatabase': 'Database',
  'snowflakeschema': 'Schema',
  'snowflaketable': 'Table',
  'snowflakeview': 'View',
  'snowflakecolumn': 'Column',
  'snowflakepipe': 'Pipeline',
  'snowflakestream': 'Table',
  'snowflaketag': 'Other',
  // Databricks
  'databrickscatalog': 'Database',
  'databricksschema': 'Schema',
  'databrickstable': 'Table',
  'databricksview': 'View',
  'databrickscolumn': 'Column',
  // BigQuery
  'bigquerydataset': 'Schema',
  'bigquerytable': 'Table',
  'bigqueryview': 'View',
  'bigquerycolumn': 'Column',
  // Redshift
  'redshiftdatabase': 'Database',
  'redshiftschema': 'Schema',
  'redshifttable': 'Table',
  'redshiftview': 'View',
  'redshiftcolumn': 'Column',
  // Queries
  'query': 'Query',
  'savedquery': 'Query',
  // BI - Tableau
  'tableauworkbook': 'Dashboard',
  'tableaudashboard': 'Dashboard',
  'tableauworksheet': 'Report',
  'tableaudatasource': 'Dataset',
  'tableausite': 'Other',
  'tableauproject': 'Other',
  // BI - PowerBI
  'powerbidashboard': 'Dashboard',
  'powerbireport': 'Report',
  'powerbidataset': 'Dataset',
  'powerbiworkspace': 'Other',
  'powerbidataflow': 'Pipeline',
  'powerbidataflowentitycolumn': 'Column',
  // BI - Looker
  'lookerdashboard': 'Dashboard',
  'lookerexplore': 'Report',
  'lookerproject': 'Other',
  'lookerfolder': 'Other',
  // BI - Other
  'microstrategycolumn': 'Column',
  'thoughtspotcolumn': 'Column',
  'domodatasetcolumn': 'Column',
  'biprocess': 'Pipeline',
  // Salesforce
  'salesforceobject': 'Table',
  'salesforcefield': 'Column',
  // APIs
  'apipath': 'API',
  'apioperation': 'API',
  'apispec': 'API',
  // Data fabric
  'fabricdataflowentitycolumn': 'Column',
  // SAP
  'saperpfunctionmodule': 'Other',
  // Other
  'task': 'Pipeline',
  'process': 'Pipeline',
  'tagattachment': 'Other',
};

const PERSISTED_ATTRIBUTE_KEYS = [
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
  'rowCount',
  'columnCount',
  'databaseName',
  'databaseQualifiedName',
  'schemaName',
  'schemaQualifiedName',
  'connectorName',
  'connectionName',
  'connectionQualifiedName',
  // Custom metadata / business attributes
  'businessAttributes',
];

function minimizeAttributes(attrs: AtlanAssetSummary['attributes']): AtlanAssetSummary['attributes'] {
  const out: Record<string, unknown> = {};
  for (const key of PERSISTED_ATTRIBUTE_KEYS) {
    const val = attrs?.[key];
    if (val !== undefined) out[key] = val;
  }
  return out as AtlanAssetSummary['attributes'];
}

function minimizeCatalogAssetForStorage(asset: CatalogAsset): CatalogAsset {
  return {
    guid: asset.guid,
    name: asset.name,
    qualifiedName: asset.qualifiedName,
    typeName: asset.typeName,
    connectorName: asset.connectorName,
    databaseName: asset.databaseName,
    databaseQualifiedName: asset.databaseQualifiedName,
    schemaName: asset.schemaName,
    schemaQualifiedName: asset.schemaQualifiedName,
    attributes: minimizeAttributes(asset.attributes || {}),
    // Drop relationships to keep storage small (they're not used for baseline analysis)
    relationships: undefined,
    database: asset.database,
    schema: asset.schema,
    parentPath: asset.parentPath,
    normalizedType: asset.normalizedType,
    addedToCanvas: asset.addedToCanvas,
  };
}

function normalizeType(typeName: string): AssetTypeCategory {
  const normalized = typeName.toLowerCase().replace(/[^a-z]/g, '');

  // Direct match
  if (TYPE_CATEGORY_MAP[normalized]) {
    return TYPE_CATEGORY_MAP[normalized];
  }

  // Pattern matching
  if (normalized.includes('database') || normalized.includes('catalog')) return 'Database';
  if (normalized.includes('schema') || normalized.includes('dataset')) return 'Schema';
  if (normalized.includes('table')) return 'Table';
  if (normalized.includes('view')) return 'View';
  if (normalized.includes('column') || normalized.includes('field')) return 'Column';
  if (normalized.includes('query')) return 'Query';
  if (normalized.includes('dashboard')) return 'Dashboard';
  if (normalized.includes('report') || normalized.includes('worksheet')) return 'Report';
  if (normalized.includes('pipeline') || normalized.includes('flow') || normalized.includes('process')) return 'Pipeline';
  if (normalized.includes('api')) return 'API';

  return 'Other';
}

// Parse hierarchy from qualifiedName
function parseHierarchy(asset: AtlanAssetSummary): Partial<CatalogAsset> {
  const qn = asset.qualifiedName || '';
  const parts = qn.split('/').filter(Boolean);

  // Typical Atlan format: default/connection/123456/database/schema/table
  // or: connection/database/schema/table

  let database: string | undefined;
  let schema: string | undefined;
  let parentPath: string | undefined;

  if (parts.length >= 3) {
    // Try to find database/schema in the path
    // Skip the connection identifier (usually numeric)
    const meaningfulParts = parts.filter(p => !/^\d+$/.test(p) && p !== 'default');

    if (meaningfulParts.length >= 2) {
      database = meaningfulParts[0];
      if (meaningfulParts.length >= 3) {
        schema = meaningfulParts[1];
        parentPath = `${database}/${schema}`;
      } else {
        parentPath = database;
      }
    }
  }

  return { database, schema, parentPath };
}

function enrichAsset(asset: AtlanAssetSummary): CatalogAsset {
  const hierarchy = parseHierarchy(asset);
  return {
    ...asset,
    ...hierarchy,
    normalizedType: normalizeType(asset.typeName),
    addedToCanvas: false,
  };
}

// Infer type from a value for business attributes
function inferType(value: unknown): string {
  if (value === null || value === undefined) return 'string';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (Array.isArray(value)) return 'multiSelect';
  if (typeof value === 'string') {
    // Check if it looks like a date
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
    // Check if it looks like a URL
    if (/^https?:\/\//.test(value)) return 'url';
    return 'string';
  }
  return 'string';
}

// Catalog state
interface CatalogState {
  // Imported assets
  assets: CatalogAsset[];
  connectors: string[];
  importedAt: string | null;

  // Import scope tracking (NEW)
  importScope: ImportScopeInfo | null;
  extractedTags: ExtractedTag[];
  extractedBusinessAttributes: ExtractedBusinessAttribute[];

  // Filter state
  selectedConnector: string | null;
  selectedTypes: AssetTypeCategory[];
  searchQuery: string;
  showOnlyNotOnCanvas: boolean;

  // Actions
  importAssets: (assets: AtlanAssetSummary[], connectors: string[]) => void;
  clearCatalog: () => void;
  markAddedToCanvas: (guids: string[]) => void;

  // Import scope actions (NEW)
  setImportScope: (scope: ImportScopeInfo) => void;
  extractMetadataFromAssets: () => void;

  // Filter actions
  setSelectedConnector: (connector: string | null) => void;
  setSelectedTypes: (types: AssetTypeCategory[]) => void;
  setSearchQuery: (query: string) => void;
  setShowOnlyNotOnCanvas: (show: boolean) => void;

  // Computed (as functions for Zustand)
  getFilteredAssets: () => CatalogAsset[];
  getHierarchy: () => HierarchyNode[];
  getTypeBreakdown: () => Array<{ type: AssetTypeCategory; count: number }>;
  getDistinctDatabases: () => Array<{ name: string; qualifiedName?: string; assetCount: number }>;
  getDistinctSchemas: (database?: string) => Array<{ name: string; database: string; qualifiedName?: string; assetCount: number }>;
}

// Hierarchy tree structure for sidebar
export interface HierarchyNode {
  id: string;
  name: string;
  type: 'connector' | 'database' | 'schema' | 'asset';
  assetType?: AssetTypeCategory;
  asset?: CatalogAsset;
  children: HierarchyNode[];
  assetCount: number;
}

export const useCatalogStore = create<CatalogState>()(
  persist(
    (set, get) => ({
      assets: [],
      connectors: [],
      importedAt: null,
      importScope: null,
      extractedTags: [],
      extractedBusinessAttributes: [],
      selectedConnector: null,
      selectedTypes: [],
      searchQuery: '',
      showOnlyNotOnCanvas: false,

      importAssets: (rawAssets, connectors) => {
        const enrichedAssets = rawAssets.map(enrichAsset);
        set({
          assets: enrichedAssets,
          connectors,
          importedAt: new Date().toISOString(),
          selectedConnector: connectors.length === 1 ? connectors[0] : null,
        });
      },

      clearCatalog: () => {
        set({
          assets: [],
          connectors: [],
          importedAt: null,
          importScope: null,
          extractedTags: [],
          extractedBusinessAttributes: [],
          selectedConnector: null,
          selectedTypes: [],
          searchQuery: '',
        });
      },

      setImportScope: (scope) => {
        set({ importScope: scope });
      },

      extractMetadataFromAssets: () => {
        const state = get();
        const assets = state.assets;

        // Extract tags from atlanTags attribute
        const tagCounts = new Map<string, { typeName: string; count: number }>();
        assets.forEach((asset) => {
          const tags = asset.attributes?.atlanTags as Array<{ typeName: string }> | undefined;
          if (tags && Array.isArray(tags)) {
            tags.forEach((tag) => {
              const existing = tagCounts.get(tag.typeName);
              if (existing) {
                existing.count++;
              } else {
                tagCounts.set(tag.typeName, { typeName: tag.typeName, count: 1 });
              }
            });
          }
        });

        const extractedTags: ExtractedTag[] = Array.from(tagCounts.entries())
          .map(([name, data]) => ({
            name,
            typeName: data.typeName,
            count: data.count,
          }))
          .sort((a, b) => b.count - a.count);

        // Extract business attributes
        const businessAttrSets = new Map<string, Map<string, { type: string; values: unknown[]; count: number }>>();
        assets.forEach((asset) => {
          const businessAttrs = asset.attributes?.businessAttributes as Record<string, Record<string, unknown>> | undefined;
          if (businessAttrs && typeof businessAttrs === 'object') {
            Object.entries(businessAttrs).forEach(([setName, attrs]) => {
              if (!businessAttrSets.has(setName)) {
                businessAttrSets.set(setName, new Map());
              }
              const setMap = businessAttrSets.get(setName)!;

              Object.entries(attrs || {}).forEach(([key, value]) => {
                if (!setMap.has(key)) {
                  setMap.set(key, {
                    type: inferType(value),
                    values: [],
                    count: 0,
                  });
                }
                const attrData = setMap.get(key)!;
                attrData.count++;
                if (attrData.values.length < 5 && value !== null && value !== undefined) {
                  attrData.values.push(value);
                }
              });
            });
          }
        });

        const extractedBusinessAttributes: ExtractedBusinessAttribute[] = Array.from(businessAttrSets.entries())
          .map(([setName, attrMap]) => ({
            setName,
            attributes: Array.from(attrMap.entries()).map(([key, data]) => ({
              key,
              type: data.type,
              sampleValues: data.values,
              count: data.count,
            })),
          }));

        set({ extractedTags, extractedBusinessAttributes });
      },

      markAddedToCanvas: (guids) => {
        set((state) => ({
          assets: state.assets.map((asset) =>
            guids.includes(asset.guid)
              ? { ...asset, addedToCanvas: true }
              : asset
          ),
        }));
      },

      setSelectedConnector: (connector) => set({ selectedConnector: connector }),
      setSelectedTypes: (types) => set({ selectedTypes: types }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setShowOnlyNotOnCanvas: (show) => set({ showOnlyNotOnCanvas: show }),

      getFilteredAssets: () => {
        const state = get();
        let filtered = state.assets;

        // Filter by connector
        if (state.selectedConnector) {
          filtered = filtered.filter(
            (a) => a.connectorName === state.selectedConnector
          );
        }

        // Filter by type
        if (state.selectedTypes.length > 0) {
          filtered = filtered.filter((a) =>
            state.selectedTypes.includes(a.normalizedType)
          );
        }

        // Filter by search
        if (state.searchQuery) {
          const query = state.searchQuery.toLowerCase();
          filtered = filtered.filter(
            (a) =>
              a.name.toLowerCase().includes(query) ||
              a.qualifiedName.toLowerCase().includes(query) ||
              a.typeName.toLowerCase().includes(query)
          );
        }

        // Filter out assets already on canvas
        if (state.showOnlyNotOnCanvas) {
          filtered = filtered.filter((a) => !a.addedToCanvas);
        }

        return filtered;
      },

      getHierarchy: () => {
        const state = get();
        const filtered = state.getFilteredAssets();

        // Build tree: Connector → Database → Schema → Assets
        const connectorMap = new Map<string, HierarchyNode>();

        filtered.forEach((asset) => {
          const connectorName = asset.connectorName || 'Unknown';

          // Get or create connector node
          if (!connectorMap.has(connectorName)) {
            connectorMap.set(connectorName, {
              id: `connector-${connectorName}`,
              name: connectorName,
              type: 'connector',
              children: [],
              assetCount: 0,
            });
          }
          const connectorNode = connectorMap.get(connectorName)!;
          connectorNode.assetCount++;

          // Get or create database node
          const dbName = asset.database || '(root)';
          let dbNode = connectorNode.children.find(
            (n) => n.type === 'database' && n.name === dbName
          );
          if (!dbNode) {
            dbNode = {
              id: `db-${connectorName}-${dbName}`,
              name: dbName,
              type: 'database',
              children: [],
              assetCount: 0,
            };
            connectorNode.children.push(dbNode);
          }
          dbNode.assetCount++;

          // Get or create schema node (if applicable)
          if (asset.schema) {
            let schemaNode = dbNode.children.find(
              (n) => n.type === 'schema' && n.name === asset.schema
            );
            if (!schemaNode) {
              schemaNode = {
                id: `schema-${connectorName}-${dbName}-${asset.schema}`,
                name: asset.schema,
                type: 'schema',
                children: [],
                assetCount: 0,
              };
              dbNode.children.push(schemaNode);
            }
            schemaNode.assetCount++;

            // Add asset to schema
            schemaNode.children.push({
              id: asset.guid,
              name: asset.name,
              type: 'asset',
              assetType: asset.normalizedType,
              asset,
              children: [],
              assetCount: 1,
            });
          } else {
            // Add asset directly to database
            dbNode.children.push({
              id: asset.guid,
              name: asset.name,
              type: 'asset',
              assetType: asset.normalizedType,
              asset,
              children: [],
              assetCount: 1,
            });
          }
        });

        return Array.from(connectorMap.values());
      },

      getTypeBreakdown: () => {
        const state = get();
        const assets = state.selectedConnector
          ? state.assets.filter((a) => a.connectorName === state.selectedConnector)
          : state.assets;

        const counts = new Map<AssetTypeCategory, number>();
        assets.forEach((asset) => {
          counts.set(asset.normalizedType, (counts.get(asset.normalizedType) || 0) + 1);
        });

        return Array.from(counts.entries())
          .map(([type, count]) => ({ type, count }))
          .sort((a, b) => b.count - a.count);
      },

      getDistinctDatabases: () => {
        const state = get();
        const assets = state.selectedConnector
          ? state.assets.filter((a) => a.connectorName === state.selectedConnector)
          : state.assets;

        const dbMap = new Map<string, { qualifiedName?: string; count: number }>();
        assets.forEach((asset) => {
          const dbName = asset.database || asset.databaseName;
          if (dbName) {
            const existing = dbMap.get(dbName);
            if (existing) {
              existing.count++;
            } else {
              dbMap.set(dbName, {
                qualifiedName: asset.databaseQualifiedName,
                count: 1,
              });
            }
          }
        });

        return Array.from(dbMap.entries())
          .map(([name, data]) => ({
            name,
            qualifiedName: data.qualifiedName,
            assetCount: data.count,
          }))
          .sort((a, b) => b.assetCount - a.assetCount);
      },

      getDistinctSchemas: (database?: string) => {
        const state = get();
        let assets = state.selectedConnector
          ? state.assets.filter((a) => a.connectorName === state.selectedConnector)
          : state.assets;

        if (database) {
          assets = assets.filter((a) => (a.database || a.databaseName) === database);
        }

        const schemaMap = new Map<string, { database: string; qualifiedName?: string; count: number }>();
        assets.forEach((asset) => {
          const schemaName = asset.schema || asset.schemaName;
          const dbName = asset.database || asset.databaseName || '';
          if (schemaName) {
            const key = `${dbName}/${schemaName}`;
            const existing = schemaMap.get(key);
            if (existing) {
              existing.count++;
            } else {
              schemaMap.set(key, {
                database: dbName,
                qualifiedName: asset.schemaQualifiedName,
                count: 1,
              });
            }
          }
        });

        return Array.from(schemaMap.entries())
          .map(([key, data]) => ({
            name: key.split('/')[1] || key,
            database: data.database,
            qualifiedName: data.qualifiedName,
            assetCount: data.count,
          }))
          .sort((a, b) => b.assetCount - a.assetCount);
      },
    }),
    {
      name: 'atlan-asset-catalog',
      version: 3, // Increment when schema changes
      partialize: (state) => ({
        assets: state.assets.map(minimizeCatalogAssetForStorage),
        connectors: state.connectors,
        importedAt: state.importedAt,
        importScope: state.importScope,
        extractedTags: state.extractedTags,
        extractedBusinessAttributes: state.extractedBusinessAttributes,
        selectedConnector: state.selectedConnector,
        selectedTypes: state.selectedTypes,
        searchQuery: state.searchQuery,
        showOnlyNotOnCanvas: state.showOnlyNotOnCanvas,
      }),
    }
  )
);

// Hard reset - clears persisted catalog data
export function resetCatalogStore() {
  localStorage.removeItem('atlan-asset-catalog');
  useCatalogStore.setState({
    assets: [],
    connectors: [],
    importedAt: null,
    importScope: null,
    extractedTags: [],
    extractedBusinessAttributes: [],
    selectedConnector: null,
    selectedTypes: [],
    searchQuery: '',
    showOnlyNotOnCanvas: false,
  });
}
