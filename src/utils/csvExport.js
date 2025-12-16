/**
 * Generate CSV content from data
 * @param {Array} data - Array of entity objects
 * @param {Array} columns - Array of column keys to include
 * @param {Object} colHeaders - Map of column keys to display headers
 * @returns {string} CSV content as string
 */
export function generateCSV(data, columns, colHeaders) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return columns.map((c) => colHeaders[c]).join(',');
  }

  const header = columns.map((c) => colHeaders[c]).join(',');
  const rows = data.map((row) =>
    columns
      .map((c) => `"${(row[c] || '').toString().replace(/"/g, '""')}"`)
      .join(',')
  );

  return [header, ...rows].join('\n');
}

/**
 * Download CSV content as a file
 * @param {string} csvContent - CSV string content
 * @param {string} filename - Name of the file to download
 */
export function downloadCSVFile(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
