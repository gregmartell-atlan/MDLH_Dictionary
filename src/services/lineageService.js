/**
 * Intelligent Lineage Service
 * 
 * OpenLineage-compliant implementation for MDLH metadata
 * 
 * OpenLineage Concepts:
 * - Dataset: A data asset with namespace + name (tables, views, dashboards, reports)
 * - Job: A process that transforms data (ETL, queries, pipelines)
 * - Lineage: Jobs with input[] → output[] Datasets
 * 
 * This service provides:
 * 1. Entity-agnostic lineage fetching (works with any asset type)
 * 2. Intelligent graph building from PROCESS_ENTITY relationships
 * 3. Interactive exploration support
 * 4. Query-aware lineage detection
 * 
 * @see https://openlineage.io/docs/spec/
 */

// Default entity tables in MDLH (will be filtered by discovered tables)
const DEFAULT_ENTITY_TABLES = [
  'TABLE_ENTITY',
  'BI_DASHBOARD_ENTITY',
  'BI_REPORT_ENTITY',
  'COLUMN_ENTITY',
  'SCHEMA_ENTITY',
  'DATABASE_ENTITY',
  'VIEW_ENTITY',
];

// Process tables for lineage (in order of preference)
const PROCESS_TABLE_CANDIDATES = [
  'PROCESS_ENTITY',
  'LINEAGEPROCESS_ENTITY',
  'COLUMNPROCESS_ENTITY',
  'BIPROCESS_ENTITY',
  'DBTPROCESS_ENTITY',
];

/**
 * Extract table/entity names from a SQL query
 * @param {string} sql - The SQL query
 * @returns {string[]} Array of potential entity names
 */
export function extractEntitiesFromSQL(sql) {
  if (!sql) return [];
  
  const entities = new Set();
  
  // Remove comments
  const cleanSql = sql
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Match FROM and JOIN clauses: FROM [db.][schema.]table_name [alias]
  const fromJoinPattern = /(?:FROM|JOIN)\s+([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*){0,2})/gi;
  
  let match;
  while ((match = fromJoinPattern.exec(cleanSql)) !== null) {
    const tableName = match[1];
    const parts = tableName.split('.');
    const justTable = parts[parts.length - 1].toUpperCase();
    
    // Skip common keywords
    if (!['SELECT', 'WHERE', 'AND', 'OR', 'ON', 'AS', 'SET', 'VALUES'].includes(justTable)) {
      entities.add(justTable);
    }
  }
  
  // Also extract from WHERE clause patterns like WHERE "NAME" = 'X'
  const whereNamePattern = /WHERE[^;]*?"NAME"\s*=\s*'([^']+)'/gi;
  while ((match = whereNamePattern.exec(cleanSql)) !== null) {
    entities.add(match[1].toUpperCase());
  }
  
  return Array.from(entities);
}

/**
 * Build FQN for a table
 */
export function buildFQN(database, schema, table) {
  return `${database}.${schema}.${table}`;
}

/**
 * Parse JSON array from string or return as-is
 */
function parseJsonArray(value) {
  if (!value) return [];
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? value : [];
}

/**
 * Normalize a row from query results (handles array or object format)
 */
function normalizeRow(rawRow, columns) {
  if (!rawRow) return null;
  if (Array.isArray(rawRow) && columns?.length) {
    return columns.reduce((acc, col, idx) => ({ ...acc, [col]: rawRow[idx] }), {});
  }
  return rawRow;
}

/**
 * Parse PROCESS_NAME to extract source and target information
 * Format: "SOURCE_PATH and N more → TARGET_PATH"
 */
