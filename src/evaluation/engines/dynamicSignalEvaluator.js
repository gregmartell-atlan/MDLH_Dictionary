/**
 * Dynamic Signal Evaluator
 * 
 * Evaluates metadata signals based on DYNAMICALLY DISCOVERED columns.
 * Unlike the static evaluator, this one:
 * - Adapts to whatever columns exist in the MDLH schema
 * - Handles column name variations (OWNER_USERS vs OWNERUSERS)
 * - Gracefully degrades when expected columns are missing
 * - Provides explanations of what could/couldn't be evaluated
 * 
 * This is the RUNTIME evaluator that works with actual data.
 */

import { UNIFIED_FIELD_CATALOG } from '../catalog/unifiedFields';

// =============================================================================
// SIGNAL DEFINITIONS
// =============================================================================

/**
 * All canonical signals in the system
 */
export const CANONICAL_SIGNALS = [
  'OWNERSHIP',
  'SEMANTICS', 
  'LINEAGE',
  'SENSITIVITY',
  'ACCESS',
  'QUALITY',
  'FRESHNESS',
  'USAGE',
  'TRUST',
  'AI_READY',
];

/**
 * Maps signals to their contributing fields
 * Built from UNIFIED_FIELD_CATALOG at runtime
 */
function buildSignalFieldMap() {
  const signalMap = {};
  
  for (const signal of CANONICAL_SIGNALS) {
    signalMap[signal] = {
      fields: [],
      totalWeight: 0,
    };
  }
  
  for (const field of UNIFIED_FIELD_CATALOG) {
    if (!field.contributesToSignals) continue;
    
    for (const contrib of field.contributesToSignals) {
      if (signalMap[contrib.signal]) {
        signalMap[contrib.signal].fields.push({
          fieldId: field.id,
          mdlhColumn: field.mdlhColumn,
          weight: contrib.weight,
          required: contrib.required || false,
          source: field.source,
        });
        signalMap[contrib.signal].totalWeight += contrib.weight;
      }
    }
  }
  
  return signalMap;
}

const SIGNAL_FIELD_MAP = buildSignalFieldMap();

// =============================================================================
// COLUMN NAME VARIATIONS
// =============================================================================

/**
 * Generate possible column name variations
 */
function getColumnVariations(columnName) {
  if (!columnName) return [];
  
  const variations = new Set();
  const upper = columnName.toUpperCase();
  
  // Original
  variations.add(upper);
  
  // Without underscores (OWNER_USERS -> OWNERUSERS)
  variations.add(upper.replace(/_/g, ''));
  
  // With underscores (OWNERUSERS -> OWNER_USERS)
  const withUnderscores = upper.replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
                               .replace(/([a-z])([A-Z])/g, '$1_$2');
  variations.add(withUnderscores);
  
  // With __ prefix (MDLH sometimes uses this)
  variations.add(`__${upper}`);
  
  return Array.from(variations);
}

/**
 * Find a column in the available set, checking variations
 */
function findColumn(columnName, availableColumns) {
  const variations = getColumnVariations(columnName);
  
  for (const variation of variations) {
    if (availableColumns.has(variation)) {
      return variation;
    }
  }
  
  return null;
}

// =============================================================================
// COLUMN TYPE DETECTION
// =============================================================================

const ARRAY_PATTERNS = ['OWNER', 'ADMIN', 'CLASSIFICATION', 'TAG', 'TERM', 'GUID', 'DOMAIN', 'MEANING'];
const BOOLEAN_PATTERNS = ['HAS_', 'IS_', 'ISPRIMARY', 'ISFOREIGN'];

function detectColumnType(columnName, dataType) {
  const upper = columnName.toUpperCase();
  
  if (dataType?.toUpperCase().includes('ARRAY')) return 'array';
  if (dataType?.toUpperCase().includes('BOOLEAN')) return 'boolean';
  if (ARRAY_PATTERNS.some(p => upper.includes(p))) return 'array';
  if (BOOLEAN_PATTERNS.some(p => upper.includes(p))) return 'boolean';
  
  return 'scalar';
}

