/**
 * CompactQueryEditor - Minimal SQL editor for sidebar context
 *
 * Clean, focused design:
 * - No header chrome
 * - Monaco editor (minimal config)
 * - Single "Run query" pill button
 * - Compact results display
 */

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import LazyMonacoEditor from './LazyMonacoEditor';
import {
  Check, Clock, AlertCircle, Database, Copy, Download,
  ChevronDown, X, Search
} from 'lucide-react';
import { useQuery, useConnection } from '../hooks/useSnowflake';
import { RunQueryButton } from './ui/RunQueryButton';
import {
  normalizeRows,
  extractColumnNames,
  getRowCount,
  isEmptyResult,
  hasNoResult
} from '../utils/queryResultAdapter';

/**
 * Compact results display
 */
function CompactResults({ results, loading, error }) {
  const [searchFilter, setSearchFilter] = useState('');
  const [copied, setCopied] = useState(false);

  const normalizedRows = useMemo(
    () => results ? normalizeRows(results) : [],
    [results]
  );

  const columnNames = useMemo(
    () => results ? extractColumnNames(results) : [],
    [results]
  );

  const filteredRows = useMemo(() => {
    if (!searchFilter.trim()) return normalizedRows;
    const search = searchFilter.toLowerCase();
    return normalizedRows.filter(row =>
      Object.values(row).some(val =>
        String(val).toLowerCase().includes(search)
      )
    );
  }, [normalizedRows, searchFilter]);

  const rowCount = getRowCount(results);

  const handleCopyAll = async () => {
    const json = JSON.stringify(normalizedRows, null, 2);
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Error state
  if (error) {
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-start gap-2">
          <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-800">Query failed</p>
            <p className="text-xs text-red-600 mt-1 break-words">
              {String(error).substring(0, 200)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // No results yet
  if (hasNoResult(results) && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-slate-400">
        <Database size={24} className="mb-2 opacity-50" />
        <p className="text-sm">Run query to see results</p>
        <p className="text-xs mt-1 text-slate-300">⌘+Enter</p>
      </div>
    );
  }

  // Empty results
  if (isEmptyResult(results) && !loading) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm font-medium text-slate-600">No rows returned</p>
        <p className="text-xs text-slate-400 mt-1">Query succeeded but returned 0 rows</p>
      </div>
    );
  }

  // Results table
  const displayColumns = columnNames.slice(0, 5);
  const hasMoreColumns = columnNames.length > 5;

  return (
    <div className="flex flex-col h-full">
      {/* Results header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-emerald-600">
            <Check size={12} />
            <span className="font-medium">{filteredRows.length.toLocaleString()}</span>
            <span className="text-slate-500">rows</span>
          </span>
          {results?.executionTime && (
            <span className="flex items-center gap-1 text-slate-500">
              <Clock size={12} />
              {(results.executionTime / 1000).toFixed(2)}s
            </span>
          )}
        </div>
        <button
          onClick={handleCopyAll}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
        >
          {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {/* Search filter */}
      {rowCount > 5 && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
          <Search size={12} className="text-slate-400" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Filter results..."
            className="flex-1 text-xs bg-transparent outline-none text-slate-700 placeholder:text-slate-400"
          />
          {searchFilter && (
            <button onClick={() => setSearchFilter('')} className="text-slate-400 hover:text-slate-600">
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 sticky top-0">
            <tr>
              {displayColumns.map((col, i) => (
                <th
                  key={i}
                  className="px-3 py-2 text-left font-medium text-slate-600 border-b border-slate-200 whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
              {hasMoreColumns && (
                <th className="px-3 py-2 text-left text-slate-400 border-b border-slate-200">
                  +{columnNames.length - 5}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {filteredRows.slice(0, 100).map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-slate-50 border-b border-slate-50">
                {displayColumns.map((colName, colIdx) => {
                  const value = row[colName];
                  return (
                    <td key={colIdx} className="px-3 py-2 max-w-[120px] truncate text-slate-700">
                      {value !== null && value !== undefined
                        ? String(value).substring(0, 50)
                        : <span className="text-slate-300 italic">null</span>
                      }
                    </td>
                  );
                })}
                {hasMoreColumns && (
                  <td className="px-3 py-2 text-slate-300">...</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {filteredRows.length > 100 && (
          <div className="px-3 py-2 bg-slate-50 text-xs text-slate-500 text-center border-t">
            Showing 100 of {filteredRows.length.toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Main CompactQueryEditor component
 */
export default function CompactQueryEditor({
  initialQuery = '',
  database,
  schema,
  onQueryChange,
  placeholder = '-- Write your SQL query here...',
}) {
  const editorRef = useRef(null);
  const [sql, setSql] = useState(initialQuery);

  const { status: connStatus } = useConnection();
  const { executeQuery, results, loading, error, clearResults } = useQuery();

  const isConnected = connStatus?.connected;

  // Update SQL when initialQuery changes
  useEffect(() => {
    if (initialQuery && initialQuery !== sql) {
      setSql(initialQuery);
      clearResults();
    }
  }, [initialQuery]);

  // Notify parent of changes
  useEffect(() => {
    onQueryChange?.(sql);
  }, [sql, onQueryChange]);

  const handleEditorMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    // Add keyboard shortcut
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleExecute();
    });
  }, []);

  const handleExecute = useCallback(async () => {
    const queryText = sql.trim();
    if (!queryText || !isConnected) return;

    await executeQuery(queryText, {
      database: database || connStatus?.database,
      schema: schema || connStatus?.schema,
      warehouse: connStatus?.warehouse,
    });
  }, [sql, database, schema, connStatus, executeQuery, isConnected]);

  const lineCount = sql.split('\n').length;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Editor section */}
      <div className="flex-shrink-0 border-b border-slate-200">
        <div className="h-[140px] bg-slate-50">
          <LazyMonacoEditor
            height={140}
            value={sql}
            onChange={(value) => setSql(value || '')}
            onMount={handleEditorMount}
            options={{
              fontSize: 13,
              lineNumbers: 'off',
              padding: { top: 12, bottom: 12 },
              renderLineHighlight: 'none',
              lineDecorationsWidth: 0,
              lineNumbersMinChars: 0,
              glyphMargin: false,
            }}
          />
        </div>

        {/* Action bar */}
        <div className="flex items-center justify-between px-3 py-2 bg-white border-t border-slate-100">
          <RunQueryButton
            onClick={handleExecute}
            loading={loading}
            disabled={!sql.trim() || !isConnected}
            showDropdown={true}
          />
          <span className="text-xs text-slate-400">
            {lineCount} {lineCount === 1 ? 'line' : 'lines'}
          </span>
        </div>
      </div>

      {/* Results section */}
      <div className="flex-1 overflow-hidden border-t border-slate-200">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-500">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
              Executing...
            </div>
          </div>
        ) : (
          <CompactResults results={results} loading={loading} error={error} />
        )}
      </div>

      {/* Connection status */}
      {!isConnected && (
        <div className="px-3 py-2 bg-amber-50 border-t border-amber-200 text-xs text-amber-700">
          Connect to Snowflake to run queries
        </div>
      )}
    </div>
  );
}
