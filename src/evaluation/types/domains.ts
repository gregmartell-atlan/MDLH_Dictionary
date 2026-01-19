/**
 * Domain Model Types
 *
 * Types for designing domain structure, ownership models,
 * and boundary rules.
 */

// import type { MetadataFieldType, RequirementType } from './metadata-fields';
import type { FieldRequirement } from './requirements';

// Re-export FieldRequirement for convenience (single source of truth in requirements.ts)
export type { FieldRequirement } from './requirements';

// ============================================
// DOMAIN MODEL TYPES
// ============================================

export type OwnershipStyle = 'centralized' | 'distributed' | 'hybrid';
export type StewardshipModel = 'dedicated' | 'federated' | 'crowdsourced';
export type BoundaryType = 'connector' | 'database' | 'schema' | 'path' | 'tag' | 'custom';

export interface DomainModel {
  id: string;
  name: string;
  description: string;
  color: string;
  boundaryType: BoundaryType;
  boundaryRules: BoundaryRule[];
  ownershipModel: OwnershipModel;
  metadataRequirements: FieldRequirement[];
  taxonomySubset: string[];
  glossaryScope: string[];
  parentDomainId?: string;
  childDomainIds: string[];
  assetCount?: number;
  position?: { x: number; y: number };
  
  // Sync state
  atlanAssets?: string[]; // List of asset GUIDs
  lastSyncedAt?: string;
}

export interface BoundaryRule {
  id: string;
  type: BoundaryType;
  pattern: string;
  description?: string;
  isInclude: boolean;
}

export interface OwnershipModel {
  style: OwnershipStyle;
  domainOwner?: string;
  domainOwnerEmail?: string;
  stewardshipModel: StewardshipModel;
  stewards: Steward[];
  escalationPath: string[];
}

export interface Steward {
  id: string;
  name: string;
  email?: string;
  role: string;
  scope?: string;
}

// FieldRequirement is now imported from ./requirements

// ============================================
// DOMAIN TEMPLATES
// ============================================

export interface DomainTemplate {
  id: string;
  name: string;
  description: string;
  style: OwnershipStyle;
  domains: Partial<DomainModel>[];
  relationships: DomainRelationship[];
}

export interface DomainRelationship {
  sourceId: string;
  targetId: string;
  type: 'parent-child' | 'peer' | 'shared-data';
}

