import React, { useMemo, useState } from 'react';
import {
  Loader2, AlertTriangle, RefreshCw, Zap, GitBranch, Settings, AlertCircle,
  Copy, Check, ChevronRight, ArrowUpRight, ArrowDownRight, Layers, Play
} from 'lucide-react';
import { LineageRail } from './LineageRail';
import { TabbedCodeCard } from '../ui/TabbedCodeCard';

/**
 * QueryCard - Card matching EntityDetailPanel sidebar style
 */
function QueryCard({ icon: Icon, title, description, sql, onRun, onCopy }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopy?.(sql);
  };

  const handleRun = () => {
    onRun?.(sql, { label: title, description, sql });
  };

  return (
    <button
      type="button"
      onClick={handleRun}
      className="group w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/30 transition-all text-left"
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
        <Icon size={16} className="text-slate-500 group-hover:text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-800 group-hover:text-blue-700">
          {title}
        </div>
        <div className="text-xs text-slate-500 truncate">
          {description}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <span
          onClick={handleCopy}
          className="p-1 hover:bg-slate-200 rounded"
          title="Copy SQL"
        >
          {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} className="text-slate-400" />}
        </span>
      </div>
      <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-500 flex-shrink-0" />
    </button>
  );
}

/**
 * LineagePanel
 *
 * Unified lineage workspace that groups:
 * - Live lineage graph (LineageRail)
 * - "View lineage SQL query" preview
 * - Ready-to-run lineage queries for the current table
 *
 * This mirrors the UX in the MDLH lineage mock (graph + SQL preview + lineage queries),
 * and keeps all typography/spacing consistent.
 */
