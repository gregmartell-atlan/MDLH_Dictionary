/**
 * Outcome Metrics Templates
 * 
 * Standard metrics for tracking metadata enrichment success,
 * based on Daikin and Raptive implementations.
 */

import type { MetadataPattern, OutcomeMetric } from '../types/metadata-assistant';

export const OUTCOME_METRICS: OutcomeMetric[] = [
  // ============================================
  // ENRICHMENT PROGRESS
  // ============================================
  {
    id: 'metric-assets-enriched',
    name: 'Assets Enriched',
    category: 'Enrichment Progress',
    description: 'Total number of assets with baseline metadata',
    baseline: '0',
    target: '225',
    unit: 'assets',
    measurementMethod: 'Count of assets with completeness score > 0',
    frequency: 'weekly',
    relatedPatterns: ['Quick Discovery', 'Trusted Metrics', 'Compliance'],
  },
  {
    id: 'metric-avg-completeness',
    name: 'Average Completeness Score',
    category: 'Completeness Score',
    description: 'Average completeness score across all enriched assets',
    baseline: '15',
    target: '80',
    unit: 'points (out of 100)',
    measurementMethod: 'Weighted average of metadata field presence',
    frequency: 'weekly',
    relatedPatterns: ['Quick Discovery', 'Trusted Metrics'],
  },
  {
    id: 'metric-certified-assets',
    name: 'Certified Assets',
    category: 'Enrichment Progress',
    description: 'Number of assets with VERIFIED certificate',
    baseline: '0',
    target: '100',
    unit: 'assets',
    measurementMethod: 'Count of assets with VERIFIED certificate status',
    frequency: 'sprint',
    relatedPatterns: ['Trusted Metrics', 'Data Product'],
  },

  // ============================================
  // TIME TO DATA
  // ============================================
  {
    id: 'metric-time-to-find',
    name: 'Time to Find Data',
    category: 'Time to Data',
    description: 'Average time for users to find relevant data assets',
    baseline: '30+',
    target: '<5',
    unit: 'minutes',
    measurementMethod: 'User survey + analytics on search-to-click time',
    frequency: 'monthly',
    relatedPatterns: ['Quick Discovery'],
  },
  {
    id: 'metric-search-success-rate',
    name: 'Search Success Rate',
    category: 'Discovery',
    description: 'Percentage of searches that result in asset access',
    baseline: '40',
    target: '80',
    unit: '%',
    measurementMethod: 'Analytics: (searches with clicks) / (total searches)',
    frequency: 'weekly',
    relatedPatterns: ['Quick Discovery'],
  },

  // ============================================
  // SUPPORT & SATISFACTION
  // ============================================
  {
    id: 'metric-support-tickets',
    name: 'Support Tickets per Month',
    category: 'Support Tickets',
    description: 'Data-related support tickets (ownership, access, understanding)',
    baseline: '50',
    target: '<20',
    unit: 'tickets/month',
    measurementMethod: 'Count of tickets tagged "data catalog" or "data access"',
    frequency: 'monthly',
    relatedPatterns: ['Quick Discovery', 'Compliance'],
  },
  {
    id: 'metric-user-satisfaction',
    name: 'User Satisfaction Score',
    category: 'User Satisfaction',
    description: 'User satisfaction with data discovery experience',
    baseline: '2.2',
    target: '4.0',
    unit: 'rating (1-5 scale)',
    measurementMethod: 'Quarterly user survey: "How satisfied are you with data discovery?"',
    frequency: 'monthly',
    relatedPatterns: ['Quick Discovery', 'Data Product'],
  },
  {
    id: 'metric-self-service-rate',
    name: 'Self-Service Success Rate',
    category: 'Self-Service Rate',
    description: 'Percentage of data requests fulfilled without intervention',
    baseline: '40',
    target: '80',
    unit: '%',
    measurementMethod: '(Self-served requests) / (Total requests)',
    frequency: 'monthly',
    relatedPatterns: ['Quick Discovery', 'Data Product'],
  },

  // ============================================
  // GOVERNANCE & COMPLIANCE
  // ============================================
  {
    id: 'metric-pii-coverage',
    name: 'PII Classification Coverage',
    category: 'Compliance',
    description: 'Percentage of PII columns with classification tags',
    baseline: '20',
    target: '95',
    unit: '%',
    measurementMethod: 'Manual audit + automated pattern detection validation',
    frequency: 'sprint',
    relatedPatterns: ['Compliance'],
  },
  {
    id: 'metric-ownership-coverage',
    name: 'Ownership Coverage',
    category: 'Enrichment Progress',
    description: 'Percentage of business-critical assets with assigned owners',
    baseline: '25',
    target: '95',
    unit: '%',
    measurementMethod: '(Assets with ownerUsers) / (Business-critical assets)',
    frequency: 'weekly',
    relatedPatterns: ['Quick Discovery', 'Compliance', 'Root Cause'],
  },
  {
    id: 'metric-access-policy-coverage',
    name: 'Access Policy Coverage',
    category: 'Compliance',
    description: 'Percentage of sensitive assets with access policies',
    baseline: '10',
    target: '100',
    unit: '%',
    measurementMethod: '(Sensitive assets with policies) / (All sensitive assets)',
    frequency: 'sprint',
    relatedPatterns: ['Compliance'],
  },

  // ============================================
  // GLOSSARY & STANDARDS
  // ============================================
  {
    id: 'metric-glossary-terms',
    name: 'Active Glossary Terms',
    category: 'Glossary',
    description: 'Number of glossary terms with asset links',
    baseline: '0',
    target: '50',
    unit: 'terms',
    measurementMethod: 'Count of glossary terms with >0 linked assets',
    frequency: 'sprint',
    relatedPatterns: ['Trusted Metrics', 'Standards'],
  },
  {
    id: 'metric-glossary-linkage',
    name: 'Glossary Linkage Rate',
    category: 'Glossary',
    description: 'Percentage of business-critical assets linked to glossary',
    baseline: '5',
    target: '70',
    unit: '%',
    measurementMethod: '(Assets with glossary links) / (Business-critical assets)',
    frequency: 'sprint',
    relatedPatterns: ['Trusted Metrics', 'Standards'],
  },

  // ============================================
  // LINEAGE & ROOT CAUSE
  // ============================================
  {
    id: 'metric-lineage-completeness',
    name: 'Lineage Completeness',
    category: 'RCA',
    description: 'Percentage of assets with upstream/downstream lineage',
    baseline: '60',
    target: '95',
    unit: '%',
    measurementMethod: 'Automated lineage extraction validation',
    frequency: 'monthly',
    relatedPatterns: ['Root Cause', 'Trusted Metrics'],
  },
  {
    id: 'metric-incident-resolution-time',
    name: 'Incident Resolution Time',
    category: 'RCA',
    description: 'Average time to resolve data quality incidents',
    baseline: '4',
    target: '<2',
    unit: 'hours',
    measurementMethod: 'Time from incident alert to resolution (tracked in incident system)',
    frequency: 'monthly',
    relatedPatterns: ['Root Cause', 'Incident Comms'],
  },

  // ============================================
  // IMPACT ANALYSIS
  // ============================================
  {
    id: 'metric-impact-analysis-time',
    name: 'Impact Analysis Time',
    category: 'Impact Analysis',
    description: 'Time to assess downstream impact of schema changes',
    baseline: '2',
    target: '<0.5',
    unit: 'hours',
    measurementMethod: 'Survey of data engineers: time spent on impact analysis',
    frequency: 'monthly',
    relatedPatterns: ['Root Cause'],
  },

  // ============================================
  // COST OPTIMIZATION
  // ============================================
  {
    id: 'metric-unused-assets-identified',
    name: 'Unused Assets Identified',
    category: 'Cost Optimization',
    description: 'Number of assets identified for deprecation (0 queries in 90 days)',
    baseline: '0',
    target: '50',
    unit: 'assets',
    measurementMethod: 'Query analysis: assets with 0 queries in past 90 days',
    frequency: 'monthly',
    relatedPatterns: ['Incident Comms'],
  },
];

