import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type {
  MetadataModel,
  ModelPage,
  EntityDefinition,
  EdgeDefinition,
  AttributeDefinition,
  RelationshipDefinition,
  AtlanAssetCategory,
  AtlanAssetType,
  DomainModel,
  CustomMetadataDesign,
  RequirementsMatrix,
} from '../types';
import type { RequirementType } from '../types/metadata-fields';
import { getAssetTypeInfo } from '../types';
import { useHistoryStore } from './historyStore';
import type { CanvasTemplate } from '../types/canvas-templates';
import { type EnrichmentPlan } from '../types/enrichment-plan';
import { fetchAssetsByGuidsBatched } from '../services/atlanApi';
import { buildLineageEdges, edgeKey, type EdgeKind } from '../utils/edgeBuilders';

// ============================================
// ENRICHMENT STATE TYPES
// ============================================

export type EnrichmentStatus = 'idle' | 'running' | 'cancelled' | 'error' | 'completed';

export interface EnrichmentState {
  status: EnrichmentStatus;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  batchesDone: number;
  batchesTotal: number;
  nodesAdded: number;
  edgesAdded: number;
  lastOptions: EnrichmentOptions | null;
}

export interface EnrichmentOptions {
  includeLineage?: boolean;
  includeGlossary?: boolean;
  includeGovernance?: boolean;
  includeFields?: boolean;
  batchSize?: number;
  concurrency?: number;
  maxAttempts?: number;
  baseDelayMs?: number;
}

const initialEnrichmentState: EnrichmentState = {
  status: 'idle',
  startedAt: null,
  finishedAt: null,
  error: null,
  batchesDone: 0,
  batchesTotal: 0,
  nodesAdded: 0,
  edgesAdded: 0,
  lastOptions: null,
};

// Helper to create an empty page
const createEmptyPage = (name: string = 'Untitled Page'): ModelPage => {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    name,
    description: '',
    entities: [],
    edges: [],
    createdAt: now,
    updatedAt: now,
  };
};

// Helper to get active page from model
const getActivePage = (model: MetadataModel): ModelPage | undefined => {
  return model.pages.find(p => p.id === model.activePageId);
};

// Helper to update active page in model
const updateActivePage = (
  model: MetadataModel,
  updater: (page: ModelPage) => ModelPage
): MetadataModel => {
  return {
    ...model,
    pages: model.pages.map(p =>
      p.id === model.activePageId ? updater(p) : p
    ),
    updatedAt: new Date().toISOString(),
  };
};

interface ModelState {
  model: MetadataModel;

  // Selection state (lifted from React Flow for sync)
  selectedEntityIds: string[];
  setSelectedEntityIds: (ids: string[]) => void;

  // Page actions (Miro-like)
  addPage: (name?: string) => string;
  deletePage: (pageId: string) => void;
  setActivePage: (pageId: string) => void;
  renamePage: (pageId: string, name: string) => void;
  duplicatePage: (pageId: string) => string;

  // Entity actions (operate on active page)
  addEntity: (
    category: AtlanAssetCategory,
    assetType: AtlanAssetType,
    position: { x: number; y: number }
  ) => string;
  importEntities: (entities: EntityDefinition[]) => void;
  updateEntity: (id: string, updates: Partial<EntityDefinition>) => void;
  updateEntities: (updates: Array<{ id: string; updates: Partial<EntityDefinition> }>) => void;
  deleteEntity: (id: string) => void;

  // Attribute actions
  addAttribute: (entityId: string, attribute: Omit<AttributeDefinition, 'id'>) => void;
  updateAttribute: (entityId: string, attributeId: string, updates: Partial<AttributeDefinition>) => void;
  deleteAttribute: (entityId: string, attributeId: string) => void;
  bulkUpdateAttribute: (attrName: string, updates: Partial<AttributeDefinition>) => void;

  // Relationship actions
  addRelationship: (
    sourceEntityId: string,
    targetEntityId: string,
    relationship: Omit<RelationshipDefinition, 'id' | 'targetEntityId'>
  ) => void;
  updateRelationship: (
    entityId: string,
    relationshipId: string,
    updates: Partial<RelationshipDefinition>
  ) => void;
  deleteRelationship: (entityId: string, relationshipId: string) => void;

  // Edge actions (for React Flow)
  addEdge: (edge: Omit<EdgeDefinition, 'id'>) => void;
  addEdges: (edges: EdgeDefinition[]) => void;
  deleteEdge: (edgeId: string) => void;

  // Bulk replace actions (for imports)
  setEntities: (entities: EntityDefinition[]) => void;
  setEdges: (edges: EdgeDefinition[]) => void;

  // Model actions
  updateModelInfo: (updates: { name?: string; description?: string }) => void;
  clearModel: () => void;
  loadModel: (model: MetadataModel) => void;
  loadTemplate: (template: CanvasTemplate) => void;
  applyTemplateToNewPage: (template: CanvasTemplate) => void;
  exportModel: () => MetadataModel;

  // Versioning actions
  createVersion: (name: string, description?: string) => void;
  rollbackToVersion: (versionId: string) => void;
  deleteVersion: (versionId: string) => void;

  // Gallery state
  isGalleryOpen: boolean;
  openGallery: () => void;
  closeGallery: () => void;

