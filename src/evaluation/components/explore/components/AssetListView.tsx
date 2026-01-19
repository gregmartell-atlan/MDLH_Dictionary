// ============================================
// ASSET LIST VIEW
// Flat searchable list with checkboxes for multi-select
// ============================================

import { useCallback, useMemo } from 'react';
import {
  Database,
  Folder,
  Table,
  Eye,
  Columns,
  BarChart3,
  FileCode,
  Box,
  Check,
  GripVertical,
  CheckSquare,
  Square,
} from 'lucide-react';
import type { CatalogAsset, AssetTypeCategory } from '../../../stores/catalogStore';

interface AssetListViewProps {
  assets: CatalogAsset[];
  searchQuery: string;
  selectedGuids: Set<string>;
  onToggleSelect: (guid: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDragStart: (assets: CatalogAsset[]) => void;
}

// Get icon for asset type
function getAssetIcon(type: AssetTypeCategory) {
  switch (type) {
    case 'Database':
      return <Database size={16} className="text-blue-500" />;
    case 'Schema':
      return <Folder size={16} className="text-amber-500" />;
    case 'Table':
      return <Table size={16} className="text-emerald-500" />;
    case 'View':
      return <Eye size={16} className="text-purple-500" />;
    case 'Column':
      return <Columns size={16} className="text-slate-500" />;
    case 'Dashboard':
      return <BarChart3 size={16} className="text-pink-500" />;
    case 'Report':
      return <FileCode size={16} className="text-orange-500" />;
    case 'Pipeline':
      return <Box size={16} className="text-cyan-500" />;
    default:
      return <Box size={16} className="text-slate-400" />;
  }
}

// Get background color for asset type
function getTypeBgColor(type: AssetTypeCategory): string {
  switch (type) {
    case 'Database':
      return 'bg-blue-50';
    case 'Schema':
      return 'bg-amber-50';
    case 'Table':
      return 'bg-emerald-50';
    case 'View':
      return 'bg-purple-50';
    case 'Column':
      return 'bg-slate-50';
    case 'Dashboard':
      return 'bg-pink-50';
    case 'Report':
      return 'bg-orange-50';
    default:
      return 'bg-slate-50';
  }
}

// Single asset row component
function AssetRow({
  asset,
  isSelected,
  onToggleSelect,
  onDragStart,
}: {
  asset: CatalogAsset;
  isSelected: boolean;
  onToggleSelect: (guid: string) => void;
  onDragStart: (assets: CatalogAsset[]) => void;
}) {
  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData('application/json', JSON.stringify({
        type: 'catalog-asset',
        asset,
      }));
      e.dataTransfer.effectAllowed = 'copy';
      onDragStart([asset]);
    },
    [asset, onDragStart]
  );

  return (
    <div
      className={`
        flex items-center gap-3 px-3 py-2.5 border-b border-slate-100
        transition-colors duration-150 cursor-pointer
        ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}
        ${asset.addedToCanvas ? 'opacity-50' : ''}
      `}
      onClick={() => onToggleSelect(asset.guid)}
      draggable
      onDragStart={handleDragStart}
    >
      {/* Checkbox */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect(asset.guid);
        }}
        className="text-slate-400 hover:text-blue-600"
      >
        {isSelected ? (
          <CheckSquare size={18} className="text-blue-600" />
        ) : (
          <Square size={18} />
        )}
      </button>

      {/* Drag handle */}
      <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500">
        <GripVertical size={16} />
      </div>

      {/* Type icon */}
      <span className={`p-1.5 rounded ${getTypeBgColor(asset.normalizedType)}`}>
        {getAssetIcon(asset.normalizedType)}
      </span>

      {/* Asset info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-slate-800 truncate">
            {asset.name}
          </span>
          {asset.addedToCanvas && (
            <span className="text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full flex items-center gap-1">
              <Check size={10} />
              on canvas
            </span>
          )}
        </div>
        <div className="text-xs text-slate-500 truncate">
          {asset.database && asset.schema
            ? `${asset.database} / ${asset.schema}`
            : asset.qualifiedName}
        </div>
      </div>

      {/* Type badge */}
      <span className="text-[10px] uppercase text-slate-400 font-medium px-2 py-1 bg-slate-100 rounded">
        {asset.normalizedType}
      </span>

      {/* Connector badge */}
      {asset.connectorName && (
        <span className="text-[10px] text-slate-500 px-2 py-1 bg-slate-50 rounded border border-slate-200">
          {asset.connectorName}
        </span>
      )}
    </div>
  );
}

export function AssetListView({
  assets,
  searchQuery,
  selectedGuids,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onDragStart,
}: AssetListViewProps) {
  // Filter assets by search query
  const filteredAssets = useMemo(() => {
    if (!searchQuery.trim()) return assets;

    const q = searchQuery.toLowerCase();
    return assets.filter(
      (asset) =>
        asset.name.toLowerCase().includes(q) ||
        asset.qualifiedName.toLowerCase().includes(q) ||
        (asset.connectorName || '').toLowerCase().includes(q) ||
        asset.normalizedType.toLowerCase().includes(q)
    );
  }, [assets, searchQuery]);

  // Group by type for organization
  const groupedAssets = useMemo(() => {
    const groups: Partial<Record<AssetTypeCategory, CatalogAsset[]>> = {};

    filteredAssets.forEach((asset) => {
      const key = asset.normalizedType;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(asset);
    });

    // Sort groups by hierarchy level
    const order: AssetTypeCategory[] = [
      'Database',
      'Schema',
      'Table',
      'View',
      'Column',
      'Dashboard',
      'Report',
      'Dataset',
      'API',
      'Pipeline',
      'Query',
      'Other',
    ];

    return order
      .filter((type) => (groups[type]?.length ?? 0) > 0)
      .map((type) => ({
        type,
        assets: groups[type] ?? [],
      }));
  }, [filteredAssets]);

  const allSelected = filteredAssets.length > 0 && filteredAssets.every((a) => selectedGuids.has(a.guid));
  const someSelected = filteredAssets.some((a) => selectedGuids.has(a.guid));

  if (filteredAssets.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
        {searchQuery ? 'No assets match your search' : 'No assets to display'}
      </div>
    );
  }

  return (
    <div>
      {/* Header with select all */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={allSelected ? onDeselectAll : onSelectAll}
            className="text-slate-500 hover:text-blue-600"
          >
            {allSelected ? (
              <CheckSquare size={18} className="text-blue-600" />
            ) : someSelected ? (
              <CheckSquare size={18} className="text-blue-400" />
            ) : (
              <Square size={18} />
            )}
          </button>
          <span className="text-sm text-slate-600">
            {selectedGuids.size > 0
              ? `${selectedGuids.size} selected`
              : `${filteredAssets.length} assets`}
          </span>
        </div>

        {selectedGuids.size > 0 && (
          <button
            type="button"
            onClick={onDeselectAll}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            Clear selection
          </button>
        )}
      </div>

      {/* Asset list grouped by type */}
      <div className="max-h-[500px] overflow-y-auto">
        {groupedAssets.map(({ type, assets: typeAssets }) => (
          <div key={type}>
            {/* Type header */}
            <div className="px-3 py-1.5 bg-slate-100 border-b border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {type} ({typeAssets.length})
              </span>
            </div>

            {/* Assets of this type */}
            {typeAssets.map((asset) => (
              <AssetRow
                key={asset.guid}
                asset={asset}
                isSelected={selectedGuids.has(asset.guid)}
                onToggleSelect={onToggleSelect}
                onDragStart={onDragStart}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default AssetListView;
