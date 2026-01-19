/**
 * Run Repository
 * Database operations for runs and catalog
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './sqlite.js';
import type { Run, RunStatus, ScoringConfig } from '../types/run.js';
import type { RunScope } from '../types/api.js';
import type { Asset } from '../types/mdlh.js';

// Default scoring configuration
const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  methodology: 'WEIGHTED_DIMENSIONS',
  unknownPolicy: 'IGNORE_IN_ROLLUP',
  readyThreshold: 0.75,
  impactThreshold: 0.5,
  qualityThreshold: 0.7,
};

// ============================================
// RUN OPERATIONS
// ============================================

export function createRun(
  sessionId: string,
  scope: RunScope,
  capabilities: string[],
  scoringConfig?: Partial<ScoringConfig>
): Run {
  const db = getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const config: ScoringConfig = { ...DEFAULT_SCORING_CONFIG, ...scoringConfig };

  const stmt = db.prepare(`
    INSERT INTO runs (id, session_id, status, scope_json, capabilities_json, scoring_config_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    sessionId,
    'CREATED',
    JSON.stringify(scope),
    JSON.stringify(capabilities),
    JSON.stringify(config),
    now,
    now
  );

  return {
    id,
    sessionId,
    status: 'CREATED',
    scope,
    capabilities,
    scoringConfig: config,
    createdAt: now,
    updatedAt: now,
  };
}

export function getRun(id: string): Run | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, session_id, status, scope_json, capabilities_json, scoring_config_json,
           created_at, updated_at, completed_at
    FROM runs WHERE id = ?
  `);

  const row = stmt.get(id) as {
    id: string;
    session_id: string;
    status: RunStatus;
    scope_json: string;
    capabilities_json: string;
    scoring_config_json: string | null;
    created_at: string;
    updated_at: string;
    completed_at: string | null;
  } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    sessionId: row.session_id,
    status: row.status,
    scope: JSON.parse(row.scope_json || '{}') as RunScope,
    capabilities: JSON.parse(row.capabilities_json || '[]') as string[],
    scoringConfig: row.scoring_config_json 
      ? JSON.parse(row.scoring_config_json) as ScoringConfig
      : DEFAULT_SCORING_CONFIG,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at || undefined,
  };
}

export function listRuns(sessionId?: string): Run[] {
  const db = getDatabase();
  
  let query = `
    SELECT id, session_id, status, scope_json, capabilities_json, scoring_config_json,
           created_at, updated_at, completed_at
    FROM runs
  `;
  
  const params: string[] = [];
  if (sessionId) {
    query += ' WHERE session_id = ?';
    params.push(sessionId);
  }
  
  query += ' ORDER BY created_at DESC LIMIT 100';

  const stmt = db.prepare(query);
  const rows = (sessionId ? stmt.all(sessionId) : stmt.all()) as Array<{
    id: string;
    session_id: string;
    status: RunStatus;
    scope_json: string;
    capabilities_json: string;
    scoring_config_json: string | null;
    created_at: string;
    updated_at: string;
    completed_at: string | null;
  }>;

  return rows.map(row => ({
    id: row.id,
    sessionId: row.session_id,
    status: row.status,
    scope: JSON.parse(row.scope_json || '{}') as RunScope,
    capabilities: JSON.parse(row.capabilities_json || '[]') as string[],
    scoringConfig: row.scoring_config_json 
      ? JSON.parse(row.scoring_config_json) as ScoringConfig
      : DEFAULT_SCORING_CONFIG,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at || undefined,
  }));
}

export function updateRunStatus(id: string, status: RunStatus): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  
  const updates: string[] = ['status = ?', 'updated_at = ?'];
  const params: (string | null)[] = [status, now];
  
  if (status === 'COMPLETED' || status === 'FAILED') {
    updates.push('completed_at = ?');
    params.push(now);
  }
  
  params.push(id);
  
  const stmt = db.prepare(`
    UPDATE runs SET ${updates.join(', ')} WHERE id = ?
  `);
  
  stmt.run(...params);
}

export function deleteRun(id: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM runs WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// ============================================
// CATALOG OPERATIONS
// ============================================

export function storeCatalog(runId: string, assets: Asset[]): number {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO catalog 
    (run_id, guid, asset_name, asset_type, qualified_name, connector_name, attributes_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((items: Asset[]) => {
    let count = 0;
    for (const asset of items) {
      stmt.run(
        runId,
        asset.guid,
        asset.name,
        asset.typeName,
        asset.qualifiedName,
        asset.connector,
        JSON.stringify(asset.attributes)
      );
      count++;
    }
    return count;
  });

  return insertMany(assets);
}

export function getCatalog(runId: string): Asset[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT guid, asset_name, asset_type, qualified_name, connector_name, attributes_json
    FROM catalog WHERE run_id = ?
  `);

  const rows = stmt.all(runId) as Array<{
    guid: string;
    asset_name: string | null;
    asset_type: string | null;
    qualified_name: string | null;
    connector_name: string | null;
    attributes_json: string | null;
  }>;

  return rows.map(row => ({
    guid: row.guid,
    name: row.asset_name || '',
    typeName: row.asset_type || '',
    qualifiedName: row.qualified_name || '',
    connector: row.connector_name || '',
    attributes: JSON.parse(row.attributes_json || '{}'),
  }));
}

export function getCatalogCount(runId: string): number {
  const db = getDatabase();
  const stmt = db.prepare('SELECT COUNT(*) as count FROM catalog WHERE run_id = ?');
  const row = stmt.get(runId) as { count: number };
  return row.count;
}

export function clearCatalog(runId: string): void {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM catalog WHERE run_id = ?');
  stmt.run(runId);
}
