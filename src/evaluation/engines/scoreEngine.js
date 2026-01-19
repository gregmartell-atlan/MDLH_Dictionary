/**
 * Score Engine
 *
 * Computes Impact/Quality scores for assets and assigns them to quadrants.
 * 
 * Quadrants:
 * - HH: High Impact, High Quality (ideal)
 * - HL: High Impact, Low Quality (high priority for remediation)
 * - LH: Low Impact, High Quality (well-documented but not critical)
 * - LL: Low Impact, Low Quality (low priority)
 * - HU: High Impact, Unknown Quality
 * - LU: Low Impact, Unknown Quality
 * 
 * Ported from atlan-metadata-evaluation/assessment/packages/domain/src/engines/score-engine.ts
 */

import { getSignalById, SIGNAL_DEFINITIONS } from '../catalog/signalDefinitions';
import { getFieldsForSignal } from '../catalog/unifiedFields';

// =============================================================================
// TYPES
// =============================================================================

/**
 * @typedef {'HH' | 'HL' | 'LH' | 'LL' | 'HU' | 'LU'} Quadrant
 */

/**
 * @typedef {Object} Explanation
 * @property {string} title
 * @property {string} reasoning
 * @property {string[]} [evidenceRefs]
 */

/**
 * @typedef {Object} SubjectScore
 * @property {'ASSET' | 'SCHEMA' | 'DATABASE'} subjectType
 * @property {string} subjectId
 * @property {string} [subjectName]
 * @property {string} [assetType]
 * @property {string} [qualifiedName]
 * @property {number} impactScore - 0-1
 * @property {number | null} qualityScore - 0-1 or null if unknown
 * @property {boolean} qualityUnknown
 * @property {Quadrant} quadrant
 * @property {number} [readinessScore]
 * @property {Record<string, number>} [dimensionScores]
 * @property {Explanation[]} explanations
 */

/**
 * @typedef {Object} CanonicalSignals
 * @property {boolean | 'UNKNOWN'} OWNERSHIP
 * @property {boolean | 'UNKNOWN'} SEMANTICS
 * @property {boolean | 'UNKNOWN'} LINEAGE
 * @property {boolean | 'UNKNOWN'} SENSITIVITY
 * @property {boolean | 'UNKNOWN'} ACCESS
 * @property {boolean | 'UNKNOWN'} QUALITY
 * @property {boolean | 'UNKNOWN'} FRESHNESS
 * @property {boolean | 'UNKNOWN'} USAGE
 * @property {boolean | 'UNKNOWN'} AI_READY
 * @property {boolean | 'UNKNOWN'} TRUST
 */

// =============================================================================
// SIGNAL EVALUATION
// =============================================================================

/**
 * Check if a signal value indicates presence
 * @param {boolean | 'UNKNOWN'} value
 * @returns {boolean}
 */
export function isSignalPresent(value) {
  return value === true;
}

/**
 * Check if a signal value is unknown
 * @param {boolean | 'UNKNOWN'} value
 * @returns {boolean}
 */
export function isSignalUnknown(value) {
  return value === 'UNKNOWN';
}

/**
 * Evaluate signals from asset attributes
 * @param {Record<string, any>} attributes - Asset attributes
 * @returns {CanonicalSignals}
 */
export function evaluateSignals(attributes) {
  const signals = {
    OWNERSHIP: evaluateOwnership(attributes),
    SEMANTICS: evaluateSemantics(attributes),
    LINEAGE: evaluateLineage(attributes),
    SENSITIVITY: evaluateSensitivity(attributes),
    ACCESS: evaluateAccess(attributes),
    QUALITY: evaluateQuality(attributes),
    FRESHNESS: evaluateFreshness(attributes),
    USAGE: evaluateUsage(attributes),
    AI_READY: 'UNKNOWN', // Requires custom metadata
    TRUST: evaluateTrust(attributes),
  };
  
  return signals;
}

/**
 * Evaluate ownership signal
 * @param {Record<string, any>} attrs
 * @returns {boolean | 'UNKNOWN'}
 */
function evaluateOwnership(attrs) {
  const ownerUsers = attrs.ownerUsers;
  const ownerGroups = attrs.ownerGroups;
  
  const hasOwnerUsers = Array.isArray(ownerUsers) && ownerUsers.length > 0;
  const hasOwnerGroups = Array.isArray(ownerGroups) && ownerGroups.length > 0;
  
  return hasOwnerUsers || hasOwnerGroups;
}

