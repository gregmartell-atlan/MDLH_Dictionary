export const FIELD_ATTRIBUTE_OVERRIDES: Record<string, string> = {
  qualified_name: 'qualifiedName',
  owner_users: 'ownerUsers',
  owner_groups: 'ownerGroups',
  certificate_status: 'certificateStatus',
  business_criticality: 'businessCriticality',
  // Description - userDescription is user-entered, description is system/source
  description: 'userDescription', // Prefer user-entered description
  user_description: 'userDescription',
  system_description: 'description',
  source_description: 'description',
  // Timestamp fields - map to actual Atlan attributes
  updated_at: 'sourceUpdatedAt',
  created_at: 'sourceCreatedAt',
  created_by: '__createdBy',
  updated_by: '__modifiedBy',
  last_synced_at: 'lastSyncRunAt',
  last_sync_run: 'lastSyncRun',
  // Usage and popularity
  popularity_score: 'popularityScore',
  view_count: 'viewsCount',
  query_count: 'queryCount',
  source_read_count: 'sourceReadCount',
  source_read_user_count: 'sourceReadUserCount',
  source_last_read_at: 'sourceLastReadAt',
  // Starring/favorites
  starred_by: 'starredBy',
  starred_count: 'starredCount',
  // Stewards (often in custom metadata, but check native first)
  steward_users: 'adminUsers',
  steward_groups: 'adminGroups',
  // Viewer access
  viewer_users: 'viewerUsers',
  viewer_groups: 'viewerGroups',
  // Admin access
  admin_users: 'adminUsers',
  admin_groups: 'adminGroups',
  admin_roles: 'adminRoles',
  consumer_impact_if_wrong: 'consumerImpactIfWrong',
  metadata_completeness_score: 'metadataCompletenessScore',
  dq_score: 'dqScore',
  // Badge fields - visual indicators on assets
  badge_name: 'badgeName',
  badge_description: 'badgeDescription',
  badge_priority: 'badgePriority',
  badge_condition_expression: 'badgeConditions',
  badge_conditions: 'badgeConditions',
  badge_metadata_attribute: 'badgeMetadataAttribute',
  // Column-level attributes (relational schema)
  primary_key: 'isPrimary',
  foreign_key: 'isForeign',
  is_nullable: 'isNullable',
  is_partition: 'isPartition',
  is_clustered: 'isClustered',
  is_sort: 'isSort',
  is_dist: 'isDist',
  column_name: 'name',
  metric_name: 'name',
  term_name: 'name',
  glossary_name: 'glossaryName',
  glossary_category: 'glossaryCategory',
  term_definition_short: 'shortDescription',
  term_definition_long: 'longDescription',
  term_status: 'status',
  metric_formula: 'formula',
  metric_grain: 'grain',
  metric_owner_business: 'ownerUsers',
  metric_owner_technical: 'ownerGroups',
  metric_status: 'status',
  domain: 'domainQualifiedName',
  tags: 'classificationNames',
  tag: 'classificationNames',
  source_qualified_name: 'inputToProcesses',
  target_qualified_name: 'outputFromProcesses',
  data_product_criticality: 'dataProductCriticality',
  data_product_sensitivity: 'dataProductSensitivity',
  data_product_visibility: 'dataProductVisibility',
  data_product_status: 'dataProductStatus',
  data_product_description: 'description',
  data_product_name: 'name',
  data_product_owner_team: 'ownerGroups',
  persona_name: 'name',
  persona_description: 'description',
  purpose_name: 'name',
  purpose_description: 'description',
  auth_policy_name: 'name',
  auth_policy_type: 'policyType',
  auth_policy_category: 'policyCategory',
  auth_policy_resource_category: 'policyResourceCategory',
  persona_policies: 'policies',
  purpose_policies: 'policies',
  business_policy_name: 'name',
  business_policy_category: 'businessPolicyType',
  business_policy_rule: 'businessPolicyRules',
  business_policy_description: 'businessPolicyLongDescription',
  incident_name: 'name',
  incident_status: 'status',
  incident_start_time: 'startTime',
  incident_end_time: 'endTime',
  incident_category: 'category',
  incident_severity: 'incidentSeverity',
  term_examples: 'examples',
  term_scope: 'usage',
  related_terms: 'synonyms',
  term_glossary_name: 'anchor',
  term_categories: 'categories',
  pii_flag: 'classificationNames',
  pii_type: 'classificationNames',
  sensitivity_classification: 'classificationNames',
  regulatory_scope: 'classificationNames',
  data_subject_category: 'classificationNames',
  processing_activity: 'classificationNames',
  legal_basis: 'classificationNames',
  retention_rule: 'classificationNames',
};

