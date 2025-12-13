/**
 * Schema Explorer - Atlan-style tree browser for databases, schemas, tables, and columns
 * Matches the Atlan UI pattern with expandable hierarchy and data types
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  ChevronRight, ChevronDown, Database, Layers, Table2, 
  Eye, Columns, RefreshCw, Loader2, Hash, Type, Calendar,
  ToggleLeft, Code2, List, Braces, Search, Filter, X,
  Play, Copy, ExternalLink, Rows3, Clock
} from 'lucide-react';
import { useMetadata } from '../hooks/useSnowflake';
import { buildSafeFQN } from '../utils/queryHelpers';

// Type icons for different data types
const TypeIcon = ({ dataType }) => {
  const type = (dataType || '').toUpperCase().split('(')[0];
  
  if (['VARCHAR', 'CHAR', 'STRING', 'TEXT'].includes(type)) {
    return <Type size={12} className="text-green-500" />;
  }
  if (['NUMBER', 'INTEGER', 'INT', 'BIGINT', 'DECIMAL', 'FLOAT', 'DOUBLE'].includes(type)) {
    return <Hash size={12} className="text-blue-500" />;
  }
  if (['BOOLEAN', 'BOOL'].includes(type)) {
    return <ToggleLeft size={12} className="text-purple-500" />;
  }
  if (['DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'TIMESTAMP_NTZ', 'TIMESTAMP_LTZ', 'TIMESTAMP_TZ'].includes(type)) {
    return <Calendar size={12} className="text-amber-500" />;
  }
  if (['VARIANT', 'OBJECT'].includes(type)) {
    return <Braces size={12} className="text-pink-500" />;
  }
  if (['ARRAY'].includes(type)) {
    return <List size={12} className="text-pink-500" />;
  }
  return <Code2 size={12} className="text-gray-400" />;
};

// Format data type for display
const formatDataType = (dataType) => {
  if (!dataType) return '';
  const type = dataType.toUpperCase();
  
  // Simplify common types
  if (type.startsWith('VARCHAR')) return 'string';
  if (type.startsWith('NUMBER')) return 'number';
  if (type === 'BOOLEAN') return 'boolean';
  if (type.startsWith('TIMESTAMP')) return 'timestamp';
  if (type === 'DATE') return 'date';
  if (type === 'VARIANT') return 'variant';
  if (type === 'ARRAY') return 'array';
  if (type === 'OBJECT') return 'object';
  if (type.startsWith('FLOAT') || type.startsWith('DOUBLE')) return 'double';
  if (type.startsWith('INT') || type === 'BIGINT') return 'bigint';
  
  return type.toLowerCase();
};

// Format row count with K/M suffix
const formatRowCount = (count) => {
  if (count === undefined || count === null) return null;
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
};

/**
 * TableHoverPreview - Shows a preview card when hovering over a table
 * Displays table info, columns preview, and quick actions
 */
