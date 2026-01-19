/**
 * MDLH Evaluation API
 * Node.js Express Backend
 * 
 * Main entry point for the evaluation backend server
 */

import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { initDatabase, closeDatabase } from './db/sqlite.js';
import { requestTiming, errorHandler, validateSession } from './middleware/index.js';
import routes from './routes/index.js';

// Initialize Express app
const app = express();

// ============================================
// MIDDLEWARE
// ============================================

// CORS
app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-ID', 'X-Request-ID'],
}));

// JSON body parsing
app.use(express.json({ limit: '10mb' }));

// Request timing/logging
app.use(requestTiming);

// Session validation (optional for most routes)
app.use(validateSession);

// ============================================
// ROUTES
// ============================================

app.use(routes);

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
  });
});

// Global error handler
app.use(errorHandler);

// ============================================
// SERVER STARTUP
// ============================================

async function startServer(): Promise<void> {
  try {
    // Initialize database
    console.log('[Server] Initializing database...');
    initDatabase();

    // Start listening
    app.listen(config.port, config.host, () => {
      console.log(`[Server] MDLH Evaluation API running on http://${config.host}:${config.port}`);
      console.log(`[Server] Environment: ${config.isDev ? 'development' : 'production'}`);
      console.log(`[Server] CORS origins: ${config.corsOrigins.join(', ')}`);
    });
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Received SIGINT, shutting down...');
  closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Server] Received SIGTERM, shutting down...');
  closeDatabase();
  process.exit(0);
});

// Start the server
startServer();
