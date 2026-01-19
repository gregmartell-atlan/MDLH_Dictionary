/**
 * Evidence Drawer Types
 *
 * The Evidence Drawer exists to answer one question:
 * "Why does the system believe this?"
 *
 * It is the primary trust surface of the application.
 */

// ============================================================================
// Core Evidence Drawer Context
// ============================================================================

export type EvidenceDrawerFocus =
  | 'SCORE'           // Why is this score what it is?
  | 'GAP'             // Why does this gap exist?
  | 'PLAN_ACTION'     // Why is this action in the plan?
  | 'PROGRESS_DELTA'; // What changed between runs?

export type SubjectType = 'ASSET' | 'DOMAIN' | 'CAPABILITY';

export interface EvidenceDrawerContext {
  /** Unique run identifier */
  runId: string;
  /** Capability being evaluated */
  capabilityId: string;
  /** Evaluation run ID for snapshot reference */
  evaluationRunId: string;
  /** What type of subject we're examining */
  subjectType: SubjectType;
  /** The subject ID (asset GUID, domain ID, etc.) */
  subjectId: string;
  /** What aspect of the subject to focus on */
  focus: EvidenceDrawerFocus;
  /** Optional: specific measure/dimension/gap ID */
  focusId?: string;
  /** Methodology type used for scoring */
  methodologyType: MethodologyType;
}

export type MethodologyType =
  | 'WEIGHTED_DIMENSIONS'
  | 'WEIGHTED_MEASURES'
  | 'CHECKLIST'
  | 'QTRIPLET'
  | 'MATURITY';

// ============================================================================
// Evidence Snapshot (Immutable)
// ============================================================================

export interface EvidenceSnapshot {
  /** Snapshot timestamp */
  timestamp: string;
  /** Run ID this snapshot belongs to */
  runId: string;
  /** All raw evidence signals */
  signals: EvidenceSignal[];
  /** Computed measures */
  measures: MeasureEvidence[];
  /** Computed dimensions (if methodology uses them) */
  dimensions?: DimensionEvidence[];
  /** Detected gaps */
  gaps: GapEvidence[];
  /** Gate evaluations */
  gates: GateEvidence[];
}

export interface EvidenceSignal {
  /** Signal type (OWNERSHIP, LINEAGE, etc.) */
  signalType: string;
  /** Subject this signal is about */
  subjectId: string;
  subjectName?: string;
  subjectType: string;
  /** The actual value */
  value: boolean | number | 'UNKNOWN' | undefined;
  /** Where this value came from */
  source: EvidenceSource;
  /** When this was observed */
  observedAt: string;
}

export interface EvidenceSource {
  /** Source type */
  type: 'ATLAN_API' | 'MOCK' | 'CACHE' | 'COMPUTED';
  /** API endpoint or method */
  endpoint?: string;
  /** Field path in the response */
  fieldPath?: string;
  /** Atlan URL for direct linking */
  atlanUrl?: string;
}

export interface MeasureEvidence {
  /** Measure ID */
  measureId: string;
  /** Human-readable description */
  description: string;
  /** Computed value */
  value: number | 'UNKNOWN';
  /** Formula used (deterministic) */
  formula: string;
  /** Human-readable explanation */
  humanReadable: string;
  /** Input signals used */
  inputSignals: string[];
  /** Per-asset breakdown */
  assetContributions: AssetContribution[];
}

export interface AssetContribution {
  assetId: string;
  assetName?: string;
  assetType: string;
  /** Did this asset contribute positively? */
  passes: boolean | 'UNKNOWN';
  /** The signal value for this asset */
  signalValue: boolean | number | 'UNKNOWN' | undefined;
  /** Why this value */
  explanation: string;
}

export interface DimensionEvidence {
  /** Dimension ID */
  dimensionId: string;
  /** Human-readable description */
  description: string;
  /** Computed score */
  score: number | 'UNKNOWN';
  /** Weight in methodology (if weighted) */
  weight?: number;
  /** Weighted contribution to final score */
  weightedContribution?: number;
  /** Measures that comprise this dimension */
  measureIds: string[];
  /** Formula used */
  formula: string;
  /** Human-readable explanation */
  humanReadable: string;
}

export interface GapEvidence {
  /** Gap ID */
  gapId: string;
  /** Gap type */
  gapType: 'MISSING' | 'UNKNOWN' | 'CONFLICT';
  /** Signal that's missing/unknown */
  signalType: string;
  /** Subject affected */
  subjectId: string;
  subjectName?: string;
  subjectType: string;
  /** Severity */
  severity: 'HIGH' | 'MED' | 'LOW';
  /** Why this gap exists */
  explanation: string;
  /** Evidence that led to this gap */
  evidenceChain: EvidenceChainStep[];
}

