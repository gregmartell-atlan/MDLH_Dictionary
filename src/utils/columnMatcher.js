/**
 * Smart Column Matcher
 *
 * Provides intelligent matching between metadata model fields and actual
 * database column names using:
 * - Synonym dictionaries for common naming patterns
 * - Fuzzy matching with Levenshtein distance
 * - Pattern-based inference (prefixes, suffixes, separators)
 * - Confidence scoring for match quality
 *
 * This enables the MDLH Dict tool to work with various MDLH schemas
 * without requiring exact column name matches.
 * 
 * Ported from atlan-metadata-evaluation/packages/web/lib/column-matcher.ts
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Confidence score thresholds
 */
export const MATCH_CONFIDENCE = {
  exactMdlh: 1.0,
  synonymExact: 0.95,
  normalized: 0.85,
  synonymNormalized: 0.80,
  fuzzyMultiplier: 0.8,
  fuzzyMinSimilarity: 0.7,
  thresholds: {
    high: 0.9,
    medium: 0.7,
    low: 0.5,
  },
};

/**
 * Field synonyms - maps canonical field IDs to common column name patterns
 */
export const FIELD_SYNONYMS = {
  // Ownership
  owner_users: [
    'OWNER', 'OWNERS', 'OWNER_USERS', 'OWNERUSERS', 'ASSET_OWNER',
    'OWNED_BY', 'STEWARD', 'STEWARDS', 'DATA_OWNER', 'DATAOWNER',
    'RESPONSIBLE', 'ACCOUNTABLE', 'OWNER_USER', 'OWNERUSER',
  ],
  owner_groups: [
    'OWNER_GROUPS', 'OWNERGROUPS', 'OWNER_GROUP', 'OWNERGROUP',
    'TEAM', 'TEAMS', 'OWNING_TEAM', 'STEWARD_GROUP', 'STEWARDGROUPS',
  ],
  admin_users: [
    'ADMIN', 'ADMINS', 'ADMIN_USERS', 'ADMINUSERS', 'ADMIN_USER',
    'ADMINISTRATOR', 'ADMINISTRATORS',
  ],
  admin_groups: [
    'ADMIN_GROUPS', 'ADMINGROUPS', 'ADMIN_GROUP', 'ADMINGROUP',
  ],

  // Documentation / Semantics
  description: [
    'DESCRIPTION', 'DESC', 'ASSET_DESCRIPTION', 'ASSETDESCRIPTION',
    'USER_DESCRIPTION', 'USERDESCRIPTION', 'SUMMARY', 'ABOUT',
    'DEFINITION', 'ASSET_DESC', 'BUSINESS_DESCRIPTION',
  ],
  readme: [
    'README', 'README_GUID', 'READMEGUID', 'README_ID', 'READMEID',
    'DOCUMENTATION', 'DOCS', 'RUNBOOK', 'LONG_DESCRIPTION',
  ],
  glossary_terms: [
    'ASSIGNEDTERMS', 'ASSIGNED_TERMS', 'MEANINGS', 'MEANING',
    'GLOSSARY_TERMS', 'GLOSSARYTERMS', 'TERMS', 'LINKED_TERMS',
    'BUSINESS_TERMS', 'TERM_GUIDS', 'TERMGUIDS',
  ],

  // Classification / Sensitivity
  classifications: [
    'CLASSIFICATIONNAMES', 'CLASSIFICATION_NAMES', 'CLASSIFICATIONS',
    'CLASSIFICATION', 'TAGS', 'ATLAN_TAGS', 'ATLANTAGS',
    'SENSITIVITY', 'SENSITIVITY_TAGS', 'DATA_CLASSIFICATION',
  ],
  pii_classification: [
    'PII', 'PII_FLAG', 'PIIFLAG', 'IS_PII', 'ISPII', 'HAS_PII',
    'PII_TYPE', 'PIITYPE', 'PERSONAL_DATA', 'PERSONALDATA',
  ],

  // Trust / Governance
  certificate_status: [
    'CERTIFICATESTATUS', 'CERTIFICATE_STATUS', 'CERTIFICATE',
    'CERTIFICATION', 'CERTIFIED', 'IS_CERTIFIED', 'ISCERTIFIED',
    'TRUST_STATUS', 'ENDORSEMENT', 'ENDORSEMENTSTATUS',
  ],
  certificate_message: [
    'CERTIFICATESTATUSMESSAGE', 'CERTIFICATE_STATUS_MESSAGE',
    'CERTIFICATE_MESSAGE', 'CERTIFICATEMESSAGE', 'CERT_MESSAGE',
  ],

  // Lineage
  has_lineage: [
    'HASLINEAGE', 'HAS_LINEAGE', 'LINEAGE', 'LINEAGE_EXISTS',
    'HAS_UPSTREAM', 'HAS_DOWNSTREAM', 'LINEAGE_FLAG',
  ],
  lineage_upstream: [
    'UPSTREAM', 'UPSTREAM_LINEAGE', 'INPUTS', 'INPUT_TO',
    'INPUTTOPROCESSES', 'INPUT_TO_PROCESSES', 'SOURCE_LINEAGE',
  ],
  lineage_downstream: [
    'DOWNSTREAM', 'DOWNSTREAM_LINEAGE', 'OUTPUTS', 'OUTPUT_FROM',
    'OUTPUTFROMPROCESSES', 'OUTPUT_FROM_PROCESSES', 'TARGET_LINEAGE',
  ],

  // Quality
  dq_score: [
    'DQSCORE', 'DQ_SCORE', 'DATA_QUALITY_SCORE', 'DATAQUALITYSCORE',
    'QUALITY_SCORE', 'QUALITYSCORE', 'DQ_PERCENT', 'QUALITY',
  ],
  freshness: [
    'FRESHNESS', 'DATA_FRESHNESS', 'DATAFRESHNESS', 'LAST_SYNC',
    'LAST_UPDATED', 'LASTUPDATED', 'STALENESS', 'AGE',
  ],

  // Usage
  popularity_score: [
    'POPULARITYSCORE', 'POPULARITY_SCORE', 'POPULARITY',
    'USAGE_SCORE', 'USAGESCORE', 'VIEW_COUNT', 'VIEWCOUNT',
    'QUERY_COUNT', 'QUERYCOUNT', 'ACCESS_COUNT',
  ],

  // Identifiers
  guid: [
    'GUID', 'ID', 'ASSET_GUID', 'ASSETGUID', 'ENTITY_GUID',
    'ENTITYGUID', 'UNIQUE_ID', 'UNIQUEID', 'UUID',
  ],
  qualified_name: [
    'QUALIFIEDNAME', 'QUALIFIED_NAME', 'QN', 'FQN',
    'FULLY_QUALIFIED_NAME', 'FULLYQUALIFIEDNAME', 'ASSET_QN',
  ],
  name: [
    'NAME', 'ASSET_NAME', 'ASSETNAME', 'DISPLAY_NAME', 'DISPLAYNAME',
    'TITLE', 'LABEL',
  ],
  typename: [
    'TYPENAME', 'TYPE_NAME', 'TYPE', 'ASSET_TYPE', 'ASSETTYPE',
    'ENTITY_TYPE', 'ENTITYTYPE', 'OBJECT_TYPE',
  ],

  // Status
  status: [
    'STATUS', 'ASSET_STATUS', 'ASSETSTATUS', 'STATE',
    'LIFECYCLE_STATUS', 'LIFECYCLESTATUS', 'IS_ACTIVE',
  ],

  // Timestamps
  created_at: [
    'CREATEDAT', 'CREATED_AT', 'CREATE_TIME', 'CREATETIME',
    'CREATED', 'CREATION_DATE', 'CREATIONDATE', '__CREATEDAT',
  ],
  updated_at: [
    'UPDATEDAT', 'UPDATED_AT', 'UPDATE_TIME', 'UPDATETIME',
    'MODIFIED', 'MODIFIED_AT', 'MODIFIEDAT', 'LAST_MODIFIED',
    '__MODIFICATIONTIMESTAMP', '__UPDATEDAT',
  ],

  // Custom Metadata
  custom_metadata: [
    'CUSTOMMETADATA', 'CUSTOM_METADATA', 'CM', 'BUSINESSMETADATA',
    'BUSINESS_METADATA', 'EXTENDED_ATTRIBUTES', 'ATTRIBUTES',
  ],

  // Domains
  domain_guids: [
    'DOMAINGUIDS', 'DOMAIN_GUIDS', 'DOMAINS', 'DOMAIN',
    'DATA_DOMAIN', 'DATADOMAIN', 'DOMAIN_IDS',
  ],

  // Connectors
  connector_name: [
    'CONNECTORNAME', 'CONNECTOR_NAME', 'CONNECTOR', 'SOURCE',
    'SOURCE_TYPE', 'SOURCETYPE', 'INTEGRATION', 'CONNECTION',
  ],
};

