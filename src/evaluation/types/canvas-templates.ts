/**
 * Canvas Template Types
 *
 * Type definitions for visual canvas templates that pre-populate
 * the React Flow designer with entities and relationships.
 */

// ============================================
// TEMPLATE CATEGORY TYPES
// ============================================

export type TemplateCategory =
  | 'discovery'
  | 'governance'
  | 'lineage'
  | 'datamesh'
  | 'ai';

export const TEMPLATE_CATEGORY_META: Record<TemplateCategory, {
  name: string;
  description: string;
  color: string;
}> = {
  discovery: {
    name: 'Discovery',
    description: 'Find and explore data assets',
    color: 'blue',
  },
  governance: {
    name: 'Governance',
    description: 'Manage data quality and compliance',
    color: 'amber',
  },
  lineage: {
    name: 'Lineage',
    description: 'Trace data flow and dependencies',
    color: 'purple',
  },
  datamesh: {
    name: 'Data Mesh',
    description: 'Domain-driven data architecture',
    color: 'teal',
  },
  ai: {
    name: 'AI/ML',
    description: 'AI and machine learning use cases',
    color: 'indigo',
  },
};

// ============================================
// ASSET CATEGORY TYPES
// ============================================

export type AssetCategory =
  | 'SQL'
  | 'BI'
  | 'Glossary'
  | 'DataMesh'
  | 'Orchestration'
  | 'dbt'
  | 'Storage'
  | 'Governance'
  | 'Core'
  | 'AI'
  | 'Other';

export const ASSET_CATEGORIES: Record<AssetCategory, string[]> = {
  SQL: [
    'Database',
    'Schema',
    'Table',
    'View',
    'MaterialisedView',
    'Column',
    'TablePartition',
    'Procedure',
    'Function',
    'SnowflakeDynamicTable',
    'SnowflakePipe',
    'SnowflakeStream',
    'SnowflakeTag',
  ],
  BI: [
    'TableauSite',
    'TableauProject',
    'TableauWorkbook',
    'TableauDashboard',
    'TableauDatasource',
    'TableauCalculatedField',
    'PowerBIWorkspace',
    'PowerBIReport',
    'PowerBIDashboard',
    'PowerBIDataset',
    'PowerBIMeasure',
    'LookerProject',
    'LookerModel',
    'LookerExplore',
    'LookerDashboard',
    'MetabaseDashboard',
    'MetabaseQuestion',
  ],
  Glossary: [
    'AtlasGlossary',
    'AtlasGlossaryTerm',
    'AtlasGlossaryCategory',
  ],
  DataMesh: [
    'DataDomain',
    'DataProduct',
    'DataContract',
  ],
  Orchestration: [
    'AirflowDag',
    'AirflowTask',
    'AdfPipeline',
    'AdfActivity',
    'AdfDataflow',
    'AdfDataset',
    'MatillionGroup',
    'MatillionProject',
    'MatillionJob',
    'FivetranConnector',
  ],
  dbt: [
    'DbtModel',
    'DbtModelColumn',
    'DbtSource',
    'DbtTest',
    'DbtMetric',
    'DbtTag',
    'DbtProcess',
    'DbtColumnProcess',
  ],
  Storage: [
    'S3Bucket',
    'S3Object',
    'ADLSAccount',
    'ADLSContainer',
    'ADLSObject',
    'GCSBucket',
    'GCSObject',
  ],
  Governance: [
    'Tag',
    'Persona',
    'Purpose',
    'AuthPolicy',
    'BusinessPolicy',
    'BusinessPolicyLog',
  ],
  Core: [
    'Connection',
    'Process',
    'ColumnProcess',
    'BIProcess',
    'SparkJob',
  ],
  AI: [
    'AIModel',
    'AIApplication',
  ],
  Other: [],
};

// All entity types as a flat array
export const ALL_ENTITY_TYPES = Object.values(ASSET_CATEGORIES).flat();

// Get category for an entity type
export function getCategoryForType(entityType: string): AssetCategory {
  for (const [category, types] of Object.entries(ASSET_CATEGORIES)) {
    if (types.includes(entityType)) {
      return category as AssetCategory;
    }
  }
  return 'Other';
}

// Category colors for visual distinction
export const CATEGORY_COLORS: Record<AssetCategory, {
  bg: string;
  border: string;
  text: string;
  fill: string;
}> = {
  SQL: { bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-700', fill: '#3b82f6' },
  BI: { bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-700', fill: '#8b5cf6' },
  Glossary: { bg: 'bg-green-100', border: 'border-green-400', text: 'text-green-700', fill: '#22c55e' },
  DataMesh: { bg: 'bg-teal-100', border: 'border-teal-400', text: 'text-teal-700', fill: '#14b8a6' },
  Orchestration: { bg: 'bg-orange-100', border: 'border-orange-400', text: 'text-orange-700', fill: '#f97316' },
  dbt: { bg: 'bg-rose-100', border: 'border-rose-400', text: 'text-rose-700', fill: '#f43f5e' },
  Storage: { bg: 'bg-cyan-100', border: 'border-cyan-400', text: 'text-cyan-700', fill: '#06b6d4' },
  Governance: { bg: 'bg-amber-100', border: 'border-amber-400', text: 'text-amber-700', fill: '#f59e0b' },
  Core: { bg: 'bg-gray-100', border: 'border-gray-400', text: 'text-gray-700', fill: '#6b7280' },
  AI: { bg: 'bg-indigo-100', border: 'border-indigo-400', text: 'text-indigo-700', fill: '#6366f1' },
  Other: { bg: 'bg-gray-100', border: 'border-gray-400', text: 'text-gray-700', fill: '#6b7280' },
};

// ============================================
// TEMPLATE ENTITY TYPES
// ============================================

export interface TemplateAttribute {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'user[]' | 'group[]' | 'date';
  required: boolean;
  description?: string;
  enumValues?: string[];
}

export interface TemplateEntity {
  type: string;
  category: AssetCategory;
  suggestedName: string;
  position: { x: number; y: number };
  attributes: TemplateAttribute[];
}

export interface TemplateRelationship {
  sourceType: string;
  targetType: string;
  cardinality: '1:1' | '1:N' | 'N:1' | 'N:N';
  label: string;
}

export interface CustomMetadataAttribute {
  name: string;
  displayName: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'date';
  enumValues?: string[];
  required?: boolean;
}

/**
 * Custom metadata set for canvas templates.
 * Note: This differs from the main CustomMetadataSet in types/index.ts
 * which is used for model entities. This type is template-specific.
 */
export interface TemplateCustomMetadataSet {
  name: string;
  displayName: string;
  attributes: CustomMetadataAttribute[];
}

// ============================================
// CANVAS TEMPLATE TYPE
// ============================================

export interface CanvasTemplate {
  id: string;
  name: string;
  description: string;
  useCase: string;
  icon: string;
  category: TemplateCategory;
  entities: TemplateEntity[];
  relationships: TemplateRelationship[];
  customMetadata?: TemplateCustomMetadataSet[];
}

// ============================================
// TEMPLATE BADGE HELPER
// ============================================

export function getTemplateCategoryBadgeClasses(category: TemplateCategory): string {
  const colorMap: Record<TemplateCategory, string> = {
    discovery: 'bg-blue-100 text-blue-700',
    governance: 'bg-amber-100 text-amber-700',
    lineage: 'bg-purple-100 text-purple-700',
    datamesh: 'bg-teal-100 text-teal-700',
    ai: 'bg-indigo-100 text-indigo-700',
  };
  return colorMap[category] || 'bg-gray-100 text-gray-700';
}
