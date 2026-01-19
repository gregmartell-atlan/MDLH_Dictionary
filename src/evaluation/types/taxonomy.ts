/**
 * Taxonomy Types
 *
 * Types for designing classification taxonomies,
 * tag hierarchies, and propagation rules.
 */

// ============================================
// TAXONOMY TYPES
// ============================================

export type PropagationDirection = 'upstream' | 'downstream' | 'both' | 'none';

export interface TaxonomyDesign {
  id: string;
  name: string;
  description: string;
  purpose: string;
  structure: TaxonomyNode[];
  propagationRules: PropagationRule[];
  policyMappings: PolicyMapping[];
}

export interface TaxonomyNode {
  id: string;
  name: string;
  displayName: string;
  description: string;
  color: string;
  icon?: string;
  parentId?: string;
  children: TaxonomyNode[];
  applicableAssetTypes: string[];
  autoDetectionPatterns: string[];
  isLeaf: boolean;
  order: number;
}

export interface PropagationRule {
  id: string;
  tagId: string;
  direction: PropagationDirection;
  condition?: string;
  description: string;
}

export interface PolicyMapping {
  id: string;
  tagId: string;
  policyType: 'access' | 'masking' | 'retention' | 'audit';
  policyName: string;
  description: string;
}

// ============================================
// TAXONOMY TEMPLATES
// ============================================

export interface TaxonomyTemplate {
  id: string;
  name: string;
  description: string;
  useCase: string;
  nodes: TaxonomyNode[];
}