export const FIELD_ALIAS_GROUPS: Record<string, string[]> = {
  owner: ['ownerUsers', 'ownerGroups'],
  owner_users: ['ownerUsers'],
  owner_groups: ['ownerGroups'],
  certificate_status: ['certificateStatus'],
  // Description - userDescription is user-entered (preferred), description is system/source
  description: ['userDescription', 'description'], // Prefer userDescription first
  user_description: ['userDescription'],
  system_description: ['description'],
  source_description: ['description'],
  readme: ['readme'],
  // Timestamp fields - multiple Atlan attributes for same concept
  updated_at: ['sourceUpdatedAt', '__modificationTimestamp', 'updateTime', 'lastSyncRunAt'],
  created_at: ['sourceCreatedAt', '__timestamp', 'createTime', 'sourceCreatedTime'],
  created_by: ['__createdBy', 'createdBy', 'sourceCreatedBy'],
  updated_by: ['__modifiedBy', 'modifiedBy', 'sourceUpdatedBy'],
  last_synced_at: ['lastSyncRunAt', 'lastSyncRun', '__modificationTimestamp'],
  // Usage and popularity
  popularity_score: ['popularityScore', 'viewsCount', 'queryCount'],
  view_count: ['viewsCount', 'viewCount', 'popularityScore'],
  query_count: ['queryCount', 'queryCountUpdatedAt'],
  source_read_count: ['sourceReadCount', 'sourceReadUserCount'],
  source_read_user_count: ['sourceReadUserCount', 'sourceReadCount'],
  source_last_read_at: ['sourceLastReadAt', 'lastAccessedAt'],
  // Starring/favorites
  starred_by: ['starredBy'],
  starred_count: ['starredCount'],
  // Viewer access
  viewer_users: ['viewerUsers'],
  viewer_groups: ['viewerGroups'],
  // Admin access
  admin_users: ['adminUsers'],
  admin_groups: ['adminGroups'],
  admin_roles: ['adminRoles'],
  // Badge fields
  badge_name: ['badgeName'],
  badge_description: ['badgeDescription'],
  badge_priority: ['badgePriority'],
  badge_condition_expression: ['badgeConditions'],
  badge_conditions: ['badgeConditions'],
  badge_metadata_attribute: ['badgeMetadataAttribute'],
  // Column-level attributes
  primary_key: ['isPrimary'],
  foreign_key: ['isForeign'],
  is_nullable: ['isNullable', 'nullable'],
  is_partition: ['isPartition', 'isPartitioned'],
  is_clustered: ['isClustered'],
  is_sort: ['isSort'],
  is_dist: ['isDist'],
  // Freshness
  last_accessed: ['lastAccessedAt', 'sourceLastAccessedAt', 'lastSyncRunAt'],
  freshness: ['sourceUpdatedAt', '__modificationTimestamp', 'lastSyncRunAt'],
  // Stewards
  steward_users: ['adminUsers', 'ownerUsers'],
  steward_groups: ['adminGroups', 'ownerGroups'],
  domain: ['domainGUIDs', 'domains', '__domainGUIDs', 'domainQualifiedName', 'parentDomainQualifiedName', 'domain'],
  domains: ['domainGUIDs', 'domains', '__domainGUIDs', 'domainQualifiedName', 'parentDomainQualifiedName', 'domain'],
  domain_guid: ['domainGUIDs', '__domainGUIDs', 'domains', 'domainQualifiedName', 'parentDomainQualifiedName', 'domain'],
  domain_guids: ['domainGUIDs', '__domainGUIDs', 'domains', 'domainQualifiedName', 'parentDomainQualifiedName', 'domain'],
  glossary_terms: ['meanings', 'glossaryTerms', 'assignedTerms'],
  tags: ['classificationNames', '__classificationNames', 'atlanTags'],
  tag: ['classificationNames', '__classificationNames', 'atlanTags'],
  classifications: ['classificationNames', '__classificationNames', 'classifications', 'atlanTags'],
  source_qualified_name: ['__hasLineage', 'hasLineage', 'inputToProcesses'],
  target_qualified_name: ['__hasLineage', 'hasLineage', 'outputFromProcesses'],
  data_product_criticality: ['dataProductCriticality'],
  data_product_sensitivity: ['dataProductSensitivity'],
  data_product_visibility: ['dataProductVisibility'],
  data_product_status: ['dataProductStatus'],
  data_product_description: ['description'],
  data_product_name: ['name'],
  data_product_owner_team: ['ownerGroups', 'ownerUsers'],
  persona_name: ['name'],
  persona_description: ['description'],
  purpose_name: ['name'],
  purpose_description: ['description'],
  auth_policy_name: ['name'],
  auth_policy_type: ['policyType'],
  auth_policy_category: ['policyCategory'],
  auth_policy_resource_category: ['policyResourceCategory'],
  persona_policies: ['policies'],
  purpose_policies: ['policies'],
  business_policy_name: ['name'],
  business_policy_category: ['businessPolicyType'],
  business_policy_rule: ['businessPolicyRules'],
  business_policy_description: ['businessPolicyLongDescription'],
  incident_name: ['name'],
  incident_status: ['status'],
  incident_start_time: ['startTime'],
  incident_end_time: ['endTime'],
  incident_category: ['category'],
  incident_severity: ['incidentSeverity'],
  term_examples: ['examples'],
  term_scope: ['usage'],
  related_terms: ['synonyms', 'seeAlso', 'isA', 'preferredTerms'],
  glossary_name: ['anchor'],
  glossary_category: ['categories'],
  pii_flag: ['classificationNames', '__classificationNames', 'classifications'],
  pii_type: ['classificationNames', '__classificationNames', 'classifications'],
  sensitivity_classification: ['classificationNames', '__classificationNames', 'classifications'],
  regulatory_scope: ['classificationNames', '__classificationNames', 'classifications'],
  data_subject_category: ['classificationNames', '__classificationNames', 'classifications'],
  processing_activity: ['classificationNames', '__classificationNames', 'classifications'],
  legal_basis: ['classificationNames', '__classificationNames', 'classifications'],
  retention_rule: ['classificationNames', '__classificationNames', 'classifications'],
};

