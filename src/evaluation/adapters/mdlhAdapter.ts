/**
 * MDLH Adapter
 * Bridges the evaluation API types to the format expected by UI components
 * 
 * This adapter transforms data from the new Node.js backend format
 * to the format expected by existing v2run components
 */

import type {
  Run,
  Score,
  DomainScore,
  Gap,
  Plan,
  Asset,
  Artifact,
  Quadrant,
} from '../services/evaluationApi';

// ============================================
// LEGACY TYPE DEFINITIONS (for backwards compatibility)
// ============================================

/**
 * Legacy run format used by existing components
 */
export interface LegacyRun {
  id: string;
  createdAt: string;
  status: string;
  scope?: string;
  selectedCapabilities: string[];
  scores?: LegacyScore[];
  gaps?: LegacyGap[];
  plans?: LegacyPhase[];
  artifacts?: LegacyArtifact[];
}

export interface LegacyScore {
  id: string;
  runId: string;
  subjectType: string;
  subjectId: string;
  impactScore: number;
  qualityScore: number | null;
  qualityUnknown: boolean;
  quadrant: string;
  assetCount: number;
  knownAssetCount: number;
  explanationsJson: unknown[];
}

export interface LegacyGap {
  id: string;
  gapType: string;
  explanation: string;
  subjectType: string;
  subjectId: string;
  priority?: string;
}

export interface LegacyPhase {
  name: string;
  actions: LegacyAction[];
}

export interface LegacyAction {
  workstream: string;
  scope: string;
  effortBucket: string;
  explanation?: string;
}

export interface LegacyArtifact {
  type: string;
  format: string;
  content?: string;
}

export interface LegacyDomainAsset {
  assetGuid: string;
  name: string;
  type: string;
  qualifiedName: string | null;
  atlanUrl: string | null;
  signals: Array<{ key: string; present: boolean; evidenceRefs: string[] }>;
  score: {
    impactScore: number;
    qualityScore: number | null;
    qualityUnknown: boolean;
  } | null;
  quadrant: string;
}

// ============================================
// QUADRANT MAPPINGS
// ============================================

const QUADRANT_MAP: Record<Quadrant, string> = {
  HH: 'HIGH_IMPACT_HIGH_QUALITY',
  HL: 'HIGH_IMPACT_LOW_QUALITY',
  LH: 'LOW_IMPACT_HIGH_QUALITY',
  LL: 'LOW_IMPACT_LOW_QUALITY',
  HU: 'QUALITY_UNKNOWN',
  LU: 'QUALITY_UNKNOWN',
};

const REVERSE_QUADRANT_MAP: Record<string, Quadrant> = {
  HIGH_IMPACT_HIGH_QUALITY: 'HH',
  HIGH_IMPACT_LOW_QUALITY: 'HL',
  LOW_IMPACT_HIGH_QUALITY: 'LH',
  LOW_IMPACT_LOW_QUALITY: 'LL',
  QUALITY_UNKNOWN: 'HU',
  UNKNOWN: 'LU',
};

// ============================================
// ADAPTERS: New format → Legacy format
// ============================================

/**
 * Convert new Run to legacy format
 */
export function adaptRun(run: Run): LegacyRun {
  return {
    id: run.id,
    createdAt: run.createdAt,
    status: run.status,
    scope: run.scope.database ? `${run.scope.database}.${run.scope.schema}` : undefined,
    selectedCapabilities: run.capabilities,
    scores: [],
    gaps: [],
    plans: [],
    artifacts: [],
  };
}

/**
 * Convert new DomainScore to legacy format
 */
export function adaptDomainScore(score: DomainScore): LegacyScore {
  return {
    id: score.id,
    runId: score.runId,
    subjectType: score.subjectType,
    subjectId: score.subjectId,
    impactScore: score.impactScore,
    qualityScore: score.qualityScore,
    qualityUnknown: score.qualityUnknown,
    quadrant: QUADRANT_MAP[score.quadrant] || 'QUALITY_UNKNOWN',
    assetCount: score.assetCount,
    knownAssetCount: score.knownAssetCount,
    explanationsJson: [],
  };
}

/**
 * Convert array of DomainScores
 */
export function adaptDomainScores(scores: DomainScore[]): LegacyScore[] {
  return scores.map(adaptDomainScore);
}

/**
 * Convert new Gap to legacy format
 */
export function adaptGap(gap: Gap, index: number): LegacyGap {
  return {
    id: gap.id?.toString() || `gap-${index}`,
    gapType: gap.field,
    explanation: `Current coverage: ${(gap.currentCoverage * 100).toFixed(0)}%, Target: ${(gap.targetCoverage * 100).toFixed(0)}%`,
    subjectType: 'FIELD',
    subjectId: gap.field,
    priority: gap.priority,
  };
}

/**
 * Convert array of Gaps
 */
