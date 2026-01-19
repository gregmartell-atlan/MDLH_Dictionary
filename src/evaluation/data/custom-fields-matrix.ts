/**
 * Custom Fields × Use Case × Vertical Matrix
 * 
 * Output matrices showing recommended custom fields by use case and vertical
 * for planning and implementation.
 */

import type { UseCase } from '../types/metadata-assistant';
import {
  getRecommendedCustomFields,
  getCustomFieldsByUseCase,
  getCustomFieldsByVertical,
  CUSTOM_FIELDS_LIBRARY,
} from './custom-fields-library';

// ============================================
// USE CASE × CUSTOM FIELDS MATRIX
// ============================================

export interface UseCaseCustomFieldsMatrix {
  useCase: UseCase;
  description: string;
  recommendedFields: {
    fieldId: string;
    displayName: string;
    priority: 'must-have' | 'recommended' | 'optional';
    automationStrategy: string;
    effortMinutes: number;
  }[];
  totalEffortHours: number;
  implementationApproach: string;
}

export function generateUseCaseMatrix(useCase: UseCase): UseCaseCustomFieldsMatrix {
  const fields = getCustomFieldsByUseCase(useCase);
  const totalEffort = fields.reduce((sum, f) => sum + f.effortMinutes, 0);

  // Assign priorities based on relevance
  const recommended = fields.map(field => ({
    fieldId: field.id,
    displayName: field.displayName,
    priority: 'recommended' as const,
    automationStrategy: field.automationStrategy,
    effortMinutes: field.effortMinutes,
  }));

  // Bump first 2-3 to must-have if automation can help
  const upgraded = recommended.map((r, i) => ({
    ...r,
    priority: i < 2 && r.automationStrategy !== 'manual' ? ('must-have' as const) : r.priority,
  }));

  const descriptions: Record<UseCase, string> = {
    'Data Discovery': 'Surface data with context, making discovery frictionless',
    'Trusted Metrics': 'Define and govern KPI calculations with confidence',
    Compliance: 'Manage access and ensure regulatory requirements',
    'Root Cause Analysis': 'Enable rapid incident investigation and resolution',
    'Impact Analysis': 'Understand downstream effects of changes',
    'Data Compliance': 'Standardize business terminology and definitions',
    'Data Products': 'Self-serve data with clear contracts and SLAs',
    'Cost Optimization': 'Identify unused data and optimize spending',
    'Lifecycle Management': 'Track data from creation through retirement',
    'Metrics Catalog': 'Single source of truth for business metrics',
  };

  return {
    useCase,
    description: descriptions[useCase] || '',
    recommendedFields: upgraded,
    totalEffortHours: totalEffort / 60,
    implementationApproach:
      upgraded.filter(f => f.automationStrategy !== 'manual').length > 0
        ? 'Start with automated fields, then supplement with manual'
        : 'Manual setup with process documentation',
  };
}

// ============================================
// VERTICAL × CUSTOM FIELDS MATRIX
// ============================================

export interface VerticalCustomFieldsMatrix {
  vertical: string;
  description: string;
  recommendedFields: {
    fieldId: string;
    displayName: string;
    priority: 'critical' | 'important' | 'optional';
    automationStrategy: string;
    reason: string;
  }[];
  complianceFields: string[];
  operationalFields: string[];
  totalEffortHours: number;
}

