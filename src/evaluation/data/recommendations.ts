// ============================================
// RECOMMENDATIONS ENGINE
// Based on audit results, provide actionable recommendations
// Ported and adapted from MDLH_Dict queryTemplates
// ============================================

import type { AuditResult, FieldCoverage } from '../types/priority';

// ============================================
// RECOMMENDATION TYPES
// ============================================

export type RecommendationPriority = 'critical' | 'high' | 'medium' | 'low';
export type RecommendationCategory =
  | 'ownership'
  | 'documentation'
  | 'governance'
  | 'classification'
  | 'lineage'
  | 'quality'
  | 'cost';

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  category: RecommendationCategory;
  priority: RecommendationPriority;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  actions: RecommendationAction[];
  relatedFields: string[];
  coverageThreshold?: number; // Triggers when coverage is below this %
}

export interface RecommendationAction {
  label: string;
  type: 'bulk_update' | 'atlan_ui' | 'api_call' | 'workflow' | 'report';
  description: string;
  atlanPath?: string; // Path in Atlan UI
  apiEndpoint?: string;
}

export interface RecommendationMatch {
  recommendation: Recommendation;
  currentCoverage: number;
  assetsAffected: number;
  potentialImpact: number;
}

// ============================================
// RECOMMENDATION DEFINITIONS
// ============================================

