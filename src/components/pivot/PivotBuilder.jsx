/**
 * Pivot Builder
 * 
 * Interactive pivot table builder with:
 * - Pre-built pivot gallery
 * - Custom pivot configuration
 * - Live SQL generation and execution
 * - Results visualization
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
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
import { useConnection, useMetadata, useQuery } from '../../hooks/useSnowflake';
import { useDynamicSchema } from '../../context/DynamicSchemaContext';
import { useMdlhContext } from '../../context/MdlhContext';
import { getCapabilitiesTableColumns } from '../../utils/capabilityHelpers';
import { submitPivotFeedback } from '../../services/pivotFeedback';
import { PreBuiltPivotGallery } from './PreBuiltPivotGallery';
import {
  PIVOT_DIMENSIONS,
  PIVOT_MEASURES,
  generatePivotSQL,
  buildCustomPivotSQL,
  getPivotById,
} from '../../data/prebuiltPivotRegistry';
import { DEFAULT_SCHEMA, MDLH_DATABASES, MDLH_SCHEMAS } from '../../data/constants';
import { buildSafeFQN } from '../../utils/queryHelpers';

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
  const { fetchTables, fetchColumns } = useMetadata(connectionStatus);
  const { context: mdlhContext, capabilities, setDatabase: setGlobalDatabase, setSchema: setGlobalSchema } = useMdlhContext();
  const {
    databases,
    discoveredTables = [],
    mdlhTableTypes = {},
    discoverSchemas,
    discoverTablesFast,
  } = useDynamicSchema() || {};
  
  // State
  const [activeTab, setActiveTab] = useState('gallery'); // 'gallery' | 'custom'
  const [selectedDimensions, setSelectedDimensions] = useState([]);
  const [selectedMeasures, setSelectedMeasures] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedDatabase, setSelectedDatabase] = useState(propDatabase || mdlhContext.database || '');
  const [selectedSchema, setSelectedSchema] = useState(propSchema || mdlhContext.schema || '');
  const [generatedSQL, setGeneratedSQL] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSQL, setShowSQL] = useState(false);
  const [copiedSQL, setCopiedSQL] = useState(false);
  const lastTableRefreshRef = useRef('');
  const [directTables, setDirectTables] = useState([]);
  const [selectedPivotId, setSelectedPivotId] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState('5');
  const [feedbackHelpful, setFeedbackHelpful] = useState('yes');
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState(null);
  const [tableColumns, setTableColumns] = useState([]);
  const [sqlIssues, setSqlIssues] = useState({ missingColumns: [], alternates: [] });
  const [sqlAutoGenerated, setSqlAutoGenerated] = useState(false);
  
  useEffect(() => {
    const nextDatabase = propDatabase || mdlhContext.database || '';
    if (nextDatabase && nextDatabase !== selectedDatabase) {
      setSelectedDatabase(nextDatabase);
    }
    const nextSchema = propSchema || mdlhContext.schema || '';
    if (nextSchema && nextSchema !== selectedSchema) {
      setSelectedSchema(nextSchema);
    }
  }, [propDatabase, propSchema, mdlhContext.database, mdlhContext.schema, selectedDatabase, selectedSchema]);

  const availableDatabases = useMemo(() => {
    const dbs = new Set(discoveredTables.map((t) => t.database).filter(Boolean));
    MDLH_DATABASES.forEach((db) => dbs.add(db.name));
    if (databases?.size) {
      for (const dbName of databases.keys()) {
        dbs.add(dbName);
      }
    }
    if (propDatabase) dbs.add(propDatabase);
    if (selectedDatabase) dbs.add(selectedDatabase);
    return Array.from(dbs).sort();
  }, [discoveredTables, databases, propDatabase, selectedDatabase]);

  const availableSchemas = useMemo(() => {
    const schemas = new Set(MDLH_SCHEMAS);
    if (selectedDatabase && databases?.size) {
      const dbEntry = databases.get(selectedDatabase);
      if (dbEntry?.schemas?.size) {
        for (const schemaName of dbEntry.schemas.keys()) {
          schemas.add(schemaName);
        }
      }
    }
    for (const t of discoveredTables) {
      if (!selectedDatabase || t.database === selectedDatabase) {
        if (t.schema) schemas.add(t.schema);
      }
    }
    if (propSchema && (!selectedDatabase || propDatabase === selectedDatabase)) {
      schemas.add(propSchema);
    }
    return Array.from(schemas).sort();
  }, [discoveredTables, databases, selectedDatabase, propSchema, propDatabase]);

  useEffect(() => {
    if (!isConnected || !selectedDatabase || !discoverSchemas) return;
    const dbEntry = databases?.get?.(selectedDatabase);
    if (!dbEntry || (dbEntry.schemas?.size ?? 0) === 0) {
      discoverSchemas(selectedDatabase, false);
    }
  }, [isConnected, selectedDatabase, databases, discoverSchemas]);

  // Available tables for the selected DB + schema
  const availableTables = useMemo(() => {
    const byDiscovery = discoveredTables.filter(
      (t) => t.database === selectedDatabase && t.schema === selectedSchema
    );
    if (byDiscovery.length > 0) return byDiscovery;
    return directTables;
  }, [discoveredTables, selectedDatabase, selectedSchema, directTables]);

  useEffect(() => {
    if (!isConnected || !selectedDatabase || !selectedSchema || !fetchTables) return;
    let cancelled = false;

    const loadTables = async () => {
      const tables = await fetchTables(selectedDatabase, selectedSchema, false);
      if (cancelled) return;
      const normalized = (Array.isArray(tables) ? tables : [])
        .filter((t) => t?.name)
        .map((t) => ({
          name: t.name,
          database: t.database || selectedDatabase,
          schema: t.schema || selectedSchema,
          fqn: buildSafeFQN(
            t.database || selectedDatabase,
            t.schema || selectedSchema,
            t.name
          ),
        }));
      setDirectTables(normalized);
    };

    loadTables();

    return () => {
      cancelled = true;
    };
  }, [isConnected, selectedDatabase, selectedSchema, fetchTables]);

  useEffect(() => {
    if (!isConnected || !selectedDatabase || !selectedSchema || !discoverTablesFast) return;
    discoverTablesFast(selectedDatabase, selectedSchema, false);
  }, [isConnected, selectedDatabase, selectedSchema, discoverTablesFast]);

  useEffect(() => {
    if (!isConnected || !selectedDatabase || !selectedSchema || !discoverTablesFast) return;
    if (availableTables.length > 0) return;
    const key = `${selectedDatabase}.${selectedSchema}`;
    if (lastTableRefreshRef.current === key) return;
    lastTableRefreshRef.current = key;
    discoverTablesFast(selectedDatabase, selectedSchema, true);
  }, [isConnected, selectedDatabase, selectedSchema, availableTables.length, discoverTablesFast]);

  useEffect(() => {
    if (!selectedDatabase && availableDatabases.length > 0) {
      setSelectedDatabase(availableDatabases[0]);
    }
  }, [selectedDatabase, availableDatabases]);

  const preferredSchema = useMemo(() => {
    if (availableSchemas.includes(DEFAULT_SCHEMA)) {
      return DEFAULT_SCHEMA;
    }
    return availableSchemas[0] || '';
  }, [availableSchemas]);

  useEffect(() => {
    if (!selectedSchema && preferredSchema) {
      setSelectedSchema(preferredSchema);
    }
  }, [selectedSchema, preferredSchema]);

  useEffect(() => {
    if (selectedSchema && availableSchemas.length > 0 && !availableSchemas.includes(selectedSchema)) {
      setSelectedSchema(preferredSchema);
    }
  }, [selectedSchema, availableSchemas, preferredSchema]);
  
  // Default to ASSETS table
  useEffect(() => {
    if (!selectedTable && availableTables.length > 0) {
      const assetsTable = availableTables.find(
        (t) =>
          t.name.toUpperCase() === 'ASSETS' ||
          mdlhTableTypes[t.fqn] === 'ASSETS'
      );
      const tableEntity = availableTables.find(
        (t) => t.name.toUpperCase() === 'TABLE_ENTITY'
      );
      setSelectedTable((assetsTable || tableEntity || availableTables[0]).fqn);
    }
  }, [availableTables, selectedTable, mdlhTableTypes]);

  useEffect(() => {
    if (selectedTable && availableTables.length > 0) {
      const tableExists = availableTables.some((t) => t.fqn === selectedTable);
      if (!tableExists) {
        setSelectedTable(null);
      }
    }
  }, [availableTables, selectedTable]);

  useEffect(() => {
    if (!selectedTable) {
      setTableColumns([]);
      return;
    }
    if (!isConnected || !fetchColumns) return;
    const parts = selectedTable.split('.').map((part) => part.replace(/^"|"$/g, ''));
    const tableName = parts[2] || parts[parts.length - 1];
    const tableDb = parts[0] || selectedDatabase;
    const tableSchema = parts[1] || selectedSchema || DEFAULT_SCHEMA;
    if (!tableDb || !tableSchema || !tableName) return;
    let cancelled = false;

    const loadColumns = async () => {
      const cols = await fetchColumns(tableDb, tableSchema, tableName, false);
      if (cancelled) return;
      const columnNames = (Array.isArray(cols) ? cols : [])
        .map((c) => c?.name)
        .filter(Boolean);
      if (columnNames.length > 0) {
        setTableColumns(columnNames);
        return;
      }
      const capabilityColumns = getCapabilitiesTableColumns(capabilities, tableName);
      setTableColumns(capabilityColumns);
    };

    loadColumns();

    return () => {
      cancelled = true;
    };
  }, [isConnected, fetchColumns, selectedTable, selectedDatabase, selectedSchema]);
  
  // Table FQN for queries
  const tableFqn = useMemo(() => {
    if (selectedTable) return selectedTable;
    if (selectedDatabase && selectedSchema) {
      return buildSafeFQN(selectedDatabase, selectedSchema, 'ASSETS');
    }
    return null;
  }, [selectedTable, selectedDatabase, selectedSchema]);
  
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
    const generated = pivot.generatedSQL
      ? { sql: pivot.generatedSQL, missingColumns: [], alternates: [] }
      : generatePivotSQL(
        pivot.id,
        tableFqn,
        { database: selectedDatabase, schema: selectedSchema },
        { availableColumns: tableColumns, capabilities }
      );
    setGeneratedSQL(generated.sql || '');
    setSqlIssues({
      missingColumns: generated.missingColumns || [],
      alternates: generated.alternates || [],
    });
    setSelectedPivotId(pivot.id);
    setSqlAutoGenerated(true);
    setActiveTab('custom'); // Switch to custom to show the configuration
    setShowSQL(true);
  }, [tableFqn, selectedDatabase, selectedSchema, tableColumns]);
  
  const generateSQL = useCallback(() => {
    if (!tableFqn || selectedDimensions.length === 0 || selectedMeasures.length === 0) {
      setError('Please select at least one dimension and one measure');
      return;
    }
    
    const generated = buildCustomPivotSQL(
      selectedDimensions,
      selectedMeasures,
      tableFqn,
      "STATUS = 'ACTIVE'",
      { availableColumns: tableColumns, capabilities }
    );
    setGeneratedSQL(generated.sql);
    setSqlIssues({
      missingColumns: generated.missingColumns || [],
      alternates: generated.alternates || [],
    });
    setSqlAutoGenerated(true);
    setSelectedPivotId('custom');
    setShowSQL(true);
  }, [tableFqn, selectedDimensions, selectedMeasures, tableColumns]);
  
  const executePivot = useCallback(async () => {
    if (!generatedSQL || !isConnected) {
      setError('Generate SQL first or connect to Snowflake');
      return;
    }

    if (sqlIssues.missingColumns.length > 0) {
      setError(`Missing columns: ${sqlIssues.missingColumns.join(', ')}`);
      return;
    }
    
    setLoading(true);
    setError(null);
    setResults(null);
    
    try {
      const result = await executeQuery(generatedSQL, { 
        database: selectedDatabase || propDatabase || mdlhContext.database, 
        schema: selectedSchema || propSchema || mdlhContext.schema || DEFAULT_SCHEMA
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
  }, [generatedSQL, isConnected, executeQuery, propDatabase, propSchema, selectedDatabase, selectedSchema, mdlhContext.database, mdlhContext.schema, sqlIssues.missingColumns.length]);
  
  const copySQL = useCallback(() => {
    navigator.clipboard.writeText(generatedSQL);
    setCopiedSQL(true);
    setTimeout(() => setCopiedSQL(false), 2000);
  }, [generatedSQL]);

  const tableSupported = useMemo(() => {
    if (!capabilities?.tables || !selectedTable) return null;
    const parts = selectedTable.split('.').map((part) => part.replace(/^"|"$/g, ''));
    const tableName = parts[parts.length - 1];
    if (!tableName) return null;
    return capabilities.tables.some((t) => t.toUpperCase() === tableName.toUpperCase());
  }, [capabilities, selectedTable]);

  useEffect(() => {
    if (!sqlAutoGenerated || !tableFqn) return;
    if (selectedPivotId && selectedPivotId !== 'custom') {
      const regenerated = generatePivotSQL(
        selectedPivotId,
        tableFqn,
        { database: selectedDatabase, schema: selectedSchema },
        { availableColumns: tableColumns, capabilities }
      );
      setGeneratedSQL(regenerated.sql || '');
      setSqlIssues({
        missingColumns: regenerated.missingColumns || [],
        alternates: regenerated.alternates || [],
      });
      return;
    }
    if (selectedDimensions.length > 0 && selectedMeasures.length > 0) {
      const regenerated = buildCustomPivotSQL(
        selectedDimensions,
        selectedMeasures,
        tableFqn,
        "STATUS = 'ACTIVE'",
        { availableColumns: tableColumns, capabilities }
      );
      setGeneratedSQL(regenerated.sql);
      setSqlIssues({
        missingColumns: regenerated.missingColumns || [],
        alternates: regenerated.alternates || [],
      });
    }
  }, [
    sqlAutoGenerated,
    selectedPivotId,
    selectedDimensions,
    selectedMeasures,
    tableFqn,
    selectedDatabase,
    selectedSchema,
    tableColumns,
    capabilities
  ]);
  
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

  const handleSubmitFeedback = useCallback(async () => {
    if (!generatedSQL) {
      setFeedbackStatus('Generate SQL first.');
      return;
    }

    try {
      setFeedbackStatus('Sending...');
      await submitPivotFeedback({
        pivot_id: selectedPivotId || 'custom',
        rating: Number(feedbackRating),
        helpful: feedbackHelpful === 'yes',
        comment: feedbackComment.trim() || null,
        context_database: selectedDatabase || null,
        context_schema: selectedSchema || null,
        context_table: selectedTable || null,
        sql: generatedSQL
      });
      setFeedbackStatus('Thanks! Feedback saved.');
      setFeedbackComment('');
    } catch (err) {
      setFeedbackStatus(err.message || 'Failed to send feedback.');
    }
  }, [
    generatedSQL,
    selectedPivotId,
    feedbackRating,
    feedbackHelpful,
    feedbackComment,
    selectedDatabase,
    selectedSchema,
    selectedTable
  ]);
  
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
              <Database size={16} className="text-slate-400" />
              <select
                value={selectedDatabase}
                onChange={(e) => {
                  const nextDb = e.target.value;
                  setSelectedDatabase(nextDb);
                  setSelectedSchema('');
                  setSelectedTable(null);
                  setGlobalDatabase(nextDb, { source: 'manual' });
                }}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
                disabled={!isConnected || availableDatabases.length === 0}
              >
                {availableDatabases.length === 0 && <option value="">No databases</option>}
                {availableDatabases.map((db) => (
                  <option key={db} value={db}>{db}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-slate-400" />
              <select
                value={selectedSchema}
                onChange={(e) => {
                  const nextSchema = e.target.value;
                  setSelectedSchema(nextSchema);
                  setSelectedTable(null);
                  setGlobalSchema(nextSchema, { source: 'manual' });
                }}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
                disabled={!isConnected || availableSchemas.length === 0}
              >
                {availableSchemas.length === 0 && <option value="">No schemas</option>}
                {availableSchemas.map((schema) => (
                  <option key={schema} value={schema}>{schema}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Table2 size={16} className="text-slate-400" />
              <select
                value={selectedTable || ''}
                onChange={(e) => {
                  setSelectedTable(e.target.value);
                }}
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
              context={{ database: selectedDatabase, schema: selectedSchema }}
              onSelectPivot={handlePrebuiltSelect}
              availableColumns={tableColumns}
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
                <button
                  onClick={() => setShowFeedback((prev) => !prev)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50"
                >
                  Feedback
                </button>
                {showFeedback && (
                  <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs text-slate-500">Helpful?</label>
                      <select
                        value={feedbackHelpful}
                        onChange={(e) => setFeedbackHelpful(e.target.value)}
                        className="border border-slate-200 rounded-md px-2 py-1 text-xs"
                      >
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs text-slate-500">Rating</label>
                      <select
                        value={feedbackRating}
                        onChange={(e) => setFeedbackRating(e.target.value)}
                        className="border border-slate-200 rounded-md px-2 py-1 text-xs"
                      >
                        {['5', '4', '3', '2', '1'].map((value) => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      value={feedbackComment}
                      onChange={(e) => setFeedbackComment(e.target.value)}
                      placeholder="What should we improve?"
                      rows={3}
                      className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                    />
                    <button
                      onClick={handleSubmitFeedback}
                      className="w-full rounded-md bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                    >
                      Send Feedback
                    </button>
                    {feedbackStatus && (
                      <div className="text-xs text-slate-500">{feedbackStatus}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* Right: Results */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* SQL Preview */}
              {showSQL && generatedSQL && (
                <div className="border-b border-slate-200 bg-slate-900 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-400">SQL (editable)</span>
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
                  {(sqlIssues.missingColumns.length > 0 || sqlIssues.alternates.length > 0 || tableSupported === false) && (
                    <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                      {tableSupported === false && (
                        <div>
                          Table not available in this context. Switch database/schema or refresh capabilities.
                        </div>
                      )}
                      {sqlIssues.missingColumns.length > 0 && (
                        <div>
                          Missing columns: {sqlIssues.missingColumns.join(', ')}.
                        </div>
                      )}
                      {sqlIssues.alternates.length > 0 && (
                        <div>
                          Using alternates: {sqlIssues.alternates.map((alt) => `${alt.column} → ${alt.alternate}`).join(', ')}.
                        </div>
                      )}
                    </div>
                  )}
                  <textarea
                    value={generatedSQL}
                    onChange={(e) => {
                      setGeneratedSQL(e.target.value);
                      setSqlIssues({ missingColumns: [], alternates: [] });
                      setSqlAutoGenerated(false);
                    }}
                    spellCheck={false}
                    className="w-full text-sm text-slate-100 font-mono bg-slate-900 border border-slate-700 rounded-lg p-2 max-h-48 h-32 overflow-auto focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
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
