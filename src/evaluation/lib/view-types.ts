/**
 * Shared types for multi-view UI components
 */

// ============================================================================
// Types (locally defined to avoid cross-package import issues)
// ============================================================================

export type Workstream =
  | 'OWNERSHIP'
  | 'SEMANTICS'
  | 'LINEAGE'
  | 'SENSITIVITY_ACCESS'
  | 'QUALITY_FRESHNESS';

export type PhaseName = 'MVP' | 'EXPANDED' | 'HARDENING';

export type GapSeverity = 'HIGH' | 'MED' | 'LOW';

export type GapType = 'COVERAGE' | 'QUALITY' | 'COMPLIANCE';

export type EffortBucket = 'QUICK_WIN' | 'STANDARD' | 'PROJECT';

// ============================================================================
// View Mode Types
// ============================================================================

export type ViewMode = 'spreadsheet' | 'linear' | 'kanban';

export interface ViewConfig {
  mode: ViewMode;
  groupBy?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: ViewFilter[];
  columnVisibility?: Record<string, boolean>;
}

export interface ViewFilter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains' | 'in';
  value: unknown;
}

// ============================================================================
// Tri-State Signal Value
// ============================================================================

export type TriState = true | false | 'UNKNOWN';

export function triStateToDisplay(value: TriState): string {
  if (value === true) return '✓';
  if (value === false) return '✗';
  return '?';
}

export function triStateToColor(value: TriState): string {
  if (value === true) return 'text-green-600';
  if (value === false) return 'text-red-600';
  return 'text-gray-400';
}

export function triStateToBgColor(value: TriState): string {
  if (value === true) return 'bg-green-50';
  if (value === false) return 'bg-red-50';
  return 'bg-gray-50';
}

// ============================================================================
// Asset Row (for Spreadsheet View)
// ============================================================================

export interface AssetSignals {
  ownership: TriState;
  lineage: TriState;
  semantics: TriState;
  sensitivity: TriState;
  access: TriState;
  usage: TriState;
  freshness: TriState;
}

/**
 * Detailed signal values for "Details" display mode.
 * Contains the actual values from Atlan, not just existence flags.
 */
export interface AssetSignalDetails {
  ownership: {
    present: boolean;
    owners?: string[];
    groups?: string[];
  };
  semantics: {
    present: boolean;
    description?: string;
    userDescription?: string;
  };
  lineage: {
    hasLineage: boolean;
    upstreamCount?: number;
    downstreamCount?: number;
  };
  sensitivity: {
    classified: boolean;
    classifications?: string[];
  };
  access: {
    hasPolicies: boolean;
    policyCount?: number;
    compliant?: boolean;
  };
  usage: {
    hasUsage: boolean;
    queryCount?: number;
    popularityScore?: number;
  };
  freshness: {
    hasDQ: boolean;
    status?: string;
    lastScan?: string;
  };
}

export interface AssetRow {
  id: string;
  name: string;
  type: string;
  qualifiedName: string;

  // Evidence signals (tri-state for checkmark display)
  signals: AssetSignals;

  // Detailed signal values (for "Details" display mode)
  signalDetails?: AssetSignalDetails;

  // Computed metrics
  signalCoverage: number;
  gapCount: number;
  highSeverityGaps: number;

  // Plan overlay
  plannedActions: ActionSummary[];
  expectedGapsClosed: number;

  // Metadata
  atlanUrl?: string;
  lastUpdated?: string;

  // Domain/Data Product linkage for pivot grouping
  domainGUIDs?: string[];
  domainName?: string;
  
  // Hierarchy attributes for pivot grouping
  connectionName?: string;
  databaseName?: string;
  schemaName?: string;
}

export interface ActionSummary {
  actionId: string;
  description: string;
  phase: PhaseName;
  workstream: Workstream;
}

// ============================================================================
// Action Item (for Linear/Kanban Views)
// ============================================================================

/**
 * Derived status for actions - NOT manually editable.
 * Status is computed based on gap closure after re-evaluation.
 * 
 * - PENDING: Gaps still exist for this action's scope
 * - RESOLVED: All associated gaps have disappeared after re-evaluation
 * 
 * Note: This is an intentional extension of the spec's "no PM" philosophy.
 * We display derived status for visualization, but users cannot manually
 * change it. Progress is always observed via gap disappearance.
 */
export type DerivedStatus = 'PENDING' | 'RESOLVED';

export type ActionPriority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  /**
   * Derived status based on gap closure - NOT manually editable.
   * PENDING = gaps still exist, RESOLVED = gaps disappeared on re-eval
   */
  derivedStatus: DerivedStatus;
  priority: ActionPriority;
  phase: PhaseName;
  workstream: Workstream;
  effort: EffortBucket;
  assetCount: number;
  gapsAddressed: number;
  gapIds: string[];
  assetIds: string[];
  // NOTE: assignee and dueDate intentionally removed per spec invariants
  // "No tasks, statuses, assignees, timelines"
}