export const TAXONOMY_TEMPLATES: TaxonomyTemplate[] = [
  {
    id: 'data-sensitivity',
    name: 'Data Sensitivity',
    description: 'Classification based on data sensitivity and access requirements',
    useCase: 'Compliance, access control, data protection',
    nodes: [
      {
        id: 'public',
        name: 'Public',
        displayName: 'Public',
        description: 'Data that can be freely shared externally',
        color: '#22C55E',
        parentId: undefined,
        children: [],
        applicableAssetTypes: ['Table', 'Column', 'Dashboard', 'Report'],
        autoDetectionPatterns: [],
        isLeaf: true,
        order: 1,
      },
      {
        id: 'internal',
        name: 'Internal',
        displayName: 'Internal',
        description: 'Data for internal use only',
        color: '#3B82F6',
        parentId: undefined,
        children: [],
        applicableAssetTypes: ['Table', 'Column', 'Dashboard', 'Report'],
        autoDetectionPatterns: [],
        isLeaf: true,
        order: 2,
      },
      {
        id: 'confidential',
        name: 'Confidential',
        displayName: 'Confidential',
        description: 'Sensitive data requiring access controls',
        color: '#F59E0B',
        parentId: undefined,
        children: [
          {
            id: 'pii',
            name: 'PII',
            displayName: 'PII',
            description: 'Personally Identifiable Information',
            color: '#EF4444',
            parentId: 'confidential',
            children: [
              {
                id: 'pii-direct',
                name: 'PII-Direct',
                displayName: 'Direct Identifier',
                description: 'Name, SSN, Email, Phone',
                color: '#DC2626',
                parentId: 'pii',
                children: [],
                applicableAssetTypes: ['Column'],
                autoDetectionPatterns: ['*name*', '*email*', '*ssn*', '*phone*', '*address*'],
                isLeaf: true,
                order: 1,
              },
              {
                id: 'pii-indirect',
                name: 'PII-Indirect',
                displayName: 'Indirect Identifier',
                description: 'ZIP, DOB, Gender - can identify in combination',
                color: '#F87171',
                parentId: 'pii',
                children: [],
                applicableAssetTypes: ['Column'],
                autoDetectionPatterns: ['*zip*', '*dob*', '*birth*', '*gender*', '*age*'],
                isLeaf: true,
                order: 2,
              },
            ],
            applicableAssetTypes: ['Table', 'Column'],
            autoDetectionPatterns: [],
            isLeaf: false,
            order: 1,
          },
          {
            id: 'phi',
            name: 'PHI',
            displayName: 'PHI',
            description: 'Protected Health Information (HIPAA)',
            color: '#EC4899',
            parentId: 'confidential',
            children: [],
            applicableAssetTypes: ['Table', 'Column'],
            autoDetectionPatterns: ['*diagnosis*', '*treatment*', '*medical*', '*health*', '*patient*'],
            isLeaf: true,
            order: 2,
          },
          {
            id: 'financial',
            name: 'Financial',
            displayName: 'Financial',
            description: 'Financial account and transaction data',
            color: '#8B5CF6',
            parentId: 'confidential',
            children: [],
            applicableAssetTypes: ['Table', 'Column'],
            autoDetectionPatterns: ['*account*', '*balance*', '*credit*', '*salary*', '*revenue*'],
            isLeaf: true,
            order: 3,
          },
        ],
        applicableAssetTypes: ['Table', 'Column', 'Dashboard'],
        autoDetectionPatterns: [],
        isLeaf: false,
        order: 3,
      },
      {
        id: 'restricted',
        name: 'Restricted',
        displayName: 'Restricted',
        description: 'Highly sensitive, need-to-know basis only',
        color: '#DC2626',
        parentId: undefined,
        children: [],
        applicableAssetTypes: ['Table', 'Column'],
        autoDetectionPatterns: [],
        isLeaf: true,
        order: 4,
      },
    ],
  },
  {
    id: 'data-quality',
    name: 'Data Quality Status',
    description: 'Classification based on data quality and curation level',
    useCase: 'Data trust, self-service analytics',
    nodes: [
      {
        id: 'raw',
        name: 'Raw',
        displayName: 'Raw',
        description: 'Unprocessed data directly from source',
        color: '#6B7280',
        parentId: undefined,
        children: [],
        applicableAssetTypes: ['Table', 'View'],
        autoDetectionPatterns: ['*raw*', '*staging*', '*landing*'],
        isLeaf: true,
        order: 1,
      },
      {
        id: 'cleansed',
        name: 'Cleansed',
        displayName: 'Cleansed',
        description: 'Data that has been cleaned and validated',
        color: '#3B82F6',
        parentId: undefined,
        children: [],
        applicableAssetTypes: ['Table', 'View'],
        autoDetectionPatterns: ['*clean*', '*validated*'],
        isLeaf: true,
        order: 2,
      },
      {
        id: 'curated',
        name: 'Curated',
        displayName: 'Curated',
        description: 'Business-ready, transformed data',
        color: '#10B981',
        parentId: undefined,
        children: [],
        applicableAssetTypes: ['Table', 'View'],
        autoDetectionPatterns: ['*mart*', '*dim_*', '*fact_*', '*curated*'],
        isLeaf: true,
        order: 3,
      },
      {
        id: 'certified',
        name: 'Certified',
        displayName: 'Certified',
        description: 'Officially approved for reporting',
        color: '#22C55E',
        parentId: undefined,
        children: [],
        applicableAssetTypes: ['Table', 'View', 'Dashboard'],
        autoDetectionPatterns: [],
        isLeaf: true,
        order: 4,
      },
    ],
  },
  {
    id: 'data-lifecycle',
    name: 'Data Lifecycle',
    description: 'Classification based on data retention and lifecycle stage',
    useCase: 'Retention policies, storage management',
    nodes: [
      {
        id: 'active',
        name: 'Active',
        displayName: 'Active',
        description: 'Currently in use, frequently accessed',
        color: '#22C55E',
        parentId: undefined,
        children: [],
        applicableAssetTypes: ['Table', 'Database'],
        autoDetectionPatterns: [],
        isLeaf: true,
        order: 1,
      },
      {
        id: 'archive-ready',
        name: 'Archive-Ready',
        displayName: 'Archive Ready',
        description: 'Low access, candidate for archival',
        color: '#F59E0B',
        parentId: undefined,
        children: [],
        applicableAssetTypes: ['Table', 'Database'],
        autoDetectionPatterns: ['*archive*', '*historical*'],
        isLeaf: true,
        order: 2,
      },
      {
        id: 'archived',
        name: 'Archived',
        displayName: 'Archived',
        description: 'Moved to cold storage',
        color: '#6B7280',
        parentId: undefined,
        children: [],
        applicableAssetTypes: ['Table', 'Database'],
        autoDetectionPatterns: [],
        isLeaf: true,
        order: 3,
      },
      {
        id: 'delete-pending',
        name: 'Delete-Pending',
        displayName: 'Delete Pending',
        description: 'Scheduled for deletion',
        color: '#EF4444',
        parentId: undefined,
        children: [],
        applicableAssetTypes: ['Table', 'Database'],
        autoDetectionPatterns: [],
        isLeaf: true,
        order: 4,
      },
    ],
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getTaxonomyTemplateById(id: string): TaxonomyTemplate | undefined {
  return TAXONOMY_TEMPLATES.find(t => t.id === id);
}

export function flattenTaxonomyNodes(nodes: TaxonomyNode[]): TaxonomyNode[] {
  const result: TaxonomyNode[] = [];

  function traverse(node: TaxonomyNode) {
    result.push(node);
    for (const child of node.children) {
      traverse(child);
    }
  }

  for (const node of nodes) {
    traverse(node);
  }

  return result;
}

export function findNodeById(nodes: TaxonomyNode[], id: string): TaxonomyNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNodeById(node.children, id);
    if (found) return found;
  }
  return undefined;
}

export function getNodePath(nodes: TaxonomyNode[], targetId: string): TaxonomyNode[] {
  const path: TaxonomyNode[] = [];

  function traverse(node: TaxonomyNode, currentPath: TaxonomyNode[]): boolean {
    currentPath.push(node);
    if (node.id === targetId) {
      path.push(...currentPath);
      return true;
    }
    for (const child of node.children) {
      if (traverse(child, currentPath)) return true;
    }
    currentPath.pop();
    return false;
  }

  for (const node of nodes) {
    if (traverse(node, [])) break;
  }

  return path;
}
