// ============================================
// PRIORITY ENGINE TYPES
// Based on Metadata Model Designer Specification
// ============================================

// Priority Levels
export type PriorityLevel = 'P0' | 'P1' | 'P2' | 'P3';
export type Effort = 'low' | 'medium' | 'high';
export type RequirementType = 'required' | 'recommended' | 'optional';

// Metadata Field Types (Atlan native fields)
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
  | 'links';

// Pattern Types for metadata models
export type PatternType =
  | 'quick-discovery'
  | 'trusted-metrics'
  | 'compliance-ready'
  | 'root-cause-analysis'
  | 'data-product'
  | 'custom';

// Persona Types for role-based views
export type PersonaType =
  | 'data-steward'
  | 'data-engineer'
  | 'analyst'
  | 'executive'
  | 'all';

// ============================================
// COMPLETENESS WEIGHTS (from Atlan best practices)
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
};

// ============================================
// EFFORT ESTIMATES (minutes per asset)
// ============================================

export const EFFORT_ESTIMATES: Record<MetadataFieldType, Effort> = {
  ownerUsers: 'low',           // 1-2 min, often bulk assignable
  ownerGroups: 'low',          // 1-2 min
  description: 'medium',       // 3-5 min to write good description
  userDescription: 'low',      // 1-2 min, crowdsourced
  readme: 'high',              // 10-15 min for quality readme
  atlanTags: 'medium',         // 2-3 min, requires classification knowledge
  certificateStatus: 'low',    // 1 min, binary decision
  glossaryTerms: 'medium',     // 3-5 min, requires glossary to exist
  lineage: 'high',             // Often automatic, but manual is 10+ min
  accessPolicies: 'high',      // 5-10 min, requires security review
  customMetadata: 'medium',    // Varies, 2-5 min
  starredBy: 'low',            // User-driven, no effort
  links: 'low',                // 1-2 min
};

export const EFFORT_MINUTES: Record<Effort, number> = {
  low: 2,
  medium: 4,
  high: 10,
};

// ============================================
// PATTERN TEMPLATE
// ============================================

export interface PatternField {
  field: MetadataFieldType;
  requirement: RequirementType;
  rationale: string;
}

export interface PatternTemplate {
  id: PatternType;
  name: string;
  description: string;
  useCase: string;
  fields: PatternField[];
  suggestedTimeline: string;
  prerequisites: string[];
}

export const PATTERN_TEMPLATES: PatternTemplate[] = [
  {
    id: 'quick-discovery',
    name: 'Quick Discovery',
    description: 'Enable users to find and understand data assets quickly',
    useCase: 'Organizations prioritizing self-service data discovery',
    suggestedTimeline: '4-6 weeks',
    prerequisites: [],
    fields: [
      { field: 'description', requirement: 'required', rationale: 'Users need to understand what the asset contains' },
      { field: 'ownerUsers', requirement: 'required', rationale: 'Users need to know who to contact for questions' },
      { field: 'glossaryTerms', requirement: 'recommended', rationale: 'Standardizes terminology for search' },
      { field: 'certificateStatus', requirement: 'recommended', rationale: 'Signals trustworthiness' },
      { field: 'starredBy', requirement: 'optional', rationale: 'Social proof of useful assets' },
      { field: 'readme', requirement: 'optional', rationale: 'Deep context for power users' },
    ],
  },
  {
    id: 'trusted-metrics',
    name: 'Trusted Metrics',
    description: 'Establish single source of truth for KPIs and calculations',
    useCase: 'Organizations with metric inconsistency or duplicate definitions',
    suggestedTimeline: '6-8 weeks',
    prerequisites: ['Glossary structure defined'],
    fields: [
      { field: 'glossaryTerms', requirement: 'required', rationale: 'Links metrics to official definitions' },
      { field: 'ownerUsers', requirement: 'required', rationale: 'Accountable party for metric accuracy' },
      { field: 'lineage', requirement: 'required', rationale: 'Shows how metric is calculated' },
      { field: 'certificateStatus', requirement: 'required', rationale: 'Distinguishes official vs unofficial' },
      { field: 'description', requirement: 'recommended', rationale: 'Explains calculation methodology' },
      { field: 'customMetadata', requirement: 'recommended', rationale: 'Business context like refresh frequency' },
    ],
  },
  {
    id: 'compliance-ready',
    name: 'Compliance Ready',
    description: 'Prepare for regulatory audits and data governance requirements',
    useCase: 'Organizations in regulated industries (finance, healthcare, etc.)',
    suggestedTimeline: '8-12 weeks',
    prerequisites: ['Classification taxonomy defined', 'Access policies designed'],
    fields: [
      { field: 'atlanTags', requirement: 'required', rationale: 'Classification is non-negotiable for compliance' },
      { field: 'ownerUsers', requirement: 'required', rationale: 'Accountability chain for auditors' },
      { field: 'accessPolicies', requirement: 'required', rationale: 'Demonstrates access control' },
      { field: 'lineage', requirement: 'recommended', rationale: 'Data flow documentation for audits' },
      { field: 'description', requirement: 'recommended', rationale: 'Context for auditors' },
      { field: 'customMetadata', requirement: 'recommended', rationale: 'Retention policies, data sources' },
    ],
  },
  {
    id: 'root-cause-analysis',
    name: 'Root Cause Analysis',
    description: 'Enable fast debugging of data quality and pipeline issues',
    useCase: 'Organizations with frequent data incidents or quality problems',
    suggestedTimeline: '6-8 weeks',
    prerequisites: ['Lineage connectors configured'],
    fields: [
      { field: 'lineage', requirement: 'required', rationale: 'Must trace data flow to find issues' },
      { field: 'ownerUsers', requirement: 'required', rationale: 'Know who to escalate to' },
      { field: 'description', requirement: 'recommended', rationale: 'Understanding expected behavior' },
      { field: 'customMetadata', requirement: 'recommended', rationale: 'SLAs, freshness expectations' },
      { field: 'links', requirement: 'optional', rationale: 'Runbooks, incident playbooks' },
    ],
  },
  {
    id: 'data-product',
    name: 'Data Product',
    description: 'Package data as a self-service product for consumers',
    useCase: 'Organizations building internal data marketplace or mesh',
    suggestedTimeline: '10-14 weeks',
    prerequisites: ['Data product framework defined', 'Consumer personas identified'],
    fields: [
      { field: 'readme', requirement: 'required', rationale: 'Product documentation is essential' },
      { field: 'ownerUsers', requirement: 'required', rationale: 'Product owner accountability' },
      { field: 'certificateStatus', requirement: 'required', rationale: 'Production-ready signal' },
      { field: 'glossaryTerms', requirement: 'required', rationale: 'Consistent terminology' },
      { field: 'description', requirement: 'required', rationale: 'Quick product overview' },
      { field: 'lineage', requirement: 'recommended', rationale: 'Transparency on sources' },
      { field: 'accessPolicies', requirement: 'recommended', rationale: 'Self-service access requests' },
      { field: 'customMetadata', requirement: 'recommended', rationale: 'SLAs, update frequency, cost' },
      { field: 'links', requirement: 'optional', rationale: 'Sample queries, tutorials' },
    ],
  },
];

