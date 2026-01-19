/**
 * Custom Fields Asset Targeting Module
 *
 * Maps custom field definitions to specific asset types (Tables, Columns, Databases, etc.)
 * with asset-specific enrichment strategies, validation rules, and inheritance patterns.
 */

// ============================================================================
// Asset Type Definitions
// ============================================================================

export type AssetType = 'Table' | 'Column' | 'Database' | 'Schema' | 'README' | 'Asset' | 'Process';

export interface ValidationRule {
  rule: string;
  errorMessage: string;
  applicableValues?: string[];
}

export interface AssetEnrichmentStrategy {
  automationLevel: 'manual' | 'semi-automated' | 'fully-automated';
  dataSource: string;
  frequency?: 'on-demand' | 'daily' | 'weekly' | 'on-change';
  technicalPrerequisites?: string[];
}

export interface AssetLevelField {
  fieldId: string;
  fieldName: string;
  applicableAssets: AssetType[];
  isInheritable: boolean;
  inheritancePattern?: 'cascading' | 'blocking' | 'override';
  assetSpecificValidation?: Partial<Record<AssetType, ValidationRule>>;
  enrichmentStrategy: AssetEnrichmentStrategy;
  priority: 'critical' | 'high' | 'medium' | 'low';
  useCase?: string;
}

export interface PropagationRule {
  sourceAsset: AssetType;
  targetAsset: AssetType;
  fieldId: string;
  propagationType: 'copy' | 'aggregate' | 'filter' | 'transform' | 'override';
  transformation?: (value: unknown) => unknown;
}

export interface AssetFieldMatrix {
  asset: AssetType;
  fields: AssetLevelField[];
  totalFields: number;
  criticalFields: AssetLevelField[];
  automationCoverage: number;
  inheritableFields: AssetLevelField[];
}

export interface HierarchicalFieldMapping {
  database: AssetLevelField[];
  schema: AssetLevelField[];
  table: AssetLevelField[];
  column: AssetLevelField[];
  propagationRules: PropagationRule[];
}

// ============================================================================
// Asset-Level Field Definitions
// ============================================================================

