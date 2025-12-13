/**
 * Web Worker for heavy result processing
 *
 * Offloads CPU-intensive operations from main thread:
 * - Filtering large datasets
 * - Sorting
 * - JSON parsing
 * - Data transformations
 */

// Handle messages from main thread
self.onmessage = function (e) {
  const { type, payload, id } = e.data;

  try {
    let result;

    switch (type) {
      case 'FILTER':
        result = filterRows(payload.rows, payload.filter, payload.columns);
        break;

      case 'SORT':
        result = sortRows(payload.rows, payload.column, payload.direction);
        break;

      case 'TRANSFORM':
        result = transformRows(payload.rows, payload.transforms);
        break;

      case 'PARSE_JSON':
        result = parseJsonSafely(payload.json);
        break;

      case 'AGGREGATE':
        result = aggregateRows(payload.rows, payload.groupBy, payload.aggregations);
        break;

      case 'EXPORT_CSV':
        result = exportToCsv(payload.rows, payload.columns);
        break;

      default:
        throw new Error(`Unknown operation: ${type}`);
    }

    self.postMessage({ id, success: true, result });
  } catch (error) {
    self.postMessage({ id, success: false, error: error.message });
  }
};

/**
 * Filter rows by search string across all columns
 */
function filterRows(rows, filter, columns = null) {
  if (!filter || !filter.trim()) return rows;

  const search = filter.toLowerCase();
  const columnsToSearch = columns || (rows[0] ? Object.keys(rows[0]) : []);

  return rows.filter((row) =>
    columnsToSearch.some((col) => {
      const val = row[col];
      if (val === null || val === undefined) return false;
      return String(val).toLowerCase().includes(search);
    })
  );
}

/**
 * Sort rows by column
 */
function sortRows(rows, column, direction = 'asc') {
  if (!column) return rows;

  return [...rows].sort((a, b) => {
    const aVal = a[column];
    const bVal = b[column];

    // Handle nulls
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    // Numeric comparison
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return direction === 'asc' ? aVal - bVal : bVal - aVal;
    }

    // String comparison
    const comparison = String(aVal).localeCompare(String(bVal));
    return direction === 'asc' ? comparison : -comparison;
  });
}

/**
 * Transform rows (e.g., format dates, numbers)
 */
function transformRows(rows, transforms) {
  if (!transforms || Object.keys(transforms).length === 0) return rows;

  return rows.map((row) => {
    const newRow = { ...row };
    for (const [column, transform] of Object.entries(transforms)) {
      if (row[column] !== undefined) {
        newRow[column] = applyTransform(row[column], transform);
      }
    }
    return newRow;
  });
}

function applyTransform(value, transform) {
  switch (transform.type) {
    case 'date':
      return formatDate(value, transform.format);
    case 'number':
      return formatNumber(value, transform.decimals);
    case 'truncate':
      return String(value).substring(0, transform.length);
    default:
      return value;
  }
}

function formatDate(value, format = 'short') {
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;

    if (format === 'relative') {
      const now = new Date();
      const diff = now - date;
      const minutes = Math.floor(diff / 60000);
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    }

    return date.toLocaleDateString();
  } catch {
    return value;
  }
}

function formatNumber(value, decimals = 2) {
  const num = Number(value);
  if (isNaN(num)) return value;
  return num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Parse JSON safely (for large payloads)
 */
function parseJsonSafely(json) {
  if (typeof json === 'object') return json;
  return JSON.parse(json);
}

/**
 * Aggregate rows by groupBy columns
 */
function aggregateRows(rows, groupBy, aggregations) {
  const groups = new Map();

  for (const row of rows) {
    const key = groupBy.map((col) => row[col]).join('|||');

    if (!groups.has(key)) {
      const baseRow = {};
      for (const col of groupBy) {
        baseRow[col] = row[col];
      }
      groups.set(key, { ...baseRow, _count: 0, _rows: [] });
    }

    const group = groups.get(key);
    group._count++;
    group._rows.push(row);
  }

  // Apply aggregations
  return Array.from(groups.values()).map((group) => {
    const result = { ...group };
    delete result._rows;

    for (const [column, aggType] of Object.entries(aggregations)) {
      const values = group._rows.map((r) => r[column]).filter((v) => v !== null);

      switch (aggType) {
        case 'sum':
          result[`${column}_sum`] = values.reduce((a, b) => Number(a) + Number(b), 0);
          break;
        case 'avg':
          result[`${column}_avg`] =
            values.reduce((a, b) => Number(a) + Number(b), 0) / values.length;
          break;
        case 'min':
          result[`${column}_min`] = Math.min(...values.map(Number));
          break;
        case 'max':
          result[`${column}_max`] = Math.max(...values.map(Number));
          break;
        case 'count':
          result[`${column}_count`] = values.length;
          break;
      }
    }

    return result;
  });
}

/**
 * Export rows to CSV string
 */
function exportToCsv(rows, columns) {
  if (!rows || rows.length === 0) return '';

  const cols = columns || Object.keys(rows[0]);

  // Header
  const header = cols.map(escapeCsvValue).join(',');

  // Rows
  const dataRows = rows.map((row) =>
    cols.map((col) => escapeCsvValue(row[col])).join(',')
  );

  return [header, ...dataRows].join('\n');
}

function escapeCsvValue(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
