/**
 * Evaluation Router
 * Consolidated router for ALL /api/runs/* endpoints
 * Single router pattern per plan specification
 */

import { Router, Request } from 'express';
import { asyncHandler, errors } from '../middleware/errorHandler.js';
import { requireSession } from '../middleware/auth.js';
import { CreateRunRequestSchema, IngestRequestSchema } from '../types/api.js';
import * as runService from '../services/runService.js';
import * as scoreService from '../services/scoreService.js';
import * as planService from '../services/planService.js';
import * as artifactService from '../services/artifactService.js';
import type { Quadrant } from '../types/run.js';

// Helper to get param as string
function getParam(req: Request, key: string): string {
  const val = req.params[key];
  return Array.isArray(val) ? val[0] : val;
}

const router = Router();

// Apply session requirement to all routes
router.use(requireSession);

// ============================================
// RUN LIFECYCLE
// ============================================

/**
 * POST /runs - Create a new evaluation run
 */
router.post('/', asyncHandler(async (req, res) => {
  const sessionId = req.sessionId!;
  const body = CreateRunRequestSchema.parse(req.body);
  
  const run = runService.createRun(
    sessionId,
    body.scope || {},
    body.capabilities || [],
    body.scoringConfig
  );
  
  res.status(201).json({
    success: true,
    data: run,
  });
}));

/**
 * GET /runs - List all runs for current session
 */
router.get('/', asyncHandler(async (req, res) => {
  const sessionId = req.sessionId;
  const runs = runService.listRuns(sessionId);
  
  res.json({
    success: true,
    data: runs,
  });
}));

/**
 * GET /runs/:id - Get a specific run
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const run = runService.getRun(getParam(req, 'id'));
  
  if (!run) {
    throw errors.notFound('Run');
  }
  
  // Include stats
  const stats = runService.getRunStats(getParam(req, 'id'));
  
  res.json({
    success: true,
    data: { ...run, stats },
  });
}));

/**
 * DELETE /runs/:id - Delete a run and all associated data
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const deleted = runService.deleteRun(getParam(req, 'id'));
  
  if (!deleted) {
    throw errors.notFound('Run');
  }
  
  res.json({
    success: true,
    message: 'Run deleted',
  });
}));

// ============================================
// INGESTION + SCORING
// ============================================

/**
 * POST /runs/:id/ingest - Ingest assets from MDLH
 */
router.post('/:id/ingest', asyncHandler(async (req, res) => {
  const run = runService.getRun(getParam(req, 'id'));
  if (!run) {
    throw errors.notFound('Run');
  }
  
  const sessionId = req.sessionId!;
  const body = IngestRequestSchema.parse(req.body);
  
  // Use scope from run or request body
  const database = body.database || run.scope.database;
  const schema = body.schema || run.scope.schema;
  
  if (!database || !schema) {
    throw errors.badRequest('Database and schema are required');
  }
  
  const result = await runService.ingestAssets(
    getParam(req, 'id'),
    sessionId,
    database,
    schema,
    body.limit || run.scope.limit
  );
  
  if (!result.success) {
    throw errors.internal(result.error || 'Ingestion failed');
  }
  
  res.json({
    success: true,
    data: {
      assetCount: result.count,
    },
  });
}));

/**
 * POST /runs/:id/score - Compute scores for ingested assets
 */
router.post('/:id/score', asyncHandler(async (req, res) => {
  const run = runService.getRun(getParam(req, 'id'));
  if (!run) {
    throw errors.notFound('Run');
  }
  
  // Get MDLH rows from request or re-fetch
  const mdlhRows = req.body.mdlhRows || [];
  
  const result = runService.computeScores(getParam(req, 'id'), mdlhRows);
  
  if (!result.success) {
    throw errors.internal(result.error || 'Scoring failed');
  }
  
  res.json({
    success: true,
    data: {
      scoreCount: result.count,
    },
  });
}));

/**
 * POST /runs/:id/ingest-and-score - Combined operation
 */
