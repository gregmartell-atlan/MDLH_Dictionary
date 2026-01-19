/**
 * Atlan Field Compatibility Utilities
 * 
 * Maps between field names and Atlan attribute names.
 * Ported from atlan-metadata-evaluation assessment package.
 */

export const FIELD_ATTRIBUTE_OVERRIDES = {
  qualified_name: 'qualifiedName',
  owner_users: 'ownerUsers',
  owner_groups: 'ownerGroups',
  certificate_status: 'certificateStatus',
  business_criticality: 'businessCriticality',
  description: 'userDescription',
  user_description: 'userDescription',
  system_description: 'description',
  source_description: 'description',
  updated_at: 'sourceUpdatedAt',
  created_at: 'sourceCreatedAt',
  created_by: '__createdBy',
  updated_by: '__modifiedBy',
  last_synced_at: 'lastSyncRunAt',
  last_sync_run: 'lastSyncRun',
  popularity_score: 'popularityScore',
  view_count: 'viewsCount',
  query_count: 'queryCount',
  source_read_count: 'sourceReadCount',
  source_read_user_count: 'sourceReadUserCount',
  source_last_read_at: 'sourceLastReadAt',
  starred_by: 'starredBy',
  starred_count: 'starredCount',
  steward_users: 'adminUsers',
  steward_groups: 'adminGroups',
  viewer_users: 'viewerUsers',
  viewer_groups: 'viewerGroups',
  admin_users: 'adminUsers',
  admin_groups: 'adminGroups',
  admin_roles: 'adminRoles',
  glossary_terms: 'meanings',
  tags: 'classificationNames',
  tag: 'classificationNames',
  domain: 'domainQualifiedName',
};

export const FIELD_ALIAS_GROUPS = {
  owner: ['ownerUsers', 'ownerGroups'],
  owner_users: ['ownerUsers'],
  owner_groups: ['ownerGroups'],
  certificate_status: ['certificateStatus'],
  description: ['userDescription', 'description'],
  readme: ['readme'],
  updated_at: ['sourceUpdatedAt', '__modificationTimestamp', 'updateTime', 'lastSyncRunAt'],
  created_at: ['sourceCreatedAt', '__timestamp', 'createTime', 'sourceCreatedTime'],
  popularity_score: ['popularityScore', 'viewsCount', 'queryCount'],
  glossary_terms: ['meanings', 'glossaryTerms', 'assignedTerms'],
  tags: ['classificationNames', '__classificationNames', 'atlanTags'],
  domain: ['domainGUIDs', 'domains', '__domainGUIDs', 'domainQualifiedName'],
};

export function getAliasCandidates(fieldName) {
  const key = fieldName.toLowerCase();
  if (FIELD_ALIAS_GROUPS[key]) {
    return FIELD_ALIAS_GROUPS[key];
  }
  return [];
}

export const ASSET_TYPE_TO_ATLAN_TYPES = {
  'Tables': ['Table', 'SnowflakeTable', 'DatabricksTable', 'MaterializedView'],
  'Views': ['View', 'SnowflakeView', 'MaterializedView'],
  'views': ['View', 'SnowflakeView', 'MaterializedView'],
  'Tables; views': ['Table', 'View', 'SnowflakeTable', 'SnowflakeView', 'MaterializedView'],
  'Columns': ['Column', 'SnowflakeColumn', 'DatabricksColumn'],
  'Dashboards; reports': ['Dashboard', 'Report', 'TableauDashboard', 'PowerBIDashboard', 'LookerDashboard'],
  'Dashboards': ['Dashboard', 'TableauDashboard', 'PowerBIDashboard', 'LookerDashboard'],
  'reports': ['PowerBIReport', 'TableauWorksheet', 'CognosReport', 'MicroStrategyReport'],
  'Glossary terms': ['AtlasGlossaryTerm'],
  'Metric terms / KPIs': ['AtlasGlossaryTerm'],
  'Domains': ['DataDomain'],
  'Data product entities': ['DataProduct'],
};

export function toAtlanAttributeCandidates(fieldName) {
  const override = FIELD_ATTRIBUTE_OVERRIDES[fieldName];
  const camel = fieldName.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
  const candidates = new Set();
  if (fieldName) candidates.add(fieldName);
  if (camel) candidates.add(camel);
  if (override) candidates.add(override);
  return Array.from(candidates);
}

export function getAtlanTypeNames(assetType) {
  return ASSET_TYPE_TO_ATLAN_TYPES[assetType] || [];
}

export function isCustomMetadataField(fieldName) {
  return fieldName.startsWith('cm_');
}
