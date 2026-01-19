/**
 * Field Mapping Table
 *
 * Displays canonical fields and their tenant-specific mappings.
 * Allows confirming, rejecting, or overriding mappings.
 */

import React, { useMemo } from 'react';
import {
  useTenantConfigStore,
  TenantFieldMapping,
  MappingStatus,
} from '../../stores/tenantConfigStore';

// ============================================
// STATUS BADGE
// ============================================

interface StatusBadgeProps {
  status: MappingStatus;
  reconciliationStatus?: string;
}

function StatusBadge({ status, reconciliationStatus }: StatusBadgeProps) {
  const colors: Record<MappingStatus, string> = {
    confirmed: 'bg-green-100 text-green-800 border-green-200',
    auto: 'bg-blue-100 text-blue-800 border-blue-200',
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    rejected: 'bg-red-100 text-red-800 border-red-200',
  };

  const labels: Record<MappingStatus, string> = {
    confirmed: 'Confirmed',
    auto: 'Auto-mapped',
    pending: 'Pending Review',
    rejected: 'Rejected',
  };

  return (
    <div className="flex items-center gap-2">
      <span
        className={`px-2 py-0.5 text-xs font-medium rounded-full border ${colors[status]}`}
      >
        {labels[status]}
      </span>
      {reconciliationStatus && (
        <span className="text-xs text-gray-500">
          ({reconciliationStatus})
        </span>
      )}
    </div>
  );
}

// ============================================
// CONFIDENCE INDICATOR
// ============================================

interface ConfidenceIndicatorProps {
  confidence?: number;
}

function ConfidenceIndicator({ confidence }: ConfidenceIndicatorProps) {
  if (confidence === undefined) return null;

  const percent = Math.round(confidence * 100);
  const color =
    percent >= 90 ? 'text-green-600' :
    percent >= 70 ? 'text-blue-600' :
    percent >= 50 ? 'text-yellow-600' :
    'text-red-600';

  return (
    <span className={`text-xs font-medium ${color}`}>
      {percent}%
    </span>
  );
}

// ============================================
// SOURCE DISPLAY
// ============================================

interface SourceDisplayProps {
  source?: TenantFieldMapping['tenantSource'];
}

function SourceDisplay({ source }: SourceDisplayProps) {
  if (!source) {
    return <span className="text-gray-400 italic">No mapping</span>;
  }

  const typeColors: Record<string, string> = {
    native: 'bg-purple-100 text-purple-700',
    native_any: 'bg-purple-100 text-purple-700',
    custom_metadata: 'bg-indigo-100 text-indigo-700',
    classification: 'bg-pink-100 text-pink-700',
    relationship: 'bg-orange-100 text-orange-700',
    derived: 'bg-gray-100 text-gray-700',
  };

  const getSourceLabel = () => {
    switch (source.type) {
      case 'native':
        return `native:${source.attribute || '?'}`;
      case 'native_any':
        return `native_any:[${(source.attributes as string[] || []).join(', ')}]`;
      case 'custom_metadata':
        return `cm:${source.businessAttribute || '?'}.${source.attribute || '?'}`;
      case 'classification':
        return `tag:${source.pattern || source.tag || '*'}`;
      case 'relationship':
        return `rel:${source.relation || '?'}`;
      case 'derived':
        return 'derived';
      default:
        return source.type;
    }
  };

  return (
    <span
      className={`px-2 py-0.5 text-xs font-mono rounded ${typeColors[source.type] || 'bg-gray-100'}`}
    >
      {getSourceLabel()}
    </span>
  );
}

// ============================================
// ACTION BUTTONS
// ============================================

interface ActionButtonsProps {
  mapping: TenantFieldMapping;
  onConfirm: () => void;
  onReject: () => void;
  onEdit: () => void;
}

