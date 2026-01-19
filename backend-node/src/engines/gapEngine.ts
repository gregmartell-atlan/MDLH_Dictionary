/**
 * Gap Engine
 * Analyzes metadata gaps and generates prioritized remediation items
 */

import type { Gap, Priority, PlanPhase } from '../types/run.js';
import type { Asset } from '../types/mdlh.js';

/**
 * Target coverage thresholds by field
 */
const COVERAGE_TARGETS = {
  OWNERSHIP: 0.95,      // 95% should have owners
  DESCRIPTION: 0.90,    // 90% should have descriptions
  TERMS: 0.70,          // 70% should have glossary terms
  TAGS: 0.80,           // 80% should have classification tags
  LINEAGE: 0.75,        // 75% should have lineage
  CERTIFICATE: 0.60,    // 60% should be certified
} as const;

/**
 * Effort hours per asset for each field type
 */
const EFFORT_PER_ASSET = {
  OWNERSHIP: 0.1,      // Quick assignment
  DESCRIPTION: 0.25,   // Requires thought
  TERMS: 0.15,         // Selection from glossary
  TAGS: 0.1,           // Classification selection
  LINEAGE: 0.5,        // May require investigation
  CERTIFICATE: 0.2,    // Review and certify
} as const;

/**
 * Compute gaps from asset catalog
 */
export function computeGaps(runId: string, assets: Asset[]): Gap[] {
  if (assets.length === 0) {
    return [];
  }

  const gaps: Gap[] = [];
  const total = assets.length;

  // OWNERSHIP gap (ownerGroups not available in ATLAN_GOLD.PUBLIC.ASSETS)
  const withOwnership = assets.filter(a => 
    a.attributes.ownerUsers.length > 0
  ).length;
  gaps.push(createGap(runId, 'OWNERSHIP', withOwnership, total));

  // DESCRIPTION gap
  const withDescription = assets.filter(a => 
    !!a.attributes.description
  ).length;
  gaps.push(createGap(runId, 'DESCRIPTION', withDescription, total));

  // TERMS gap
  const withTerms = assets.filter(a => 
    a.attributes.termGuids.length > 0
  ).length;
  gaps.push(createGap(runId, 'TERMS', withTerms, total));

  // TAGS gap
  const withTags = assets.filter(a => 
    a.attributes.tags.length > 0
  ).length;
  gaps.push(createGap(runId, 'TAGS', withTags, total));

  // LINEAGE gap
  const withLineage = assets.filter(a => 
    a.attributes.hasLineage
  ).length;
  gaps.push(createGap(runId, 'LINEAGE', withLineage, total));

  // CERTIFICATE gap
  const withCertificate = assets.filter(a => 
    !!a.attributes.certificateStatus && a.attributes.certificateStatus !== 'NONE'
  ).length;
  gaps.push(createGap(runId, 'CERTIFICATE', withCertificate, total));

  // Filter out gaps that are already at target
  return gaps.filter(g => g.gapPercent > 0);
}

/**
 * Create a gap entry
 */
function createGap(
  runId: string,
  field: keyof typeof COVERAGE_TARGETS,
  withField: number,
  total: number
): Gap {
  const currentCoverage = withField / total;
  const targetCoverage = COVERAGE_TARGETS[field];
  const gapPercent = Math.max(0, targetCoverage - currentCoverage);
  const assetsToFix = Math.ceil(gapPercent * total);
  const effortHours = assetsToFix * EFFORT_PER_ASSET[field];
  const priority = computePriority(gapPercent, field);

  return {
    runId,
    field,
    currentCoverage,
    targetCoverage,
    gapPercent,
    priority,
    effortHours,
  };
}

/**
 * Compute priority based on gap size and field importance
 */
function computePriority(gapPercent: number, field: string): Priority {
  // Ownership and description are always higher priority
  const isHighPriorityField = field === 'OWNERSHIP' || field === 'DESCRIPTION';
  
  if (gapPercent >= 0.5) {
    return isHighPriorityField ? 'P0' : 'P1';
  }
  if (gapPercent >= 0.25) {
    return isHighPriorityField ? 'P1' : 'P2';
  }
  if (gapPercent >= 0.1) {
    return 'P2';
  }
  return 'P3';
}

/**
 * Generate a remediation plan from gaps
 */
export function generatePlan(gaps: Gap[]): { phases: PlanPhase[]; totalWeeks: number } {
  if (gaps.length === 0) {
    return { phases: [], totalWeeks: 0 };
  }

  // Sort gaps by priority
  const sortedGaps = [...gaps].sort((a, b) => {
    const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  const phases: PlanPhase[] = [];
  let totalWeeks = 0;

  // Phase 1: Foundation (P0 gaps)
  const p0Gaps = sortedGaps.filter(g => g.priority === 'P0');
  if (p0Gaps.length > 0) {
    const phase1Hours = p0Gaps.reduce((sum, g) => sum + g.effortHours, 0);
    const phase1Weeks = Math.ceil(phase1Hours / 40); // 40 hrs/week
    phases.push({
      name: 'Foundation',
      description: 'Address critical metadata gaps to establish baseline',
      fields: p0Gaps.map(g => g.field),
      estimatedWeeks: phase1Weeks,
      milestone: 'Core ownership and documentation in place',
    });
    totalWeeks += phase1Weeks;
  }

  // Phase 2: Enhancement (P1 gaps)
  const p1Gaps = sortedGaps.filter(g => g.priority === 'P1');
  if (p1Gaps.length > 0) {
    const phase2Hours = p1Gaps.reduce((sum, g) => sum + g.effortHours, 0);
    const phase2Weeks = Math.ceil(phase2Hours / 40);
    phases.push({
      name: 'Enhancement',
      description: 'Expand metadata coverage to high-value areas',
      fields: p1Gaps.map(g => g.field),
      estimatedWeeks: phase2Weeks,
      milestone: 'High-priority enrichment complete',
    });
    totalWeeks += phase2Weeks;
  }

  // Phase 3: Optimization (P2/P3 gaps)
  const p23Gaps = sortedGaps.filter(g => g.priority === 'P2' || g.priority === 'P3');
  if (p23Gaps.length > 0) {
    const phase3Hours = p23Gaps.reduce((sum, g) => sum + g.effortHours, 0);
    const phase3Weeks = Math.ceil(phase3Hours / 40);
    phases.push({
      name: 'Optimization',
      description: 'Complete remaining metadata enrichment',
      fields: p23Gaps.map(g => g.field),
      estimatedWeeks: phase3Weeks,
      milestone: 'Target coverage achieved across all fields',
    });
    totalWeeks += phase3Weeks;
  }

  return { phases, totalWeeks };
}

/**
 * Get gaps breakdown by asset type
 */
export function computeGapsByAssetType(
  runId: string,
  assets: Asset[]
): Map<string, Gap[]> {
  const byType = new Map<string, Asset[]>();
  
  for (const asset of assets) {
    const type = asset.typeName || 'Unknown';
    const existing = byType.get(type) || [];
    existing.push(asset);
    byType.set(type, existing);
  }

  const result = new Map<string, Gap[]>();
  
  for (const [assetType, typeAssets] of byType) {
    const gaps = computeGaps(runId, typeAssets).map(g => ({
      ...g,
      assetType,
    }));
    result.set(assetType, gaps);
  }

  return result;
}
