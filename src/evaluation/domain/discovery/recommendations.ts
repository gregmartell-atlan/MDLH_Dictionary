/**
 * Field Recommendations Engine
 *
 * Analyzes tenant schema to recommend fields that could improve
 * assessment coverage and signal quality.
 */

import type {
  TenantSchemaSnapshot,
  ReconciliationReport,
  FieldRecommendation,
  RecommendationsReport,
  CustomMetadataDefinition,
  ClassificationDefinition,
  FieldPopulationStats,
} from './types';
import type { SignalType, UnifiedField } from '../catalog/types';
import { SIGNAL_DEFINITIONS } from '../catalog/signal-definitions';
import { getUnmatchedFields } from './field-reconciliation';

// =============================================================================
// RECOMMENDATION PATTERNS
// =============================================================================

/**
 * Known patterns for custom metadata that contribute to signals
 */
const CM_SIGNAL_PATTERNS: Array<{
  pattern: RegExp;
  signal: SignalType;
  weight: number;
  rationale: string;
}> = [
  // Ownership signals
  {
    pattern: /owner|steward|responsible|contact|dpo|custodian/i,
    signal: 'OWNERSHIP',
    weight: 0.8,
    rationale: 'Contains ownership/stewardship information',
  },
  // Semantics signals
  {
    pattern: /description|purpose|definition|meaning|context|documentation/i,
    signal: 'SEMANTICS',
    weight: 0.7,
    rationale: 'Contains semantic/documentation information',
  },
  // Quality signals
  {
    pattern: /quality|accuracy|valid|complete|consistent|timeliness|freshness/i,
    signal: 'QUALITY',
    weight: 0.8,
    rationale: 'Contains data quality information',
  },
  // Sensitivity signals
  {
    pattern: /pii|phi|sensitive|confidential|privacy|personal|gdpr|hipaa|pci/i,
    signal: 'SENSITIVITY',
    weight: 0.9,
    rationale: 'Contains data sensitivity/classification information',
  },
  // Access signals
  {
    pattern: /access|permission|entitlement|role|security|restricted/i,
    signal: 'ACCESS',
    weight: 0.7,
    rationale: 'Contains access control information',
  },
  // Lineage signals
  {
    pattern: /source|origin|upstream|downstream|lineage|transformation/i,
    signal: 'LINEAGE',
    weight: 0.6,
    rationale: 'Contains lineage/provenance information',
  },
  // Trust signals
  {
    pattern: /certified|verified|approved|trust|golden|authoritative/i,
    signal: 'TRUST',
    weight: 0.9,
    rationale: 'Contains trust/certification information',
  },
  // Freshness signals
  {
    pattern: /updated|refresh|frequency|schedule|sla|lag|latency/i,
    signal: 'FRESHNESS',
    weight: 0.7,
    rationale: 'Contains freshness/update frequency information',
  },
  // Usage signals
  {
    pattern: /usage|popularity|query|view|access.?count|analytics/i,
    signal: 'USAGE',
    weight: 0.6,
    rationale: 'Contains usage/popularity information',
  },
  // AI Readiness signals
  {
    pattern: /ai|ml|model|training|feature|embedding|vector/i,
    signal: 'AI_READY',
    weight: 0.8,
    rationale: 'Contains AI/ML readiness information',
  },
];

/**
 * Known patterns for classifications that contribute to signals
 */
const CLASSIFICATION_SIGNAL_PATTERNS: Array<{
  pattern: RegExp;
  signal: SignalType;
  weight: number;
  rationale: string;
}> = [
  {
    pattern: /pii|personal|gdpr|ccpa|privacy/i,
    signal: 'SENSITIVITY',
    weight: 0.9,
    rationale: 'PII/Privacy classification',
  },
  {
    pattern: /phi|hipaa|health|medical/i,
    signal: 'SENSITIVITY',
    weight: 0.9,
    rationale: 'PHI/Health data classification',
  },
  {
    pattern: /pci|payment|credit.?card|financial/i,
    signal: 'SENSITIVITY',
    weight: 0.9,
    rationale: 'PCI/Financial data classification',
  },
  {
    pattern: /confidential|secret|internal|restricted/i,
    signal: 'ACCESS',
    weight: 0.8,
    rationale: 'Confidentiality classification',
  },
  {
    pattern: /verified|certified|golden|master|authoritative/i,
    signal: 'TRUST',
    weight: 0.85,
    rationale: 'Trust/certification classification',
  },
  {
    pattern: /deprecated|archive|legacy|sunset/i,
    signal: 'TRUST',
    weight: 0.6,
    rationale: 'Lifecycle status classification',
  },
];

