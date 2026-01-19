/**
 * Metadata Field Types and Configuration
 *
 * Core definitions for metadata fields, weights, effort estimates,
 * and priority scoring.
 */

// ============================================
// ENUMS & CONSTANTS
// ============================================

export type PriorityLevel = 'P0' | 'P1' | 'P2' | 'P3';
export type Effort = 'low' | 'medium' | 'high';
export type RequirementType = 'required' | 'recommended' | 'optional' | 'not-applicable';

export type MetadataFieldType =
  | 'ownerUsers'
  | 'ownerGroups'
  | 'description'
  | 'userDescription'
  | 'readme'
  | 'atlanTags'
  | 'certificateStatus'
  | 'glossaryTerms'
  | 'lineage'
  | 'accessPolicies'
  | 'customMetadata'
  | 'starredBy'
  | 'links'
  // Compliance Info
  | 'compliance_retention'
  | 'compliance_legal_hold'
  | 'compliance_country'
  // Data Product Info
  | 'product_sla'
  | 'product_tier'
  | 'product_cost'
  | 'product_refresh_rate'
  | 'product_usage'
  | 'product_rating'
  | 'product_quality_score'
  | 'product_lifecycle'
  // Data Quality Info
  | 'dq_freshness'
  | 'dq_completeness'
  | 'dq_owner'
  // Operational Info
  | 'ops_on_call'
  | 'ops_runbook'
  | 'ops_slack';

export type PatternType =
  | 'quick-discovery'
  | 'trusted-metrics'
  | 'compliance-ready'
  | 'root-cause-analysis'
  | 'data-product'
  | 'custom';

export type PersonaType =
  | 'data-steward'
  | 'data-engineer'
  | 'analyst'
  | 'executive'
  | 'all';

// ============================================
// FIELD METADATA
// ============================================

export interface MetadataFieldInfo {
  id: MetadataFieldType;
  displayName: string;
  description: string;
  purpose: string;
  whenNeeded: string;
  weight: number;
  effort: Effort;
  effortMinutes: number;
  autoPopulated: boolean;
  bulkAssignable: boolean;
}

