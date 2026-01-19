import { v4 as uuidv4 } from 'uuid';
import type { AssistantProject, MetadataModelRow } from '../types/metadata-assistant';
import type { RequirementsMatrix, AssetTypeRequirements, AssetType, FieldRequirement } from '../types/requirements';
import type { EnrichmentPlan, PlanVersion } from '../types/enrichment-plan';
import type { MetadataFieldType } from '../types/metadata-fields';

/**
 * Maps string asset types from the wizard to the strict AssetType enum
 */
function mapAssetType(type: string): AssetType {
  const normalized = type.toLowerCase();
  if (normalized.includes('table')) return 'Table';
  if (normalized.includes('view')) return 'View';
  if (normalized.includes('column')) return 'Column';
  if (normalized.includes('schema')) return 'Schema';
  if (normalized.includes('database')) return 'Database';
  if (normalized.includes('dashboard')) return 'Dashboard';
  if (normalized.includes('report')) return 'Report';
  if (normalized.includes('dataset')) return 'Dataset';
  if (normalized.includes('metric')) return 'Model'; // Mapping metrics to Model for now
  if (normalized.includes('glossary')) return 'Table'; // Fallback
  return 'Table'; // Default fallback
}

/**
 * Maps metadata elements to FieldRequirements
 */
function mapRequirements(elements: MetadataFieldType[]): FieldRequirement[] {
  return elements.map(field => ({
    field,
    requirement: 'required', // Default to required for generated plans
    helpText: `Generated requirement for ${field}`,
  }));
}

/**
 * Converts a Metadata Assistant Project into a Requirements Matrix Plan
 */
export function convertProjectToPlan(project: AssistantProject): EnrichmentPlan {
  // Group rows by asset type
  const requirementsByAsset = new Map<AssetType, Set<MetadataFieldType>>();

  project.metadataModel.forEach((row: MetadataModelRow) => {
    const assetType = mapAssetType(row.assetType);
    
    if (!requirementsByAsset.has(assetType)) {
      requirementsByAsset.set(assetType, new Set());
    }
    
    const currentSet = requirementsByAsset.get(assetType)!;
    row.metadataElements.forEach(element => currentSet.add(element));
  });

  // Convert map to array
  const assetTypeRequirements: AssetTypeRequirements[] = Array.from(requirementsByAsset.entries()).map(([assetType, fields]) => ({
    assetType,
    requirements: mapRequirements(Array.from(fields))
  }));

  const matrix: RequirementsMatrix = {
    id: uuidv4(),
    name: project.name,
    description: project.description,
    status: 'draft',
    owner: 'Metadata Assistant',
    targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    assetTypeRequirements,
    domainOverrides: [],
    connectorOverrides: [],
    certificationRules: [],
    conditionalRules: []
  };

  const now = new Date().toISOString();
  const initialVersion: PlanVersion = {
    id: uuidv4(),
    versionNumber: 1,
    createdAt: now,
    createdBy: 'assistant',
    description: 'Initial generation from Metadata Assistant',
    matrix: matrix,
    changeLog: ['Created from project: ' + project.name]
  };

  return {
    id: uuidv4(),
    name: project.name,
    description: project.description,
    domains: project.domains,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    currentMatrix: matrix,
    versions: [initialVersion],
    activeDraft: initialVersion,
    targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    managers: (project.stakeholders || [])
      .filter((s) => s.role.toLowerCase().includes('manager') || s.role.toLowerCase().includes('lead'))
      .map((s) => s.email),
    reviewers: (project.stakeholders || [])
      .filter((s) => s.role.toLowerCase().includes('reviewer') || s.role.toLowerCase().includes('approver'))
      .map((s) => s.email),
    owners: (project.stakeholders || [])
      .filter((s) => s.role.toLowerCase().includes('owner'))
      .map((s) => s.email),
    owner: (project.stakeholders || []).find((s) => s.role.toLowerCase().includes('owner'))?.email,
    contributors: {},
    requirements: [],
    progress: [],
    createdBy: 'assistant'
  };
}