// ============================================
// AUDIT DATA MODEL
// ============================================

export interface CoverageTrend {
  previousPercent: number;
  changePercent: number;
  direction: 'up' | 'down' | 'stable';
  periodDays: number;
}

export interface FieldCoverage {
  field: MetadataFieldType;
  totalAssets: number;
  populatedAssets: number;
  coveragePercent: number; // 0-1
  trend?: CoverageTrend;
}

export interface AssetBreakdown {
  assetType: string;
  count: number;
  avgCompleteness: number;
}

export interface AuditSummary {
  totalAssets: number;
  assetsWithOwner: number;
  assetsWithDescription: number;
  assetsWithTags: number;
  assetsWithGlossary: number;
  assetsWithLineage: number;
  overallCompletenessScore: number; // 0-100
}

export interface AuditResult {
  timestamp: Date;
  tenantId: string;
  summary: AuditSummary;
  fieldCoverage: FieldCoverage[];
  assetBreakdown: AssetBreakdown[];
}

// ============================================
// PRIORITY ENGINE TYPES
// ============================================

export interface PriorityInput {
  field: MetadataFieldType;
  currentCoverage: number;        // 0-1, from audit
  assetCount: number;             // Total assets affected
  isRequired: boolean;            // From pattern template
  isRecommended: boolean;         // From pattern template
  weightScore: number;            // From COMPLETENESS_WEIGHTS
  estimatedEffort: Effort;        // From EFFORT_ESTIMATES
}

export interface Priority {
  field: MetadataFieldType;
  level: PriorityLevel;
  score: number;                  // Raw computed score
  badge: string;                  // Emoji indicator
  label: string;                  // Human-readable
  reasoning: string[];            // Why this priority
}

export interface PriorityBadgeConfig {
  level: PriorityLevel;
  badge: string;
  label: string;
  color: string;
  minScore: number;
}

export const PRIORITY_BADGE_CONFIG: PriorityBadgeConfig[] = [
  { level: 'P0', badge: '', label: 'Critical', color: '#DC2626', minScore: 70 },
  { level: 'P1', badge: '', label: 'High', color: '#EA580C', minScore: 50 },
  { level: 'P2', badge: '', label: 'Medium', color: '#CA8A04', minScore: 30 },
  { level: 'P3', badge: '', label: 'Low', color: '#6B7280', minScore: 0 },
];

export interface PriorityDrift {
  field: MetadataFieldType;
  previousLevel: PriorityLevel;
  currentLevel: PriorityLevel;
  direction: 'worsened' | 'improved';
  scoreDelta: number;
}

// ============================================
// IMPACT SIMULATION TYPES
// ============================================

export interface ImpactSimulation {
  field: MetadataFieldType;
  currentCoverage: number;
  simulatedCoverage: number;
  scoreImpact: number;
  completenessImpact: number;
  effortHours: number;
  roi: number; // scoreImpact / effortHours
}

