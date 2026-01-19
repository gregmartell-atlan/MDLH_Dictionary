/**
 * Pivot Measure Calculations
 * 
 * Functions to calculate various measures for pivot table rollups
 */

import type { Measure, PivotAsset, PivotNodeMetrics } from './pivot-types';

// ============================================================================
// Signal Calculation Helpers
// ============================================================================

/**
 * Convert tri-state signal to numeric value for averaging
 * true = 1, false = 0, 'UNKNOWN' = excluded from average
 */
function signalToNumeric(signal: boolean | 'UNKNOWN'): number | null {
  if (signal === 'UNKNOWN') return null;
  return signal ? 1 : 0;
}

/**
 * Calculate average of numeric values, excluding nulls
 */
function averageNonNull(values: (number | null)[]): number {
  const validValues = values.filter((v): v is number => v !== null);
  if (validValues.length === 0) return 0;
  return validValues.reduce((sum, v) => sum + v, 0) / validValues.length;
}

// ============================================================================
// Calculate Metrics for a Group of Assets
// ============================================================================

/**
 * Calculate all metrics for a group of assets
 */
export function calculateMetricsForAssets(assets: PivotAsset[]): PivotNodeMetrics {
  if (assets.length === 0) {
    return {
      assetCount: 0,
      signalCoverage: 0,
      gapCount: 0,
      highSeverityGaps: 0,
      ownershipCoverage: 0,
      lineageCoverage: 0,
      semanticsCoverage: 0,
      sensitivityCoverage: 0,
      accessCoverage: 0,
      usageCoverage: 0,
      freshnessCoverage: 0,
    };
  }

  // Count metrics
  const assetCount = assets.length;
  const gapCount = assets.reduce((sum, a) => sum + a.gapCount, 0);
  const highSeverityGaps = assets.reduce((sum, a) => sum + a.highSeverityGaps, 0);

  // Calculate coverage for each signal type
  const ownershipValues = assets.map(a => signalToNumeric(a.signals.ownership));
  const lineageValues = assets.map(a => signalToNumeric(a.signals.lineage));
  const semanticsValues = assets.map(a => signalToNumeric(a.signals.semantics));
  const sensitivityValues = assets.map(a => signalToNumeric(a.signals.sensitivity));
  const accessValues = assets.map(a => signalToNumeric(a.signals.access));
  const usageValues = assets.map(a => signalToNumeric(a.signals.usage));
  const freshnessValues = assets.map(a => signalToNumeric(a.signals.freshness));

  const ownershipCoverage = Math.round(averageNonNull(ownershipValues) * 100);
  const lineageCoverage = Math.round(averageNonNull(lineageValues) * 100);
  const semanticsCoverage = Math.round(averageNonNull(semanticsValues) * 100);
  const sensitivityCoverage = Math.round(averageNonNull(sensitivityValues) * 100);
  const accessCoverage = Math.round(averageNonNull(accessValues) * 100);
  const usageCoverage = Math.round(averageNonNull(usageValues) * 100);
  const freshnessCoverage = Math.round(averageNonNull(freshnessValues) * 100);

  // Overall signal coverage (average of all signal coverages)
  const allCoverages = [
    ownershipCoverage,
    lineageCoverage,
    semanticsCoverage,
    sensitivityCoverage,
    accessCoverage,
    usageCoverage,
    freshnessCoverage,
  ];
  const signalCoverage = Math.round(
    allCoverages.reduce((sum, c) => sum + c, 0) / allCoverages.length
  );

  return {
    assetCount,
    signalCoverage,
    gapCount,
    highSeverityGaps,
    ownershipCoverage,
    lineageCoverage,
    semanticsCoverage,
    sensitivityCoverage,
    accessCoverage,
    usageCoverage,
    freshnessCoverage,
  };
}

// ============================================================================
// Calculate Single Measure
// ============================================================================

/**
 * Calculate a single measure value for a set of assets
 */
export function calculateMeasure(measure: Measure, assets: PivotAsset[]): number {
  if (assets.length === 0) return 0;

  switch (measure) {
    case 'assetCount':
      return assets.length;

    case 'gapCount':
      return assets.reduce((sum, a) => sum + a.gapCount, 0);

    case 'highSeverityGaps':
      return assets.reduce((sum, a) => sum + a.highSeverityGaps, 0);

    case 'signalCoverage': {
      const metrics = calculateMetricsForAssets(assets);
      return metrics.signalCoverage;
    }

    case 'ownershipCoverage': {
      const values = assets.map(a => signalToNumeric(a.signals.ownership));
      return Math.round(averageNonNull(values) * 100);
    }

    case 'lineageCoverage': {
      const values = assets.map(a => signalToNumeric(a.signals.lineage));
      return Math.round(averageNonNull(values) * 100);
    }

    case 'semanticsCoverage': {
      const values = assets.map(a => signalToNumeric(a.signals.semantics));
      return Math.round(averageNonNull(values) * 100);
    }

    case 'sensitivityCoverage': {
      const values = assets.map(a => signalToNumeric(a.signals.sensitivity));
      return Math.round(averageNonNull(values) * 100);
    }

    case 'accessCoverage': {
      const values = assets.map(a => signalToNumeric(a.signals.access));
      return Math.round(averageNonNull(values) * 100);
    }

    case 'usageCoverage': {
      const values = assets.map(a => signalToNumeric(a.signals.usage));
      return Math.round(averageNonNull(values) * 100);
    }

    case 'freshnessCoverage': {
      const values = assets.map(a => signalToNumeric(a.signals.freshness));
      return Math.round(averageNonNull(values) * 100);
    }

    default:
      return 0;
  }
}

