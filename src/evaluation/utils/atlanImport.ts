import { v4 as uuidv4 } from 'uuid';
import type {
  MetadataModel,
  EntityDefinition,
  AttributeDefinition,
  AtlanAssetCategory,
  AtlanAssetType,
  EdgeDefinition,
  RelationshipDefinition,
} from '../types';
import type { AtlanAssetSummary } from '../services/atlanApi';
import type { CatalogAsset, AssetTypeCategory } from '../stores/catalogStore';

type TypeMapping = {
  category: AtlanAssetCategory;
  assetType: AtlanAssetType;
};

const TYPE_MAP: Record<string, TypeMapping> = {
  table: { category: 'SQL', assetType: 'Table' },
  view: { category: 'SQL', assetType: 'View' },
  materializedview: { category: 'SQL', assetType: 'MaterializedView' },
  database: { category: 'SQL', assetType: 'Database' },
  schema: { category: 'SQL', assetType: 'Schema' },
  column: { category: 'SQL', assetType: 'Column' },
  function: { category: 'SQL', assetType: 'Function' },
  procedure: { category: 'SQL', assetType: 'Procedure' },
  'tableauworkbook': { category: 'BI', assetType: 'TableauWorkbook' },
  'tableaudashboard': { category: 'BI', assetType: 'TableauDashboard' },
  'tableauworksheet': { category: 'BI', assetType: 'TableauWorksheet' },
  'powerbireport': { category: 'BI', assetType: 'PowerBIReport' },
  'powerbidashboard': { category: 'BI', assetType: 'PowerBIDashboard' },
  'powerbidataset': { category: 'BI', assetType: 'PowerBIDataset' },
  'powerbiworkspace': { category: 'BI', assetType: 'PowerBIWorkspace' },
  'lookerdashboard': { category: 'BI', assetType: 'LookerDashboard' },
  'lookerexplore': { category: 'BI', assetType: 'LookerExplore' },
  'lookerproject': { category: 'BI', assetType: 'LookerProject' },
  'apipath': { category: 'API', assetType: 'APIPath' },
  'apioperation': { category: 'API', assetType: 'APIOperation' },
  'apispec': { category: 'API', assetType: 'APISpec' },
  's3bucket': { category: 'ObjectStore', assetType: 'S3Bucket' },
  's3object': { category: 'ObjectStore', assetType: 'S3Object' },
  'gcsbucket': { category: 'ObjectStore', assetType: 'GCSBucket' },
  'gcsobject': { category: 'ObjectStore', assetType: 'GCSObject' },
  'adlscontainer': { category: 'ObjectStore', assetType: 'ADLSContainer' },
  'adlsobject': { category: 'ObjectStore', assetType: 'ADLSObject' },
  'kafkatopic': { category: 'EventStore', assetType: 'KafkaTopic' },
  'kafkaconsumergroup': { category: 'EventStore', assetType: 'KafkaConsumerGroup' },
};

const FALLBACK: TypeMapping = { category: 'Custom', assetType: 'CustomEntity' };

function mapType(typeName: string): TypeMapping {
  const normalized = typeName.toLowerCase();
  return TYPE_MAP[normalized] || FALLBACK;
}

const HIERARCHY_LEVELS: Partial<Record<AtlanAssetType, number>> = {
  Database: 0,
  Schema: 1,
  Table: 2,
  View: 2,
  MaterializedView: 2,
  Column: 3,
  Function: 2,
  Procedure: 2,
  S3Bucket: 0,
  GCSBucket: 0,
  ADLSContainer: 0,
  S3Object: 1,
  GCSObject: 1,
  ADLSObject: 1,
  KafkaTopic: 0,
  KafkaConsumerGroup: 1,
  TableauWorkbook: 0,
  TableauDashboard: 1,
  TableauWorksheet: 2,
  PowerBIWorkspace: 0,
  PowerBIDashboard: 1,
  PowerBIReport: 1,
  PowerBIDataset: 1,
  LookerProject: 0,
  LookerDashboard: 1,
  LookerExplore: 1,
  APIPath: 1,
  APIOperation: 2,
  APISpec: 0,
  AirflowDag: 0,
  AirflowTask: 1,
  DbtSource: 0,
  DbtModel: 1,
  DbtTest: 2,
  DbtMetric: 1,
  DataDomain: 0,
  DataProduct: 1,
  MongoDBDatabase: 0,
  MongoDBCollection: 1,
  DynamoDBTable: 0,
  CosmosDBContainer: 0,
  EventHubNamespace: 0,
  EventHub: 1,
  CustomEntity: 0,
};

interface BuildModelOptions {
  modelName?: string;
  includeColumns?: boolean;
  connectors?: string[];
}