export function parseProcessName(processName) {
  if (!processName) return { sources: [], targets: [], raw: processName };
  
  // Split on arrow (→ or ->)
  const arrowMatch = processName.match(/(.+?)\s*(?:→|->)\s*(.+)/);
  if (!arrowMatch) {
    return { sources: [processName], targets: [], raw: processName };
  }
  
  const [, leftSide, rightSide] = arrowMatch;
  
  // Extract table name from path like "DB/SCHEMA/TABLE"
  const extractName = (path) => {
    const parts = path.trim().split('/');
    return parts[parts.length - 1] || path.trim();
  };
  
  // Parse "TABLE and N more" pattern
  const parseWithMore = (side) => {
    const moreMatch = side.match(/(.+?)(?:\s+and\s+(\d+)\s+more)?$/i);
    const primary = extractName(moreMatch?.[1] || side);
    const additionalCount = parseInt(moreMatch?.[2] || '0', 10);
    return { primary, additionalCount, full: moreMatch?.[1]?.trim() || side.trim() };
  };
  
  const sourceInfo = parseWithMore(leftSide);
  const targetInfo = parseWithMore(rightSide);
  
  return {
    primarySource: sourceInfo.primary,
    primaryTarget: targetInfo.primary,
    sourceCount: 1 + sourceInfo.additionalCount,
    targetCount: 1 + targetInfo.additionalCount,
    fullSource: sourceInfo.full,
    fullTarget: targetInfo.full,
    raw: processName,
  };
}

/**
 * LineageService class - Intelligent lineage fetching and graph building
 */
export class LineageService {
  constructor(executeQuery, database, schema, discoveredTables = null) {
    this.executeQuery = executeQuery;
    this.database = database;
    this.schema = schema;

    // Filter tables to only those that exist
    const tableSet = discoveredTables
      ? new Set([...(discoveredTables instanceof Set ? discoveredTables : discoveredTables)].map(t => t.toUpperCase()))
      : null;

    // Find available entity tables
    this.entityTables = tableSet
      ? DEFAULT_ENTITY_TABLES.filter(t => tableSet.has(t.toUpperCase()))
      : DEFAULT_ENTITY_TABLES;

    // Find available process table for lineage
    // First try to find one in discovered tables, then fall back to default
    const discoveredProcessTable = tableSet
      ? PROCESS_TABLE_CANDIDATES.find(t => tableSet.has(t.toUpperCase()))
      : null;

    // Always fall back to PROCESS_ENTITY if not found - we'll try it anyway
    // This allows lineage to work even if discoveredTables doesn't include process tables
    this.processTable = discoveredProcessTable || 'PROCESS_ENTITY';

    // hasLineage is true if we found a process table in discovery, OR if we're falling back
    // The actual query will fail gracefully if the table doesn't exist
    this.hasLineage = true;

    if (!discoveredProcessTable && tableSet) {
      console.warn('[LineageService] No process table found in discoveredTables, falling back to PROCESS_ENTITY');
    }

    console.log('[LineageService] Initialized with:', {
      database,
      schema,
      entityTables: this.entityTables.length,
      processTable: this.processTable,
      hasLineage: this.hasLineage
    });
  }
  
  /**
   * Find an entity by name across all entity tables
   * @param {string} entityName - Name of the entity to find
   * @returns {Promise<Object|null>} Entity info or null
   */
  async findEntity(entityName) {
    if (!entityName) {
      console.warn('[LineageService.findEntity] Called with empty entityName');
      return null;
    }

    console.log('[LineageService.findEntity] Searching for:', entityName, {
      entityTables: this.entityTables,
      database: this.database,
      schema: this.schema
    });

    // Try each entity table that exists
    for (const entityTable of this.entityTables) {
      try {
        const sql = `
          SELECT "GUID", "NAME", "QUALIFIEDNAME", "TYPENAME"
          FROM ${buildFQN(this.database, this.schema, entityTable)}
          WHERE UPPER("NAME") = '${entityName.toUpperCase()}'
          LIMIT 1
        `;

        console.log(`[LineageService.findEntity] Trying ${entityTable}...`);
        const result = await this.executeQuery(sql);

        if (result?.rows?.length) {
          const row = normalizeRow(result.rows[0], result.columns);
          const entity = {
            guid: row?.GUID || row?.guid,
            name: row?.NAME || row?.name,
            qualifiedName: row?.QUALIFIEDNAME || row?.qualifiedName,
            typeName: row?.TYPENAME || row?.typename,
            sourceTable: entityTable,
          };
          console.log('[LineageService.findEntity] Found entity:', entity);
          return entity;
        }
      } catch (err) {
        // Table might not exist, continue to next
        console.debug(`[LineageService.findEntity] ${entityTable} error:`, err.message);
      }
    }

    console.warn('[LineageService.findEntity] Entity not found in any table:', entityName);
    return null;
  }
  
