// ============================================
// GOVERNANCE STORE
// Manages domains, taxonomy, and custom metadata designs
// with seeding from imported catalog assets
// ============================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type { CatalogAsset } from './catalogStore';
import type { DomainModel } from '../types/domains';
import type { TaxonomyDesign, TaxonomyNode } from '../types/taxonomy';
import type { CustomMetadataDesign, CustomAttribute, AttributeType } from '../types/custom-metadata';

// ============================================
// HELPER FUNCTIONS
// ============================================

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function safeId(prefix: string): string {
  return `${prefix}-${nanoid(8)}`;
}

// ============================================
// DOMAIN SEEDING
// ============================================

function seedDomainsFromCatalog(assets: CatalogAsset[]): DomainModel[] {
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#06B6D4', '#EF4444'];

  const byConnector = new Map<string, CatalogAsset[]>();
  assets.forEach((a) => {
    const c = a.connectorName || 'unknown';
    byConnector.set(c, [...(byConnector.get(c) || []), a]);
  });

  const domains: DomainModel[] = [];

  for (const [connector, connectorAssets] of byConnector.entries()) {
    const connectorId = `connector-${slugify(connector)}`;

    const dbMap = new Map<string, CatalogAsset[]>();
    connectorAssets.forEach((a) => {
      const db = a.databaseName || a.database || '(root)';
      dbMap.set(db, [...(dbMap.get(db) || []), a]);
    });

    const dbDomainIds: string[] = [];

    domains.push({
      id: connectorId,
      name: slugify(connector) || connectorId,
      description: `Imported assets grouped by connector: ${connector}`,
      color: colors[Math.floor(Math.random() * colors.length)],
      boundaryType: 'connector',
      boundaryRules: [{ id: safeId('rule'), type: 'connector', pattern: connector, isInclude: true }],
      ownershipModel: {
        style: 'distributed',
        stewardshipModel: 'federated',
        stewards: [],
        escalationPath: [],
      },
      metadataRequirements: [],
      taxonomySubset: [],
      glossaryScope: [],
      childDomainIds: dbDomainIds,
    });

    for (const [db, dbAssets] of dbMap.entries()) {
      const dbId = `db-${slugify(connector)}-${slugify(db)}`;
      dbDomainIds.push(dbId);

      const schemaMap = new Map<string, CatalogAsset[]>();
      dbAssets.forEach((a) => {
        const schema = a.schemaName || a.schema || '(root)';
        schemaMap.set(schema, [...(schemaMap.get(schema) || []), a]);
      });

      const schemaDomainIds: string[] = [];

      domains.push({
        id: dbId,
        name: slugify(db) || dbId,
        description: `Database domain for ${connector}.${db}`,
        color: colors[Math.floor(Math.random() * colors.length)],
        boundaryType: 'database',
        boundaryRules: [{ id: safeId('rule'), type: 'database', pattern: db, isInclude: true }],
        ownershipModel: {
          style: 'distributed',
          stewardshipModel: 'federated',
          stewards: [],
          escalationPath: [],
        },
        metadataRequirements: [],
        taxonomySubset: [],
        glossaryScope: [],
        parentDomainId: connectorId,
        childDomainIds: schemaDomainIds,
      });

      for (const [schema, schemaAssets] of schemaMap.entries()) {
        const schemaId = `schema-${slugify(connector)}-${slugify(db)}-${slugify(schema)}`;
        schemaDomainIds.push(schemaId);

        domains.push({
          id: schemaId,
          name: slugify(schema) || schemaId,
          description: `Schema domain for ${connector}.${db}.${schema} (${schemaAssets.length} assets)`,
          color: colors[Math.floor(Math.random() * colors.length)],
          boundaryType: 'schema',
          boundaryRules: [{ id: safeId('rule'), type: 'schema', pattern: schema, isInclude: true }],
          ownershipModel: {
            style: 'distributed',
            stewardshipModel: 'federated',
            stewards: [],
            escalationPath: [],
          },
          metadataRequirements: [],
          taxonomySubset: [],
          glossaryScope: [],
          parentDomainId: dbId,
          childDomainIds: [],
          assetCount: schemaAssets.length,
        });
      }
    }
  }

  return domains;
}

// ============================================
// TAXONOMY SEEDING
// ============================================

