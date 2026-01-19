/**
 * Tenant Configuration Store
 * 
 * Manages tenant-specific metadata configuration:
 * - Field availability and mappings
 * - Custom metadata definitions
 * - Signal overrides and weights
 * - Reconciliation state
 * 
 * Uses Zustand for state management with persistence.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * @typedef {Object} FieldMapping
 * @property {string} fieldId - Unified field ID
 * @property {string} mdlhColumn - Actual MDLH column name
 * @property {boolean} available - Is this field available in the tenant?
 * @property {string} [source] - Source type: 'native' | 'custom_metadata' | 'derived'
 * @property {string} [customMetadataId] - If source is custom_metadata, the CM name
 * @property {string} [derivation] - If source is derived, the derivation logic
 * @property {Date} [lastVerified] - When this mapping was last verified
 */

/**
 * @typedef {Object} CustomMetadataConfig
 * @property {string} id
 * @property {string} name
 * @property {string} [displayName]
 * @property {string[]} attributes
 * @property {string[]} applicableAssetTypes
 * @property {boolean} enabled
 */

/**
 * @typedef {Object} SignalOverride
 * @property {string} signalId
 * @property {number} [weightOverride] - Override signal weight (0-1)
 * @property {boolean} [required] - Mark as required
 * @property {boolean} [disabled] - Disable this signal
 * @property {string[]} [additionalFields] - Extra fields to include
 */

/**
 * @typedef {Object} ReconciliationResult
 * @property {string} fieldId
 * @property {'match' | 'mismatch' | 'missing' | 'extra'} status
 * @property {string} [expectedColumn]
 * @property {string} [actualColumn]
 * @property {string} [message]
 */