function buildHierarchy(
  entities: EntityDefinition[]
): { edges: EdgeDefinition[]; entitiesWithRelationships: EntityDefinition[] } {
  const qnToId = new Map<string, { id: string; assetType: AtlanAssetType }>();
  const edges: EdgeDefinition[] = [];
  const entitiesWithRelationships = entities.map((entity) => ({
    ...entity,
    relationships: [...entity.relationships],
  }));

  const normalize = (value?: string) => (value || '').toLowerCase();

  entities.forEach((entity) => {
    const assetType = entity.assetType || 'CustomEntity';
    qnToId.set(normalize(entity.name), { id: entity.id, assetType });
    qnToId.set(normalize(entity.displayName), { id: entity.id, assetType });
  });

  const parseSegments = (qualifiedName: string) => {
    const slashSplit = qualifiedName.split('/');
    const dotSplit = qualifiedName.split('.');
    const chosen = slashSplit.length > dotSplit.length ? slashSplit : dotSplit;
    return chosen.map((part) => part.trim()).filter(Boolean);
  };

  entities.forEach((entity) => {
    const entityAssetType = entity.assetType || 'CustomEntity';
    const level = HIERARCHY_LEVELS[entityAssetType] ?? -1;
    if (level <= 0) return;

    const segments = parseSegments(entity.name || entity.displayName || '');
    if (segments.length < 2) return;

    const parentSegments = segments.slice(0, -1);
    const parentKey = normalize(parentSegments.join('/'));
    const parent = qnToId.get(parentKey);

    if (!parent) return;

    const parentLevel = HIERARCHY_LEVELS[parent.assetType] ?? -1;
    if (parentLevel !== level - 1) return;

    const relationshipId = uuidv4();
    const rel: RelationshipDefinition = {
      id: relationshipId,
      name: 'contains',
      targetEntityId: entity.id,
      cardinality: 'one-to-many',
    };

    const parentEntityIndex = entitiesWithRelationships.findIndex((e) => e.id === parent.id);
    if (parentEntityIndex >= 0) {
      entitiesWithRelationships[parentEntityIndex] = {
        ...entitiesWithRelationships[parentEntityIndex],
        relationships: [...entitiesWithRelationships[parentEntityIndex].relationships, rel],
      };
    }

    edges.push({
      id: uuidv4(),
      source: parent.id,
      target: entity.id,
      label: 'contains',
      relationshipId: relationshipId,
    });
  });

  return { edges, entitiesWithRelationships };
}

// Layout configuration
const CONNECTOR_COLUMN_WIDTH = 600;
const HIERARCHY_ROW_HEIGHT = 200;
const ENTITY_SPACING_X = 280;
const ENTITY_SPACING_Y = 120;

interface LayoutOptions {
  connectorIndex: number;
  typeIndex: number;
  itemIndex: number;
  level: number;
  totalInType: number;
}

function calculatePosition(options: LayoutOptions): { x: number; y: number } {
  const { connectorIndex, itemIndex, level } = options;

  // Organize in a grid within each connector column
  const itemsPerRow = 3;
  const row = Math.floor(itemIndex / itemsPerRow);
  const col = itemIndex % itemsPerRow;

  return {
    x: 100 + connectorIndex * CONNECTOR_COLUMN_WIDTH + col * ENTITY_SPACING_X,
    y: 100 + level * HIERARCHY_ROW_HEIGHT + row * ENTITY_SPACING_Y,
  };
}