// =============================================================================
// RECOMMENDATION GENERATION
// =============================================================================

/**
 * Analyze custom metadata for potential signal contributions
 */
function analyzeCustomMetadata(
  cmDef: CustomMetadataDefinition,
  stats: FieldPopulationStats[]
): FieldRecommendation[] {
  const recommendations: FieldRecommendation[] = [];

  for (const attr of cmDef.attributes) {
    // Check each attribute against signal patterns
    for (const pattern of CM_SIGNAL_PATTERNS) {
      const nameMatch = pattern.pattern.test(attr.name);
      const displayMatch = pattern.pattern.test(attr.displayName);
      const descMatch = attr.description && pattern.pattern.test(attr.description);

      if (nameMatch || displayMatch || descMatch) {
        // Find population stats for this attribute
        const attrStats = stats.find(
          s => s.attributeName === `${cmDef.name}.${attr.name}`
        );

        const populationRate = attrStats?.populationRate ?? 0;
        const totalAssets = attrStats?.totalAssets ?? 0;
        const populatedAssets = attrStats?.populatedAssets ?? 0;

        // Calculate confidence based on match strength and population
        let confidence = 0.5;
        if (nameMatch) confidence += 0.2;
        if (displayMatch) confidence += 0.15;
        if (descMatch) confidence += 0.1;
        if (populationRate > 0.5) confidence += 0.15;
        confidence = Math.min(confidence, 1.0);

        recommendations.push({
          tenantField: {
            type: 'custom_metadata',
            path: `cm.${cmDef.name}.${attr.name}`,
            displayName: `${cmDef.displayName} → ${attr.displayName}`,
            description: attr.description,
          },
          populationStats: {
            totalAssets,
            populatedAssets,
            rate: populationRate,
          },
          recommendation: {
            signal: pattern.signal,
            rationale: pattern.rationale,
            weight: pattern.weight,
            action: 'add_to_model',
          },
          confidence,
        });

        // Only match first pattern for each attribute
        break;
      }
    }
  }

  return recommendations;
}

/**
 * Analyze classifications for potential signal contributions
 */
function analyzeClassifications(
  classifications: ClassificationDefinition[]
): FieldRecommendation[] {
  const recommendations: FieldRecommendation[] = [];

  for (const classification of classifications) {
    for (const pattern of CLASSIFICATION_SIGNAL_PATTERNS) {
      const nameMatch = pattern.pattern.test(classification.name);
      const displayMatch = pattern.pattern.test(classification.displayName);
      const descMatch = classification.description && pattern.pattern.test(classification.description);

      if (nameMatch || displayMatch || descMatch) {
        let confidence = 0.6;
        if (nameMatch) confidence += 0.2;
        if (displayMatch) confidence += 0.1;
        if (descMatch) confidence += 0.1;
        confidence = Math.min(confidence, 1.0);

        recommendations.push({
          tenantField: {
            type: 'classification',
            path: `classification:${classification.name}`,
            displayName: classification.displayName,
            description: classification.description,
          },
          populationStats: {
            totalAssets: 0, // Classifications don't have direct population stats
            populatedAssets: 0,
            rate: 0,
          },
          recommendation: {
            signal: pattern.signal,
            rationale: pattern.rationale,
            weight: pattern.weight,
            action: 'add_to_model',
          },
          confidence,
        });

        break;
      }
    }
  }

  return recommendations;
}

/**
 * Analyze native attributes for potential additions
 */
