/**
 * Enrichment Plan Types
 * 
 * Defines the structure for Governance Plans, including versioning,
 * progress tracking, and integration with the Metadata Assistant.
 */

import type { RequirementsMatrix, PlanStatus } from './requirements';
import type { MetadataFieldType } from './metadata-fields';

// ============================================
// REQUIREMENT DEFINITIONS
// ============================================

export interface EnrichmentPlanRequirement {
  id: string;
  fieldType: MetadataFieldType;
  
  // Scope: which assets does this apply to?
  assetScope: {
    domains?: string[]; // Target domain IDs (e.g., ["finance-domain-id"])
    connectors?: string[]; // e.g., ["snowflake"]
    assetTypes?: string[]; // e.g., ["Table", "View"]
    qualityThreshold?: 'all' | 'business-critical' | 'new';
    tagsRequired?: string[]; // Only assets with these tags (e.g., ["pii"])
  };
  
  // Requirement level
  statusType: 'required' | 'recommended';
  
  // Target metrics
  targetCount?: number; // How many assets should have this
  lastUpdated: string;
}

// ============================================
// PROGRESS TRACKING
// ============================================

export interface EnrichmentPlanProgress {
  requirementId: string;
  currentCount: number; // How many assets currently have it
  targetCount: number;
  percentComplete: number; // 0-100
  
  // Assets that don't have this field yet
  assetsWithoutField: string[]; // GUIDs
  assetsWithField: string[]; // GUIDs
  
  // Who's contributing?
  completedByUser?: Record<string, number>; // "user@company.com": 45
  
  // Timeline tracking
  lastUpdated: string; // When was this last counted?
  weeklyVelocity?: number; // Assets added per week
  estimatedCompletionDate?: string; // If velocity stays same
  onTrack: boolean;
}

export interface PlanMetrics {
  overallCompletion: number; // % of requirements met
  requiredCompletion: number; // % of REQUIRED requirements met
  daysRemaining: number;
  completionColor: 'green' | 'yellow' | 'red'; // on-track, at-risk, behind
  topContributor?: { userId: string; count: number };
}

// ============================================
// VERSIONING
// ============================================

export interface PlanVersion {
  id: string;
  versionNumber: number;
  createdAt: string;
  createdBy: 'user' | 'assistant';
  description?: string;
  matrix: RequirementsMatrix;
  changeLog?: string[];
}

// ============================================
// MAIN PLAN TYPE
// ============================================

export interface EnrichmentPlan {
  id: string;
  name: string;
  description: string;
  
  // Links to governance structure
  domains: string[]; // Which domains?
  
  // Timeline
  status: PlanStatus;
  startDate?: string;
  targetDate: string; // When should we be done?
  actualCompletionDate?: string;
  
  // Ownership & accountability
  owner?: string; // Plan sponsor (user ID)
  managers: string[]; // Who tracks progress?
  reviewers?: string[]; // Stakeholders providing sign-off
  owners?: string[]; // Additional accountable owners
  contributors: Record<string, number>; // userId → asset count completed
  
  // The work to do
  requirements: EnrichmentPlanRequirement[]; // What needs enriching
  
  // Progress: real-time tracking of each requirement
  progress: EnrichmentPlanProgress[];
  
  // Metrics: aggregated view
  metrics?: PlanMetrics;
  
  // The matrix from assistant/designer
  currentMatrix: RequirementsMatrix;
  
  // Versioning & history
  versions: PlanVersion[];
  activeDraft?: PlanVersion;

  // Collaboration
  comments?: Array<{
    id: string;
    author: string;
    text: string;
    createdAt: string;
    status?: 'open' | 'resolved';
  }>;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  createdBy: 'user' | 'assistant';
  lastProgressCheck?: string; // When did we last calculate progress?
}

// Helper to create a new plan
export const createEmptyPlan = (name: string, description: string = ''): EnrichmentPlan => {
  const now = new Date().toISOString();
  const targetDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const defaultMatrix: RequirementsMatrix = {
    id: crypto.randomUUID(),
    name,
    description,
    status: 'draft',
    assetTypeRequirements: [],
    domainOverrides: [],
    connectorOverrides: [],
    certificationRules: [],
    conditionalRules: []
  };

  return {
    id: crypto.randomUUID(),
    name,
    description,
    domains: [],
    status: 'draft',
    targetDate,
    managers: [],
    contributors: {},
    requirements: [],
    progress: [],
    currentMatrix: defaultMatrix,
    versions: [],
    createdAt: now,
    updatedAt: now,
    createdBy: 'user'
  };
};

// Helper to calculate plan metrics from progress
export const calculatePlanMetrics = (plan: EnrichmentPlan): PlanMetrics => {
  if (plan.requirements.length === 0) {
    return {
      overallCompletion: 0,
      requiredCompletion: 0,
      daysRemaining: 0,
      completionColor: 'gray' as any,
    };
  }

  const requiredReqs = plan.requirements.filter(r => r.statusType === 'required');
  
  // Overall completion: average of all requirements
  const overallCompletion = Math.round(
    plan.progress.reduce((sum, p) => sum + p.percentComplete, 0) / plan.requirements.length
  );

  // Required completion: average of required requirements
  const requiredCompletion = requiredReqs.length > 0
    ? Math.round(
        plan.progress
          .filter(p => plan.requirements.find(r => r.id === p.requirementId && r.statusType === 'required'))
          .reduce((sum, p) => sum + p.percentComplete, 0) / requiredReqs.length
      )
    : 100;

  // Days remaining
  const target = new Date(plan.targetDate);
  const now = new Date();
  const daysRemaining = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // Status: green if all required at 100%, yellow if >80%, red if <80%
  let completionColor: 'green' | 'yellow' | 'red' = 'green';
  if (requiredCompletion < 80) {
    completionColor = 'red';
  } else if (requiredCompletion < 100) {
    completionColor = 'yellow';
  }

  // Top contributor
  const contributors = Object.entries(plan.contributors).sort(([, a], [, b]) => b - a);
  const topContributor = contributors.length > 0
    ? { userId: contributors[0][0], count: contributors[0][1] }
    : undefined;

  return {
    overallCompletion,
    requiredCompletion,
    daysRemaining,
    completionColor,
    topContributor,
  };
};