export function adaptGaps(gaps: Gap[]): LegacyGap[] {
  return gaps.map((g, i) => adaptGap(g, i));
}

/**
 * Convert new Plan to legacy phases format
 */
export function adaptPlan(plan: Plan): LegacyPhase[] {
  return plan.phases.map(phase => ({
    name: phase.name,
    actions: phase.fields.map(field => ({
      workstream: field,
      scope: phase.description,
      effortBucket: `${phase.estimatedWeeks} weeks`,
      explanation: phase.milestone,
    })),
  }));
}

/**
 * Convert new Artifact to legacy format
 */
export function adaptArtifact(artifact: Artifact): LegacyArtifact {
  return {
    type: artifact.type,
    format: artifact.format,
  };
}

/**
 * Convert array of Artifacts
 */
export function adaptArtifacts(artifacts: Artifact[]): LegacyArtifact[] {
  return artifacts.map(adaptArtifact);
}

/**
 * Convert Score to LegacyDomainAsset format
 */
export function adaptScoreToAsset(score: Score): LegacyDomainAsset {
  // Build signals from explanations
  const signals = [
    { key: 'ownership', present: !score.explanations.some(e => e.title === 'Missing Ownership'), evidenceRefs: [] },
    { key: 'semantics', present: !score.explanations.some(e => e.title === 'Missing Documentation'), evidenceRefs: [] },
    { key: 'lineage', present: !score.explanations.some(e => e.title === 'Missing Lineage'), evidenceRefs: [] },
    { key: 'sensitivity/access', present: true, evidenceRefs: [] }, // Default to present if no explicit gap
  ];

  return {
    assetGuid: score.subjectId,
    name: score.subjectName || score.subjectId,
    type: score.assetType || 'Unknown',
    qualifiedName: score.qualifiedName || null,
    atlanUrl: null,
    signals,
    score: {
      impactScore: score.impactScore,
      qualityScore: score.qualityScore,
      qualityUnknown: score.qualityUnknown,
    },
    quadrant: QUADRANT_MAP[score.quadrant] || 'QUALITY_UNKNOWN',
  };
}

/**
 * Convert array of Scores to legacy domain assets
 */
export function adaptScoresToAssets(scores: Score[]): LegacyDomainAsset[] {
  return scores.map(adaptScoreToAsset);
}

/**
 * Convert Asset to catalog format expected by components
 */
export function adaptAssetToCatalog(asset: Asset) {
  return {
    guid: asset.guid,
    qualifiedName: asset.qualifiedName,
    name: asset.name,
    typeName: asset.typeName,
    connectorName: asset.connector,
    impactScore: asset.attributes.popularityScore ? asset.attributes.popularityScore / 100 : null,
    qualityScore: null, // Scores are computed separately
    signals: [
      { signalType: 'OWNERSHIP', signalValue: asset.attributes.ownerUsers.length > 0 || asset.attributes.ownerGroups.length > 0 ? 'OBSERVED' : 'UNKNOWN', signalSource: 'MDLH' },
      { signalType: 'SEMANTICS', signalValue: asset.attributes.description ? 'OBSERVED' : 'UNKNOWN', signalSource: 'MDLH' },
      { signalType: 'LINEAGE', signalValue: asset.attributes.hasLineage ? 'OBSERVED' : 'UNKNOWN', signalSource: 'MDLH' },
      { signalType: 'SENSITIVITY', signalValue: asset.attributes.tags.length > 0 ? 'OBSERVED' : 'UNKNOWN', signalSource: 'MDLH' },
    ],
  };
}

/**
 * Convert array of Assets to catalog format
 */
export function adaptAssetsToCatalog(assets: Asset[]) {
  return assets.map(adaptAssetToCatalog);
}

// ============================================
// ADAPTERS: Legacy format → New format
// ============================================

/**
 * Convert legacy scope to new RunScope format
 */
export function convertLegacyScope(scope?: { 
  domainQualifiedName?: string; 
  connectionQualifiedName?: string; 
  schemaQualifiedName?: string;
  query?: string;
}) {
  if (!scope) return {};
  
  // Parse qualified names to extract database/schema
  if (scope.schemaQualifiedName) {
    const parts = scope.schemaQualifiedName.split('/');
    // Format: connector/database/schema or similar
    if (parts.length >= 3) {
      return {
        database: parts[parts.length - 2],
        schema: parts[parts.length - 1],
        connectorFilter: parts[0],
      };
    }
  }
  
  if (scope.connectionQualifiedName) {
    const parts = scope.connectionQualifiedName.split('/');
    if (parts.length >= 2) {
      return {
        database: parts[parts.length - 1],
        connectorFilter: parts[0],
      };
    }
  }

  return {};
}

/**
 * Get quadrant from legacy string
 */
export function getQuadrantFromLegacy(legacyQuadrant: string): Quadrant {
  return REVERSE_QUADRANT_MAP[legacyQuadrant] || 'LU';
}
