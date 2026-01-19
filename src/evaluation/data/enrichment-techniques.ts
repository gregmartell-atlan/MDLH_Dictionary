/**
 * Enrichment Techniques Catalog
 * 
 * Defines how to enrich each metadata element by asset type and source system.
 * Based on customer implementations and best practices.
 */

import type { EnrichmentTechnique } from '../types/metadata-assistant';

export const ENRICHMENT_TECHNIQUES: EnrichmentTechnique[] = [
  // ============================================
  // DESCRIPTIONS
  // ============================================
  {
    id: 'tech-desc-sf-table-auto',
    metadataElement: 'description',
    assetType: 'Table',
    sourceSystem: 'Snowflake',
    techniqueType: 'Automation',
    tooling: 'Built-in crawler + workflows',
    trackingField: 'cm_enrichment_round_1',
    curationProcess: 'Crawl Snowflake comments nightly; steward reviews low-score assets weekly',
    estimatedEffortPerAsset: 0.5,
    prerequisites: ['Snowflake connector configured', 'Comments exist in Snowflake'],
    successCriteria: '90%+ tables have descriptions pulled from source comments',
  },
  {
    id: 'tech-desc-sf-column-ai',
    metadataElement: 'description',
    assetType: 'Column',
    sourceSystem: 'Snowflake',
    techniqueType: 'Hybrid',
    tooling: 'AI-generated descriptions + dbt YAML sync',
    trackingField: 'cm_enrichment_round_1',
    curationProcess: 'Sync dbt YAML descriptions first; use AI for remaining columns; steward reviews',
    estimatedEffortPerAsset: 0.2,
    prerequisites: ['dbt integration enabled', 'AI description tool configured'],
    successCriteria: '80%+ columns have meaningful descriptions',
  },
  {
    id: 'tech-desc-tableau-auto',
    metadataElement: 'description',
    assetType: 'Dashboard',
    sourceSystem: 'Tableau',
    techniqueType: 'Automation',
    tooling: 'Tableau connector workflow',
    trackingField: '',
    curationProcess: 'Auto-crawl Tableau dashboard descriptions via connector',
    estimatedEffortPerAsset: 0.1,
    prerequisites: ['Tableau connector configured'],
    successCriteria: '100% dashboards have descriptions from Tableau',
  },

  // ============================================
  // OWNERS
  // ============================================
  {
    id: 'tech-owner-bulk-schema',
    metadataElement: 'ownerUsers',
    assetType: 'Table',
    sourceSystem: 'Snowflake',
    techniqueType: 'Hybrid',
    tooling: 'Bulk edit + playbooks',
    trackingField: 'cm_ownership',
    curationProcess: 'Bulk assign based on schema ownership mapping; validate with domain owners',
    estimatedEffortPerAsset: 0.5,
    prerequisites: ['Schema → Owner mapping defined', 'Domain owners identified'],
    successCriteria: '95%+ tables have owners assigned',
  },
  {
    id: 'tech-owner-dbt-meta',
    metadataElement: 'ownerUsers',
    assetType: 'DbtModel',
    sourceSystem: 'dbt',
    techniqueType: 'Automation',
    tooling: 'dbt meta tags',
    trackingField: '',
    curationProcess: 'Define ownership in dbt YAML meta tags; sync automatically via connector',
    estimatedEffortPerAsset: 0.1,
    prerequisites: ['dbt meta.owner convention established'],
    successCriteria: '100% dbt models have owners from YAML',
  },

  // ============================================
  // CLASSIFICATIONS (TAGS)
  // ============================================
  {
    id: 'tech-tags-pii-auto',
    metadataElement: 'atlanTags',
    assetType: 'Column',
    sourceSystem: 'Snowflake',
    techniqueType: 'Hybrid',
    tooling: 'PII detection playbooks',
    trackingField: 'cm_pii_detection',
    curationProcess: 'Auto-detect PII patterns (email, SSN, etc.); apply tags via playbooks; steward reviews',
    estimatedEffortPerAsset: 0.3,
    prerequisites: ['PII taxonomy defined', 'Detection rules configured'],
    successCriteria: '95%+ PII columns tagged; <5% false positives',
  },
  {
    id: 'tech-tags-bulk-domain',
    metadataElement: 'atlanTags',
    assetType: 'Table',
    sourceSystem: 'Snowflake',
    techniqueType: 'Hybrid',
    tooling: 'Bulk edit + domain tagging playbooks',
    trackingField: 'cm_domain_tagging',
    curationProcess: 'Bulk assign domain tags based on schema/database; refine with stewards',
    estimatedEffortPerAsset: 0.2,
    prerequisites: ['Domain taxonomy defined', 'Schema → Domain mapping'],
    successCriteria: '90%+ tables have domain tags',
  },

  // ============================================
  // CERTIFICATION
  // ============================================
  {
    id: 'tech-cert-playbook',
    metadataElement: 'certificateStatus',
    assetType: 'Table',
    sourceSystem: 'Snowflake',
    techniqueType: 'Automation',
    tooling: 'Certification playbooks',
    trackingField: 'cm_certification',
    curationProcess: 'Define certification rules (completeness score ≥ 80, owner assigned, etc.); auto-certify via playbooks',
    estimatedEffortPerAsset: 0.1,
    prerequisites: ['Certification criteria defined', 'Completeness scoring enabled'],
    successCriteria: 'Business-critical assets certified within 2 sprints',
  },

  // ============================================
  // GLOSSARY TERMS
  // ============================================
  {
    id: 'tech-glossary-manual',
    metadataElement: 'glossaryTerms',
    assetType: 'View',
    sourceSystem: 'Snowflake',
    techniqueType: 'Manual',
    tooling: 'Atlan UI + optional header-match playbooks',
    trackingField: 'cm_glossary_linkage',
    curationProcess: 'Domain owners manually link critical views to glossary terms; use playbooks for name-based matching',
    estimatedEffortPerAsset: 2,
    prerequisites: ['Glossary structure created', 'Domain owners trained'],
    successCriteria: '80%+ business-critical views linked to glossary',
  },
  {
    id: 'tech-glossary-dashboard',
    metadataElement: 'glossaryTerms',
    assetType: 'Dashboard',
    sourceSystem: 'Tableau',
    techniqueType: 'Hybrid',
    tooling: 'Playbooks + manual curation',
    trackingField: 'cm_glossary_linkage',
    curationProcess: 'Use playbooks for automated term matching in dashboard names; owners review and add missing links',
    estimatedEffortPerAsset: 1.5,
    prerequisites: ['Glossary with KPI/metric terms', 'Dashboard naming conventions'],
    successCriteria: '70%+ dashboards linked to KPI glossary terms',
  },

  // ============================================
  // LINEAGE
  // ============================================
  {
    id: 'tech-lineage-ootb',
    metadataElement: 'lineage',
    assetType: 'Table',
    sourceSystem: 'Snowflake',
    techniqueType: 'Automation',
    tooling: 'Out-of-the-box connector lineage',
    trackingField: '',
    curationProcess: 'Lineage auto-populated from Snowflake connector; validate completeness quarterly',
    estimatedEffortPerAsset: 0,
    prerequisites: ['Snowflake connector configured with lineage enabled'],
    successCriteria: 'Lineage available for 95%+ tables',
  },

  // ============================================
  // README
  // ============================================
  {
    id: 'tech-readme-template',
    metadataElement: 'readme',
    assetType: 'Table',
    sourceSystem: 'Snowflake',
    techniqueType: 'Manual',
    tooling: 'README templates',
    trackingField: 'cm_readme_status',
    curationProcess: 'Use standard README template for business-critical tables; owners fill in sections',
    estimatedEffortPerAsset: 15,
    prerequisites: ['README template created', 'Owners trained'],
    successCriteria: 'Top 50 business-critical tables have complete READMEs',
  },

  // ============================================
  // CUSTOM METADATA
  // ============================================
  {
    id: 'tech-cm-freshness-dbt',
    metadataElement: 'customMetadata',
    assetType: 'Table',
    sourceSystem: 'Snowflake',
    techniqueType: 'Automation',
    tooling: 'dbt metadata sync + propagation package',
    trackingField: '',
    curationProcess: 'Pull dbt freshness metadata; propagate using custom package to populate badges',
    estimatedEffortPerAsset: 0.1,
    prerequisites: ['dbt freshness tests configured', 'Custom metadata set created'],
    successCriteria: 'Freshness metadata auto-populated for dbt-managed tables',
  },

  // ============================================
  // ACCESS POLICIES
  // ============================================
  {
    id: 'tech-access-bulk',
    metadataElement: 'accessPolicies',
    assetType: 'Table',
    sourceSystem: 'Snowflake',
    techniqueType: 'Hybrid',
    tooling: 'Atlan access policies + bulk assignment',
    trackingField: 'cm_access_control',
    curationProcess: 'Define access policies for PII/sensitive tags; bulk apply; review quarterly',
    estimatedEffortPerAsset: 0.5,
    prerequisites: ['PII tags applied', 'Access policies defined'],
    successCriteria: 'All PII-tagged assets have access controls',
  },
];

