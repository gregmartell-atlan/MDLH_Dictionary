/**
 * Signal Definitions
 *
 * Defines the canonical signals for metadata assessment.
 * Each signal aggregates multiple fields into a single health indicator.
 *
 * Signals are composed from fields using aggregation rules:
 * - 'any': Present if ANY contributing field has a value
 * - 'all': Present only if ALL contributing fields have values
 * - 'weighted_threshold': Present if weighted sum >= threshold
 * 
 * Ported from atlan-metadata-evaluation/assessment/packages/domain/src/catalog/signal-definitions.ts
 */

// =============================================================================
// SIGNAL TYPE DEFINITION
// =============================================================================

/**
 * @typedef {'OWNERSHIP' | 'SEMANTICS' | 'LINEAGE' | 'SENSITIVITY' | 'ACCESS' | 'QUALITY' | 'FRESHNESS' | 'USAGE' | 'AI_READY' | 'TRUST'} SignalType
 */

/**
 * @typedef {'OWNERSHIP' | 'SEMANTICS' | 'LINEAGE' | 'SENSITIVITY_ACCESS' | 'QUALITY_FRESHNESS'} WorkstreamType
 */

/**
 * @typedef {'HIGH' | 'MED' | 'LOW'} SeverityLevel
 */

/**
 * @typedef {Object} SignalDefinition
 * @property {SignalType} id - Unique signal identifier
 * @property {string} displayName - Human-readable name
 * @property {string} description - Description of what this signal represents
 * @property {{method: 'any' | 'all' | 'weighted_threshold', threshold?: number}} aggregation - How to aggregate fields
 * @property {WorkstreamType} workstream - Which workstream this belongs to
 * @property {SeverityLevel} severity - Importance level
 * @property {string} [guidanceUrl] - Link to documentation
 */

// =============================================================================
// SIGNAL DEFINITIONS
// =============================================================================

/** @type {SignalDefinition[]} */
export const SIGNAL_DEFINITIONS = [
  {
    id: 'OWNERSHIP',
    displayName: 'Ownership',
    description: 'Asset has accountable owners or stewards assigned. Critical for knowing who to contact about data issues.',
    aggregation: { method: 'any' },
    workstream: 'OWNERSHIP',
    severity: 'HIGH',
    guidanceUrl: 'https://solutions.atlan.com/ownership-enrichment/',
  },
  {
    id: 'SEMANTICS',
    displayName: 'Semantics',
    description: 'Asset has documentation, descriptions, or glossary term links. Essential for discoverability and understanding.',
    aggregation: { method: 'any' },
    workstream: 'SEMANTICS',
    severity: 'HIGH',
    guidanceUrl: 'https://solutions.atlan.com/description-enrichment/',
  },
  {
    id: 'LINEAGE',
    displayName: 'Lineage',
    description: 'Asset has documented upstream/downstream data flow relationships. Important for impact analysis and RCA.',
    aggregation: { method: 'any' },
    workstream: 'LINEAGE',
    severity: 'MED',
    guidanceUrl: 'https://developer.atlan.com/lineage/',
  },
  {
    id: 'SENSITIVITY',
    displayName: 'Sensitivity',
    description: 'Asset has classification tags indicating data sensitivity (PII, PHI, etc.). Required for compliance.',
    aggregation: { method: 'any' },
    workstream: 'SENSITIVITY_ACCESS',
    severity: 'MED',
    guidanceUrl: 'https://solutions.atlan.com/classification-propagation/',
  },
  {
    id: 'ACCESS',
    displayName: 'Access Control',
    description: 'Asset has access policies defined. Important for security and compliance enforcement.',
    aggregation: { method: 'any' },
    workstream: 'SENSITIVITY_ACCESS',
    severity: 'MED',
    guidanceUrl: 'https://developer.atlan.com/access-control/',
  },
  {
    id: 'QUALITY',
    displayName: 'Quality',
    description: 'Asset has data quality monitoring configured (Soda, Anomalo, Monte Carlo). Indicates trustworthiness.',
    aggregation: { method: 'any' },
    workstream: 'QUALITY_FRESHNESS',
    severity: 'LOW',
    guidanceUrl: 'https://developer.atlan.com/data-quality/',
  },
  {
    id: 'FRESHNESS',
    displayName: 'Freshness',
    description: 'Asset has freshness/timeliness monitoring. Important for time-sensitive use cases.',
    aggregation: { method: 'any' },
    workstream: 'QUALITY_FRESHNESS',
    severity: 'LOW',
    guidanceUrl: 'https://developer.atlan.com/data-quality/',
  },
  {
    id: 'USAGE',
    displayName: 'Usage',
    description: 'Asset has usage telemetry available (popularity, query counts). Useful for prioritization.',
    aggregation: { method: 'any' },
    workstream: 'QUALITY_FRESHNESS',
    severity: 'LOW',
    guidanceUrl: 'https://developer.atlan.com/popularity/',
  },
  {
    id: 'AI_READY',
    displayName: 'AI Readiness',
    description: 'Asset is approved for AI/ML training and usage. Required for RAG and AI agent use cases.',
    aggregation: { method: 'weighted_threshold', threshold: 0.7 },
    workstream: 'SENSITIVITY_ACCESS',
    severity: 'HIGH',
    guidanceUrl: 'https://developer.atlan.com/ai-governance/',
  },
  {
    id: 'TRUST',
    displayName: 'Trust',
    description: 'Asset has certification or trust markers. Indicates governance approval.',
    aggregation: { method: 'any' },
    workstream: 'OWNERSHIP',
    severity: 'MED',
    guidanceUrl: 'https://solutions.atlan.com/certification/',
  },
];