export const ASSET_LEVEL_FIELDS: AssetLevelField[] = [
  {
    fieldId: 'lifecycle_status',
    fieldName: 'Lifecycle Status',
    applicableAssets: ['Database', 'Schema', 'Table', 'Column'],
    isInheritable: true,
    inheritancePattern: 'cascading',
    enrichmentStrategy: {
      automationLevel: 'semi-automated',
      dataSource: 'metadata_events',
      frequency: 'on-change',
      technicalPrerequisites: ['event-streaming', 'metadata-store'],
    },
    priority: 'critical',
    useCase: 'governance',
  },

  {
    fieldId: 'pii_classification',
    fieldName: 'PII Classification',
    applicableAssets: ['Column', 'Table'],
    isInheritable: true,
    inheritancePattern: 'blocking',
    enrichmentStrategy: {
      automationLevel: 'fully-automated',
      dataSource: 'data_classification_scan',
      frequency: 'weekly',
      technicalPrerequisites: ['column-profiling', 'classification-engine'],
    },
    priority: 'critical',
    useCase: 'compliance',
  },

  {
    fieldId: 'dq_framework',
    fieldName: 'Data Quality Framework',
    applicableAssets: ['Table', 'Column', 'Database'],
    isInheritable: true,
    inheritancePattern: 'cascading',
    enrichmentStrategy: {
      automationLevel: 'semi-automated',
      dataSource: 'dq_rules_engine',
      frequency: 'daily',
      technicalPrerequisites: ['dq-engine', 'rules-catalog'],
    },
    priority: 'high',
    useCase: 'data-quality',
  },

  {
    fieldId: 'refresh_frequency',
    fieldName: 'Refresh Frequency',
    applicableAssets: ['Table', 'Database', 'Column'],
    isInheritable: true,
    inheritancePattern: 'override',
    enrichmentStrategy: {
      automationLevel: 'fully-automated',
      dataSource: 'pipeline_scheduler',
      frequency: 'on-change',
      technicalPrerequisites: ['pipeline-metadata', 'scheduler-api'],
    },
    priority: 'high',
    useCase: 'operations',
  },

  {
    fieldId: 'retention_days',
    fieldName: 'Retention Days',
    applicableAssets: ['Table', 'Column', 'Database'],
    isInheritable: true,
    inheritancePattern: 'blocking',
    enrichmentStrategy: {
      automationLevel: 'manual',
      dataSource: 'compliance_policy',
      technicalPrerequisites: ['policy-engine'],
    },
    priority: 'critical',
    useCase: 'compliance',
  },

  {
    fieldId: 'criticality_tier',
    fieldName: 'Criticality Tier',
    applicableAssets: ['Database', 'Schema', 'Table', 'Column'],
    isInheritable: true,
    inheritancePattern: 'cascading',
    enrichmentStrategy: {
      automationLevel: 'semi-automated',
      dataSource: 'impact_analysis',
      frequency: 'weekly',
      technicalPrerequisites: ['lineage-engine', 'impact-calculator'],
    },
    priority: 'high',
    useCase: 'governance',
  },

  {
    fieldId: 'api_exposure',
    fieldName: 'API Exposure',
    applicableAssets: ['Table', 'Schema', 'Database'],
    isInheritable: false,
    enrichmentStrategy: {
      automationLevel: 'semi-automated',
      dataSource: 'api_registry',
      frequency: 'daily',
      technicalPrerequisites: ['api-catalog', 'governance-engine'],
    },
    priority: 'high',
    useCase: 'api-governance',
  },

  {
    fieldId: 'ml_ready',
    fieldName: 'ML Readiness Score',
    applicableAssets: ['Table', 'Column'],
    isInheritable: false,
    enrichmentStrategy: {
      automationLevel: 'fully-automated',
      dataSource: 'ml_quality_scanner',
      frequency: 'weekly',
      technicalPrerequisites: ['profiling-engine', 'quality-rules'],
    },
    priority: 'medium',
    useCase: 'ml-governance',
  },

  {
    fieldId: 'department',
    fieldName: 'Department',
    applicableAssets: ['Database', 'Table', 'Schema'],
    isInheritable: true,
    inheritancePattern: 'cascading',
    enrichmentStrategy: {
      automationLevel: 'manual',
      dataSource: 'org_hierarchy',
      technicalPrerequisites: ['org-sync'],
    },
    priority: 'high',
    useCase: 'governance',
  },

  {
    fieldId: 'business_unit',
    fieldName: 'Business Unit',
    applicableAssets: ['Database', 'Table', 'Schema'],
    isInheritable: true,
    inheritancePattern: 'cascading',
    enrichmentStrategy: {
      automationLevel: 'manual',
      dataSource: 'org_hierarchy',
      technicalPrerequisites: ['org-sync'],
    },
    priority: 'high',
    useCase: 'governance',
  },

  {
    fieldId: 'cost_center',
    fieldName: 'Cost Center',
    applicableAssets: ['Database', 'Table'],
    isInheritable: true,
    inheritancePattern: 'cascading',
    enrichmentStrategy: {
      automationLevel: 'semi-automated',
      dataSource: 'financial_system',
      frequency: 'daily',
      technicalPrerequisites: ['financial-sync', 'mapping-engine'],
    },
    priority: 'medium',
    useCase: 'financial',
  },

  {
    fieldId: 'sla_response_time',
    fieldName: 'SLA Response Time',
    applicableAssets: ['Table', 'Database'],
    isInheritable: true,
    inheritancePattern: 'cascading',
    enrichmentStrategy: {
      automationLevel: 'semi-automated',
      dataSource: 'sla_contracts',
      technicalPrerequisites: ['sla-engine'],
    },
    priority: 'high',
    useCase: 'sla-management',
  },

  {
    fieldId: 'explainability_marker',
    fieldName: 'Explainability Marker',
    applicableAssets: ['Column', 'Table'],
    isInheritable: false,
    enrichmentStrategy: {
      automationLevel: 'manual',
      dataSource: 'ml_governance',
      technicalPrerequisites: ['ml-policy-engine'],
    },
    priority: 'medium',
    useCase: 'ml-governance',
  },

  {
    fieldId: 'readme_completeness',
    fieldName: 'README Completeness Score',
    applicableAssets: ['README', 'Table', 'Column'],
    isInheritable: false,
    enrichmentStrategy: {
      automationLevel: 'fully-automated',
      dataSource: 'text_analysis',
      frequency: 'on-change',
      technicalPrerequisites: ['nlp-engine', 'content-analyzer'],
    },
    priority: 'medium',
    useCase: 'documentation',
  },

  {
    fieldId: 'schema_validation_status',
    fieldName: 'Schema Validation Status',
    applicableAssets: ['Column', 'Table'],
    isInheritable: false,
    enrichmentStrategy: {
      automationLevel: 'fully-automated',
      dataSource: 'schema_validator',
      frequency: 'daily',
      technicalPrerequisites: ['schema-registry'],
    },
    priority: 'medium',
    useCase: 'data-quality',
  },
];

