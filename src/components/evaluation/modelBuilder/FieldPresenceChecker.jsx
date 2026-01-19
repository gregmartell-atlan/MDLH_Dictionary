/**
 * FieldPresenceChecker Component - Enhanced Version
 * 
 * Interactive tool to check field presence and coverage across MDLH schemas.
 * Now with multi-level hierarchical filtering capabilities:
 * - Database/Schema/Table selection
 * - MDLH table detection
 * - Hierarchy filters (Connection, Domain, Asset Type)
 * - Dynamic field catalog adaptation
 * 
 * Uses the new DynamicSchemaContext for centralized discovery.
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Database,
  Play,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Download,
  Layers,
  ChevronDown,
  ChevronRight,
  Settings2,
  Filter,
  Table2,
  Sparkles,
  Link2,
  Eye,
  EyeOff,
  BarChart3,
  Grid3X3,
} from 'lucide-react';
import { useFieldPresence } from '../../../hooks/useFieldPresence';
import { useConnection, useMetadata, useQuery } from '../../../hooks/useSnowflake';
import { AssetContextSelector, SELECTION_MODE } from '../../common/AssetContextSelector';
import { escapeIdentifier, escapeStringValue, buildSafeFQN } from '../../../utils/queryHelpers';

// =============================================================================
// CONSTANTS
// =============================================================================

// Category display order
const CATEGORY_ORDER = [
  'identity',
  'ownership',
  'documentation',
  'lineage',
  'classification',
  'governance',
  'quality',
  'usage',
  'hierarchy',
  'lifecycle',
];

// MDLH table patterns
const MDLH_TABLE_PATTERNS = {
  asset: ['ASSETS', 'ASSET', 'GOLD_ASSETS', 'ALL_ASSETS'],
  lineage: ['LINEAGE', 'RELATIONSHIPS', 'PROCESSES'],
  glossary: ['GLOSSARY', 'TERMS'],
  quality: ['QUALITY', 'DQ_RESULTS', 'CHECKS'],
};

// Hierarchy columns for filtering
const HIERARCHY_COLUMNS = {
  connection: ['CONNECTIONQUALIFIEDNAME', 'CONNECTORNAME'],
  database: ['DATABASEQUALIFIEDNAME', 'DATABASE_NAME'],
  schema: ['SCHEMAQUALIFIEDNAME', 'SCHEMA_NAME'],
  assetType: ['TYPENAME', 'ASSET_TYPE'],
  domain: ['DOMAINGUIDS'],
};

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function CategoryBadge({ category }) {
  const colors = {
    identity: 'bg-slate-100 text-slate-700',
    ownership: 'bg-blue-100 text-blue-700',
    documentation: 'bg-purple-100 text-purple-700',
    lineage: 'bg-amber-100 text-amber-700',
    classification: 'bg-red-100 text-red-700',
    governance: 'bg-emerald-100 text-emerald-700',
    quality: 'bg-cyan-100 text-cyan-700',
    usage: 'bg-orange-100 text-orange-700',
    hierarchy: 'bg-indigo-100 text-indigo-700',
    lifecycle: 'bg-gray-100 text-gray-700',
  };
  
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${colors[category] || 'bg-gray-100 text-gray-600'}`}>
      {category}
    </span>
  );
}

function StatusCell({ found, coverage, matchedColumn }) {
  if (!found) {
    return (
      <div className="flex items-center gap-1 text-red-600">
        <XCircle size={14} />
        <span className="text-xs">Missing</span>
      </div>
    );
  }
  
  const coverageColor = coverage >= 80 ? 'text-emerald-600' : coverage >= 50 ? 'text-amber-600' : 'text-red-600';
  
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1 text-emerald-600">
        <CheckCircle size={14} />
        <span className="text-xs font-medium">{matchedColumn}</span>
      </div>
      {coverage !== null && coverage !== undefined && (
        <span className={`text-[10px] ${coverageColor}`}>
          {coverage.toFixed(1)}% populated
        </span>
      )}
    </div>
  );
}

function TableBadge({ tableName }) {
  const upper = tableName?.toUpperCase() || '';
  
  // Detect MDLH category
  let category = null;
  let color = 'bg-slate-100 text-slate-600';
  let icon = Table2;
  
  if (MDLH_TABLE_PATTERNS.asset.some(p => upper.includes(p))) {
    category = 'Asset';
    color = 'bg-blue-100 text-blue-700';
    icon = Database;
  } else if (MDLH_TABLE_PATTERNS.lineage.some(p => upper.includes(p))) {
    category = 'Lineage';
    color = 'bg-amber-100 text-amber-700';
    icon = Link2;
  } else if (MDLH_TABLE_PATTERNS.glossary.some(p => upper.includes(p))) {
    category = 'Glossary';
    color = 'bg-purple-100 text-purple-700';
  } else if (MDLH_TABLE_PATTERNS.quality.some(p => upper.includes(p))) {
    category = 'Quality';
    color = 'bg-cyan-100 text-cyan-700';
    icon = Sparkles;
  }
  
  const Icon = icon;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${color}`}>
      <Icon size={10} />
      {category || tableName}
    </span>
  );
}

function HierarchyFilterPanel({ filters, onFilterChange, availableFilters, loading }) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-slate-500" />
          <span>Hierarchy Filters</span>
          {Object.values(filters).filter(Boolean).length > 0 && (
            <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-medium">
              {Object.values(filters).filter(Boolean).length} active
            </span>
          )}
        </div>
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      
      {expanded && (
        <div className="px-4 py-3 border-t border-slate-200 space-y-3">
          {/* Asset Type Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Asset Type</label>
            <select
              value={filters.assetType || ''}
              onChange={(e) => onFilterChange({ ...filters, assetType: e.target.value || null })}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              disabled={loading}
            >
              <option value="">All Asset Types</option>
              {(availableFilters.assetTypes || []).map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          
          {/* Connection Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Connection</label>
            <select
              value={filters.connection || ''}
              onChange={(e) => onFilterChange({ ...filters, connection: e.target.value || null })}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              disabled={loading}
            >
              <option value="">All Connections</option>
              {(availableFilters.connections || []).map(conn => (
                <option key={conn} value={conn}>{conn.split('/').pop()}</option>
              ))}
            </select>
          </div>
          
          {/* Clear filters */}
          {Object.values(filters).filter(Boolean).length > 0 && (
            <button
              onClick={() => onFilterChange({})}
              className="text-xs text-indigo-600 hover:underline"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function FieldPresenceChecker({ database, schema }) {
  const { status: connectionStatus } = useConnection();
  const isConnected = connectionStatus?.connected === true;
  const { fetchDatabases, fetchSchemas } = useMetadata(connectionStatus);
  const { executeQuery } = useQuery(connectionStatus);
  const { loading, error, results, runPresenceCheck } = useFieldPresence();
  
  // ==========================================================================
  // STATE
  // ==========================================================================
  
  // Dynamic schema selection using AssetContextSelector
  const [selectedSchemas, setSelectedSchemas] = useState([]);
  const [showContextSelector, setShowContextSelector] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState(new Set(CATEGORY_ORDER));
  const [selectingAll, setSelectingAll] = useState(false);
  const [autoSelectedAll, setAutoSelectedAll] = useState(false);
  const [autoRunTriggered, setAutoRunTriggered] = useState(false);
  
  // View mode: 'grid' for compact view, 'table' for detailed view
  const [viewMode, setViewMode] = useState('table');
  
  // Hierarchy filters
  const [hierarchyFilters, setHierarchyFilters] = useState({
    assetType: null,
    connection: null,
    database: null,
    schema: null,
  });
  
  // Available filter values (populated from discovered data)
  const [availableFilters, setAvailableFilters] = useState({
    assetTypes: [],
    connections: [],
  });
  
  // Table-specific analysis (for deep discovery)
  const [selectedTable, setSelectedTable] = useState(null);
  const [discoveredTables, setDiscoveredTables] = useState([]);
  
  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================
  
  // Initialize with passed database/schema if provided
  useEffect(() => {
    if (database && schema && selectedSchemas.length === 0) {
      setSelectedSchemas([{
        database,
        schema,
        label: `${database}.${schema}`,
      }]);
    }
  }, [database, schema]);
  
  // ==========================================================================
  // DISCOVERY FUNCTIONS
  // ==========================================================================
  
  /**
   * Discover available tables in a schema
   */
  const discoverTablesInSchema = useCallback(async (db, sch) => {
    if (!isConnected) return [];
    
    try {
      const query = `
        SELECT DISTINCT TABLE_NAME
        FROM ${escapeIdentifier(db)}.INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = ${escapeStringValue(sch)}
          AND TABLE_TYPE IN ('BASE TABLE', 'VIEW')
        ORDER BY TABLE_NAME
      `;
      
      const result = await executeQuery(query, { database: db, schema: sch });
      
      // Normalize
      const normalizeRows = (rawResult) => {
        const columns = rawResult?.columns || [];
        const rows = rawResult?.rows || [];
        if (!Array.isArray(rows)) return [];
        return rows.map((row) => {
          if (Array.isArray(row)) {
            return columns.reduce((acc, col, idx) => {
              acc[col] = row[idx];
              return acc;
            }, {});
          }
          return row || {};
        });
      };
      
      const tables = normalizeRows(result).map(r => r.TABLE_NAME || r.table_name).filter(Boolean);
      
      // Categorize tables
      return tables.map(name => ({
        name,
        isMdlh: Object.values(MDLH_TABLE_PATTERNS).flat().some(p => 
          name.toUpperCase().includes(p)
        ),
      }));
    } catch (e) {
      console.error(`[FieldPresenceChecker] Failed to discover tables in ${db}.${sch}:`, e);
      return [];
    }
  }, [isConnected, executeQuery]);
  
  /**
   * Fetch available hierarchy filter values from a schema
   */
  const fetchAvailableFilters = useCallback(async (db, sch, table = 'ASSETS') => {
    if (!isConnected) return;
    
    try {
      // Check which hierarchy columns exist
      const columnsQuery = `
        SELECT COLUMN_NAME
        FROM ${escapeIdentifier(db)}.INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ${escapeStringValue(sch)}
          AND TABLE_NAME = ${escapeStringValue(table)}
      `;
      
      const colResult = await executeQuery(columnsQuery, { database: db, schema: sch });
      const columns = new Set();
      
      const normalizeRows = (rawResult) => {
        const cols = rawResult?.columns || [];
        const rows = rawResult?.rows || [];
        if (!Array.isArray(rows)) return [];
        return rows.map((row) => {
          if (Array.isArray(row)) {
            return cols.reduce((acc, col, idx) => {
              acc[col] = row[idx];
              return acc;
            }, {});
          }
          return row || {};
        });
      };
      
      for (const row of normalizeRows(colResult)) {
        const name = row.COLUMN_NAME || row.column_name;
        if (name) columns.add(name.toUpperCase());
      }
      
      const fqn = buildSafeFQN(db, sch, table);
      
      // Fetch asset types if available
      const typeCol = HIERARCHY_COLUMNS.assetType.find(c => columns.has(c.toUpperCase()));
      if (typeCol) {
        const typeQuery = `
          SELECT DISTINCT ${escapeIdentifier(typeCol)} AS value
          FROM ${fqn}
          WHERE ${escapeIdentifier(typeCol)} IS NOT NULL
            AND STATUS = 'ACTIVE'
          ORDER BY value
          LIMIT 100
        `;
        
        try {
          const typeResult = await executeQuery(typeQuery, { database: db, schema: sch });
          const types = normalizeRows(typeResult).map(r => r.VALUE || r.value).filter(Boolean);
          setAvailableFilters(prev => ({ ...prev, assetTypes: types }));
        } catch (e) {
          console.warn('Failed to fetch asset types:', e);
        }
      }
      
      // Fetch connections if available
      const connCol = HIERARCHY_COLUMNS.connection.find(c => columns.has(c.toUpperCase()));
      if (connCol) {
        const connQuery = `
          SELECT DISTINCT ${escapeIdentifier(connCol)} AS value
          FROM ${fqn}
          WHERE ${escapeIdentifier(connCol)} IS NOT NULL
            AND STATUS = 'ACTIVE'
          ORDER BY value
          LIMIT 100
        `;
        
        try {
          const connResult = await executeQuery(connQuery, { database: db, schema: sch });
          const conns = normalizeRows(connResult).map(r => r.VALUE || r.value).filter(Boolean);
          setAvailableFilters(prev => ({ ...prev, connections: conns }));
        } catch (e) {
          console.warn('Failed to fetch connections:', e);
        }
      }
    } catch (e) {
      console.error('Failed to fetch available filters:', e);
    }
  }, [isConnected, executeQuery]);
  
  // ==========================================================================
  // RESULTS PROCESSING
  // ==========================================================================
  
  // Group results by category
  const groupedResults = useMemo(() => {
    if (!results || results.length === 0) return null;
    
    const groups = {};
    
    for (const category of CATEGORY_ORDER) {
      groups[category] = {
        category,
        fields: [],
      };
    }
    
    // Get fields from first successful result
    const firstResult = results.find(r => !r.error);
    if (!firstResult) return null;
    
    for (const field of firstResult.fieldResults) {
      const cat = field.category;
      if (groups[cat]) {
        const fieldData = {
          ...field,
          schemas: {},
        };
        
        // Add data from all schemas
        for (const result of results) {
          if (result.error) continue;
          const schemaKey = `${result.database}.${result.schema}`;
          const fieldResult = result.fieldResults.find(f => f.fieldId === field.fieldId);
          if (fieldResult) {
            fieldData.schemas[schemaKey] = {
              found: fieldResult.found,
              matchedColumn: fieldResult.matchedColumn,
              coverage: fieldResult.coverage,
            };
          }
        }
        
        groups[cat].fields.push(fieldData);
      }
    }
    
    return groups;
  }, [results]);
  
  // Compute summary statistics
  const summaryStats = useMemo(() => {
    if (!results) return null;
    
    const successResults = results.filter(r => !r.error);
    if (successResults.length === 0) return null;
    
    const totalFields = successResults[0]?.totalFields || 0;
    const avgFound = successResults.reduce((sum, r) => sum + r.foundFields, 0) / successResults.length;
    const avgCoverage = successResults.reduce((sum, r) => {
      const fieldResults = r.fieldResults || [];
      const coverages = fieldResults.filter(f => f.coverage !== null).map(f => f.coverage);
      return sum + (coverages.length > 0 ? coverages.reduce((a, b) => a + b, 0) / coverages.length : 0);
    }, 0) / successResults.length;
    
    return {
      totalSchemas: successResults.length,
      errorSchemas: results.filter(r => r.error).length,
      totalFields,
      avgFound: Math.round(avgFound),
      avgCoverage: avgCoverage.toFixed(1),
    };
  }, [results]);
  
  // ==========================================================================
  // HANDLERS
  // ==========================================================================
  
  const handleRun = async () => {
    if (selectedSchemas.length === 0) return;
    
    const schemas = selectedSchemas.map(s => ({ 
      database: s.database, 
      schema: s.schema 
    }));
    
    await runPresenceCheck(schemas);
    setShowContextSelector(false); // Collapse selector after running
    
    // Fetch available filters from first schema
    if (schemas.length > 0) {
      await fetchAvailableFilters(schemas[0].database, schemas[0].schema);
    }
  };
  
  const handleSelectionChange = (newSelection) => {
    setSelectedSchemas(newSelection);
  };

  // Auto-select all schemas
  useEffect(() => {
    if (!isConnected) return;
    if (autoSelectedAll) return;
    if (selectedSchemas.length > 0) return;
    setAutoSelectedAll(true);
    handleSelectAllSchemas();
  }, [isConnected, autoSelectedAll, selectedSchemas.length]);

  // Auto-run after auto-select
  useEffect(() => {
    if (!isConnected) return;
    if (!autoSelectedAll) return;
    if (autoRunTriggered) return;
    if (selectedSchemas.length === 0) return;
    const schemas = selectedSchemas.map(s => ({
      database: s.database,
      schema: s.schema,
    }));
    setAutoRunTriggered(true);
    runPresenceCheck(schemas);
  }, [isConnected, autoSelectedAll, autoRunTriggered, selectedSchemas, runPresenceCheck]);

  const handleSelectAllSchemas = async () => {
    setSelectingAll(true);
    try {
      const dbs = await fetchDatabases();
      const dbNames = (Array.isArray(dbs) ? dbs : [])
        .map(d => (typeof d === 'string' ? d : d?.name))
        .filter(Boolean);
      const schemaLists = await Promise.all(
        dbNames.map(async (dbName) => {
          const schemas = await fetchSchemas(dbName);
          const schemaNames = (Array.isArray(schemas) ? schemas : [])
            .map(s => (typeof s === 'string' ? s : s?.name))
            .filter(Boolean)
            .filter((name) => name.toUpperCase() !== 'INFORMATION_SCHEMA');
          return { dbName, schemaNames };
        })
      );
      const allSelections = schemaLists.flatMap(({ dbName, schemaNames }) =>
        schemaNames.map((schemaName) => ({
          database: dbName,
          schema: schemaName,
          label: `${dbName}.${schemaName}`,
        }))
      );
      setSelectedSchemas(allSelections);
      setShowContextSelector(false);
    } finally {
      setSelectingAll(false);
    }
  };
  
  const toggleCategory = (category) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };
  
  const exportResults = () => {
    if (!results) return;
    
    const exportData = {
      timestamp: new Date().toISOString(),
      summary: summaryStats,
      results,
      filters: hierarchyFilters,
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `field_presence_${new Date().toISOString().split('T')[0]}.json`;
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
              Connect to Snowflake to run field presence checks.
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  const schemaKeys = selectedSchemas.map(s => `${s.database}.${s.schema}`);
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Layers className="text-indigo-600" size={24} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Field Presence Checker</h2>
            <p className="text-sm text-slate-500">
              Validate field mappings and coverage across your MDLH schemas
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewMode === 'table' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500'
              }`}
            >
              <Grid3X3 size={16} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewMode === 'grid' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500'
              }`}
            >
              <BarChart3 size={16} />
            </button>
          </div>
          
          <button
            onClick={() => setShowContextSelector(!showContextSelector)}
            className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-2 transition-colors ${
              showContextSelector
                ? 'bg-slate-200 text-slate-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Settings2 size={16} />
            {showContextSelector ? 'Hide Selector' : 'Select Schemas'}
          </button>

          <button
            onClick={handleSelectAllSchemas}
            disabled={selectingAll}
            className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Select all databases and schemas (excluding INFORMATION_SCHEMA)"
          >
            {selectingAll ? <RefreshCw size={16} className="animate-spin" /> : <Database size={16} />}
            {selectingAll ? 'Selecting...' : 'Select All'}
          </button>
          
          {results && (
            <button
              onClick={exportResults}
              className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-2"
            >
              <Download size={16} />
              Export
            </button>
          )}
          
          <button
            onClick={handleRun}
            disabled={loading || selectedSchemas.length === 0}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <Play size={16} />
                Run Check ({selectedSchemas.length})
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Dynamic Schema Selection */}
      {showContextSelector && (
        <AssetContextSelector
          selectedSchemas={selectedSchemas}
          onSelectionChange={handleSelectionChange}
          selectionMode={SELECTION_MODE.MULTI_SCHEMA}
          title="Select Schemas to Analyze"
          placeholder="Choose databases and schemas to check for field presence"
          defaultExpanded={selectedSchemas.length === 0}
        />
      )}
      
      {/* Selected schemas summary (when selector is hidden) */}
      {!showContextSelector && selectedSchemas.length > 0 && (
        <div className="bg-slate-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-700">Selected Schemas</h3>
            <button
              onClick={() => setShowContextSelector(true)}
              className="text-xs text-indigo-600 hover:underline"
            >
              Change selection
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedSchemas.slice(0, 10).map((s) => (
              <span
                key={s.label}
                className="px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 bg-indigo-100 text-indigo-700 border border-indigo-200"
              >
                <Database size={14} />
                {s.label}
              </span>
            ))}
            {selectedSchemas.length > 10 && (
              <span className="px-3 py-1.5 rounded-lg text-sm bg-slate-100 text-slate-600">
                +{selectedSchemas.length - 10} more
              </span>
            )}
          </div>
        </div>
      )}
      
      {/* Hierarchy Filters */}
      {results && (
        <HierarchyFilterPanel
          filters={hierarchyFilters}
          onFilterChange={setHierarchyFilters}
          availableFilters={availableFilters}
          loading={loading}
        />
      )}
      
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
      
      {/* Summary Stats */}
      {summaryStats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="p-4 bg-white border border-slate-200 rounded-lg">
            <div className="text-2xl font-bold text-slate-800">{summaryStats.totalSchemas}</div>
            <div className="text-xs text-slate-500">Schemas Analyzed</div>
          </div>
          <div className="p-4 bg-white border border-slate-200 rounded-lg">
            <div className="text-2xl font-bold text-slate-800">{summaryStats.totalFields}</div>
            <div className="text-xs text-slate-500">Catalog Fields</div>
          </div>
          <div className="p-4 bg-white border border-slate-200 rounded-lg">
            <div className="text-2xl font-bold text-emerald-600">{summaryStats.avgFound}</div>
            <div className="text-xs text-slate-500">Avg Fields Found</div>
          </div>
          <div className="p-4 bg-white border border-slate-200 rounded-lg">
            <div className="text-2xl font-bold text-indigo-600">{summaryStats.avgCoverage}%</div>
            <div className="text-xs text-slate-500">Avg Coverage</div>
          </div>
          {summaryStats.errorSchemas > 0 && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{summaryStats.errorSchemas}</div>
              <div className="text-xs text-red-500">Errors</div>
            </div>
          )}
        </div>
      )}
      
      {/* Results Summary Cards */}
      {results && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map((result) => {
            const key = `${result.database}.${result.schema}`;
            
            if (result.error) {
              return (
                <div key={key} className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="font-medium text-red-700">{key}</h4>
                  <p className="text-sm text-red-600 mt-1">{result.error}</p>
                </div>
              );
            }
            
            const pct = ((result.foundFields / result.totalFields) * 100).toFixed(1);
            
            return (
              <div key={key} className="p-4 bg-white border border-slate-200 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-slate-800">{key}</h4>
                  <TableBadge tableName={result.primaryTable} />
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Primary Table:</span>
                    <span className="font-medium text-slate-700">{result.primaryTable}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Columns:</span>
                    <span className="font-medium text-slate-700">{result.columnCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Fields Found:</span>
                    <span className="font-medium text-emerald-600">
                      {result.foundFields}/{result.totalFields} ({pct}%)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Assets:</span>
                    <span className="font-medium text-slate-700">
                      {result.totalAssets?.toLocaleString() || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Detailed Results Table */}
      {groupedResults && viewMode === 'table' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 w-64">Field</th>
                  {schemaKeys.map(key => (
                    <th key={key} className="text-left px-4 py-3 font-medium text-slate-600 min-w-[200px]">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CATEGORY_ORDER.map(category => {
                  const group = groupedResults[category];
                  if (!group || group.fields.length === 0) return null;
                  
                  const isExpanded = expandedCategories.has(category);
                  const foundCount = group.fields.filter(f => 
                    Object.values(f.schemas).some(s => s.found)
                  ).length;
                  
                  return (
                    <React.Fragment key={category}>
                      {/* Category header */}
                      <tr
                        className="bg-slate-100 cursor-pointer hover:bg-slate-150"
                        onClick={() => toggleCategory(category)}
                      >
                        <td colSpan={1 + schemaKeys.length} className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown size={16} className="text-slate-400" />
                            ) : (
                              <ChevronRight size={16} className="text-slate-400" />
                            )}
                            <CategoryBadge category={category} />
                            <span className="text-slate-500 text-xs">
                              ({foundCount}/{group.fields.length} fields)
                            </span>
                          </div>
                        </td>
                      </tr>
                      
                      {/* Field rows */}
                      {isExpanded && group.fields.map(field => (
                        <tr key={field.fieldId} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-2">
                            <div>
                              <div className="font-medium text-slate-700">{field.displayName}</div>
                              <div className="text-xs text-slate-400">{field.fieldId}</div>
                            </div>
                          </td>
                          {schemaKeys.map(schemaKey => {
                            const schemaData = field.schemas[schemaKey];
                            return (
                              <td key={schemaKey} className="px-4 py-2">
                                {schemaData ? (
                                  <StatusCell
                                    found={schemaData.found}
                                    coverage={schemaData.coverage}
                                    matchedColumn={schemaData.matchedColumn}
                                  />
                                ) : (
                                  <span className="text-slate-400 text-xs">N/A</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Grid View */}
      {groupedResults && viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CATEGORY_ORDER.map(category => {
            const group = groupedResults[category];
            if (!group || group.fields.length === 0) return null;
            
            const foundCount = group.fields.filter(f => 
              Object.values(f.schemas).some(s => s.found)
            ).length;
            
            return (
              <div key={category} className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <CategoryBadge category={category} />
                  <span className="text-sm text-slate-500">
                    {foundCount}/{group.fields.length}
                  </span>
                </div>
                
                <div className="space-y-2">
                  {group.fields.slice(0, 5).map(field => {
                    const isFound = Object.values(field.schemas).some(s => s.found);
                    return (
                      <div key={field.fieldId} className="flex items-center gap-2">
                        {isFound ? (
                          <CheckCircle size={14} className="text-emerald-500" />
                        ) : (
                          <XCircle size={14} className="text-red-400" />
                        )}
                        <span className={`text-sm ${isFound ? 'text-slate-700' : 'text-slate-400'}`}>
                          {field.displayName}
                        </span>
                      </div>
                    );
                  })}
                  {group.fields.length > 5 && (
                    <div className="text-xs text-slate-400">
                      +{group.fields.length - 5} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default FieldPresenceChecker;
