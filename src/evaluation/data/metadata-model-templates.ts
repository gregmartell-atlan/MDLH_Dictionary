/**
 * Metadata Model Row Templates
 * 
 * Reference implementations from customer templates showing
 * manageable amounts, automation flags, and enrichment processes.
 * 
 * Sources:
 * - Bandwidth Metadata Modeling Template
 * - Daikin Template (Relational assets, BI assets)
 * - Master Template
 */

import type { Industry, MetadataModelRow } from '../types/metadata-assistant';
import type { MetadataFieldType } from '../types/metadata-fields';

export const METADATA_MODEL_TEMPLATES: MetadataModelRow[] = [
  // ============================================
  // SNOWFLAKE - TABLES
  // ============================================
  {
    id: 'tmpl-sf-table-desc',
    sourceSystem: 'Snowflake',
    assetType: 'Table',
    metadataElements: ['description'],
    manageableAmount: 'Business-critical',
    initialAmount: 200,
    daapDimension: ['Understandable'],
    bulkMetadataExists: true,
    bulkMetadataLocation: 'Snowflake comments',
    automationPossible: true,
    curationProcess: 'Comments crawled automatically via workflows',
    trackingField: 'cm_enrichment_round_1',
    governanceGuidelinesExist: false,
    tenant: 'bandwidth',
  },
  {
    id: 'tmpl-sf-table-readme',
    sourceSystem: 'Snowflake',
    assetType: 'Table',
    metadataElements: ['readme'],
    manageableAmount: 'Business-critical',
    initialAmount: 100,
    daapDimension: ['Understandable'],
    bulkMetadataExists: false,
    automationPossible: false,
    curationProcess: 'Manual creation for complex tables; use templates',
    trackingField: 'cm_enrichment_round_2',
    governanceGuidelinesExist: true,
    tenant: 'bandwidth',
  },
  {
    id: 'tmpl-sf-table-owners',
    sourceSystem: 'Snowflake',
    assetType: 'Table',
    metadataElements: ['ownerUsers'],
    manageableAmount: 'All assets',
    initialAmount: 200,
    daapDimension: ['Addressable'],
    bulkMetadataExists: false,
    automationPossible: true,
    curationProcess: 'Bulk assign based on schema ownership; validate with stewards',
    trackingField: 'cm_enrichment_round_1',
    governanceGuidelinesExist: true,
    tenant: 'bandwidth',
  },
  {
    id: 'tmpl-sf-table-tags',
    sourceSystem: 'Snowflake',
    assetType: 'Table',
    metadataElements: ['atlanTags'],
    manageableAmount: 'All assets',
    initialAmount: 200,
    daapDimension: ['Secure'],
    bulkMetadataExists: false,
    automationPossible: true,
    curationProcess: 'Define PII tagging rules; bulk enrich using playbooks',
    trackingField: 'cm_pii_classification',
    governanceGuidelinesExist: true,
    tenant: 'bandwidth',
  },
  {
    id: 'tmpl-sf-table-lineage',
    sourceSystem: 'Snowflake',
    assetType: 'Table',
    metadataElements: ['lineage'],
    manageableAmount: 'All assets',
    initialAmount: 200,
    daapDimension: ['Interoperable'],
    bulkMetadataExists: true,
    bulkMetadataLocation: 'Out-of-the-box lineage',
    automationPossible: true,
    curationProcess: 'Automatic lineage from connector; validate completeness',
    trackingField: '',
    governanceGuidelinesExist: false,
    tenant: 'bandwidth',
  },
  {
    id: 'tmpl-sf-table-cert',
    sourceSystem: 'Snowflake',
    assetType: 'Table',
    metadataElements: ['certificateStatus'],
    manageableAmount: 'Business-critical',
    initialAmount: 100,
    daapDimension: ['Trustworthy'],
    bulkMetadataExists: false,
    automationPossible: true,
    curationProcess: 'Define certification rules using Playbooks based on completeness score',
    trackingField: 'cm_certification_round',
    governanceGuidelinesExist: true,
    tenant: 'bandwidth',
  },
  {
    id: 'tmpl-sf-table-custom',
    sourceSystem: 'Snowflake',
    assetType: 'Table',
    metadataElements: ['customMetadata'],
    manageableAmount: 'Business-critical',
    initialAmount: 100,
    daapDimension: ['Trustworthy'],
    bulkMetadataExists: true,
    bulkMetadataLocation: 'dbt job status metadata',
    automationPossible: true,
    curationProcess: 'Use propagation custom package to populate freshness badges',
    trackingField: '',
    governanceGuidelinesExist: false,
    tenant: 'bandwidth',
  },

  // ============================================
  // SNOWFLAKE - COLUMNS
  // ============================================
  {
    id: 'tmpl-sf-column-desc',
    sourceSystem: 'Snowflake',
    assetType: 'Column',
    metadataElements: ['description'],
    manageableAmount: 'Most queried',
    initialAmount: 500,
    daapDimension: ['Understandable'],
    bulkMetadataExists: true,
    bulkMetadataLocation: 'dbt YAML',
    automationPossible: true,
    curationProcess: 'dbt descriptions crawled via workflow; AI-generate for remaining',
    trackingField: 'cm_enrichment_round_1',
    governanceGuidelinesExist: false,
    tenant: 'bandwidth',
  },
  {
    id: 'tmpl-sf-column-tags',
    sourceSystem: 'Snowflake',
    assetType: 'Column',
    metadataElements: ['atlanTags'],
    manageableAmount: 'All assets',
    initialAmount: 1000,
    daapDimension: ['Secure'],
    bulkMetadataExists: false,
    automationPossible: true,
    curationProcess: 'Auto-detect PII patterns; apply tags via playbooks',
    trackingField: 'cm_pii_detection',
    governanceGuidelinesExist: true,
    tenant: 'bandwidth',
  },

  // ============================================
  // SNOWFLAKE - VIEWS
  // ============================================
  {
    id: 'tmpl-sf-view-glossary',
    sourceSystem: 'Snowflake',
    assetType: 'View',
    metadataElements: ['glossaryTerms'],
    manageableAmount: 'Business-critical',
    initialAmount: 100,
    daapDimension: ['Discoverable'],
    bulkMetadataExists: false,
    automationPossible: false,
    curationProcess: 'Owners link terms; playbooks/custom package for header-match linking',
    trackingField: 'cm_glossary_linkage',
    governanceGuidelinesExist: true,
    governanceGuidelinesLink: 'https://ask.atlan.com/glossary-best-practices',
    tenant: 'bandwidth',
  },

  // ============================================
  // TABLEAU - DASHBOARDS
  // ============================================
  {
    id: 'tmpl-tableau-dash-desc',
    sourceSystem: 'Tableau',
    assetType: 'Dashboard',
    metadataElements: ['description'],
    manageableAmount: 'All assets',
    initialAmount: 200,
    daapDimension: ['Understandable'],
    bulkMetadataExists: true,
    bulkMetadataLocation: 'Tableau descriptions',
    automationPossible: true,
    curationProcess: 'Auto-crawled via workflows',
    trackingField: '',
    governanceGuidelinesExist: false,
    tenant: 'daikin',
  },
  {
    id: 'tmpl-tableau-dash-glossary',
    sourceSystem: 'Tableau',
    assetType: 'Dashboard',
    metadataElements: ['glossaryTerms'],
    manageableAmount: 'Business-critical',
    initialAmount: 100,
    daapDimension: ['Discoverable'],
    bulkMetadataExists: false,
    automationPossible: false,
    curationProcess: 'Owner-driven + playbooks for term matching',
    trackingField: 'cm_glossary_linkage',
    governanceGuidelinesExist: true,
    tenant: 'daikin',
  },
  {
    id: 'tmpl-tableau-dash-tags',
    sourceSystem: 'Tableau',
    assetType: 'Dashboard',
    metadataElements: ['atlanTags'],
    manageableAmount: 'All assets',
    initialAmount: 200,
    daapDimension: ['Secure'],
    bulkMetadataExists: false,
    automationPossible: true,
    curationProcess: 'Tags propagated from sources or bulk enriched via playbooks',
    trackingField: 'cm_classification',
    governanceGuidelinesExist: false,
    tenant: 'daikin',
  },
  {
    id: 'tmpl-tableau-dash-lineage',
    sourceSystem: 'Tableau',
    assetType: 'Dashboard',
    metadataElements: ['lineage'],
    manageableAmount: 'All assets',
    initialAmount: 200,
    daapDimension: ['Interoperable'],
    bulkMetadataExists: true,
    bulkMetadataLocation: 'Out-of-the-box lineage',
    automationPossible: true,
    curationProcess: 'Automatic from connector',
    trackingField: '',
    governanceGuidelinesExist: false,
    tenant: 'daikin',
  },
  {
    id: 'tmpl-tableau-dash-cert',
    sourceSystem: 'Tableau',
    assetType: 'Dashboard',
    metadataElements: ['certificateStatus'],
    manageableAmount: 'Business-critical',
    initialAmount: 100,
    daapDimension: ['Trustworthy'],
    bulkMetadataExists: false,
    automationPossible: true,
    curationProcess: 'Certification rules via Playbooks based on usage + completeness',
    trackingField: 'cm_certification',
    governanceGuidelinesExist: true,
    tenant: 'daikin',
  },

  // ============================================
  // DAIKIN SPECIFIC - ALL_INVOICE_DATA
  // ============================================
  {
    id: 'tmpl-daikin-invoice-complete',
    sourceSystem: 'Snowflake',
    assetType: 'Table',
    metadataElements: ['description', 'readme', 'ownerUsers', 'atlanTags', 'lineage', 'certificateStatus'],
    manageableAmount: 'Business-critical',
    initialAmount: 1,
    daapDimension: ['Secure', 'Understandable', 'Addressable', 'Interoperable', 'Trustworthy'],
    bulkMetadataExists: true,
    bulkMetadataLocation: 'Snowflake comments',
    automationPossible: true,
    curationProcess: 'Comments auto-crawled; policies & contracts via GitHub + Atlan APIs',
    trackingField: 'cm_enrichment_status',
    governanceGuidelinesExist: true,
    industry: 'Manufacturing/HVAC',
    tenant: 'daikin',
  },

  // ============================================
  // POWERBI
  // ============================================
  {
    id: 'tmpl-powerbi-dash-owners',
    sourceSystem: 'PowerBI',
    assetType: 'Dashboard',
    metadataElements: ['ownerUsers'],
    manageableAmount: 'All assets',
    initialAmount: 150,
    daapDimension: ['Addressable'],
    bulkMetadataExists: false,
    automationPossible: true,
    curationProcess: 'Bulk assign from PowerBI workspace owners; validate',
    trackingField: 'cm_ownership',
    governanceGuidelinesExist: true,
    tenant: 'bandwidth',
  },
  {
    id: 'tmpl-powerbi-report-cert',
    sourceSystem: 'PowerBI',
    assetType: 'Report',
    metadataElements: ['certificateStatus'],
    manageableAmount: 'Business-critical',
    initialAmount: 50,
    daapDimension: ['Trustworthy'],
    bulkMetadataExists: false,
    automationPossible: false,
    curationProcess: 'Manual certification by report owners based on governance criteria',
    trackingField: 'cm_certification',
    governanceGuidelinesExist: true,
    tenant: 'bandwidth',
  },

  // ============================================
  // DBT
  // ============================================
  {
    id: 'tmpl-dbt-model-desc',
    sourceSystem: 'dbt',
    assetType: 'DbtModel',
    metadataElements: ['description'],
    manageableAmount: 'All assets',
    initialAmount: 300,
    daapDimension: ['Understandable'],
    bulkMetadataExists: true,
    bulkMetadataLocation: 'dbt YAML files',
    automationPossible: true,
    curationProcess: 'Auto-sync from dbt manifest; enforce in CI/CD',
    trackingField: '',
    governanceGuidelinesExist: true,
    tenant: 'bandwidth',
  },
  {
    id: 'tmpl-dbt-model-owners',
    sourceSystem: 'dbt',
    assetType: 'DbtModel',
    metadataElements: ['ownerUsers'],
    manageableAmount: 'All assets',
    initialAmount: 300,
    daapDimension: ['Addressable'],
    bulkMetadataExists: true,
    bulkMetadataLocation: 'dbt meta tags',
    automationPossible: true,
    curationProcess: 'Define ownership in dbt YAML; sync via connector',
    trackingField: '',
    governanceGuidelinesExist: true,
    tenant: 'bandwidth',
  },
];

