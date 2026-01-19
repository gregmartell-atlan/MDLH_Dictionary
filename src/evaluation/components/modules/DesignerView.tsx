import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Canvas from '../canvas/Canvas';
import Toolbar, { type CanvasViewMode } from '../canvas/Toolbar';
import { SpreadsheetView } from '../spreadsheet';
import PageNavigator from '../canvas/PageNavigator';
import AssetPalette from '../palette/AssetPalette';
import EntityPanel from '../sidebar/EntityPanel';
import MultiSelectPanel from '../sidebar/MultiSelectPanel';
import { useUIStore } from '../../stores/uiStore';

const EMPTY_ARRAY: any[] = [];

export function DesignerView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const viewModeFromUrl = (searchParams.get('view') as CanvasViewMode) || 'canvas';
  const entityIdFromUrl = searchParams.get('entity');

  const [canvasViewMode, setCanvasViewMode] = useState<CanvasViewMode>(viewModeFromUrl);
  const selectedEntityIds = useUIStore((state) => state.selectedEntityIds || EMPTY_ARRAY);
  const selectEntity = useUIStore((state) => state.selectEntity);
  const navigate = useNavigate();

  // Sync URL with state
  useEffect(() => {
    const params = new URLSearchParams();
    if (canvasViewMode !== 'canvas') {
      params.set('view', canvasViewMode);
    }
    if (selectedEntityIds.length === 1) {
      params.set('entity', selectedEntityIds[0]);
    }
    setSearchParams(params, { replace: true });
  }, [canvasViewMode, selectedEntityIds, setSearchParams]);

  // Select entity from URL on mount
  useEffect(() => {
    if (entityIdFromUrl) {
      selectEntity(entityIdFromUrl);
    }
  }, [entityIdFromUrl, selectEntity]);

  const handleImportFromAtlan = () => {
    navigate('/import');
  };

  return (
    <>
      {/* Toolbar */}
      <Toolbar
        onImportFromAtlan={handleImportFromAtlan}
        viewMode={canvasViewMode}
        onViewModeChange={setCanvasViewMode}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Asset Palette with Canvas/Atlan/Types toggle */}
        {canvasViewMode === 'canvas' && (
          <AssetPalette />
        )}

        {/* Canvas or Spreadsheet View */}
        <div className="flex-1 flex flex-col">
          {canvasViewMode === 'canvas' ? (
            <>
              <Canvas />
              <PageNavigator />
            </>
          ) : (
            <SpreadsheetView />
          )}
        </div>

        {/* Right Sidebar - Entity Panel or Multi-Select Panel (only for canvas mode) */}
        {canvasViewMode === 'canvas' && (
          selectedEntityIds.length >= 2 ? (
            <MultiSelectPanel />
          ) : (
            <EntityPanel />
          )
        )}
      </div>
    </>
  );
}
