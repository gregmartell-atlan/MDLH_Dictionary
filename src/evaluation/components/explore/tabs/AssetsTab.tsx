// ============================================
// ASSETS TAB
// Asset browser with drag-to-canvas + navigation cards
// ============================================

import { useState, useCallback } from 'react';
import {
  Database,
  Layers,
  Tag,
  Settings,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { AssetBrowser } from '../components/AssetBrowser';
import type { ExploreDataState } from '../../../hooks/useExploreData';
import { useCatalogStore } from '../../../stores/catalogStore';

interface AssetsTabProps {
  data: ExploreDataState;
  onNavigate?: (view: string) => void;
}

export function AssetsTab({ data, onNavigate }: AssetsTabProps) {
  const {
    hierarchySuggestions,
    existingTags,
    existingBusinessAttributes,
    mode,
  } = data;

  const [addedCount, setAddedCount] = useState(0);
  const hasAssets = useCatalogStore((s) => s.assets.length > 0);

  // Handle assets added to canvas
  const handleAssetsAdded = useCallback((count: number) => {
    setAddedCount((prev) => prev + count);
    // Auto-clear after 3 seconds
    setTimeout(() => setAddedCount(0), 3000);
  }, []);

  if (mode !== 'imported' && mode !== 'hybrid' && !hasAssets) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Database size={48} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">
            Import Required
          </h3>
          <p className="text-sm text-gray-500 max-w-md">
            Asset browser and hierarchy suggestions are available after importing assets from Atlan.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Success notification */}
      {addedCount > 0 && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg shadow-lg animate-fadeIn">
          <CheckCircle2 size={18} className="text-emerald-600" />
          <span className="text-sm font-medium text-emerald-800">
            {addedCount} {addedCount === 1 ? 'asset' : 'assets'} added to canvas
          </span>
        </div>
      )}

      {/* Main layout: Browser on left, Quick Actions on right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Asset Browser - takes 2 columns */}
        <div className="lg:col-span-2">
          <AssetBrowser onAssetsAdded={handleAssetsAdded} />
        </div>

        {/* Quick Actions Sidebar */}
        <div className="space-y-4">
          <h3
            className="text-sm font-medium uppercase tracking-wider"
            style={{ color: 'var(--explore-text-muted)' }}
          >
            Quick Actions
          </h3>

          {/* Domain Structure Card */}
          <div
            className="explore-nav-card group cursor-pointer"
            onClick={() => onNavigate?.('domains')}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="explore-nav-card-icon"
                style={{ background: 'rgba(6, 182, 212, 0.1)' }}
              >
                <Layers size={18} style={{ color: 'rgb(6, 182, 212)' }} />
              </div>
              <div>
                <h4
                  className="font-medium text-sm"
                  style={{ color: 'var(--explore-text-primary)' }}
                >
                  Domain Structure
                </h4>
                <p
                  className="text-xs"
                  style={{ color: 'var(--explore-text-muted)' }}
                >
                  {hierarchySuggestions.databases.length} databases
                </p>
              </div>
            </div>
            <button
              className="w-full py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors"
              style={{
                background: 'rgba(6, 182, 212, 0.1)',
                color: 'rgb(6, 182, 212)',
              }}
            >
              Create Domains
              <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Taxonomy Card */}
          <div
            className="explore-nav-card group cursor-pointer"
            onClick={() => onNavigate?.('taxonomy')}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="explore-nav-card-icon"
                style={{ background: 'rgba(139, 92, 246, 0.1)' }}
              >
                <Tag size={18} style={{ color: 'rgb(139, 92, 246)' }} />
              </div>
              <div>
                <h4
                  className="font-medium text-sm"
                  style={{ color: 'var(--explore-text-primary)' }}
                >
                  Taxonomy
                </h4>
                <p
                  className="text-xs"
                  style={{ color: 'var(--explore-text-muted)' }}
                >
                  {existingTags.length} tags discovered
                </p>
              </div>
            </div>
            <button
              className="w-full py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors"
              style={{
                background: 'rgba(139, 92, 246, 0.1)',
                color: 'rgb(139, 92, 246)',
              }}
            >
              Build Taxonomy
              <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Custom Metadata Card */}
          <div
            className="explore-nav-card group cursor-pointer"
            onClick={() => onNavigate?.('custom-metadata')}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="explore-nav-card-icon"
                style={{ background: 'rgba(245, 158, 11, 0.1)' }}
              >
                <Settings size={18} style={{ color: 'rgb(245, 158, 11)' }} />
              </div>
              <div>
                <h4
                  className="font-medium text-sm"
                  style={{ color: 'var(--explore-text-primary)' }}
                >
                  Custom Metadata
                </h4>
                <p
                  className="text-xs"
                  style={{ color: 'var(--explore-text-muted)' }}
                >
                  {existingBusinessAttributes.length} schemas
                </p>
              </div>
            </div>
            <button
              className="w-full py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors"
              style={{
                background: 'rgba(245, 158, 11, 0.1)',
                color: 'rgb(245, 158, 11)',
              }}
            >
              Design Metadata
              <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Tip Card */}
          <div
            className="p-4 rounded-lg border"
            style={{
              background: 'var(--explore-card-bg)',
              borderColor: 'var(--explore-border)',
            }}
          >
            <h4
              className="text-xs font-medium uppercase tracking-wider mb-2"
              style={{ color: 'var(--explore-text-muted)' }}
            >
              Tip
            </h4>
            <p
              className="text-sm"
              style={{ color: 'var(--explore-text-secondary)' }}
            >
              Drag assets from the browser to the <strong>Model Canvas</strong> to visualize relationships and design your metadata model.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AssetsTab;
