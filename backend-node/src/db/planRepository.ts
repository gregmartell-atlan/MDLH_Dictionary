/**
 * Plan Repository
 * Database operations for gaps, plans, and artifacts
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './sqlite.js';
import type { Gap, Plan, PlanPhase, Artifact, ArtifactType, Priority } from '../types/run.js';

// ============================================
// GAP OPERATIONS
// ============================================

export function storeGaps(runId: string, gaps: Gap[]): number {
  const db = getDatabase();
  
  // Clear existing gaps first
  const clearStmt = db.prepare('DELETE FROM gaps WHERE run_id = ?');
  clearStmt.run(runId);
  
  const stmt = db.prepare(`
    INSERT INTO gaps 
    (run_id, field, asset_type, current_coverage, target_coverage, gap_percent, priority, effort_hours)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((items: Gap[]) => {
    let count = 0;
    for (const gap of items) {
      stmt.run(
        runId,
        gap.field,
        gap.assetType || null,
        gap.currentCoverage,
        gap.targetCoverage,
        gap.gapPercent,
        gap.priority,
        gap.effortHours
      );
      count++;
    }
    return count;
  });

  return insertMany(gaps);
}

export function getGaps(runId: string): Gap[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, run_id, field, asset_type, current_coverage, target_coverage, 
           gap_percent, priority, effort_hours
    FROM gaps WHERE run_id = ?
    ORDER BY 
      CASE priority 
        WHEN 'P0' THEN 0 
        WHEN 'P1' THEN 1 
        WHEN 'P2' THEN 2 
        WHEN 'P3' THEN 3 
      END,
      gap_percent DESC
  `);

  const rows = stmt.all(runId) as Array<{
    id: number;
    run_id: string;
    field: string;
    asset_type: string | null;
    current_coverage: number;
    target_coverage: number;
    gap_percent: number;
    priority: Priority;
    effort_hours: number;
  }>;

  return rows.map(row => ({
    id: row.id,
    runId: row.run_id,
    field: row.field,
    assetType: row.asset_type || undefined,
    currentCoverage: row.current_coverage,
    targetCoverage: row.target_coverage,
    gapPercent: row.gap_percent,
    priority: row.priority,
    effortHours: row.effort_hours,
  }));
}

// ============================================
// PLAN OPERATIONS
// ============================================

export function storePlan(runId: string, phases: PlanPhase[], totalWeeks: number): Plan {
  const db = getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  // Delete existing plan for this run
  const deleteStmt = db.prepare('DELETE FROM plans WHERE run_id = ?');
  deleteStmt.run(runId);

  const stmt = db.prepare(`
    INSERT INTO plans (id, run_id, phases_json, total_weeks, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(id, runId, JSON.stringify(phases), totalWeeks, now);

  return {
    id,
    runId,
    phases,
    totalWeeks,
    createdAt: now,
  };
}

export function getPlan(runId: string): Plan | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, run_id, phases_json, total_weeks, created_at
    FROM plans WHERE run_id = ?
    ORDER BY created_at DESC LIMIT 1
  `);

  const row = stmt.get(runId) as {
    id: string;
    run_id: string;
    phases_json: string;
    total_weeks: number;
    created_at: string;
  } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    runId: row.run_id,
    phases: JSON.parse(row.phases_json || '[]') as PlanPhase[],
    totalWeeks: row.total_weeks,
    createdAt: row.created_at,
  };
}

// ============================================
// ARTIFACT OPERATIONS
// ============================================

export function storeArtifact(
  runId: string,
  type: ArtifactType,
  format: string,
  content: string
): Artifact {
  const db = getDatabase();
  const now = new Date().toISOString();

  // Delete existing artifact of same type
  const deleteStmt = db.prepare('DELETE FROM artifacts WHERE run_id = ? AND type = ?');
  deleteStmt.run(runId, type);

  const stmt = db.prepare(`
    INSERT INTO artifacts (run_id, type, format, content, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const result = stmt.run(runId, type, format, content, now);

  return {
    id: Number(result.lastInsertRowid),
    runId,
    type,
    format,
    content,
    createdAt: now,
  };
}

export function getArtifacts(runId: string): Artifact[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, run_id, type, format, created_at
    FROM artifacts WHERE run_id = ?
    ORDER BY created_at DESC
  `);

  const rows = stmt.all(runId) as Array<{
    id: number;
    run_id: string;
    type: ArtifactType;
    format: string;
    created_at: string;
  }>;

  return rows.map(row => ({
    id: row.id,
    runId: row.run_id,
    type: row.type,
    format: row.format,
    content: '', // Don't return content in list
    createdAt: row.created_at,
  }));
}

export function getArtifact(runId: string, type: ArtifactType): Artifact | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, run_id, type, format, content, created_at
    FROM artifacts WHERE run_id = ? AND type = ?
    ORDER BY created_at DESC LIMIT 1
  `);

  const row = stmt.get(runId, type) as {
    id: number;
    run_id: string;
    type: ArtifactType;
    format: string;
    content: string;
    created_at: string;
  } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    runId: row.run_id,
    type: row.type,
    format: row.format,
    content: row.content,
    createdAt: row.created_at,
  };
}
