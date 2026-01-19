// ============================================================================
// Priority Types
// Legacy types for backwards compatibility with the unified assessment adapter
// ============================================================================

// Priority Levels
export type PriorityLevel = 'P0' | 'P1' | 'P2' | 'P3';
export type Effort = 'low' | 'medium' | 'high';
export type RequirementType = 'required' | 'recommended' | 'optional';

// Metadata Field Types (Atlan native fields)
export type MetadataFieldType =
  | 'ownerUsers'
  | 'ownerGroups'
  | 'description'
  | 'userDescription'
  | 'readme'
  | 'atlanTags'
  | 'certificateStatus'
  | 'glossaryTerms'
  | 'lineage'
  | 'accessPolicies'
  | 'customMetadata'
  | 'starredBy'
  | 'links';

// Persona Types for role-based views
export type PersonaType =
  | 'governance_lead'
  | 'data_steward'
  | 'compliance_officer'
  | 'data_analyst'
  | 'data_engineer'
  | 'executive'
  | 'atlan_csm'
  | 'all';

// Field Coverage from audits
export interface FieldCoverage {
  field: MetadataFieldType;
  totalAssets: number;
  populatedAssets?: number;
  assetsCovered?: number;
  coveragePercent: number; // 0-1
}

// Priority output
export interface Priority {
  field: MetadataFieldType;
  level: PriorityLevel;
  score: number;
  badge: string;
  label: string;
  reasoning: string[];
}

// Pattern Template
export interface PatternField {
  field: MetadataFieldType;
  requirement: RequirementType;
  rationale: string;
}

export interface PatternTemplate {
  id: string;
  name: string;
  description: string;
  useCase: string;
  fields: PatternField[];
  suggestedTimeline: string;
  prerequisites: string[];
}

// Field Display Names
export const FIELD_DISPLAY_NAMES: Record<MetadataFieldType, string> = {
  ownerUsers: 'Owner (Users)',
  ownerGroups: 'Owner (Groups)',
  description: 'Description',
  userDescription: 'User Description',
  readme: 'README',
  atlanTags: 'Classifications',
  certificateStatus: 'Certificate',
  glossaryTerms: 'Glossary Terms',
  lineage: 'Lineage',
  accessPolicies: 'Access Policies',
  customMetadata: 'Custom Metadata',
  starredBy: 'Starred',
  links: 'Links',
};

export function formatFieldName(field: MetadataFieldType): string {
  return FIELD_DISPLAY_NAMES[field] || field;
}

// Persona Views
export interface PersonaView {
  persona: PersonaType;
  name: string;
  description: string;
  focusFields: MetadataFieldType[];
  excludeFields: MetadataFieldType[];
}

export const PERSONA_VIEWS: PersonaView[] = [
  {
    persona: 'governance_lead',
    name: 'Data Governance Lead',
    description: 'Focus on overall governance strategy and metrics',
    focusFields: ['ownerUsers', 'ownerGroups', 'atlanTags', 'certificateStatus', 'glossaryTerms'],
    excludeFields: ['lineage', 'starredBy'],
  },
  {
    persona: 'data_steward',
    name: 'Data Steward',
    description: 'Focus on governance, classification, and ownership',
    focusFields: ['ownerUsers', 'ownerGroups', 'atlanTags', 'certificateStatus', 'glossaryTerms'],
    excludeFields: ['lineage', 'starredBy'],
  },
  {
    persona: 'compliance_officer',
    name: 'Compliance Officer',
    description: 'Focus on classification, access, and audit readiness',
    focusFields: ['atlanTags', 'accessPolicies', 'certificateStatus', 'lineage'],
    excludeFields: ['starredBy', 'readme'],
  },
  {
    persona: 'data_analyst',
    name: 'Data Analyst',
    description: 'Focus on discoverability and understanding',
    focusFields: ['description', 'glossaryTerms', 'certificateStatus', 'readme', 'starredBy'],
    excludeFields: ['accessPolicies', 'customMetadata'],
  },
  {
    persona: 'data_engineer',
    name: 'Data Engineer',
    description: 'Focus on lineage, quality, and technical metadata',
    focusFields: ['lineage', 'description', 'customMetadata', 'links'],
    excludeFields: ['glossaryTerms', 'certificateStatus', 'starredBy'],
  },
  {
    persona: 'executive',
    name: 'Executive',
    description: 'Focus on high-level metrics and progress',
    focusFields: ['ownerUsers', 'certificateStatus', 'atlanTags'],
    excludeFields: ['lineage', 'customMetadata', 'links', 'readme'],
  },
  {
    persona: 'atlan_csm',
    name: 'Atlan CSM/PS',
    description: 'Focus on adoption and customer success metrics',
    focusFields: ['ownerUsers', 'description', 'certificateStatus', 'glossaryTerms'],
    excludeFields: ['accessPolicies'],
  },
];
