// ============================================
// TENANT CONFIGURATION STORE
// Manages tenant-specific field mappings and configuration
// ============================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================
// TYPES
// ============================================

export type MappingStatus = 'auto' | 'confirmed' | 'rejected' | 'pending';

export type ReconciliationStatus =
  | 'MATCHED'
  | 'ALIAS_MATCHED'
  | 'CM_MATCHED'
  | 'CM_SUGGESTED'
  | 'NOT_FOUND'
  | 'AMBIGUOUS';

export interface FieldSource {
  type: 'native' | 'native_any' | 'custom_metadata' | 'classification' | 'relationship' | 'derived';
  // Additional properties vary by type
  [key: string]: unknown;
}

export interface TenantFieldMapping {
  canonicalFieldId: string;
  canonicalFieldName: string;
  tenantSource?: FieldSource;
  status: MappingStatus;
  reconciliationStatus?: ReconciliationStatus;
  confidence?: number;
  confirmedAt?: string;
  confirmedBy?: string;
  notes?: string;
}

export interface TenantCustomField {
  id: string;
  displayName: string;
  description?: string;
  tenantSource: FieldSource;
  contributesToSignals: Array<{ signal: string; weight: number }>;
  createdAt: string;
  createdBy?: string;
}

export interface ClassificationMapping {
  pattern: string;
  signal: string;
  indicatorType: 'positive' | 'negative';
  confirmedAt?: string;
}

export interface TenantConfig {
  tenantId: string;
  baseUrl: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  fieldMappings: TenantFieldMapping[];
  customFields: TenantCustomField[];
  classificationMappings: ClassificationMapping[];
  excludedFields: string[];
  lastSnapshotAt?: string;
}

export interface SchemaSnapshot {
  tenantId: string;
  discoveredAt: string;
  entityTypes: string[];
  customMetadata: Array<{
    name: string;
    displayName: string;
    attributes: Array<{
      name: string;
      displayName: string;
      type: string;
    }>;
  }>;
  classifications: Array<{
    name: string;
    displayName: string;
    description?: string;
    usageCount?: number;
  }>;
  domains: Array<{
    guid: string;
    name: string;
    qualifiedName?: string;
  }>;
  // MDLH-specific fields
  tables?: Array<{
    name: string;
    type: string;
    rowCount?: number;
    comment?: string;
  }>;
  columns?: Record<string, Array<{
    name: string;
    type: string;
    nullable?: boolean;
    default?: string;
    comment?: string;
  }>>;
  nativeAttributes?: string[];
}

// ============================================
// STORE STATE
// ============================================

interface TenantConfigState {
  // Current tenant configuration
  config: TenantConfig | null;

  // Schema snapshot from discovery
  schemaSnapshot: SchemaSnapshot | null;

  // UI State
  isLoading: boolean;
  error: string | null;
  selectedFieldId: string | null;
  filterStatus: MappingStatus | 'all';
  searchQuery: string;

  // Discovery progress
  discoveryProgress: {
    phase: 'idle' | 'discovering' | 'reconciling' | 'complete' | 'error';
    message?: string;
  };

  // Actions
  setConfig: (config: TenantConfig) => void;
  setSchemaSnapshot: (snapshot: SchemaSnapshot) => void;

  // Field mapping actions
  confirmMapping: (fieldId: string, confirmedBy?: string) => void;
  rejectMapping: (fieldId: string, notes?: string) => void;
  overrideMapping: (fieldId: string, newSource: FieldSource) => void;
  excludeField: (fieldId: string) => void;
  includeField: (fieldId: string) => void;

  // Custom field actions
  addCustomField: (field: Omit<TenantCustomField, 'id' | 'createdAt'>) => void;
  removeCustomField: (fieldId: string) => void;

  // Classification mapping actions
  addClassificationMapping: (mapping: Omit<ClassificationMapping, 'confirmedAt'>) => void;
  removeClassificationMapping: (pattern: string) => void;