export const useTenantConfigStore = create(
  persist(
    (set, get) => ({
      // =========================================================================
      // STATE
      // =========================================================================
      
      // Tenant identification
      tenantId: null,
      tenantName: null,
      
      // Field mappings
      fieldMappings: [],
      fieldMappingsLoaded: false,
      
      // Custom metadata
      customMetadataConfigs: [],
      
      // Signal overrides
      signalOverrides: [],
      
      // Reconciliation
      reconciliationResults: [],
      lastReconciliation: null,
      
      // Discovery state
      discoveredColumns: [], // Columns found in MDLH tables
      discoveredCustomMetadata: [], // CM found in tenant
      discoveryTimestamp: null,
      
      // UI state
      showReconciliationPanel: false,
      selectedFieldId: null,
      
      // =========================================================================
      // TENANT ACTIONS
      // =========================================================================
      
      /**
       * Set tenant info
       * @param {string} tenantId
       * @param {string} [tenantName]
       */
      setTenant: (tenantId, tenantName = null) => {
        set({
          tenantId,
          tenantName: tenantName || tenantId,
        });
      },
      
      /**
       * Clear tenant config
       */
      clearTenant: () => {
        set({
          tenantId: null,
          tenantName: null,
          fieldMappings: [],
          fieldMappingsLoaded: false,
          customMetadataConfigs: [],
          signalOverrides: [],
          reconciliationResults: [],
          lastReconciliation: null,
          discoveredColumns: [],
          discoveredCustomMetadata: [],
          discoveryTimestamp: null,
        });
      },
      
      // =========================================================================
      // FIELD MAPPING ACTIONS
      // =========================================================================
      
      /**
       * Set field mappings (bulk update)
       * @param {FieldMapping[]} mappings
       */
      setFieldMappings: (mappings) => {
        set({
          fieldMappings: mappings,
          fieldMappingsLoaded: true,
        });
      },
      
      /**
       * Update a single field mapping
       * @param {string} fieldId
       * @param {Partial<FieldMapping>} updates
       */
      updateFieldMapping: (fieldId, updates) => {
        set(state => ({
          fieldMappings: state.fieldMappings.map(m =>
            m.fieldId === fieldId
              ? { ...m, ...updates, lastVerified: new Date() }
              : m
          ),
        }));
      },
      
      /**
       * Add a new field mapping
       * @param {FieldMapping} mapping
       */
      addFieldMapping: (mapping) => {
        set(state => ({
          fieldMappings: [
            ...state.fieldMappings.filter(m => m.fieldId !== mapping.fieldId),
            { ...mapping, lastVerified: new Date() },
          ],
        }));
      },
      
      /**
       * Remove a field mapping
       * @param {string} fieldId
       */
      removeFieldMapping: (fieldId) => {
        set(state => ({
          fieldMappings: state.fieldMappings.filter(m => m.fieldId !== fieldId),
        }));
      },
      
      /**
       * Get field mapping by ID
       * @param {string} fieldId
       * @returns {FieldMapping | undefined}
       */
      getFieldMapping: (fieldId) => {
        return get().fieldMappings.find(m => m.fieldId === fieldId);
      },
      
      /**
       * Get available field IDs
       * @returns {string[]}
       */
      getAvailableFieldIds: () => {
        return get().fieldMappings
          .filter(m => m.available)
          .map(m => m.fieldId);
      },
      
      /**
       * Check if a field is available
       * @param {string} fieldId
       * @returns {boolean}
       */
      isFieldAvailable: (fieldId) => {
        const mapping = get().getFieldMapping(fieldId);
        return mapping?.available === true;
      },
      
      // =========================================================================
      // CUSTOM METADATA ACTIONS
      // =========================================================================
      
      /**
       * Set custom metadata configs
       * @param {CustomMetadataConfig[]} configs
       */
      setCustomMetadataConfigs: (configs) => {
        set({ customMetadataConfigs: configs });
      },
      
      /**
       * Add or update custom metadata config
       * @param {CustomMetadataConfig} config
       */
      upsertCustomMetadataConfig: (config) => {
        set(state => ({
          customMetadataConfigs: [
            ...state.customMetadataConfigs.filter(c => c.id !== config.id),
            config,
          ],
        }));
      },
      
      /**
       * Toggle custom metadata enabled state
       * @param {string} configId
       */
      toggleCustomMetadata: (configId) => {
        set(state => ({
          customMetadataConfigs: state.customMetadataConfigs.map(c =>
            c.id === configId ? { ...c, enabled: !c.enabled } : c
          ),
        }));
      },
      
      // =========================================================================
      // SIGNAL OVERRIDE ACTIONS
      // =========================================================================
      
      /**
       * Set signal overrides
       * @param {SignalOverride[]} overrides
       */
      setSignalOverrides: (overrides) => {
        set({ signalOverrides: overrides });
      },
      
      /**
       * Update signal override
       * @param {string} signalId
       * @param {Partial<SignalOverride>} updates
       */
      updateSignalOverride: (signalId, updates) => {
        set(state => {
          const existing = state.signalOverrides.find(o => o.signalId === signalId);
          if (existing) {
            return {
              signalOverrides: state.signalOverrides.map(o =>
                o.signalId === signalId ? { ...o, ...updates } : o
              ),
            };
          } else {
            return {
              signalOverrides: [
                ...state.signalOverrides,
                { signalId, ...updates },
              ],
            };
          }
        });
      },
      
      /**
       * Get signal override
       * @param {string} signalId
       * @returns {SignalOverride | undefined}
       */
      getSignalOverride: (signalId) => {
        return get().signalOverrides.find(o => o.signalId === signalId);
      },
      
      /**
       * Get effective signal weight (with override)
       * @param {string} signalId
       * @param {number} defaultWeight
       * @returns {number}
       */
      getEffectiveSignalWeight: (signalId, defaultWeight = 1) => {
        const override = get().getSignalOverride(signalId);
        if (override?.disabled) return 0;
        return override?.weightOverride ?? defaultWeight;
      },
      
      // =========================================================================
      // DISCOVERY ACTIONS
      // =========================================================================
      
      /**
       * Set discovered columns from MDLH schema scan
       * @param {string[]} columns
       */
      setDiscoveredColumns: (columns) => {
        set({
          discoveredColumns: columns,
          discoveryTimestamp: new Date(),
        });
      },
      
      /**
       * Set discovered custom metadata
       * @param {Object[]} customMetadata
       */
      setDiscoveredCustomMetadata: (customMetadata) => {
        set({ discoveredCustomMetadata: customMetadata });
      },
      
      // =========================================================================
      // RECONCILIATION ACTIONS
      // =========================================================================
      
      /**
       * Set reconciliation results
       * @param {ReconciliationResult[]} results
       */
      setReconciliationResults: (results) => {
        set({
          reconciliationResults: results,
          lastReconciliation: new Date(),
        });
      },
      
      /**
       * Get reconciliation summary
       * @returns {{total: number, matches: number, mismatches: number, missing: number, extra: number}}
       */
      getReconciliationSummary: () => {
        const results = get().reconciliationResults;
        return {
          total: results.length,
          matches: results.filter(r => r.status === 'match').length,
          mismatches: results.filter(r => r.status === 'mismatch').length,
          missing: results.filter(r => r.status === 'missing').length,
          extra: results.filter(r => r.status === 'extra').length,
        };
      },
      
      /**
       * Toggle reconciliation panel
       */
      toggleReconciliationPanel: () => {
        set(state => ({
          showReconciliationPanel: !state.showReconciliationPanel,
        }));
      },
      
      // =========================================================================
      // UI ACTIONS
      // =========================================================================
      
      /**
       * Select a field for editing
       * @param {string | null} fieldId
       */
      setSelectedField: (fieldId) => {
        set({ selectedFieldId: fieldId });
      },
      
      // =========================================================================
      // BULK OPERATIONS
      // =========================================================================
      
      /**
       * Initialize tenant config from unified field catalog
       * @param {Object[]} unifiedFields - Fields from unified catalog
       * @param {string[]} availableColumns - Columns discovered in MDLH
       */
      initializeFromCatalog: (unifiedFields, availableColumns) => {
        const columnSet = new Set(availableColumns.map(c => c.toUpperCase()));
        
        const mappings = unifiedFields.map(field => ({
          fieldId: field.id,
          mdlhColumn: field.mdlhColumn || '',
          available: field.mdlhColumn ? columnSet.has(field.mdlhColumn) : false,
          source: 'native',
          lastVerified: new Date(),
        }));
        
        set({
          fieldMappings: mappings,
          fieldMappingsLoaded: true,
          discoveredColumns: availableColumns,
          discoveryTimestamp: new Date(),
        });
      },
      
      /**
       * Export config as JSON
       * @returns {Object}
       */
      exportConfig: () => {
        const state = get();
        return {
          tenantId: state.tenantId,
          tenantName: state.tenantName,
          fieldMappings: state.fieldMappings,
          customMetadataConfigs: state.customMetadataConfigs,
          signalOverrides: state.signalOverrides,
          exportedAt: new Date().toISOString(),
        };
      },
      
      /**
       * Import config from JSON
       * @param {Object} config
       */
      importConfig: (config) => {
        set({
          tenantId: config.tenantId || null,
          tenantName: config.tenantName || null,
          fieldMappings: config.fieldMappings || [],
          fieldMappingsLoaded: true,
          customMetadataConfigs: config.customMetadataConfigs || [],
          signalOverrides: config.signalOverrides || [],
        });
      },
    }),
    {
      name: 'mdlh-tenant-config-store',
      partialize: (state) => ({
        tenantId: state.tenantId,
        tenantName: state.tenantName,
        fieldMappings: state.fieldMappings,
        customMetadataConfigs: state.customMetadataConfigs,
        signalOverrides: state.signalOverrides,
      }),
    }
  )
);

export default useTenantConfigStore;
