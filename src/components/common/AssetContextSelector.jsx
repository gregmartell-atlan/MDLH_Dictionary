/**
 * AssetContextSelector - Reusable component for selecting database/schema/table context
 * 
 * Provides a dynamic multi-level selector that discovers available assets from Snowflake
 * and allows users to select specific databases, schemas, and optionally tables for analysis.
 * 
 * Used by: FieldPresenceChecker, ModelBuilder, EvaluationApp, etc.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Database,
  Layers,
  Table2,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  RefreshCw,
  Search,
  Plus,
  Minus,
  AlertCircle,
} from 'lucide-react';
import { useMetadata, useConnection } from '../../hooks/useSnowflake';

/**
 * Selection modes for the selector
 */
export const SELECTION_MODE = {
  SINGLE_SCHEMA: 'single_schema',     // Select one database.schema
  MULTI_SCHEMA: 'multi_schema',       // Select multiple database.schema combinations
  SINGLE_TABLE: 'single_table',       // Select one database.schema.table
  MULTI_TABLE: 'multi_table',         // Select multiple tables across schemas
};

/**
 * Compact badge showing selected count
 */
function SelectionBadge({ count, label, onClear }) {
  if (count === 0) return null;
  
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
      {count} {label}
      {onClear && (
        <button
          onClick={(e) => { e.stopPropagation(); onClear(); }}
          className="ml-1 hover:text-indigo-900"
        >
          <X size={12} />
        </button>
      )}
    </span>
  );
}

/**
 * Single database row with expand/collapse and selection
 */
function DatabaseRow({
  database,
  isExpanded,
  isSelected,
  schemas,
  selectedSchemas,
  loadingSchemas,
  onToggleExpand,
  onToggleSelect,
  onSchemaSelect,
  onSchemaToggle,
  selectionMode,
  showTables,
}) {
  const schemaCount = schemas?.length || 0;
  const selectedSchemaCount = selectedSchemas?.filter(s => s.database === database.name).length || 0;
  
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {/* Database header */}
      <div
        className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
          isSelected ? 'bg-indigo-50' : 'bg-slate-50 hover:bg-slate-100'
        }`}
        onClick={onToggleExpand}
      >
        <button className="p-0.5" onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}>
          {isExpanded ? (
            <ChevronDown size={16} className="text-slate-400" />
          ) : (
            <ChevronRight size={16} className="text-slate-400" />
          )}
        </button>
        
        <Database size={16} className="text-slate-500" />
        
        <span className="font-medium text-slate-700 flex-1">{database.name}</span>
        
        {selectedSchemaCount > 0 && (
          <span className="text-xs text-indigo-600 font-medium">
            {selectedSchemaCount} schema{selectedSchemaCount !== 1 ? 's' : ''} selected
          </span>
        )}
        
        {schemaCount > 0 && (
          <span className="text-xs text-slate-400">
            {schemaCount} schema{schemaCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      
      {/* Schemas list */}
      {isExpanded && (
        <div className="border-t border-slate-200 bg-white">
          {loadingSchemas ? (
            <div className="flex items-center gap-2 px-6 py-3 text-sm text-slate-500">
              <RefreshCw size={14} className="animate-spin" />
              Loading schemas...
            </div>
          ) : schemas?.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {schemas.map((schema) => {
                const isSchemaSelected = selectedSchemas?.some(
                  s => s.database === database.name && s.schema === schema.name
                );
                
                return (
                  <div
                    key={schema.name}
                    className={`flex items-center gap-2 px-6 py-2 cursor-pointer transition-colors ${
                      isSchemaSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'
                    }`}
                    onClick={() => {
                      if (selectionMode === SELECTION_MODE.MULTI_SCHEMA) {
                        onSchemaToggle(database.name, schema.name);
                      } else {
                        onSchemaSelect(database.name, schema.name);
                      }
                    }}
                  >
                    <Layers size={14} className="text-slate-400" />
                    <span className="text-sm text-slate-600 flex-1">{schema.name}</span>
                    
                    {isSchemaSelected && (
                      <Check size={14} className="text-indigo-600" />
                    )}
                    
                    {selectionMode === SELECTION_MODE.MULTI_SCHEMA && (
                      <button
                        className={`p-1 rounded ${
                          isSchemaSelected
                            ? 'text-indigo-600 hover:bg-indigo-100'
                            : 'text-slate-400 hover:bg-slate-100'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSchemaToggle(database.name, schema.name);
                        }}
                      >
                        {isSchemaSelected ? <Minus size={14} /> : <Plus size={14} />}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-6 py-3 text-sm text-slate-400 italic">
              No schemas found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Main AssetContextSelector component
 */