/**
 * Common prefixes that can be stripped for matching
 */
const STRIPPABLE_PREFIXES = [
  '__', '_', 'ASSET_', 'DATA_', 'META_', 'ATLAN_', 'MDLH_',
  'SRC_', 'TGT_', 'RAW_', 'STG_', 'DIM_', 'FACT_',
];

/**
 * Common suffixes that can be stripped for matching
 */
const STRIPPABLE_SUFFIXES = [
  '_ID', '_GUID', '_NAME', '_VALUE', '_FLAG', '_STATUS',
  '_COUNT', '_SCORE', '_PERCENT', '_TYPE', '_DATE', '_TIME',
  'S', // Plural
];

/**
 * Regex patterns for inferring column categories
 */
const CATEGORY_PATTERNS = [
  ['ownership', /OWNER|STEWARD|ADMIN|RESPONSIBLE|ACCOUNTABLE/i],
  ['documentation', /DESC|README|DOC|DEFINITION|SUMMARY/i],
  ['glossary', /TERM|GLOSSARY|MEANING/i],
  ['classification', /TAG|CLASS|SENSITIV|PII|PRIVACY/i],
  ['governance', /CERT|TRUST|ENDORSE|BADGE/i],
  ['lineage', /LINEAGE|UPSTREAM|DOWNSTREAM|INPUT|OUTPUT/i],
  ['quality', /QUALITY|DQ|SCORE|FRESH/i],
  ['usage', /POPULAR|USAGE|VIEW|QUERY|ACCESS/i],
  ['identity', /GUID|ID|NAME|TYPE|QN|FQN/i],
  ['timestamp', /CREAT|UPDATE|MODIF|TIME|DATE|_AT$/i],
  ['integration', /DOMAIN|CONNECTOR|SOURCE|CONNECTION/i],
];