/**
 * Get techniques filtered by criteria
 */
export function filterEnrichmentTechniques(criteria: {
  metadataElement?: string;
  assetType?: string;
  sourceSystem?: string;
  techniqueType?: string;
}): EnrichmentTechnique[] {
  return ENRICHMENT_TECHNIQUES.filter(tech => {
    if (criteria.metadataElement && tech.metadataElement !== criteria.metadataElement) return false;
    if (criteria.assetType && tech.assetType !== criteria.assetType) return false;
    if (criteria.sourceSystem && tech.sourceSystem !== criteria.sourceSystem) return false;
    if (criteria.techniqueType && tech.techniqueType !== criteria.techniqueType) return false;
    return true;
  });
}

/**
 * Get recommended technique for a metadata element
 */
export function getRecommendedTechnique(
  metadataElement: string,
  assetType: string,
  sourceSystem: string
): EnrichmentTechnique | undefined {
  // Try exact match
  let technique = ENRICHMENT_TECHNIQUES.find(
    tech =>
      tech.metadataElement === metadataElement &&
      tech.assetType === assetType &&
      tech.sourceSystem === sourceSystem
  );

  // Fallback to same element and source
  if (!technique) {
    technique = ENRICHMENT_TECHNIQUES.find(
      tech =>
        tech.metadataElement === metadataElement &&
        tech.sourceSystem === sourceSystem
    );
  }

  // Fallback to same element
  if (!technique) {
    technique = ENRICHMENT_TECHNIQUES.find(
      tech => tech.metadataElement === metadataElement
    );
  }

  return technique;
}

/**
 * Calculate total effort for a set of techniques applied to asset counts
 */
export function calculateEnrichmentEffort(
  techniques: EnrichmentTechnique[],
  assetCounts: Record<string, number>
): {
  totalMinutes: number;
  totalHours: number;
  totalDays: number;
  byTechniqueType: Record<string, number>;
} {
  let totalMinutes = 0;
  const byTechniqueType: Record<string, number> = {
    Automation: 0,
    Manual: 0,
    Hybrid: 0,
    'Not Applicable': 0,
  };

  techniques.forEach(tech => {
    const assetCount = assetCounts[tech.assetType] || 0;
    const effort = (tech.estimatedEffortPerAsset || 0) * assetCount;
    totalMinutes += effort;
    byTechniqueType[tech.techniqueType] += effort;
  });

  return {
    totalMinutes,
    totalHours: Math.ceil(totalMinutes / 60),
    totalDays: Math.ceil(totalMinutes / (8 * 60)),
    byTechniqueType,
  };
}
