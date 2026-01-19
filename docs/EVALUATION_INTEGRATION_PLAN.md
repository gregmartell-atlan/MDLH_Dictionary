# Integration Plan: atlan-metadata-evaluation → MDLH Explorer

> **Goal:** Full merger of the `atlan-metadata-evaluation` repo into MDLH Explorer, adapting all components to use Snowflake/MDLH as the data source.

---

## Executive Summary

The `atlan-metadata-evaluation` project contains a sophisticated metadata assessment platform with:
- **10 canonical signals** (Ownership, Semantics, Lineage, Sensitivity, Access, Quality, Freshness, Usage, AI Readiness, Trust)
- **60+ unified field definitions** with source mappings
- **Scoring engines** (Impact/Quality quadrants, gap analysis, plan generation)
- **Tenant configuration** and field reconciliation
- **Assistant wizard** for guided metadata planning
- **V2 Run UI** (Assessment → Model → Plan → Export)

All components currently fetch data via Atlan REST API. We will adapt them to use MDLH Snowflake queries through the existing MDLH backend.

---

## Component Inventory

### Core Domain Logic (TypeScript → JavaScript Port)

| Source Path | Target Path | Description |
|-------------|-------------|-------------|
| `assessment/packages/domain/src/catalog/unified-fields.ts` | `src/evaluation/catalog/unifiedFields.js` | 60+ field definitions |
| `assessment/packages/domain/src/catalog/signal-definitions.ts` | `src/evaluation/catalog/signalDefinitions.js` | 10 canonical signals |
| `assessment/packages/domain/src/catalog/signal-composer.ts` | `src/evaluation/catalog/signalComposer.js` | Signal aggregation |
| `assessment/packages/domain/src/catalog/field-evaluator.ts` | `src/evaluation/catalog/fieldEvaluator.js` | Field presence checks |
| `assessment/packages/domain/src/catalog/use-case-profiles.ts` | `src/evaluation/catalog/useCaseProfiles.js` | Use case → field mappings |
| `assessment/packages/domain/src/engines/score-engine.ts` | `src/evaluation/engines/scoreEngine.js` | Impact/Quality scoring |
| `assessment/packages/domain/src/engines/gap-engine.ts` | `src/evaluation/engines/gapEngine.js` | Gap identification |
| `assessment/packages/domain/src/engines/plan-engine.ts` | `src/evaluation/engines/planEngine.js` | Remediation planning |
| `assessment/packages/domain/src/engines/signal-mapper.ts` | `src/evaluation/engines/signalMapper.js` | Field → Signal mapping |
| `assessment/packages/domain/src/engines/explanation-generator.ts` | `src/evaluation/engines/explanationGenerator.js` | Human-readable explanations |
| `assessment/packages/domain/src/models/*.ts` | `src/evaluation/models/*.js` | Type definitions |
| `assessment/packages/domain/src/discovery/tenant-config.ts` | `src/evaluation/discovery/tenantConfig.js` | Tenant configuration |
| `assessment/packages/domain/src/discovery/tenant-discovery.ts` | `src/evaluation/discovery/tenantDiscovery.js` | Auto-discover tenant metadata |
| `assessment/packages/domain/src/discovery/field-reconciliation.ts` | `src/evaluation/discovery/fieldReconciliation.js` | Reconcile expected vs actual |
| `assessment/packages/domain/src/assessment/asset-fetcher.ts` | `src/evaluation/assessment/assetFetcher.js` | **CRITICAL: Replace with MDLH fetcher** |
| `assessment/packages/domain/src/assessment/scope-resolver.ts` | `src/evaluation/assessment/scopeResolver.js` | Scope filtering |
| `assessment/packages/domain/src/assessment/rollup-engine.ts` | `src/evaluation/assessment/rollupEngine.js` | Aggregate scores |
| `assessment/packages/domain/src/assessment/use-case-assessor.ts` | `src/evaluation/assessment/useCaseAssessor.js` | Use case readiness |
| `assessment/packages/domain/src/requirements/capability-requirements.ts` | `src/evaluation/requirements/capabilityRequirements.js` | Required signals per capability |