export const METADATA_FIELDS: MetadataFieldInfo[] = [
  {
    id: 'ownerUsers',
    displayName: 'Owner (Users)',
    description: 'Individual user(s) accountable for the asset',
    purpose: 'Accountability and contact point',
    whenNeeded: 'Always - foundational for governance',
    weight: 30,
    effort: 'low',
    effortMinutes: 2,
    autoPopulated: false,
    bulkAssignable: true,
  },
  {
    id: 'ownerGroups',
    displayName: 'Owner (Groups)',
    description: 'Team or group accountable for the asset',
    purpose: 'Team-level accountability',
    whenNeeded: 'When ownership is shared across a team',
    weight: 15,
    effort: 'low',
    effortMinutes: 2,
    autoPopulated: false,
    bulkAssignable: true,
  },
  {
    id: 'description',
    displayName: 'Description',
    description: 'Human-readable explanation of the asset',
    purpose: 'Understanding what the data contains',
    whenNeeded: 'Discovery use cases, onboarding',
    weight: 20,
    effort: 'medium',
    effortMinutes: 4,
    autoPopulated: false,
    bulkAssignable: false,
  },
  {
    id: 'userDescription',
    displayName: 'User Description',
    description: 'Crowdsourced descriptions from data consumers',
    purpose: 'Community knowledge capture',
    whenNeeded: 'Self-service environments',
    weight: 10,
    effort: 'low',
    effortMinutes: 2,
    autoPopulated: false,
    bulkAssignable: false,
  },
  {
    id: 'readme',
    displayName: 'README',
    description: 'Long-form documentation with formatting',
    purpose: 'Detailed context, usage examples, caveats',
    whenNeeded: 'Data products, complex assets',
    weight: 5,
    effort: 'high',
    effortMinutes: 15,
    autoPopulated: false,
    bulkAssignable: false,
  },
  {
    id: 'atlanTags',
    displayName: 'Classifications',
    description: 'Tags for categorization and policy enforcement',
    purpose: 'Classification, access control, compliance',
    whenNeeded: 'Compliance, access control, PII detection',
    weight: 25,
    effort: 'medium',
    effortMinutes: 3,
    autoPopulated: true, // Can be auto-detected
    bulkAssignable: true,
  },
  {
    id: 'certificateStatus',
    displayName: 'Certificate',
    description: 'Trust level indicator (Draft, Verified, Deprecated)',
    purpose: 'Signal trustworthiness to consumers',
    whenNeeded: 'Self-service analytics, data marketplace',
    weight: 25,
    effort: 'low',
    effortMinutes: 1,
    autoPopulated: false,
    bulkAssignable: true,
  },
  {
    id: 'glossaryTerms',
    displayName: 'Glossary Terms',
    description: 'Links to business glossary definitions',
    purpose: 'Standardize terminology, link to business meaning',
    whenNeeded: 'Metric consistency, business alignment',
    weight: 15,
    effort: 'medium',
    effortMinutes: 4,
    autoPopulated: false,
    bulkAssignable: false,
  },
  {
    id: 'lineage',
    displayName: 'Lineage',
    description: 'Data flow connections (upstream/downstream)',
    purpose: 'Impact analysis, root cause debugging',
    whenNeeded: 'Debugging, compliance, change management',
    weight: 10,
    effort: 'high',
    effortMinutes: 10,
    autoPopulated: true, // Usually from connectors
    bulkAssignable: false,
  },
  {
    id: 'accessPolicies',
    displayName: 'Access Policies',
    description: 'Who can access and what they can do',
    purpose: 'Security and compliance enforcement',
    whenNeeded: 'Regulated industries, sensitive data',
    weight: 10,
    effort: 'high',
    effortMinutes: 8,
    autoPopulated: false,
    bulkAssignable: true,
  },
  {
    id: 'customMetadata',
    displayName: 'Custom Metadata',
    description: 'Organization-specific attributes',
    purpose: 'Business context not covered by standard fields',
    whenNeeded: 'Domain-specific needs, SLAs, cost tracking',
    weight: 5,
    effort: 'medium',
    effortMinutes: 4,
    autoPopulated: false,
    bulkAssignable: true,
  },
  {
    id: 'starredBy',
    displayName: 'Starred',
    description: 'User favorites/bookmarks',
    purpose: 'Social proof, popular assets',
    whenNeeded: 'Discovery, recommendations',
    weight: 2,
    effort: 'low',
    effortMinutes: 0, // User-driven
    autoPopulated: true,
    bulkAssignable: false,
  },
  {
    id: 'links',
    displayName: 'Links',
    description: 'External references (runbooks, wikis, etc.)',
    purpose: 'Connect to external documentation',
    whenNeeded: 'Operational context, runbooks',
    weight: 3,
    effort: 'low',
    effortMinutes: 2,
    autoPopulated: false,
    bulkAssignable: false,
  },
  // Compliance Info
  {
    id: 'compliance_retention',
    displayName: 'Retention Period',
    description: 'Data retention policy duration',
    purpose: 'Compliance with data privacy laws',
    whenNeeded: 'PII data, regulated datasets',
    weight: 10,
    effort: 'low',
    effortMinutes: 2,
    autoPopulated: false,
    bulkAssignable: true,
  },
  {
    id: 'compliance_legal_hold',
    displayName: 'Legal Hold',
    description: 'Whether data is under legal hold',
    purpose: 'Prevent deletion during litigation',
    whenNeeded: 'Legal proceedings',
    weight: 10,
    effort: 'low',
    effortMinutes: 1,
    autoPopulated: false,
    bulkAssignable: true,
  },
  {
    id: 'compliance_country',
    displayName: 'Data Source Country',
    description: 'Country of origin for the data',
    purpose: 'Data sovereignty compliance',
    whenNeeded: 'Cross-border data flows',
    weight: 5,
    effort: 'low',
    effortMinutes: 1,
    autoPopulated: false,
    bulkAssignable: true,
  },
  // Data Product Info
  {
    id: 'product_sla',
    displayName: 'SLA',
    description: 'Service Level Agreement',
    purpose: 'Define expected availability/performance',
    whenNeeded: 'Data products, critical assets',
    weight: 8,
    effort: 'medium',
    effortMinutes: 5,
    autoPopulated: false,
    bulkAssignable: true,
  },
  {
    id: 'product_refresh_rate',
    displayName: 'Refresh Frequency',
    description: 'How often data is updated',
    purpose: 'Set freshness expectations',
    whenNeeded: 'Dashboards, reporting',
    weight: 5,
    effort: 'low',
    effortMinutes: 2,
    autoPopulated: true,
    bulkAssignable: true,
  },
  {
    id: 'product_cost',
    displayName: 'Cost Center',
    description: 'Department responsible for costs',
    purpose: 'Cost allocation and tracking',
    whenNeeded: 'Budgeting, chargeback',
    weight: 5,
    effort: 'low',
    effortMinutes: 1,
    autoPopulated: false,
    bulkAssignable: true,
  },
  // Data Quality Info
  {
    id: 'dq_freshness',
    displayName: 'Freshness SLA',
    description: 'Maximum allowed data lag',
    purpose: 'Monitor data timeliness',
    whenNeeded: 'Real-time analytics',
    weight: 8,
    effort: 'medium',
    effortMinutes: 5,
    autoPopulated: false,
    bulkAssignable: true,
  },
  {
    id: 'dq_completeness',
    displayName: 'Completeness Threshold',
    description: 'Minimum required data completeness %',
    purpose: 'Ensure data quality standards',
    whenNeeded: 'Critical reporting',
    weight: 8,
    effort: 'medium',
    effortMinutes: 5,
    autoPopulated: false,
    bulkAssignable: true,
  },
  {
    id: 'dq_owner',
    displayName: 'DQ Owner',
    description: 'Person responsible for data quality',
    purpose: 'Accountability for DQ issues',
    whenNeeded: 'When different from asset owner',
    weight: 5,
    effort: 'low',
    effortMinutes: 2,
    autoPopulated: false,
    bulkAssignable: true,
  },
  // Operational Info
  {
    id: 'ops_on_call',
    displayName: 'On-Call Team',
    description: 'Team to contact for urgent issues',
    purpose: 'Incident response',
    whenNeeded: 'Critical pipelines',
    weight: 8,
    effort: 'low',
    effortMinutes: 2,
    autoPopulated: false,
    bulkAssignable: true,
  },
  {
    id: 'ops_runbook',
    displayName: 'Runbook URL',
    description: 'Link to operational runbook',
    purpose: 'Guide for incident resolution',
    whenNeeded: 'Production assets',
    weight: 5,
    effort: 'low',
    effortMinutes: 2,
    autoPopulated: false,
    bulkAssignable: true,
  },
  {
    id: 'ops_slack',
    displayName: 'Slack Channel',
    description: 'Communication channel for this asset',
    purpose: 'Team collaboration',
    whenNeeded: 'Shared assets',
    weight: 3,
    effort: 'low',
    effortMinutes: 1,
    autoPopulated: false,
    bulkAssignable: true,
  },
];

