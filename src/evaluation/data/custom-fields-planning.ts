/**
 * Custom Fields Implementation Planning Module
 * 
 * Generates actionable implementation plans for custom fields based on
 * use cases, verticals, and organizational readiness.
 */

import type { UseCase } from '../types/metadata-assistant';
import {
  ALL_USE_CASES,
  ALL_VERTICALS,
} from './custom-fields-matrix';
import {
  getRecommendedCustomFields,
  generateCustomFieldsPlan,
} from './custom-fields-library';

// ============================================
// IMPLEMENTATION PLAN TYPES
// ============================================

export interface CustomFieldsImplementationPlan {
  organizationProfile: {
    useCases: UseCase[];
    vertical?: string;
    maturity: 'beginner' | 'intermediate' | 'advanced';
    teamSize: number;
    timeline: 'immediate' | 'quarterly' | 'annual';
  };
  phases: ImplementationPhase[];
  totalEffortHours: number;
  estimatedTimeline: {
    foundationWeeks: number;
    enhancementWeeks: number;
    optimizationWeeks: number;
    totalWeeks: number;
  };
  risks: Risk[];
  successMetrics: SuccessMetric[];
}

export interface ImplementationPhase {
  phase: 'Foundation' | 'Enhancement' | 'Optimization';
  durationWeeks: number;
  customFields: {
    id: string;
    displayName: string;
    automationStrategy: string;
    effort: number;
    owner: string;
  }[];
  milestones: string[];
  successCriteria: string[];
}

export interface Risk {
  issue: string;
  probability: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation: string;
}

export interface SuccessMetric {
  metric: string;
  target: string;
  measuredBy: string;
}

// ============================================
// IMPLEMENTATION PLAN GENERATOR
// ============================================

export function generateImplementationPlan(config: {
  useCases: UseCase[];
  vertical?: string;
  maturity: 'beginner' | 'intermediate' | 'advanced';
  teamSize: number;
  timeline: 'immediate' | 'quarterly' | 'annual';
}): CustomFieldsImplementationPlan {
  const recommendations = getRecommendedCustomFields(config.useCases, config.vertical);
  const fieldsPlan = generateCustomFieldsPlan(recommendations.map(r => r.field));

  // Calculate effort based on maturity
  const effortMultiplier =
    config.maturity === 'beginner' ? 2 : config.maturity === 'intermediate' ? 1.5 : 1;
  const totalEffort = fieldsPlan.totalEffortHours * effortMultiplier;

  // Build phases
  const phases = buildPhases(
    fieldsPlan,
    config.maturity
  );

  // Timeline estimation
  const estimatedTimeline = estimateTimeline(phases);

  // Identify risks
  const risks = identifyRisks(config, fieldsPlan);

  // Success metrics
  const successMetrics = defineSuccessMetrics(config.useCases);

  return {
    organizationProfile: config,
    phases,
    totalEffortHours: totalEffort,
    estimatedTimeline,
    risks,
    successMetrics,
  };
}

