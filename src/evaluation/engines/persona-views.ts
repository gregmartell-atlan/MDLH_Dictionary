// ============================================
// PERSONA VIEWS
// Role-based filtering and display configuration
// ============================================

import type {
  Priority,
  MetadataFieldType,
  PersonaType,
  PersonaView,
  FieldCoverage,
} from '../types/priority';
import { PERSONA_VIEWS } from '../types/priority';

/**
 * Filter priorities for a specific persona
 */
export function filterForPersona(
  priorities: Priority[],
  persona: PersonaType
): Priority[] {
  if (persona === 'all') return priorities;

  const view = PERSONA_VIEWS.find(v => v.persona === persona);
  if (!view) return priorities;

  return priorities.filter(p =>
    view.focusFields.includes(p.field) &&
    !view.excludeFields.includes(p.field)
  );
}

/**
 * Get persona-specific dashboard config
 */
export function getPersonaDashboard(persona: PersonaType): PersonaView {
  return PERSONA_VIEWS.find(v => v.persona === persona) || PERSONA_VIEWS[0];
}

/**
 * Get all available personas
 */
export function getAllPersonas(): PersonaView[] {
  return PERSONA_VIEWS;
}

/**
 * Get persona by type
 */
export function getPersonaByType(persona: PersonaType): PersonaView | undefined {
  return PERSONA_VIEWS.find(v => v.persona === persona);
}

/**
 * Filter field coverage for a persona
 */
export function filterCoverageForPersona(
  coverage: FieldCoverage[],
  persona: PersonaType
): FieldCoverage[] {
  if (persona === 'all') return coverage;

  const view = PERSONA_VIEWS.find(v => v.persona === persona);
  if (!view) return coverage;

  return coverage.filter(c =>
    view.focusFields.includes(c.field) &&
    !view.excludeFields.includes(c.field)
  );
}

/**
 * Get focus fields for a persona
 */
export function getPersonaFocusFields(persona: PersonaType): MetadataFieldType[] {
  const view = PERSONA_VIEWS.find(v => v.persona === persona);
  return view?.focusFields || [];
}

/**
 * Get excluded fields for a persona
 */
export function getPersonaExcludedFields(persona: PersonaType): MetadataFieldType[] {
  const view = PERSONA_VIEWS.find(v => v.persona === persona);
  return view?.excludeFields || [];
}

/**
 * Get action verbs for a persona (used in UI)
 */
export function getPersonaActionVerbs(persona: PersonaType): string[] {
  const view = PERSONA_VIEWS.find(v => v.persona === persona);
  return view?.displayConfig.actionVerbs || [];
}

/**
 * Get primary metric name for a persona
 */
export function getPersonaPrimaryMetric(persona: PersonaType): string {
  const view = PERSONA_VIEWS.find(v => v.persona === persona);
  return view?.displayConfig.primaryMetric || 'Score';
}

/**
 * Calculate persona-specific score
 */
export function calculatePersonaScore(
  coverage: FieldCoverage[],
  persona: PersonaType
): number {
  const filteredCoverage = filterCoverageForPersona(coverage, persona);

  if (filteredCoverage.length === 0) return 0;

  const avgCoverage = filteredCoverage.reduce((sum, c) => sum + c.coveragePercent, 0)
    / filteredCoverage.length;

  return Math.round(avgCoverage * 100);
}

/**
 * Get persona-specific recommendations
 */
export function getPersonaRecommendations(
  priorities: Priority[],
  persona: PersonaType
): Priority[] {
  const filtered = filterForPersona(priorities, persona);
  // Return top 3 priorities for this persona
  return filtered.slice(0, 3);
}

/**
 * Check if a field is relevant for a persona
 */
export function isFieldRelevantForPersona(
  field: MetadataFieldType,
  persona: PersonaType
): boolean {
  if (persona === 'all') return true;

  const view = PERSONA_VIEWS.find(v => v.persona === persona);
  if (!view) return true;

  return view.focusFields.includes(field) && !view.excludeFields.includes(field);
}

/**
 * Get chart types recommended for a persona
 */
export function getPersonaChartTypes(persona: PersonaType): string[] {
  const view = PERSONA_VIEWS.find(v => v.persona === persona);
  return view?.displayConfig.chartTypes || [];
}

/**
 * Get persona summary stats
 */
export function getPersonaSummary(
  coverage: FieldCoverage[],
  priorities: Priority[],
  persona: PersonaType
): {
  name: string;
  description: string;
  score: number;
  topPriorities: Priority[];
  focusAreas: MetadataFieldType[];
} {
  const view = getPersonaDashboard(persona);
  const score = calculatePersonaScore(coverage, persona);
  const topPriorities = getPersonaRecommendations(priorities, persona);
  const focusAreas = getPersonaFocusFields(persona);

  return {
    name: view.name,
    description: view.description,
    score,
    topPriorities,
    focusAreas,
  };
}