// =============================================================================
// MATCHING FUNCTIONS
// =============================================================================

/**
 * Normalize a column name for comparison
 * @param {string} name - Column name
 * @returns {string} Normalized name
 */
export function normalizeColumnName(name) {
  if (!name) return '';

  let normalized = name.toUpperCase().trim();

  // Remove common prefixes
  for (const prefix of STRIPPABLE_PREFIXES) {
    if (normalized.startsWith(prefix) && normalized.length > prefix.length) {
      normalized = normalized.slice(prefix.length);
      break;
    }
  }

  // Remove common suffixes
  for (const suffix of STRIPPABLE_SUFFIXES) {
    if (normalized.endsWith(suffix) && normalized.length > suffix.length + 2) {
      const stripped = normalized.slice(0, -suffix.length);
      if (stripped.length >= 3) {
        normalized = stripped;
        break;
      }
    }
  }

  return normalized;
}

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} str1 
 * @param {string} str2 
 * @returns {number}
 */
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;

  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}

/**
 * Calculate similarity score (0-1) between two strings
 * @param {string} str1 
 * @param {string} str2 
 * @returns {number}
 */
export function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;

  const s1 = str1.toUpperCase();
  const s2 = str2.toUpperCase();

  if (s1 === s2) return 1.0;

  if (s1.includes(s2) || s2.includes(s1)) {
    const containmentRatio = Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length);
    return 0.7 + (containmentRatio * 0.2);
  }

  const distance = levenshteinDistance(s1, s2);
  const maxLen = Math.max(s1.length, s2.length);
  const similarity = 1 - (distance / maxLen);

  return Math.max(0, similarity);
}

/**
 * Match a field to a column using synonyms and fuzzy matching
 * @param {string} fieldId - Field identifier
 * @param {string[]} columnNames - Available column names
 * @param {string|null} mdlhColumn - Expected MDLH column name
 * @returns {{matched: boolean, column: string|null, confidence: number, method: string}}
 */
