// ============================================
// LINEAGE CSV IMPORT
// Parse Atlan impact analysis CSV exports and create entities + lineage edges
// ============================================

import { v4 as uuidv4 } from 'uuid';
import type {
  EntityDefinition,
  EdgeDefinition,
  AttributeDefinition,
  AtlanAssetCategory,
  AtlanAssetType,
} from '../types';

// ============================================
// TYPES
// ============================================

export interface LineageCSVRow {
  name: string;
  type: string;
  businessName?: string;
  connector: string;
  database?: string;
  schema?: string;
  tableView?: string;
  lineageDepth: number;
  description?: string;
  ownerUsers?: string;
  ownerGroups?: string;
  certificationStatus?: string;
  tags?: string;
  terms?: string;
  usage?: string;
  popularity?: string;
  qualifiedName: string;
  atlanUrl?: string;
  guid: string;
  immediateUpstream: string[];
  immediateDownstream: string[];
}

export interface LineageImportResult {
  entities: EntityDefinition[];
  edges: EdgeDefinition[];
  /** Map from qualified name to entity ID */
  qnToEntityId: Map<string, string>;
  /** All referenced qualified names (including those not in CSV, e.g., SILVER_COLORS in upstream CSV) */
  referencedQualifiedNames: Set<string>;
  /** Raw edge data for re-resolution during merge */
  rawEdges: Array<{ sourceQn: string; targetQn: string }>;
  /** Statistics about the import */
  stats: {
    totalAssets: number;
    lineageEdges: number;
    connectors: string[];
    maxDepth: number;
  };
}

// ============================================
// TYPE MAPPING
// ============================================

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
  s3object: { category: 'ObjectStore', assetType: 'S3Object' },
  s3bucket: { category: 'ObjectStore', assetType: 'S3Bucket' },
  kafkatopic: { category: 'EventStore', assetType: 'KafkaTopic' },
  kafkaconsumergroup: { category: 'EventStore', assetType: 'KafkaConsumerGroup' },
  tableauworkbook: { category: 'BI', assetType: 'TableauWorkbook' },
  tableaudashboard: { category: 'BI', assetType: 'TableauDashboard' },
  powerbireport: { category: 'BI', assetType: 'PowerBIReport' },
  powerbidashboard: { category: 'BI', assetType: 'PowerBIDashboard' },
  lookerexplore: { category: 'BI', assetType: 'LookerExplore' },
  lookerdashboard: { category: 'BI', assetType: 'LookerDashboard' },
};

const FALLBACK: TypeMapping = { category: 'Custom', assetType: 'CustomEntity' };

function mapType(typeName: string): TypeMapping {
  const normalized = typeName.toLowerCase().replace(/\s+/g, '');
  return TYPE_MAP[normalized] || FALLBACK;
}

// ============================================
// CSV PARSING
// ============================================

/**
 * Parse the Immediate Upstream/Downstream column format:
 * "Name(qualifiedName), Name2(qualifiedName2)"
 * Returns array of qualified names
 */
function parseLineageReferences(value: string): string[] {
  if (!value || value.trim() === '') return [];

  const refs: string[] = [];
  // Match pattern: Name(qualifiedName)
  // The qualified name is inside parentheses
  const regex = /([^(,]+)\(([^)]+)\)/g;
  let match;

  while ((match = regex.exec(value)) !== null) {
    const qualifiedName = match[2].trim();
    if (qualifiedName) {
      refs.push(qualifiedName);
    }
  }

  return refs;
}

/**
 * Parse CSV content into rows
 * Handles quoted fields with commas inside
 */
function parseCSV(csvContent: string): Record<string, string>[] {
  const lines = csvContent.split('\n');
  if (lines.length < 2) return [];

  // Parse header
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);

  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header.trim()] = values[index] || '';
    });

    rows.push(row);
  }

  return rows;
}

/**
 * Parse a single CSV line, handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

/**
 * Convert raw CSV row to typed LineageCSVRow
 */
