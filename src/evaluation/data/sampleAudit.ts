// Sample audit data for demonstration
import type { FieldCoverage, AuditResult } from '../types/priority';

export const SAMPLE_FIELD_COVERAGE: FieldCoverage[] = [
  {
    field: 'ownerUsers',
    totalAssets: 12500,
    populatedAssets: 4375,
    coveragePercent: 0.35,
    trend: { previousPercent: 0.28, changePercent: 7, direction: 'up', periodDays: 30 },
  },
  {
    field: 'ownerGroups',
    totalAssets: 12500,
    populatedAssets: 2500,
    coveragePercent: 0.20,
    trend: { previousPercent: 0.18, changePercent: 2, direction: 'up', periodDays: 30 },
  },
  {
    field: 'description',
    totalAssets: 12500,
    populatedAssets: 3125,
    coveragePercent: 0.25,
    trend: { previousPercent: 0.22, changePercent: 3, direction: 'up', periodDays: 30 },
  },
  {
    field: 'userDescription',
    totalAssets: 12500,
    populatedAssets: 625,
    coveragePercent: 0.05,
  },
  {
    field: 'readme',
    totalAssets: 12500,
    populatedAssets: 250,
    coveragePercent: 0.02,
  },
  {
    field: 'atlanTags',
    totalAssets: 12500,
    populatedAssets: 1875,
    coveragePercent: 0.15,
    trend: { previousPercent: 0.12, changePercent: 3, direction: 'up', periodDays: 30 },
  },
  {
    field: 'certificateStatus',
    totalAssets: 12500,
    populatedAssets: 2500,
    coveragePercent: 0.20,
  },
  {
    field: 'glossaryTerms',
    totalAssets: 12500,
    populatedAssets: 625,
    coveragePercent: 0.05,
    trend: { previousPercent: 0.08, changePercent: -3, direction: 'down', periodDays: 30 },
  },
  {
    field: 'lineage',
    totalAssets: 12500,
    populatedAssets: 5000,
    coveragePercent: 0.40,
    trend: { previousPercent: 0.35, changePercent: 5, direction: 'up', periodDays: 30 },
  },
  {
    field: 'accessPolicies',
    totalAssets: 12500,
    populatedAssets: 1250,
    coveragePercent: 0.10,
  },
  {
    field: 'customMetadata',
    totalAssets: 12500,
    populatedAssets: 3750,
    coveragePercent: 0.30,
  },
  {
    field: 'starredBy',
    totalAssets: 12500,
    populatedAssets: 875,
    coveragePercent: 0.07,
  },
  {
    field: 'links',
    totalAssets: 12500,
    populatedAssets: 500,
    coveragePercent: 0.04,
  },
];

export const SAMPLE_AUDIT_RESULT: AuditResult = {
  timestamp: new Date(),
  tenantId: 'demo-tenant',
  summary: {
    totalAssets: 12500,
    assetsWithOwner: 4375,
    assetsWithDescription: 3125,
    assetsWithTags: 1875,
    assetsWithGlossary: 625,
    assetsWithLineage: 5000,
    overallCompletenessScore: 42,
  },
  fieldCoverage: SAMPLE_FIELD_COVERAGE,
  assetBreakdown: [
    { assetType: 'Table', count: 5000, avgCompleteness: 45 },
    { assetType: 'Column', count: 4500, avgCompleteness: 35 },
    { assetType: 'Dashboard', count: 1500, avgCompleteness: 55 },
    { assetType: 'View', count: 1000, avgCompleteness: 40 },
    { assetType: 'Schema', count: 500, avgCompleteness: 60 },
  ],
};
