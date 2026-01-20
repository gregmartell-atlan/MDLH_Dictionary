/**
 * MdlhContext - Centralized MDLH database/schema context for the UI.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createLogger } from '../utils/logger';
import { DEFAULT_DATABASE, DEFAULT_SCHEMA } from '../data/constants';
import { useConnectionContext } from './ConnectionContext';
import { useDynamicSchema } from './DynamicSchemaContext';
import { buildHeaders, getPythonApiUrl } from '../config/api';

const log = createLogger('MdlhContext');
const MDLH_CONTEXT_KEY = 'mdlh_context';
const CAPABILITIES_CACHE_PREFIX = 'mdlh_capabilities';
const CAPABILITIES_TTL_MS = 10 * 60 * 1000;
const API_URL = getPythonApiUrl();

const defaultContextValue = {
  context: {
    database: DEFAULT_DATABASE,
    schema: DEFAULT_SCHEMA,
    warehouse: null,
    table: null,
  },
  capabilities: null,
  capabilitiesLoading: false,
  source: 'default',
  setContext: () => {},
  setDatabase: () => {},
  setSchema: () => {},
  setTable: () => {},
  refreshDiscovery: () => {},
  refreshCapabilities: () => {},
};

const MdlhContext = createContext(defaultContextValue);

function loadStoredContext() {
  const raw = localStorage.getItem(MDLH_CONTEXT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(MDLH_CONTEXT_KEY);
    return null;
  }
}

function persistContext(next) {
  try {
    localStorage.setItem(MDLH_CONTEXT_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors (private mode/quotas)
  }
}

function buildCapabilitiesKey(database, schema) {
  return `${CAPABILITIES_CACHE_PREFIX}:${database || ''}.${schema || ''}`;
}

function loadCapabilitiesCache(database, schema) {
  if (!database || !schema) return null;
  const key = buildCapabilitiesKey(database, schema);
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.timestamp || Date.now() - parsed.timestamp > CAPABILITIES_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed.data || null;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

function persistCapabilitiesCache(database, schema, data) {
  if (!database || !schema || !data) return;
  const key = buildCapabilitiesKey(database, schema);
  try {
    localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data }));
  } catch {
    // Ignore storage errors
  }
}

export function MdlhProvider({ children }) {
  const { status } = useConnectionContext();
  const {
    discoverDatabases,
    discoverSchemas,
    discoverTablesFast,
  } = useDynamicSchema();

  const [context, setContextState] = useState(() => {
    const stored = loadStoredContext();
    if (stored?.database || stored?.schema) {
      return {
        database: stored.database || DEFAULT_DATABASE,
        schema: stored.schema || DEFAULT_SCHEMA,
        warehouse: stored.warehouse || null,
        table: stored.table || null,
      };
    }
    return {
      database: DEFAULT_DATABASE,
      schema: DEFAULT_SCHEMA,
      warehouse: null,
      table: null,
    };
  });
  const [source, setSource] = useState(() => {
    const stored = loadStoredContext();
    return stored?.source || 'default';
  });
  const [capabilities, setCapabilities] = useState(null);
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(false);

  const lastSessionIdRef = useRef(null);
  const capabilitiesAbortRef = useRef(null);

  const setContext = useCallback((partial, options = {}) => {
    const nextSource = options.source || 'manual';

    setContextState((prev) => {
      const next = { ...prev, ...partial };

      if (Object.prototype.hasOwnProperty.call(partial, 'database') && partial.database !== prev.database) {
        if (!Object.prototype.hasOwnProperty.call(partial, 'schema')) {
          next.schema = DEFAULT_SCHEMA;
        }
        next.table = null;
      }

      if (Object.prototype.hasOwnProperty.call(partial, 'schema') && partial.schema !== prev.schema) {
        next.table = null;
      }

      persistContext({ ...next, source: nextSource });
      return next;
    });

    setSource(nextSource);
  }, []);

  const setDatabase = useCallback((database, options = {}) => {
    setContext({ database }, options);
  }, [setContext]);

  const setSchema = useCallback((schema, options = {}) => {
    setContext({ schema }, options);
  }, [setContext]);

  const setTable = useCallback((table, options = {}) => {
    setContext({ table }, options);
  }, [setContext]);

  useEffect(() => {
    if (!status?.connected) return;
    const sessionId = status.sessionId || status.session_id || null;
    if (!sessionId) return;

    if (lastSessionIdRef.current && lastSessionIdRef.current !== sessionId) {
      if (source === 'manual') {
        lastSessionIdRef.current = sessionId;
        return;
      }
      setContext(
        {
          database: status.database || DEFAULT_DATABASE,
          schema: status.schema || DEFAULT_SCHEMA,
          table: null,
        },
        { source: 'session' }
      );
    }

    lastSessionIdRef.current = sessionId;
  }, [status, setContext, source]);

  useEffect(() => {
    if (!status?.connected) return;
    if (source === 'manual') return;

    if (!context.database && status.database) {
      setContext({ database: status.database }, { source: 'session' });
    }
    if (!context.schema && status.schema) {
      setContext({ schema: status.schema }, { source: 'session' });
    }
  }, [status, context.database, context.schema, source, setContext]);

  useEffect(() => {
    if (!status?.connected) return;
    if (!context.database || !discoverSchemas) return;
    discoverSchemas(context.database, false);
  }, [status?.connected, context.database, discoverSchemas]);

  useEffect(() => {
    if (!status?.connected) return;
    if (!context.database || !context.schema || !discoverTablesFast) return;
    discoverTablesFast(context.database, context.schema, false);
  }, [status?.connected, context.database, context.schema, discoverTablesFast]);

  const fetchCapabilities = useCallback(async (refresh = false, includeAllTables = false) => {
    if (!status?.connected || !context.database || !context.schema) return;
    if (capabilitiesAbortRef.current) {
      capabilitiesAbortRef.current.abort();
    }
    const controller = new AbortController();
    capabilitiesAbortRef.current = controller;

    // Skip cache if requesting all tables (more comprehensive scan)
    if (!refresh && !includeAllTables) {
      const cached = loadCapabilitiesCache(context.database, context.schema);
      if (cached) {
        setCapabilities(cached);
        return;
      }
    }

    setCapabilitiesLoading(true);
    try {
      const params = new URLSearchParams({
        database: context.database,
        schema: context.schema,
        refresh: refresh ? 'true' : 'false',
        include_all_tables: includeAllTables ? 'true' : 'false',
      });
      const response = await fetch(`${API_URL}/api/metadata/capabilities?${params.toString()}`, {
        headers: buildHeaders(),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch capabilities (${response.status})`);
      }
      const data = await response.json();
      setCapabilities(data);
      persistCapabilitiesCache(data.database || context.database, data.schema || context.schema, data);

      if (data.database && data.database !== context.database && source !== 'manual') {
        setContext({ database: data.database }, { source: 'auto' });
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        log.warn('Capabilities fetch failed', { error: err.message });
      }
    } finally {
      setCapabilitiesLoading(false);
    }
  }, [status?.connected, context.database, context.schema, source, setContext]);

  const refreshDiscovery = useCallback(() => {
    if (!status?.connected) return;
    discoverDatabases?.(true);
    if (context.database) {
      discoverSchemas?.(context.database, true);
    }
    if (context.database && context.schema) {
      discoverTablesFast?.(context.database, context.schema, true);
    }
  }, [status?.connected, context.database, context.schema, discoverDatabases, discoverSchemas, discoverTablesFast]);

  const refreshCapabilities = useCallback((includeAllTables = false) => {
    fetchCapabilities(true, includeAllTables);
  }, [fetchCapabilities]);

  const fetchAllTableColumns = useCallback(() => {
    fetchCapabilities(false, true);
  }, [fetchCapabilities]);

  useEffect(() => {
    fetchCapabilities(false);
    return () => {
      if (capabilitiesAbortRef.current) {
        capabilitiesAbortRef.current.abort();
      }
    };
  }, [fetchCapabilities]);

  const value = useMemo(() => ({
    context,
    source,
    capabilities,
    capabilitiesLoading,
    setContext,
    setDatabase,
    setSchema,
    setTable,
    refreshDiscovery,
    refreshCapabilities,
    fetchAllTableColumns,
  }), [context, source, capabilities, capabilitiesLoading, setContext, setDatabase, setSchema, setTable, refreshDiscovery, refreshCapabilities, fetchAllTableColumns]);

  return (
    <MdlhContext.Provider value={value}>
      {children}
    </MdlhContext.Provider>
  );
}

export function useMdlhContext() {
  const ctx = useContext(MdlhContext);
  if (!ctx) {
    throw new Error('useMdlhContext must be used within a MdlhProvider');
  }
  return ctx;
}

export default MdlhContext;
