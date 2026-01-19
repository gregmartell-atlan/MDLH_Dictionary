/**
 * Vertical × Pattern Recommendations
 * Section 5.5 from spec v2
 * 
 * Maps industries/verticals to recommended patterns and extra fields.
 * Helps customers in specific verticals know what metadata matters most.
 */

import type { Industry, UseCase, MetadataFieldType } from '../types/metadata-assistant';

export interface VerticalRecommendation {
  vertical: Industry;
  description: string;
  primaryDomains: string[];
  topUseCases: UseCase[];
  extraRecommendedFields: MetadataFieldType[];
  keyPatterns: string[];
  examples: string[];
  reference?: string; // e.g., "Daikin", "Bandwidth", "Raptive"
}

export const VERTICAL_RECOMMENDATIONS: VerticalRecommendation[] = [
  {
    vertical: 'Manufacturing/HVAC',
    description: 'Heavy emphasis on logistics, manufacturing ops, supply chain quality & lineage',
    primaryDomains: ['Logistics', 'Sales', 'Manufacturing', 'Supply Chain'],
    topUseCases: ['Trusted Metrics', 'Root Cause Analysis', 'Impact Analysis', 'Data Discovery'],
    extraRecommendedFields: ['customMetadata', 'lineage', 'certificateStatus'],
    keyPatterns: ['System Type', 'Region', 'Sustainability Rating', 'Heavy lineage + DQ'],
    examples: [
      'Track HVAC system failures across regions → detailed lineage from sensors to dashboards',
      'Trusted metrics: uptime %, efficiency ratings, regional performance comparisons',
    ],
    reference: 'Daikin',
  },
  {
    vertical: 'Technology',
    description: 'Focus on governance, ML/AI readiness, discovery, compliance',
    primaryDomains: ['ML/AI', 'Governance', 'Discovery', 'Platform'],
    topUseCases: ['Data Discovery', 'Compliance', 'Root Cause Analysis', 'Metrics Catalog'],
    extraRecommendedFields: ['customMetadata', 'lineage', 'atlanTags', 'readme'],
    keyPatterns: ['ML-ready metadata', 'Governance workflow', 'AI explainability'],
    examples: [
      'ML dataset: feature definitions, training assumptions, bias risk tags',
      'Governance reviews ensure: owner approved, documented lineage, no PII leakage',
    ],
    reference: 'Bandwidth',
  },
  {
    vertical: 'Retail/E-commerce',
    description: 'Metrics catalog emphasis, business glossary, discovery, compliance, cost',
    primaryDomains: ['E-commerce', 'Marketing', 'Finance', 'SEO'],
    topUseCases: ['Metrics Catalog', 'Data Compliance', 'Data Discovery', 'Cost Optimization'],
    extraRecommendedFields: ['customMetadata', 'certificateStatus', 'glossaryTerms'],
    keyPatterns: ['SEO-specific tags', 'Monte Carlo DQ', 'Exec KPI standards'],
    examples: [
      'Tag tables with SEO domain, content type, currency, refresh frequency',
      'KPI catalog: conversion rate, AOV, customer LTV with daily SLA',
    ],
    reference: 'Raptive',
  },
  {
    vertical: 'Financial Services',
    description: 'Regulatory compliance emphasis, metrics definitions, trusted data, lineage',
    primaryDomains: ['Finance', 'Risk', 'Compliance', 'Reporting'],
    topUseCases: ['Compliance', 'Metrics Catalog', 'Trusted Metrics', 'Data Compliance'],
    extraRecommendedFields: ['customMetadata', 'certificateStatus', 'lineage', 'ownerUsers'],
    keyPatterns: ['Regulatory tags', 'Metrics RACI', 'Financial calculations', 'Audit trails'],
    examples: [
      'Metric: "Balance Sheet Total" → formula, approval chain, regulatory source, audit log',
      'PII tagging: account numbers, SSN → auto-access policies, retention rules',
    ],
  },
  {
    vertical: 'Healthcare',
    description: 'HIPAA compliance, PII protection, audit trails, trust',
    primaryDomains: ['Clinical', 'Claims', 'Patients', 'Compliance'],
    topUseCases: ['Compliance', 'Data Discovery', 'Root Cause Analysis'],
    extraRecommendedFields: ['customMetadata', 'atlanTags', 'certificateStatus', 'lineage'],
    keyPatterns: ['HIPAA-specific tags', 'De-identification status', 'Audit retention'],
    examples: [
      'Patient data: marked as PHI, access logged, retention = 7 years',
      'Clinical trial dataset: IRB approval link, consent tracking, anonymization status',
    ],
  },
  {
    vertical: 'Media/Entertainment',
    description: 'Content metadata, usage metrics, cost per asset, discovery',
    primaryDomains: ['Content', 'Audience', 'Performance', 'Advertising'],
    topUseCases: ['Metrics Catalog', 'Data Discovery', 'Cost Optimization', 'Lifecycle Management'],
    extraRecommendedFields: ['customMetadata', 'links', 'glossaryTerms'],
    keyPatterns: ['Content types', 'Usage stats', 'Revenue attribution', 'Deprecation tracking'],
    examples: [
      'Video metadata: format, duration, quality, CDN cost, streaming views',
      'Audience metric: monthly uniques, engagement rate, cost per view',
    ],
  },
  {
    vertical: 'Telecommunications',
    description: 'Network data, customer analytics, compliance, operational metrics',
    primaryDomains: ['Network', 'Customer', 'Billing', 'Operations'],
    topUseCases: ['Metrics Catalog', 'Data Discovery', 'Compliance'],
    extraRecommendedFields: ['customMetadata', 'certificateStatus', 'lineage'],
    keyPatterns: ['Network topology', 'Customer segments', 'Billing tags', 'SLA tracking'],
    examples: [
      'Network metric: latency, packet loss by region, SLA = 99.5%',
      'Customer data: segments, churn risk, regulatory classification',
    ],
  },
  {
    vertical: 'Other',
    description: 'General-purpose metadata model (DaaP dimensions)',
    primaryDomains: [],
    topUseCases: ['Data Discovery', 'Metrics Catalog'],
    extraRecommendedFields: ['description', 'ownerUsers', 'glossaryTerms'],
    keyPatterns: ['Standard DaaP', 'User-driven'],
    examples: [],
  },
];

