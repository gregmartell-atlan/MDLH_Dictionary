/**
 * Pivot Builder
 * 
 * Interactive pivot table builder with:
 * - Pre-built pivot gallery
 * - Custom pivot configuration
 * - Live SQL generation and execution
 * - Results visualization
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  LayoutGrid,
  Plus,
  Play,
  RefreshCw,
  ChevronRight,
  Database,
  Table2,
  Download,
  Copy,
  Check,
  X,
  ArrowUpDown,
  Layers,
  BarChart3,
  Settings2,
  Filter,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useConnection, useQuery } from '../../hooks/useSnowflake';
import { useDynamicSchema } from '../../context/DynamicSchemaContext';
import { PreBuiltPivotGallery } from './PreBuiltPivotGallery';
import {
  PIVOT_DIMENSIONS,
  PIVOT_MEASURES,
  generatePivotSQL,
  buildCustomPivotSQL,
  getPivotById,
} from '../../data/prebuiltPivotRegistry';
import { buildSafeFQN, escapeIdentifier } from '../../utils/queryHelpers';

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/**
 * Dimension/Measure selector with drag-drop style
 */
function ItemSelector({ items, selected, onToggle, type = 'dimension' }) {
  return (
    <div className="space-y-1">
      {Object.entries(items).map(([id, item]) => {
        const isSelected = selected.includes(id);
        return (
          <button
            key={id}
            onClick={() => onToggle(id)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
              isSelected
                ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span className="text-base">{item.icon}</span>
            <span className="flex-1 font-medium">{item.label}</span>
            {isSelected && <Check size={14} className="text-indigo-600" />}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Selected items display with reorder/remove
 */
function SelectedItems({ items, definitions, onRemove, onReorder, label }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-4 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-lg">
        No {label} selected
      </div>
    );
  }
  
  return (
    <div className="space-y-1">
      {items.map((id, idx) => {
        const def = definitions[id];
        return (
          <div
            key={id}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg"
          >
            <span className="text-base">{def?.icon}</span>
            <span className="flex-1 text-sm font-medium text-indigo-700">{def?.label || id}</span>
            <button
              onClick={() => onRemove(id)}
              className="p-1 text-indigo-400 hover:text-indigo-600"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Results table
 */
function PivotResultsTable({ results, loading, error }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw size={24} className="animate-spin text-indigo-500" />
        <span className="ml-2 text-slate-500">Executing pivot query...</span>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        <strong>Error:</strong> {error}
      </div>
    );
  }
  
  if (!results || results.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <BarChart3 size={48} className="mx-auto mb-4 opacity-30" />
        <p>No results yet. Run a pivot to see data.</p>
      </div>
    );
  }
  
  // Get headers from first row
  const headers = Object.keys(results[0]);
  
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            {headers.map(header => (
              <th 
                key={header}
                className="px-4 py-3 text-left font-medium text-slate-600 uppercase text-xs tracking-wide"
              >
                {header.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {results.map((row, idx) => (
            <tr key={idx} className="hover:bg-slate-50">
              {headers.map(header => {
                const value = row[header];
                const isNumeric = typeof value === 'number';
                
                return (
                  <td 
                    key={header}
                    className={`px-4 py-3 ${isNumeric ? 'text-right font-mono' : ''}`}
                  >
                    {value !== null && value !== undefined 
                      ? (isNumeric && !Number.isInteger(value) 
                          ? value.toFixed(1) 
                          : value)
                      : '—'
                    }
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function PivotBuilder({ database: propDatabase, schema: propSchema }) {
  const { status: connectionStatus } = useConnection();
  const isConnected = connectionStatus?.connected === true;
  const { executeQuery, loading: queryLoading } = useQuery(connectionStatus);
  const { discoveredTables = [], mdlhTableTypes = {} } = useDynamicSchema() || {};
  
  // State
  const [activeTab, setActiveTab] = useState('gallery'); // 'gallery' | 'custom'
  const [selectedDimensions, setSelectedDimensions] = useState([]);
  const [selectedMeasures, setSelectedMeasures] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [generatedSQL, setGeneratedSQL] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSQL, setShowSQL] = useState(false);
  const [copiedSQL, setCopiedSQL] = useState(false);
  
  // Available MDLH tables (ASSETS, LINEAGE, etc.)
  const availableTables = useMemo(() => {
    return discoveredTables.filter(t => 
      (t.database === propDatabase && t.schema === propSchema) ||
      mdlhTableTypes[t.fqn]
    );
  }, [discoveredTables, propDatabase, propSchema, mdlhTableTypes]);
  
  // Default to ASSETS table
  useEffect(() => {
    if (!selectedTable && availableTables.length > 0) {
      const assetsTable = availableTables.find(t => 
        t.name.toUpperCase() === 'ASSETS' || 
        mdlhTableTypes[t.fqn] === 'ASSETS'
      );
      setSelectedTable(assetsTable?.fqn || availableTables[0].fqn);
    }
  }, [availableTables, selectedTable, mdlhTableTypes]);
  
  // Table FQN for queries
  const tableFqn = useMemo(() => {
    if (selectedTable) return selectedTable;
    if (propDatabase && propSchema) {
      return buildSafeFQN(propDatabase, propSchema, 'ASSETS');
    }
    return null;
  }, [selectedTable, propDatabase, propSchema]);
  
  // ==========================================================================
  // HANDLERS
  // ==========================================================================
  
  const toggleDimension = useCallback((dimId) => {
    setSelectedDimensions(prev => 
      prev.includes(dimId) 
        ? prev.filter(d => d !== dimId)
        : [...prev, dimId]
    );
  }, []);
  
  const toggleMeasure = useCallback((measureId) => {
    setSelectedMeasures(prev => 
      prev.includes(measureId) 
        ? prev.filter(m => m !== measureId)
        : [...prev, measureId]
    );
  }, []);
  
  const removeDimension = useCallback((dimId) => {
    setSelectedDimensions(prev => prev.filter(d => d !== dimId));
  }, []);
  
  const removeMeasure = useCallback((measureId) => {
    setSelectedMeasures(prev => prev.filter(m => m !== measureId));
  }, []);
  
  const handlePrebuiltSelect = useCallback((pivot) => {
    // Set dimensions and measures from pre-built pivot
    setSelectedDimensions(pivot.rowDimensions);
    setSelectedMeasures(pivot.measures);
    setGeneratedSQL(pivot.generatedSQL || generatePivotSQL(pivot.id, tableFqn));
    setActiveTab('custom'); // Switch to custom to show the configuration
    setShowSQL(true);
  }, [tableFqn]);
  
  const generateSQL = useCallback(() => {
    if (!tableFqn || selectedDimensions.length === 0 || selectedMeasures.length === 0) {
      setError('Please select at least one dimension and one measure');
      return;
    }
    
    const sql = buildCustomPivotSQL(selectedDimensions, selectedMeasures, tableFqn);
    setGeneratedSQL(sql);
    setShowSQL(true);
  }, [tableFqn, selectedDimensions, selectedMeasures]);
  
  const executePivot = useCallback(async () => {
    if (!generatedSQL || !isConnected) {
      setError('Generate SQL first or connect to Snowflake');
      return;
    }
    
    setLoading(true);
    setError(null);
    setResults(null);
    
    try {
      const result = await executeQuery(generatedSQL, { 
        database: propDatabase, 
        schema: propSchema 
      });
      
      // Normalize results
      if (result && Array.isArray(result.rows)) {
        setResults(result.rows);
      } else if (Array.isArray(result)) {
        setResults(result);
      } else {
        setResults([]);
      }
    } catch (err) {
      console.error('[PivotBuilder] Query error:', err);
      setError(err.message || 'Failed to execute query');
    } finally {
      setLoading(false);
    }
  }, [generatedSQL, isConnected, executeQuery, propDatabase, propSchema]);
  
  const copySQL = useCallback(() => {
    navigator.clipboard.writeText(generatedSQL);
    setCopiedSQL(true);
    setTimeout(() => setCopiedSQL(false), 2000);
  }, [generatedSQL]);
  
  const exportResults = useCallback(() => {
    if (!results) return;
    
    const csv = [
      Object.keys(results[0]).join(','),
      ...results.map(row => Object.values(row).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pivot_results_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [results]);
  
  // ==========================================================================
  // RENDER
  // ==========================================================================
  
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <LayoutGrid size={24} className="text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Pivot Builder</h1>
              <p className="text-sm text-slate-500">
                Build and execute pivot tables against MDLH
              </p>
            </div>
          </div>
          
          {/* Table selector */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Table2 size={16} className="text-slate-400" />
              <select
                value={selectedTable || ''}
                onChange={(e) => setSelectedTable(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
              >
                {availableTables.map(t => (
                  <option key={t.fqn} value={t.fqn}>
                    {t.name}
                  </option>
                ))}
                {availableTables.length === 0 && (
                  <option value="">No tables discovered</option>
                )}
              </select>
            </div>
            
            {/* Connection status */}
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
              isConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {isConnected ? 'Connected' : 'Disconnected'}
            </div>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-4 mt-4">
          <button
            onClick={() => setActiveTab('gallery')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'gallery'
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Pre-Built Pivots
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'custom'
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Custom Builder
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'gallery' ? (
          <div className="h-full overflow-auto p-6">
            <PreBuiltPivotGallery
              tableFqn={tableFqn}
              onSelectPivot={handlePrebuiltSelect}
            />
          </div>
        ) : (
          <div className="h-full flex">
            {/* Left: Configuration */}
            <div className="w-80 border-r border-slate-200 bg-slate-50 overflow-auto p-4">
              {/* Dimensions */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Layers size={16} />
                  Row Dimensions
                </h3>
                <SelectedItems
                  items={selectedDimensions}
                  definitions={PIVOT_DIMENSIONS}
                  onRemove={removeDimension}
                  label="dimensions"
                />
                <details className="mt-3">
                  <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
                    + Add dimension
                  </summary>
                  <div className="mt-2">
                    <ItemSelector
                      items={PIVOT_DIMENSIONS}
                      selected={selectedDimensions}
                      onToggle={toggleDimension}
                      type="dimension"
                    />
                  </div>
                </details>
              </div>
              
              {/* Measures */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <BarChart3 size={16} />
                  Measures
                </h3>
                <SelectedItems
                  items={selectedMeasures}
                  definitions={PIVOT_MEASURES}
                  onRemove={removeMeasure}
                  label="measures"
                />
                <details className="mt-3">
                  <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
                    + Add measure
                  </summary>
                  <div className="mt-2">
                    <ItemSelector
                      items={PIVOT_MEASURES}
                      selected={selectedMeasures}
                      onToggle={toggleMeasure}
                      type="measure"
                    />
                  </div>
                </details>
              </div>
              
              {/* Actions */}
              <div className="space-y-2">
                <button
                  onClick={generateSQL}
                  disabled={selectedDimensions.length === 0 || selectedMeasures.length === 0}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Settings2 size={16} />
                  Generate SQL
                </button>
                
                <button
                  onClick={executePivot}
                  disabled={!generatedSQL || !isConnected || loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <Play size={16} />
                  )}
                  {loading ? 'Running...' : 'Run Pivot'}
                </button>
              </div>
            </div>
            
            {/* Right: Results */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* SQL Preview */}
              {showSQL && generatedSQL && (
                <div className="border-b border-slate-200 bg-slate-900 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-400">Generated SQL</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={copySQL}
                        className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                      >
                        {copiedSQL ? <Check size={12} /> : <Copy size={12} />}
                        {copiedSQL ? 'Copied!' : 'Copy'}
                      </button>
                      <button
                        onClick={() => setShowSQL(false)}
                        className="text-slate-400 hover:text-white"
                      >
                        <EyeOff size={14} />
                      </button>
                    </div>
                  </div>
                  <pre className="text-sm text-slate-100 font-mono overflow-x-auto max-h-32">
                    {generatedSQL}
                  </pre>
                </div>
              )}
              
              {/* Results */}
              <div className="flex-1 overflow-auto p-4">
                {results && results.length > 0 && (
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-slate-500">
                      {results.length} row{results.length !== 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={exportResults}
                      className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                    >
                      <Download size={14} />
                      Export CSV
                    </button>
                  </div>
                )}
                
                <PivotResultsTable
                  results={results}
                  loading={loading}
                  error={error}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PivotBuilder;
