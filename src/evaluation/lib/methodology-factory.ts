/**
 * Shared Methodology Factory
 *
 * SINGLE SOURCE OF TRUTH for building methodology configurations.
 * Used by both /api/assess and /api/evaluate endpoints.
 *
 * This consolidates the previously duplicated logic that was causing
 * inconsistent scores across endpoints.
 */

import type {
  UseCaseSpec,
  Methodology,
  ScoringConfig,
  ChecklistRule,
  MaturityLevel,
} from '@atlan/assessment-lib';

export type MethodologyType =
  | 'WEIGHTED_DIMENSIONS'
  | 'WEIGHTED_MEASURES'
  | 'CHECKLIST'
  | 'QTRIPLET'
  | 'MATURITY';

export type UnknownPolicy = 'IGNORE_IN_ROLLUP' | 'TREAT_UNKNOWN_AS_ZERO';

/**
 * Valid methodology types for validation
 */
export const VALID_METHODOLOGY_TYPES: MethodologyType[] = [
  'WEIGHTED_DIMENSIONS',
  'WEIGHTED_MEASURES',
  'CHECKLIST',
  'QTRIPLET',
  'MATURITY',
];

/**
 * Validate methodology type - throws if invalid
 */
export function validateMethodologyType(type: string): MethodologyType {
  if (!VALID_METHODOLOGY_TYPES.includes(type as MethodologyType)) {
    throw new Error(
      `Invalid methodology type: "${type}". ` +
      `Valid types are: ${VALID_METHODOLOGY_TYPES.join(', ')}`
    );
  }
  return type as MethodologyType;
}

/**
 * Build a methodology configuration for the given use case.
 *
 * This is the CANONICAL implementation - both /api/assess and /api/evaluate
 * MUST use this function to ensure consistent scoring.
 */
export function buildMethodology(
  useCase: UseCaseSpec,
  methodologyType: MethodologyType
): Methodology {
  switch (methodologyType) {
    case 'WEIGHTED_DIMENSIONS':
      return buildWeightedDimensions(useCase);

    case 'WEIGHTED_MEASURES':
      return buildWeightedMeasures(useCase);

    case 'CHECKLIST':
      return buildChecklist(useCase);

    case 'QTRIPLET':
      return buildQTriplet(useCase);

    case 'MATURITY':
      return buildMaturity(useCase);

    default:
      // TypeScript exhaustiveness check
      const _exhaustive: never = methodologyType;
      throw new Error(`Unhandled methodology type: ${_exhaustive}`);
  }
}

/**
 * Build a complete ScoringConfig with methodology, unknown policy, and metadata.
 */
export function buildScoringConfig(
  useCase: UseCaseSpec,
  methodologyType: MethodologyType,
  unknownPolicy: UnknownPolicy = 'IGNORE_IN_ROLLUP',
  readyThreshold: number = 0.75
): ScoringConfig {
  return {
    id: `${useCase.id}_${methodologyType.toLowerCase()}`,
    label: `${useCase.name} (${methodologyType})`,
    methodology: buildMethodology(useCase, methodologyType),
    unknownPolicy,
    readyThreshold,
  };
}

// ============================================================================
// Individual Methodology Builders
// ============================================================================

function buildWeightedDimensions(useCase: UseCaseSpec): Methodology {
  const dimensions = useCase.dimensions || [];
  const weight = dimensions.length > 0 ? 1 / dimensions.length : 1;

  return {
    type: 'WEIGHTED_DIMENSIONS',
    weights: Object.fromEntries(dimensions.map((d) => [d.id, weight])),
  };
}

function buildWeightedMeasures(useCase: UseCaseSpec): Methodology {
  const measures = useCase.measures || [];
  const weight = measures.length > 0 ? 1 / measures.length : 1;

  return {
    type: 'WEIGHTED_MEASURES',
    weights: Object.fromEntries(measures.map((m) => [m.id, weight])),
  };
}

/**
 * CHECKLIST methodology
 *
 * Rules:
 * - First 2 measures are REQUIRED (must pass for overall pass)
 * - All measures use >= 80% threshold
 * - UNKNOWN values propagate as UNKNOWN
 */
function buildChecklist(useCase: UseCaseSpec): Methodology {
  const rules: ChecklistRule[] = useCase.measures.map((m, index) => ({
    id: m.id,
    description: `${m.description} >= 80%`,
    // First two measures are required for checklist pass
    required: index < 2,
    pass: (measures: Record<string, any>) => {
      const v = measures[m.id];
      if (v === 'UNKNOWN') return 'UNKNOWN';
      return (v as number) >= 0.8;
    },
  }));

  return {
    type: 'CHECKLIST',
    rules,
  };
}

