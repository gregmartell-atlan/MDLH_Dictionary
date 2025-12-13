/**
 * useResultProcessor - Web Worker hook for heavy data processing
 *
 * Offloads CPU-intensive operations to a background thread:
 * - Large dataset filtering
 * - Sorting 100k+ rows
 * - CSV export generation
 *
 * Falls back to main thread if Workers unavailable.
 */

import { useCallback, useRef, useEffect, useState } from 'react';

// Create worker instance (singleton)
let workerInstance = null;
let workerCallbacks = new Map();
let messageId = 0;

function getWorker() {
  if (!workerInstance && typeof Worker !== 'undefined') {
    try {
      workerInstance = new Worker(
        new URL('../workers/resultProcessor.worker.js', import.meta.url),
        { type: 'module' }
      );

      workerInstance.onmessage = (e) => {
        const { id, success, result, error } = e.data;
        const callback = workerCallbacks.get(id);
        if (callback) {
          workerCallbacks.delete(id);
          if (success) {
            callback.resolve(result);
          } else {
            callback.reject(new Error(error));
          }
        }
      };

      workerInstance.onerror = (e) => {
        console.error('Worker error:', e);
      };
    } catch (err) {
      console.warn('Web Worker not available, using main thread:', err);
      workerInstance = null;
    }
  }
  return workerInstance;
}

/**
 * Send message to worker and wait for response
 */
function sendToWorker(type, payload) {
  return new Promise((resolve, reject) => {
    const worker = getWorker();

    if (!worker) {
      // Fallback: process on main thread
      reject(new Error('Worker not available'));
      return;
    }

    const id = ++messageId;
    workerCallbacks.set(id, { resolve, reject });

    worker.postMessage({ type, payload, id });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (workerCallbacks.has(id)) {
        workerCallbacks.delete(id);
        reject(new Error('Worker timeout'));
      }
    }, 30000);
  });
}

/**
 * Main hook for result processing
 */
export function useResultProcessor() {
  const [isProcessing, setIsProcessing] = useState(false);

  /**
   * Filter rows using worker (for large datasets)
   */
  const filterRows = useCallback(async (rows, filter, columns = null) => {
    // For small datasets, process on main thread
    if (rows.length < 1000) {
      return filterRowsSync(rows, filter, columns);
    }

    setIsProcessing(true);
    try {
      return await sendToWorker('FILTER', { rows, filter, columns });
    } catch {
      // Fallback to main thread
      return filterRowsSync(rows, filter, columns);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  /**
   * Sort rows using worker (for large datasets)
   */
  const sortRows = useCallback(async (rows, column, direction = 'asc') => {
    if (rows.length < 1000) {
      return sortRowsSync(rows, column, direction);
    }

    setIsProcessing(true);
    try {
      return await sendToWorker('SORT', { rows, column, direction });
    } catch {
      return sortRowsSync(rows, column, direction);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  /**
   * Export to CSV using worker
   */
  const exportToCsv = useCallback(async (rows, columns) => {
    if (rows.length < 5000) {
      return exportToCsvSync(rows, columns);
    }

    setIsProcessing(true);
    try {
      return await sendToWorker('EXPORT_CSV', { rows, columns });
    } catch {
      return exportToCsvSync(rows, columns);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  /**
   * Aggregate rows using worker
   */
  const aggregateRows = useCallback(async (rows, groupBy, aggregations) => {
    setIsProcessing(true);
    try {
      return await sendToWorker('AGGREGATE', { rows, groupBy, aggregations });
    } catch {
      // No sync fallback for aggregation - it's complex
      throw new Error('Aggregation requires Web Worker support');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return {
    filterRows,
    sortRows,
    exportToCsv,
    aggregateRows,
    isProcessing,
  };
}

// =============================================================================
// Sync fallbacks (main thread)
// =============================================================================

function filterRowsSync(rows, filter, columns = null) {
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

function sortRowsSync(rows, column, direction = 'asc') {
  if (!column) return rows;

  return [...rows].sort((a, b) => {
    const aVal = a[column];
    const bVal = b[column];

    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return direction === 'asc' ? aVal - bVal : bVal - aVal;
    }

    const comparison = String(aVal).localeCompare(String(bVal));
    return direction === 'asc' ? comparison : -comparison;
  });
}

function exportToCsvSync(rows, columns) {
  if (!rows || rows.length === 0) return '';
  const cols = columns || Object.keys(rows[0]);

  const escapeCsvValue = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = cols.map(escapeCsvValue).join(',');
  const dataRows = rows.map((row) =>
    cols.map((col) => escapeCsvValue(row[col])).join(',')
  );

  return [header, ...dataRows].join('\n');
}

export default useResultProcessor;
