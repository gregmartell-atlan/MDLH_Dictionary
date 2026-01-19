/**
 * Plan Comparison Engine
 *
 * Compares Enrichment Plan requirements against actual Atlan asset metadata
 * to identify gaps, coverage, and data quality issues
 */

import type { EnrichmentPlan, EnrichmentPlanRequirement } from '../types/enrichment-plan';
import type { AtlanAssetSummary } from '../services/atlanApi';

// ============================================
// TYPES
// ============================================

export interface FieldComparisonResult {
  requirementId: string;
  fieldName: string;
  fieldType: string;
  assetGuid: string;
  assetName: string;
  currentValue?: unknown;
  isEmpty: boolean;
  status: 'complete' | 'partial' | 'missing';
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface AssetComparisonSummary {
  assetGuid: string;
  assetName: string;
  assetType: string;
  totalRequirements: number;
  completedCount: number;
  partialCount: number;
  missingCount: number;
  completionPercentage: number;
  qualityScore: number; // 0-100
  fieldResults: FieldComparisonResult[];
}

export interface PlanComparisonResult {
  planId: string;
  planTitle: string;
  comparisonTimestamp: string;
  totalAssets: number;
  assetSummaries: AssetComparisonSummary[];
  aggregateMetrics: {
    totalRequirements: number;
    averageCompletion: number;
    completedAssets: number;
    partialAssets: number;
    incompleteAssets: number;
    overallQualityScore: number;
    gapsByField: Record<string, { total: number; missing: number; coverage: number }>;
  };
}

// ============================================
// FIELD VALUE CHECKERS
// ============================================

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function getFieldValue(asset: AtlanAssetSummary, fieldName: string): unknown {
  const attributes = asset.attributes || {};

  // Handle nested fields like "businessAttributes.SetName.FieldName"
  if (fieldName.includes('.')) {
    const parts = fieldName.split('.');
    let current: any = attributes;
    for (const part of parts) {
      current = current?.[part];
    }
    return current;
  }

  return attributes[fieldName as keyof typeof attributes];
}

function evaluateFieldCompletion(
  asset: AtlanAssetSummary,
  requirement: EnrichmentPlanRequirement
): FieldComparisonResult {
  const fieldValue = getFieldValue(asset, requirement.fieldType);
  const isEmpty = !hasValue(fieldValue);

  let status: 'complete' | 'partial' | 'missing' = 'missing';
  let severity: 'error' | 'warning' | 'info' = 'error';
  let message = `Missing required field: ${requirement.fieldType}`;

  if (!isEmpty) {
    status = 'complete';
    severity = 'info';
    message = `${requirement.fieldType} is populated`;
  } else {
    severity = requirement.statusType === 'required' ? 'error' : 'warning';
  }

  return {
    requirementId: requirement.id,
    fieldName: requirement.fieldType,
    fieldType: 'string', // Defaulting to string as dataType is not in requirement
    assetGuid: asset.guid,
    assetName: asset.name,
    currentValue: !isEmpty ? fieldValue : undefined,
    isEmpty,
    status,
    severity,
    message,
  };
}

// ============================================
// COMPARISON FUNCTIONS
// ============================================

export function compareAssetToPlan(
  asset: AtlanAssetSummary,
  plan: EnrichmentPlan
): AssetComparisonSummary {
  // Only compare against requirements that match this asset's type
  const applicableRequirements = plan.requirements.filter(req => {
    if (!req.assetScope?.assetTypes || req.assetScope.assetTypes.length === 0) {
      return true; // Applies to all types
    }
    return req.assetScope.assetTypes.includes(asset.typeName);
  });

  const fieldResults = applicableRequirements.map((req) =>
    evaluateFieldCompletion(asset, req)
  );

  // Calculate metrics
  const completedCount = fieldResults.filter((r) => r.status === 'complete').length;
  const partialCount = fieldResults.filter((r) => r.status === 'partial').length;
  const missingCount = fieldResults.filter((r) => r.status === 'missing').length;

  const completionPercentage =
    applicableRequirements.length > 0
      ? Math.round(
          ((completedCount + partialCount * 0.5) / applicableRequirements.length) * 100
        )
      : 100;

  // Quality score: weighted by severity
  const qualityScore = Math.max(
    0,
    100 -
      (missingCount * 10 + partialCount * 5) // Penalties for incomplete fields
  );

  return {
    assetGuid: asset.guid,
    assetName: asset.name,
    assetType: asset.typeName,
    totalRequirements: applicableRequirements.length,
    completedCount,
    partialCount,
    missingCount,
    completionPercentage,
    qualityScore,
    fieldResults,
  };
}

export function comparePlanToAssets(
  plan: EnrichmentPlan,
  assets: AtlanAssetSummary[]
): PlanComparisonResult {
  const assetSummaries = assets.map((asset) => compareAssetToPlan(asset, plan));

  // Calculate aggregate metrics
  const totalRequirements = plan.requirements.length;
  const completedAssets = assetSummaries.filter(
    (a) => a.completionPercentage === 100
  ).length;
  const partialAssets = assetSummaries.filter(
    (a) => a.completionPercentage > 0 && a.completionPercentage < 100
  ).length;
  const incompleteAssets = assetSummaries.filter(
    (a) => a.completionPercentage === 0
  ).length;

  const averageCompletion =
    assetSummaries.length > 0
      ? Math.round(
          assetSummaries.reduce((sum, a) => sum + a.completionPercentage, 0) /
            assetSummaries.length
        )
      : 0;

  const overallQualityScore =
    assetSummaries.length > 0
      ? Math.round(
          assetSummaries.reduce((sum, a) => sum + a.qualityScore, 0) /
            assetSummaries.length
        )
      : 0;

  // Gaps by field
  const gapsByField: Record<string, { total: number; missing: number; coverage: number }> = {};

  for (const requirement of plan.requirements) {
    const results = assetSummaries.flatMap((a) => a.fieldResults);
    const reqResults = results.filter((r) => r.requirementId === requirement.id);
    const missingCount = reqResults.filter((r) => r.status === 'missing').length;

    gapsByField[requirement.fieldType] = {
      total: reqResults.length,
      missing: missingCount,
      coverage: reqResults.length > 0 ? Math.round(((reqResults.length - missingCount) / reqResults.length) * 100) : 0,
    };
  }

  return {
    planId: plan.id,
    planTitle: plan.name,
    comparisonTimestamp: new Date().toISOString(),
    totalAssets: assets.length,
    assetSummaries,
    aggregateMetrics: {
      totalRequirements,
      averageCompletion,
      completedAssets,
      partialAssets,
      incompleteAssets,
      overallQualityScore,
      gapsByField,
    },
  };
}
