/**
 * useColumnMatcher Hook
 * 
 * Provides intelligent column matching capabilities for MDLH schemas.
 * Uses the column matcher utility to match catalog fields to actual
 * database columns with fuzzy matching and confidence scoring.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useDynamicSchema } from '../context/DynamicSchemaContext';
import { UNIFIED_FIELD_CATALOG } from '../evaluation/catalog/unifiedFields';
import {
  matchCatalogToColumns,
  matchFieldToColumn,
  suggestFieldsForColumns,
  identifyColumn,
  inferColumnCategory,
  MATCH_CONFIDENCE,
} from '../utils/columnMatcher';

/**
 * Hook to match unified field catalog to discovered columns
 * @param {Object} options
 * @param {string} [options.tableName] - Specific table to match against (default: uses all discovered columns)
 * @param {boolean} [options.autoMatch] - Whether to automatically match on mount/column change
 * @returns {Object} Column matching utilities and state
 */
export function useColumnMatcher({ tableName = null, autoMatch = true } = {}) {
  const { capabilities, isLoading: schemaLoading } = useDynamicSchema();
  
  const [matchResult, setMatchResult] = useState(null);
  const [isMatching, setIsMatching] = useState(false);
  const [lastMatchedAt, setLastMatchedAt] = useState(null);

  /**
   * Get available columns from capabilities
   */
  const availableColumns = useMemo(() => {
    if (!capabilities?.columns) return [];
    
    if (tableName) {
      // Get columns for specific table
      const tableColumns = capabilities.columns[tableName] || 
                          capabilities.columns[tableName.toUpperCase()] || [];
      return tableColumns.map(c => c.name || c);
    }
    
    // Get all columns from all tables
    const allColumns = new Set();
    for (const cols of Object.values(capabilities.columns)) {
      for (const col of cols) {
        allColumns.add(col.name || col);
      }
    }
    return Array.from(allColumns);
  }, [capabilities, tableName]);

  /**
   * Get column info including which table it's from
   */
  const columnInfo = useMemo(() => {
    if (!capabilities?.columns) return new Map();
    
    const info = new Map();
    for (const [table, cols] of Object.entries(capabilities.columns)) {
      for (const col of cols) {
        const name = col.name || col;
        if (!info.has(name)) {
          info.set(name, {
            name,
            type: col.type || 'UNKNOWN',
            tables: [table],
          });
        } else {
          info.get(name).tables.push(table);
        }
      }
    }
    return info;
  }, [capabilities]);

  /**
   * Prepare field catalog for matching
   */
  const fieldCatalog = useMemo(() => {
    return UNIFIED_FIELD_CATALOG.map(field => ({
      id: field.id,
      displayName: field.displayName,
      mdlhColumn: field.mdlhColumn,
      category: field.category,
      signals: field.contributesToSignals?.map(s => s.signal) || [],
    }));
  }, []);

  /**
   * Perform column matching
   */
  const performMatch = useCallback(() => {
    if (availableColumns.length === 0) {
      setMatchResult(null);
      return null;
    }

    setIsMatching(true);
    try {
      const result = matchCatalogToColumns(fieldCatalog, availableColumns);
      
      // Enhance with column info
      result.catalog = result.catalog.map(item => ({
        ...item,
        columnInfo: item.matchedColumn ? columnInfo.get(item.matchedColumn) : null,
        category: fieldCatalog.find(f => f.id === item.fieldId)?.category,
      }));
      
      // Add suggestions for unmatched columns
      result.suggestions = suggestFieldsForColumns(result.unmatchedColumns);
      
      setMatchResult(result);
      setLastMatchedAt(new Date());
      return result;
    } finally {
      setIsMatching(false);
    }
  }, [availableColumns, fieldCatalog, columnInfo]);

  /**
   * Auto-match when columns change
   */
  useEffect(() => {
    if (autoMatch && availableColumns.length > 0 && !schemaLoading) {
      performMatch();
    }
  }, [autoMatch, availableColumns, schemaLoading, performMatch]);

  /**
   * Match a single field to available columns
   */
  const matchField = useCallback((fieldId, mdlhColumn = null) => {
    return matchFieldToColumn(fieldId, availableColumns, mdlhColumn);
  }, [availableColumns]);

  /**
   * Check if a field has a matching column
   */
  const hasMatchingColumn = useCallback((fieldId) => {
    if (!matchResult) return false;
    const field = matchResult.catalog.find(f => f.fieldId === fieldId);
    return field?.matched || false;
  }, [matchResult]);

  /**
   * Get the matched column for a field
   */
  const getMatchedColumn = useCallback((fieldId) => {
    if (!matchResult) return null;
    const field = matchResult.catalog.find(f => f.fieldId === fieldId);
    return field?.matchedColumn || null;
  }, [matchResult]);

  /**
   * Get match confidence for a field
   */
  const getMatchConfidence = useCallback((fieldId) => {
    if (!matchResult) return 0;
    const field = matchResult.catalog.find(f => f.fieldId === fieldId);
    return field?.matchConfidence || 0;
  }, [matchResult]);

  /**
   * Get fields by category with their match status
   */
  const getFieldsByCategory = useCallback((category) => {
    if (!matchResult) return [];
    return matchResult.catalog.filter(f => f.category === category);
  }, [matchResult]);

  /**
   * Get matched fields only
   */
  const matchedFields = useMemo(() => {
    if (!matchResult) return [];
    return matchResult.catalog.filter(f => f.matched);
  }, [matchResult]);

  /**
   * Get unmatched fields only
   */
  const unmatchedFields = useMemo(() => {
    if (!matchResult) return [];
    return matchResult.catalog.filter(f => !f.matched);
  }, [matchResult]);

  /**
   * Get high-confidence matches only
   */
  const highConfidenceMatches = useMemo(() => {
    if (!matchResult) return [];
    return matchResult.catalog.filter(
      f => f.matchConfidence >= MATCH_CONFIDENCE.thresholds.high
    );
  }, [matchResult]);

  /**
   * Identify what a column might represent
   */
  const identifyColumnField = useCallback((columnName) => {
    return identifyColumn(columnName);
  }, []);

  /**
   * Get category for a column
   */
  const getColumnCategory = useCallback((columnName) => {
    return inferColumnCategory(columnName);
  }, []);

  /**
   * Get coverage stats by category
   */
  const coverageByCategory = useMemo(() => {
    if (!matchResult) return {};
    
    const categories = {};
    for (const field of matchResult.catalog) {
      const cat = field.category || 'unknown';
      if (!categories[cat]) {
        categories[cat] = { total: 0, matched: 0, fields: [] };
      }
      categories[cat].total++;
      if (field.matched) {
        categories[cat].matched++;
      }
      categories[cat].fields.push(field);
    }
    
    // Calculate percentages
    for (const cat of Object.values(categories)) {
      cat.percentage = cat.total > 0 
        ? Math.round((cat.matched / cat.total) * 100) 
        : 0;
    }
    
    return categories;
  }, [matchResult]);

  /**
   * Get coverage stats by signal
   */
  const coverageBySignal = useMemo(() => {
    if (!matchResult) return {};
    
    const signals = {};
    for (const field of matchResult.catalog) {
      const fieldDef = fieldCatalog.find(f => f.id === field.fieldId);
      if (!fieldDef?.signals) continue;
      
      for (const signal of fieldDef.signals) {
        if (!signals[signal]) {
          signals[signal] = { total: 0, matched: 0, fields: [] };
        }
        signals[signal].total++;
        if (field.matched) {
          signals[signal].matched++;
        }
        signals[signal].fields.push(field);
      }
    }
    
    // Calculate percentages
    for (const sig of Object.values(signals)) {
      sig.percentage = sig.total > 0 
        ? Math.round((sig.matched / sig.total) * 100) 
        : 0;
    }
    
    return signals;
  }, [matchResult, fieldCatalog]);

  return {
    // State
    matchResult,
    isMatching,
    isLoading: schemaLoading || isMatching,
    lastMatchedAt,
    availableColumns,
    columnInfo,
    
    // Stats
    stats: matchResult?.stats || null,
    coverageByCategory,
    coverageBySignal,
    
    // Filtered results
    matchedFields,
    unmatchedFields,
    highConfidenceMatches,
    suggestions: matchResult?.suggestions || [],
    
    // Methods
    performMatch,
    matchField,
    hasMatchingColumn,
    getMatchedColumn,
    getMatchConfidence,
    getFieldsByCategory,
    identifyColumnField,
    getColumnCategory,
  };
}

export default useColumnMatcher;