  /**
   * Find an entity by GUID
   * @param {string} guid - GUID of the entity
   * @returns {Promise<Object|null>} Entity info or null
   */
  async findEntityByGuid(guid) {
    if (!guid) return null;

    for (const entityTable of this.entityTables) {
      try {
        const sql = `
          SELECT "GUID", "NAME", "QUALIFIEDNAME", "TYPENAME"
          FROM ${buildFQN(this.database, this.schema, entityTable)}
          WHERE "GUID" = '${guid}'
          LIMIT 1
        `;
        
        const result = await this.executeQuery(sql);
        if (result?.rows?.length) {
          const row = normalizeRow(result.rows[0], result.columns);
          return {
            guid: row?.GUID || row?.guid,
            name: row?.NAME || row?.name,
            qualifiedName: row?.QUALIFIEDNAME || row?.qualifiedName,
            typeName: row?.TYPENAME || row?.typename,
            sourceTable: entityTable,
          };
        }
      } catch (err) {
        console.debug(`[LineageService] ${entityTable} GUID lookup error:`, err.message);
      }
    }
    
    return null;
  }
  
  /**
   * Get lineage for an entity (by name or GUID)
   * @param {string} entityNameOrGuid - Entity name or GUID
   * @returns {Promise<Object>} Lineage graph data
   */
  async getLineage(entityNameOrGuid) {
    console.log('[LineageService.getLineage] START:', {
      entityNameOrGuid,
      hasLineage: this.hasLineage,
      processTable: this.processTable,
      entityTables: this.entityTables
    });

    // Check if lineage is available
    if (!this.hasLineage) {
      console.warn('[LineageService.getLineage] No lineage table available');
      return {
        error: 'Lineage data is not available. No PROCESS_ENTITY table found in the database.',
        nodes: [],
        edges: [],
        rawProcesses: [],
        lineageNotAvailable: true,
      };
    }

    // First, find the entity by name
    console.log('[LineageService.getLineage] Finding entity by name...');
    let entity = await this.findEntity(entityNameOrGuid);

    if (!entity) {
      // Try as GUID
      console.log('[LineageService.getLineage] Not found by name, trying as GUID...');
      entity = await this.findEntityByGuid(entityNameOrGuid);
    }

    console.log('[LineageService.getLineage] Entity lookup result:', entity);
    
    if (!entity) {
      return {
        error: `Entity "${entityNameOrGuid}" not found in MDLH metadata`,
        nodes: [],
        edges: [],
        rawProcesses: [],
      };
    }
    
    console.log('[LineageService] Found entity:', entity);
    
    // Get upstream processes (where this entity is in OUTPUTS)
    const upstreamProcesses = await this.getProcesses(entity.guid, 'OUTPUTS');
    
    // Get downstream processes (where this entity is in INPUTS)
    const downstreamProcesses = await this.getProcesses(entity.guid, 'INPUTS');
    
    // Build the graph
    return this.buildGraph(entity, upstreamProcesses, downstreamProcesses);
  }
  