export const RECOMMENDATIONS: Recommendation[] = [
  // =========================================
  // OWNERSHIP RECOMMENDATIONS
  // =========================================
  {
    id: 'missing_owners_critical',
    title: 'Critical: Assign Owners to High-Value Assets',
    description: 'Assets without designated owners lack accountability. Start with tables that have high query activity or are used in production pipelines.',
    category: 'ownership',
    priority: 'critical',
    impact: 'Improves accountability, enables data stewardship, reduces time to find SMEs',
    effort: 'medium',
    relatedFields: ['ownerUsers', 'ownerGroups'],
    coverageThreshold: 30,
    actions: [
      {
        label: 'View Orphan Assets in Atlan',
        type: 'atlan_ui',
        description: 'Filter assets by missing owner and high popularity',
        atlanPath: '/assets?filter=ownerUsers:empty&sort=popularityScore:desc',
      },
      {
        label: 'Bulk Assign Owners',
        type: 'bulk_update',
        description: 'Use Atlan bulk edit to assign owners based on schema/connection',
        atlanPath: '/governance/bulk-update',
      },
      {
        label: 'Set Up Ownership Workflow',
        type: 'workflow',
        description: 'Configure automatic owner assignment based on connection/schema patterns',
      },
    ],
  },
  {
    id: 'missing_owners_standard',
    title: 'Expand Owner Coverage',
    description: 'Good progress on ownership, but some assets still lack designated owners. Focus on documenting remaining gaps.',
    category: 'ownership',
    priority: 'medium',
    impact: 'Complete ownership coverage enables full accountability',
    effort: 'low',
    relatedFields: ['ownerUsers', 'ownerGroups'],
    coverageThreshold: 70,
    actions: [
      {
        label: 'Generate Orphan Report',
        type: 'report',
        description: 'Export list of assets without owners for review',
      },
      {
        label: 'Assign by Schema Pattern',
        type: 'bulk_update',
        description: 'Bulk assign owners based on database/schema conventions',
      },
    ],
  },

  // =========================================
  // DOCUMENTATION RECOMMENDATIONS
  // =========================================
  {
    id: 'missing_descriptions_critical',
    title: 'Critical: Add Descriptions to Key Assets',
    description: 'Most assets lack descriptions, making it hard for analysts to understand data meaning. Prioritize tables used in dashboards and reports.',
    category: 'documentation',
    priority: 'critical',
    impact: 'Reduces time-to-insight, improves data discovery, enables self-service analytics',
    effort: 'high',
    relatedFields: ['description', 'userDescription'],
    coverageThreshold: 25,
    actions: [
      {
        label: 'AI Description Generation',
        type: 'workflow',
        description: 'Use Atlan AI to auto-generate descriptions from column patterns',
        atlanPath: '/settings/ai-features',
      },
      {
        label: 'Focus on Popular Assets',
        type: 'atlan_ui',
        description: 'Start with highest-popularity tables lacking descriptions',
        atlanPath: '/assets?filter=description:empty&sort=popularityScore:desc',
      },
      {
        label: 'Schema-Level Descriptions',
        type: 'bulk_update',
        description: 'Add descriptions at schema level to provide context for all child assets',
      },
    ],
  },
  {
    id: 'missing_descriptions_standard',
    title: 'Complete Documentation Coverage',
    description: 'Documentation is progressing well. Focus on filling remaining gaps, especially for complex transformations and derived tables.',
    category: 'documentation',
    priority: 'medium',
    impact: 'Full documentation enables analyst self-service',
    effort: 'medium',
    relatedFields: ['description', 'userDescription'],
    coverageThreshold: 60,
    actions: [
      {
        label: 'Document Complex Assets',
        type: 'atlan_ui',
        description: 'Focus on assets with lineage (transformations) lacking descriptions',
        atlanPath: '/assets?filter=description:empty,hasLineage:true',
      },
      {
        label: 'READMEs for Schemas',
        type: 'atlan_ui',
        description: 'Add README documents to key schemas',
        atlanPath: '/governance/readme',
      },
    ],
  },

  // =========================================
  // CLASSIFICATION RECOMMENDATIONS
  // =========================================
  {
    id: 'missing_tags_critical',
    title: 'Critical: Classify Sensitive Data',
    description: 'Most assets lack classification tags. This is a compliance risk - PII, PHI, and financial data must be identified and tagged.',
    category: 'classification',
    priority: 'critical',
    impact: 'Enables compliance, data protection, and access control',
    effort: 'medium',
    relatedFields: ['atlanTags'],
    coverageThreshold: 20,
    actions: [
      {
        label: 'Auto-Classification Scan',
        type: 'workflow',
        description: 'Run Atlan auto-classification to detect PII/PHI patterns',
        atlanPath: '/settings/classification',
      },
      {
        label: 'Review Column Names',
        type: 'report',
        description: 'Generate report of columns with names suggesting PII (email, ssn, phone, etc.)',
      },
      {
        label: 'Set Up Propagation',
        type: 'workflow',
        description: 'Configure tag propagation through lineage',
        atlanPath: '/governance/classification/propagation',
      },
    ],
  },
  {
    id: 'missing_tags_standard',
    title: 'Expand Classification Coverage',
    description: 'Good classification foundation. Extend tags to remaining assets and ensure propagation is working correctly.',
    category: 'classification',
    priority: 'medium',
    impact: 'Complete classification enables comprehensive data protection',
    effort: 'low',
    relatedFields: ['atlanTags'],
    coverageThreshold: 50,
    actions: [
      {
        label: 'Verify Propagation',
        type: 'atlan_ui',
        description: 'Check that tags are propagating through lineage correctly',
        atlanPath: '/governance/classification/audit',
      },
      {
        label: 'Tag Downstream Assets',
        type: 'bulk_update',
        description: 'Bulk tag assets downstream of already-classified sources',
      },
    ],
  },

  // =========================================
  // GLOSSARY RECOMMENDATIONS
  // =========================================
  {
    id: 'missing_glossary_terms',
    title: 'Link Assets to Business Glossary',
    description: 'Assets lack connections to business glossary terms. This breaks the link between technical assets and business meaning.',
    category: 'governance',
    priority: 'high',
    impact: 'Enables business context, improves search, connects technical to business',
    effort: 'medium',
    relatedFields: ['meanings'],
    coverageThreshold: 30,
    actions: [
      {
        label: 'Create Core Glossary',
        type: 'atlan_ui',
        description: 'Start with a core business glossary for key domains',
        atlanPath: '/governance/glossary/create',
      },
      {
        label: 'Auto-Link Suggestions',
        type: 'workflow',
        description: 'Use AI to suggest glossary term links based on asset names',
        atlanPath: '/settings/ai-features/glossary',
      },
      {
        label: 'Domain-Based Linking',
        type: 'bulk_update',
        description: 'Bulk link assets in a domain/schema to relevant terms',
      },
    ],
  },

  // =========================================
  // LINEAGE RECOMMENDATIONS
  // =========================================
  {
    id: 'missing_lineage',
    title: 'Establish Data Lineage',
    description: 'Many assets lack lineage connections. Without lineage, impact analysis and root cause debugging are impossible.',
    category: 'lineage',
    priority: 'high',
    impact: 'Enables impact analysis, debugging, compliance tracking',
    effort: 'high',
    relatedFields: ['__hasLineage'],
    coverageThreshold: 40,
    actions: [
      {
        label: 'Configure Lineage Crawlers',
        type: 'workflow',
        description: 'Set up lineage extraction from dbt, Airflow, or SQL parsing',
        atlanPath: '/settings/lineage',
      },
      {
        label: 'Manual Lineage for Key Assets',
        type: 'atlan_ui',
        description: 'Add manual lineage for critical data products',
        atlanPath: '/assets/lineage/manual',
      },
      {
        label: 'Review Lineage Gaps',
        type: 'report',
        description: 'Identify high-value assets without upstream/downstream connections',
      },
    ],
  },

  // =========================================
  // CERTIFICATION RECOMMENDATIONS
  // =========================================
  {
    id: 'low_certification',
    title: 'Certify Trusted Data Assets',
    description: 'Few assets are certified. Certification helps analysts identify trusted, production-ready data.',
    category: 'governance',
    priority: 'medium',
    impact: 'Builds trust, reduces usage of incorrect data, enables data marketplace',
    effort: 'medium',
    relatedFields: ['certificateStatus'],
    coverageThreshold: 25,
    actions: [
      {
        label: 'Define Certification Criteria',
        type: 'workflow',
        description: 'Establish what makes an asset "production-ready"',
      },
      {
        label: 'Certify High-Usage Assets',
        type: 'atlan_ui',
        description: 'Start certifying most-queried, documented, owned assets',
        atlanPath: '/governance/certification',
      },
      {
        label: 'Set Up Certification Workflow',
        type: 'workflow',
        description: 'Create approval workflow for certification requests',
        atlanPath: '/workflows/certification',
      },
    ],
  },

  // =========================================
  // QUALITY RECOMMENDATIONS
  // =========================================
  {
    id: 'enable_profiling',
    title: 'Enable Data Profiling',
    description: 'Assets lack profiling data. Profiling provides statistics about data distribution, nulls, and patterns.',
    category: 'quality',
    priority: 'medium',
    impact: 'Enables data quality monitoring, anomaly detection, trust scoring',
    effort: 'low',
    relatedFields: [],
    actions: [
      {
        label: 'Configure Profiling',
        type: 'workflow',
        description: 'Enable automatic profiling for key connections',
        atlanPath: '/settings/profiling',
      },
      {
        label: 'Profile High-Value Tables',
        type: 'atlan_ui',
        description: 'Run profiling on most-used tables first',
        atlanPath: '/assets/profile',
      },
    ],
  },

  // =========================================
  // COST OPTIMIZATION
  // =========================================
  {
    id: 'identify_unused_assets',
    title: 'Identify Unused Assets',
    description: 'Some assets may be unused or stale. Identifying these can reduce storage costs and cognitive load.',
    category: 'cost',
    priority: 'low',
    impact: 'Reduces storage costs, simplifies data landscape',
    effort: 'medium',
    relatedFields: [],
    actions: [
      {
        label: 'Low Popularity Report',
        type: 'report',
        description: 'Export assets with zero or low popularity scores',
      },
      {
        label: 'Stale Asset Detection',
        type: 'atlan_ui',
        description: 'Find assets not modified or queried in 90+ days',
        atlanPath: '/assets?filter=lastModified:before:90d',
      },
      {
        label: 'Archive Workflow',
        type: 'workflow',
        description: 'Set up workflow to flag and archive unused assets',
      },
    ],
  },
];

