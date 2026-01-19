/**
 * Gap Analysis Engine
 *
 * Calculates gaps between current metadata state and requirements.
 * Provides prioritized actions and feasibility assessment.
 */

import type { MetadataFieldType, RequirementType } from '../types/metadata-fields';
import type { FieldCoverageResult } from '../hooks/useFieldCoverage';
import type { RequirementsMatrix, AssetType } from '../types/requirements';
import { getRequirementLevel } from '../types/requirements';
import { getFieldInfo } from '../types/metadata-fields';

// ============================================
// TYPES
// ============================================

export interface GapAnalysis {
  overallGap: {
    current: number;
    target: number;
    gap: number;
    percentage: number;
  };
  fieldGaps: FieldGap[];
  prioritizedActions: PrioritizedAction[];
  feasibilityScore: {
    score: number;
    level: FeasibilityLevel;
    rationale: string[];
  };
}

export interface FieldGap {
  field: MetadataFieldType;
  assetType: string;
  currentCoverage: number;
  targetCoverage: number;
  gap: number;
  effort: {
    assetCount: number;
    hoursEstimate: number;
    canAutomate: boolean;
  };
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  requirementLevel: RequirementType;
}

export interface PrioritizedAction {
  id: string;
  field: MetadataFieldType;
  assetType: string;
  description: string;
  currentState: string;
  targetState: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  effort: {
    assetCount: number;
    hoursEstimate: number;
    canAutomate: boolean;
  };
  impact: {
    coverageIncrease: number;
    assetsAffected: number;
  };
}

export type FeasibilityLevel = 'Conservative' | 'Realistic' | 'Ambitious' | 'Aggressive';

// ============================================
// TARGET COVERAGE BY REQUIREMENT LEVEL
// ============================================

const TARGET_COVERAGE_MAP: Record<RequirementType, number> = {
  'required': 90,
  'recommended': 70,
  'optional': 30,
  'not-applicable': 0,
};

// ============================================
// GAP ANALYSIS ENGINE
// ============================================

export function calculateGapAnalysis(
  coverageData: FieldCoverageResult[],
  requirementsMatrix: RequirementsMatrix | null
): GapAnalysis {
  if (!requirementsMatrix) {
    // Return empty analysis if no requirements defined
    return {
      overallGap: { current: 0, target: 0, gap: 0, percentage: 0 },
      fieldGaps: [],
      prioritizedActions: [],
      feasibilityScore: {
        score: 0,
        level: 'Conservative',
        rationale: ['No requirements matrix defined'],
      },
    };
  }

  // Calculate field-level gaps
  const fieldGaps = calculateFieldGaps(coverageData, requirementsMatrix);

  // Calculate overall gap
  const overallGap = calculateOverallGap(fieldGaps);

  // Generate prioritized actions
  const prioritizedActions = generatePrioritizedActions(fieldGaps);

  // Calculate feasibility
  const feasibilityScore = calculateFeasibility(fieldGaps, prioritizedActions);

  return {
    overallGap,
    fieldGaps,
    prioritizedActions,
    feasibilityScore,
  };
}

// ============================================
// FIELD GAP CALCULATION
// ============================================