export interface GateEvidence {
  /** Gate ID */
  gateId: string;
  /** Gate description */
  description: string;
  /** Did it pass? */
  passed: boolean;
  /** Severity if failed */
  severity?: 'BLOCK' | 'WARN';
  /** Inputs evaluated */
  inputs: { measureId: string; value: number | 'UNKNOWN' }[];
  /** Threshold required */
  threshold?: number;
  /** Actual value */
  actualValue?: number | 'UNKNOWN';
  /** Explanation */
  explanation: string;
}

// ============================================================================
// Evidence Chain (Deterministic Reasoning)
// ============================================================================

export interface EvidenceChainStep {
  /** Step number in the chain */
  stepNumber: number;
  /** What type of step */
  stepType: 'SIGNAL_READ' | 'COMPUTATION' | 'THRESHOLD_CHECK' | 'AGGREGATION';
  /** Input(s) to this step */
  inputs: string[];
  /** Output of this step */
  output: string;
  /** Deterministic formula/rule applied */
  rule: string;
  /** Human-readable explanation */
  explanation: string;
}

// ============================================================================
// Methodology-Specific Evidence Renderers
// ============================================================================

export interface WeightedDimensionsEvidence {
  type: 'WEIGHTED_DIMENSIONS';
  dimensions: DimensionEvidence[];
  totalWeight: number;
  finalScore: number | 'UNKNOWN';
  formula: string;
}

export interface WeightedMeasuresEvidence {
  type: 'WEIGHTED_MEASURES';
  measures: (MeasureEvidence & { weight: number; weightedContribution: number })[];
  totalWeight: number;
  finalScore: number | 'UNKNOWN';
  formula: string;
}

export interface ChecklistEvidence {
  type: 'CHECKLIST';
  rules: {
    ruleId: string;
    description: string;
    required: boolean;
    result: boolean | 'UNKNOWN';
    measureInputs: { measureId: string; value: number | 'UNKNOWN' }[];
    threshold?: number;
    explanation: string;
  }[];
  passedCount: number;
  totalCount: number;
  requiredFailures: string[];
}

export interface QTripletEvidence {
  type: 'QTRIPLET';
  completeness: { score: number | 'UNKNOWN'; measureIds: string[]; formula: string };
  consistency: { score: number | 'UNKNOWN'; measureIds: string[]; formula: string };
  accuracy: { score: number | 'UNKNOWN'; measureIds: string[]; formula: string };
  aggregateFormula: string;
  finalScore: number | 'UNKNOWN';
}

export interface MaturityEvidence {
  type: 'MATURITY';
  achievedLevel: 1 | 2 | 3 | 4 | 5;
  levelDetails: {
    level: 1 | 2 | 3 | 4 | 5;
    passed: boolean;
    ruleResults: { ruleId: string; description: string; passed: boolean | 'UNKNOWN' }[];
  }[];
}

export type MethodologyEvidence =
  | WeightedDimensionsEvidence
  | WeightedMeasuresEvidence
  | ChecklistEvidence
  | QTripletEvidence
  | MaturityEvidence;

// ============================================================================
// Progress Delta Evidence
// ============================================================================

export interface ProgressDeltaEvidence {
  /** Baseline run */
  baselineRunId: string;
  baselineTimestamp: string;
  /** Current run */
  currentRunId: string;
  currentTimestamp: string;
  /** Score change */
  scoreChange: {
    before: number | 'UNKNOWN';
    after: number | 'UNKNOWN';
    delta: number | null;
  };
  /** Gaps opened/closed */
  gapsOpened: GapEvidence[];
  gapsClosed: GapEvidence[];
  /** Signal changes */
  signalChanges: {
    signalType: string;
    subjectId: string;
    before: boolean | number | 'UNKNOWN' | undefined;
    after: boolean | number | 'UNKNOWN' | undefined;
    changeType: 'IMPROVED' | 'REGRESSED' | 'UNCHANGED' | 'NEW' | 'REMOVED';
  }[];
}

// ============================================================================
// Complete Drawer Data
// ============================================================================

export interface EvidenceDrawerData {
  /** The context that opened this drawer */
  context: EvidenceDrawerContext;
  /** The snapshot being examined */
  snapshot: EvidenceSnapshot;
  /** Methodology-specific evidence */
  methodologyEvidence: MethodologyEvidence;
  /** Evidence chain for the focused item */
  evidenceChain: EvidenceChainStep[];
  /** Progress delta (if focus is PROGRESS_DELTA) */
  progressDelta?: ProgressDeltaEvidence;
  /** Metadata */
  meta: {
    generatedAt: string;
    snapshotVersion: string;
    isComplete: boolean;
    warnings: string[];
  };
}
