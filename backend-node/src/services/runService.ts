/**
 * Run Service
 * Business logic for run lifecycle
 */

import * as runRepo from '../db/runRepository.js';
import * as scoreRepo from '../db/scoreRepository.js';
import * as planRepo from '../db/planRepository.js';
import { fetchMdlhAssets } from './snowflake.js';
import { MDLH } from '../queries/mdlhQueries.js';
import { mdlhRowToAsset } from '../engines/signalMapper.js';
import { scoreAssets } from '../engines/scoreEngine.js';
import { computeGaps } from '../engines/gapEngine.js';
import type { Run, ScoringConfig } from '../types/run.js';
import type { RunScope } from '../types/api.js';
import type { MdlhAssetRow } from '../types/mdlh.js';

/**
 * Create a new evaluation run
 */
export function createRun(
  sessionId: string,
  scope: RunScope,
  capabilities: string[],
  scoringConfig?: Partial<ScoringConfig>
): Run {
  return runRepo.createRun(sessionId, scope, capabilities, scoringConfig);
}

/**
 * Get a run by ID
 */
export function getRun(id: string): Run | null {
  return runRepo.getRun(id);
}

/**
 * List runs, optionally filtered by session
 */
export function listRuns(sessionId?: string): Run[] {
  return runRepo.listRuns(sessionId);
}

/**
 * Delete a run and all associated data
 */
export function deleteRun(id: string): boolean {
  return runRepo.deleteRun(id);
}

/**
 * Ingest assets from MDLH into the run
 */
export async function ingestAssets(
  runId: string,
  sessionId: string,
  database: string,
  schema: string,
  limit?: number
): Promise<{ success: boolean; count?: number; error?: string; rows?: MdlhAssetRow[] }> {
  // Update status
  runRepo.updateRunStatus(runId, 'INGESTING');

  try {
    // Build and execute query
    const query = MDLH.FETCH_ASSETS(database, schema, limit);
    const result = await fetchMdlhAssets(query, sessionId);

    if (!result.success || !result.rows) {
      runRepo.updateRunStatus(runId, 'FAILED');
      return { success: false, error: result.error };
    }

    // Convert to canonical assets
    const assets = result.rows.map(mdlhRowToAsset);

    // Clear existing catalog and store new
    runRepo.clearCatalog(runId);
    const count = runRepo.storeCatalog(runId, assets);

    return { success: true, count, rows: result.rows };
  } catch (error) {
    runRepo.updateRunStatus(runId, 'FAILED');
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Compute scores for all assets in a run using configured methodology
 */
export function computeScores(
  runId: string,
  mdlhRows: MdlhAssetRow[]
): { success: boolean; count?: number; error?: string } {
  try {
    // Update status
    runRepo.updateRunStatus(runId, 'SCORING');

    // Get run to access scoring config
    const run = runRepo.getRun(runId);
    if (!run) {
      return { success: false, error: 'Run not found' };
    }

    // Get catalog
    const assets = runRepo.getCatalog(runId);
    
    if (assets.length === 0) {
      return { success: false, error: 'No assets in catalog. Run ingest first.' };
    }

    // Score all assets using methodology from run config
    const scores = scoreAssets(assets, mdlhRows, runId, run.scoringConfig);

    // Clear existing scores and store new
    scoreRepo.clearScores(runId);
    const count = scoreRepo.storeScores(runId, scores);

    // Compute gaps
    const gaps = computeGaps(runId, assets);
    planRepo.storeGaps(runId, gaps);

    // Update status
    runRepo.updateRunStatus(runId, 'COMPLETED');

    return { success: true, count };
  } catch (error) {
    runRepo.updateRunStatus(runId, 'FAILED');
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Ingest and score in one operation
 */
export async function ingestAndScore(
  runId: string,
  sessionId: string,
  database: string,
  schema: string,
  limit?: number
): Promise<{ success: boolean; assetCount?: number; scoreCount?: number; error?: string }> {
  // Ingest
  const ingestResult = await ingestAssets(runId, sessionId, database, schema, limit);
  
  if (!ingestResult.success) {
    return { success: false, error: ingestResult.error };
  }

  // Score (needs MDLH rows for signal evaluation)
  const scoreResult = computeScores(runId, ingestResult.rows || []);
  
  if (!scoreResult.success) {
    return { success: false, error: scoreResult.error };
  }

  return {
    success: true,
    assetCount: ingestResult.count,
    scoreCount: scoreResult.count,
  };
}

/**
 * Get run statistics
 */
export function getRunStats(runId: string): {
  assetCount: number;
  scoreCount: number;
  gapCount: number;
  hasPlan: boolean;
} {
  const assetCount = runRepo.getCatalogCount(runId);
  const scores = scoreRepo.getScores(runId);
  const gaps = planRepo.getGaps(runId);
  const plan = planRepo.getPlan(runId);

  return {
    assetCount,
    scoreCount: scores.length,
    gapCount: gaps.length,
    hasPlan: plan !== null,
  };
}
