/**
 * Plan Service
 * Business logic for gaps and remediation plans
 */

import * as planRepo from '../db/planRepository.js';
import * as runRepo from '../db/runRepository.js';
import { computeGaps, generatePlan } from '../engines/gapEngine.js';
import type { Gap, Plan } from '../types/run.js';

/**
 * Get gaps for a run
 */
export function getGaps(runId: string): Gap[] {
  return planRepo.getGaps(runId);
}

/**
 * Recompute gaps from current catalog
 */
export function recomputeGaps(runId: string): Gap[] {
  const assets = runRepo.getCatalog(runId);
  const gaps = computeGaps(runId, assets);
  planRepo.storeGaps(runId, gaps);
  return gaps;
}

/**
 * Get current plan for a run
 */
export function getPlan(runId: string): Plan | null {
  return planRepo.getPlan(runId);
}

/**
 * Generate a new plan from current gaps
 */
export function createPlan(runId: string): Plan {
  const gaps = planRepo.getGaps(runId);
  
  if (gaps.length === 0) {
    // Generate gaps first
    const assets = runRepo.getCatalog(runId);
    const newGaps = computeGaps(runId, assets);
    planRepo.storeGaps(runId, newGaps);
    
    const planData = generatePlan(newGaps);
    return planRepo.storePlan(runId, planData.phases, planData.totalWeeks);
  }

  const planData = generatePlan(gaps);
  return planRepo.storePlan(runId, planData.phases, planData.totalWeeks);
}

/**
 * Get model data for the model view
 * Returns the current state of gaps and plan
 */
export function getModel(runId: string): {
  gaps: Gap[];
  plan: Plan | null;
  summary: ModelSummary;
} {
  const gaps = planRepo.getGaps(runId);
  const plan = planRepo.getPlan(runId);

  const summary: ModelSummary = {
    totalGaps: gaps.length,
    totalEffortHours: gaps.reduce((sum, g) => sum + g.effortHours, 0),
    byPriority: {
      P0: gaps.filter(g => g.priority === 'P0').length,
      P1: gaps.filter(g => g.priority === 'P1').length,
      P2: gaps.filter(g => g.priority === 'P2').length,
      P3: gaps.filter(g => g.priority === 'P3').length,
    },
    estimatedWeeks: plan?.totalWeeks || 0,
    phaseCount: plan?.phases.length || 0,
  };

  return { gaps, plan, summary };
}

export interface ModelSummary {
  totalGaps: number;
  totalEffortHours: number;
  byPriority: Record<string, number>;
  estimatedWeeks: number;
  phaseCount: number;
}