function buildPhases(
  fieldsPlan: ReturnType<typeof generateCustomFieldsPlan>,
  maturity: string
): ImplementationPhase[] {
  const phases: ImplementationPhase[] = [];

  // Foundation Phase: Manual + Critical Automated Fields
  if (fieldsPlan.manual.length > 0 || fieldsPlan.automation.length > 0) {
    const foundationFields = [
      ...fieldsPlan.automation.slice(0, 2),
      ...fieldsPlan.manual.slice(0, 2),
    ];

    phases.push({
      phase: 'Foundation',
      durationWeeks: maturity === 'beginner' ? 4 : 2,
      customFields: foundationFields.map(f => ({
        id: f.id,
        displayName: f.displayName,
        automationStrategy: f.automationStrategy,
        effort: f.effortMinutes,
        owner: 'Data Governance Lead',
      })),
      milestones: [
        'Custom field schema defined',
        'Automation rules configured',
        'Pilot deployment (10% of assets)',
        'Team training completed',
      ],
      successCriteria: [
        'All foundation fields available in Atlan',
        'Automation rules 90%+ accurate',
        'Team demonstrates understanding',
        'Pilot shows adoption >50%',
      ],
    });
  }

  // Enhancement Phase: Remaining Automated Fields + Optional Manual
  if (fieldsPlan.automation.length > 2 || fieldsPlan.hybrid.length > 0) {
    const enhancementFields = [
      ...fieldsPlan.automation.slice(2),
      ...fieldsPlan.hybrid.slice(0, 2),
    ];

    if (enhancementFields.length > 0) {
      phases.push({
        phase: 'Enhancement',
        durationWeeks: maturity === 'beginner' ? 6 : 3,
        customFields: enhancementFields.map(f => ({
          id: f.id,
          displayName: f.displayName,
          automationStrategy: f.automationStrategy,
          effort: f.effortMinutes,
          owner: 'Data Steward',
        })),
        milestones: [
          'Additional automation rules deployed',
          'Full asset coverage (100%)',
          'Completeness monitoring active',
          'Feedback loops established',
        ],
        successCriteria: [
          'All enhancements fields >70% populated',
          'Automation error rate <5%',
          'User adoption tracking shows usage',
          'Performance SLAs met',
        ],
      });
    }
  }

  // Optimization Phase: Advanced Analytics & Governance
  if (fieldsPlan.hybrid.length > 2 || fieldsPlan.manual.length > 2) {
    const optimizationFields = [
      ...fieldsPlan.hybrid.slice(2),
      ...fieldsPlan.manual.slice(2),
    ];

    if (optimizationFields.length > 0) {
      phases.push({
        phase: 'Optimization',
        durationWeeks: maturity === 'beginner' ? 8 : 4,
        customFields: optimizationFields.map(f => ({
          id: f.id,
          displayName: f.displayName,
          automationStrategy: f.automationStrategy,
          effort: f.effortMinutes,
          owner: 'Data Quality Lead',
        })),
        milestones: [
          'Advanced analytics dashboards created',
          'AI-powered recommendations deployed',
          'Governance policies integrated',
          'Continuous improvement roadmap',
        ],
        successCriteria: [
          'Optimization fields >80% populated',
          'Automated insights driving decisions',
          'Custom field ROI documented',
          'Roadmap for next phase defined',
        ],
      });
    }
  }

  return phases;
}

function estimateTimeline(
  phases: ImplementationPhase[]
): CustomFieldsImplementationPlan['estimatedTimeline'] {
  const foundationPhase = phases.find(p => p.phase === 'Foundation');
  const enhancementPhase = phases.find(p => p.phase === 'Enhancement');
  const optimizationPhase = phases.find(p => p.phase === 'Optimization');

  const foundationWeeks = foundationPhase?.durationWeeks || 2;
  const enhancementWeeks = enhancementPhase?.durationWeeks || 3;
  const optimizationWeeks = optimizationPhase?.durationWeeks || 4;

  return {
    foundationWeeks,
    enhancementWeeks,
    optimizationWeeks,
    totalWeeks: foundationWeeks + enhancementWeeks + optimizationWeeks,
  };
}

function identifyRisks(
  config: {
    useCases: UseCase[];
    vertical?: string;
    maturity: 'beginner' | 'intermediate' | 'advanced';
    teamSize: number;
    timeline: 'immediate' | 'quarterly' | 'annual';
  },
  fieldsPlan: ReturnType<typeof generateCustomFieldsPlan>
): Risk[] {
  const risks: Risk[] = [];

  // Risk: High effort relative to team size
  if (fieldsPlan.totalEffortHours > config.teamSize * 40) {
    risks.push({
      issue: 'Implementation effort exceeds team capacity',
      probability: 'high',
      impact: 'high',
      mitigation: 'Prioritize foundation fields, extend timeline, or hire contractors',
    });
  }

  // Risk: Manual fields hard to adopt
  if (fieldsPlan.manual.length > 5) {
    risks.push({
      issue: 'High number of manual custom fields may face adoption resistance',
      probability: 'medium',
      impact: 'medium',
      mitigation: 'Build automation where possible, create templates, invest in training',
    });
  }

  // Risk: Immature organization
  if (config.maturity === 'beginner' && config.useCases.length > 5) {
    risks.push({
      issue: 'Complex use cases without metadata foundation may struggle',
      probability: 'high',
      impact: 'medium',
      mitigation: 'Start with Data Discovery use case, build basic fields first',
    });
  }

  // Risk: Aggressive timeline
  if (config.timeline === 'immediate' && fieldsPlan.totalEffortHours > 100) {
    risks.push({
      issue: 'Aggressive timeline for large scope may compromise quality',
      probability: 'medium',
      impact: 'high',
      mitigation: 'Reduce scope, increase team, or extend timeline to quarterly',
    });
  }

  // Risk: Vertical-specific fields
  if (config.vertical && !ALL_VERTICALS.includes(config.vertical)) {
    risks.push({
      issue: 'Unsupported vertical may need custom field definitions',
      probability: 'medium',
      impact: 'low',
      mitigation: 'Extend library or adapt closest vertical template',
    });
  }

  return risks;
}

