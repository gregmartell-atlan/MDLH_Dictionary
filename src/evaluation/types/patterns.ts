/**
 * Pattern Templates
 *
 * Pre-built metadata model patterns for common use cases.
 * Each pattern defines which fields are required/recommended.
 */

import type { MetadataFieldType, RequirementType, PatternType } from './metadata-fields';

// ============================================
// PATTERN TEMPLATE TYPES
// ============================================

export interface PatternTemplate {
  id: PatternType;
  name: string;
  description: string;
  useCase: string;
  fields: PatternField[];
  suggestedTimeline: string;
  prerequisites: string[];
  personas: string[];
  outcomes: string[];
}

export interface PatternField {
  field: MetadataFieldType;
  requirement: RequirementType;
  rationale: string;
}

// ============================================
// PATTERN TEMPLATES
// ============================================

export const PATTERN_TEMPLATES: PatternTemplate[] = [
  {
    id: 'quick-discovery',
    name: 'Quick Discovery',
    description: 'Enable users to find and understand data assets quickly',
    useCase: 'Organizations prioritizing self-service data discovery',
    suggestedTimeline: '4-6 weeks',
    prerequisites: [],
    personas: ['analyst', 'data-engineer'],
    outcomes: [
      'Reduced time-to-data for analysts',
      'Fewer "who owns this?" Slack messages',
      'Better search results in catalog',
    ],
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
    personas: ['analyst', 'executive', 'data-steward'],
    outcomes: [
      'One definition per metric',
      'Clear ownership of KPI calculations',
      'Audit trail for metric changes',
    ],
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
    personas: ['data-steward', 'executive'],
    outcomes: [
      'Audit-ready documentation',
      'Automated compliance reporting',
      'Reduced risk of regulatory fines',
    ],
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
    personas: ['data-engineer'],
    outcomes: [
      'Faster incident resolution',
      'Clear escalation paths',
      'Impact analysis before changes',
    ],
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
    personas: ['data-engineer', 'data-steward', 'analyst'],
    outcomes: [
      'Productized, consumable data',
      'Clear SLAs and expectations',
      'Self-service access requests',
    ],
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
// QUESTIONNAIRE TYPES
// ============================================

export interface QuestionnaireQuestion {
  id: string;
  question: string;
  options: QuestionnaireOption[];
  multiSelect: boolean;
}

export interface QuestionnaireOption {
  id: string;
  label: string;
  description: string;
  patternsToBoost: PatternType[];
  fieldsToRequire?: MetadataFieldType[];
}

export const QUESTIONNAIRE_QUESTIONS: QuestionnaireQuestion[] = [
  {
    id: 'primary-goal',
    question: "What's your primary goal?",
    multiSelect: false,
    options: [
      {
        id: 'find-data',
        label: 'Help people find data faster',
        description: 'Improve search and discovery experience',
        patternsToBoost: ['quick-discovery'],
        fieldsToRequire: ['description', 'ownerUsers'],
      },
      {
        id: 'pass-audits',
        label: 'Pass regulatory audits',
        description: 'GDPR, HIPAA, SOX, or internal compliance',
        patternsToBoost: ['compliance-ready'],
        fieldsToRequire: ['atlanTags', 'ownerUsers', 'accessPolicies'],
      },
      {
        id: 'fix-metrics',
        label: 'Fix inconsistent metrics',
        description: 'Multiple definitions of the same KPI',
        patternsToBoost: ['trusted-metrics'],
        fieldsToRequire: ['glossaryTerms', 'certificateStatus'],
      },
      {
        id: 'debug-issues',
        label: 'Debug data issues faster',
        description: 'Root cause analysis and impact assessment',
        patternsToBoost: ['root-cause-analysis'],
        fieldsToRequire: ['lineage', 'ownerUsers'],
      },
      {
        id: 'data-products',
        label: 'Build data products',
        description: 'Internal marketplace or data mesh',
        patternsToBoost: ['data-product'],
        fieldsToRequire: ['readme', 'certificateStatus', 'glossaryTerms'],
      },
    ],
  },
  {
    id: 'team-size',
    question: 'How large is your data team?',
    multiSelect: false,
    options: [
      {
        id: 'small',
        label: 'Small (1-10)',
        description: 'Centralized, everyone knows everyone',
        patternsToBoost: ['quick-discovery'],
      },
      {
        id: 'medium',
        label: 'Medium (10-50)',
        description: 'Starting to need formal processes',
        patternsToBoost: ['quick-discovery', 'trusted-metrics'],
      },
      {
        id: 'large',
        label: 'Large (50+)',
        description: 'Federated teams, formal governance needed',
        patternsToBoost: ['compliance-ready', 'data-product'],
      },
    ],
  },
  {
    id: 'maturity',
    question: 'Where are you on the governance journey?',
    multiSelect: false,
    options: [
      {
        id: 'starting',
        label: 'Just starting',
        description: 'Little to no metadata today',
        patternsToBoost: ['quick-discovery'],
      },
      {
        id: 'scaling',
        label: 'Scaling up',
        description: 'Some metadata, need consistency',
        patternsToBoost: ['trusted-metrics', 'compliance-ready'],
      },
      {
        id: 'optimizing',
        label: 'Optimizing',
        description: 'Good coverage, need refinement',
        patternsToBoost: ['data-product', 'root-cause-analysis'],
      },
    ],
  },
  {
    id: 'pain-points',
    question: 'What are your biggest pain points? (Select all that apply)',
    multiSelect: true,
    options: [
      {
        id: 'no-owners',
        label: 'Nobody owns the data',
        description: 'Questions go unanswered',
        patternsToBoost: ['quick-discovery', 'compliance-ready'],
        fieldsToRequire: ['ownerUsers', 'ownerGroups'],
      },
      {
        id: 'no-descriptions',
        label: "Can't understand what data means",
        description: 'Cryptic column names, no context',
        patternsToBoost: ['quick-discovery'],
        fieldsToRequire: ['description', 'glossaryTerms'],
      },
      {
        id: 'no-lineage',
        label: "Don't know where data comes from",
        description: 'Impact analysis is guesswork',
        patternsToBoost: ['root-cause-analysis'],
        fieldsToRequire: ['lineage'],
      },
      {
        id: 'no-trust',
        label: "Don't know what to trust",
        description: 'Multiple versions, no certification',
        patternsToBoost: ['trusted-metrics', 'data-product'],
        fieldsToRequire: ['certificateStatus'],
      },
      {
        id: 'compliance-risk',
        label: 'Compliance risk',
        description: 'PII exposure, audit concerns',
        patternsToBoost: ['compliance-ready'],
        fieldsToRequire: ['atlanTags', 'accessPolicies'],
      },
    ],
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getPatternById(id: PatternType): PatternTemplate | undefined {
  return PATTERN_TEMPLATES.find(p => p.id === id);
}

export function getRequiredFields(pattern: PatternTemplate): MetadataFieldType[] {
  return pattern.fields
    .filter(f => f.requirement === 'required')
    .map(f => f.field);
}

export function getRecommendedFields(pattern: PatternTemplate): MetadataFieldType[] {
  return pattern.fields
    .filter(f => f.requirement === 'recommended')
    .map(f => f.field);
}

export function scorePatternMatch(
  pattern: PatternTemplate,
  answers: Record<string, string | string[]>
): number {
  let score = 0;

  for (const [questionId, answer] of Object.entries(answers)) {
    const question = QUESTIONNAIRE_QUESTIONS.find(q => q.id === questionId);
    if (!question) continue;

    const selectedIds = Array.isArray(answer) ? answer : [answer];
    for (const selectedId of selectedIds) {
      const option = question.options.find(o => o.id === selectedId);
      if (option?.patternsToBoost.includes(pattern.id)) {
        score += 10;
      }
    }
  }

  return score;
}

export function recommendPatterns(
  answers: Record<string, string | string[]>
): PatternTemplate[] {
  const scored = PATTERN_TEMPLATES.map(pattern => ({
    pattern,
    score: scorePatternMatch(pattern, answers),
  }));

  return scored
    .sort((a, b) => b.score - a.score)
    .map(s => s.pattern);
}
