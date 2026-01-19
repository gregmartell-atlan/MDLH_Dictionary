/**
 * Unified Field Catalog
 *
 * Single source of truth for all assessable metadata fields.
 * Each field defines:
 * - How to source its value (native MDLH column, custom metadata, derived)
 * - Which signals it contributes to
 * - Which use cases care about it
 * - Scoring weights for completeness calculation
 * 
 * MDLH Adaptation: Source mappings point to MDLH Snowflake columns
 * 
 * Ported from atlan-metadata-evaluation/assessment/packages/domain/src/catalog/unified-fields.ts
 */

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * @typedef {'native' | 'native_any' | 'custom_metadata' | 'classification' | 'relationship' | 'derived'} SourceType
 */

/**
 * @typedef {Object} FieldSource
 * @property {SourceType} type
 * @property {string} [attribute] - For native type
 * @property {string[]} [attributes] - For native_any type
 * @property {string} [businessAttribute] - For custom_metadata type
 * @property {string} [pattern] - For classification type
 * @property {string[]} [anyOf] - For classification type
 * @property {string} [relation] - For relationship type
 * @property {string} [direction] - For relationship type
 * @property {string} [derivation] - For derived type
 */

/**
 * @typedef {Object} SignalContribution
 * @property {string} signal - Signal ID
 * @property {number} weight - Weight (0-1)
 * @property {boolean} [required] - Is this required for the signal
 * @property {boolean} [negative] - Does this negatively impact the signal
 */

/**
 * @typedef {Object} UnifiedField
 * @property {string} id - Unique field identifier
 * @property {string} displayName - Human-readable name
 * @property {string} description - Description
 * @property {string} category - Category (ownership, documentation, etc.)
 * @property {FieldSource} source - How to get the value
 * @property {string} [mdlhColumn] - MDLH Snowflake column name (uppercase)
 * @property {string[]} supportedAssetTypes - Asset types this applies to
 * @property {SignalContribution[]} contributesToSignals - Which signals this contributes to
 * @property {string} [measureId] - Measure identifier for scoring
 * @property {number} [completenessWeight] - Weight for completeness scoring
 * @property {string[]} useCases - Which use cases this is relevant for
 * @property {string[]} coreForUseCases - Which use cases this is critical for
 * @property {string} [atlanDocsUrl] - Link to Atlan docs
 * @property {string} [atlanApiHint] - API hint
 * @property {'active' | 'experimental' | 'deprecated'} status
 */

// =============================================================================
// OWNERSHIP FIELDS
// =============================================================================

/** @type {UnifiedField[]} */
const ownershipFields = [
  {
    id: 'owner_users',
    displayName: 'Owner Users',
    description: 'Individual users accountable for the asset.',
    category: 'ownership',
    source: { type: 'native', attribute: 'ownerUsers' },
    mdlhColumn: 'OWNERUSERS',
    supportedAssetTypes: ['*'],
    contributesToSignals: [
      { signal: 'OWNERSHIP', weight: 1.0 },
    ],
    measureId: 'coverage.owner',
    completenessWeight: 20,
    useCases: ['*'],
    coreForUseCases: ['self_service_discovery', 'data_governance', 'ai_agents'],
    atlanDocsUrl: 'https://solutions.atlan.com/asset-export-basic/',
    status: 'active',
  },
  {
    id: 'owner_groups',
    displayName: 'Owner Groups',
    description: 'Teams or groups accountable for the asset.',
    category: 'ownership',
    source: { type: 'native', attribute: 'ownerGroups' },
    mdlhColumn: 'OWNERGROUPS',
    supportedAssetTypes: ['*'],
    contributesToSignals: [
      { signal: 'OWNERSHIP', weight: 1.0 },
    ],
    measureId: 'coverage.owner',
    useCases: ['*'],
    coreForUseCases: ['data_governance'],
    status: 'active',
  },
  {
    id: 'admin_users',
    displayName: 'Admin Users',
    description: 'Admin users with elevated access to the asset.',
    category: 'ownership',
    source: { type: 'native', attribute: 'adminUsers' },
    mdlhColumn: 'ADMINUSERS',
    supportedAssetTypes: ['Table', 'View', 'Column', 'AtlasGlossaryTerm'],
    contributesToSignals: [
      { signal: 'OWNERSHIP', weight: 0.5 },
    ],
    useCases: ['data_governance', 'dsar_retention'],
    coreForUseCases: [],
    status: 'active',
  },
  {
    id: 'admin_groups',
    displayName: 'Admin Groups',
    description: 'Admin groups with elevated access to the asset.',
    category: 'ownership',
    source: { type: 'native', attribute: 'adminGroups' },
    mdlhColumn: 'ADMINGROUPS',
    supportedAssetTypes: ['Table', 'View', 'Column', 'AtlasGlossaryTerm'],
    contributesToSignals: [
      { signal: 'OWNERSHIP', weight: 0.5 },
    ],
    useCases: ['data_governance', 'dsar_retention'],
    coreForUseCases: [],
    status: 'active',
  },
];

