// ============================================
// SQLite Database Wrapper (Browser-Compatible)
// Uses sql.js for browser compatibility
// ============================================

import initSqlJs, { Database, SqlJsStatic } from 'sql.js';

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;

// Initialize SQLite database
export async function initDatabase(): Promise<Database> {
  if (db) return db;

  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: (file: string) => `https://sql.js.org/dist/${file}`
    });
  }

  // Check if we're in browser (IndexedDB) or Node.js (file system)
  const isBrowser = typeof window !== 'undefined' && typeof indexedDB !== 'undefined';

  if (isBrowser) {
    // Browser: Try to load from IndexedDB
    try {
      const savedDb = localStorage.getItem('v2_db');
      if (savedDb) {
        const uint8Array = new Uint8Array(JSON.parse(savedDb));
        db = new SQL.Database(uint8Array);
      } else {
        db = new SQL.Database();
      }
    } catch (err) {
      console.warn('Failed to load from IndexedDB, creating new database:', err);
      db = new SQL.Database();
    }
  } else {
    // Node.js: Create new database (could load from file if needed)
    db = new SQL.Database();
  }

  // Initialize schema
  initializeSchema(db);

  return db;
}

// Save database to persistence
export function saveDatabase(): void {
  if (!db) return;

  const isBrowser = typeof window !== 'undefined' && typeof indexedDB !== 'undefined';

  if (isBrowser) {
    // Browser: Save to localStorage (IndexedDB would be better for large data)
    try {
      const data = db.export();
      const json = Array.from(data);
      localStorage.setItem('v2_db', JSON.stringify(json));
    } catch (err) {
      console.warn('Failed to save database to localStorage:', err);
    }
  }
  // Node.js: Could save to file if needed
}

// Initialize database schema
function initializeSchema(database: Database): void {
  database.run(`
    CREATE TABLE IF NOT EXISTS assessment_runs (
      id TEXT PRIMARY KEY,
      createdAt TEXT DEFAULT (datetime('now')),
      scopeJson TEXT,
      selectedCapabilitiesJson TEXT,
      status TEXT
    );

    CREATE TABLE IF NOT EXISTS assets_cache (
      id TEXT PRIMARY KEY,
      runId TEXT NOT NULL,
      assetGuid TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      qualifiedName TEXT,
      domain TEXT,
      sourceSystem TEXT,
      atlanUrl TEXT,
      FOREIGN KEY (runId) REFERENCES assessment_runs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_assets_cache_runId ON assets_cache(runId);
    CREATE INDEX IF NOT EXISTS idx_assets_cache_assetGuid ON assets_cache(assetGuid);

    CREATE TABLE IF NOT EXISTS evidence_signals (
      id TEXT PRIMARY KEY,
      runId TEXT NOT NULL,
      assetGuid TEXT NOT NULL,
      signalType TEXT NOT NULL,
      valueJson TEXT NOT NULL,
      observedAt TEXT DEFAULT (datetime('now')),
      source TEXT NOT NULL,
      atlanUrl TEXT,
      FOREIGN KEY (runId) REFERENCES assessment_runs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_evidence_signals_runId ON evidence_signals(runId);
    CREATE INDEX IF NOT EXISTS idx_evidence_signals_assetGuid ON evidence_signals(assetGuid);

    CREATE TABLE IF NOT EXISTS scores (
      id TEXT PRIMARY KEY,
      runId TEXT NOT NULL,
      subjectType TEXT NOT NULL,
      subjectId TEXT NOT NULL,
      impactScore REAL NOT NULL,
      qualityScore REAL,
      qualityUnknown INTEGER NOT NULL DEFAULT 0,
      explanationsJson TEXT NOT NULL,
      FOREIGN KEY (runId) REFERENCES assessment_runs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_scores_runId ON scores(runId);
    CREATE INDEX IF NOT EXISTS idx_scores_subject ON scores(subjectType, subjectId);

    CREATE TABLE IF NOT EXISTS logical_models (
      id TEXT PRIMARY KEY,
      runId TEXT NOT NULL,
      name TEXT NOT NULL,
      version INTEGER NOT NULL,
      graphJson TEXT NOT NULL,
      FOREIGN KEY (runId) REFERENCES assessment_runs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_logical_models_runId ON logical_models(runId);

    CREATE TABLE IF NOT EXISTS gaps (
      id TEXT PRIMARY KEY,
      runId TEXT NOT NULL,
      gapType TEXT NOT NULL,
      subjectType TEXT NOT NULL,
      subjectId TEXT NOT NULL,
      severity TEXT NOT NULL,
      evidenceRefsJson TEXT NOT NULL,
      explanation TEXT NOT NULL,
      FOREIGN KEY (runId) REFERENCES assessment_runs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_gaps_runId ON gaps(runId);

    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      runId TEXT NOT NULL,
      phasesJson TEXT NOT NULL,
      FOREIGN KEY (runId) REFERENCES assessment_runs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_plans_runId ON plans(runId);

    CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY,
      runId TEXT NOT NULL,
      type TEXT NOT NULL,
      format TEXT NOT NULL,
      contentText TEXT NOT NULL,
      FOREIGN KEY (runId) REFERENCES assessment_runs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_artifacts_runId ON artifacts(runId);
    CREATE INDEX IF NOT EXISTS idx_artifacts_type ON artifacts(type);
  `);
}

