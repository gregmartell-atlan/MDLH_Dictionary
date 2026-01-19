// ============================================
// PRIORITY ENGINE
// Computes priorities based on audit data + pattern requirements
// ============================================

import type {
  PriorityInput,
  Priority,
  PriorityLevel,
  PriorityDrift,
  PatternTemplate,
  FieldCoverage,
} from '../types/priority';
import {
  PRIORITY_BADGE_CONFIG,
  COMPLETENESS_WEIGHTS,
  EFFORT_ESTIMATES,
} from '../types/priority';

/**
 * Compute priority for a single metadata field
 */
export function computePriority(input: PriorityInput): Priority {
  let score = 0;
  const reasoning: string[] = [];

  // 1. Gap severity (inverse of coverage, scaled to 40 points)
  const gapScore = (1 - input.currentCoverage) * 40;
  score += gapScore;
  if (input.currentCoverage < 0.25) {
    reasoning.push(`Critical gap: only ${(input.currentCoverage * 100).toFixed(0)}% coverage`);
  } else if (input.currentCoverage < 0.5) {
    reasoning.push(`Significant gap: ${(input.currentCoverage * 100).toFixed(0)}% coverage`);
  }

  // 2. Pattern requirement (30 points for required, 15 for recommended)
  if (input.isRequired) {
    score += 30;
    reasoning.push('Required by selected pattern');
  } else if (input.isRecommended) {
    score += 15;
    reasoning.push('Recommended by selected pattern');
  }

  // 3. Completeness weight contribution (normalized to ~20 points max)
  const weightContribution = (input.weightScore / 30) * 20; // 30 is max weight
  score += weightContribution;
  if (input.weightScore >= 25) {
    reasoning.push('High impact on completeness score');
  }

  // 4. Effort adjustment (quick wins get +10, hard tasks get -10)
  if (input.estimatedEffort === 'low') {
    score += 10;
    reasoning.push('Quick win: low effort to fix');
  } else if (input.estimatedEffort === 'high') {
    score -= 10;
    reasoning.push('Note: higher effort required');
  }

  // 5. Asset volume boost (more assets = higher priority)
  if (input.assetCount > 1000) {
    score += 5;
    reasoning.push(`High impact: ${input.assetCount.toLocaleString()} assets affected`);
  }

  // Determine priority level from score
  const config = PRIORITY_BADGE_CONFIG.find(c => score >= c.minScore)
    || PRIORITY_BADGE_CONFIG[PRIORITY_BADGE_CONFIG.length - 1];

  return {
    field: input.field,
    level: config.level,
    score: Math.round(score),
    badge: config.badge,
    label: config.label,
    reasoning,
  };
}

/**
 * Compute priorities for all fields given audit + pattern
 */
export function computeAllPriorities(
  audit: FieldCoverage[],
  pattern: PatternTemplate | null
): Priority[] {
  const priorities: Priority[] = [];

  for (const coverage of audit) {
    const field = coverage.field;

    // Find pattern requirement if pattern selected
    let isRequired = false;
    let isRecommended = false;

    if (pattern) {
      const patternField = pattern.fields.find(f => f.field === field);
      if (patternField) {
        isRequired = patternField.requirement === 'required';
        isRecommended = patternField.requirement === 'recommended';
      }
    }

    const input: PriorityInput = {
      field,
      currentCoverage: coverage.coveragePercent,
      assetCount: coverage.totalAssets,
      isRequired,
      isRecommended,
      weightScore: COMPLETENESS_WEIGHTS[field] || 0,
      estimatedEffort: EFFORT_ESTIMATES[field] || 'medium',
    };

    priorities.push(computePriority(input));
  }

  // Sort by score descending (highest priority first)
  return priorities.sort((a, b) => b.score - a.score);
}

/**
 * Detect priority drift between two audit snapshots
 */
export function detectPriorityDrift(
  previous: Priority[],
  current: Priority[]
): PriorityDrift[] {
  const drifts: PriorityDrift[] = [];

  for (const curr of current) {
    const prev = previous.find(p => p.field === curr.field);
    if (!prev) continue;

    const levelOrder: PriorityLevel[] = ['P0', 'P1', 'P2', 'P3'];
    const prevIndex = levelOrder.indexOf(prev.level);
    const currIndex = levelOrder.indexOf(curr.level);

    if (currIndex !== prevIndex) {
      drifts.push({
        field: curr.field,
        previousLevel: prev.level,
        currentLevel: curr.level,
        direction: currIndex < prevIndex ? 'worsened' : 'improved',
        scoreDelta: curr.score - prev.score,
      });
    }
  }

  return drifts;
}

/**
 * Get the top N priority items
 */
export function getTopPriorities(
  priorities: Priority[],
  limit: number = 5
): Priority[] {
  return priorities.slice(0, limit);
}

/**
 * Filter priorities by level
 */
export function filterByLevel(
  priorities: Priority[],
  levels: PriorityLevel[]
): Priority[] {
  return priorities.filter(p => levels.includes(p.level));
}

/**
 * Calculate overall priority score for the entire model
 */
export function calculateOverallScore(priorities: Priority[]): number {
  if (priorities.length === 0) return 0;

  // Lower is better - calculate inverse of average priority score
  const avgScore = priorities.reduce((sum, p) => sum + p.score, 0) / priorities.length;
  // Normalize to 0-100 where 100 is best (no priorities)
  return Math.max(0, Math.min(100, 100 - avgScore));
}

/**
 * Get priority badge configuration by level
 */
export function getPriorityConfig(level: PriorityLevel) {
  return PRIORITY_BADGE_CONFIG.find(c => c.level === level) || PRIORITY_BADGE_CONFIG[PRIORITY_BADGE_CONFIG.length - 1];
}