// =============================================================================
// DOCUMENTATION / SEMANTICS FIELDS
// =============================================================================

/** @type {UnifiedField[]} */
const documentationFields = [
  {
    id: 'description',
    displayName: 'Description',
    description: "Short prose description of the asset's purpose.",
    category: 'documentation',
    source: { type: 'native_any', attributes: ['description', 'userDescription'] },
    mdlhColumn: 'DESCRIPTION', // Also check USERDESCRIPTION
    supportedAssetTypes: ['*'],
    contributesToSignals: [
      { signal: 'SEMANTICS', weight: 1.0 },
    ],
    measureId: 'coverage.asset_description',
    completenessWeight: 15,
    useCases: ['*'],
    coreForUseCases: ['self_service_discovery', 'rag', 'text_to_sql', 'ai_agents'],
    status: 'active',
  },
  {
    id: 'readme',
    displayName: 'README / Documentation',
    description: 'Long-form documentation including examples and caveats.',
    category: 'documentation',
    source: { type: 'relationship', relation: 'readme' },
    mdlhColumn: 'README',
    supportedAssetTypes: ['Table', 'View', 'Database', 'Schema', 'Dashboard'],
    contributesToSignals: [
      { signal: 'SEMANTICS', weight: 0.8 },
    ],
    measureId: 'coverage.runbook',
    completenessWeight: 10,
    useCases: ['self_service_discovery', 'rag', 'ai_agents'],
    coreForUseCases: [],
    status: 'active',
  },
  {
    id: 'glossary_terms',
    displayName: 'Linked Glossary Terms',
    description: 'Business glossary terms linked to the asset.',
    category: 'documentation',
    source: { type: 'relationship', relation: 'meanings' },
    mdlhColumn: 'ASSIGNEDTERMS', // or MEANINGS
    supportedAssetTypes: ['Table', 'View', 'Column', 'Dashboard'],
    contributesToSignals: [
      { signal: 'SEMANTICS', weight: 0.6 },
    ],
    completenessWeight: 10,
    useCases: ['business_glossary', 'text_to_sql', 'self_service_discovery'],
    coreForUseCases: ['business_glossary'],
    status: 'active',
  },
];

// =============================================================================
// LINEAGE FIELDS
// =============================================================================

/** @type {UnifiedField[]} */
const lineageFields = [
  {
    id: 'has_lineage',
    displayName: 'Has Lineage',
    description: 'Asset has upstream or downstream lineage documented.',
    category: 'lineage',
    source: { type: 'native', attribute: '__hasLineage' },
    mdlhColumn: '__HASLINEAGE',
    supportedAssetTypes: ['Table', 'View', 'Column', 'MaterialisedView'],
    contributesToSignals: [
      { signal: 'LINEAGE', weight: 1.0 },
    ],
    measureId: 'coverage.lineage',
    useCases: ['rag', 'ai_agents', 'impact_analysis', 'rca'],
    coreForUseCases: ['impact_analysis', 'rca'],
    status: 'active',
  },
  {
    id: 'is_primary_key',
    displayName: 'Is Primary Key',
    description: 'Column is part of the primary key.',
    category: 'lineage',
    source: { type: 'native', attribute: 'isPrimary' },
    mdlhColumn: 'ISPRIMARYKEY',
    supportedAssetTypes: ['Column'],
    contributesToSignals: [
      { signal: 'LINEAGE', weight: 0.5 },
    ],
    measureId: 'coverage.joinability',
    useCases: ['text_to_sql', 'data_modeling'],
    coreForUseCases: ['text_to_sql'],
    status: 'active',
  },
  {
    id: 'is_foreign_key',
    displayName: 'Is Foreign Key',
    description: 'Column participates in a foreign key relationship.',
    category: 'lineage',
    source: { type: 'native', attribute: 'isForeign' },
    mdlhColumn: 'ISFOREIGNKEY',
    supportedAssetTypes: ['Column'],
    contributesToSignals: [
      { signal: 'LINEAGE', weight: 0.5 },
    ],
    measureId: 'coverage.joinability',
    useCases: ['text_to_sql', 'data_modeling'],
    coreForUseCases: ['text_to_sql'],
    status: 'active',
  },
];