export function matchFieldToColumn(fieldId, columnNames, mdlhColumn = null) {
  const columnSet = new Set(columnNames.map(c => c.toUpperCase()));
  const normalizedColumns = new Map(
    columnNames.map(c => [normalizeColumnName(c), c])
  );

  const {
    exactMdlh,
    synonymExact,
    normalized,
    synonymNormalized,
    fuzzyMultiplier,
    fuzzyMinSimilarity,
  } = MATCH_CONFIDENCE;

  // 1. Exact match on mdlhColumn
  if (mdlhColumn && columnSet.has(mdlhColumn.toUpperCase())) {
    return {
      matched: true,
      column: mdlhColumn.toUpperCase(),
      confidence: exactMdlh,
      method: 'exact_mdlh',
    };
  }

  // 2. Check synonyms
  const synonyms = FIELD_SYNONYMS[fieldId] || [];
  for (const synonym of synonyms) {
    if (columnSet.has(synonym.toUpperCase())) {
      return {
        matched: true,
        column: synonym.toUpperCase(),
        confidence: synonymExact,
        method: 'synonym_exact',
      };
    }
  }

  // 3. Normalized match
  const normalizedFieldId = normalizeColumnName(fieldId);
  if (normalizedColumns.has(normalizedFieldId)) {
    return {
      matched: true,
      column: normalizedColumns.get(normalizedFieldId),
      confidence: normalized,
      method: 'normalized',
    };
  }

  // 4. Normalized synonyms
  for (const synonym of synonyms) {
    const normalizedSynonym = normalizeColumnName(synonym);
    if (normalizedColumns.has(normalizedSynonym)) {
      return {
        matched: true,
        column: normalizedColumns.get(normalizedSynonym),
        confidence: synonymNormalized,
        method: 'synonym_normalized',
      };
    }
  }

  // 5. Fuzzy match
  let bestMatch = null;
  let bestSimilarity = 0;

  for (const colName of columnNames) {
    const simFieldId = calculateSimilarity(fieldId, colName);
    if (simFieldId > bestSimilarity && simFieldId >= fuzzyMinSimilarity) {
      bestSimilarity = simFieldId;
      bestMatch = { column: colName, method: 'fuzzy_field_id' };
    }

    if (mdlhColumn) {
      const simMdlh = calculateSimilarity(mdlhColumn, colName);
      if (simMdlh > bestSimilarity && simMdlh >= fuzzyMinSimilarity) {
        bestSimilarity = simMdlh;
        bestMatch = { column: colName, method: 'fuzzy_mdlh' };
      }
    }

    for (const synonym of synonyms) {
      const simSynonym = calculateSimilarity(synonym, colName);
      if (simSynonym > bestSimilarity && simSynonym >= fuzzyMinSimilarity) {
        bestSimilarity = simSynonym;
        bestMatch = { column: colName, method: 'fuzzy_synonym' };
      }
    }
  }

  if (bestMatch) {
    return {
      matched: true,
      column: bestMatch.column.toUpperCase(),
      confidence: bestSimilarity * fuzzyMultiplier,
      method: bestMatch.method,
    };
  }

  return {
    matched: false,
    column: null,
    confidence: 0,
    method: 'none',
  };
}

/**
 * Match all fields in a catalog to available columns
 * @param {Array<{id: string, displayName?: string, mdlhColumn?: string}>} fieldCatalog 
 * @param {string[]} columnNames 
 * @returns {{catalog: Array, matchedColumns: string[], unmatchedColumns: string[], stats: Object}}
 */
export function matchCatalogToColumns(fieldCatalog, columnNames) {
  const results = [];
  const matchedColumns = new Set();

  for (const field of fieldCatalog) {
    const match = matchFieldToColumn(field.id, columnNames, field.mdlhColumn);

    results.push({
      fieldId: field.id,
      displayName: field.displayName,
      matched: match.matched,
      matchedColumn: match.column,
      matchConfidence: match.confidence,
      matchMethod: match.method,
    });

    if (match.matched && match.column) {
      matchedColumns.add(match.column);
    }
  }

  const unmatchedColumns = columnNames.filter(
    c => !matchedColumns.has(c.toUpperCase())
  );

  const { thresholds } = MATCH_CONFIDENCE;

  return {
    catalog: results,
    matchedColumns: Array.from(matchedColumns),
    unmatchedColumns,
    stats: {
      total: fieldCatalog.length,
      matched: results.filter(r => r.matched).length,
      highConfidence: results.filter(r => r.matchConfidence >= thresholds.high).length,
      mediumConfidence: results.filter(r => r.matchConfidence >= thresholds.medium && r.matchConfidence < thresholds.high).length,
      lowConfidence: results.filter(r => r.matchConfidence >= thresholds.low && r.matchConfidence < thresholds.medium).length,
      unmatched: results.filter(r => !r.matched).length,
    },
  };
}

