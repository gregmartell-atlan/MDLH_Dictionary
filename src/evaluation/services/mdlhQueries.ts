// ============================================
// MDLH QUERY TEMPLATES
// Queries to run against Atlan's Metadata Lakehouse (Snowflake)
// ============================================

import type { MetadataFieldType } from '../types/priority';

const DEFAULT_GOLD_SCHEMA = 'ATLAN_GOLD.PUBLIC';
const BASE_EXCLUDED_TYPES = [
  'Glossary',
  'GlossaryTerm',
  'GlossaryCategory',
  'Persona',
  'Purpose',
  'AuthPolicy',
  'Readme',
  'Link',
  'File',
];

const BASE_EXCLUDED_TYPES_SQL = BASE_EXCLUDED_TYPES.map((t) => `'${t}'`).join(', ');
const ORPHAN_EXCLUDED_TYPES_SQL = [...BASE_EXCLUDED_TYPES, 'Column'].map((t) => `'${t}'`).join(', ');

export function getGoldSchema(database?: string, schema?: string): string {
  if (database && schema) {
    return `${database}.${schema}`;
  }
  if (database) {
    return database;
  }
  return DEFAULT_GOLD_SCHEMA;
}

function buildStatusFilter(): string {
  return "(STATUS IS NULL OR LOWER(STATUS) <> 'deleted')";
}

/**
 * Query to get field coverage across all assets
 * Returns counts of assets with each metadata field populated
 */
export const FIELD_COVERAGE_QUERY = (goldSchema: string) => `
SELECT
  COUNT(*) as total_assets,
  COUNT(CASE WHEN OWNER_USERS IS NOT NULL AND ARRAY_SIZE(OWNER_USERS) > 0 THEN 1 END) as with_owner_users,
  0 as with_owner_groups,
  COUNT(CASE WHEN DESCRIPTION IS NOT NULL AND TRIM(DESCRIPTION) != '' THEN 1 END) as with_description,
  COUNT(CASE WHEN DESCRIPTION IS NOT NULL AND TRIM(DESCRIPTION) != '' THEN 1 END) as with_user_description,
  COUNT(CASE WHEN README_GUID IS NOT NULL THEN 1 END) as with_readme,
  COUNT(CASE WHEN TAGS IS NOT NULL AND ARRAY_SIZE(TAGS) > 0 THEN 1 END) as with_atlan_tags,
  COUNT(CASE WHEN CERTIFICATE_STATUS IS NOT NULL AND TRIM(CERTIFICATE_STATUS) != '' THEN 1 END) as with_certificate,
  COUNT(CASE WHEN TERM_GUIDS IS NOT NULL AND ARRAY_SIZE(TERM_GUIDS) > 0 THEN 1 END) as with_glossary_terms,
  COUNT(CASE WHEN HAS_LINEAGE = true THEN 1 END) as with_lineage,
  0 as with_starred,
  0 as with_links
FROM ${goldSchema}.ASSETS
WHERE ${buildStatusFilter()}
  AND ASSET_TYPE NOT IN (${BASE_EXCLUDED_TYPES_SQL})
`;

/**
 * Query to get field coverage by asset type
 */
export const FIELD_COVERAGE_BY_TYPE_QUERY = (goldSchema: string) => `
SELECT
  ASSET_TYPE as asset_type,
  COUNT(*) as total_assets,
  COUNT(CASE WHEN OWNER_USERS IS NOT NULL AND ARRAY_SIZE(OWNER_USERS) > 0 THEN 1 END) as with_owner_users,
  COUNT(CASE WHEN DESCRIPTION IS NOT NULL AND TRIM(DESCRIPTION) != '' THEN 1 END) as with_description,
  COUNT(CASE WHEN TAGS IS NOT NULL AND ARRAY_SIZE(TAGS) > 0 THEN 1 END) as with_atlan_tags,
  COUNT(CASE WHEN CERTIFICATE_STATUS IS NOT NULL AND TRIM(CERTIFICATE_STATUS) != '' THEN 1 END) as with_certificate,
  COUNT(CASE WHEN TERM_GUIDS IS NOT NULL AND ARRAY_SIZE(TERM_GUIDS) > 0 THEN 1 END) as with_glossary_terms,
  COUNT(CASE WHEN HAS_LINEAGE = true THEN 1 END) as with_lineage
FROM ${goldSchema}.ASSETS
WHERE ${buildStatusFilter()}
  AND ASSET_TYPE NOT IN (${BASE_EXCLUDED_TYPES_SQL})
GROUP BY ASSET_TYPE
ORDER BY total_assets DESC
`;

/**
 * Query to get assets missing owners (orphan assets)
 */
export const ORPHAN_ASSETS_QUERY = (goldSchema: string) => `
SELECT
  ASSET_QUALIFIED_NAME as qualifiedName,
  ASSET_NAME as name,
  ASSET_TYPE as asset_type,
  CONNECTOR_NAME as connectorName,
  CERTIFICATE_STATUS as certificateStatus
FROM ${goldSchema}.ASSETS
WHERE ${buildStatusFilter()}
  AND (OWNER_USERS IS NULL OR ARRAY_SIZE(OWNER_USERS) = 0)
  AND ASSET_TYPE NOT IN (${ORPHAN_EXCLUDED_TYPES_SQL})
ORDER BY ASSET_TYPE, CONNECTOR_NAME
LIMIT 1000
`;

