/**
 * Requirements Matrix Types
 *
 * Types for defining metadata requirements by asset type,
 * domain, and certification level.
 */

import type { MetadataFieldType, RequirementType } from './metadata-fields';

// ============================================
// REQUIREMENTS MATRIX TYPES
// ============================================

export type AssetType =
  | 'Table'
  | 'View'
  | 'Column'
  | 'Database'
  | 'Schema'
  | 'Dashboard'
  | 'Report'
  | 'Chart'
  | 'Dataset'
  | 'Query'
  | 'Process'
  | 'Pipeline'
  | 'Model'
  | 'Notebook';

export type CertificationLevel = 'bronze' | 'silver' | 'gold' | 'none';

export type PlanStatus = 'draft' | 'in-review' | 'approved' | 'in-progress' | 'paused' | 'completed' | 'archived' | 'active';

export interface RequirementsMatrix {
  id: string;
  name: string;
  description: string;
  status: PlanStatus;
  owner?: string;
  targetDate?: string;
  assetTypeRequirements: AssetTypeRequirements[];
  domainOverrides: DomainOverride[];
  connectorOverrides: ConnectorOverride[];
  certificationRules: CertificationRule[];
  conditionalRules: ConditionalRule[];
}

export interface AssetTypeRequirements {
  assetType: AssetType;
  requirements: FieldRequirement[];
}

export interface FieldRequirement {
  field: MetadataFieldType | string;
  requirement: RequirementType;
  condition?: string;
  validationRule?: string;
  helpText?: string;
  inheritFrom?: AssetType;
}

export interface DomainOverride {
  domainId: string;
  domainName: string;
  overrides: {
    assetType: AssetType;
    field: MetadataFieldType | string;
    requirement: RequirementType;
    reason: string;
  }[];
}

export interface ConnectorOverride {
  connectorName: string; // e.g., "snowflake", "dbt"
  overrides: {
    assetType: AssetType;
    field: MetadataFieldType | string;
    requirement: RequirementType;
    reason: string;
  }[];
}

export interface CertificationRule {
  level: CertificationLevel;
  displayName: string;
  description: string;
  color: string;
  icon: string;
  requirements: FieldRequirement[];
  benefits: string[];
  assetTypes: AssetType[];
}

export interface ConditionalRule {
  id: string;
  name: string;
  description: string;
  condition: ConditionalExpression;
  thenRequire: FieldRequirement[];
}

export interface ConditionalExpression {
  type: 'tag' | 'field' | 'assetType' | 'domain' | 'and' | 'or';
  value?: string;
  operator?: 'equals' | 'contains' | 'exists' | 'notExists';
  children?: ConditionalExpression[];
}

// ============================================
// DEFAULT REQUIREMENTS
// ============================================

export const DEFAULT_ASSET_REQUIREMENTS: AssetTypeRequirements[] = [
  {
    assetType: 'Table',
    requirements: [
      { field: 'ownerUsers', requirement: 'required', helpText: 'Every table needs an owner' },
      { field: 'description', requirement: 'required', helpText: 'Describe the purpose and contents' },
      { field: 'atlanTags', requirement: 'recommended', helpText: 'Classify for compliance' },
      { field: 'glossaryTerms', requirement: 'recommended', helpText: 'Link to business definitions' },
      { field: 'certificateStatus', requirement: 'optional' },
      { field: 'lineage', requirement: 'optional', helpText: 'Usually auto-populated' },
      { field: 'readme', requirement: 'optional', helpText: 'For complex tables' },
    ],
  },
  {
    assetType: 'Column',
    requirements: [
      { field: 'ownerUsers', requirement: 'not-applicable', inheritFrom: 'Table' },
      { field: 'description', requirement: 'recommended', helpText: 'Explain what this column contains' },
      { field: 'atlanTags', requirement: 'required', condition: 'if contains PII', helpText: 'Classify PII columns' },
      { field: 'glossaryTerms', requirement: 'recommended', helpText: 'Link to business term' },
      { field: 'certificateStatus', requirement: 'not-applicable' },
      { field: 'lineage', requirement: 'not-applicable', helpText: 'Inherited from table' },
    ],
  },
  {
    assetType: 'View',
    requirements: [
      { field: 'ownerUsers', requirement: 'recommended', helpText: 'Often inherits from source' },
      { field: 'description', requirement: 'recommended', helpText: 'Explain the view logic' },
      { field: 'atlanTags', requirement: 'optional' },
      { field: 'glossaryTerms', requirement: 'optional' },
      { field: 'certificateStatus', requirement: 'optional' },
      { field: 'lineage', requirement: 'optional', helpText: 'Usually auto-populated' },
    ],
  },
  {
    assetType: 'Dashboard',
    requirements: [
      { field: 'ownerUsers', requirement: 'required', helpText: 'Who maintains this dashboard?' },
      { field: 'description', requirement: 'required', helpText: 'What questions does it answer?' },
      { field: 'atlanTags', requirement: 'optional' },
      { field: 'glossaryTerms', requirement: 'required', helpText: 'Link to KPI definitions' },
      { field: 'certificateStatus', requirement: 'required', helpText: 'Is this official?' },
      { field: 'lineage', requirement: 'required', helpText: 'Must know data sources' },
      { field: 'readme', requirement: 'recommended', helpText: 'Usage guide for consumers' },
    ],
  },
  {
    assetType: 'Report',
    requirements: [
      { field: 'ownerUsers', requirement: 'required' },
      { field: 'description', requirement: 'required' },
      { field: 'glossaryTerms', requirement: 'required' },
      { field: 'certificateStatus', requirement: 'recommended' },
      { field: 'lineage', requirement: 'recommended' },
    ],
  },
  {
    assetType: 'Database',
    requirements: [
      { field: 'ownerUsers', requirement: 'required', helpText: 'DBA or data team owner' },
      { field: 'description', requirement: 'required', helpText: 'Purpose of this database' },
      { field: 'atlanTags', requirement: 'optional' },
    ],
  },
  {
    assetType: 'Schema',
    requirements: [
      { field: 'ownerUsers', requirement: 'recommended' },
      { field: 'description', requirement: 'recommended' },
      { field: 'atlanTags', requirement: 'optional' },
    ],
  },
  {
    assetType: 'Pipeline',
    requirements: [
      { field: 'ownerUsers', requirement: 'required', helpText: 'Who to contact when it fails?' },
      { field: 'description', requirement: 'required', helpText: 'What does this pipeline do?' },
      { field: 'lineage', requirement: 'required', helpText: 'Must show data flow' },
      { field: 'links', requirement: 'recommended', helpText: 'Link to runbook' },
    ],
  },
];

