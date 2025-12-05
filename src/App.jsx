import React, { useState, useEffect, useRef } from 'react';
import { Download, Table, Database, BookOpen, Boxes, FolderTree, BarChart3, GitBranch, Cloud, Workflow, Shield, Bot, Copy, Check, Code2, X, Search, Command, Terminal, Play } from 'lucide-react';
import QueryEditor from './components/QueryEditor';

const tabs = [
  { id: 'core', label: 'Core', icon: Table },
  { id: 'glossary', label: 'Glossary', icon: BookOpen },
  { id: 'datamesh', label: 'Data Mesh', icon: Boxes },
  { id: 'relational', label: 'Relational DB', icon: Database },
  { id: 'queries', label: 'Query Org', icon: FolderTree },
  { id: 'bi', label: 'BI Tools', icon: BarChart3 },
  { id: 'dbt', label: 'dbt', icon: GitBranch },
  { id: 'storage', label: 'Object Storage', icon: Cloud },
  { id: 'orchestration', label: 'Orchestration', icon: Workflow },
  { id: 'governance', label: 'Governance', icon: Shield },
  { id: 'ai', label: 'AI/ML', icon: Bot },
  { id: 'editor', label: 'Query Editor', icon: Terminal, isEditor: true },
];

const data = {
  core: [
    { entity: 'Referenceable', table: '(abstract)', description: 'Root of all entity types', keyAttributes: 'guid, qualifiedName', relationships: 'Base for all', notes: 'Not directly queryable' },
    { entity: 'Asset', table: '(abstract)', description: 'Base class for all assets', keyAttributes: 'name, description, ownerUsers, ownerGroups, certificateStatus, announcementType, createTime, updateTime, createdBy, updatedBy', relationships: 'Extends Referenceable', notes: 'Not directly queryable' },
    { entity: 'Catalog', table: '(abstract)', description: 'Base for technical/data assets', keyAttributes: 'connectionQualifiedName, connectorType', relationships: 'Extends Asset', notes: 'Parent for SQL, BI, dbt, etc.' },
    { entity: 'Connection', table: 'CONNECTION_ENTITY', description: 'Configured connection to data source', keyAttributes: 'connectorName, category, host, port, adminRoles, adminGroups, adminUsers', relationships: 'Contains databases, schemas', notes: 'Root of connector hierarchy' },
    { entity: 'Process', table: 'PROCESS_ENTITY', description: 'Transformation/lineage process', keyAttributes: 'inputs, outputs, sql, code, columnProcesses', relationships: 'Links assets in lineage', notes: 'Table-level lineage' },
    { entity: 'ColumnProcess', table: 'COLUMNPROCESS_ENTITY', description: 'Column-level lineage process', keyAttributes: 'inputs, outputs', relationships: 'Links columns in lineage', notes: 'Column-level lineage' },
    { entity: 'BIProcess', table: 'BIPROCESS_ENTITY', description: 'BI-specific transformation', keyAttributes: 'inputs, outputs', relationships: 'BI tool lineage', notes: 'Extends Process' },
    { entity: 'SparkJob', table: 'SPARKJOB_ENTITY', description: 'Apache Spark job', keyAttributes: 'sparkRunVersion, sparkRunOpenLineageState', relationships: 'Spark lineage', notes: 'OpenLineage integration' },
  ],
  glossary: [
    { entity: 'AtlasGlossary', table: 'ATLASGLOSSARY_ENTITY', description: 'Business glossary container', keyAttributes: 'name, shortDescription, longDescription, language, usage', relationships: 'Contains terms & categories', qualifiedNamePattern: 'Generated hash', exampleQuery: "SELECT GUID, NAME FROM ATLASGLOSSARY_ENTITY" },
    { entity: 'AtlasGlossaryTerm', table: 'ATLASGLOSSARYTERM_ENTITY', description: 'Business term with definition', keyAttributes: 'name, shortDescription, longDescription, examples, usage, abbreviation, anchor', relationships: 'anchor (glossary), categories, assignedEntities, seeAlso, synonyms, antonyms', qualifiedNamePattern: 'Generated hash', exampleQuery: "SELECT NAME, USERDESCRIPTION FROM ATLASGLOSSARYTERM_ENTITY WHERE CERTIFICATESTATUS='VERIFIED'" },
    { entity: 'AtlasGlossaryCategory', table: 'ATLASGLOSSARYCATEGORY_ENTITY', description: 'Hierarchical grouping of terms', keyAttributes: 'name, shortDescription, longDescription, anchor', relationships: 'anchor (glossary), parentCategory, childrenCategories, terms', qualifiedNamePattern: 'Generated hash', exampleQuery: "SELECT NAME, PARENTCATEGORY FROM ATLASGLOSSARYCATEGORY_ENTITY" },
  ],
  datamesh: [
    { entity: 'DataDomain', table: 'DATADOMAIN_ENTITY', description: 'Business domain grouping', keyAttributes: 'name, description, parentDomainQualifiedName, superDomainQualifiedName', relationships: 'dataProducts, parentDomain, subDomains', qualifiedNamePattern: 'default/domain/<lowerCamelCaseName>', exampleQuery: "SELECT NAME, USERDESCRIPTION FROM DATADOMAIN_ENTITY" },
    { entity: 'DataProduct', table: 'DATAPRODUCT_ENTITY', description: 'Self-contained data product', keyAttributes: 'name, description, dataProductStatus, dataProductCriticality, dataProductSensitivity, dataProductVisibility, dataProductAssetsDSL, dataProductScore', relationships: 'dataDomain, inputPorts, outputPorts, dataContractLatest', qualifiedNamePattern: '<parentDomainQN>/product/<name>', exampleQuery: "SELECT NAME, DATAPRODUCTSTATUS FROM DATAPRODUCT_ENTITY WHERE DATAPRODUCTSTATUS='Active'" },
    { entity: 'DataContract', table: 'DATACONTRACT_ENTITY', description: 'Formal data specification', keyAttributes: 'dataContractSpec, dataContractVersion, certificateStatus, dataContractAssetGuid', relationships: 'dataContractAsset, dataContractNextVersion', qualifiedNamePattern: 'Generated', exampleQuery: "SELECT DATACONTRACTVERSION, CERTIFICATESTATUS FROM DATACONTRACT_ENTITY" },
  ],
  relational: [
    { entity: 'Database', table: 'DATABASE_ENTITY', description: 'Database container', keyAttributes: 'name, schemaCount, connectionQualifiedName', relationships: 'schemas, connection', qualifiedNamePattern: 'default/<connector>/<epoch>/<db_name>', hierarchy: 'Connection → Database' },
    { entity: 'Schema', table: 'SCHEMA_ENTITY', description: 'Namespace within database', keyAttributes: 'name, tableCount, viewCount, databaseQualifiedName', relationships: 'tables, views, database', qualifiedNamePattern: '.../<db_name>/<schema_name>', hierarchy: 'Database → Schema' },
    { entity: 'Table', table: 'TABLE_ENTITY', description: 'Database table', keyAttributes: 'name, rowCount, columnCount, sizeBytes, partitionStrategy, schemaQualifiedName', relationships: 'columns, partitions, queries, schema', qualifiedNamePattern: '.../<schema>/<table_name>', hierarchy: 'Schema → Table' },
    { entity: 'View', table: 'VIEW_ENTITY', description: 'Database view', keyAttributes: 'name, columnCount, definition, schemaQualifiedName', relationships: 'columns, queries, schema', qualifiedNamePattern: '.../<schema>/<view_name>', hierarchy: 'Schema → View' },
    { entity: 'MaterialisedView', table: 'MATERIALISEDVIEW_ENTITY', description: 'Materialized/cached view', keyAttributes: 'name, definition, refreshMode, staleness', relationships: 'columns, schema', qualifiedNamePattern: '.../<schema>/<mv_name>', hierarchy: 'Schema → MaterialisedView' },
    { entity: 'Column', table: 'COLUMN_ENTITY', description: 'Table/view column', keyAttributes: 'name, dataType, maxLength, precision, scale, isPrimaryKey, isForeignKey, isNullable, isPartition, order', relationships: 'table/view, foreignKeyTo', qualifiedNamePattern: '.../<table>/<column_name>', hierarchy: 'Table/View → Column' },
    { entity: 'TablePartition', table: 'TABLEPARTITION_ENTITY', description: 'Partition of partitioned table', keyAttributes: 'name, partitionList, partitionStrategy', relationships: 'columns, parentTable', qualifiedNamePattern: '.../<table>/<partition>', hierarchy: 'Table → Partition' },
    { entity: 'Procedure', table: 'PROCEDURE_ENTITY', description: 'Stored procedure', keyAttributes: 'name, definition, schemaQualifiedName', relationships: 'schema', qualifiedNamePattern: '.../<schema>/<proc_name>', hierarchy: 'Schema → Procedure' },
    { entity: 'Function', table: 'FUNCTION_ENTITY', description: 'User-defined function', keyAttributes: 'name, definition, schemaQualifiedName', relationships: 'schema', qualifiedNamePattern: '.../<schema>/<func_name>', hierarchy: 'Schema → Function' },
    { entity: 'SnowflakeDynamicTable', table: 'SNOWFLAKEDYNAMICTABLE_ENTITY', description: 'Snowflake dynamic table', keyAttributes: 'name, definition, refreshMode', relationships: 'columns, schema', qualifiedNamePattern: 'Snowflake-specific', hierarchy: 'Schema → DynamicTable' },
    { entity: 'SnowflakePipe', table: 'SNOWFLAKEPIPE_ENTITY', description: 'Snowpipe ingestion', keyAttributes: 'name, definition, snowflakePipeNotificationChannelName', relationships: 'schema', qualifiedNamePattern: 'Snowflake-specific', hierarchy: 'Schema → Pipe' },
    { entity: 'SnowflakeStream', table: 'SNOWFLAKESTREAM_ENTITY', description: 'CDC stream', keyAttributes: 'name, snowflakeStreamType, snowflakeStreamSourceType', relationships: 'schema', qualifiedNamePattern: 'Snowflake-specific', hierarchy: 'Schema → Stream' },
    { entity: 'SnowflakeTag', table: 'SNOWFLAKETAG_ENTITY', description: 'Native Snowflake tag', keyAttributes: 'name, tagAllowedValues', relationships: 'schema, taggedAssets', qualifiedNamePattern: 'Snowflake-specific', hierarchy: 'Schema → Tag' },
  ],
  queries: [
    { entity: 'Namespace', table: '(abstract)', description: 'Base for organizational containers', keyAttributes: 'name, childrenQueries, childrenFolders', relationships: 'Base for Collection/Folder', hierarchy: 'Abstract parent', notes: 'Not directly queryable' },
    { entity: 'Collection', table: 'COLLECTION_ENTITY', description: 'Top-level query collection', keyAttributes: 'name, description, icon, iconType, adminUsers, adminGroups, viewerUsers, viewerGroups', relationships: 'childrenFolders, childrenQueries', hierarchy: 'Root container', notes: 'Atlan Insights collections' },
    { entity: 'Folder', table: 'FOLDER_ENTITY', description: 'Query folder within collection', keyAttributes: 'name, parentQualifiedName, collectionQualifiedName', relationships: 'parentFolder, childrenFolders, childrenQueries', hierarchy: 'Collection → Folder', notes: 'Can nest folders' },
    { entity: 'Query', table: 'QUERY_ENTITY', description: 'Saved SQL query', keyAttributes: 'name, rawQuery, defaultSchemaQualifiedName, defaultDatabaseQualifiedName, variablesSchemaBase64, isVisualQuery', relationships: 'parentFolder/collection, visualBuilderSchemaBase64', hierarchy: 'Folder/Collection → Query', notes: 'Saved queries in Insights' },
  ],
  bi: [
    { entity: 'TableauSite', table: 'TABLEAUSITE_ENTITY', description: 'Tableau site', keyAttributes: 'name, siteQualifiedName', relationships: 'projects', connector: 'Tableau', hierarchy: 'Root' },
    { entity: 'TableauProject', table: 'TABLEAUPROJECT_ENTITY', description: 'Tableau project', keyAttributes: 'name, isTopLevelProject', relationships: 'site, workbooks, datasources', connector: 'Tableau', hierarchy: 'Site → Project' },
    { entity: 'TableauWorkbook', table: 'TABLEAUWORKBOOK_ENTITY', description: 'Tableau workbook', keyAttributes: 'name, projectQualifiedName', relationships: 'project, dashboards, worksheets', connector: 'Tableau', hierarchy: 'Project → Workbook' },
    { entity: 'TableauDashboard', table: 'TABLEAUDASHBOARD_ENTITY', description: 'Tableau dashboard', keyAttributes: 'name, workbookQualifiedName', relationships: 'workbook, worksheets', connector: 'Tableau', hierarchy: 'Workbook → Dashboard' },
    { entity: 'TableauDatasource', table: 'TABLEAUDATASOURCE_ENTITY', description: 'Tableau data source', keyAttributes: 'name, hasExtracts', relationships: 'project, fields, upstreamTables', connector: 'Tableau', hierarchy: 'Project → Datasource' },
    { entity: 'TableauCalculatedField', table: 'TABLEAUCALCULATEDFIELD_ENTITY', description: 'Tableau calculated field', keyAttributes: 'name, formula, workbookQualifiedName', relationships: 'workbook, datasource', connector: 'Tableau', hierarchy: 'Workbook → CalculatedField' },
    { entity: 'PowerBIWorkspace', table: 'POWERBIWORKSPACE_ENTITY', description: 'Power BI workspace', keyAttributes: 'name, webUrl', relationships: 'reports, dashboards, datasets', connector: 'Power BI', hierarchy: 'Root' },
    { entity: 'PowerBIReport', table: 'POWERBIREPORT_ENTITY', description: 'Power BI report', keyAttributes: 'name, webUrl, workspaceQualifiedName', relationships: 'workspace, pages, dataset', connector: 'Power BI', hierarchy: 'Workspace → Report' },
    { entity: 'PowerBIDataset', table: 'POWERBIDATASET_ENTITY', description: 'Power BI dataset', keyAttributes: 'name, workspaceQualifiedName', relationships: 'workspace, tables, measures', connector: 'Power BI', hierarchy: 'Workspace → Dataset' },
    { entity: 'PowerBIMeasure', table: 'POWERBIMEASURE_ENTITY', description: 'Power BI measure', keyAttributes: 'name, powerBIMeasureExpression, table', relationships: 'dataset, table', connector: 'Power BI', hierarchy: 'Dataset → Measure' },
    { entity: 'LookerProject', table: 'LOOKERPROJECT_ENTITY', description: 'Looker project', keyAttributes: 'name', relationships: 'models, explores', connector: 'Looker', hierarchy: 'Root' },
    { entity: 'LookerModel', table: 'LOOKERMODEL_ENTITY', description: 'Looker model', keyAttributes: 'name, projectName', relationships: 'project, explores, views', connector: 'Looker', hierarchy: 'Project → Model' },
    { entity: 'LookerExplore', table: 'LOOKEREXPLORE_ENTITY', description: 'Looker explore', keyAttributes: 'name, modelName, connectionName', relationships: 'model, fields', connector: 'Looker', hierarchy: 'Model → Explore' },
    { entity: 'LookerDashboard', table: 'LOOKERDASHBOARD_ENTITY', description: 'Looker dashboard', keyAttributes: 'name, folderName', relationships: 'folder, tiles', connector: 'Looker', hierarchy: 'Folder → Dashboard' },
    { entity: 'MetabaseDashboard', table: 'METABASEDASHBOARD_ENTITY', description: 'Metabase dashboard', keyAttributes: 'name, collectionQualifiedName', relationships: 'collection, questions', connector: 'Metabase', hierarchy: 'Collection → Dashboard' },
    { entity: 'MetabaseQuestion', table: 'METABASEQUESTION_ENTITY', description: 'Metabase question/chart', keyAttributes: 'name, queryType', relationships: 'collection, dashboards', connector: 'Metabase', hierarchy: 'Collection → Question' },
    { entity: 'SigmaDataElement', table: 'SIGMADATAELEMENT_ENTITY', description: 'Sigma data element', keyAttributes: 'name, guid', relationships: 'workbook, dataset', connector: 'Sigma', hierarchy: 'Workbook → DataElement' },
  ],
  dbt: [
    { entity: 'DbtModel', table: 'DBTMODEL_ENTITY', description: 'dbt model (transformation)', keyAttributes: 'name, dbtAlias, dbtMaterialization, dbtModelSqlAssets, dbtCompiledSQL, dbtRawSQL', relationships: 'columns, sources, tests, metrics', qualifiedNamePattern: 'dbt-specific', notes: 'Links to SQL table/view' },
    { entity: 'DbtModelColumn', table: 'DBTMODELCOLUMN_ENTITY', description: 'Column in dbt model', keyAttributes: 'name, dbtModelQualifiedName, dataType', relationships: 'dbtModel, sqlColumn', qualifiedNamePattern: 'dbt-specific', notes: 'Links to SQL column' },
    { entity: 'DbtSource', table: 'DBTSOURCE_ENTITY', description: 'dbt source definition', keyAttributes: 'name, dbtSourceFreshnessCriteria', relationships: 'sqlAsset, dbtTests', qualifiedNamePattern: 'dbt-specific', notes: 'References source table' },
    { entity: 'DbtTest', table: 'DBTTEST_ENTITY', description: 'dbt test (schema/data)', keyAttributes: 'name, dbtTestState, dbtTestStatus, dbtTestCompiledSQL', relationships: 'dbtModel, dbtSource', qualifiedNamePattern: 'dbt-specific', notes: 'Test results' },
    { entity: 'DbtMetric', table: 'DBTMETRIC_ENTITY', description: 'dbt metric (semantic layer)', keyAttributes: 'name, dbtMetricType, dbtMetricFilters', relationships: 'dbtModel, columns', qualifiedNamePattern: 'dbt-specific', notes: 'Semantic layer metric' },
    { entity: 'DbtTag', table: 'DBTTAG_ENTITY', description: 'dbt meta tag', keyAttributes: 'name, dbtTagValue', relationships: 'taggedAssets', qualifiedNamePattern: 'dbt-specific', notes: 'Tags from dbt meta' },
    { entity: 'DbtProcess', table: 'DBTPROCESS_ENTITY', description: 'dbt lineage process', keyAttributes: 'inputs, outputs, dbtProcessJobStatus', relationships: 'dbtModel inputs/outputs', qualifiedNamePattern: 'dbt-specific', notes: 'Model-level lineage' },
    { entity: 'DbtColumnProcess', table: 'DBTCOLUMNPROCESS_ENTITY', description: 'dbt column lineage', keyAttributes: 'inputs, outputs', relationships: 'column inputs/outputs', qualifiedNamePattern: 'dbt-specific', notes: 'Column-level lineage' },
  ],
  storage: [
    { entity: 'S3Bucket', table: 'S3BUCKET_ENTITY', description: 'AWS S3 bucket', keyAttributes: 'name, s3BucketArn, awsRegion, s3ObjectCount', relationships: 's3Objects, connection', connector: 'AWS S3', hierarchy: 'Connection → Bucket' },
    { entity: 'S3Object', table: 'S3OBJECT_ENTITY', description: 'AWS S3 object', keyAttributes: 'name, s3ObjectKey, s3ObjectSize, s3ObjectContentType, s3ObjectLastModifiedTime', relationships: 's3Bucket', connector: 'AWS S3', hierarchy: 'Bucket → Object' },
    { entity: 'ADLSAccount', table: 'ADLSACCOUNT_ENTITY', description: 'Azure ADLS account', keyAttributes: 'name, adlsAccountQualifiedName', relationships: 'adlsContainers, connection', connector: 'Azure ADLS', hierarchy: 'Connection → Account' },
    { entity: 'ADLSContainer', table: 'ADLSCONTAINER_ENTITY', description: 'Azure ADLS container', keyAttributes: 'name, adlsContainerUrl', relationships: 'adlsAccount, adlsObjects', connector: 'Azure ADLS', hierarchy: 'Account → Container' },
    { entity: 'ADLSObject', table: 'ADLSOBJECT_ENTITY', description: 'Azure ADLS object', keyAttributes: 'name, adlsObjectUrl, adlsObjectSize, adlsObjectContentType', relationships: 'adlsContainer', connector: 'Azure ADLS', hierarchy: 'Container → Object' },
    { entity: 'GCSBucket', table: 'GCSBUCKET_ENTITY', description: 'Google Cloud Storage bucket', keyAttributes: 'name, gcsBucketName, gcsObjectCount', relationships: 'gcsObjects, connection', connector: 'GCS', hierarchy: 'Connection → Bucket' },
    { entity: 'GCSObject', table: 'GCSOBJECT_ENTITY', description: 'Google Cloud Storage object', keyAttributes: 'name, gcsObjectKey, gcsObjectSize, gcsObjectContentType', relationships: 'gcsBucket', connector: 'GCS', hierarchy: 'Bucket → Object' },
  ],
  orchestration: [
    { entity: 'AirflowDag', table: 'AIRFLOWDAG_ENTITY', description: 'Airflow DAG', keyAttributes: 'name, airflowDagSchedule, airflowDagScheduleInterval', relationships: 'airflowTasks, connection', connector: 'Airflow', hierarchy: 'Connection → DAG' },
    { entity: 'AirflowTask', table: 'AIRFLOWTASK_ENTITY', description: 'Airflow task within DAG', keyAttributes: 'name, airflowTaskOperatorClass, airflowTaskSql', relationships: 'airflowDag, inputAssets, outputAssets', connector: 'Airflow', hierarchy: 'DAG → Task' },
    { entity: 'AdfPipeline', table: 'ADFPIPELINE_ENTITY', description: 'Azure Data Factory pipeline', keyAttributes: 'name, adfPipelineAnnotations', relationships: 'adfActivities, adfDatasets', connector: 'ADF', hierarchy: 'Connection → Pipeline' },
    { entity: 'AdfActivity', table: 'ADFACTIVITY_ENTITY', description: 'ADF pipeline activity', keyAttributes: 'name, adfActivityType', relationships: 'adfPipeline', connector: 'ADF', hierarchy: 'Pipeline → Activity' },
    { entity: 'AdfDataflow', table: 'ADFDATAFLOW_ENTITY', description: 'ADF data flow', keyAttributes: 'name', relationships: 'adfPipeline, adfDatasets', connector: 'ADF', hierarchy: 'Pipeline → Dataflow' },
    { entity: 'AdfDataset', table: 'ADFDATASET_ENTITY', description: 'ADF dataset', keyAttributes: 'name, adfDatasetAnnotations', relationships: 'adfLinkedService, adfActivities', connector: 'ADF', hierarchy: 'Connection → Dataset' },
    { entity: 'AdfLinkedservice', table: 'ADFLINKEDSERVICE_ENTITY', description: 'ADF linked service', keyAttributes: 'name, adfLinkedserviceAnnotations', relationships: 'adfDatasets', connector: 'ADF', hierarchy: 'Connection → LinkedService' },
    { entity: 'MatillionGroup', table: 'MATILLIONGROUP_ENTITY', description: 'Matillion group', keyAttributes: 'name', relationships: 'matillionProjects', connector: 'Matillion', hierarchy: 'Connection → Group' },
    { entity: 'MatillionProject', table: 'MATILLIONPROJECT_ENTITY', description: 'Matillion project', keyAttributes: 'name', relationships: 'matillionGroup, matillionJobs', connector: 'Matillion', hierarchy: 'Group → Project' },
    { entity: 'MatillionJob', table: 'MATILLIONJOB_ENTITY', description: 'Matillion job', keyAttributes: 'name, matillionJobType', relationships: 'matillionProject, matillionComponents', connector: 'Matillion', hierarchy: 'Project → Job' },
    { entity: 'FivetranConnector', table: 'FIVETRANCONNECTOR_ENTITY', description: 'Fivetran connector', keyAttributes: 'name, fivetranConnectorSyncFrequency, fivetranConnectorSyncPaused', relationships: 'connection', connector: 'Fivetran', hierarchy: 'Connection → Connector' },
  ],
  governance: [
    { entity: 'Tag (Classification)', table: 'TAG_RELATIONSHIP', description: 'Classification tag for assets', keyAttributes: 'tagName, propagate, restrictPropagationThroughLineage', relationships: 'entityGuid (linked asset)', notes: 'Use TAG_RELATIONSHIP to find tagged assets' },
    { entity: 'CustomMetadata', table: 'CUSTOMMETADATA_RELATIONSHIP', description: 'Custom metadata attributes', keyAttributes: 'entityGuid, attributeDisplayName, attributeValue', relationships: 'entityGuid (linked asset)', notes: 'Join with entity tables on guid' },
    { entity: 'SnowflakeTag', table: 'SNOWFLAKETAG_ENTITY', description: 'Native Snowflake tag', keyAttributes: 'name, tagAllowedValues', relationships: 'taggedAssets', notes: 'Synced from Snowflake' },
    { entity: 'DatabricksUnityCatalogTag', table: 'DATABRICKSUNITYCATALOGTAG_ENTITY', description: 'Databricks Unity Catalog tag', keyAttributes: 'name', relationships: 'taggedAssets', notes: 'Synced from Databricks' },
    { entity: 'BigqueryTag', table: 'BIGQUERYTAG_ENTITY', description: 'BigQuery policy tag', keyAttributes: 'name', relationships: 'taggedAssets', notes: 'Synced from BigQuery' },
    { entity: 'Persona', table: 'PERSONA_ENTITY', description: 'Access control persona', keyAttributes: 'name, personaGroups, personaUsers', relationships: 'policies', notes: 'Defines what users can see/do' },
    { entity: 'Purpose', table: 'PURPOSE_ENTITY', description: 'Data access purpose', keyAttributes: 'name, purposeTags', relationships: 'policies', notes: 'Purpose-based access control' },
    { entity: 'BusinessPolicy', table: 'BUSINESSPOLICY_ENTITY', description: 'Data governance policy', keyAttributes: 'name, businessPolicyType, businessPolicyValiditySchedule', relationships: 'governedAssets, businessPolicyLogs', notes: 'Policy definitions' },
    { entity: 'BusinessPolicyLog', table: 'BUSINESSPOLICYLOG_ENTITY', description: 'Policy execution log', keyAttributes: 'businessPolicyLogMessage, businessPolicyLogTimestamp', relationships: 'businessPolicy', notes: 'Audit trail' },
  ],
  ai: [
    { entity: 'AIModel', table: 'AIMODEL_ENTITY', description: 'AI/ML model', keyAttributes: 'name, aiModelStatus, aiModelVersion, aiModelType', relationships: 'aiApplications, datasets (via Process)', notes: 'Model governance' },
    { entity: 'AIApplication', table: 'AIAPPLICATION_ENTITY', description: 'Application using AI models', keyAttributes: 'name, aiApplicationVersion, aiApplicationDevelopmentStage', relationships: 'aiModels', notes: 'App-level AI governance' },
  ],
};