function TableHoverPreview({ 
  table, 
  database, 
  schema, 
  columns = [], 
  columnCount,
  rowCount,
  position, 
  onViewTable, 
  onCopyName,
  onClose 
}) {
  console.log('[TableHoverPreview] Rendering preview for:', table?.name, 'at position:', position);
  console.log('[TableHoverPreview] Props:', { database, schema, columnCount, rowCount, columnsLength: columns?.length });
  
  const isView = table.kind === 'VIEW';
  const fqn = buildSafeFQN(database, schema, table.name);
  const displayedColumns = columns.slice(0, 5);
  const remainingColumns = columns.length - 5;
  
  return (
    <div 
      className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 w-72 animate-zoom-in-95"
      style={{
        top: position.top,
        left: position.left,
      }}
      onMouseLeave={onClose}
    >
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white rounded-t-lg">
        <div className="flex items-center gap-2">
          {isView ? (
            <div className="p-1.5 bg-amber-100 rounded-md">
              <Eye size={14} className="text-amber-600" />
            </div>
          ) : (
            <div className="p-1.5 bg-emerald-100 rounded-md">
              <Table2 size={14} className="text-emerald-600" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-gray-900 truncate">
              {table.name}
            </div>
            <div className="text-[10px] text-gray-400 font-mono truncate">
              {database}.{schema}
            </div>
          </div>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
            isView 
              ? 'bg-amber-50 text-amber-600 border border-amber-200' 
              : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
          }`}>
            {isView ? 'VIEW' : 'TABLE'}
          </span>
        </div>
      </div>
      
      {/* Stats Row */}
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/50 flex items-center gap-4">
        {columnCount !== undefined && (
          <div className="flex items-center gap-1.5">
            <Columns size={12} className="text-blue-500" />
            <span className="text-xs text-gray-600">
              <span className="font-medium">{columnCount}</span> columns
            </span>
          </div>
        )}
        {rowCount !== undefined && rowCount !== null && (
          <div className="flex items-center gap-1.5">
            <Rows3 size={12} className="text-purple-500" />
            <span className="text-xs text-gray-600">
              <span className="font-medium">{formatRowCount(rowCount)}</span> rows
            </span>
          </div>
        )}
        {table.created_on && (
          <div className="flex items-center gap-1.5">
            <Clock size={12} className="text-gray-400" />
            <span className="text-[10px] text-gray-500">
              {new Date(table.created_on).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>
      
      {/* Columns Preview */}
      {displayedColumns.length > 0 && (
        <div className="px-3 py-2 border-b border-gray-100">
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1.5 font-medium">
            Columns
          </div>
          <div className="space-y-1">
            {displayedColumns.map((col, i) => (
              <div key={col.name || i} className="flex items-center gap-2 text-xs">
                <TypeIcon dataType={col.data_type || col.type} />
                <span className="text-gray-700 truncate flex-1">{col.name}</span>
                <span className="text-gray-400 font-mono text-[10px]">
                  {formatDataType(col.data_type || col.type)}
                </span>
              </div>
            ))}
            {remainingColumns > 0 && (
              <div className="text-[10px] text-gray-400 pl-5 italic">
                +{remainingColumns} more columns...
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Actions */}
      <div className="px-2 py-2 flex items-center gap-1.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewTable?.();
          }}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
        >
          <Play size={12} />
          View Table
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCopyName?.(fqn);
          }}
          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          title="Copy fully qualified name"
        >
          <Copy size={14} />
        </button>
      </div>
    </div>
  );
}

// Context Header - shows current connection/database/schema
function ContextHeader({ 
  connectionName, 
  database, 
  schema, 
  onDatabaseClick, 
  onSchemaClick 
}) {
  return (
    <div className="border-b border-gray-200 bg-white">
      {/* Connection */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
        <div className="p-1.5 bg-amber-100 rounded">
          <Database size={16} className="text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-500">Connection</div>
          <div className="text-sm font-medium text-gray-900 truncate">
            {connectionName || 'snowflake'}
          </div>
        </div>
        <ChevronRight size={16} className="text-gray-300" />
      </div>
      
      {/* Database */}
      <button 
        onClick={onDatabaseClick}
        className="w-full flex items-center gap-2 px-3 py-2 border-b border-gray-100 hover:bg-gray-50 transition-colors"
      >
        <div className="p-1.5 bg-blue-100 rounded">
          <Database size={16} className="text-blue-600" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-xs text-gray-500">Database</div>
          <div className="text-sm font-medium text-gray-900 truncate">
            {database || 'Select database'}
          </div>
        </div>
        <ChevronRight size={16} className="text-gray-300" />
      </button>
      
      {/* Schema */}
      <button 
        onClick={onSchemaClick}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors"
      >
        <div className="p-1.5 bg-purple-100 rounded">
          <Layers size={16} className="text-purple-600" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-xs text-gray-500">Schema</div>
          <div className="text-sm font-medium text-gray-900 truncate">
            {schema || 'Select schema'}
          </div>
        </div>
        <ChevronRight size={16} className="text-gray-300" />
      </button>
    </div>
  );
}

// Table row in the tree with hover preview
function TableRow({ 
  table, 
  isExpanded, 
  isLoading, 
  onToggle, 
  onInsert,
  onViewTable,
  onCopyName,
  columnCount,
  columns = [],
  database,
  schema
}) {
  const isView = table.kind === 'VIEW';
  const rowRef = useRef(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewPosition, setPreviewPosition] = useState({ top: 0, left: 0 });
  const hoverTimeout = useRef(null);
  
  const handleMouseEnter = useCallback(() => {
    console.log('[TableRow] mouseEnter:', table.name);
    // Delay showing preview to avoid flickering on quick mouse movements
    hoverTimeout.current = setTimeout(() => {
      console.log('[TableRow] hover timeout fired for:', table.name);
      if (rowRef.current) {
        const rect = rowRef.current.getBoundingClientRect();
        console.log('[TableRow] rect:', { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom });
        // Position to the right of the row, slightly overlapping
        const pos = {
          top: Math.min(rect.top, window.innerHeight - 320), // Keep within viewport
          left: rect.right + 8,
        };
        console.log('[TableRow] setting preview position:', pos);
        setPreviewPosition(pos);
        setShowPreview(true);
        console.log('[TableRow] showPreview set to true');
      } else {
        console.log('[TableRow] rowRef.current is null!');
      }
    }, 400); // 400ms delay before showing
  }, [table.name]);
  
  const handleMouseLeave = useCallback(() => {
    console.log('[TableRow] mouseLeave:', table.name);
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current);
      console.log('[TableRow] cleared hover timeout');
    }
    // Small delay before hiding to allow moving to the preview
    setTimeout(() => {
      console.log('[TableRow] hiding preview for:', table.name);
      setShowPreview(false);
    }, 100);
  }, [table.name]);
  
  // Log state changes
  useEffect(() => {
    console.log('[TableRow] showPreview changed:', showPreview, 'for table:', table.name);
  }, [showPreview, table.name]);
  
  return (
    <>
      <div 
        ref={rowRef}
        className="flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50 cursor-pointer group border-b border-gray-50"
        onClick={onToggle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <button 
          className="p-0.5 hover:bg-gray-200 rounded"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          {isLoading ? (
            <Loader2 size={14} className="text-gray-400 animate-spin" />
          ) : isExpanded ? (
            <ChevronDown size={14} className="text-gray-400" />
          ) : (
            <ChevronRight size={14} className="text-gray-400" />
          )}
        </button>
        
        {isView ? (
          <Eye size={14} className="text-amber-500 flex-shrink-0" />
        ) : (
          <Table2 size={14} className="text-emerald-500 flex-shrink-0" />
        )}
        
        <span className="text-sm text-gray-800 truncate flex-1 font-medium">
          {table.name}
        </span>
        
        {/* Column count badge */}
        {columnCount !== undefined && (
          <span className="text-xs text-gray-400 tabular-nums">
            {columnCount}
          </span>
        )}
        
        {/* Insert button on hover */}
        <button 
          className="opacity-0 group-hover:opacity-100 text-xs text-blue-500 hover:text-blue-700 px-1.5 py-0.5 bg-blue-50 rounded transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onInsert();
          }}
        >
          + Insert
        </button>
      </div>
      
      {/* Hover Preview Portal */}
      {showPreview && console.log('[TableRow] Rendering TableHoverPreview for:', table.name)}
      {showPreview && (
        <TableHoverPreview
          table={table}
          database={database}
          schema={schema}
          columns={columns}
          columnCount={columnCount || columns.length}
          rowCount={table.row_count || table.rows}
          position={previewPosition}
          onViewTable={() => {
            setShowPreview(false);
            onViewTable?.();
          }}
          onCopyName={(name) => {
            onCopyName?.(name);
            setShowPreview(false);
          }}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  );
}

// Column row in the tree
function ColumnRow({ column, onInsert }) {
  const dataType = column.data_type || column.type || 'UNKNOWN';
  const formattedType = formatDataType(dataType);
  
  return (
    <div 
      className="flex items-center gap-2 pl-10 pr-3 py-1 hover:bg-gray-50 cursor-pointer group"
      onClick={() => onInsert(column.name)}
    >
      <TypeIcon dataType={dataType} />
      
      <span className="text-sm text-gray-700 truncate flex-1">
        {column.name}
      </span>
      
      <span className="text-xs text-gray-400 font-mono">
        {formattedType}
      </span>
    </div>
  );
}

// Search/Filter bar
function SearchBar({ value, onChange, placeholder }) {
  return (
    <div className="px-3 py-2 border-b border-gray-200">
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {value && (
          <button 
            onClick={() => onChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function SchemaExplorer({ 
  onInsertText, 
  onViewTable,
  defaultDatabase, 
  defaultSchema,
  isConnected,
  connectionName = 'snowflake'
}) {
  const { fetchDatabases, fetchSchemas, fetchTables, fetchColumns, refreshCache, loading } = useMetadata();
  
  const [selectedDatabase, setSelectedDatabase] = useState(defaultDatabase || '');
  const [selectedSchema, setSelectedSchema] = useState(defaultSchema || '');
  const [databases, setDatabases] = useState([]);
  const [schemas, setSchemas] = useState([]);
  const [tables, setTables] = useState([]);
  const [columns, setColumns] = useState({});
  const [expanded, setExpanded] = useState({});
  const [loadingNodes, setLoadingNodes] = useState({});
  const [searchFilter, setSearchFilter] = useState('');
  const [showDatabasePicker, setShowDatabasePicker] = useState(false);
  const [showSchemaPicker, setShowSchemaPicker] = useState(false);
  const [copiedName, setCopiedName] = useState(null);
  
  // Load databases on mount
  useEffect(() => {
    if (isConnected) {
      loadDatabases();
    }
  }, [isConnected]);
  
  // Update from props
  useEffect(() => {
    if (defaultDatabase && defaultDatabase !== selectedDatabase) {
      setSelectedDatabase(defaultDatabase);
    }
  }, [defaultDatabase]);
  
  useEffect(() => {
    if (defaultSchema && defaultSchema !== selectedSchema) {
      setSelectedSchema(defaultSchema);
    }
  }, [defaultSchema]);
  
  // Load schemas when database changes
  useEffect(() => {
    if (selectedDatabase) {
      loadSchemas(selectedDatabase);
    }
  }, [selectedDatabase]);
  
  // Load tables when schema changes
  useEffect(() => {
    if (selectedDatabase && selectedSchema) {
      loadTables(selectedDatabase, selectedSchema);
    }
  }, [selectedDatabase, selectedSchema]);
  
  const loadDatabases = async () => {
    const data = await fetchDatabases();
    setDatabases(data || []);
  };
  
  const loadSchemas = async (db) => {
    const data = await fetchSchemas(db);
    setSchemas(data || []);
  };
  
  const loadTables = async (db, schema) => {
    const data = await fetchTables(db, schema);
    setTables(data || []);
  };
  
  const toggleTable = async (tableName) => {
    const key = `table:${tableName}`;
    
    if (expanded[key]) {
      setExpanded(prev => ({ ...prev, [key]: false }));
      return;
    }
    
    // Load columns if not already loaded
    if (!columns[tableName]) {
      setLoadingNodes(prev => ({ ...prev, [key]: true }));
      const columnList = await fetchColumns(selectedDatabase, selectedSchema, tableName);
      setColumns(prev => ({ ...prev, [tableName]: columnList || [] }));
      setLoadingNodes(prev => ({ ...prev, [key]: false }));
    }
    
    setExpanded(prev => ({ ...prev, [key]: true }));
  };
  
  const handleRefresh = async () => {
    await refreshCache();
    setColumns({});
    setExpanded({});
    if (selectedDatabase && selectedSchema) {
      await loadTables(selectedDatabase, selectedSchema);
    }
  };
  
  /**
   * Insert text into the editor
   * For tables, we build a fully qualified name (FQN) using buildSafeFQN
   * For columns, we just insert the column name
   */
  const insertText = (text, isTable = false) => {
    if (isTable && selectedDatabase && selectedSchema) {
      // Build FQN for tables using the safe helper
      const fqn = buildSafeFQN(selectedDatabase, selectedSchema, text);
      onInsertText?.(fqn || text);
    } else {
      // For columns, just insert the name
      onInsertText?.(text);
    }
  };
  
  /**
   * Handle "View Table" action from preview
   * Generates a SELECT * FROM query and optionally triggers execution
   */
  const handleViewTable = useCallback((tableName) => {
    const fqn = buildSafeFQN(selectedDatabase, selectedSchema, tableName);
    const query = `SELECT * FROM ${fqn} LIMIT 100;`;
    
    // If parent provides onViewTable, use it (can trigger immediate execution)
    if (onViewTable) {
      onViewTable({ 
        tableName, 
        database: selectedDatabase, 
        schema: selectedSchema, 
        fqn, 
        query 
      });
    } else {
      // Fallback: just insert the query
      onInsertText?.(query);
    }
  }, [selectedDatabase, selectedSchema, onViewTable, onInsertText]);
  
  /**
   * Copy fully qualified name to clipboard
   */
  const handleCopyName = useCallback(async (name) => {
    try {
      await navigator.clipboard.writeText(name);
      setCopiedName(name);
      setTimeout(() => setCopiedName(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);
  
  // Filter tables based on search
  const filteredTables = useMemo(() => {
    if (!searchFilter) return tables;
    const filter = searchFilter.toLowerCase();
    return tables.filter(t => t.name.toLowerCase().includes(filter));
  }, [tables, searchFilter]);
  
  // Group tables by type (tables vs views)
  const { regularTables, views } = useMemo(() => {
    const regular = filteredTables.filter(t => t.kind !== 'VIEW');
    const v = filteredTables.filter(t => t.kind === 'VIEW');
    return { regularTables: regular, views: v };
  }, [filteredTables]);
  
  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-200">
      {/* Context Header */}
      <ContextHeader
        connectionName={connectionName}
        database={selectedDatabase}
        schema={selectedSchema}
        onDatabaseClick={() => setShowDatabasePicker(!showDatabasePicker)}
        onSchemaClick={() => setShowSchemaPicker(!showSchemaPicker)}
      />
      
      {/* Database Picker Dropdown */}
      {showDatabasePicker && (
        <div className="border-b border-gray-200 bg-gray-50 max-h-48 overflow-y-auto">
          {databases.map(db => (
            <button
              key={db.name}
              onClick={() => {
                setSelectedDatabase(db.name);
                setSelectedSchema('');
                setTables([]);
                setShowDatabasePicker(false);
              }}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-blue-50 ${
                selectedDatabase === db.name ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
              }`}
            >
              {db.name}
            </button>
          ))}
        </div>
      )}
      
      {/* Schema Picker Dropdown */}
      {showSchemaPicker && selectedDatabase && (
        <div className="border-b border-gray-200 bg-gray-50 max-h-48 overflow-y-auto">
          {schemas.map(schema => (
            <button
              key={schema.name}
              onClick={() => {
                setSelectedSchema(schema.name);
                setShowSchemaPicker(false);
              }}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-blue-50 ${
                selectedSchema === schema.name ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
              }`}
            >
              {schema.name}
            </button>
          ))}
        </div>
      )}
      
      {/* Search Filter */}
      {tables.length > 0 && (
        <SearchBar
          value={searchFilter}
          onChange={setSearchFilter}
          placeholder="Filter tables..."
        />
      )}
      
      {/* Refresh Button & Stats */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
        <span className="text-xs text-gray-500">
          {tables.length} tables {searchFilter && `(${filteredTables.length} shown)`}
        </span>
        <button 
          onClick={handleRefresh}
          className="p-1.5 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-700"
          title="Refresh metadata"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      
      {/* Tables & Columns Tree */}
      <div className="flex-1 overflow-y-auto">
        {!selectedDatabase || !selectedSchema ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            <Database size={32} className="mx-auto mb-2 opacity-50" />
            <p>Select a database and schema</p>
            <p className="text-xs mt-1">to browse tables and columns</p>
          </div>
        ) : tables.length === 0 && !loading ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            <Table2 size={32} className="mx-auto mb-2 opacity-50" />
            <p>No tables found</p>
            <p className="text-xs mt-1">in {selectedDatabase}.{selectedSchema}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {/* Regular Tables */}
            {regularTables.map(table => (
              <div key={table.name}>
                <TableRow
                  table={table}
                  database={selectedDatabase}
                  schema={selectedSchema}
                  isExpanded={expanded[`table:${table.name}`]}
                  isLoading={loadingNodes[`table:${table.name}`]}
                  onToggle={() => toggleTable(table.name)}
                  onInsert={() => insertText(table.name, true)}
                  onViewTable={() => handleViewTable(table.name)}
                  onCopyName={handleCopyName}
                  columnCount={columns[table.name]?.length}
                  columns={columns[table.name] || []}
                />
                
                {/* Columns */}
                {expanded[`table:${table.name}`] && columns[table.name] && (
                  <div className="bg-gray-50/50">
                    {columns[table.name].map(col => (
                      <ColumnRow
                        key={col.name}
                        column={col}
                        onInsert={insertText}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
            
            {/* Views section */}
            {views.length > 0 && (
              <>
                <div className="px-3 py-1.5 bg-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Views ({views.length})
                </div>
                {views.map(view => (
                  <div key={view.name}>
                    <TableRow
                      table={view}
                      database={selectedDatabase}
                      schema={selectedSchema}
                      isExpanded={expanded[`table:${view.name}`]}
                      isLoading={loadingNodes[`table:${view.name}`]}
                      onToggle={() => toggleTable(view.name)}
                      onInsert={() => insertText(view.name, true)}
                      onViewTable={() => handleViewTable(view.name)}
                      onCopyName={handleCopyName}
                      columnCount={columns[view.name]?.length}
                      columns={columns[view.name] || []}
                    />
                    
                    {expanded[`table:${view.name}`] && columns[view.name] && (
                      <div className="bg-gray-50/50">
                        {columns[view.name].map(col => (
                          <ColumnRow
                            key={col.name}
                            column={col}
                            onInsert={insertText}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
      
      {/* Copy toast notification */}
      {copiedName && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg flex items-center gap-2 animate-fade-in-up">
          <Copy size={14} className="text-emerald-400" />
          <span>Copied to clipboard</span>
        </div>
      )}
    </div>
  );
}