function seedTaxonomyFromCatalog(assets: CatalogAsset[]): TaxonomyDesign {
  const tagSet = new Set<string>();
  const termSet = new Set<string>();

  for (const a of assets) {
    const tags = a.attributes?.atlanTags;
    if (Array.isArray(tags)) {
      for (const t of tags) {
        if (typeof t === 'string') tagSet.add(t);
        else if (t && typeof t === 'object' && 'typeName' in t && typeof (t as { typeName: unknown }).typeName === 'string') {
          tagSet.add((t as { typeName: string }).typeName);
        }
      }
    }

    const meanings = a.attributes?.meanings;
    if (Array.isArray(meanings)) {
      for (const m of meanings) {
        if (m && typeof m === 'object' && 'displayText' in m && typeof (m as { displayText: unknown }).displayText === 'string') {
          termSet.add((m as { displayText: string }).displayText);
        }
      }
    }
  }

  const makeLeaf = (name: string, order: number): TaxonomyNode => ({
    id: `tag-${slugify(name)}-${order}`,
    name: slugify(name) || `tag-${order}`,
    displayName: name,
    description: 'Seeded from imported assets',
    color: '#3B82F6',
    parentId: undefined,
    children: [],
    applicableAssetTypes: ['Table', 'View', 'Column', 'Dashboard', 'Report', 'Dataset'],
    autoDetectionPatterns: [],
    isLeaf: true,
    order,
  });

  const tagChildren = Array.from(tagSet)
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 200)
    .map((t, i) => makeLeaf(t, i));

  const termChildren = Array.from(termSet)
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 200)
    .map((t, i) => ({ ...makeLeaf(t, i), color: '#10B981' }));

  const rootNodes: TaxonomyNode[] = [];

  if (tagChildren.length > 0) {
    rootNodes.push({
      id: 'imported-tags',
      name: 'imported-tags',
      displayName: 'Imported Tags',
      description: 'Seeded from atlanTags on imported assets',
      color: '#3B82F6',
      parentId: undefined,
      children: tagChildren,
      applicableAssetTypes: ['Table', 'View', 'Column', 'Dashboard', 'Report', 'Dataset'],
      autoDetectionPatterns: [],
      isLeaf: false,
      order: 0,
    });
  }

  if (termChildren.length > 0) {
    rootNodes.push({
      id: 'imported-terms',
      name: 'imported-terms',
      displayName: 'Imported Glossary Terms',
      description: 'Seeded from meanings on imported assets',
      color: '#10B981',
      parentId: undefined,
      children: termChildren,
      applicableAssetTypes: ['Table', 'View', 'Column', 'Dashboard', 'Report', 'Dataset'],
      autoDetectionPatterns: [],
      isLeaf: false,
      order: 1,
    });
  }

  return {
    id: `taxonomy-${Date.now()}`,
    name: 'Imported Taxonomy',
    description: 'Seeded from imported Atlan assets',
    purpose: 'Starting point for taxonomy design',
    structure: rootNodes,
    propagationRules: [],
    policyMappings: [],
  };
}

// ============================================
// CUSTOM METADATA SEEDING
// ============================================

function inferAttributeType(values: unknown[]): AttributeType {
  const nonNull = values.filter((v) => v !== null && v !== undefined);
  if (nonNull.length === 0) return 'string';
  if (nonNull.every((v) => typeof v === 'boolean')) return 'boolean';
  if (nonNull.every((v) => typeof v === 'number')) return 'number';
  return 'string';
}

