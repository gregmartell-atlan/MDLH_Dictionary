/**
 * useFieldDiscovery - Discover available fields from selected table
 *
 * Queries INFORMATION_SCHEMA.COLUMNS to get field metadata and
 * auto-classifies fields as dimensions (categorical) or measures (numeric)
 * for intelligent pivot configuration defaults.
 */

import { useState, useEffect } from 'react';
import { useQuery } from './useSnowflake';
import { buildSafeFQN, escapeStringValue } from '../utils/queryHelpers';
import { normalizeRows } from '../utils/queryResultAdapter';
import { Type, Hash, List, Braces, Clock, ToggleLeft, Circle } from 'lucide-react';

/**
 * Get icon component for data type
 */
export function getTypeIcon(dataType) {
  const type = dataType?.toUpperCase() || '';

  if (type.includes('VARCHAR') || type.includes('CHAR') || type.includes('TEXT') || type.includes('STRING')) {
    return Type; // Abc icon
  }
  if (type.includes('NUMBER') || type.includes('INT') || type.includes('FLOAT') || type.includes('DECIMAL') || type.includes('NUMERIC')) {
    return Hash; // # icon
  }
  if (type.includes('ARRAY')) {
    return List; // List icon
  }
  if (type.includes('OBJECT') || type.includes('VARIANT')) {
    return Braces; // {} icon
  }
  if (type.includes('TIMESTAMP') || type.includes('DATE') || type.includes('TIME')) {
    return Clock; // Clock icon
  }
  if (type.includes('BOOL')) {
    return ToggleLeft; // Toggle icon
  }

  return Circle; // Default icon
}

/**
 * Determine default aggregation based on data type
 */
export function getDefaultAggregation(dataType) {
  const type = dataType?.toUpperCase() || '';

  const numericTypes = ['NUMBER', 'DECIMAL', 'FLOAT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT', 'DOUBLE', 'REAL', 'NUMERIC'];

  if (numericTypes.some(t => type.includes(t))) {
    return 'SUM'; // Default to SUM for numeric fields
  }

  return 'COUNT'; // Default to COUNT for categorical fields
}

/**
 * Classify field as dimension or measure based on data type
 */
export function classifyField(dataType) {
  const type = dataType?.toUpperCase() || '';

  const numericTypes = ['NUMBER', 'DECIMAL', 'FLOAT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT', 'DOUBLE', 'REAL', 'NUMERIC'];

  if (numericTypes.some(t => type.includes(t))) {
    return 'measure'; // Numeric = aggregatable
  }

  return 'dimension'; // Non-numeric = groupable
}

/**
 * Hook to discover fields from a table
 */
export function useFieldDiscovery(database, schema, table) {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { executeQuery } = useQuery();

  useEffect(() => {
    if (!database || !schema || !table) {
      setFields([]);
      return;
    }

    const discoverFields = async () => {
      setLoading(true);
      setError(null);

      try {
        // Query INFORMATION_SCHEMA.COLUMNS for field metadata
        const fqn = buildSafeFQN(database, schema, 'INFORMATION_SCHEMA.COLUMNS');
        const sql = `
SELECT
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT,
    ORDINAL_POSITION,
    COMMENT
FROM ${fqn}
WHERE TABLE_SCHEMA = ${escapeStringValue(schema)}
  AND TABLE_NAME = ${escapeStringValue(table)}
ORDER BY ORDINAL_POSITION;
        `.trim();

        const result = await executeQuery(sql);

        if (result?.rows) {
          const normalizedRows = normalizeRows(result);

          const discoveredFields = normalizedRows.map(row => {
            const fieldName = row.COLUMN_NAME;
            const dataType = row.DATA_TYPE;
            const fieldType = classifyField(dataType);

            return {
              fieldName,
              dataType,
              isNullable: row.IS_NULLABLE === 'YES',
              fieldType, // 'dimension' or 'measure'
              defaultAggregation: getDefaultAggregation(dataType),
              icon: getTypeIcon(dataType),
              comment: row.COMMENT || null,
              ordinalPosition: row.ORDINAL_POSITION,
            };
          });

          setFields(discoveredFields);
        } else {
          setFields([]);
        }

        setLoading(false);
      } catch (err) {
        console.error('[useFieldDiscovery] Error discovering fields:', err);
        setError(err.message || 'Failed to discover fields');
        setFields([]);
        setLoading(false);
      }
    };

    discoverFields();
  }, [database, schema, table, executeQuery]);

  return { fields, loading, error };
}

export default useFieldDiscovery;