function defineSuccessMetrics(useCases: UseCase[]): SuccessMetric[] {
  const metrics: SuccessMetric[] = [
    {
      metric: 'Custom Field Adoption Rate',
      target: '>80% of assets have custom fields populated',
      measuredBy: 'Atlan metadata dashboard',
    },
    {
      metric: 'Data Quality Score',
      target: '>90% for critical custom fields',
      measuredBy: 'Completeness scoring algorithm',
    },
    {
      metric: 'User Satisfaction',
      target: '>4/5 in quarterly surveys',
      measuredBy: 'NPS survey, user feedback',
    },
  ];

  // Add use-case specific metrics
  if (useCases.includes('Compliance')) {
    metrics.push({
      metric: 'Compliance Coverage',
      target: '100% of regulated assets tagged',
      measuredBy: 'Compliance audit report',
    });
  }

  if (useCases.includes('Cost Optimization')) {
    metrics.push({
      metric: 'Cost Attribution Accuracy',
      target: '>95% of costs allocated to cost centers',
      measuredBy: 'Finance reconciliation',
    });
  }

  if (useCases.includes('Data Products')) {
    metrics.push({
      metric: 'Product SLA Compliance',
      target: '>98% uptime, <100ms latency',
      measuredBy: 'Monitoring dashboard',
    });
  }

  return metrics;
}

// ============================================
// QUICK START TEMPLATES
// ============================================

export const QUICK_START_TEMPLATES = {
  minimal: (): CustomFieldsImplementationPlan => {
    return generateImplementationPlan({
      useCases: ['Data Discovery'],
      maturity: 'beginner',
      teamSize: 2,
      timeline: 'quarterly',
    });
  },

  standard: (): CustomFieldsImplementationPlan => {
    return generateImplementationPlan({
      useCases: ['Data Discovery', 'Trusted Metrics', 'Lifecycle Management'],
      vertical: 'Technology',
      maturity: 'intermediate',
      teamSize: 5,
      timeline: 'quarterly',
    });
  },

  comprehensive: (): CustomFieldsImplementationPlan => {
    return generateImplementationPlan({
      useCases: ALL_USE_CASES,
      vertical: 'Financial Services',
      maturity: 'advanced',
      teamSize: 10,
      timeline: 'annual',
    });
  },

  compliance: (): CustomFieldsImplementationPlan => {
    return generateImplementationPlan({
      useCases: ['Compliance', 'Lifecycle Management', 'Root Cause Analysis'],
      vertical: 'Healthcare',
      maturity: 'intermediate',
      teamSize: 4,
      timeline: 'quarterly',
    });
  },

  dataMesh: (): CustomFieldsImplementationPlan => {
    return generateImplementationPlan({
      useCases: ['Data Products', 'Data Discovery', 'Impact Analysis'],
      vertical: 'Technology',
      maturity: 'advanced',
      teamSize: 8,
      timeline: 'quarterly',
    });
  },
};

/**
 * Generate custom fields roadmap for stakeholder communication
 */
export function generateCustomFieldsRoadmap(plan: CustomFieldsImplementationPlan): string {
  const weeks = plan.estimatedTimeline.totalWeeks;
  const totalFields = plan.phases.reduce((sum, p) => sum + p.customFields.length, 0);

  return `
# Custom Fields Implementation Roadmap

**Organization:** ${plan.organizationProfile.vertical || 'Multi-vertical'}  
**Maturity Level:** ${plan.organizationProfile.maturity}  
**Timeline:** ${weeks} weeks (${Math.ceil(weeks / 4)} months)  
**Team Size:** ${plan.organizationProfile.teamSize} people  

## Overview
Total Custom Fields: **${totalFields}**  
Estimated Effort: **${Math.round(plan.totalEffortHours)} hours**  

## Phases

${plan.phases
  .map(
    phase => `
### Phase ${plan.phases.indexOf(phase) + 1}: ${phase.phase}
**Duration:** ${phase.durationWeeks} weeks  
**Fields:** ${phase.customFields.length}  

**Custom Fields:**
${phase.customFields.map(f => `- ${f.displayName} (${f.automationStrategy})`).join('\n')}

**Milestones:**
${phase.milestones.map(m => `- ${m}`).join('\n')}

**Success Criteria:**
${phase.successCriteria.map(s => `✓ ${s}`).join('\n')}
`
  )
  .join('\n')}

## Risks & Mitigations

${plan.risks
  .map(
    r => `
**${r.issue}**  
- Probability: ${r.probability} | Impact: ${r.impact}
- Mitigation: ${r.mitigation}
`
  )
  .join('\n')}

## Success Metrics

${plan.successMetrics.map(m => `- **${m.metric}:** ${m.target} (${m.measuredBy})`).join('\n')}
`;
}