function seedCustomMetadataFromCatalog(assets: CatalogAsset[]): CustomMetadataDesign[] {
  const setMap = new Map<string, Map<string, unknown[]>>();

  for (const a of assets) {
    const cm = a.attributes?.businessAttributes;
    if (!cm || typeof cm !== 'object') continue;

    // Heuristic: if top-level values are objects, treat them as sets
    for (const [k, v] of Object.entries(cm)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const setName = k;
        if (!setMap.has(setName)) setMap.set(setName, new Map());
        const attrMap = setMap.get(setName)!;

        for (const [attrKey, attrVal] of Object.entries(v as Record<string, unknown>)) {
          if (!attrMap.has(attrKey)) attrMap.set(attrKey, []);
          attrMap.get(attrKey)!.push(attrVal);
        }
      } else {
        const setName = 'ImportedCustomMetadata';
        if (!setMap.has(setName)) setMap.set(setName, new Map());
        const attrMap = setMap.get(setName)!;
        if (!attrMap.has(k)) attrMap.set(k, []);
        attrMap.get(k)!.push(v);
      }
    }
  }

  const schemas: CustomMetadataDesign[] = [];

  for (const [setName, attrMap] of setMap.entries()) {
    const attributes: CustomAttribute[] = Array.from(attrMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(0, 200)
      .map(([attrKey, values], idx) => ({
        id: `attr-${slugify(attrKey)}-${idx}`,
        name: slugify(attrKey).replace(/-/g, '_') || `field_${idx}`,
        displayName: attrKey,
        description: 'Seeded from imported assets',
        type: inferAttributeType(values),
        isRequired: false,
        isMultiValued: false,
        order: idx,
      }));

    schemas.push({
      id: `schema-${slugify(setName)}-${nanoid(6)}`,
      name: slugify(setName).replace(/-/g, '_') || `CustomMetadata_${nanoid(4)}`,
      displayName: setName,
      description: 'Seeded from businessAttributes on imported assets',
      appliesTo: ['Table', 'View', 'Column', 'Dashboard', 'Dataset', 'Report'],
      attributes,
      isRequired: false,
      domains: [],
    });
  }

  return schemas;
}

// ============================================
// STORE INTERFACE
// ============================================

interface GovernanceState {
  // Data
  domains: DomainModel[];
  taxonomy: TaxonomyDesign | null;
  customMetadataSchemas: CustomMetadataDesign[];

  // Actions
  seedFromCatalogIfEmpty: (assets: CatalogAsset[]) => void;
  clearGovernance: () => void;

  // Domain actions
  setDomains: (domains: DomainModel[]) => void;
  addDomain: (domain: DomainModel) => void;
  updateDomain: (id: string, updates: Partial<DomainModel>) => void;
  removeDomain: (id: string) => void;

  // Taxonomy actions
  setTaxonomy: (taxonomy: TaxonomyDesign) => void;

  // Custom metadata actions
  setCustomMetadataSchemas: (schemas: CustomMetadataDesign[]) => void;
  addCustomMetadataSchema: (schema: CustomMetadataDesign) => void;
  updateCustomMetadataSchema: (id: string, updates: Partial<CustomMetadataDesign>) => void;
  removeCustomMetadataSchema: (id: string) => void;
}

export const useGovernanceStore = create<GovernanceState>()(
  persist(
    (set, get) => ({
      domains: [],
      taxonomy: null,
      customMetadataSchemas: [],

      seedFromCatalogIfEmpty: (assets) => {
        const state = get();
        if (!assets || assets.length === 0) return;

        const next: Partial<GovernanceState> = {};
        if (state.domains.length === 0) next.domains = seedDomainsFromCatalog(assets);
        if (!state.taxonomy) next.taxonomy = seedTaxonomyFromCatalog(assets);
        if (state.customMetadataSchemas.length === 0)
          next.customMetadataSchemas = seedCustomMetadataFromCatalog(assets);

        if (Object.keys(next).length > 0) set(next as GovernanceState);
      },

      clearGovernance: () =>
        set({ domains: [], taxonomy: null, customMetadataSchemas: [] }),

      // Domain actions
      setDomains: (domains) => set({ domains }),

      addDomain: (domain) =>
        set((state) => ({ domains: [...state.domains, domain] })),

      updateDomain: (id, updates) =>
        set((state) => ({
          domains: state.domains.map((d) =>
            d.id === id ? { ...d, ...updates } : d
          ),
        })),

      removeDomain: (id) =>
        set((state) => ({
          domains: state.domains.filter((d) => d.id !== id),
        })),

      // Taxonomy actions
      setTaxonomy: (taxonomy) => set({ taxonomy }),

      // Custom metadata actions
      setCustomMetadataSchemas: (customMetadataSchemas) => set({ customMetadataSchemas }),

      addCustomMetadataSchema: (schema) =>
        set((state) => ({
          customMetadataSchemas: [...state.customMetadataSchemas, schema],
        })),

      updateCustomMetadataSchema: (id, updates) =>
        set((state) => ({
          customMetadataSchemas: state.customMetadataSchemas.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        })),

      removeCustomMetadataSchema: (id) =>
        set((state) => ({
          customMetadataSchemas: state.customMetadataSchemas.filter((s) => s.id !== id),
        })),
    }),
    { name: 'governance-store' }
  )
);

export default useGovernanceStore;