function calculateFieldGaps(
  coverageData: FieldCoverageResult[],
  matrix: RequirementsMatrix
): FieldGap[] {
  const gaps: FieldGap[] = [];

  // Iterate through coverage data
  for (const coverage of coverageData) {
    const field = coverage.field as MetadataFieldType;
    const fieldInfo = getFieldInfo(field);

    if (!fieldInfo) continue;

    // Break down by asset type
    for (const [assetType, assetCoverage] of Object.entries(coverage.byAssetType)) {
      const requirementLevel = getRequirementLevel(
        matrix,
        assetType as AssetType,
        field
      );

      // Skip not-applicable fields
      if (requirementLevel === 'not-applicable') continue;

      const targetCoverage = TARGET_COVERAGE_MAP[requirementLevel];
      const currentCoverage = assetCoverage.total > 0
        ? Math.round((assetCoverage.populated / assetCoverage.total) * 100)
        : 0;

      const gap = Math.max(0, targetCoverage - currentCoverage);

      // Only include gaps where we're below target
      if (gap > 0) {
        const missingCount = Math.ceil(
          (gap / 100) * assetCoverage.total
        );

        const hoursEstimate = calculateEffortHours(
          missingCount,
          fieldInfo.effortMinutes,
          fieldInfo.bulkAssignable
        );

        const priority = calculatePriority(gap, requirementLevel);

        gaps.push({
          field,
          assetType,
          currentCoverage,
          targetCoverage,
          gap,
          effort: {
            assetCount: missingCount,
            hoursEstimate,
            canAutomate: fieldInfo.autoPopulated,
          },
          priority,
          requirementLevel,
        });
      }
    }
  }

  // Sort by priority then gap size
  return gaps.sort((a, b) => {
    const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return b.gap - a.gap;
  });
}

// ============================================
// PRIORITY CALCULATION
// ============================================

function calculatePriority(
  gap: number,
  requirementLevel: RequirementType
): 'P0' | 'P1' | 'P2' | 'P3' {
  // P0: required field with >50% gap
  if (requirementLevel === 'required' && gap > 50) {
    return 'P0';
  }

  // P1: required >20% gap OR recommended >50% gap
  if (
    (requirementLevel === 'required' && gap > 20) ||
    (requirementLevel === 'recommended' && gap > 50)
  ) {
    return 'P1';
  }

  // P2: recommended >20% gap
  if (requirementLevel === 'recommended' && gap > 20) {
    return 'P2';
  }

  // P3: everything else
  return 'P3';
}

// ============================================
// EFFORT CALCULATION
// ============================================

function calculateEffortHours(
  assetCount: number,
  minutesPerAsset: number,
  bulkAssignable: boolean
): number {
  if (bulkAssignable) {
    // Bulk operations have economies of scale
    // Assume batch operations reduce time by 40%
    return Math.round((assetCount * minutesPerAsset * 0.6) / 60);
  }

  // Individual operations
  return Math.round((assetCount * minutesPerAsset) / 60);
}

// ============================================
// OVERALL GAP CALCULATION
// ============================================

function calculateOverallGap(fieldGaps: FieldGap[]): {
  current: number;
  target: number;
  gap: number;
  percentage: number;
} {
  if (fieldGaps.length === 0) {
    return { current: 100, target: 100, gap: 0, percentage: 0 };
  }

  // Weight by requirement level
  const weights: Record<RequirementType, number> = {
    'required': 3,
    'recommended': 2,
    'optional': 1,
    'not-applicable': 0,
  };

  let totalWeightedCurrent = 0;
  let totalWeightedTarget = 0;
  let totalWeight = 0;

  for (const gap of fieldGaps) {
    const weight = weights[gap.requirementLevel];
    totalWeightedCurrent += gap.currentCoverage * weight;
    totalWeightedTarget += gap.targetCoverage * weight;
    totalWeight += weight;
  }

  const current = totalWeight > 0
    ? Math.round(totalWeightedCurrent / totalWeight)
    : 0;

  const target = totalWeight > 0
    ? Math.round(totalWeightedTarget / totalWeight)
    : 0;

  const gap = Math.max(0, target - current);
  const percentage = target > 0 ? Math.round((gap / target) * 100) : 0;

  return { current, target, gap, percentage };
}

// ============================================
// ACTION GENERATION
// ============================================

function generatePrioritizedActions(fieldGaps: FieldGap[]): PrioritizedAction[] {
  return fieldGaps.map((gap, index) => {
    const fieldInfo = getFieldInfo(gap.field);
    const fieldName = fieldInfo?.displayName || gap.field;

    return {
      id: `action-${index}`,
      field: gap.field,
      assetType: gap.assetType,
      description: generateActionDescription(gap, fieldName),
      currentState: `${gap.currentCoverage}% coverage`,
      targetState: `${gap.targetCoverage}% coverage (${gap.requirementLevel})`,
      priority: gap.priority,
      effort: gap.effort,
      impact: {
        coverageIncrease: gap.gap,
        assetsAffected: gap.effort.assetCount,
      },
    };
  });
}