router.post('/:id/ingest-and-score', asyncHandler(async (req, res) => {
  const run = runService.getRun(getParam(req, 'id'));
  if (!run) {
    throw errors.notFound('Run');
  }
  
  const sessionId = req.sessionId!;
  const body = IngestRequestSchema.parse(req.body);
  
  const database = body.database || run.scope.database;
  const schema = body.schema || run.scope.schema;
  
  if (!database || !schema) {
    throw errors.badRequest('Database and schema are required');
  }
  
  const result = await runService.ingestAndScore(
    getParam(req, 'id'),
    sessionId,
    database,
    schema,
    body.limit || run.scope.limit
  );
  
  if (!result.success) {
    throw errors.internal(result.error || 'Ingest and score failed');
  }
  
  res.json({
    success: true,
    data: {
      assetCount: result.assetCount,
      scoreCount: result.scoreCount,
    },
  });
}));

/**
 * GET /runs/:id/catalog - Get ingested assets
 */
router.get('/:id/catalog', asyncHandler(async (req, res) => {
  const run = runService.getRun(getParam(req, 'id'));
  if (!run) {
    throw errors.notFound('Run');
  }
  
  // Import directly to avoid circular deps
  const { getCatalog } = await import('../db/runRepository.js');
  const catalog = getCatalog(getParam(req, 'id'));
  
  res.json({
    success: true,
    data: catalog,
  });
}));

/**
 * GET /runs/:id/scores - Get all scores
 */
router.get('/:id/scores', asyncHandler(async (req, res) => {
  const run = runService.getRun(getParam(req, 'id'));
  if (!run) {
    throw errors.notFound('Run');
  }
  
  const scores = scoreService.getScores(getParam(req, 'id'));
  const summary = scoreService.getScoreSummary(getParam(req, 'id'));
  
  res.json({
    success: true,
    data: {
      scores,
      summary,
    },
  });
}));

/**
 * GET /runs/:id/scores/domains - Get domain-level scores
 */
router.get('/:id/scores/domains', asyncHandler(async (req, res) => {
  const run = runService.getRun(getParam(req, 'id'));
  if (!run) {
    throw errors.notFound('Run');
  }
  
  const domainScores = scoreService.getDomainScores(getParam(req, 'id'));
  
  res.json({
    success: true,
    data: domainScores,
  });
}));

/**
 * GET /runs/:id/domains/:domainId/assets - Get assets for a domain
 */
router.get('/:id/domains/:domainId/assets', asyncHandler(async (req, res) => {
  const run = runService.getRun(getParam(req, 'id'));
  if (!run) {
    throw errors.notFound('Run');
  }
  
  const domainId = decodeURIComponent(getParam(req, 'domainId'));
  const result = scoreService.getDomainAssets(getParam(req, 'id'), domainId);
  
  res.json({
    success: true,
    data: result,
  });
}));

/**
 * GET /runs/:id/scores/quadrant/:quadrant - Get scores by quadrant
 */
router.get('/:id/scores/quadrant/:quadrant', asyncHandler(async (req, res) => {
  const run = runService.getRun(getParam(req, 'id'));
  if (!run) {
    throw errors.notFound('Run');
  }
  
  const quadrant = getParam(req, 'quadrant') as Quadrant;
  const validQuadrants = ['HH', 'HL', 'LH', 'LL', 'HU', 'LU'];
  
  if (!validQuadrants.includes(quadrant)) {
    throw errors.badRequest(`Invalid quadrant. Must be one of: ${validQuadrants.join(', ')}`);
  }
  
  const scores = scoreService.getScoresByQuadrant(getParam(req, 'id'), quadrant);
  
  res.json({
    success: true,
    data: scores,
  });
}));

// ============================================
// GAP ANALYSIS
// ============================================

/**
 * GET /runs/:id/gaps - Get gaps for a run
 */
router.get('/:id/gaps', asyncHandler(async (req, res) => {
  const run = runService.getRun(getParam(req, 'id'));
  if (!run) {
    throw errors.notFound('Run');
  }
  
  const gaps = planService.getGaps(getParam(req, 'id'));
  
  res.json({
    success: true,
    data: gaps,
  });
}));