/**
 * Query to get completeness scores per asset
 */
export const COMPLETENESS_SCORE_QUERY = (goldSchema: string) => `
SELECT
  ASSET_QUALIFIED_NAME as qualifiedName,
  ASSET_NAME as name,
  ASSET_TYPE as asset_type,
  CONNECTOR_NAME as connectorName,
  (
    CASE WHEN OWNER_USERS IS NOT NULL AND ARRAY_SIZE(OWNER_USERS) > 0 THEN 30 ELSE 0 END +
    CASE WHEN DESCRIPTION IS NOT NULL AND TRIM(DESCRIPTION) != '' THEN 20 ELSE 0 END +
    CASE WHEN CERTIFICATE_STATUS IS NOT NULL AND TRIM(CERTIFICATE_STATUS) != '' THEN 25 ELSE 0 END +
    CASE WHEN TERM_GUIDS IS NOT NULL AND ARRAY_SIZE(TERM_GUIDS) > 0 THEN 15 ELSE 0 END +
    CASE WHEN TAGS IS NOT NULL AND ARRAY_SIZE(TAGS) > 0 THEN 25 ELSE 0 END +
    CASE WHEN HAS_LINEAGE = true THEN 10 ELSE 0 END
  ) as completeness_score
FROM ${goldSchema}.ASSETS
WHERE ${buildStatusFilter()}
  AND ASSET_TYPE NOT IN (${ORPHAN_EXCLUDED_TYPES_SQL})
ORDER BY completeness_score ASC
LIMIT 100
`;

/**
 * Query to get asset counts by connector
 */
export const ASSETS_BY_CONNECTOR_QUERY = (goldSchema: string) => `
SELECT
  CONNECTOR_NAME as connectorName,
  ASSET_TYPE as asset_type,
  COUNT(*) as asset_count,
  ROUND(AVG(
    CASE WHEN OWNER_USERS IS NOT NULL AND ARRAY_SIZE(OWNER_USERS) > 0 THEN 30 ELSE 0 END +
    CASE WHEN DESCRIPTION IS NOT NULL AND TRIM(DESCRIPTION) != '' THEN 20 ELSE 0 END +
    CASE WHEN CERTIFICATE_STATUS IS NOT NULL AND TRIM(CERTIFICATE_STATUS) != '' THEN 25 ELSE 0 END
  ), 1) as avg_completeness
FROM ${goldSchema}.ASSETS
WHERE ${buildStatusFilter()}
  AND ASSET_TYPE NOT IN (${BASE_EXCLUDED_TYPES_SQL})
GROUP BY CONNECTOR_NAME, ASSET_TYPE
ORDER BY CONNECTOR_NAME, asset_count DESC
`;

/**
 * Query to get trend data (requires historical table)
 */
export const COVERAGE_TREND_QUERY = (goldSchema: string, days: number = 30) => `
SELECT
  DATE_TRUNC('day', TO_TIMESTAMP_LTZ(UPDATED_AT / 1000)) as date,
  COUNT(*) as total_assets,
  COUNT(CASE WHEN OWNER_USERS IS NOT NULL AND ARRAY_SIZE(OWNER_USERS) > 0 THEN 1 END) as with_owner,
  COUNT(CASE WHEN DESCRIPTION IS NOT NULL AND TRIM(DESCRIPTION) != '' THEN 1 END) as with_description
FROM ${goldSchema}.ASSETS
WHERE ${buildStatusFilter()}
  AND UPDATED_AT IS NOT NULL
  AND TO_TIMESTAMP_LTZ(UPDATED_AT / 1000) >= DATEADD('day', -${days}, CURRENT_TIMESTAMP())
GROUP BY DATE_TRUNC('day', TO_TIMESTAMP_LTZ(UPDATED_AT / 1000))
ORDER BY date
`;

/**
 * Map query result columns to MetadataFieldType
 */
export const COLUMN_TO_FIELD_MAP: Record<string, MetadataFieldType> = {
  with_owner_users: 'ownerUsers',
  with_owner_groups: 'ownerGroups',
  with_description: 'description',
  with_user_description: 'userDescription',
  with_readme: 'readme',
  with_atlan_tags: 'atlanTags',
  with_certificate: 'certificateStatus',
  with_glossary_terms: 'glossaryTerms',
  with_lineage: 'lineage',
  with_starred: 'starredBy',
  with_links: 'links',
};

/**
 * Parse field coverage query results into FieldCoverage array
 */
export function parseFieldCoverageResult(row: Record<string, number>): {
  field: MetadataFieldType;
  totalAssets: number;
  populatedAssets: number;
  coveragePercent: number;
}[] {
  const totalAssets = row.total_assets || row.TOTAL_ASSETS || 0;
  const results: {
    field: MetadataFieldType;
    totalAssets: number;
    populatedAssets: number;
    coveragePercent: number;
  }[] = [];

  for (const [column, field] of Object.entries(COLUMN_TO_FIELD_MAP)) {
    const populatedAssets = row[column] || row[column.toUpperCase()] || 0;
    results.push({
      field,
      totalAssets,
      populatedAssets,
      coveragePercent: totalAssets > 0 ? populatedAssets / totalAssets : 0,
    });
  }

  return results;
}
