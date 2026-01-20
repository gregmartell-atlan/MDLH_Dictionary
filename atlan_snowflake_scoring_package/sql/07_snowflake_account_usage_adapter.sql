USE DATABASE METADATA_PLANNING;
USE SCHEMA EVIDENCE;

CREATE OR REPLACE VIEW ATLAN_SNOWFLAKE_TABLE_MAP AS
SELECT
  a.ASSET_QUALIFIED_NAME AS asset_key,
  'TABLE' AS asset_type,
  SPLIT_PART(a.ASSET_QUALIFIED_NAME, '/', -3) AS database_name,
  SPLIT_PART(a.ASSET_QUALIFIED_NAME, '/', -2) AS schema_name,
  SPLIT_PART(a.ASSET_QUALIFIED_NAME, '/', -1) AS object_name
FROM atlan_gold.public.ASSETS a
WHERE a.STATUS='ACTIVE' AND a.CONNECTOR_NAME='snowflake' AND a.ASSET_TYPE='Table';

CREATE OR REPLACE VIEW ATLAN_SNOWFLAKE_COLUMN_MAP AS
SELECT
  a.ASSET_QUALIFIED_NAME AS asset_key,
  'COLUMN' AS asset_type,
  SPLIT_PART(a.ASSET_QUALIFIED_NAME, '/', -4) AS database_name,
  SPLIT_PART(a.ASSET_QUALIFIED_NAME, '/', -3) AS schema_name,
  SPLIT_PART(a.ASSET_QUALIFIED_NAME, '/', -2) AS table_name,
  SPLIT_PART(a.ASSET_QUALIFIED_NAME, '/', -1) AS column_name
FROM atlan_gold.public.ASSETS a
WHERE a.STATUS='ACTIVE' AND a.CONNECTOR_NAME='snowflake' AND a.ASSET_TYPE='Column';

CREATE OR REPLACE PROCEDURE POPULATE_SNOWFLAKE_CONSTRAINT_EVIDENCE()
RETURNS STRING
LANGUAGE SQL
AS
$$
BEGIN
  DELETE FROM EVIDENCE.EVIDENCE_OBSERVATION
  WHERE source='SNOWFLAKE_ACCOUNT_USAGE'
    AND evidence_key IN ('snowflake.pk.present','snowflake.fk.count');

  INSERT INTO EVIDENCE.EVIDENCE_OBSERVATION
  WITH pk AS (
    SELECT table_catalog, table_schema, table_name,
           MAX(IFF(constraint_type='PRIMARY KEY',1,0)) AS has_pk
    FROM SNOWFLAKE.ACCOUNT_USAGE.TABLE_CONSTRAINTS
    GROUP BY 1,2,3
  )
  SELECT CURRENT_TIMESTAMP(),'SNOWFLAKE_ACCOUNT_USAGE',m.asset_key,m.asset_type,
         'snowflake.pk.present', IFF(COALESCE(pk.has_pk,0)=1,TRUE,FALSE), 0.95
  FROM EVIDENCE.ATLAN_SNOWFLAKE_TABLE_MAP m
  LEFT JOIN pk
    ON pk.table_catalog=m.database_name AND pk.table_schema=m.schema_name AND pk.table_name=m.object_name;

  INSERT INTO EVIDENCE.EVIDENCE_OBSERVATION
  WITH fk AS (
    SELECT table_catalog, table_schema, table_name,
           COUNT_IF(constraint_type='FOREIGN KEY') AS fk_count
    FROM SNOWFLAKE.ACCOUNT_USAGE.TABLE_CONSTRAINTS
    GROUP BY 1,2,3
  )
  SELECT CURRENT_TIMESTAMP(),'SNOWFLAKE_ACCOUNT_USAGE',m.asset_key,m.asset_type,
         'snowflake.fk.count', COALESCE(fk.fk_count,0), 0.90
  FROM EVIDENCE.ATLAN_SNOWFLAKE_TABLE_MAP m
  LEFT JOIN fk
    ON fk.table_catalog=m.database_name AND fk.table_schema=m.schema_name AND fk.table_name=m.object_name;

  RETURN 'OK: loaded PK/FK evidence';
END;
$$;

CREATE OR REPLACE PROCEDURE POPULATE_SNOWFLAKE_MASKING_EVIDENCE()
RETURNS STRING
LANGUAGE SQL
AS
$$
BEGIN
  DELETE FROM EVIDENCE.EVIDENCE_OBSERVATION
  WHERE source='SNOWFLAKE_ACCOUNT_USAGE' AND evidence_key='snowflake.masking.present';

  INSERT INTO EVIDENCE.EVIDENCE_OBSERVATION
  WITH pr AS (
    SELECT ref_database_name AS database_name,
           ref_schema_name   AS schema_name,
           ref_entity_name   AS table_name,
           ref_column_name   AS column_name,
           MAX(IFF(policy_kind='MASKING_POLICY',1,0)) AS has_masking
    FROM SNOWFLAKE.ACCOUNT_USAGE.POLICY_REFERENCES
    GROUP BY 1,2,3,4
  )
  SELECT CURRENT_TIMESTAMP(),'SNOWFLAKE_ACCOUNT_USAGE',c.asset_key,c.asset_type,
         'snowflake.masking.present', IFF(COALESCE(pr.has_masking,0)=1,TRUE,FALSE), 0.90
  FROM EVIDENCE.ATLAN_SNOWFLAKE_COLUMN_MAP c
  LEFT JOIN pr
    ON pr.database_name=c.database_name AND pr.schema_name=c.schema_name
   AND pr.table_name=c.table_name AND pr.column_name=c.column_name;

  INSERT INTO EVIDENCE.EVIDENCE_OBSERVATION
  WITH pr_tbl AS (
    SELECT ref_database_name AS database_name,
           ref_schema_name   AS schema_name,
           ref_entity_name   AS object_name,
           MAX(IFF(policy_kind='MASKING_POLICY',1,0)) AS has_masking_any
    FROM SNOWFLAKE.ACCOUNT_USAGE.POLICY_REFERENCES
    GROUP BY 1,2,3
  )
  SELECT CURRENT_TIMESTAMP(),'SNOWFLAKE_ACCOUNT_USAGE',t.asset_key,t.asset_type,
         'snowflake.masking.present', IFF(COALESCE(pr_tbl.has_masking_any,0)=1,TRUE,FALSE), 0.90
  FROM EVIDENCE.ATLAN_SNOWFLAKE_TABLE_MAP t
  LEFT JOIN pr_tbl
    ON pr_tbl.database_name=t.database_name AND pr_tbl.schema_name=t.schema_name AND pr_tbl.object_name=t.object_name;

  RETURN 'OK: loaded masking evidence';
END;
$$;

CREATE OR REPLACE PROCEDURE REFRESH_FROM_SNOWFLAKE_ACCOUNT_USAGE()
RETURNS STRING
LANGUAGE SQL
AS
$$
BEGIN
  CALL EVIDENCE.POPULATE_SNOWFLAKE_CONSTRAINT_EVIDENCE();
  CALL EVIDENCE.POPULATE_SNOWFLAKE_MASKING_EVIDENCE();
  RETURN 'OK: refreshed Snowflake ACCOUNT_USAGE evidence';
END;
$$;
