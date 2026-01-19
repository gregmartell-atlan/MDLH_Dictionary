/**
 * Metadata Modeling Assistant Types
 * 
 * Canonical domain model for the Metadata Modeling Assistant based on
 * the embedded templates and reference content from:
 * - Metadata Model Design Framework (MDDF)
 * - Master Metadata Model Templates
 * - Bandwidth, Daikin, Raptive customer implementations
 */

import type { MetadataFieldType, RequirementType } from './metadata-fields';
import type { PatternTemplate } from './patterns';
import type { CustomMetadataDesign } from './custom-metadata';

// Re-export commonly used types
export type { MetadataFieldType, RequirementType, PatternTemplate, CustomMetadataDesign };

// ============================================
// DaaP FRAMEWORK (Data as a Product)
// ============================================

export type DaaPDimension =
  | 'Discoverable'
  | 'Understandable'
  | 'Addressable'
  | 'Secure'
  | 'Interoperable'
  | 'Trustworthy'
  | 'Natively accessible';

export interface DaaPFramework {
  dimension: DaaPDimension;
  description: string;
  metadataElements: MetadataFieldType[];
}

export const DAAP_FRAMEWORK: DaaPFramework[] = [
  {
    dimension: 'Discoverable',
    description: 'Aggregating metadata across assets makes them easily discoverable with "Google-like search" and "Amazon-like browsing."',
    metadataElements: ['description', 'glossaryTerms', 'atlanTags', 'certificateStatus'],
  },
  {
    dimension: 'Understandable',
    description: 'Defining and aggregating metadata (who uses, who created, origin, etc.) to create 360° context.',
    metadataElements: ['description', 'readme', 'ownerUsers', 'customMetadata'],
  },
  {
    dimension: 'Addressable',
    description: 'Assets have documented owners and contacts with lineage; a consistent address and history is critical.',
    metadataElements: ['ownerUsers', 'ownerGroups', 'lineage'],
  },
  {
    dimension: 'Secure',
    description: 'Metadata about security classifications (e.g., PII) that orchestrates security policy management.',
    metadataElements: ['atlanTags', 'accessPolicies'],
  },
  {
    dimension: 'Interoperable',
    description: 'Lineage and relationship metadata exposed according to global standards for interoperability.',
    metadataElements: ['lineage', 'glossaryTerms'],
  },
  {
    dimension: 'Trustworthy',
    description: 'Trust from transparency and consistency; quality and usage metadata combined into data quality scores.',
    metadataElements: ['certificateStatus', 'customMetadata', 'ownerUsers'],
  },
  {
    dimension: 'Natively accessible',
    description: 'Metadata is available in tools users already use (Slack/Teams, Excel, etc.).',
    metadataElements: ['links'],
  },
];

// ============================================
// INDUSTRY & USE CASE TAXONOMY
// ============================================

export type Industry =
  | 'Financial Services'
  | 'Healthcare'
  | 'Manufacturing/HVAC'
  | 'Retail/E-commerce'
  | 'Technology'
  | 'Telecommunications'
  | 'Media/Entertainment'
  | 'Other';

export type UseCase =
  | 'Data Discovery'
  | 'Trusted Metrics'
  | 'Compliance'
  | 'Root Cause Analysis'
  | 'Impact Analysis'
  | 'Metrics Catalog'
  | 'Data Compliance'
  | 'Cost Optimization'
  | 'Lifecycle Management'
  | 'Data Products';

// ============================================
// USER STORY
// ============================================

export interface UserStory {
  id: string;
  role: string;
  persona?: string; // e.g., "Data Analyst", "Data Steward"
  domain?: string;
  desire: string;
  reason: string;
  outcome?: string; // What success looks like
  textFull: string; // Complete user story sentence
  daapDimensions: DaaPDimension[];
  daapUnlock?: string; // Which DaaP dimension this unlocks
  ootbCapabilities: string[]; // Out-of-the-box metadata, abilities, integrations
  antiPatternRisk?: string; // What to avoid
  recommendedPatterns?: MetadataPattern[];
  pattern?: MetadataPattern;
  industry?: Industry;
  useCase?: UseCase;
  source?: 'bandwidth' | 'daikin' | 'raptive' | 'master-template' | 'accolade' | 'bank-ozk' | 'custom';
}