// ============================================
// RECOMMENDATION ENGINE
// ============================================

/**
 * Get recommendations based on audit results
 */
export function getRecommendations(
  audit: AuditResult | null,
  fieldCoverage: FieldCoverage[]
): RecommendationMatch[] {
  if (!audit) return [];

  const matches: RecommendationMatch[] = [];

  // Find field coverage by field name
  const getCoverage = (fieldName: string): number => {
    const coverage = fieldCoverage.find((fc) => fc.field === fieldName);
    return coverage?.coveragePercent || 0;
  };

  // Check each recommendation against current coverage
  for (const rec of RECOMMENDATIONS) {
    // If recommendation has a coverage threshold, check if we're below it
    if (rec.coverageThreshold !== undefined && rec.relatedFields.length > 0) {
      // Get average coverage across related fields
      const avgCoverage =
        rec.relatedFields.reduce((sum, field) => sum + getCoverage(field), 0) /
        rec.relatedFields.length;

      if (avgCoverage < rec.coverageThreshold) {
        const totalAssets = audit.summary.totalAssets;
        const coveredAssets = Math.round((avgCoverage / 100) * totalAssets);
        const assetsAffected = totalAssets - coveredAssets;
        const potentialImpact = rec.coverageThreshold - avgCoverage;

        matches.push({
          recommendation: rec,
          currentCoverage: Math.round(avgCoverage),
          assetsAffected,
          potentialImpact: Math.round(potentialImpact),
        });
      }
    } else if (rec.coverageThreshold === undefined) {
      // Recommendations without thresholds are always included
      matches.push({
        recommendation: rec,
        currentCoverage: 0,
        assetsAffected: 0,
        potentialImpact: 0,
      });
    }
  }

  // Sort by priority
  const priorityOrder: Record<RecommendationPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  return matches.sort(
    (a, b) =>
      priorityOrder[a.recommendation.priority] -
      priorityOrder[b.recommendation.priority]
  );
}