// ============================================
// CERTIFICATION RULES
// ============================================

export const DEFAULT_CERTIFICATION_RULES: CertificationRule[] = [
  {
    level: 'bronze',
    displayName: 'Bronze',
    description: 'Basic metadata for discoverability',
    color: '#CD7F32',
    icon: 'shield',
    assetTypes: ['Table', 'View', 'Dashboard'],
    requirements: [
      { field: 'ownerUsers', requirement: 'required' },
      { field: 'description', requirement: 'required' },
    ],
    benefits: [
      'Appears in search results',
      'Basic contact information available',
    ],
  },
  {
    level: 'silver',
    displayName: 'Silver',
    description: 'Trusted for team use',
    color: '#C0C0C0',
    icon: 'shield-check',
    assetTypes: ['Table', 'View', 'Dashboard'],
    requirements: [
      { field: 'ownerUsers', requirement: 'required' },
      { field: 'description', requirement: 'required' },
      { field: 'glossaryTerms', requirement: 'required' },
      { field: 'atlanTags', requirement: 'required' },
    ],
    benefits: [
      'Recommended in search',
      'Linked to business glossary',
      'Classified for compliance',
    ],
  },
  {
    level: 'gold',
    displayName: 'Gold',
    description: 'Official source of truth',
    color: '#FFD700',
    icon: 'award',
    assetTypes: ['Table', 'View', 'Dashboard'],
    requirements: [
      { field: 'ownerUsers', requirement: 'required' },
      { field: 'description', requirement: 'required' },
      { field: 'glossaryTerms', requirement: 'required' },
      { field: 'atlanTags', requirement: 'required' },
      { field: 'lineage', requirement: 'required' },
      { field: 'readme', requirement: 'required' },
    ],
    benefits: [
      'Prioritized in search',
      'Full documentation',
      'Lineage verified',
      'Safe for executive reporting',
    ],
  },
];

// ============================================
// CONDITIONAL RULES EXAMPLES
// ============================================

export const DEFAULT_CONDITIONAL_RULES: ConditionalRule[] = [
  {
    id: 'pii-classification',
    name: 'PII Classification Required',
    description: 'Columns with PII patterns must be classified',
    condition: {
      type: 'and',
      children: [
        { type: 'assetType', value: 'Column', operator: 'equals' },
        { type: 'field', value: 'name', operator: 'contains' },
      ],
    },
    thenRequire: [
      { field: 'atlanTags', requirement: 'required', helpText: 'PII must be classified' },
    ],
  },
  {
    id: 'dashboard-glossary',
    name: 'Dashboard Glossary Terms',
    description: 'Certified dashboards must link to glossary',
    condition: {
      type: 'and',
      children: [
        { type: 'assetType', value: 'Dashboard', operator: 'equals' },
        { type: 'field', value: 'certificateStatus', operator: 'exists' },
      ],
    },
    thenRequire: [
      { field: 'glossaryTerms', requirement: 'required', helpText: 'Link KPIs to definitions' },
    ],
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getRequirementsForAssetType(
  matrix: RequirementsMatrix,
  assetType: AssetType
): FieldRequirement[] {
  const assetReqs = matrix.assetTypeRequirements.find(r => r.assetType === assetType);
  return assetReqs?.requirements || [];
}

export function getRequirementLevel(
  matrix: RequirementsMatrix,
  assetType: AssetType,
  field: MetadataFieldType | string
): RequirementType {
  const reqs = getRequirementsForAssetType(matrix, assetType);
  const fieldReq = reqs.find(r => r.field === field);
  return fieldReq?.requirement || 'optional';
}

export function getCertificationRequirements(
  level: CertificationLevel
): FieldRequirement[] {
  const rule = DEFAULT_CERTIFICATION_RULES.find(r => r.level === level);
  return rule?.requirements || [];
}

export function checkCertificationEligibility(
  populatedFields: (MetadataFieldType | string)[],
  level: CertificationLevel
): { eligible: boolean; missingFields: string[] } {
  const requirements = getCertificationRequirements(level);
  const requiredFields = requirements
    .filter(r => r.requirement === 'required')
    .map(r => r.field);

  const missingFields = requiredFields.filter(f => !populatedFields.includes(f));

  return {
    eligible: missingFields.length === 0,
    missingFields,
  };
}

export function createDefaultMatrix(): RequirementsMatrix {
  return {
    id: 'default',
    name: 'Default Requirements Matrix',
    description: 'Standard metadata requirements by asset type',
    status: 'draft',
    assetTypeRequirements: DEFAULT_ASSET_REQUIREMENTS,
    domainOverrides: [],
    connectorOverrides: [],
    certificationRules: DEFAULT_CERTIFICATION_RULES,
    conditionalRules: DEFAULT_CONDITIONAL_RULES,
  };
}