// Example queries organized by category
const exampleQueries = {
  core: [
    {
      title: 'List All MDLH Tables',
      description: 'Discover available entity tables in the lakehouse',
      query: `SHOW TABLES;`
    },
    {
      title: 'Explore Catalog Integrations',
      description: 'View configured catalog integrations',
      query: `SHOW CATALOG INTEGRATIONS;
DESCRIBE CATALOG INTEGRATION <integration_name>;`
    },
    {
      title: 'Switch MDLH Environment',
      description: 'Select which MDLH database to query',
      query: `-- Choose your MDLH environment
USE FIELD_METADATA;      -- For atlan.atlan.com
USE MDLH_GOVERNANCE;     -- For demo-governance.atlan.com
USE MDLH_ATLAN_HOME;     -- For home tenant`
    },
    {
      title: 'Time Travel Query',
      description: 'Query historical data using Iceberg time travel',
      query: `-- Query data from a specific timestamp
SELECT *
FROM ATLASGLOSSARY_ENTITY
AT(TIMESTAMP => '2025-07-22 12:00:00'::timestamp_tz)
LIMIT 10;

-- View snapshot history for a table
SELECT *
FROM TABLE(INFORMATION_SCHEMA.ICEBERG_TABLE_SNAPSHOT_REFRESH_HISTORY(
  TABLE_NAME => 'ATLASGLOSSARY_ENTITY'
));`
    },
    {
      title: 'Downstream Lineage (No Limit)',
      description: 'Find ALL downstream assets from a source - no recursion limit',
      query: `-- GET DOWNSTREAM ASSETS - NO DISTANCE, NO RECURSION LIMIT
-- Warning: May be slow for assets with extensive lineage
WITH RECURSIVE lineage_cte (guid) AS (
    -- Anchor: Start with your source GUID
    SELECT '<YOUR_SOURCE_GUID>'::VARCHAR AS guid

    UNION ALL
    
    -- Recursive: Find all downstream dependencies
    SELECT outputs_flat.value::VARCHAR
    FROM lineage_cte AS L
    JOIN PROCESS_ENTITY AS P ON L.guid = P.inputs::ARRAY[0]::VARCHAR
    , LATERAL FLATTEN(INPUT => P.outputs::ARRAY) AS outputs_flat
)
SELECT DISTINCT
    COALESCE(T.name, V.name, SGELEM.name) AS entity_name,
    L.guid AS entity_guid,
    CASE
        WHEN T.name IS NOT NULL THEN 'TABLE'
        WHEN V.name IS NOT NULL THEN 'VIEW'
        WHEN SGELEM.name IS NOT NULL THEN 'SIGMA DATA ELEMENT'
        ELSE 'UNKNOWN'
    END AS entity_type
FROM lineage_cte AS L
LEFT JOIN TABLE_ENTITY AS T ON T.guid = L.guid
LEFT JOIN VIEW_ENTITY AS V ON V.guid = L.guid
LEFT JOIN SIGMADATAELEMENT_ENTITY AS SGELEM ON SGELEM.guid = L.guid
ORDER BY entity_name ASC;`
    },
    {
      title: 'Downstream Lineage (With Limit)',
      description: 'Find downstream assets with recursion depth limit and distance tracking',
      query: `-- GET DOWNSTREAM ASSETS - WITH DISTANCE AND RECURSION LIMIT
WITH RECURSIVE lineage_cte (guid, level) AS (
    -- Anchor: Start with your source GUID
    SELECT '<YOUR_SOURCE_GUID>'::VARCHAR AS guid, 0 AS level

    UNION ALL
    
    -- Recursive: Find downstream, increment level each step
    SELECT outputs_flat.value::VARCHAR, L.level + 1
    FROM lineage_cte AS L
    JOIN PROCESS_ENTITY AS P ON L.guid = P.inputs::ARRAY[0]::VARCHAR
    , LATERAL FLATTEN(INPUT => P.outputs::ARRAY) AS outputs_flat
    WHERE L.level < 5  -- Stop at 5 hops
)
SELECT DISTINCT
    COALESCE(T.name, V.name, SF.name, SGELEM.name) AS entity_name,
    L.guid AS entity_guid,
    CASE
        WHEN T.name IS NOT NULL THEN 'TABLE'
        WHEN V.name IS NOT NULL THEN 'VIEW'
        WHEN SF.name IS NOT NULL THEN 'SALESFORCE OBJECT'
        WHEN SGELEM.name IS NOT NULL THEN 'SIGMA DATA ELEMENT'
        ELSE 'UNKNOWN'
    END AS entity_type,
    L.level AS distance
FROM lineage_cte AS L
LEFT JOIN TABLE_ENTITY AS T ON T.guid = L.guid
LEFT JOIN VIEW_ENTITY AS V ON V.guid = L.guid
LEFT JOIN SALESFORCEOBJECT_ENTITY AS SF ON SF.guid = L.guid
LEFT JOIN SIGMADATAELEMENT_ENTITY AS SGELEM ON SGELEM.guid = L.guid
WHERE L.level > 0  -- Exclude the starting asset
ORDER BY distance ASC;`
    },
    {
      title: 'Upstream Lineage (With Distance)',
      description: 'Find all upstream sources with distance tracking',
      query: `-- GET UPSTREAM ASSETS - WITH DISTANCE AND RECURSION LIMIT
WITH RECURSIVE lineage_cte (guid, level) AS (
    -- Anchor: Start with your target GUID
    SELECT '<YOUR_TARGET_GUID>'::VARCHAR AS guid, 0 AS level

    UNION ALL
    
    -- Recursive: Find upstream by joining on OUTPUTS
    SELECT inputs_flat.value::VARCHAR, L.level + 1
    FROM lineage_cte AS L
    -- Note: Join on OUTPUTS to go upstream
    JOIN PROCESS_ENTITY AS P ON L.guid = P.outputs::ARRAY[0]::VARCHAR
    , LATERAL FLATTEN(INPUT => P.inputs::ARRAY) AS inputs_flat
    WHERE L.level < 5  -- Stop at 5 hops
)
SELECT DISTINCT
    COALESCE(T.name, V.name, SF.name) AS entity_name,
    L.guid AS entity_guid,
    CASE
        WHEN T.name IS NOT NULL THEN 'TABLE'
        WHEN V.name IS NOT NULL THEN 'VIEW'
        WHEN SF.name IS NOT NULL THEN 'SALESFORCE OBJECT'
        ELSE 'UNKNOWN'
    END AS entity_type,
    L.level AS distance
FROM lineage_cte AS L
LEFT JOIN TABLE_ENTITY AS T ON T.guid = L.guid
LEFT JOIN VIEW_ENTITY AS V ON V.guid = L.guid
LEFT JOIN SALESFORCEOBJECT_ENTITY AS SF ON SF.guid = L.guid
WHERE L.level > 0  -- Exclude starting asset
ORDER BY distance ASC;`
    },
    {
      title: 'Bidirectional Lineage',
      description: 'Get both upstream and downstream lineage with positive/negative distance',
      query: `-- BIDIRECTIONAL LINEAGE - Both upstream and downstream
-- Positive distance = downstream, Negative = upstream
WITH RECURSIVE downstream_cte (guid, level) AS (
    SELECT '<YOUR_GUID>'::VARCHAR AS guid, 0 AS level
    UNION ALL
    SELECT outputs_flat.value::VARCHAR, L.level + 1
    FROM downstream_cte AS L
    JOIN PROCESS_ENTITY AS P ON L.guid = P.inputs::ARRAY[0]::VARCHAR
    , LATERAL FLATTEN(INPUT => P.outputs::ARRAY) AS outputs_flat
    WHERE L.level < 5
),
upstream_cte (guid, level) AS (
    SELECT '<YOUR_GUID>'::VARCHAR AS guid, 0 AS level
    UNION ALL
    SELECT inputs_flat.value::VARCHAR, L.level - 1  -- Negative for upstream
    FROM upstream_cte AS L
    JOIN PROCESS_ENTITY AS P ON L.guid = P.outputs::ARRAY[0]::VARCHAR
    , LATERAL FLATTEN(INPUT => P.inputs::ARRAY) AS inputs_flat
    WHERE L.level > -5
),
combined_lineage AS (
    SELECT * FROM downstream_cte
    UNION ALL
    SELECT * FROM upstream_cte
)
SELECT DISTINCT
    COALESCE(T.name, V.name, SF.name, SGELEM.name) AS entity_name,
    L.guid AS entity_guid,
    CASE
        WHEN T.name IS NOT NULL THEN 'TABLE'
        WHEN V.name IS NOT NULL THEN 'VIEW'
        WHEN SF.name IS NOT NULL THEN 'SALESFORCE OBJECT'
        WHEN SGELEM.name IS NOT NULL THEN 'SIGMA DATA ELEMENT'
        ELSE 'UNKNOWN'
    END AS entity_type,
    L.level AS distance  -- Negative = upstream, Positive = downstream
FROM combined_lineage AS L
LEFT JOIN TABLE_ENTITY AS T ON T.guid = L.guid
LEFT JOIN VIEW_ENTITY AS V ON V.guid = L.guid
LEFT JOIN SALESFORCEOBJECT_ENTITY AS SF ON SF.guid = L.guid
LEFT JOIN SIGMADATAELEMENT_ENTITY AS SGELEM ON SGELEM.guid = L.guid
WHERE L.level != 0  -- Exclude starting asset
ORDER BY distance ASC;`
    },
  ],
  glossary: [
    {
      title: 'List All Glossaries',
      description: 'View all business glossaries in your tenant with creator info',
      query: `-- First, see all Glossaries in your Atlan tenant
SELECT
  NAME,
  GUID,
  CREATEDBY
FROM ATLASGLOSSARY_ENTITY;

-- Note the GUID of the glossary you want to explore
-- You'll use it in subsequent queries with ARRAY_CONTAINS`
    },
    {
      title: 'Terms with Categories (Full Detail)',
      description: 'List glossary terms with their parent glossaries and categories resolved to names',
      query: `-- Comprehensive query to resolve term relationships
WITH glossary_lookup AS (
    SELECT GUID AS glossary_guid, NAME AS glossary_name
    FROM GLOSSARY_ENTITY
),
category_lookup AS (
    SELECT GUID AS category_guid, NAME AS category_name
    FROM GLOSSARYCATEGORY_ENTITY
),
term_anchors AS (
    SELECT TERM.GUID AS term_guid,
           anchor_elem.value::STRING AS glossary_guid
    FROM GLOSSARYTERM_ENTITY TERM,
         LATERAL FLATTEN(input => TERM.ANCHOR) AS anchor_elem
),
term_categories AS (
    SELECT TERM.GUID AS term_guid,
           category_elem.value::STRING AS category_guid
    FROM GLOSSARYTERM_ENTITY TERM,
         LATERAL FLATTEN(input => TERM.CATEGORIES) AS category_elem
),
term_glossary_names AS (
    SELECT TA.term_guid,
           LISTAGG(GL.glossary_name, ', ') WITHIN GROUP (ORDER BY GL.glossary_name) AS glossaries
    FROM term_anchors TA
    LEFT JOIN glossary_lookup GL ON TA.glossary_guid = GL.glossary_guid
    GROUP BY TA.term_guid
),
term_category_names AS (
    SELECT TC.term_guid,
           LISTAGG(CL.category_name, ', ') WITHIN GROUP (ORDER BY CL.category_name) AS categories
    FROM term_categories TC
    LEFT JOIN category_lookup CL ON TC.category_guid = CL.category_guid
    GROUP BY TC.term_guid
)
SELECT
    T.NAME,
    T.USERDESCRIPTION,
    TG.glossaries AS GLOSSARIES,
    TC.categories AS CATEGORIES,
    T.GUID
FROM GLOSSARYTERM_ENTITY T
LEFT JOIN term_glossary_names TG ON T.GUID = TG.term_guid
LEFT JOIN term_category_names TC ON T.GUID = TC.term_guid
LIMIT 100;`
    },
    {
      title: 'Terms by Glossary GUID',
      description: 'Get all terms belonging to a specific glossary',
      query: `SELECT GUID, NAME, USERDESCRIPTION
FROM ATLASGLOSSARYTERM_ENTITY
WHERE ARRAY_CONTAINS('<GLOSSARY_GUID>', ANCHOR);`
    },
    {
      title: 'Terms by Creator',
      description: 'Find all terms created by a specific user',
      query: `SELECT GUID, NAME
FROM ATLASGLOSSARYTERM_ENTITY
WHERE CREATEDBY = '<username>';`
    },
    {
      title: 'Certificate Status Distribution',
      description: 'Count terms by certification status',
      query: `SELECT CERTIFICATESTATUS, COUNT(GUID) as term_count
FROM ATLASGLOSSARYTERM_ENTITY
GROUP BY CERTIFICATESTATUS;`
    },
    {
      title: 'Find Duplicate Terms (Jaro-Winkler)',
      description: 'Identify similar terms across glossaries using fuzzy matching',
      query: `WITH core_terms AS (
  SELECT NAME AS core_name, GUID AS core_guid,
         USERDESCRIPTION AS core_description
  FROM ATLASGLOSSARYTERM_ENTITY
  WHERE ARRAY_CONTAINS('<CORE_GLOSSARY_GUID>', ANCHOR)
),
non_core_terms AS (
  SELECT NAME AS non_core_name, GUID AS non_core_guid,
         USERDESCRIPTION AS non_core_description,
         ANCHOR AS non_core_anchor_guid
  FROM ATLASGLOSSARYTERM_ENTITY
  WHERE NOT(ARRAY_CONTAINS('<CORE_GLOSSARY_GUID>', ANCHOR))
),
glossary_lookup AS (
  SELECT GUID AS glossary_guid, NAME AS glossary_name
  FROM ATLASGLOSSARY_ENTITY
)
SELECT DISTINCT
  T1.core_name AS source_of_truth_name,
  T2.non_core_name AS potential_duplicate_name,
  T3.glossary_name AS duplicate_glossary,
  JAROWINKLER_SIMILARITY(T1.core_name, T2.non_core_name) AS similarity_score
FROM core_terms T1
JOIN non_core_terms T2
  ON JAROWINKLER_SIMILARITY(T1.core_name, T2.non_core_name) >= 95
  AND T1.core_guid != T2.non_core_guid
JOIN glossary_lookup T3
  ON ARRAY_CONTAINS(T3.glossary_guid, T2.non_core_anchor_guid)
ORDER BY similarity_score DESC;`
    },
    {
      title: 'Find Substring Duplicates',
      description: 'Find terms where one name contains another',
      query: `WITH standardized_terms AS (
  SELECT NAME AS original_term_name, GUID AS term_guid,
         USERDESCRIPTION AS term_description,
         LOWER(REGEXP_REPLACE(NAME, '[ _-]', '', 1, 0)) AS standardized_name
  FROM ATLASGLOSSARYTERM_ENTITY
)
SELECT DISTINCT
  t1.original_term_name AS potential_duplicate_1_name,
  t2.original_term_name AS potential_duplicate_2_name,
  t1.term_guid AS potential_duplicate_1_guid,
  t2.term_guid AS potential_duplicate_2_guid
FROM standardized_terms t1
JOIN standardized_terms t2
  ON t1.standardized_name LIKE '%' || t2.standardized_name || '%'
  AND LENGTH(t1.standardized_name) > LENGTH(t2.standardized_name)
  AND t1.term_guid != t2.term_guid
ORDER BY potential_duplicate_1_name;`
    },
  ],
  datamesh: [
    {
      title: 'List Data Domains',
      description: 'View all data domains and their hierarchy',
      query: `SELECT NAME, USERDESCRIPTION, PARENTDOMAINQUALIFIEDNAME
FROM DATADOMAIN_ENTITY
ORDER BY NAME;`
    },
    {
      title: 'Active Data Products',
      description: 'Find all active data products with their status',
      query: `SELECT NAME, DATAPRODUCTSTATUS, DATAPRODUCTCRITICALITY
FROM DATAPRODUCT_ENTITY
WHERE DATAPRODUCTSTATUS = 'Active'
ORDER BY DATAPRODUCTCRITICALITY DESC;`
    },
    {
      title: 'Data Contracts Overview',
      description: 'View data contract versions and certification status',
      query: `SELECT DATACONTRACTVERSION, CERTIFICATESTATUS, DATACONTRACTASSETGUID
FROM DATACONTRACT_ENTITY
ORDER BY DATACONTRACTVERSION DESC;`
    },
  ],
  relational: [
    {
      title: 'Basic Table Exploration',
      description: 'View table metadata with row counts and sizes',
      query: `SELECT NAME, ROWCOUNT, COLUMNCOUNT, SIZEBYTES, POPULARITYSCORE
FROM TABLE_ENTITY
WHERE SIZEBYTES IS NOT NULL
ORDER BY SIZEBYTES DESC
LIMIT 100;`
    },
    {
      title: 'Full Column Metadata Export',
      description: 'Comprehensive column-level metadata with tags and custom metadata as JSON arrays',
      query: `-- Column-Level Metadata Query with Aggregated Custom Metadata and Tags
WITH FILTERED_COLUMNS AS (
    SELECT GUID
    FROM COLUMN_ENTITY
    WHERE CONNECTORNAME IN ('glue', 'snowflake')
),
-- Aggregate Custom Metadata for each column as JSON
CM_AGG AS (
    SELECT
        CM.ENTITYGUID,
        ARRAY_AGG(
            DISTINCT OBJECT_CONSTRUCT(
                'set_name', SETDISPLAYNAME,
                'field_name', ATTRIBUTEDISPLAYNAME,
                'field_value', ATTRIBUTEVALUE
            )
        ) AS CUSTOM_METADATA_JSON
    FROM CUSTOMMETADATA_RELATIONSHIP CM
    JOIN FILTERED_COLUMNS FC ON CM.ENTITYGUID = FC.GUID
    GROUP BY CM.ENTITYGUID
),
-- Aggregate Tags for each column as JSON
TR_AGG AS (
    SELECT
        TR.ENTITYGUID,
        '[' || LISTAGG(
            OBJECT_CONSTRUCT('name', TR.TAGNAME, 'value', TR.TAGVALUE)::STRING, ','
        ) WITHIN GROUP (ORDER BY TR.TAGNAME) || ']' AS TAG_JSON
    FROM TAG_RELATIONSHIP TR
    JOIN FILTERED_COLUMNS FC ON TR.ENTITYGUID = FC.GUID
    GROUP BY TR.ENTITYGUID
)
SELECT
    -- Asset Identifiers
    COL.NAME AS COL_NAME,
    COL.QUALIFIEDNAME AS COL_QUALIFIEDNAME,
    COL.GUID AS COL_GUID,
    COL.DESCRIPTION AS COL_DESCRIPTION,
    COL.USERDESCRIPTION AS COL_USERDESCRIPTION,
    COL.CONNECTORNAME, COL.CONNECTIONNAME,
    COL.DATABASENAME, COL.SCHEMANAME, COL.TABLENAME,
    -- Source Attributes
    COL.DATATYPE, COL.SUBDATATYPE,
    COL."ORDER" AS COL_ORDER,
    COL.ISPARTITION, COL.ISPRIMARY, COL.ISNULLABLE,
    COL.PRECISION, COL.MAXLENGTH,
    -- Atlan Metrics
    COL.STATUS, COL.HASLINEAGE, COL.POPULARITYSCORE,
    COL.QUERYCOUNT, COL.QUERYUSERCOUNT,
    -- Tags & Custom Metadata
    TR_AGG.TAG_JSON AS COL_TAGS,
    CM_AGG.CUSTOM_METADATA_JSON AS COL_CUSTOM_METADATA,
    -- Enrichment
    COL.CERTIFICATESTATUS, COL.MEANINGS,
    COL.OWNERUSERS, COL.OWNERGROUPS
FROM COLUMN_ENTITY COL
LEFT JOIN CM_AGG ON COL.GUID = CM_AGG.ENTITYGUID
LEFT JOIN TR_AGG ON COL.GUID = TR_AGG.ENTITYGUID
WHERE COL.CONNECTORNAME IN ('glue', 'snowflake')
LIMIT 100;`
    },
    {
      title: 'Tables Without Descriptions',
      description: 'Find tables missing documentation',
      query: `SELECT
  SUM(CASE WHEN DESCRIPTION IS NOT NULL THEN 1 ELSE 0 END) "WITH DESCRIPTIONS",
  SUM(CASE WHEN DESCRIPTION IS NULL THEN 1 ELSE 0 END) "WITHOUT DESCRIPTIONS"
FROM TABLE_ENTITY;`
    },
    {
      title: 'Storage Reclamation Analysis',
      description: 'Find large tables by size and popularity for storage optimization',
      query: `-- STORAGE RECLAMATION ANALYSIS
-- Show the largest tables and their popularity scores
-- Use this to identify large, unused tables for cleanup
SELECT
  NAME,
  ROWCOUNT,
  COLUMNCOUNT,
  SIZEBYTES,
  POPULARITYSCORE
FROM TABLE_ENTITY
WHERE SIZEBYTES IS NOT NULL
ORDER BY SIZEBYTES DESC;

-- Calculate total storage used by unpopular tables
SELECT SUM(SIZEBYTES) as bytes_in_unpopular_tables
FROM TABLE_ENTITY
WHERE POPULARITYSCORE < 0.05;`
    },
    {
      title: 'Most Popular Tables',
      description: 'Find tables with highest query counts',
      query: `SELECT NAME, QUERYCOUNT, POPULARITYSCORE, COLUMNCOUNT
FROM TABLE_ENTITY
ORDER BY QUERYCOUNT DESC
LIMIT 20;`
    },
    {
      title: 'Frequent Column Updaters',
      description: 'Find users who update columns most frequently - useful for identifying power users',
      query: `-- POPULARITY ANALYSIS
-- Shows users who update Columns most frequently in Atlan
-- Useful for identifying power users and data stewards
SELECT
  UPDATEDBY,
  TO_TIMESTAMP(MAX(UPDATETIME)/1000) AS LASTUPDATE,
  COUNT(*) AS UPDATECOUNT
FROM COLUMN_ENTITY
GROUP BY UPDATEDBY
ORDER BY UPDATECOUNT DESC;`
    },
    {
      title: 'Table-Column Join',
      description: 'Get column details with parent table information',
      query: `SELECT tbl.name AS table_name,
       col.name AS column_name,
       col.datatype,
       TO_TIMESTAMP(col.updatetime/1000) AS column_updated,
       tbl.rowcount
FROM COLUMN_ENTITY col
JOIN TABLE_ENTITY tbl ON col."TABLE"[0] = tbl.guid
LIMIT 50;`
    },
    {
      title: 'Find Column by GUID',
      description: 'Get parent table for a specific column',
      query: `SELECT name AS table_name, rowcount
FROM TABLE_ENTITY
WHERE ARRAY_CONTAINS('<COLUMN_GUID>', columns);`
    },
    {
      title: 'Untagged Tables',
      description: 'Find tables without any classification tags',
      query: `SELECT GUID, QUALIFIEDNAME, COLUMNCOUNT, ROWCOUNT
FROM TABLE_ENTITY
WHERE ASSETTAGS = '[]';`
    },
    {
      title: 'Inactive Tables',
      description: 'Find tables with inactive status',
      query: `SELECT GUID, QUALIFIEDNAME, COLUMNCOUNT, ROWCOUNT, QUERYCOUNT
FROM TABLE_ENTITY
WHERE STATUS = 'INACTIVE';

-- Status distribution
SELECT STATUS, COUNT(*)
FROM TABLE_ENTITY
GROUP BY STATUS;`
    },
  ],
  queries: [
    {
      title: 'List Collections',
      description: 'View all Insights collections',
      query: `SELECT * FROM COLLECTION_ENTITY;`
    },
    {
      title: 'Collection Hierarchy',
      description: 'See folders within collections',
      query: `SELECT c.NAME as collection_name, f.NAME as folder_name
FROM COLLECTION_ENTITY c
LEFT JOIN FOLDER_ENTITY f ON f.COLLECTIONQUALIFIEDNAME = c.QUALIFIEDNAME;`
    },
  ],
  bi: [
    {
      title: 'Tableau Calculated Field Duplicates',
      description: 'Find potential duplicate calculated fields by name',
      query: `WITH standardized_metrics AS (
  SELECT NAME AS original_metric_name, GUID AS metric_guid,
         FORMULA AS original_formula,
         LOWER(REGEXP_REPLACE(NAME, '[ _-]', '', 1, 0)) AS standardized_name
  FROM TABLEAUCALCULATEDFIELD_ENTITY
)
SELECT DISTINCT
  t1.original_metric_name AS duplicate_1_name,
  t1.metric_guid AS duplicate_1_guid,
  t1.original_formula AS duplicate_1_formula,
  t2.original_metric_name AS duplicate_2_name,
  t2.metric_guid AS duplicate_2_guid,
  t2.original_formula AS duplicate_2_formula
FROM standardized_metrics t1
JOIN standardized_metrics t2
  ON t1.standardized_name LIKE '%' || t2.standardized_name || '%'
  AND LENGTH(t1.standardized_name) > LENGTH(t2.standardized_name)
  AND t1.metric_guid != t2.metric_guid
ORDER BY duplicate_1_name;`
    },
    {
      title: 'Tableau Formula Duplicates',
      description: 'Find calculated fields with identical formulas',
      query: `WITH standardized_metrics AS (
  SELECT NAME AS metric_name, GUID AS metric_guid, FORMULA AS original_formula,
         LOWER(REGEXP_REPLACE(FORMULA, '[ _\\[\\]]', '', 1, 0)) AS standardized_formula
  FROM TABLEAUCALCULATEDFIELD_ENTITY
)
SELECT standardized_formula,
       COUNT(*) AS number_of_metrics,
       LISTAGG(metric_guid, ', ') WITHIN GROUP (ORDER BY metric_guid) AS all_guids,
       LISTAGG(metric_name, ', ') WITHIN GROUP (ORDER BY metric_name) AS all_names
FROM standardized_metrics
GROUP BY standardized_formula
HAVING COUNT(*) > 1
ORDER BY number_of_metrics DESC;`
    },
    {
      title: 'Power BI Measure Duplicates',
      description: 'Find measures with same name across tables',
      query: `SELECT
  t1.NAME "MEASURE 1 NAME",
  t1.GUID "MEASURE 1 GUID",
  t1.POWERBIMEASUREEXPRESSION "MEASURE 1 EXPRESSION",
  t2.NAME "MEASURE 2 NAME",
  t2.GUID "MEASURE 2 GUID",
  t2.POWERBIMEASUREEXPRESSION "MEASURE 2 EXPRESSION",
  t1."TABLE" "COMMON TABLE"
FROM POWERBIMEASURE_ENTITY t1
JOIN POWERBIMEASURE_ENTITY t2
  ON t1.NAME = t2.NAME
  AND GET(t1."TABLE", 0) = GET(t2."TABLE", 0)
WHERE t1.GUID < t2.GUID
ORDER BY "MEASURE 1 NAME";`
    },
    {
      title: 'Power BI Measures by Popularity',
      description: 'Find most popular Power BI measures',
      query: `SELECT NAME, POPULARITYSCORE, POWERBIMEASUREEXPRESSION
FROM POWERBIMEASURE_ENTITY
ORDER BY POPULARITYSCORE DESC
LIMIT 20;`
    },
    {
      title: 'Tables with Measures',
      description: 'Find Power BI tables that have measures',
      query: `SELECT * FROM POWERBITABLE_ENTITY
WHERE POWERBITABLEMEASURECOUNT > 0;`
    },
  ],
  dbt: [
    {
      title: 'dbt Job Status Summary',
      description: 'Count models by job status',
      query: `SELECT dbtJobStatus, COUNT(*)
FROM DBTMODELCOLUMN_ENTITY
GROUP BY dbtJobStatus;

SELECT assetDbtJobStatus, COUNT(*)
FROM TABLE_ENTITY
GROUP BY assetDbtJobStatus;`
    },
    {
      title: 'dbt Models Overview',
      description: 'View dbt models with materialization type',
      query: `SELECT NAME, DBTALIAS, DBTMATERIALIZATION, DBTRAWSQL
FROM DBTMODEL_ENTITY
LIMIT 50;`
    },
  ],
  storage: [
    {
      title: 'S3 Bucket Overview',
      description: 'List S3 buckets with object counts',
      query: `SELECT NAME, S3BUCKETARN, AWSREGION, S3OBJECTCOUNT
FROM S3BUCKET_ENTITY
ORDER BY S3OBJECTCOUNT DESC;`
    },
  ],
  orchestration: [
    {
      title: 'Airflow DAGs',
      description: 'List all Airflow DAGs with schedules',
      query: `SELECT NAME, AIRFLOWDAGSCHEDULE, AIRFLOWDAGSCHEDULEINTERVAL
FROM AIRFLOWDAG_ENTITY;`
    },
    {
      title: 'Workflow Entities',
      description: 'View all workflow definitions',
      query: `SELECT * FROM WORKFLOW_ENTITY;`
    },
  ],
  governance: [
    {
      title: 'Most Popular Tags',
      description: 'Find most frequently used classification tags',
      query: `SELECT TAGNAME, COUNT(TAGNAME) as usage_count
FROM TAG_RELATIONSHIP
GROUP BY TAGNAME
ORDER BY usage_count DESC;`
    },
    {
      title: 'Tagged Tables',
      description: 'List all tables with their assigned tags',
      query: `-- Get all tables that have tags and their tag names
-- Useful for auditing tag coverage
SELECT
  TB.GUID,
  TB.NAME AS TABLENAME,
  TG.TAGNAME
FROM TABLE_ENTITY TB
JOIN TAG_RELATIONSHIP TG ON TB.GUID = TG.ENTITYGUID
WHERE TB.NAME IS NOT NULL;`
    },
    {
      title: 'Untagged Tables (Compliance)',
      description: 'Find tables without tags for compliance - includes creator and database for notification',
      query: `-- TAG COMPLIANCE USE CASE
-- Some companies require all tables to have a tag
-- (e.g., specifying data retention period).
-- Tables without tags may be flagged for deletion.

-- Find all untagged tables with creator info for follow-up:
SELECT DISTINCT
  TB.GUID,
  TB.NAME AS TABLENAME,
  TB.CREATEDBY,
  TB.DATABASEQUALIFIEDNAME
FROM TABLE_ENTITY TB
LEFT JOIN TAG_RELATIONSHIP TG ON TB.GUID = TG.ENTITYGUID
WHERE TG.TAGNAME IS NULL;

-- Use this to notify creators to add required tags`
    },
    {
      title: 'Custom Metadata Query',
      description: 'Find assets with specific custom metadata values',
      query: `SELECT col.guid, col.name AS column_name,
       cm.attributedisplayname, cm.attributevalue
FROM COLUMN_ENTITY col
JOIN CUSTOMMETADATA_RELATIONSHIP cm ON col.guid = cm.entityguid
WHERE attributedisplayname = 'Cost Center Attribution'
  AND attributevalue = 'COGS';`
    },
    {
      title: 'Custom Metadata Overview',
      description: 'Explore all custom metadata attributes',
      query: `SELECT DISTINCT attributedisplayname, attributevalue, COUNT(*)
FROM CUSTOMMETADATA_RELATIONSHIP
GROUP BY attributedisplayname, attributevalue
ORDER BY COUNT(*) DESC;`
    },
    {
      title: 'Assets with Tags (Join Pattern)',
      description: 'List assets with their tags using JOIN pattern',
      query: `-- Pattern for listing any asset type with tags
SELECT
  TB.GUID,
  TB.NAME AS TABLENAME,
  TG.TAGNAME
FROM TABLE_ENTITY TB
JOIN TAG_RELATIONSHIP TG ON TB.GUID = TG.ENTITYGUID
WHERE TB.NAME IS NOT NULL;

-- Same pattern works for columns, views, etc.
-- Just replace TABLE_ENTITY with the entity type you need`
    },
  ],
  ai: [
    {
      title: 'AI Models Overview',
      description: 'List all AI/ML models with status',
      query: `SELECT NAME, AIMODELSTATUS, AIMODELVERSION, AIMODELTYPE
FROM AIMODEL_ENTITY
ORDER BY AIMODELVERSION DESC;`
    },
  ],
};