### UI Components (TypeScript → JavaScript Port)

| Source Path | Target Path | Description |
|-------------|-------------|-------------|
| `src/components/assistant/*` | `src/components/evaluation/assistant/*` | Wizard steps 0-5 |
| `src/components/tenant-config/*` | `src/components/evaluation/tenantConfig/*` | Field mapping, reconciliation |
| `src/components/v2run/*` | `src/components/evaluation/v2run/*` | Assessment flow UI |
| `src/components/evidence/*` | `src/components/evaluation/evidence/*` | Evidence drawers |
| `src/components/priority/*` | `src/components/evaluation/priority/*` | Priority views |
| `src/components/audit/*` | `src/components/evaluation/audit/*` | Audit panels |
| `src/components/explore/*` | `src/components/evaluation/explore/*` | Explore dashboard |
| `assessment/packages/web/components/*` | `src/components/evaluation/web/*` | Next.js components (adapt to React) |

### Stores (Zustand → Keep as Zustand or adapt to existing patterns)

| Source Path | Target Path | Description |
|-------------|-------------|-------------|
| `src/stores/tenantConfigStore.ts` | `src/stores/tenantConfigStore.js` | Tenant configuration state |
| `src/stores/assistantStore.ts` | `src/stores/assistantStore.js` | Assistant wizard state |
| `src/stores/governanceStore.ts` | `src/stores/governanceStore.js` | Governance state |
| `src/stores/evidenceStore.ts` | `src/stores/evidenceStore.js` | Evidence/audit state |
| `src/stores/catalogStore.ts` | `src/stores/catalogStore.js` | Catalog state |
| `src/stores/enrichmentPlanStore.ts` | `src/stores/enrichmentPlanStore.js` | Plan state |
| `src/stores/modelStore.ts` | `src/stores/modelStore.js` | Model designer state |
| `assessment/packages/web/lib/evaluationStore.ts` | `src/stores/evaluationStore.js` | Evaluation results |

### Data Modules

| Source Path | Target Path | Description |
|-------------|-------------|-------------|
| `src/data/completeness-scoring.ts` | `src/data/evaluation/completenessScoring.js` | Scoring weights |
| `src/data/custom-fields-*.ts` | `src/data/evaluation/customFields/*.js` | Custom field definitions |
| `src/data/persona-*.ts` | `src/data/evaluation/persona/*.js` | Persona profiles |
| `src/data/use-case-field-recommendations.ts` | `src/data/evaluation/useCaseRecommendations.js` | Use case → field recommendations |
| `src/data/user-story-library.ts` | `src/data/evaluation/userStoryLibrary.js` | User story templates |
| `src/data/enrichment-techniques.ts` | `src/data/evaluation/enrichmentTechniques.js` | Enrichment strategies |
| `src/data/roadmap-generator.ts` | `src/data/evaluation/roadmapGenerator.js` | Roadmap generation |
| `src/data/strategy-scout.ts` | `src/data/evaluation/strategyScout.js` | Strategy recommendations |
| `assessment/packages/domain/src/catalog/unified-fields.ts` | `src/data/evaluation/unifiedFieldCatalog.js` | **Master field catalog** |

### Services (TypeScript → JavaScript)

