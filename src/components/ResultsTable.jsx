/**
 * Results Table - Display query results with pagination and export
 */

import React, { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table';
import { 
  ArrowUpDown, ArrowUp, ArrowDown, Download, Copy, Check,
  ChevronLeft, ChevronRight, Loader2, AlertCircle, Search, Wand2, Play
} from 'lucide-react';

// Parse error message to extract the missing table name
function parseErrorForMissingTable(error) {
  if (!error) return null;
  
  // Pattern: Object 'TABLE_NAME' does not exist
  const match1 = error.match(/Object\s+'([^']+)'\s+does not exist/i);
  if (match1) return match1[1];
  
  // Pattern: Table 'TABLE_NAME' does not exist
  const match2 = error.match(/Table\s+'([^']+)'\s+does not exist/i);
  if (match2) return match2[1];
  
  // Pattern: invalid identifier 'COLUMN_NAME'
  const match3 = error.match(/invalid identifier\s+'([^']+)'/i);
  if (match3) return { type: 'column', name: match3[1] };
  
  // Pattern: Schema 'SCHEMA' does not exist
  const match4 = error.match(/Schema\s+'([^']+)'\s+does not exist/i);
  if (match4) return { type: 'schema', name: match4[1] };
  
  return null;
}

// Component to show alternative suggestions
function AlternativeSuggestions({ 
  missingObject, 
  alternatives, 
  loading, 
  onSearch, 
  onSelectAlternative 
}) {
  if (!missingObject) return null;
  
  const objectName = typeof missingObject === 'string' ? missingObject : missingObject.name;
  const objectType = typeof missingObject === 'object' ? missingObject.type : 'table';
  
  // Extract suggestions array from alternatives object (new format) or use directly (old format)
  const suggestions = alternatives?.suggestions || (Array.isArray(alternatives) ? alternatives : null);
  const context = alternatives?.context;
  const hasSuggestions = suggestions && suggestions.length > 0;
  const hasSearched = alternatives !== null;
  
  return (
    <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
      <div className="flex items-center gap-2 text-blue-700 font-medium mb-2">
        <Wand2 size={16} />
        <span>Can't find: <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">{objectName}</code></span>
      </div>
      
      {!hasSearched && !loading && (
        <button
          onClick={() => onSearch(objectName, objectType)}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Search size={14} />
          Find similar {objectType}s in warehouse
        </button>
      )}
      
      {loading && (
        <div className="flex items-center gap-2 text-blue-600 text-sm">
          <Loader2 size={14} className="animate-spin" />
          Searching for alternatives...
        </div>
      )}
      
      {hasSuggestions && (
        <div className="space-y-2">
          {context && (
            <p className="text-xs text-blue-500 mb-2">
              Searching in: <code className="bg-blue-100 px-1 rounded">{context.database}.{context.schema}</code>
            </p>
          )}
          <p className="text-sm text-blue-600">Found {suggestions.length} similar {objectType}(s):</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.slice(0, 15).map((alt, i) => (
              <button
                key={i}
                onClick={() => onSelectAlternative(alt, objectName)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-sm font-mono text-blue-700 hover:bg-blue-100 hover:border-blue-400 transition-colors"
              >
                <Play size={12} />
                {alt}
              </button>
            ))}
          </div>
          <p className="text-xs text-blue-500 mt-2">Click to run query with this {objectType} instead</p>
        </div>
      )}
      
      {hasSearched && !hasSuggestions && (
        <div className="space-y-2">
          {context && (
            <p className="text-xs text-blue-500 mb-1">
              Searched in: <code className="bg-blue-100 px-1 rounded">{context.database}.{context.schema}</code>
            </p>
          )}
          <p className="text-sm text-blue-600">No similar {objectType}s found. Try a different database/schema.</p>
          {alternatives?.error && (
            <p className="text-xs text-red-500 mt-1">Error: {alternatives.error}</p>
          )}
        </div>
      )}
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <button
      onClick={handleCopy}
      className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-700"
      title="Copy to clipboard"
    >
      {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
    </button>
  );
}

export default function ResultsTable({ 
  results, 
  loading, 
  error,
  onPageChange,
  onExport,
  // New props for error recovery
  onSearchAlternatives,
  onSelectAlternative,
  alternatives,
  alternativesLoading
}) {
  const [sorting, setSorting] = useState([]);
  
  // Parse error to find missing object
  const missingObject = useMemo(() => parseErrorForMissingTable(error), [error]);
  
  // Build columns from result metadata
  // Handles both string columns ["col1", "col2"] and object columns [{name: "col1"}, {name: "col2"}]
  const columns = useMemo(() => {
    if (!results?.columns) return [];
    
    return results.columns.map((col, index) => {
      // Handle both string and object column formats
      const colName = typeof col === 'string' ? col : (col.name || `col_${index}`);
      const colType = typeof col === 'object' ? col.type : undefined;
      
      return {
        id: colName || `col_${index}`,
        accessorKey: colName,
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 font-semibold text-gray-700 hover:text-gray-900"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            <span>{colName}</span>
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp size={14} />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown size={14} />
            ) : (
              <ArrowUpDown size={14} className="opacity-50" />
            )}
          </button>
        ),
        cell: ({ getValue }) => {
          const value = getValue();
          if (value === null) return <span className="text-gray-400 italic">NULL</span>;
          if (typeof value === 'object') return JSON.stringify(value);
          return String(value);
        },
        meta: { type: colType }
      };
    });
  }, [results?.columns]);
  
  // Build data from rows
  // Handles both string and object column formats
  const data = useMemo(() => {
    if (!results?.rows || !results?.columns) return [];
    
    return results.rows.map(row => {
      const obj = {};
      results.columns.forEach((col, i) => {
        const colName = typeof col === 'string' ? col : col.name;
        obj[colName] = row[i];
      });
      return obj;
    });
  }, [results?.rows, results?.columns]);
  
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  
  const exportToCSV = () => {
    if (!results?.columns || !results?.rows) return;
    
    const headers = results.columns.map(c => c.name).join(',');
    const rows = results.rows.map(row => 
      row.map(cell => {
        if (cell === null) return '';
        if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return String(cell);
      }).join(',')
    ).join('\n');
    
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query_results_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-white">
        <div className="text-center">
          <Loader2 size={32} className="mx-auto text-blue-500 animate-spin mb-2" />
          <p className="text-gray-500">Executing query...</p>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-white p-4">
        <div className="text-center max-w-lg">
          <AlertCircle size={32} className="mx-auto text-red-500 mb-2" />
          <p className="text-red-600 font-medium">Query Failed</p>
          <p className="text-gray-500 text-sm mt-1 font-mono bg-gray-100 p-2 rounded">{error}</p>
          
          {/* Alternative suggestions for missing objects */}
          {onSearchAlternatives && (
            <AlternativeSuggestions
              missingObject={missingObject}
              alternatives={alternatives}
              loading={alternativesLoading}
              onSearch={onSearchAlternatives}
              onSelectAlternative={onSelectAlternative}
            />
          )}
        </div>
      </div>
    );
  }
  
  // Empty state
  if (!results) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center text-gray-400">
          <p className="text-lg">No results yet</p>
          <p className="text-sm">Execute a query to see results here</p>
        </div>
      </div>
    );
  }
  
  const rowCount = results.rowCount ?? results.total_rows ?? results.rows?.length ?? 0;
  const columnCount = results.columns?.length ?? 0;
  
  // Show empty table message when 0 rows but columns exist
  if (rowCount === 0 && columnCount > 0) {
    return (
      <div className="flex flex-col h-full bg-white">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span><strong>0</strong> rows</span>
            <span><strong>{columnCount}</strong> columns</span>
          </div>
        </div>
        
        {/* Empty results message */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-lg font-medium text-gray-700 mb-2">Query Returned No Rows</h3>
            <p className="text-sm text-gray-500 mb-4">
              The query executed successfully and found <strong>{columnCount} columns</strong>, but the table is empty or no rows matched your query conditions.
            </p>
            <div className="text-xs text-gray-400 bg-gray-50 rounded p-2 font-mono">
              Columns: {results.columns?.slice(0, 5).map(c => typeof c === 'string' ? c : c.name).join(', ')}
              {columnCount > 5 && ` ... +${columnCount - 5} more`}
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>
            <strong>{rowCount.toLocaleString()}</strong> rows
          </span>
          <span>
            <strong>{columnCount}</strong> columns
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>
      
      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className="px-4 py-2 text-left border-b border-gray-200 bg-gray-50"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} className="hover:bg-blue-50/50 border-b border-gray-100">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-4 py-2 max-w-xs truncate">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Pagination - only show if pagination info is available */}
      {results.has_more !== undefined && results.page !== undefined && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 bg-gray-50">
          <span className="text-sm text-gray-600">
            Page {results.page} of {Math.ceil((results.total_rows ?? results.rowCount ?? 0) / (results.page_size ?? 100))}
          </span>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange?.(results.page - 1)}
              disabled={results.page <= 1}
              className="p-1 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => onPageChange?.(results.page + 1)}
              disabled={!results.has_more}
              className="p-1 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