function buildActualAttributes(asset: AtlanAssetSummary): AttributeDefinition[] {
  const attributes: AttributeDefinition[] = [];

  // Always include core identifiers
  attributes.push({
    id: uuidv4(),
    name: 'qualifiedName',
    displayName: 'Qualified Name',
    type: 'string',
    required: true,
    description: 'Unique identifier in Atlan',
    value: asset.qualifiedName,
  });

  attributes.push({
    id: uuidv4(),
    name: 'name',
    displayName: 'Name',
    type: 'string',
    required: true,
    value: asset.name,
  });

  // Add actual attributes from the asset (guard against undefined)
  const attrMap = asset.attributes || {};

  if (attrMap.description) {
    attributes.push({
      id: uuidv4(),
      name: 'description',
      displayName: 'Description',
      type: 'string',
      required: false,
      value: attrMap.description as string,
    });
  }

  if (attrMap.userDescription) {
    attributes.push({
      id: uuidv4(),
      name: 'userDescription',
      displayName: 'User Description',
      type: 'string',
      required: false,
      value: attrMap.userDescription as string,
    });
  }

  if (attrMap.ownerUsers && Array.isArray(attrMap.ownerUsers) && attrMap.ownerUsers.length > 0) {
    attributes.push({
      id: uuidv4(),
      name: 'ownerUsers',
      displayName: 'Owners',
      type: 'array',
      required: false,
      value: (attrMap.ownerUsers as string[]).join(', '),
    });
  }

  if (attrMap.certificateStatus) {
    attributes.push({
      id: uuidv4(),
      name: 'certificateStatus',
      displayName: 'Certificate',
      type: 'string',
      required: false,
      value: attrMap.certificateStatus as string,
    });
  }

  if (attrMap.connectionName) {
    attributes.push({
      id: uuidv4(),
      name: 'connectionName',
      displayName: 'Connection',
      type: 'string',
      required: false,
      value: attrMap.connectionName as string,
    });
  }

  // Add tags if present
  if (attrMap.atlanTags && Array.isArray(attrMap.atlanTags) && attrMap.atlanTags.length > 0) {
    const tagNames = (attrMap.atlanTags as Array<{ typeName: string }>).map(t => t.typeName);
    attributes.push({
      id: uuidv4(),
      name: 'atlanTags',
      displayName: 'Tags',
      type: 'array',
      required: false,
      value: tagNames.join(', '),
    });
  }

  // Add glossary terms if present
  if (attrMap.meanings && Array.isArray(attrMap.meanings) && attrMap.meanings.length > 0) {
    const termNames = (attrMap.meanings as Array<{ displayText: string }>).map(t => t.displayText);
    attributes.push({
      id: uuidv4(),
      name: 'glossaryTerms',
      displayName: 'Glossary Terms',
      type: 'array',
      required: false,
      value: termNames.join(', '),
    });
  }

  // Add owner groups if present
  if (attrMap.ownerGroups && Array.isArray(attrMap.ownerGroups) && attrMap.ownerGroups.length > 0) {
    attributes.push({
      id: uuidv4(),
      name: 'ownerGroups',
      displayName: 'Owner Groups',
      type: 'array',
      required: false,
      value: (attrMap.ownerGroups as string[]).join(', '),
    });
  }

  // Add README if present
  if (attrMap.readme) {
    attributes.push({
      id: uuidv4(),
      name: 'readme',
      displayName: 'README',
      type: 'string',
      required: false,
      value: attrMap.readme as string,
    });
  }

  // Add links if present
  if (attrMap.links && Array.isArray(attrMap.links) && attrMap.links.length > 0) {
    attributes.push({
      id: uuidv4(),
      name: 'links',
      displayName: 'Links',
      type: 'array',
      required: false,
      value: JSON.stringify(attrMap.links),
    });
  }

  // Add starred by count if present (indicates social proof)
  if (attrMap.starredCount && typeof attrMap.starredCount === 'number' && attrMap.starredCount > 0) {
    attributes.push({
      id: uuidv4(),
      name: 'starredBy',
      displayName: 'Starred By',
      type: 'number',
      required: false,
      value: attrMap.starredCount as number,
    });
  }

  // Indicate lineage presence (upstream/downstream counts)
  const hasLineage =
    (attrMap.__hasLineage === true) ||
    (typeof attrMap.inputToProcesses !== 'undefined' && Array.isArray(attrMap.inputToProcesses) && attrMap.inputToProcesses.length > 0) ||
    (typeof attrMap.outputFromProcesses !== 'undefined' && Array.isArray(attrMap.outputFromProcesses) && attrMap.outputFromProcesses.length > 0);

  if (hasLineage) {
    attributes.push({
      id: uuidv4(),
      name: 'lineage',
      displayName: 'Lineage',
      type: 'boolean',
      required: false,
      value: true,
    });
  }

  // Add custom metadata if present
  // Custom metadata in Atlan is stored under businessAttributes
  if (attrMap.businessAttributes && typeof attrMap.businessAttributes === 'object') {
    const customMetadataKeys = Object.keys(attrMap.businessAttributes);
    if (customMetadataKeys.length > 0) {
      attributes.push({
        id: uuidv4(),
        name: 'customMetadata',
        displayName: 'Custom Metadata',
        type: 'string',
        required: false,
        value: customMetadataKeys.join(', '),
      });
    }
  }

  // Add access policies indicator if present
  if (attrMap.accessPolicies && Array.isArray(attrMap.accessPolicies) && attrMap.accessPolicies.length > 0) {
    attributes.push({
      id: uuidv4(),
      name: 'accessPolicies',
      displayName: 'Access Policies',
      type: 'array',
      required: false,
      value: `${attrMap.accessPolicies.length} policies`,
    });
  }

  return attributes;
}