// ============================================
// METADATA PATTERNS
// ============================================

export type MetadataPattern =
  | 'Quick Discovery'
  | 'Trusted Metrics'
  | 'Compliance'
  | 'Standards'
  | 'Root Cause'
  | 'Incident Comms'
  | 'Data Product';

export interface PatternDefinition {
  pattern: MetadataPattern;
  userNeed: string;
  metadataSolution: MetadataFieldType[]; // Combination of metadata elements
  description: string;
}

export const METADATA_PATTERNS: PatternDefinition[] = [
  {
    pattern: 'Quick Discovery',
    userNeed: 'Find relevant data quickly',
    metadataSolution: ['description', 'atlanTags', 'certificateStatus', 'accessPolicies'],
    description: 'Descriptions + Domain tags + Certificates + Access policies + Usage stats',
  },
  {
    pattern: 'Trusted Metrics',
    userNeed: 'Single source of truth',
    metadataSolution: ['glossaryTerms', 'readme', 'lineage', 'links'],
    description: 'Glossary definitions + README formulas + Term-to-asset links + Dashboard links',
  },
  {
    pattern: 'Compliance',
    userNeed: 'Protect sensitive data',
    metadataSolution: ['atlanTags', 'accessPolicies', 'ownerUsers', 'lineage'],
    description: 'PII/Sensitivity tags + Access policies + Owners + Lineage + Handling descriptions',
  },
  {
    pattern: 'Standards',
    userNeed: 'Agreed definitions',
    metadataSolution: ['glossaryTerms', 'readme', 'ownerUsers'],
    description: 'Glossary + Term-to-table links + README calculations + Owner approval',
  },
  {
    pattern: 'Root Cause',
    userNeed: 'Trace data issues',
    metadataSolution: ['lineage', 'description', 'ownerUsers'],
    description: 'End-to-end lineage + Descriptions on all assets + Pipeline owners + Integrations',
  },
  {
    pattern: 'Incident Comms',
    userNeed: 'Alert on issues',
    metadataSolution: ['description', 'ownerUsers', 'customMetadata', 'links'],
    description: 'Descriptions + Owners + Announcements + DQ metadata + Slack/Teams integration',
  },
  {
    pattern: 'Data Product',
    userNeed: 'Self-service data consumption',
    metadataSolution: ['readme', 'certificateStatus', 'glossaryTerms', 'ownerUsers', 'accessPolicies'],
    description: 'README + Certificate + Glossary + Owners + Access policies + SLAs',
  },
];

// ============================================
// METADATA MODEL ROW
// ============================================

export type ManageableAmount = 
  | 'Business-critical'
  | 'Most queried'
  | 'All assets'
  | string; // Custom scope

export type EnrichmentQuadrant =
  | 'Automated_Backlog'    // Clear Debt - crawlers, AI
  | 'Manual_Backlog'       // Sprints - steward working sessions
  | 'Automated_Forward'    // Prevention - playbooks, propagator, CI/CD
  | 'Manual_Forward';      // Process Change - PR templates, reviews

export interface PropagatorConfig {
  tool: 'Metadata Propagator';
  configString: string; // e.g., "Quality.SLA@@@Quality.SLA"
  direction: 'upstream' | 'downstream';
  behavior: 'soft_append' | 'overwrite' | 'merge';
}

