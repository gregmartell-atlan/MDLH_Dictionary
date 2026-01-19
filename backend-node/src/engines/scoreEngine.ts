/**
 * Score Engine
 * Computes impact and quality scores from signals using configurable methodologies
 */

import type { Asset, CanonicalSignals } from '../types/mdlh.js';
import type { Score, Quadrant, Explanation, ScoringConfig } from '../types/run.js';
import { evaluateSignalsFromMDLH, countKnownTrueSignals, countKnownSignals } from './signalMapper.js';
import { scoreWithMethodology, getMethodologyDescription } from './methodologyFactory.js';
import type { MdlhAssetRow } from '../types/mdlh.js';

/**
 * Default scoring config for backwards compatibility
 */
const DEFAULT_CONFIG: ScoringConfig = {
  methodology: 'WEIGHTED_DIMENSIONS',
  unknownPolicy: 'IGNORE_IN_ROLLUP',
  readyThreshold: 0.75,
  impactThreshold: 0.5,
  qualityThreshold: 0.7,
};

/**
 * Compute scores for a single asset using configured methodology
 */
export function scoreAsset(
  asset: Asset,
  mdlhRow: MdlhAssetRow,
  runId: string,
  config: ScoringConfig = DEFAULT_CONFIG
): Score {
  const signals = evaluateSignalsFromMDLH(mdlhRow);
  
  // Compute impact score (0-1)
  const impactScore = computeImpactScore(mdlhRow);
  
  // Compute quality score using methodology
  const methodologyResult = scoreWithMethodology(signals, config);
  const { qualityScore, qualityUnknown, dimensionScores, maturityLevel, qtripletScores } = methodologyResult;
  
  // Determine quadrant using configured thresholds
  const quadrant = computeQuadrant(
    impactScore, 
    qualityScore, 
    qualityUnknown,
    config.impactThreshold,
    config.qualityThreshold
  );
  
  // Generate explanations including methodology info
  const explanations = generateExplanations(
    signals, 
    impactScore, 
    qualityScore, 
    config,
    dimensionScores,
    maturityLevel,
    qtripletScores
  );

  return {
    runId,
    subjectType: 'ASSET',
    subjectId: asset.guid,
    subjectName: asset.name,
    assetType: asset.typeName,
    qualifiedName: asset.qualifiedName,
    impactScore,
    qualityScore,
    qualityUnknown,
    quadrant,
    explanations,
  };
}

/**
 * Score multiple assets using configured methodology
 */
export function scoreAssets(
  assets: Asset[],
  mdlhRows: MdlhAssetRow[],
  runId: string,
  config: ScoringConfig = DEFAULT_CONFIG
): Score[] {
  // Create lookup map for MDLH rows
  const rowMap = new Map<string, MdlhAssetRow>();
  for (const row of mdlhRows) {
    rowMap.set(row.GUID, row);
  }

  return assets.map(asset => {
    const row = rowMap.get(asset.guid);
    if (!row) {
      // Return minimal score if no row found
      return {
        runId,
        subjectType: 'ASSET' as const,
        subjectId: asset.guid,
        subjectName: asset.name,
        assetType: asset.typeName,
        qualifiedName: asset.qualifiedName,
        impactScore: 0,
        qualityScore: null,
        qualityUnknown: true,
        quadrant: 'LU' as Quadrant,
        explanations: [{
          title: 'Missing Data',
          reasoning: 'No MDLH row found for this asset',
        }],
      };
    }
    return scoreAsset(asset, row, runId, config);
  });
}

/**
 * Compute impact score from MDLH row
 * Only POPULARITY_SCORE is available in ATLAN_GOLD.PUBLIC.ASSETS
 */
function computeImpactScore(row: MdlhAssetRow): number {
  const popularityNorm = normalizePopularity(row.POPULARITY_SCORE);
  return popularityNorm;
}

