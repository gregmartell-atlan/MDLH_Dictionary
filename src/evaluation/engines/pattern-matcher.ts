// ============================================
// PATTERN MATCHER
// Match audit data to pattern templates
// ============================================

import type {
  PatternTemplate,
  PatternMatch,
  ImplementationPlan,
  ImplementationPhase,
  FieldCoverage,
  MetadataFieldType,
} from '../types/priority';
import { PATTERN_TEMPLATES } from '../types/priority';

/**
 * Analyze how well current metadata matches each pattern
 */
export function matchPatterns(
  audit: FieldCoverage[],
  coverageThreshold: number = 0.7
): PatternMatch[] {
  return PATTERN_TEMPLATES.map(pattern => {
    const requiredFields = pattern.fields.filter(f => f.requirement === 'required');
    const recommendedFields = pattern.fields.filter(f => f.requirement === 'recommended');

    // Check required field coverage
    const requiredGaps: MetadataFieldType[] = [];
    let requiredScore = 0;

    for (const field of requiredFields) {
      const coverage = audit.find(a => a.field === field.field);
      if (coverage && coverage.coveragePercent >= coverageThreshold) {
        requiredScore += 1;
      } else {
        requiredGaps.push(field.field);
      }
    }

    // Check recommended field coverage
    const recommendedGaps: MetadataFieldType[] = [];
    let recommendedScore = 0;

    for (const field of recommendedFields) {
      const coverage = audit.find(a => a.field === field.field);
      if (coverage && coverage.coveragePercent >= coverageThreshold) {
        recommendedScore += 1;
      } else {
        recommendedGaps.push(field.field);
      }
    }

    // Calculate match score (required fields weighted 2x)
    const maxScore = requiredFields.length * 2 + recommendedFields.length;
    const actualScore = requiredScore * 2 + recommendedScore;
    const matchScore = maxScore > 0 ? (actualScore / maxScore) * 100 : 0;

    return {
      pattern,
      matchScore: Math.round(matchScore),
      requiredGaps,
      recommendedGaps,
      readyToImplement: requiredGaps.length === 0,
    };
  }).sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Suggest best pattern based on current state
 */
export function suggestPattern(audit: FieldCoverage[]): PatternMatch | null {
  const matches = matchPatterns(audit);

  // Return highest scoring pattern that's not already complete
  return matches.find(m => m.matchScore < 100) || null;
}

/**
 * Get pattern by ID
 */
export function getPatternById(id: string): PatternTemplate | undefined {
  return PATTERN_TEMPLATES.find(p => p.id === id);
}

/**
 * Generate implementation plan for a pattern
 */
export function generateImplementationPlan(
  pattern: PatternTemplate,
  audit: FieldCoverage[]
): ImplementationPlan {
  const match = matchPatterns(audit).find(m => m.pattern.id === pattern.id);
  if (!match) {
    throw new Error(`Pattern ${pattern.id} not found`);
  }

  const phases: ImplementationPhase[] = [];

  // Phase 1: Required fields
  if (match.requiredGaps.length > 0) {
    phases.push({
      name: 'Foundation',
      description: 'Address required metadata fields',
      fields: match.requiredGaps,
      estimatedWeeks: Math.ceil(match.requiredGaps.length * 1.5),
      milestone: 'Pattern requirements met',
    });
  }

  // Phase 2: Recommended fields
  if (match.recommendedGaps.length > 0) {
    phases.push({
      name: 'Enhancement',
      description: 'Add recommended metadata fields',
      fields: match.recommendedGaps,
      estimatedWeeks: Math.ceil(match.recommendedGaps.length * 1),
      milestone: 'Pattern fully implemented',
    });
  }

  // Phase 3: Optimization
  phases.push({
    name: 'Optimization',
    description: 'Establish continuous enrichment processes',
    fields: [],
    estimatedWeeks: 2,
    milestone: 'Sustainable governance achieved',
  });

  return {
    pattern,
    currentMatchScore: match.matchScore,
    phases,
    totalEstimatedWeeks: phases.reduce((sum, p) => sum + p.estimatedWeeks, 0),
  };
}

/**
 * Get patterns sorted by how close they are to completion
 */
export function getClosestPatterns(
  audit: FieldCoverage[],
  limit: number = 3
): PatternMatch[] {
  const matches = matchPatterns(audit);
  return matches
    .filter(m => m.matchScore > 0 && m.matchScore < 100)
    .slice(0, limit);
}

/**
 * Get patterns that are ready to implement (all required fields met)
 */
export function getReadyPatterns(audit: FieldCoverage[]): PatternMatch[] {
  return matchPatterns(audit).filter(m => m.readyToImplement);
}

/**
 * Calculate effort to complete a pattern
 */
export function calculatePatternEffort(
  pattern: PatternTemplate,
  audit: FieldCoverage[]
): { totalWeeks: number; requiredWeeks: number; recommendedWeeks: number } {
  const match = matchPatterns(audit).find(m => m.pattern.id === pattern.id);
  if (!match) {
    return { totalWeeks: 0, requiredWeeks: 0, recommendedWeeks: 0 };
  }

  const requiredWeeks = Math.ceil(match.requiredGaps.length * 1.5);
  const recommendedWeeks = Math.ceil(match.recommendedGaps.length * 1);
  const totalWeeks = requiredWeeks + recommendedWeeks + 2; // +2 for optimization phase

  return { totalWeeks, requiredWeeks, recommendedWeeks };
}

/**
 * Get field rationale from pattern
 */
export function getFieldRationale(
  pattern: PatternTemplate,
  field: MetadataFieldType
): string | undefined {
  return pattern.fields.find(f => f.field === field)?.rationale;
}

/**
 * Check if a field is required by a pattern
 */
export function isFieldRequired(
  pattern: PatternTemplate,
  field: MetadataFieldType
): boolean {
  const patternField = pattern.fields.find(f => f.field === field);
  return patternField?.requirement === 'required';
}

/**
 * Get all required fields for a pattern
 */
export function getRequiredFields(pattern: PatternTemplate): MetadataFieldType[] {
  return pattern.fields
    .filter(f => f.requirement === 'required')
    .map(f => f.field);
}

/**
 * Get all recommended fields for a pattern
 */
export function getRecommendedFields(pattern: PatternTemplate): MetadataFieldType[] {
  return pattern.fields
    .filter(f => f.requirement === 'recommended')
    .map(f => f.field);
}
