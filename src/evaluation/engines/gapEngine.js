/**
 * Gap Engine
 *
 * Identifies metadata gaps for assets based on signal coverage.
 * A gap is created when a required signal is missing or has low coverage.
 * 
 * Ported from atlan-metadata-evaluation/assessment/packages/domain/src/engines/gap-engine.ts
 */

import { 
  SIGNAL_DEFINITIONS, 
  getSignalById, 
  getSignalPriority,
  getWorkstreamForSignal 
} from '../catalog/signalDefinitions';
import { getFieldsForSignal, UNIFIED_FIELD_CATALOG } from '../catalog/unifiedFields';
import { isSignalPresent, isSignalUnknown, evaluateSignals } from './scoreEngine';

// =============================================================================
// TYPES
// =============================================================================

/**
 * @typedef {Object} Gap
 * @property {string} id - Unique gap identifier
 * @property {string} signalId - Which signal is missing
 * @property {string} signalDisplayName - Human-readable signal name
 * @property {string} workstreamId - Which workstream this belongs to
 * @property {string} workstreamDisplayName - Human-readable workstream name
 * @property {number} priority - 1 (highest) to 3 (lowest)
 * @property {'HIGH' | 'MED' | 'LOW'} severity
 * @property {string[]} affectedAssetIds - GUIDs of assets with this gap
 * @property {number} affectedAssetCount
 * @property {number} coveragePercent - Current coverage (0-100)
 * @property {string[]} remediationFields - Fields that can fix this gap
 * @property {string} description - Description of the gap
 * @property {string} [guidanceUrl] - Link to documentation
 */

/**
 * @typedef {Object} AssetGap
 * @property {string} assetId
 * @property {string} assetName
 * @property {string} assetType
 * @property {string} qualifiedName
 * @property {Gap[]} gaps
 * @property {number} totalGapCount
 * @property {number} highPriorityGapCount
 */

/**
 * @typedef {Object} GapSummary
 * @property {number} totalAssets
 * @property {number} totalGaps
 * @property {number} assetsWithGaps
 * @property {Record<string, number>} gapsBySignal
 * @property {Record<string, number>} gapsByWorkstream
 * @property {Record<number, number>} gapsByPriority
 */

// =============================================================================
// GAP ENGINE
// =============================================================================

/**
 * Gap Engine
 * Identifies and prioritizes metadata gaps
 */
export class GapEngine {
  /**
   * @param {Object} [options]
   * @property {string[]} [requiredSignals] - Signals that must be present
   * @property {string[]} [optionalSignals] - Signals that are nice to have
   */
  constructor(options = {}) {
    this.requiredSignals = options.requiredSignals || [
      'OWNERSHIP', 'SEMANTICS', 'TRUST'
    ];
    this.optionalSignals = options.optionalSignals || [
      'LINEAGE', 'SENSITIVITY', 'ACCESS', 'QUALITY', 'FRESHNESS', 'USAGE'
    ];
  }