/**
 * Infer the likely category of a column based on its name
 * @param {string} columnName 
 * @returns {string}
 */
export function inferColumnCategory(columnName) {
  const upper = columnName.toUpperCase();

  for (const [category, pattern] of CATEGORY_PATTERNS) {
    if (pattern.test(upper)) {
      return category;
    }
  }

  return 'unknown';
}

/**
 * Suggest field mappings for unmatched columns
 * @param {string[]} unmatchedColumns 
 * @returns {Array<{column: string, normalizedColumn: string, possibleFields: Array, category: string}>}
 */
export function suggestFieldsForColumns(unmatchedColumns) {
  const suggestions = [];

  for (const column of unmatchedColumns) {
    const normalizedCol = normalizeColumnName(column);
    const possibleFields = [];

    for (const [fieldId, synonyms] of Object.entries(FIELD_SYNONYMS)) {
      for (const synonym of synonyms) {
        const similarity = calculateSimilarity(normalizedCol, normalizeColumnName(synonym));
        if (similarity >= 0.5) {
          possibleFields.push({ fieldId, synonym, similarity });
        }
      }
    }

    possibleFields.sort((a, b) => b.similarity - a.similarity);

    suggestions.push({
      column,
      normalizedColumn: normalizedCol,
      possibleFields: possibleFields.slice(0, 3),
      category: inferColumnCategory(column),
    });
  }

  return suggestions;
}

/**
 * Get synonyms for a field
 * @param {string} fieldId 
 * @returns {string[]}
 */
export function getFieldSynonyms(fieldId) {
  return FIELD_SYNONYMS[fieldId] || [];
}

/**
 * Add custom synonyms at runtime
 * @param {string} fieldId 
 * @param {string[]} synonyms 
 */
export function addFieldSynonyms(fieldId, synonyms) {
  if (!FIELD_SYNONYMS[fieldId]) {
    FIELD_SYNONYMS[fieldId] = [];
  }
  FIELD_SYNONYMS[fieldId].push(...synonyms);
}

/**
 * Get all available field IDs that have synonyms defined
 * @returns {string[]}
 */
export function getKnownFieldIds() {
  return Object.keys(FIELD_SYNONYMS);
}

/**
 * Check if a column name matches any known field pattern
 * @param {string} columnName 
 * @returns {{fieldId: string|null, confidence: number, category: string}}
 */
export function identifyColumn(columnName) {
  const upper = columnName.toUpperCase();
  const normalized = normalizeColumnName(columnName);
  
  // Check for exact matches first
  for (const [fieldId, synonyms] of Object.entries(FIELD_SYNONYMS)) {
    if (synonyms.includes(upper)) {
      return {
        fieldId,
        confidence: 1.0,
        category: inferColumnCategory(columnName),
      };
    }
  }
  
  // Check normalized matches
  for (const [fieldId, synonyms] of Object.entries(FIELD_SYNONYMS)) {
    for (const synonym of synonyms) {
      if (normalizeColumnName(synonym) === normalized) {
        return {
          fieldId,
          confidence: 0.85,
          category: inferColumnCategory(columnName),
        };
      }
    }
  }
  
  // Fuzzy match
  let bestMatch = null;
  let bestSimilarity = 0;
  
  for (const [fieldId, synonyms] of Object.entries(FIELD_SYNONYMS)) {
    for (const synonym of synonyms) {
      const sim = calculateSimilarity(normalized, normalizeColumnName(synonym));
      if (sim > bestSimilarity && sim >= 0.7) {
        bestSimilarity = sim;
        bestMatch = fieldId;
      }
    }
  }
  
  return {
    fieldId: bestMatch,
    confidence: bestSimilarity * 0.8,
    category: inferColumnCategory(columnName),
  };
}

export default {
  MATCH_CONFIDENCE,
  FIELD_SYNONYMS,
  normalizeColumnName,
  calculateSimilarity,
  matchFieldToColumn,
  matchCatalogToColumns,
  inferColumnCategory,
  suggestFieldsForColumns,
  getFieldSynonyms,
  addFieldSynonyms,
  getKnownFieldIds,
  identifyColumn,
};
