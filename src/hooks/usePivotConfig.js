/**
 * usePivotConfig - State management for pivot table configuration
 *
 * Uses useReducer pattern for complex pivot state with actions:
 * - addToZone: Add field to a drop zone (rows/columns/values/filters)
 * - removeFromZone: Remove field from a zone
 * - reorderZone: Reorder fields within a zone
 * - setAggregation: Change aggregation function for a measure
 * - addFilter: Add filter condition
 * - removeFilter: Remove filter condition
 * - setResults: Update query execution results
 * - setLoading: Update loading state
 * - setError: Update error state
 */

import { useReducer, useCallback } from 'react';

// Default options for pivot configuration
const DEFAULT_OPTIONS = {
  showSubtotals: false,
  showGrandTotals: false,
  nullValueDisplay: '(empty)',
  limitRows: 1000,
};

// Initial state factory
function createInitialState(database, schema, table) {
  return {
    source: {
      database: database || null,
      schema: schema || null,
      table: table || null,
      availableFields: [],
    },
    rows: [],
    columns: [],
    values: [],
    filters: [],
    options: DEFAULT_OPTIONS,
    execution: {
      sql: null,
      results: null,
      loading: false,
      error: null,
    },
  };
}

// Reducer actions
const ACTIONS = {
  ADD_TO_ZONE: 'ADD_TO_ZONE',
  REMOVE_FROM_ZONE: 'REMOVE_FROM_ZONE',
  REORDER_ZONE: 'REORDER_ZONE',
  SET_AGGREGATION: 'SET_AGGREGATION',
  ADD_FILTER: 'ADD_FILTER',
  REMOVE_FILTER: 'REMOVE_FILTER',
  UPDATE_FILTER: 'UPDATE_FILTER',
  SET_AVAILABLE_FIELDS: 'SET_AVAILABLE_FIELDS',
  SET_SOURCE: 'SET_SOURCE',
  SET_SQL: 'SET_SQL',
  SET_RESULTS: 'SET_RESULTS',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  CLEAR_EXECUTION: 'CLEAR_EXECUTION',
  RESET_CONFIG: 'RESET_CONFIG',
};

// Reducer function
function pivotReducer(state, action) {
  switch (action.type) {
    case ACTIONS.ADD_TO_ZONE: {
      const { zone, field } = action.payload;

      // Don't add if already in zone
      if (state[zone].some(f => f.fieldName === field.fieldName)) {
        return state;
      }

      // For values zone, ensure aggregation is set
      if (zone === 'values') {
        return {
          ...state,
          [zone]: [
            ...state[zone],
            {
              ...field,
              aggregation: field.aggregation || field.defaultAggregation || 'COUNT',
              alias: field.alias || field.fieldName.toLowerCase(),
            },
          ],
        };
      }

      // For other zones
      return {
        ...state,
        [zone]: [...state[zone], field],
      };
    }

    case ACTIONS.REMOVE_FROM_ZONE: {
      const { zone, fieldName } = action.payload;
      return {
        ...state,
        [zone]: state[zone].filter(f => f.fieldName !== fieldName),
      };
    }

    case ACTIONS.REORDER_ZONE: {
      const { zone, fromIndex, toIndex } = action.payload;
      const newArray = [...state[zone]];
      const [removed] = newArray.splice(fromIndex, 1);
      newArray.splice(toIndex, 0, removed);
      return {
        ...state,
        [zone]: newArray,
      };
    }

    case ACTIONS.SET_AGGREGATION: {
      const { fieldName, aggregation } = action.payload;
      return {
        ...state,
        values: state.values.map(v =>
          v.fieldName === fieldName ? { ...v, aggregation } : v
        ),
      };
    }

    case ACTIONS.ADD_FILTER: {
      const { filter } = action.payload;
      return {
        ...state,
        filters: [...state.filters, filter],
      };
    }

    case ACTIONS.REMOVE_FILTER: {
      const { fieldName } = action.payload;
      return {
        ...state,
        filters: state.filters.filter(f => f.fieldName !== fieldName),
      };
    }

    case ACTIONS.UPDATE_FILTER: {
      const { fieldName, updates } = action.payload;
      return {
        ...state,
        filters: state.filters.map(f =>
          f.fieldName === fieldName ? { ...f, ...updates } : f
        ),
      };
    }

    case ACTIONS.SET_AVAILABLE_FIELDS: {
      return {
        ...state,
        source: {
          ...state.source,
          availableFields: action.payload.fields,
        },
      };
    }

    case ACTIONS.SET_SOURCE: {
      const { database, schema, table } = action.payload;
      return {
        ...state,
        source: {
          database,
          schema,
          table,
          availableFields: [], // Reset fields when source changes
        },
        // Clear configuration when source changes
        rows: [],
        columns: [],
        values: [],
        filters: [],
      };
    }

    case ACTIONS.SET_SQL: {
      return {
        ...state,
        execution: {
          ...state.execution,
          sql: action.payload.sql,
        },
      };
    }

    case ACTIONS.SET_RESULTS: {
      return {
        ...state,
        execution: {
          ...state.execution,
          results: action.payload.results,
          loading: false,
          error: null,
        },
      };
    }

    case ACTIONS.SET_LOADING: {
      return {
        ...state,
        execution: {
          ...state.execution,
          loading: action.payload.loading,
          error: null,
        },
      };
    }

    case ACTIONS.SET_ERROR: {
      return {
        ...state,
        execution: {
          ...state.execution,
          error: action.payload.error,
          loading: false,
        },
      };
    }

    case ACTIONS.CLEAR_EXECUTION: {
      return {
        ...state,
        execution: {
          sql: null,
          results: null,
          loading: false,
          error: null,
        },
      };
    }

    case ACTIONS.RESET_CONFIG: {
      return createInitialState(
        state.source.database,
        state.source.schema,
        state.source.table
      );
    }

    default:
      return state;
  }
}

