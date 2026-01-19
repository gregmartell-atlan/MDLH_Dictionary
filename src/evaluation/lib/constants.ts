/**
 * Shared constants across the application
 */

/**
 * Human-readable names for AI capability IDs
 */
export const CAPABILITY_NAMES: Record<string, string> = {
  text_to_sql: 'Text-to-SQL',
  rag: 'RAG',
  meta_ai_readiness: 'Meta AI Readiness',
  ai_agents: 'AI Agents',
  dsar_retention: 'DSAR & Retention',
  governance_fundamentals: 'Governance Fundamentals',
};

/**
 * Get the display name for a capability ID
 * @param capabilityId - The capability identifier
 * @returns Human-readable name or formatted fallback
 */
export function getCapabilityName(capabilityId: string): string {
  return CAPABILITY_NAMES[capabilityId] || capabilityId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