export interface MetadataModelRow {
  id: string;
  userStoryId?: string; // Link to UserStory
  sourceSystem: string; // e.g., "Snowflake", "Tableau"
  assetType: string; // e.g., "Tables", "Views", "Columns", "Dashboard"
  logicalEntity?: string; // Business entity name
  metadataElements: MetadataFieldType[];
  isCustomMetadata?: boolean;
  manageableAmount: ManageableAmount;
  initialAmount: number; // Number of assets to start with
  daapDimension: DaaPDimension[];
  bulkMetadataExists: boolean;
  bulkMetadataLocation?: string; // e.g., "Snowflake comments", "dbt YAML"
  automationPossible: boolean;
  enrichmentQuadrant?: EnrichmentQuadrant;
  automationTool?: string; // "Atlan_AI", "Playbook", "dbt", "Propagator", "API"
  propagatorConfig?: PropagatorConfig;
  curationProcess?: string;
  trackingField?: string; // Custom metadata field for tracking enrichment rounds
  governanceGuidelinesExist: boolean;
  governanceGuidelinesLink?: string;
  scoringField?: string;
  targetCompletionDate?: string;
  industry?: Industry;
  tenant?: string; // Customer name for reference implementations
}

// ============================================
// ENRICHMENT TECHNIQUE
// ============================================

export type EnrichmentTechniqueType = 'Automation' | 'Manual' | 'Hybrid' | 'Not Applicable';

export interface EnrichmentTechnique {
  id: string;
  metadataElement: MetadataFieldType;
  assetType: string;
  sourceSystem: string;
  techniqueType: EnrichmentTechniqueType;
  tooling?: string; // e.g., "Built-in crawler", "Playbooks", "Python SDK"
  trackingField?: string;
  curationProcess: string;
  estimatedEffortPerAsset?: number; // Minutes
  prerequisites?: string[];
  successCriteria?: string;
}

// ============================================
// GOVERNANCE STANDARD
// ============================================

export interface GovernanceStandard {
  id: string;
  metadataElement: MetadataFieldType;
  standardFormat: string; // Template or pattern
  verificationCriteria: string[];
  examples: string[];
  whenRequired: RequirementType;
  relatedPatterns: MetadataPattern[];
}

// ============================================
// OUTCOME METRIC
// ============================================

export type MetricCategory = 
  | 'Enrichment Progress'
  | 'Completeness Score'
  | 'Time to Data'
  | 'Support Tickets'
  | 'User Satisfaction'
  | 'Self-Service Rate'
  | 'Data Exploration'
  | 'Discovery'
  | 'Glossary'
  | 'Metrics Catalog'
  | 'RCA'
  | 'Impact Analysis'
  | 'Compliance'
  | 'Lifecycle'
  | 'Cost Optimization';

export interface OutcomeMetric {
  id: string;
  name: string;
  category: MetricCategory;
  description: string;
  baseline?: number | string;
  target?: number | string;
  actual?: number | string;
  unit: string; // e.g., "assets", "%", "minutes", "tickets/month"
  measurementMethod: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'sprint' | 'one-time';
  relatedPatterns: MetadataPattern[];
}

// ============================================
// IMPLEMENTATION ROADMAP
// ============================================

export interface RoadmapPhase {
  id: string;
  name: string;
  week?: number;
  sprint?: string; // e.g., "Sprint 0", "Sprint 1"
  domain?: string;
  assetsTarget: number;
  keyActivities: string[];
  deliverable: string;
  duration?: number; // Days
  dependencies?: string[]; // IDs of prerequisite phases
}

export interface ImplementationRoadmap {
  id: string;
  name: string;
  description: string;
  totalDuration: number; // Weeks
  totalAssets: number;
  phases: RoadmapPhase[];
  milestones: RoadmapMilestone[];
  metrics: OutcomeMetric[];
}

export interface RoadmapMilestone {
  id: string;
  name: string;
  description: string;
  targetDate?: string;
  completionCriteria: string[];
  deliverables: string[];
}

// ============================================
// VALUE vs VIABILITY MATRIX (VVM) - Strategy Scout
// ============================================

export type VVMClassification = 'Quick Win' | 'Big Bet' | 'Game Changer' | 'Backlog';

export interface DomainScore {
  domain: string;
  // Value dimensions (0-5 each)
  businessImpact: number;
  userReach: number;
  regulatoryPressure: number;
  valueScore: number; // Sum of value dimensions
  // Viability dimensions (0-5 each)
  leadershipSponsorship: number;
  smeAvailability: number;
  existingDocumentation: number;
  toolingReadiness: number;
  viabilityScore: number; // Sum of viability dimensions
  // Classification
  classification: VVMClassification;
  rationale: string;
}

