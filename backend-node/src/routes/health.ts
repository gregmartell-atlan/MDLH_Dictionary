/**
 * Health Router
 * Health check endpoints with dependency verification
 */

import { Router } from 'express';

const router = Router();

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

/**
 * GET /health - Basic health check
 */
router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'mdlh-evaluation-api',
    version: '1.0.0',
  });
});

/**
 * GET /health/ready - Readiness check
 * Verifies SQLite is accessible and Python backend is reachable
 */
router.get('/ready', async (_req, res) => {
  const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};
  let overallStatus = 'ready';

  // Check SQLite
  try {
    const { getDatabase } = await import('../db/sqlite.js');
    const db = getDatabase();
    const stmt = db.prepare('SELECT 1');
    stmt.get();
    checks.sqlite = { status: 'ok' };
  } catch (error) {
    checks.sqlite = { 
      status: 'error', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
    overallStatus = 'degraded';
  }

  // Check Python backend connectivity
  try {
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${PYTHON_BACKEND_URL}/health`, {
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - start;

    if (response.ok) {
      checks.pythonBackend = { status: 'ok', latencyMs };
    } else {
      checks.pythonBackend = { 
        status: 'error', 
        latencyMs,
        error: `HTTP ${response.status}` 
      };
      overallStatus = 'degraded';
    }
  } catch (error) {
    checks.pythonBackend = { 
      status: 'unreachable', 
      error: error instanceof Error ? error.message : 'Connection failed' 
    };
    // Python backend being down is critical for query execution
    overallStatus = 'degraded';
  }

  const statusCode = overallStatus === 'ready' ? 200 : 503;
  
  res.status(statusCode).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
  });
});

/**
 * GET /health/live - Liveness check (Kubernetes-style)
 * Just checks if the process is running
 */
router.get('/live', (_req, res) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default router;
