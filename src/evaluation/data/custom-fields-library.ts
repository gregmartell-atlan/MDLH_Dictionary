/**
 * Custom Metadata Fields Library
 * 
 * Defines organization-specific custom fields with enumerations, automation rules,
 * and recommendations by use case and vertical.
 */

import type { UseCase } from '../types/metadata-assistant';

// ============================================
// CUSTOM FIELD TYPES
// ============================================

export type CustomFieldType = 'enum' | 'text' | 'date' | 'number' | 'boolean';

export type AutomationStrategy = 'manual' | 'automation' | 'hybrid';

export interface CustomFieldEnumOption {
  value: string;
  label: string;
  color?: string;
  description?: string;
}

export interface CustomFieldDefinition {
  id: string;
  displayName: string;
  description: string;
  fieldType: CustomFieldType;
  options?: CustomFieldEnumOption[]; // For enum fields
  defaultValue?: string;
  automationStrategy: AutomationStrategy;
  automationRules?: {
    trigger: string;
    action: string;
  }[];
  purpose: string;
  whenNeeded: string;
  examples: string[];
  relatedUseCases: UseCase[];
  relatedVerticals?: string[];
  bulkAssignable: boolean;
  effortMinutes: number;
}

// ============================================
// OPERATIONAL CUSTOM FIELDS
// ============================================