/**
 * Get metrics for a specific pattern
 */
export function getMetricsForPattern(pattern: MetadataPattern): OutcomeMetric[] {
  return OUTCOME_METRICS.filter((metric) => metric.relatedPatterns.includes(pattern));
}

/**
 * Get metrics by category
 */
export function getMetricsByCategory(category: string): OutcomeMetric[] {
  return OUTCOME_METRICS.filter(metric => metric.category === category);
}

/**
 * Generate default metrics for a project based on use cases
 */
export function generateProjectMetrics(useCases: string[]): OutcomeMetric[] {
  const selectedMetrics: OutcomeMetric[] = [];

  // Always include core enrichment metrics
  selectedMetrics.push(
    ...OUTCOME_METRICS.filter(m => 
      m.category === 'Enrichment Progress' || m.category === 'Completeness Score'
    )
  );

  // Add metrics based on use cases
  useCases.forEach(useCase => {
    switch (useCase) {
      case 'Data Discovery':
        selectedMetrics.push(
          ...OUTCOME_METRICS.filter(m => 
            m.category === 'Discovery' || m.category === 'Time to Data'
          )
        );
        break;
      case 'Trusted Metrics':
      case 'Metrics Catalog':
        selectedMetrics.push(
          ...OUTCOME_METRICS.filter(m => 
            m.category === 'Glossary' || m.category === 'Metrics Catalog'
          )
        );
        break;
      case 'Compliance':
      case 'Data Compliance':
        selectedMetrics.push(
          ...OUTCOME_METRICS.filter(m => m.category === 'Compliance')
        );
        break;
      case 'Root Cause Analysis':
        selectedMetrics.push(
          ...OUTCOME_METRICS.filter(m => 
            m.category === 'RCA' || m.category === 'Impact Analysis'
          )
        );
        break;
      case 'Cost Optimization':
        selectedMetrics.push(
          ...OUTCOME_METRICS.filter(m => m.category === 'Cost Optimization')
        );
        break;
    }
  });

  // Remove duplicates
  const unique = selectedMetrics.reduce((acc, metric) => {
    if (!acc.find(m => m.id === metric.id)) {
      acc.push(metric);
    }
    return acc;
  }, [] as OutcomeMetric[]);

  return unique;
}
