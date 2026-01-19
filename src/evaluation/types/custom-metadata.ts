/**
 * Custom Metadata Schema Types
 *
 * Types for designing custom metadata attributes,
 * including templates for common use cases.
 */

import type { AssetType } from './requirements';

// ============================================
// CUSTOM METADATA TYPES
// ============================================

export type AttributeType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'enum'
  | 'multiSelect'
  | 'user'
  | 'group'
  | 'url'
  | 'sql';

export interface CustomMetadataDesign {
  id: string;
  name: string;
  displayName: string;
  description: string;
  appliesTo: AssetType[];
  attributes: CustomAttribute[];
  isRequired: boolean;
  domains: string[];
  icon?: string;
  color?: string;
}

export interface CustomAttribute {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  type: AttributeType;
  enumValues?: string[];
  isRequired: boolean;
  isMultiValued: boolean;
  defaultValue?: unknown;
  helpText?: string;
  validationRule?: string;
  validationMessage?: string;
  order: number;
}

// ============================================
// CUSTOM METADATA TEMPLATES
// ============================================

export interface CustomMetadataTemplate {
  id: string;
  name: string;
  description: string;
  useCase: string;
  schema: Partial<CustomMetadataDesign>;
}

export const CUSTOM_METADATA_TEMPLATES: CustomMetadataTemplate[] = [
  {
    id: 'data-product',
    name: 'Data Product',
    description: 'Metadata for data products in a data mesh architecture',
    useCase: 'Track SLAs, consumers, costs, and freshness for data products',
    schema: {
      name: 'DataProductInfo',
      displayName: 'Data Product Info',
      description: 'Metadata for data product management',
      appliesTo: ['Table', 'View', 'Dashboard', 'Dataset'],
      isRequired: false,
      attributes: [
        {
          id: 'sla',
          name: 'sla',
          displayName: 'SLA',
          description: 'Service Level Agreement for data freshness',
          type: 'enum',
          enumValues: ['Real-time', 'Hourly', 'Daily', 'Weekly'],
          isRequired: true,
          isMultiValued: false,
          order: 1,
        },
        {
          id: 'refresh-frequency',
          name: 'refresh_frequency',
          displayName: 'Refresh Frequency',
          description: 'How often the data is updated',
          type: 'enum',
          enumValues: ['Streaming', 'Every 15 min', 'Hourly', 'Daily', 'Weekly', 'Monthly'],
          isRequired: true,
          isMultiValued: false,
          order: 2,
        },
        {
          id: 'cost-center',
          name: 'cost_center',
          displayName: 'Cost Center',
          description: 'Budget allocation for this data product',
          type: 'string',
          isRequired: false,
          isMultiValued: false,
          order: 3,
        },
        {
          id: 'consumers',
          name: 'consumers',
          displayName: 'Consumers',
          description: 'Teams or users consuming this data product',
          type: 'group',
          isRequired: false,
          isMultiValued: true,
          order: 4,
        },
        {
          id: 'data-contract-url',
          name: 'data_contract_url',
          displayName: 'Data Contract URL',
          description: 'Link to the data contract document',
          type: 'url',
          isRequired: false,
          isMultiValued: false,
          order: 5,
        },
      ],
    },
  },
  {
    id: 'compliance',
    name: 'Compliance',
    description: 'Metadata for regulatory compliance tracking',
    useCase: 'GDPR, CCPA, HIPAA, SOX compliance requirements',
    schema: {
      name: 'ComplianceInfo',
      displayName: 'Compliance Info',
      description: 'Regulatory compliance metadata',
      appliesTo: ['Table', 'Column', 'Database'],
      isRequired: false,
      attributes: [
        {
          id: 'retention-period',
          name: 'retention_period',
          displayName: 'Retention Period',
          description: 'How long data must be retained',
          type: 'enum',
          enumValues: ['30 days', '90 days', '1 year', '3 years', '7 years', 'Indefinite'],
          isRequired: true,
          isMultiValued: false,
          order: 1,
        },
        {
          id: 'legal-hold',
          name: 'legal_hold',
          displayName: 'Legal Hold',
          description: 'Is this data under legal hold?',
          type: 'boolean',
          isRequired: false,
          isMultiValued: false,
          defaultValue: false,
          order: 2,
        },
        {
          id: 'data-source-country',
          name: 'data_source_country',
          displayName: 'Data Source Country',
          description: 'Country where data originates',
          type: 'enum',
          enumValues: ['USA', 'UK', 'EU', 'Canada', 'Australia', 'Other'],
          isRequired: false,
          isMultiValued: true,
          order: 3,
        },
        {
          id: 'regulations',
          name: 'regulations',
          displayName: 'Applicable Regulations',
          description: 'Which regulations apply to this data',
          type: 'multiSelect',
          enumValues: ['GDPR', 'CCPA', 'HIPAA', 'SOX', 'PCI-DSS', 'FERPA'],
          isRequired: false,
          isMultiValued: true,
          order: 4,
        },
        {
          id: 'last-audit-date',
          name: 'last_audit_date',
          displayName: 'Last Audit Date',
          description: 'Date of most recent compliance audit',
          type: 'date',
          isRequired: false,
          isMultiValued: false,
          order: 5,
        },
      ],
    },
  },
  {
    id: 'data-quality',
    name: 'Data Quality',
    description: 'Metadata for data quality tracking and SLAs',
    useCase: 'Track freshness, completeness, and quality metrics',
    schema: {
      name: 'DataQualityInfo',
      displayName: 'Data Quality Info',
      description: 'Data quality metrics and SLAs',
      appliesTo: ['Table', 'View', 'Column'],
      isRequired: false,
      attributes: [
        {
          id: 'freshness-sla',
          name: 'freshness_sla',
          displayName: 'Freshness SLA',
          description: 'Maximum acceptable data staleness',
          type: 'enum',
          enumValues: ['< 1 hour', '< 4 hours', '< 24 hours', '< 7 days'],
          isRequired: false,
          isMultiValued: false,
          order: 1,
        },
        {
          id: 'completeness-threshold',
          name: 'completeness_threshold',
          displayName: 'Completeness Threshold',
          description: 'Minimum acceptable % of non-null values',
          type: 'number',
          isRequired: false,
          isMultiValued: false,
          defaultValue: 95,
          helpText: 'Enter a percentage (0-100)',
          order: 2,
        },
        {
          id: 'dq-owner',
          name: 'dq_owner',
          displayName: 'DQ Owner',
          description: 'Person responsible for data quality',
          type: 'user',
          isRequired: false,
          isMultiValued: false,
          order: 3,
        },
        {
          id: 'dq-rules',
          name: 'dq_rules',
          displayName: 'DQ Rules',
          description: 'Link to data quality rules documentation',
          type: 'url',
          isRequired: false,
          isMultiValued: false,
          order: 4,
        },
        {
          id: 'known-issues',
          name: 'known_issues',
          displayName: 'Known Issues',
          description: 'Document any known data quality issues',
          type: 'string',
          isRequired: false,
          isMultiValued: false,
          order: 5,
        },
      ],
    },
  },
  {
    id: 'operational',
    name: 'Operational',
    description: 'Metadata for operational context and incident response',
    useCase: 'Runbooks, on-call teams, and incident tracking',
    schema: {
      name: 'OperationalInfo',
      displayName: 'Operational Info',
      description: 'Operational context for incident response',
      appliesTo: ['Table', 'Pipeline', 'Dashboard'],
      isRequired: false,
      attributes: [
        {
          id: 'on-call-team',
          name: 'on_call_team',
          displayName: 'On-Call Team',
          description: 'Team responsible for incidents',
          type: 'group',
          isRequired: false,
          isMultiValued: false,
          order: 1,
        },
        {
          id: 'runbook-url',
          name: 'runbook_url',
          displayName: 'Runbook URL',
          description: 'Link to operational runbook',
          type: 'url',
          isRequired: false,
          isMultiValued: false,
          order: 2,
        },
        {
          id: 'slack-channel',
          name: 'slack_channel',
          displayName: 'Slack Channel',
          description: 'Channel for alerts and discussion',
          type: 'string',
          isRequired: false,
          isMultiValued: false,
          helpText: 'e.g., #data-alerts',
          order: 3,
        },
        {
          id: 'last-incident-date',
          name: 'last_incident_date',
          displayName: 'Last Incident Date',
          description: 'Date of most recent incident',
          type: 'date',
          isRequired: false,
          isMultiValued: false,
          order: 4,
        },
        {
          id: 'criticality',
          name: 'criticality',
          displayName: 'Criticality',
          description: 'Business criticality level',
          type: 'enum',
          enumValues: ['Critical', 'High', 'Medium', 'Low'],
          isRequired: false,
          isMultiValued: false,
          order: 5,
        },
      ],
    },
  },
  {
    id: 'business-context',
    name: 'Business Context',
    description: 'Metadata for business context and lineage gaps',
    useCase: 'Fill gaps where automated lineage cannot reach',
    schema: {
      name: 'BusinessContext',
      displayName: 'Business Context',
      description: 'Business context for understanding data',
      appliesTo: ['Table', 'View', 'Dashboard', 'Report'],
      isRequired: false,
      attributes: [
        {
          id: 'business-process',
          name: 'business_process',
          displayName: 'Business Process',
          description: 'Which business process does this support?',
          type: 'enum',
          enumValues: ['Order to Cash', 'Procure to Pay', 'Record to Report', 'Hire to Retire', 'Lead to Cash', 'Other'],
          isRequired: false,
          isMultiValued: true,
          order: 1,
        },
        {
          id: 'upstream-system',
          name: 'upstream_system',
          displayName: 'Upstream System',
          description: 'Source system(s) for this data',
          type: 'string',
          isRequired: false,
          isMultiValued: true,
          helpText: 'e.g., Salesforce, SAP, Workday',
          order: 2,
        },
        {
          id: 'downstream-reports',
          name: 'downstream_reports',
          displayName: 'Downstream Reports',
          description: 'Reports that depend on this data',
          type: 'string',
          isRequired: false,
          isMultiValued: true,
          order: 3,
        },
        {
          id: 'business-owner',
          name: 'business_owner',
          displayName: 'Business Owner',
          description: 'Business stakeholder for this data',
          type: 'user',
          isRequired: false,
          isMultiValued: false,
          order: 4,
        },
      ],
    },
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getCustomMetadataTemplateById(id: string): CustomMetadataTemplate | undefined {
  return CUSTOM_METADATA_TEMPLATES.find(t => t.id === id);
}

export function createCustomMetadataFromTemplate(
  template: CustomMetadataTemplate,
  id: string
): CustomMetadataDesign {
  return {
    id,
    name: template.schema.name || 'CustomMetadata',
    displayName: template.schema.displayName || template.name,
    description: template.schema.description || '',
    appliesTo: template.schema.appliesTo || [],
    attributes: (template.schema.attributes || []).map((attr, index) => ({
      ...attr,
      id: attr.id || `attr-${index}`,
      order: attr.order || index,
    })),
    isRequired: template.schema.isRequired || false,
    domains: template.schema.domains || [],
  };
}

export function validateAttributeName(name: string): { valid: boolean; error?: string } {
  if (!name) {
    return { valid: false, error: 'Name is required' };
  }
  if (!/^[a-z][a-z0-9_]*$/.test(name)) {
    return { valid: false, error: 'Name must start with lowercase letter and contain only lowercase letters, numbers, and underscores' };
  }
  if (name.length > 50) {
    return { valid: false, error: 'Name must be 50 characters or less' };
  }
  return { valid: true };
}