/**
 * Get template rows filtered by criteria
 */
export function filterMetadataModelTemplates(criteria: {
  sourceSystem?: string;
  assetType?: string;
  metadataElement?: MetadataFieldType;
  tenant?: string;
  industry?: Industry;
}): MetadataModelRow[] {
  return METADATA_MODEL_TEMPLATES.filter(row => {
    if (criteria.sourceSystem && row.sourceSystem !== criteria.sourceSystem) return false;
    if (criteria.assetType && row.assetType !== criteria.assetType) return false;
    if (criteria.metadataElement && !row.metadataElements.includes(criteria.metadataElement)) return false;
    if (criteria.tenant && row.tenant !== criteria.tenant) return false;
    if (criteria.industry && row.industry !== criteria.industry) return false;
    return true;
  });
}

/**
 * Get recommended template rows based on connectors and use cases
 */
export function getRecommendedTemplateRows(
  connectors: string[]
): MetadataModelRow[] {
  const recommendations: MetadataModelRow[] = [];

  // Filter by connectors
  connectors.forEach(connector => {
    const matching = METADATA_MODEL_TEMPLATES.filter(row => 
      row.sourceSystem.toLowerCase().includes(connector.toLowerCase())
    );
    recommendations.push(...matching);
  });

  // If no connector match, return a base set
  if (recommendations.length === 0) {
    return METADATA_MODEL_TEMPLATES.filter(row => 
      row.sourceSystem === 'Snowflake' && row.assetType === 'Table'
    ).slice(0, 5);
  }

  return recommendations;
}

/**
 * Calculate total effort for a set of metadata model rows
 */
export function calculateTotalEffort(rows: MetadataModelRow[]): {
  totalAssets: number;
  estimatedDays: number;
  automatedRows: number;
  manualRows: number;
} {
  const totalAssets = rows.reduce((sum, row) => sum + row.initialAmount, 0);
  const automatedRows = rows.filter(row => row.automationPossible).length;
  const manualRows = rows.filter(row => !row.automationPossible).length;
  
  // Rough estimate: 1 asset/minute for manual, 10 assets/minute for automated
  const manualAssets = rows
    .filter(row => !row.automationPossible)
    .reduce((sum, row) => sum + row.initialAmount, 0);
  const automatedAssets = rows
    .filter(row => row.automationPossible)
    .reduce((sum, row) => sum + row.initialAmount, 0);
  
  const estimatedMinutes = (manualAssets * 1) + (automatedAssets * 0.1);
  const estimatedDays = Math.ceil(estimatedMinutes / (8 * 60)); // 8-hour days
  
  return {
    totalAssets,
    estimatedDays,
    automatedRows,
    manualRows,
  };
}
