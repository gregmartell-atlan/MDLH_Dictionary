/**
 * Score Service
 * Business logic for score retrieval and aggregation
 */

import * as scoreRepo from '../db/scoreRepository.js';
import * as runRepo from '../db/runRepository.js';
import type { Score, DomainScore, Quadrant } from '../types/run.js';

/**
 * Get all scores for a run
 */
export function getScores(runId: string): Score[] {
  return scoreRepo.getScores(runId);
}

/**
 * Get domain-level aggregated scores
 */
export function getDomainScores(runId: string): DomainScore[] {
  return scoreRepo.getDomainScores(runId);
}

/**
 * Get scores filtered by quadrant
 */
export function getScoresByQuadrant(runId: string, quadrant: Quadrant): Score[] {
  return scoreRepo.getScoresByQuadrant(runId, quadrant);
}

/**
 * Get assets for a specific domain (connector)
 */
export function getDomainAssets(
  runId: string,
  domain: string
): { assets: Score[]; stats: DomainStats } {
  const allScores = scoreRepo.getScores(runId);
  const catalog = runRepo.getCatalog(runId);
  
  // Create lookup for connector by guid
  const connectorMap = new Map<string, string>();
  for (const asset of catalog) {
    connectorMap.set(asset.guid, asset.connector);
  }
  
  // Filter scores by domain
  const domainAssets = allScores.filter(score => {
    const connector = connectorMap.get(score.subjectId);
    return connector === domain || connector === 'Unknown' && domain === 'Unknown';
  });

  // Compute domain stats
  const stats = computeDomainStats(domainAssets);

  return { assets: domainAssets, stats };
}

/**
 * Domain statistics
 */
export interface DomainStats {
  totalAssets: number;
  avgImpact: number;
  avgQuality: number | null;
  quadrantCounts: Record<Quadrant, number>;
  topIssues: string[];
}

/**
 * Compute statistics for a set of scores
 */
function computeDomainStats(scores: Score[]): DomainStats {
  if (scores.length === 0) {
    return {
      totalAssets: 0,
      avgImpact: 0,
      avgQuality: null,
      quadrantCounts: { HH: 0, HL: 0, LH: 0, LL: 0, HU: 0, LU: 0 },
      topIssues: [],
    };
  }

  // Average impact
  const avgImpact = scores.reduce((sum, s) => sum + s.impactScore, 0) / scores.length;

  // Average quality (only for known)
  const knownQualityScores = scores.filter(s => !s.qualityUnknown && s.qualityScore !== null);
  const avgQuality = knownQualityScores.length > 0
    ? knownQualityScores.reduce((sum, s) => sum + (s.qualityScore || 0), 0) / knownQualityScores.length
    : null;

  // Quadrant counts
  const quadrantCounts: Record<Quadrant, number> = { HH: 0, HL: 0, LH: 0, LL: 0, HU: 0, LU: 0 };
  for (const score of scores) {
    quadrantCounts[score.quadrant]++;
  }

  // Top issues from explanations
  const issueCount = new Map<string, number>();
  for (const score of scores) {
    for (const exp of score.explanations) {
      if (exp.title.startsWith('Missing')) {
        const count = issueCount.get(exp.title) || 0;
        issueCount.set(exp.title, count + 1);
      }
    }
  }
  
  const topIssues = [...issueCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([issue, count]) => `${issue} (${count})`);

  return {
    totalAssets: scores.length,
    avgImpact,
    avgQuality,
    quadrantCounts,
    topIssues,
  };
}

/**
 * Get score summary statistics
 */
export function getScoreSummary(runId: string): {
  total: number;
  byQuadrant: Record<Quadrant, number>;
  avgImpact: number;
  avgQuality: number | null;
  unknownCount: number;
} {
  const scores = scoreRepo.getScores(runId);
  
  if (scores.length === 0) {
    return {
      total: 0,
      byQuadrant: { HH: 0, HL: 0, LH: 0, LL: 0, HU: 0, LU: 0 },
      avgImpact: 0,
      avgQuality: null,
      unknownCount: 0,
    };
  }

  const byQuadrant: Record<Quadrant, number> = { HH: 0, HL: 0, LH: 0, LL: 0, HU: 0, LU: 0 };
  let impactSum = 0;
  let qualitySum = 0;
  let qualityCount = 0;
  let unknownCount = 0;

  for (const score of scores) {
    byQuadrant[score.quadrant]++;
    impactSum += score.impactScore;
    
    if (score.qualityUnknown) {
      unknownCount++;
    } else if (score.qualityScore !== null) {
      qualitySum += score.qualityScore;
      qualityCount++;
    }
  }

  return {
    total: scores.length,
    byQuadrant,
    avgImpact: impactSum / scores.length,
    avgQuality: qualityCount > 0 ? qualitySum / qualityCount : null,
    unknownCount,
  };
}
