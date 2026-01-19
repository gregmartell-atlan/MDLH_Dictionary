/**
 * SQLite Database Connection
 * Handles initialization, migrations, and provides database instance
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: Database.Database | null = null;

/**
 * Initialize SQLite database
 */
export function initDatabase(): Database.Database {
  if (db) {
    return db;
  }

  // Ensure data directory exists
  const dataDir = path.dirname(config.sqlitePath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Create database connection
  db = new Database(config.sqlitePath);
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL');

  // Run schema migration
  runMigrations(db);

  console.log(`[SQLite] Database initialized at ${config.sqlitePath}`);
  
  return db;
}

/**
 * Get database instance (must call initDatabase first)
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    console.log('[SQLite] Database connection closed');
  }
}

/**
 * Run schema migrations
 */
function runMigrations(database: Database.Database): void {
  const schemaPath = path.join(__dirname, 'schema.sql');
  
  if (!fs.existsSync(schemaPath)) {
    console.warn('[SQLite] schema.sql not found, skipping migrations');
    return;
  }

  const schema = fs.readFileSync(schemaPath, 'utf-8');
  
  // Execute the entire schema as a single batch
  try {
    database.exec(schema);
    console.log('[SQLite] Schema migrations complete');
  } catch (error) {
    // Ignore "already exists" errors
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('already exists')) {
      console.error(`[SQLite] Migration error: ${message}`);
    } else {
      console.log('[SQLite] Schema already up to date');
    }
  }
}

/**
 * Helper to run a transaction
 */
export function runTransaction<T>(fn: (db: Database.Database) => T): T {
  const database = getDatabase();
  return database.transaction(fn)(database);
}