export function buildModelFromAssets(
  assets: AtlanAssetSummary[],
  options?: BuildModelOptions
): MetadataModel {
  const now = new Date().toISOString();
  const includeColumns = options?.includeColumns ?? false;

  // Deduplicate by qualifiedName
  const seen = new Set<string>();
  const filteredAssets = assets.filter((asset) => {
    const key = (asset.qualifiedName || asset.guid || asset.name).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Group assets by connector, then by type
  const byConnector = new Map<string, Map<string, AtlanAssetSummary[]>>();

  filteredAssets.forEach((asset) => {
    const mapping = mapType(asset.typeName);
    if (!includeColumns && mapping.assetType === 'Column') return;

    const connector = asset.connectorName || 'unknown';
    const assetType = mapping.assetType;

    if (!byConnector.has(connector)) {
      byConnector.set(connector, new Map());
    }
    const connectorMap = byConnector.get(connector)!;

    if (!connectorMap.has(assetType)) {
      connectorMap.set(assetType, []);
    }
    connectorMap.get(assetType)!.push(asset);
  });

  // Build entities with organized layout
  const connectorList = Array.from(byConnector.keys()).sort();
  const entities: EntityDefinition[] = [];

  connectorList.forEach((connector, connectorIndex) => {
    const typeMap = byConnector.get(connector)!;
    const sortedTypes = Array.from(typeMap.keys()).sort((a, b) => {
      const levelA = HIERARCHY_LEVELS[a as AtlanAssetType] ?? 99;
      const levelB = HIERARCHY_LEVELS[b as AtlanAssetType] ?? 99;
      return levelA - levelB;
    });

    sortedTypes.forEach((assetType, typeIndex) => {
      const assetsOfType = typeMap.get(assetType)!;
      const mapping = mapType(assetType);
      const level = HIERARCHY_LEVELS[mapping.assetType] ?? 0;

      assetsOfType.forEach((asset, itemIndex) => {
        const position = calculatePosition({
          connectorIndex,
          typeIndex,
          itemIndex,
          level,
          totalInType: assetsOfType.length,
        });

        // Use actual attributes from Atlan
        const attributes = buildActualAttributes(asset);

        entities.push({
          id: uuidv4(),
          name: asset.qualifiedName || asset.name,
          displayName: asset.name || asset.typeName,
          category: mapping.category,
          assetType: mapping.assetType,
          connectorName: connector,
          description:
            (asset.attributes.description as string | undefined) ||
            (asset.attributes.userDescription as string | undefined) ||
            '',
          attributes,
          relationships: [],
          position,
        });
      });
    });
  });

  const { edges, entitiesWithRelationships } = buildHierarchy(entities);

  // Create page-based model structure
  const pageId = uuidv4();
  const page = {
    id: pageId,
    name: 'Page 1',
    description: '',
    entities: entitiesWithRelationships,
    edges,
    createdAt: now,
    updatedAt: now,
  };

  return {
    id: uuidv4(),
    name: options?.modelName || 'Atlan Import',
    description: `Imported ${entities.length} assets from ${connectorList.length} connector(s): ${connectorList.join(', ')}`,
    pages: [page],
    activePageId: pageId,
    enrichmentPlans: [],
    domains: [],
    customMetadata: [],
    versions: [],
    requirementsMatrix: null,
    // Legacy fields for backwards compat
    entities: entitiesWithRelationships,
    edges,
    createdAt: now,
    updatedAt: now,
  };
}

// ============================================
// CATALOG TO CANVAS CONVERSION
// Convert CatalogAsset[] to EntityDefinition[] for selective canvas population
// ============================================

// Map catalog type categories to our asset types
const CATALOG_TYPE_TO_ASSET: Record<AssetTypeCategory, TypeMapping> = {
  Database: { category: 'SQL', assetType: 'Database' },
  Schema: { category: 'SQL', assetType: 'Schema' },
  Table: { category: 'SQL', assetType: 'Table' },
  View: { category: 'SQL', assetType: 'View' },
  Column: { category: 'SQL', assetType: 'Column' },
  Query: { category: 'Custom', assetType: 'CustomEntity' },
  Dashboard: { category: 'BI', assetType: 'TableauDashboard' },
  Report: { category: 'BI', assetType: 'TableauWorksheet' },
  Dataset: { category: 'BI', assetType: 'PowerBIDataset' },
  API: { category: 'API', assetType: 'APIPath' },
  Pipeline: { category: 'Airflow', assetType: 'AirflowDag' },
  Other: { category: 'Custom', assetType: 'CustomEntity' },
};

/**
 * Convert catalog assets to canvas entities
 * Positions entities in a clean grid layout based on type hierarchy
 */
export function catalogAssetsToEntities(
  assets: CatalogAsset[],
  startPosition: { x: number; y: number } = { x: 100, y: 100 }
): EntityDefinition[] {
  // Group by normalized type for layout
  const byType = new Map<AssetTypeCategory, CatalogAsset[]>();

  assets.forEach((asset) => {
    const type = asset.normalizedType;
    if (!byType.has(type)) {
      byType.set(type, []);
    }
    byType.get(type)!.push(asset);
  });

  // Sort types by hierarchy level
  const typeOrder: AssetTypeCategory[] = [
    'Database', 'Schema', 'Table', 'View', 'Column',
    'Dashboard', 'Report', 'Dataset',
    'API', 'Pipeline', 'Query', 'Other'
  ];

  const sortedTypes = Array.from(byType.keys()).sort((a, b) => {
    return typeOrder.indexOf(a) - typeOrder.indexOf(b);
  });

  const entities: EntityDefinition[] = [];
  let currentY = startPosition.y;
  const rowHeight = 160;
  const colWidth = 300;
  const itemsPerRow = 4;

  sortedTypes.forEach((assetType) => {
    const assetsOfType = byType.get(assetType)!;
    const mapping = CATALOG_TYPE_TO_ASSET[assetType];

    assetsOfType.forEach((asset, index) => {
      const row = Math.floor(index / itemsPerRow);
      const col = index % itemsPerRow;

      const position = {
        x: startPosition.x + col * colWidth,
        y: currentY + row * rowHeight,
      };

      // Build attributes from catalog asset
      const attributes = buildActualAttributes({
        guid: asset.guid,
        name: asset.name,
        qualifiedName: asset.qualifiedName,
        typeName: asset.typeName,
        connectorName: asset.connectorName,
        attributes: asset.attributes,
      });

      entities.push({
        id: uuidv4(),
        name: asset.qualifiedName || asset.name,
        displayName: asset.name,
        category: mapping.category,
        assetType: mapping.assetType,
        connectorName: asset.connectorName,
        description: (asset.attributes.description as string | undefined) ||
                     (asset.attributes.userDescription as string | undefined) || '',
        attributes,
        relationships: [],
        position,
      });
    });

    // Move to next type group's starting Y position
    const rowsUsed = Math.ceil(assetsOfType.length / itemsPerRow);
    currentY += rowsUsed * rowHeight + 80; // Extra spacing between type groups
  });

  return entities;
}

/**
 * Get bounding box of existing entities to find free space for new ones
 */
export function getCanvasBounds(entities: EntityDefinition[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  if (entities.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  entities.forEach((entity) => {
    minX = Math.min(minX, entity.position.x);
    maxX = Math.max(maxX, entity.position.x + 280); // Approximate entity width
    minY = Math.min(minY, entity.position.y);
    maxY = Math.max(maxY, entity.position.y + 200); // Approximate entity height
  });

  return { minX, maxX, minY, maxY };
}

// ============================================
// HIERARCHICAL CATALOG TO CANVAS WITH RELATIONSHIPS
// Creates entities AND edges for parent-child relationships
// ============================================

/**
 * Result of converting catalog assets to canvas entities with relationships
 */
export interface EntitiesWithRelationshipsResult {
  entities: EntityDefinition[];
  edges: EdgeDefinition[];
  /** Map from catalog asset GUID to canvas entity ID */
  guidToEntityId: Map<string, string>;
}

/**
 * Convert catalog assets to canvas entities WITH auto-created relationships.
 * Uses hierarchical layout: Database → Schema → Table
 *
 * @param assets - Catalog assets to convert
 * @param startPosition - Starting position on canvas
 * @returns Entities, edges, and GUID mapping
 */
export function catalogAssetsToEntitiesWithRelationships(
  assets: CatalogAsset[],
  startPosition: { x: number; y: number } = { x: 100, y: 100 }
): EntitiesWithRelationshipsResult {
  const entities: EntityDefinition[] = [];
  const edges: EdgeDefinition[] = [];
  const guidToEntityId = new Map<string, string>();

  // Map from qualifiedName to entity info for relationship building
  const qnToEntity = new Map<string, { id: string; assetType: AtlanAssetType; level: number }>();

  // Group assets by hierarchy level
  const databases: CatalogAsset[] = [];
  const schemas: CatalogAsset[] = [];
  const tables: CatalogAsset[] = [];
  const columns: CatalogAsset[] = [];
  const others: CatalogAsset[] = [];

  assets.forEach((asset) => {
    switch (asset.normalizedType) {
      case 'Database':
        databases.push(asset);
        break;
      case 'Schema':
        schemas.push(asset);
        break;
      case 'Table':
      case 'View':
        tables.push(asset);
        break;
      case 'Column':
        columns.push(asset);
        break;
      default:
        others.push(asset);
    }
  });

  // Layout constants for hierarchical display
  const LEVEL_SPACING_Y = 200;
  const ITEM_SPACING_X = 320;
  const ITEM_SPACING_Y = 120;
  const ITEMS_PER_ROW = 5;

  // Helper to create entity and track it
  const createEntity = (
    asset: CatalogAsset,
    position: { x: number; y: number },
    level: number
  ): EntityDefinition => {
    const entityId = uuidv4();
    const mapping = CATALOG_TYPE_TO_ASSET[asset.normalizedType];

    // Track for relationship building
    guidToEntityId.set(asset.guid, entityId);
    qnToEntity.set(asset.qualifiedName.toLowerCase(), {
      id: entityId,
      assetType: mapping.assetType,
      level,
    });

    const attributes = buildActualAttributes({
      guid: asset.guid,
      name: asset.name,
      qualifiedName: asset.qualifiedName,
      typeName: asset.typeName,
      connectorName: asset.connectorName,
      attributes: asset.attributes,
    });

    return {
      id: entityId,
      name: asset.qualifiedName || asset.name,
      displayName: asset.name,
      category: mapping.category,
      assetType: mapping.assetType,
      connectorName: asset.connectorName,
      description:
        (asset.attributes.description as string | undefined) ||
        (asset.attributes.userDescription as string | undefined) ||
        '',
      attributes,
      relationships: [],
      position,
    };
  };

  // Helper to find parent qualified name
  const getParentQualifiedName = (qn: string): string | null => {
    // Try slash separator first (e.g., "connector/db/schema/table")
    const slashParts = qn.split('/');
    if (slashParts.length > 1) {
      return slashParts.slice(0, -1).join('/').toLowerCase();
    }
    // Try dot separator (e.g., "db.schema.table")
    const dotParts = qn.split('.');
    if (dotParts.length > 1) {
      return dotParts.slice(0, -1).join('.').toLowerCase();
    }
    return null;
  };

  // Level 0: Databases
  let currentY = startPosition.y;
  databases.forEach((db, index) => {
    const row = Math.floor(index / ITEMS_PER_ROW);
    const col = index % ITEMS_PER_ROW;
    const position = {
      x: startPosition.x + col * ITEM_SPACING_X,
      y: currentY + row * ITEM_SPACING_Y,
    };
    entities.push(createEntity(db, position, 0));
  });
  if (databases.length > 0) {
    const dbRows = Math.ceil(databases.length / ITEMS_PER_ROW);
    currentY += dbRows * ITEM_SPACING_Y + LEVEL_SPACING_Y;
  }

  // Level 1: Schemas
  const schemaStartY = currentY;
  schemas.forEach((schema, index) => {
    const row = Math.floor(index / ITEMS_PER_ROW);
    const col = index % ITEMS_PER_ROW;
    const position = {
      x: startPosition.x + col * ITEM_SPACING_X,
      y: schemaStartY + row * ITEM_SPACING_Y,
    };
    entities.push(createEntity(schema, position, 1));
  });
  if (schemas.length > 0) {
    const schemaRows = Math.ceil(schemas.length / ITEMS_PER_ROW);
    currentY = schemaStartY + schemaRows * ITEM_SPACING_Y + LEVEL_SPACING_Y;
  }

  // Level 2: Tables/Views
  const tableStartY = currentY;
  tables.forEach((table, index) => {
    const row = Math.floor(index / ITEMS_PER_ROW);
    const col = index % ITEMS_PER_ROW;
    const position = {
      x: startPosition.x + col * ITEM_SPACING_X,
      y: tableStartY + row * ITEM_SPACING_Y,
    };
    entities.push(createEntity(table, position, 2));
  });
  if (tables.length > 0) {
    const tableRows = Math.ceil(tables.length / ITEMS_PER_ROW);
    currentY = tableStartY + tableRows * ITEM_SPACING_Y + LEVEL_SPACING_Y;
  }

  // Level 3: Columns (if included)
  const columnStartY = currentY;
  columns.forEach((column, index) => {
    const row = Math.floor(index / ITEMS_PER_ROW);
    const col = index % ITEMS_PER_ROW;
    const position = {
      x: startPosition.x + col * ITEM_SPACING_X,
      y: columnStartY + row * ITEM_SPACING_Y,
    };
    entities.push(createEntity(column, position, 3));
  });
  if (columns.length > 0) {
    const columnRows = Math.ceil(columns.length / ITEMS_PER_ROW);
    currentY = columnStartY + columnRows * ITEM_SPACING_Y + LEVEL_SPACING_Y;
  }

  // Other types at the end
  others.forEach((asset, index) => {
    const row = Math.floor(index / ITEMS_PER_ROW);
    const col = index % ITEMS_PER_ROW;
    const position = {
      x: startPosition.x + col * ITEM_SPACING_X,
      y: currentY + row * ITEM_SPACING_Y,
    };
    entities.push(createEntity(asset, position, 4));
  });

  // Build relationships based on qualified name hierarchy
  entities.forEach((entity) => {
    const parentQn = getParentQualifiedName(entity.name);
    if (!parentQn) return;

    const parentInfo = qnToEntity.get(parentQn);
    if (!parentInfo) return;

    // Verify parent is one level above
    const childInfo = qnToEntity.get(entity.name.toLowerCase());
    if (!childInfo || parentInfo.level !== childInfo.level - 1) return;

    // Create relationship
    const relationshipId = uuidv4();
    const rel: RelationshipDefinition = {
      id: relationshipId,
      name: 'contains',
      targetEntityId: entity.id,
      cardinality: 'one-to-many',
    };

    // Add relationship to parent entity
    const parentEntity = entities.find((e) => e.id === parentInfo.id);
    if (parentEntity) {
      parentEntity.relationships.push(rel);
    }

    // Create edge
    edges.push({
      id: uuidv4(),
      source: parentInfo.id,
      target: entity.id,
      label: 'contains',
      relationshipId,
    });
  });

  return { entities, edges, guidToEntityId };
}

/**
 * Get child counts for an asset (used for "Include children?" modal)
 */
export function getChildCounts(
  parentAsset: CatalogAsset,
  allAssets: CatalogAsset[]
): { schemas: number; tables: number; columns: number; total: number } {
  const parentQn = parentAsset.qualifiedName.toLowerCase();

  let schemas = 0;
  let tables = 0;
  let columns = 0;

  allAssets.forEach((asset) => {
    const assetQn = asset.qualifiedName.toLowerCase();
    // Check if this asset's qualified name starts with parent's
    if (assetQn !== parentQn && assetQn.startsWith(parentQn)) {
      switch (asset.normalizedType) {
        case 'Schema':
          schemas++;
          break;
        case 'Table':
        case 'View':
          tables++;
          break;
        case 'Column':
          columns++;
          break;
      }
    }
  });

  return { schemas, tables, columns, total: schemas + tables + columns };
}

/**
 * Filter assets to get all children of a parent asset
 */
export function getChildAssets(
  parentAsset: CatalogAsset,
  allAssets: CatalogAsset[],
  includeColumns: boolean = false
): CatalogAsset[] {
  const parentQn = parentAsset.qualifiedName.toLowerCase();

  return allAssets.filter((asset) => {
    const assetQn = asset.qualifiedName.toLowerCase();
    if (assetQn === parentQn) return false; // Exclude parent itself
    if (!assetQn.startsWith(parentQn)) return false; // Must be a child
    if (!includeColumns && asset.normalizedType === 'Column') return false;
    return true;
  });
}

// ============================================
// EXPLORER NODE TO CANVAS CONVERSION
// Convert dragged ExplorerNode to canvas entities
// ============================================

/**
 * ExplorerNode type for drag data (matches AtlanExplorer.tsx)
 */
export interface ExplorerNodeDragData {
  id: string;
  guid?: string;
  name: string;
  qualifiedName: string;
  type: 'connector' | 'database' | 'schema' | 'table' | 'view' | 'column';
  connectorName?: string;
  children?: ExplorerNodeDragData[];
  childCount?: number;
  isLoaded?: boolean;
  asset?: AtlanAssetSummary;
  hasLineage?: boolean;
  hasOwner?: boolean;
  hasDescription?: boolean;
  rowCount?: number;
  columnCount?: number;
}

/**
 * Map ExplorerNode type to asset type
 */
const EXPLORER_TYPE_MAP: Record<string, TypeMapping> = {
  connector: { category: 'Custom', assetType: 'CustomEntity' },
  database: { category: 'SQL', assetType: 'Database' },
  schema: { category: 'SQL', assetType: 'Schema' },
  table: { category: 'SQL', assetType: 'Table' },
  view: { category: 'SQL', assetType: 'View' },
  column: { category: 'SQL', assetType: 'Column' },
};

/**
 * Convert a dragged ExplorerNode (with optional children) to canvas entities
 * Uses hierarchical layout based on node type
 */
export function explorerNodeToEntities(
  node: ExplorerNodeDragData,
  dropPosition: { x: number; y: number },
  includeChildren: boolean = true
): EntitiesWithRelationshipsResult {
  const entities: EntityDefinition[] = [];
  const edges: EdgeDefinition[] = [];
  const guidToEntityId = new Map<string, string>();
  const qnToEntity = new Map<string, { id: string; level: number }>();

  // Layout constants - entity card is approximately 260px wide
  const NODE_WIDTH = 280;
  const NODE_HEIGHT = 140;
  const HORIZONTAL_GAP = 40;
  const VERTICAL_GAP = 80;

  // Tree layout data structure
  interface LayoutNode {
    node: ExplorerNodeDragData;
    entityId: string;
    children: LayoutNode[];
    width: number; // subtree width
    x: number;
    y: number;
  }

  // Build layout tree recursively
  const buildLayoutTree = (n: ExplorerNodeDragData, depth: number): LayoutNode => {
    const entityId = uuidv4();

    // Track for relationship building
    if (n.guid) {
      guidToEntityId.set(n.guid, entityId);
    }
    qnToEntity.set(n.qualifiedName.toLowerCase(), { id: entityId, level: depth });

    const children: LayoutNode[] = [];
    if (includeChildren && n.children && n.children.length > 0) {
      n.children.forEach((child) => {
        children.push(buildLayoutTree(child, depth + 1));
      });
    }

    // Calculate subtree width (sum of children widths, or single node width)
    let width = NODE_WIDTH;
    if (children.length > 0) {
      width = children.reduce((sum, c) => sum + c.width, 0) + (children.length - 1) * HORIZONTAL_GAP;
    }

    return {
      node: n,
      entityId,
      children,
      width,
      x: 0,
      y: 0,
    };
  };

  // Position nodes in tree layout
  const positionTree = (layoutNode: LayoutNode, x: number, y: number) => {
    layoutNode.y = y;

    if (layoutNode.children.length === 0) {
      // Leaf node - center at x
      layoutNode.x = x;
    } else {
      // Parent node - position children first, then center parent
      let childX = x - layoutNode.width / 2;

      layoutNode.children.forEach((child) => {
        const childCenterX = childX + child.width / 2;
        positionTree(child, childCenterX, y + NODE_HEIGHT + VERTICAL_GAP);
        childX += child.width + HORIZONTAL_GAP;
      });

      // Center parent above children
      const firstChild = layoutNode.children[0];
      const lastChild = layoutNode.children[layoutNode.children.length - 1];
      layoutNode.x = (firstChild.x + lastChild.x) / 2;
    }
  };

  // Convert layout node to entity
  const createEntity = (layoutNode: LayoutNode): void => {
    const n = layoutNode.node;
    const mapping = EXPLORER_TYPE_MAP[n.type] || FALLBACK;

    // Build attributes from node data
    const attributes: AttributeDefinition[] = [
      {
        id: uuidv4(),
        name: 'qualifiedName',
        displayName: 'Qualified Name',
        type: 'string',
        required: true,
        value: n.qualifiedName,
      },
      {
        id: uuidv4(),
        name: 'name',
        displayName: 'Name',
        type: 'string',
        required: true,
        value: n.name,
      },
    ];

    // Add metadata indicators as attributes
    if (n.hasLineage) {
      attributes.push({
        id: uuidv4(),
        name: 'lineage',
        displayName: 'Has Lineage',
        type: 'boolean',
        required: false,
        value: true,
      });
    }

    if (n.rowCount !== undefined) {
      attributes.push({
        id: uuidv4(),
        name: 'rowCount',
        displayName: 'Row Count',
        type: 'number',
        required: false,
        value: n.rowCount,
      });
    }

    if (n.columnCount !== undefined) {
      attributes.push({
        id: uuidv4(),
        name: 'columnCount',
        displayName: 'Column Count',
        type: 'number',
        required: false,
        value: n.columnCount,
      });
    }

    // If we have the full asset data, add more attributes
    if (n.asset) {
      const additionalAttrs = buildActualAttributes(n.asset);
      // Merge, avoiding duplicates
      additionalAttrs.forEach((attr) => {
        if (!attributes.find((a) => a.name === attr.name)) {
          attributes.push(attr);
        }
      });
    }

    const entity: EntityDefinition = {
      id: layoutNode.entityId,
      name: n.qualifiedName || n.name,
      displayName: n.name,
      category: mapping.category,
      assetType: mapping.assetType,
      connectorName: n.connectorName,
      description: '',
      attributes,
      relationships: [],
      position: {
        x: layoutNode.x - NODE_WIDTH / 2, // Convert center to top-left
        y: layoutNode.y,
      },
      atlanGuid: n.guid,
      atlanQualifiedName: n.qualifiedName,
    };

    entities.push(entity);

    // Create edges to children and recurse
    layoutNode.children.forEach((child) => {
      const relationshipId = uuidv4();
      const rel: RelationshipDefinition = {
        id: relationshipId,
        name: 'contains',
        targetEntityId: child.entityId,
        cardinality: 'one-to-many',
      };
      entity.relationships.push(rel);

      edges.push({
        id: uuidv4(),
        source: layoutNode.entityId,
        target: child.entityId,
        label: 'contains',
        relationshipId,
      });

      createEntity(child);
    });
  };

  // Build and position the layout tree
  const layoutTree = buildLayoutTree(node, 0);
  positionTree(layoutTree, dropPosition.x + layoutTree.width / 2, dropPosition.y);
  createEntity(layoutTree);

  return { entities, edges, guidToEntityId };
}