// =============================================================================
// CLASSIFICATION / SENSITIVITY FIELDS
// =============================================================================

/** @type {UnifiedField[]} */
const classificationFields = [
  {
    id: 'classifications',
    displayName: 'Classifications',
    description: 'Classification tags applied to the asset.',
    category: 'classification',
    source: { type: 'native', attribute: 'classificationNames' },
    mdlhColumn: 'CLASSIFICATIONNAMES',
    supportedAssetTypes: ['*'],
    contributesToSignals: [
      { signal: 'SENSITIVITY', weight: 1.0 },
    ],
    completenessWeight: 5,
    useCases: ['dsar_retention', 'data_governance', 'ai_agents'],
    coreForUseCases: ['dsar_retention'],
    status: 'active',
  },
  {
    id: 'has_pii',
    displayName: 'Has PII Classification',
    description: 'Asset has PII classification applied.',
    category: 'classification',
    source: { type: 'classification', pattern: '^PII' },
    supportedAssetTypes: ['Table', 'View', 'Column'],
    contributesToSignals: [
      { signal: 'SENSITIVITY', weight: 1.0 },
    ],
    useCases: ['dsar_retention', 'privacy_compliance'],
    coreForUseCases: ['dsar_retention'],
    status: 'active',
  },
];

// =============================================================================
// ACCESS / GOVERNANCE FIELDS
// =============================================================================

/** @type {UnifiedField[]} */
const accessFields = [
  {
    id: 'policy_count',
    displayName: 'Policy Count',
    description: 'Number of access policies applied to the asset.',
    category: 'governance',
    source: { type: 'native', attribute: 'assetPoliciesCount' },
    mdlhColumn: 'ASSETPOLICIESCOUNT',
    supportedAssetTypes: ['Table', 'View', 'Column', 'MaterialisedView'],
    contributesToSignals: [
      { signal: 'ACCESS', weight: 1.0 },
    ],
    measureId: 'policy.protection',
    useCases: ['ai_agents', 'dsar_retention', 'data_governance'],
    coreForUseCases: ['dsar_retention'],
    status: 'active',
  },
];

// =============================================================================
// QUALITY / FRESHNESS FIELDS
// =============================================================================

/** @type {UnifiedField[]} */
const qualityFields = [
  {
    id: 'dq_soda_status',
    displayName: 'Soda DQ Status',
    description: 'Data quality status from Soda integration.',
    category: 'quality',
    source: { type: 'native', attribute: 'assetSodaDQStatus' },
    mdlhColumn: 'ASSETSODADQSTATUS',
    supportedAssetTypes: ['Table', 'View', 'MaterialisedView'],
    contributesToSignals: [
      { signal: 'QUALITY', weight: 1.0 },
      { signal: 'FRESHNESS', weight: 0.5 },
    ],
    measureId: 'coverage.dq_signals',
    useCases: ['rag', 'ai_agents', 'data_governance'],
    coreForUseCases: [],
    status: 'active',
  },
  {
    id: 'mc_is_monitored',
    displayName: 'Monte Carlo Monitored',
    description: 'Asset is monitored by Monte Carlo.',
    category: 'quality',
    source: { type: 'native', attribute: 'assetMcIsMonitored' },
    mdlhColumn: 'ASSETMCISMONITORED',
    supportedAssetTypes: ['Table', 'View', 'MaterialisedView'],
    contributesToSignals: [
      { signal: 'QUALITY', weight: 1.0 },
      { signal: 'FRESHNESS', weight: 0.5 },
    ],
    measureId: 'coverage.dq_signals',
    useCases: ['data_governance'],
    coreForUseCases: [],
    status: 'active',
  },
];

// =============================================================================
// USAGE FIELDS
// =============================================================================

