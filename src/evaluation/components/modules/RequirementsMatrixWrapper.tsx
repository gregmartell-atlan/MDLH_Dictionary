/**
 * RequirementsMatrixWrapper - Connects RequirementsMatrix to the model store
 *
 * This wrapper:
 * 1. Reads requirementsMatrix from modelStore
 * 2. Provides onSave callback to persist changes
 * 3. Passes field coverage data from imported entities
 * 4. Provides scope filtering for imported assets
 */

import { useModelStore } from '../../stores/modelStore';
import { useFieldCoverage, type FieldCoverageFilter } from '../../hooks/useFieldCoverage';
import { useScopeFilter } from '../../hooks/useScopeFilter';
import { PlanWorkspace } from './PlanWorkspace';
import { PlanManager } from './PlanManager';
import type { EnrichmentPlan } from '../../types/enrichment-plan';
import type { EntityDefinition } from '../../types';

const EMPTY_PLANS: EnrichmentPlan[] = [];
const EMPTY_ENTITIES: EntityDefinition[] = [];

export function RequirementsMatrixWrapper() {
  // Get plans and active plan state
  const plans = useModelStore((state) => state.model.enrichmentPlans || EMPTY_PLANS);
  const activePlanId = useModelStore((state) => state.activePlanId);
  const setActivePlanId = useModelStore((state) => state.setActivePlanId);

  // Get active plan object
  const activePlan = plans.find(p => p.id === activePlanId);

  // Get scope filter state
  const { filter, isFiltered } = useScopeFilter();

  // Build filter for field coverage
  const coverageFilter: FieldCoverageFilter | undefined = isFiltered ? {
    connector: filter.connector || undefined,
    database: filter.database || undefined,
    schema: filter.schema || undefined,
    assetTypes: filter.assetTypes?.length > 0 ? filter.assetTypes : undefined,
  } : undefined;

  // Get entities from the active page for field coverage analysis
  const modelEntities = useModelStore((state) => {
    const activePage = state.model.pages.find(p => p.id === state.model.activePageId);
    return activePage?.entities || EMPTY_ENTITIES;
  });

  // Calculate field coverage from current entities with filter applied
  const fieldCoverage = useFieldCoverage(modelEntities, coverageFilter);

  // If no plan is selected, show the Plan Manager
  if (!activePlanId || !activePlan) {
    return <PlanManager onSelectPlan={setActivePlanId} />;
  }

  return (
    <PlanWorkspace 
      planId={activePlanId}
      onBack={() => setActivePlanId(null)}
      fieldCoverage={fieldCoverage}
    />
  );
}