  /**
   * Get processes where entity GUID appears in specified field
   * @param {string} entityGuid - Entity GUID to search for
   * @param {string} field - 'INPUTS' or 'OUTPUTS'
   * @returns {Promise<Array>} Array of process records
   */
  async getProcesses(entityGuid, field) {
    if (!this.processTable) {
      return [];
    }

    // Use FLATTEN to search within VARIANT/ARRAY columns
    // The INPUTS/OUTPUTS columns contain arrays of GUID strings like ["guid1", "guid2"]
    const sql = `
      SELECT DISTINCT
        p."GUID" AS process_guid,
        p."NAME" AS process_name,
        p."TYPENAME" AS process_type,
        p."INPUTS" AS inputs,
        p."OUTPUTS" AS outputs,
        p."POPULARITYSCORE" AS popularity
      FROM ${buildFQN(this.database, this.schema, this.processTable)} p,
           LATERAL FLATTEN(input => p."${field}", OUTER => TRUE) f
      WHERE f.value::STRING = '${entityGuid}'
      ORDER BY p."POPULARITYSCORE" DESC NULLS LAST
      LIMIT 10
    `;

    console.log(`[LineageService.getProcesses] Querying ${field} for guid:`, entityGuid);

    try {
      const result = await this.executeQuery(sql);
      console.log(`[LineageService.getProcesses] ${field} query returned ${result?.rows?.length || 0} rows`);
      return (result?.rows || []).map(row => normalizeRow(row, result?.columns));
    } catch (err) {
      console.error(`[LineageService] Error fetching ${field} processes:`, err);

      // Fallback: try with ARRAY_TO_STRING for simple GUID arrays
      console.log(`[LineageService] Trying fallback query with ARRAY_TO_STRING...`);
      const fallbackSql = `
        SELECT
          p."GUID" AS process_guid,
          p."NAME" AS process_name,
          p."TYPENAME" AS process_type,
          p."INPUTS" AS inputs,
          p."OUTPUTS" AS outputs,
          p."POPULARITYSCORE" AS popularity
        FROM ${buildFQN(this.database, this.schema, this.processTable)} p
        WHERE ARRAY_TO_STRING(p."${field}", ',') ILIKE '%${entityGuid}%'
        ORDER BY p."POPULARITYSCORE" DESC NULLS LAST
        LIMIT 10
      `;

      try {
        const fallbackResult = await this.executeQuery(fallbackSql);
        console.log(`[LineageService.getProcesses] Fallback query returned ${fallbackResult?.rows?.length || 0} rows`);
        return (fallbackResult?.rows || []).map(row => normalizeRow(row, fallbackResult?.columns));
      } catch (fallbackErr) {
        console.error(`[LineageService] Fallback query also failed:`, fallbackErr);
        return [];
      }
    }
  }
  
  /**
   * Build graph data from entity and processes
   */
  buildGraph(entity, upstreamProcesses, downstreamProcesses) {
    const nodes = [];
    const edges = [];
    const rawProcesses = [];
    let nodeId = 0;
    
    const seenUpstream = new Set();
    const seenDownstream = new Set();
    
    // Process upstream (sources that feed into this entity)
    upstreamProcesses.forEach(proc => {
      const processName = proc?.PROCESS_NAME || proc?.process_name || '';
      const parsed = parseProcessName(processName);
      
      rawProcesses.push({
        direction: 'upstream',
        guid: proc?.PROCESS_GUID || proc?.process_guid,
        name: processName,
        type: proc?.PROCESS_TYPE || proc?.process_type || 'Process',
        inputCount: parseJsonArray(proc?.INPUTS || proc?.inputs).length,
        outputCount: parseJsonArray(proc?.OUTPUTS || proc?.outputs).length,
        parsed,
      });
      
      // Add source node from parsed process name
      if (parsed.primarySource && !seenUpstream.has(parsed.primarySource)) {
        seenUpstream.add(parsed.primarySource);
        nodes.push({
          id: `upstream_${nodeId++}`,
          label: parsed.primarySource,
          type: 'dataset',
          typeName: 'Table',
          fullPath: parsed.fullSource,
          column: 0,
          row: nodes.filter(n => n.column === 0).length,
          additionalCount: parsed.sourceCount - 1,
        });
      }
    });
    
    // Add main entity node (center)
    const mainNode = {
      id: 'main',
      label: entity.name,
      type: 'dataset',
      typeName: entity.typeName || 'Asset',
      guid: entity.guid,
      qualifiedName: entity.qualifiedName,
      column: 1,
      row: 0,
      isMain: true,
    };
    nodes.push(mainNode);
    
    // Add edges from upstream to main
    nodes.filter(n => n.column === 0).forEach(n => {
      edges.push({ from: n.id, to: 'main' });
    });
    
    // Process downstream (targets that this entity feeds)
    downstreamProcesses.forEach(proc => {
      const processName = proc?.PROCESS_NAME || proc?.process_name || '';
      const parsed = parseProcessName(processName);
      
      rawProcesses.push({
        direction: 'downstream',
        guid: proc?.PROCESS_GUID || proc?.process_guid,
        name: processName,
        type: proc?.PROCESS_TYPE || proc?.process_type || 'Process',
        inputCount: parseJsonArray(proc?.INPUTS || proc?.inputs).length,
        outputCount: parseJsonArray(proc?.OUTPUTS || proc?.outputs).length,
        parsed,
      });
      
      // Add target node from parsed process name
      if (parsed.primaryTarget && !seenDownstream.has(parsed.primaryTarget)) {
        seenDownstream.add(parsed.primaryTarget);
        const id = `downstream_${nodeId++}`;
        nodes.push({
          id,
          label: parsed.primaryTarget,
          type: 'dataset',
          typeName: 'Table',
          fullPath: parsed.fullTarget,
          column: 2,
          row: nodes.filter(n => n.column === 2).length,
          additionalCount: parsed.targetCount - 1,
        });
        edges.push({ from: 'main', to: id });
      }
    });
    
    return {
      nodes,
      edges,
      rawProcesses,
      metadata: {
        entityName: entity.name,
        entityGuid: entity.guid,
        entityType: entity.typeName,
        upstreamCount: seenUpstream.size,
        downstreamCount: seenDownstream.size,
        totalProcesses: rawProcesses.length,
      },
    };
  }
  
