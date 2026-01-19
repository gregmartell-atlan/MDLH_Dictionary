import type { EnrichmentPlan } from './enrichment-plan';

// Atlan Asset Categories based on the official model hierarchy
export type AtlanAssetCategory =
  | 'SQL'
  | 'ObjectStore'
  | 'NoSQL'
  | 'EventStore'
  | 'BI'
  | 'Airflow'
  | 'Dbt'
  | 'Matillion'
  | 'Fivetran'
  | 'DataMesh'
  | 'MultiDimensionalDataset'
  | 'API'
  | 'Custom';

// Specific asset types within each category
export type AtlanAssetType =
  // SQL types
  | 'Database'
  | 'Schema'
  | 'Table'
  | 'View'
  | 'Column'
  | 'MaterializedView'
  | 'Function'
  | 'Procedure'
  // ObjectStore types
  | 'S3Bucket'
  | 'S3Object'
  | 'ADLSContainer'
  | 'ADLSObject'
  | 'GCSBucket'
  | 'GCSObject'
  // NoSQL types
  | 'MongoDBDatabase'
  | 'MongoDBCollection'
  | 'DynamoDBTable'
  | 'CosmosDBContainer'
  // EventStore types
  | 'KafkaTopic'
  | 'KafkaConsumerGroup'
  | 'EventHubNamespace'
  | 'EventHub'
  // BI types
  | 'TableauWorkbook'
  | 'TableauDashboard'
  | 'TableauWorksheet'
  | 'PowerBIWorkspace'
  | 'PowerBIDashboard'
  | 'PowerBIReport'
  | 'PowerBIDataset'
  | 'LookerDashboard'
  | 'LookerExplore'
  | 'LookerProject'
  // Airflow types
  | 'AirflowDag'
  | 'AirflowTask'
  // Dbt types
  | 'DbtModel'
  | 'DbtSource'
  | 'DbtTest'
  | 'DbtMetric'
  // DataMesh types
  | 'DataDomain'
  | 'DataProduct'
  // API types
  | 'APISpec'
  | 'APIPath'
  | 'APIOperation'
  // Generic/Custom
  | 'CustomEntity';

// Attribute data types
export type AttributeType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'enum'
  | 'array'
  | 'user'
  | 'group';

// Relationship cardinality
export type Cardinality = 'one-to-one' | 'one-to-many' | 'many-to-many';

// Attribute definition
export interface AttributeDefinition {
  id: string;
  name: string;
  displayName: string;
  type: AttributeType;
  required: boolean;
  description?: string;
  enumValues?: string[];
  defaultValue?: string | number | boolean;
  value?: string | number | boolean; // Actual value from Atlan
}

// Relationship definition
export interface RelationshipDefinition {
  id: string;
  name: string;
  targetEntityId: string;
  cardinality: Cardinality;
  description?: string;
}

// Custom metadata set
export interface CustomMetadataSet {
  id: string;
  name: string;
  displayName: string;
  attributes: AttributeDefinition[];
}

// Entity definition - the main building block
export interface EntityDefinition {
  id: string;
  name: string;
  displayName?: string;
  type?: string; // Legacy field for backward compat
  category: AtlanAssetCategory;
  assetType?: AtlanAssetType;
  connectorName?: string;
  description?: string;
  qualifiedName?: string;
  attributes: AttributeDefinition[];
  relationships: RelationshipDefinition[];
  customMetadata?: CustomMetadataSet[];
  // Position on canvas (for React Flow)
  position: { x: number; y: number };
  // Atlan import metadata (for enrichment)
  atlanGuid?: string;
  atlanQualifiedName?: string;
  atlanTypeName?: string;
  atlanRawAttributes?: Record<string, unknown>;
  atlanRelationships?: Record<string, unknown>;
}

// Edge kind for categorizing relationship types
export type EdgeKind = 'containment' | 'lineage' | 'glossary' | 'governance' | 'manual' | 'unknown';

// Edge definition for React Flow
export interface EdgeDefinition {
  id: string;
  source: string;
  target: string;
  type?: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  relationshipId?: string;
  // Metadata for edge type/kind
  data?: {
    label?: string;
    cardinality?: string;
    kind?: EdgeKind;
    [key: string]: unknown;
  };
}

