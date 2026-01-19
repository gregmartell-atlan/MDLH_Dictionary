/**
 * Tenant Configuration Page
 * 
 * Configure tenant-specific field mappings and signal overrides.
 */

import React, { useState, useEffect } from 'react';
import { useTenantConfigStore } from '../../../stores/tenantConfigStore';
import { UNIFIED_FIELD_CATALOG } from '../../../evaluation/catalog/unifiedFields';
import { SIGNAL_DEFINITIONS } from '../../../evaluation/catalog/signalDefinitions';
import { 
  Settings, 
  Database, 
  Check, 
  X, 
  RefreshCw, 
  Download, 
  Upload, 
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

/**
 * Field Mapping Table Component
 */
function FieldMappingTable({ category, fields, onToggleField }) {
  const { fieldMappings, isFieldAvailable } = useTenantConfigStore();
  const [expanded, setExpanded] = useState(true);
  
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <span className="font-medium text-slate-700 capitalize">{category}</span>
          <span className="text-xs text-slate-500">({fields.length} fields)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-emerald-600">
            {fields.filter(f => isFieldAvailable(f.id)).length} available
          </span>
        </div>
      </button>
      
      {expanded && (
        <div className="divide-y divide-slate-100">
          {fields.map(field => {
            const mapping = fieldMappings.find(m => m.fieldId === field.id);
            const available = mapping?.available;
            
            return (
              <div
                key={field.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800">{field.displayName}</span>
                    {field.mdlhColumn && (
                      <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                        {field.mdlhColumn}
                      </code>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{field.description}</p>
                </div>
                
                <div className="flex items-center gap-3">
                  {/* Signals */}
                  <div className="flex gap-1">
                    {field.contributesToSignals?.slice(0, 2).map(s => (
                      <span
                        key={s.signal}
                        className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded"
                      >
                        {s.signal}
                      </span>
                    ))}
                  </div>
                  
                  {/* Availability indicator */}
                  <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${
                    available
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    {available ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        Available
                      </>
                    ) : (
                      <>
                        <X className="w-3 h-3" />
                        Missing
                      </>
                    )}
                  </div>
                  
                  {/* Toggle */}
                  <button
                    onClick={() => onToggleField(field.id, !available)}
                    className={`p-1.5 rounded transition-colors ${
                      available
                        ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                        : 'bg-slate-200 text-slate-400 hover:bg-slate-300'
                    }`}
                  >
                    {available ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Signal Override Panel Component
 */
function SignalOverridePanel() {
  const { signalOverrides, updateSignalOverride, getEffectiveSignalWeight } = useTenantConfigStore();
  
  return (
    <div className="space-y-4">
      <h3 className="font-medium text-slate-900">Signal Configuration</h3>
      <p className="text-sm text-slate-500">
        Adjust signal weights or disable signals that aren't relevant to your use cases.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {SIGNAL_DEFINITIONS.map(signal => {
          const override = signalOverrides.find(o => o.signalId === signal.id);
          const weight = getEffectiveSignalWeight(signal.id, 1);
          const disabled = override?.disabled;
          
          return (
            <div
              key={signal.id}
              className={`p-4 rounded-lg border ${
                disabled ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`font-medium ${disabled ? 'text-slate-400' : 'text-slate-800'}`}>
                  {signal.displayName}
                </span>
                <button
                  onClick={() => updateSignalOverride(signal.id, { disabled: !disabled })}
                  className={`text-xs px-2 py-1 rounded ${
                    disabled
                      ? 'bg-slate-200 text-slate-500'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {disabled ? 'Disabled' : 'Enabled'}
                </button>
              </div>
              
              {!disabled && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Weight</span>
                    <span>{Math.round(weight * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(weight * 100)}
                    onChange={(e) => updateSignalOverride(signal.id, { 
                      weightOverride: parseInt(e.target.value) / 100 
                    })}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Main Tenant Config Page
 */
export function TenantConfigPage() {
  const {
    tenantId,
    tenantName,
    fieldMappings,
    fieldMappingsLoaded,
    discoveredColumns,
    discoveryTimestamp,
    setTenant,
    initializeFromCatalog,
    updateFieldMapping,
    getReconciliationSummary,
    exportConfig,
    importConfig,
  } = useTenantConfigStore();
  
  const [activeTab, setActiveTab] = useState('fields'); // 'fields' | 'signals' | 'import-export'
  
  // Initialize field mappings if not loaded
  useEffect(() => {
    if (!fieldMappingsLoaded && discoveredColumns.length > 0) {
      initializeFromCatalog(UNIFIED_FIELD_CATALOG.filter(f => f.status === 'active'), discoveredColumns);
    }
  }, [fieldMappingsLoaded, discoveredColumns, initializeFromCatalog]);
  
  // Group fields by category
  const fieldsByCategory = UNIFIED_FIELD_CATALOG
    .filter(f => f.status === 'active')
    .reduce((acc, field) => {
      const category = field.category || 'other';
      if (!acc[category]) acc[category] = [];
      acc[category].push(field);
      return acc;
    }, {});
  
  const handleToggleField = (fieldId, available) => {
    updateFieldMapping(fieldId, { available });
  };
  
  const handleExport = () => {
    const config = exportConfig();
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tenant-config-${tenantId || 'default'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  const handleImport = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const config = JSON.parse(e.target.result);
        importConfig(config);
      } catch (err) {
        console.error('Failed to import config:', err);
      }
    };
    reader.readAsText(file);
  };
  
  const reconciliationSummary = getReconciliationSummary();
  
  return (
    <div className="tenant-config-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-400" />
            Tenant Configuration
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure field mappings and signal weights for your tenant
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <label className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
            <Upload className="w-4 h-4" />
            Import
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <div className="text-2xl font-bold text-slate-900">{fieldMappings.length}</div>
          <div className="text-xs text-slate-500">Total Fields</div>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <div className="text-2xl font-bold text-emerald-600">
            {fieldMappings.filter(m => m.available).length}
          </div>
          <div className="text-xs text-slate-500">Available</div>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <div className="text-2xl font-bold text-amber-600">
            {fieldMappings.filter(m => !m.available).length}
          </div>
          <div className="text-xs text-slate-500">Missing</div>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{discoveredColumns.length}</div>
          <div className="text-xs text-slate-500">MDLH Columns</div>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('fields')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'fields'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Field Mappings
        </button>
        <button
          onClick={() => setActiveTab('signals')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'signals'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Signal Weights
        </button>
      </div>
      
      {/* Tab Content */}
      {activeTab === 'fields' && (
        <div className="space-y-4">
          {Object.entries(fieldsByCategory).map(([category, fields]) => (
            <FieldMappingTable
              key={category}
              category={category}
              fields={fields}
              onToggleField={handleToggleField}
            />
          ))}
        </div>
      )}
      
      {activeTab === 'signals' && (
        <SignalOverridePanel />
      )}
      
      {/* Styles */}
      <style>{`
        .tenant-config-page {
          padding: 24px;
          max-width: 1200px;
          margin: 0 auto;
        }
      `}</style>
    </div>
  );
}

export default TenantConfigPage;