/** @type {UnifiedField[]} */
const usageFields = [
  {
    id: 'popularity_score',
    displayName: 'Popularity Score',
    description: 'Popularity score based on query frequency.',
    category: 'usage',
    source: { type: 'native', attribute: 'popularityScore' },
    mdlhColumn: 'POPULARITYSCORE',
    supportedAssetTypes: ['Table', 'View', 'Column', 'MaterialisedView'],
    contributesToSignals: [
      { signal: 'USAGE', weight: 1.0 },
    ],
    measureId: 'coverage.usage_telemetry',
    useCases: ['self_service_discovery', 'cost_optimization'],
    coreForUseCases: [],
    status: 'active',
  },
  {
    id: 'query_count',
    displayName: 'Query Count',
    description: 'Number of queries accessing this asset.',
    category: 'usage',
    source: { type: 'native', attribute: 'queryCount' },
    mdlhColumn: 'QUERYCOUNT',
    supportedAssetTypes: ['Table', 'View', 'Column', 'MaterialisedView'],
    contributesToSignals: [
      { signal: 'USAGE', weight: 0.8 },
    ],
    measureId: 'coverage.usage_telemetry',
    useCases: ['cost_optimization'],
    coreForUseCases: [],
    status: 'active',
  },
  {
    id: 'query_user_count',
    displayName: 'Query User Count',
    description: 'Number of unique users querying this asset.',
    category: 'usage',
    source: { type: 'native', attribute: 'queryUserCount' },
    mdlhColumn: 'QUERYUSERCOUNT',
    supportedAssetTypes: ['Table', 'View', 'Column', 'MaterialisedView'],
    contributesToSignals: [
      { signal: 'USAGE', weight: 0.6 },
    ],
    measureId: 'coverage.usage_telemetry',
    useCases: ['cost_optimization'],
    coreForUseCases: [],
    status: 'active',
  },
];

// =============================================================================
// TRUST / CERTIFICATION FIELDS
// =============================================================================

/** @type {UnifiedField[]} */
const trustFields = [
  {
    id: 'certificate_status',
    displayName: 'Certificate Status',
    description: 'Governance certificate status of the asset.',
    category: 'governance',
    source: { type: 'native', attribute: 'certificateStatus' },
    mdlhColumn: 'CERTIFICATESTATUS',
    supportedAssetTypes: ['*'],
    contributesToSignals: [
      { signal: 'TRUST', weight: 1.0 },
    ],
    measureId: 'coverage.certified',
    completenessWeight: 25,
    useCases: ['*'],
    coreForUseCases: ['data_governance'],
    status: 'active',
  },
  {
    id: 'certificate_status_message',
    displayName: 'Certificate Message',
    description: 'Message explaining the certificate status.',
    category: 'governance',
    source: { type: 'native', attribute: 'certificateStatusMessage' },
    mdlhColumn: 'CERTIFICATESTATUSMESSAGE',
    supportedAssetTypes: ['*'],
    contributesToSignals: [],
    useCases: ['data_governance'],
    coreForUseCases: [],
    status: 'active',
  },
];

// =============================================================================
// HIERARCHY FIELDS
// =============================================================================

/** @type {UnifiedField[]} */
const hierarchyFields = [
  {
    id: 'connection_qualified_name',
    displayName: 'Connection Qualified Name',
    description: 'Qualified name of the connection.',
    category: 'hierarchy',
    source: { type: 'native', attribute: 'connectionQualifiedName' },
    mdlhColumn: 'CONNECTIONQUALIFIEDNAME',
    supportedAssetTypes: ['Database', 'Schema', 'Table', 'View', 'Column'],
    contributesToSignals: [],
    useCases: ['*'],
    coreForUseCases: [],
    status: 'active',
  },
  {
    id: 'database_qualified_name',
    displayName: 'Database Qualified Name',
    description: 'Qualified name of the database.',
    category: 'hierarchy',
    source: { type: 'native', attribute: 'databaseQualifiedName' },
    mdlhColumn: 'DATABASEQUALIFIEDNAME',
    supportedAssetTypes: ['Schema', 'Table', 'View', 'Column'],
    contributesToSignals: [],
    useCases: ['*'],
    coreForUseCases: [],
    status: 'active',
  },
  {
    id: 'schema_qualified_name',
    displayName: 'Schema Qualified Name',
    description: 'Qualified name of the schema.',
    category: 'hierarchy',
    source: { type: 'native', attribute: 'schemaQualifiedName' },
    mdlhColumn: 'SCHEMAQUALIFIEDNAME',
    supportedAssetTypes: ['Table', 'View', 'Column'],
    contributesToSignals: [],
    useCases: ['*'],
    coreForUseCases: [],
    status: 'active',
  },
  {
    id: 'domain_guids',
    displayName: 'Domain GUIDs',
    description: 'Business domains this asset belongs to.',
    category: 'hierarchy',
    source: { type: 'native_any', attributes: ['domainGUIDs', '__domainGUIDs'] },
    mdlhColumn: 'DOMAINGUIDS',
    supportedAssetTypes: ['*'],
    contributesToSignals: [],
    useCases: ['data_products', 'data_governance'],
    coreForUseCases: ['data_products'],
    status: 'active',
  },
];