function ActionButtons({ mapping, onConfirm, onReject, onEdit }: ActionButtonsProps) {
  const showConfirm = mapping.status === 'pending' || mapping.status === 'auto';
  const showReject = mapping.status !== 'rejected';

  return (
    <div className="flex items-center gap-1">
      {showConfirm && (
        <button
          onClick={onConfirm}
          className="p-1 text-green-600 hover:bg-green-50 rounded"
          title="Confirm mapping"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </button>
      )}
      {showReject && (
        <button
          onClick={onReject}
          className="p-1 text-red-600 hover:bg-red-50 rounded"
          title="Reject mapping"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      <button
        onClick={onEdit}
        className="p-1 text-gray-600 hover:bg-gray-50 rounded"
        title="Edit mapping"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
    </div>
  );
}

// ============================================
// FILTER BAR
// ============================================

function FilterBar() {
  const { filterStatus, searchQuery, setFilterStatus, setSearchQuery, getConfigCompleteness } =
    useTenantConfigStore();

  const completeness = getConfigCompleteness();

  const statusOptions: Array<{ value: MappingStatus | 'all'; label: string; count?: number }> = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending', count: completeness.pending },
    { value: 'auto', label: 'Auto', count: completeness.auto },
    { value: 'confirmed', label: 'Confirmed', count: completeness.confirmed },
    { value: 'rejected', label: 'Rejected', count: completeness.rejected },
  ];

  return (
    <div className="flex items-center justify-between gap-4 p-4 bg-gray-50 border-b">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Filter:</span>
        <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden">
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterStatus(opt.value)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                filterStatus === opt.value
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {opt.label}
              {opt.count !== undefined && (
                <span className="ml-1 text-xs opacity-70">({opt.count})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search fields..."
            className="w-64 pl-8 pr-4 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN TABLE
// ============================================

interface FieldMappingTableProps {
  onSelectField?: (fieldId: string) => void;
}

export function FieldMappingTable({ onSelectField }: FieldMappingTableProps) {
  const {
    config,
    selectedFieldId,
    getFilteredMappings,
    confirmMapping,
    rejectMapping,
    setSelectedField,
  } = useTenantConfigStore();

  const filteredMappings = useMemo(() => getFilteredMappings(), [getFilteredMappings]);

  if (!config) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No tenant configuration loaded. Run discovery first.
      </div>
    );
  }

  if (filteredMappings.length === 0) {
    return (
      <div className="flex flex-col">
        <FilterBar />
        <div className="flex items-center justify-center h-64 text-gray-500">
          No mappings match the current filters.
        </div>
      </div>
    );
  }

  const handleSelect = (fieldId: string) => {
    setSelectedField(fieldId);
    onSelectField?.(fieldId);
  };

  return (
    <div className="flex flex-col h-full">
      <FilterBar />

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-700">
                Canonical Field
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">
                Tenant Source
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">
                Status
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">
                Confidence
              </th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredMappings.map((mapping) => (
              <tr
                key={mapping.canonicalFieldId}
                onClick={() => handleSelect(mapping.canonicalFieldId)}
                className={`cursor-pointer transition-colors ${
                  selectedFieldId === mapping.canonicalFieldId
                    ? 'bg-blue-50'
                    : 'hover:bg-gray-50'
                }`}
              >
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-900">
                      {mapping.canonicalFieldName}
                    </span>
                    <span className="text-xs text-gray-500 font-mono">
                      {mapping.canonicalFieldId}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <SourceDisplay source={mapping.tenantSource} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge
                    status={mapping.status}
                    reconciliationStatus={mapping.reconciliationStatus}
                  />
                </td>
                <td className="px-4 py-3">
                  <ConfidenceIndicator confidence={mapping.confidence} />
                </td>
                <td className="px-4 py-3 text-right">
                  <ActionButtons
                    mapping={mapping}
                    onConfirm={() => confirmMapping(mapping.canonicalFieldId)}
                    onReject={() => rejectMapping(mapping.canonicalFieldId)}
                    onEdit={() => handleSelect(mapping.canonicalFieldId)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default FieldMappingTable;
