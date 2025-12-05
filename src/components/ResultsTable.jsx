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
  ChevronLeft, ChevronRight, Loader2, AlertCircle
} from 'lucide-react';

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
  onExport
}) {
  const [sorting, setSorting] = useState([]);
  
  // Build columns from result metadata
  const columns = useMemo(() => {
    if (!results?.columns) return [];
    
    return results.columns.map(col => ({
      accessorKey: col.name,
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 font-semibold text-gray-700 hover:text-gray-900"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          <span>{col.name}</span>
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
      meta: { type: col.type }
    }));
  }, [results?.columns]);
  
  // Build data from rows
  const data = useMemo(() => {
    if (!results?.rows || !results?.columns) return [];
    
    return results.rows.map(row => {
      const obj = {};
      results.columns.forEach((col, i) => {
        obj[col.name] = row[i];
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
      <div className="flex items-center justify-center h-full bg-white">
        <div className="text-center max-w-md">
          <AlertCircle size={32} className="mx-auto text-red-500 mb-2" />
          <p className="text-red-600 font-medium">Query Failed</p>
          <p className="text-gray-500 text-sm mt-1">{error}</p>
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
  
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>
            <strong>{(results.rowCount ?? results.total_rows ?? results.rows?.length ?? 0).toLocaleString()}</strong> rows
          </span>
          <span>
            <strong>{results.columns?.length ?? 0}</strong> columns
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