// ============================================================================
// Asset Field Matrix Generation
// ============================================================================

export function generateAssetFieldMatrix(assetType: AssetType): AssetFieldMatrix {
  const applicableFields = ASSET_LEVEL_FIELDS.filter((f) =>
    f.applicableAssets.includes(assetType)
  );

  const criticalFields = applicableFields.filter((f) => f.priority === 'critical');
  const automatedFields = applicableFields.filter(
    (f) => f.enrichmentStrategy.automationLevel !== 'manual'
  );
  const inheritableFields = applicableFields.filter((f) => f.isInheritable);

  return {
    asset: assetType,
    fields: applicableFields,
    totalFields: applicableFields.length,
    criticalFields,
    automationCoverage: applicableFields.length > 0 
      ? Math.round((automatedFields.length / applicableFields.length) * 100)
      : 0,
    inheritableFields,
  };
}

/**
 * Generate full hierarchical mapping with propagation rules
 */
export function generateHierarchicalFieldMapping(): HierarchicalFieldMapping {
  const databaseFields = generateAssetFieldMatrix('Database').fields;
  const schemaFields = generateAssetFieldMatrix('Schema').fields;
  const tableFields = generateAssetFieldMatrix('Table').fields;
  const columnFields = generateAssetFieldMatrix('Column').fields;

  const propagationRules: PropagationRule[] = [
    { sourceAsset: 'Database', targetAsset: 'Schema', fieldId: 'lifecycle_status', propagationType: 'copy' },
    { sourceAsset: 'Schema', targetAsset: 'Table', fieldId: 'lifecycle_status', propagationType: 'copy' },
    { sourceAsset: 'Table', targetAsset: 'Column', fieldId: 'lifecycle_status', propagationType: 'copy' },
    { sourceAsset: 'Column', targetAsset: 'Table', fieldId: 'pii_classification', propagationType: 'aggregate' },
    { sourceAsset: 'Table', targetAsset: 'Column', fieldId: 'retention_days', propagationType: 'filter' },
    { sourceAsset: 'Database', targetAsset: 'Table', fieldId: 'criticality_tier', propagationType: 'copy' },
    { sourceAsset: 'Table', targetAsset: 'Column', fieldId: 'criticality_tier', propagationType: 'copy' },
    { sourceAsset: 'Table', targetAsset: 'Column', fieldId: 'refresh_frequency', propagationType: 'override' },
    { sourceAsset: 'Database', targetAsset: 'Table', fieldId: 'department', propagationType: 'copy' },
    { sourceAsset: 'Database', targetAsset: 'Table', fieldId: 'cost_center', propagationType: 'copy' },
    { sourceAsset: 'Database', targetAsset: 'Table', fieldId: 'dq_framework', propagationType: 'copy' },
    { sourceAsset: 'Table', targetAsset: 'Column', fieldId: 'dq_framework', propagationType: 'copy' },
  ];

  return { database: databaseFields, schema: schemaFields, table: tableFields, column: columnFields, propagationRules };
}