function analyzeNativeAttributes(
  snapshot: TenantSchemaSnapshot,
  reconciliationReport: ReconciliationReport
): FieldRecommendation[] {
  const recommendations: FieldRecommendation[] = [];

  // Get unmatched fields to see what we're missing
  const unmatchedFields = getUnmatchedFields(reconciliationReport);
  const unmatchedIds = new Set(unmatchedFields.map(f => f.canonicalFieldId));

  // Look for native attributes with high population that might fill gaps
  for (const stats of snapshot.fieldPopulation) {
    if (stats.populationRate < 0.3) continue; // Skip low-population fields

    // Check if this attribute matches any signal patterns
    for (const pattern of CM_SIGNAL_PATTERNS) {
      if (pattern.pattern.test(stats.attributeName)) {
        let confidence = 0.4 + (stats.populationRate * 0.4);

        recommendations.push({
          tenantField: {
            type: 'attribute',
            path: stats.attributeName,
            displayName: stats.attributeName,
          },
          populationStats: {
            totalAssets: stats.totalAssets,
            populatedAssets: stats.populatedAssets,
            rate: stats.populationRate,
          },
          recommendation: {
            signal: pattern.signal,
            rationale: `High population rate (${(stats.populationRate * 100).toFixed(0)}%) suggests valuable data`,
            weight: pattern.weight * stats.populationRate,
            action: 'supplement',
          },
          confidence,
        });

        break;
      }
    }
  }

  return recommendations;
}

/**
 * Identify signal gaps and suggest improvements
 */
function identifySignalGaps(
  reconciliationReport: ReconciliationReport
): Map<SignalType, number> {
  const signalCoverage = new Map<SignalType, number>();

  // Initialize all signals to 0
  for (const signal of SIGNAL_DEFINITIONS) {
    signalCoverage.set(signal.id, 0);
  }

  // Count matched fields per signal
  for (const result of reconciliationReport.results) {
    if (result.status === 'MATCHED' || result.status === 'ALIAS_MATCHED' || result.status === 'CM_MATCHED') {
      // Would need to look up the field to get its signals
      // For now, we'll track overall reconciliation
    }
  }

  return signalCoverage;
}

// =============================================================================
// MAIN RECOMMENDATION FUNCTION
// =============================================================================

/**
 * Generate field recommendations based on tenant schema analysis
 */
export function generateRecommendations(
  snapshot: TenantSchemaSnapshot,
  reconciliationReport: ReconciliationReport
): RecommendationsReport {
  const allRecommendations: FieldRecommendation[] = [];

  // Analyze custom metadata
  for (const cmDef of Object.values(snapshot.customMetadata)) {
    const cmRecs = analyzeCustomMetadata(cmDef, snapshot.fieldPopulation);
    allRecommendations.push(...cmRecs);
  }

  // Analyze classifications
  const classRecs = analyzeClassifications(snapshot.classifications);
  allRecommendations.push(...classRecs);

  // Analyze native attributes
  const nativeRecs = analyzeNativeAttributes(snapshot, reconciliationReport);
  allRecommendations.push(...nativeRecs);

  // Deduplicate by path
  const seenPaths = new Set<string>();
  const uniqueRecommendations = allRecommendations.filter(rec => {
    if (seenPaths.has(rec.tenantField.path)) {
      return false;
    }
    seenPaths.add(rec.tenantField.path);
    return true;
  });

  // Sort by confidence and relevance
  uniqueRecommendations.sort((a, b) => {
    // Primary: confidence
    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence;
    }
    // Secondary: population rate
    return b.populationStats.rate - a.populationStats.rate;
  });

  // Calculate summary
  const bySignal: Record<SignalType, number> = {} as Record<SignalType, number>;
  for (const signal of SIGNAL_DEFINITIONS) {
    bySignal[signal.id] = uniqueRecommendations.filter(
      r => r.recommendation.signal === signal.id
    ).length;
  }

  const byConfidenceLevel = {
    high: uniqueRecommendations.filter(r => r.confidence >= 0.8).length,
    medium: uniqueRecommendations.filter(r => r.confidence >= 0.5 && r.confidence < 0.8).length,
    low: uniqueRecommendations.filter(r => r.confidence < 0.5).length,
  };

  return {
    tenantId: snapshot.tenantId,
    generatedAt: new Date().toISOString(),
    recommendations: uniqueRecommendations,
    summary: {
      totalRecommendations: uniqueRecommendations.length,
      bySignal,
      byConfidenceLevel,
    },
  };
}