  /**
   * Get lineage for entities detected in a SQL query
   * @param {string} sql - SQL query to analyze
   * @returns {Promise<Object>} Combined lineage for all detected entities
   */
  async getLineageFromQuery(sql) {
    const entities = extractEntitiesFromSQL(sql);
    console.log('[LineageService] Detected entities in query:', entities);
    
    if (entities.length === 0) {
      return {
        nodes: [],
        edges: [],
        rawProcesses: [],
        metadata: { detectedEntities: [] },
      };
    }
    
    // Get lineage for the first detected entity (primary table)
    const primaryEntity = entities[0];
    const lineage = await this.getLineage(primaryEntity);
    
    return {
      ...lineage,
      metadata: {
        ...lineage.metadata,
        detectedEntities: entities,
        primaryEntity,
      },
    };
  }
}

/**
 * Create a lineage service instance
 * @param {Function} executeQuery - Query execution function
 * @param {string} database - Database name
 * @param {string} schema - Schema name
 * @param {Set|Array} discoveredTables - Tables that exist in the database
 */
export function createLineageService(executeQuery, database, schema, discoveredTables = null) {
  return new LineageService(executeQuery, database, schema, discoveredTables);
}

/**
 * Detect if query results are lineage data
 * @param {Object} queryResult - Query result with columns and rows
 * @returns {boolean} True if this looks like lineage data
 */
export function isLineageQueryResult(queryResult) {
  if (!queryResult?.columns) return false;
  
  const cols = queryResult.columns.map(c => c.toUpperCase());
  
  // Check for process entity columns
  const hasProcessName = cols.some(c => c.includes('PROCESS_NAME') || c.includes('NAME'));
  const hasInputs = cols.some(c => c.includes('INPUTS') || c.includes('INPUT'));
  const hasOutputs = cols.some(c => c.includes('OUTPUTS') || c.includes('OUTPUT'));
  
  // Must have at least process name and one of inputs/outputs
  return hasProcessName && (hasInputs || hasOutputs);
}

/**
 * Transform lineage query results into graph visualization data
 * 
 * This allows ANY query that returns lineage data to be visualized,
 * not just the pre-built lineage queries.
 * 
 * @param {Object} queryResult - Query result with columns and rows
 * @param {string} focusEntity - Optional entity to highlight as "main"
 * @returns {Object} Lineage graph data { nodes, edges, rawProcesses, metadata }
 */
