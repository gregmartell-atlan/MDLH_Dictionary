/**
 * Query Editor - Main component for SQL editing and execution
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { 
  Play, Square, Trash2, History, Settings, 
  Check, X, Loader2, Database, Clock,
  Wifi, WifiOff, PanelLeft, PanelLeftClose,
  ChevronDown, Layers, AlertTriangle, Lightbulb, Sparkles
} from 'lucide-react';
import SchemaExplorer from './SchemaExplorer';
import ResultsTable from './ResultsTable';
import ConnectionModal from './ConnectionModal';
import { useConnection, useQuery, useQueryHistory, useMetadata, usePreflight } from '../hooks/useSnowflake';

// Parse SQL to extract database/schema/table references
function parseSqlContext(sql) {
  if (!sql) return null;
  
  // Remove comments
  const cleanSql = sql
    .replace(/--[^\n]*/g, '')  // Single line comments
    .replace(/\/\*[\s\S]*?\*\//g, '');  // Block comments
  
  // Patterns for FROM/JOIN clauses
  const tablePatterns = [
    // Full: FROM database.schema.table
    /(?:FROM|JOIN)\s+([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)/gi,
    // Partial: FROM schema.table  
    /(?:FROM|JOIN)\s+([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)/gi,
    // Single: FROM table
    /(?:FROM|JOIN)\s+([A-Za-z_][A-Za-z0-9_]*)/gi
  ];
  
  const references = [];
  
  // Full database.schema.table
  let match;
  const fullPattern = /(?:FROM|JOIN)\s+([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)/gi;
  while ((match = fullPattern.exec(cleanSql)) !== null) {
    references.push({
      database: match[1].toUpperCase(),
      schema: match[2].toUpperCase(),
      table: match[3].toUpperCase(),
      full: `${match[1]}.${match[2]}.${match[3]}`.toUpperCase()
    });
  }
  
  // If we found full references, use the first one
  if (references.length > 0) {
    return references[0];
  }
  
  // Try partial schema.table (but skip if looks like db.schema from full match)
  const partialPattern = /(?:FROM|JOIN)\s+([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)(?!\.)/gi;
  while ((match = partialPattern.exec(cleanSql)) !== null) {
    // This could be database.table or schema.table - context dependent
    return {
      database: null, // Unknown - use default
      schema: match[1].toUpperCase(),
      table: match[2].toUpperCase(),
      partial: true
    };
  }
  
  // Try single table name
  const singlePattern = /(?:FROM|JOIN)\s+([A-Za-z_][A-Za-z0-9_]*)(?!\.)/gi;
  while ((match = singlePattern.exec(cleanSql)) !== null) {
    // Skip if it's a keyword
    const tableName = match[1].toUpperCase();
    const keywords = ['SELECT', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'AS'];
    if (!keywords.includes(tableName)) {
      return {
        database: null,
        schema: null, 
        table: tableName
      };
    }
  }
  
  return null;
}

function ConnectionBadge({ status, onConnect, loading }) {
  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs">
        <Loader2 size={12} className="animate-spin" />
        Connecting...
      </div>
    );
  }
  
  if (!status || !status.connected) {
    return (
      <button 
        onClick={onConnect}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs hover:bg-amber-100 font-medium"
      >
        <Database size={12} />
        Configure Connection
      </button>
    );
  }
  
  return (
    <button 
      onClick={onConnect}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-xs hover:bg-green-100"
      title="Click to reconfigure"
    >
      <Wifi size={12} />
      <span>{status.warehouse || 'Connected'}</span>
    </button>
  );
}

// Database/Schema Selector Dropdown
function ContextSelector({ 
  label, 
  icon: Icon, 
  value, 
  options, 
  onChange, 
  loading,
  placeholder = 'Select...'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm hover:border-gray-300 hover:bg-gray-50 min-w-[140px]"
      >
        <Icon size={14} className="text-gray-500" />
        <span className="truncate max-w-[120px] text-gray-700">
          {value || placeholder}
        </span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-80 overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {label}
            </div>
          </div>
          
          <div className="overflow-y-auto max-h-64">
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 size={16} className="animate-spin text-gray-400" />
              </div>
            ) : options.length === 0 ? (
              <div className="text-center py-4 text-gray-400 text-sm">
                No options available
              </div>
            ) : (
              options.map((option) => (
                <button
                  key={option.name}
                  onClick={() => {
                    onChange(option.name);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-blue-50 ${
                    value === option.name ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                  }`}
                >
                  <Icon size={14} className={value === option.name ? 'text-blue-500' : 'text-gray-400'} />
                  <span className="truncate">{option.name}</span>
                  {value === option.name && (
                    <Check size={14} className="ml-auto text-blue-500" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function QueryHistoryPanel({ isOpen, onClose, history, onSelectQuery, onRefresh, loading }) {
  if (!isOpen) return null;
  
  return (
    <div className="absolute right-0 top-full mt-2 w-96 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-96 overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-700">Query History</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>
      
      <div className="overflow-y-auto max-h-80">
        {history.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            No query history yet
          </div>
        ) : (
          history.map((item, i) => (
            <div 
              key={item.query_id}
              className="p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
              onClick={() => onSelectQuery(item.sql)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  item.status === 'SUCCESS' ? 'bg-green-100 text-green-700' :
                  item.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {item.status}
                </span>
                <span className="text-xs text-gray-400">
                  {item.row_count !== null && `${item.row_count} rows`}
                </span>
              </div>
              <code className="text-xs text-gray-600 line-clamp-2 block mt-1">
                {item.sql}
              </code>
              {item.duration_ms && (
                <span className="text-xs text-gray-400 mt-1 block">
                  {(item.duration_ms / 1000).toFixed(2)}s
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Preflight Warning Panel - shown when preflight finds issues
function PreflightWarningPanel({ 
  preflightResult, 
  loading,
  onUseSuggested, 
  onExecuteAnyway, 
  onDismiss 
}) {
  if (loading) {
    return (
      <div className="p-4 bg-blue-50 border-b border-blue-200">
        <div className="flex items-center gap-2 text-blue-600">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm font-medium">Checking query...</span>
        </div>
      </div>
    );
  }
  
  if (!preflightResult || preflightResult.valid) return null;
  
  const { issues, suggestions, suggested_query, tables_checked } = preflightResult;
  
  return (
    <div className="p-4 bg-amber-50 border-b border-amber-200">
      <div className="flex items-start gap-3">
        <AlertTriangle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
        
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-amber-800 mb-2">Query Issues Detected</h4>
          
          {/* Issues list */}
          <ul className="text-sm text-amber-700 space-y-1 mb-3">
            {issues?.map((issue, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-amber-400">•</span>
                <span>{issue}</span>
              </li>
            ))}
          </ul>
          
          {/* Suggestions */}
          {suggestions?.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center gap-1.5 text-sm font-medium text-amber-800 mb-2">
                <Lightbulb size={14} />
                <span>Tables with data you can query:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestions.slice(0, 8).map((s, i) => (
                  <span 
                    key={i}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded border border-amber-200 text-xs"
                    title={s.reason}
                  >
                    <Database size={12} className="text-amber-500" />
                    <span className="font-mono text-amber-700">{s.table_name}</span>
                    {s.row_count > 0 && (
                      <span className="text-amber-500">({s.row_count.toLocaleString()} rows)</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Suggested query */}
          {suggested_query && (
            <div className="bg-white rounded-lg border border-amber-200 p-3 mb-3">
              <div className="flex items-center gap-1.5 text-sm font-medium text-green-700 mb-2">
                <Sparkles size={14} />
                <span>Suggested query that will return results:</span>
              </div>
              <pre className="text-xs text-gray-700 bg-gray-50 p-2 rounded overflow-x-auto max-h-24">
                {suggested_query.substring(0, 500)}{suggested_query.length > 500 ? '...' : ''}
              </pre>
            </div>
          )}
          
          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-3">
            {suggested_query && (
              <button
                onClick={onUseSuggested}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium"
              >
                <Sparkles size={14} />
                Run Suggested Query
              </button>
            )}
            <button
              onClick={onExecuteAnyway}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded text-sm font-medium"
            >
              <Play size={14} />
              Run Anyway
            </button>
            <button
              onClick={onDismiss}
              className="px-3 py-1.5 text-gray-600 hover:text-gray-800 text-sm"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function QueryEditor({ initialQuery = '', onClose }) {
  const editorRef = useRef(null);
  const [sql, setSql] = useState(initialQuery);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  
  // Database/Schema context state
  const [selectedDatabase, setSelectedDatabase] = useState('');
  const [selectedSchema, setSelectedSchema] = useState('');
  const [databases, setDatabases] = useState([]);
  const [schemas, setSchemas] = useState([]);
  const [loadingDatabases, setLoadingDatabases] = useState(false);
  const [loadingSchemas, setLoadingSchemas] = useState(false);
  
  const { status: connStatus, testConnection, loading: connLoading } = useConnection();
  const { executeQuery, results, loading: queryLoading, error: queryError, clearResults } = useQuery();
  const { history, fetchHistory, loading: historyLoading } = useQueryHistory();
  const { fetchDatabases, fetchSchemas, fetchTables } = useMetadata();
  const { preflightResult, loading: preflightLoading, runPreflight, clearPreflight } = usePreflight();
  const [connectionStatus, setConnectionStatus] = useState(null);
  
  // State for error recovery / alternative suggestions
  const [alternatives, setAlternatives] = useState(null);
  const [alternativesLoading, setAlternativesLoading] = useState(false);
  
  // State for preflight warnings
  const [showPreflightWarning, setShowPreflightWarning] = useState(false);
  
  // Load databases when connected
  const loadDatabases = useCallback(async () => {
    setLoadingDatabases(true);
    try {
      const dbs = await fetchDatabases();
      setDatabases(dbs || []);
    } catch (err) {
      console.error('Failed to load databases:', err);
    } finally {
      setLoadingDatabases(false);
    }
  }, [fetchDatabases]);
  
  // Load schemas when database changes
  const loadSchemas = useCallback(async (database) => {
    if (!database) {
      setSchemas([]);
      return;
    }
    setLoadingSchemas(true);
    try {
      const schemaList = await fetchSchemas(database);
      setSchemas(schemaList || []);
    } catch (err) {
      console.error('Failed to load schemas:', err);
    } finally {
      setLoadingSchemas(false);
    }
  }, [fetchSchemas]);
  
  // Handle database selection
  const handleDatabaseChange = useCallback((database) => {
    setSelectedDatabase(database);
    setSelectedSchema(''); // Reset schema when database changes
    loadSchemas(database);
  }, [loadSchemas]);
  
  // Try to connect on mount (will fail gracefully if no env config)
  useEffect(() => {
    testConnection().then(status => {
      setConnectionStatus(status);
      // If not connected, show modal automatically
      if (!status?.connected) {
        setShowConnectionModal(true);
      } else {
        // Load databases if connected
        loadDatabases();
        // Set default database/schema from connection
        if (status?.database) {
          setSelectedDatabase(status.database);
          loadSchemas(status.database);
        }
        if (status?.schema) {
          setSelectedSchema(status.schema);
        }
      }
    });
    fetchHistory();
  }, []);
  
  // Handle successful connection from modal
  const handleConnectionSuccess = (status) => {
    setConnectionStatus(status);
    setShowConnectionModal(false);
    
    // Load databases after successful connection
    loadDatabases();
    
    // Set default database/schema from connection
    if (status?.database) {
      setSelectedDatabase(status.database);
      loadSchemas(status.database);
    }
    if (status?.schema) {
      setSelectedSchema(status.schema);
    }
  };
  
  // Update SQL when initialQuery changes
  useEffect(() => {
    if (initialQuery) {
      setSql(initialQuery);
    }
  }, [initialQuery]);
  
  // Handle editor mount
  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    
    // Add keyboard shortcut for execute
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleExecute();
    });
    
    // Focus editor
    editor.focus();
  };
  
  // Run preflight check on query
  const handlePreflight = useCallback(async (queryText) => {
    const db = selectedDatabase || connStatus?.database;
    const schema = selectedSchema || connStatus?.schema;
    
    const result = await runPreflight(queryText, { database: db, schema });
    
    if (result && !result.valid && result.suggestions?.length > 0) {
      setShowPreflightWarning(true);
    }
    
    return result;
  }, [selectedDatabase, selectedSchema, connStatus, runPreflight]);
  
  // Execute query with optional preflight
  const handleExecute = useCallback(async (skipPreflight = false) => {
    const queryText = sql.trim();
    if (!queryText) return;
    
    // Clear previous state
    setAlternatives(null);
    clearPreflight();
    setShowPreflightWarning(false);
    
    // Run preflight check first (unless skipped)
    if (!skipPreflight) {
      const preflight = await handlePreflight(queryText);
      
      // If preflight found issues and has suggestions, show warning instead of executing
      if (preflight && !preflight.valid && preflight.suggested_query) {
        console.log('[Query] Preflight found issues, showing suggestions');
        setShowPreflightWarning(true);
        return; // Don't execute, let user review suggestions
      }
    }
    
    // Use selected database/schema, fallback to connection defaults
    await executeQuery(queryText, {
      database: selectedDatabase || connStatus?.database,
      schema: selectedSchema || connStatus?.schema,
      warehouse: connStatus?.warehouse
    });
    
    // Refresh history after execution
    fetchHistory();
  }, [sql, selectedDatabase, selectedSchema, connStatus, executeQuery, fetchHistory, handlePreflight, clearPreflight]);
  
  // Execute the suggested query from preflight
  const handleExecuteSuggested = useCallback(async () => {
    if (preflightResult?.suggested_query) {
      setSql(preflightResult.suggested_query);
      setShowPreflightWarning(false);
      clearPreflight();
      
      // Execute the suggested query (skip preflight since we just ran it)
      setTimeout(async () => {
        await executeQuery(preflightResult.suggested_query, {
          database: selectedDatabase || connStatus?.database,
          schema: selectedSchema || connStatus?.schema,
          warehouse: connStatus?.warehouse
        });
        fetchHistory();
      }, 100);
    }
  }, [preflightResult, selectedDatabase, selectedSchema, connStatus, executeQuery, fetchHistory, clearPreflight]);
  
  // Force execute anyway (ignore preflight warnings)
  const handleExecuteAnyway = useCallback(async () => {
    setShowPreflightWarning(false);
    clearPreflight();
    
    await executeQuery(sql.trim(), {
      database: selectedDatabase || connStatus?.database,
      schema: selectedSchema || connStatus?.schema,
      warehouse: connStatus?.warehouse
    });
    
    fetchHistory();
  }, [sql, selectedDatabase, selectedSchema, connStatus, executeQuery, fetchHistory, clearPreflight]);
  
  // Search for alternative tables when query fails
  // Dynamically parses the SQL to extract database/schema context
  const handleSearchAlternatives = useCallback(async (objectName, objectType = 'table') => {
    setAlternativesLoading(true);
    setAlternatives(null);
    
    try {
      // Parse SQL to extract the actual database/schema being referenced
      const sqlContext = parseSqlContext(sql);
      console.log('[Alternatives] Parsed SQL context:', sqlContext);
      
      // Priority: SQL context > selected values > connection defaults
      let db = sqlContext?.database || selectedDatabase || connStatus?.database;
      let schema = sqlContext?.schema || selectedSchema || connStatus?.schema;
      
      // Special handling: if we found a partial reference (schema.table),
      // the "schema" might actually be a database name
      if (sqlContext?.partial && !sqlContext.database) {
        // Try fetching from this as if it were a database first
        const schemasInPotentialDb = await fetchSchemas(sqlContext.schema);
        if (schemasInPotentialDb && schemasInPotentialDb.length > 0) {
          // It's a database! Use the default schema
          db = sqlContext.schema;
          schema = 'PUBLIC'; // Default to PUBLIC
          console.log(`[Alternatives] Detected ${sqlContext.schema} as database, using schema PUBLIC`);
        }
      }
      
      console.log(`[Alternatives] Searching in ${db}.${schema} for tables like "${objectName}"`);
      
      // Fetch all tables in the determined schema
      const tables = await fetchTables(db, schema);
      
      if (!tables || tables.length === 0) {
        console.log(`[Alternatives] No tables found in ${db}.${schema}`);
        setAlternatives([]);
        return;
      }
      
      console.log(`[Alternatives] Found ${tables.length} tables in ${db}.${schema}`);
      
      // Filter to find similar tables
      const searchTerm = objectName.toUpperCase()
        .replace('_ENTITY', '')
        .replace('ATLAS', '')
        .replace(/_/g, ''); // Remove underscores for flexible matching
      
      const similar = tables
        .map(t => t.name || t)
        .filter(name => {
          const upperName = name.toUpperCase();
          const cleanName = upperName.replace(/_ENTITY/, '').replace(/_/g, '');
          
          // Exact match (table exists - shouldn't happen)
          if (upperName === objectName.toUpperCase()) return false;
          
          // Contains the key search term
          if (cleanName.includes(searchTerm) || searchTerm.includes(cleanName)) return true;
          
          // Fuzzy: shares significant substring
          if (searchTerm.length > 3) {
            for (let i = 0; i <= searchTerm.length - 3; i++) {
              if (cleanName.includes(searchTerm.substring(i, i + 3))) return true;
            }
          }
          
          return false;
        })
        .sort((a, b) => {
          // Prioritize exact base name matches
          const aClean = a.toUpperCase().replace('_ENTITY', '').replace(/_/g, '');
          const bClean = b.toUpperCase().replace('_ENTITY', '').replace(/_/g, '');
          
          // Exact match scores highest
          if (aClean === searchTerm) return -1;
          if (bClean === searchTerm) return 1;
          
          // Then starts with
          if (aClean.startsWith(searchTerm) && !bClean.startsWith(searchTerm)) return -1;
          if (bClean.startsWith(searchTerm) && !aClean.startsWith(searchTerm)) return 1;
          
          // Then shorter names
          return a.length - b.length;
        })
        .slice(0, 15); // Limit results
      
      // Store context for replacement
      setAlternatives({
        suggestions: similar,
        context: { database: db, schema: schema },
        originalObject: objectName
      });
    } catch (err) {
      console.error('Failed to search alternatives:', err);
      setAlternatives({ suggestions: [], error: err.message });
    } finally {
      setAlternativesLoading(false);
    }
  }, [sql, selectedDatabase, selectedSchema, connStatus, fetchTables, fetchSchemas]);
  
  // Select an alternative and re-run the query
  const handleSelectAlternative = useCallback((alternativeTable, originalTable) => {
    // Get context from alternatives (parsed from failed SQL) or fall back to defaults
    const ctx = alternatives?.context || {};
    const db = ctx.database || selectedDatabase || connStatus?.database;
    const schema = ctx.schema || selectedSchema || connStatus?.schema;
    const origTable = originalTable || alternatives?.originalObject;
    
    console.log(`[Alternative] Replacing "${origTable}" with "${alternativeTable}" in ${db}.${schema}`);
    
    // Build the fully qualified replacement
    const fullyQualified = `${db}.${schema}.${alternativeTable}`;
    
    // Create regex patterns to find and replace the table name
    // Order matters: match most specific patterns first
    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escaped = escapeRegex(origTable);
    
    let newSql = sql;
    
    // Pattern 1: full reference (db.schema.table)
    const fullPattern = new RegExp(
      `(FROM|JOIN)\\s+[A-Za-z_][A-Za-z0-9_]*\\.[A-Za-z_][A-Za-z0-9_]*\\.${escaped}\\b`,
      'gi'
    );
    newSql = newSql.replace(fullPattern, `$1 ${fullyQualified}`);
    
    // Pattern 2: partial reference (schema.table or db.table)
    const partialPattern = new RegExp(
      `(FROM|JOIN)\\s+[A-Za-z_][A-Za-z0-9_]*\\.${escaped}\\b`,
      'gi'
    );
    newSql = newSql.replace(partialPattern, `$1 ${fullyQualified}`);
    
    // Pattern 3: bare table name
    const barePattern = new RegExp(
      `(FROM|JOIN)\\s+${escaped}\\b`,
      'gi'
    );
    newSql = newSql.replace(barePattern, `$1 ${fullyQualified}`);
    
    console.log('[Alternative] New SQL:', newSql.substring(0, 200));
    
    // Update SQL and execute
    setSql(newSql);
    setAlternatives(null);
    
    // Execute with slight delay to let state update
    setTimeout(() => {
      executeQuery(newSql, {
        database: db,
        schema: schema,
        warehouse: connStatus?.warehouse
      });
      fetchHistory();
    }, 100);
  }, [sql, alternatives, selectedDatabase, selectedSchema, connStatus, executeQuery, fetchHistory]);
  
  // Insert text at cursor
  const handleInsertText = useCallback((text) => {
    if (editorRef.current) {
      const editor = editorRef.current;
      const selection = editor.getSelection();
      const id = { major: 1, minor: 1 };
      const op = {
        identifier: id,
        range: selection,
        text: text,
        forceMoveMarkers: true
      };
      editor.executeEdits("insertText", [op]);
      editor.focus();
    }
  }, []);
  
  // Clear editor
  const handleClear = () => {
    setSql('');
    clearResults();
    editorRef.current?.focus();
  };
  
  // Load query from history
  const handleSelectHistoryQuery = (query) => {
    setSql(query);
    setShowHistory(false);
    editorRef.current?.focus();
  };
  
  return (
    <div className="flex flex-col h-[calc(100vh-300px)] min-h-[500px] bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-2 hover:bg-gray-200 rounded text-gray-500"
            title={showSidebar ? 'Hide schema browser' : 'Show schema browser'}
          >
            {showSidebar ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
          </button>
          
          <div className="h-4 w-px bg-gray-300" />
          
          <button
            onClick={handleExecute}
            disabled={queryLoading || !sql.trim()}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#3366FF] hover:bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {queryLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            Run
          </button>
          
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-200 text-gray-600 rounded text-sm"
          >
            <Trash2 size={14} />
            Clear
          </button>
          
          <div className="relative">
            <button
              onClick={() => {
                setShowHistory(!showHistory);
                if (!showHistory) fetchHistory();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-200 text-gray-600 rounded text-sm"
            >
              <History size={14} />
              History
            </button>
            
            <QueryHistoryPanel
              isOpen={showHistory}
              onClose={() => setShowHistory(false)}
              history={history}
              onSelectQuery={handleSelectHistoryQuery}
              onRefresh={fetchHistory}
              loading={historyLoading}
            />
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Database Selector */}
          <ContextSelector
            label="Databases"
            icon={Database}
            value={selectedDatabase}
            options={databases}
            onChange={handleDatabaseChange}
            loading={loadingDatabases}
            placeholder="Database"
          />
          
          {/* Schema Selector */}
          <ContextSelector
            label="Schemas"
            icon={Layers}
            value={selectedSchema}
            options={schemas}
            onChange={setSelectedSchema}
            loading={loadingSchemas}
            placeholder="Schema"
          />
          
          <div className="h-4 w-px bg-gray-300" />
          
          <ConnectionBadge 
            status={connectionStatus} 
            onConnect={() => setShowConnectionModal(true)} 
            loading={connLoading}
          />
          
          <span className="text-xs text-gray-400">
            ⌘+Enter to run
          </span>
        </div>
      </div>
      
      {/* Connection Modal */}
      <ConnectionModal
        isOpen={showConnectionModal}
        onClose={() => setShowConnectionModal(false)}
        onConnect={handleConnectionSuccess}
        currentStatus={connectionStatus}
      />
      
      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Schema Browser */}
        {showSidebar && (
          <div className="w-64 flex-shrink-0 border-r border-gray-200">
            <SchemaExplorer 
              onInsertText={handleInsertText}
              defaultDatabase={connStatus?.database}
              isConnected={connectionStatus?.connected}
            />
          </div>
        )}
        
        {/* Editor + Results */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* SQL Editor */}
          <div className="h-1/2 border-b border-gray-200">
            <Editor
              height="100%"
              defaultLanguage="sql"
              value={sql}
              onChange={(value) => setSql(value || '')}
              onMount={handleEditorMount}
              theme="vs"
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                automaticLayout: true,
                tabSize: 2,
                padding: { top: 10 },
                suggestOnTriggerCharacters: true,
              }}
            />
          </div>
          
          {/* Results */}
          <div className="h-1/2 overflow-hidden flex flex-col">
            {/* Preflight Warning */}
            {(showPreflightWarning || preflightLoading) && (
              <PreflightWarningPanel
                preflightResult={preflightResult}
                loading={preflightLoading}
                onUseSuggested={handleExecuteSuggested}
                onExecuteAnyway={handleExecuteAnyway}
                onDismiss={() => {
                  setShowPreflightWarning(false);
                  clearPreflight();
                }}
              />
            )}
            
            {/* Results Table */}
            <div className="flex-1 overflow-hidden">
              <ResultsTable
                results={results}
                loading={queryLoading}
                error={queryError}
                onSearchAlternatives={handleSearchAlternatives}
                onSelectAlternative={handleSelectAlternative}
                alternatives={alternatives}
                alternativesLoading={alternativesLoading}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