  // UI actions
  setSelectedField: (fieldId: string | null) => void;
  setFilterStatus: (status: MappingStatus | 'all') => void;
  setSearchQuery: (query: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setDiscoveryProgress: (progress: TenantConfigState['discoveryProgress']) => void;

  // Computed getters
  getActiveMapings: () => TenantFieldMapping[];
  getPendingMappings: () => TenantFieldMapping[];
  getFilteredMappings: () => TenantFieldMapping[];
  getConfigCompleteness: () => {
    score: number;
    confirmed: number;
    auto: number;
    pending: number;
    rejected: number;
    excluded: number;
  };

  // Reset
  reset: () => void;
}

// ============================================
// STORE IMPLEMENTATION
// ============================================

const initialState = {
  config: null,
  schemaSnapshot: null,
  isLoading: false,
  error: null,
  selectedFieldId: null,
  filterStatus: 'all' as const,
  searchQuery: '',
  discoveryProgress: { phase: 'idle' as const },
};

export const useTenantConfigStore = create<TenantConfigState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Basic setters
      setConfig: (config) => set({ config }),
      setSchemaSnapshot: (snapshot) => set({ schemaSnapshot: snapshot }),

      // Field mapping actions
      confirmMapping: (fieldId, confirmedBy) => {
        const { config } = get();
        if (!config) return;

        const now = new Date().toISOString();
        const updatedMappings = config.fieldMappings.map((m) =>
          m.canonicalFieldId === fieldId
            ? { ...m, status: 'confirmed' as MappingStatus, confirmedAt: now, confirmedBy }
            : m
        );

        set({
          config: {
            ...config,
            fieldMappings: updatedMappings,
            updatedAt: now,
            version: config.version + 1,
          },
        });
      },

      rejectMapping: (fieldId, notes) => {
        const { config } = get();
        if (!config) return;

        const now = new Date().toISOString();
        const updatedMappings = config.fieldMappings.map((m) =>
          m.canonicalFieldId === fieldId
            ? { ...m, status: 'rejected' as MappingStatus, confirmedAt: now, notes }
            : m
        );

        set({
          config: {
            ...config,
            fieldMappings: updatedMappings,
            updatedAt: now,
            version: config.version + 1,
          },
        });
      },

      overrideMapping: (fieldId, newSource) => {
        const { config } = get();
        if (!config) return;

        const now = new Date().toISOString();
        const existingIndex = config.fieldMappings.findIndex(
          (m) => m.canonicalFieldId === fieldId
        );

        let updatedMappings: TenantFieldMapping[];
        if (existingIndex >= 0) {
          updatedMappings = config.fieldMappings.map((m, i) =>
            i === existingIndex
              ? { ...m, tenantSource: newSource, status: 'confirmed' as MappingStatus, confirmedAt: now }
              : m
          );
        } else {
          updatedMappings = [
            ...config.fieldMappings,
            {
              canonicalFieldId: fieldId,
              canonicalFieldName: fieldId,
              tenantSource: newSource,
              status: 'confirmed' as MappingStatus,
              confirmedAt: now,
            },
          ];
        }

        set({
          config: {
            ...config,
            fieldMappings: updatedMappings,
            updatedAt: now,
            version: config.version + 1,
          },
        });
      },

      excludeField: (fieldId) => {
        const { config } = get();
        if (!config || config.excludedFields.includes(fieldId)) return;

        set({
          config: {
            ...config,
            excludedFields: [...config.excludedFields, fieldId],
            updatedAt: new Date().toISOString(),
            version: config.version + 1,
          },
        });
      },

      includeField: (fieldId) => {
        const { config } = get();
        if (!config) return;

        set({
          config: {
            ...config,
            excludedFields: config.excludedFields.filter((f) => f !== fieldId),
            updatedAt: new Date().toISOString(),
            version: config.version + 1,
          },
        });
      },

      // Custom field actions
      addCustomField: (field) => {
        const { config } = get();
        if (!config) return;

        const now = new Date().toISOString();
        const newField: TenantCustomField = {
          ...field,
          id: `custom_${Date.now()}`,
          createdAt: now,
        };

        set({
          config: {
            ...config,
            customFields: [...config.customFields, newField],
            updatedAt: now,
            version: config.version + 1,
          },
        });
      },

