// ============================================
// ASSET CATALOG SIDEBAR
// Hierarchical, filterable view of imported Atlan assets
// ============================================

import { useState } from 'react';
import {
  Search,
  ChevronRight,
  ChevronDown,
  Database,
  Table,
  Columns,
  LayoutDashboard,
  FileText,
  GitBranch,
  Globe,
  Package,
  HelpCircle,
  Plus,
  CheckCircle,
  FolderTree,
  Layers,
  Eye,
} from 'lucide-react';
import { useCatalogStore, type HierarchyNode, type AssetTypeCategory, type CatalogAsset } from '../../stores/catalogStore';

// Icons for asset types
const TYPE_ICONS: Record<AssetTypeCategory, React.ReactNode> = {
  Database: <Database size={14} />,
  Schema: <FolderTree size={14} />,
  Table: <Table size={14} />,
  View: <Eye size={14} />,
  Column: <Columns size={14} />,
  Query: <FileText size={14} />,
  Dashboard: <LayoutDashboard size={14} />,
  Report: <FileText size={14} />,
  Dataset: <Package size={14} />,
  API: <Globe size={14} />,
  Pipeline: <GitBranch size={14} />,
  Other: <HelpCircle size={14} />,
};

// Colors for asset types
const TYPE_COLORS: Record<AssetTypeCategory, string> = {
  Database: '#8B5CF6',
  Schema: '#6366F1',
  Table: '#3B82F6',
  View: '#06B6D4',
  Column: '#6B7280',
  Query: '#F59E0B',
  Dashboard: '#EC4899',
  Report: '#F97316',
  Dataset: '#10B981',
  API: '#14B8A6',
  Pipeline: '#8B5CF6',
  Other: '#9CA3AF',
};

interface AssetCatalogProps {
  onAddToCanvas: (assets: CatalogAsset[]) => void;
}

