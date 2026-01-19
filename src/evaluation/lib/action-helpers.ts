/**
 * Action Helpers
 * 
 * Utilities for transforming plan data into ActionItems with derived status.
 * 
 * Key Principle (from spec invariants):
 * - "No tasks, statuses, assignees, timelines"
 * - "Progress is observed, not reported"
 * - "Remediation = gaps disappearing"
 * 
 * This module implements the "intentional extension" where we display
 * derived status for visualization, but never allow manual status changes.
 * Status is computed from gap closure after re-evaluation.
 */

import {
  ActionItem,
  DerivedStatus,
  ActionPriority,
  PhaseName,
  Workstream,
  EffortBucket,
  computeDerivedStatus,
  getPriorityFromSeverity,
} from './view-types';

/**
 * Raw action data from the plan engine (before derived status computation)
 */
export interface RawPlanAction {
  id: string;
  description: string;
  workstream: Workstream;
  phase: PhaseName;
  scope: string[];
  assetCount: number;
  effortBucket: 'S' | 'M' | 'L';
  expectedEffect: string[]; // Gap IDs expected to close
  gapsAddressed: number;
  priority?: number;
}

/**
 * Gap snapshot for status computation
 */
export interface GapSnapshot {
  id: string;
  gapType: 'MISSING' | 'UNKNOWN' | 'CONFLICT';
  severity: 'HIGH' | 'MED' | 'LOW';
  isSuppressed?: boolean;
}

/**
 * Converts effort bucket codes to canonical EffortBucket type
 */
function normalizeEffortBucket(effort: 'S' | 'M' | 'L'): EffortBucket {
  const mapping: Record<'S' | 'M' | 'L', EffortBucket> = {
    'S': 'QUICK_WIN',
    'M': 'STANDARD',
    'L': 'PROJECT',
  };
  return mapping[effort];
}

/**
 * Transforms raw plan actions into ActionItems with derived status.
 * 
 * Status is computed by checking if the action's associated gaps still exist
 * in the current gap snapshot. This is the ONLY way status changes.
 * 
 * @param actions - Raw actions from plan engine
 * @param currentGaps - Current gap snapshot from latest evaluation
 * @returns ActionItems with derived status
 */
export function transformActionsWithDerivedStatus(
  actions: RawPlanAction[],
  currentGaps: GapSnapshot[]
): ActionItem[] {
  // Build a set of current gap IDs for fast lookup
  const currentGapIds = new Set(
    currentGaps
      .filter(g => !g.isSuppressed) // Don't count suppressed gaps
      .map(g => g.id)
  );

  // Count high severity gaps for priority calculation
  const highSeverityCount = currentGaps.filter(g => g.severity === 'HIGH' && !g.isSuppressed).length;

  return actions.map((action, index) => {
    // Derive status from gap closure
    const derivedStatus = computeDerivedStatus(currentGapIds, action.expectedEffect);

    // Compute priority from action context
    const actionHighSeverityGaps = action.expectedEffect.filter(gapId => {
      const gap = currentGaps.find(g => g.id === gapId);
      return gap && gap.severity === 'HIGH' && !gap.isSuppressed;
    }).length;
    
    const priority = getPriorityFromSeverity(action.gapsAddressed, actionHighSeverityGaps);

    return {
      id: action.id,
      title: action.description,
      description: `Address ${action.gapsAddressed} gap${action.gapsAddressed !== 1 ? 's' : ''} across ${action.assetCount} asset${action.assetCount !== 1 ? 's' : ''}`,
      derivedStatus,
      priority,
      phase: action.phase,
      workstream: action.workstream,
      effort: normalizeEffortBucket(action.effortBucket),
      assetCount: action.assetCount,
      gapsAddressed: action.gapsAddressed,
      gapIds: action.expectedEffect,
      assetIds: action.scope,
    };
  });
}

/**
 * Computes summary statistics for a set of actions
 */
export function computeActionStats(actions: ActionItem[]) {
  return {
    total: actions.length,
    resolved: actions.filter(a => a.derivedStatus === 'RESOLVED').length,
    pending: actions.filter(a => a.derivedStatus === 'PENDING').length,
    totalAssets: actions.reduce((sum, a) => sum + a.assetCount, 0),
    totalGaps: actions.reduce((sum, a) => sum + a.gapsAddressed, 0),
    byPhase: {
      MVP: actions.filter(a => a.phase === 'MVP').length,
      EXPANDED: actions.filter(a => a.phase === 'EXPANDED').length,
      HARDENING: actions.filter(a => a.phase === 'HARDENING').length,
    },
    byPriority: {
      URGENT: actions.filter(a => a.priority === 'URGENT').length,
      HIGH: actions.filter(a => a.priority === 'HIGH').length,
      MEDIUM: actions.filter(a => a.priority === 'MEDIUM').length,
      LOW: actions.filter(a => a.priority === 'LOW').length,
    },
  };
}

/**
 * Returns a message explaining that status is derived, not editable
 */
export function getDerivedStatusExplanation(): string {
  return 'Status is derived from gap closure after re-evaluation. Actions become "Resolved" when their associated gaps disappear.';
}