export interface ActionGroup {
  id: string;
  label: string;
  description?: string;
  items: ActionItem[];
  collapsed?: boolean;
  color?: string;
}

// ============================================================================
// Kanban Column
// ============================================================================

export interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
  color?: string;
}

export interface KanbanCard {
  id: string;
  title: string;
  subtitle: string;
  labels: KanbanLabel[];
  priority?: ActionPriority;
  derivedStatus?: DerivedStatus;
  // NOTE: assignee and progress intentionally removed per spec invariants
}

export interface KanbanLabel {
  text: string;
  color: string;
}

// ============================================================================
// Grouping Options
// ============================================================================

/**
 * Grouping options for visualization views.
 * Note: 'derivedStatus' groups by PENDING/RESOLVED but is read-only.
 */
export type LinearGroupBy = 'phase' | 'workstream' | 'priority' | 'derivedStatus';
export type KanbanGroupBy = 'phase' | 'workstream' | 'derivedStatus';

// ============================================================================
// Color Mappings
// ============================================================================

export const PHASE_COLORS: Record<PhaseName, string> = {
  MVP: 'bg-blue-100 text-blue-800',
  EXPANDED: 'bg-purple-100 text-purple-800',
  HARDENING: 'bg-green-100 text-green-800',
};

export const WORKSTREAM_COLORS: Record<Workstream, string> = {
  OWNERSHIP: 'bg-amber-100 text-amber-800',
  SEMANTICS: 'bg-cyan-100 text-cyan-800',
  LINEAGE: 'bg-indigo-100 text-indigo-800',
  SENSITIVITY_ACCESS: 'bg-rose-100 text-rose-800',
  QUALITY_FRESHNESS: 'bg-emerald-100 text-emerald-800',
};

export const PRIORITY_COLORS: Record<ActionPriority, string> = {
  URGENT: 'bg-red-100 text-red-800',
  HIGH: 'bg-orange-100 text-orange-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  LOW: 'bg-gray-100 text-gray-800',
};

/**
 * Colors for derived status (read-only, computed from gap closure)
 */
export const DERIVED_STATUS_COLORS: Record<DerivedStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  RESOLVED: 'bg-green-100 text-green-800',
};

export const EFFORT_LABELS: Record<EffortBucket, string> = {
  QUICK_WIN: 'Quick Win',
  STANDARD: 'Standard',
  PROJECT: 'Project',
};

// ============================================================================
// Utility Functions
// ============================================================================

export function computeSignalCoverage(signals: AssetSignals): number {
  const values = Object.values(signals);
  const present = values.filter(v => v === true).length;
  return present / values.length;
}

export function getWorkstreamLabel(workstream: Workstream): string {
  const labels: Record<Workstream, string> = {
    OWNERSHIP: 'Ownership',
    SEMANTICS: 'Semantics',
    LINEAGE: 'Lineage',
    SENSITIVITY_ACCESS: 'Sensitivity & Access',
    QUALITY_FRESHNESS: 'Quality & Freshness',
  };
  return labels[workstream];
}

export function getPhaseLabel(phase: PhaseName): string {
  const labels: Record<PhaseName, string> = {
    MVP: 'MVP',
    EXPANDED: 'Expanded',
    HARDENING: 'Hardening',
  };
  return labels[phase];
}

export function getPriorityFromSeverity(gapCount: number, highSeverity: number): ActionPriority {
  if (highSeverity > 3) return 'URGENT';
  if (highSeverity > 0) return 'HIGH';
  if (gapCount > 5) return 'MEDIUM';
  return 'LOW';
}

/**
 * Computes derived status for an action based on gap closure.
 * This is the only way status changes - via re-evaluation showing gaps are gone.
 * 
 * @param currentGapIds - Gap IDs that still exist in the current evaluation
 * @param actionGapIds - Gap IDs that this action was meant to address
 * @returns RESOLVED if all action gaps are gone, PENDING otherwise
 */
export function computeDerivedStatus(
  currentGapIds: Set<string>,
  actionGapIds: string[]
): DerivedStatus {
  // An action is RESOLVED when none of its associated gaps exist anymore
  const hasRemainingGaps = actionGapIds.some(gapId => currentGapIds.has(gapId));
  return hasRemainingGaps ? 'PENDING' : 'RESOLVED';
}

/**
 * Get human-readable label for derived status
 */
export function getDerivedStatusLabel(status: DerivedStatus): string {
  return status === 'RESOLVED' ? 'Resolved' : 'Pending';
}
