import { Workstream } from './signals';

/**
 * Remediation plan phases
 * Represents progressive maturity stages
 */
export type PhaseName = 'MVP' | 'Expanded' | 'Hardening';

/**
 * Effort bucket for action sizing
 * Based on number of affected assets
 */
export type EffortBucket = 'S' | 'M' | 'L';

/**
 * A specific remediation action
 */
export interface Action {
  /**
   * Unique action identifier
   */
  id: string;

  /**
   * Workstream this action belongs to
   */
  workstream: Workstream;

  /**
   * Human-readable action description
   */
  description: string;

  /**
   * Asset IDs or domain IDs in scope
   */
  scope: string[];

  /**
   * Asset count (derived from scope length)
   */
  assetCount: number;

  /**
   * Effort sizing bucket
   */
  effortBucket: EffortBucket;

  /**
   * Gap IDs expected to close when this action is completed
   */
  expectedEffect: string[];

  /**
   * Number of gaps this action addresses
   */
  gapsAddressed: number;

  /**
   * Priority order within the workstream
   */
  priority?: number;
}

/**
 * Workstream-grouped actions
 */
export interface WorkstreamActions {
  /**
   * Workstream identifier
   */
  workstream: Workstream;

  /**
   * Human-readable workstream name
   */
  name: string;

  /**
   * Description of this workstream
   */
  description: string;

  /**
   * Actions in this workstream
   */
  actions: Action[];

  /**
   * Total asset count across all actions
   */
  totalAssetCount: number;

  /**
   * Total gaps addressed by this workstream
   */
  totalGapsAddressed: number;
}

/**
 * A remediation phase (MVP, Expanded, or Hardening)
 */
export interface Phase {
  /**
   * Phase name
   */
  name: PhaseName;

  /**
   * Human-readable phase description
   */
  description: string;

  /**
   * Workstreams in this phase
   */
  workstreams: WorkstreamActions[];

  /**
   * Total actions in this phase
   */
  totalActions: number;

  /**
   * Total assets affected in this phase
   */
  totalAssets: number;

  /**
   * Total gaps addressed in this phase
   */
  totalGaps: number;
}

/**
 * Complete remediation plan
 */
export interface RemediationPlan {
  /**
   * Capability this plan is for
   */
  capabilityId: string;

  /**
   * Scope this plan covers
   */
  scopeId: string;

  /**
   * When this plan was generated
   */
  generatedAt: string;

  /**
   * Three remediation phases
   */
  phases: Phase[];

  /**
   * Overall plan statistics
   */
  summary: {
    totalActions: number;
    totalAssets: number;
    totalGaps: number;
    phaseDistribution: Record<PhaseName, number>;
  };
}

/**
 * Computes effort bucket based on asset count
 */
export function computeEffortBucket(assetCount: number): EffortBucket {
  if (assetCount < 5) return 'S';
  if (assetCount <= 20) return 'M';
  return 'L';
}

/**
 * Gets human-readable name for a workstream
 */
export function getWorkstreamName(workstream: Workstream): string {
  const names: Record<Workstream, string> = {
    OWNERSHIP: 'Ownership',
    SEMANTICS: 'Semantics & Documentation',
    LINEAGE: 'Lineage & Relationships',
    SENSITIVITY_ACCESS: 'Sensitivity & Access Control',
    QUALITY_FRESHNESS: 'Quality & Freshness Monitoring',
  };
  return names[workstream];
}

/**
 * Gets human-readable description for a workstream
 */
export function getWorkstreamDescription(workstream: Workstream): string {
  const descriptions: Record<Workstream, string> = {
    OWNERSHIP: 'Assign owners and establish stewardship for assets',
    SEMANTICS: 'Add descriptions, glossary terms, and documentation',
    LINEAGE: 'Document upstream and downstream dependencies',
    SENSITIVITY_ACCESS: 'Tag sensitive data and define access policies',
    QUALITY_FRESHNESS: 'Set up quality monitoring and freshness SLAs',
  };
  return descriptions[workstream];
}

/**
 * Gets description for a phase
 */
export function getPhaseDescription(phase: PhaseName): string {
  const descriptions: Record<PhaseName, string> = {
    MVP: 'Minimum viable improvements - address highest severity gaps on highest impact assets',
    Expanded: 'Expand coverage - address medium severity gaps and broaden asset coverage',
    Hardening: 'Quality hardening - address remaining gaps and establish monitoring',
  };
  return descriptions[phase];
}

/**
 * Creates a unique action ID
 */
export function createActionId(
  workstream: Workstream,
  phase: PhaseName,
  index: number
): string {
  return `action-${phase.toLowerCase()}-${workstream.toLowerCase()}-${index}`;
}
