/**
 * Methodology Factory
 * Single source of truth for building methodology configurations
 * Ported from frontend src/evaluation/lib/methodology-factory.ts
 */

import type { MethodologyType, ScoringConfig } from '../types/api.js';
import type { CanonicalSignals, MdlhAssetRow } from '../types/mdlh.js';
import { evaluateSignalsFromMDLH, countKnownSignals, countKnownTrueSignals } from './signalMapper.js';

// ============================================
// SIGNAL WEIGHTS BY METHODOLOGY
// ============================================

/**
 * Default signal weights (WEIGHTED_DIMENSIONS)
 * Equal weight across all observable signals
 */
const WEIGHTED_DIMENSIONS_WEIGHTS: Record<keyof CanonicalSignals, number> = {
  OWNERSHIP: 1,
  SEMANTICS: 1,
  LINEAGE: 1,
  SENSITIVITY: 1,
  TRUST: 1,
  USAGE: 0, // Impact signal, not quality
  ACCESS: 0, // Not in MDLH
  QUALITY: 0, // Not in MDLH
  FRESHNESS: 0, // Not in MDLH
  AI_READY: 0, // Not in MDLH
};

/**
 * QTRIPLET weights - grouped by quality dimension
 * qcomp (Completeness): Semantics, Trust
 * qcons (Consistency): Ownership, Lineage
 * qaccu (Accuracy): Sensitivity, Quality
 */
const QTRIPLET_WEIGHTS = {
  qcomp: { SEMANTICS: 2, TRUST: 1.5 }, // Completeness
  qcons: { OWNERSHIP: 2, LINEAGE: 1.5 }, // Consistency
  qaccu: { SENSITIVITY: 1.5 }, // Accuracy (limited in MDLH)
};

/**
 * CHECKLIST thresholds - each signal must meet threshold
 */
const CHECKLIST_THRESHOLDS = {
  OWNERSHIP: true, // Required
  SEMANTICS: true, // Required
  LINEAGE: false, // Optional
  SENSITIVITY: false, // Optional
  TRUST: false, // Optional
};

/**
 * MATURITY level requirements
 * Each level has stricter requirements
 */
const MATURITY_LEVELS = [
  { level: 1, required: [] }, // Basic - no requirements
  { level: 2, required: ['OWNERSHIP'] }, // Managed - ownership
  { level: 3, required: ['OWNERSHIP', 'SEMANTICS'] }, // Defined - ownership + docs
  { level: 4, required: ['OWNERSHIP', 'SEMANTICS', 'LINEAGE'] }, // Quantified
  { level: 5, required: ['OWNERSHIP', 'SEMANTICS', 'LINEAGE', 'SENSITIVITY', 'TRUST'] }, // Optimizing
];

// ============================================
// SCORING FUNCTIONS BY METHODOLOGY
// ============================================

export interface ScoredResult {
  qualityScore: number | null;
  qualityUnknown: boolean;
  dimensionScores: Record<string, number>;
  maturityLevel?: number;
  checklistResults?: Record<string, boolean>;
  qtripletScores?: { qcomp: number; qcons: number; qaccu: number };
}

/**
 * Compute quality score using WEIGHTED_DIMENSIONS methodology
 */
function scoreWeightedDimensions(
  signals: CanonicalSignals,
  config: ScoringConfig
): ScoredResult {
  const knownSignals = countKnownSignals(signals);
  
  if (knownSignals === 0) {
    return { qualityScore: null, qualityUnknown: true, dimensionScores: {} };
  }

  let totalWeight = 0;
  let earnedWeight = 0;
  const dimensionScores: Record<string, number> = {};

  for (const [signal, weight] of Object.entries(WEIGHTED_DIMENSIONS_WEIGHTS)) {
    if (weight === 0) continue;
    
    const value = signals[signal as keyof CanonicalSignals];
    if (value === 'UNKNOWN') {
      if (config.unknownPolicy === 'TREAT_UNKNOWN_AS_ZERO') {
        totalWeight += weight;
        dimensionScores[signal] = 0;
      }
      continue;
    }
    
    totalWeight += weight;
    const score = value === true ? 1 : 0;
    dimensionScores[signal] = score;
    earnedWeight += score * weight;
  }

  if (totalWeight === 0) {
    return { qualityScore: null, qualityUnknown: true, dimensionScores };
  }

  return {
    qualityScore: earnedWeight / totalWeight,
    qualityUnknown: false,
    dimensionScores,
  };
}

/**
 * Compute quality score using QTRIPLET methodology
 * Groups signals into Completeness, Consistency, Accuracy
 */
