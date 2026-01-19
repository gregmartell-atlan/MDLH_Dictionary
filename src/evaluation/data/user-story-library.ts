/**
 * User Story Library
 * 
 * Embedded user stories from customer templates:
 * - Bandwidth Metadata Modeling Template
 * - Daikin Template
 * - Master Template
 * - Raptive PS Workbook
 */

import type { UserStory } from '../types/metadata-assistant';

export const USER_STORY_LIBRARY: UserStory[] = [
  // ============================================
  // GOVERNANCE & STEWARDSHIP
  // ============================================
  {
    id: 'us-001',
    role: 'Data Steward',
    persona: 'Data Steward',
    domain: 'Governance',
    desire: 'add data quality scores and privacy tags to datasets',
    reason: 'people do not use inappropriate data in their reports',
    outcome: 'Reduced compliance violations and increased trust in reporting',
    textFull: 'As a data steward, I want to add data quality scores and privacy tags to datasets, so that people do not use inappropriate data in their reports.',
    daapDimensions: ['Secure', 'Trustworthy'],
    daapUnlock: 'Secure',
    ootbCapabilities: ['atlanTags', 'customMetadata'],
    antiPatternRisk: 'Inconsistent tagging across domains; no verification workflow',
    recommendedPatterns: ['Compliance'],
    pattern: 'Compliance',
    source: 'bandwidth',
  },
  {
    id: 'us-002',
    role: 'Data Steward',
    persona: 'Data Steward',
    domain: 'Governance',
    desire: 'a clear workflow for approving and enriching metadata',
    reason: 'business users can confidently use well-documented, high-quality data',
    outcome: 'Certified datasets with verified metadata',
    textFull: 'As a data steward, I want a clear workflow for approving and enriching metadata, so that business users can confidently use well-documented, high-quality data.',
    daapDimensions: ['Trustworthy', 'Understandable'],
    daapUnlock: 'Trustworthy',
    ootbCapabilities: ['customMetadata', 'accessPolicies', 'ownerUsers'],
    antiPatternRisk: 'Ad-hoc approvals without documented standards',
    recommendedPatterns: ['Standards'],
    pattern: 'Standards',
    source: 'master-template',
  },
  {
    id: 'us-003',
    role: 'Metadata Librarian',
    domain: 'Governance',
    desire: 'organize and categorize datasets systematically',
    reason: 'we can maintain consistency across the organization',
    textFull: 'As a metadata librarian, I want to organize and categorize datasets systematically, so that we can maintain consistency across the organization.',
    daapDimensions: ['Discoverable', 'Understandable'],
    ootbCapabilities: ['atlanTags', 'customMetadata', 'glossaryTerms'],
    pattern: 'Standards',
    source: 'bandwidth',
  },
  {
    id: 'us-004',
    role: 'Data Governance Lead',
    domain: 'Governance',
    desire: 'view lifecycle / retirement dates of datasets',
    reason: 'we can plan for deprecation and avoid using stale data',
    textFull: 'As a data governance lead, I want to view lifecycle / retirement dates of datasets, so that we can plan for deprecation and avoid using stale data.',
    daapDimensions: ['Trustworthy'],
    ootbCapabilities: ['customMetadata', 'certificateStatus'],
    pattern: 'Incident Comms',
    source: 'bandwidth',
  },

  // ============================================
  // DISCOVERY & UNDERSTANDING
  // ============================================
  {
    id: 'us-005',
    role: 'Business User',
    persona: 'Data Analyst',
    domain: 'Discovery',
    desire: 'define simple, clear terms for key concepts across the company',
    reason: 'everyone uses the same language when discussing data',
    outcome: 'Reduced confusion and aligned cross-team collaboration',
    textFull: 'As a business user, I want to define simple, clear terms for key concepts across the company, so that everyone uses the same language when discussing data.',
    daapDimensions: ['Discoverable', 'Understandable'],
    daapUnlock: 'Understandable',
    ootbCapabilities: ['glossaryTerms'],
    antiPatternRisk: 'Having 47 different definitions of "Customer" across departments',
    recommendedPatterns: ['Standards'],
    pattern: 'Standards',
    source: 'bandwidth',
  },
  {
    id: 'us-006',
    role: 'Analyst',
    domain: 'Discovery',
    desire: 'search for datasets using business terms, not technical jargon',
    reason: 'I can find the data I need without knowing the database schema',
    textFull: 'As an analyst, I want to search for datasets using business terms, not technical jargon, so that I can find the data I need without knowing the database schema.',
    daapDimensions: ['Discoverable'],
    ootbCapabilities: ['glossaryTerms', 'description'],
    pattern: 'Quick Discovery',
    source: 'bandwidth',
  },
  {
    id: 'us-007',
    role: 'Project Manager',
    domain: 'Discovery',
    desire: 'add metadata about project datasets to reduce redundant questions',
    reason: 'team members can self-serve instead of interrupting me',
    textFull: 'As a project manager, I want to add metadata about project datasets to reduce redundant questions, so that team members can self-serve instead of interrupting me.',
    daapDimensions: ['Discoverable', 'Understandable'],
    ootbCapabilities: ['description', 'links', 'glossaryTerms'],
    pattern: 'Quick Discovery',
    source: 'bandwidth',
  },

  // ============================================
  // FINANCE & ANALYTICS
  // ============================================
  {
    id: 'us-008',
    role: 'Finance Analyst',
    domain: 'Finance',
    desire: 'a reliable way to reconcile financial data from multiple systems',
    reason: 'we can close the books faster and with fewer errors',
    textFull: 'As a finance analyst, I want a reliable way to reconcile financial data from multiple systems, so that we can close the books faster and with fewer errors.',
    daapDimensions: ['Interoperable', 'Trustworthy'],
    ootbCapabilities: ['lineage', 'description', 'glossaryTerms'],
    pattern: 'Trusted Metrics',
    source: 'master-template',
  },
  {
    id: 'us-009',
    role: 'Business Analyst',
    domain: 'Analytics',
    desire: 'flag fields with identical names but different calculations',
    reason: 'reports use the correct metric definition',
    textFull: 'As a business analyst, I want to flag fields with identical names but different calculations, so that reports use the correct metric definition.',
    daapDimensions: ['Understandable', 'Trustworthy'],
    ootbCapabilities: ['glossaryTerms', 'customMetadata'],
    pattern: 'Trusted Metrics',
    source: 'bandwidth',
  },

  // ============================================
  // SALES & MARKETING
  // ============================================
  {
    id: 'us-010',
    role: 'Sales Manager',
    domain: 'Sales',
    desire: 'a single source of truth for customer account data',
    reason: 'our sales team can personalize outreach and close deals faster',
    textFull: 'As a sales manager, I want a single source of truth for customer account data, so that our sales team can personalize outreach and close deals faster.',
    daapDimensions: ['Discoverable', 'Trustworthy'],
    ootbCapabilities: ['certificateStatus', 'description'],
    pattern: 'Trusted Metrics',
    source: 'master-template',
  },
  {
    id: 'us-011',
    role: 'Marketing Analyst',
    domain: 'Marketing',
    desire: 'understand customer purchase history data',
    reason: 'I can identify segments for campaigns',
    textFull: 'As a marketing analyst, I want to understand customer purchase history data, so that I can identify segments for campaigns.',
    daapDimensions: ['Understandable', 'Discoverable'],
    ootbCapabilities: ['glossaryTerms', 'description'],
    pattern: 'Quick Discovery',
    industry: 'Manufacturing/HVAC',
    source: 'daikin',
  },

  // ============================================
  // DATA ENGINEERING
  // ============================================
  {
    id: 'us-012',
    role: 'Data Engineer',
    domain: 'Engineering',
    desire: 'a standardized tagging system for datasets',
    reason: 'teams can easily discover and reuse existing data assets',
    textFull: 'As a data engineer, I want a standardized tagging system for datasets, so that teams can easily discover and reuse existing data assets.',
    daapDimensions: ['Discoverable', 'Interoperable'],
    ootbCapabilities: ['certificateStatus', 'atlanTags', 'customMetadata'],
    pattern: 'Standards',
    source: 'master-template',
  },
  {
    id: 'us-013',
    role: 'Data Engineer',
    domain: 'Engineering',
    desire: 'trace data lineage end-to-end',
    reason: 'I can perform impact analysis before making changes',
    textFull: 'As a data engineer, I want to trace data lineage end-to-end, so that I can perform impact analysis before making changes.',
    daapDimensions: ['Interoperable'],
    ootbCapabilities: ['lineage'],
    pattern: 'Root Cause',
    source: 'bandwidth',
  },

  // ============================================
  // DATA SCIENCE & ML
  // ============================================
  {
    id: 'us-014',
    role: 'Data Scientist',
    domain: 'Data Science',
    desire: 'create metadata for ML models and training data',
    reason: 'others can reuse and troubleshoot models',
    textFull: 'As a data scientist, I want to create metadata for ML models and training data, so that others can reuse and troubleshoot models.',
    daapDimensions: ['Discoverable', 'Interoperable', 'Understandable'],
    ootbCapabilities: ['customMetadata', 'lineage'],
    pattern: 'Data Product',
    source: 'bandwidth',
  },

  // ============================================
  // COMPLIANCE & SECURITY
  // ============================================
  {
    id: 'us-015',
    role: 'Compliance Officer',
    domain: 'Compliance',
    desire: 'track legal/compliance-related metadata and PII',
    reason: 'we can demonstrate compliance during audits',
    textFull: 'As a compliance officer, I want to track legal/compliance-related metadata and PII, so that we can demonstrate compliance during audits.',
    daapDimensions: ['Secure'],
    ootbCapabilities: ['atlanTags', 'customMetadata', 'accessPolicies'],
    pattern: 'Compliance',
    source: 'bandwidth',
  },
  {
    id: 'us-016',
    role: 'Security Analyst',
    domain: 'Security',
    desire: 'identify all datasets containing sensitive information',
    reason: 'we can apply appropriate access controls',
    textFull: 'As a security analyst, I want to identify all datasets containing sensitive information, so that we can apply appropriate access controls.',
    daapDimensions: ['Secure'],
    ootbCapabilities: ['atlanTags', 'accessPolicies'],
    pattern: 'Compliance',
    source: 'bandwidth',
  },

  // ============================================
  // REPORTING & BI
  // ============================================
  {
    id: 'us-017',
    role: 'Report Developer',
    domain: 'BI',
    desire: 'link reports to underlying datasets and metadata',
    reason: 'consumers can trace report calculations back to source data',
    textFull: 'As a report developer, I want to link reports to underlying datasets and metadata, so that consumers can trace report calculations back to source data.',
    daapDimensions: ['Discoverable', 'Interoperable'],
    ootbCapabilities: ['lineage', 'glossaryTerms'],
    pattern: 'Trusted Metrics',
    source: 'bandwidth',
  },
  {
    id: 'us-018',
    role: 'Dashboard Owner',
    domain: 'BI',
    desire: 'certify dashboards as official sources of truth',
    reason: 'users know which dashboards to trust for decision-making',
    textFull: 'As a dashboard owner, I want to certify dashboards as official sources of truth, so that users know which dashboards to trust for decision-making.',
    daapDimensions: ['Trustworthy'],
    ootbCapabilities: ['certificateStatus', 'ownerUsers'],
    pattern: 'Trusted Metrics',
    source: 'bandwidth',
  },

  // ============================================
  // COLLABORATION
  // ============================================
  {
    id: 'us-019',
    role: 'Product Owner',
    domain: 'Collaboration',
    desire: 'gather user feedback on metadata quality',
    reason: 'we can continuously improve data documentation',
    textFull: 'As a product owner, I want to gather user feedback on metadata quality, so that we can continuously improve data documentation.',
    daapDimensions: ['Natively accessible'],
    ootbCapabilities: ['links'],
    pattern: 'Data Product',
    source: 'bandwidth',
  },
  {
    id: 'us-020',
    role: 'Team Lead',
    domain: 'Collaboration',
    desire: 'receive notifications when important datasets change',
    reason: 'my team can respond quickly to data issues',
    textFull: 'As a team lead, I want to receive notifications when important datasets change, so that my team can respond quickly to data issues.',
    daapDimensions: ['Natively accessible'],
    ootbCapabilities: ['links', 'ownerUsers'],
    pattern: 'Incident Comms',
    source: 'bandwidth',
  },
];

