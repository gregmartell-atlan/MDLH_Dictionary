/**
 * Snowflake Service
 * Handles Snowflake connection and query execution
 * Proxies to the Python backend for actual Snowflake operations
 */

import type { MdlhAssetRow } from '../types/mdlh.js';

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

interface QueryResult<T> {
  success: boolean;
  data?: T[];
  columns?: string[];
  error?: string;
  rowCount?: number;
}

/**
 * Execute a query via the Python backend
 * Uses two-step process: execute (returns query_id) then fetch results
 */
export async function executeQuery<T>(
  query: string,
  sessionId: string
): Promise<QueryResult<T>> {
  try {
    // Step 1: Execute the query
    const executeResponse = await fetch(`${PYTHON_BACKEND_URL}/api/query/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': sessionId,
      },
      body: JSON.stringify({ sql: query }),
    });

    if (!executeResponse.ok) {
      const error = await executeResponse.text();
      return { success: false, error: `Query execution failed: ${error}` };
    }

    const executeResult = await executeResponse.json() as { 
      query_id?: string;
      status?: string;
      error?: string;
      message?: string;
    };
    
    if (executeResult.error || executeResult.status === 'ERROR') {
      return { success: false, error: executeResult.error || executeResult.message || 'Query execution failed' };
    }

    const queryId = executeResult.query_id;
    if (!queryId) {
      return { success: false, error: 'No query_id returned from execute' };
    }

    // Step 2: Fetch results
    const resultsResponse = await fetch(`${PYTHON_BACKEND_URL}/api/query/${queryId}/results`, {
      headers: {
        'X-Session-ID': sessionId,
      },
    });

    if (!resultsResponse.ok) {
      const error = await resultsResponse.text();
      return { success: false, error: `Failed to fetch results: ${error}` };
    }

    const resultsData = await resultsResponse.json() as { 
      error?: string; 
      rows?: T[]; 
      data?: T[];
      columns?: string[];
      row_count?: number;
    };
    
    if (resultsData.error) {
      return { success: false, error: resultsData.error };
    }

    return {
      success: true,
      data: resultsData.rows || resultsData.data || [],
      columns: resultsData.columns || [],
      rowCount: resultsData.row_count || (resultsData.rows || resultsData.data || []).length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Connection error: ${message}` };
  }
}

/**
 * Fetch MDLH assets using the Python backend
 * Transforms array-format rows into object-format rows
 */
export async function fetchMdlhAssets(
  query: string,
  sessionId: string
): Promise<{ success: boolean; rows?: MdlhAssetRow[]; error?: string }> {
  // Execute query - Python backend returns rows as arrays
  const result = await executeQuery<unknown[]>(query, sessionId);
  
  if (!result.success) {
    return { success: false, error: result.error };
  }

  const columns = result.columns || [];
  const rawRows = result.data || [];

  // Transform array rows into object rows using column names
  const rows: MdlhAssetRow[] = rawRows.map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, index) => {
      obj[col] = row[index];
    });
    return obj as unknown as MdlhAssetRow;
  });

  return {
    success: true,
    rows,
  };
}

/**
 * Check if Python backend session is active
 */
export async function checkSession(sessionId: string): Promise<boolean> {
  try {
    const response = await fetch(`${PYTHON_BACKEND_URL}/api/session/status`, {
      headers: {
        'X-Session-ID': sessionId,
      },
    });

    if (!response.ok) return false;
    
    const result = await response.json() as { connected?: boolean };
    return result.connected === true;
  } catch {
    return false;
  }
}

/**
 * Get connection info from Python backend
 */
export async function getConnectionInfo(
  sessionId: string
): Promise<{ database?: string; schema?: string; warehouse?: string } | null> {
  try {
    const response = await fetch(`${PYTHON_BACKEND_URL}/api/session/status`, {
      headers: {
        'X-Session-ID': sessionId,
      },
    });

    if (!response.ok) return null;
    
    const result = await response.json() as { database?: string; schema?: string; warehouse?: string };
    return {
      database: result.database,
      schema: result.schema,
      warehouse: result.warehouse,
    };
  } catch {
    return null;
  }
}