export function generateVerticalMatrix(vertical: string): VerticalCustomFieldsMatrix {
  const fields = getCustomFieldsByVertical(vertical);
  const totalEffort = fields.reduce((sum, f) => sum + f.effortMinutes, 0);

  // Categorize by vertical-specific needs
  const complianceMapping: Record<string, string[]> = {
    'Financial Services': ['pii_classification', 'retention_days', 'criticality_tier'],
    Healthcare: ['pii_classification', 'retention_days', 'dq_framework'],
    'Manufacturing/HVAC': ['sla_response_time', 'lifecycle_status', 'cost_center'],
    Technology: ['api_exposure', 'ml_ready', 'dq_framework'],
    'Retail/E-commerce': ['sla_response_time', 'refresh_frequency', 'cost_center'],
  };

  const operationalMapping: Record<string, string[]> = {
    'Financial Services': ['cost_center', 'refresh_frequency', 'criticality_tier'],
    Healthcare: ['criticality_tier', 'refresh_frequency'],
    'Manufacturing/HVAC': ['department', 'business_unit', 'lifecycle_status'],
    Technology: ['department', 'api_exposure', 'ml_ready'],
    'Retail/E-commerce': ['department', 'business_unit', 'refresh_frequency'],
  };

  const complianceFields = complianceMapping[vertical] || [];
  const operationalFields = operationalMapping[vertical] || [];

  const recommended = fields.map(field => {
    let priority: 'critical' | 'important' | 'optional' = 'optional';
    let reason = 'Applicable to vertical';

    if (complianceFields.includes(field.id)) {
      priority = 'critical';
      reason = 'Regulatory/compliance requirement';
    } else if (operationalFields.includes(field.id)) {
      priority = 'important';
      reason = 'Operational excellence';
    }

    return {
      fieldId: field.id,
      displayName: field.displayName,
      priority,
      automationStrategy: field.automationStrategy,
      reason,
    };
  });

  return {
    vertical,
    description: `Custom fields tailored for ${vertical} organizations`,
    recommendedFields: recommended,
    complianceFields,
    operationalFields,
    totalEffortHours: totalEffort / 60,
  };
}

// ============================================
// COMBINED MATRIX (USE CASE + VERTICAL)
// ============================================

export interface CombinedCustomFieldsMatrix {
  useCase: UseCase;
  vertical: string;
  recommendedFields: {
    fieldId: string;
    displayName: string;
    priority: 'must-have' | 'recommended' | 'optional';
    reason: string;
    automationStrategy: string;
    effortMinutes: number;
  }[];
  automatedImplementation: {
    fieldId: string;
    rules: string[];
  }[];
  manualImplementation: {
    fieldId: string;
    instructions: string;
  }[];
  phaseMap: {
    phase: 'Foundation' | 'Enhancement' | 'Optimization';
    fields: string[];
    durationDays: number;
  }[];
  totalEffortHours: number;
}

export function generateCombinedMatrix(
  useCase: UseCase,
  vertical?: string
): CombinedCustomFieldsMatrix {
  const recommendations = getRecommendedCustomFields([useCase], vertical);

  const automated = recommendations
    .filter(r => r.field.automationStrategy !== 'manual')
    .map(r => ({
      fieldId: r.field.id,
      rules: r.field.automationRules?.map(rule => `${rule.trigger} → ${rule.action}`) || [],
    }));

  const manual = recommendations
    .filter(r => r.field.automationStrategy === 'manual')
    .map(r => ({
      fieldId: r.field.id,
      instructions: `Manually assign ${r.field.displayName}. ${r.field.purpose}`,
    }));

  const totalEffort = recommendations.reduce((sum, r) => sum + r.field.effortMinutes, 0);

  // Phase mapping
  const phaseMap: CombinedCustomFieldsMatrix['phaseMap'] = [];

  // Foundation: must-have fields
  const foundation = recommendations.filter(r => r.priority === 'must-have');
  if (foundation.length > 0) {
    phaseMap.push({
      phase: 'Foundation',
      fields: foundation.map(r => r.field.displayName),
      durationDays: Math.ceil((foundation.reduce((sum, r) => sum + r.field.effortMinutes, 0) / 60) * 2),
    });
  }

  // Enhancement: recommended fields
  const enhancement = recommendations.filter(r => r.priority === 'recommended');
  if (enhancement.length > 0) {
    phaseMap.push({
      phase: 'Enhancement',
      fields: enhancement.map(r => r.field.displayName),
      durationDays: Math.ceil((enhancement.reduce((sum, r) => sum + r.field.effortMinutes, 0) / 60) * 3),
    });
  }

  // Optimization: optional fields
  const optimization = recommendations.filter(r => r.priority === 'optional');
  if (optimization.length > 0) {
    phaseMap.push({
      phase: 'Optimization',
      fields: optimization.map(r => r.field.displayName),
      durationDays: Math.ceil((optimization.reduce((sum, r) => sum + r.field.effortMinutes, 0) / 60) * 5),
    });
  }

  return {
    useCase,
    vertical: vertical || 'All',
    recommendedFields: recommendations.map(r => ({
      fieldId: r.field.id,
      displayName: r.field.displayName,
      priority: r.priority,
      reason: r.reason,
      automationStrategy: r.field.automationStrategy,
      effortMinutes: r.field.effortMinutes,
    })),
    automatedImplementation: automated,
    manualImplementation: manual,
    phaseMap,
    totalEffortHours: totalEffort / 60,
  };
}

