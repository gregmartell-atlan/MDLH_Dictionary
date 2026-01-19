/**
 * MDLH Table Analyzer
 * 
 * Deep inspection component for MDLH tables.
 * Provides:
 * - Column-by-column analysis
 * - Data type visualization
 * - Sample data preview
 * - Coverage statistics per column
 * - Signal contribution mapping
 * - Field catalog correlation
 * 
 * This is the "microscope" view for understanding what's in your MDLH.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Table2,
  Columns3,
  Database,
  Layers,
  BarChart3,
  Eye,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  AlertCircle,
  Hash,
  Calendar,
  ToggleLeft,
  List,
  FileText,
  HelpCircle,
  Sparkles,
  Search,
  Download,
  Filter,
  Zap,
  Link2,
} from 'lucide-react';
import { useConnection, useQuery } from '../../../hooks/useSnowflake';
import { useDynamicFieldCatalog } from '../../../hooks/useDynamicFieldCatalog';
import { createDynamicSignalEvaluator, CANONICAL_SIGNALS } from '../../../evaluation/engines/dynamicSignalEvaluator';
import { UNIFIED_FIELD_CATALOG } from '../../../evaluation/catalog/unifiedFields';
import { escapeIdentifier, escapeStringValue, buildSafeFQN } from '../../../utils/queryHelpers';

// =============================================================================
// CONSTANTS
// =============================================================================

const COLUMN_TYPE_CONFIG = {
  array: { icon: List, label: 'Array', color: 'text-purple-500 bg-purple-50' },
  boolean: { icon: ToggleLeft, label: 'Boolean', color: 'text-blue-500 bg-blue-50' },
  number: { icon: Hash, label: 'Number', color: 'text-amber-500 bg-amber-50' },
  timestamp: { icon: Calendar, label: 'Timestamp', color: 'text-emerald-500 bg-emerald-50' },
  string: { icon: FileText, label: 'String', color: 'text-slate-500 bg-slate-50' },
  variant: { icon: HelpCircle, label: 'Variant', color: 'text-pink-500 bg-pink-50' },
};

const SIGNAL_COLORS = {
  OWNERSHIP: 'bg-blue-100 text-blue-700',
  SEMANTICS: 'bg-purple-100 text-purple-700',
  LINEAGE: 'bg-amber-100 text-amber-700',
  SENSITIVITY: 'bg-red-100 text-red-700',
  ACCESS: 'bg-orange-100 text-orange-700',
  QUALITY: 'bg-cyan-100 text-cyan-700',
  FRESHNESS: 'bg-emerald-100 text-emerald-700',
  USAGE: 'bg-indigo-100 text-indigo-700',
  TRUST: 'bg-green-100 text-green-700',
  AI_READY: 'bg-violet-100 text-violet-700',
};

// =============================================================================
// HELPERS
// =============================================================================

function getColumnTypeConfig(dataType) {
  const upper = (dataType || '').toUpperCase();
  
  if (upper.includes('ARRAY')) return COLUMN_TYPE_CONFIG.array;
  if (upper.includes('BOOLEAN')) return COLUMN_TYPE_CONFIG.boolean;
  if (upper.includes('NUMBER') || upper.includes('INT') || upper.includes('FLOAT') || upper.includes('DECIMAL')) {
    return COLUMN_TYPE_CONFIG.number;
  }
  if (upper.includes('TIMESTAMP') || upper.includes('DATE') || upper.includes('TIME')) {
    return COLUMN_TYPE_CONFIG.timestamp;
  }
  if (upper.includes('VARIANT') || upper.includes('OBJECT')) return COLUMN_TYPE_CONFIG.variant;
  
  return COLUMN_TYPE_CONFIG.string;
}

function findFieldForColumn(columnName) {
  const upper = columnName.toUpperCase();
  
  return UNIFIED_FIELD_CATALOG.find(field => {
    if (!field.mdlhColumn) return false;
    
    // Check direct match
    if (field.mdlhColumn.toUpperCase() === upper) return true;
    
    // Check without underscores
    if (field.mdlhColumn.toUpperCase().replace(/_/g, '') === upper.replace(/_/g, '')) return true;
    
    // Check source attributes
    if (field.source?.attributes) {
      return field.source.attributes.some(attr => 
        attr.toUpperCase() === upper || 
        attr.toUpperCase().replace(/_/g, '') === upper.replace(/_/g, '')
      );
    }
    
    return false;
  });
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function TypeBadge({ dataType }) {
  const config = getColumnTypeConfig(dataType);
  const Icon = config.icon;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
      <Icon size={12} />
      {config.label}
    </span>
  );
}

function SignalBadge({ signal }) {
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${SIGNAL_COLORS[signal] || 'bg-gray-100 text-gray-600'}`}>
      {signal}
    </span>
  );
}

function CoverageBar({ percentage, label }) {
  const color = percentage >= 80 ? 'bg-emerald-500' : percentage >= 50 ? 'bg-amber-500' : 'bg-red-500';
  
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
        <div 
          className={`h-full ${color} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs font-medium text-slate-600 w-12 text-right">
        {percentage.toFixed(1)}%
      </span>
    </div>
  );
}

function ColumnRow({ column, coverage, field, signals, sampleValue, expanded, onToggle }) {
  const typeConfig = getColumnTypeConfig(column.dataType);
  const TypeIcon = typeConfig.icon;
  
  return (
    <>
      <tr 
        className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer ${expanded ? 'bg-slate-50' : ''}`}
        onClick={onToggle}
      >
        {/* Expand icon */}
        <td className="px-3 py-2 w-8">
          {expanded ? (
            <ChevronDown size={14} className="text-slate-400" />
          ) : (
            <ChevronRight size={14} className="text-slate-400" />
          )}
        </td>
        
        {/* Column name */}
        <td className="px-3 py-2">
          <div className="flex items-center gap-2">
            <TypeIcon size={14} className={typeConfig.color.split(' ')[0]} />
            <span className="font-medium text-slate-700">{column.name}</span>
            {field && (
              <CheckCircle size={12} className="text-emerald-500" title="Mapped to field catalog" />
            )}
          </div>
        </td>
        
        {/* Data type */}
        <td className="px-3 py-2">
          <TypeBadge dataType={column.dataType} />
        </td>
        
        {/* Coverage */}
        <td className="px-3 py-2 w-40">
          {coverage !== null && coverage !== undefined ? (
            <CoverageBar percentage={coverage} />
          ) : (
            <span className="text-xs text-slate-400">—</span>
          )}
        </td>
        
        {/* Signals */}
        <td className="px-3 py-2">
          <div className="flex flex-wrap gap-1">
            {signals.map(sig => (
              <SignalBadge key={sig} signal={sig} />
            ))}
            {signals.length === 0 && (
              <span className="text-xs text-slate-400">—</span>
            )}
          </div>
        </td>
        
        {/* Sample value */}
        <td className="px-3 py-2 max-w-[200px]">
          <div className="text-xs text-slate-500 truncate" title={String(sampleValue)}>
            {sampleValue !== null && sampleValue !== undefined 
              ? String(sampleValue).substring(0, 50)
              : <span className="italic">null</span>
            }
          </div>
        </td>
      </tr>
      
      {/* Expanded details */}
      {expanded && (
        <tr className="bg-slate-50">
          <td colSpan={6} className="px-8 py-4">
            <div className="grid grid-cols-2 gap-6">
              {/* Column info */}
              <div>
                <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                  Column Details
                </h4>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Data Type:</dt>
                    <dd className="font-medium">{column.dataType}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Nullable:</dt>
                    <dd className="font-medium">{column.isNullable ? 'Yes' : 'No'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Position:</dt>
                    <dd className="font-medium">{column.position}</dd>
                  </div>
                </dl>
              </div>
              
              {/* Field catalog info */}
              <div>
                <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                  Field Catalog Mapping
                </h4>
                {field ? (
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Field ID:</dt>
                      <dd className="font-medium text-indigo-600">{field.id}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Display Name:</dt>
                      <dd className="font-medium">{field.displayName}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Category:</dt>
                      <dd className="font-medium">{field.category}</dd>
                    </div>
                    {field.description && (
                      <div className="mt-2">
                        <dt className="text-slate-500 text-xs">Description:</dt>
                        <dd className="text-slate-600 mt-0.5">{field.description}</dd>
                      </div>
                    )}
                  </dl>
                ) : (
                  <p className="text-sm text-slate-400 italic">
                    No field catalog mapping found. This column may be custom or specific to your MDLH.
                  </p>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function MDLHTableAnalyzer({ database, schema, table = 'ASSETS' }) {
  const { status: connectionStatus } = useConnection();
  const isConnected = connectionStatus?.connected === true;
  const { executeQuery, loading: queryLoading } = useQuery(connectionStatus);
  
  // Dynamic field catalog for this table
  const {
    discoveredColumns,
    dynamicCatalog,
    availableSignals,
    loading: catalogLoading,
    refresh: refreshCatalog,
  } = useDynamicFieldCatalog(database, schema, table);
  
  // Local state
  const [columns, setColumns] = useState([]);
  const [coverage, setCoverage] = useState({});
  const [sampleData, setSampleData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedColumns, setExpandedColumns] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'mapped' | 'unmapped'
  const [showOnlyPopulated, setShowOnlyPopulated] = useState(false);
  
  // ==========================================================================
  // DATA LOADING
  // ==========================================================================
  
  /**
   * Fetch column coverage statistics
   */
  const fetchCoverage = useCallback(async () => {
    if (!isConnected || !database || !schema || !table || discoveredColumns.length === 0) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const fqn = buildSafeFQN(database, schema, table);
      
      // Build coverage expressions for each column
      const expressions = discoveredColumns.map(col => {
        const colName = escapeIdentifier(col.name);
        const typeConfig = getColumnTypeConfig(col.dataType);
        
        if (typeConfig.label === 'Array') {
          return `COUNT_IF(${colName} IS NOT NULL AND ARRAY_SIZE(${colName}) > 0) AS "${col.name}"`;
        } else if (typeConfig.label === 'Boolean') {
          return `COUNT_IF(${colName} = TRUE) AS "${col.name}"`;
        } else {
          return `COUNT_IF(${colName} IS NOT NULL AND ${colName} <> '') AS "${col.name}"`;
        }
      });
      
      // Split into batches to avoid query size limits
      const batchSize = 50;
      const coverageResults = {};
      let totalCount = 0;
      
      for (let i = 0; i < expressions.length; i += batchSize) {
        const batch = expressions.slice(i, i + batchSize);
        
        const query = `
          SELECT
            ${i === 0 ? 'COUNT(*) AS total_count,' : ''}
            ${batch.join(',\n            ')}
          FROM ${fqn}
          WHERE STATUS = 'ACTIVE'
        `;
        
        const result = await executeQuery(query, { database, schema });
        
        // Normalize result
        if (result?.rows?.[0]) {
          const row = result.rows[0];
          
          if (i === 0) {
            totalCount = row.TOTAL_COUNT || row.total_count || 0;
          }
          
          for (const col of discoveredColumns.slice(i, i + batchSize)) {
            const count = row[col.name] || row[col.name.toUpperCase()] || 0;
            coverageResults[col.name] = totalCount > 0 ? (count / totalCount * 100) : 0;
          }
        }
      }
      
      setCoverage({ totalCount, columns: coverageResults });
      setColumns(discoveredColumns);
    } catch (err) {
      console.error('[MDLHTableAnalyzer] Coverage fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isConnected, database, schema, table, discoveredColumns, executeQuery]);
  
  /**
   * Fetch sample data for preview
   */
  const fetchSampleData = useCallback(async () => {
    if (!isConnected || !database || !schema || !table) {
      return;
    }
    
    try {
      const fqn = buildSafeFQN(database, schema, table);
      
      const query = `
        SELECT *
        FROM ${fqn}
        WHERE STATUS = 'ACTIVE'
        LIMIT 1
      `;
      
      const result = await executeQuery(query, { database, schema });
      
      if (result?.rows?.[0]) {
        const row = result.rows[0];
        const samples = {};
        
        for (const [key, value] of Object.entries(row)) {
          samples[key] = value;
          samples[key.toUpperCase()] = value;
        }
        
        setSampleData(samples);
      }
    } catch (err) {
      console.error('[MDLHTableAnalyzer] Sample data fetch error:', err);
    }
  }, [isConnected, database, schema, table, executeQuery]);
  
  // Fetch data when table changes
  useEffect(() => {
    if (discoveredColumns.length > 0) {
      fetchCoverage();
      fetchSampleData();
    }
  }, [discoveredColumns, fetchCoverage, fetchSampleData]);
  
  // ==========================================================================
  // COMPUTED DATA
  // ==========================================================================
  
  // Build column analysis data
  const columnAnalysis = useMemo(() => {
    return discoveredColumns.map(col => {
      const field = findFieldForColumn(col.name);
      
      // Find signals this column contributes to
      const signals = [];
      if (field?.contributesToSignals) {
        for (const contrib of field.contributesToSignals) {
          signals.push(contrib.signal);
        }
      }
      
      return {
        column: col,
        field,
        signals,
        coverage: coverage.columns?.[col.name] ?? null,
        sampleValue: sampleData[col.name] ?? sampleData[col.name.toUpperCase()] ?? null,
      };
    });
  }, [discoveredColumns, coverage, sampleData]);
  
  // Filter columns
  const filteredColumns = useMemo(() => {
    let filtered = columnAnalysis;
    
    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c => 
        c.column.name.toLowerCase().includes(term) ||
        c.field?.displayName?.toLowerCase().includes(term) ||
        c.field?.id?.toLowerCase().includes(term)
      );
    }
    
    // Type filter
    if (filterType === 'mapped') {
      filtered = filtered.filter(c => c.field);
    } else if (filterType === 'unmapped') {
      filtered = filtered.filter(c => !c.field);
    }
    
    // Populated filter
    if (showOnlyPopulated) {
      filtered = filtered.filter(c => c.coverage > 0);
    }
    
    return filtered;
  }, [columnAnalysis, searchTerm, filterType, showOnlyPopulated]);
  
  // Summary stats
  const summary = useMemo(() => {
    const mapped = columnAnalysis.filter(c => c.field).length;
    const unmapped = columnAnalysis.filter(c => !c.field).length;
    const populated = columnAnalysis.filter(c => c.coverage > 0).length;
    const avgCoverage = columnAnalysis.reduce((sum, c) => sum + (c.coverage || 0), 0) / columnAnalysis.length || 0;
    
    return {
      totalColumns: columnAnalysis.length,
      mapped,
      unmapped,
      populated,
      avgCoverage,
      totalAssets: coverage.totalCount || 0,
    };
  }, [columnAnalysis, coverage]);
  
  // Signal evaluator summary
  const signalSummary = useMemo(() => {
    if (discoveredColumns.length === 0) return null;
    
    const evaluator = createDynamicSignalEvaluator(discoveredColumns);
    return evaluator.getSummary();
  }, [discoveredColumns]);
  
  // ==========================================================================
  // HANDLERS
  // ==========================================================================
  
  const toggleColumn = (columnName) => {
    setExpandedColumns(prev => {
      const next = new Set(prev);
      if (next.has(columnName)) {
        next.delete(columnName);
      } else {
        next.add(columnName);
      }
      return next;
    });
  };
  
  const exportAnalysis = () => {
    const exportData = {
      table: `${database}.${schema}.${table}`,
      timestamp: new Date().toISOString(),
      summary,
      signalSummary,
      columns: columnAnalysis.map(c => ({
        name: c.column.name,
        dataType: c.column.dataType,
        coverage: c.coverage,
        fieldId: c.field?.id,
        fieldName: c.field?.displayName,
        signals: c.signals,
        sampleValue: c.sampleValue,
      })),
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mdlh_analysis_${table}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  // ==========================================================================
  // RENDER
  // ==========================================================================
  
  if (!isConnected) {
    return (
      <div className="p-6 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-center gap-3">
          <AlertCircle className="text-amber-600" size={24} />
          <div>
            <h3 className="font-semibold text-amber-800">Connection Required</h3>
            <p className="text-sm text-amber-700">
              Connect to Snowflake to analyze MDLH tables.
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  if (!database || !schema) {
    return (
      <div className="p-6 bg-slate-50 border border-slate-200 rounded-lg text-center">
        <Database size={48} className="mx-auto text-slate-300 mb-4" />
        <h3 className="font-semibold text-slate-600">Select a Schema</h3>
        <p className="text-sm text-slate-500 mt-1">
          Choose a database and schema to analyze MDLH tables.
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-100 rounded-lg">
            <Table2 className="text-cyan-600" size={24} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">MDLH Table Analyzer</h2>
            <p className="text-sm text-slate-500">
              {database}.{schema}.{table}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => { refreshCatalog(); fetchCoverage(); }}
            disabled={loading || catalogLoading}
            className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-2"
          >
            <RefreshCw size={14} className={(loading || catalogLoading) ? 'animate-spin' : ''} />
            Refresh
          </button>
          
          <button
            onClick={exportAnalysis}
            className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-2"
          >
            <Download size={14} />
            Export
          </button>
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <div className="text-2xl font-bold text-slate-800">{summary.totalColumns}</div>
          <div className="text-xs text-slate-500">Total Columns</div>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <div className="text-2xl font-bold text-emerald-600">{summary.mapped}</div>
          <div className="text-xs text-slate-500">Mapped to Catalog</div>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <div className="text-2xl font-bold text-amber-600">{summary.unmapped}</div>
          <div className="text-xs text-slate-500">Unmapped Columns</div>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <div className="text-2xl font-bold text-indigo-600">{summary.avgCoverage.toFixed(1)}%</div>
          <div className="text-xs text-slate-500">Avg Coverage</div>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <div className="text-2xl font-bold text-slate-800">{summary.totalAssets.toLocaleString()}</div>
          <div className="text-xs text-slate-500">Active Assets</div>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <div className="text-2xl font-bold text-cyan-600">
            {signalSummary?.fullyEvaluable || 0}/{CANONICAL_SIGNALS.length}
          </div>
          <div className="text-xs text-slate-500">Signals Evaluable</div>
        </div>
      </div>
      
      {/* Signal Capability Summary */}
      {signalSummary && (
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Zap size={16} className="text-amber-500" />
            Signal Evaluation Capability
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(signalSummary.signals).map(([signal, info]) => (
              <div
                key={signal}
                className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 ${
                  info.canEvaluate
                    ? info.coverage === '100.0'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {info.canEvaluate ? (
                  <CheckCircle size={14} />
                ) : (
                  <XCircle size={14} />
                )}
                <span className="font-medium">{signal}</span>
                {info.canEvaluate && (
                  <span className="text-xs opacity-75">{info.coverage}%</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search columns..."
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          />
        </div>
        
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-cyan-500"
        >
          <option value="all">All Columns</option>
          <option value="mapped">Mapped Only</option>
          <option value="unmapped">Unmapped Only</option>
        </select>
        
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showOnlyPopulated}
            onChange={(e) => setShowOnlyPopulated(e.target.checked)}
            className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
          />
          Show only populated
        </label>
        
        <span className="text-sm text-slate-500">
          Showing {filteredColumns.length} of {columnAnalysis.length} columns
        </span>
      </div>
      
      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-700">
            <XCircle size={18} />
            <span className="font-medium">Error:</span>
            <span>{error}</span>
          </div>
        </div>
      )}
      
      {/* Columns Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="w-8"></th>
                <th className="text-left px-3 py-3 font-medium text-slate-600">Column Name</th>
                <th className="text-left px-3 py-3 font-medium text-slate-600">Type</th>
                <th className="text-left px-3 py-3 font-medium text-slate-600 w-40">Coverage</th>
                <th className="text-left px-3 py-3 font-medium text-slate-600">Signals</th>
                <th className="text-left px-3 py-3 font-medium text-slate-600">Sample Value</th>
              </tr>
            </thead>
            <tbody>
              {loading && !columns.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
                    Loading column analysis...
                  </td>
                </tr>
              ) : filteredColumns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No columns match your filters
                  </td>
                </tr>
              ) : (
                filteredColumns.map(({ column, field, signals, coverage: colCoverage, sampleValue }) => (
                  <ColumnRow
                    key={column.name}
                    column={column}
                    coverage={colCoverage}
                    field={field}
                    signals={signals}
                    sampleValue={sampleValue}
                    expanded={expandedColumns.has(column.name)}
                    onToggle={() => toggleColumn(column.name)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default MDLHTableAnalyzer;