// ============================================
// PATTERN MATCHER TYPES
// ============================================

export interface PatternMatch {
  pattern: PatternTemplate;
  matchScore: number;
  requiredGaps: MetadataFieldType[];
  recommendedGaps: MetadataFieldType[];
  readyToImplement: boolean;
}

export interface ImplementationPhase {
  name: string;
  description: string;
  fields: MetadataFieldType[];
  estimatedWeeks: number;
  milestone: string;
}

export interface ImplementationPlan {
  pattern: PatternTemplate;
  currentMatchScore: number;
  phases: ImplementationPhase[];
  totalEstimatedWeeks: number;
}

// ============================================
// VALIDATION ENGINE TYPES
// ============================================

export type AntiPatternCategory =
  | 'orphan-assets'
  | 'description-desert'
  | 'classification-chaos'
  | 'lineage-blackout'
  | 'glossary-ghost-town'
  | 'owner-overload'
  | 'stale-metadata';

export interface ValidationIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  category: AntiPatternCategory;
  title: string;
  description: string;
  affectedFields: MetadataFieldType[];
  recommendation: string;
}

export interface RecommendedFix {
  issue: ValidationIssue;
  quickWin: boolean;
  estimatedEffort: string;
  dependencies: string[];
}

// ============================================
// PERSONA VIEW TYPES
// ============================================

export interface PersonaDisplayConfig {
  primaryMetric: string;
  chartTypes: string[];
  actionVerbs: string[];
}

export interface PersonaView {
  persona: PersonaType;
  name: string;
  description: string;
  focusFields: MetadataFieldType[];
  excludeFields: MetadataFieldType[];
  displayConfig: PersonaDisplayConfig;
}

export const PERSONA_VIEWS: PersonaView[] = [
  {
    persona: 'data-steward',
    name: 'Data Steward',
    description: 'Focus on governance, classification, and ownership',
    focusFields: ['ownerUsers', 'ownerGroups', 'atlanTags', 'certificateStatus', 'glossaryTerms'],
    excludeFields: ['lineage', 'starredBy'],
    displayConfig: {
      primaryMetric: 'Governance Score',
      chartTypes: ['coverage-heatmap', 'ownership-distribution', 'classification-breakdown'],
      actionVerbs: ['Assign', 'Classify', 'Certify', 'Define'],
    },
  },
  {
    persona: 'data-engineer',
    name: 'Data Engineer',
    description: 'Focus on lineage, quality, and technical metadata',
    focusFields: ['lineage', 'description', 'customMetadata', 'links'],
    excludeFields: ['glossaryTerms', 'certificateStatus', 'starredBy'],
    displayConfig: {
      primaryMetric: 'Technical Completeness',
      chartTypes: ['lineage-coverage', 'connector-health', 'freshness-timeline'],
      actionVerbs: ['Connect', 'Document', 'Configure', 'Trace'],
    },
  },
  {
    persona: 'analyst',
    name: 'Data Analyst',
    description: 'Focus on discoverability and understanding',
    focusFields: ['description', 'glossaryTerms', 'certificateStatus', 'readme', 'starredBy'],
    excludeFields: ['accessPolicies', 'customMetadata'],
    displayConfig: {
      primaryMetric: 'Discoverability Score',
      chartTypes: ['search-success-rate', 'popular-assets', 'term-coverage'],
      actionVerbs: ['Find', 'Understand', 'Trust', 'Use'],
    },
  },
  {
    persona: 'executive',
    name: 'Executive',
    description: 'Focus on high-level metrics and progress',
    focusFields: ['ownerUsers', 'certificateStatus', 'atlanTags'],
    excludeFields: ['lineage', 'customMetadata', 'links', 'readme'],
    displayConfig: {
      primaryMetric: 'Overall Maturity Score',
      chartTypes: ['maturity-trend', 'risk-heatmap', 'roi-dashboard'],
      actionVerbs: ['Track', 'Compare', 'Report', 'Prioritize'],
    },
  },
];

// ============================================
// EXPORT TYPES
// ============================================

export interface ExportConfig {
  format: 'json' | 'csv' | 'markdown' | 'atlan-bulk';
  includeReasons: boolean;
  includeTimeline: boolean;
}

// ============================================
// FIELD NAME DISPLAY MAPPING
// ============================================

export const FIELD_DISPLAY_NAMES: Record<MetadataFieldType, string> = {
  ownerUsers: 'Owner (Users)',
  ownerGroups: 'Owner (Groups)',
  description: 'Description',
  userDescription: 'User Description',
  readme: 'README',
  atlanTags: 'Classifications',
  certificateStatus: 'Certificate',
  glossaryTerms: 'Glossary Terms',
  lineage: 'Lineage',
  accessPolicies: 'Access Policies',
  customMetadata: 'Custom Metadata',
  starredBy: 'Starred',
  links: 'Links',
};

export function formatFieldName(field: MetadataFieldType): string {
  return FIELD_DISPLAY_NAMES[field] || field;
}