export const CUSTOM_FIELDS_LIBRARY: CustomFieldDefinition[] = [
  {
    id: 'lifecycle_status',
    displayName: 'Data Lifecycle Status',
    description: 'Stage of data in its lifecycle (Bronze/Silver/Gold or Deprecated)',
    fieldType: 'enum',
    options: [
      {
        value: 'bronze',
        label: 'Bronze',
        color: '#8B7355',
        description: 'Raw, unvalidated data from source systems',
      },
      {
        value: 'silver',
        label: 'Silver',
        color: '#C0C0C0',
        description: 'Validated, cleansed data ready for analytics',
      },
      {
        value: 'gold',
        label: 'Gold',
        color: '#FFD700',
        description: 'Certified, trusted data for business decisions',
      },
      {
        value: 'deprecated',
        label: 'Deprecated',
        color: '#DC2626',
        description: 'Legacy data no longer in use, marked for retirement',
      },
    ],
    automationStrategy: 'hybrid',
    automationRules: [
      {
        trigger: 'DQ score >= 95%',
        action: 'Auto-promote to Silver',
      },
      {
        trigger: 'No consumers for 90 days',
        action: 'Suggest Deprecated',
      },
    ],
    purpose: 'Track data maturity and readiness for consumption',
    whenNeeded: 'Data mesh, multi-tier architectures, quality gating',
    examples: [
      'raw_customer_data (Bronze) → validated_customers (Silver) → customer_360 (Gold)',
      'legacy_product_info (Deprecated) → product_master (Gold)',
    ],
    relatedUseCases: ['Lifecycle Management', 'Data Products', 'Cost Optimization'],
    relatedVerticals: ['Manufacturing/HVAC', 'Technology'],
    bulkAssignable: true,
    effortMinutes: 1,
  },
  {
    id: 'department',
    displayName: 'Department',
    description: 'Owning department or business unit',
    fieldType: 'enum',
    options: [
      {
        value: 'finance',
        label: 'Finance',
        color: '#3B82F6',
        description: 'Finance, accounting, FP&A',
      },
      {
        value: 'marketing',
        label: 'Marketing',
        color: '#EC4899',
        description: 'Marketing, demand generation, brand',
      },
      {
        value: 'hr',
        label: 'HR',
        color: '#10B981',
        description: 'Human resources, talent, payroll',
      },
      {
        value: 'supply_chain',
        label: 'Supply Chain',
        color: '#F59E0B',
        description: 'Logistics, procurement, inventory',
      },
      {
        value: 'sales',
        label: 'Sales',
        color: '#8B5CF6',
        description: 'Sales, revenue operations, customer success',
      },
      {
        value: 'engineering',
        label: 'Engineering',
        color: '#6366F1',
        description: 'Engineering, product, platform',
      },
      {
        value: 'operations',
        label: 'Operations',
        color: '#14B8A6',
        description: 'Operations, compliance, governance',
      },
    ],
    automationStrategy: 'manual',
    purpose: 'Categorize data by owning department for discovery and governance',
    whenNeeded: 'Multi-department organizations, cost allocation, organizational alignment',
    examples: [
      'revenue_forecast (Finance)',
      'campaign_performance (Marketing)',
      'employee_roster (HR)',
      'supply_orders (Supply Chain)',
    ],
    relatedUseCases: ['Data Discovery', 'Lifecycle Management', 'Cost Optimization'],
    relatedVerticals: ['Retail/E-commerce', 'Financial Services', 'Manufacturing/HVAC'],
    bulkAssignable: true,
    effortMinutes: 2,
  },
  {
    id: 'business_unit',
    displayName: 'Business Unit',
    description: 'Geographic or strategic business unit',
    fieldType: 'text',
    defaultValue: '',
    automationStrategy: 'manual',
    purpose: 'Segment data by business unit for regional or strategic analysis',
    whenNeeded: 'Multi-region companies, federated governance, P&L tracking',
    examples: [
      'US Consumer',
      'EMEA SMB',
      'APAC Enterprise',
      'Global Platform',
    ],
    relatedUseCases: ['Data Discovery', 'Cost Optimization'],
    relatedVerticals: ['Retail/E-commerce', 'Technology', 'Financial Services'],
    bulkAssignable: true,
    effortMinutes: 2,
  },
  {
    id: 'sla_response_time',
    displayName: 'SLA Response Time',
    description: 'Expected response time for queries/updates',
    fieldType: 'enum',
    options: [
      { value: 'realtime', label: 'Real-time (<100ms)', color: '#DC2626' },
      { value: 'fast', label: 'Fast (100ms-1s)', color: '#EA580C' },
      { value: 'standard', label: 'Standard (1-10s)', color: '#CA8A04' },
      { value: 'batch', label: 'Batch (>10s)', color: '#6B7280' },
    ],
    automationStrategy: 'hybrid',
    automationRules: [
      {
        trigger: 'Query monitoring shows avg latency',
        action: 'Auto-update SLA category',
      },
    ],
    purpose: 'Set performance expectations for data consumption',
    whenNeeded: 'Real-time analytics, operational dashboards, SLA commitments',
    examples: [
      'order_status (Real-time)',
      'customer_dashboard (Fast)',
      'monthly_metrics (Batch)',
    ],
    relatedUseCases: ['Metrics Catalog', 'Data Products', 'Trusted Metrics'],
    relatedVerticals: ['Retail/E-commerce', 'Technology'],
    bulkAssignable: true,
    effortMinutes: 3,
  },
  {
    id: 'dq_framework',
    displayName: 'Data Quality Framework',
    description: 'Data quality scoring method',
    fieldType: 'enum',
    options: [
      {
        value: 'monte_carlo',
        label: 'Monte Carlo',
        description: 'ML-based anomaly detection',
      },
      {
        value: 'custom_rules',
        label: 'Custom Rules',
        description: 'Business logic validation',
      },
      {
        value: 'schema_validation',
        label: 'Schema Validation',
        description: 'Type and format checking',
      },
      {
        value: 'hybrid',
        label: 'Hybrid',
        description: 'Combination of multiple approaches',
      },
    ],
    automationStrategy: 'automation',
    automationRules: [
      {
        trigger: 'DQ tool selection',
        action: 'Auto-assign framework',
      },
    ],
    purpose: 'Track which DQ validation method is applied',
    whenNeeded: 'Quality assurance, monitoring, alerting',
    examples: [
      'customer_data (Monte Carlo)',
      'financial_metrics (Custom Rules + Schema)',
      'product_catalog (Hybrid)',
    ],
    relatedUseCases: ['Trusted Metrics', 'Compliance', 'Root Cause Analysis'],
    relatedVerticals: ['Financial Services', 'Healthcare'],
    bulkAssignable: true,
    effortMinutes: 2,
  },
  {
    id: 'cost_center',
    displayName: 'Cost Center',
    description: 'Cost center for chargeback/allocation',
    fieldType: 'text',
    automationStrategy: 'hybrid',
    automationRules: [
      {
        trigger: 'Department assigned',
        action: 'Auto-populate from cost center mapping',
      },
    ],
    purpose: 'Allocate infrastructure costs to business units',
    whenNeeded: 'FinOps, showback, chargeback models',
    examples: [
      'CC-1234 (Marketing)',
      'CC-5678 (Finance)',
      'CC-9012 (Shared Platform)',
    ],
    relatedUseCases: ['Cost Optimization'],
    relatedVerticals: ['Financial Services', 'Technology'],
    bulkAssignable: true,
    effortMinutes: 2,
  },
  {
    id: 'refresh_frequency',
    displayName: 'Refresh Frequency',
    description: 'How often data is updated',
    fieldType: 'enum',
    options: [
      { value: 'realtime', label: 'Real-time (Continuous)' },
      { value: 'hourly', label: 'Hourly' },
      { value: 'daily', label: 'Daily' },
      { value: 'weekly', label: 'Weekly' },
      { value: 'monthly', label: 'Monthly' },
      { value: 'quarterly', label: 'Quarterly' },
      { value: 'static', label: 'Static (No updates)' },
    ],
    automationStrategy: 'automation',
    automationRules: [
      {
        trigger: 'Pipeline schedule detected',
        action: 'Auto-set refresh frequency',
      },
    ],
    purpose: 'Set freshness expectations for consumers',
    whenNeeded: 'Real-time dashboards, batch reporting, data product SLAs',
    examples: [
      'live_transactions (Real-time)',
      'daily_summary (Daily)',
      'annual_report (Quarterly)',
    ],
    relatedUseCases: ['Data Products', 'Metrics Catalog', 'Trusted Metrics'],
    relatedVerticals: ['Retail/E-commerce', 'Financial Services'],
    bulkAssignable: true,
    effortMinutes: 1,
  },
  {
    id: 'pii_classification',
    displayName: 'PII Classification',
    description: 'Type of personally identifiable information',
    fieldType: 'enum',
    options: [
      { value: 'none', label: 'No PII', color: '#10B981' },
      {
        value: 'pseudo',
        label: 'Pseudonymized',
        color: '#F59E0B',
        description: 'Indirect identifiers only',
      },
      {
        value: 'sensitive',
        label: 'Sensitive PII',
        color: '#EA580C',
        description: 'SSN, driver license, passport',
      },
      {
        value: 'health',
        label: 'Health Information',
        color: '#DC2626',
        description: 'HIPAA-protected health info',
      },
      {
        value: 'financial',
        label: 'Financial Info',
        color: '#DC2626',
        description: 'Account numbers, credit cards',
      },
    ],
    automationStrategy: 'automation',
    automationRules: [
      {
        trigger: 'Column classification detected',
        action: 'Auto-assign PII category',
      },
    ],
    purpose: 'Enable access control and compliance policies',
    whenNeeded: 'GDPR, HIPAA, SOX compliance, privacy protection',
    examples: [
      'customer_id (Pseudonymized)',
      'ssn (Sensitive PII)',
      'health_records (Health Information)',
    ],
    relatedUseCases: ['Compliance', 'Data Compliance'],
    relatedVerticals: ['Healthcare', 'Financial Services'],
    bulkAssignable: false, // Column-level
    effortMinutes: 5,
  },
  {
    id: 'retention_days',
    displayName: 'Retention Period (Days)',
    description: 'How long to retain data before deletion',
    fieldType: 'number',
    automationStrategy: 'manual',
    purpose: 'Ensure compliance with data retention policies',
    whenNeeded: 'GDPR, CCPA, industry regulations, cost management',
    examples: [
      '90 (90-day retention)',
      '365 (1-year retention)',
      '2555 (7-year retention, common for financial)',
      '-1 (Indefinite)',
    ],
    relatedUseCases: ['Compliance', 'Cost Optimization'],
    relatedVerticals: ['Financial Services', 'Healthcare'],
    bulkAssignable: true,
    effortMinutes: 2,
  },
  {
    id: 'criticality_tier',
    displayName: 'Criticality Tier',
    description: 'Business criticality for recovery/disaster plans',
    fieldType: 'enum',
    options: [
      {
        value: 'tier1',
        label: 'Tier 1 - Critical',
        color: '#DC2626',
        description: 'Revenue-impacting, immediate RTO',
      },
      {
        value: 'tier2',
        label: 'Tier 2 - Important',
        color: '#EA580C',
        description: 'Business-essential, <4h RTO',
      },
      {
        value: 'tier3',
        label: 'Tier 3 - Standard',
        color: '#F59E0B',
        description: 'Normal operations, <24h RTO',
      },
      {
        value: 'tier4',
        label: 'Tier 4 - Low',
        color: '#6B7280',
        description: 'Non-critical, >24h RTO',
      },
    ],
    automationStrategy: 'manual',
    purpose: 'Determine backup/disaster recovery strategy',
    whenNeeded: 'Disaster recovery planning, BCDR strategy, SLA definition',
    examples: [
      'production_orders (Tier 1)',
      'internal_dashboards (Tier 3)',
      'archival_data (Tier 4)',
    ],
    relatedUseCases: ['Data Products', 'Lifecycle Management'],
    relatedVerticals: ['Financial Services', 'Healthcare'],
    bulkAssignable: true,
    effortMinutes: 3,
  },
  {
    id: 'api_exposure',
    displayName: 'API Exposure',
    description: 'Whether data is exposed via API',
    fieldType: 'enum',
    options: [
      {
        value: 'not_exposed',
        label: 'Not Exposed',
        description: 'Internal only, no API access',
      },
      {
        value: 'internal_api',
        label: 'Internal API',
        description: 'Exposed to internal apps only',
      },
      {
        value: 'partner_api',
        label: 'Partner API',
        description: 'Exposed to approved partners',
      },
      {
        value: 'public_api',
        label: 'Public API',
        description: 'Publicly available API',
      },
    ],
    automationStrategy: 'hybrid',
    purpose: 'Track API contracts and exposure for data products',
    whenNeeded: 'Data product platforms, API governance',
    examples: [
      'product_catalog (Public API)',
      'customer_data (Internal API)',
      'supplier_info (Partner API)',
    ],
    relatedUseCases: ['Data Products'],
    relatedVerticals: ['Technology', 'Retail/E-commerce'],
    bulkAssignable: true,
    effortMinutes: 2,
  },
  {
    id: 'explainability_marker',
    displayName: 'Explainability Marker',
    description: 'ML explainability status and technique',
    fieldType: 'enum',
    options: [
      {
        value: 'transparent',
        label: 'Transparent',
        description: 'Rule-based, fully explainable',
      },
      {
        value: 'interpretable',
        label: 'Interpretable',
        description: 'Feature importance available',
      },
      {
        value: 'opaque',
        label: 'Opaque (Black Box)',
        description: 'Limited explainability',
      },
      {
        value: 'not_applicable',
        label: 'N/A',
        description: 'Not used in ML',
      },
    ],
    automationStrategy: 'manual',
    purpose: 'Track explainability for AI governance and regulatory compliance',
    whenNeeded: 'ML models, AI fairness, regulatory reporting (GDPR Article 22)',
    examples: [
      'credit_score (Opaque - needs LIME/SHAP)',
      'churn_prediction (Interpretable - feature importance)',
      'customer_segmentation (Transparent - rule-based)',
    ],
    relatedUseCases: ['Compliance', 'Data Products'],
    relatedVerticals: ['Financial Services', 'Healthcare'],
    bulkAssignable: false, // Per-feature
    effortMinutes: 5,
  },
  {
    id: 'ml_ready',
    displayName: 'ML-Ready Score',
    description: 'Readiness for machine learning (0-100)',
    fieldType: 'number',
    automationStrategy: 'automation',
    automationRules: [
      {
        trigger: 'Missing values < 5%, data quality > 95%',
        action: 'Auto-score >= 80',
      },
    ],
    purpose: 'Indicate dataset suitability for ML pipelines',
    whenNeeded: 'Data science platforms, ML feature engineering',
    examples: [
      '95 (High quality, ready for training)',
      '65 (Needs cleaning, feature engineering)',
      '30 (Requires significant preprocessing)',
    ],
    relatedUseCases: ['Data Products'],
    relatedVerticals: ['Technology', 'Financial Services'],
    bulkAssignable: true,
    effortMinutes: 3,
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getCustomField(id: string): CustomFieldDefinition | undefined {
  return CUSTOM_FIELDS_LIBRARY.find(f => f.id === id);
}

export function getCustomFieldsByUseCase(useCase: UseCase): CustomFieldDefinition[] {
  return CUSTOM_FIELDS_LIBRARY.filter(f => f.relatedUseCases.includes(useCase));
}

export function getCustomFieldsByVertical(vertical: string): CustomFieldDefinition[] {
  return CUSTOM_FIELDS_LIBRARY.filter(f =>
    f.relatedVerticals?.includes(vertical)
  );
}

export function getCustomFieldsByStrategy(strategy: AutomationStrategy): CustomFieldDefinition[] {
  return CUSTOM_FIELDS_LIBRARY.filter(f => f.automationStrategy === strategy);
}

export function getAutomatedCustomFields(): CustomFieldDefinition[] {
  return CUSTOM_FIELDS_LIBRARY.filter(
    f => f.automationStrategy === 'automation' || f.automationStrategy === 'hybrid'
  );
}

/**
 * Get custom field recommendations for a use case + vertical combo
 */
export function getRecommendedCustomFields(
  useCases: UseCase[],
  vertical?: string
): {
  field: CustomFieldDefinition;
  priority: 'must-have' | 'recommended' | 'optional';
  reason: string;
}[] {
  const fieldMap = new Map<
    string,
    { field: CustomFieldDefinition; score: number; reasons: string[] }
  >();

  // Score by use case
  useCases.forEach(uc => {
    getCustomFieldsByUseCase(uc).forEach(field => {
      const existing = fieldMap.get(field.id) || {
        field,
        score: 0,
        reasons: [],
      };
      existing.score += 2;
      existing.reasons.push(`Used in ${uc}`);
      fieldMap.set(field.id, existing);
    });
  });

  // Boost score by vertical
  if (vertical) {
    getCustomFieldsByVertical(vertical).forEach(field => {
      const existing = fieldMap.get(field.id) || {
        field,
        score: 0,
        reasons: [],
      };
      existing.score += 1;
      if (!existing.reasons.some(r => r.includes(vertical))) {
        existing.reasons.push(`Common in ${vertical}`);
      }
      fieldMap.set(field.id, existing);
    });
  }

  // Convert scores to priorities
  return Array.from(fieldMap.values())
    .map(({ field, score, reasons }) => {
      let priority: 'must-have' | 'recommended' | 'optional' = 'optional';
      if (score >= 3) priority = 'must-have';
      else if (score >= 2) priority = 'recommended';

      return {
        field,
        priority,
        reason: reasons.join('; '),
      };
    })
    .sort((a, b) => {
      const priorityOrder = { 'must-have': 0, recommended: 1, optional: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
}

/**
 * Generate custom fields implementation plan
 */
export function generateCustomFieldsPlan(fields: CustomFieldDefinition[]): {
  manual: CustomFieldDefinition[];
  automation: CustomFieldDefinition[];
  hybrid: CustomFieldDefinition[];
  totalEffortHours: number;
} {
  const plan = {
    manual: fields.filter(f => f.automationStrategy === 'manual'),
    automation: fields.filter(f => f.automationStrategy === 'automation'),
    hybrid: fields.filter(f => f.automationStrategy === 'hybrid'),
    totalEffortHours: 0,
  };

  plan.totalEffortHours = fields.reduce((sum, f) => sum + f.effortMinutes, 0) / 60;

  return plan;
}
