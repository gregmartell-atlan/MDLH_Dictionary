/**
 * Centralized Configuration
 * Loads environment variables and provides typed config object
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env file
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
  // Server
  port: parseInt(process.env.PORT || '8001', 10),
  host: process.env.HOST || '0.0.0.0',
  
  // CORS - allow common development ports
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176,http://localhost:3000')
    .split(',')
    .map(s => s.trim()),
  
  // SQLite
  sqlitePath: process.env.SQLITE_PATH || path.join(__dirname, '..', 'data', 'evaluation.db'),
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Development mode
  isDev: process.env.NODE_ENV !== 'production',
} as const;

export type Config = typeof config;
