/**
 * Pre-Built Pivot Registry
 * 
 * Consolidated registry of all pre-built pivot configurations from the 
 * metadata-quality-platform. These pivots represent common analysis patterns
 * for metadata governance and can be adapted to any MDLH structure.
 * 
 * Each pivot definition includes:
 * - Row dimensions to group by
 * - Measures to calculate
 * - SQL template for direct MDLH execution
 * - Display configuration
 */

// =============================================================================
// DIMENSION DEFINITIONS
// =============================================================================

export const PIVOT_DIMENSIONS = {
  // Hierarchy dimensions
  connection: {
    id: 'connection',
    label: 'Connection',
    icon: '🔗',
    mdlhColumn: 'CONNECTORNAME',
    alternates: ['CONNECTOR_NAME', 'CONNECTIONNAME', 'CONNECTION_NAME'],
    description: 'Source system connection (Snowflake, BigQuery, etc.)',
  },
  database: {
    id: 'database',
    label: 'Database',
    icon: '🗄️',
    mdlhColumn: 'DATABASEQUALIFIEDNAME',
    alternates: ['DATABASE_NAME', 'DATABASENAME'],
    extractFn: `SPLIT_PART(DATABASEQUALIFIEDNAME, '/', -1)`,
    description: 'Database name within connection',
  },
  schema: {
    id: 'schema',
    label: 'Schema',
    icon: '📁',
    mdlhColumn: 'SCHEMAQUALIFIEDNAME',
    alternates: ['SCHEMA_NAME', 'SCHEMANAME'],
    extractFn: `SPLIT_PART(SCHEMAQUALIFIEDNAME, '/', -1)`,
    description: 'Schema within database',
  },
  type: {
    id: 'type',
    label: 'Asset Type',
    icon: '📦',
    mdlhColumn: 'ASSET_TYPE',
    alternates: ['TYPENAME', 'TYPE_NAME'],
    description: 'Type of asset (Table, View, Column, Dashboard, etc.)',
  },
  
  // Ownership dimensions
  owner: {
    id: 'owner',
    label: 'Owner',
    icon: '👤',
    mdlhColumn: 'OWNERUSERS',
    alternates: ['OWNER_USERS'],
    extractFn: `COALESCE(OWNERUSERS[0]::STRING, 'Unowned')`,
    isArray: true,
    description: 'Primary owner user',
  },
  ownerGroup: {
    id: 'ownerGroup',
    label: 'Owner Group',
    icon: '👥',
    mdlhColumn: 'OWNERGROUPS',
    alternates: ['OWNER_GROUPS'],
    extractFn: `COALESCE(OWNERGROUPS[0]::STRING, 'Unowned')`,
    isArray: true,
    description: 'Primary owner group',
  },
  
  // Governance dimensions
  domain: {
    id: 'domain',
    label: 'Domain',
    icon: '🏢',
    mdlhColumn: 'DOMAINGUIDS',
    alternates: ['DOMAIN_GUIDS', '__DOMAINGUIDS'],
    extractFn: `COALESCE(DOMAINGUIDS[0]::STRING, 'No Domain')`,
    isArray: true,
    description: 'Business domain assignment',
  },
  certificationStatus: {
    id: 'certificationStatus',
    label: 'Certification',
    icon: '✓',
    mdlhColumn: 'CERTIFICATESTATUS',
    alternates: ['CERTIFICATE_STATUS'],
    extractFn: `COALESCE(CERTIFICATESTATUS, 'None')`,
    description: 'Certification status (VERIFIED, DRAFT, DEPRECATED, None)',
  },
  
  // Enrichment dimensions
  hasTerms: {
    id: 'hasTerms',
    label: 'Has Terms',
    icon: '📘',
    mdlhColumn: 'TERMGUIDS',
    alternates: ['TERM_GUIDS', 'MEANINGS'],
    extractFn: `CASE WHEN ARRAY_SIZE(TERMGUIDS) > 0 THEN 'Yes' ELSE 'No' END`,
    isArray: true,
    description: 'Whether asset has linked glossary terms',
  },
  hasTags: {
    id: 'hasTags',
    label: 'Has Tags',
    icon: '🏷️',
    mdlhColumn: 'CLASSIFICATIONNAMES',
    alternates: ['CLASSIFICATION_NAMES', 'TAGS'],
    extractFn: `CASE WHEN ARRAY_SIZE(CLASSIFICATIONNAMES) > 0 THEN 'Yes' ELSE 'No' END`,
    isArray: true,
    description: 'Whether asset has classification tags',
  },
  hasReadme: {
    id: 'hasReadme',
    label: 'Has README',
    icon: '📄',
    mdlhColumn: 'README_GUID',
    alternates: ['READMEGUID'],
    extractFn: `CASE WHEN README_GUID IS NOT NULL THEN 'Yes' ELSE 'No' END`,
    description: 'Whether asset has a README document',
  },
  
  // Usage dimensions
  popularityBucket: {
    id: 'popularityBucket',
    label: 'Popularity',
    icon: '🔥',
    mdlhColumn: 'POPULARITYSCORE',
    alternates: ['POPULARITY_SCORE'],
    extractFn: `CASE 
      WHEN POPULARITYSCORE >= 0.8 THEN 'Hot'
      WHEN POPULARITYSCORE >= 0.5 THEN 'Warm'
      WHEN POPULARITYSCORE > 0 THEN 'Normal'
      ELSE 'No Data'
    END`,
    description: 'Popularity bucket based on usage',
  },
  updateAgeBucket: {
    id: 'updateAgeBucket',
    label: 'Update Age',
    icon: '⏱️',
    mdlhColumn: 'UPDATED_AT',
    alternates: ['UPDATETIME', 'UPDATE_TIME'],
    extractFn: `CASE
      WHEN DATEDIFF(DAY, TO_TIMESTAMP(UPDATED_AT / 1000), CURRENT_TIMESTAMP()) <= 30 THEN '0-30d'
      WHEN DATEDIFF(DAY, TO_TIMESTAMP(UPDATED_AT / 1000), CURRENT_TIMESTAMP()) <= 90 THEN '31-90d'
      WHEN DATEDIFF(DAY, TO_TIMESTAMP(UPDATED_AT / 1000), CURRENT_TIMESTAMP()) <= 180 THEN '91-180d'
      ELSE '180d+'
    END`,
    description: 'Time since last update',
  },
  
  // Lineage dimensions
  lineageStatus: {
    id: 'lineageStatus',
    label: 'Lineage Status',
    icon: '🔗',
    mdlhColumn: 'HASLINEAGE',
    alternates: ['HAS_LINEAGE', '__HASLINEAGE'],
    extractFn: `CASE WHEN HASLINEAGE = TRUE THEN 'Has Lineage' ELSE 'No Lineage' END`,
    description: 'Whether asset has lineage',
  },
};

