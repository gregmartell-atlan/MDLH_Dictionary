/**
 * MDLH Tenant Configuration Service
 * 
 * Service for discovering MDLH schema and building tenant configurations
 * with field mappings.
 */

import { createLogger } from '../utils/logger';

const log = createLogger('mdlhTenantConfig');

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Get session ID from sessionStorage
 */
function getSessionId() {
  const stored = sessionStorage.getItem('snowflake_session');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return parsed.sessionId;
    } catch (e) {
      log.error('Failed to parse session', { error: e.message });
      return null;
    }
  }
  return null;
}

/**
 * Discover tenant configuration from MDLH schema
 * 
 * @param {Object} params
 * @param {string} params.tenantId - Tenant identifier
 * @param {string} params.baseUrl - Base URL for tenant
 * @param {string} params.database - Database name
 * @param {string} params.schema - Schema name
 * @returns {Promise<Object>} Tenant configuration
 */
export async function discoverTenantConfig({ tenantId, baseUrl, database, schema }) {
  const sessionId = getSessionId();
  
  if (!sessionId) {
    throw new Error('Not connected to Snowflake');
  }
  
  try {
    log.info('Discovering tenant config', { tenantId, database, schema });
    
    const response = await fetch(`${API_BASE_URL}/api/tenant-config/discover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': sessionId,
      },
      body: JSON.stringify({
        tenantId,
        baseUrl,
        database,
        schema,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }
    
    const config = await response.json();
    log.info('Tenant config discovered', { 
      fieldMappings: config.fieldMappings?.length || 0,
      tables: config.schemaSnapshot?.tables?.length || 0,
    });
    
    return config;
  } catch (err) {
    log.error('Failed to discover tenant config', { error: err.message });
    throw err;
  }
}

/**
 * Get schema snapshot (tables and columns) without full config
 * 
 * @param {string} database - Database name
 * @param {string} schema - Schema name
 * @returns {Promise<Object>} Schema snapshot
 */
export async function getSchemaSnapshot(database, schema) {
  const sessionId = getSessionId();
  
  if (!sessionId) {
    throw new Error('Not connected to Snowflake');
  }
  
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/tenant-config/schema?database=${encodeURIComponent(database)}&schema=${encodeURIComponent(schema)}`,
      {
        headers: {
          'X-Session-ID': sessionId,
        },
      }
    );
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (err) {
    log.error('Failed to get schema snapshot', { error: err.message });
    throw err;
  }
}
