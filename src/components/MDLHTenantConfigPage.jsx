/**
 * MDLH Tenant Configuration Page
 * 
 * Integrates tenant config discovery and reconciliation with MDLH schema.
 * Allows users to discover MDLH tables/columns and map canonical fields.
 */

import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Search, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  XCircle,
  Settings,
  Layers,
  FileText,
  Loader2,
  FileText as FileTextIcon,
  TestTube,
  Download,
  Upload
} from 'lucide-react';
import { discoverTenantConfig, getSchemaSnapshot } from '../services/mdlhTenantConfigService';
import { useTenantConfigStore } from '../evaluation/stores/tenantConfigStore';
import { FieldMappingTable } from '../evaluation/components/tenant-config/FieldMappingTable';
import { FieldMappingEditor } from '../evaluation/components/tenant-config/FieldMappingEditor';
import { ReconciliationDashboard } from '../evaluation/components/tenant-config/ReconciliationDashboard';
import { createLogger } from '../utils/logger';

const log = createLogger('MDLHTenantConfig');

export function MDLHTenantConfigPage() {
  const {
    config,
    schemaSnapshot,
    isLoading,
    error,
    setConfig,
    setSchemaSnapshot,
    setLoading,
    setError,
    selectedFieldId,
    setSelectedField,
    getConfigCompleteness,
  } = useTenantConfigStore();

  const [discoveryState, setDiscoveryState] = useState({
    database: '',
    schema: '',
    tenantId: '',
    baseUrl: '',
    isDiscovering: false,
  });

  const [connectionInfo, setConnectionInfo] = useState(null);

  // Load connection info from session storage
  useEffect(() => {
    const stored = sessionStorage.getItem('snowflake_session');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.database && parsed.schema) {
          setConnectionInfo({
            database: parsed.database,
            schema: parsed.schema,
          });
          setDiscoveryState(prev => ({
            ...prev,
            database: parsed.database,
            schema: parsed.schema,
          }));
        }
      } catch (e) {
        log.error('Failed to parse connection info', { error: e.message });
      }
    }
  }, []);

  const handleDiscover = async () => {
    if (!discoveryState.database || !discoveryState.schema) {
      setError('Please specify database and schema');
      return;
    }

    setLoading(true);
    setError(null);
    setDiscoveryState(prev => ({ ...prev, isDiscovering: true }));

    try {
      const tenantId = discoveryState.tenantId || `mdlh-${discoveryState.database}-${discoveryState.schema}`;
      const baseUrl = discoveryState.baseUrl || window.location.origin;

      log.info('Starting tenant config discovery', {
        tenantId,
        database: discoveryState.database,
        schema: discoveryState.schema,
      });

      const discoveredConfig = await discoverTenantConfig({
        tenantId,
        baseUrl,
        database: discoveryState.database,
        schema: discoveryState.schema,
      });

      // Update store
      setConfig(discoveredConfig);
      if (discoveredConfig.schemaSnapshot) {
        setSchemaSnapshot(discoveredConfig.schemaSnapshot);
      }

      log.info('Tenant config discovered successfully', {
        fieldMappings: discoveredConfig.fieldMappings?.length || 0,
      });

      // Switch to overview tab after successful discovery
      setActiveTab('overview');
    } catch (err) {
      log.error('Discovery failed', { error: err.message });
      setError(err.message || 'Failed to discover tenant configuration');
    } finally {
      setLoading(false);
      setDiscoveryState(prev => ({ ...prev, isDiscovering: false }));
    }
  };

  const completeness = config ? getConfigCompleteness() : null;
  // Default to overview if config exists, otherwise discovery
  const [activeTab, setActiveTab] = useState(config ? 'overview' : 'discovery');

  // Switch to overview when config is loaded
  useEffect(() => {
    if (config && activeTab === 'discovery') {
      setActiveTab('overview');
    }
  }, [config]);

  const handleExport = () => {
    if (!config) return;
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tenant-config-${config.tenantId || 'default'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedConfig = JSON.parse(e.target.result);
        setConfig(importedConfig);
        if (importedConfig.schemaSnapshot) {
          setSchemaSnapshot(importedConfig.schemaSnapshot);
        }
        log.info('Config imported successfully');
      } catch (err) {
        log.error('Failed to import config', { error: err });
        setError('Failed to import configuration file');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-slate-50" data-testid="tenant-config-page">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Settings className="w-8 h-8 text-slate-700" />
                <h1 className="text-3xl font-bold text-slate-900">MDLH Tenant Configuration</h1>
              </div>
              <p className="text-slate-600">
                Discover MDLH schema and map canonical fields to actual columns
              </p>
            </div>
            {config && (
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer text-sm font-medium text-slate-700">
                  <Upload className="w-4 h-4" />
                  Import
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    className="hidden"
                  />
                </label>
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white border-b border-slate-200 px-6">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('discovery')}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'discovery'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Discovery
            </button>
            {config && (
              <>
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'overview'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab('mappings')}
                  className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'mappings'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Field Mappings
                  {config.fieldMappings && (
                    <span className="ml-2 px-2 py-0.5 text-xs bg-slate-100 rounded-full">
                      {config.fieldMappings.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'settings'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Settings
                </button>
                <button
                  onClick={() => setActiveTab('test')}
                  className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'test'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Test
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'discovery' && (
            <div>
              {/* Discovery Section */}
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Schema Discovery
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Database
                    </label>
                    <input
                      type="text"
                      value={discoveryState.database}
                      onChange={(e) =>
                        setDiscoveryState(prev => ({ ...prev, database: e.target.value }))
                      }
                      placeholder="ATLAN_GOLD"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Schema
                    </label>
                    <input
                      type="text"
                      value={discoveryState.schema}
                      onChange={(e) =>
                        setDiscoveryState(prev => ({ ...prev, schema: e.target.value }))
                      }
                      placeholder="PUBLIC"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Tenant ID (optional)
                    </label>
                    <input
                      type="text"
                      value={discoveryState.tenantId}
                      onChange={(e) =>
                        setDiscoveryState(prev => ({ ...prev, tenantId: e.target.value }))
                      }
                      placeholder="Auto-generated if empty"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Base URL (optional)
                    </label>
                    <input
                      type="text"
                      value={discoveryState.baseUrl}
                      onChange={(e) =>
                        setDiscoveryState(prev => ({ ...prev, baseUrl: e.target.value }))
                      }
                      placeholder={window.location.origin}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <button
                  onClick={handleDiscover}
                  disabled={isLoading || discoveryState.isDiscovering || !discoveryState.database || !discoveryState.schema}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
                >
                  {isLoading || discoveryState.isDiscovering ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Discovering...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Discover Schema
                    </>
                  )}
                </button>

                {error && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-red-800">{error}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'overview' && config && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200">
              <ReconciliationDashboard />
            </div>
          )}

          {activeTab === 'mappings' && config && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <FileTextIcon className="w-5 h-5" />
                Field Mappings
              </h2>
              <FieldMappingTable onSelectField={setSelectedField} />
            </div>
          )}

          {activeTab === 'settings' && config && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Configuration Settings
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Tenant ID
                    </label>
                    <input
                      type="text"
                      value={config.tenantId}
                      readOnly
                      className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50 text-slate-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Base URL
                    </label>
                    <input
                      type="text"
                      value={config.baseUrl}
                      readOnly
                      className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50 text-slate-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Version
                    </label>
                    <input
                      type="text"
                      value={config.version}
                      readOnly
                      className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50 text-slate-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Last Updated
                    </label>
                    <input
                      type="text"
                      value={new Date(config.updatedAt).toLocaleString()}
                      readOnly
                      className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50 text-slate-600"
                    />
                  </div>
                </div>
                {schemaSnapshot && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-3">Schema Snapshot</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Tables Discovered
                        </label>
                        <div className="text-lg font-semibold text-slate-900">
                          {schemaSnapshot.tables?.length || 0}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Discovery Time
                        </label>
                        <div className="text-sm text-slate-700">
                          {schemaSnapshot.discoveredAt
                            ? new Date(schemaSnapshot.discoveredAt).toLocaleString()
                            : 'Unknown'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'test' && config && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <TestTube className="w-5 h-5" />
                Test Configuration
              </h2>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="font-medium text-blue-900 mb-2">Configuration Validation</h3>
                  <div className="space-y-2 text-sm text-blue-800">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      <span>Configuration loaded: {config.fieldMappings?.length || 0} field mappings</span>
                    </div>
                    {completeness && (
                      <>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          <span>Completeness score: {Math.round(completeness.score * 100)}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          <span>Active mappings: {completeness.confirmed + completeness.auto}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <h3 className="font-medium text-slate-900 mb-2">Test Field Mapping</h3>
                  <p className="text-sm text-slate-600">
                    Select a field from the Field Mappings tab to test its mapping configuration.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Field Editor Modal */}
          {selectedFieldId && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">Edit Field Mapping</h3>
                  <button
                    onClick={() => setSelectedField(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-6">
                  <FieldMappingEditor
                    fieldId={selectedFieldId}
                    onClose={() => setSelectedField(null)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Empty State for Discovery */}
          {activeTab === 'discovery' && !config && !isLoading && !error && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
              <Database className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                No Configuration Yet
              </h3>
              <p className="text-slate-600 mb-4">
                Enter your database and schema above, then click "Discover Schema" to begin.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MDLHTenantConfigPage;