function generateActionDescription(gap: FieldGap, fieldName: string): string {
  if (gap.effort.canAutomate) {
    return `Enable automated ${fieldName} for ${gap.assetType}s`;
  }

  if (gap.effort.assetCount <= 10) {
    return `Manually populate ${fieldName} for ${gap.effort.assetCount} ${gap.assetType}s`;
  }

  return `Populate ${fieldName} for ${gap.effort.assetCount} ${gap.assetType}s`;
}

// ============================================
// FEASIBILITY CALCULATION
// ============================================

function calculateFeasibility(
  _fieldGaps: FieldGap[],
  actions: PrioritizedAction[]
): {
  score: number;
  level: FeasibilityLevel;
  rationale: string[];
} {
  const rationale: string[] = [];

  // Calculate total effort needed
  const totalHours = actions.reduce((sum, action) => sum + action.effort.hoursEstimate, 0);
  const totalAssets = actions.reduce((sum, action) => sum + action.effort.assetCount, 0);

  // Count automatable actions
  const automatableActions = actions.filter(a => a.effort.canAutomate).length;
  const automatablePercent = actions.length > 0
    ? (automatableActions / actions.length) * 100
    : 0;

  // Count by priority
  const p0Count = actions.filter(a => a.priority === 'P0').length;

  // Calculate feasibility score (0-100)
  let score = 100;

  // Deduct based on total effort
  if (totalHours > 200) {
    score -= 40;
    rationale.push(`High effort required: ${totalHours} hours`);
  } else if (totalHours > 100) {
    score -= 25;
    rationale.push(`Moderate effort required: ${totalHours} hours`);
  } else if (totalHours > 40) {
    score -= 10;
    rationale.push(`Manageable effort: ${totalHours} hours`);
  } else {
    rationale.push(`Low effort required: ${totalHours} hours`);
  }

  // Deduct based on critical actions
  if (p0Count > 10) {
    score -= 30;
    rationale.push(`${p0Count} critical (P0) gaps to address`);
  } else if (p0Count > 5) {
    score -= 20;
    rationale.push(`${p0Count} critical (P0) gaps to address`);
  } else if (p0Count > 0) {
    score -= 10;
    rationale.push(`${p0Count} critical (P0) gaps to address`);
  }

  // Add back based on automation potential
  if (automatablePercent > 50) {
    score += 15;
    rationale.push(`${Math.round(automatablePercent)}% of actions can be automated`);
  } else if (automatablePercent > 25) {
    score += 10;
    rationale.push(`${Math.round(automatablePercent)}% of actions can be automated`);
  }

  // Deduct for large asset counts
  if (totalAssets > 5000) {
    score -= 20;
    rationale.push(`Large scope: ${totalAssets.toLocaleString()} assets affected`);
  } else if (totalAssets > 1000) {
    score -= 10;
    rationale.push(`Moderate scope: ${totalAssets.toLocaleString()} assets affected`);
  } else {
    rationale.push(`Focused scope: ${totalAssets.toLocaleString()} assets affected`);
  }

  // Ensure score stays within bounds
  score = Math.max(0, Math.min(100, score));

  // Determine level
  let level: FeasibilityLevel;
  if (score >= 75) {
    level = 'Conservative';
    rationale.unshift('Highly achievable with current resources');
  } else if (score >= 60) {
    level = 'Realistic';
    rationale.unshift('Achievable with focused effort');
  } else if (score >= 40) {
    level = 'Ambitious';
    rationale.unshift('Requires significant commitment');
  } else {
    level = 'Aggressive';
    rationale.unshift('Challenging timeline, consider phasing');
  }

  return { score, level, rationale };
}