  /**
   * Analyze gaps for a batch of assets
   * @param {Array<{guid: string, typeName: string, qualifiedName: string, displayName: string, attributes: Record<string, any>}>} assets
   * @returns {{assetGaps: AssetGap[], aggregatedGaps: Gap[], summary: GapSummary}}
   */
  analyzeGaps(assets) {
    const assetGaps = [];
    const gapsBySignal = new Map();
    
    for (const asset of assets) {
      const gaps = this.findAssetGaps(asset);
      
      assetGaps.push({
        assetId: asset.guid,
        assetName: asset.displayName || asset.attributes?.name || asset.guid,
        assetType: asset.typeName,
        qualifiedName: asset.qualifiedName,
        gaps,
        totalGapCount: gaps.length,
        highPriorityGapCount: gaps.filter(g => g.priority === 1).length,
      });
      
      // Aggregate by signal
      for (const gap of gaps) {
        if (!gapsBySignal.has(gap.signalId)) {
          gapsBySignal.set(gap.signalId, {
            ...gap,
            affectedAssetIds: [],
          });
        }
        gapsBySignal.get(gap.signalId).affectedAssetIds.push(asset.guid);
      }
    }
    
    // Build aggregated gaps with counts
    const aggregatedGaps = Array.from(gapsBySignal.values()).map(gap => ({
      ...gap,
      affectedAssetCount: gap.affectedAssetIds.length,
      coveragePercent: Math.round((1 - gap.affectedAssetIds.length / assets.length) * 100),
    }));
    
    // Sort by priority then by affected count
    aggregatedGaps.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.affectedAssetCount - a.affectedAssetCount;
    });
    
    // Build summary
    const summary = this.buildSummary(assets, assetGaps, aggregatedGaps);
    
    return { assetGaps, aggregatedGaps, summary };
  }

  /**
   * Find gaps for a single asset
   * @param {Object} asset
   * @returns {Gap[]}
   */
  findAssetGaps(asset) {
    const signals = evaluateSignals(asset.attributes || {});
    const gaps = [];
    
    // Check required signals
    for (const signalId of this.requiredSignals) {
      const signalValue = signals[signalId];
      
      if (!isSignalPresent(signalValue)) {
        const gap = this.createGap(signalId, asset, signalValue);
        if (gap) gaps.push(gap);
      }
    }
    
    // Check optional signals (lower priority)
    for (const signalId of this.optionalSignals) {
      const signalValue = signals[signalId];
      
      if (!isSignalPresent(signalValue) && !isSignalUnknown(signalValue)) {
        const gap = this.createGap(signalId, asset, signalValue, true);
        if (gap) gaps.push(gap);
      }
    }
    
    return gaps;
  }

  /**
   * Create a gap object
   * @param {string} signalId
   * @param {Object} asset
   * @param {boolean | 'UNKNOWN'} signalValue
   * @param {boolean} [isOptional=false]
   * @returns {Gap | null}
   */
  createGap(signalId, asset, signalValue, isOptional = false) {
    const signal = getSignalById(signalId);
    if (!signal) return null;
    
    const workstream = getWorkstreamForSignal(signalId);
    const priority = isOptional ? Math.min(3, getSignalPriority(signalId) + 1) : getSignalPriority(signalId);
    
    // Get fields that can remediate this gap
    const remediationFields = getFieldsForSignal(signalId)
      .filter(f => 
        f.supportedAssetTypes.includes('*') || 
        f.supportedAssetTypes.includes(asset.typeName)
      )
      .map(f => f.displayName);
    
    return {
      id: `${asset.guid}-${signalId}`,
      signalId,
      signalDisplayName: signal.displayName,
      workstreamId: workstream?.id || 'OTHER',
      workstreamDisplayName: workstream?.displayName || 'Other',
      priority,
      severity: signal.severity,
      affectedAssetIds: [asset.guid],
      affectedAssetCount: 1,
      coveragePercent: 0,
      remediationFields,
      description: this.generateGapDescription(signal, asset, signalValue),
      guidanceUrl: signal.guidanceUrl,
    };
  }

  /**
   * Generate human-readable gap description
   * @param {Object} signal
   * @param {Object} asset
   * @param {boolean | 'UNKNOWN'} signalValue
   * @returns {string}
   */
  generateGapDescription(signal, asset, signalValue) {
    const assetName = asset.displayName || asset.attributes?.name || asset.guid;
    
    if (isSignalUnknown(signalValue)) {
      return `${signal.displayName} status is unknown for "${assetName}". ${signal.description}`;
    }
    
    return `"${assetName}" is missing ${signal.displayName}. ${signal.description}`;
  }

  /**
   * Build gap summary
   * @param {Object[]} assets
   * @param {AssetGap[]} assetGaps
   * @param {Gap[]} aggregatedGaps
   * @returns {GapSummary}
   */
  buildSummary(assets, assetGaps, aggregatedGaps) {
    const gapsBySignal = {};
    const gapsByWorkstream = {};
    const gapsByPriority = { 1: 0, 2: 0, 3: 0 };
    
    for (const gap of aggregatedGaps) {
      gapsBySignal[gap.signalId] = gap.affectedAssetCount;
      
      if (!gapsByWorkstream[gap.workstreamId]) {
        gapsByWorkstream[gap.workstreamId] = 0;
      }
      gapsByWorkstream[gap.workstreamId] += gap.affectedAssetCount;
      
      gapsByPriority[gap.priority] = (gapsByPriority[gap.priority] || 0) + gap.affectedAssetCount;
    }
    
    const totalGaps = assetGaps.reduce((sum, ag) => sum + ag.totalGapCount, 0);
    const assetsWithGaps = assetGaps.filter(ag => ag.totalGapCount > 0).length;
    
    return {
      totalAssets: assets.length,
      totalGaps,
      assetsWithGaps,
      gapsBySignal,
      gapsByWorkstream,
      gapsByPriority,
    };
  }

  /**
   * Get top gaps by impact (most affected assets)
   * @param {Gap[]} gaps
   * @param {number} [limit=10]
   * @returns {Gap[]}
   */
  getTopGapsByImpact(gaps, limit = 10) {
    return [...gaps]
      .sort((a, b) => b.affectedAssetCount - a.affectedAssetCount)
      .slice(0, limit);
  }

  /**
   * Get top gaps by priority
   * @param {Gap[]} gaps
   * @param {number} [limit=10]
   * @returns {Gap[]}
   */
  getTopGapsByPriority(gaps, limit = 10) {
    return [...gaps]
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return b.affectedAssetCount - a.affectedAssetCount;
      })
      .slice(0, limit);
  }

  /**
   * Group gaps by workstream
   * @param {Gap[]} gaps
   * @returns {Record<string, Gap[]>}
   */
  groupGapsByWorkstream(gaps) {
    const grouped = {};
    
    for (const gap of gaps) {
      if (!grouped[gap.workstreamId]) {
        grouped[gap.workstreamId] = [];
      }
      grouped[gap.workstreamId].push(gap);
    }
    
    return grouped;
  }
}

// =============================================================================
// FACTORY
// =============================================================================

/**
 * Create a gap engine with default options
 * @param {Object} [options]
 * @returns {GapEngine}
 */
export function createGapEngine(options = {}) {
  return new GapEngine(options);
}
