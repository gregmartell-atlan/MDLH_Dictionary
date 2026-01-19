/**
 * MDLH Query Templates
 * Centralized SQL templates for MDLH Gold layer
 * Single source of truth for all MDLH queries
 */

import { buildSafeFQN, buildLimit } from '../utils/sqlHelpers.js';

/**
 * MDLH Query Templates
 * Uses buildSafeFQN for safe table references [[memory:11947487]]
 */
export const MDLH = {
  /**
   * Fetch all assets from ASSETS table
   * Uses ATLAN_GOLD.PUBLIC.ASSETS which is a pre-built denormalized view
   * Column names are already user-friendly (ASSET_NAME, ASSET_TYPE, etc.)
   * Available columns: GUID, ASSET_TYPE, ASSET_NAME, ASSET_QUALIFIED_NAME, DESCRIPTION,
   *   README_GUID, STATUS, CREATED_AT, CREATED_BY, UPDATED_AT, UPDATED_BY,
   *   CERTIFICATE_STATUS, CERTIFICATE_UPDATED_BY, CERTIFICATE_UPDATED_AT,
   *   CONNECTOR_NAME, CONNECTOR_QUALIFIED_NAME, SOURCE_CREATED_AT, SOURCE_CREATED_BY,
   *   SOURCE_UPDATED_AT, SOURCE_UPDATED_BY, OWNER_USERS, TERM_GUIDS, POPULARITY_SCORE, TAGS, HAS_LINEAGE
   */
  FETCH_ASSETS: (database: string, schema: string, limit?: number): string => `
    SELECT
      GUID,
      ASSET_NAME,
      ASSET_TYPE,
      ASSET_QUALIFIED_NAME,
      CONNECTOR_NAME,
      OWNER_USERS,
      DESCRIPTION,
      README_GUID,
      TERM_GUIDS,
      TAGS,
      HAS_LINEAGE,
      CERTIFICATE_STATUS,
      POPULARITY_SCORE,
      SOURCE_UPDATED_AT
    FROM ${buildSafeFQN(database, schema, 'ASSETS')}
    ORDER BY POPULARITY_SCORE DESC NULLS LAST
    LIMIT ${buildLimit(limit)}
  `,

  /**
   * Get field coverage statistics
   */
  FIELD_COVERAGE: (database: string, schema: string): string => `
    SELECT
      COUNT(*) AS total_assets,
      COUNT_IF(ARRAY_SIZE(COALESCE(OWNER_USERS, ARRAY_CONSTRUCT())) > 0 
               OR ARRAY_SIZE(COALESCE(OWNER_GROUPS, ARRAY_CONSTRUCT())) > 0) AS with_owners,
      COUNT_IF(DESCRIPTION IS NOT NULL AND DESCRIPTION <> '') AS with_description,
      COUNT_IF(ARRAY_SIZE(COALESCE(TAGS, ARRAY_CONSTRUCT())) > 0) AS with_tags,
      COUNT_IF(ARRAY_SIZE(COALESCE(TERM_GUIDS, ARRAY_CONSTRUCT())) > 0) AS with_terms,
      COUNT_IF(HAS_LINEAGE = TRUE) AS with_lineage,
      COUNT_IF(CERTIFICATE_STATUS IS NOT NULL AND CERTIFICATE_STATUS NOT IN ('', 'NONE')) AS with_certificate,
      COUNT_IF(README_GUID IS NOT NULL) AS with_readme,
      COUNT_IF(POPULARITY_SCORE > 0) AS with_usage
    FROM ${buildSafeFQN(database, schema, 'ASSETS')}
    WHERE STATUS = 'ACTIVE'
  `,

  /**
   * Get domain (connector) breakdown
   */
  DOMAIN_BREAKDOWN: (database: string, schema: string): string => `
    SELECT
      COALESCE(CONNECTOR_NAME, 'Unknown') AS domain,
      COUNT(*) AS asset_count,
      AVG(COALESCE(POPULARITY_SCORE, 0)) AS avg_impact,
      COUNT_IF(DESCRIPTION IS NOT NULL AND DESCRIPTION <> '') AS with_description,
      COUNT_IF(ARRAY_SIZE(COALESCE(OWNER_USERS, ARRAY_CONSTRUCT())) > 0) AS with_owners
    FROM ${buildSafeFQN(database, schema, 'ASSETS')}
    WHERE STATUS = 'ACTIVE'
    GROUP BY CONNECTOR_NAME
    ORDER BY asset_count DESC
  `,

  /**
   * Get asset type breakdown
   */
  ASSET_TYPE_BREAKDOWN: (database: string, schema: string): string => `
    SELECT
      ASSET_TYPE,
      COUNT(*) AS asset_count,
      AVG(COALESCE(POPULARITY_SCORE, 0)) AS avg_impact
    FROM ${buildSafeFQN(database, schema, 'ASSETS')}
    WHERE STATUS = 'ACTIVE'
    GROUP BY ASSET_TYPE
    ORDER BY asset_count DESC
    LIMIT 50
  `,

  /**
   * Get high-impact assets (for prioritization)
   */
  HIGH_IMPACT_ASSETS: (database: string, schema: string, limit = 100): string => `
    SELECT
      GUID,
      ASSET_NAME,
      ASSET_TYPE,
      CONNECTOR_NAME,
      POPULARITY_SCORE,
      QUERY_COUNT,
      QUERY_USER_COUNT
    FROM ${buildSafeFQN(database, schema, 'ASSETS')}
    WHERE STATUS = 'ACTIVE'
      AND POPULARITY_SCORE > 0
    ORDER BY POPULARITY_SCORE DESC
    LIMIT ${buildLimit(limit, 1000)}
  `,

  /**
   * Get orphan assets (no ownership)
   */
  ORPHAN_ASSETS: (database: string, schema: string, limit = 500): string => `
    SELECT
      GUID,
      ASSET_NAME,
      ASSET_TYPE,
      CONNECTOR_NAME,
      POPULARITY_SCORE
    FROM ${buildSafeFQN(database, schema, 'ASSETS')}
    WHERE STATUS = 'ACTIVE'
      AND (OWNER_USERS IS NULL OR ARRAY_SIZE(OWNER_USERS) = 0)
      AND (OWNER_GROUPS IS NULL OR ARRAY_SIZE(OWNER_GROUPS) = 0)
    ORDER BY POPULARITY_SCORE DESC NULLS LAST
    LIMIT ${buildLimit(limit, 1000)}
  `,

  /**
   * Get undocumented assets
   */
  UNDOCUMENTED_ASSETS: (database: string, schema: string, limit = 500): string => `
    SELECT
      GUID,
      ASSET_NAME,
      ASSET_TYPE,
      CONNECTOR_NAME,
      POPULARITY_SCORE
    FROM ${buildSafeFQN(database, schema, 'ASSETS')}
    WHERE STATUS = 'ACTIVE'
      AND (DESCRIPTION IS NULL OR DESCRIPTION = '')
      AND README_GUID IS NULL
    ORDER BY POPULARITY_SCORE DESC NULLS LAST
    LIMIT ${buildLimit(limit, 1000)}
  `,
};

export type MdlhQueryKey = keyof typeof MDLH;