/**
 * Determine quadrant from scores using configurable thresholds
 */
function computeQuadrant(
  impactScore: number,
  qualityScore: number | null,
  qualityUnknown: boolean,
  impactThreshold: number = 0.5,
  qualityThreshold: number = 0.7
): Quadrant {
  const highImpact = impactScore >= impactThreshold;
  
  if (qualityUnknown || qualityScore === null) {
    return highImpact ? 'HU' : 'LU';
  }
  
  const highQuality = qualityScore >= qualityThreshold;
  
  if (highImpact && highQuality) return 'HH';
  if (highImpact && !highQuality) return 'HL';
  if (!highImpact && highQuality) return 'LH';
  return 'LL';
}

/**
 * Generate explanation entries for a score with methodology context
 */
function generateExplanations(
  signals: CanonicalSignals,
  impactScore: number,
  qualityScore: number | null,
  config: ScoringConfig,
  dimensionScores: Record<string, number>,
  maturityLevel?: number,
  qtripletScores?: { qcomp: number; qcons: number; qaccu: number }
): Explanation[] {
  const explanations: Explanation[] = [];
  
  // Methodology explanation
  explanations.push({
    title: 'Scoring Methodology',
    reasoning: getMethodologyDescription(config.methodology),
  });
  
  // Impact explanation
  explanations.push({
    title: 'Impact Score',
    reasoning: impactScore >= config.impactThreshold
      ? `High usage (${Math.round(impactScore * 100)}%) indicates active use`
      : `Low usage (${Math.round(impactScore * 100)}%) suggests limited business impact`,
  });

  // Quality explanation based on methodology
  const trueCount = countKnownTrueSignals(signals);
  const knownCount = countKnownSignals(signals);
  
  if (qualityScore !== null) {
    let qualityReasoning = `Quality: ${Math.round(qualityScore * 100)}%`;
    
    if (config.methodology === 'QTRIPLET' && qtripletScores) {
      qualityReasoning += ` (Completeness: ${Math.round(qtripletScores.qcomp * 100)}%, ` +
        `Consistency: ${Math.round(qtripletScores.qcons * 100)}%, ` +
        `Accuracy: ${Math.round(qtripletScores.qaccu * 100)}%)`;
    } else if (config.methodology === 'MATURITY' && maturityLevel) {
      qualityReasoning = `Maturity Level ${maturityLevel}/5 (${Math.round(qualityScore * 100)}%)`;
    } else {
      qualityReasoning += ` - ${trueCount} of ${knownCount} signals present`;
    }
    
    explanations.push({
      title: 'Quality Score',
      reasoning: qualityReasoning,
    });
  }

  // Signal-specific gap explanations
  if (signals.OWNERSHIP === false) {
    explanations.push({
      title: 'Missing Ownership',
      reasoning: 'No owner assigned. Consider assigning an owner for accountability.',
    });
  }

  if (signals.SEMANTICS === false) {
    explanations.push({
      title: 'Missing Documentation',
      reasoning: 'No description or glossary terms. Add documentation for discoverability.',
    });
  }

  if (signals.LINEAGE === false) {
    explanations.push({
      title: 'Missing Lineage',
      reasoning: 'No lineage information. Lineage helps understand data flow.',
    });
  }

  if (signals.SENSITIVITY === false) {
    explanations.push({
      title: 'Missing Classification',
      reasoning: 'No classification tags. Tag sensitive data for compliance.',
    });
  }

  if (signals.TRUST === false) {
    explanations.push({
      title: 'Missing Certification',
      reasoning: 'No certificate status. Consider certifying trusted assets.',
    });
  }

  return explanations;
}

// ============================================
// NORMALIZATION HELPERS
// ============================================

function normalizePopularity(score: number | null): number {
  if (!score || score <= 0) return 0;
  // Popularity scores typically range 0-100, normalize to 0-1
  return Math.min(score / 100, 1);
}
