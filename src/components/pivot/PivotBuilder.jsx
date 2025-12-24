/**
 * PivotBuilder - Main pivot table builder component
 *
 * Excel-style drag-and-drop interface for building aggregation queries
 * without writing SQL. Generates and executes safe SQL queries.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Play, Code2, Download, RotateCcw, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { usePivotConfig } from '../../hooks/usePivotConfig';
import { useFieldDiscovery } from '../../hooks/useFieldDiscovery';
import { useQuery } from '../../hooks/useSnowflake';
import { generatePivotSQL, validatePivotConfig } from '../../utils/pivotSQLGenerator';
import { getRecommendedPivots } from '../../utils/pivotTemplates';
import { PivotConfigPanel } from './PivotConfigPanel';
import { TemplateSelector } from './TemplateSelector';
import ResultsTable from '../ResultsTable';

export function PivotBuilder({ database, schema, initialTable = null }) {
  const [selectedTable, setSelectedTable] = useState(initialTable);
  const [showSQL, setShowSQL] = useState(false);

  // Hooks
  const {
    config,
    addToZone,
    removeFromZone,
    reorderZone,
    setAggregation,
    setAvailableFields,
    setSource,
    setSQL,
    setResults,
    setLoading,
    setError,
    clearExecution,
    resetConfig,
  } = usePivotConfig(database, schema, selectedTable);

  const { fields, loading: fieldsLoading, error: fieldsError } = useFieldDiscovery(
    database,
    schema,
    selectedTable
  );

  const { executeQuery } = useQuery();

  // Get recommended templates based on table and fields
  const recommendedTemplates = useMemo(() => {
    if (!selectedTable || !fields || fields.length === 0) {
      return [];
    }
    return getRecommendedPivots(selectedTable, fields);
  }, [selectedTable, fields]);

  // Update available fields when discovered
  useEffect(() => {
    if (fields.length > 0) {
      setAvailableFields(fields);
    }
  }, [fields, setAvailableFields]);

  // Update source when table changes
  useEffect(() => {
    if (database && schema && selectedTable) {
      setSource(database, schema, selectedTable);
    }
  }, [database, schema, selectedTable, setSource]);

  // Generate SQL when configuration changes
  useEffect(() => {
    try {
      // Only generate SQL if we have at least one value (measure)
      if (config.values.length > 0) {
        const sql = generatePivotSQL(config);
        setSQL(sql);
      } else {
        setSQL(null);
      }
    } catch (err) {
      console.error('[PivotBuilder] SQL generation error:', err);
      setSQL(null);
    }
    // Only depend on the pivot configuration parts, not execution state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    config.rows,
    config.columns,
    config.values,
    config.filters,
    config.source.database,
    config.source.schema,
    config.source.table,
    setSQL,
  ]);

  // Execute query
  const handleRunQuery = async () => {
    // Validate configuration
    const validation = validatePivotConfig(config);
    if (!validation.valid) {
      setError(validation.errors.join(', '));
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const sql = generatePivotSQL(config);
      const results = await executeQuery(sql);

      setResults(results);
    } catch (err) {
      console.error('[PivotBuilder] Query execution error:', err);
      setError(err.message || 'Failed to execute query');
    } finally {
      setLoading(false);
    }
  };

  // Handle table selection
  const handleTableChange = (e) => {
    const table = e.target.value;
    setSelectedTable(table);
    clearExecution();
  };

  // Handle template application
  const handleApplyTemplate = (template) => {
    if (!template.enrichedConfig) {
      console.error('[PivotBuilder] Template missing enriched config');
      return;
    }

    // Clear current configuration
    resetConfig();

    // Apply template configuration
    const config = template.enrichedConfig;

    // Add rows
    config.rows.forEach(field => {
      addToZone('rows', field);
    });

    // Add columns
    config.columns.forEach(field => {
      addToZone('columns', field);
    });

    // Add values
    config.values.forEach(field => {
      addToZone('values', field);
    });

    // Add filters
    config.filters.forEach(filter => {
      addToZone('filters', filter);
    });

    console.log('[PivotBuilder] Applied template:', template.name);
  };

  const canRunQuery = config.values.length > 0 && config.execution.sql;

  return (
    <div className="flex h-full bg-white">
      {/* Left Panel: Configuration */}
      <div className="w-96 flex-shrink-0">
        <PivotConfigPanel
          fields={fields}
          fieldsLoading={fieldsLoading}
          fieldsError={fieldsError}
          config={config}
          onAddToZone={addToZone}
          onRemoveFromZone={removeFromZone}
          onReorderZone={reorderZone}
          recommendedTemplates={recommendedTemplates}
          onApplyTemplate={handleApplyTemplate}
        />
      </div>

      {/* Right Panel: Results */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="flex-shrink-0 p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            {/* Table selector */}
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Select Table
              </label>
              <input
                type="text"
                value={selectedTable || ''}
                onChange={handleTableChange}
                placeholder="e.g., TABLE_ENTITY"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 mt-5">
              {/* Run Query */}
              <button
                onClick={handleRunQuery}
                disabled={!canRunQuery || config.execution.loading}
                className={`
                  flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors
                  ${canRunQuery && !config.execution.loading
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }
                `}
              >
                {config.execution.loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play size={16} />
                    Run Query
                  </>
                )}
              </button>

              {/* Show SQL */}
              <button
                onClick={() => setShowSQL(!showSQL)}
                disabled={!config.execution.sql}
                className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Code2 size={16} />
                {showSQL ? 'Hide SQL' : 'Show SQL'}
              </button>

              {/* Reset */}
              <button
                onClick={resetConfig}
                className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                title="Reset configuration"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </div>

          {/* SQL Preview */}
          {showSQL && config.execution.sql && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-600">Generated SQL</span>
                <button
                  onClick={() => navigator.clipboard.writeText(config.execution.sql)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                >
                  Copy
                </button>
              </div>
              <pre className="p-3 bg-slate-900 text-slate-100 text-xs rounded-lg overflow-x-auto">
                {config.execution.sql}
              </pre>
            </div>
          )}

          {/* Error message */}
          {config.execution.error && (
            <div className="mt-4 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={16} />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800">Error</p>
                <p className="text-xs text-red-700 mt-1">{config.execution.error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-hidden p-4">
          {!selectedTable ? (
            // No table selected
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="max-w-md">
                <h3 className="text-lg font-semibold text-slate-700 mb-2">
                  Welcome to Pivot Builder
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  Select a table to start building your pivot analysis.
                  Drag fields from the left panel to configure your aggregation.
                </p>
                <div className="flex flex-col gap-2 text-xs text-slate-600">
                  <div className="flex items-start gap-2">
                    <CheckCircle size={14} className="text-green-600 mt-0.5" />
                    <span>Drag measures to <strong>Values</strong> to aggregate</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle size={14} className="text-green-600 mt-0.5" />
                    <span>Drag dimensions to <strong>Rows</strong> to group</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle size={14} className="text-green-600 mt-0.5" />
                    <span>Click <strong>Run Query</strong> to see results</span>
                  </div>
                </div>
              </div>
            </div>
          ) : !config.execution.results && !config.execution.loading ? (
            // No results yet
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="max-w-md">
                <h3 className="text-lg font-semibold text-slate-700 mb-2">
                  Configure Your Pivot
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  Add at least one measure to the <strong>Values</strong> zone,
                  then click <strong>Run Query</strong> to see results.
                </p>
                {fieldsLoading && (
                  <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                    <Loader2 size={16} className="animate-spin" />
                    Discovering fields...
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Show results
            <div className="h-full">
              <ResultsTable
                results={config.execution.results}
                loading={config.execution.loading}
                error={config.execution.error}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PivotBuilder;
