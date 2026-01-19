/**
 * MDLHSchemaViewer - Displays discovered MDLH schema tables and relationships
 * Includes ERD-style visualization
 */

import React, { useState, useMemo } from 'react';
import { useTenantConfigStore } from '../../stores/tenantConfigStore';
import { Database, Table, AlertCircle, Search, Network, Eye, EyeOff } from 'lucide-react';
import { ERDDiagram } from './ERDDiagram';

export function MDLHSchemaViewer() {
  const { schemaSnapshot } = useTenantConfigStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [showERD, setShowERD] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  // Access tables and columns from schemaSnapshot (may be in different structure)
  const tables = (schemaSnapshot as any)?.tables || [];
  const columns = (schemaSnapshot as any)?.columns || {};

  // Filter tables by search term
  const filteredTables = useMemo(() => {
    if (!searchTerm.trim()) return tables;
    const search = searchTerm.toLowerCase();
    return tables.filter(t => 
      t.name?.toLowerCase().includes(search) ||
      t.type?.toLowerCase().includes(search)
    );
  }, [tables, searchTerm]);

  // Group tables by type
  const tablesByType = useMemo(() => {
    const groups: Record<string, typeof tables> = {};
    tables.forEach(table => {
      const type = table.type || 'UNKNOWN';
      if (!groups[type]) groups[type] = [];
      groups[type].push(table);
    });
    return groups;
  }, [tables]);

  if (!schemaSnapshot || tables.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <AlertCircle size={24} className="text-yellow-600 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 mb-2">No Schema Discovered</h3>
          <p className="text-sm text-gray-600">
            Run schema discovery to see MDLH tables and relationships.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database size={20} className="text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">MDLH Schema</h2>
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
            {tables.length} tables
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowERD(!showERD)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {showERD ? <EyeOff size={16} /> : <Eye size={16} />}
            {showERD ? 'Hide ERD' : 'Show ERD'}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search tables..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* ERD View */}
      {showERD && (
        <div className="border border-gray-200 rounded-lg p-6 bg-gray-50 min-h-[400px]">
          <div className="flex items-center gap-2 mb-4">
            <Network size={18} className="text-blue-600" />
            <h3 className="font-semibold text-gray-900">Entity Relationship Diagram</h3>
          </div>
          <ERDDiagram />
        </div>
      )}

      {/* Tables by Type */}
      <div className="space-y-6">
        {Object.entries(tablesByType).map(([type, typeTables]) => (
          <div key={type}>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
              {type} ({typeTables.length})
            </h3>
            <div className="grid gap-3">
              {typeTables
                .filter(t => filteredTables.includes(t))
                .map((table) => {
                  const tableColumns = columns[table.name || ''] || [];
                  const isSelected = selectedTable === table.name;
                  
                  return (
                    <div
                      key={table.name}
                      className={`border rounded-lg p-4 bg-white hover:shadow-md transition-all cursor-pointer ${
                        isSelected ? 'border-blue-500 shadow-md' : 'border-gray-200'
                      }`}
                      onClick={() => setSelectedTable(isSelected ? null : table.name || null)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Table size={16} className="text-blue-500" />
                          <h4 className="font-semibold text-gray-900 font-mono">{table.name}</h4>
                        </div>
                        {table.rowCount !== undefined && (
                          <span className="text-xs text-gray-500">
                            {table.rowCount?.toLocaleString()} rows
                          </span>
                        )}
                      </div>
                      
                      {table.comment && (
                        <p className="text-sm text-gray-600 mb-2">{table.comment}</p>
                      )}

                      {isSelected && tableColumns.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-xs font-medium text-gray-600 mb-2">
                            Columns ({tableColumns.length}):
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {tableColumns.slice(0, 10).map((col, idx) => (
                              <div key={idx} className="text-xs font-mono text-gray-700">
                                {col.name}
                                <span className="text-gray-400 ml-1">({col.type})</span>
                              </div>
                            ))}
                            {tableColumns.length > 10 && (
                              <div className="text-xs text-gray-500">
                                +{tableColumns.length - 10} more
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Total Tables:</span>
            <span className="font-semibold text-gray-900 ml-2">{tables.length}</span>
          </div>
          <div>
            <span className="text-gray-600">Total Columns:</span>
            <span className="font-semibold text-gray-900 ml-2">
              {Object.values(columns).reduce((sum, cols) => sum + cols.length, 0)}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Discovered:</span>
            <span className="font-semibold text-gray-900 ml-2">
              {schemaSnapshot.discoveredAt 
                ? new Date(schemaSnapshot.discoveredAt).toLocaleDateString()
                : 'Unknown'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
