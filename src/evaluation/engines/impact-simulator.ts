// ============================================
// IMPACT SIMULATOR
// What-if analysis for metadata improvements
// ============================================

import type {
  MetadataFieldType,
  FieldCoverage,
  PatternTemplate,
  ImpactSimulation,
} from '../types/priority';
import {
  COMPLETENESS_WEIGHTS,
  EFFORT_ESTIMATES,
  EFFORT_MINUTES,
} from '../types/priority';
import { computeAllPriorities } from './priority-engine';

/**
 * Simulate impact of fixing a specific field to target coverage
 */
export function simulateImpact(
  audit: FieldCoverage[],
  field: MetadataFieldType,
  targetCoverage: number,
  pattern: PatternTemplate | null
): ImpactSimulation {
  const currentFieldData = audit.find(a => a.field === field);
  if (!currentFieldData) {
    throw new Error(`Field ${field} not found in audit`);
  }

  const currentCoverage = currentFieldData.coveragePercent;
  const assetCount = currentFieldData.totalAssets;
  const assetsToFix = Math.ceil((targetCoverage - currentCoverage) * assetCount);

  // Calculate effort
  const effortPerAsset = EFFORT_MINUTES[EFFORT_ESTIMATES[field]];
  const totalMinutes = assetsToFix * effortPerAsset;
  const effortHours = totalMinutes / 60;

  // Calculate completeness impact
  const weight = COMPLETENESS_WEIGHTS[field];
  const completenessImpact = (targetCoverage - currentCoverage) * weight;

  // Calculate priority score impact by simulating new audit
  const simulatedAudit = audit.map(a =>
    a.field === field
      ? { ...a, coveragePercent: targetCoverage }
      : a
  );

  const currentPriorities = computeAllPriorities(audit, pattern);
  const simulatedPriorities = computeAllPriorities(simulatedAudit, pattern);

  const currentScore = currentPriorities.find(p => p.field === field)?.score || 0;
  const simulatedScore = simulatedPriorities.find(p => p.field === field)?.score || 0;
  const scoreImpact = currentScore - simulatedScore; // Lower priority score = better

  return {
    field,
    currentCoverage,
    simulatedCoverage: targetCoverage,
    scoreImpact,
    completenessImpact,
    effortHours,
    roi: effortHours > 0 ? scoreImpact / effortHours : 0,
  };
}

/**
 * Simulate fixing all required fields to 100%
 */
export function simulatePatternCompletion(
  audit: FieldCoverage[],
  pattern: PatternTemplate
): ImpactSimulation[] {
  const requiredFields = pattern.fields
    .filter(f => f.requirement === 'required')
    .map(f => f.field);

  return requiredFields.map(field =>
    simulateImpact(audit, field, 1.0, pattern)
  );
}

/**
 * Find the highest ROI actions
 */
export function getQuickWins(
  audit: FieldCoverage[],
  pattern: PatternTemplate | null,
  limit: number = 5
): ImpactSimulation[] {
  const simulations = audit.map(a =>
    simulateImpact(audit, a.field, Math.min(a.coveragePercent + 0.25, 1.0), pattern)
  );

  return simulations
    .filter(s => s.effortHours > 0)
    .sort((a, b) => b.roi - a.roi)
    .slice(0, limit);
}

/**
 * Calculate total effort to reach a target completeness score
 */
export function calculateTotalEffort(
  audit: FieldCoverage[],
  targetCompleteness: number,
  pattern: PatternTemplate | null
): { totalHours: number; breakdown: ImpactSimulation[] } {
  // Start with required fields if pattern is selected
  let fieldsToImprove: MetadataFieldType[] = [];

  if (pattern) {
    // Prioritize required fields first
    fieldsToImprove = pattern.fields
      .filter(f => f.requirement === 'required')
      .map(f => f.field);
  } else {
    // Otherwise, prioritize by weight
    fieldsToImprove = Object.entries(COMPLETENESS_WEIGHTS)
      .sort(([, a], [, b]) => b - a)
      .map(([field]) => field as MetadataFieldType);
  }

  const breakdown: ImpactSimulation[] = [];
  let totalHours = 0;
  let currentCompleteness = calculateCurrentCompleteness(audit);

  for (const field of fieldsToImprove) {
    if (currentCompleteness >= targetCompleteness) break;

    const fieldCoverage = audit.find(a => a.field === field);
    if (!fieldCoverage || fieldCoverage.coveragePercent >= 0.9) continue;

    const simulation = simulateImpact(audit, field, 0.9, pattern);
    breakdown.push(simulation);
    totalHours += simulation.effortHours;
    currentCompleteness += simulation.completenessImpact;
  }

  return { totalHours, breakdown };
}

/**
 * Calculate current overall completeness score
 */
export function calculateCurrentCompleteness(audit: FieldCoverage[]): number {
  let totalWeightedScore = 0;
  let totalWeight = 0;

  for (const coverage of audit) {
    const weight = COMPLETENESS_WEIGHTS[coverage.field] || 0;
    totalWeightedScore += coverage.coveragePercent * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? (totalWeightedScore / totalWeight) * 100 : 0;
}

/**
 * Simulate multiple improvements and show combined impact
 */
export function simulateCombinedImpact(
  audit: FieldCoverage[],
  improvements: { field: MetadataFieldType; targetCoverage: number }[],
  pattern: PatternTemplate | null
): {
  simulations: ImpactSimulation[];
  totalScoreImpact: number;
  totalCompletenessImpact: number;
  totalEffortHours: number;
  combinedROI: number;
} {
  const simulations: ImpactSimulation[] = [];
  let runningAudit = [...audit];

  for (const improvement of improvements) {
    const simulation = simulateImpact(runningAudit, improvement.field, improvement.targetCoverage, pattern);
    simulations.push(simulation);

    // Update running audit for next simulation
    runningAudit = runningAudit.map(a =>
      a.field === improvement.field
        ? { ...a, coveragePercent: improvement.targetCoverage }
        : a
    );
  }

  const totalScoreImpact = simulations.reduce((sum, s) => sum + s.scoreImpact, 0);
  const totalCompletenessImpact = simulations.reduce((sum, s) => sum + s.completenessImpact, 0);
  const totalEffortHours = simulations.reduce((sum, s) => sum + s.effortHours, 0);
  const combinedROI = totalEffortHours > 0 ? totalScoreImpact / totalEffortHours : 0;

  return {
    simulations,
    totalScoreImpact,
    totalCompletenessImpact,
    totalEffortHours,
    combinedROI,
  };
}