export interface StrategyScoutResult {
  domains: DomainScore[];
  recommendedPilot: string; // Top domain to start with
  recommendation: string;
}

// ============================================
// MCP READINESS & AI GOVERNANCE
// ============================================

export interface MCPReadinessCheck {
  assetType: string;
  requiredFields: MetadataFieldType[];
  isReady: boolean;
  missingFields?: MetadataFieldType[];
  score?: number; // 0-100
}

// ============================================
// PERSONA PROFILES
// ============================================

export type PersonaType =
  | 'Data Governance Lead'
  | 'Data Steward'
  | 'Compliance Officer'
  | 'Data Analyst'
  | 'Data Engineer'
  | 'Executive / CFO'
  | 'Atlan CSM / PS';

export interface PersonaProfile {
  persona: PersonaType;
  primaryGoals: string[];
  topUseCases: UseCase[];
  primaryDaaPFocus: DaaPDimension[];
}

// ============================================
// COMPLETENESS SCORE CONFIGURATION
// ============================================

export interface CompletenessScoreConfig {
  id: string;
  name: string;
  description: string;
  weights: Record<MetadataFieldType, number>;
  threshold: number; // Minimum score for "complete" (typically 80)
  applicableAssetTypes: string[];
}

export const DEFAULT_COMPLETENESS_CONFIG: CompletenessScoreConfig = {
  id: 'default',
  name: 'Default Completeness Score',
  description: 'Standard completeness scoring from MDDF',
  weights: {
    description: 20,
    ownerUsers: 30,
    certificateStatus: 25,
    glossaryTerms: 15,
    customMetadata: 10,
    ownerGroups: 0,
    userDescription: 0,
    readme: 0,
    atlanTags: 0,
    lineage: 0,
    accessPolicies: 0,
    starredBy: 0,
    links: 0,
    compliance_retention: 0,
    compliance_legal_hold: 0,
    compliance_country: 0,
    product_sla: 0,
    product_tier: 0,
    product_cost: 0,
    product_refresh_rate: 0,
    product_usage: 0,
    product_rating: 0,
    product_quality_score: 0,
    product_lifecycle: 0,
    dq_freshness: 0,
    dq_completeness: 0,
    dq_owner: 0,
    ops_on_call: 0,
    ops_runbook: 0,
    ops_slack: 0,
  },
  threshold: 80,
  applicableAssetTypes: ['Table', 'View', 'Dashboard'],
};

// ============================================
// ASSISTANT PROJECT
// ============================================

export interface AssistantProject {
  id: string;
  name: string;
  description: string;
  industry: Industry;
  domains: string[];
  useCases: UseCase[];
  connectors: string[]; // e.g., ["Snowflake", "Tableau", "dbt"]
  userStories: UserStory[];
  metadataModel: MetadataModelRow[];
  enrichmentTechniques: EnrichmentTechnique[];
  roadmap?: ImplementationRoadmap;
  completenessConfig?: CompletenessScoreConfig;
  selectedPatterns?: PatternTemplate[];
  selectedCustomMetadata?: CustomMetadataDesign[];
  stakeholders?: Array<{
    name: string;
    email: string;
    role: string;
  }>;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  status: 'draft' | 'in-progress' | 'completed';
}

// ============================================
// WIZARD STATE
// ============================================

export interface WizardState {
  currentStep: number;
  totalSteps: number;
  profile: {
    projectName?: string;
    industry?: Industry;
    domains: string[];
    useCases: UseCase[];
    connectors: string[];
    teamSize?: 'small' | 'medium' | 'large';
    maturity?: 'starting' | 'scaling' | 'optimizing';
  };
  selectedUserStories: UserStory[];
  draftMetadataModel: MetadataModelRow[];
  selectedTechniques: EnrichmentTechnique[];
  proposedRoadmap?: ImplementationRoadmap;
  selectedPatterns: PatternTemplate[];
  selectedCustomMetadata: CustomMetadataDesign[];
  stakeholders?: Array<{
    name: string;
    email: string;
    role: string;
  }>;
}