/**
 * Get fields applicable to multiple asset types
 */
export function getFieldsByApplicability(assetTypes: AssetType[]): Record<string, AssetLevelField> {
  const fieldMap: Record<string, AssetLevelField> = {};

  ASSET_LEVEL_FIELDS.forEach((field) => {
    const applicableToAll = assetTypes.every((at) => field.applicableAssets.includes(at));
    if (applicableToAll) {
      fieldMap[field.fieldId] = field;
    }
  });

  return fieldMap;
}

/**
 * Get critical fields for asset type
 */
export function getCriticalFieldsForAsset(assetType: AssetType): AssetLevelField[] {
  return ASSET_LEVEL_FIELDS.filter(
    (f) => f.applicableAssets.includes(assetType) && f.priority === 'critical'
  );
}

/**
 * Generate asset enrichment summary
 */
export interface AssetEnrichmentSummary {
  asset: AssetType;
  totalFields: number;
  automationReadiness: {
    fullyAutomated: number;
    semiAutomated: number;
    manual: number;
  };
  criticalFieldsCount: number;
  inheritableFieldsCount: number;
  technicalPrerequisites: Set<string>;
  enrichmentRoadmap: Array<{
    phase: string;
    fieldsToEnrich: AssetLevelField[];
    estimatedEffort: string;
    prerequisites: string[];
  }>;
}

export function generateAssetEnrichmentSummary(assetType: AssetType): AssetEnrichmentSummary {
  const matrix = generateAssetFieldMatrix(assetType);
  const allPrereqs = new Set<string>();

  matrix.fields.forEach((f) => {
    f.enrichmentStrategy.technicalPrerequisites?.forEach((p) => allPrereqs.add(p));
  });

  const automationReadiness = {
    fullyAutomated: matrix.fields.filter((f) => f.enrichmentStrategy.automationLevel === 'fully-automated').length,
    semiAutomated: matrix.fields.filter((f) => f.enrichmentStrategy.automationLevel === 'semi-automated').length,
    manual: matrix.fields.filter((f) => f.enrichmentStrategy.automationLevel === 'manual').length,
  };

  const enrichmentRoadmap = [
    {
      phase: 'Phase 1: Automated Enrichment',
      fieldsToEnrich: matrix.fields.filter((f) => f.enrichmentStrategy.automationLevel === 'fully-automated'),
      estimatedEffort: '2-4 weeks',
      prerequisites: Array.from(allPrereqs),
    },
    {
      phase: 'Phase 2: Semi-Automated Workflows',
      fieldsToEnrich: matrix.fields.filter((f) => f.enrichmentStrategy.automationLevel === 'semi-automated'),
      estimatedEffort: '4-8 weeks',
      prerequisites: ['process-definition', 'workflow-engine'],
    },
    {
      phase: 'Phase 3: Manual & Exception Handling',
      fieldsToEnrich: matrix.fields.filter((f) => f.enrichmentStrategy.automationLevel === 'manual'),
      estimatedEffort: 'Ongoing',
      prerequisites: ['governance-team', 'policy-engine'],
    },
  ];

  return {
    asset: assetType,
    totalFields: matrix.totalFields,
    automationReadiness,
    criticalFieldsCount: matrix.criticalFields.length,
    inheritableFieldsCount: matrix.inheritableFields.length,
    technicalPrerequisites: allPrereqs,
    enrichmentRoadmap,
  };
}