/**
 * Get top N recommendations
 */
export function getTopRecommendations(
  audit: AuditResult | null,
  fieldCoverage: FieldCoverage[],
  limit = 5
): RecommendationMatch[] {
  return getRecommendations(audit, fieldCoverage).slice(0, limit);
}

/**
 * Get recommendations by category
 */
export function getRecommendationsByCategory(
  audit: AuditResult | null,
  fieldCoverage: FieldCoverage[],
  category: RecommendationCategory
): RecommendationMatch[] {
  return getRecommendations(audit, fieldCoverage).filter(
    (m) => m.recommendation.category === category
  );
}

/**
 * Calculate overall health score based on audit
 */
export function calculateHealthScore(audit: AuditResult | null): {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  summary: string;
} {
  if (!audit) {
    return { score: 0, grade: 'F', summary: 'No audit data available' };
  }

  const score = audit.summary.overallCompletenessScore;

  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  let summary: string;

  if (score >= 90) {
    grade = 'A';
    summary = 'Excellent metadata coverage - focus on maintenance';
  } else if (score >= 75) {
    grade = 'B';
    summary = 'Good coverage - address remaining gaps';
  } else if (score >= 60) {
    grade = 'C';
    summary = 'Moderate coverage - prioritize high-impact fields';
  } else if (score >= 40) {
    grade = 'D';
    summary = 'Low coverage - significant work needed';
  } else {
    grade = 'F';
    summary = 'Critical coverage gaps - immediate action required';
  }

  return { score, grade, summary };
}

/**
 * Get quick wins - high impact, low effort recommendations
 */
export function getQuickWinRecommendations(
  audit: AuditResult | null,
  fieldCoverage: FieldCoverage[]
): RecommendationMatch[] {
  return getRecommendations(audit, fieldCoverage).filter(
    (m) =>
      m.recommendation.effort === 'low' &&
      (m.recommendation.priority === 'critical' ||
        m.recommendation.priority === 'high')
  );
}

// ============================================
// QUERY TEMPLATES FOR EXPLORATION
// ============================================

export interface QueryTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  atlanSearchDSL: Record<string, unknown>;
  displayFields: string[];
}

/**
 * Pre-built Atlan search queries for common exploration tasks
 */