export const DOMAIN_TEMPLATES: DomainTemplate[] = [
  {
    id: 'centralized',
    name: 'Centralized Governance',
    description: 'Single team owns all metadata. Best for small organizations or early-stage governance.',
    style: 'centralized',
    domains: [
      {
        id: 'enterprise',
        name: 'Enterprise Data',
        description: 'All organizational data assets',
        color: '#3B82F6',
        boundaryType: 'connector',
        boundaryRules: [{ id: '1', type: 'connector', pattern: '*', isInclude: true }],
        ownershipModel: {
          style: 'centralized',
          stewardshipModel: 'dedicated',
          stewards: [],
          escalationPath: ['Data Governance Lead', 'CDO'],
        },
        metadataRequirements: [],
        taxonomySubset: [],
        glossaryScope: [],
        childDomainIds: [],
      },
    ],
    relationships: [],
  },
  {
    id: 'by-function',
    name: 'Functional Domains',
    description: 'Domains aligned to business functions. Common in mid-size organizations.',
    style: 'distributed',
    domains: [
      {
        id: 'sales',
        name: 'Sales',
        description: 'CRM, pipeline, revenue data',
        color: '#10B981',
        boundaryType: 'database',
        boundaryRules: [
          { id: '1', type: 'database', pattern: '*sales*', isInclude: true },
          { id: '2', type: 'database', pattern: '*crm*', isInclude: true },
        ],
        ownershipModel: {
          style: 'distributed',
          stewardshipModel: 'federated',
          stewards: [],
          escalationPath: ['Sales Ops Lead', 'VP Sales'],
        },
        metadataRequirements: [],
        taxonomySubset: [],
        glossaryScope: ['Sales Terms'],
        childDomainIds: [],
      },
      {
        id: 'finance',
        name: 'Finance',
        description: 'Financial reporting, budgets, actuals',
        color: '#8B5CF6',
        boundaryType: 'database',
        boundaryRules: [
          { id: '1', type: 'database', pattern: '*finance*', isInclude: true },
          { id: '2', type: 'database', pattern: '*accounting*', isInclude: true },
        ],
        ownershipModel: {
          style: 'distributed',
          stewardshipModel: 'federated',
          stewards: [],
          escalationPath: ['Finance Ops Lead', 'CFO'],
        },
        metadataRequirements: [
          { field: 'atlanTags', requirement: 'required', helpText: 'Financial data must be classified' },
        ],
        taxonomySubset: ['Financial', 'Confidential'],
        glossaryScope: ['Finance Terms', 'KPIs'],
        childDomainIds: [],
      },
      {
        id: 'product',
        name: 'Product',
        description: 'Product analytics, usage, features',
        color: '#F59E0B',
        boundaryType: 'database',
        boundaryRules: [
          { id: '1', type: 'database', pattern: '*product*', isInclude: true },
          { id: '2', type: 'database', pattern: '*analytics*', isInclude: true },
        ],
        ownershipModel: {
          style: 'distributed',
          stewardshipModel: 'federated',
          stewards: [],
          escalationPath: ['Product Analytics Lead', 'VP Product'],
        },
        metadataRequirements: [],
        taxonomySubset: [],
        glossaryScope: ['Product Terms'],
        childDomainIds: [],
      },
    ],
    relationships: [],
  },
  {
    id: 'data-mesh',
    name: 'Data Mesh',
    description: 'Domain-oriented, decentralized ownership with federated governance.',
    style: 'hybrid',
    domains: [
      {
        id: 'platform',
        name: 'Platform Team',
        description: 'Central platform providing tools and standards',
        color: '#6366F1',
        boundaryType: 'custom',
        boundaryRules: [],
        ownershipModel: {
          style: 'centralized',
          stewardshipModel: 'dedicated',
          stewards: [],
          escalationPath: ['Platform Lead', 'CTO'],
        },
        metadataRequirements: [],
        taxonomySubset: [],
        glossaryScope: ['Platform Standards'],
        childDomainIds: [],
      },
      {
        id: 'consumer-domain',
        name: 'Consumer Domain',
        description: 'Customer-facing products and services',
        color: '#EC4899',
        boundaryType: 'tag',
        boundaryRules: [{ id: '1', type: 'tag', pattern: 'domain:consumer', isInclude: true }],
        ownershipModel: {
          style: 'distributed',
          stewardshipModel: 'federated',
          stewards: [],
          escalationPath: ['Domain Lead'],
        },
        metadataRequirements: [
          { field: 'readme', requirement: 'required', helpText: 'Data products need documentation' },
          { field: 'certificateStatus', requirement: 'required' },
        ],
        taxonomySubset: ['PII', 'Customer Data'],
        glossaryScope: ['Consumer Terms'],
        childDomainIds: [],
      },
      {
        id: 'internal-domain',
        name: 'Internal Domain',
        description: 'Internal operations and analytics',
        color: '#14B8A6',
        boundaryType: 'tag',
        boundaryRules: [{ id: '1', type: 'tag', pattern: 'domain:internal', isInclude: true }],
        ownershipModel: {
          style: 'distributed',
          stewardshipModel: 'federated',
          stewards: [],
          escalationPath: ['Domain Lead'],
        },
        metadataRequirements: [],
        taxonomySubset: ['Internal'],
        glossaryScope: ['Internal Terms'],
        childDomainIds: [],
      },
    ],
    relationships: [
      { sourceId: 'platform', targetId: 'consumer-domain', type: 'shared-data' },
      { sourceId: 'platform', targetId: 'internal-domain', type: 'shared-data' },
    ],
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getDomainTemplateById(id: string): DomainTemplate | undefined {
  return DOMAIN_TEMPLATES.find(t => t.id === id);
}

export function createDomainFromTemplate(
  template: Partial<DomainModel>,
  id: string
): DomainModel {
  return {
    id,
    name: template.name || 'New Domain',
    description: template.description || '',
    color: template.color || '#6B7280',
    boundaryType: template.boundaryType || 'database',
    boundaryRules: template.boundaryRules || [],
    ownershipModel: template.ownershipModel || {
      style: 'distributed',
      stewardshipModel: 'federated',
      stewards: [],
      escalationPath: [],
    },
    metadataRequirements: template.metadataRequirements || [],
    taxonomySubset: template.taxonomySubset || [],
    glossaryScope: template.glossaryScope || [],
    childDomainIds: template.childDomainIds || [],
    position: template.position,
  };
}