export function getAliasCandidates(fieldName: string): string[] {
  const key = fieldName.toLowerCase();
  if (FIELD_ALIAS_GROUPS[key]) {
    return FIELD_ALIAS_GROUPS[key];
  }
  return [];
}

const ASSET_TYPE_TO_ATLAN_TYPES: Record<string, string[]> = {
  'Tables': ['Table', 'SnowflakeTable', 'DatabricksTable', 'MaterializedView'],
  'Views': ['View', 'SnowflakeView', 'MaterializedView'],
  'views': ['View', 'SnowflakeView', 'MaterializedView'],
  'Tables; views': ['Table', 'View', 'SnowflakeTable', 'SnowflakeView', 'MaterializedView'],
  'Columns': ['Column', 'SnowflakeColumn', 'DatabricksColumn'],
  'Dashboards; reports': ['Dashboard', 'Report', 'TableauDashboard', 'PowerBIDashboard', 'LookerDashboard'],
  'Dashboards': ['Dashboard', 'TableauDashboard', 'PowerBIDashboard', 'LookerDashboard'],
  'reports': ['PowerBIReport', 'TableauWorksheet', 'CognosReport', 'MicroStrategyReport', 'ModeReport', 'SalesforceReport', 'FabricReport'],
  'Glossary terms': ['AtlasGlossaryTerm'],
  'Metric terms / KPIs': ['AtlasGlossaryTerm'],
  'Domains': ['DataDomain'],
  'Data product entities': ['DataProduct'],
  'Data contracts (logical objects)': ['DataContract'],
  'Access control objects': ['Persona', 'Purpose', 'AuthPolicy'],
  'Business policies': ['BusinessPolicy'],
  'Incidents': ['Incident'],
  'Incidents (policy / access)': ['Incident'],
  'Tables containing PII': ['Table', 'SnowflakeTable', 'DatabricksTable'],
  'Columns with PII': ['Column', 'SnowflakeColumn', 'DatabricksColumn'],
  'Training datasets': ['Table', 'View', 'SnowflakeTable', 'SnowflakeView'],
  'ML / AI models': ['MLModel', 'AIModel'],
  'Asset export rows': [],
  'Glossary export rows': [],
};

export function toAtlanAttributeCandidates(fieldName: string): string[] {
  const override = FIELD_ATTRIBUTE_OVERRIDES[fieldName];
  const camel = fieldName.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
  const candidates = new Set<string>();
  if (fieldName) candidates.add(fieldName);
  if (camel) candidates.add(camel);
  if (override) candidates.add(override);
  if (fieldName.startsWith('data_product_')) {
    const suffix = fieldName.replace(/^data_product_/, '');
    const suffixCamel = suffix.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
    if (suffixCamel) {
      const capSuffix = suffixCamel.charAt(0).toUpperCase() + suffixCamel.slice(1);
      candidates.add(`dataProduct${capSuffix}`);
      candidates.add(`daap${capSuffix}`);
    }
  }
  if (fieldName.startsWith('domain_')) {
    const suffix = fieldName.replace(/^domain_/, '');
    const suffixCamel = suffix.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
    if (suffixCamel) {
      const capSuffix = suffixCamel.charAt(0).toUpperCase() + suffixCamel.slice(1);
      candidates.add(`domain${capSuffix}`);
    }
  }
  return Array.from(candidates);
}

export function getAtlanTypeNames(assetType: string): string[] {
  return ASSET_TYPE_TO_ATLAN_TYPES[assetType] || [];
}

export function isCustomMetadataField(fieldName: string): boolean {
  return fieldName.startsWith('cm_');
}
