/**
 * Evaluation Module
 * 
 * Metadata assessment and scoring for MDLH Explorer.
 * Full platform ported from atlan-metadata-evaluation.
 */

// Main App Components
export { EvaluationApp, default } from './EvaluationApp';
export { ModelingApp } from './ModelingApp';

// MDLH Bridge Service
export {
  configureMDLHBridge,
  getMDLHBridgeConfig,
  isConnected,
  buildFQN,
  executeQuery,
  fetchFieldCoverage,
  fetchAssetBreakdown,
  fetchOrphanAssets,
  fetchConnectorSummary,
  fetchAuditResult,
} from './services/mdlhBridge';

// Catalog exports
export {
  SIGNAL_DEFINITIONS,
  WORKSTREAM_DEFINITIONS,
  getSignalById,
  getSignalsByWorkstream,
  getSignalsBySeverity,
  getAllSignalIds,
  createSignalMap,
  getWorkstreamForSignal,
  getSignalPriority,
  SEVERITY_TO_PRIORITY,
} from './catalog/signalDefinitions';

export {
  UNIFIED_FIELD_CATALOG,
  getFieldById,
  getFieldsByCategory,
  getFieldsForSignal,
  getFieldsForUseCase,
  getCoreFieldsForUseCase,
  getFieldsForAssetType,
  getCompletenessFields,
  getMeasureFields,
  getActiveFields,
  createFieldMap,
  getMdlhColumnsForFields,
  getAllMdlhColumnsForSignals,
} from './catalog/unifiedFields';

// Engine exports
export {
  ScoreEngine,
  createScoreEngine,
  evaluateSignals,
  isSignalPresent,
  isSignalUnknown,
} from './engines/scoreEngine';

export {
  GapEngine,
  createGapEngine,
} from './engines/gapEngine';

// Assessment exports
export {
  MDLHAssetFetcher,
  MockAssetFetcher,
  createMDLHAssetFetcher,
} from './assessment/mdlhAssetFetcher';