/**
 * Evaluate semantics signal
 * @param {Record<string, any>} attrs
 * @returns {boolean | 'UNKNOWN'}
 */
function evaluateSemantics(attrs) {
  const description = attrs.description || attrs.userDescription || '';
  const hasDescription = typeof description === 'string' && description.trim().length > 0;
  
  const meanings = attrs.meanings;
  const hasGlossaryTerms = Array.isArray(meanings) && meanings.length > 0;
  
  const readme = attrs.readme;
  const hasReadme = readme != null && readme !== '';
  
  return hasDescription || hasGlossaryTerms || hasReadme;
}

/**
 * Evaluate lineage signal
 * @param {Record<string, any>} attrs
 * @returns {boolean | 'UNKNOWN'}
 */
function evaluateLineage(attrs) {
  const hasLineage = attrs.__hasLineage;
  if (typeof hasLineage === 'boolean') {
    return hasLineage;
  }
  return 'UNKNOWN';
}

/**
 * Evaluate sensitivity signal
 * @param {Record<string, any>} attrs
 * @returns {boolean | 'UNKNOWN'}
 */
function evaluateSensitivity(attrs) {
  const classifications = attrs.classificationNames || attrs.classifications;
  const hasClassifications = Array.isArray(classifications) && classifications.length > 0;
  return hasClassifications;
}

/**
 * Evaluate access signal
 * @param {Record<string, any>} attrs
 * @returns {boolean | 'UNKNOWN'}
 */
function evaluateAccess(attrs) {
  const policyCount = attrs.assetPoliciesCount;
  if (typeof policyCount === 'number') {
    return policyCount > 0;
  }
  return 'UNKNOWN';
}

/**
 * Evaluate quality signal
 * @param {Record<string, any>} attrs
 * @returns {boolean | 'UNKNOWN'}
 */
function evaluateQuality(attrs) {
  const sodaStatus = attrs.assetSodaDQStatus;
  const anomaloStatus = attrs.assetAnomaloDQStatus;
  const mcMonitored = attrs.assetMcIsMonitored;
  
  const hasSoda = sodaStatus != null;
  const hasAnomalo = anomaloStatus != null;
  const hasMonteCarlo = mcMonitored === true;
  
  if (hasSoda || hasAnomalo || hasMonteCarlo) {
    return true;
  }
  return false;
}

/**
 * Evaluate freshness signal
 * @param {Record<string, any>} attrs
 * @returns {boolean | 'UNKNOWN'}
 */
function evaluateFreshness(attrs) {
  const lastScan = attrs.assetSodaLastScanAt;
  const lastRead = attrs.sourceLastReadAt;
  const updateTime = attrs.updateTime || attrs.__modificationTimestamp;
  
  // If we have any freshness indicator, consider it present
  if (lastScan || lastRead || updateTime) {
    return true;
  }
  return 'UNKNOWN';
}

/**
 * Evaluate usage signal
 * @param {Record<string, any>} attrs
 * @returns {boolean | 'UNKNOWN'}
 */
function evaluateUsage(attrs) {
  const popularityScore = attrs.popularityScore;
  const queryCount = attrs.queryCount;
  const queryUserCount = attrs.queryUserCount;
  
  const hasPopularity = typeof popularityScore === 'number' && popularityScore > 0;
  const hasQueryCount = typeof queryCount === 'number' && queryCount > 0;
  const hasUserCount = typeof queryUserCount === 'number' && queryUserCount > 0;
  
  return hasPopularity || hasQueryCount || hasUserCount;
}

/**
 * Evaluate trust signal
 * @param {Record<string, any>} attrs
 * @returns {boolean | 'UNKNOWN'}
 */
function evaluateTrust(attrs) {
  const certificateStatus = attrs.certificateStatus;
  return certificateStatus != null && certificateStatus !== '';
}

// =============================================================================
// SCORE ENGINE
// =============================================================================

/**
 * Thresholds for scoring
 */
const IMPACT_THRESHOLD = 0.5;
const QUALITY_THRESHOLD = 0.7;
const DEFAULT_IMPACT = 0.25;

/**
 * Score Engine
 * Computes Impact/Quality scores and quadrant assignments
 */