// =============================================================================
// VALUE EVALUATION
// =============================================================================

/**
 * Check if a value indicates "populated" (true for signal contribution)
 */
function isPopulated(value, columnType) {
  if (value === null || value === undefined) return false;
  
  switch (columnType) {
    case 'array':
      // Arrays must have at least one element
      if (Array.isArray(value)) return value.length > 0;
      // Sometimes arrays come as JSON strings
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) && parsed.length > 0;
        } catch {
          return value.trim() !== '' && value !== '[]';
        }
      }
      return false;
      
    case 'boolean':
      return value === true || value === 'TRUE' || value === 'true' || value === 1;
      
    default:
      // Scalars - non-empty string or non-null value
      if (typeof value === 'string') {
        return value.trim() !== '' && value.toLowerCase() !== 'null';
      }
      return true;
  }
}

// =============================================================================
// DYNAMIC SIGNAL EVALUATOR
// =============================================================================

/**
 * Create a signal evaluator bound to a specific schema's available columns
 */
export function createDynamicSignalEvaluator(availableColumns, columnTypes = {}) {
  // Convert to Set of uppercase column names
  const columnSet = new Set(
    Array.from(availableColumns).map(c => 
      typeof c === 'string' ? c.toUpperCase() : c.name?.toUpperCase()
    ).filter(Boolean)
  );
  
  /**
   * Check which signals can be evaluated with available columns
   */
  const getEvaluableSignals = () => {
    const result = {};
    
    for (const [signal, config] of Object.entries(SIGNAL_FIELD_MAP)) {
      const evaluableFields = [];
      const missingFields = [];
      let evaluableWeight = 0;
      
      for (const field of config.fields) {
        const matchedColumn = findColumn(field.mdlhColumn, columnSet);
        
        if (matchedColumn) {
          evaluableFields.push({
            ...field,
            matchedColumn,
            columnType: columnTypes[matchedColumn] || detectColumnType(matchedColumn, null),
          });
          evaluableWeight += field.weight;
        } else {
          missingFields.push(field);
        }
      }
      
      result[signal] = {
        signal,
        canEvaluate: evaluableFields.length > 0,
        evaluableFields,
        missingFields,
        evaluableWeight,
        totalWeight: config.totalWeight,
        coverage: config.totalWeight > 0 
          ? (evaluableWeight / config.totalWeight * 100).toFixed(1) 
          : 0,
      };
    }
    
    return result;
  };
  
  /**
   * Evaluate a single signal for an asset row
   */
  const evaluateSignal = (signalType, assetRow) => {
    const signalConfig = SIGNAL_FIELD_MAP[signalType];
    if (!signalConfig) {
      return { value: 'UNKNOWN', reason: `Unknown signal type: ${signalType}` };
    }
    
    const contributions = [];
    let anyTrue = false;
    let anyFalse = false;
    let totalWeight = 0;
    let populatedWeight = 0;
    
    for (const field of signalConfig.fields) {
      const matchedColumn = findColumn(field.mdlhColumn, columnSet);
      
      if (!matchedColumn) {
        contributions.push({
          fieldId: field.fieldId,
          column: field.mdlhColumn,
          status: 'missing',
          value: null,
          populated: false,
        });
        continue;
      }
      
      // Get value from asset row (case-insensitive)
      const rowKeys = Object.keys(assetRow);
      const actualKey = rowKeys.find(k => k.toUpperCase() === matchedColumn);
      const value = actualKey ? assetRow[actualKey] : null;
      
      const colType = columnTypes[matchedColumn] || detectColumnType(matchedColumn, null);
      const populated = isPopulated(value, colType);
      
      contributions.push({
        fieldId: field.fieldId,
        column: matchedColumn,
        status: 'found',
        value,
        populated,
        weight: field.weight,
      });
      
      totalWeight += field.weight;
      if (populated) {
        populatedWeight += field.weight;
        anyTrue = true;
      } else {
        anyFalse = true;
      }
    }
    
    // Determine final signal value
    let signalValue;
    let reason;
    
    if (!contributions.some(c => c.status === 'found')) {
      signalValue = 'UNKNOWN';
      reason = 'No contributing columns available in schema';
    } else if (anyTrue) {
      signalValue = true;
      reason = `${contributions.filter(c => c.populated).length} of ${contributions.filter(c => c.status === 'found').length} fields populated`;
    } else {
      signalValue = false;
      reason = 'All available contributing fields are empty';
    }
    
    return {
      signal: signalType,
      value: signalValue,
      score: totalWeight > 0 ? populatedWeight / totalWeight : 0,
      contributions,
      reason,
    };
  };
  
  /**
   * Evaluate all signals for an asset row
   */
  const evaluateAllSignals = (assetRow) => {
    const results = {};
    
    for (const signal of CANONICAL_SIGNALS) {
      results[signal] = evaluateSignal(signal, assetRow);
    }
    
    return results;
  };
  
  /**
   * Compute aggregate scores for a batch of assets
   */
  const evaluateBatch = (assetRows) => {
    const batchResults = {
      totalAssets: assetRows.length,
      signals: {},
    };
    
    // Initialize signal aggregates
    for (const signal of CANONICAL_SIGNALS) {
      batchResults.signals[signal] = {
        signal,
        trueCount: 0,
        falseCount: 0,
        unknownCount: 0,
        avgScore: 0,
        scores: [],
      };
    }
    
    // Evaluate each asset
    for (const row of assetRows) {
      const signals = evaluateAllSignals(row);
      
      for (const [signalType, result] of Object.entries(signals)) {
        const agg = batchResults.signals[signalType];
        
        if (result.value === true) {
          agg.trueCount++;
        } else if (result.value === false) {
          agg.falseCount++;
        } else {
          agg.unknownCount++;
        }
        
        if (typeof result.score === 'number') {
          agg.scores.push(result.score);
        }
      }
    }
    
    // Compute averages
    for (const agg of Object.values(batchResults.signals)) {
      if (agg.scores.length > 0) {
        agg.avgScore = agg.scores.reduce((a, b) => a + b, 0) / agg.scores.length;
      }
      delete agg.scores; // Remove temp array
    }
    
    return batchResults;
  };
  
  /**
   * Get a human-readable summary of evaluator capabilities
   */
  const getSummary = () => {
    const evaluable = getEvaluableSignals();
    
    const fullyEvaluable = Object.values(evaluable).filter(e => e.coverage === '100.0').length;
    const partiallyEvaluable = Object.values(evaluable).filter(e => e.canEvaluate && e.coverage !== '100.0').length;
    const notEvaluable = Object.values(evaluable).filter(e => !e.canEvaluate).length;
    
    return {
      totalSignals: CANONICAL_SIGNALS.length,
      fullyEvaluable,
      partiallyEvaluable,
      notEvaluable,
      availableColumns: columnSet.size,
      signals: evaluable,
    };
  };
  
  return {
    // Schema info
    availableColumns: columnSet,
    columnCount: columnSet.size,
    
    // Capability checks
    getEvaluableSignals,
    canEvaluate: (signalType) => {
      const evaluable = getEvaluableSignals();
      return evaluable[signalType]?.canEvaluate || false;
    },
    
    // Evaluation functions
    evaluateSignal,
    evaluateAllSignals,
    evaluateBatch,
    
    // Utilities
    getSummary,
    findColumn: (colName) => findColumn(colName, columnSet),
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export { SIGNAL_FIELD_MAP };
export default createDynamicSignalEvaluator;
