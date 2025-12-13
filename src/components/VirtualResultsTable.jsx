/**
 * VirtualResultsTable - High-performance results table with virtual scrolling
 *
 * Like Databricks/Snowflake web UI:
 * - Only renders visible rows (handles 100k+ rows)
 * - Smooth scrolling with overscan
 * - Column resizing
 * - Sticky header
 */

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Check, Clock, AlertCircle, Database, Copy, Download,
  Search, X, ChevronDown, ChevronUp, ArrowUpDown
} from 'lucide-react';
import {
  normalizeRows,
  extractColumnNames,
  getRowCount,
  isEmptyResult,
  hasNoResult
} from '../utils/queryResultAdapter';

const ROW_HEIGHT = 36; // Fixed row height for virtualization
const OVERSCAN = 10; // Render extra rows outside viewport

/**
 * Virtual table body with row virtualization
 */
function VirtualTableBody({ rows, columns, parentRef, maxCols = 10 }) {
  const displayColumns = columns.slice(0, maxCols);
  const hasMoreColumns = columns.length > maxCols;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  const virtualRows = virtualizer.getVirtualItems();

  return (
    <tbody
      style={{
        height: `${virtualizer.getTotalSize()}px`,
        width: '100%',
        position: 'relative',
      }}
    >
      {virtualRows.map((virtualRow) => {
        const row = rows[virtualRow.index];
        return (
          <tr
            key={virtualRow.key}
            data-index={virtualRow.index}
            className="hover:bg-slate-50 border-b border-slate-100"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {displayColumns.map((colName, colIdx) => {
              const value = row[colName];
              return (
                <td
                  key={colIdx}
                  className="px-3 py-2 text-slate-700 truncate"
                  style={{
                    flex: '1 1 0',
                    minWidth: 100,
                    maxWidth: 200,
                  }}
                  title={value !== null && value !== undefined ? String(value) : ''}
                >
                  {value !== null && value !== undefined ? (
                    String(value).substring(0, 100)
                  ) : (
                    <span className="text-slate-300 italic">null</span>
                  )}
                </td>
              );
            })}
            {hasMoreColumns && (
              <td className="px-3 py-2 text-slate-300 flex-shrink-0">...</td>
            )}
          </tr>
        );
      })}
    </tbody>
  );
}

/**
 * Main VirtualResultsTable component
 */