export function AssetContextSelector({
  // Selection state (controlled)
  selectedSchemas = [],
  onSelectionChange,
  
  // Configuration
  selectionMode = SELECTION_MODE.MULTI_SCHEMA,
  showTableCount = false,
  maxSelections = null,
  defaultExpanded = false,
  
  // Styling
  className = '',
  compact = false,
  
  // Labels
  title = 'Select Context',
  placeholder = 'Choose databases and schemas to analyze',
  emptyMessage = 'No databases available',
}) {
  const { status: connectionStatus } = useConnection();
  const { fetchDatabases, fetchSchemas, fetchTables, loading: metadataLoading } = useMetadata();
  
  const isConnected = connectionStatus?.connected === true;
  
  // Local state
  const [databases, setDatabases] = useState([]);
  const [schemasMap, setSchemasMap] = useState({}); // { [dbName]: Schema[] }
  const [tablesMap, setTablesMap] = useState({});   // { [dbName.schemaName]: Table[] }
  const [expandedDbs, setExpandedDbs] = useState(new Set());
  const [loadingSchemas, setLoadingSchemas] = useState({});
  const [loadingTables, setLoadingTables] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [error, setError] = useState(null);
  
  // Load databases on mount when connected
  useEffect(() => {
    if (isConnected && !initialLoadDone) {
      setError(null);
      fetchDatabases()
        .then((dbs) => {
          const dbList = Array.isArray(dbs) ? dbs : [];
          setDatabases(dbList.map(d => typeof d === 'string' ? { name: d } : d));
          setInitialLoadDone(true);
          
          // Auto-expand first database if defaultExpanded
          if (defaultExpanded && dbList.length > 0) {
            const firstDb = typeof dbList[0] === 'string' ? dbList[0] : dbList[0].name;
            setExpandedDbs(new Set([firstDb]));
            loadSchemasForDb(firstDb);
          }
        })
        .catch((err) => {
          console.error('[AssetContextSelector] Failed to load databases:', err);
          setError('Failed to load databases');
        });
    }
  }, [isConnected, initialLoadDone, fetchDatabases, defaultExpanded]);
  
  // Load schemas for a database
  const loadSchemasForDb = useCallback(async (dbName) => {
    if (schemasMap[dbName] || loadingSchemas[dbName]) return;
    
    setLoadingSchemas(prev => ({ ...prev, [dbName]: true }));
    
    try {
      const schemas = await fetchSchemas(dbName);
      const schemaList = Array.isArray(schemas) ? schemas : [];
      setSchemasMap(prev => ({
        ...prev,
        [dbName]: schemaList.map(s => typeof s === 'string' ? { name: s } : s),
      }));
    } catch (err) {
      console.error(`[AssetContextSelector] Failed to load schemas for ${dbName}:`, err);
    } finally {
      setLoadingSchemas(prev => ({ ...prev, [dbName]: false }));
    }
  }, [fetchSchemas, schemasMap, loadingSchemas]);
  
  // Toggle database expansion
  const toggleDbExpand = useCallback((dbName) => {
    setExpandedDbs(prev => {
      const next = new Set(prev);
      if (next.has(dbName)) {
        next.delete(dbName);
      } else {
        next.add(dbName);
        // Load schemas when expanding
        loadSchemasForDb(dbName);
      }
      return next;
    });
  }, [loadSchemasForDb]);
  
  // Select a single schema (replaces current selection)
  const selectSchema = useCallback((database, schema) => {
    const newSelection = [{ database, schema, label: `${database}.${schema}` }];
    onSelectionChange?.(newSelection);
  }, [onSelectionChange]);
  
  // Toggle a schema in multi-select mode
  const toggleSchema = useCallback((database, schema) => {
    const key = `${database}.${schema}`;
    const exists = selectedSchemas.some(s => s.database === database && s.schema === schema);
    
    let newSelection;
    if (exists) {
      newSelection = selectedSchemas.filter(s => !(s.database === database && s.schema === schema));
    } else {
      if (maxSelections && selectedSchemas.length >= maxSelections) {
        return; // Don't add more than max
      }
      newSelection = [...selectedSchemas, { database, schema, label: key }];
    }
    
    onSelectionChange?.(newSelection);
  }, [selectedSchemas, maxSelections, onSelectionChange]);
  
  // Clear all selections
  const clearAll = useCallback(() => {
    onSelectionChange?.([]);
  }, [onSelectionChange]);
  
  // Refresh databases
  const refresh = useCallback(async () => {
    setError(null);
    setInitialLoadDone(false);
    setDatabases([]);
    setSchemasMap({});
    setExpandedDbs(new Set());
    
    try {
      const dbs = await fetchDatabases(true);
      const dbList = Array.isArray(dbs) ? dbs : [];
      setDatabases(dbList.map(d => typeof d === 'string' ? { name: d } : d));
      setInitialLoadDone(true);
    } catch (err) {
      setError('Failed to refresh databases');
    }
  }, [fetchDatabases]);
  
  // Filter databases by search
  const filteredDatabases = useMemo(() => {
    if (!searchTerm) return databases;
    const term = searchTerm.toLowerCase();
    return databases.filter(db => db.name.toLowerCase().includes(term));
  }, [databases, searchTerm]);
  
  // Not connected state
  if (!isConnected) {
    return (
      <div className={`p-4 bg-amber-50 border border-amber-200 rounded-lg ${className}`}>
        <div className="flex items-center gap-3">
          <AlertCircle className="text-amber-600" size={20} />
          <div>
            <h4 className="font-medium text-amber-800">Connection Required</h4>
            <p className="text-sm text-amber-700">
              Connect to Snowflake to browse available databases and schemas.
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`bg-white border border-slate-200 rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
          <Database size={18} className="text-slate-500" />
          <h3 className="font-medium text-slate-700">{title}</h3>
        </div>
        
        <div className="flex items-center gap-2">
          <SelectionBadge
            count={selectedSchemas.length}
            label="selected"
            onClear={selectedSchemas.length > 0 ? clearAll : null}
          />
          
          <button
            onClick={refresh}
            disabled={metadataLoading}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
            title="Refresh databases"
          >
            <RefreshCw size={16} className={metadataLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
      
      {/* Search */}
      {databases.length > 5 && (
        <div className="px-4 py-2 border-b border-slate-100">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search databases..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>
      )}
      
      {/* Error state */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border-b border-red-100 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}
      
      {/* Database list */}
      <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
        {!initialLoadDone ? (
          <div className="flex items-center justify-center gap-2 py-8 text-slate-500">
            <RefreshCw size={18} className="animate-spin" />
            <span>Loading databases...</span>
          </div>
        ) : filteredDatabases.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            {searchTerm ? 'No databases match your search' : emptyMessage}
          </div>
        ) : (
          filteredDatabases.map((db) => (
            <DatabaseRow
              key={db.name}
              database={db}
              isExpanded={expandedDbs.has(db.name)}
              isSelected={selectedSchemas.some(s => s.database === db.name)}
              schemas={schemasMap[db.name]}
              selectedSchemas={selectedSchemas}
              loadingSchemas={loadingSchemas[db.name]}
              onToggleExpand={() => toggleDbExpand(db.name)}
              onToggleSelect={() => {}}
              onSchemaSelect={selectSchema}
              onSchemaToggle={toggleSchema}
              selectionMode={selectionMode}
              showTables={false}
            />
          ))
        )}
      </div>
      
      {/* Selected schemas preview */}
      {selectedSchemas.length > 0 && (
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50">
          <div className="flex flex-wrap gap-2">
            {selectedSchemas.map((s) => (
              <span
                key={s.label}
                className="inline-flex items-center gap-1.5 px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-sm"
              >
                <Database size={12} />
                {s.label}
                <button
                  onClick={() => toggleSchema(s.database, s.schema)}
                  className="ml-1 hover:text-indigo-900"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AssetContextSelector;
