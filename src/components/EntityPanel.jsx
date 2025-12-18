/**
 * EntityPanel - Unified expandable panel for entity details and query testing
 *
 * Features:
 * - Rail mode: Collapsed vertical bar with icons, hover to expand
 * - Quick access: Library + Test tabs work without entity selected
 * - Full mode: All 4 tabs when entity is selected
 * - Pin to keep open, or hover-only
 *
 * Use the EntityPanelContext to control expand/collapse from anywhere.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import LazyMonacoEditor from './LazyMonacoEditor';
import { format as formatSQL } from 'sql-formatter';
import {
  Table2, GitBranch, Copy, Check, X, ChevronRight, ChevronDown, ChevronLeft,
  Network, Columns, BarChart3, Tag, Sparkles, Play, Maximize2, Minimize2,
  Database, FileText, ArrowUpRight, ArrowDownRight, Layers, Loader2,
  FlaskConical, Code2, Clock, AlertCircle, Search, WifiOff, Library,
  Snowflake, TrendingUp, PanelRight, AlignLeft, History, Trash2,
  Flame, Target, BarChart3 as ChartIcon
} from 'lucide-react';
import {
  SIDEBAR_STYLES,
  RailButton,
  PinButton,
  ResizeHandle,
  CollapsedRailContainer,
  ExpandedContainer,
} from './ui/SidebarStyles';
import { validateQueryTables } from '../utils/dynamicExampleQueries';
import { useEntityPanelOptional } from '../context/EntityPanelContext';
import { useQuery, useConnection, useQueryHistory } from '../hooks/useSnowflake';
import { RunQueryButton } from './ui/RunQueryButton';
import {
  buildDynamicRecommendations,
} from '../utils/dynamicQueryBuilder';
import { createLogger } from '../utils/logger';
import {
  normalizeRows,
  extractColumnNames,
  getRowCount,
  isEmptyResult,
  hasNoResult
} from '../utils/queryResultAdapter';

const logger = createLogger('EntityPanel');

// Icon mapping for query categories
const categoryIcons = {
  lineage: GitBranch,
  structure: Columns,
  governance: Tag,
  usage: BarChart3,
  glossary: FileText,
  default: Database
};

/**
 * QueryItem - Clickable query card
 */
