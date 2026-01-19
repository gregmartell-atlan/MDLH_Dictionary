/**
 * EvaluationRun Persistence Store
 *
 * Persists evaluation runs to localStorage with baseline tracking.
 * Each capability+scope combination has its own run history.
 */

export interface GapSnapshot {
  id: string;
  gapType: 'MISSING' | 'UNKNOWN' | 'CONFLICT';
  signalType: string;
  subjectId: string;
  subjectName: string;
  severity: 'HIGH' | 'MED' | 'LOW';
  workstream: string;
  isSuppressed: boolean;
}

export interface EvidenceSnapshot {
  measureId: string;
  value: any;
  assetId?: string;
  assetName?: string;
}

export interface EvaluationRun {
  id: string;
  runNumber: number;
  timestamp: string;
  capabilityId: string;
  scopeId: string;
  methodology: string;
  provider: string;
  readinessScore: number;
  gatePass: boolean;
  gapCounts: {
    total: number;
    high: number;
    medium: number;
    low: number;
    unknown: number;
  };
  gaps: GapSnapshot[];
  evidenceSnapshot: EvidenceSnapshot[];
  isBaseline: boolean;
  constraintsHash?: string; // Track if constraints changed
}

export interface EvidenceDelta {
  id: string;
  changeType: 'ADDED' | 'REMOVED' | 'CHANGED';
  signalType: string;
  subjectName: string;
  subjectType: string;
  previousValue?: any;
  newValue?: any;
  timestamp: string;
  fromRunId: string;
  toRunId: string;
}

export interface QuadrantMovement {
  domain: string;
  assetType: string;
  assetCount: number;
  baselineQuadrant: string;
  currentQuadrant: string;
  direction: 'IMPROVED' | 'REGRESSED' | 'STABLE';
}

const STORAGE_KEY = 'atlan_evaluation_runs';
const MAX_RUNS_PER_SCOPE = 50; // Limit storage per capability+scope

/**
 * Get a unique key for storing runs for a capability+scope combination
 */
function getScopeKey(capabilityId: string, scopeId: string): string {
  return `${capabilityId}:${scopeId}`;
}

/**
 * Load all runs from localStorage
 */
function loadAllRuns(): Record<string, EvaluationRun[]> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Save all runs to localStorage
 */
function saveAllRuns(runs: Record<string, EvaluationRun[]>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
  } catch (e) {
    console.error('Failed to save evaluation runs:', e);
  }
}

/**
 * Get runs for a specific capability+scope
 */
export function getRuns(capabilityId: string, scopeId: string): EvaluationRun[] {
  const allRuns = loadAllRuns();
  const scopeKey = getScopeKey(capabilityId, scopeId);
  return allRuns[scopeKey] || [];
}

/**
 * Get the baseline run for a capability+scope
 */
export function getBaselineRun(capabilityId: string, scopeId: string): EvaluationRun | null {
  const runs = getRuns(capabilityId, scopeId);
  return runs.find(r => r.isBaseline) || runs[0] || null;
}

/**
 * Get the latest run for a capability+scope
 */
export function getLatestRun(capabilityId: string, scopeId: string): EvaluationRun | null {
  const runs = getRuns(capabilityId, scopeId);
  return runs[runs.length - 1] || null;
}

/**
 * Add a new evaluation run
 */
export function addRun(run: Omit<EvaluationRun, 'id' | 'runNumber' | 'timestamp' | 'isBaseline'>): EvaluationRun {
  const allRuns = loadAllRuns();
  const scopeKey = getScopeKey(run.capabilityId, run.scopeId);
  const existingRuns = allRuns[scopeKey] || [];

  const newRun: EvaluationRun = {
    ...run,
    id: `run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    runNumber: existingRuns.length + 1,
    timestamp: new Date().toISOString(),
    isBaseline: existingRuns.length === 0, // First run is baseline
  };

  // Trim old runs if exceeding limit
  const updatedRuns = [...existingRuns, newRun];
  if (updatedRuns.length > MAX_RUNS_PER_SCOPE) {
    // Keep baseline and newest runs
    const baselineRun = updatedRuns.find(r => r.isBaseline);
    const nonBaselineRuns = updatedRuns.filter(r => !r.isBaseline);
    const trimmedNonBaseline = nonBaselineRuns.slice(-MAX_RUNS_PER_SCOPE + 1);
    allRuns[scopeKey] = baselineRun
      ? [baselineRun, ...trimmedNonBaseline.filter(r => r.id !== baselineRun.id)]
      : trimmedNonBaseline;
  } else {
    allRuns[scopeKey] = updatedRuns;
  }

  saveAllRuns(allRuns);
  return newRun;
}

/**
 * Reset the baseline to a specific run
 */
export function resetBaseline(capabilityId: string, scopeId: string, runId?: string): EvaluationRun | null {
  const allRuns = loadAllRuns();
  const scopeKey = getScopeKey(capabilityId, scopeId);
  const runs = allRuns[scopeKey] || [];

  if (runs.length === 0) return null;

  // Clear existing baseline
  const updatedRuns = runs.map(r => ({ ...r, isBaseline: false }));

  // Set new baseline
  const targetRunId = runId || runs[runs.length - 1].id;
  const targetIndex = updatedRuns.findIndex(r => r.id === targetRunId);

  if (targetIndex === -1) return null;

  updatedRuns[targetIndex].isBaseline = true;
  allRuns[scopeKey] = updatedRuns;
  saveAllRuns(allRuns);

  return updatedRuns[targetIndex];
}

/**
 * Compute evidence deltas between two runs
 */
export function computeEvidenceDeltas(fromRun: EvaluationRun, toRun: EvaluationRun): EvidenceDelta[] {
  const deltas: EvidenceDelta[] = [];
  const fromMap = new Map(fromRun.evidenceSnapshot.map(e => [`${e.measureId}:${e.assetId || ''}`, e]));
  const toMap = new Map(toRun.evidenceSnapshot.map(e => [`${e.measureId}:${e.assetId || ''}`, e]));

  // Find added and changed
  for (const [key, toEvidence] of toMap) {
    const fromEvidence = fromMap.get(key);
    if (!fromEvidence) {
      deltas.push({
        id: `delta-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        changeType: 'ADDED',
        signalType: toEvidence.measureId,
        subjectName: toEvidence.assetName || toEvidence.assetId || 'Unknown',
        subjectType: 'Asset',
        newValue: toEvidence.value,
        timestamp: toRun.timestamp,
        fromRunId: fromRun.id,
        toRunId: toRun.id,
      });
    } else if (JSON.stringify(fromEvidence.value) !== JSON.stringify(toEvidence.value)) {
      deltas.push({
        id: `delta-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        changeType: 'CHANGED',
        signalType: toEvidence.measureId,
        subjectName: toEvidence.assetName || toEvidence.assetId || 'Unknown',
        subjectType: 'Asset',
        previousValue: fromEvidence.value,
        newValue: toEvidence.value,
        timestamp: toRun.timestamp,
        fromRunId: fromRun.id,
        toRunId: toRun.id,
      });
    }
  }

  // Find removed
  for (const [key, fromEvidence] of fromMap) {
    if (!toMap.has(key)) {
      deltas.push({
        id: `delta-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        changeType: 'REMOVED',
        signalType: fromEvidence.measureId,
        subjectName: fromEvidence.assetName || fromEvidence.assetId || 'Unknown',
        subjectType: 'Asset',
        previousValue: fromEvidence.value,
        timestamp: toRun.timestamp,
        fromRunId: fromRun.id,
        toRunId: toRun.id,
      });
    }
  }

  // Sort by timestamp descending
  return deltas.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * Compute all evidence deltas across all runs since baseline
 */