// ============================================================================
// Aggregate Child Metrics (for rollup)
// ============================================================================

/**
 * Aggregate metrics from child nodes using weighted averages
 */
export function aggregateChildMetrics(childMetrics: PivotNodeMetrics[]): PivotNodeMetrics {
  if (childMetrics.length === 0) {
    return {
      assetCount: 0,
      signalCoverage: 0,
      gapCount: 0,
      highSeverityGaps: 0,
      ownershipCoverage: 0,
      lineageCoverage: 0,
      semanticsCoverage: 0,
      sensitivityCoverage: 0,
      accessCoverage: 0,
      usageCoverage: 0,
      freshnessCoverage: 0,
    };
  }

  // Sum counts
  const assetCount = childMetrics.reduce((sum, m) => sum + m.assetCount, 0);
  const gapCount = childMetrics.reduce((sum, m) => sum + m.gapCount, 0);
  const highSeverityGaps = childMetrics.reduce((sum, m) => sum + m.highSeverityGaps, 0);

  // Weighted averages for coverage metrics
  const weightedAvg = (key: keyof PivotNodeMetrics): number => {
    if (assetCount === 0) return 0;
    const weightedSum = childMetrics.reduce(
      (sum, m) => sum + m[key] * m.assetCount,
      0
    );
    return Math.round(weightedSum / assetCount);
  };

  return {
    assetCount,
    gapCount,
    highSeverityGaps,
    signalCoverage: weightedAvg('signalCoverage'),
    ownershipCoverage: weightedAvg('ownershipCoverage'),
    lineageCoverage: weightedAvg('lineageCoverage'),
    semanticsCoverage: weightedAvg('semanticsCoverage'),
    sensitivityCoverage: weightedAvg('sensitivityCoverage'),
    accessCoverage: weightedAvg('accessCoverage'),
    usageCoverage: weightedAvg('usageCoverage'),
    freshnessCoverage: weightedAvg('freshnessCoverage'),
  };
}

// ============================================================================
// Measure Labels & Formatting
// ============================================================================

/**
 * Get human-readable label for a measure
 */
export function getMeasureLabel(measure: Measure): string {
  const labels: Record<Measure, string> = {
    assetCount: '# Assets',
    signalCoverage: 'Signal Coverage',
    gapCount: 'Gaps',
    highSeverityGaps: 'High Severity',
    ownershipCoverage: 'Ownership',
    lineageCoverage: 'Lineage',
    semanticsCoverage: 'Semantics',
    sensitivityCoverage: 'Sensitivity',
    accessCoverage: 'Access',
    usageCoverage: 'Usage',
    freshnessCoverage: 'Freshness',
  };
  return labels[measure] || measure;
}

/**
 * Format a measure value for display
 */
export function formatMeasure(measure: Measure, value: number): string {
  // Count measures display as plain numbers
  if (measure === 'assetCount' || measure === 'gapCount' || measure === 'highSeverityGaps') {
    return value.toLocaleString();
  }
  
  // Coverage measures display as percentages
  return `${value}%`;
}

/**
 * Determine if a measure should show a visual bar
 */
export function shouldShowBar(measure: Measure): boolean {
  const barMeasures: Measure[] = [
    'signalCoverage',
    'ownershipCoverage',
    'lineageCoverage',
    'semanticsCoverage',
    'sensitivityCoverage',
    'accessCoverage',
    'usageCoverage',
    'freshnessCoverage',
  ];
  return barMeasures.includes(measure);
}

/**
 * Get color class for a percentage value
 */
export function getScoreColorClass(value: number): string {
  if (value >= 80) return 'bg-green-500';
  if (value >= 60) return 'bg-amber-500';
  if (value >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}

/**
 * Get text color class for a percentage value
 */
export function getScoreTextClass(value: number): string {
  if (value >= 80) return 'text-green-600';
  if (value >= 60) return 'text-amber-600';
  if (value >= 40) return 'text-orange-600';
  return 'text-red-600';
}