      removeCustomField: (fieldId) => {
        const { config } = get();
        if (!config) return;

        set({
          config: {
            ...config,
            customFields: config.customFields.filter((f) => f.id !== fieldId),
            updatedAt: new Date().toISOString(),
            version: config.version + 1,
          },
        });
      },

      // Classification mapping actions
      addClassificationMapping: (mapping) => {
        const { config } = get();
        if (!config) return;

        const now = new Date().toISOString();
        const newMapping: ClassificationMapping = {
          ...mapping,
          confirmedAt: now,
        };

        set({
          config: {
            ...config,
            classificationMappings: [...config.classificationMappings, newMapping],
            updatedAt: now,
            version: config.version + 1,
          },
        });
      },

      removeClassificationMapping: (pattern) => {
        const { config } = get();
        if (!config) return;

        set({
          config: {
            ...config,
            classificationMappings: config.classificationMappings.filter(
              (m) => m.pattern !== pattern
            ),
            updatedAt: new Date().toISOString(),
            version: config.version + 1,
          },
        });
      },

      // UI actions
      setSelectedField: (fieldId) => set({ selectedFieldId: fieldId }),
      setFilterStatus: (status) => set({ filterStatus: status }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      setDiscoveryProgress: (progress) => set({ discoveryProgress: progress }),

      // Computed getters
      getActiveMapings: () => {
        const { config } = get();
        if (!config) return [];
        return config.fieldMappings.filter(
          (m) => m.status === 'confirmed' || m.status === 'auto'
        );
      },

      getPendingMappings: () => {
        const { config } = get();
        if (!config) return [];
        return config.fieldMappings.filter((m) => m.status === 'pending');
      },

      getFilteredMappings: () => {
        const { config, filterStatus, searchQuery } = get();
        if (!config) return [];

        let mappings = config.fieldMappings;

        // Filter by status
        if (filterStatus !== 'all') {
          mappings = mappings.filter((m) => m.status === filterStatus);
        }

        // Filter by search query
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          mappings = mappings.filter(
            (m) =>
              m.canonicalFieldId.toLowerCase().includes(query) ||
              m.canonicalFieldName.toLowerCase().includes(query)
          );
        }

        return mappings;
      },

      getConfigCompleteness: () => {
        const { config } = get();
        if (!config) {
          return { score: 0, confirmed: 0, auto: 0, pending: 0, rejected: 0, excluded: 0 };
        }

        const confirmed = config.fieldMappings.filter((m) => m.status === 'confirmed').length;
        const auto = config.fieldMappings.filter((m) => m.status === 'auto').length;
        const pending = config.fieldMappings.filter((m) => m.status === 'pending').length;
        const rejected = config.fieldMappings.filter((m) => m.status === 'rejected').length;
        const excluded = config.excludedFields.length;

        const total = config.fieldMappings.length;
        const score = total > 0 ? (confirmed + auto) / total : 0;

        return { score, confirmed, auto, pending, rejected, excluded };
      },

      // Reset
      reset: () => set(initialState),
    }),
    {
      name: 'tenant-config-storage',
      partialize: (state) => ({
        config: state.config,
        schemaSnapshot: state.schemaSnapshot,
      }),
    }
  )
);

// ============================================
// SELECTORS
// ============================================

export const selectConfig = (state: TenantConfigState) => state.config;
export const selectSchemaSnapshot = (state: TenantConfigState) => state.schemaSnapshot;
export const selectIsLoading = (state: TenantConfigState) => state.isLoading;
export const selectError = (state: TenantConfigState) => state.error;
export const selectSelectedFieldId = (state: TenantConfigState) => state.selectedFieldId;
export const selectFilterStatus = (state: TenantConfigState) => state.filterStatus;
export const selectSearchQuery = (state: TenantConfigState) => state.searchQuery;
export const selectDiscoveryProgress = (state: TenantConfigState) => state.discoveryProgress;
