/**
 * FlyoutQueryEditor - Embedded SQL editor for the flyout panel
 * 
 * A compact SQL editor with execution capabilities that can be
 * embedded within the QueryPanel flyout for testing queries inline.
 * 
 * Features:
 * - Simplified 2-row header layout (can be hidden when used in TestQueryLayout)
 * - Unsaved changes tracking with callback
 * - Collapsible SQL editor
 * - Compact results table
 * - Smart query suggestions with auto-fix chips
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { 
  Play, X, Loader2, Check, AlertCircle, ChevronDown, ChevronRight,
  Copy, Database, Clock, RotateCcw, Maximize2, WifiOff, Snowflake, Trash2,
  Sparkles, Zap, GitBranch
} from 'lucide-react';
import { useQuery, useConnection, useMetadata } from '../hooks/useSnowflake';
import { createLogger } from '../utils/logger';
import { 
  getSuggestionsFromError, 
  buildSchemaCache,
  getProactiveSuggestions 
} from '../utils/querySuggestions';
import {
  normalizeRows,
  extractColumnNames,
  getRowCount,
  getColumnCount,
  isEmptyResult,
  hasNoResult
} from '../utils/queryResultAdapter';
import { SuggestionList, QuickFixChip } from './SuggestionChips';
import { QueryFlowMenu, QuickFlowButtons } from './QueryFlowMenu';
import { buildEntityContext } from '../queryFlows';
import ResultFlowSuggestions from './ResultFlowSuggestions';
import StepWizard from './StepWizard';
import PlaceholderSuggestions from './PlaceholderSuggestions';

const log = createLogger('FlyoutQueryEditor');

// Parse SQL errors into friendly messages with missing table detection
function parseSqlError(error) {
  const errorStr = String(error);
  
  // Extract line number if present
  const lineMatch = errorStr.match(/line\s+(\d+)/i) || errorStr.match(/at\s+position.*?line\s+(\d+)/i);
  const line = lineMatch ? parseInt(lineMatch[1], 10) : null;
  
  // Extract missing table/object name from error
  let missingTable = null;
  const objectPatterns = [
    /Object\s+'([^']+)'\s+does not exist/i,
    /Table\s+'([^']+)'\s+does not exist/i,
    /relation\s+"([^"]+)"\s+does not exist/i,
    /Unknown table\s+'([^']+)'/i,
    /'([A-Z_]+_ENTITY)'\s+does not exist/i,
  ];
  
  for (const pattern of objectPatterns) {
    const match = errorStr.match(pattern);
    if (match) {
      missingTable = match[1];
      break;
    }
  }
  
  // Determine error type for better UI
  let errorType = 'generic';
  let suggestion = null;
  
  if (missingTable) {
    errorType = 'missing_table';
    suggestion = `Table "${missingTable}" doesn't exist. Run "SHOW TABLES;" to see available tables.`;
  } else {
    const typoPatterns = [
      { pattern: /syntax error.*?['"]?SELEC['"]?/i, suggestion: 'Did you mean SELECT?' },
      { pattern: /syntax error.*?['"]?FORM['"]?/i, suggestion: 'Did you mean FROM?' },
      { pattern: /syntax error.*?['"]?WEHERE['"]?/i, suggestion: 'Did you mean WHERE?' },
      { pattern: /syntax error.*?['"]?GRUOP['"]?/i, suggestion: 'Did you mean GROUP?' },
      { pattern: /syntax error.*?['"]?ODER['"]?/i, suggestion: 'Did you mean ORDER?' },
      { pattern: /unexpected end/i, suggestion: 'Query seems incomplete. Check for missing clauses.' },
      { pattern: /missing.*?from/i, suggestion: 'Add a FROM clause to specify the table.' },
      { pattern: /invalid identifier/i, suggestion: 'Column or table name not found. Check spelling.', type: 'invalid_identifier' },
      { pattern: /ambiguous.*?column/i, suggestion: 'Qualify the column with its table name (e.g., table.column).' },
      { pattern: /permission denied/i, suggestion: 'You don\'t have access to this object.', type: 'permission' },
      { pattern: /compilation error/i, suggestion: 'SQL syntax issue. Review the highlighted line.', type: 'syntax' },
      { pattern: /not authorized/i, suggestion: 'You don\'t have permission to access this object.', type: 'permission' },
    ];
    
    for (const { pattern, suggestion: sug, type } of typoPatterns) {
      if (pattern.test(errorStr)) {
        suggestion = sug;
        if (type) errorType = type;
        break;
      }
    }
  }
  
  let shortError = errorStr;
  if (shortError.length > 250) {
    const coreMatch = errorStr.match(/(?:error|failed):\s*(.{1,200})/i);
    if (coreMatch) {
      shortError = coreMatch[1] + '...';
    } else {
      shortError = errorStr.substring(0, 250) + '...';
    }
  }
  
  return { line, suggestion, shortError, fullError: errorStr, missingTable, errorType };
}

/**
 * CompactResultsTable - Flyout-optimized results display
 * 
 * Uses the adapter pattern to normalize rows ONCE via useMemo,
 * then accesses values by column name (not index) for reliability.
 * 
 * This fixes the "lol everything is null" bug that happens when
 * row arrays and column arrays get out of sync.
 */
