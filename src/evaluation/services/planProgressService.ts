/**
 * Plan Progress Service
 *
 * Calculates real-time progress for enrichment plans by:
 * 1. Finding all assets matching plan requirement scopes
 * 2. Counting how many have the required field
 * 3. Calculating completion %, velocity, and ETA
 */

import type { EnrichmentPlan, EnrichmentPlanProgress, EnrichmentPlanRequirement } from '../types/enrichment-plan';
import type { AtlanAssetSummary } from '../types/atlan-api';
import { comparePlanToAssets } from './planComparisonEngine';

// ============================================
// PROGRESS CALCULATION
// ============================================

export interface ProgressSnapshot {
  requirementId: string;
  currentCount: number;
  targetCount: number;
  percentComplete: number;
  assetsWithField: string[];
  assetsWithoutField: string[];
  weeklyVelocity?: number;
  estimatedCompletionDate?: string;
  onTrack: boolean;
}



/**
 * Check if an asset has the required field
 */
function assetHasField(asset: AtlanAssetSummary, fieldType: string): boolean {
  const attrs = asset.attributes;
  switch (fieldType) {
    case 'description':
      return !!attrs?.description && attrs.description.trim().length > 0;
    case 'ownerUsers':
      return !!(attrs?.ownerUsers && (attrs.ownerUsers as any[]).length > 0);
    case 'ownerGroups':
      return !!(attrs?.ownerGroups && (attrs.ownerGroups as any[]).length > 0);
    case 'atlanTags':
      return !!(attrs?.atlanTags && (attrs.atlanTags as any[]).length > 0);
    case 'glossaryTerms':
      return !!(attrs?.meanings && (attrs.meanings as any[]).length > 0);
    case 'certificateStatus':
      return !!(attrs?.certificateStatus && attrs.certificateStatus !== 'DRAFT');
    case 'readme':
      return !!(attrs && (attrs as any).readme && (attrs as any).readme.trim().length > 0);
    case 'userDescription':
      return !!attrs?.userDescription && attrs.userDescription.trim().length > 0;
    default:
      return false;
  }
}

/**
 * Calculate progress for a single requirement
 */
