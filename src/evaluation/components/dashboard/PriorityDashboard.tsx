import { useState, useMemo, useEffect } from 'react';
import {
  BarChart3,
  Target,
  Layers,
  Users,
  Download,
  RefreshCw,
  ChevronDown,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Database,
  WifiOff,
  Loader2,
} from 'lucide-react';
import type {
  PatternTemplate,
  PersonaType,
  MetadataFieldType,
  Priority,
} from '../../types/priority';
import { PERSONA_VIEWS } from '../../types/priority';
import { useAtlanAudit } from '../../hooks/useAtlanAudit';
import { computeAllPriorities, calculateOverallScore } from '../../engines/priority-engine';
import { matchPatterns } from '../../engines/pattern-matcher';
import { validateMetadataModel, getRecommendedFixes, getValidationSummary } from '../../engines/validation-engine';
import { filterForPersona, calculatePersonaScore } from '../../engines/persona-views';
import { getQuickWins } from '../../engines/impact-simulator';
import { exportPriorities, downloadFile, getMimeType, getFileExtension } from '../../engines/export-engine';
import { FieldCardGrid } from '../priority/FieldCard';
import { PatternSelector, PatternDetail } from '../priority/PatternSelector';
import { ValidationPanel, ValidationSummary } from '../priority/ValidationPanel';
import { ImpactSimulator, QuickSimulator } from '../priority/ImpactSimulator';
import { AtlanConnectionModal } from './AtlanConnectionModal';
import { ConnectorSelector } from './ConnectorSelector';
import { RecommendationsPanel } from './RecommendationsPanel';
import { fetchAssetsForModel, getAssetTypeBreakdown } from '../../services/atlanApi';
import { buildModelFromAssets } from '../../utils/atlanImport';
import { useModelStore } from '../../stores/modelStore';
import type { ConnectorInfo } from '../../services/atlanApi';
import { useUIStore } from '../../stores/uiStore';

const EMPTY_ARRAY: any[] = [];

type TabType = 'overview' | 'patterns' | 'validation' | 'simulate';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectors: ConnectorInfo[];
  selectedConnectors: string[];
  onSelectConnectors: (ids: string[]) => void;
  includeColumns: boolean;
  onToggleColumns: (value: boolean) => void;
  maxAssets: number;
  onMaxAssetsChange: (value: number) => void;
  onImport: () => void;
  importing: boolean;
  onScan: () => void;
  scanning: boolean;
  preview: Array<{
    connector: string;
    total: number;
    types: Array<{ assetType: string; count: number }>;
    samples: string[];
  }>;
}

