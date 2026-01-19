/**
 * Propagator Config Generator
 * Module G from spec v2
 * 
 * Generates valid Metadata Propagator configurations
 * for automated metadata enrichment.
 */

import type { PropagatorConfig, MetadataFieldType } from '../types/metadata-assistant';

/**
 * Field mappings that are safe for propagation
 * Tags attach differently than other metadata
 */
export const PROPAGATABLE_FIELDS: Record<string, { 
  customMetadataGroup?: string; 
  attribute?: string;
  propagationType: 'standard' | 'tag';
  defaultDirection: 'downstream' | 'upstream';
}> = {
  description: { 
    propagationType: 'standard', 
    defaultDirection: 'downstream',
  },
  ownerUsers: { 
    propagationType: 'standard', 
    defaultDirection: 'downstream',
  },
  glossaryTerms: { 
    propagationType: 'standard', 
    defaultDirection: 'downstream',
  },
  certificateStatus: { 
    propagationType: 'standard', 
    defaultDirection: 'downstream',
  },
  // Custom metadata examples
  'Quality.SLA': {
    customMetadataGroup: 'Quality',
    attribute: 'SLA',
    propagationType: 'standard',
    defaultDirection: 'downstream',
  },
  'Quality.DQ_Score': {
    customMetadataGroup: 'Quality',
    attribute: 'DQ_Score',
    propagationType: 'standard',
    defaultDirection: 'downstream',
  },
  'Governance.Sensitivity': {
    customMetadataGroup: 'Governance',
    attribute: 'Sensitivity',
    propagationType: 'standard',
    defaultDirection: 'downstream',
  },
  'Governance.Retention_Policy': {
    customMetadataGroup: 'Governance',
    attribute: 'Retention_Policy',
    propagationType: 'standard',
    defaultDirection: 'downstream',
  },
  'Context.Source_System': {
    customMetadataGroup: 'Context',
    attribute: 'Source_System',
    propagationType: 'standard',
    defaultDirection: 'downstream',
  },
  // Tags propagate differently
  atlanTags: {
    propagationType: 'tag',
    defaultDirection: 'downstream',
  },
};

/**
 * Generate a Propagator config for a specific field
 */
export function generatePropagatorConfig(
  field: MetadataFieldType | string,
  options: {
    direction?: 'upstream' | 'downstream';
    behavior?: 'soft_append' | 'overwrite' | 'merge';
    customMetadataGroup?: string;
  } = {}
): PropagatorConfig | null {
  const fieldInfo = PROPAGATABLE_FIELDS[field];
  
  if (!fieldInfo) {
    console.warn(`Field ${field} is not configured for propagation`);
    return null;
  }
  
  // Tags use special syntax
  if (fieldInfo.propagationType === 'tag') {
    return {
      tool: 'Metadata Propagator',
      configString: `tags@@@tags`, // Special syntax for tags
      direction: options.direction || fieldInfo.defaultDirection,
      behavior: 'soft_append', // Tags always append
    };
  }
  
  // Custom metadata uses Group.Attribute@@@Group.Attribute
  if (fieldInfo.customMetadataGroup) {
    const group = options.customMetadataGroup || fieldInfo.customMetadataGroup;
    const attr = fieldInfo.attribute;
    return {
      tool: 'Metadata Propagator',
      configString: `${group}.${attr}@@@${group}.${attr}`,
      direction: options.direction || fieldInfo.defaultDirection,
      behavior: options.behavior || 'soft_append',
    };
  }
  
  // OOTB fields use simple field name
  return {
    tool: 'Metadata Propagator',
    configString: `${field}@@@${field}`,
    direction: options.direction || fieldInfo.defaultDirection,
    behavior: options.behavior || 'soft_append',
  };
}

/**
 * Generate propagator configs for a set of fields
 */
export function generatePropagatorConfigs(
  fields: Array<MetadataFieldType | string>,
  direction: 'upstream' | 'downstream' = 'downstream'
): PropagatorConfig[] {
  return fields
    .map(field => generatePropagatorConfig(field, { direction }))
    .filter((config): config is PropagatorConfig => config !== null);
}

/**
 * Recommend fields for propagation based on asset lineage
 */
export function recommendPropagationFields(context: {
  sourceAssetType: string;
  targetAssetType: string;
  existingMetadata: Array<MetadataFieldType | string>;
}): Array<MetadataFieldType | string> {
  const { sourceAssetType, targetAssetType, existingMetadata } = context;
  
  // Common propagation patterns
  const tableToView = ['description', 'ownerUsers', 'glossaryTerms', 'Quality.SLA', 'Governance.Sensitivity'];
  const tableToDashboard = ['ownerUsers', 'glossaryTerms', 'certificateStatus', 'Governance.Sensitivity'];
  const viewToView = ['description', 'ownerUsers', 'glossaryTerms', 'certificateStatus'];
  
  let recommended: Array<MetadataFieldType | string> = [];
  
  if (sourceAssetType.includes('Table') && targetAssetType.includes('View')) {
    recommended = tableToView;
  } else if (sourceAssetType.includes('Table') && targetAssetType.includes('Dashboard')) {
    recommended = tableToDashboard;
  } else if (sourceAssetType.includes('View') && targetAssetType.includes('View')) {
    recommended = viewToView;
  } else {
    // Default safe set
    recommended = ['description', 'ownerUsers', 'glossaryTerms'];
  }
  
  // Filter to only fields that exist in source
  return recommended.filter(field => existingMetadata.includes(field as MetadataFieldType));
}

/**
 * Generate example propagator config string for documentation
 */
export function generateExampleConfig(): string {
  return `# Metadata Propagator Configuration Examples

## OOTB Fields
- Description: \`description@@@description\`
- Owners: \`ownerUsers@@@ownerUsers\`
- Glossary Terms: \`glossaryTerms@@@glossaryTerms\`
- Certificate: \`certificateStatus@@@certificateStatus\`

## Custom Metadata
- Quality SLA: \`Quality.SLA@@@Quality.SLA\`
- DQ Score: \`Quality.DQ_Score@@@Quality.DQ_Score\`
- Sensitivity: \`Governance.Sensitivity@@@Governance.Sensitivity\`
- Source System: \`Context.Source_System@@@Context.Source_System\`

## Tags (Special Syntax)
- Tags: \`tags@@@tags\`

## Direction Options
- downstream: upstream table → downstream views/dashboards
- upstream: downstream changes → upstream sources (rare)

## Behavior Options
- soft_append: Add if missing, don't overwrite
- overwrite: Replace existing value
- merge: Combine values (for multi-value fields)
`;
}