export function LineagePanel({
  isConnected,
  database,
  schema,
  editorQuery,
  lineageData,
  loading,
  error,
  currentTable,
  selectedEntity,
  onRefresh,
  onRunQuery,
}) {
  // Use selectedEntity if provided, otherwise fall back to lineageData metadata
  const entityGuid = selectedEntity?.GUID || selectedEntity?.guid || lineageData?.metadata?.tableGuid || null;
  const entityName = selectedEntity?.NAME || selectedEntity?.name || lineageData?.metadata?.tableName || currentTable || null;
  const entityType = selectedEntity?.TYPENAME || selectedEntity?.typename || 'Table';
  
  // For backward compatibility
  const tableName = entityName;
  const tableGuid = entityGuid;

  const hasGraph = lineageData?.nodes?.length > 0 && lineageData?.edges?.length > 0;

  // Fallback static graph when disconnected or no lineage yet
  const fallbackNodes = useMemo(
    () => [
      { id: 'src', label: 'SRC_ORDERS', type: 'table', column: 0, row: 0 },
      { id: 'proc', label: 'Load_FACT_ORDERS', type: 'process', column: 1, row: 0 },
      { id: 'fact', label: 'FACT_ORDERS', type: 'table', column: 2, row: 0 },
    ],
    []
  );

  const fallbackEdges = useMemo(
    () => [
      { from: 'src', to: 'proc' },
      { from: 'proc', to: 'fact' },
    ],
    []
  );

  // Build SQL snippets based on the current table's GUID
  // Using simple string search on INPUTS/OUTPUTS columns (more reliable than LATERAL FLATTEN)
  const { upstreamSql, downstreamSql } = useMemo(() => {
    if (!tableGuid || !database || !schema) {
      return {
        upstreamSql:
          '-- Connect to Snowflake + MDLH and select a table in the editor to see lineage SQL here.',
        downstreamSql:
          '-- Once a table with lineage is detected in your SQL, downstream lineage SQL will appear here.',
      };
    }

    const procFQN = `${database}.${schema}.PROCESS_ENTITY`;

    // Use LATERAL FLATTEN to search GUID arrays (upstream = where this asset appears in OUTPUTS)
    const upstream = `-- Find processes that produce ${tableName || 'this table'} (upstream sources)
SELECT DISTINCT
    p."NAME" AS process_name,
    p."TYPENAME" AS process_type,
    p."INPUTS" AS source_assets,
    p."OUTPUTS" AS target_assets,
    p."POPULARITYSCORE" AS popularity
FROM ${procFQN} p,
     LATERAL FLATTEN(input => p."OUTPUTS") f
WHERE f.value::STRING = '${tableGuid}'
ORDER BY popularity DESC NULLS LAST
LIMIT 10;`;

    // Use LATERAL FLATTEN to search GUID arrays (downstream = where this asset appears in INPUTS)
    const downstream = `-- Find processes that consume ${tableName || 'this table'} (downstream targets)
SELECT DISTINCT
    p."NAME" AS process_name,
    p."TYPENAME" AS process_type,
    p."INPUTS" AS source_assets,
    p."OUTPUTS" AS target_assets,
    p."POPULARITYSCORE" AS popularity
FROM ${procFQN} p,
     LATERAL FLATTEN(input => p."INPUTS") f
WHERE f.value::STRING = '${tableGuid}'
ORDER BY popularity DESC NULLS LAST
LIMIT 10;`;

    return { upstreamSql: upstream, downstreamSql: downstream };
  }, [tableGuid, tableName, database, schema]);

  const pythonWrapper = (sql) =>
    `from mdlh_client import client

c = client()
rows = c.sql(\"\"\"\n${sql}\n\"\"\")
print(rows)`;

  return (
    <section className="mx-6 mt-4 mb-4 space-y-4" aria-label="Lineage workspace">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">
            {tableName ? `Lineage for ${tableName}` : 'Lineage'}
          </h2>
          {tableName && (
            <span className="text-[11px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-mono">
              {tableName}
            </span>
          )}
          {isConnected ? (
            <span className="text-[11px] px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
              Live
            </span>
          ) : (
            <span className="text-[11px] px-2 py-0.5 bg-gray-50 text-gray-500 rounded-full border border-gray-200">
              Example
            </span>
          )}
        </div>

        {isConnected && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : null}
            <span>{loading ? 'Loading…' : 'Refresh'}</span>
          </button>
        )}
      </div>

      {/* Graph + primary SQL preview side by side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-3">
          {error && (
            <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle size={12} className="mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Show "Load Lineage" button when connected but no data and not loading */}
          {isConnected && !hasGraph && !loading && !error && (
            <div className="flex flex-col items-center justify-center gap-3 p-6 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-sm text-slate-600 text-center">
                {entityName
                  ? `No lineage data loaded for "${entityName}".`
                  : 'Select an entity to view its lineage.'}
              </p>
              <button
                type="button"
                onClick={onRefresh}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <RefreshCw size={14} />
                Load Lineage
              </button>
            </div>
          )}

          <LineageRail
            nodes={hasGraph ? lineageData.nodes : fallbackNodes}
            edges={hasGraph ? lineageData.edges : fallbackEdges}
            title={
              tableName
                ? `Lineage graph for ${tableName}`
                : 'Example lineage graph'
            }
            metadata={lineageData?.metadata}
            rawProcesses={lineageData?.rawProcesses}
          />
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">
            View lineage SQL query
          </h3>
          <TabbedCodeCard
            languages={[
              { id: 'sql', label: 'SQL' },
              { id: 'python', label: 'Python' },
            ]}
            variants={[
              { id: 'upstream', label: 'Upstream sources' },
              { id: 'downstream', label: 'Downstream targets' },
            ]}
            snippets={[
              {
                language: 'sql',
                variantId: 'upstream',
                code: upstreamSql,
              },
              {
                language: 'sql',
                variantId: 'downstream',
                code: downstreamSql,
              },
              {
                language: 'python',
                variantId: 'upstream',
                code: pythonWrapper(upstreamSql),
              },
              {
                language: 'python',
                variantId: 'downstream',
                code: pythonWrapper(downstreamSql),
              },
            ]}
          />
        </div>
      </div>

      {/* Lineage query library for this table */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">Lineage queries</h3>
        <p className="text-xs text-slate-500">
          Ready-to-run lineage queries for this table, using real GUIDs from MDLH.
        </p>
        <TabbedCodeCard
          languages={[
            { id: 'sql', label: 'SQL' },
            { id: 'python', label: 'Python' },
          ]}
          variants={[
            { id: 'downstream', label: 'Downstream targets' },
            { id: 'upstream', label: 'Upstream sources' },
          ]}
          snippets={[
            {
              language: 'sql',
              variantId: 'downstream',
              code: downstreamSql,
            },
            {
              language: 'sql',
              variantId: 'upstream',
              code: upstreamSql,
            },
            {
              language: 'python',
              variantId: 'downstream',
              code: pythonWrapper(downstreamSql),
            },
            {
              language: 'python',
              variantId: 'upstream',
              code: pythonWrapper(upstreamSql),
            },
          ]}
        />
      </div>

      {/* Recommended Lineage Queries */}
      {tableGuid && database && schema && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Recommended Queries</h3>
          <p className="text-xs text-slate-500">Click to run in editor, or hover to copy SQL.</p>

          {/* Basic Lineage (1 hop) */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">
              Lineage
            </h4>
            <div className="space-y-2">
              <QueryCard
                icon={ArrowUpRight}
                title="Upstream Assets (1 hop)"
                description="Direct sources feeding this asset"
                onRun={onRunQuery}
                sql={`-- Upstream: Direct sources for ${tableName || 'this asset'}
SELECT DISTINCT
  p."NAME" AS process_name,
  p."TYPENAME" AS process_type,
  p."INPUTS" AS source_assets,
  p."POPULARITYSCORE" AS popularity
FROM ${database}.${schema}.PROCESS_ENTITY p,
     LATERAL FLATTEN(input => p."OUTPUTS") f
WHERE f.value::STRING = '${tableGuid}'
ORDER BY popularity DESC NULLS LAST
LIMIT 10;`}
              />
              <QueryCard
                icon={ArrowDownRight}
                title="Downstream Assets (1 hop)"
                description="Direct consumers of this asset"
                onRun={onRunQuery}
                sql={`-- Downstream: Direct consumers of ${tableName || 'this asset'}
SELECT DISTINCT
  p."NAME" AS process_name,
  p."TYPENAME" AS process_type,
  p."OUTPUTS" AS target_assets,
  p."POPULARITYSCORE" AS popularity
FROM ${database}.${schema}.PROCESS_ENTITY p,
     LATERAL FLATTEN(input => p."INPUTS") f
WHERE f.value::STRING = '${tableGuid}'
ORDER BY popularity DESC NULLS LAST
LIMIT 10;`}
              />
              <QueryCard
                icon={Layers}
                title="Full Lineage Chain (5 hops)"
                description="Recursive upstream traversal"
                onRun={onRunQuery}
                sql={`-- Full Lineage: Recursive upstream for ${tableName || 'this asset'}
WITH RECURSIVE lineage_tree AS (
  SELECT DISTINCT
    p."GUID" AS process_guid,
    p."NAME" AS process_name,
    f_in.value::STRING AS upstream_guid,
    1 AS depth
  FROM ${database}.${schema}.PROCESS_ENTITY p,
       LATERAL FLATTEN(input => p."OUTPUTS") f_out,
       LATERAL FLATTEN(input => p."INPUTS") f_in
  WHERE f_out.value::STRING = '${tableGuid}'

  UNION ALL

  SELECT DISTINCT
    p."GUID",
    p."NAME",
    f_in.value::STRING,
    lt.depth + 1
  FROM lineage_tree lt
  JOIN ${database}.${schema}.PROCESS_ENTITY p
    ON EXISTS (
      SELECT 1 FROM LATERAL FLATTEN(input => p."OUTPUTS") f
      WHERE f.value::STRING = lt.upstream_guid
    ),
  LATERAL FLATTEN(input => p."INPUTS") f_in
  WHERE lt.depth < 5
)
SELECT DISTINCT depth AS hop, process_name, upstream_guid
FROM lineage_tree
ORDER BY depth, process_name
LIMIT 50;`}
              />
            </div>
          </div>

          {/* Advanced Analysis */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">
              Analysis
            </h4>
            <div className="space-y-2">
              <QueryCard
                icon={Zap}
                title="Impact Analysis"
                description="Find all downstream assets affected by changes"
                onRun={onRunQuery}
                sql={`-- Impact Analysis: What downstream depends on ${tableName || 'this asset'}?
WITH RECURSIVE lineage_tree AS (
  SELECT DISTINCT
    p."GUID" AS process_guid,
    p."NAME" AS process_name,
    f_out.value::STRING AS downstream_guid,
    1 AS depth
  FROM ${database}.${schema}.PROCESS_ENTITY p,
       LATERAL FLATTEN(input => p."INPUTS") f_in,
       LATERAL FLATTEN(input => p."OUTPUTS") f_out
  WHERE f_in.value::STRING = '${tableGuid}'

  UNION ALL

  SELECT DISTINCT
    p."GUID",
    p."NAME",
    f_out.value::STRING,
    lt.depth + 1
  FROM lineage_tree lt
  JOIN ${database}.${schema}.PROCESS_ENTITY p
    ON EXISTS (
      SELECT 1 FROM LATERAL FLATTEN(input => p."INPUTS") f
      WHERE f.value::STRING = lt.downstream_guid
    ),
  LATERAL FLATTEN(input => p."OUTPUTS") f_out
  WHERE lt.depth < 3
)
SELECT DISTINCT depth AS hop, process_name, downstream_guid
FROM lineage_tree
ORDER BY depth, process_name
LIMIT 50;`}
              />
              <QueryCard
                icon={Settings}
                title="Process Details"
                description="Show transformation SQL and metadata"
                onRun={onRunQuery}
                sql={`-- Process Details: Transformation logic for ${tableName || 'this asset'}
SELECT
  p."NAME" AS process_name,
  p."TYPENAME" AS process_type,
  p."SQL" AS transformation_sql,
  p."CREATEDBY" AS created_by,
  p."CREATETIME" AS created_at,
  p."POPULARITYSCORE" AS popularity,
  ARRAY_SIZE(p."INPUTS") AS input_count,
  ARRAY_SIZE(p."OUTPUTS") AS output_count
FROM ${database}.${schema}.PROCESS_ENTITY p,
     LATERAL FLATTEN(input => p."INPUTS") f_in
WHERE f_in.value::STRING = '${tableGuid}'
   OR EXISTS (
     SELECT 1 FROM LATERAL FLATTEN(input => p."OUTPUTS") f_out
     WHERE f_out.value::STRING = '${tableGuid}'
   )
ORDER BY p."POPULARITYSCORE" DESC NULLS LAST
LIMIT 20;`}
              />
              <QueryCard
                icon={AlertCircle}
                title="Lineage Health Check"
                description="Find assets with broken lineage"
                onRun={onRunQuery}
                sql={`-- Lineage Health: Find assets marked as having lineage but no processes
SELECT
  t."GUID",
  t."NAME",
  t."TYPENAME",
  t."HASLINEAGE",
  t."POPULARITYSCORE"
FROM ${database}.${schema}.TABLE_ENTITY t
WHERE t."HASLINEAGE" = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM ${database}.${schema}.PROCESS_ENTITY p,
         LATERAL FLATTEN(input => p."INPUTS") f_in
    WHERE f_in.value::STRING = t."GUID"
  )
  AND NOT EXISTS (
    SELECT 1 FROM ${database}.${schema}.PROCESS_ENTITY p,
         LATERAL FLATTEN(input => p."OUTPUTS") f_out
    WHERE f_out.value::STRING = t."GUID"
  )
ORDER BY t."POPULARITYSCORE" DESC NULLS LAST
LIMIT 20;`}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default LineagePanel;


