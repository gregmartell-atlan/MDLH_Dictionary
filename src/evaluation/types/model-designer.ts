/**
 * Model Designer - Central Export
 *
 * Re-exports all types for the metadata model designer modules.
 */

// Core metadata field types
export * from './metadata-fields';

// Atlan API types (for service interactions)
export * from './atlan-api';

// Pattern templates
export * from './patterns';

// Domain model types (FieldRequirement is now re-exported from requirements.ts via domains.ts)
export {
  type OwnershipStyle,
  type StewardshipModel,
  type BoundaryType,
  type DomainModel,
  type BoundaryRule,
  type OwnershipModel,
  type Steward,
  type DomainTemplate,
  type DomainRelationship,
  type FieldRequirement,
  DOMAIN_TEMPLATES,
  getDomainTemplateById,
  createDomainFromTemplate,
} from './domains';

// Taxonomy types
export * from './taxonomy';

// Glossary structure types
export * from './glossary';

// Custom metadata schema types
export * from './custom-metadata';

// Requirements matrix types
export * from './requirements';
export * from './enrichment-plan';

// Canvas templates (visual designer)
export * from './canvas-templates';
