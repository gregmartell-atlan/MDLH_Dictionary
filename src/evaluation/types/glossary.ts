/**
 * Glossary Structure Types
 *
 * Types for designing glossary hierarchy, term templates,
 * and naming conventions.
 */

// ============================================
// GLOSSARY TYPES
// ============================================

export type ApprovalWorkflow = 'none' | 'single' | 'committee';
export type NamingPattern = 'snake_case' | 'Title Case' | 'camelCase' | 'UPPER_CASE' | 'kebab-case';

export interface GlossaryDesign {
  id: string;
  name: string;
  description: string;
  categories: GlossaryCategory[];
  governanceModel: GlossaryGovernance;
  namingConventions: NamingConvention[];
}

export interface GlossaryCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  owner?: string;
  ownerEmail?: string;
  approvalWorkflow: ApprovalWorkflow;
  termTemplate: TermTemplate;
  domains: string[];
  parentCategoryId?: string;
  childCategoryIds: string[];
  order: number;
}

export interface TermTemplate {
  requiredFields: string[];
  optionalFields: string[];
  customFields: CustomTermField[];
  exampleTerm: Record<string, string>;
}

export interface CustomTermField {
  id: string;
  name: string;
  displayName: string;
  type: 'string' | 'number' | 'date' | 'enum' | 'url' | 'user';
  enumValues?: string[];
  isRequired: boolean;
  helpText?: string;
}

export interface GlossaryGovernance {
  defaultApprovalWorkflow: ApprovalWorkflow;
  allowUserSuggestions: boolean;
  requireOwnerForTerms: boolean;
  termExpirationDays?: number;
  reviewCycleDays?: number;
}

export interface NamingConvention {
  id: string;
  category: string;
  pattern: NamingPattern;
  prefix?: string;
  suffix?: string;
  maxLength?: number;
  examples: string[];
  antiPatterns: string[];
}

// ============================================
// GLOSSARY STRUCTURE TEMPLATES
// ============================================

export interface GlossaryTemplate {
  id: string;
  name: string;
  description: string;
  useCase: string;
  categories: Partial<GlossaryCategory>[];
}