export function calculateRequirementProgress(
  requirement: EnrichmentPlanRequirement,
  scopedAssets: AtlanAssetSummary[],
  targetDate?: string
): ProgressSnapshot {
  const targetCount = requirement.targetCount || scopedAssets.length;

  const assetsWithField: string[] = [];
  const assetsWithoutField: string[] = [];

  scopedAssets.forEach((asset) => {
    if (assetHasField(asset, requirement.fieldType)) {
      assetsWithField.push(asset.guid);
    } else {
      assetsWithoutField.push(asset.guid);
    }
  });

  const currentCount = assetsWithField.length;
  const percentComplete = targetCount > 0 ? Math.round((currentCount / targetCount) * 100) : 100;

  // Estimate completion (placeholder - would need historical data)
  let onTrack = true;
  let estimatedCompletionDate: string | undefined;

  if (targetDate) {
    const daysRemaining = Math.ceil(
      (new Date(targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    const assetsNeeded = Math.max(0, targetCount - currentCount);
    const neededPerDay = assetsNeeded / Math.max(1, daysRemaining);

    // Assume we can do ~5 assets/day
    const estimatedDaysNeeded = neededPerDay > 5 ? assetsNeeded / 5 : daysRemaining;
    onTrack = estimatedDaysNeeded <= daysRemaining;

    if (!onTrack) {
      const today = new Date();
      estimatedCompletionDate = new Date(today.getTime() + estimatedDaysNeeded * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
    } else {
      estimatedCompletionDate = targetDate;
    }
  }

  return {
    requirementId: requirement.id,
    currentCount,
    targetCount,
    percentComplete,
    assetsWithField,
    assetsWithoutField,
    onTrack,
    estimatedCompletionDate,
  };
}

/**
 * Calculate progress for entire plan
 */
export function calculatePlanProgress(
  plan: EnrichmentPlan,
  liveAssets: AtlanAssetSummary[]
): Partial<EnrichmentPlan> {
  const comparison = comparePlanToAssets(plan, liveAssets);
  const updatedProgress: EnrichmentPlanProgress[] = [];

  plan.requirements.forEach((req) => {
    // Find all field results for this requirement across all assets
    const reqResults = comparison.assetSummaries.flatMap(a => 
      a.fieldResults.filter(f => f.requirementId === req.id)
    );
    
    const assetsWithField = reqResults
      .filter(r => r.status === 'complete' || r.status === 'partial')
      .map(r => r.assetGuid);
      
    const assetsWithoutField = reqResults
      .filter(r => r.status === 'missing')
      .map(r => r.assetGuid);

    const currentCount = assetsWithField.length;
    const targetCount = req.targetCount || comparison.totalAssets;
    const percentComplete = targetCount > 0 ? Math.round((currentCount / targetCount) * 100) : 100;

    // Estimate completion
    let onTrack = true;
    let estimatedCompletionDate: string | undefined;

    if (plan.targetDate) {
      const daysRemaining = Math.ceil(
        (new Date(plan.targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );
      const assetsNeeded = Math.max(0, targetCount - currentCount);
      
      // Assume we can do ~5 assets/day
      const estimatedDaysNeeded = assetsNeeded / 5;
      onTrack = estimatedDaysNeeded <= daysRemaining;

      if (!onTrack) {
        const today = new Date();
        estimatedCompletionDate = new Date(today.getTime() + estimatedDaysNeeded * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0];
      } else {
        estimatedCompletionDate = plan.targetDate;
      }
    }

    updatedProgress.push({
      requirementId: req.id,
      currentCount,
      targetCount,
      percentComplete,
      assetsWithField,
      assetsWithoutField,
      onTrack,
      estimatedCompletionDate,
      completedByUser: plan.progress.find((p) => p.requirementId === req.id)?.completedByUser || {},
      lastUpdated: new Date().toISOString(),
    });
  });

  return {
    progress: updatedProgress,
    lastProgressCheck: new Date().toISOString(),
  };
}

/**
 * Find "at-risk" requirements (off-track)
 */
export function findAtRiskRequirements(plan: EnrichmentPlan): EnrichmentPlanRequirement[] {
  return plan.requirements.filter((req) => {
    const progress = plan.progress.find((p) => p.requirementId === req.id);
    return progress && !progress.onTrack;
  });
}

/**
 * Calculate overall plan velocity
 */
export interface PlanVelocity {
  assetsCompletedThisWeek: number;
  averagePerDay: number;
  estimatedDaysToCompletion: number;
  isOnSchedule: boolean;
}

export function calculatePlanVelocity(plan: EnrichmentPlan, targetDate?: string): PlanVelocity {
  const now = new Date();

  // Count contributions in last 7 days (placeholder - would need timestamp on each)
  const assetsCompletedThisWeek = Object.values(plan.contributors).reduce((sum, count) => sum + count, 0);

  const averagePerDay = assetsCompletedThisWeek / 7;

  const requiredAssetsRemaining = plan.requirements.reduce((sum, req) => {
    const progress = plan.progress.find((p) => p.requirementId === req.id);
    if (!progress) return sum;
    return sum + Math.max(0, progress.targetCount - progress.currentCount);
  }, 0);

  const estimatedDaysToCompletion = averagePerDay > 0 ? requiredAssetsRemaining / averagePerDay : Infinity;

  let isOnSchedule = true;
  if (targetDate) {
    const daysUntilTarget = Math.ceil(
      (new Date(targetDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    isOnSchedule = estimatedDaysToCompletion <= daysUntilTarget;
  }

  return {
    assetsCompletedThisWeek,
    averagePerDay: Math.round(averagePerDay * 10) / 10,
    estimatedDaysToCompletion: Math.round(estimatedDaysToCompletion),
    isOnSchedule,
  };
}

/**
 * Generate alert if plan is at risk
 */
export interface PlanAlert {
  severity: 'info' | 'warning' | 'error';
  message: string;
  recommendation: string;
}

export function generatePlanAlerts(plan: EnrichmentPlan): PlanAlert[] {
  const alerts: PlanAlert[] = [];
  const now = new Date();
  const daysRemaining = Math.ceil(
    (new Date(plan.targetDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Check timeline
  if (daysRemaining < 0) {
    alerts.push({
      severity: 'error',
      message: `Plan deadline passed ${Math.abs(daysRemaining)} days ago`,
      recommendation: 'Update target date or mark complete',
    });
  } else if (daysRemaining < 7) {
    alerts.push({
      severity: 'warning',
      message: `Only ${daysRemaining} days left to complete plan`,
      recommendation: 'Prioritize remaining requirements',
    });
  }

  // Check at-risk requirements
  const atRisk = findAtRiskRequirements(plan);
  if (atRisk.length > 0) {
    alerts.push({
      severity: 'warning',
      message: `${atRisk.length} requirement(s) at risk of not completing on time`,
      recommendation: `Focus on: ${atRisk.map((r) => r.fieldType).join(', ')}`,
    });
  }

  // Check contributor engagement
  if (Object.keys(plan.contributors).length === 0 && plan.status === 'in-progress') {
    alerts.push({
      severity: 'warning',
      message: 'No contributors have started work on this plan',
      recommendation: 'Assign owners and start with highest-impact requirements',
    });
  }

  // Check all required fields at 100%
  const requiredFields = plan.requirements.filter((r) => r.statusType === 'required');
  const requiredComplete = requiredFields.every((r) => {
    const progress = plan.progress.find((p) => p.requirementId === r.id);
    return progress && progress.percentComplete === 100;
  });

  if (requiredComplete && plan.status === 'in-progress') {
    alerts.push({
      severity: 'info',
      message: 'All required fields are complete!',
      recommendation: 'Review recommended fields or mark plan complete',
    });
  }

  return alerts;
}