  // Plan actions
  addPlan: (plan: EnrichmentPlan) => void;
  updatePlan: (planId: string, updates: Partial<EnrichmentPlan>) => void;
  deletePlan: (planId: string) => void;
  activePlanId: string | null;
  setActivePlanId: (planId: string | null) => void;

  // Domain actions
  addDomain: (domain: DomainModel) => void;
  setDomains: (domains: DomainModel[]) => void;
  updateDomain: (id: string, updates: Partial<DomainModel>) => void;
  deleteDomain: (id: string) => void;

  // Custom Metadata actions
  addCustomMetadata: (cm: CustomMetadataDesign) => void;
  updateCustomMetadata: (id: string, updates: Partial<CustomMetadataDesign>) => void;
  deleteCustomMetadata: (id: string) => void;
  setCustomMetadata: (schemas: CustomMetadataDesign[]) => void;

  // Computed getters
  getActivePage: () => ModelPage | undefined;
  getActiveEntities: () => EntityDefinition[];
  getActiveEdges: () => EdgeDefinition[];

  // Enrichment state and actions
  enrichment: EnrichmentState;
  enrichCanvasFromAtlan: (options?: EnrichmentOptions) => Promise<{ nodesAdded: number; edgesAdded: number }>;
  cancelEnrichment: () => void;
  retryEnrichment: () => Promise<{ nodesAdded: number; edgesAdded: number }>;
  setEnrichmentProgress: (progress: Partial<EnrichmentState>) => void;
}