// =============================================================================
// MEASURE DEFINITIONS
// =============================================================================

export const PIVOT_MEASURES = {
  // Count measures
  assetCount: {
    id: 'assetCount',
    label: '# Assets',
    icon: '📊',
    sql: 'COUNT(*)',
    format: 'number',
    description: 'Total number of assets in group',
  },
  
  // Coverage measures
  descriptionCoverage: {
    id: 'descriptionCoverage',
    label: '% Described',
    icon: '📝',
    sql: `ROUND(COUNT_IF(DESCRIPTION IS NOT NULL AND DESCRIPTION <> '') * 100.0 / NULLIF(COUNT(*), 0), 1)`,
    format: 'percent',
    description: 'Percentage of assets with descriptions',
  },
  ownerCoverage: {
    id: 'ownerCoverage',
    label: '% Owned',
    icon: '👤',
    sql: `ROUND(COUNT_IF(ARRAY_SIZE(OWNERUSERS) > 0 OR ARRAY_SIZE(OWNERGROUPS) > 0) * 100.0 / NULLIF(COUNT(*), 0), 1)`,
    format: 'percent',
    description: 'Percentage of assets with owners assigned',
  },
  certificationCoverage: {
    id: 'certificationCoverage',
    label: 'Cert Rate',
    icon: '✓',
    sql: `ROUND(COUNT_IF(CERTIFICATESTATUS = 'VERIFIED') * 100.0 / NULLIF(COUNT(*), 0), 1)`,
    format: 'percent',
    description: 'Percentage of assets certified',
  },
  termCoverage: {
    id: 'termCoverage',
    label: '% with Terms',
    icon: '📘',
    sql: `ROUND(COUNT_IF(ARRAY_SIZE(TERMGUIDS) > 0) * 100.0 / NULLIF(COUNT(*), 0), 1)`,
    format: 'percent',
    description: 'Percentage of assets linked to glossary terms',
  },
  tagCoverage: {
    id: 'tagCoverage',
    label: '% Tagged',
    icon: '🏷️',
    sql: `ROUND(COUNT_IF(ARRAY_SIZE(CLASSIFICATIONNAMES) > 0) * 100.0 / NULLIF(COUNT(*), 0), 1)`,
    format: 'percent',
    description: 'Percentage of assets with classification tags',
  },
  
  // Lineage measures
  lineageCoverage: {
    id: 'lineageCoverage',
    label: 'Lineage Coverage',
    icon: '🔗',
    sql: `ROUND(COUNT_IF(HASLINEAGE = TRUE) * 100.0 / NULLIF(COUNT(*), 0), 1)`,
    format: 'percent',
    description: 'Percentage of assets with lineage',
  },
  hasUpstream: {
    id: 'hasUpstream',
    label: 'Has Upstream',
    icon: '⬆️',
    sql: `ROUND(COUNT_IF(HASLINEAGE = TRUE) * 100.0 / NULLIF(COUNT(*), 0), 1)`, // Simplified - needs lineage table join
    format: 'percent',
    description: 'Percentage with upstream lineage',
  },
  hasDownstream: {
    id: 'hasDownstream',
    label: 'Has Downstream',
    icon: '⬇️',
    sql: `ROUND(COUNT_IF(HASLINEAGE = TRUE) * 100.0 / NULLIF(COUNT(*), 0), 1)`, // Simplified - needs lineage table join
    format: 'percent',
    description: 'Percentage with downstream lineage',
  },
  fullLineage: {
    id: 'fullLineage',
    label: 'Full Lineage',
    icon: '↕️',
    sql: `ROUND(COUNT_IF(HASLINEAGE = TRUE) * 100.0 / NULLIF(COUNT(*), 0), 1)`, // Simplified
    format: 'percent',
    description: 'Percentage with both upstream and downstream',
  },
  orphaned: {
    id: 'orphaned',
    label: 'Orphaned',
    icon: '⚠️',
    sql: `COUNT_IF(HASLINEAGE = FALSE OR HASLINEAGE IS NULL)`,
    format: 'number',
    description: 'Number of assets without lineage',
  },
  
  // Certification breakdown
  certifiedCount: {
    id: 'certifiedCount',
    label: '✓ Certified',
    icon: '✓',
    sql: `COUNT_IF(CERTIFICATESTATUS = 'VERIFIED')`,
    format: 'number',
    description: 'Number of certified assets',
  },
  draftCount: {
    id: 'draftCount',
    label: '◐ Draft',
    icon: '◐',
    sql: `COUNT_IF(CERTIFICATESTATUS = 'DRAFT')`,
    format: 'number',
    description: 'Number of draft assets',
  },
  deprecatedCount: {
    id: 'deprecatedCount',
    label: '✗ Deprecated',
    icon: '✗',
    sql: `COUNT_IF(CERTIFICATESTATUS = 'DEPRECATED')`,
    format: 'number',
    description: 'Number of deprecated assets',
  },
  noCertCount: {
    id: 'noCertCount',
    label: '○ None',
    icon: '○',
    sql: `COUNT_IF(CERTIFICATESTATUS IS NULL OR CERTIFICATESTATUS NOT IN ('VERIFIED', 'DRAFT', 'DEPRECATED'))`,
    format: 'number',
    description: 'Number of uncertified assets',
  },
  
  // Quality score measures (computed)
  avgCompleteness: {
    id: 'avgCompleteness',
    label: 'Avg Completeness',
    icon: '📊',
    sql: `ROUND((
      COALESCE(COUNT_IF(DESCRIPTION IS NOT NULL AND DESCRIPTION <> ''), 0) * 25.0 +
      COALESCE(COUNT_IF(ARRAY_SIZE(OWNERUSERS) > 0 OR ARRAY_SIZE(OWNERGROUPS) > 0), 0) * 25.0 +
      COALESCE(COUNT_IF(CERTIFICATESTATUS IS NOT NULL), 0) * 25.0 +
      COALESCE(COUNT_IF(ARRAY_SIZE(TERMGUIDS) > 0), 0) * 25.0
    ) / NULLIF(COUNT(*), 0), 1)`,
    format: 'percent',
    description: 'Average completeness score based on key fields',
  },
};