const columns = {
  core: ['entity', 'table', 'description', 'keyAttributes', 'relationships', 'notes'],
  glossary: ['entity', 'table', 'description', 'keyAttributes', 'relationships', 'qualifiedNamePattern', 'exampleQuery'],
  datamesh: ['entity', 'table', 'description', 'keyAttributes', 'relationships', 'qualifiedNamePattern', 'exampleQuery'],
  relational: ['entity', 'table', 'description', 'keyAttributes', 'relationships', 'qualifiedNamePattern', 'hierarchy'],
  queries: ['entity', 'table', 'description', 'keyAttributes', 'relationships', 'hierarchy', 'notes'],
  bi: ['entity', 'table', 'description', 'keyAttributes', 'relationships', 'connector', 'hierarchy'],
  dbt: ['entity', 'table', 'description', 'keyAttributes', 'relationships', 'qualifiedNamePattern', 'notes'],
  storage: ['entity', 'table', 'description', 'keyAttributes', 'relationships', 'connector', 'hierarchy'],
  orchestration: ['entity', 'table', 'description', 'keyAttributes', 'relationships', 'connector', 'hierarchy'],
  governance: ['entity', 'table', 'description', 'keyAttributes', 'relationships', 'notes'],
  ai: ['entity', 'table', 'description', 'keyAttributes', 'relationships', 'notes'],
};