/**
 * Get high-confidence recommendations
 */
export function getHighConfidenceRecommendations(
  report: RecommendationsReport,
  threshold = 0.8
): FieldRecommendation[] {
  return report.recommendations.filter(r => r.confidence >= threshold);
}

/**
 * Get recommendations for a specific signal
 */
export function getRecommendationsForSignal(
  report: RecommendationsReport,
  signal: SignalType
): FieldRecommendation[] {
  return report.recommendations.filter(r => r.recommendation.signal === signal);
}

/**
 * Get recommendations that could fill coverage gaps
 */
export function getGapFillingRecommendations(
  report: RecommendationsReport,
  reconciliationReport: ReconciliationReport
): FieldRecommendation[] {
  // Find signals with low coverage
  const signalCounts = new Map<SignalType, number>();
  for (const rec of report.recommendations) {
    const current = signalCounts.get(rec.recommendation.signal) || 0;
    signalCounts.set(rec.recommendation.signal, current + 1);
  }

  // Prioritize recommendations for underrepresented signals
  const avgCount = report.recommendations.length / SIGNAL_DEFINITIONS.length;

  return report.recommendations.filter(rec => {
    const signalCount = signalCounts.get(rec.recommendation.signal) || 0;
    // Boost recommendations for signals with below-average coverage
    return signalCount < avgCount || rec.confidence >= 0.7;
  });
}

/**
 * Generate improvement suggestions based on gaps
 */
export function generateImprovementSuggestions(
  snapshot: TenantSchemaSnapshot,
  reconciliationReport: ReconciliationReport
): Array<{
  signal: SignalType;
  gap: string;
  suggestion: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}> {
  const suggestions: Array<{
    signal: SignalType;
    gap: string;
    suggestion: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
  }> = [];

  const unmatchedFields = getUnmatchedFields(reconciliationReport);

  // Group unmatched by what they would contribute to
  const unmatchedBySignal = new Map<SignalType, string[]>();

  for (const field of unmatchedFields) {
    // This would need the original UnifiedField to get contributesToSignals
    // For now, infer from field name
    for (const pattern of CM_SIGNAL_PATTERNS) {
      if (pattern.pattern.test(field.canonicalFieldId) || pattern.pattern.test(field.canonicalFieldName)) {
        const existing = unmatchedBySignal.get(pattern.signal) || [];
        existing.push(field.canonicalFieldName);
        unmatchedBySignal.set(pattern.signal, existing);
        break;
      }
    }
  }

  // Generate suggestions
  for (const [signal, fields] of unmatchedBySignal) {
    const signalDef = SIGNAL_DEFINITIONS.find(s => s.id === signal);
    const priority = signalDef?.severity === 'HIGH' ? 'HIGH' :
                     signalDef?.severity === 'MED' ? 'MEDIUM' : 'LOW';

    suggestions.push({
      signal,
      gap: `Missing ${fields.length} field(s): ${fields.slice(0, 3).join(', ')}${fields.length > 3 ? '...' : ''}`,
      suggestion: `Consider adding custom metadata or enabling native attributes for ${signal} signal`,
      priority,
    });
  }

  // Check for empty signal areas
  const hasCustomMetadata = Object.keys(snapshot.customMetadata).length > 0;
  const hasClassifications = snapshot.classifications.length > 0;
  const hasDomains = snapshot.domains.length > 0;

  if (!hasCustomMetadata) {
    suggestions.push({
      signal: 'QUALITY',
      gap: 'No custom metadata defined',
      suggestion: 'Create custom metadata business attributes for data governance fields',
      priority: 'HIGH',
    });
  }

  if (!hasClassifications) {
    suggestions.push({
      signal: 'SENSITIVITY',
      gap: 'No classifications defined',
      suggestion: 'Create classification tags for PII, PHI, confidentiality levels',
      priority: 'HIGH',
    });
  }

  if (!hasDomains) {
    suggestions.push({
      signal: 'OWNERSHIP',
      gap: 'No domains defined',
      suggestion: 'Create data domains to enable domain-based ownership',
      priority: 'MEDIUM',
    });
  }

  return suggestions.sort((a, b) => {
    const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}