// =============================================================================
// SIGNAL LOOKUP UTILITIES
// =============================================================================

/**
 * Get signal definition by ID
 * @param {SignalType} id
 * @returns {SignalDefinition | undefined}
 */
export function getSignalById(id) {
  return SIGNAL_DEFINITIONS.find(s => s.id === id);
}

/**
 * Get signals by workstream
 * @param {WorkstreamType} workstream
 * @returns {SignalDefinition[]}
 */
export function getSignalsByWorkstream(workstream) {
  return SIGNAL_DEFINITIONS.filter(s => s.workstream === workstream);
}

/**
 * Get signals by severity
 * @param {SeverityLevel} severity
 * @returns {SignalDefinition[]}
 */
export function getSignalsBySeverity(severity) {
  return SIGNAL_DEFINITIONS.filter(s => s.severity === severity);
}

/**
 * Get all signal IDs
 * @returns {SignalType[]}
 */
export function getAllSignalIds() {
  return SIGNAL_DEFINITIONS.map(s => s.id);
}

/**
 * Create signal ID → definition map
 * @returns {Map<SignalType, SignalDefinition>}
 */
export function createSignalMap() {
  return new Map(SIGNAL_DEFINITIONS.map(s => [s.id, s]));
}

// =============================================================================
// WORKSTREAM DEFINITIONS
// =============================================================================

/**
 * @typedef {Object} WorkstreamDefinition
 * @property {WorkstreamType} id
 * @property {string} displayName
 * @property {string} description
 * @property {SignalType[]} signals
 * @property {number} priority
 */

/** @type {WorkstreamDefinition[]} */
export const WORKSTREAM_DEFINITIONS = [
  {
    id: 'OWNERSHIP',
    displayName: 'Ownership & Stewardship',
    description: 'Assign owners and stewards to assets for accountability.',
    signals: ['OWNERSHIP', 'TRUST'],
    priority: 1,
  },
  {
    id: 'SEMANTICS',
    displayName: 'Documentation & Context',
    description: 'Enrich assets with descriptions, READMEs, and glossary terms.',
    signals: ['SEMANTICS'],
    priority: 2,
  },
  {
    id: 'LINEAGE',
    displayName: 'Lineage & Relationships',
    description: 'Document data flow and relationships between assets.',
    signals: ['LINEAGE'],
    priority: 3,
  },
  {
    id: 'SENSITIVITY_ACCESS',
    displayName: 'Classification & Access Control',
    description: 'Apply sensitivity tags and configure access policies.',
    signals: ['SENSITIVITY', 'ACCESS', 'AI_READY'],
    priority: 4,
  },
  {
    id: 'QUALITY_FRESHNESS',
    displayName: 'Quality & Observability',
    description: 'Configure DQ monitoring and freshness tracking.',
    signals: ['QUALITY', 'FRESHNESS', 'USAGE'],
    priority: 5,
  },
];

/**
 * Get workstream for a signal
 * @param {SignalType} signalId
 * @returns {WorkstreamDefinition | undefined}
 */
export function getWorkstreamForSignal(signalId) {
  return WORKSTREAM_DEFINITIONS.find(w => w.signals.includes(signalId));
}

// =============================================================================
// SEVERITY MAPPING
// =============================================================================

/**
 * Maps signal severity to gap priority
 * @type {Record<SeverityLevel, number>}
 */
export const SEVERITY_TO_PRIORITY = {
  HIGH: 1,
  MED: 2,
  LOW: 3,
};

/**
 * Get gap priority for a signal
 * @param {SignalType} signalId
 * @returns {number}
 */
export function getSignalPriority(signalId) {
  const signal = getSignalById(signalId);
  return signal ? SEVERITY_TO_PRIORITY[signal.severity] : 3;
}
