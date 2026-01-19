// ============================================
// ASSET TREE VIEW
// Hierarchical tree with expand/collapse and drag handles
// ============================================

import { useState, useCallback, memo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Database,
  Folder,
  Table,
  Columns,
  GripVertical,
  Eye,
  BarChart3,
  FileCode,
  Box,
  Check,
} from 'lucide-react';
import type { HierarchyNode, CatalogAsset } from '../../../stores/catalogStore';

interface AssetTreeViewProps {
  hierarchy: HierarchyNode[];
  onDragStart: (asset: CatalogAsset, node: HierarchyNode) => void;
  onAssetClick?: (asset: CatalogAsset) => void;
  selectedAssetGuids?: Set<string>;
}

// Get icon for node type
function getNodeIcon(node: HierarchyNode) {
  if (node.type === 'connector') {
    return <Database size={16} className="text-indigo-500" />;
  }
  if (node.type === 'database') {
    return <Database size={16} className="text-blue-500" />;
  }
  if (node.type === 'schema') {
    return <Folder size={16} className="text-amber-500" />;
  }

  // Asset types
  const assetType = node.assetType || node.asset?.normalizedType;
  switch (assetType) {
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

// Individual tree node component
const TreeNode = memo(function TreeNode({
  node,
  level,
  onDragStart,
  onAssetClick,
  selectedAssetGuids,
}: {
  node: HierarchyNode;
  level: number;
  onDragStart: (asset: CatalogAsset, node: HierarchyNode) => void;
  onAssetClick?: (asset: CatalogAsset) => void;
  selectedAssetGuids?: Set<string>;
}) {
  // Auto-expand first two levels
  const [expanded, setExpanded] = useState(level < 2);
  const hasChildren = node.children.length > 0;
  const isAsset = node.type === 'asset' && node.asset;
  const isSelected = isAsset && node.asset && selectedAssetGuids?.has(node.asset.guid);
  const isAddedToCanvas = isAsset && node.asset?.addedToCanvas;

  const handleToggle = useCallback(() => {
    if (hasChildren) {
      setExpanded((prev) => !prev);
    }
  }, [hasChildren]);

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      if (!node.asset) return;

      // Set drag data
      e.dataTransfer.setData('application/json', JSON.stringify({
        type: 'catalog-asset',
        asset: node.asset,
        node: {
          id: node.id,
          name: node.name,
          type: node.type,
          assetType: node.assetType,
          assetCount: node.assetCount,
        },
      }));
      e.dataTransfer.effectAllowed = 'copy';

      // Notify parent
      onDragStart(node.asset, node);
    },
    [node, onDragStart]
  );

  const handleClick = useCallback(() => {
    if (isAsset && node.asset && onAssetClick) {
      onAssetClick(node.asset);
    } else {
      handleToggle();
    }
  }, [isAsset, node.asset, onAssetClick, handleToggle]);

  return (
    <div className="select-none">
      <div
        className={`
          flex items-center gap-1 py-1.5 px-2 rounded-lg cursor-pointer
          transition-colors duration-150
          ${isSelected ? 'bg-blue-100 border border-blue-300' : 'hover:bg-slate-100'}
          ${isAddedToCanvas ? 'opacity-50' : ''}
        `}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
        draggable={!!isAsset}
        onDragStart={handleDragStart}
      >
        {/* Expand/Collapse button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleToggle();
          }}
          className={`p-0.5 rounded hover:bg-slate-200 ${!hasChildren ? 'invisible' : ''}`}
        >
          {expanded ? (
            <ChevronDown size={14} className="text-slate-400" />
          ) : (
            <ChevronRight size={14} className="text-slate-400" />
          )}
        </button>

        {/* Drag handle (only for draggable items) */}
        {isAsset && (
          <div
            className="p-0.5 rounded cursor-grab hover:bg-slate-200 active:cursor-grabbing"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <GripVertical size={14} className="text-slate-400" />
          </div>
        )}

        {/* Icon */}
        <span className="flex-shrink-0">{getNodeIcon(node)}</span>

        {/* Label */}
        <span className="flex-1 truncate text-sm text-slate-700">{node.name}</span>

        {/* Asset count badge */}
        {node.assetCount > 0 && node.type !== 'asset' && (
          <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
            {node.assetCount}
          </span>
        )}

        {/* Added to canvas indicator */}
        {isAddedToCanvas && (
          <span className="text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full flex items-center gap-1">
            <Check size={10} />
            on canvas
          </span>
        )}

        {/* Asset type badge */}
        {isAsset && node.assetType && !isAddedToCanvas && (
          <span className="text-[10px] uppercase text-slate-400 font-medium">
            {node.assetType}
          </span>
        )}
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              onDragStart={onDragStart}
              onAssetClick={onAssetClick}
              selectedAssetGuids={selectedAssetGuids}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export function AssetTreeView({
  hierarchy,
  onDragStart,
  onAssetClick,
  selectedAssetGuids,
}: AssetTreeViewProps) {
  if (hierarchy.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
        No assets to display
      </div>
    );
  }

  return (
    <div className="py-2">
      {hierarchy.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          level={0}
          onDragStart={onDragStart}
          onAssetClick={onAssetClick}
          selectedAssetGuids={selectedAssetGuids}
        />
      ))}
    </div>
  );
}

export default AssetTreeView;
