import { create } from 'zustand';

// Scope filter for filtering by import hierarchy
export interface ScopeFilter {
  connector: string | null;
  database: string | null;
  schema: string | null;
  assetTypes: string[];
}

interface UIState {
  // Selection
  selectedEntityId: string | null;
  selectedEntityIds: string[];
  selectedEdgeId: string | null;
  // Panel visibility
  isPaletteOpen: boolean;
  isEntityPanelOpen: boolean;
  // Global modals
  isAtlanConnectionModalOpen: boolean;
  // Drag state
  draggedAsset: {
    category: string;
    assetType: string;
  } | null;
  // Filters (existing)
  connectorFilter: string[];
  assetTypeFilter: string[];
  searchQuery: string;
  // Scope filter (NEW) - for filtering by import hierarchy
  scopeFilter: ScopeFilter;
  // Actions
  selectEntity: (id: string | null) => void;
  selectEntities: (ids: string[]) => void;
  selectEdge: (id: string | null) => void;
  togglePalette: () => void;
  toggleEntityPanel: () => void;
  openAtlanConnectionModal: () => void;
  closeAtlanConnectionModal: () => void;
  setDraggedAsset: (asset: { category: string; assetType: string } | null) => void;
  setConnectorFilter: (connectors: string[]) => void;
  setAssetTypeFilter: (types: string[]) => void;
  setSearchQuery: (query: string) => void;
  clearSelection: () => void;
  // Scope filter actions (NEW)
  setScopeFilter: (filter: Partial<ScopeFilter>) => void;
  clearScopeFilter: () => void;
}

const initialScopeFilter: ScopeFilter = {
  connector: null,
  database: null,
  schema: null,
  assetTypes: [],
};

export const useUIStore = create<UIState>((set) => ({
  selectedEntityId: null,
  selectedEntityIds: [],
  selectedEdgeId: null,
  isPaletteOpen: true,
  isEntityPanelOpen: true,
  isAtlanConnectionModalOpen: false,
  draggedAsset: null,
  connectorFilter: [],
  assetTypeFilter: [],
  searchQuery: '',
  scopeFilter: initialScopeFilter,

  selectEntity: (id) => {
    set({
      selectedEntityId: id,
      selectedEntityIds: id ? [id] : [],
      selectedEdgeId: null,
      isEntityPanelOpen: id !== null,
    });
  },

  selectEntities: (ids) => {
    set({
      selectedEntityIds: ids,
      selectedEntityId: ids.length === 1 ? ids[0] : null,
      selectedEdgeId: null,
      isEntityPanelOpen: ids.length > 0,
    });
  },

  selectEdge: (id) => {
    set({
      selectedEdgeId: id,
      selectedEntityId: null,
    });
  },

  togglePalette: () => {
    set((state) => ({ isPaletteOpen: !state.isPaletteOpen }));
  },

  toggleEntityPanel: () => {
    set((state) => ({ isEntityPanelOpen: !state.isEntityPanelOpen }));
  },

  openAtlanConnectionModal: () => {
    set({ isAtlanConnectionModalOpen: true });
  },

  closeAtlanConnectionModal: () => {
    set({ isAtlanConnectionModalOpen: false });
  },

  setDraggedAsset: (asset) => {
    set({ draggedAsset: asset });
  },

  setConnectorFilter: (connectors) => {
    set({ connectorFilter: connectors });
  },

  setAssetTypeFilter: (types) => {
    set({ assetTypeFilter: types });
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  clearSelection: () => {
    set({
      selectedEntityId: null,
      selectedEntityIds: [],
      selectedEdgeId: null,
    });
  },

  setScopeFilter: (filter) => {
    set((state) => ({
      scopeFilter: {
        ...state.scopeFilter,
        ...filter,
        // Clear dependent filters when parent changes
        ...(filter.connector !== undefined && filter.connector !== state.scopeFilter.connector
          ? { database: null, schema: null }
          : {}),
        ...(filter.database !== undefined && filter.database !== state.scopeFilter.database
          ? { schema: null }
          : {}),
      },
    }));
  },

  clearScopeFilter: () => {
    set({ scopeFilter: initialScopeFilter });
  },
}));