export function getAllEvidenceDeltas(capabilityId: string, scopeId: string): EvidenceDelta[] {
  const runs = getRuns(capabilityId, scopeId);
  if (runs.length < 2) return [];

  const allDeltas: EvidenceDelta[] = [];

  for (let i = 1; i < runs.length; i++) {
    const deltas = computeEvidenceDeltas(runs[i - 1], runs[i]);
    allDeltas.push(...deltas);
  }

  // Sort by timestamp descending
  return allDeltas.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * Compute gap trajectory data for charting
 */
export function getGapTrajectory(capabilityId: string, scopeId: string): {
  date: string;
  runNumber: number;
  total: number;
  high: number;
  medium: number;
  low: number;
  readiness: number;
}[] {
  const runs = getRuns(capabilityId, scopeId);
  return runs.map(run => ({
    date: new Date(run.timestamp).toLocaleDateString(),
    runNumber: run.runNumber,
    total: run.gapCounts.total,
    high: run.gapCounts.high,
    medium: run.gapCounts.medium,
    low: run.gapCounts.low,
    readiness: run.readinessScore,
  }));
}

/**
 * Clear all runs for a capability+scope (use with caution)
 */
export function clearRuns(capabilityId: string, scopeId: string): void {
  const allRuns = loadAllRuns();
  const scopeKey = getScopeKey(capabilityId, scopeId);
  delete allRuns[scopeKey];
  saveAllRuns(allRuns);
}

/**
 * Export runs as JSON (for backup)
 */
export function exportRuns(capabilityId: string, scopeId: string): string {
  const runs = getRuns(capabilityId, scopeId);
  return JSON.stringify(runs, null, 2);
}

/**
 * Import runs from JSON (for restore)
 */
export function importRuns(capabilityId: string, scopeId: string, jsonData: string): boolean {
  try {
    const runs = JSON.parse(jsonData) as EvaluationRun[];
    if (!Array.isArray(runs)) return false;

    const allRuns = loadAllRuns();
    const scopeKey = getScopeKey(capabilityId, scopeId);
    allRuns[scopeKey] = runs;
    saveAllRuns(allRuns);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get summary statistics for a capability+scope
 */
export function getRunSummary(capabilityId: string, scopeId: string): {
  totalRuns: number;
  baselineRun: EvaluationRun | null;
  latestRun: EvaluationRun | null;
  gapDelta: number;
  readinessDelta: number;
  trend: 'IMPROVING' | 'REGRESSING' | 'STABLE';
} {
  const runs = getRuns(capabilityId, scopeId);
  const baselineRun = getBaselineRun(capabilityId, scopeId);
  const latestRun = getLatestRun(capabilityId, scopeId);

  const gapDelta = baselineRun && latestRun
    ? latestRun.gapCounts.total - baselineRun.gapCounts.total
    : 0;

  const readinessDelta = baselineRun && latestRun
    ? latestRun.readinessScore - baselineRun.readinessScore
    : 0;

  let trend: 'IMPROVING' | 'REGRESSING' | 'STABLE' = 'STABLE';
  if (gapDelta < 0 || readinessDelta > 5) {
    trend = 'IMPROVING';
  } else if (gapDelta > 0 || readinessDelta < -5) {
    trend = 'REGRESSING';
  }

  return {
    totalRuns: runs.length,
    baselineRun,
    latestRun,
    gapDelta,
    readinessDelta,
    trend,
  };
}
