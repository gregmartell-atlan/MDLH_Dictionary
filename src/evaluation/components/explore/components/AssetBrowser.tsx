// ============================================
// ASSET BROWSER
// Main container with tree/list view toggle and search
// ============================================

import { useState, useCallback, useMemo } from 'react';
import {
  Search,
  TreeDeciduous,
  List,
  Plus,
  X,

} from 'lucide-react';
import { AssetTreeView } from './AssetTreeView';
import { AssetListView } from './AssetListView';
import { IncludeChildrenModal } from './IncludeChildrenModal';
import { useCatalogStore, type CatalogAsset } from '../../../stores/catalogStore';
import { useModelStore } from '../../../stores/modelStore';

const EMPTY_ARRAY: any[] = [];

import {
  catalogAssetsToEntitiesWithRelationships,
  getChildCounts,
  getChildAssets,
  getCanvasBounds,
} from '../../../utils/atlanImport';

type ViewMode = 'tree' | 'list';

interface AssetBrowserProps {
  /** Optional callback when assets are added to canvas */
  onAssetsAdded?: (count: number) => void;
}

export function AssetBrowser({ onAssetsAdded }: AssetBrowserProps) {
  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGuids, setSelectedGuids] = useState<Set<string>>(new Set());

  // Modal state for include children prompt
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    asset: CatalogAsset | null;
    childCounts: { schemas: number; tables: number; columns: number; total: number };
  }>({
    isOpen: false,
    asset: null,
    childCounts: { schemas: 0, tables: 0, columns: 0, total: 0 },
  });

  // Dragging state
  const [, setDraggingAssets] = useState<CatalogAsset[]>([]);

  // Store access
  const assets = useCatalogStore((state) => state.assets);
  const hierarchy = useCatalogStore((state) => state.getHierarchy());
  const markAddedToCanvas = useCatalogStore((state) => state.markAddedToCanvas);

  const importEntities = useModelStore((state) => state.importEntities);
  const addEdges = useModelStore((state) => state.addEdges);
  const modelEntities = useModelStore((state) => {
    const activePage = state.model.pages.find(p => p.id === state.model.activePageId);
    return activePage?.entities || EMPTY_ARRAY;
  });

  // Filter assets based on search
  const filteredAssets = useMemo(() => {
    if (!searchQuery.trim()) return assets;

    const q = searchQuery.toLowerCase();
    return assets.filter(
      (asset) =>
        asset.name.toLowerCase().includes(q) ||
        asset.qualifiedName.toLowerCase().includes(q) ||
        (asset.connectorName || '').toLowerCase().includes(q)
    );
  }, [assets, searchQuery]);

  // Handle tree node drag start
  const handleTreeDragStart = useCallback((asset: CatalogAsset) => {
    // Check if this is a container type (Database or Schema)
    const isContainer = asset.normalizedType === 'Database' || asset.normalizedType === 'Schema';

    if (isContainer) {
      // Get child counts to show in modal
      const childCounts = getChildCounts(asset, assets);
      if (childCounts.total > 0) {
        setDraggingAssets([asset]);
        setModalState({
          isOpen: true,
          asset,
          childCounts,
        });
        return;
      }
    }

    // For non-containers or containers without children, add directly
    setDraggingAssets([asset]);
  }, [assets]);

  // Handle list drag start
  const handleListDragStart = useCallback((draggedAssets: CatalogAsset[]) => {
    setDraggingAssets(draggedAssets);
  }, []);

  // Handle adding assets to canvas
  const addAssetsToCanvas = useCallback((assetsToAdd: CatalogAsset[], includeChildren: boolean, includeColumns: boolean = false) => {
    let finalAssets = [...assetsToAdd];

    // If including children, expand the selection
    if (includeChildren) {
      assetsToAdd.forEach((asset) => {
        const children = getChildAssets(asset, assets, includeColumns);
        finalAssets.push(...children);
      });
      // Deduplicate
      const seenGuids = new Set<string>();
      finalAssets = finalAssets.filter((a) => {
        if (seenGuids.has(a.guid)) return false;
        seenGuids.add(a.guid);
        return true;
      });
    }

    // Filter out assets already on canvas
    finalAssets = finalAssets.filter((a) => !a.addedToCanvas);

    if (finalAssets.length === 0) return;

    // Calculate start position based on existing canvas bounds
    const bounds = getCanvasBounds(modelEntities);
    const startPosition = {
      x: bounds.maxX > 0 ? bounds.maxX + 100 : 100,
      y: 100,
    };

    // Convert to entities with relationships
    const { entities, edges } = catalogAssetsToEntitiesWithRelationships(finalAssets, startPosition);

    // Import to canvas
    importEntities(entities);
    if (edges.length > 0) {
      addEdges(edges);
    }

    // Mark as added in catalog
    markAddedToCanvas(finalAssets.map((a) => a.guid));

    // Clear selection
    setSelectedGuids(new Set());
    setDraggingAssets([]);

    // Notify parent
    onAssetsAdded?.(entities.length);
  }, [assets, modelEntities, importEntities, addEdges, markAddedToCanvas, onAssetsAdded]);

  // Handle modal confirm
  const handleModalConfirm = useCallback((includeChildren: boolean, includeColumns?: boolean) => {
    if (modalState.asset) {
      addAssetsToCanvas([modalState.asset], includeChildren, includeColumns ?? false);
    }
    setModalState({ isOpen: false, asset: null, childCounts: { schemas: 0, tables: 0, columns: 0, total: 0 } });
  }, [modalState.asset, addAssetsToCanvas]);

  // Handle modal cancel
  const handleModalCancel = useCallback(() => {
    setModalState({ isOpen: false, asset: null, childCounts: { schemas: 0, tables: 0, columns: 0, total: 0 } });
    setDraggingAssets([]);
  }, []);

  // Handle list selection
  const handleToggleSelect = useCallback((guid: string) => {
    setSelectedGuids((prev) => {
      const next = new Set(prev);
      if (next.has(guid)) {
        next.delete(guid);
      } else {
        next.add(guid);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedGuids(new Set(filteredAssets.map((a) => a.guid)));
  }, [filteredAssets]);

  const handleDeselectAll = useCallback(() => {
    setSelectedGuids(new Set());
  }, []);

  // Handle adding selected assets
  const handleAddSelected = useCallback(() => {
    const selected = assets.filter((a) => selectedGuids.has(a.guid));
    if (selected.length === 0) return;

    // Check if any are containers with children
    const containersWithChildren = selected.filter((a) => {
      if (a.normalizedType !== 'Database' && a.normalizedType !== 'Schema') return false;
      const childCounts = getChildCounts(a, assets);
      return childCounts.total > 0;
    });

    if (containersWithChildren.length === 1) {
      // Show modal for single container
      const container = containersWithChildren[0];
      setModalState({
        isOpen: true,
        asset: container,
        childCounts: getChildCounts(container, assets),
      });
    } else {
      // Add all selected without children (user can expand later)
      addAssetsToCanvas(selected, false);
    }
  }, [assets, selectedGuids, addAssetsToCanvas]);

  // Asset click handler (for tree view)
  const handleAssetClick = useCallback((asset: CatalogAsset) => {
    handleToggleSelect(asset.guid);
  }, [handleToggleSelect]);

  const assetCount = assets.length;
  const notOnCanvasCount = assets.filter((a) => !a.addedToCanvas).length;

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-slate-800">Asset Browser</h3>
            <p className="text-xs text-slate-500">
              {notOnCanvasCount} of {assetCount} assets available
            </p>
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('tree')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'tree'
                  ? 'bg-white shadow text-blue-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              title="Tree View"
            >
              <TreeDeciduous size={18} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'list'
                  ? 'bg-white shadow text-blue-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              title="List View"
            >
              <List size={18} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {viewMode === 'tree' ? (
          <AssetTreeView
            hierarchy={hierarchy}
            onDragStart={handleTreeDragStart}
            onAssetClick={handleAssetClick}
            selectedAssetGuids={selectedGuids}
          />
        ) : (
          <AssetListView
            assets={filteredAssets}
            searchQuery={searchQuery}
            selectedGuids={selectedGuids}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
            onDragStart={handleListDragStart}
          />
        )}
      </div>

      {/* Footer with add button */}
      {selectedGuids.size > 0 && (
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={handleAddSelected}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Add {selectedGuids.size} {selectedGuids.size === 1 ? 'Asset' : 'Assets'} to Canvas
          </button>
        </div>
      )}

      {/* Include Children Modal */}
      <IncludeChildrenModal
        isOpen={modalState.isOpen}
        entityName={modalState.asset?.name || ''}
        entityType={modalState.asset?.normalizedType || 'Asset'}
        childCounts={modalState.childCounts}
        onConfirm={handleModalConfirm}
        onCancel={handleModalCancel}
      />
    </div>
  );
}

export default AssetBrowser;