function scoreQTriplet(
  signals: CanonicalSignals,
  config: ScoringConfig
): ScoredResult {
  const knownSignals = countKnownSignals(signals);
  
  if (knownSignals === 0) {
    return { qualityScore: null, qualityUnknown: true, dimensionScores: {}, qtripletScores: { qcomp: 0, qcons: 0, qaccu: 0 } };
  }

  // Compute each Q dimension
  const computeDimension = (weights: Record<string, number>): number => {
    let total = 0;
    let earned = 0;
    
    for (const [signal, weight] of Object.entries(weights)) {
      const value = signals[signal as keyof CanonicalSignals];
      if (value === 'UNKNOWN') {
        if (config.unknownPolicy === 'TREAT_UNKNOWN_AS_ZERO') {
          total += weight;
        }
        continue;
      }
      total += weight;
      if (value === true) {
        earned += weight;
      }
    }
    
    return total > 0 ? earned / total : 0;
  };

  const qcomp = computeDimension(QTRIPLET_WEIGHTS.qcomp);
  const qcons = computeDimension(QTRIPLET_WEIGHTS.qcons);
  const qaccu = computeDimension(QTRIPLET_WEIGHTS.qaccu);

  // Overall quality is geometric mean of the three dimensions
  // Using min for stricter scoring - all dimensions matter
  const qualityScore = Math.min(qcomp, qcons, qaccu);

  return {
    qualityScore,
    qualityUnknown: false,
    dimensionScores: { qcomp, qcons, qaccu },
    qtripletScores: { qcomp, qcons, qaccu },
  };
}

/**
 * Compute quality score using CHECKLIST methodology
 * Pass/fail for each signal with some required
 */
function scoreChecklist(
  signals: CanonicalSignals,
  config: ScoringConfig
): ScoredResult {
  const checklistResults: Record<string, boolean> = {};
  let requiredPassed = true;
  let totalChecks = 0;
  let passedChecks = 0;

  for (const [signal, required] of Object.entries(CHECKLIST_THRESHOLDS)) {
    const value = signals[signal as keyof CanonicalSignals];
    
    if (value === 'UNKNOWN') {
      checklistResults[signal] = false;
      if (required) {
        requiredPassed = false;
      }
      continue;
    }

    const passed = value === true;
    checklistResults[signal] = passed;
    totalChecks++;
    
    if (passed) {
      passedChecks++;
    } else if (required) {
      requiredPassed = false;
    }
  }

  // Quality score: 0 if required checks fail, otherwise % of checks passed
  const qualityScore = requiredPassed && totalChecks > 0
    ? passedChecks / totalChecks
    : 0;

  return {
    qualityScore,
    qualityUnknown: countKnownSignals(signals) === 0,
    dimensionScores: checklistResults as unknown as Record<string, number>,
    checklistResults,
  };
}

/**
 * Compute quality score using MATURITY methodology
 * Levels 1-5 based on cumulative requirements
 */
function scoreMaturity(
  signals: CanonicalSignals,
  config: ScoringConfig
): ScoredResult {
  let currentLevel = 1;

  for (const level of MATURITY_LEVELS) {
    if (level.required.length === 0) {
      currentLevel = level.level;
      continue;
    }

    const allMet = level.required.every(signal => {
      const value = signals[signal as keyof CanonicalSignals];
      return value === true;
    });

    if (allMet) {
      currentLevel = level.level;
    } else {
      break;
    }
  }

  // Quality score: normalize maturity level to 0-1
  const qualityScore = (currentLevel - 1) / (MATURITY_LEVELS.length - 1);

  return {
    qualityScore,
    qualityUnknown: countKnownSignals(signals) === 0,
    dimensionScores: { maturityLevel: currentLevel },
    maturityLevel: currentLevel,
  };
}

// ============================================
// MAIN SCORING FUNCTION
// ============================================

/**
 * Score an asset using the configured methodology
 */
export function scoreWithMethodology(
  signals: CanonicalSignals,
  config: ScoringConfig
): ScoredResult {
  switch (config.methodology) {
    case 'WEIGHTED_DIMENSIONS':
    case 'WEIGHTED_MEASURES':
      return scoreWeightedDimensions(signals, config);
    
    case 'QTRIPLET':
      return scoreQTriplet(signals, config);
    
    case 'CHECKLIST':
      return scoreChecklist(signals, config);
    
    case 'MATURITY':
      return scoreMaturity(signals, config);
    
    default:
      // Fallback to weighted dimensions
      return scoreWeightedDimensions(signals, config);
  }
}

/**
 * Score an MDLH row directly
 */
export function scoreAssetWithMethodology(
  row: MdlhAssetRow,
  config: ScoringConfig
): ScoredResult {
  const signals = evaluateSignalsFromMDLH(row);
  return scoreWithMethodology(signals, config);
}

/**
 * Get human-readable methodology description
 */
export function getMethodologyDescription(type: MethodologyType): string {
  switch (type) {
    case 'WEIGHTED_DIMENSIONS':
      return 'Equal weight across all observable signals (default)';
    case 'WEIGHTED_MEASURES':
      return 'Custom weights per measure (same as dimensions)';
    case 'QTRIPLET':
      return 'Quality Triplet: Completeness, Consistency, Accuracy';
    case 'CHECKLIST':
      return 'Pass/fail checklist with required signals';
    case 'MATURITY':
      return 'Maturity levels 1-5 based on cumulative requirements';
    default:
      return 'Unknown methodology';
  }
}