/**
 * Hook for managing pivot table configuration state
 */
export function usePivotConfig(database, schema, table) {
  const [state, dispatch] = useReducer(
    pivotReducer,
    createInitialState(database, schema, table)
  );

  // Action creators (memoized to prevent unnecessary re-renders)
  const addToZone = useCallback((zone, field) => {
    dispatch({ type: ACTIONS.ADD_TO_ZONE, payload: { zone, field } });
  }, []);

  const removeFromZone = useCallback((zone, fieldName) => {
    dispatch({ type: ACTIONS.REMOVE_FROM_ZONE, payload: { zone, fieldName } });
  }, []);

  const reorderZone = useCallback((zone, fromIndex, toIndex) => {
    dispatch({ type: ACTIONS.REORDER_ZONE, payload: { zone, fromIndex, toIndex } });
  }, []);

  const setAggregation = useCallback((fieldName, aggregation) => {
    dispatch({ type: ACTIONS.SET_AGGREGATION, payload: { fieldName, aggregation } });
  }, []);

  const addFilter = useCallback((filter) => {
    dispatch({ type: ACTIONS.ADD_FILTER, payload: { filter } });
  }, []);

  const removeFilter = useCallback((fieldName) => {
    dispatch({ type: ACTIONS.REMOVE_FILTER, payload: { fieldName } });
  }, []);

  const updateFilter = useCallback((fieldName, updates) => {
    dispatch({ type: ACTIONS.UPDATE_FILTER, payload: { fieldName, updates } });
  }, []);

  const setAvailableFields = useCallback((fields) => {
    dispatch({ type: ACTIONS.SET_AVAILABLE_FIELDS, payload: { fields } });
  }, []);

  const setSource = useCallback((database, schema, table) => {
    dispatch({ type: ACTIONS.SET_SOURCE, payload: { database, schema, table } });
  }, []);

  const setSQL = useCallback((sql) => {
    dispatch({ type: ACTIONS.SET_SQL, payload: { sql } });
  }, []);

  const setResults = useCallback((results) => {
    dispatch({ type: ACTIONS.SET_RESULTS, payload: { results } });
  }, []);

  const setLoading = useCallback((loading) => {
    dispatch({ type: ACTIONS.SET_LOADING, payload: { loading } });
  }, []);

  const setError = useCallback((error) => {
    dispatch({ type: ACTIONS.SET_ERROR, payload: { error } });
  }, []);

  const clearExecution = useCallback(() => {
    dispatch({ type: ACTIONS.CLEAR_EXECUTION });
  }, []);

  const resetConfig = useCallback(() => {
    dispatch({ type: ACTIONS.RESET_CONFIG });
  }, []);

  return {
    // State
    config: state,

    // Actions
    addToZone,
    removeFromZone,
    reorderZone,
    setAggregation,
    addFilter,
    removeFilter,
    updateFilter,
    setAvailableFields,
    setSource,
    setSQL,
    setResults,
    setLoading,
    setError,
    clearExecution,
    resetConfig,
  };
}

export default usePivotConfig;