const colHeaders = {
  entity: 'Entity Type',
  table: 'MDLH Table',
  description: 'Description',
  keyAttributes: 'Key Attributes',
  relationships: 'Relationships',
  qualifiedNamePattern: 'qualifiedName Pattern',
  hierarchy: 'Hierarchy',
  connector: 'Connector',
  notes: 'Notes',
  exampleQuery: 'Example Query',
};

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async (e) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
        copied 
          ? 'bg-green-500 text-white' 
          : 'bg-white border border-gray-200 text-gray-600 hover:border-[#3366FF] hover:text-[#3366FF]'
      }`}
      title="Copy to clipboard"
    >
      {copied ? (
        <>
          <Check size={12} />
          <span>Copied!</span>
        </>
      ) : (
        <>
          <Copy size={12} />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

// Inline copy button for table cells
function CellCopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async (e) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  
  return (
    <button
      onClick={handleCopy}
      className={`ml-1.5 opacity-0 group-hover:opacity-100 inline-flex items-center justify-center w-5 h-5 rounded transition-all duration-150 ${
        copied 
          ? 'bg-green-500 text-white' 
          : 'bg-gray-200 hover:bg-[#3366FF] text-gray-500 hover:text-white'
      }`}
      title="Copy"
    >
      {copied ? <Check size={10} /> : <Copy size={10} />}
    </button>
  );
}

// Slide-out Query Panel
function QueryPanel({ isOpen, onClose, queries, categoryLabel, highlightedQuery, onRunInEditor }) {
  const panelRef = useRef(null);
  const highlightedRef = useRef(null);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target) && isOpen) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Scroll to highlighted query when panel opens
  useEffect(() => {
    if (isOpen && highlightedQuery && highlightedRef.current) {
      setTimeout(() => {
        highlightedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 350);
    }
  }, [isOpen, highlightedQuery]);

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />
      
      {/* Panel */}
      <div 
        ref={panelRef}
        className={`fixed top-0 right-0 h-full w-full max-w-2xl bg-white border-l border-gray-200 shadow-2xl z-50 transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-[#3366FF]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Code2 size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Example Queries</h2>
              <p className="text-sm text-blue-100">{categoryLabel} • {queries.length} queries</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/20 text-white transition-colors"
            title="Close (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Panel Content */}
        <div className="overflow-y-auto h-[calc(100%-80px)] p-4 space-y-3 bg-gray-50">
          {/* Show highlighted inline query at top if it's not in the main queries */}
          {highlightedQuery && !queries.some(q => q.query === highlightedQuery) && (
            <div ref={highlightedRef}>
              <div className="mb-4 pb-4 border-b border-gray-200">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-medium">Entity Example Query</p>
                <QueryCard 
                  title="Entity Query" 
                  description="Example query for this entity type" 
                  query={highlightedQuery} 
                  defaultExpanded={true}
                  onRunInEditor={onRunInEditor}
                />
              </div>
            </div>
          )}
          
          {queries.length > 0 ? (
            <>
              {highlightedQuery && !queries.some(q => q.query === highlightedQuery) && (
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">More {categoryLabel} Queries</p>
              )}
              {queries.map((q, i) => {
                const isHighlighted = highlightedQuery && q.query === highlightedQuery;
                return (
                  <div key={i} ref={isHighlighted ? highlightedRef : null}>
                    <QueryCard 
                      title={q.title} 
                      description={q.description} 
                      query={q.query} 
                      defaultExpanded={isHighlighted}
                      onRunInEditor={onRunInEditor}
                    />
                  </div>
                );
              })}
            </>
          ) : !highlightedQuery ? (
            <div className="text-center py-16">
              <Code2 size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-600 font-medium">No queries available</p>
              <p className="text-gray-400 text-sm mt-1">Queries for this category are coming soon</p>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

function QueryCard({ title, description, query, defaultExpanded = false, onRunInEditor }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  
  return (
    <div className={`bg-white rounded-xl border overflow-hidden transition-all duration-200 ${
      expanded ? 'border-[#3366FF] shadow-lg' : 'border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300'
    }`}>
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#3366FF]/10 rounded-lg">
            <Code2 size={18} className="text-[#3366FF]" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 text-sm">{title}</h4>
            <p className="text-gray-500 text-xs mt-0.5">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <CopyButton text={query} />
          {onRunInEditor && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRunInEditor(query);
              }}
              className="flex items-center gap-1 px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-xs font-medium"
              title="Open in Query Editor"
            >
              <Play size={10} />
              Run
            </button>
          )}
          <div className={`w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}>
            <span className="text-gray-500 text-xs">▶</span>
          </div>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50">
          <pre className="text-xs text-gray-800 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed p-4 bg-white rounded-lg border border-gray-200">
            {query}
          </pre>
        </div>
      )}
    </div>
  );
}

// Play button for running a query
function PlayQueryButton({ onClick, hasQuery }) {
  if (!hasQuery) return null;
  
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#3366FF] hover:bg-blue-600 text-white transition-all duration-200 shadow-sm hover:shadow-md"
      title="View query"
    >
      <Code2 size={12} />
      <span>Query</span>
    </button>
  );
}

// Default MDLH databases users can query
const MDLH_DATABASES = [
  { name: 'FIELD_METADATA', label: 'Field Metadata (atlan.atlan.com)' },
  { name: 'MDLH_GOVERNANCE', label: 'MDLH Governance (demo-governance.atlan.com)' },
  { name: 'MDLH_ATLAN_HOME', label: 'MDLH Atlan Home' },
  { name: 'ATLAN_MDLH', label: 'Atlan MDLH' },
];

// Generate a context-aware example query for an entity
function generateEntityQuery(entityName, tableName, database, options = {}) {
  const db = database || 'FIELD_METADATA';
  const table = tableName || `${entityName.toUpperCase()}_ENTITY`;
  const limit = options.limit || 10;
  
  // Base query with USE and SELECT
  let query = `-- Query ${entityName} entities from ${db}
USE ${db};

SELECT *
FROM ${table}
LIMIT ${limit};`;

  // Add entity-specific enhancements
  const entityLower = entityName.toLowerCase();
  
  if (entityLower.includes('column')) {
    query = `-- Query Column entities with key attributes
USE ${db};

SELECT 
    NAME,
    TABLENAME,
    DATATYPE,
    DESCRIPTION,
    USERDESCRIPTION,
    CERTIFICATESTATUS,
    CONNECTORNAME
FROM ${table}
WHERE STATUS = 'ACTIVE'
ORDER BY TABLENAME, "ORDER"
LIMIT ${limit};`;
  } else if (entityLower.includes('table') && !entityLower.includes('partition')) {
    query = `-- Query Table entities with popularity metrics
USE ${db};

SELECT 
    NAME,
    SCHEMANAME,
    DATABASENAME,
    QUERYCOUNT,
    POPULARITYSCORE,
    CERTIFICATESTATUS,
    CONNECTORNAME
FROM ${table}
WHERE STATUS = 'ACTIVE'
ORDER BY POPULARITYSCORE DESC NULLS LAST
LIMIT ${limit};`;
  } else if (entityLower.includes('glossary') && entityLower.includes('term')) {
    query = `-- Query Glossary Terms with verification status
USE ${db};

SELECT 
    NAME,
    USERDESCRIPTION,
    CERTIFICATESTATUS,
    OWNERUSERS,
    UPDATETIME
FROM ${table}
WHERE CERTIFICATESTATUS = 'VERIFIED'
ORDER BY UPDATETIME DESC
LIMIT ${limit};`;
  } else if (entityLower.includes('schema')) {
    query = `-- Query Schema entities
USE ${db};

SELECT 
    NAME,
    DATABASENAME,
    CONNECTORNAME,
    DESCRIPTION,
    OWNERUSERS
FROM ${table}
WHERE STATUS = 'ACTIVE'
LIMIT ${limit};`;
  } else if (entityLower.includes('database')) {
    query = `-- Query Database entities
USE ${db};

SELECT 
    NAME,
    CONNECTORNAME,
    CONNECTIONNAME,
    DESCRIPTION,
    POPULARITYSCORE
FROM ${table}
WHERE STATUS = 'ACTIVE'
ORDER BY POPULARITYSCORE DESC NULLS LAST
LIMIT ${limit};`;
  } else if (entityLower.includes('process') || entityLower.includes('lineage')) {
    query = `-- Query Process/Lineage entities
USE ${db};

SELECT 
    NAME,
    TYPENAME,
    INPUTS,
    OUTPUTS,
    CREATETIME
FROM ${table}
ORDER BY CREATETIME DESC
LIMIT ${limit};`;
  } else if (entityLower.includes('connection')) {
    query = `-- Query Connection entities
USE ${db};

SELECT 
    NAME,
    CONNECTORNAME,
    HOST,
    CERTIFICATESTATUS,
    ADMINUSERS
FROM ${table}
LIMIT ${limit};`;
  }
  
  return query;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('core');
  const [search, setSearch] = useState('');
  const [showQueries, setShowQueries] = useState(false);
  const [highlightedQuery, setHighlightedQuery] = useState(null);
  const [editorQuery, setEditorQuery] = useState('');
  const [selectedMDLHDatabase, setSelectedMDLHDatabase] = useState('FIELD_METADATA');
  const searchRef = useRef(null);

  // Keyboard shortcut: Cmd/Ctrl + K to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Function to open Query Editor with a specific query
  const openInEditor = (query) => {
    setEditorQuery(query);
    setActiveTab('editor');
    setShowQueries(false);
  };

  // Skip filtering for editor tab
  const filteredData = activeTab === 'editor' ? [] : (data[activeTab] || []).filter(row =>
    Object.values(row).some(val => 
      val?.toString().toLowerCase().includes(search.toLowerCase())
    )
  );

  const filteredQueries = (exampleQueries[activeTab] || []).filter(q =>
    q.title.toLowerCase().includes(search.toLowerCase()) ||
    q.description.toLowerCase().includes(search.toLowerCase()) ||
    q.query.toLowerCase().includes(search.toLowerCase())
  );

  // Find a query related to an entity by searching for table name in query SQL
  const findQueryForEntity = (entityName, tableName) => {
    const allQueries = exampleQueries[activeTab] || [];
    
    if (!tableName || tableName === '(abstract)') return null;
    
    const tableNameLower = tableName.toLowerCase();
    const entityNameLower = entityName.toLowerCase();
    
    // Priority 1: Exact table name match in query SQL (e.g., "FROM TABLE_ENTITY" or "TABLE_ENTITY")
    let matchedQuery = allQueries.find(q => {
      const queryLower = q.query.toLowerCase();
      return (
        queryLower.includes(`from ${tableNameLower}`) ||
        queryLower.includes(`from\n    ${tableNameLower}`) ||
        queryLower.includes(`from\n${tableNameLower}`) ||
        queryLower.includes(`join ${tableNameLower}`) ||
        // Also check for the table name as a standalone reference
        new RegExp(`\\b${tableNameLower.replace(/_/g, '_')}\\b`).test(queryLower)
      );
    });
    
    // Priority 2: Entity name explicitly in title (e.g., "Table" in title for TABLE_ENTITY)
    if (!matchedQuery) {
      matchedQuery = allQueries.find(q => {
        const titleLower = q.title.toLowerCase();
        // Match singular entity name (e.g., "Column" for Column entity, "Table" for Table)
        return (
          titleLower.includes(entityNameLower) ||
          titleLower.includes(entityNameLower + 's') || // plural
          titleLower.includes(entityNameLower + ' ')
        );
      });
    }
    
    return matchedQuery || null;
  };

  // Open panel with highlighted query
  const openQueryForEntity = (entityName, tableName, exampleQuery) => {
    // Priority 1: Generate a context-aware query using selected database
    if (tableName && tableName !== '(abstract)') {
      const dynamicQuery = generateEntityQuery(entityName, tableName, selectedMDLHDatabase);
      setHighlightedQuery(dynamicQuery);
    } 
    // Priority 2: Use inline exampleQuery if no table
    else if (exampleQuery) {
      setHighlightedQuery(exampleQuery);
    } 
    // Priority 3: Find related query from exampleQueries
    else {
      const matchedQuery = findQueryForEntity(entityName, tableName);
      setHighlightedQuery(matchedQuery?.query || null);
    }
    setShowQueries(true);
  };

  // Check if entity has a related query
  const hasQueryForEntity = (entityName, tableName, exampleQuery) => {
    if (exampleQuery) return true;
    if (!tableName || tableName === '(abstract)') return false;
    return findQueryForEntity(entityName, tableName) !== null;
  };

  const downloadCSV = () => {
    const cols = columns[activeTab];
    const header = cols.map(c => colHeaders[c]).join(',');
    const rows = filteredData.map(row => 
      cols.map(c => `"${(row[c] || '').toString().replace(/"/g, '""')}"`).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mdlh_${activeTab}_entities.csv`;
    a.click();
  };

  const downloadAllCSV = () => {
    Object.keys(data).forEach(tabId => {
      const cols = columns[tabId];
      const header = cols.map(c => colHeaders[c]).join(',');
      const rows = data[tabId].map(row => 
        cols.map(c => `"${(row[c] || '').toString().replace(/"/g, '""')}"`).join(',')
      );
      const csv = [header, ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mdlh_${tabId}_entities.csv`;
      a.click();
    });
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Navigation Bar */}
      <nav className="border-b border-gray-200 bg-white sticky top-0 z-30">
        <div className="max-w-full mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[#3366FF] font-bold text-xl">atlan</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-64 pl-9 pr-16 py-2 bg-white border border-gray-300 rounded-full text-sm focus:outline-none focus:border-[#3366FF] focus:ring-2 focus:ring-[#3366FF]/20 transition-all duration-200 placeholder-gray-400"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                <Command size={10} />
                <span>K</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="bg-[#3366FF] rounded-2xl mx-6 mt-6 p-8 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl font-semibold mb-3 italic">
            Metadata Lakehouse Entity Dictionary
          </h1>
          <p className="text-blue-100 text-lg">
            Reference guide for MDLH entity types, tables, attributes, and example queries
          </p>
          
          {/* Quick Action Buttons */}
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            <button
              onClick={() => {
                setHighlightedQuery(null);
                setShowQueries(true);
              }}
              className="px-5 py-2.5 bg-white text-[#3366FF] rounded-full text-sm font-medium hover:bg-blue-50 transition-all duration-200 flex items-center gap-2"
            >
              <Code2 size={16} />
              View All Queries
            </button>
            <button
              onClick={downloadCSV}
              className="px-5 py-2.5 bg-white/20 text-white border border-white/30 rounded-full text-sm font-medium hover:bg-white/30 transition-all duration-200 flex items-center gap-2"
            >
              <Download size={14} />
              Export Tab
            </button>
            <button
              onClick={downloadAllCSV}
              className="px-5 py-2.5 bg-white/20 text-white border border-white/30 rounded-full text-sm font-medium hover:bg-white/30 transition-all duration-200 flex items-center gap-2"
            >
              <Download size={14} />
              Export All
            </button>
          </div>
          
          {/* Database Selector for Query Context */}
          <div className="flex items-center gap-2 mt-4">
            <Database size={14} className="text-blue-100" />
            <span className="text-sm text-blue-100">Query Database:</span>
            <select
              value={selectedMDLHDatabase}
              onChange={(e) => setSelectedMDLHDatabase(e.target.value)}
              className="px-3 py-1.5 bg-white/20 text-white border border-white/30 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer appearance-none"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '16px', paddingRight: '32px' }}
            >
              {MDLH_DATABASES.map(db => (
                <option key={db.name} value={db.name} className="text-gray-900">
                  {db.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-full mx-auto px-6 py-6">
        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-gray-200">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-[#3366FF] text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-[#3366FF] hover:text-[#3366FF]'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Conditional Content: Query Editor or Data Table */}
        {activeTab === 'editor' ? (
          <QueryEditor initialQuery={editorQuery} />
        ) : (
          <>
            <div className="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    {columns[activeTab]?.map(col => (
                      <th key={col} className="px-4 py-3 text-left font-semibold text-gray-700 border-b border-gray-200 text-xs uppercase tracking-wider">
                        {colHeaders[col]}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b border-gray-200 text-xs uppercase tracking-wider w-24">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredData.length > 0 ? (
                    filteredData.map((row, i) => (
                      <tr key={i} className="group hover:bg-blue-50/50 transition-colors duration-150">
                        {columns[activeTab]?.map(col => (
                          <td key={col} className="px-4 py-3 align-top">
                            {col === 'entity' ? (
                              <span className="inline-flex items-center">
                                <span className="font-semibold text-[#3366FF]">{row[col]}</span>
                                <CellCopyButton text={row[col]} />
                              </span>
                            ) : col === 'table' ? (
                              <span className="inline-flex items-center">
                                <span className="font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-xs">{row[col]}</span>
                                {row[col] !== '(abstract)' && <CellCopyButton text={row[col]} />}
                              </span>
                            ) : col === 'exampleQuery' ? (
                              <span className="inline-flex items-center">
                                <code className="text-gray-600 bg-gray-100 px-2 py-0.5 rounded text-xs break-all">{row[col]}</code>
                                {row[col] && <CellCopyButton text={row[col]} />}
                              </span>
                            ) : (
                              <span className="text-gray-600">{row[col]}</span>
                            )}
                          </td>
                        ))}
                        <td className="px-4 py-3 align-top">
                          <PlayQueryButton 
                            hasQuery={hasQueryForEntity(row.entity, row.table, row.exampleQuery)}
                            onClick={() => openQueryForEntity(row.entity, row.table, row.exampleQuery)}
                          />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={(columns[activeTab]?.length || 0) + 1} className="px-4 py-12 text-center">
                        <Search size={32} className="mx-auto text-gray-300 mb-2" />
                        <p className="text-gray-600 font-medium">No results found</p>
                        <p className="text-gray-400 text-xs mt-1">Try adjusting your search terms</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing <span className="text-gray-900 font-medium">{filteredData.length}</span> of <span className="text-gray-900 font-medium">{data[activeTab]?.length || 0}</span> entities in <span className="text-[#3366FF] font-medium">{tabs.find(t => t.id === activeTab)?.label}</span>
              </p>
              <p className="text-sm text-gray-400">
                Press <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-gray-600 font-mono text-xs">⌘K</kbd> to search • Click <span className="text-[#3366FF]">Query</span> buttons for SQL examples
              </p>
            </div>
          </>
        )}
      </div>

      {/* Query Side Panel */}
      <QueryPanel 
        isOpen={showQueries} 
        onClose={() => {
          setShowQueries(false);
          setHighlightedQuery(null);
        }} 
        queries={filteredQueries}
        categoryLabel={tabs.find(t => t.id === activeTab)?.label}
        highlightedQuery={highlightedQuery}
        onRunInEditor={openInEditor}
      />
    </div>
  );
}