export function transformLineageResultsToGraph(queryResult, focusEntity = null) {
  if (!queryResult?.rows?.length) {
    return { nodes: [], edges: [], rawProcesses: [], metadata: {} };
  }
  
  const cols = queryResult.columns.map(c => c.toUpperCase());
  
  // Find column indices
  const findCol = (patterns) => {
    for (const pattern of patterns) {
      const idx = cols.findIndex(c => c.includes(pattern));
      if (idx >= 0) return idx;
    }
    return -1;
  };
  
  const nameIdx = findCol(['PROCESS_NAME', 'NAME']);
  const guidIdx = findCol(['PROCESS_GUID', 'GUID']);
  const typeIdx = findCol(['PROCESS_TYPE', 'TYPE', 'TYPENAME']);
  const inputsIdx = findCol(['INPUTS', 'INPUT']);
  const outputsIdx = findCol(['OUTPUTS', 'OUTPUT']);
  
  const nodes = [];
  const edges = [];
  const rawProcesses = [];
  const seenSources = new Set();
  const seenTargets = new Set();
  let nodeId = 0;
  
  // Process each row
  queryResult.rows.forEach((row, rowIdx) => {
    const getValue = (idx) => {
      if (idx < 0) return null;
      return Array.isArray(row) ? row[idx] : row[cols[idx]];
    };
    
    const processName = getValue(nameIdx) || `Process ${rowIdx + 1}`;
    const processGuid = getValue(guidIdx) || `proc_${rowIdx}`;
    const processType = getValue(typeIdx) || 'Process';
    const inputs = parseJsonArray(getValue(inputsIdx));
    const outputs = parseJsonArray(getValue(outputsIdx));
    
    // Parse process name to extract source/target
    const parsed = parseProcessName(processName);
    
    rawProcesses.push({
      guid: processGuid,
      name: processName,
      type: processType,
      inputCount: inputs.length,
      outputCount: outputs.length,
      parsed,
    });
    
    // Add source node if not seen
    if (parsed.primarySource && !seenSources.has(parsed.primarySource)) {
      seenSources.add(parsed.primarySource);
      nodes.push({
        id: `source_${nodeId++}`,
        label: parsed.primarySource,
        type: 'dataset',
        typeName: 'Source',
        fullPath: parsed.fullSource,
        column: 0,
        row: nodes.filter(n => n.column === 0).length,
        additionalCount: parsed.sourceCount - 1,
      });
    }
    
    // Add target node if not seen
    if (parsed.primaryTarget && !seenTargets.has(parsed.primaryTarget)) {
      seenTargets.add(parsed.primaryTarget);
      nodes.push({
        id: `target_${nodeId++}`,
        label: parsed.primaryTarget,
        type: 'dataset',
        typeName: 'Target',
        fullPath: parsed.fullTarget,
        column: 2,
        row: nodes.filter(n => n.column === 2).length,
        additionalCount: parsed.targetCount - 1,
      });
    }
  });
  
  // Add process nodes in the middle (column 1)
  const processNode = {
    id: 'processes',
    label: `${rawProcesses.length} Process${rawProcesses.length !== 1 ? 'es' : ''}`,
    type: 'process',
    typeName: 'Process',
    column: 1,
    row: 0,
    isMain: !focusEntity,
  };
  nodes.push(processNode);
  
  // Add edges: sources → processes → targets
  nodes.filter(n => n.column === 0).forEach(n => {
    edges.push({ from: n.id, to: 'processes' });
  });
  nodes.filter(n => n.column === 2).forEach(n => {
    edges.push({ from: 'processes', to: n.id });
  });
  
  // If focusEntity specified, try to find and mark it
  if (focusEntity) {
    const focusNode = nodes.find(n => 
      n.label?.toUpperCase() === focusEntity.toUpperCase()
    );
    if (focusNode) {
      focusNode.isMain = true;
      processNode.isMain = false;
    }
  }
  
  return {
    nodes,
    edges,
    rawProcesses,
    metadata: {
      sourceCount: seenSources.size,
      targetCount: seenTargets.size,
      processCount: rawProcesses.length,
      sources: [...seenSources],
      targets: [...seenTargets],
    },
  };
}

/**
 * Auto-detect lineage in query results and transform if applicable
 * @param {Object} queryResult - Query result
 * @param {string} focusEntity - Optional focus entity
 * @returns {Object|null} Lineage graph data if detected, null otherwise
 */
export function autoDetectLineage(queryResult, focusEntity = null) {
  if (!isLineageQueryResult(queryResult)) {
    return null;
  }
  return transformLineageResultsToGraph(queryResult, focusEntity);
}

export default LineageService;

