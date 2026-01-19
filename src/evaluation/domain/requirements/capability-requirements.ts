import { CanonicalSignal } from '../models/signals';

/**
 * Maps capability IDs to their required signals
 * Defines which canonical signals must be present for each capability
 */
export interface CapabilityRequirements {
  /**
   * Capability identifier
   */
  capabilityId: string;

  /**
   * Human-readable capability name
   */
  name: string;

  /**
   * Description of this capability
   */
  description: string;

  /**
   * Required signals for this capability
   * These are the minimum signals needed to assess readiness
   */
  requiredSignals: CanonicalSignal[];

  /**
   * Critical signals (subset of required)
   * Missing these results in HIGH severity gaps
   */
  criticalSignals: CanonicalSignal[];

  /**
   * Optional signals (nice to have but not required)
   */
  optionalSignals: CanonicalSignal[];
}

/**
 * Default capability requirements
 */
export const DEFAULT_CAPABILITY_REQUIREMENTS: CapabilityRequirements[] = [
  {
    capabilityId: 'meta_ai_readiness',
    name: 'Meta AI Readiness',
    description: 'Cross-cutting readiness for AI/ML workloads - semantic, operational, traceability, trust, and safety',
    requiredSignals: ['OWNERSHIP', 'SEMANTICS', 'LINEAGE', 'SENSITIVITY', 'USAGE', 'FRESHNESS'],
    criticalSignals: ['OWNERSHIP', 'SEMANTICS'],
    optionalSignals: ['ACCESS'],
  },
  {
    capabilityId: 'rag',
    name: 'RAG (Retrieval-Augmented Generation)',
    description: 'Readiness for document retrieval and AI grounding - requires descriptions, ownership, and freshness',
    requiredSignals: ['SEMANTICS', 'OWNERSHIP', 'FRESHNESS', 'LINEAGE'],
    criticalSignals: ['SEMANTICS', 'OWNERSHIP'],
    optionalSignals: ['USAGE', 'SENSITIVITY', 'ACCESS'],
  },
  {
    capabilityId: 'text_to_sql',
    name: 'Text-to-SQL',
    description: 'Natural language query generation - requires semantics, joinability (lineage), and safety',
    requiredSignals: ['SEMANTICS', 'OWNERSHIP', 'LINEAGE', 'SENSITIVITY'],
    criticalSignals: ['SEMANTICS', 'OWNERSHIP'],
    optionalSignals: ['USAGE', 'FRESHNESS', 'ACCESS'],
  },
  {
    capabilityId: 'ai_agents',
    name: 'AI Agents',
    description: 'Autonomous data access - requires ownership, policies, runbooks, and reliability',
    requiredSignals: ['OWNERSHIP', 'SEMANTICS', 'ACCESS', 'SENSITIVITY', 'LINEAGE'],
    criticalSignals: ['OWNERSHIP', 'ACCESS', 'SENSITIVITY'],
    optionalSignals: ['USAGE', 'FRESHNESS'],
  },
  {
    capabilityId: 'dsar_retention',
    name: 'DSAR & Retention',
    description: 'Data subject access rights and retention policies - requires ownership, policies, and protection',
    requiredSignals: ['OWNERSHIP', 'SENSITIVITY', 'ACCESS', 'LINEAGE'],
    criticalSignals: ['OWNERSHIP', 'SENSITIVITY', 'ACCESS'],
    optionalSignals: ['SEMANTICS', 'USAGE', 'FRESHNESS'],
  },
  {
    capabilityId: 'governance_fundamentals',
    name: 'Governance Fundamentals',
    description: 'Basic metadata hygiene - ownership and descriptions are universal needs',
    requiredSignals: ['OWNERSHIP', 'SEMANTICS'],
    criticalSignals: ['OWNERSHIP', 'SEMANTICS'],
    optionalSignals: ['LINEAGE', 'SENSITIVITY', 'ACCESS', 'USAGE', 'FRESHNESS'],
  },
];

/**
 * Gets capability requirements by ID
 */
export function getCapabilityRequirements(capabilityId: string): CapabilityRequirements | undefined {
  return DEFAULT_CAPABILITY_REQUIREMENTS.find((req) => req.capabilityId === capabilityId);
}

/**
 * Gets all capability IDs
 */
export function getAllCapabilityIds(): string[] {
  return DEFAULT_CAPABILITY_REQUIREMENTS.map((req) => req.capabilityId);
}

/**
 * Checks if a signal is critical for a capability
 */
export function isCriticalSignal(capabilityId: string, signal: CanonicalSignal): boolean {
  const requirements = getCapabilityRequirements(capabilityId);
  return requirements?.criticalSignals.includes(signal) ?? false;
}

/**
 * Checks if a signal is required for a capability
 */
export function isRequiredSignal(capabilityId: string, signal: CanonicalSignal): boolean {
  const requirements = getCapabilityRequirements(capabilityId);
  return requirements?.requiredSignals.includes(signal) ?? false;
}
