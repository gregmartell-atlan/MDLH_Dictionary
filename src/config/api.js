/**
 * Centralized API Configuration
 * 
 * This file contains all API URL configurations for both backends.
 * In development, Vite proxies all /api/* requests to the appropriate backend.
 * In production, these URLs should be configured via environment variables.
 * 
 * Backend Architecture:
 * - Python (FastAPI) @ :8000 - Snowflake connection, queries, metadata
 * - Node.js (Express) @ :8001 - Evaluation runs, scoring, plans
 */

// Python backend (Snowflake operations)
export const PYTHON_BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Node.js backend (Evaluation operations)
export const NODE_BACKEND_URL = import.meta.env.VITE_EVALUATION_API_URL || 'http://localhost:8001';

// Session storage key
export const SESSION_STORAGE_KEY = 'snowflake_session';

// In development with Vite proxy, we can use relative URLs
// The proxy configuration in vite.config.js routes requests to the correct backend
export const USE_PROXY = import.meta.env.DEV;

/**
 * Get the base URL for Python backend requests
 * In dev mode with proxy, returns empty string (relative URL)
 * In production, returns the full URL
 */
export function getPythonApiUrl() {
  return USE_PROXY ? '' : PYTHON_BACKEND_URL;
}

/**
 * Get the base URL for Node backend requests
 * In dev mode with proxy, returns empty string (relative URL)
 * In production, returns the full URL
 */
export function getNodeApiUrl() {
  return USE_PROXY ? '' : NODE_BACKEND_URL;
}

/**
 * Get session ID from sessionStorage
 * @returns {string|null}
 */
export function getSessionId() {
  const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return parsed.sessionId || null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Build headers with session ID
 * @param {object} additionalHeaders - Additional headers to include
 * @returns {object} Headers object
 */
export function buildHeaders(additionalHeaders = {}) {
  const sessionId = getSessionId();
  const headers = {
    'Content-Type': 'application/json',
    ...additionalHeaders,
  };
  
  if (sessionId) {
    headers['X-Session-ID'] = sessionId;
  }
  
  return headers;
}

export default {
  PYTHON_BACKEND_URL,
  NODE_BACKEND_URL,
  SESSION_STORAGE_KEY,
  USE_PROXY,
  getPythonApiUrl,
  getNodeApiUrl,
  getSessionId,
  buildHeaders,
};
