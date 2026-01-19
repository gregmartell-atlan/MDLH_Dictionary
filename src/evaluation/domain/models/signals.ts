/**
 * Canonical data quality signals for health assessment
 * Maps to the 7 core metadata attributes needed for AI readiness
 */

export type CanonicalSignal =
  | 'OWNERSHIP'       // Assets have assigned owners (users or groups)
  | 'LINEAGE'         // Upstream/downstream relationships documented
  | 'SEMANTICS'       // Descriptions, glossary terms, documentation present
  | 'SENSITIVITY'     // Classification tags and data sensitivity markers
  | 'ACCESS'          // Access policies and permissions defined
  | 'USAGE'           // Usage telemetry and popularity metrics available
  | 'FRESHNESS';      // Data freshness SLAs and quality monitoring

/**
 * Tri-state value for signal presence
 * - true: Signal is present
 * - false: Signal is explicitly absent
 * - 'UNKNOWN': Signal availability cannot be determined
 */
export type SignalValue = true | false | 'UNKNOWN';

/**
 * Complete signal profile for an asset
 * Maps each canonical signal to its presence state
 */
export interface CanonicalSignals {
  OWNERSHIP: SignalValue;
  LINEAGE: SignalValue;
  SEMANTICS: SignalValue;
  SENSITIVITY: SignalValue;
  ACCESS: SignalValue;
  USAGE: SignalValue;
  FRESHNESS: SignalValue;
}

/**
 * Workstream categorization for remediation activities
 * Groups related signals for action planning
 */
export type Workstream =
  | 'OWNERSHIP'           // Owner assignment and stewardship
  | 'SEMANTICS'           // Documentation and descriptions
  | 'LINEAGE'             // Relationship mapping
  | 'SENSITIVITY_ACCESS'  // Classification and access control
  | 'QUALITY_FRESHNESS';  // Data quality and monitoring

/**
 * Maps canonical signals to their remediation workstreams
 */
export const SIGNAL_TO_WORKSTREAM: Record<CanonicalSignal, Workstream> = {
  OWNERSHIP: 'OWNERSHIP',
  SEMANTICS: 'SEMANTICS',
  LINEAGE: 'LINEAGE',
  SENSITIVITY: 'SENSITIVITY_ACCESS',
  ACCESS: 'SENSITIVITY_ACCESS',
  USAGE: 'QUALITY_FRESHNESS',
  FRESHNESS: 'QUALITY_FRESHNESS',
};

/**
 * Signal importance for gap severity calculation
 * Critical signals → HIGH severity gaps
 * Important signals → MED severity gaps
 * Optional signals → LOW severity gaps
 */
export const SIGNAL_SEVERITY_MAP: Record<CanonicalSignal, 'HIGH' | 'MED' | 'LOW'> = {
  OWNERSHIP: 'HIGH',      // Always critical
  SEMANTICS: 'HIGH',      // Always critical for discoverability
  LINEAGE: 'MED',         // Important for understanding
  SENSITIVITY: 'MED',     // Important for compliance
  ACCESS: 'MED',          // Important for security
  USAGE: 'LOW',           // Nice to have for prioritization
  FRESHNESS: 'LOW',       // Nice to have for quality
};
