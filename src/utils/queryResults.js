export function normalizeQueryRows(rawResult, options = {}) {
  let rows = rawResult?.rows || [];
  let columns = rawResult?.columns || [];
  if (!Array.isArray(rows)) return [];

  // Unwrap nested row payloads like [[{...}]] or [[[...]]]
  if (rows.length > 0 && rows.every((row) => Array.isArray(row) && row.length === 1)) {
    const nestedValue = rows[0]?.[0];
    if (Array.isArray(nestedValue) || (nestedValue && typeof nestedValue === 'object' && !Array.isArray(nestedValue))) {
      rows = rows.map((row) => row[0]);
    }
  }

  if (Array.isArray(columns)) {
    columns = columns
      .map((col) => (typeof col === 'string' ? col : col?.name))
      .filter(Boolean);
  } else {
    columns = [];
  }

  if (columns.length === 1 && typeof columns[0] === 'string' && columns[0].includes(',')) {
    columns = columns[0]
      .split(',')
      .map((col) => col.trim())
      .filter(Boolean);
  }

  const maxRowLength = rows.reduce((max, row) => {
    if (Array.isArray(row)) {
      return Math.max(max, row.length);
    }
    if (row && typeof row === 'object') {
      return Math.max(max, Object.keys(row).length);
    }
    return max;
  }, 0);

  if (columns.length === 0 && Array.isArray(options.fallbackColumns)) {
    columns = options.fallbackColumns;
  }

  if ((columns.length === 0 || columns.length < maxRowLength) && options.fallbackByLength) {
    const lengths = Object.keys(options.fallbackByLength)
      .map((length) => Number(length))
      .filter((length) => Number.isFinite(length))
      .sort((a, b) => b - a);
    for (const length of lengths) {
      if (maxRowLength >= length) {
        columns = options.fallbackByLength[length];
        break;
      }
    }
  }

  return rows.map((row) => {
    if (Array.isArray(row)) {
      return columns.reduce((acc, col, idx) => {
        acc[col] = row[idx];
        return acc;
      }, {});
    }
    if (row && typeof row === 'object' && columns.length > 0) {
      const keys = Object.keys(row);
      const isNumericKeyed = keys.length > 0 && keys.every((key) => /^\d+$/.test(key));
      if (isNumericKeyed) {
        return columns.reduce((acc, col, idx) => {
          acc[col] = row[idx];
          return acc;
        }, {});
      }
    }
    return row || {};
  });
}