// A page/canvas within the model (like Miro boards)
export interface ModelPage {
  id: string;
  name: string;
  description?: string;
  icon?: string; // emoji or icon name
  color?: string; // accent color for the page tab
  entities: EntityDefinition[];
  edges: EdgeDefinition[];
  createdAt: string;
  updatedAt: string;
}

import type { DomainModel } from './domains';
import type { CustomMetadataDesign } from './custom-metadata';
import type { RequirementsMatrix } from './requirements';

export type { DomainModel } from './domains';
export type { CustomMetadataDesign } from './custom-metadata';
export type { RequirementsMatrix } from './requirements';

export interface ModelVersion {
  id: string;
  name: string;
  description?: string;
  timestamp: string;
  snapshot: string; // JSON string of the model state
}

// Complete model definition
export interface MetadataModel {
  id: string;
  name: string;
  description?: string;
  // Multi-page support
  pages: ModelPage[];
  activePageId: string;
  // Governance Studio
  enrichmentPlans: EnrichmentPlan[];
  domains: DomainModel[];
  customMetadata: CustomMetadataDesign[];
  requirementsMatrix: RequirementsMatrix | null;
  // Versioning
  versions: ModelVersion[];
  // Legacy single-page (for backwards compat)
  entities: EntityDefinition[];
  edges: EdgeDefinition[];
  createdAt: string;
  updatedAt: string;
}

// Category metadata for the palette
export interface CategoryInfo {
  category: AtlanAssetCategory;
  displayName: string;
  description: string;
  color: string;
  assetTypes: {
    type: AtlanAssetType;
    displayName: string;
    defaultAttributes: Omit<AttributeDefinition, 'id'>[];
  }[];
}