| Source Path | Target Path | Description |
|-------------|-------------|-------------|
| `src/services/mdlhQueries.ts` | `src/services/evaluation/mdlhQueries.js` | **Already has MDLH SQL!** |
| `src/services/mdlhService.ts` | `src/services/evaluation/mdlhService.js` | **Already has MDLH service!** |
| `src/services/planService.ts` | `src/services/evaluation/planService.js` | Plan management |
| `src/services/planComparisonEngine.ts` | `src/services/evaluation/planComparisonEngine.js` | Plan comparison |
| `src/services/unified-assessment-adapter.ts` | `src/services/evaluation/unifiedAssessmentAdapter.js` | Assessment adapter |
| `assessment/packages/web/lib/reconciliation-engine.ts` | `src/services/evaluation/reconciliationEngine.js` | Field reconciliation |
| `assessment/packages/web/lib/tenant-aware-evaluator.ts` | `src/services/evaluation/tenantAwareEvaluator.js` | Tenant-aware scoring |

### Engines (from src/engines/)

| Source Path | Target Path | Description |
|-------------|-------------|-------------|
| `src/engines/anti-pattern-detector.ts` | `src/evaluation/engines/antiPatternDetector.js` | Detect governance anti-patterns |
| `src/engines/gap-analysis.ts` | `src/evaluation/engines/gapAnalysis.js` | Gap analysis |
| `src/engines/impact-simulator.ts` | `src/evaluation/engines/impactSimulator.js` | Impact simulation |
| `src/engines/pattern-matcher.ts` | `src/evaluation/engines/patternMatcher.js` | Pattern matching |
| `src/engines/persona-views.ts` | `src/evaluation/engines/personaViews.js` | Persona-based views |
| `src/engines/priority-engine.ts` | `src/evaluation/engines/priorityEngine.js` | Priority scoring |
| `src/engines/validation-engine.ts` | `src/evaluation/engines/validationEngine.js` | Validation |

---

## Critical Adaptation: MDLH Data Fetcher

The most important change is replacing the `AtlanApiFetcher` with an `MDLHSnowflakeFetcher`.

### Current: Atlan REST API

```typescript
// assessment/packages/domain/src/assessment/asset-fetcher.ts
export class AtlanApiFetcher implements AssetFetcher {
  async fetchAssets(scope, tenantConfig) {
    // Calls Atlan REST API: /api/meta/search/indexsearch
  }
}
```

### New: MDLH Snowflake Fetcher

```javascript
// src/evaluation/assessment/mdlhAssetFetcher.js
export class MDLHAssetFetcher {
  constructor(snowflakeConnection, config) {
    this.connection = snowflakeConnection;
    this.config = config;
  }

  async fetchAssets(scope, tenantConfig) {
    const sql = this.buildAssetQuery(scope, tenantConfig);
    const result = await this.connection.executeQuery(sql);
    return result.rows.map(row => this.mapToAssetRecord(row));
  }

  buildAssetQuery(scope, tenantConfig) {
    const tables = this.getEntityTables(scope.assetTypes);
    const columns = this.getRequiredColumns(tenantConfig);
    
    return `
      SELECT ${columns.join(', ')}
      FROM ${tables.map(t => `${this.config.database}.${this.config.schema}.${t}`).join(' UNION ALL SELECT ... FROM ')}
      WHERE ${this.buildScopeFilter(scope)}
      ORDER BY POPULARITYSCORE DESC NULLS LAST
      LIMIT ${scope.sampleSize || 1000}
    `;
  }
}
```

---

## Field Mapping: Unified Fields → MDLH Columns

| Unified Field ID | MDLH Column | MDLH Tables |
|------------------|-------------|-------------|
| `owner_users` | `OWNERUSERS` | All `*_ENTITY` |
| `owner_groups` | `OWNERGROUPS` | All `*_ENTITY` |
| `description` | `DESCRIPTION`, `USERDESCRIPTION` | All `*_ENTITY` |
| `readme` | `README` (relationship) | Via join |
| `glossary_terms` | `ASSIGNEDTERMS` | All `*_ENTITY` |
| `has_lineage` | `__HASLINEAGE` or derived from `PROCESS_ENTITY` | Via join |
| `classifications` | `CLASSIFICATIONNAMES` | All `*_ENTITY` |
| `certificate_status` | `CERTIFICATESTATUS` | All `*_ENTITY` |
| `popularity_score` | `POPULARITYSCORE` | All `*_ENTITY` |
| `query_count` | `QUERYCOUNT` | All `*_ENTITY` |
| `connection_qualified_name` | `CONNECTIONQUALIFIEDNAME` | All `*_ENTITY` |
| `database_qualified_name` | `DATABASEQUALIFIEDNAME` | All `*_ENTITY` |
| `schema_qualified_name` | `SCHEMAQUALIFIEDNAME` | All `*_ENTITY` |