/**
 * Get recommendations for a specific vertical
 */
export function getVerticalRecommendation(vertical: Industry): VerticalRecommendation | undefined {
  return VERTICAL_RECOMMENDATIONS.find(v => v.vertical === vertical);
}

/**
 * Get all recommended fields for a vertical
 */
export function getFieldsForVertical(vertical: Industry): MetadataFieldType[] {
  const rec = getVerticalRecommendation(vertical);
  if (!rec) return [];
  return rec.extraRecommendedFields;
}

/**
 * Get top use cases for a vertical
 */
export function getUseCasesForVertical(vertical: Industry): UseCase[] {
  const rec = getVerticalRecommendation(vertical);
  if (!rec) return [];
  return rec.topUseCases;
}

/**
 * Match industry to reference implementation
 */
export function getReferenceImplementation(vertical: Industry): string | undefined {
  const rec = getVerticalRecommendation(vertical);
  return rec?.reference;
}

/**
 * Get quick reference: Vertical → (Domains, UseCases, Fields)
 */
export function getVerticalQuickReference(vertical: Industry): {
  domains: string[];
  useCases: UseCase[];
  fields: MetadataFieldType[];
  patterns: string[];
} {
  const rec = getVerticalRecommendation(vertical);
  if (!rec) {
    return { domains: [], useCases: [], fields: [], patterns: [] };
  }
  
  return {
    domains: rec.primaryDomains,
    useCases: rec.topUseCases,
    fields: rec.extraRecommendedFields,
    patterns: rec.keyPatterns,
  };
}

/**
 * Generate vertical summary for documentation
 */
export function generateVerticalSummary(vertical: Industry): string {
  const rec = getVerticalRecommendation(vertical);
  if (!rec) return '';
  
  return `
# ${rec.vertical}

**Focus:** ${rec.description}

**Domains:** ${rec.primaryDomains.join(', ')}

**Top Use Cases:**
${rec.topUseCases.map(uc => `- ${uc}`).join('\n')}

**Key Patterns:**
${rec.keyPatterns.map(p => `- ${p}`).join('\n')}

**Extra Fields to Prioritize:**
${rec.extraRecommendedFields.join(', ')}

**Examples:**
${rec.examples.map(ex => `- ${ex}`).join('\n')}
${rec.reference ? `\n**Reference:** Atlan has experience with ${rec.vertical} via **${rec.reference}** implementation.` : ''}
`;
}

/**
 * Get all verticals with their reference implementations
 */
export function getVerticalsByReference(): Record<string, Industry[]> {
  const byRef: Record<string, Industry[]> = {};
  
  VERTICAL_RECOMMENDATIONS.forEach(rec => {
    if (rec.reference) {
      if (!byRef[rec.reference]) {
        byRef[rec.reference] = [];
      }
      byRef[rec.reference].push(rec.vertical);
    }
  });
  
  return byRef;
}
