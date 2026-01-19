import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { WelcomeScreen } from '../WelcomeScreen';
import { useModelStore } from '../../stores/modelStore';
import { useCatalogStore } from '../../stores/catalogStore';
import { useGovernanceStore } from '../../stores/governanceStore';
import { useUIStore } from '../../stores/uiStore';

const EMPTY_ARRAY: any[] = [];

export function WelcomeFlow() {
  const navigate = useNavigate();
  const clearModel = useModelStore((state) => state.clearModel);
  const clearCatalog = useCatalogStore((state) => state.clearCatalog);
  const clearGovernance = useGovernanceStore((state) => state.clearGovernance);
  const openAtlanConnectionModal = useUIStore((state) => state.openAtlanConnectionModal);

  const modelEntities = useModelStore((state) => {
    const activePage = state.model.pages.find(p => p.id === state.model.activePageId);
    return activePage?.entities || EMPTY_ARRAY;
  });
  const catalogAssets = useCatalogStore((state) => state.assets);

  const handleStartFresh = useCallback(() => {
    clearModel();
    clearCatalog();
    clearGovernance();
    navigate('/app/designer');
  }, [clearModel, clearCatalog, clearGovernance, navigate]);

  const handleImportFromAtlan = useCallback(() => {
    navigate('/import');
  }, [navigate]);

  const handleExplore = useCallback(() => {
    navigate('/app/explore');
    openAtlanConnectionModal();
  }, [navigate, openAtlanConnectionModal]);

  const handleModelingAssistant = useCallback(() => {
    navigate('/app/assistant');
  }, [navigate]);

  const handleContinue = useCallback(() => {
    navigate(catalogAssets.length > 0 ? '/app/explore' : '/app/designer');
  }, [catalogAssets.length, navigate]);

  return (
    <WelcomeScreen
      onExplore={handleExplore}
      onStartFresh={handleStartFresh}
      onModelingAssistant={handleModelingAssistant}
      onImportFromAtlan={handleImportFromAtlan}
      onContinue={handleContinue}
      hasExistingModel={modelEntities.length > 0 || catalogAssets.length > 0}
      existingEntityCount={modelEntities.length}
      catalogAssetCount={catalogAssets.length}
    />
  );
}