---

## New Routes in MDLH Explorer

| Route | Component | Description |
|-------|-----------|-------------|
| `/evaluation` | `EvaluationDashboard` | Main evaluation dashboard |
| `/evaluation/assess` | `AssessmentWizard` | Start new assessment |
| `/evaluation/assess/:id` | `AssessmentDetail` | Assessment results |
| `/evaluation/assess/:id/gaps` | `GapsView` | Gap analysis |
| `/evaluation/assess/:id/plan` | `PlanView` | Remediation plan |
| `/evaluation/tenant-config` | `TenantConfigPage` | Tenant configuration |
| `/evaluation/field-mapping` | `FieldMappingPage` | Field mapping editor |
| `/evaluation/reconciliation` | `ReconciliationDashboard` | Field reconciliation |
| `/evaluation/assistant` | `MetadataAssistantWizard` | Guided assistant |

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
1. Create directory structure: `src/evaluation/`
2. Port core domain logic (engines, catalog, models)
3. Create `MDLHAssetFetcher` to replace API fetcher
4. Port data modules

### Phase 2: Stores & Services (Week 1-2)
1. Port Zustand stores
2. Port services
3. Integrate with existing MDLH connection

### Phase 3: UI Components (Week 2-3)
1. Port assistant wizard
2. Port tenant config components
3. Port v2run components
4. Port evidence/audit components

### Phase 4: Integration (Week 3)
1. Add routes to App.jsx
2. Add navigation items
3. Connect to existing Snowflake connection
4. Test end-to-end flow

### Phase 5: Polish (Week 4)
1. Style consistency with MDLH Explorer
2. Error handling
3. Loading states
4. Documentation

---

## Key Decisions

### TypeScript → JavaScript
- MDLH Explorer uses JavaScript (JSX)
- We'll convert TypeScript to JavaScript during port
- Preserve JSDoc comments for type hints

### State Management
- Keep Zustand (already used in evaluation app)
- Or integrate with existing React Context patterns in MDLH Explorer

### Styling
- Use existing MDLH Explorer CSS patterns
- Tailwind classes where applicable
- Maintain Atlan design language

### Data Source
- All data fetched via Snowflake through existing backend
- Use `buildSafeFQN()` and `escapeStringValue()` for SQL safety [[memory:11947487]]
- Never use placeholders in queries [[memory:11948991]]

---

## Files to Create First

1. `src/evaluation/index.js` - Main export
2. `src/evaluation/catalog/unifiedFields.js` - Field catalog
3. `src/evaluation/catalog/signalDefinitions.js` - Signal definitions
4. `src/evaluation/engines/scoreEngine.js` - Scoring engine
5. `src/evaluation/assessment/mdlhAssetFetcher.js` - **MDLH data fetcher**
6. `src/components/evaluation/EvaluationDashboard.jsx` - Main dashboard

---

## Success Criteria

- [ ] Can run assessment against MDLH Snowflake data
- [ ] Signal coverage calculated from MDLH tables
- [ ] Impact/Quality quadrant view working
- [ ] Gap analysis identifies missing fields
- [ ] Plan generation creates remediation steps
- [ ] Tenant config allows field mapping
- [ ] Reconciliation shows expected vs actual
- [ ] Assistant wizard guides through setup
- [ ] All routes accessible from navigation
