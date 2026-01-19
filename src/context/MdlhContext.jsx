/**
 * MdlhContext - Centralized MDLH database/schema context for the UI.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createLogger } from '../utils/logger';
import { DEFAULT_DATABASE, DEFAULT_SCHEMA } from '../data/constants';
import { useConnectionContext } from './ConnectionContext';
import { useDynamicSchema } from './DynamicSchemaContext';

const log = createLogger('MdlhContext');
const MDLH_CONTEXT_KEY = 'mdlh_context';

const defaultContextValue = {
  context: {
    database: DEFAULT_DATABASE,
    schema: DEFAULT_SCHEMA,
    warehouse: null,
    table: null,
  },
  source: 'default',
  setContext: () => {},
  setDatabase: () => {},
  setSchema: () => {},
  setTable: () => {},
  refreshDiscovery: () => {},
};

const MdlhContext = createContext(defaultContextValue);

function loadStoredContext() {
  const raw = sessionStorage.getItem(MDLH_CONTEXT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    sessionStorage.removeItem(MDLH_CONTEXT_KEY);
    return null;
  }
}

function persistContext(next) {
  try {
    sessionStorage.setItem(MDLH_CONTEXT_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors (private mode/quotas)
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

  const lastSessionIdRef = useRef(null);

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

  const value = useMemo(() => ({
    context,
    source,
    setContext,
    setDatabase,
    setSchema,
    setTable,
    refreshDiscovery,
  }), [context, source, setContext, setDatabase, setSchema, setTable, refreshDiscovery]);

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
