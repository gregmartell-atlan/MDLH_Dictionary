import { CanonicalSignal, Workstream } from './signals';

/**
 * Types of gaps detected in metadata quality assessment
 */
export type GapType =
  | 'MISSING'     // Required signal is absent
  | 'UNKNOWN'     // Signal availability cannot be determined
  | 'CONFLICT';   // Signal has conflicting values (future use)

/**
 * Severity level for gap prioritization
 */
export type GapSeverity = 'HIGH' | 'MED' | 'LOW';

/**
 * Subject type for gap attribution
 */
export type SubjectType = 'DOMAIN' | 'ASSET' | 'MODEL_ELEMENT';

/**
 * A detected gap in metadata quality
 * Represents a missing or unknown signal on a specific asset or domain
 */
export interface Gap {
  /**
   * Unique identifier for this gap
   */
  id: string;

  /**
   * Type of gap (missing, unknown, conflict)
   */
  gapType: GapType;

  /**
   * Which canonical signal is affected
   */
  signalType: CanonicalSignal;

  /**
   * Subject type (domain, asset, model element)
   */
  subjectType: SubjectType;

  /**
   * Subject identifier (asset GUID, domain ID, etc.)
   */
  subjectId: string;

  /**
   * Human-readable subject name
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
   * Gap severity for prioritization
   */
  severity: GapSeverity;

  /**
   * Remediation workstream this gap belongs to
   */
  workstream: Workstream;

  /**
   * Human-readable explanation of the gap
   */
  explanation: string;

  /**
   * Links to evidence in Atlan (asset URLs, etc.)
   */
  evidenceRefs: string[];

  /**
   * When this gap was detected
   */
  detectedAt?: string;
}

/**
 * Summary statistics for gaps
 */
export interface GapSummary {
  total: number;
  byGapType: Record<GapType, number>;
  bySeverity: Record<GapSeverity, number>;
  byWorkstream: Record<Workstream, number>;
  bySignal: Record<CanonicalSignal, number>;
}

/**
 * Creates a unique gap ID
 */
export function createGapId(
  gapType: GapType,
  signalType: CanonicalSignal,
  subjectId: string
): string {
  return `gap-${gapType.toLowerCase()}-${signalType.toLowerCase()}-${subjectId}`;
}

/**
 * Computes gap summary statistics
 */
export function computeGapSummary(gaps: Gap[]): GapSummary {
  const summary: GapSummary = {
    total: gaps.length,
    byGapType: { MISSING: 0, UNKNOWN: 0, CONFLICT: 0 },
    bySeverity: { HIGH: 0, MED: 0, LOW: 0 },
    byWorkstream: {
      OWNERSHIP: 0,
      SEMANTICS: 0,
      LINEAGE: 0,
      SENSITIVITY_ACCESS: 0,
      QUALITY_FRESHNESS: 0,
    },
    bySignal: {
      OWNERSHIP: 0,
      LINEAGE: 0,
      SEMANTICS: 0,
      SENSITIVITY: 0,
      ACCESS: 0,
      USAGE: 0,
      FRESHNESS: 0,
    },
  };

  for (const gap of gaps) {
    summary.byGapType[gap.gapType]++;
    summary.bySeverity[gap.severity]++;
    summary.byWorkstream[gap.workstream]++;
    summary.bySignal[gap.signalType]++;
  }

  return summary;
}