/**
 * Get user stories filtered by criteria
 */
export function filterUserStories(criteria: {
  industry?: string;
  domain?: string;
  pattern?: string;
  source?: string;
}): UserStory[] {
  return USER_STORY_LIBRARY.filter(story => {
    if (criteria.industry && story.industry !== criteria.industry) return false;
    if (criteria.domain && story.domain !== criteria.domain) return false;
    if (criteria.pattern && story.pattern !== criteria.pattern) return false;
    if (criteria.source && story.source !== criteria.source) return false;
    return true;
  });
}

/**
 * Get recommended user stories based on use cases
 */
export function getRecommendedUserStories(useCases: string[]): UserStory[] {
  const recommendations: UserStory[] = [];
  
  useCases.forEach(useCase => {
    switch (useCase) {
      case 'Data Discovery':
        recommendations.push(
          ...USER_STORY_LIBRARY.filter(s => 
            s.pattern === 'Quick Discovery' || s.domain === 'Discovery'
          )
        );
        break;
      case 'Trusted Metrics':
        recommendations.push(
          ...USER_STORY_LIBRARY.filter(s => 
            s.pattern === 'Trusted Metrics'
          )
        );
        break;
      case 'Compliance':
      case 'Data Compliance':
        recommendations.push(
          ...USER_STORY_LIBRARY.filter(s => 
            s.pattern === 'Compliance' || s.domain === 'Compliance' || s.domain === 'Security'
          )
        );
        break;
      case 'Root Cause Analysis':
        recommendations.push(
          ...USER_STORY_LIBRARY.filter(s => 
            s.pattern === 'Root Cause'
          )
        );
        break;
      case 'Data Products':
        recommendations.push(
          ...USER_STORY_LIBRARY.filter(s => 
            s.pattern === 'Data Product'
          )
        );
        break;
    }
  });
  
  // Remove duplicates
  const unique = recommendations.reduce((acc, story) => {
    if (!acc.find(s => s.id === story.id)) {
      acc.push(story);
    }
    return acc;
  }, [] as UserStory[]);
  
  return unique;
}