export function AssetCatalog({ onAddToCanvas }: AssetCatalogProps) {
  const {
    assets,
    connectors,
    importedAt,
    selectedConnector,
    selectedTypes,
    searchQuery,
    showOnlyNotOnCanvas,
    setSelectedConnector,
    setSelectedTypes,
    setSearchQuery,
    setShowOnlyNotOnCanvas,
    getFilteredAssets,
    getHierarchy,
    getTypeBreakdown,
  } = useCatalogStore();

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');
  const [showFilters] = useState(true);

  const hierarchy = getHierarchy();
  const filteredAssets = getFilteredAssets();
  const typeBreakdown = getTypeBreakdown();

  // Toggle node expansion
  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  // Toggle asset selection
  const toggleAssetSelection = (guid: string) => {
    setSelectedAssets((prev) => {
      const next = new Set(prev);
      if (next.has(guid)) {
        next.delete(guid);
      } else {
        next.add(guid);
      }
      return next;
    });
  };

  // Select all visible assets
  const selectAll = () => {
    setSelectedAssets(new Set(filteredAssets.map((a) => a.guid)));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedAssets(new Set());
  };

  // Add selected assets to canvas
  const handleAddToCanvas = () => {
    const assetsToAdd = filteredAssets.filter((a) => selectedAssets.has(a.guid));
    onAddToCanvas(assetsToAdd);
    clearSelection();
  };

  // Toggle type filter
  const toggleTypeFilter = (type: AssetTypeCategory) => {
    if (selectedTypes.includes(type)) {
      setSelectedTypes(selectedTypes.filter((t) => t !== type));
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };

  // Render a hierarchy node
  const renderNode = (node: HierarchyNode, depth: number = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children.length > 0;
    const isAsset = node.type === 'asset';
    const isSelected = isAsset && selectedAssets.has(node.id);

    return (
      <div key={node.id}>
        <div
          className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-gray-100 rounded transition-colors ${
            isSelected ? 'bg-blue-50' : ''
          }`}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
          onClick={() => {
            if (isAsset) {
              toggleAssetSelection(node.id);
            } else if (hasChildren) {
              toggleNode(node.id);
            }
          }}
        >
          {/* Expand/collapse icon for non-assets */}
          {!isAsset && hasChildren && (
            <span className="text-gray-400">
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          )}

          {/* Type icon */}
          {isAsset && node.assetType ? (
            <span style={{ color: TYPE_COLORS[node.assetType] }}>
              {TYPE_ICONS[node.assetType]}
            </span>
          ) : node.type === 'connector' ? (
            <Database size={14} className="text-indigo-500" />
          ) : node.type === 'database' ? (
            <Database size={14} className="text-purple-500" />
          ) : node.type === 'schema' ? (
            <FolderTree size={14} className="text-blue-500" />
          ) : null}

          {/* Name */}
          <span
            className={`flex-1 truncate text-sm ${
              isAsset ? 'font-normal' : 'font-medium'
            }`}
            style={{ color: isAsset ? 'var(--text-secondary)' : 'var(--text-primary)' }}
            title={node.name}
          >
            {node.name}
          </span>

          {/* Asset count badge */}
          {!isAsset && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
              {node.assetCount}
            </span>
          )}

          {/* Type badge for assets */}
          {isAsset && node.assetType && (
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: `${TYPE_COLORS[node.assetType]}15`,
                color: TYPE_COLORS[node.assetType],
              }}
            >
              {node.assetType}
            </span>
          )}

          {/* Added to canvas indicator */}
          {isAsset && node.asset?.addedToCanvas && (
            <CheckCircle size={14} className="text-green-500" />
          )}
        </div>

        {/* Children */}
        {isExpanded && hasChildren && (
          <div>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Empty state
  if (assets.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
        <Layers size={48} className="text-gray-300 mb-4" />
        <h3 className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
          No assets imported
        </h3>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Import assets from Atlan to browse and add them to your model
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            Asset Catalog
          </h2>
          <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600">
            {assets.length} assets
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="px-4 py-3 border-b border-gray-100 space-y-3">
          {/* Connector filter */}
          {connectors.length > 1 && (
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">
                Connector
              </label>
              <select
                value={selectedConnector || ''}
                onChange={(e) => setSelectedConnector(e.target.value || null)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All connectors</option>
                {connectors.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Type filters */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">
              Asset Types
            </label>
            <div className="flex flex-wrap gap-1">
              {typeBreakdown.slice(0, 8).map(({ type, count }) => (
                <button
                  key={type}
                  onClick={() => toggleTypeFilter(type)}
                  className={`flex items-center gap-1 px-2 py-1 text-xs rounded-full transition-colors ${
                    selectedTypes.includes(type)
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {TYPE_ICONS[type]}
                  <span>{type}</span>
                  <span className="text-gray-400">({count})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Show only not on canvas */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlyNotOnCanvas}
              onChange={(e) => setShowOnlyNotOnCanvas(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span style={{ color: 'var(--text-secondary)' }}>Hide assets already on canvas</span>
          </label>
        </div>
      )}

      {/* Selection actions */}
      {selectedAssets.size > 0 && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
          <span className="text-sm text-blue-700">
            {selectedAssets.size} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={clearSelection}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Clear
            </button>
            <button
              onClick={handleAddToCanvas}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={14} />
              Add to Canvas
            </button>
          </div>
        </div>
      )}

      {/* Bulk actions */}
      {selectedAssets.size === 0 && filteredAssets.length > 0 && (
        <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {filteredAssets.length} assets showing
          </span>
          <button
            onClick={selectAll}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            Select all
          </button>
        </div>
      )}

      {/* Asset list/tree */}
      <div className="flex-1 overflow-y-auto">
        {viewMode === 'tree' ? (
          <div className="py-2">
            {hierarchy.map((node) => renderNode(node))}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredAssets.map((asset) => (
              <div
                key={asset.guid}
                className={`flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-gray-50 ${
                  selectedAssets.has(asset.guid) ? 'bg-blue-50' : ''
                }`}
                onClick={() => toggleAssetSelection(asset.guid)}
              >
                <span style={{ color: TYPE_COLORS[asset.normalizedType] }}>
                  {TYPE_ICONS[asset.normalizedType]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {asset.name}
                  </div>
                  <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                    {asset.qualifiedName}
                  </div>
                </div>
                <span
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: `${TYPE_COLORS[asset.normalizedType]}15`,
                    color: TYPE_COLORS[asset.normalizedType],
                  }}
                >
                  {asset.normalizedType}
                </span>
                {asset.addedToCanvas && <CheckCircle size={14} className="text-green-500" />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
        <span>
          Imported {importedAt ? new Date(importedAt).toLocaleDateString() : ''}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('tree')}
            className={`p-1 rounded ${viewMode === 'tree' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
            title="Tree view"
          >
            <FolderTree size={14} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1 rounded ${viewMode === 'list' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
            title="List view"
          >
            <Layers size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