export default function VirtualResultsTable({
  results,
  loading,
  error,
  maxCols = 10,
  maxHeight = 500,
  onCopyAll,
  onExport,
}) {
  const [searchFilter, setSearchFilter] = useState('');
  const [sortConfig, setSortConfig] = useState({ column: null, direction: 'asc' });
  const [copied, setCopied] = useState(false);
  const parentRef = useRef(null);

  // Normalize data
  const normalizedRows = useMemo(
    () => (results ? normalizeRows(results) : []),
    [results]
  );

  const columnNames = useMemo(
    () => (results ? extractColumnNames(results) : []),
    [results]
  );

  // Filter rows
  const filteredRows = useMemo(() => {
    if (!searchFilter.trim()) return normalizedRows;
    const search = searchFilter.toLowerCase();
    return normalizedRows.filter((row) =>
      Object.values(row).some((val) =>
        String(val).toLowerCase().includes(search)
      )
    );
  }, [normalizedRows, searchFilter]);

  // Sort rows
  const sortedRows = useMemo(() => {
    if (!sortConfig.column) return filteredRows;

    return [...filteredRows].sort((a, b) => {
      const aVal = a[sortConfig.column];
      const bVal = b[sortConfig.column];

      // Handle nulls
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      // Compare
      let comparison = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [filteredRows, sortConfig]);

  const rowCount = getRowCount(results);
  const displayColumns = columnNames.slice(0, maxCols);
  const hasMoreColumns = columnNames.length > maxCols;

  // Copy handler
  const handleCopyAll = useCallback(async () => {
    const json = JSON.stringify(normalizedRows, null, 2);
    await navigator.clipboard.writeText(json);
    setCopied(true);
    onCopyAll?.();
    setTimeout(() => setCopied(false), 2000);
  }, [normalizedRows, onCopyAll]);

  // Sort handler
  const handleSort = useCallback((column) => {
    setSortConfig((prev) => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mr-3" />
        <span className="text-sm">Executing query...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg m-3">
        <div className="flex items-start gap-2">
          <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800">Query failed</p>
            <p className="text-xs text-red-600 mt-1">{String(error).substring(0, 300)}</p>
          </div>
        </div>
      </div>
    );
  }

  // No results yet
  if (hasNoResult(results)) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <Database size={32} className="mb-3 opacity-50" />
        <p className="text-sm font-medium">Run a query to see results</p>
        <p className="text-xs mt-1">⌘+Enter to execute</p>
      </div>
    );
  }

  // Empty results
  if (isEmptyResult(results)) {
    return (
      <div className="p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
          <AlertCircle size={24} className="text-amber-600" />
        </div>
        <p className="text-sm font-medium text-slate-700">No rows returned</p>
        <p className="text-xs text-slate-500 mt-1">Query succeeded but returned 0 rows</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
            <Check size={14} />
            {sortedRows.length.toLocaleString()}
            <span className="text-slate-500 font-normal">
              {sortedRows.length !== normalizedRows.length && `of ${normalizedRows.length.toLocaleString()}`} rows
            </span>
          </span>
          {results?.executionTime && (
            <span className="flex items-center gap-1 text-slate-500">
              <Clock size={12} />
              {(results.executionTime / 1000).toFixed(2)}s
            </span>
          )}
          {results?.isCached && (
            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-medium">
              CACHED
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyAll}
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
          >
            {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
            {copied ? 'Copied!' : 'Copy JSON'}
          </button>
          {onExport && (
            <button
              onClick={onExport}
              className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
            >
              <Download size={12} />
              Export
            </button>
          )}
        </div>
      </div>

      {/* Search filter */}
      {rowCount > 10 && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-white flex-shrink-0">
          <Search size={14} className="text-slate-400" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Filter results..."
            className="flex-1 text-sm bg-transparent outline-none text-slate-700 placeholder:text-slate-400"
          />
          {searchFilter && (
            <button
              onClick={() => setSearchFilter('')}
              className="p-1 text-slate-400 hover:text-slate-600 rounded"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Virtual scrolling table */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto"
        style={{ maxHeight, contain: 'strict' }}
      >
        <table className="w-full text-xs border-collapse" style={{ tableLayout: 'fixed' }}>
          {/* Sticky header */}
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr style={{ display: 'flex' }}>
              {displayColumns.map((col) => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className="px-3 py-2 text-left font-medium text-slate-600 border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                  style={{ flex: '1 1 0', minWidth: 100, maxWidth: 200 }}
                >
                  <div className="flex items-center gap-1">
                    <span className="truncate">{col}</span>
                    {sortConfig.column === col ? (
                      sortConfig.direction === 'asc' ? (
                        <ChevronUp size={12} />
                      ) : (
                        <ChevronDown size={12} />
                      )
                    ) : (
                      <ArrowUpDown size={10} className="text-slate-300" />
                    )}
                  </div>
                </th>
              ))}
              {hasMoreColumns && (
                <th className="px-3 py-2 text-left text-slate-400 border-b border-slate-200 flex-shrink-0">
                  +{columnNames.length - maxCols}
                </th>
              )}
            </tr>
          </thead>

          {/* Virtual body */}
          <VirtualTableBody
            rows={sortedRows}
            columns={columnNames}
            parentRef={parentRef}
            maxCols={maxCols}
          />
        </table>
      </div>

      {/* Footer */}
      {sortedRows.length > 100 && (
        <div className="px-3 py-2 bg-slate-50 text-xs text-slate-500 text-center border-t flex-shrink-0">
          Showing all {sortedRows.length.toLocaleString()} rows (virtual scrolling enabled)
        </div>
      )}
    </div>
  );
}
