/**
 * FieldList - Searchable list of available fields
 *
 * Displays all discovered fields from the selected table.
 * Fields can be clicked or dragged to drop zones.
 */

import React, { useState, useMemo } from 'react';
import { Search, Loader2, AlertCircle } from 'lucide-react';
import { StaticField } from './DraggableField';

export function FieldList({ fields, loading, error, onFieldClick }) {
  const [searchTerm, setSearchTerm] = useState('');

  // Filter fields by search term
  const filteredFields = useMemo(() => {
    if (!searchTerm.trim()) return fields;

    const search = searchTerm.toLowerCase();
    return fields.filter(field =>
      field.fieldName.toLowerCase().includes(search) ||
      field.dataType.toLowerCase().includes(search)
    );
  }, [fields, searchTerm]);

  // Group fields by type
  const groupedFields = useMemo(() => {
    const measures = filteredFields.filter(f => f.fieldType === 'measure');
    const dimensions = filteredFields.filter(f => f.fieldType === 'dimension');
    return { measures, dimensions };
  }, [filteredFields]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Available Fields</h3>

        {/* Search box */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search fields..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
          />
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin text-slate-400" size={24} />
          <span className="ml-2 text-sm text-slate-500">Discovering fields...</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={16} />
          <div>
            <p className="text-sm font-semibold text-red-800">Error</p>
            <p className="text-xs text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Field list */}
      {!loading && !error && (
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Measures section */}
          {groupedFields.measures.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                  Measures
                </span>
                <span className="text-xs text-slate-500">({groupedFields.measures.length})</span>
              </div>
              <div className="space-y-2">
                {groupedFields.measures.map(field => (
                  <StaticField
                    key={field.fieldName}
                    field={field}
                    onAdd={onFieldClick}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Dimensions section */}
          {groupedFields.dimensions.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">
                  Dimensions
                </span>
                <span className="text-xs text-slate-500">({groupedFields.dimensions.length})</span>
              </div>
              <div className="space-y-2">
                {groupedFields.dimensions.map(field => (
                  <StaticField
                    key={field.fieldName}
                    field={field}
                    onAdd={onFieldClick}
                  />
                ))}
              </div>
            </div>
          )}

          {/* No results */}
          {filteredFields.length === 0 && !loading && !error && (
            <div className="text-center py-8">
              <p className="text-sm text-slate-400">No fields found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FieldList;