function CompactResultsTable({ results, loading, error, suggestions = [], onApplySuggestion }) {
  // =========================================================================
  // ADAPTER LAYER: Normalize transport shape → render shape (once!)
  // =========================================================================
  const normalizedRows = useMemo(
    () => results ? normalizeRows(results) : [],
    [results]
  );
  
  const columnNames = useMemo(
    () => results ? extractColumnNames(results) : [],
    [results]
  );
  
  const rowCount = getRowCount(results);
  const columnCount = getColumnCount(results);
  
  // =========================================================================
  // Loading State
  // =========================================================================
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-blue-600">
        <Loader2 size={24} className="animate-spin mr-2" />
        <span className="text-sm font-medium">Executing query...</span>
      </div>
    );
  }

  // =========================================================================
  // Error State (with suggestions)
  // =========================================================================
  if (error) {
    const { line, suggestion, shortError, missingTable, errorType } = parseSqlError(error);
    
    const isMissingTable = errorType === 'missing_table';
    const bgColor = isMissingTable ? 'bg-amber-50' : 'bg-rose-50';
    const borderColor = isMissingTable ? 'border-amber-200' : 'border-rose-200';
    const iconBg = isMissingTable ? 'bg-amber-100' : 'bg-rose-100';
    const iconColor = isMissingTable ? 'text-amber-500' : 'text-rose-500';
    const textColor = isMissingTable ? 'text-amber-700' : 'text-rose-700';
    const subTextColor = isMissingTable ? 'text-amber-600' : 'text-rose-600';
    
    return (
      <div className="space-y-3">
        {/* Error Card */}
        <div className={`p-4 ${bgColor} border ${borderColor} rounded-xl`}>
          <div className="flex items-start gap-3">
            <div className={`p-1.5 ${iconBg} rounded-full flex-shrink-0`}>
              {isMissingTable ? (
                <Database size={16} className={iconColor} />
              ) : (
                <AlertCircle size={16} className={iconColor} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className={`font-medium ${textColor} text-sm`}>
                  {isMissingTable ? 'Table Not Found' : 'Query Error'}
                </p>
                {missingTable && (
                  <span className="text-xs px-2 py-0.5 bg-amber-200 text-amber-800 rounded font-mono">
                    {missingTable}
                  </span>
                )}
                {line && !missingTable && (
                  <span className="text-xs px-1.5 py-0.5 bg-rose-100 text-rose-600 rounded">
                    Line {line}
                  </span>
                )}
              </div>
              {suggestion && (
                <p className={`${subTextColor} text-sm mt-1.5 flex items-start gap-1.5`}>
                  <span className="flex-shrink-0">💡</span>
                  <span>{suggestion}</span>
                </p>
              )}
              
              {/* Quick fix chips for suggestions */}
              {suggestions.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium mb-2 flex items-center gap-1.5 opacity-80">
                    <Sparkles size={12} />
                    Try one of these tables instead:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.slice(0, 4).map((s, idx) => (
                      <QuickFixChip 
                        key={`${s.type}-${s.title}-${idx}`}
                        suggestion={s}
                        onApply={onApplySuggestion}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              <details className="mt-2">
                <summary className={`${subTextColor}/80 text-xs cursor-pointer hover:underline`}>
                  Show full error
                </summary>
                <p className={`${subTextColor}/70 text-xs mt-1 font-mono ${isMissingTable ? 'bg-amber-100/50' : 'bg-rose-100/50'} p-2 rounded break-words`}>
                  {shortError}
                </p>
              </details>
            </div>
          </div>
        </div>
        
        {/* Extended suggestions panel */}
        {suggestions.length > 4 && (
          <SuggestionList
            suggestions={suggestions.slice(4)}
            onApply={onApplySuggestion}
            title={`More suggestions (${suggestions.length - 4})`}
            layout="inline"
            maxVisible={6}
          />
        )}
      </div>
    );
  }

  // =========================================================================
  // No Results Yet State
  // =========================================================================
  if (hasNoResult(results)) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-400">
        <Database size={32} className="mb-2 opacity-50" />
        <p className="text-sm">Click "Run query" to execute</p>
        <p className="text-xs mt-1 text-gray-300">⌘+Enter for quick run</p>
      </div>
    );
  }

  // =========================================================================
  // Empty Results State (query succeeded but 0 rows)
  // =========================================================================
  if (isEmptyResult(results)) {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="flex items-start gap-2">
          <AlertCircle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-700 text-sm">Query returned no rows</p>
            <p className="text-amber-600 text-xs mt-1">
              The table may be empty or no rows match your query conditions.
            </p>
            {columnCount > 0 && (
              <p className="text-amber-600 text-xs mt-1">
                Columns found: {columnNames.slice(0, 5).join(', ')}
                {columnCount > 5 && ` +${columnCount - 5} more`}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // Data Table - Uses normalized rows (object access, not index access!)
  // =========================================================================
  const { executionTime } = results;
  const displayColumns = columnNames.slice(0, 8);
  const hasMoreColumns = columnNames.length > 8;

  return (
    <div>
      {/* Results header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Check size={12} className="text-green-500" />
            <strong className="text-gray-700">{rowCount.toLocaleString()}</strong> rows
          </span>
          {executionTime && (
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {(executionTime / 1000).toFixed(2)}s
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">{columnCount} columns</span>
      </div>

      {/* Results table - now uses normalized row objects! */}
      <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {displayColumns.map((col, i) => (
                <th key={i} className="px-3 py-2 text-left font-medium text-gray-600 border-b border-gray-200 whitespace-nowrap">
                  {col}
                </th>
              ))}
              {hasMoreColumns && (
                <th className="px-3 py-2 text-left text-gray-400 border-b border-gray-200">
                  +{columnNames.length - 8} more
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {normalizedRows.slice(0, 50).map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-blue-50 border-b border-gray-100 last:border-0">
                {displayColumns.map((colName, colIdx) => {
                  // Access by column NAME (object property), not index!
                  const value = row[colName];
                  return (
                    <td key={colIdx} className="px-3 py-2 max-w-[200px] truncate">
                      {value !== null && value !== undefined 
                        ? String(value).substring(0, 100)
                        : <span className="text-gray-300 italic">null</span>
                      }
                    </td>
                  );
                })}
                {hasMoreColumns && (
                  <td className="px-3 py-2 text-gray-300">...</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {normalizedRows.length > 50 && (
          <div className="px-3 py-2 bg-gray-50 text-xs text-gray-500 text-center border-t border-gray-200">
            Showing 50 of {normalizedRows.length} rows
          </div>
        )}
      </div>
    </div>
  );
}

// Copy button
function CopyButton({ text, size = 14 }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async (e) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  
  return (
    <button
      onClick={handleCopy}
      className={`p-1.5 rounded transition-all ${
        copied 
          ? 'bg-green-100 text-green-600' 
          : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
      }`}
      title={copied ? 'Copied!' : 'Copy SQL'}
    >
      {copied ? <Check size={size} /> : <Copy size={size} />}
    </button>
  );
}

// ============================================================================
// FlyoutQueryEditorHeader - 2-row simplified header
// ============================================================================

function FlyoutQueryEditorHeader({
  title,
  hasUnsavedChanges,
  onRun,
  running,
  database,
  schema,
  isConnected,
  onOpenFullEditor,
  onClearResults,
  hasResults,
  onCopy,
  sql
}) {
  return (
    <div className="border-b border-gray-200 bg-white px-4 py-3 space-y-2 flex-shrink-0">
      {/* Row 1: Title + unsaved dot | Run button */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex-shrink-0">
            <Play size={14} />
          </span>
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 truncate">{title}</h3>
            {hasUnsavedChanges && (
              <span 
                className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" 
                title="Unsaved changes" 
              />
            )}
          </div>
        </div>
        <button
          onClick={onRun}
          disabled={running || !isConnected}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border border-emerald-500 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          <span>{running ? 'Running…' : 'Run query'}</span>
        </button>
      </div>

      {/* Row 2: Context | Utilities */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="inline-flex items-center gap-1.5">
          {isConnected ? (
            <>
              <Snowflake size={12} className="text-blue-500" />
              <span className="font-mono">
                {database || 'Default'}.{schema || 'PUBLIC'}
              </span>
            </>
          ) : (
            <>
              <WifiOff size={12} className="text-gray-400" />
              <span>Not connected</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <CopyButton text={sql} size={12} />
          {hasResults && onClearResults && (
            <button
              onClick={onClearResults}
              className="inline-flex items-center gap-1 hover:text-gray-700 transition-colors"
              title="Clear results"
            >
              <Trash2 size={12} />
              <span>Clear</span>
            </button>
          )}
          {onOpenFullEditor && (
            <button
              onClick={onOpenFullEditor}
              className="inline-flex items-center gap-1 hover:text-gray-700 transition-colors"
              title="Open in full Query Editor"
            >
              <Maximize2 size={12} />
              <span>Full editor</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main FlyoutQueryEditor Component
// ============================================================================

export default function FlyoutQueryEditor({ 
  initialQuery = '', 
  title = 'Test Query',
  onClose,
  onOpenFullEditor,
  database,
  schema,
  // New props for integration with TestQueryLayout
  hideHeader = false,
  onSqlChange = null,
  // Schema info for suggestions
  availableTables = [],
  tableColumns = {},
  // Entity context for query flows
  entityContext = null,
  // Show query flow controls
  showFlowControls = true,
}) {
  const editorRef = useRef(null);
  const [sql, setSql] = useState(initialQuery);
  const [isExpanded, setIsExpanded] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  
  // Wizard mode state
  const [wizardMode, setWizardMode] = useState(null); // null or { flowId, entity }
  
  const { status: connStatus } = useConnection();
  const { executeQuery, results, loading, error, clearResults } = useQuery();
  const { fetchTables, fetchColumns } = useMetadata();
  
  // Local state for discovered tables (if not passed as props)
  const [localTables, setLocalTables] = useState([]);
  const [localColumns, setLocalColumns] = useState({});
  
  // Fetch tables if not provided and connected
  useEffect(() => {
    if (availableTables.length === 0 && connStatus?.connected) {
      const db = database || connStatus?.database;
      const sch = schema || connStatus?.schema;
      if (db && sch) {
        log.debug('Fetching tables for suggestions', { db, sch });
        fetchTables(db, sch).then(tables => {
          if (Array.isArray(tables)) {
            setLocalTables(tables.map(t => typeof t === 'string' ? t : t.name));
          }
        });
      }
    }
  }, [availableTables, connStatus, database, schema, fetchTables]);
  
  // Build schema cache for suggestions
  const schemaCache = useMemo(() => {
    const allTables = availableTables.length > 0 ? availableTables : localTables;
    const allColumns = Object.keys(tableColumns).length > 0 ? tableColumns : localColumns;
    
    // Debug: log what tables we have (use strings for visibility)
    const debugInfo = {
      propsAvailableTables: availableTables?.length || 0,
      localTablesCount: localTables?.length || 0,
      allTablesCount: allTables?.length || 0,
      first5: JSON.stringify(allTables?.slice?.(0, 5) || []),
      hasProcessEntity: allTables?.some?.(t => t?.toUpperCase?.() === 'PROCESS_ENTITY') || false,
    };
    console.warn(`[FlyoutQueryEditor] schemaCache: props=${debugInfo.propsAvailableTables}, local=${debugInfo.localTablesCount}, total=${debugInfo.allTablesCount}, hasProcess=${debugInfo.hasProcessEntity}, first5=${debugInfo.first5}`);
    
    return buildSchemaCache(allTables, allColumns);
  }, [availableTables, localTables, tableColumns, localColumns]);
  
  // Generate suggestions when error occurs
  useEffect(() => {
    if (error && schemaCache.tables.length > 0) {
      const newSuggestions = getSuggestionsFromError(sql, error, schemaCache);
      setSuggestions(newSuggestions);
      log.info('Generated suggestions for error', { 
        suggestionCount: newSuggestions.length,
        errorPreview: error.substring(0, 50)
      });
    } else {
      setSuggestions([]);
    }
  }, [error, sql, schemaCache]);
  
  // Apply a suggestion to the SQL
  const handleApplySuggestion = useCallback((suggestion) => {
    log.info('Applying suggestion', { type: suggestion.type, title: suggestion.title });
    
    if (suggestion.type === 'rewrite' || suggestion.type === 'syntax') {
      // Full query replacement
      setSql(suggestion.fix);
    } else if (suggestion.type === 'table') {
      // Replace the missing table with the suggested one
      const newSql = sql.replace(
        new RegExp(`\\b${suggestion.title.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'gi'),
        suggestion.fix
      );
      // If no direct replacement worked, try to find and replace the table reference
      if (newSql === sql) {
        // Use the full query rewrite from the suggestion engine
        const rewriteSuggestion = suggestions.find(s => s.type === 'rewrite');
        if (rewriteSuggestion) {
          setSql(rewriteSuggestion.fix);
        }
      } else {
        setSql(newSql);
      }
    } else if (suggestion.type === 'column') {
      // Replace column name
      const newSql = sql.replace(
        new RegExp(`\\b${suggestion.title}\\b`, 'gi'),
        suggestion.fix
      );
      setSql(newSql);
    }
    
    // Clear errors after applying fix
    clearResults();
  }, [sql, suggestions, clearResults]);
  
  // Update SQL when initialQuery changes
  useEffect(() => {
    if (initialQuery) {
      setSql(initialQuery);
      clearResults();
    }
  }, [initialQuery, clearResults]);
  
  // Notify parent of SQL changes (for unsaved changes tracking)
  useEffect(() => {
    if (onSqlChange) {
      onSqlChange(sql, initialQuery);
    }
  }, [sql, initialQuery, onSqlChange]);

  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined' 
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
    : false;

  // Handle editor mount - auto-focus for immediate typing
  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    
    setTimeout(() => {
      editor.focus();
    }, 100);
    
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleExecute();
    });
  };

  // Execute query
  const handleExecute = useCallback(async () => {
    const queryText = sql.trim();
    if (!queryText) {
      log.warn('handleExecute() - empty query, aborting');
      return;
    }
    
    log.info('handleExecute() - running query', {
      sqlPreview: queryText.substring(0, 60) + (queryText.length > 60 ? '...' : ''),
      database: database || connStatus?.database,
      schema: schema || connStatus?.schema
    });
    
    await executeQuery(queryText, {
      database: database || connStatus?.database,
      schema: schema || connStatus?.schema,
      warehouse: connStatus?.warehouse
    });
  }, [sql, database, schema, connStatus, executeQuery]);

  // Reset to initial query
  const handleReset = useCallback(() => {
    setSql(initialQuery);
    clearResults();
  }, [initialQuery, clearResults]);
  
  // Clear results only
  const handleClearResults = useCallback(() => {
    clearResults();
  }, [clearResults]);
  
  // Open in full editor
  const handleOpenFullEditor = useCallback(() => {
    if (onOpenFullEditor) {
      onOpenFullEditor(sql);
    }
  }, [onOpenFullEditor, sql]);

  const isConnected = connStatus?.connected;
  const hasUnsavedChanges = sql !== initialQuery;

  // Build entity context from connection if not provided
  const effectiveEntityContext = useMemo(() => {
    if (entityContext) return entityContext;
    
    // Default entity context based on current connection
    const db = database || connStatus?.database;
    const sch = schema || connStatus?.schema;
    
    return {
      type: 'UNKNOWN',
      database: db,
      schema: sch,
    };
  }, [entityContext, database, schema, connStatus]);

  // Handle query flow selection
  const handleFlowSelect = useCallback((builtQuery, flowType) => {
    log.info('Query flow selected', { flowType, title: builtQuery.title });
    setSql(builtQuery.sql);
    clearResults();
  }, [clearResults]);

  // Handle opening wizard mode
  const handleOpenWizard = useCallback((flowId, entity) => {
    log.info('Opening wizard mode', { flowId, entityType: entity?.type });
    setWizardMode({ flowId, entity: entity || effectiveEntityContext });
    clearResults();
  }, [effectiveEntityContext, clearResults]);

  // Handle wizard completion
  const handleWizardComplete = useCallback(({ sql: finalSql, inputs }) => {
    log.info('Wizard complete', { sqlLength: finalSql?.length, inputs });
    setSql(finalSql);
    setWizardMode(null);
  }, []);

  // Handle using SQL from wizard
  const handleWizardUseSql = useCallback((wizardSql) => {
    log.info('Using SQL from wizard step', { sqlPreview: wizardSql?.substring(0, 50) });
    setSql(wizardSql);
    setWizardMode(null);
  }, []);

  return (
    <div 
      className="flex flex-col h-full bg-white"
      role="region"
      aria-label="SQL Query Editor"
    >
      {/* Header - hidden when used inside TestQueryLayout */}
      {!hideHeader && (
        <FlyoutQueryEditorHeader
          title={title}
          hasUnsavedChanges={hasUnsavedChanges}
          onRun={handleExecute}
          running={loading}
          database={database || connStatus?.database}
          schema={schema || connStatus?.schema}
          isConnected={isConnected}
          onOpenFullEditor={handleOpenFullEditor}
          onClearResults={handleClearResults}
          hasResults={!!results}
          sql={sql}
        />
      )}

      {/* Not connected warning */}
      {!isConnected && !wizardMode && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex-shrink-0">
          <p className="text-xs text-amber-700 flex items-center gap-2">
            <WifiOff size={14} />
            Connect to Snowflake to run queries
          </p>
        </div>
      )}

      {/* Wizard Mode */}
      {wizardMode && (
        <div className="flex-1 overflow-hidden">
          <StepWizard
            flowId={wizardMode.flowId}
            entity={wizardMode.entity}
            availableTables={schemaCache.tables || []}
            database={database || connStatus?.database}
            schema={schema || connStatus?.schema}
            onComplete={handleWizardComplete}
            onCancel={() => setWizardMode(null)}
            onUseSql={handleWizardUseSql}
          />
        </div>
      )}

      {/* Main Content Area - hidden when in wizard mode */}
      {!wizardMode && (
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Collapsible SQL Editor */}
        <div className={`border-b border-gray-200 ${prefersReducedMotion ? '' : 'transition-all duration-200'} ${isExpanded ? 'h-[200px]' : 'h-10'}`}>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 hover:bg-gray-100 text-xs font-medium text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
            aria-expanded={isExpanded}
            aria-controls="sql-editor"
          >
            <span className="flex items-center gap-2">
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              SQL Editor
              {hasUnsavedChanges && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              )}
            </span>
            <span className="text-gray-400">
              {sql.split('\n').length} lines
            </span>
          </button>
          
          {isExpanded && (
            <div id="sql-editor" className="h-[calc(100%-32px)] flex flex-col">
              {/* Placeholder Suggestions Bar - shows when SQL has {{...}} or <...> placeholders */}
              <PlaceholderSuggestions
                sql={sql}
                database={database || connStatus?.database}
                schema={schema || connStatus?.schema}
                availableTables={new Set(schemaCache.tables || [])}
                executeQuery={async (querySql) => {
                  // Execute query and return results for placeholder value fetching
                  try {
                    const result = await executeQuery(querySql);
                    return result;
                  } catch (err) {
                    log.error('Error fetching placeholder values', { error: err });
                    return { rows: [] };
                  }
                }}
                onSqlChange={(newSql) => setSql(newSql)}
              />
              
              <div className="flex-1">
                <Editor
                  height="100%"
                  defaultLanguage="sql"
                  value={sql}
                  onChange={(value) => setSql(value || '')}
                  onMount={handleEditorMount}
                  theme="vs"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 12,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    automaticLayout: true,
                    tabSize: 2,
                    padding: { top: 8 },
                    lineNumbersMinChars: 3,
                    folding: false,
                    renderLineHighlight: 'line',
                    scrollbar: {
                      vertical: 'auto',
                      horizontal: 'auto',
                      verticalScrollbarSize: 8,
                      horizontalScrollbarSize: 8,
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Results Section - scrollable */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          <CompactResultsTable 
            results={results} 
            loading={loading} 
            error={error}
            suggestions={suggestions}
            onApplySuggestion={handleApplySuggestion}
          />
          
          {/* Show contextual flow suggestions after query execution */}
          {results?.rows?.length > 0 && !loading && !error && (
            <ResultFlowSuggestions
              results={results}
              availableTables={schemaCache.tables}
              onSelectFlow={handleFlowSelect}
            />
          )}
        </div>
      </div>
      )}

      {/* Query Flows Panel (if entity context is available) */}
      {!wizardMode && showFlowControls && effectiveEntityContext && (
        <div className="flex-shrink-0 px-4 py-3 border-t border-gray-100 bg-gradient-to-r from-indigo-50/50 to-purple-50/50">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <GitBranch size={14} className="text-indigo-500" />
              <span className="font-medium">Query Flows</span>
              {effectiveEntityContext.type !== 'UNKNOWN' && (
                <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs">
                  {effectiveEntityContext.type}
                </span>
              )}
            </div>
            <QueryFlowMenu
              entity={effectiveEntityContext}
              availableTables={schemaCache.tables}
              onSelectFlow={handleFlowSelect}
              onOpenWizard={handleOpenWizard}
              disabled={!isConnected}
              buttonClassName="text-xs"
            />
          </div>
          
          {/* Quick flow buttons for common actions */}
          {effectiveEntityContext.type !== 'UNKNOWN' && (
            <div className="mt-2">
              <QuickFlowButtons
                entity={effectiveEntityContext}
                availableTables={schemaCache.tables}
                onSelectFlow={handleFlowSelect}
              />
            </div>
          )}
        </div>
      )}

      {/* Sticky Footer with Actions - hidden in wizard mode */}
      {!wizardMode && (
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <button
            onClick={handleExecute}
            disabled={loading || !sql.trim() || !isConnected}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            aria-label="Execute SQL query"
          >
            {loading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            {loading ? 'Running...' : 'Run query'}
          </button>
          
          {hasUnsavedChanges && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 hover:bg-gray-200 text-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              title="Reset to original query"
              aria-label="Reset query to original"
            >
              <RotateCcw size={14} />
              Reset
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 hidden sm:inline">
            ⌘+Enter to run
          </span>
          {onOpenFullEditor && (
            <button
              onClick={handleOpenFullEditor}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              title="Open in full Query Editor"
              aria-label="Open query in full editor"
            >
              <Maximize2 size={14} />
              Full Editor
            </button>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