function rowToLineageCSVRow(row: Record<string, string>): LineageCSVRow {
  return {
    name: row['Name'] || '',
    type: row['Type'] || '',
    businessName: row['Business Name'] || undefined,
    connector: row['Connector'] || '',
    database: row['Database'] || undefined,
    schema: row['Schema'] || undefined,
    tableView: row['Table/View'] || undefined,
    lineageDepth: parseInt(row['Lineage depth'] || '0', 10),
    description: row['Description'] || undefined,
    ownerUsers: row['Owner users'] || undefined,
    ownerGroups: row['Owner groups'] || undefined,
    certificationStatus: row['Certification Status'] || undefined,
    tags: row['Tags'] || undefined,
    terms: row['Terms'] || undefined,
    usage: row['Usage'] || undefined,
    popularity: row['Popularity'] || undefined,
    qualifiedName: row['Qualified Name'] || '',
    atlanUrl: row['Atlan URL'] || undefined,
    guid: row['Impacted Asset GUID'] || '',
    immediateUpstream: parseLineageReferences(row['Immediate Upstream'] || ''),
    immediateDownstream: parseLineageReferences(row['Immediate Downstream'] || ''),
  };
}

// ============================================
// LAYOUT
// ============================================

const DEPTH_SPACING_X = 400;
const ITEM_SPACING_Y = 160;
const START_X = 100;
const START_Y = 100;

/**
 * Calculate position based on lineage depth
 * Depth 0 = leftmost, higher depth = further right
 */
function calculatePosition(depth: number, indexInDepth: number): { x: number; y: number } {
  return {
    x: START_X + depth * DEPTH_SPACING_X,
    y: START_Y + indexInDepth * ITEM_SPACING_Y,
  };
}

// ============================================
// ENTITY BUILDING
// ============================================

function buildAttributes(row: LineageCSVRow): AttributeDefinition[] {
  const attrs: AttributeDefinition[] = [];

  attrs.push({
    id: uuidv4(),
    name: 'qualifiedName',
    displayName: 'Qualified Name',
    type: 'string',
    required: true,
    value: row.qualifiedName,
  });

  attrs.push({
    id: uuidv4(),
    name: 'name',
    displayName: 'Name',
    type: 'string',
    required: true,
    value: row.name,
  });

  if (row.description) {
    attrs.push({
      id: uuidv4(),
      name: 'description',
      displayName: 'Description',
      type: 'string',
      required: false,
      value: row.description,
    });
  }

  if (row.connector) {
    attrs.push({
      id: uuidv4(),
      name: 'connector',
      displayName: 'Connector',
      type: 'string',
      required: false,
      value: row.connector,
    });
  }

  if (row.database) {
    attrs.push({
      id: uuidv4(),
      name: 'database',
      displayName: 'Database',
      type: 'string',
      required: false,
      value: row.database,
    });
  }

  if (row.schema) {
    attrs.push({
      id: uuidv4(),
      name: 'schema',
      displayName: 'Schema',
      type: 'string',
      required: false,
      value: row.schema,
    });
  }

  if (row.certificationStatus) {
    attrs.push({
      id: uuidv4(),
      name: 'certificationStatus',
      displayName: 'Certification',
      type: 'string',
      required: false,
      value: row.certificationStatus,
    });
  }

  if (row.tags) {
    attrs.push({
      id: uuidv4(),
      name: 'tags',
      displayName: 'Tags',
      type: 'string',
      required: false,
      value: row.tags,
    });
  }

  if (row.terms) {
    attrs.push({
      id: uuidv4(),
      name: 'glossaryTerms',
      displayName: 'Glossary Terms',
      type: 'string',
      required: false,
      value: row.terms,
    });
  }

  if (row.ownerUsers) {
    attrs.push({
      id: uuidv4(),
      name: 'owners',
      displayName: 'Owners',
      type: 'string',
      required: false,
      value: row.ownerUsers,
    });
  }

  if (row.usage) {
    attrs.push({
      id: uuidv4(),
      name: 'usage',
      displayName: 'Usage',
      type: 'string',
      required: false,
      value: row.usage,
    });
  }

  if (row.popularity) {
    attrs.push({
      id: uuidv4(),
      name: 'popularity',
      displayName: 'Popularity',
      type: 'string',
      required: false,
      value: row.popularity,
    });
  }

  // Mark as having lineage
  attrs.push({
    id: uuidv4(),
    name: 'lineage',
    displayName: 'Has Lineage',
    type: 'boolean',
    required: false,
    value: true,
  });

  return attrs;
}