// =============================================================================
// PRE-BUILT PIVOT CONFIGURATIONS
// =============================================================================

export const PREBUILT_PIVOTS = [
  // =========================================================================
  // PIVOT 1: Completeness by Connection & Asset Type
  // =========================================================================
  {
    id: 'completeness_by_connection_type',
    name: 'Completeness by Connection & Asset Type',
    description: 'Which source systems and asset types need the most documentation work?',
    category: 'Completeness',
    icon: '📊',
    color: 'blue',
    
    rowDimensions: ['connection', 'type'],
    measures: ['assetCount', 'descriptionCoverage', 'ownerCoverage', 'avgCompleteness'],
    
    insights: [
      { type: 'danger', pattern: 'avgCompleteness < 40', message: 'Low completeness indicates significant documentation gaps' },
      { type: 'success', pattern: 'avgCompleteness >= 80', message: 'High completeness - use as template for other systems' },
    ],
    
    sqlTemplate: `
      SELECT
        COALESCE(CONNECTORNAME, 'Unknown') AS connection,
        COALESCE(ASSET_TYPE, 'Unknown') AS asset_type,
        COUNT(*) AS asset_count,
        ROUND(COUNT_IF(DESCRIPTION IS NOT NULL AND DESCRIPTION <> '') * 100.0 / NULLIF(COUNT(*), 0), 1) AS description_coverage,
        ROUND(COUNT_IF(ARRAY_SIZE(OWNERUSERS) > 0 OR ARRAY_SIZE(OWNERGROUPS) > 0) * 100.0 / NULLIF(COUNT(*), 0), 1) AS owner_coverage,
        ROUND((
          COALESCE(COUNT_IF(DESCRIPTION IS NOT NULL), 0) * 25.0 +
          COALESCE(COUNT_IF(ARRAY_SIZE(OWNERUSERS) > 0 OR ARRAY_SIZE(OWNERGROUPS) > 0), 0) * 25.0 +
          COALESCE(COUNT_IF(CERTIFICATESTATUS IS NOT NULL), 0) * 25.0 +
          COALESCE(COUNT_IF(ARRAY_SIZE(TERMGUIDS) > 0), 0) * 25.0
        ) / NULLIF(COUNT(*), 0), 1) AS avg_completeness
      FROM {{TABLE}}
      WHERE STATUS = 'ACTIVE'
      GROUP BY 1, 2
      ORDER BY connection, asset_type
    `,
  },
  
  // =========================================================================
  // PIVOT 2: Quality Scorecard by Domain
  // =========================================================================
  {
    id: 'quality_scorecard_domain',
    name: 'Quality Scorecard: Domain × Dimension',
    description: 'Heatmap showing quality scores across all dimensions by business domain',
    category: 'Quality',
    icon: '🏢',
    color: 'purple',
    
    rowDimensions: ['domain'],
    measures: ['assetCount', 'descriptionCoverage', 'ownerCoverage', 'certificationCoverage', 'termCoverage', 'tagCoverage'],
    
    insights: [
      { type: 'danger', pattern: 'overall < 40', message: 'Domain needs immediate attention' },
      { type: 'warning', pattern: 'termCoverage < 50', message: 'Low glossary term linkage - semantic context missing' },
      { type: 'success', pattern: 'overall >= 80', message: 'High quality domain - model for others' },
    ],
    
    sqlTemplate: `
      SELECT
        COALESCE(DOMAINGUIDS[0]::STRING, 'No Domain') AS domain,
        COUNT(*) AS asset_count,
        ROUND(COUNT_IF(DESCRIPTION IS NOT NULL AND DESCRIPTION <> '') * 100.0 / NULLIF(COUNT(*), 0), 1) AS description_coverage,
        ROUND(COUNT_IF(ARRAY_SIZE(OWNERUSERS) > 0 OR ARRAY_SIZE(OWNERGROUPS) > 0) * 100.0 / NULLIF(COUNT(*), 0), 1) AS owner_coverage,
        ROUND(COUNT_IF(CERTIFICATESTATUS = 'VERIFIED') * 100.0 / NULLIF(COUNT(*), 0), 1) AS certification_coverage,
        ROUND(COUNT_IF(ARRAY_SIZE(TERMGUIDS) > 0) * 100.0 / NULLIF(COUNT(*), 0), 1) AS term_coverage,
        ROUND(COUNT_IF(ARRAY_SIZE(CLASSIFICATIONNAMES) > 0) * 100.0 / NULLIF(COUNT(*), 0), 1) AS tag_coverage
      FROM {{TABLE}}
      WHERE STATUS = 'ACTIVE'
      GROUP BY 1
      ORDER BY asset_count DESC
    `,
  },
  
  // =========================================================================
  // PIVOT 3: Owner Accountability - Certification Coverage
  // =========================================================================
  {
    id: 'owner_accountability_certification',
    name: 'Owner Accountability: Certification Coverage',
    description: 'Who is certifying their assets vs. leaving them in draft or unverified state?',
    category: 'Accountability',
    icon: '👥',
    color: 'amber',
    
    rowDimensions: ['ownerGroup'],
    measures: ['certifiedCount', 'draftCount', 'deprecatedCount', 'noCertCount', 'assetCount', 'certificationCoverage'],
    
    insights: [
      { type: 'danger', pattern: 'ownerGroup === "Unowned"', message: 'Unowned assets cannot be certified - assign owners first' },
      { type: 'warning', pattern: 'certificationCoverage < 30', message: 'Low certification rate - needs certification push' },
      { type: 'success', pattern: 'certificationCoverage >= 80', message: 'High certification - use as template for other teams' },
    ],
    
    sqlTemplate: `
      SELECT
        COALESCE(OWNERGROUPS[0]::STRING, OWNERUSERS[0]::STRING, 'Unowned') AS owner_group,
        COUNT_IF(CERTIFICATESTATUS = 'VERIFIED') AS certified_count,
        COUNT_IF(CERTIFICATESTATUS = 'DRAFT') AS draft_count,
        COUNT_IF(CERTIFICATESTATUS = 'DEPRECATED') AS deprecated_count,
        COUNT_IF(CERTIFICATESTATUS IS NULL OR CERTIFICATESTATUS NOT IN ('VERIFIED', 'DRAFT', 'DEPRECATED')) AS no_cert_count,
        COUNT(*) AS total_assets,
        ROUND(COUNT_IF(CERTIFICATESTATUS = 'VERIFIED') * 100.0 / NULLIF(COUNT(*), 0), 1) AS cert_rate
      FROM {{TABLE}}
      WHERE STATUS = 'ACTIVE'
      GROUP BY 1
      ORDER BY total_assets DESC
    `,
  },
  
  // =========================================================================
  // PIVOT 4: Lineage Coverage by Source System
  // =========================================================================
  {
    id: 'lineage_coverage_source',
    name: 'Lineage Coverage: Source Systems',
    description: 'Which connections have documented lineage vs. orphaned assets?',
    category: 'Lineage',
    icon: '🔗',
    color: 'cyan',
    
    rowDimensions: ['connection', 'database', 'schema'],
    measures: ['assetCount', 'lineageCoverage', 'orphaned'],
    
    insights: [
      { type: 'danger', pattern: 'orphaned > 100', message: 'High orphan count - no lineage context' },
      { type: 'success', pattern: 'lineageCoverage >= 95', message: 'Excellent lineage coverage - leverage for propagation' },
    ],
    
    sqlTemplate: `
      SELECT
        COALESCE(CONNECTORNAME, 'Unknown') AS connection,
        SPLIT_PART(DATABASEQUALIFIEDNAME, '/', -1) AS database_name,
        SPLIT_PART(SCHEMAQUALIFIEDNAME, '/', -1) AS schema_name,
        COUNT(*) AS asset_count,
        ROUND(COUNT_IF(HASLINEAGE = TRUE) * 100.0 / NULLIF(COUNT(*), 0), 1) AS lineage_coverage,
        COUNT_IF(HASLINEAGE = FALSE OR HASLINEAGE IS NULL) AS orphaned
      FROM {{TABLE}}
      WHERE STATUS = 'ACTIVE'
        AND ASSET_TYPE IN ('Table', 'View', 'SnowflakeTable', 'SnowflakeView')
      GROUP BY 1, 2, 3
      ORDER BY connection, database_name, schema_name
    `,
  },
  
  // =========================================================================
  // PIVOT 5: Semantic Enrichment Status
  // =========================================================================
  {
    id: 'semantic_enrichment',
    name: 'Semantic Enrichment Status',
    description: 'Which assets have glossary terms, tags, and descriptions?',
    category: 'Semantics',
    icon: '📘',
    color: 'indigo',
    
    rowDimensions: ['type', 'certificationStatus'],
    measures: ['assetCount', 'descriptionCoverage', 'termCoverage', 'tagCoverage'],
    
    insights: [
      { type: 'warning', pattern: 'termCoverage < 30', message: 'Low term linkage - semantic context missing' },
      { type: 'info', pattern: 'certificationStatus === "VERIFIED" && termCoverage < 50', message: 'Certified assets should have glossary terms' },
    ],
    
    sqlTemplate: `
      SELECT
        COALESCE(ASSET_TYPE, 'Unknown') AS asset_type,
        COALESCE(CERTIFICATESTATUS, 'None') AS certification_status,
        COUNT(*) AS asset_count,
        ROUND(COUNT_IF(DESCRIPTION IS NOT NULL AND DESCRIPTION <> '') * 100.0 / NULLIF(COUNT(*), 0), 1) AS description_coverage,
        ROUND(COUNT_IF(ARRAY_SIZE(TERMGUIDS) > 0) * 100.0 / NULLIF(COUNT(*), 0), 1) AS term_coverage,
        ROUND(COUNT_IF(ARRAY_SIZE(CLASSIFICATIONNAMES) > 0) * 100.0 / NULLIF(COUNT(*), 0), 1) AS tag_coverage
      FROM {{TABLE}}
      WHERE STATUS = 'ACTIVE'
      GROUP BY 1, 2
      ORDER BY asset_type, certification_status
    `,
  },
  
  // =========================================================================
  // PIVOT 6: Usage & Popularity Analysis
  // =========================================================================
  {
    id: 'usage_popularity',
    name: 'Usage & Popularity Analysis',
    description: 'Which assets are most used and how does quality correlate with usage?',
    category: 'Usage',
    icon: '🔥',
    color: 'orange',
    
    rowDimensions: ['popularityBucket', 'type'],
    measures: ['assetCount', 'descriptionCoverage', 'ownerCoverage', 'certificationCoverage'],
    
    insights: [
      { type: 'danger', pattern: 'popularityBucket === "Hot" && descriptionCoverage < 50', message: 'Hot assets without documentation create risk' },
      { type: 'success', pattern: 'popularityBucket === "Hot" && certificationCoverage >= 80', message: 'Popular and well-governed' },
    ],
    
    sqlTemplate: `
      SELECT
        CASE 
          WHEN POPULARITYSCORE >= 0.8 THEN 'Hot'
          WHEN POPULARITYSCORE >= 0.5 THEN 'Warm'
          WHEN POPULARITYSCORE > 0 THEN 'Normal'
          ELSE 'No Data'
        END AS popularity_bucket,
        COALESCE(ASSET_TYPE, 'Unknown') AS asset_type,
        COUNT(*) AS asset_count,
        ROUND(COUNT_IF(DESCRIPTION IS NOT NULL AND DESCRIPTION <> '') * 100.0 / NULLIF(COUNT(*), 0), 1) AS description_coverage,
        ROUND(COUNT_IF(ARRAY_SIZE(OWNERUSERS) > 0 OR ARRAY_SIZE(OWNERGROUPS) > 0) * 100.0 / NULLIF(COUNT(*), 0), 1) AS owner_coverage,
        ROUND(COUNT_IF(CERTIFICATESTATUS = 'VERIFIED') * 100.0 / NULLIF(COUNT(*), 0), 1) AS certification_coverage
      FROM {{TABLE}}
      WHERE STATUS = 'ACTIVE'
      GROUP BY 1, 2
      ORDER BY 1, 2
    `,
  },
  
  // =========================================================================
  // PIVOT 7: Staleness Analysis
  // =========================================================================
  {
    id: 'staleness_analysis',
    name: 'Staleness Analysis',
    description: 'How fresh is the metadata? When were assets last updated?',
    category: 'Freshness',
    icon: '⏱️',
    color: 'emerald',
    
    rowDimensions: ['updateAgeBucket', 'connection'],
    measures: ['assetCount', 'ownerCoverage', 'certificationCoverage'],
    
    insights: [
      { type: 'warning', pattern: 'updateAgeBucket === "180d+" && assetCount > 100', message: 'Many stale assets - may need review campaign' },
      { type: 'info', pattern: 'updateAgeBucket === "0-30d"', message: 'Recently updated assets' },
    ],
    
    sqlTemplate: `
      SELECT
        CASE
          WHEN DATEDIFF(DAY, TO_TIMESTAMP(UPDATED_AT / 1000), CURRENT_TIMESTAMP()) <= 30 THEN '0-30d'
          WHEN DATEDIFF(DAY, TO_TIMESTAMP(UPDATED_AT / 1000), CURRENT_TIMESTAMP()) <= 90 THEN '31-90d'
          WHEN DATEDIFF(DAY, TO_TIMESTAMP(UPDATED_AT / 1000), CURRENT_TIMESTAMP()) <= 180 THEN '91-180d'
          ELSE '180d+'
        END AS update_age_bucket,
        COALESCE(CONNECTORNAME, 'Unknown') AS connection,
        COUNT(*) AS asset_count,
        ROUND(COUNT_IF(ARRAY_SIZE(OWNERUSERS) > 0 OR ARRAY_SIZE(OWNERGROUPS) > 0) * 100.0 / NULLIF(COUNT(*), 0), 1) AS owner_coverage,
        ROUND(COUNT_IF(CERTIFICATESTATUS = 'VERIFIED') * 100.0 / NULLIF(COUNT(*), 0), 1) AS certification_coverage
      FROM {{TABLE}}
      WHERE STATUS = 'ACTIVE'
      GROUP BY 1, 2
      ORDER BY 1, 2
    `,
  },
  
  // =========================================================================
  // PIVOT 8: Classification/Sensitivity Coverage
  // =========================================================================
  {
    id: 'classification_coverage',
    name: 'Classification & Sensitivity Coverage',
    description: 'Which assets have been classified for data sensitivity?',
    category: 'Compliance',
    icon: '🔒',
    color: 'red',
    
    rowDimensions: ['connection', 'type'],
    measures: ['assetCount', 'tagCoverage'],
    
    insights: [
      { type: 'danger', pattern: 'tagCoverage < 20', message: 'Low classification coverage - compliance risk' },
      { type: 'success', pattern: 'tagCoverage >= 80', message: 'Well-classified for compliance' },
    ],
    
    sqlTemplate: `
      SELECT
        COALESCE(CONNECTORNAME, 'Unknown') AS connection,
        COALESCE(ASSET_TYPE, 'Unknown') AS asset_type,
        COUNT(*) AS asset_count,
        ROUND(COUNT_IF(ARRAY_SIZE(CLASSIFICATIONNAMES) > 0) * 100.0 / NULLIF(COUNT(*), 0), 1) AS tag_coverage
      FROM {{TABLE}}
      WHERE STATUS = 'ACTIVE'
      GROUP BY 1, 2
      ORDER BY connection, asset_type
    `,
  },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get a pivot configuration by ID
 */
export function getPivotById(pivotId) {
  return PREBUILT_PIVOTS.find(p => p.id === pivotId);
}

/**
 * Get all pivots for a specific category
 */
export function getPivotsByCategory(category) {
  return PREBUILT_PIVOTS.filter(p => p.category === category);
}

/**
 * Get all unique categories
 */
export function getPivotCategories() {
  const categories = [...new Set(PREBUILT_PIVOTS.map(p => p.category))];
  return categories;
}

/**
 * Generate SQL for a pivot with a specific table FQN
 */
export function generatePivotSQL(pivotId, tableFqn) {
  const pivot = getPivotById(pivotId);
  if (!pivot) return null;
  
  return pivot.sqlTemplate.replace(/\{\{TABLE\}\}/g, tableFqn);
}

/**
 * Get dimension definition
 */
export function getDimension(dimensionId) {
  return PIVOT_DIMENSIONS[dimensionId];
}

/**
 * Get measure definition
 */
export function getMeasure(measureId) {
  return PIVOT_MEASURES[measureId];
}

/**
 * Build a custom pivot SQL from dimensions and measures
 */
export function buildCustomPivotSQL(rowDimensions, measures, tableFqn, whereClause = "STATUS = 'ACTIVE'") {
  // Build SELECT clause
  const selectParts = [];
  const groupByParts = [];
  
  // Add dimension columns
  rowDimensions.forEach((dimId, idx) => {
    const dim = PIVOT_DIMENSIONS[dimId];
    if (dim) {
      const selectExpr = dim.extractFn || `COALESCE(${dim.mdlhColumn}, 'Unknown')`;
      selectParts.push(`${selectExpr} AS ${dim.id}`);
      groupByParts.push(idx + 1);
    }
  });
  
  // Add measure columns
  measures.forEach(measureId => {
    const measure = PIVOT_MEASURES[measureId];
    if (measure) {
      selectParts.push(`${measure.sql} AS ${measure.id}`);
    }
  });
  
  // Build complete SQL
  const sql = `
SELECT
  ${selectParts.join(',\n  ')}
FROM ${tableFqn}
WHERE ${whereClause}
GROUP BY ${groupByParts.join(', ')}
ORDER BY ${groupByParts.join(', ')}
  `.trim();
  
  return sql;
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  PIVOT_DIMENSIONS,
  PIVOT_MEASURES,
  PREBUILT_PIVOTS,
  getPivotById,
  getPivotsByCategory,
  getPivotCategories,
  generatePivotSQL,
  getDimension,
  getMeasure,
  buildCustomPivotSQL,
};