export const EXPLORATION_QUERIES: QueryTemplate[] = [
  {
    id: 'orphan_tables',
    name: 'Orphan Tables',
    description: 'Tables without assigned owners',
    category: 'Ownership',
    atlanSearchDSL: {
      size: 100,
      query: {
        bool: {
          must: [
            { terms: { '__typeName.keyword': ['Table', 'View', 'MaterializedView'] } },
          ],
          must_not: [
            { term: { __state: 'DELETED' } },
            { exists: { field: 'ownerUsers' } },
            { exists: { field: 'ownerGroups' } },
          ],
        },
      },
    },
    displayFields: ['name', 'typeName', 'connectorName', 'databaseName', 'schemaName'],
  },
  {
    id: 'undocumented_popular',
    name: 'Popular Undocumented Assets',
    description: 'High-usage assets lacking descriptions',
    category: 'Documentation',
    atlanSearchDSL: {
      size: 100,
      query: {
        bool: {
          must: [{ range: { popularityScore: { gt: 0.5 } } }],
          must_not: [
            { term: { __state: 'DELETED' } },
            { exists: { field: 'description' } },
            { exists: { field: 'userDescription' } },
          ],
        },
      },
    },
    displayFields: ['name', 'typeName', 'popularityScore', 'connectorName'],
  },
  {
    id: 'pii_candidates',
    name: 'Potential PII Columns',
    description: 'Columns with names suggesting PII (email, ssn, phone, etc.)',
    category: 'Classification',
    atlanSearchDSL: {
      size: 100,
      query: {
        bool: {
          must: [
            { term: { '__typeName.keyword': 'Column' } },
            {
              bool: {
                should: [
                  { wildcard: { 'name.keyword': '*email*' } },
                  { wildcard: { 'name.keyword': '*phone*' } },
                  { wildcard: { 'name.keyword': '*ssn*' } },
                  { wildcard: { 'name.keyword': '*social_security*' } },
                  { wildcard: { 'name.keyword': '*address*' } },
                  { wildcard: { 'name.keyword': '*dob*' } },
                  { wildcard: { 'name.keyword': '*birth*' } },
                  { wildcard: { 'name.keyword': '*credit*' } },
                ],
                minimum_should_match: 1,
              },
            },
          ],
          must_not: [
            { term: { __state: 'DELETED' } },
            { exists: { field: 'atlanTags' } },
          ],
        },
      },
    },
    displayFields: ['name', 'tableName', 'dataType', 'connectorName'],
  },
  {
    id: 'no_lineage_tables',
    name: 'Tables Without Lineage',
    description: 'Tables missing upstream or downstream lineage',
    category: 'Lineage',
    atlanSearchDSL: {
      size: 100,
      query: {
        bool: {
          must: [
            { terms: { '__typeName.keyword': ['Table', 'View'] } },
            { term: { __hasLineage: false } },
          ],
          must_not: [{ term: { __state: 'DELETED' } }],
        },
      },
    },
    displayFields: ['name', 'typeName', 'connectorName', 'databaseName'],
  },
  {
    id: 'stale_assets',
    name: 'Potentially Stale Assets',
    description: 'Assets not modified in 90+ days with low popularity',
    category: 'Cost',
    atlanSearchDSL: {
      size: 100,
      query: {
        bool: {
          must: [
            { terms: { '__typeName.keyword': ['Table', 'View'] } },
            {
              range: {
                __modificationTimestamp: {
                  lt: `now-90d`,
                },
              },
            },
          ],
          must_not: [{ term: { __state: 'DELETED' } }],
          should: [
            { range: { popularityScore: { lt: 0.1 } } },
            {
              bool: {
                must_not: [{ exists: { field: 'popularityScore' } }],
              },
            },
          ],
          minimum_should_match: 1,
        },
      },
    },
    displayFields: ['name', 'typeName', 'popularityScore', '__modificationTimestamp'],
  },
  {
    id: 'certified_assets',
    name: 'Certified Assets',
    description: 'Assets with certification status',
    category: 'Governance',
    atlanSearchDSL: {
      size: 100,
      query: {
        bool: {
          must: [{ exists: { field: 'certificateStatus' } }],
          must_not: [{ term: { __state: 'DELETED' } }],
        },
      },
    },
    displayFields: ['name', 'typeName', 'certificateStatus', 'ownerUsers'],
  },
  {
    id: 'glossary_linked_assets',
    name: 'Assets Linked to Glossary',
    description: 'Assets connected to business glossary terms',
    category: 'Governance',
    atlanSearchDSL: {
      size: 100,
      query: {
        bool: {
          must: [
            { exists: { field: 'meanings' } },
            {
              script: {
                script: "doc['meanings'].size() > 0",
              },
            },
          ],
          must_not: [{ term: { __state: 'DELETED' } }],
        },
      },
    },
    displayFields: ['name', 'typeName', 'meanings', 'connectorName'],
  },
];

export default {
  RECOMMENDATIONS,
  EXPLORATION_QUERIES,
  getRecommendations,
  getTopRecommendations,
  getRecommendationsByCategory,
  getQuickWinRecommendations,
  calculateHealthScore,
};