/**
 * QTRIPLET methodology (Quality Triplet)
 *
 * Groups measures into three components:
 * - qcomp (Completeness): semantic/descriptive measures
 * - qcons (Consistency): operational/governance measures
 * - qaccu (Accuracy): quality/freshness measures
 */
function buildQTriplet(useCase: UseCaseSpec): Methodology {
  // Semantic/descriptive measures → Completeness
  const semanticMeasures = useCase.measures
    .filter((m) =>
      m.id.includes('description') ||
      m.id.includes('certified') ||
      m.id.includes('semantic')
    )
    .map((m) => m.id);

  // Operational/governance measures → Consistency
  const operationalMeasures = useCase.measures
    .filter((m) =>
      m.id.includes('owner') ||
      m.id.includes('runbook') ||
      m.id.includes('relationship') ||
      m.id.includes('lineage')
    )
    .map((m) => m.id);

  // Quality/freshness measures → Accuracy
  const qualityMeasures = useCase.measures
    .filter((m) =>
      m.id.includes('quality') ||
      m.id.includes('freshness') ||
      m.id.includes('incident') ||
      m.id.includes('dq') ||
      m.id.includes('volatility')
    )
    .map((m) => m.id);

  // Fallback: distribute measures evenly if categorization fails
  const fallbackMeasure = (index: number) =>
    useCase.measures[index]?.id ? [useCase.measures[index].id] : [];

  return {
    type: 'QTRIPLET',
    qcomp: semanticMeasures.length > 0 ? semanticMeasures : fallbackMeasure(0),
    qcons: operationalMeasures.length > 0 ? operationalMeasures : fallbackMeasure(1),
    qaccu: qualityMeasures.length > 0 ? qualityMeasures : fallbackMeasure(2),
  };
}

/**
 * MATURITY methodology
 *
 * Five maturity levels with progressively stricter requirements:
 *
 * Level 1: Basic (no requirements - everyone starts here)
 * Level 2: Managed (owner coverage >= 50%)
 * Level 3: Defined (owner >= 70%, description >= 50%)
 * Level 4: Quantitatively Managed (owner >= 85%, description >= 70%)
 * Level 5: Optimizing (owner >= 95%, description >= 90%, relationships >= 80%)
 */
function buildMaturity(useCase: UseCaseSpec): Methodology {
  // Helper to create a threshold rule
  const thresholdRule = (
    id: string,
    measureId: string,
    description: string,
    threshold: number
  ): ChecklistRule => ({
    id,
    description,
    pass: (measures: Record<string, any>) => {
      const v = measures[measureId];
      if (v === 'UNKNOWN') return 'UNKNOWN';
      return (v as number) >= threshold;
    },
  });

  return {
    type: 'MATURITY',
    levels: [
      // Level 1: Basic - No requirements
      {
        level: 1 as MaturityLevel,
        requiredRules: [],
      },
      // Level 2: Managed - Basic ownership
      {
        level: 2 as MaturityLevel,
        requiredRules: [
          thresholdRule(
            'level2_owner',
            'coverage.owner',
            'Owner coverage >= 50%',
            0.5
          ),
        ],
      },
      // Level 3: Defined - Ownership + Documentation
      {
        level: 3 as MaturityLevel,
        requiredRules: [
          thresholdRule(
            'level3_owner',
            'coverage.owner',
            'Owner coverage >= 70%',
            0.7
          ),
          thresholdRule(
            'level3_desc',
            'coverage.asset_description',
            'Description coverage >= 50%',
            0.5
          ),
        ],
      },
      // Level 4: Quantitatively Managed
      {
        level: 4 as MaturityLevel,
        requiredRules: [
          thresholdRule(
            'level4_owner',
            'coverage.owner',
            'Owner coverage >= 85%',
            0.85
          ),
          thresholdRule(
            'level4_desc',
            'coverage.asset_description',
            'Description coverage >= 70%',
            0.7
          ),
        ],
      },
      // Level 5: Optimizing - Full coverage
      {
        level: 5 as MaturityLevel,
        requiredRules: [
          thresholdRule(
            'level5_owner',
            'coverage.owner',
            'Owner coverage >= 95%',
            0.95
          ),
          thresholdRule(
            'level5_desc',
            'coverage.asset_description',
            'Description coverage >= 90%',
            0.9
          ),
          thresholdRule(
            'level5_lineage',
            'coverage.lineage',
            'Lineage coverage >= 80%',
            0.8
          ),
        ],
      },
    ],
  };
}
