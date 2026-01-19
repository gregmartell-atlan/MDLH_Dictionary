/**
 * Use Case × Field Recommendations
 * Section 5.2 from spec v2
 * 
 * Maps each use case to must-have, nice-to-have, and pattern fields.
 * This drives metadata model recommendations.
 */

import type { UseCase, MetadataFieldType } from '../types/metadata-assistant';

export interface UseCaseFieldRecommendation {
  useCase: UseCase;
  description: string;
  mustHaveFields: MetadataFieldType[];
  niceToHaveFields: MetadataFieldType[];
  typicalAssetTypes: string[];
  typicalVerticals: string[];
  examples: string[];
}

export const USE_CASE_FIELD_RECOMMENDATIONS: UseCaseFieldRecommendation[] = [
  {
    useCase: 'Data Discovery',
    description: 'Find & understand relevant data quickly',
    mustHaveFields: ['description', 'ownerUsers', 'atlanTags', 'certificateStatus', 'glossaryTerms'],
    niceToHaveFields: ['customMetadata', 'readme', 'links', 'lineage'],
    typicalAssetTypes: ['Table', 'View', 'Dashboard'],
    typicalVerticals: ['All', 'Raptive', 'Vimeo'],
    examples: [
      'Business user searches "customer revenue" → finds Customer table via glossary term',
      'Analyst browses Sales domain → discovers certified, documented tables',
    ],
  },
  {
    useCase: 'Metrics Catalog',
    description: 'Single source of truth for KPIs & calculations',
    mustHaveFields: ['description', 'ownerUsers', 'glossaryTerms', 'certificateStatus', 'customMetadata'],
    niceToHaveFields: ['readme', 'links', 'lineage'],
    typicalAssetTypes: ['Glossary Term (Metric)', 'Dashboard'],
    typicalVerticals: ['Finance', 'Executive Reporting', 'SaaS'],
    examples: [
      'CFO checks metric definition → sees formula, RACI, last updated',
      'Analyst links dashboard to core metric term → confirms alignment',
    ],
  },
  {
    useCase: 'Compliance',
    description: 'Protect sensitive data & reduce regulatory risk',
    mustHaveFields: ['atlanTags', 'accessPolicies', 'ownerUsers', 'lineage', 'customMetadata'],
    niceToHaveFields: ['certificateStatus', 'description', 'glossaryTerms'],
    typicalAssetTypes: ['Table', 'Column', 'Dashboard'],
    typicalVerticals: ['Financial Services', 'Healthcare', 'Regulated Industries'],
    examples: [
      'Compliance officer tags PII columns → auto-applies access policies via lineage',
      'Audit: track who owns sensitive data & where it flows downstream',
    ],
  },
  {
    useCase: 'Root Cause Analysis',
    description: 'Trace data issues end-to-end',
    mustHaveFields: ['lineage', 'description', 'ownerUsers', 'customMetadata', 'certificateStatus'],
    niceToHaveFields: ['readme', 'links', 'glossaryTerms'],
    typicalAssetTypes: ['Table', 'View', 'Column', 'Pipeline'],
    typicalVerticals: ['Platform-heavy orgs', 'Daikin', 'Raptive'],
    examples: [
      'Revenue discrepancy → trace via lineage from source DB to BI tool',
      'Job failed → check owner contact, last run status, error logs',
    ],
  },
  {
    useCase: 'Impact Analysis',
    description: 'Understand downstream blast radius of changes',
    mustHaveFields: ['lineage', 'ownerUsers', 'description', 'certificateStatus'],
    niceToHaveFields: ['customMetadata', 'glossaryTerms', 'readme'],
    typicalAssetTypes: ['Table', 'Column', 'Dashboard', 'Metric'],
    typicalVerticals: ['Platform-heavy orgs', 'Data Engineering'],
    examples: [
      'Deprecate column → see which dashboards/reports break',
      'Source table schema change → estimate impact on downstream consumers',
    ],
  },
  {
    useCase: 'Data Compliance' as const,
    description: 'Agree on glossary & term-to-asset mapping',
    mustHaveFields: ['description', 'ownerUsers', 'glossaryTerms', 'customMetadata'],
    niceToHaveFields: ['readme', 'certificateStatus', 'links'],
    typicalAssetTypes: ['Glossary Term', 'Table', 'Column'],
    typicalVerticals: ['All'],
    examples: [
      'Term: "Customer" → definition, examples, linked tables/columns',
      'Metric: "Active Users" → formula, owner, last calc run',
    ],
  },
  {
    useCase: 'Data Products',
    description: 'Self-serve data consumption with trust',
    mustHaveFields: ['readme', 'certificateStatus', 'glossaryTerms', 'ownerUsers', 'accessPolicies'],
    niceToHaveFields: ['description', 'customMetadata', 'lineage', 'links'],
    typicalAssetTypes: ['Table', 'View', 'Dataset', 'Dashboard'],
    typicalVerticals: ['All'],
    examples: [
      'Data product: Customers360 → README, SLA, access guide, owners',
      'Consumer views product metadata → knows who to contact, when updated, what it contains',
    ],
  },
  {
    useCase: 'Cost Optimization',
    description: 'Identify deprecation candidates & optimize usage',
    mustHaveFields: ['customMetadata', 'lineage', 'description', 'ownerUsers'],
    niceToHaveFields: ['certificateStatus', 'glossaryTerms', 'links'],
    typicalAssetTypes: ['Table', 'View', 'Dashboard'],
    typicalVerticals: ['Raptive', 'Cloud-native teams'],
    examples: [
      'Unused table for 6+ months → mark as deprecation candidate',
      'Cost dashboard shows: storage per table, query frequency, owner suggestions',
    ],
  },
  {
    useCase: 'Lifecycle Management',
    description: 'Track data from creation through retirement',
    mustHaveFields: ['customMetadata', 'certificateStatus', 'ownerUsers', 'lineage'],
    niceToHaveFields: ['description', 'glossaryTerms', 'readme'],
    typicalAssetTypes: ['Table', 'View', 'Dataset'],
    typicalVerticals: ['Governance-heavy', 'Bandwidth'],
    examples: [
      'View table: Bronze → Silver → Gold progression',
      'Deprecation workflow: notify owners, set sunset date, archive after',
    ],
  },
  {
    useCase: 'Trusted Metrics',
    description: 'Ensure KPI accuracy & trust across org',
    mustHaveFields: ['glossaryTerms', 'readme', 'lineage', 'certificateStatus', 'ownerUsers'],
    niceToHaveFields: ['customMetadata', 'description', 'links'],
    typicalAssetTypes: ['Glossary Term', 'Dashboard', 'Metric'],
    typicalVerticals: ['Finance', 'Executive', 'SaaS'],
    examples: [
      'Metric definition includes: formula, assumptions, refresh cadence, owner approval',
      'Dashboard links to core metrics → auto-updates when definitions change',
    ],
  },
];