// =============================================================================
// IDENTITY FIELDS
// =============================================================================

/** @type {UnifiedField[]} */
const identityFields = [
  {
    id: 'guid',
    displayName: 'GUID',
    description: 'Globally unique identifier.',
    category: 'identity',
    source: { type: 'native', attribute: 'guid' },
    mdlhColumn: 'GUID',
    supportedAssetTypes: ['*'],
    contributesToSignals: [],
    useCases: ['*'],
    coreForUseCases: [],
    status: 'active',
  },
  {
    id: 'name',
    displayName: 'Name',
    description: 'Human-readable display name of the asset.',
    category: 'identity',
    source: { type: 'native', attribute: 'name' },
    mdlhColumn: 'NAME',
    supportedAssetTypes: ['*'],
    contributesToSignals: [],
    useCases: ['*'],
    coreForUseCases: ['*'],
    status: 'active',
  },
  {
    id: 'qualified_name',
    displayName: 'Qualified Name',
    description: 'Globally-unique technical identifier for the asset.',
    category: 'identity',
    source: { type: 'native', attribute: 'qualifiedName' },
    mdlhColumn: 'QUALIFIEDNAME',
    supportedAssetTypes: ['*'],
    contributesToSignals: [],
    useCases: ['*'],
    coreForUseCases: ['*'],
    status: 'active',
  },
  {
    id: 'type_name',
    displayName: 'Type Name',
    description: 'Atlan entity type name.',
    category: 'identity',
    source: { type: 'native', attribute: 'typeName' },
    mdlhColumn: 'TYPENAME',
    supportedAssetTypes: ['*'],
    contributesToSignals: [],
    useCases: ['*'],
    coreForUseCases: [],
    status: 'active',
  },
  {
    id: 'status',
    displayName: 'Status',
    description: 'Asset lifecycle status (ACTIVE, DELETED, etc.).',
    category: 'identity',
    source: { type: 'native', attribute: '__state' },
    mdlhColumn: 'STATUS',
    supportedAssetTypes: ['*'],
    contributesToSignals: [],
    useCases: ['*'],
    coreForUseCases: [],
    status: 'active',
  },
  {
    id: 'connector_name',
    displayName: 'Connector Name',
    description: 'Name of the data source connector.',
    category: 'identity',
    source: { type: 'native', attribute: 'connectorName' },
    mdlhColumn: 'CONNECTORNAME',
    supportedAssetTypes: ['*'],
    contributesToSignals: [],
    useCases: ['*'],
    coreForUseCases: [],
    status: 'active',
  },
];

// =============================================================================
// LIFECYCLE FIELDS
// =============================================================================

/** @type {UnifiedField[]} */
const lifecycleFields = [
  {
    id: 'created_at',
    displayName: 'Created At',
    description: 'Timestamp when the asset was created in Atlan.',
    category: 'lifecycle',
    source: { type: 'native', attribute: '__timestamp' },
    mdlhColumn: '__TIMESTAMP',
    supportedAssetTypes: ['*'],
    contributesToSignals: [],
    useCases: ['auditing', 'lifecycle'],
    coreForUseCases: [],
    status: 'active',
  },
  {
    id: 'updated_at',
    displayName: 'Updated At',
    description: 'Timestamp when the asset was last updated.',
    category: 'lifecycle',
    source: { type: 'native', attribute: '__modificationTimestamp' },
    mdlhColumn: '__MODIFICATIONTIMESTAMP',
    supportedAssetTypes: ['*'],
    contributesToSignals: [],
    useCases: ['auditing', 'rca'],
    coreForUseCases: [],
    status: 'active',
  },
];