// ============================================
// COMPLETENESS WEIGHTS
// ============================================

export const COMPLETENESS_WEIGHTS: Record<MetadataFieldType, number> = {
  ownerUsers: 30,
  ownerGroups: 15,
  description: 20,
  userDescription: 10,
  readme: 5,
  atlanTags: 25,
  certificateStatus: 25,
  glossaryTerms: 15,
  lineage: 10,
  accessPolicies: 10,
  customMetadata: 5,
  starredBy: 2,
  links: 3,
  // Compliance
  compliance_retention: 10,
  compliance_legal_hold: 10,
  compliance_country: 5,
  // Product
  product_sla: 8,
  product_refresh_rate: 5,
  product_tier: 5,
  product_usage: 5,
  product_rating: 3,
  product_quality_score: 8,
  product_lifecycle: 5,
  product_cost: 5,
  // DQ
  dq_freshness: 8,
  dq_completeness: 8,
  dq_owner: 5,
  // Ops
  ops_on_call: 8,
  ops_runbook: 5,
  ops_slack: 3,
};

// ============================================
// EFFORT ESTIMATES
// ============================================

export const EFFORT_ESTIMATES: Record<MetadataFieldType, Effort> = {
  ownerUsers: 'low',
  ownerGroups: 'low',
  description: 'medium',
  userDescription: 'low',
  readme: 'high',
  atlanTags: 'medium',
  certificateStatus: 'low',
  glossaryTerms: 'medium',
  lineage: 'high',
  accessPolicies: 'high',
  customMetadata: 'medium',
  starredBy: 'low',
  links: 'low',
  // Compliance
  compliance_retention: 'low',
  compliance_legal_hold: 'low',
  compliance_country: 'low',
  // Product
  product_sla: 'medium',
  product_refresh_rate: 'low',
  product_tier: 'low',
  product_usage: 'medium',
  product_rating: 'low',
  product_quality_score: 'high',
  product_lifecycle: 'medium',
  product_cost: 'low',
  // DQ
  dq_freshness: 'medium',
  dq_completeness: 'medium',
  dq_owner: 'low',
  // Ops
  ops_on_call: 'low',
  ops_runbook: 'low',
  ops_slack: 'low',
};

export const EFFORT_MINUTES: Record<Effort, number> = {
  low: 2,
  medium: 4,
  high: 10,
};

// ============================================
// PRIORITY BADGE CONFIG
// ============================================

export interface PriorityBadgeConfig {
  level: PriorityLevel;
  badge: string;
  label: string;
  color: string;
  bgColor: string;
  minScore: number;
}

export const PRIORITY_BADGE_CONFIG: PriorityBadgeConfig[] = [
  { level: 'P0', badge: '', label: 'Critical', color: '#DC2626', bgColor: '#FEE2E2', minScore: 70 },
  { level: 'P1', badge: '', label: 'High', color: '#EA580C', bgColor: '#FFEDD5', minScore: 50 },
  { level: 'P2', badge: '', label: 'Medium', color: '#CA8A04', bgColor: '#FEF9C3', minScore: 30 },
  { level: 'P3', badge: '', label: 'Low', color: '#6B7280', bgColor: '#F3F4F6', minScore: 0 },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getFieldInfo(field: MetadataFieldType): MetadataFieldInfo | undefined {
  return METADATA_FIELDS.find(f => f.id === field);
}

export function getPriorityConfig(level: PriorityLevel): PriorityBadgeConfig {
  return PRIORITY_BADGE_CONFIG.find(c => c.level === level) || PRIORITY_BADGE_CONFIG[3];
}

export function getPriorityFromScore(score: number): PriorityBadgeConfig {
  return PRIORITY_BADGE_CONFIG.find(c => score >= c.minScore) || PRIORITY_BADGE_CONFIG[3];
}