export class ScoreEngine {
  /**
   * @param {Object} [options]
   * @property {number} [impactThreshold=0.5]
   * @property {number} [qualityThreshold=0.7]
   */
  constructor(options = {}) {
    this.impactThreshold = options.impactThreshold || IMPACT_THRESHOLD;
    this.qualityThreshold = options.qualityThreshold || QUALITY_THRESHOLD;
  }

  /**
   * Compute scores for a batch of assets
   * @param {Array<{guid: string, typeName: string, qualifiedName: string, displayName: string, attributes: Record<string, any>}>} assets
   * @param {Object} [requirements] - Required signals for quality calculation
   * @returns {SubjectScore[]}
   */
  computeScores(assets, requirements = null) {
    return assets.map(asset => this.computeAssetScore(asset, requirements));
  }

  /**
   * Compute score for a single asset
   * @param {Object} asset
   * @param {Object} [requirements]
   * @returns {SubjectScore}
   */
  computeAssetScore(asset, requirements = null) {
    const signals = evaluateSignals(asset.attributes || {});
    
    // Compute impact score from usage signals
    const impactScore = this.computeImpactScore(asset.attributes, signals);
    
    // Compute quality score from signal coverage
    const { qualityScore, qualityUnknown } = this.computeQualityScore(signals, requirements);
    
    // Compute quadrant
    const quadrant = this.computeQuadrant(impactScore, qualityScore, qualityUnknown);
    
    // Generate explanations
    const explanations = this.generateExplanations(asset, signals, impactScore, qualityScore, qualityUnknown);
    
    return {
      subjectType: 'ASSET',
      subjectId: asset.guid,
      subjectName: asset.displayName || asset.attributes?.name,
      assetType: asset.typeName,
      qualifiedName: asset.qualifiedName,
      impactScore,
      qualityScore,
      qualityUnknown,
      quadrant,
      dimensionScores: this.computeDimensionScores(signals),
      explanations,
    };
  }

  /**
   * Compute impact score from usage signals
   * @param {Record<string, any>} attrs
   * @param {CanonicalSignals} signals
   * @returns {number}
   */
  computeImpactScore(attrs, signals) {
    // If we have usage telemetry, use it for impact
    if (isSignalPresent(signals.USAGE)) {
      const popularity = attrs?.popularityScore || 0;
      // Normalize popularity to 0-1 range (assuming max ~1000)
      const normalizedPopularity = Math.min(1, Math.log(1 + popularity) / Math.log(1001));
      return Math.max(0.5, normalizedPopularity); // At least 0.5 if usage exists
    }
    
    // Default to low impact when usage unavailable
    return DEFAULT_IMPACT;
  }

  /**
   * Compute quality score from signal coverage
   * @param {CanonicalSignals} signals
   * @param {Object} [requirements]
   * @returns {{qualityScore: number | null, qualityUnknown: boolean}}
   */
  computeQualityScore(signals, requirements = null) {
    // Default required signals if not specified
    const requiredSignals = requirements?.requiredSignals || [
      'OWNERSHIP', 'SEMANTICS', 'LINEAGE', 'SENSITIVITY', 'TRUST'
    ];
    
    let presentCount = 0;
    let unknownCount = 0;
    
    for (const signalId of requiredSignals) {
      const signalValue = signals[signalId];
      
      if (isSignalPresent(signalValue)) {
        presentCount++;
      } else if (isSignalUnknown(signalValue)) {
        unknownCount++;
      }
    }
    
    // If too many unknowns (>= 50%), quality is unknown
    const unknownRatio = unknownCount / requiredSignals.length;
    if (unknownRatio >= 0.5) {
      return { qualityScore: null, qualityUnknown: true };
    }
    
    // Quality score = present signals / total required signals
    const qualityScore = presentCount / requiredSignals.length;
    return { qualityScore, qualityUnknown: false };
  }

  /**
   * Compute quadrant from scores
   * @param {number} impactScore
   * @param {number | null} qualityScore
   * @param {boolean} qualityUnknown
   * @returns {Quadrant}
   */
  computeQuadrant(impactScore, qualityScore, qualityUnknown) {
    const highImpact = impactScore >= this.impactThreshold;
    
    if (qualityUnknown || qualityScore === null) {
      return highImpact ? 'HU' : 'LU';
    }
    
    const highQuality = qualityScore >= this.qualityThreshold;
    
    if (highImpact && highQuality) return 'HH';
    if (highImpact && !highQuality) return 'HL';
    if (!highImpact && highQuality) return 'LH';
    return 'LL';
  }

