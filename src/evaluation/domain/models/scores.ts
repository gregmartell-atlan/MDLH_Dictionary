import { SubjectType } from './gaps';

/**
 * Quadrant classification based on impact and quality scores
 * - HH: High Impact, High Quality (ready to use)
 * - HL: High Impact, Low Quality (fix urgently)
 * - LH: Low Impact, High Quality (maintain)
 * - LL: Low Impact, Low Quality (low priority)
 * - HU: High Impact, Unknown Quality (investigate)
 * - LU: Low Impact, Unknown Quality (defer)
 */
export type Quadrant = 'HH' | 'HL' | 'LH' | 'LL' | 'HU' | 'LU';

/**
 * Explanation for a score or assessment result
 */
export interface Explanation {
  /**
   * Short title for the explanation
   */
  title: string;

  /**
   * Detailed reasoning
   */
  reasoning: string;

  /**
   * References to evidence (Atlan URLs, etc.)
   */
  evidenceRefs: string[];

  /**
   * Severity level (for gap explanations)
   */
  severity?: 'HIGH' | 'MED' | 'LOW';
}

/**
 * Score for a specific subject (domain or asset)
 * Enriches basic readiness scoring with impact/quality dimensions
 */
export interface SubjectScore {
  /**
   * Subject type (domain, asset, etc.)
   */
  subjectType: SubjectType;

  /**
   * Subject identifier
   */
  subjectId: string;

  /**
   * Human-readable name
   */
  subjectName?: string;

  /**
   * Asset type (Table, Column, Database, etc.)
   */
  assetType?: string;

  /**
   * Qualified name for Atlan linking
   */
  qualifiedName?: string;

  /**
   * Impact score (0..1)
   * Derived from usage metrics, popularity, or defaulted to 0.25
   * Never UNKNOWN - always has a value
   */
  impactScore: number;

  /**
   * Quality score (0..1 or null if UNKNOWN-heavy)
   * Ratio of present required signals to total required signals
   */
  qualityScore: number | null;

  /**
   * True if quality score is null due to excessive UNKNOWN signals
   */
  qualityUnknown: boolean;

  /**
   * Quadrant classification (HH, HL, LH, LL, HU, LU)
   */
  quadrant: Quadrant;

  /**
   * Overall readiness score from assessment engine (0..1)
   */
  readinessScore?: number;

  /**
   * Explanations for this score
   */
  explanations: Explanation[];

  /**
   * Dimension scores (if using WEIGHTED_DIMENSIONS methodology)
   */
  dimensionScores?: Record<string, number>;
}

/**
 * Computes quadrant from impact and quality scores
 */
export function computeQuadrant(
  impactScore: number,
  qualityScore: number | null,
  impactThreshold: number = 0.5,
  qualityThreshold: number = 0.7
): Quadrant {
  const highImpact = impactScore >= impactThreshold;

  if (qualityScore === null) {
    // UNKNOWN quality
    return highImpact ? 'HU' : 'LU';
  }

  const highQuality = qualityScore >= qualityThreshold;

  if (highImpact && highQuality) return 'HH';
  if (highImpact && !highQuality) return 'HL';
  if (!highImpact && highQuality) return 'LH';
  return 'LL';
}

/**
 * Gets human-readable description for a quadrant
 */
export function getQuadrantDescription(quadrant: Quadrant): string {
  const descriptions: Record<Quadrant, string> = {
    HH: 'High Impact, High Quality - Ready to use for AI workloads',
    HL: 'High Impact, Low Quality - Fix urgently, high business value',
    LH: 'Low Impact, High Quality - Maintain current standards',
    LL: 'Low Impact, Low Quality - Low priority for remediation',
    HU: 'High Impact, Unknown Quality - Investigate to determine readiness',
    LU: 'Low Impact, Unknown Quality - Defer investigation',
  };
  return descriptions[quadrant];
}

/**
 * Gets priority level for a quadrant (for action planning)
 */
export function getQuadrantPriority(quadrant: Quadrant): 'HIGH' | 'MED' | 'LOW' {
  const priorities: Record<Quadrant, 'HIGH' | 'MED' | 'LOW'> = {
    HL: 'HIGH',  // High impact, needs fixing
    HU: 'HIGH',  // High impact, needs investigation
    HH: 'MED',   // Maintain quality
    LH: 'MED',   // Maintain quality
    LU: 'LOW',   // Low priority
    LL: 'LOW',   // Low priority
  };
  return priorities[quadrant];
}
