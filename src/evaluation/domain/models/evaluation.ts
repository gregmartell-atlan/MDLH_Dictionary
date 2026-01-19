import { AssessmentResult } from '@atlan/assessment-lib';
import { Gap, GapSummary } from './gaps';
import { SubjectScore } from './scores';
import { RemediationPlan } from './plan';

/**
 * Complete evaluation run for a capability
 * Combines assessment results with gap analysis and remediation planning
 */
export interface EvaluationRun {
  /**
   * Unique evaluation run identifier
   */
  id: string;

  /**
   * Capability being evaluated
   */
  capabilityId: string;

  /**
   * Human-readable capability name
   */
  capabilityName: string;

  /**
   * Scope identifier (e.g., connection qualified name, domain ID)
   */
  scopeId: string;

  /**
   * Scope description
   */
  scopeDescription?: string;

  /**
   * When this evaluation was run
   */
  timestamp: string;

  /**
   * Data provider used (mock or atlan)
   */
  providerMode: 'mock' | 'atlan';

  /**
   * Assessment result from scoring library
   */
  assessmentResult: AssessmentResult;

  /**
   * Enriched subject scores with impact/quality
   */
  scores: SubjectScore[];

  /**
   * Detected gaps
   */
  gaps: Gap[];

  /**
   * Gap summary statistics
   */
  gapSummary: GapSummary;

  /**
   * Generated remediation plan
   */
  plan: RemediationPlan;

  /**
   * Overall readiness status
   */
  readiness: {
    /**
     * Is this capability ready? (passes gates + threshold)
     */
    ready: boolean;

    /**
     * Readiness score (0..1)
     */
    score: number;

    /**
     * Reason if not ready
     */
    reason?: string;

    /**
     * Gate failures (if any)
     */
    gateFailures: string[];
  };

  /**
   * Execution metadata
   */
  execution: {
    /**
     * Number of assets evaluated
     */
    assetCount: number;

    /**
     * Execution time in milliseconds
     */
    durationMs: number;

    /**
     * Any errors encountered (non-fatal)
     */
    errors: string[];

    /**
     * Any warnings
     */
    warnings: string[];
  };
}

/**
 * Creates a unique evaluation run ID
 */
export function createEvaluationId(capabilityId: string, timestamp: Date): string {
  const dateStr = timestamp.toISOString().replace(/[:.]/g, '-');
  return `eval-${capabilityId}-${dateStr}`;
}

/**
 * Status classification for evaluation result
 */
export type EvaluationStatus = 'READY' | 'NOT_READY' | 'UNKNOWN_HEAVY' | 'ERROR';

/**
 * Determines evaluation status from results
 */
export function getEvaluationStatus(evaluation: EvaluationRun): EvaluationStatus {
  if (evaluation.execution.errors.length > 0) {
    return 'ERROR';
  }

  // Check if too many UNKNOWN gaps (indicates lack of evidence)
  const unknownRatio = evaluation.gapSummary.byGapType.UNKNOWN / evaluation.gapSummary.total;
  if (unknownRatio > 0.35) {
    return 'UNKNOWN_HEAVY';
  }

  if (evaluation.readiness.ready) {
    return 'READY';
  }

  return 'NOT_READY';
}

/**
 * Gets status description
 */
export function getStatusDescription(status: EvaluationStatus): string {
  const descriptions: Record<EvaluationStatus, string> = {
    READY: 'Capability is ready for use',
    NOT_READY: 'Capability has gaps that need remediation',
    UNKNOWN_HEAVY: 'Insufficient evidence to determine readiness',
    ERROR: 'Evaluation encountered errors',
  };
  return descriptions[status];
}
