/**
 * EntityDetailPanel - Unified right sidebar for entity details, lineage queries, and test queries
 *
 * Three tabs:
 * - Current Cell: Entity info
 * - Lineage: Recommended queries + View Graph button
 * - Test Query: Embedded SQL editor
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Table2, GitBranch, Copy, Check, X, ChevronRight, ChevronDown,
  Network, Columns, BarChart3, Tag, Sparkles, Play,
  Database, FileText, ArrowUpRight, ArrowDownRight, Layers,
  FlaskConical, Code2, Loader2
} from 'lucide-react';
import {
  buildDynamicRecommendations,
} from '../utils/dynamicQueryBuilder';
import { createLogger } from '../utils/logger';
import CompactQueryEditor from './CompactQueryEditor';

const logger = createLogger('EntityDetailPanel');

// Icon mapping for query categories
const categoryIcons = {
  lineage: GitBranch,
  structure: Columns,
  governance: Tag,
  usage: BarChart3,
  glossary: FileText,
  default: Database
};

// Query item component matching Atlan's design
function QueryItem({ query, onRun, icon: CustomIcon }) {
  const [copied, setCopied] = useState(false);
  const Icon = CustomIcon || categoryIcons[query.category] || categoryIcons.default;

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(query.sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRun = () => {
    logger.info('Running query:', query.label);
    onRun(query.sql, query);
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
          {query.label}
        </div>
        <div className="text-xs text-slate-500 truncate">
          {query.description}
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

// Category section component
function QueryCategory({ title, queries, onRun }) {
  if (!queries || queries.length === 0) return null;

  return (
    <div className="mb-4">
      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">
        {title}
      </h4>
      <div className="space-y-2">
        {queries.map((query) => (
          <QueryItem
            key={query.id}
            query={query}
            onRun={onRun}
          />
        ))}
      </div>
    </div>
  );
}

// Tab Button component
function TabButton({ icon: Icon, label, isActive, onClick, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-2 py-3 text-xs font-medium transition-colors ${
        isActive
          ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
      }`}
    >
      <span className="flex items-center justify-center gap-1.5">
        <Icon size={14} />
        {label}
        {badge && (
          <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${
            isActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
          }`}>
            {badge}
          </span>
        )}
      </span>
    </button>
  );
}

export default function EntityDetailPanel({
  selectedEntity,
  category = 'core',
  database = 'FIELD_METADATA',
  schema = 'PUBLIC',
  onOpenInEditor,
  onOpenLineage,
  onClose,
  // Dynamic query requirements
  discoveredTables = new Set(),
  sampleEntities = null,
  // Test query props
  initialTestQuery = '',
}) {
  const [activeTab, setActiveTab] = useState('lineage');
  const [isQueriesExpanded, setIsQueriesExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const [testQuery, setTestQuery] = useState(initialTestQuery);

  // Get entity details
  const entityName = selectedEntity?.table || selectedEntity?.NAME || selectedEntity?.name || selectedEntity?.entity || 'Unknown';
  const entityType = selectedEntity?.entityType || selectedEntity?.TYPENAME || selectedEntity?.entity || 'Table';
  const guid = selectedEntity?.guid || selectedEntity?.GUID || null;
  const truncatedGuid = guid ? (guid.length > 16 ? `${guid.substring(0, 16)}...` : guid) : 'No GUID';

  // Build dynamic recommendations based on discovered tables
  const dynamicQueries = useMemo(() => {
    if (!discoveredTables || discoveredTables.size === 0) {
      logger.info('No discovered tables - using fallback queries');
      return [];
    }

    logger.info('Building dynamic recommendations for:', entityName, {
      discoveredTables: discoveredTables.size,
      hasSamples: !!sampleEntities,
      guid
    });

    const recommendations = buildDynamicRecommendations({
      database,
      schema,
      discoveredTables,
      samples: sampleEntities || {},
      context: {
        table: entityName,
        guid: guid,
        entityType: entityType
      }
    });

    logger.info('Generated', recommendations.length, 'dynamic queries');
    return recommendations;
  }, [database, schema, discoveredTables, sampleEntities, entityName, guid, entityType]);

  // Build upstream/downstream lineage queries
  const lineageQueries = useMemo(() => {
    if (!guid || !database || !schema) return [];

    const procFQN = `${database}.${schema}.PROCESS_ENTITY`;

    return [
      {
        id: 'upstream-1hop',
        label: 'Upstream Assets (1 hop)',
        description: 'Direct sources feeding this asset',
        category: 'lineage',
        icon: ArrowUpRight,
        sql: `-- Upstream: Direct sources for ${entityName}
SELECT DISTINCT
  p."NAME" AS process_name,
  p."TYPENAME" AS process_type,
  p."INPUTS" AS source_assets,
  p."POPULARITYSCORE" AS popularity
FROM ${procFQN} p,
     LATERAL FLATTEN(input => p."OUTPUTS") f
WHERE f.value::STRING = '${guid}'
ORDER BY popularity DESC NULLS LAST
LIMIT 10;`
      },
      {
        id: 'downstream-1hop',
        label: 'Downstream Assets (1 hop)',
        description: 'Direct consumers of this asset',
        category: 'lineage',
        icon: ArrowDownRight,
        sql: `-- Downstream: Direct consumers of ${entityName}
SELECT DISTINCT
  p."NAME" AS process_name,
  p."TYPENAME" AS process_type,
  p."OUTPUTS" AS target_assets,
  p."POPULARITYSCORE" AS popularity
FROM ${procFQN} p,
     LATERAL FLATTEN(input => p."INPUTS") f
WHERE f.value::STRING = '${guid}'
ORDER BY popularity DESC NULLS LAST
LIMIT 10;`
      },
      {
        id: 'full-lineage',
        label: 'Full Lineage Chain (5 hops)',
        description: 'Recursive upstream traversal',
        category: 'lineage',
        icon: Layers,
        sql: `-- Full Lineage: Recursive upstream for ${entityName}
WITH RECURSIVE lineage_tree AS (
  -- Base: direct upstream
  SELECT DISTINCT
    p."GUID" AS process_guid,
    p."NAME" AS process_name,
    f_in.value::STRING AS upstream_guid,
    1 AS depth
  FROM ${procFQN} p,
       LATERAL FLATTEN(input => p."OUTPUTS") f_out,
       LATERAL FLATTEN(input => p."INPUTS") f_in
  WHERE f_out.value::STRING = '${guid}'

  UNION ALL

  -- Recursive
  SELECT DISTINCT
    p."GUID",
    p."NAME",
    f_in.value::STRING,
    lt.depth + 1
  FROM lineage_tree lt
  JOIN ${procFQN} p
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
LIMIT 50;`
      }
    ];
  }, [guid, entityName, database, schema]);

  // Categorize queries for display
  const categorizedQueries = useMemo(() => {
    const structure = [];
    const governance = [];
    const other = [];

    dynamicQueries.forEach(q => {
      switch (q.category) {
        case 'structure':
          structure.push(q);
          break;
        case 'governance':
          governance.push(q);
          break;
        default:
          if (q.category !== 'lineage') {
            other.push(q);
          }
      }
    });

    return { structure, governance, other };
  }, [dynamicQueries]);

  // Check if we have valid data for queries
  const hasDiscoveredTables = discoveredTables && discoveredTables.size > 0;
  const hasSampleData = sampleEntities && (
    sampleEntities.tables?.length > 0 ||
    sampleEntities.columns?.length > 0 ||
    sampleEntities.processes?.length > 0
  );

  const handleCopyGuid = () => {
    if (guid) {
      navigator.clipboard.writeText(guid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleViewLineage = () => {
    logger.info('Opening lineage for:', entityName);
    if (onOpenLineage) {
      onOpenLineage({
        NAME: entityName,
        GUID: guid,
        entityType: entityType
      });
    }
  };

  const handleRunQuery = useCallback((sql, query) => {
    logger.info('Running query:', query?.label || 'Unknown');
    // Switch to Test Query tab and load the query
    setTestQuery(sql);
    setActiveTab('test');
  }, []);

  const handleOpenInEditor = useCallback((sql, query) => {
    if (onOpenInEditor) {
      onOpenInEditor(sql, query);
    }
  }, [onOpenInEditor]);

  const totalQueries = lineageQueries.length + categorizedQueries.structure.length +
                       categorizedQueries.governance.length + categorizedQueries.other.length;

  if (!selectedEntity) {
    return null;
  }

  return (
    <div className="w-96 border-l border-slate-200 bg-white flex flex-col flex-shrink-0 shadow-sm">
      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <TabButton
          icon={Table2}
          label="Details"
          isActive={activeTab === 'cell'}
          onClick={() => setActiveTab('cell')}
        />
        <TabButton
          icon={GitBranch}
          label="Queries"
          isActive={activeTab === 'lineage'}
          onClick={() => setActiveTab('lineage')}
          badge={totalQueries > 0 ? totalQueries : null}
        />
        <TabButton
          icon={FlaskConical}
          label="Test"
          isActive={activeTab === 'test'}
          onClick={() => setActiveTab('test')}
        />
        <button
          onClick={onClose}
          className="px-3 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          title="Close panel"
        >
          <X size={16} />
        </button>
      </div>

      {/* Entity Header - Always visible */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Table2 size={20} className="text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-slate-900 truncate" title={entityName}>
              {entityName}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-medium rounded">
                {entityType}
              </span>
              {guid && (
                <span className="text-xs text-slate-400 font-mono truncate flex items-center gap-1">
                  {truncatedGuid}
                  <button
                    onClick={handleCopyGuid}
                    className="p-0.5 hover:bg-slate-100 rounded transition-colors"
                    title="Copy GUID"
                  >
                    {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content based on active tab */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'lineage' && (
          <div className="flex-1 overflow-y-auto p-4">
            {/* View Lineage Graph - Prominent Action */}
            <button
              type="button"
              onClick={handleViewLineage}
              className="w-full mb-4 p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 hover:border-blue-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/80 border border-blue-200 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Network size={24} className="text-blue-600" />
                </div>
                <div className="flex-1 text-left">
                  <div className="text-sm font-semibold text-slate-800">
                    View Lineage Graph
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Visualize upstream and downstream dependencies
                  </div>
                </div>
                <ChevronRight size={20} className="text-blue-400 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            {/* Recommended Queries */}
            <button
              type="button"
              onClick={() => setIsQueriesExpanded(!isQueriesExpanded)}
              className="w-full flex items-center justify-between py-2 text-left"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Sparkles size={16} className="text-amber-500" />
                Recommended Queries
              </span>
              {isQueriesExpanded ? (
                <ChevronDown size={18} className="text-slate-400" />
              ) : (
                <ChevronRight size={18} className="text-slate-400" />
              )}
            </button>

            {isQueriesExpanded && (
              <div className="mt-3 space-y-4">
                {/* Lineage Queries */}
                {lineageQueries.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">
                      Lineage
                    </h4>
                    <div className="space-y-2">
                      {lineageQueries.map((query) => (
                        <QueryItem
                          key={query.id}
                          query={query}
                          onRun={handleRunQuery}
                          icon={query.icon}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Structure Queries */}
                <QueryCategory
                  title="Structure"
                  queries={categorizedQueries.structure}
                  onRun={handleRunQuery}
                />

                {/* Governance Queries */}
                <QueryCategory
                  title="Governance"
                  queries={categorizedQueries.governance}
                  onRun={handleRunQuery}
                />

                {/* Other Queries */}
                {categorizedQueries.other.length > 0 && (
                  <QueryCategory
                    title="Other"
                    queries={categorizedQueries.other}
                    onRun={handleRunQuery}
                  />
                )}

                {/* No queries available */}
                {lineageQueries.length === 0 && dynamicQueries.length === 0 && (
                  <div className="text-center py-6 text-slate-400">
                    <Database size={24} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No queries available</p>
                    <p className="text-xs mt-1">Select an entity with a GUID</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'cell' && (
          /* Details tab - entity info */
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Entity Name
                </label>
                <p className="text-sm text-slate-800 mt-1 font-mono">{entityName}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Type
                </label>
                <p className="text-sm text-slate-800 mt-1">{entityType}</p>
              </div>
              {guid && (
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    GUID
                  </label>
                  <p className="text-sm text-slate-800 mt-1 font-mono break-all">{guid}</p>
                </div>
              )}
              {selectedEntity?.description && (
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Description
                  </label>
                  <p className="text-sm text-slate-600 mt-1">{selectedEntity.description}</p>
                </div>
              )}
              {/* Show all other fields from the selected entity */}
              {Object.entries(selectedEntity || {})
                .filter(([key]) => !['entity', 'table', 'name', 'NAME', 'guid', 'GUID', 'entityType', 'TYPENAME', 'description'].includes(key))
                .slice(0, 5)
                .map(([key, value]) => (
                  <div key={key}>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      {key}
                    </label>
                    <p className="text-sm text-slate-800 mt-1 font-mono break-all">
                      {typeof value === 'object' ? JSON.stringify(value).substring(0, 100) : String(value).substring(0, 200)}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {activeTab === 'test' && (
          /* Test Query tab - compact SQL editor */
          <div className="flex-1 overflow-hidden flex flex-col">
            <CompactQueryEditor
              initialQuery={testQuery}
              database={database}
              schema={schema}
              onQueryChange={(sql) => setTestQuery(sql)}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-slate-200 bg-slate-50 flex-shrink-0">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="font-mono">{database}.{schema}</span>
          <span className="text-slate-400">
            {activeTab === 'lineage' && 'Click query to test'}
            {activeTab === 'test' && '⌘+Enter to run'}
            {activeTab === 'cell' && 'Entity details'}
          </span>
        </div>
      </div>
    </div>
  );
}
