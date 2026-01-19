/**
 * Route Aggregator
 * Combines all routers into a single export
 */

import { Router } from 'express';
import healthRouter from './health.js';
import evaluationRouter from './evaluation.js';

const router = Router();

// Health check (no auth required)
router.use('/health', healthRouter);

// Evaluation routes (consolidated under /api/runs)
router.use('/api/runs', evaluationRouter);

export default router;