export const GLOSSARY_TEMPLATES: GlossaryTemplate[] = [
  {
    id: 'by-domain',
    name: 'Domain-Based',
    description: 'Glossary categories aligned to business domains',
    useCase: 'Federated organizations where each domain owns their terminology',
    categories: [
      {
        id: 'sales-terms',
        name: 'Sales Terms',
        description: 'Sales and CRM terminology',
        color: '#10B981',
        icon: 'trending-up',
        domains: ['sales'],
        approvalWorkflow: 'single',
        termTemplate: {
          requiredFields: ['definition', 'owner'],
          optionalFields: ['formula', 'examples', 'relatedTerms'],
          customFields: [],
          exampleTerm: {
            name: 'Annual Recurring Revenue',
            definition: 'Total value of recurring revenue normalized to a one-year period',
            formula: 'SUM(monthly_recurring_revenue) * 12',
          },
        },
      },
      {
        id: 'finance-terms',
        name: 'Finance Terms',
        description: 'Financial reporting and accounting terminology',
        color: '#8B5CF6',
        icon: 'dollar-sign',
        domains: ['finance'],
        approvalWorkflow: 'committee',
        termTemplate: {
          requiredFields: ['definition', 'owner', 'formula'],
          optionalFields: ['examples', 'relatedTerms', 'dataSource'],
          customFields: [
            {
              id: 'gaap-compliant',
              name: 'gaap_compliant',
              displayName: 'GAAP Compliant',
              type: 'enum',
              enumValues: ['Yes', 'No', 'Partial'],
              isRequired: true,
            },
          ],
          exampleTerm: {
            name: 'Gross Margin',
            definition: 'Revenue minus cost of goods sold, expressed as a percentage',
            formula: '(revenue - cogs) / revenue * 100',
          },
        },
      },
      {
        id: 'product-terms',
        name: 'Product Terms',
        description: 'Product analytics and feature terminology',
        color: '#F59E0B',
        icon: 'box',
        domains: ['product'],
        approvalWorkflow: 'single',
        termTemplate: {
          requiredFields: ['definition', 'owner'],
          optionalFields: ['formula', 'examples', 'relatedTerms'],
          customFields: [],
          exampleTerm: {
            name: 'Monthly Active Users',
            definition: 'Unique users who performed at least one action in the past 30 days',
          },
        },
      },
    ],
  },
  {
    id: 'by-type',
    name: 'Type-Based',
    description: 'Glossary categories by term type (KPIs, Dimensions, Entities)',
    useCase: 'Metric-focused organizations standardizing KPI definitions',
    categories: [
      {
        id: 'kpis',
        name: 'KPIs',
        description: 'Key Performance Indicators and metrics',
        color: '#EF4444',
        icon: 'target',
        approvalWorkflow: 'committee',
        termTemplate: {
          requiredFields: ['definition', 'formula', 'owner', 'dataSource'],
          optionalFields: ['targetValue', 'refreshFrequency'],
          customFields: [
            {
              id: 'metric-type',
              name: 'metric_type',
              displayName: 'Metric Type',
              type: 'enum',
              enumValues: ['Leading', 'Lagging', 'Diagnostic'],
              isRequired: true,
            },
          ],
          exampleTerm: {
            name: 'Customer Acquisition Cost',
            definition: 'Total cost to acquire a new customer',
            formula: 'total_marketing_spend / new_customers_acquired',
            metric_type: 'Lagging',
          },
        },
      },
      {
        id: 'dimensions',
        name: 'Dimensions',
        description: 'Standard dimensions for slicing and filtering',
        color: '#3B82F6',
        icon: 'layers',
        approvalWorkflow: 'single',
        termTemplate: {
          requiredFields: ['definition', 'owner'],
          optionalFields: ['allowedValues', 'hierarchy'],
          customFields: [],
          exampleTerm: {
            name: 'Region',
            definition: 'Geographic area for sales and operations reporting',
            allowedValues: 'AMER, EMEA, APAC',
          },
        },
      },
      {
        id: 'entities',
        name: 'Business Entities',
        description: 'Core business objects and concepts',
        color: '#10B981',
        icon: 'database',
        approvalWorkflow: 'single',
        termTemplate: {
          requiredFields: ['definition', 'owner'],
          optionalFields: ['attributes', 'relationships'],
          customFields: [],
          exampleTerm: {
            name: 'Customer',
            definition: 'An organization or individual that has purchased or engaged with our products',
          },
        },
      },
      {
        id: 'acronyms',
        name: 'Acronyms',
        description: 'Company-specific abbreviations and acronyms',
        color: '#6B7280',
        icon: 'type',
        approvalWorkflow: 'none',
        termTemplate: {
          requiredFields: ['definition'],
          optionalFields: ['fullForm', 'context'],
          customFields: [],
          exampleTerm: {
            name: 'ARR',
            definition: 'Annual Recurring Revenue',
            fullForm: 'Annual Recurring Revenue',
          },
        },
      },
    ],
  },
  {
    id: 'by-layer',
    name: 'Layer-Based',
    description: 'Glossary categories by data layer (source, transform, business)',
    useCase: 'Technical organizations with layered data architecture',
    categories: [
      {
        id: 'source-definitions',
        name: 'Source Definitions',
        description: 'Terms as defined in source systems',
        color: '#6B7280',
        icon: 'database',
        approvalWorkflow: 'none',
        termTemplate: {
          requiredFields: ['definition', 'sourceSystem'],
          optionalFields: ['technicalName'],
          customFields: [
            {
              id: 'source-system',
              name: 'source_system',
              displayName: 'Source System',
              type: 'string',
              isRequired: true,
            },
          ],
          exampleTerm: {
            name: 'sfdc_account_id',
            definition: 'Unique identifier for an account in Salesforce',
            source_system: 'Salesforce',
          },
        },
      },
      {
        id: 'transformation-logic',
        name: 'Transformation Logic',
        description: 'Business rules and transformation definitions',
        color: '#F59E0B',
        icon: 'git-branch',
        approvalWorkflow: 'single',
        termTemplate: {
          requiredFields: ['definition', 'logic', 'owner'],
          optionalFields: ['inputTerms', 'outputTerms'],
          customFields: [],
          exampleTerm: {
            name: 'active_customer_flag',
            definition: 'Customer is considered active if they have made a purchase in the last 365 days',
            logic: 'CASE WHEN last_purchase_date >= DATEADD(day, -365, CURRENT_DATE) THEN true ELSE false END',
          },
        },
      },
      {
        id: 'business-meaning',
        name: 'Business Meaning',
        description: 'Business-friendly definitions for stakeholders',
        color: '#10B981',
        icon: 'book-open',
        approvalWorkflow: 'committee',
        termTemplate: {
          requiredFields: ['definition', 'owner'],
          optionalFields: ['examples', 'relatedTerms', 'stakeholders'],
          customFields: [],
          exampleTerm: {
            name: 'Active Customer',
            definition: 'A customer who has made at least one purchase within the past year',
          },
        },
      },
    ],
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getGlossaryTemplateById(id: string): GlossaryTemplate | undefined {
  return GLOSSARY_TEMPLATES.find(t => t.id === id);
}

export function createCategoryFromTemplate(
  template: Partial<GlossaryCategory>,
  id: string
): GlossaryCategory {
  return {
    id,
    name: template.name || 'New Category',
    description: template.description || '',
    color: template.color || '#6B7280',
    icon: template.icon || 'folder',
    approvalWorkflow: template.approvalWorkflow || 'single',
    termTemplate: template.termTemplate || {
      requiredFields: ['definition'],
      optionalFields: [],
      customFields: [],
      exampleTerm: {},
    },
    domains: template.domains || [],
    childCategoryIds: [],
    order: 0,
  };
}

export function validateTermAgainstTemplate(
  term: Record<string, unknown>,
  template: TermTemplate
): { valid: boolean; missingFields: string[] } {
  const missingFields = template.requiredFields.filter(
    field => !term[field] || term[field] === ''
  );

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}
