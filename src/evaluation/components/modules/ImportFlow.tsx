import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScopedImport } from '../ScopedImport';
import { useCatalogStore } from '../../stores/catalogStore';
import { useGovernanceStore } from '../../stores/governanceStore';
import { useModelStore } from '../../stores/modelStore';
import type { AtlanAssetSummary } from '../../services/atlanApi';

const EMPTY_ARRAY: any[] = [];

export function ImportFlow() {
  const navigate = useNavigate();
  const importAssets = useCatalogStore((state) => state.importAssets);
  const setImportScope = useCatalogStore((state) => state.setImportScope);
  const extractMetadataFromAssets = useCatalogStore((state) => state.extractMetadataFromAssets);
  const seedGovernance = useGovernanceStore((state) => state.seedFromCatalogIfEmpty);
  
  const modelEntities = useModelStore((state) => {
    const activePage = state.model.pages.find(p => p.id === state.model.activePageId);
    return activePage?.entities || EMPTY_ARRAY;
  });
  const catalogAssets = useCatalogStore((state) => state.assets);

  const handleImportComplete = useCallback((assets: AtlanAssetSummary[], scope: { connector: string; database?: string; schema?: string }) => {
    importAssets(assets, [scope.connector]);
    setImportScope({
      connector: scope.connector,
      database: scope.database,
      schema: scope.schema,
      importedAt: new Date().toISOString(),
      assetCount: assets.length,
    });
    extractMetadataFromAssets();
    const currentCatalogAssets = useCatalogStore.getState().assets;
    seedGovernance(currentCatalogAssets);
    navigate('/app/explore');
  }, [importAssets, setImportScope, extractMetadataFromAssets, seedGovernance, navigate]);

  const handleBack = () => {
    if (modelEntities.length > 0 || catalogAssets.length > 0) {
      navigate('/app/designer');
    } else {
      navigate('/');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-white animate-in slide-in-from-bottom-10 duration-200">
      <ScopedImport
        onBack={handleBack}
        onImport={handleImportComplete}
      />
    </div>
  );
}