// =============================================================================
// EXPORT: UNIFIED FIELD CATALOG
// =============================================================================

/**
 * Complete unified field catalog
 * Combines all field categories into a single searchable collection
 * @type {UnifiedField[]}
 */
export const UNIFIED_FIELD_CATALOG = [
  ...identityFields,
  ...ownershipFields,
  ...documentationFields,
  ...lineageFields,
  ...classificationFields,
  ...accessFields,
  ...qualityFields,
  ...usageFields,
  ...trustFields,
  ...hierarchyFields,
  ...lifecycleFields,
];

// =============================================================================
// CATALOG LOOKUP UTILITIES
// =============================================================================

/**
 * Get a field by ID
 * @param {string} id
 * @returns {UnifiedField | undefined}
 */
export function getFieldById(id) {
  return UNIFIED_FIELD_CATALOG.find(f => f.id === id);
}

/**
 * Get fields by category
 * @param {string} category
 * @returns {UnifiedField[]}
 */
export function getFieldsByCategory(category) {
  return UNIFIED_FIELD_CATALOG.filter(f => f.category === category);
}

/**
 * Get fields that contribute to a specific signal
 * @param {string} signal
 * @returns {UnifiedField[]}
 */
export function getFieldsForSignal(signal) {
  return UNIFIED_FIELD_CATALOG.filter(f =>
    f.contributesToSignals.some(c => c.signal === signal)
  );
}

/**
 * Get fields for a specific use case
 * @param {string} useCaseId
 * @returns {UnifiedField[]}
 */
export function getFieldsForUseCase(useCaseId) {
  return UNIFIED_FIELD_CATALOG.filter(f =>
    f.useCases.includes('*') || f.useCases.includes(useCaseId)
  );
}

/**
 * Get core fields for a specific use case
 * @param {string} useCaseId
 * @returns {UnifiedField[]}
 */
export function getCoreFieldsForUseCase(useCaseId) {
  return UNIFIED_FIELD_CATALOG.filter(f =>
    f.coreForUseCases.includes('*') || f.coreForUseCases.includes(useCaseId)
  );
}

/**
 * Get fields supported by an asset type
 * @param {string} assetType
 * @returns {UnifiedField[]}
 */
export function getFieldsForAssetType(assetType) {
  return UNIFIED_FIELD_CATALOG.filter(f =>
    f.supportedAssetTypes.includes('*') || f.supportedAssetTypes.includes(assetType)
  );
}

/**
 * Get fields with completeness weights (for completeness scoring)
 * @returns {UnifiedField[]}
 */
export function getCompletenessFields() {
  return UNIFIED_FIELD_CATALOG.filter(f => f.completenessWeight !== undefined && f.completenessWeight > 0);
}

/**
 * Get fields with measure IDs (for binding matrix integration)
 * @returns {UnifiedField[]}
 */
export function getMeasureFields() {
  return UNIFIED_FIELD_CATALOG.filter(f => f.measureId !== undefined);
}

/**
 * Get active fields only
 * @returns {UnifiedField[]}
 */
export function getActiveFields() {
  return UNIFIED_FIELD_CATALOG.filter(f => f.status === 'active');
}

/**
 * Create a field ID → field map for efficient lookup
 * @returns {Map<string, UnifiedField>}
 */
export function createFieldMap() {
  return new Map(UNIFIED_FIELD_CATALOG.map(f => [f.id, f]));
}

/**
 * Get MDLH columns needed for a set of fields
 * @param {UnifiedField[]} fields
 * @returns {string[]}
 */
export function getMdlhColumnsForFields(fields) {
  const columns = new Set();
  for (const field of fields) {
    if (field.mdlhColumn) {
      columns.add(field.mdlhColumn);
    }
  }
  return Array.from(columns);
}

/**
 * Get all MDLH columns needed for signal evaluation
 * @returns {string[]}
 */
export function getAllMdlhColumnsForSignals() {
  const signalFields = UNIFIED_FIELD_CATALOG.filter(f => f.contributesToSignals.length > 0);
  return getMdlhColumnsForFields(signalFields);
}