// ============================================
// MAIN IMPORT FUNCTION
// ============================================

/**
 * Import lineage data from Atlan impact analysis CSV
 * Creates entities for each asset and lineage edges for upstream/downstream
 */
export function importLineageFromCSV(csvContent: string): LineageImportResult {
  const rawRows = parseCSV(csvContent);
  const rows = rawRows.map(rowToLineageCSVRow).filter(r => r.qualifiedName);

  // Group by depth for layout
  const byDepth = new Map<number, LineageCSVRow[]>();
  let maxDepth = 0;

  rows.forEach(row => {
    const depth = row.lineageDepth;
    if (!byDepth.has(depth)) {
      byDepth.set(depth, []);
    }
    byDepth.get(depth)!.push(row);
    maxDepth = Math.max(maxDepth, depth);
  });

  // Build entities
  const entities: EntityDefinition[] = [];
  const qnToEntityId = new Map<string, string>();
  const connectors = new Set<string>();

  // Sort depths and create entities
  const sortedDepths = Array.from(byDepth.keys()).sort((a, b) => a - b);

  sortedDepths.forEach(depth => {
    const rowsAtDepth = byDepth.get(depth)!;

    rowsAtDepth.forEach((row, indexInDepth) => {
      const entityId = uuidv4();
      qnToEntityId.set(row.qualifiedName.toLowerCase(), entityId);

      if (row.connector) {
        connectors.add(row.connector);
      }

      const mapping = mapType(row.type);
      const position = calculatePosition(depth, indexInDepth);

      entities.push({
        id: entityId,
        name: row.qualifiedName,
        displayName: row.name,
        category: mapping.category,
        assetType: mapping.assetType,
        connectorName: row.connector,
        description: row.description || '',
        attributes: buildAttributes(row),
        relationships: [],
        position,
        atlanGuid: row.guid,
        atlanQualifiedName: row.qualifiedName,
      });
    });
  });

  // Collect all referenced qualified names and raw edges
  const referencedQualifiedNames = new Set<string>();
  const rawEdges: Array<{ sourceQn: string; targetQn: string }> = [];
  const edgeKeys = new Set<string>();

  rows.forEach(row => {
    const rowQn = row.qualifiedName.toLowerCase();
    referencedQualifiedNames.add(rowQn);

    // Collect upstream references
    row.immediateUpstream.forEach(upstreamQn => {
      const normalizedQn = upstreamQn.toLowerCase();
      referencedQualifiedNames.add(normalizedQn);

      const edgeKey = `${normalizedQn}->${rowQn}`;
      if (!edgeKeys.has(edgeKey)) {
        edgeKeys.add(edgeKey);
        rawEdges.push({ sourceQn: normalizedQn, targetQn: rowQn });
      }
    });

    // Collect downstream references (these may reference entities not in CSV!)
    row.immediateDownstream.forEach(downstreamQn => {
      const normalizedQn = downstreamQn.toLowerCase();
      referencedQualifiedNames.add(normalizedQn);

      const edgeKey = `${rowQn}->${normalizedQn}`;
      if (!edgeKeys.has(edgeKey)) {
        edgeKeys.add(edgeKey);
        rawEdges.push({ sourceQn: rowQn, targetQn: normalizedQn });
      }
    });
  });

  // Build edges for entities we have IDs for (within CSV)
  const edges: EdgeDefinition[] = [];

  rawEdges.forEach(({ sourceQn, targetQn }) => {
    const sourceId = qnToEntityId.get(sourceQn);
    const targetId = qnToEntityId.get(targetQn);

    // Only create edge if BOTH entities are in the CSV
    // (edges to canvas entities will be created during merge)
    if (!sourceId || !targetId) return;

    edges.push({
      id: uuidv4(),
      source: sourceId,
      target: targetId,
      label: 'lineage',
      type: 'relationship',
      data: {
        kind: 'lineage',
        label: 'lineage',
        cardinality: 'N:N',
      },
    });
  });

  return {
    entities,
    edges,
    qnToEntityId,
    referencedQualifiedNames,
    rawEdges,
    stats: {
      totalAssets: entities.length,
      lineageEdges: rawEdges.length, // Total edges (some may connect to canvas)
      connectors: Array.from(connectors),
      maxDepth,
    },
  };
}