const createEmptyModel = (): MetadataModel => {
  const firstPage = createEmptyPage('Page 1');
  return {
    id: uuidv4(),
    name: 'Untitled Model',
    description: '',
    pages: [firstPage],
    activePageId: firstPage.id,
    enrichmentPlans: [],
    domains: [],
    customMetadata: [],
    versions: [],
    requirementsMatrix: null,
    // Legacy fields (for backwards compat)
    entities: [],
    edges: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

function buildPageFromTemplate(template: CanvasTemplate): ModelPage {
  // Map from template entity type to created entity ID
  const typeToIdMap = new Map<string, string>();
  const entities: EntityDefinition[] = [];
  const edges: EdgeDefinition[] = [];

  // Map category - convert AssetCategory to AtlanAssetCategory
  const categoryMap: Record<string, AtlanAssetCategory> = {
    SQL: 'SQL',
    BI: 'BI',
    Glossary: 'Custom', // Map Glossary to Custom since we don't have Glossary category
    DataMesh: 'DataMesh',
    Orchestration: 'Airflow',
    dbt: 'Dbt',
    Storage: 'ObjectStore',
    Governance: 'Custom',
    Core: 'Custom',
    AI: 'Custom',
    Other: 'Custom',
  };

  // Create entities from template
  template.entities.forEach((templateEntity) => {
    const id = uuidv4();
    typeToIdMap.set(templateEntity.type, id);

    // Map template attributes to our format
    const attributes: AttributeDefinition[] = templateEntity.attributes.map((attr) => ({
      id: uuidv4(),
      name: attr.name,
      displayName: attr.name.charAt(0).toUpperCase() + attr.name.slice(1).replace(/([A-Z])/g, ' $1'),
      type:
        attr.type === 'user[]' || attr.type === 'group[]'
          ? (attr.type.replace('[]', '') as 'user' | 'group')
          : attr.type === 'enum'
            ? 'enum'
            : (attr.type as 'string' | 'number' | 'boolean' | 'date'),
      required: attr.required,
      description: attr.description,
      enumValues: attr.enumValues,
    }));

    const entity: EntityDefinition = {
      id,
      name: templateEntity.suggestedName,
      displayName: templateEntity.suggestedName,
      category: categoryMap[templateEntity.category] || 'Custom',
      assetType: templateEntity.type as AtlanAssetType,
      description: '',
      attributes,
      relationships: [],
      position: templateEntity.position,
    };

    entities.push(entity);
  });

  // Create edges from template relationships
  template.relationships.forEach((rel) => {
    const sourceId = typeToIdMap.get(rel.sourceType);
    const targetId = typeToIdMap.get(rel.targetType);

    if (sourceId && targetId) {
      const relationshipId = uuidv4();
      const edgeId = uuidv4();

      // Add relationship to source entity
      const sourceEntity = entities.find((e) => e.id === sourceId);
      if (sourceEntity) {
        sourceEntity.relationships.push({
          id: relationshipId,
          name: rel.label,
          targetEntityId: targetId,
          cardinality:
            rel.cardinality === '1:1' ? 'one-to-one'
              : rel.cardinality === 'N:N' ? 'many-to-many'
                : 'one-to-many',
        });
      }

      // Create edge
      edges.push({
        id: edgeId,
        source: sourceId,
        target: targetId,
        label: rel.label,
        relationshipId,
      });
    }
  });

  const newPage = createEmptyPage(template.name);
  newPage.entities = entities;
  newPage.edges = edges;
  return newPage;
}

// Helper to push to history after model changes
const pushToHistory = (model: MetadataModel) => {
  try {
    const historyStore = useHistoryStore.getState();
    if (historyStore && historyStore.push) {
      historyStore.push(model);
    }
  } catch (error) {
    // History store might not be initialized yet, that's okay
    console.debug('History store not ready:', error);
  }
};

// Module-level abort controller for enrichment
let _enrichmentAbortController: AbortController | null = null;

export const useModelStore = create<ModelState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        model: createEmptyModel(),
      isGalleryOpen: false,
      enrichment: { ...initialEnrichmentState },

      // Selection state (for syncing canvas, spreadsheet, sidebar)
      selectedEntityIds: [],
      setSelectedEntityIds: (ids) => set({ selectedEntityIds: ids }),

      // ============================================
      // PAGE ACTIONS
      // ============================================

      addPage: (name) => {
        const newPage = createEmptyPage(name || `Page ${get().model.pages.length + 1}`);
        set((state) => {
          const newModel = {
            ...state.model,
            pages: [...state.model.pages, newPage],
            activePageId: newPage.id,
            updatedAt: new Date().toISOString(),
          };
          pushToHistory(newModel);
          return { model: newModel };
        });
        return newPage.id;
      },

      deletePage: (pageId) => {
        const { model } = get();
        if (model.pages.length <= 1) return; // Can't delete last page

        const newPages = model.pages.filter((p) => p.id !== pageId);
        const newActiveId = model.activePageId === pageId ? newPages[0].id : model.activePageId;

        const newModel: MetadataModel = {
          ...model,
          pages: newPages,
          activePageId: newActiveId,
          updatedAt: new Date().toISOString(),
        };

        set({ model: newModel });
        pushToHistory(newModel);
      },

      setActivePage: (pageId) => {
        set((state) => {
          const newModel: MetadataModel = {
            ...state.model,
            activePageId: pageId,
          };
          pushToHistory(newModel);
          return { model: newModel };
        });
      },

      renamePage: (pageId, name) => {
        set((state) => {
          const newModel: MetadataModel = {
            ...state.model,
            pages: state.model.pages.map((p) =>
              p.id === pageId ? { ...p, name, updatedAt: new Date().toISOString() } : p
            ),
            updatedAt: new Date().toISOString(),
          };
          pushToHistory(newModel);
          return { model: newModel };
        });
      },

      duplicatePage: (pageId) => {
        const { model } = get();
        const sourcePage = model.pages.find(p => p.id === pageId);
        if (!sourcePage) return '';

        const entityIdMap = new Map<string, string>();
        const relationshipIdMap = new Map<string, string>();

        // Duplicate entities first, mapping IDs and remapping relationships/attributes
        const entities: EntityDefinition[] = sourcePage.entities.map((e) => {
          const newEntityId = uuidv4();
          entityIdMap.set(e.id, newEntityId);

          const newAttributes = e.attributes.map((a) => ({ ...a, id: uuidv4() }));
          const newCustomMetadata = e.customMetadata?.map((set) => ({
            ...set,
            id: uuidv4(),
            attributes: set.attributes.map((a) => ({ ...a, id: uuidv4() })),
          }));

          const newRelationships = e.relationships.map((r) => {
            const newRelationshipId = uuidv4();
            relationshipIdMap.set(r.id, newRelationshipId);
            return {
              ...r,
              id: newRelationshipId,
              targetEntityId: entityIdMap.get(r.targetEntityId) || r.targetEntityId,
            };
          });

          return {
            ...e,
            id: newEntityId,
            attributes: newAttributes,
            relationships: newRelationships,
            customMetadata: newCustomMetadata,
          };
        });

        // Now that entityIdMap is complete, fix up relationship targets for any forward refs
        const entitiesWithFixedRelationships = entities.map((e) => ({
          ...e,
          relationships: e.relationships.map((r) => ({
            ...r,
            targetEntityId: entityIdMap.get(r.targetEntityId) || r.targetEntityId,
          })),
        }));

        const edges: EdgeDefinition[] = sourcePage.edges.map((e) => ({
          ...e,
          id: uuidv4(),
          source: entityIdMap.get(e.source) || e.source,
          target: entityIdMap.get(e.target) || e.target,
          relationshipId: e.relationshipId ? (relationshipIdMap.get(e.relationshipId) || uuidv4()) : undefined,
        }));

        const newPage: ModelPage = {
          ...sourcePage,
          id: uuidv4(),
          name: `${sourcePage.name} (copy)`,
          entities: entitiesWithFixedRelationships,
          edges,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const newModel: MetadataModel = {
          ...model,
          pages: [...model.pages, newPage],
          activePageId: newPage.id,
          updatedAt: new Date().toISOString(),
        };

        set({ model: newModel });
        pushToHistory(newModel);
        return newPage.id;
      },

      // ============================================
      // ENTITY ACTIONS (on active page)
      // ============================================

      addEntity: (category, assetType, position) => {
        const id = uuidv4();
        const assetInfo = getAssetTypeInfo(category, assetType);
        const defaultAttributes: AttributeDefinition[] =
          assetInfo?.defaultAttributes.map((attr) => ({
            ...attr,
            id: uuidv4(),
          })) || [];

        const newEntity: EntityDefinition = {
          id,
          name: `New ${assetInfo?.displayName || assetType}`,
          displayName: `New ${assetInfo?.displayName || assetType}`,
          category,
          assetType,
          description: '',
          attributes: defaultAttributes,
          relationships: [],
          position,
        };

        set((state) => {
          const newModel = updateActivePage(state.model, (page) => ({
            ...page,
            entities: [...page.entities, newEntity],
            updatedAt: new Date().toISOString(),
          }));
          pushToHistory(newModel);
          return { model: newModel };
        });

        return id;
      },

      importEntities: (entities) => {
        set((state) => {
          const newModel = updateActivePage(state.model, (page) => ({
            ...page,
            entities: [...page.entities, ...entities],
            updatedAt: new Date().toISOString(),
          }));
          pushToHistory(newModel);
          return { model: newModel };
        });
      },

      updateEntity: (id, updates) => {
        set((state) => {
          const newModel = updateActivePage(state.model, (page) => ({
            ...page,
            entities: page.entities.map((entity) =>
              entity.id === id ? { ...entity, ...updates } : entity
            ),
            updatedAt: new Date().toISOString(),
          }));
          pushToHistory(newModel);
          return { model: newModel };
        });
      },

      updateEntities: (updatesList) => {
        if (!updatesList || updatesList.length === 0) return;
        const updatesById = new Map<string, Partial<EntityDefinition>>();
        updatesList.forEach((u) => {
          if (!u?.id) return;
          updatesById.set(u.id, u.updates || {});
        });
        if (updatesById.size === 0) return;

        set((state) => {
          const newModel = updateActivePage(state.model, (page) => ({
            ...page,
            entities: page.entities.map((entity) => {
              const u = updatesById.get(entity.id);
              return u ? { ...entity, ...u } : entity;
            }),
            updatedAt: new Date().toISOString(),
          }));
          pushToHistory(newModel);
          return { model: newModel };
        });
      },

      deleteEntity: (id) => {
        set((state) => {
          const newModel = updateActivePage(state.model, (page) => ({
            ...page,
            entities: page.entities.filter((entity) => entity.id !== id),
            edges: page.edges.filter(
              (edge) => edge.source !== id && edge.target !== id
            ),
            updatedAt: new Date().toISOString(),
          }));
          pushToHistory(newModel);
          return { model: newModel };
        });
      },

      // ============================================
      // ATTRIBUTE ACTIONS
      // ============================================

      addAttribute: (entityId, attribute) => {
        const newAttribute: AttributeDefinition = {
          ...attribute,
          id: uuidv4(),
        };

        set((state) => {
          const newModel = updateActivePage(state.model, (page) => ({
            ...page,
            entities: page.entities.map((entity) =>
              entity.id === entityId
                ? { ...entity, attributes: [...entity.attributes, newAttribute] }
                : entity
            ),
            updatedAt: new Date().toISOString(),
          }));
          pushToHistory(newModel);
          return { model: newModel };
        });
      },

      updateAttribute: (entityId, attributeId, updates) => {
        set((state) => {
          const newModel = updateActivePage(state.model, (page) => ({
            ...page,
            entities: page.entities.map((entity) =>
              entity.id === entityId
                ? {
                    ...entity,
                    attributes: entity.attributes.map((attr) =>
                      attr.id === attributeId ? { ...attr, ...updates } : attr
                    ),
                  }
                : entity
            ),
            updatedAt: new Date().toISOString(),
          }));
          pushToHistory(newModel);
          return { model: newModel };
        });
      },

      deleteAttribute: (entityId, attributeId) => {
        set((state) => {
          const newModel = updateActivePage(state.model, (page) => ({
            ...page,
            entities: page.entities.map((entity) =>
              entity.id === entityId
                ? {
                    ...entity,
                    attributes: entity.attributes.filter(
                      (attr) => attr.id !== attributeId
                    ),
                  }
                : entity
            ),
            updatedAt: new Date().toISOString(),
          }));
          pushToHistory(newModel);
          return { model: newModel };
        });
      },

      bulkUpdateAttribute: (attrName, updates) => {
        set((state) => {
          const newModel = updateActivePage(state.model, (page) => ({
            ...page,
            entities: page.entities.map((entity) => ({
              ...entity,
              attributes: entity.attributes.map((attr) =>
                attr.name === attrName ? { ...attr, ...updates } : attr
              ),
            })),
            updatedAt: new Date().toISOString(),
          }));
          pushToHistory(newModel);
          return { model: newModel };
        });
      },

      // ============================================
      // RELATIONSHIP ACTIONS
      // ============================================

      addRelationship: (sourceEntityId, targetEntityId, relationship) => {
        const newRelationship: RelationshipDefinition = {
          ...relationship,
          id: uuidv4(),
          targetEntityId,
        };

        const edgeId = uuidv4();
        const newEdge: EdgeDefinition = {
          id: edgeId,
          source: sourceEntityId,
          target: targetEntityId,
          label: relationship.name,
          relationshipId: newRelationship.id,
        };

        set((state) => {
          const newModel = updateActivePage(state.model, (page) => ({
            ...page,
            entities: page.entities.map((entity) =>
              entity.id === sourceEntityId
                ? {
                    ...entity,
                    relationships: [...entity.relationships, newRelationship],
                  }
                : entity
            ),
            edges: [...page.edges, newEdge],
            updatedAt: new Date().toISOString(),
          }));
          pushToHistory(newModel);
          return { model: newModel };
        });
      },

      updateRelationship: (entityId, relationshipId, updates) => {
        set((state) => {
          const newModel = updateActivePage(state.model, (page) => ({
            ...page,
            entities: page.entities.map((entity) =>
              entity.id === entityId
                ? {
                    ...entity,
                    relationships: entity.relationships.map((rel) =>
                      rel.id === relationshipId ? { ...rel, ...updates } : rel
                    ),
                  }
                : entity
            ),
            edges: page.edges.map((edge) =>
              edge.relationshipId === relationshipId
                ? { ...edge, label: updates.name || edge.label }
                : edge
            ),
            updatedAt: new Date().toISOString(),
          }));
          pushToHistory(newModel);
          return { model: newModel };
        });
      },

      deleteRelationship: (entityId, relationshipId) => {
        set((state) => {
          const newModel = updateActivePage(state.model, (page) => ({
            ...page,
            entities: page.entities.map((entity) =>
              entity.id === entityId
                ? {
                    ...entity,
                    relationships: entity.relationships.filter(
                      (rel) => rel.id !== relationshipId
                    ),
                  }
                : entity
            ),
            edges: page.edges.filter(
              (edge) => edge.relationshipId !== relationshipId
            ),
            updatedAt: new Date().toISOString(),
          }));
          pushToHistory(newModel);
          return { model: newModel };
        });
      },

      // ============================================
      // EDGE ACTIONS
      // ============================================

      addEdge: (edge) => {
        const newEdge: EdgeDefinition = {
          ...edge,
          id: uuidv4(),
        };

        set((state) => {
          const newModel = updateActivePage(state.model, (page) => ({
            ...page,
            edges: [...page.edges, newEdge],
            updatedAt: new Date().toISOString(),
          }));
          pushToHistory(newModel);
          return { model: newModel };
        });
      },

      addEdges: (edges) => {
        if (edges.length === 0) return;

        set((state) => {
          const newModel = updateActivePage(state.model, (page) => ({
            ...page,
            edges: [...page.edges, ...edges],
            updatedAt: new Date().toISOString(),
          }));
          pushToHistory(newModel);
          return { model: newModel };
        });
      },

      deleteEdge: (edgeId) => {
        const activePage = get().getActivePage();
        const edge = activePage?.edges.find((e) => e.id === edgeId);

        if (edge?.relationshipId) {
          const sourceEntity = activePage?.entities.find(
            (e) => e.id === edge.source
          );
          if (sourceEntity) {
            get().deleteRelationship(edge.source, edge.relationshipId);
            return;
          }
        }

        set((state) => {
          const newModel = updateActivePage(state.model, (page) => ({
            ...page,
            edges: page.edges.filter((e) => e.id !== edgeId),
            updatedAt: new Date().toISOString(),
          }));
          pushToHistory(newModel);
          return { model: newModel };
        });
      },

      // ============================================
      // BULK REPLACE ACTIONS (for imports)
      // ============================================

      setEntities: (entities) => {
        set((state) => {
          const newModel = updateActivePage(state.model, (page) => ({
            ...page,
            entities,
            updatedAt: new Date().toISOString(),
          }));
          pushToHistory(newModel);
          return { model: newModel };
        });
      },

      setEdges: (edges) => {
        set((state) => {
          const newModel = updateActivePage(state.model, (page) => ({
            ...page,
            edges,
            updatedAt: new Date().toISOString(),
          }));
          pushToHistory(newModel);
          return { model: newModel };
        });
      },

      // ============================================
      // MODEL ACTIONS
      // ============================================

      updateModelInfo: (updates) => {
        set((state) => {
          const newModel: MetadataModel = {
            ...state.model,
            ...updates,
            updatedAt: new Date().toISOString(),
          };
          pushToHistory(newModel);
          return { model: newModel };
        });
      },

      clearModel: () => {
        const newModel = createEmptyModel();
        set({ model: newModel });
        pushToHistory(newModel);
      },

      loadModel: (model) => {
        // Migrate old models without pages
        if (!model.pages || model.pages.length === 0) {
          const migratedPage = createEmptyPage('Page 1');
          migratedPage.entities = model.entities || [];
          migratedPage.edges = model.edges || [];
          model = {
            ...model,
            pages: [migratedPage],
            activePageId: migratedPage.id,
          };
        }
        // Ensure requirementsMatrix exists (for backwards compatibility)
        if (!model.requirementsMatrix) {
          model = {
            ...model,
            requirementsMatrix: null,
          };
        }
        set({ model });
        pushToHistory(model);
      },

      exportModel: () => {
        return get().model;
      },

      loadTemplate: (template: CanvasTemplate) => {
        const newPage = buildPageFromTemplate(template);

        const newModel: MetadataModel = {
          id: uuidv4(),
          name: template.name,
          description: template.description,
          pages: [newPage],
          activePageId: newPage.id,
          enrichmentPlans: [],
          domains: [],
          customMetadata: [],
          versions: [],
          requirementsMatrix: null,
          entities: [],
          edges: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        set({ model: newModel, isGalleryOpen: false });
        pushToHistory(newModel);
      },

      applyTemplateToNewPage: (template: CanvasTemplate) => {
        const { model } = get();
        const newPage = buildPageFromTemplate(template);

        const newModel: MetadataModel = {
          ...model,
          pages: [...model.pages, newPage],
          activePageId: newPage.id,
          updatedAt: new Date().toISOString(),
        };

        set({ model: newModel, isGalleryOpen: false });
        pushToHistory(newModel);
      },

      // ============================================
      // VERSIONING ACTIONS
      // ============================================

      createVersion: (name, description) => {
        set((state) => {
          const { model } = state;
          const newVersion = {
            id: uuidv4(),
            name,
            description,
            timestamp: new Date().toISOString(),
            snapshot: JSON.stringify(model),
          };

          const newModel = {
            ...model,
            versions: [...(model.versions || []), newVersion],
            updatedAt: new Date().toISOString(),
          };

          pushToHistory(newModel);
          return { model: newModel };
        });
      },

      rollbackToVersion: (versionId) => {
        set((state) => {
          const { model } = state;
          const version = model.versions?.find((v) => v.id === versionId);
          if (!version) return state;

          try {
            const restoredModel = JSON.parse(version.snapshot) as MetadataModel;
            // Keep the current versions list even after rollback
            restoredModel.versions = model.versions;
            restoredModel.updatedAt = new Date().toISOString();

            pushToHistory(restoredModel);
            return { model: restoredModel };
          } catch (e) {
            console.error('Failed to rollback to version:', e);
            return state;
          }
        });
      },

      deleteVersion: (versionId) => {
        set((state) => {
          const { model } = state;
          const newModel = {
            ...model,
            versions: (model.versions || []).filter((v) => v.id !== versionId),
            updatedAt: new Date().toISOString(),
          };

          pushToHistory(newModel);
          return { model: newModel };
        });
      },

      // ============================================
      // GALLERY ACTIONS
      // ============================================

      openGallery: () => {
        set({ isGalleryOpen: true });
      },

      closeGallery: () => {
        set({ isGalleryOpen: false });
      },

      // ============================================
      // REQUIREMENTS MATRIX ACTIONS
      // ============================================

      setRequirementsMatrix: (matrix: RequirementsMatrix | null) => {
        set((state) => {
          const newModel: MetadataModel = {
            ...state.model,
            requirementsMatrix: matrix,
            updatedAt: new Date().toISOString(),
          };
          pushToHistory(newModel);
          return { model: newModel };
        });
      },

      updateRequirementLevel: (assetType: string, field: string, level: RequirementType) => {
        set((state) => {
          const matrix = state.model.requirementsMatrix;
          if (!matrix) return state;

          // Find the asset type requirements
          const updatedAssetTypeReqs = matrix.assetTypeRequirements.map((atr) => {
            if (atr.assetType !== assetType) return atr;

            // Update or add the field requirement
            const existingFieldIndex = atr.requirements.findIndex(r => r.field === field);

            if (existingFieldIndex >= 0) {
              // Update existing requirement
              const updatedRequirements = [...atr.requirements];
              updatedRequirements[existingFieldIndex] = {
                ...updatedRequirements[existingFieldIndex],
                requirement: level,
              };
              return {
                ...atr,
                requirements: updatedRequirements,
              };
            } else {
              // Add new requirement
              return {
                ...atr,
                requirements: [
                  ...atr.requirements,
                  { field, requirement: level },
                ],
              };
            }
          });

          const newModel: MetadataModel = {
              ...state.model,
              requirementsMatrix: {
                ...matrix,
                assetTypeRequirements: updatedAssetTypeReqs,
              },
              updatedAt: new Date().toISOString(),
          };

          pushToHistory(newModel);
          return { model: newModel };
        });
      },

      // ============================================
      // ENRICHMENT ACTIONS
      // ============================================

      setEnrichmentProgress: (progress) => {
        set((state) => ({
          enrichment: {
            ...state.enrichment,
            ...progress,
          },
        }));
      },

      cancelEnrichment: () => {
        if (_enrichmentAbortController) {
          _enrichmentAbortController.abort();
        }
        _enrichmentAbortController = null;
        set((state) => ({
          enrichment: {
            ...state.enrichment,
            status: 'cancelled',
            finishedAt: new Date().toISOString(),
          },
        }));
      },

      enrichCanvasFromAtlan: async (options = {}) => {
        // Cancel any in-flight run
        if (_enrichmentAbortController) {
          _enrichmentAbortController.abort();
        }

        const ctrl = new AbortController();
        _enrichmentAbortController = ctrl;

        set((state) => ({
          enrichment: {
            ...state.enrichment,
            status: 'running',
            startedAt: new Date().toISOString(),
            finishedAt: null,
            error: null,
            batchesDone: 0,
            batchesTotal: 0,
            nodesAdded: 0,
            edgesAdded: 0,
            lastOptions: options || null,
          },
        }));

        try {
          if (ctrl.signal.aborted) throw new DOMException('Aborted', 'AbortError');

          const includeLineage = options?.includeLineage !== false; // Default true
          if (!includeLineage) {
            set((state) => ({
              enrichment: {
                ...state.enrichment,
                status: 'completed',
                finishedAt: new Date().toISOString(),
              },
            }));
            _enrichmentAbortController = null;
            return { nodesAdded: 0, edgesAdded: 0 };
          }

          // Get entities on active page that have Atlan GUIDs
          const activePage = get().getActivePage();
          const importedEntities = (activePage?.entities || []).filter((e) => !!e.atlanGuid);

          if (importedEntities.length === 0) {
            set((state) => ({
              enrichment: {
                ...state.enrichment,
                status: 'completed',
                finishedAt: new Date().toISOString(),
              },
            }));
            _enrichmentAbortController = null;
            return { nodesAdded: 0, edgesAdded: 0 };
          }

          // Collect process GUIDs from lineage relationships
          const processGuids = new Set<string>();
          importedEntities.forEach((entity) => {
            const rels = entity.atlanRelationships || {};
            const inputTo = rels.inputToProcesses;
            const outFrom = rels.outputFromProcesses;
            if (Array.isArray(inputTo)) {
              inputTo.forEach((p: { guid?: string }) => p?.guid && processGuids.add(p.guid));
            }
            if (Array.isArray(outFrom)) {
              outFrom.forEach((p: { guid?: string }) => p?.guid && processGuids.add(p.guid));
            }
          });

          const processGuidList = Array.from(processGuids);
          const batchSize = options?.batchSize ?? 150;
          const batchesTotal = Math.ceil(processGuidList.length / batchSize) || 1;

          set((state) => ({
            enrichment: {
              ...state.enrichment,
              batchesDone: 0,
              batchesTotal,
            },
          }));

          // Fetch process assets
          const fetchedProcesses = processGuidList.length > 0
            ? await fetchAssetsByGuidsBatched({
                guids: processGuidList,
                attributes: ['name', 'qualifiedName', '__typeName'],
                relationAttributes: ['inputs', 'outputs'],
                signal: ctrl.signal,
                batchSize,
                concurrency: options?.concurrency ?? 3,
                maxAttempts: options?.maxAttempts ?? 3,
                baseDelayMs: options?.baseDelayMs ?? 300,
                onBatchResult: ({ batchIndex, batchCount }) => {
                  get().setEnrichmentProgress({
                    batchesDone: batchIndex + 1,
                    batchesTotal: batchCount,
                  });
                },
              })
            : [];

          if (ctrl.signal.aborted) throw new DOMException('Aborted', 'AbortError');

          // Add process entities to canvas
          let nodesAdded = 0;
          if (fetchedProcesses.length > 0) {
            const processEntities: EntityDefinition[] = fetchedProcesses.map((asset) => ({
              id: uuidv4(),
              name: asset.name,
              type: 'Process',
              category: 'Pipeline' as AtlanAssetCategory,
              attributes: [],
              relationships: [],
              position: { x: Math.random() * 800, y: Math.random() * 600 },
              atlanGuid: asset.guid,
              atlanQualifiedName: asset.qualifiedName,
              atlanTypeName: asset.typeName,
              atlanRawAttributes: asset.attributes,
              atlanRelationships: asset.relationships,
            }));

            // Filter out processes already on canvas
            const existingGuids = new Set(importedEntities.map((e) => e.atlanGuid));
            const newProcessEntities = processEntities.filter((e) => !existingGuids.has(e.atlanGuid));

            if (newProcessEntities.length > 0) {
              set((state) => ({
                model: updateActivePage(state.model, (page) => ({
                  ...page,
                  entities: [...page.entities, ...newProcessEntities],
                  updatedAt: new Date().toISOString(),
                })),
              }));
              nodesAdded = newProcessEntities.length;
            }
          }

          // Build lineage edges
          const afterAdd = get();
          const afterPage = afterAdd.getActivePage();
          const allEntities = afterPage?.entities || [];
          const allEdges = afterPage?.edges || [];

          const norm = (v: unknown): string => (v || '').toString().toLowerCase();
          const nodeIdByGuid = new Map<string, string>();
          const nodeIdByQn = new Map<string, string>();

          allEntities.forEach((e) => {
            const guid = norm(e.atlanGuid);
            const qn = norm(e.atlanQualifiedName || e.qualifiedName);
            if (guid) nodeIdByGuid.set(guid, e.id);
            if (qn) nodeIdByQn.set(qn, e.id);
          });

          const existingEdgeKeys = new Set(
            allEdges.map((e) =>
              edgeKey({
                source: e.source,
                target: e.target,
                label: e.label || 'relates to',
                kind: (e.data?.kind as EdgeKind) || 'unknown',
              })
            ).filter(Boolean)
          );

          // Convert entities to asset-like objects for edge builder
          const syntheticAssets = allEntities
            .filter((e) => !!e.atlanGuid)
            .map((e) => ({
              guid: e.atlanGuid,
              qualifiedName: e.atlanQualifiedName,
              typeName: e.atlanTypeName || e.type,
              attributes: e.atlanRawAttributes || {},
              relationships: e.atlanRelationships || {},
            }));

          const lineageEdges = buildLineageEdges(syntheticAssets, {
            getNodeIdByGuid: (guid) => (guid ? nodeIdByGuid.get(norm(guid)) : undefined),
            getNodeIdByQualifiedName: (qn) => (qn ? nodeIdByQn.get(norm(qn)) : undefined),
            existingEdgeKeys,
          });

          // Add lineage edges to canvas
          let edgesAdded = 0;
          if (lineageEdges.length > 0) {
            const newEdges: EdgeDefinition[] = lineageEdges.map((e) => ({
              id: e.id,
              source: e.source,
              target: e.target,
              label: e.label,
              relationshipId: uuidv4(),
              data: e.data,
            }));

            set((state) => ({
              model: updateActivePage(state.model, (page) => ({
                ...page,
                edges: [...page.edges, ...newEdges],
                updatedAt: new Date().toISOString(),
              })),
            }));
            edgesAdded = newEdges.length;
          }

          _enrichmentAbortController = null;
          set((state) => ({
            enrichment: {
              ...state.enrichment,
              status: 'completed',
              finishedAt: new Date().toISOString(),
              nodesAdded,
              edgesAdded,
              batchesDone: state.enrichment.batchesTotal,
            },
          }));

          return { nodesAdded, edgesAdded };
        } catch (err) {
          const isAbort = err instanceof DOMException && err.name === 'AbortError';
          _enrichmentAbortController = null;

          set((state) => ({
            enrichment: {
              ...state.enrichment,
              status: isAbort ? 'cancelled' : 'error',
              error: isAbort ? null : ((err as Error)?.message || 'Enrichment failed'),
              finishedAt: new Date().toISOString(),
            },
          }));

          if (!isAbort) throw err;
          return { nodesAdded: 0, edgesAdded: 0 };
        }
      },

      retryEnrichment: async () => {
        const opts = get().enrichment?.lastOptions || {};
        return await get().enrichCanvasFromAtlan(opts);
      },

      // ============================================
      // PLAN ACTIONS
      // ============================================

      addPlan: (plan) => {
        set((state) => {
          const newModel = {
            ...state.model,
            enrichmentPlans: [...(state.model.enrichmentPlans || []), plan],
            updatedAt: new Date().toISOString(),
          };
          pushToHistory(newModel);
          return { model: newModel, activePlanId: plan.id };
        });
      },

      updatePlan: (planId, updates) => {
        set((state) => {
          const newModel = {
            ...state.model,
            enrichmentPlans: (state.model.enrichmentPlans || []).map((p) =>
              p.id === planId ? { ...p, ...updates } : p
            ),
            updatedAt: new Date().toISOString(),
          };
          pushToHistory(newModel);
          return { model: newModel };
        });
      },

      deletePlan: (planId) => {
        set((state) => {
          const newModel = {
            ...state.model,
            enrichmentPlans: (state.model.enrichmentPlans || []).filter((p) => p.id !== planId),
            updatedAt: new Date().toISOString(),
          };
          pushToHistory(newModel);
          return { model: newModel, activePlanId: state.activePlanId === planId ? null : state.activePlanId };
        });
      },

      activePlanId: null,
      setActivePlanId: (planId) => set({ activePlanId: planId }),

      // ============================================
      // DOMAIN ACTIONS
      // ============================================

      addDomain: (domain) => {
        set((state) => {
          const newModel = {
            ...state.model,
            domains: [...(state.model.domains || []), domain],
            updatedAt: new Date().toISOString(),
          };
          pushToHistory(newModel);
          return { model: newModel };
        });
      },

      setDomains: (domains) => {
        set((state) => {
          const newModel = {
            ...state.model,
            domains,
            updatedAt: new Date().toISOString(),
          };
          pushToHistory(newModel);
          return { model: newModel };
        });
      },

      updateDomain: (id, updates) => {
        set((state) => {
          const newModel = {
            ...state.model,
            domains: (state.model.domains || []).map((d) =>
              d.id === id ? { ...d, ...updates } : d
            ),
            updatedAt: new Date().toISOString(),
          };
          pushToHistory(newModel);
          return { model: newModel };
        });
      },

      deleteDomain: (id) => {
        set((state) => {
          const newModel = {
            ...state.model,
            domains: (state.model.domains || []).filter((d) => d.id !== id),
            updatedAt: new Date().toISOString(),
          };
          pushToHistory(newModel);
          return { model: newModel };
        });
      },

      // ============================================
      // CUSTOM METADATA ACTIONS
      // ============================================

      addCustomMetadata: (cm) => {
        set((state) => {
          const newModel = {
            ...state.model,
            customMetadata: [...(state.model.customMetadata || []), cm],
            updatedAt: new Date().toISOString(),
          };
          pushToHistory(newModel);
          return { model: newModel };
        });
      },

      updateCustomMetadata: (id, updates) => {
        set((state) => {
          const newModel = {
            ...state.model,
            customMetadata: (state.model.customMetadata || []).map((c) =>
              c.id === id ? { ...c, ...updates } : c
            ),
            updatedAt: new Date().toISOString(),
          };
          pushToHistory(newModel);
          return { model: newModel };
        });
      },

      setCustomMetadata: (schemas) => {
        set((state) => {
          const newModel = {
            ...state.model,
            customMetadata: schemas,
            updatedAt: new Date().toISOString(),
          };
          pushToHistory(newModel);
          return { model: newModel };
        });
      },

      deleteCustomMetadata: (id) => {
        set((state) => {
          const newModel = {
            ...state.model,
            customMetadata: (state.model.customMetadata || []).filter((c) => c.id !== id),
            updatedAt: new Date().toISOString(),
          };
          pushToHistory(newModel);
          return { model: newModel };
        });
      },

      // ============================================
      // COMPUTED GETTERS
      // ============================================

      getActivePage: () => {
        return getActivePage(get().model);
      },

      getActiveEntities: () => {
        return getActivePage(get().model)?.entities || [];
      },

      getActiveEdges: () => {
        return getActivePage(get().model)?.edges || [];
      },
    }),
    {
      name: 'atlan-metadata-model',
      version: 2,
      partialize: (state) => ({
        model: state.model,
      }),
    }
  )
));

// Autosave subscription
let autosaveTimeout: ReturnType<typeof setTimeout>;
useModelStore.subscribe(
  (state) => state.model,
  () => {
    clearTimeout(autosaveTimeout);
    autosaveTimeout = setTimeout(() => {
      // In a real app, this would save to a backend
      // For now, we just update the timestamp to indicate "saved"
      useModelStore.setState((state) => ({
        model: {
          ...state.model,
          updatedAt: new Date().toISOString(),
        }
      }));
    }, 2000); // Debounce for 2 seconds
  }
);

// Hard reset - clears persisted data
export function resetModelStore() {
  localStorage.removeItem('atlan-metadata-model');
  useModelStore.setState({ model: createEmptyModel() });
}