function ImportModal({
  isOpen,
  onClose,
  connectors,
  selectedConnectors,
  onSelectConnectors,
  includeColumns,
  onToggleColumns,
  maxAssets,
  onMaxAssetsChange,
  onImport,
  importing,
  onScan,
  scanning,
  preview,
}: ImportModalProps) {
  if (!isOpen) return null;

  const toggle = (id: string) => {
    if (selectedConnectors.includes(id)) {
      onSelectConnectors(selectedConnectors.filter((c) => c !== id));
    } else {
      onSelectConnectors([...selectedConnectors, id]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-slideIn">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              Import options
            </h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Choose connectors and scope before importing to the canvas.
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <span aria-hidden>✕</span>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Connections
            </div>
            <div className="grid grid-cols-2 gap-2">
              {connectors.map((c) => (
                <label
                  key={c.id}
                  className={`border rounded-lg px-3 py-2 text-sm cursor-pointer flex items-center justify-between ${selectedConnectors.includes(c.id) ? 'border-[var(--primary-blue)] bg-[var(--primary-blue-light)]' : 'border-gray-200'}`}
                >
                  <span>{c.name}</span>
                  <input
                    type="checkbox"
                    checked={selectedConnectors.includes(c.id)}
                    onChange={() => toggle(c.id)}
                  />
                </label>
              ))}
              {connectors.length === 0 && (
                <div className="text-xs text-gray-500 col-span-2">
                  No connectors fetched yet. Use the connector dropdown in the header or connect to Atlan.
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Include columns (can be heavy)
            </label>
            <input
              type="checkbox"
              className="form-checkbox"
              checked={includeColumns}
              onChange={(e) => onToggleColumns(e.target.checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Max assets per connector
            </label>
            <input
              type="number"
              min={50}
              max={2000}
              value={maxAssets}
              onChange={(e) => onMaxAssetsChange(Number(e.target.value) || 0)}
              className="form-input w-24"
            />
          </div>

          <div className="border rounded-lg p-3 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Preview (counts and samples)
              </div>
              <button onClick={onScan} disabled={scanning} className="btn-secondary text-xs">
                {scanning ? 'Scanning...' : 'Scan'}
              </button>
            </div>
            {preview.length === 0 && (
              <div className="text-xs text-gray-500">
                Run a scan to see what’s available before importing.
              </div>
            )}
            {preview.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {preview.map((p) => (
                  <div key={p.connector} className="border border-gray-200 rounded-lg p-2 bg-white">
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span>{p.connector}</span>
                      <span className="text-xs text-gray-500">{p.total} assets</span>
                    </div>
                    <div className="text-xs text-gray-600 mt-1 flex flex-wrap gap-1">
                      {p.types.slice(0, 4).map((t) => (
                        <span key={t.assetType} className="px-2 py-0.5 rounded-full bg-gray-100">
                          {t.assetType}: {t.count}
                        </span>
                      ))}
                    </div>
                    {p.samples.length > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        Samples: {p.samples.slice(0, 5).join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={onImport}
            disabled={importing}
            className="btn-primary flex-1"
          >
            {importing ? 'Importing...' : 'Import to canvas'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PriorityDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedPattern, setSelectedPattern] = useState<PatternTemplate | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<PersonaType>('all');
  const [simulatingField, setSimulatingField] = useState<MetadataFieldType | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedConnectors, setSelectedConnectors] = useState<string[]>([]);
  const [includeColumns, setIncludeColumns] = useState(false);
  const [maxAssets, setMaxAssets] = useState(200);
  const [preview, setPreview] = useState<Array<{
    connector: string;
    total: number;
    types: Array<{ assetType: string; count: number }>;
    samples: string[];
  }>>([]);
  const [scanning, setScanning] = useState(false);

  // Atlan/MDLH Connection & Data
  const {
    connection,
    connectAtlan,
    connectMDLH,
    connectors,
    activeConnectors,
    loadingConnectors,
    filters,
    setConnectorFilter,
    audit,
    fieldCoverage,
    loading: isLoading,
    error,
    lastFetched,
    usingSampleData,
    refresh,
    isConnected,
    dataSource,
  } = useAtlanAudit();
  const loadModel = useModelStore((state) => state.loadModel);
  const setUIConnectorFilter = useUIStore((state) => state.setConnectorFilter);
  const setUIAssetTypeFilter = useUIStore((state) => state.setAssetTypeFilter);
  const setUISearchQuery = useUIStore((state) => state.setSearchQuery);
  useEffect(() => {
    if (selectedConnectors.length === 0 && activeConnectors.length > 0) {
      setSelectedConnectors(activeConnectors.slice(0, 3));
    }
  }, [activeConnectors, selectedConnectors.length]);

  const modelEntities = useModelStore((state) => {
    const activePage = state.model.pages.find(p => p.id === state.model.activePageId);
    return activePage?.entities || EMPTY_ARRAY;
  });
  const uniqueAssetTypes = useMemo(() => {
    const types = new Set<string>();
    modelEntities.forEach((e) => e.assetType && types.add(e.assetType));
    return Array.from(types);
  }, [modelEntities]);

  // Compute priorities from real or sample data
  const priorities = useMemo(
    () => computeAllPriorities(fieldCoverage, selectedPattern),
    [fieldCoverage, selectedPattern]
  );

  // Filter by persona
  const filteredPriorities = useMemo(
    () => filterForPersona(priorities, selectedPersona),
    [priorities, selectedPersona]
  );

  // Pattern matches
  const patternMatches = useMemo(
    () => matchPatterns(fieldCoverage),
    [fieldCoverage]
  );

  // Validation issues
  const validationIssues = useMemo(
    () => audit ? validateMetadataModel(audit) : [],
    [audit]
  );

  const recommendedFixes = useMemo(
    () => getRecommendedFixes(validationIssues),
    [validationIssues]
  );

  const validationSummary = useMemo(
    () => getValidationSummary(validationIssues),
    [validationIssues]
  );

  // Quick wins
  const quickWins = useMemo(
    () => getQuickWins(fieldCoverage, selectedPattern, 3),
    [fieldCoverage, selectedPattern]
  );

  // Overall score
  const overallScore = useMemo(
    () => calculateOverallScore(priorities),
    [priorities]
  );

  // Persona score
  const personaScore = useMemo(
    () => calculatePersonaScore(fieldCoverage, selectedPersona),
    [fieldCoverage, selectedPersona]
  );

  const handleExport = (format: 'json' | 'csv' | 'markdown') => {
    const content = exportPriorities(priorities, {
      format,
      includeReasons: true,
      includeTimeline: false,
    });
    const filename = `priorities-${new Date().toISOString().split('T')[0]}.${getFileExtension(format)}`;
    downloadFile(content, filename, getMimeType(format));
    setShowExportMenu(false);
  };

  const handleImportAssets = async () => {
    if (!isConnected) {
      setShowConnectionModal(true);
      return;
    }

    setImporting(true);
    try {
      const connectorsToUse =
        selectedConnectors.length > 0
          ? selectedConnectors
          : filters.connector
            ? [filters.connector]
            : activeConnectors;

      let assets: Awaited<ReturnType<typeof fetchAssetsForModel>> = [];

      if (connectorsToUse.length > 0) {
        for (const connector of connectorsToUse) {
          const batchResult = await fetchAssetsForModel({
            connector,
            assetTypes: includeColumns ? undefined : ['Database', 'Schema', 'Table', 'View', 'MaterializedView'],
            size: maxAssets,
          });
          assets = assets.concat(batchResult.assets);
        }
      } else {
        const result = await fetchAssetsForModel({
          assetTypes: includeColumns ? undefined : ['Database', 'Schema', 'Table', 'View', 'MaterializedView'],
          size: maxAssets,
        });
        assets = result.assets;
      }

      if (assets.length === 0) {
        alert('No assets found for the selected filters.');
        return;
      }

      const model = buildModelFromAssets(assets, {
        modelName: `Atlan Import - ${new Date().toLocaleDateString()}`,
        includeColumns,
        connectors: connectorsToUse,
      });
      loadModel(model);
      setShowImportModal(false);
    } catch (error) {
      console.error('Import failed', error);
      alert('Failed to import assets from Atlan. Check the console for details.');
    } finally {
      setImporting(false);
    }
  };

  const handleScan = async () => {
    if (!isConnected) {
      setShowConnectionModal(true);
      return;
    }
    setScanning(true);
    const connectorsToUse =
      selectedConnectors.length > 0
        ? selectedConnectors
        : filters.connector
          ? [filters.connector]
          : activeConnectors;
    const summaries: typeof preview = [];
    try {
      const connectorsList = connectorsToUse.length > 0 ? connectorsToUse : ['all'];
      for (const connector of connectorsList) {
        const breakdown = await getAssetTypeBreakdown(connector === 'all' ? undefined : connector);
        const total = breakdown.reduce((sum, b) => sum + b.count, 0);
        const sampleResult = await fetchAssetsForModel({
          connector: connector === 'all' ? undefined : connector,
          size: 12,
        });
        const sampleAssets = sampleResult.assets;
        summaries.push({
          connector: connector === 'all' ? 'All connectors' : connector,
          total,
          types: breakdown.map((b) => ({ assetType: b.assetType, count: b.count })),
          samples: sampleAssets.map((a) => a.name).slice(0, 8),
        });
      }
      setPreview(summaries);
    } catch (error) {
      console.error('Scan failed', error);
      alert('Failed to scan Atlan assets. Check console for details.');
    } finally {
      setScanning(false);
    }
  };

  const getFieldData = (priority: Priority) => {
    const coverage = fieldCoverage.find(c => c.field === priority.field);
    return coverage;
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Connection Banner */}
      {usingSampleData && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <WifiOff size={18} className="text-amber-600" />
              <div>
                <span className="text-sm font-medium text-amber-800">
                  Using Sample Data
                </span>
                <span className="text-sm text-amber-600 ml-2">
                  Connect to Atlan to see real priorities from your metadata
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowConnectionModal(true)}
              className="px-4 py-1.5 text-sm font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors"
            >
              Connect to Atlan
            </button>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && !usingSampleData && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3">
          <div className="flex items-center gap-3">
            <AlertTriangle size={18} className="text-red-600" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              Priority Dashboard
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {isConnected ? (
                <>
                  Connected via {dataSource === 'atlan' ? 'Atlan API' : 'MDLH'}
                  {connection.username && (
                    <span className="ml-2">as {connection.username}</span>
                  )}
                  {lastFetched && (
                    <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      Last updated: {lastFetched.toLocaleTimeString()}
                    </span>
                  )}
                </>
              ) : (
                'Analyze metadata coverage and prioritize improvements'
              )}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Connector Selector - only show when connected to Atlan */}
            {isConnected && dataSource === 'atlan' && (
              <ConnectorSelector
                connectors={connectors}
                activeConnectors={activeConnectors}
                selectedConnector={filters.connector}
                onSelect={setConnectorFilter}
                loading={loadingConnectors}
              />
            )}

            {/* Connection Status */}
            <button
              onClick={() => setShowConnectionModal(true)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                isConnected
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              {connection.connecting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-300'}`} />
              )}
              <Database size={14} />
              <span className="text-sm font-medium">
                {isConnected ? 'Connected' : 'Connect'}
              </span>
            </button>

            {/* Persona Selector */}
            <div className="relative">
              <select
                value={selectedPersona}
                onChange={(e) => setSelectedPersona(e.target.value as PersonaType)}
                className="form-select pl-9 pr-8"
                style={{ color: 'var(--text-primary)' }}
              >
                <option value="all">All Roles</option>
                {PERSONA_VIEWS.map((p) => (
                  <option key={p.persona} value={p.persona}>
                    {p.name}
                  </option>
                ))}
              </select>
              <Users
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--text-muted)' }}
              />
              <ChevronDown
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--text-muted)' }}
              />
            </div>

            {/* Canvas Filters */}
            <div className="flex items-center gap-2">
              <select
                multiple
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions).map((o) => o.value);
                  setUIConnectorFilter(values.filter(Boolean));
                }}
                className="form-select-multi"
                style={{ minWidth: '140px' }}
              >
                <option value="">All connections</option>
                {connectors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                multiple
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions).map((o) => o.value);
                  setUIAssetTypeFilter(values.filter(Boolean));
                }}
                className="form-select-multi"
                style={{ minWidth: '160px' }}
              >
                <option value="">All types</option>
                {uniqueAssetTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Search entities..."
                onChange={(e) => setUISearchQuery(e.target.value)}
                className="form-input"
                style={{ minWidth: '180px' }}
              />
            </div>

            {/* Export Button */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="btn-secondary"
              >
                <Download size={16} />
                Export
                <ChevronDown size={14} />
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                  <button
                    onClick={() => handleExport('json')}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    Export as JSON
                  </button>
                  <button
                    onClick={() => handleExport('csv')}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    Export as CSV
                  </button>
                  <button
                    onClick={() => handleExport('markdown')}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    Export as Markdown
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={refresh}
              disabled={isLoading || !isConnected}
              className="btn-ghost"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              disabled={!isConnected || importing}
              className="btn-primary"
              title="Import assets from Atlan into the model canvas"
            >
              {importing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Download size={16} />
                  Import Assets
                </>
              )}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`tab ${activeTab === 'overview' ? 'tab-active' : ''}`}
          >
            <BarChart3 size={16} />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('patterns')}
            className={`tab ${activeTab === 'patterns' ? 'tab-active' : ''}`}
          >
            <Layers size={16} />
            Patterns
          </button>
          <button
            onClick={() => setActiveTab('validation')}
            className={`tab ${activeTab === 'validation' ? 'tab-active' : ''}`}
          >
            <AlertTriangle size={16} />
            Validation
            {validationIssues.length > 0 && (
              <span className="ml-1.5 badge-count badge-count-red">
                {validationIssues.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('simulate')}
            className={`tab ${activeTab === 'simulate' ? 'tab-active' : ''}`}
          >
            <Target size={16} />
            Simulate
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading && !audit ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader2 size={32} className="animate-spin mx-auto mb-3" style={{ color: 'var(--primary-blue)' }} />
              <p style={{ color: 'var(--text-secondary)' }}>Loading audit data...</p>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <div className="space-y-6 animate-fadeIn">
                {/* Score Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                        Overall Score
                      </span>
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: 'var(--primary-blue-light)' }}
                      >
                        <BarChart3 size={16} style={{ color: 'var(--primary-blue)' }} />
                      </div>
                    </div>
                    <div className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                      {overallScore}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <TrendingUp size={12} className="text-green-600" />
                      <span className="text-xs text-green-600">Based on coverage gaps</span>
                    </div>
                  </div>

                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {selectedPersona === 'all' ? 'Completeness' : PERSONA_VIEWS.find(p => p.persona === selectedPersona)?.displayConfig.primaryMetric}
                      </span>
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: 'var(--success-bg-color)' }}
                      >
                        <CheckCircle size={16} style={{ color: 'var(--success-color)' }} />
                      </div>
                    </div>
                    <div className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                      {personaScore}%
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          width: `${personaScore}%`,
                          backgroundColor: 'var(--success-color)',
                        }}
                      />
                    </div>
                  </div>

                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                        Total Assets
                      </span>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-100">
                        <Layers size={16} className="text-purple-600" />
                      </div>
                    </div>
                    <div className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                      {audit?.summary.totalAssets.toLocaleString() || 0}
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      {usingSampleData ? 'Sample data' : `From ${dataSource === 'atlan' ? 'Atlan' : 'MDLH'}`}
                    </p>
                  </div>

                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                        Risk Score
                      </span>
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{
                          backgroundColor: validationSummary.riskScore >= 70 ? 'var(--success-bg-color)' : 'var(--error-bg-color)',
                        }}
                      >
                        <AlertTriangle
                          size={16}
                          style={{
                            color: validationSummary.riskScore >= 70 ? 'var(--success-color)' : 'var(--error-color)',
                          }}
                        />
                      </div>
                    </div>
                    <div
                      className="text-3xl font-bold"
                      style={{
                        color: validationSummary.riskScore >= 70 ? 'var(--success-color)' : 'var(--error-color)',
                      }}
                    >
                      {validationSummary.riskScore}
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      {validationSummary.errors} critical issues
                    </p>
                  </div>
                </div>

                {/* Quick Wins */}
                {quickWins.length > 0 && (
                  <div className="card p-5">
                    <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                      Quick Wins - Highest ROI Improvements
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {quickWins.map((win) => (
                        <div
                          key={win.field}
                          className="p-4 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors cursor-pointer"
                          onClick={() => {
                            setSimulatingField(win.field);
                            setActiveTab('simulate');
                          }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                              {win.field}
                            </span>
                            <span className="badge badge-green">High ROI</span>
                          </div>
                          <div className="text-xs space-y-1" style={{ color: 'var(--text-secondary)' }}>
                            <div>+{win.completenessImpact.toFixed(1)} pts completeness</div>
                            <div>{win.effortHours.toFixed(1)} hours effort</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Two Column Layout: Field Priorities + Recommendations */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Priority Fields - 2/3 width */}
                  <div className="lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                        Field Priorities
                      </h3>
                      {selectedPattern && (
                        <span className="badge badge-blue">
                          Pattern: {selectedPattern.name}
                        </span>
                      )}
                    </div>
                    <FieldCardGrid
                      fields={filteredPriorities.map((p) => ({
                        field: p.field,
                        coverage: getFieldData(p)!,
                        priority: p,
                      })).filter(f => f.coverage)}
                      onSimulate={(field) => {
                        setSimulatingField(field);
                        setActiveTab('simulate');
                      }}
                    />
                  </div>

                  {/* Recommendations Panel - 1/3 width */}
                  <div className="lg:col-span-1">
                    <RecommendationsPanel
                      audit={audit}
                      fieldCoverage={fieldCoverage}
                      maxItems={5}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'patterns' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn">
                <div>
                  <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                    Select a Pattern
                  </h3>
                  <PatternSelector
                    matches={patternMatches}
                    selectedPattern={selectedPattern}
                    onSelect={setSelectedPattern}
                  />
                </div>
                {selectedPattern && (
                  <PatternDetail
                    pattern={selectedPattern}
                    match={patternMatches.find((m) => m.pattern.id === selectedPattern.id)}
                  />
                )}
              </div>
            )}

            {activeTab === 'validation' && (
              <div className="space-y-6 animate-fadeIn">
                <ValidationSummary
                  errors={validationSummary.errors}
                  warnings={validationSummary.warnings}
                  infos={validationSummary.info}
                  riskScore={validationSummary.riskScore}
                />
                <ValidationPanel
                  issues={validationIssues}
                  fixes={recommendedFixes}
                />
              </div>
            )}

            {activeTab === 'simulate' && (
              <div className="max-w-2xl mx-auto animate-fadeIn">
                {simulatingField ? (
                  <ImpactSimulator
                    field={simulatingField}
                    audit={fieldCoverage}
                    pattern={selectedPattern}
                    onClose={() => setSimulatingField(null)}
                  />
                ) : (
                  <QuickSimulator
                    audit={fieldCoverage}
                    pattern={selectedPattern}
                    onFieldSelect={setSimulatingField}
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Connection Modal */}
      <AtlanConnectionModal
        isOpen={showConnectionModal}
        onClose={() => setShowConnectionModal(false)}
        onConnectAtlan={connectAtlan}
        onConnectMDLH={connectMDLH}
        isConnected={isConnected}
        isConnecting={connection.connecting}
        error={connection.error || null}
        dataSource={dataSource}
        username={connection.username}
      />
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        connectors={connectors}
        selectedConnectors={selectedConnectors}
        onSelectConnectors={setSelectedConnectors}
        includeColumns={includeColumns}
        onToggleColumns={setIncludeColumns}
        maxAssets={maxAssets}
        onMaxAssetsChange={setMaxAssets}
        onImport={handleImportAssets}
        importing={importing}
        onScan={handleScan}
        scanning={scanning}
        preview={preview}
      />
    </div>
  );
}