/**
 * Get field recommendations for a use case
 */
export function getFieldsForUseCase(useCase: UseCase): UseCaseFieldRecommendation | undefined {
  return USE_CASE_FIELD_RECOMMENDATIONS.find(rec => rec.useCase === useCase);
}

/**
 * Get ALL recommended fields (must + nice) for a use case
 */
export function getAllRecommendedFieldsForUseCase(useCase: UseCase): MetadataFieldType[] {
  const rec = getFieldsForUseCase(useCase);
  if (!rec) return [];
  
  // Combine and deduplicate
  const combined = [...new Set([...rec.mustHaveFields, ...rec.niceToHaveFields])];
  return combined as MetadataFieldType[];
}

/**
 * Recommend asset types for a use case
 */
export function getAssetTypesForUseCase(useCase: UseCase): string[] {
  const rec = getFieldsForUseCase(useCase);
  return rec?.typicalAssetTypes || [];
}

/**
 * Get verticals/industries most aligned with a use case
 */
export function getVerticalsForUseCase(useCase: UseCase): string[] {
  const rec = getFieldsForUseCase(useCase);
  return rec?.typicalVerticals || [];
}

/**
 * Score field importance for a use case
 * Returns weighted field recommendations
 */
export interface WeightedFieldRecommendation {
  field: MetadataFieldType;
  weight: 'must-have' | 'nice-to-have';
  priority: number; // 1-10
  rationale: string;
}

export function getWeightedFieldsForUseCase(useCase: UseCase): WeightedFieldRecommendation[] {
  const rec = getFieldsForUseCase(useCase);
  if (!rec) return [];
  
  // Must-have fields get weight 10, nice-to-have get 5-7
  const recommendations: WeightedFieldRecommendation[] = [];
  
  rec.mustHaveFields.forEach((field, idx) => {
    recommendations.push({
      field,
      weight: 'must-have',
      priority: 10 - (idx * 0.5), // Slight priority decay
      rationale: `Essential for ${rec.useCase}`,
    });
  });
  
  rec.niceToHaveFields.forEach((field, idx) => {
    recommendations.push({
      field,
      weight: 'nice-to-have',
      priority: 6 - (idx * 0.2),
      rationale: `Helpful context for ${rec.useCase}`,
    });
  });
  
  // Sort by priority descending
  return recommendations.sort((a, b) => b.priority - a.priority);
}

/**
 * Filter metadata model template rows for a specific use case
 */
export function filterTemplatesForUseCase(
  templates: Array<{ useCase?: string; [key: string]: string | boolean | number | undefined }>,
  useCase: UseCase
): typeof templates {
  return templates.filter(t => {
    if (!t.useCase) return false;
    return t.useCase.toLowerCase() === useCase.toLowerCase();
  });
}