/**
 * POST /runs/:id/gaps/recompute - Recompute gaps
 */
router.post('/:id/gaps/recompute', asyncHandler(async (req, res) => {
  const run = runService.getRun(getParam(req, 'id'));
  if (!run) {
    throw errors.notFound('Run');
  }
  
  const gaps = planService.recomputeGaps(getParam(req, 'id'));
  
  res.json({
    success: true,
    data: gaps,
  });
}));

// ============================================
// PLAN GENERATION
// ============================================

/**
 * GET /runs/:id/model - Get model (gaps + plan)
 */
router.get('/:id/model', asyncHandler(async (req, res) => {
  const run = runService.getRun(getParam(req, 'id'));
  if (!run) {
    throw errors.notFound('Run');
  }
  
  const model = planService.getModel(getParam(req, 'id'));
  
  res.json({
    success: true,
    data: model,
  });
}));

/**
 * GET /runs/:id/plan - Get current plan
 */
router.get('/:id/plan', asyncHandler(async (req, res) => {
  const run = runService.getRun(getParam(req, 'id'));
  if (!run) {
    throw errors.notFound('Run');
  }
  
  const plan = planService.getPlan(getParam(req, 'id'));
  
  res.json({
    success: true,
    data: plan,
  });
}));

/**
 * POST /runs/:id/plan - Generate a new plan
 */
router.post('/:id/plan', asyncHandler(async (req, res) => {
  const run = runService.getRun(getParam(req, 'id'));
  if (!run) {
    throw errors.notFound('Run');
  }
  
  const plan = planService.createPlan(getParam(req, 'id'));
  
  res.json({
    success: true,
    data: plan,
  });
}));

// ============================================
// EXPORT / ARTIFACTS
// ============================================

/**
 * GET /runs/:id/artifacts - List artifacts
 */
router.get('/:id/artifacts', asyncHandler(async (req, res) => {
  const run = runService.getRun(getParam(req, 'id'));
  if (!run) {
    throw errors.notFound('Run');
  }
  
  const artifacts = artifactService.getArtifacts(getParam(req, 'id'));
  
  res.json({
    success: true,
    data: artifacts,
  });
}));

/**
 * POST /runs/:id/artifacts - Generate all artifacts
 */
router.post('/:id/artifacts', asyncHandler(async (req, res) => {
  const run = runService.getRun(getParam(req, 'id'));
  if (!run) {
    throw errors.notFound('Run');
  }
  
  const artifacts = artifactService.generateArtifacts(getParam(req, 'id'));
  
  res.json({
    success: true,
    data: artifacts.map(a => ({ type: a.type, format: a.format, createdAt: a.createdAt })),
  });
}));

/**
 * GET /runs/:id/artifacts/:type - Download artifact
 */
router.get('/:id/artifacts/:type', asyncHandler(async (req, res) => {
  const run = runService.getRun(getParam(req, 'id'));
  if (!run) {
    throw errors.notFound('Run');
  }
  
  const type = getParam(req, 'type').toUpperCase();
  const validTypes = ['CSV', 'JSON', 'MARKDOWN'];
  
  if (!validTypes.includes(type)) {
    throw errors.badRequest(`Invalid artifact type. Must be one of: ${validTypes.join(', ')}`);
  }
  
  const artifact = artifactService.getArtifact(getParam(req, 'id'), type as 'CSV' | 'JSON' | 'MARKDOWN');
  
  if (!artifact) {
    throw errors.notFound('Artifact');
  }
  
  // Set appropriate headers
  const contentTypes: Record<string, string> = {
    CSV: 'text/csv',
    JSON: 'application/json',
    MARKDOWN: 'text/markdown',
  };
  
  const extensions: Record<string, string> = {
    CSV: 'csv',
    JSON: 'json',
    MARKDOWN: 'md',
  };
  
  res.setHeader('Content-Type', contentTypes[type]);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="evaluation-${getParam(req, 'id')}.${extensions[type]}"`
  );
  
  res.send(artifact.content);
}));

export default router;