// Get database instance (ensure initialized)
export async function getDb(): Promise<Database> {
  if (!db) {
    await initDatabase();
  }
  return db!;
}

// Helper to convert row array to object
function rowToObject(columns: string[], row: any[]): Record<string, any> {
  const obj: Record<string, any> = {};
  columns.forEach((col, i) => {
    obj[col] = row[i];
  });
  return obj;
}

// Database query helpers (Prisma-like interface)
export const dbHelpers = {
  assessment_runs: {
    create: async (data: {
      id: string;
      scopeJson?: any;
      selectedCapabilitiesJson?: any;
      status: string;
    }) => {
      const database = await getDb();
      const stmt = database.prepare(
        'INSERT INTO assessment_runs (id, scopeJson, selectedCapabilitiesJson, status) VALUES (?, ?, ?, ?)'
      );
      stmt.run([
        data.id,
        JSON.stringify(data.scopeJson || null),
        JSON.stringify(data.selectedCapabilitiesJson || null),
        data.status
      ]);
      stmt.free();
      saveDatabase();
      return { ...data, createdAt: new Date().toISOString() };
    },
    findUnique: async (where: { id: string }) => {
      const database = await getDb();
      const stmt = database.prepare('SELECT * FROM assessment_runs WHERE id = ?');
      stmt.bind([where.id]);
      if (!stmt.step()) {
        stmt.free();
        return null;
      }
      const columns = stmt.getColumnNames();
      const row = stmt.get();
      const result = rowToObject(columns, row);
      stmt.free();
      return {
        ...result,
        scopeJson: result.scopeJson ? JSON.parse(result.scopeJson as string) : null,
        selectedCapabilitiesJson: result.selectedCapabilitiesJson
          ? JSON.parse(result.selectedCapabilitiesJson as string)
          : null
      };
    },
    findFirst: async (where?: { runId?: string }) => {
      const database = await getDb();
      let query = 'SELECT * FROM assessment_runs';
      const params: any[] = [];
      if (where?.runId) {
        query += ' WHERE runId = ?';
        params.push(where.runId);
      }
      query += ' ORDER BY createdAt DESC LIMIT 1';
      const stmt = database.prepare(query);
      if (params.length > 0) {
        stmt.bind(params);
      }
      if (!stmt.step()) {
        stmt.free();
        return null;
      }
      const columns = stmt.getColumnNames();
      const row = stmt.get();
      const result = rowToObject(columns, row);
      stmt.free();
      return {
        ...result,
        scopeJson: result.scopeJson ? JSON.parse(result.scopeJson as string) : null,
        selectedCapabilitiesJson: result.selectedCapabilitiesJson
          ? JSON.parse(result.selectedCapabilitiesJson as string)
          : null
      };
    },
    findMany: async () => {
      const database = await getDb();
      const stmt = database.prepare('SELECT * FROM assessment_runs');
      const rows: any[] = [];
      const columns = stmt.getColumnNames();
      while (stmt.step()) {
        const row = stmt.get();
        const obj = rowToObject(columns, row);
        rows.push({
          ...obj,
          scopeJson: obj.scopeJson ? JSON.parse(obj.scopeJson as string) : null,
          selectedCapabilitiesJson: obj.selectedCapabilitiesJson
            ? JSON.parse(obj.selectedCapabilitiesJson as string)
            : null
        });
      }
      stmt.free();
      return rows;
    },
    update: async (where: { id: string }, data: Partial<{
      scopeJson: any;
      selectedCapabilitiesJson: any;
      status: string;
    }>) => {
      const database = await getDb();
      const updates: string[] = [];
      const values: any[] = [];
      if (data.scopeJson !== undefined) {
        updates.push('scopeJson = ?');
        values.push(JSON.stringify(data.scopeJson));
      }
      if (data.selectedCapabilitiesJson !== undefined) {
        updates.push('selectedCapabilitiesJson = ?');
        values.push(JSON.stringify(data.selectedCapabilitiesJson));
      }
      if (data.status !== undefined) {
        updates.push('status = ?');
        values.push(data.status);
      }
      if (updates.length === 0) return { count: 0 };
      values.push(where.id);
      const stmt = database.prepare(
        `UPDATE assessment_runs SET ${updates.join(', ')} WHERE id = ?`
      );
      stmt.run(values);
      const changes = database.getRowsModified();
      stmt.free();
      saveDatabase();
      return { count: changes };
    }
  },
  assets_cache: {
    create: async (data: {
      runId: string;
      assetGuid: string;
      name: string;
      type: string;
      qualifiedName?: string;
      domain?: string;
      sourceSystem?: string;
      atlanUrl?: string;
    }) => {
      const database = await getDb();
      const id = `ac_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const stmt = database.prepare(
        'INSERT INTO assets_cache (id, runId, assetGuid, name, type, qualifiedName, domain, sourceSystem, atlanUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      stmt.run([
        id,
        data.runId,
        data.assetGuid,
        data.name,
        data.type,
        data.qualifiedName || null,
        data.domain || null,
        data.sourceSystem || null,
        data.atlanUrl || null
      ]);
      stmt.free();
      saveDatabase();
      return { ...data, id };
    },
    findMany: async (where?: { runId?: string; assetGuid?: string; domain?: string }) => {
      const database = await getDb();
      let query = 'SELECT * FROM assets_cache';
      const conditions: string[] = [];
      const params: any[] = [];
      if (where?.runId) {
        conditions.push('runId = ?');
        params.push(where.runId);
      }
      if (where?.assetGuid) {
        conditions.push('assetGuid = ?');
        params.push(where.assetGuid);
      }
      if (where?.domain) {
        conditions.push('domain = ?');
        params.push(where.domain);
      }
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      const stmt = database.prepare(query);
      if (params.length > 0) {
        stmt.bind(params);
      }
      const rows: any[] = [];
      const columns = stmt.getColumnNames();
      while (stmt.step()) {
        const row = stmt.get();
        rows.push(rowToObject(columns, row));
      }
      stmt.free();
      return rows;
    },
    deleteMany: async (where: { runId: string }) => {
      const database = await getDb();
      const stmt = database.prepare('DELETE FROM assets_cache WHERE runId = ?');
      stmt.run([where.runId]);
      const changes = database.getRowsModified();
      stmt.free();
      saveDatabase();
      return { count: changes };
    }
  },
  evidence_signals: {
    create: async (data: {
      runId: string;
      assetGuid: string;
      signalType: string;
      valueJson: any;
      source: string;
      atlanUrl?: string;
    }) => {
      const database = await getDb();
      const id = `es_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const stmt = database.prepare(
        'INSERT INTO evidence_signals (id, runId, assetGuid, signalType, valueJson, observedAt, source, atlanUrl) VALUES (?, ?, ?, ?, ?, datetime("now"), ?, ?)'
      );
      stmt.run([
        id,
        data.runId,
        data.assetGuid,
        data.signalType,
        JSON.stringify(data.valueJson),
        data.source,
        data.atlanUrl || null
      ]);
      stmt.free();
      saveDatabase();
      return { ...data, id, observedAt: new Date().toISOString() };
    },
    findMany: async (where?: {
      runId?: string;
      assetGuid?: string;
      assetGuids?: string[];
      signalType?: string;
    }) => {
      const database = await getDb();
      let query = 'SELECT * FROM evidence_signals';
      const conditions: string[] = [];
      const params: any[] = [];
      if (where?.runId) {
        conditions.push('runId = ?');
        params.push(where.runId);
      }
      if (where?.assetGuid) {
        conditions.push('assetGuid = ?');
        params.push(where.assetGuid);
      }
      if (where?.assetGuids && where.assetGuids.length > 0) {
        const placeholders = where.assetGuids.map(() => '?').join(', ');
        conditions.push(`assetGuid IN (${placeholders})`);
        params.push(...where.assetGuids);
      }
      if (where?.signalType) {
        conditions.push('signalType = ?');
        params.push(where.signalType);
      }
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      const stmt = database.prepare(query);
      if (params.length > 0) {
        stmt.bind(params);
      }
      const rows: any[] = [];
      const columns = stmt.getColumnNames();
      while (stmt.step()) {
        const row = stmt.get();
        const obj = rowToObject(columns, row);
        rows.push({
          ...obj,
          valueJson: JSON.parse(obj.valueJson as string)
        });
      }
      stmt.free();
      return rows;
    },
    deleteMany: async (where: { runId: string }) => {
      const database = await getDb();
      const stmt = database.prepare('DELETE FROM evidence_signals WHERE runId = ?');
      stmt.run([where.runId]);
      const changes = database.getRowsModified();
      stmt.free();
      saveDatabase();
      return { count: changes };
    }
  },
  scores: {
    create: async (data: {
      runId: string;
      subjectType: string;
      subjectId: string;
      impactScore: number;
      qualityScore: number | null;
      qualityUnknown: boolean;
      explanationsJson: any[];
    }) => {
      const database = await getDb();
      const id = `sc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const stmt = database.prepare(
        'INSERT INTO scores (id, runId, subjectType, subjectId, impactScore, qualityScore, qualityUnknown, explanationsJson) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      );
      stmt.run([
        id,
        data.runId,
        data.subjectType,
        data.subjectId,
        data.impactScore,
        data.qualityScore,
        data.qualityUnknown ? 1 : 0,
        JSON.stringify(data.explanationsJson)
      ]);
      stmt.free();
      saveDatabase();
      return { ...data, id };
    },
    findMany: async (where?: {
      runId?: string;
      subjectType?: string;
      subjectIds?: string[];
    }) => {
      const database = await getDb();
      let query = 'SELECT * FROM scores';
      const conditions: string[] = [];
      const params: any[] = [];
      if (where?.runId) {
        conditions.push('runId = ?');
        params.push(where.runId);
      }
      if (where?.subjectType) {
        conditions.push('subjectType = ?');
        params.push(where.subjectType);
      }
      if (where?.subjectIds && where.subjectIds.length > 0) {
        const placeholders = where.subjectIds.map(() => '?').join(', ');
        conditions.push(`subjectId IN (${placeholders})`);
        params.push(...where.subjectIds);
      }
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      const stmt = database.prepare(query);
      if (params.length > 0) {
        stmt.bind(params);
      }
      const rows: any[] = [];
      const columns = stmt.getColumnNames();
      while (stmt.step()) {
        const row = stmt.get();
        const obj = rowToObject(columns, row);
        rows.push({
          ...obj,
          explanationsJson: JSON.parse(obj.explanationsJson as string),
          qualityUnknown: Boolean(obj.qualityUnknown)
        });
      }
      stmt.free();
      return rows;
    },
    deleteMany: async (where: { runId: string }) => {
      const database = await getDb();
      const stmt = database.prepare('DELETE FROM scores WHERE runId = ?');
      stmt.run([where.runId]);
      const changes = database.getRowsModified();
      stmt.free();
      saveDatabase();
      return { count: changes };
    }
  },
  logical_models: {
    create: async (data: {
      runId: string;
      name: string;
      version: number;
      graphJson: any;
    }) => {
      const database = await getDb();
      const id = `lm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const stmt = database.prepare(
        'INSERT INTO logical_models (id, runId, name, version, graphJson) VALUES (?, ?, ?, ?, ?)'
      );
      stmt.run([
        id,
        data.runId,
        data.name,
        data.version,
        JSON.stringify(data.graphJson)
      ]);
      stmt.free();
      saveDatabase();
      return { ...data, id };
    },
    findMany: async (where?: { runId?: string }) => {
      const database = await getDb();
      let query = 'SELECT * FROM logical_models';
      const params: any[] = [];
      if (where?.runId) {
        query += ' WHERE runId = ?';
        params.push(where.runId);
      }
      query += ' ORDER BY version DESC';
      const stmt = database.prepare(query);
      if (params.length > 0) {
        stmt.bind(params);
      }
      const rows: any[] = [];
      const columns = stmt.getColumnNames();
      while (stmt.step()) {
        const row = stmt.get();
        const obj = rowToObject(columns, row);
        rows.push({
          ...obj,
          graphJson: JSON.parse(obj.graphJson as string)
        });
      }
      stmt.free();
      return rows;
    },
    findFirst: async (where?: { runId?: string }) => {
      const rows = await dbHelpers.logical_models.findMany(where);
      return rows.length > 0 ? rows[0] : null;
    }
  },
  gaps: {
    create: async (data: {
      runId: string;
      gapType: string;
      subjectType: string;
      subjectId: string;
      severity: string;
      evidenceRefsJson: any[];
      explanation: string;
    }) => {
      const database = await getDb();
      const id = `gp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const stmt = database.prepare(
        'INSERT INTO gaps (id, runId, gapType, subjectType, subjectId, severity, evidenceRefsJson, explanation) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      );
      stmt.run([
        id,
        data.runId,
        data.gapType,
        data.subjectType,
        data.subjectId,
        data.severity,
        JSON.stringify(data.evidenceRefsJson),
        data.explanation
      ]);
      stmt.free();
      saveDatabase();
      return { ...data, id };
    },
    findMany: async (where?: { runId?: string }) => {
      const database = await getDb();
      let query = 'SELECT * FROM gaps';
      const params: any[] = [];
      if (where?.runId) {
        query += ' WHERE runId = ?';
        params.push(where.runId);
      }
      const stmt = database.prepare(query);
      if (params.length > 0) {
        stmt.bind(params);
      }
      const rows: any[] = [];
      const columns = stmt.getColumnNames();
      while (stmt.step()) {
        const row = stmt.get();
        const obj = rowToObject(columns, row);
        rows.push({
          ...obj,
          evidenceRefsJson: JSON.parse(obj.evidenceRefsJson as string)
        });
      }
      stmt.free();
      return rows;
    },
    createMany: async (data: Array<{
      runId: string;
      gapType: string;
      subjectType: string;
      subjectId: string;
      severity: string;
      evidenceRefsJson: any[];
      explanation: string;
    }>) => {
      const database = await getDb();
      const stmt = database.prepare(
        'INSERT INTO gaps (id, runId, gapType, subjectType, subjectId, severity, evidenceRefsJson, explanation) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      );
      for (const item of data) {
        const id = `gp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        stmt.run([
          id,
          item.runId,
          item.gapType,
          item.subjectType,
          item.subjectId,
          item.severity,
          JSON.stringify(item.evidenceRefsJson),
          item.explanation
        ]);
      }
      stmt.free();
      saveDatabase();
      return { count: data.length };
    },
    deleteMany: async (where: { runId: string }) => {
      const database = await getDb();
      const stmt = database.prepare('DELETE FROM gaps WHERE runId = ?');
      stmt.run([where.runId]);
      const changes = database.getRowsModified();
      stmt.free();
      saveDatabase();
      return { count: changes };
    }
  },
  plans: {
    create: async (data: {
      runId: string;
      phasesJson: any;
    }) => {
      const database = await getDb();
      const id = `pl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const stmt = database.prepare(
        'INSERT INTO plans (id, runId, phasesJson) VALUES (?, ?, ?)'
      );
      stmt.run([id, data.runId, JSON.stringify(data.phasesJson)]);
      stmt.free();
      saveDatabase();
      return { ...data, id };
    },
    findMany: async (where?: { runId?: string }) => {
      const database = await getDb();
      let query = 'SELECT * FROM plans';
      const params: any[] = [];
      if (where?.runId) {
        query += ' WHERE runId = ?';
        params.push(where.runId);
      }
      const stmt = database.prepare(query);
      if (params.length > 0) {
        stmt.bind(params);
      }
      const rows: any[] = [];
      const columns = stmt.getColumnNames();
      while (stmt.step()) {
        const row = stmt.get();
        const obj = rowToObject(columns, row);
        rows.push({
          ...obj,
          phasesJson: JSON.parse(obj.phasesJson as string)
        });
      }
      stmt.free();
      return rows;
    },
    findFirst: async (where?: { runId?: string }) => {
      const rows = await dbHelpers.plans.findMany(where);
      return rows.length > 0 ? rows[0] : null;
    },
    deleteMany: async (where: { runId: string }) => {
      const database = await getDb();
      const stmt = database.prepare('DELETE FROM plans WHERE runId = ?');
      stmt.run([where.runId]);
      const changes = database.getRowsModified();
      stmt.free();
      saveDatabase();
      return { count: changes };
    }
  },
  artifacts: {
    findMany: async (where?: { runId?: string; type?: string }) => {
      const database = await getDb();
      let query = 'SELECT * FROM artifacts';
      const conditions: string[] = [];
      const params: any[] = [];
      if (where?.runId) {
        conditions.push('runId = ?');
        params.push(where.runId);
      }
      if (where?.type) {
        conditions.push('type = ?');
        params.push(where.type);
      }
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      const stmt = database.prepare(query);
      if (params.length > 0) {
        stmt.bind(params);
      }
      const rows: any[] = [];
      const columns = stmt.getColumnNames();
      while (stmt.step()) {
        const row = stmt.get();
        rows.push(rowToObject(columns, row));
      }
      stmt.free();
      return rows;
    },
    findFirst: async (where?: { runId?: string; type?: string }) => {
      const rows = await dbHelpers.artifacts.findMany(where);
      return rows.length > 0 ? rows[0] : null;
    },
    createMany: async (data: Array<{
      runId: string;
      type: string;
      format: string;
      contentText: string;
    }>) => {
      const database = await getDb();
      const stmt = database.prepare(
        'INSERT INTO artifacts (id, runId, type, format, contentText) VALUES (?, ?, ?, ?, ?)'
      );
      for (const item of data) {
        const id = `ar_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        stmt.run([id, item.runId, item.type, item.format, item.contentText]);
      }
      stmt.free();
      saveDatabase();
      return { count: data.length };
    },
    deleteMany: async (where: { runId: string }) => {
      const database = await getDb();
      const stmt = database.prepare('DELETE FROM artifacts WHERE runId = ?');
      stmt.run([where.runId]);
      const changes = database.getRowsModified();
      stmt.free();
      saveDatabase();
      return { count: changes };
    }
  }
};

// Export Prisma-like interface for compatibility
export const prisma = dbHelpers;