/**
 * Merge lineage import with existing canvas entities
 * - Matches entities by qualified name to avoid duplicates
 * - Creates lineage edges between assets (including to existing canvas entities)
 * - Handles references to entities not in the CSV (e.g., SILVER_COLORS in upstream CSV)
 */
export function mergeLineageWithCanvas(
  importResult: LineageImportResult,
  existingEntities: EntityDefinition[],
  existingEdges: EdgeDefinition[]
): { entities: EntityDefinition[]; edges: EdgeDefinition[]; stats: { entitiesAdded: number; edgesAdded: number; matchedExisting: number } } {
  // Build lookup of existing entities by qualified name (normalized)
  const existingQnToId = new Map<string, string>();
  existingEntities.forEach(e => {
    const qn = e.atlanQualifiedName || e.qualifiedName || e.name;
    if (qn) {
      existingQnToId.set(qn.toLowerCase(), e.id);
    }
  });

  // Merge: use existing entity IDs where possible, add new entities otherwise
  const newEntities: EntityDefinition[] = [];
  const mergedQnToId = new Map<string, string>();
  let matchedExisting = 0;

  importResult.entities.forEach(entity => {
    const qn = (entity.atlanQualifiedName || entity.name).toLowerCase();
    const existingId = existingQnToId.get(qn);

    if (existingId) {
      // Entity already exists - use existing ID
      mergedQnToId.set(qn, existingId);
      matchedExisting++;
    } else {
      // New entity - add it
      newEntities.push(entity);
      mergedQnToId.set(qn, entity.id);
    }
  });

  // Also include existing entities in mergedQnToId for edge resolution
  existingEntities.forEach(e => {
    const qn = (e.atlanQualifiedName || e.qualifiedName || e.name || '').toLowerCase();
    if (qn && !mergedQnToId.has(qn)) {
      mergedQnToId.set(qn, e.id);
    }
  });

  // Build edges using rawEdges - this allows us to connect to canvas entities
  const newEdges: EdgeDefinition[] = [];
  const existingEdgeKeys = new Set<string>();

  existingEdges.forEach(e => {
    existingEdgeKeys.add(`${e.source}-${e.target}`);
  });

  // Re-resolve ALL raw edges using the merged ID map
  // This includes edges to entities that weren't in the CSV but are on canvas
  importResult.rawEdges.forEach(({ sourceQn, targetQn }) => {
    const sourceId = mergedQnToId.get(sourceQn);
    const targetId = mergedQnToId.get(targetQn);

    // Skip if either entity not found
    if (!sourceId || !targetId) return;
    // No self-loops
    if (sourceId === targetId) return;

    const edgeKey = `${sourceId}-${targetId}`;
    if (existingEdgeKeys.has(edgeKey)) return;
    existingEdgeKeys.add(edgeKey);

    newEdges.push({
      id: uuidv4(),
      source: sourceId,
      target: targetId,
      label: 'lineage',
      type: 'relationship',
      data: {
        kind: 'lineage',
        label: 'lineage',
        cardinality: 'N:N',
      },
    });
  });

  return {
    entities: [...existingEntities, ...newEntities],
    edges: [...existingEdges, ...newEdges],
    stats: {
      entitiesAdded: newEntities.length,
      edgesAdded: newEdges.length,
      matchedExisting,
    },
  };
}