  /**
   * Compute dimension scores (for detailed breakdown)
   * @param {CanonicalSignals} signals
   * @returns {Record<string, number>}
   */
  computeDimensionScores(signals) {
    const scores = {};
    
    for (const signal of SIGNAL_DEFINITIONS) {
      const value = signals[signal.id];
      if (isSignalPresent(value)) {
        scores[signal.id] = 1.0;
      } else if (isSignalUnknown(value)) {
        scores[signal.id] = 0.5; // Unknown = 0.5
      } else {
        scores[signal.id] = 0.0;
      }
    }
    
    return scores;
  }

  /**
   * Generate explanations for scores
   * @param {Object} asset
   * @param {CanonicalSignals} signals
   * @param {number} impactScore
   * @param {number | null} qualityScore
   * @param {boolean} qualityUnknown
   * @returns {Explanation[]}
   */
  generateExplanations(asset, signals, impactScore, qualityScore, qualityUnknown) {
    const explanations = [];
    const assetDesc = asset.displayName ? `"${asset.displayName}"` : `${asset.typeName} ${asset.guid}`;
    
    // Impact explanation
    if (isSignalPresent(signals.USAGE)) {
      explanations.push({
        title: 'High Impact',
        reasoning: `${assetDesc} has usage telemetry indicating active use (impact score: ${impactScore.toFixed(2)})`,
        evidenceRefs: [`asset://${asset.guid}`],
      });
    } else {
      explanations.push({
        title: 'Low Impact (Default)',
        reasoning: `${assetDesc} has no usage telemetry; impact score defaulted to low (${impactScore.toFixed(2)})`,
        evidenceRefs: [`asset://${asset.guid}`],
      });
    }
    
    // Quality explanation
    if (qualityUnknown) {
      explanations.push({
        title: 'Quality Unknown',
        reasoning: `${assetDesc} has too many unknown signals (>= 50% of required signals unavailable)`,
        evidenceRefs: [`asset://${asset.guid}`],
      });
    } else if (qualityScore !== null) {
      const percent = (qualityScore * 100).toFixed(0);
      explanations.push({
        title: `Quality Score: ${percent}%`,
        reasoning: `${assetDesc} has ${percent}% of required metadata signals present`,
        evidenceRefs: [`asset://${asset.guid}`],
      });
    }
    
    // Missing signals
    const missingSignals = [];
    for (const [signalId, value] of Object.entries(signals)) {
      if (!isSignalPresent(value) && !isSignalUnknown(value)) {
        const signal = getSignalById(signalId);
        if (signal) {
          missingSignals.push(signal.displayName);
        }
      }
    }
    
    if (missingSignals.length > 0) {
      explanations.push({
        title: 'Missing Signals',
        reasoning: `${assetDesc} is missing: ${missingSignals.join(', ')}`,
        evidenceRefs: [`asset://${asset.guid}`],
      });
    }
    
    return explanations;
  }

  /**
   * Get quadrant distribution from scores
   * @param {SubjectScore[]} scores
   * @returns {Record<Quadrant, number>}
   */
  getQuadrantDistribution(scores) {
    const distribution = { HH: 0, HL: 0, LH: 0, LL: 0, HU: 0, LU: 0 };
    
    for (const score of scores) {
      distribution[score.quadrant]++;
    }
    
    return distribution;
  }

  /**
   * Get assets by quadrant
   * @param {SubjectScore[]} scores
   * @param {Quadrant} quadrant
   * @returns {SubjectScore[]}
   */
  getAssetsByQuadrant(scores, quadrant) {
    return scores.filter(score => score.quadrant === quadrant);
  }

  /**
   * Get high-priority assets (HL and HU quadrants)
   * @param {SubjectScore[]} scores
   * @returns {SubjectScore[]}
   */
  getHighPriorityAssets(scores) {
    return scores.filter(score => score.quadrant === 'HL' || score.quadrant === 'HU');
  }
}

// =============================================================================
// FACTORY
// =============================================================================

/**
 * Create a score engine with default options
 * @param {Object} [options]
 * @returns {ScoreEngine}
 */
export function createScoreEngine(options = {}) {
  return new ScoreEngine(options);
}