// ============================================
// EXPORT MATRICES (ALL USE CASES × VERTICALS)
// ============================================

export const ALL_USE_CASES: UseCase[] = [
  'Data Discovery',
  'Trusted Metrics',
  'Compliance',
  'Root Cause Analysis',
  'Impact Analysis',
  'Data Compliance',
  'Data Products',
  'Cost Optimization',
  'Lifecycle Management',
  'Metrics Catalog',
];

export const ALL_VERTICALS = [
  'Manufacturing/HVAC',
  'Technology',
  'Retail/E-commerce',
  'Financial Services',
  'Healthcare',
  'Media/Entertainment',
  'Telecommunications',
];

/**
 * Generate full matrix for all use cases and verticals
 */
export function generateFullMatrix(): {
  useCaseMatrices: Map<UseCase, UseCaseCustomFieldsMatrix>;
  verticalMatrices: Map<string, VerticalCustomFieldsMatrix>;
  combinedMatrices: Map<string, CombinedCustomFieldsMatrix>;
} {
  const useCaseMatrices = new Map<UseCase, UseCaseCustomFieldsMatrix>();
  const verticalMatrices = new Map<string, VerticalCustomFieldsMatrix>();
  const combinedMatrices = new Map<string, CombinedCustomFieldsMatrix>();

  // Generate use case matrices
  ALL_USE_CASES.forEach(uc => {
    useCaseMatrices.set(uc, generateUseCaseMatrix(uc));
  });

  // Generate vertical matrices
  ALL_VERTICALS.forEach(v => {
    verticalMatrices.set(v, generateVerticalMatrix(v));
  });

  // Generate combined matrices (sample: top use cases × top verticals)
  const topCombos: Array<[UseCase, string]> = [
    ['Data Discovery', 'Retail/E-commerce'],
    ['Trusted Metrics', 'Financial Services'],
    ['Compliance', 'Healthcare'],
    ['Data Products', 'Technology'],
    ['Lifecycle Management', 'Manufacturing/HVAC'],
  ];

  topCombos.forEach(([uc, v]) => {
    const key = `${uc}|${v}`;
    combinedMatrices.set(key, generateCombinedMatrix(uc, v));
  });

  return { useCaseMatrices, verticalMatrices, combinedMatrices };
}

/**
 * Generate summary report for custom fields implementation
 */
export function generateCustomFieldsSummary() {
  const fullMatrix = generateFullMatrix();

  return {
    totalCustomFields: CUSTOM_FIELDS_LIBRARY.length,
    byStrategy: {
      manual: CUSTOM_FIELDS_LIBRARY.filter(f => f.automationStrategy === 'manual').length,
      automation: CUSTOM_FIELDS_LIBRARY.filter(f => f.automationStrategy === 'automation').length,
      hybrid: CUSTOM_FIELDS_LIBRARY.filter(f => f.automationStrategy === 'hybrid').length,
    },
    useCaseCount: fullMatrix.useCaseMatrices.size,
    verticalCount: fullMatrix.verticalMatrices.size,
    averageFieldsPerUseCase: Array.from(fullMatrix.useCaseMatrices.values()).reduce(
      (sum, m) => sum + m.recommendedFields.length,
      0
    ) / fullMatrix.useCaseMatrices.size,
    estimatedTotalEffortHours: Array.from(fullMatrix.useCaseMatrices.values()).reduce(
      (sum, m) => sum + m.totalEffortHours,
      0
    ),
  };
}