// Predefined category configurations
export const CATEGORY_INFO: CategoryInfo[] = [
  {
    category: 'SQL',
    displayName: 'SQL',
    description: 'Relational database assets',
    color: '#3B82F6', // blue
    assetTypes: [
      {
        type: 'Database',
        displayName: 'Database',
        defaultAttributes: [
          { name: 'qualifiedName', displayName: 'Qualified Name', type: 'string', required: true },
          { name: 'schemaCount', displayName: 'Schema Count', type: 'number', required: false },
        ],
      },
      {
        type: 'Schema',
        displayName: 'Schema',
        defaultAttributes: [
          { name: 'qualifiedName', displayName: 'Qualified Name', type: 'string', required: true },
          { name: 'databaseName', displayName: 'Database Name', type: 'string', required: true },
          { name: 'tableCount', displayName: 'Table Count', type: 'number', required: false },
        ],
      },
      {
        type: 'Table',
        displayName: 'Table',
        defaultAttributes: [
          { name: 'qualifiedName', displayName: 'Qualified Name', type: 'string', required: true },
          { name: 'schemaName', displayName: 'Schema Name', type: 'string', required: true },
          { name: 'columnCount', displayName: 'Column Count', type: 'number', required: false },
          { name: 'rowCount', displayName: 'Row Count', type: 'number', required: false },
        ],
      },
      {
        type: 'View',
        displayName: 'View',
        defaultAttributes: [
          { name: 'qualifiedName', displayName: 'Qualified Name', type: 'string', required: true },
          { name: 'schemaName', displayName: 'Schema Name', type: 'string', required: true },
          { name: 'definition', displayName: 'SQL Definition', type: 'string', required: false },
        ],
      },
      {
        type: 'Column',
        displayName: 'Column',
        defaultAttributes: [
          { name: 'qualifiedName', displayName: 'Qualified Name', type: 'string', required: true },
          { name: 'dataType', displayName: 'Data Type', type: 'string', required: true },
          { name: 'isNullable', displayName: 'Is Nullable', type: 'boolean', required: false },
          { name: 'isPrimaryKey', displayName: 'Is Primary Key', type: 'boolean', required: false },
        ],
      },
    ],
  },
  {
    category: 'ObjectStore',
    displayName: 'Object Store',
    description: 'Cloud storage assets',
    color: '#F59E0B', // amber
    assetTypes: [
      {
        type: 'S3Bucket',
        displayName: 'S3 Bucket',
        defaultAttributes: [
          { name: 'qualifiedName', displayName: 'Qualified Name', type: 'string', required: true },
          { name: 'awsRegion', displayName: 'AWS Region', type: 'string', required: false },
          { name: 'objectCount', displayName: 'Object Count', type: 'number', required: false },
        ],
      },
      {
        type: 'S3Object',
        displayName: 'S3 Object',
        defaultAttributes: [
          { name: 'qualifiedName', displayName: 'Qualified Name', type: 'string', required: true },
          { name: 's3BucketName', displayName: 'Bucket Name', type: 'string', required: true },
          { name: 's3ObjectKey', displayName: 'Object Key', type: 'string', required: true },
        ],
      },
      {
        type: 'ADLSContainer',
        displayName: 'ADLS Container',
        defaultAttributes: [
          { name: 'qualifiedName', displayName: 'Qualified Name', type: 'string', required: true },
          { name: 'adlsAccountName', displayName: 'Account Name', type: 'string', required: true },
        ],
      },
      {
        type: 'GCSBucket',
        displayName: 'GCS Bucket',
        defaultAttributes: [
          { name: 'qualifiedName', displayName: 'Qualified Name', type: 'string', required: true },
          { name: 'gcpProjectId', displayName: 'GCP Project ID', type: 'string', required: false },
        ],
      },
    ],
  },
  {
    category: 'BI',
    displayName: 'BI',
    description: 'Business intelligence assets',
    color: '#8B5CF6', // violet
    assetTypes: [
      {
        type: 'TableauWorkbook',
        displayName: 'Tableau Workbook',
        defaultAttributes: [
          { name: 'qualifiedName', displayName: 'Qualified Name', type: 'string', required: true },
          { name: 'siteQualifiedName', displayName: 'Site', type: 'string', required: false },
        ],
      },
      {
        type: 'TableauDashboard',
        displayName: 'Tableau Dashboard',
        defaultAttributes: [
          { name: 'qualifiedName', displayName: 'Qualified Name', type: 'string', required: true },
          { name: 'workbookQualifiedName', displayName: 'Workbook', type: 'string', required: true },
        ],
      },
      {
        type: 'PowerBIWorkspace',
        displayName: 'Power BI Workspace',
        defaultAttributes: [
          { name: 'qualifiedName', displayName: 'Qualified Name', type: 'string', required: true },
        ],
      },
      {
        type: 'PowerBIDashboard',
        displayName: 'Power BI Dashboard',
        defaultAttributes: [
          { name: 'qualifiedName', displayName: 'Qualified Name', type: 'string', required: true },
          { name: 'workspaceQualifiedName', displayName: 'Workspace', type: 'string', required: true },
        ],
      },
      {
        type: 'LookerDashboard',
        displayName: 'Looker Dashboard',
        defaultAttributes: [
          { name: 'qualifiedName', displayName: 'Qualified Name', type: 'string', required: true },
          { name: 'sourceUrl', displayName: 'Source URL', type: 'string', required: false },
        ],
      },
    ],
  },
  {
    category: 'Dbt',
    displayName: 'dbt',
    description: 'dbt transformation assets',
    color: '#EF4444', // red
    assetTypes: [
      {
        type: 'DbtModel',
        displayName: 'dbt Model',
        defaultAttributes: [
          { name: 'qualifiedName', displayName: 'Qualified Name', type: 'string', required: true },
          { name: 'dbtModelSqlAsset', displayName: 'SQL Asset', type: 'string', required: false },
          { name: 'dbtMaterialization', displayName: 'Materialization', type: 'enum', required: false, enumValues: ['table', 'view', 'incremental', 'ephemeral'] },
        ],
      },
      {
        type: 'DbtSource',
        displayName: 'dbt Source',
        defaultAttributes: [
          { name: 'qualifiedName', displayName: 'Qualified Name', type: 'string', required: true },
          { name: 'dbtSourceFreshness', displayName: 'Freshness', type: 'string', required: false },
        ],
      },
      {
        type: 'DbtTest',
        displayName: 'dbt Test',
        defaultAttributes: [
          { name: 'qualifiedName', displayName: 'Qualified Name', type: 'string', required: true },
          { name: 'dbtTestStatus', displayName: 'Test Status', type: 'enum', required: false, enumValues: ['pass', 'fail', 'warn', 'error'] },
        ],
      },
    ],
  },
  {
    category: 'DataMesh',
    displayName: 'Data Mesh',
    description: 'Data mesh organizational assets',
    color: '#10B981', // emerald
    assetTypes: [
      {
        type: 'DataDomain',
        displayName: 'Data Domain',
        defaultAttributes: [
          { name: 'qualifiedName', displayName: 'Qualified Name', type: 'string', required: true },
          { name: 'domainOwner', displayName: 'Domain Owner', type: 'user', required: false },
        ],
      },
      {
        type: 'DataProduct',
        displayName: 'Data Product',
        defaultAttributes: [
          { name: 'qualifiedName', displayName: 'Qualified Name', type: 'string', required: true },
          { name: 'dataDomainName', displayName: 'Data Domain', type: 'string', required: true },
          { name: 'dataProductStatus', displayName: 'Status', type: 'enum', required: false, enumValues: ['draft', 'active', 'deprecated'] },
        ],
      },
    ],
  },
  {
    category: 'Airflow',
    displayName: 'Airflow',
    description: 'Airflow orchestration assets',
    color: '#06B6D4', // cyan
    assetTypes: [
      {
        type: 'AirflowDag',
        displayName: 'Airflow DAG',
        defaultAttributes: [
          { name: 'qualifiedName', displayName: 'Qualified Name', type: 'string', required: true },
          { name: 'airflowDagSchedule', displayName: 'Schedule', type: 'string', required: false },
        ],
      },
      {
        type: 'AirflowTask',
        displayName: 'Airflow Task',
        defaultAttributes: [
          { name: 'qualifiedName', displayName: 'Qualified Name', type: 'string', required: true },
          { name: 'airflowDagQualifiedName', displayName: 'DAG', type: 'string', required: true },
          { name: 'airflowTaskOperator', displayName: 'Operator', type: 'string', required: false },
        ],
      },
    ],
  },
  {
    category: 'API',
    displayName: 'API',
    description: 'API specification assets',
    color: '#EC4899', // pink
    assetTypes: [
      {
        type: 'APISpec',
        displayName: 'API Spec',
        defaultAttributes: [
          { name: 'qualifiedName', displayName: 'Qualified Name', type: 'string', required: true },
          { name: 'apiSpecVersion', displayName: 'Version', type: 'string', required: false },
        ],
      },
      {
        type: 'APIPath',
        displayName: 'API Path',
        defaultAttributes: [
          { name: 'qualifiedName', displayName: 'Qualified Name', type: 'string', required: true },
          { name: 'apiSpecQualifiedName', displayName: 'API Spec', type: 'string', required: true },
          { name: 'apiPathUrl', displayName: 'Path URL', type: 'string', required: true },
        ],
      },
    ],
  },
  {
    category: 'Custom',
    displayName: 'Custom',
    description: 'User-defined custom assets',
    color: '#6B7280', // gray
    assetTypes: [
      {
        type: 'CustomEntity',
        displayName: 'Custom Entity',
        defaultAttributes: [
          { name: 'qualifiedName', displayName: 'Qualified Name', type: 'string', required: true },
        ],
      },
    ],
  },
];

// Helper to get category info by category type
export function getCategoryInfo(category: AtlanAssetCategory): CategoryInfo | undefined {
  return CATEGORY_INFO.find(c => c.category === category);
}

// Helper to get asset type info
export function getAssetTypeInfo(category: AtlanAssetCategory, assetType: AtlanAssetType) {
  const categoryInfo = getCategoryInfo(category);
  return categoryInfo?.assetTypes.find(a => a.type === assetType);
}

// Re-export requirements types for convenience
export type { EnrichmentPlan, PlanVersion } from './enrichment-plan';
