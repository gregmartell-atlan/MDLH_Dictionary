const GOLD_TABLE_MAP = {
  TABLE_ENTITY: 'ASSETS',
  VIEW_ENTITY: 'ASSETS',
  SCHEMA_ENTITY: 'ASSETS',
  DATABASE_ENTITY: 'ASSETS',
  ASSET_ENTITY: 'ASSETS',
};

const GOLD_IDENTIFIER_MAP = {
  NAME: 'ASSET_NAME',
  QUALIFIEDNAME: 'ASSET_QUALIFIED_NAME',
  TYPENAME: 'ASSET_TYPE',
  ASSETNAME: 'ASSET_NAME',
  ASSETQUALIFIEDNAME: 'ASSET_QUALIFIED_NAME',
  ASSETTYPE: 'ASSET_TYPE',
  OWNERUSERS: 'OWNER_USERS',
  OWNERGROUPS: 'OWNER_USERS',
  OWNER_GROUPS: 'OWNER_USERS',
  HASLINEAGE: 'HAS_LINEAGE',
  __HASLINEAGE: 'HAS_LINEAGE',
  POPULARITYSCORE: 'POPULARITY_SCORE',
  CERTIFICATESTATUS: 'CERTIFICATE_STATUS',
  CERTIFICATEUPDATEDAT: 'CERTIFICATE_UPDATED_AT',
  CERTIFICATEUPDATEDBY: 'CERTIFICATE_UPDATED_BY',
  CONNECTORNAME: 'CONNECTOR_NAME',
  CONNECTIONQUALIFIEDNAME: 'CONNECTOR_QUALIFIED_NAME',
  DOMAINGUIDS: 'TAGS',
  CLASSIFICATIONNAMES: 'TAGS',
  CLASSIFICATION_NAMES: 'TAGS',
  MEANINGS: 'TERM_GUIDS',
  ASSIGNEDTERMS: 'TERM_GUIDS',
  USERDESCRIPTION: 'DESCRIPTION',
  UPDATETIME: 'UPDATED_AT',
  CREATETIME: 'CREATED_AT',
  UPDATEDAT: 'UPDATED_AT',
  CREATEDAT: 'CREATED_AT',
  DATABASENAME: "SPLIT_PART(ASSET_QUALIFIED_NAME, '.', 1)",
  SCHEMANAME: "SPLIT_PART(ASSET_QUALIFIED_NAME, '.', 2)",
  TABLENAME: "SPLIT_PART(ASSET_QUALIFIED_NAME, '.', 3)",
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const replaceIdentifier = (sql, from, to) => {
  if (!from || !to || from === to) return sql;
  const escaped = escapeRegex(from);
  const quotedPattern = new RegExp(`"${escaped}"`, 'gi');
  const wordPattern = new RegExp(`\\b${escaped}\\b`, 'gi');
  return sql.replace(quotedPattern, to).replace(wordPattern, to);
};

export const mapSqlForGold = (sql) => {
  if (!sql) return sql;
  let mapped = sql;

  Object.entries(GOLD_TABLE_MAP).forEach(([from, to]) => {
    mapped = replaceIdentifier(mapped, from, to);
  });

  Object.entries(GOLD_IDENTIFIER_MAP).forEach(([from, to]) => {
    mapped = replaceIdentifier(mapped, from, to);
  });

  return mapped;
};

export const mapSqlForCapabilities = (sql, capabilities) => {
  if (!capabilities?.profile) return sql;
  if (capabilities.profile === 'ATLAN_GOLD') {
    return mapSqlForGold(sql);
  }
  return sql;
};