function QueryItem({ query, onRun, icon: CustomIcon }) {
  const [copied, setCopied] = useState(false);
  const Icon = CustomIcon || categoryIcons[query.category] || categoryIcons.default;

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(query.sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={() => onRun(query.sql, query)}
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

/**
 * QueryCategory - Section of queries
 */
function QueryCategory({ title, queries, onRun }) {
  if (!queries || queries.length === 0) return null;

  return (
    <div className="mb-4">
      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">
        {title}
      </h4>
      <div className="space-y-2">
        {queries.map((query) => (
          <QueryItem key={query.id} query={query} onRun={onRun} />
        ))}
      </div>
    </div>
  );
}

/**
 * Priority badge gradient styles
 */
const PRIORITY_STYLES = {
  'Very High': {
    bg: 'bg-gradient-to-br from-rose-500 to-red-600',
    text: 'text-white',
    shadow: 'shadow-rose-500/30',
    Icon: Flame
  },
  'High': {
    bg: 'bg-gradient-to-br from-amber-400 to-orange-500',
    text: 'text-white',
    shadow: 'shadow-amber-500/30',
    Icon: TrendingUp
  },
  'Medium': {
    bg: 'bg-gradient-to-br from-sky-400 to-blue-500',
    text: 'text-white',
    shadow: 'shadow-sky-500/30',
    Icon: ChartIcon
  },
  'Low': {
    bg: 'bg-gradient-to-br from-slate-300 to-slate-400',
    text: 'text-slate-700',
    shadow: 'shadow-slate-400/20',
    Icon: Target
  }
};

/**
 * LibraryQueryCard - Enhanced query card with animations and polish
 */
function LibraryQueryCard({
  title,
  description,
  query,
  frequency,
  isValid,
  rowCount,
  onRun,
  onTest,
  onCopy,
  onExplain,
  index = 0,
}) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(query);
    setCopied(true);
    onCopy?.(query);
    setTimeout(() => setCopied(false), 2000);
  };

  // Get priority style
  const priorityStyle = PRIORITY_STYLES[frequency] || null;
  const PriorityIcon = priorityStyle?.Icon;

  return (
    <div
      className={`bg-white rounded-xl border overflow-hidden transition-all duration-200 ${
        expanded
          ? 'border-slate-300 shadow-lg'
          : 'border-slate-200 hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5'
      }`}
      style={{
        animationDelay: `${index * 30}ms`,
        animation: 'fadeInUp 0.2s ease-out forwards',
        opacity: 0
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`flex items-center justify-between px-4 py-3.5 cursor-pointer transition-colors ${
          isHovered && !expanded ? 'bg-slate-50/70' : ''
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0 flex items-start gap-3">
          {/* Priority Badge - Compact gradient icon */}
          {priorityStyle && (
            <div
              className={`flex-shrink-0 w-6 h-6 rounded-lg ${priorityStyle.bg} ${priorityStyle.text}
                shadow-lg ${priorityStyle.shadow} flex items-center justify-center`}
              title={`${frequency} priority`}
            >
              <PriorityIcon size={12} strokeWidth={2.5} />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              <h4 className="font-semibold text-slate-900 text-sm leading-snug flex-1">{title}</h4>
              {/* Status dot with glow */}
              {isValid === true && (
                <span
                  className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50 flex-shrink-0 mt-0.5"
                  title="Valid"
                />
              )}
              {isValid === false && (
                <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 mt-0.5" title="Needs attention" />
              )}
            </div>
            <p className="text-slate-600 text-xs mt-1.5 leading-relaxed">{description}</p>
            {/* Row count badge */}
            {isValid && rowCount && (
              <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-emerald-600 font-medium">
                <Database size={10} />
                {rowCount.toLocaleString()} rows
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 flex-shrink-0 ml-4">
          {/* Text actions - always visible, stack on mobile */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5">
            {onExplain && (
              <button
                onClick={(e) => { e.stopPropagation(); onExplain(query); }}
                className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-all active:scale-95 whitespace-nowrap"
              >
                Explain
              </button>
            )}
            {onTest && (
              <button
                onClick={(e) => { e.stopPropagation(); onTest(query, title); }}
                className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-all active:scale-95 whitespace-nowrap"
              >
                Test
              </button>
            )}
            <button
              onClick={handleCopy}
              className={`px-2.5 py-1.5 text-xs rounded-md transition-all active:scale-95 whitespace-nowrap ${
                copied
                  ? 'text-emerald-600 bg-emerald-50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {copied ? (
                <span className="flex items-center gap-1">
                  <Check size={12} /> Copied
                </span>
              ) : 'Copy'}
            </button>
          </div>

          {/* Run button - gradient style */}
          {onRun && (
            <button
              onClick={(e) => { e.stopPropagation(); onRun(query); }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold
                bg-gradient-to-br from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800
                text-white shadow-lg shadow-slate-900/25 transition-all active:scale-95 whitespace-nowrap"
            >
              <Play size={11} fill="currentColor" />
              Run
            </button>
          )}

          {/* Chevron */}
          <ChevronRight
            size={16}
            className={`text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
          />
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div
          className="border-t border-slate-100 bg-gradient-to-b from-slate-50 to-white"
          style={{ animation: 'fadeInUp 0.2s ease-out' }}
        >
          <div className="p-4">
            <h5 className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-2">
              <Code2 size={12} />
              SQL Query
            </h5>
            {/* Dark code block */}
            <pre className="text-xs text-slate-100 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed p-4 bg-slate-900 rounded-lg shadow-inner">
              {query}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * TabButton - Tab navigation (updated for dark header)
 */
function TabButton({ icon: Icon, label, isActive, onClick, badge, compact = false }) {
  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`p-3 transition-colors ${
          isActive
            ? 'text-blue-600 bg-blue-50'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
        }`}
        title={label}
      >
        <Icon size={18} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 text-xs font-medium rounded-lg transition-all ${
        isActive
          ? 'text-blue-700 bg-blue-100'
          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
      }`}
    >
      <span className="flex items-center justify-center gap-1.5">
        <Icon size={14} />
        {label}
        {badge && (
          <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${
            isActive ? 'bg-blue-200 text-blue-800' : 'bg-slate-200 text-slate-700'
          }`}>
            {badge}
          </span>
        )}
      </span>
    </button>
  );
}

/**
 * ResultsDisplay - Query results table
 */
function ResultsDisplay({ results, loading, error, compact = false }) {
  const [searchFilter, setSearchFilter] = useState('');
  const [copied, setCopied] = useState(false);

  const normalizedRows = useMemo(
    () => results ? normalizeRows(results) : [],
    [results]
  );

  const columnNames = useMemo(
    () => results ? extractColumnNames(results) : [],
    [results]
  );

  const filteredRows = useMemo(() => {
    if (!searchFilter.trim()) return normalizedRows;
    const search = searchFilter.toLowerCase();
    return normalizedRows.filter(row =>
      Object.values(row).some(val =>
        String(val).toLowerCase().includes(search)
      )
    );
  }, [normalizedRows, searchFilter]);

  const rowCount = getRowCount(results);

  const handleCopyAll = async () => {
    const json = JSON.stringify(normalizedRows, null, 2);
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        <Loader2 size={20} className="animate-spin mr-3" />
        <span className="text-sm">Executing...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg m-3">
        <div className="flex items-start gap-2">
          <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-800">Query failed</p>
            <p className="text-xs text-red-600 mt-1 break-words">
              {String(error).substring(0, 200)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (hasNoResult(results)) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-slate-400">
        <Database size={24} className="mb-2 opacity-50" />
        <p className="text-sm">Run query to see results</p>
        <p className="text-xs mt-1 text-slate-300">⌘+Enter</p>
      </div>
    );
  }

  if (isEmptyResult(results)) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm font-medium text-slate-600">No rows returned</p>
        <p className="text-xs text-slate-400 mt-1">Query succeeded but returned 0 rows</p>
      </div>
    );
  }

  const maxCols = compact ? 5 : 8;
  const maxRows = compact ? 100 : 200;
  const displayColumns = columnNames.slice(0, maxCols);
  const hasMoreColumns = columnNames.length > maxCols;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-emerald-600">
            <Check size={12} />
            <span className="font-medium">{filteredRows.length.toLocaleString()}</span>
            <span className="text-slate-500">rows</span>
          </span>
          {results?.executionTime && (
            <span className="flex items-center gap-1 text-slate-500">
              <Clock size={12} />
              {(results.executionTime / 1000).toFixed(2)}s
            </span>
          )}
        </div>
        <button
          onClick={handleCopyAll}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
        >
          {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {rowCount > 5 && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
          <Search size={12} className="text-slate-400" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Filter results..."
            className="flex-1 text-xs bg-transparent outline-none text-slate-700 placeholder:text-slate-400"
          />
          {searchFilter && (
            <button onClick={() => setSearchFilter('')} className="text-slate-400 hover:text-slate-600">
              <X size={12} />
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 sticky top-0">
            <tr>
              {displayColumns.map((col, i) => (
                <th key={i} className="px-3 py-2 text-left font-medium text-slate-600 border-b border-slate-200 whitespace-nowrap">
                  {col}
                </th>
              ))}
              {hasMoreColumns && (
                <th className="px-3 py-2 text-left text-slate-400 border-b border-slate-200">
                  +{columnNames.length - maxCols}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {filteredRows.slice(0, maxRows).map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-slate-50 border-b border-slate-50">
                {displayColumns.map((colName, colIdx) => {
                  const value = row[colName];
                  return (
                    <td key={colIdx} className="px-3 py-2 max-w-[120px] truncate text-slate-700">
                      {value !== null && value !== undefined
                        ? String(value).substring(0, 50)
                        : <span className="text-slate-300 italic">null</span>
                      }
                    </td>
                  );
                })}
                {hasMoreColumns && (
                  <td className="px-3 py-2 text-slate-300">...</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {filteredRows.length > maxRows && (
          <div className="px-3 py-2 bg-slate-50 text-xs text-slate-500 text-center border-t">
            Showing {maxRows} of {filteredRows.length.toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}

// RailButton is now imported from ./ui/SidebarStyles

/**
 * Main EntityPanel Component
 */
export default function EntityPanel({
  selectedEntity,
  category = 'core',
  database = 'FIELD_METADATA',
  schema = 'PUBLIC',
  discoveredTables = new Set(),
  sampleEntities = null,
  onOpenLineage,
  onClose,
  initialQuery = '',
  // Library props
  libraryQueries = [],
  queryValidationMap = new Map(),
  batchValidationResults = new Map(),
  isBatchValidating = false,
  onValidateAll = null,
  onShowMyWork = null,
  onRunInEditor = null,
}) {
  const panelContext = useEntityPanelOptional();
  const isPinned = panelContext?.isPinned ?? false;
  const isHovered = panelContext?.isHovered ?? false;
  const isExpanded = panelContext?.isExpanded ?? false;

  const editorRef = useRef(null);
  const panelRef = useRef(null);
  // hoverTimeoutRef moved to context for unified timing

  // Resize state - use shared constants
  const [panelWidth, setPanelWidth] = useState(SIDEBAR_STYLES.minExpandedWidth + 120); // Right panel slightly wider
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const MIN_WIDTH = SIDEBAR_STYLES.minExpandedWidth + 120; // Right panel min 320px
  const MAX_WIDTH = SIDEBAR_STYLES.maxExpandedWidth + 200; // Right panel max 800px

  // Default tab based on whether entity is selected
  // Default to Queries (library) tab
  const [activeTab, setActiveTab] = useState('library');
  const [isQueriesExpanded, setIsQueriesExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const [sql, setSql] = useState(initialQuery);

  const { status: connStatus } = useConnection();
  const { executeQuery, results, loading, error, clearResults } = useQuery();
  const { history, fetchHistory, loading: historyLoading } = useQueryHistory();
  const [showHistory, setShowHistory] = useState(false);

  const isConnected = connStatus?.connected;

  // Determine if panel should show full content or just rail
  const showFullPanel = isPinned || isHovered;

  // Get entity details (may be null in quick access mode)
  const entityName = selectedEntity?.table || selectedEntity?.NAME || selectedEntity?.name || selectedEntity?.entity || null;
  const entityType = selectedEntity?.entityType || selectedEntity?.TYPENAME || selectedEntity?.entity || 'Table';
  const guid = selectedEntity?.guid || selectedEntity?.GUID || null;
  const truncatedGuid = guid ? (guid.length > 16 ? `${guid.substring(0, 16)}...` : guid) : null;

  // Context-aware tab switching:
  // - When entity selected → show Details (cell) tab automatically
  // - When entity deselected → show Queries (library) tab
  const prevEntityRef = useRef(selectedEntity);
  useEffect(() => {
    const hadEntity = prevEntityRef.current;
    const hasEntity = selectedEntity;

    // Entity was just selected → switch to Details
    if (!hadEntity && hasEntity) {
      setActiveTab('cell');
    }
    // Entity was just deselected → switch to Queries
    else if (hadEntity && !hasEntity && (activeTab === 'lineage' || activeTab === 'cell')) {
      setActiveTab('library');
    }

    prevEntityRef.current = selectedEntity;
  }, [selectedEntity]);

  // Handle pending query from context
  useEffect(() => {
    if (panelContext?.pendingQuery) {
      const pending = panelContext.consumePendingQuery();
      if (pending?.sql) {
        setSql(pending.sql);
        setActiveTab('test');
        clearResults();
      }
    }
  }, [panelContext?.pendingQuery]);

  // Handle pending tab switch from context
  useEffect(() => {
    if (panelContext?.pendingTab) {
      const tab = panelContext.consumePendingTab();
      if (tab) {
        setActiveTab(tab);
      }
    }
  }, [panelContext?.pendingTab]);

  // Use context's hover handlers for consistent timing with left sidebar
  const handleMouseEnter = panelContext?.handleMouseEnter || (() => {});
  const handleMouseLeave = panelContext?.handleMouseLeave || (() => {});

  // Resize handlers
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = panelWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [panelWidth]);

  const handleResizeMove = useCallback((e) => {
    if (!isResizing) return;
    // For right panel, dragging left increases width
    const delta = startXRef.current - e.clientX;
    const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidthRef.current + delta));
    setPanelWidth(newWidth);
  }, [isResizing]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  // Attach global mouse listeners for resize
  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
      return () => {
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  // Build dynamic recommendations
  const dynamicQueries = useMemo(() => {
    if (!discoveredTables || discoveredTables.size === 0 || !selectedEntity) {
      return [];
    }
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
    return recommendations;
  }, [database, schema, discoveredTables, sampleEntities, entityName, guid, entityType, selectedEntity]);

  // Auto-generate library queries from discovered tables when none provided
  const effectiveLibraryQueries = useMemo(() => {
    if (libraryQueries.length > 0) return libraryQueries;
    if (!discoveredTables || discoveredTables.size === 0) return [];

    // Generate useful queries for discovered tables
    const tables = [...discoveredTables].slice(0, 10); // Top 10 tables
    const queries = [];

    // Add overview query
    queries.push({
      id: 'overview',
      title: 'Schema Overview',
      description: 'Count rows in all entity tables',
      category: 'explore',
      sql: `-- Row counts for all tables in ${schema}
SELECT table_name, row_count, bytes
FROM ${database}.INFORMATION_SCHEMA.TABLES
WHERE table_schema = '${schema}'
  AND table_type = 'BASE TABLE'
ORDER BY row_count DESC
LIMIT 20;`
    });

    // Add queries for key entity tables
    const entityTables = tables.filter(t => t.includes('ENTITY'));
    entityTables.slice(0, 5).forEach(table => {
      const shortName = table.replace('_ENTITY', '').replace(/_/g, ' ');
      queries.push({
        id: `preview-${table}`,
        title: `Preview ${shortName}`,
        description: `Sample rows from ${table}`,
        category: 'explore',
        sql: `-- Preview ${table}
SELECT *
FROM ${database}.${schema}."${table}"
LIMIT 100;`
      });
    });

    // Add lineage overview if PROCESS_ENTITY exists
    if (discoveredTables.has('PROCESS_ENTITY')) {
      queries.push({
        id: 'lineage-overview',
        title: 'Lineage Overview',
        description: 'Process entities with input/output counts',
        category: 'lineage',
        sql: `-- Lineage processes overview
SELECT
  "NAME",
  "TYPENAME",
  ARRAY_SIZE("INPUTS") as input_count,
  ARRAY_SIZE("OUTPUTS") as output_count,
  "POPULARITYSCORE"
FROM ${database}.${schema}."PROCESS_ENTITY"
WHERE "INPUTS" IS NOT NULL
ORDER BY "POPULARITYSCORE" DESC NULLS LAST
LIMIT 50;`
      });
    }

    // Add glossary query if ATLASGLOSSARYTERM_ENTITY exists
    if (discoveredTables.has('ATLASGLOSSARYTERM_ENTITY')) {
      queries.push({
        id: 'glossary-terms',
        title: 'Glossary Terms',
        description: 'Business glossary terms and definitions',
        category: 'governance',
        sql: `-- Glossary terms
SELECT
  "NAME",
  "DESCRIPTION",
  "QUALIFIEDNAME",
  "CREATEDAT"
FROM ${database}.${schema}."ATLASGLOSSARYTERM_ENTITY"
ORDER BY "NAME"
LIMIT 100;`
      });
    }

    return queries;
  }, [libraryQueries, discoveredTables, database, schema]);

  // Build lineage queries
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

  // Categorize queries
  const categorizedQueries = useMemo(() => {
    const structure = [];
    const governance = [];
    const other = [];
    dynamicQueries.forEach(q => {
      switch (q.category) {
        case 'structure': structure.push(q); break;
        case 'governance': governance.push(q); break;
        default: if (q.category !== 'lineage') other.push(q);
      }
    });
    return { structure, governance, other };
  }, [dynamicQueries]);

  const totalQueries = lineageQueries.length + categorizedQueries.structure.length +
                       categorizedQueries.governance.length + categorizedQueries.other.length;

  const handleCopyGuid = () => {
    if (guid) {
      navigator.clipboard.writeText(guid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleViewLineage = () => {
    if (onOpenLineage && selectedEntity) {
      onOpenLineage({
        NAME: entityName,
        GUID: guid,
        entityType: entityType
      });
    }
  };

  const handleRunQuery = useCallback((querySql, query) => {
    logger.info('Running query:', query?.label || 'Unknown');
    setSql(querySql);
    setActiveTab('test');
    clearResults();
  }, [clearResults]);

  // Format SQL with sql-formatter
  const handleFormat = useCallback(() => {
    if (!sql.trim()) return;
    try {
      const formatted = formatSQL(sql, {
        language: 'snowflake',
        tabWidth: 2,
        keywordCase: 'upper',
        linesBetweenQueries: 2,
      });
      setSql(formatted);
    } catch (err) {
      // If formatting fails, leave SQL unchanged
      console.warn('SQL formatting failed:', err);
    }
  }, [sql]);

  const handleEditorMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    // Cmd+Enter to execute
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleExecute();
    });
    // Cmd+Shift+F to format
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF,
      () => {
        handleFormat();
      }
    );
  }, [handleFormat]);

  const handleExecute = useCallback(async () => {
    const queryText = sql.trim();
    if (!queryText || !isConnected) return;
    await executeQuery(queryText, {
      database: database || connStatus?.database,
      schema: schema || connStatus?.schema,
      warehouse: connStatus?.warehouse,
    });
  }, [sql, database, schema, connStatus, executeQuery, isConnected]);

  const handleTogglePin = () => {
    panelContext?.togglePin();
  };

  const handleClose = () => {
    panelContext?.unpin();
    panelContext?.setHovered(false);
    onClose?.();
  };

  // Available tabs depend on whether entity is selected
  const availableTabs = selectedEntity
    ? ['cell', 'lineage', 'test', 'library']
    : ['test', 'library'];

  // Rail mode (collapsed)
  if (!showFullPanel) {
    return (
      <CollapsedRailContainer
        ref={panelRef}
        position="right"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Pin indicator at top */}
        <div className="p-2 border-b border-slate-200 flex justify-center">
          <PinButton isPinned={isPinned} onToggle={() => panelContext?.pin()} size="md" />
        </div>

        {/* Rail icons */}
        <div className="flex-1 py-1">
          {selectedEntity && (
            <>
              <RailButton
                icon={Table2}
                label="Details"
                isActive={activeTab === 'cell'}
                onClick={() => { setActiveTab('cell'); panelContext?.pin(); }}
                position="right"
              />
              <RailButton
                icon={GitBranch}
                label="Queries"
                isActive={activeTab === 'lineage'}
                onClick={() => { setActiveTab('lineage'); panelContext?.pin(); }}
                badge={totalQueries > 0 ? totalQueries : null}
                position="right"
              />
            </>
          )}
          <RailButton
            icon={FlaskConical}
            label="Test Query"
            isActive={activeTab === 'test'}
            onClick={() => { setActiveTab('test'); panelContext?.pin(); }}
            position="right"
          />
          <RailButton
            icon={Library}
            label="Query Library"
            isActive={activeTab === 'library'}
            onClick={() => { setActiveTab('library'); panelContext?.pin(); }}
            badge={libraryQueries.length > 0 ? libraryQueries.length : null}
            position="right"
          />
        </div>
      </CollapsedRailContainer>
    );
  }

  // Full panel mode - use expanded preset or custom width
  const displayWidth = isExpanded ? 640 : panelWidth;

  return (
    <ExpandedContainer
      ref={panelRef}
      width={displayWidth}
      position="right"
      isResizing={isResizing}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="shadow-lg"
    >
      {/* Resize handle */}
      <ResizeHandle
        position="left"
        isResizing={isResizing}
        onMouseDown={handleResizeStart}
      />
      {/* Header - light style */}
      <div className="bg-white border-b border-slate-200">
        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Library size={16} className="text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-slate-900">
                {selectedEntity ? (entityName || 'Entity') : 'Query Library'}
              </h2>
              <p className="text-xs text-slate-500">
                {selectedEntity ? entityType : `${libraryQueries.length} queries`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <PinButton isPinned={isPinned} onToggle={handleTogglePin} size="sm" className="text-slate-500 hover:text-slate-700 hover:bg-slate-100" />
            <button
              onClick={handleClose}
              className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
              title="Close panel"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tabs - inside header */}
        <div className="flex px-2 pb-2 border-b border-slate-100 bg-slate-50">
          <TabButton icon={Library} label="Queries" isActive={activeTab === 'library'} onClick={() => setActiveTab('library')} badge={libraryQueries.length > 0 ? libraryQueries.length : null} />
          {selectedEntity && (
            <TabButton icon={GitBranch} label="Lineage" isActive={activeTab === 'lineage'} onClick={() => setActiveTab('lineage')} badge={totalQueries > 0 ? totalQueries : null} />
          )}
          <TabButton icon={FlaskConical} label="Test" isActive={activeTab === 'test'} onClick={() => setActiveTab('test')} />
          {selectedEntity && (
            <TabButton icon={Table2} label="Details" isActive={activeTab === 'cell'} onClick={() => setActiveTab('cell')} />
          )}
        </div>
      </div>

      {/* Entity Header (only when entity selected) */}
      {selectedEntity && (
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
                    <button onClick={handleCopyGuid} className="p-0.5 hover:bg-slate-100 rounded transition-colors" title="Copy GUID">
                      {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    </button>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Access Header (no entity) */}
      {!selectedEntity && (
        <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white border border-blue-200 flex items-center justify-center">
              <Sparkles size={20} className="text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Quick Access</h3>
              <p className="text-xs text-slate-500 mt-0.5">Test queries & browse library</p>
            </div>
          </div>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Queries tab (entity required) */}
        {activeTab === 'lineage' && selectedEntity && (
          <div className="flex-1 overflow-y-auto p-4">
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
                  <div className="text-sm font-semibold text-slate-800">View Lineage Graph</div>
                  <div className="text-xs text-slate-500 mt-0.5">Visualize upstream and downstream dependencies</div>
                </div>
                <ChevronRight size={20} className="text-blue-400 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            <button type="button" onClick={() => setIsQueriesExpanded(!isQueriesExpanded)} className="w-full flex items-center justify-between py-2 text-left">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Sparkles size={16} className="text-amber-500" />
                Recommended Queries
              </span>
              {isQueriesExpanded ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
            </button>

            {isQueriesExpanded && (
              <div className="mt-3 space-y-4">
                {lineageQueries.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">Lineage</h4>
                    <div className="space-y-2">
                      {lineageQueries.map((query) => (
                        <QueryItem key={query.id} query={query} onRun={handleRunQuery} icon={query.icon} />
                      ))}
                    </div>
                  </div>
                )}
                <QueryCategory title="Structure" queries={categorizedQueries.structure} onRun={handleRunQuery} />
                <QueryCategory title="Governance" queries={categorizedQueries.governance} onRun={handleRunQuery} />
                {categorizedQueries.other.length > 0 && <QueryCategory title="Other" queries={categorizedQueries.other} onRun={handleRunQuery} />}
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

        {/* Details tab (entity required) */}
        {activeTab === 'cell' && selectedEntity && (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Entity Name</label>
                <p className="text-sm text-slate-800 mt-1 font-mono">{entityName}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Type</label>
                <p className="text-sm text-slate-800 mt-1">{entityType}</p>
              </div>
              {guid && (
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">GUID</label>
                  <p className="text-sm text-slate-800 mt-1 font-mono break-all">{guid}</p>
                </div>
              )}
              {selectedEntity?.description && (
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Description</label>
                  <p className="text-sm text-slate-600 mt-1">{selectedEntity.description}</p>
                </div>
              )}
              {Object.entries(selectedEntity || {})
                .filter(([key]) => !['entity', 'table', 'name', 'NAME', 'guid', 'GUID', 'entityType', 'TYPENAME', 'description'].includes(key))
                .slice(0, 5)
                .map(([key, value]) => (
                  <div key={key}>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">{key}</label>
                    <p className="text-sm text-slate-800 mt-1 font-mono break-all">
                      {typeof value === 'object' ? JSON.stringify(value).substring(0, 100) : String(value).substring(0, 200)}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Test tab (always available) */}
        {activeTab === 'test' && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-shrink-0 border-b border-slate-200">
              <LazyMonacoEditor
                value={sql}
                onChange={(value) => setSql(value || '')}
                onMount={handleEditorMount}
                height={isExpanded ? 200 : 140}
                options={{
                  lineNumbers: isExpanded ? 'on' : 'off',
                  padding: { top: 12, bottom: 12 },
                  lineDecorationsWidth: 0,
                  lineNumbersMinChars: isExpanded ? 3 : 0,
                  glyphMargin: false,
                }}
              />
              <div className="flex items-center justify-between px-3 py-2 bg-white border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <RunQueryButton onClick={handleExecute} loading={loading} disabled={!sql.trim() || !isConnected} size={isExpanded ? 'md' : 'sm'} />
                  <button
                    onClick={handleFormat}
                    disabled={!sql.trim()}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors disabled:opacity-40"
                    title="Format SQL (⌘+Shift+F)"
                  >
                    <AlignLeft size={14} />
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => { setShowHistory(!showHistory); if (!showHistory) fetchHistory(); }}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                      title="Query History"
                    >
                      <History size={14} />
                    </button>
                    {showHistory && (
                      <div className="absolute left-0 top-full mt-1 w-72 max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                        <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-600">Recent Queries</span>
                          <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600">
                            <X size={12} />
                          </button>
                        </div>
                        {historyLoading ? (
                          <div className="p-4 text-center text-slate-400 text-sm">Loading...</div>
                        ) : history.length === 0 ? (
                          <div className="p-4 text-center text-slate-400 text-sm">No recent queries</div>
                        ) : (
                          <div className="divide-y divide-slate-100">
                            {history.slice(0, 10).map((item, i) => (
                              <button
                                key={i}
                                onClick={() => { setSql(item.sql || item.query); setShowHistory(false); clearResults(); }}
                                className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors"
                              >
                                <div className="text-xs font-mono text-slate-700 truncate">{(item.sql || item.query || '').substring(0, 60)}...</div>
                                <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                                  <Clock size={10} />
                                  {item.executed_at ? new Date(item.executed_at).toLocaleTimeString() : 'Recent'}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => { setSql(''); clearResults(); }}
                    disabled={!sql.trim()}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors disabled:opacity-40"
                    title="Clear"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <span className="text-xs text-slate-400">{sql.split('\n').length} {sql.split('\n').length === 1 ? 'line' : 'lines'}</span>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <ResultsDisplay results={results} loading={loading} error={error} compact={!isExpanded} />
            </div>
            {!isConnected && (
              <div className="px-3 py-2 bg-amber-50 border-t border-amber-200 text-xs text-amber-700 flex items-center gap-2">
                <WifiOff size={12} />
                Connect to Snowflake to run queries
              </div>
            )}
          </div>
        )}

        {/* Library tab (always available) */}
        {activeTab === 'library' && (
          <div className="flex-1 overflow-y-auto">
            {/* Connection status bar */}
            <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-600">
                  {isConnected ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                      <span className="font-medium text-slate-700">{database}</span>
                      <span className="text-slate-400">.</span>
                      <span className="font-mono text-slate-600">{schema}</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-slate-300 flex-shrink-0" />
                      <span className="text-slate-500">Not connected</span>
                    </>
                  )}
                </div>
                {isConnected && queryValidationMap.size > 0 && (
                  <div className="flex items-center gap-3 text-xs flex-shrink-0 ml-4">
                    <span className="text-emerald-600 font-medium">
                      {[...queryValidationMap.values()].filter(v => v.valid === true).length} valid
                    </span>
                    <span className="text-slate-400">
                      {[...queryValidationMap.values()].filter(v => v.valid === false).length} need fix
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Tables count and validate button */}
            {isConnected && discoveredTables.size > 0 && (
              <div className="flex items-center justify-between gap-3 p-3 mx-4 mt-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <strong className="text-slate-700">{discoveredTables.size}</strong>
                  <span>tables</span>
                </div>
                {onValidateAll && (
                  <button onClick={onValidateAll} disabled={isBatchValidating} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors disabled:opacity-50">
                    {isBatchValidating ? <><Loader2 size={12} className="animate-spin" />Validating...</> : <><Check size={12} />Validate All</>}
                  </button>
                )}
              </div>
            )}

            {isBatchValidating && (
              <div className="flex items-center gap-2 p-3 mx-4 mt-3 bg-blue-50 rounded-lg border border-blue-200">
                <Loader2 size={14} className="animate-spin text-blue-500" />
                <span className="text-sm text-blue-700">Validating queries...</span>
              </div>
            )}

            <div className="p-4 space-y-3">
              {effectiveLibraryQueries.length > 0 ? (
                effectiveLibraryQueries.map((q, i) => {
                  const queryText = q.query || q.sql;
                  const validation = queryValidationMap.get(queryText);
                  const batchResult = batchValidationResults.get(`core_${i}`);
                  const isValid = validation?.valid ?? null;
                  return (
                    <LibraryQueryCard
                      key={q.queryId || q.id || i}
                      index={i}
                      title={q.title || q.label}
                      description={q.description}
                      query={queryText}
                      frequency={q.frequency}
                      isValid={isValid}
                      rowCount={batchResult?.row_count}
                      onRun={(querySql) => {
                        if (onRunInEditor) {
                          onRunInEditor(querySql);
                        } else {
                          setSql(querySql);
                          setActiveTab('test');
                          clearResults();
                        }
                      }}
                      onTest={(querySql, title) => { setSql(querySql); setActiveTab('test'); clearResults(); }}
                      onExplain={onShowMyWork ? (querySql) => onShowMyWork(querySql, batchResult) : null}
                    />
                  );
                })
              ) : (
                <div className="text-center py-12">
                  <Code2 size={36} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-600 font-medium">No queries in library</p>
                  <p className="text-slate-400 text-sm mt-1">
                    {isConnected ? 'Connect to discover tables' : 'Connect to Snowflake first'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/50 flex-shrink-0">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="font-mono">{database}.{schema}</span>
          <span className="text-slate-400">
            {activeTab === 'lineage' && 'Click query to test'}
            {activeTab === 'test' && '⌘+Enter to run'}
            {activeTab === 'cell' && 'Entity details'}
            {activeTab === 'library' && `${effectiveLibraryQueries.length} queries`}
          </span>
        </div>
      </div>
    </ExpandedContainer>
  );
}
