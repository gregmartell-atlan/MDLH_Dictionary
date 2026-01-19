/**
 * Query Editor - Three-panel SQL workspace
 * Inspired by Atlan's clean, dense UI
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import LazyMonacoEditor from './LazyMonacoEditor';
import confetti from 'canvas-confetti';
import { format as formatSQL } from 'sql-formatter';
import {
  Play, Square, Trash2, History, Settings,
  Check, X, Loader2, Database, Clock, Copy,
  Wifi, WifiOff, PanelLeft, PanelLeftClose,
  ChevronDown, ChevronRight, Layers, AlertTriangle,
  Lightbulb, Sparkles, Table2, Columns, Hash,
  Calendar, Type, ToggleLeft, GripVertical,
  Search, Filter, BarChart3, PieChart, Zap,
  GitBranch, BookOpen, Shield, TrendingUp, ExternalLink,
  Rows3, Eye, PartyPopper, AlignLeft
} from 'lucide-react';
import ResultsTable from './ResultsTable';
import { useConnection, useQuery, useQueryHistory, useMetadata, usePreflight } from '../hooks/useSnowflake';
import { createLogger } from '../utils/logger';
import { buildSafeFQN, escapeStringValue } from '../utils/queryHelpers';
import { GOLD_LAYER_QUERIES } from '../data/goldLayerQueries';
import { GoldBadge, isGoldLayerQuery } from './ui/GoldBadge';

const log = createLogger('QueryEditor');

// =============================================================================
// QUERY SUGGESTIONS - Atlan-style dropdown with ready-to-run queries
// =============================================================================

/**
 * Builds suggested queries with REAL values (no placeholders!)
 * Uses sample entities to populate GUIDs, table names, etc.
 */
function buildSuggestedQueries(database, schema, discoveredTables, sampleEntities) {
  if (!database || !schema || !discoveredTables?.size || !sampleEntities?.loaded) {
    return [];
  }

  const queries = [];
  const tables = [...discoveredTables];
  
  // Helper to get a real GUID from samples
  const getGuid = (type) => {
    const rows = sampleEntities[type];
    if (!rows || rows.length === 0) return null;
    const guidKey = Object.keys(rows[0]).find(k => k.toUpperCase() === 'GUID');
    return guidKey ? rows[0][guidKey] : null;
  };

  // Helper to get a real name from samples  
  const getName = (type) => {
    const rows = sampleEntities[type];
    if (!rows || rows.length === 0) return null;
    const nameKey = Object.keys(rows[0]).find(k => k.toUpperCase() === 'NAME');
    return nameKey ? rows[0][nameKey] : null;
  };

  // Find entity tables
  const tableEntity = tables.find(t => t.includes('TABLE') && t.includes('ENTITY') && !t.includes('TABLEAU'));
  const columnEntity = tables.find(t => t.includes('COLUMN') && t.includes('ENTITY'));
  const processEntity = tables.find(t => t.includes('PROCESS') && t.includes('ENTITY'));
  const glossaryTermEntity = tables.find(t => t.includes('GLOSSARYTERM'));
  const glossaryEntity = tables.find(t => t.includes('GLOSSARY') && !t.includes('TERM') && !t.includes('CATEGORY') && t.includes('ENTITY'));

  // Get real sample values
  const tableGuid = getGuid('tables');
  const tableName = getName('tables');
  const columnGuid = getGuid('columns');
  const processGuid = getGuid('processes');
  const glossaryGuid = getGuid('glossaries');
  const termGuid = getGuid('terms');

  // 1. Popular Tables Query (always available if we have TABLE_ENTITY)
  if (tableEntity) {
    const fqn = buildSafeFQN(database, schema, tableEntity);
    queries.push({
      id: 'popular_tables',
      label: 'Popular Tables',
      description: 'Tables ranked by usage',
      icon: TrendingUp,
      category: 'structure',
      sql: `-- Most popular tables in your environment
SELECT 
    NAME,
    TYPENAME,
    POPULARITYSCORE,
    QUERYCOUNT,
    STATUS
FROM ${fqn}
WHERE POPULARITYSCORE > 0
ORDER BY POPULARITYSCORE DESC
LIMIT 25;`
    });
  }

  // 2. Find by GUID (only if we have a real GUID)
  if (tableEntity && tableGuid) {
    const fqn = buildSafeFQN(database, schema, tableEntity);
    queries.push({
      id: 'find_by_guid',
      label: 'Find by GUID',
      description: `Lookup: ${tableName || 'entity'}`,
      icon: Search,
      category: 'lookup',
      sql: `-- Find asset by GUID
SELECT *
FROM ${fqn}
WHERE GUID = ${escapeStringValue(tableGuid)}
LIMIT 1;`
    });
  }

  // 3. Upstream Lineage (only if we have process table AND a real GUID)
  if (processEntity && tableGuid) {
    const fqn = buildSafeFQN(database, schema, processEntity);
    queries.push({
      id: 'upstream_lineage',
      label: 'Upstream Lineage',
      description: 'What feeds into this asset',
      icon: GitBranch,
      category: 'lineage',
      sql: `-- Upstream lineage (what feeds into this asset)
SELECT DISTINCT
    p."GUID" AS process_guid,
    p."NAME" AS process_name,
    p."INPUTS" AS upstream_assets,
    p."OUTPUTS" AS downstream_assets
FROM ${fqn} p,
LATERAL FLATTEN(INPUT => p."OUTPUTS", OUTER => FALSE) f
WHERE f.value::VARCHAR ILIKE '%' || ${escapeStringValue(tableGuid)} || '%'
LIMIT 50;`
    });
  }

  // 4. Downstream Lineage
  if (processEntity && tableGuid) {
    const fqn = buildSafeFQN(database, schema, processEntity);
    queries.push({
      id: 'downstream_lineage',
      label: 'Downstream Lineage', 
      description: 'What this asset feeds',
      icon: GitBranch,
      category: 'lineage',
      sql: `-- Downstream lineage (what this asset feeds into)
SELECT DISTINCT
    p."GUID" AS process_guid,
    p."NAME" AS process_name,
    p."INPUTS" AS upstream_assets,
    p."OUTPUTS" AS downstream_assets
FROM ${fqn} p,
LATERAL FLATTEN(INPUT => p."INPUTS", OUTER => FALSE) f
WHERE f.value::VARCHAR ILIKE '%' || ${escapeStringValue(tableGuid)} || '%'
LIMIT 50;`
    });
  }

  // 5. Glossary Terms (only if we have glossary entity AND a real glossary GUID)
  if (glossaryTermEntity && glossaryGuid) {
    const fqn = buildSafeFQN(database, schema, glossaryTermEntity);
    queries.push({
      id: 'glossary_terms',
      label: 'Glossary Terms',
      description: 'Terms in glossary',
      icon: BookOpen,
      category: 'glossary',
      sql: `-- Terms in a specific glossary
-- ANCHOR is an OBJECT - use :guid::STRING ILIKE for matching
SELECT 
    "GUID",
    "NAME",
    "USERDESCRIPTION",
    "STATUS"
FROM ${fqn}
WHERE "ANCHOR":guid::STRING ILIKE '%' || ${escapeStringValue(glossaryGuid)} || '%'
ORDER BY "NAME"
LIMIT 100;`
    });
  }

  // 6. Certified Assets
  if (tableEntity) {
    const fqn = buildSafeFQN(database, schema, tableEntity);
    queries.push({
      id: 'certified_assets',
      label: 'Certified Assets',
      description: 'Verified tables',
      icon: Shield,
      category: 'governance',
      sql: `-- Certified assets with certificate message
SELECT 
    NAME,
    TYPENAME,
    CERTIFICATESTATUSMESSAGE,
    CERTIFICATEUPDATEDBY,
    CERTIFICATEUPDATEDAT
FROM ${fqn}
WHERE CERTIFICATESTATUSMESSAGE IS NOT NULL
ORDER BY CERTIFICATEUPDATEDAT DESC
LIMIT 50;`
    });
  }

  // 7. Row Count
  if (tableEntity) {
    const fqn = buildSafeFQN(database, schema, tableEntity);
    queries.push({
      id: 'row_count',
      label: 'Table Count',
      description: 'Total tables',
      icon: Hash,
      category: 'structure',
      sql: `-- Count of all tables
SELECT COUNT(*) AS total_tables
FROM ${fqn};`
    });
  }

  // 8. Column Analysis (if we have column entity)
  if (columnEntity) {
    const fqn = buildSafeFQN(database, schema, columnEntity);
    queries.push({
      id: 'column_types',
      label: 'Column Types',
      description: 'Data type distribution',
      icon: Columns,
      category: 'structure',
      sql: `-- Column data type distribution
SELECT 
    DATATYPE,
    COUNT(*) AS column_count
FROM ${fqn}
GROUP BY DATATYPE
ORDER BY column_count DESC
LIMIT 20;`
    });
  }

  // ==========================================================================
  // GOLD LAYER QUERIES - Curated, production-ready (always show top 5)
  // ==========================================================================
  const goldStarters = GOLD_LAYER_QUERIES
    .filter(q => q.frequency === 'Starter' || q.frequency === 'Common')
    .slice(0, 5)
    .map(q => ({
      id: `gold_${q.id}`,
      label: `⭐ ${q.name}`,
      description: q.description,
      icon: Sparkles,
      category: 'gold',
      isGold: true,
      goldTables: q.goldTables,
      sql: q.sql
    }));
  
  // Add Gold queries at the beginning (featured)
  queries.unshift(...goldStarters);

  return queries;
}

/**
 * Query Suggestions Dropdown - Atlan style
 * Shows ready-to-run queries with REAL values (no placeholders!)
 */
function QuerySuggestionsDropdown({
  database,
  schema,
  discoveredTables,
  sampleEntities,
  onSelectQuery,
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  const queries = useMemo(() =>
    buildSuggestedQueries(database, schema, discoveredTables, sampleEntities),
    [database, schema, discoveredTables, sampleEntities]
  );

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search on open
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (query) => {
    onSelectQuery?.(query.sql);
    setIsOpen(false);
    setSearchTerm('');
  };

  // Filter queries by search term
  const filteredQueries = useMemo(() => {
    if (!searchTerm.trim()) return queries;
    const term = searchTerm.toLowerCase();
    return queries.filter(q =>
      q.label.toLowerCase().includes(term) ||
      q.description.toLowerCase().includes(term) ||
      q.category.toLowerCase().includes(term)
    );
  }, [queries, searchTerm]);

  // Group queries by category
  const groupedQueries = useMemo(() => {
    const groups = {};
    filteredQueries.forEach(q => {
      if (!groups[q.category]) groups[q.category] = [];
      groups[q.category].push(q);
    });
    return groups;
  }, [filteredQueries]);

  const categoryLabels = {
    gold: '⭐ Gold Layer (Curated)',
    structure: 'Structure',
    lookup: 'Lookup',
    lineage: 'Lineage',
    glossary: 'Glossary',
    governance: 'Governance'
  };
  
  // Custom sort to put Gold first
  const categoryOrder = ['gold', 'structure', 'lookup', 'lineage', 'glossary', 'governance'];

  if (queries.length === 0) {
    return (
      <button
        disabled
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 bg-slate-100 rounded-lg cursor-not-allowed"
        title="Loading sample data..."
      >
        <Loader2 size={12} className="animate-spin" />
        <span>Loading queries...</span>
      </button>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:border-gray-400 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        title="Query templates with real data"
      >
        <Zap size={12} className="text-amber-500" />
        <span>Templates</span>
        <ChevronDown size={12} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Search Header */}
          <div className="px-3 py-2 border-b border-gray-100">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 rounded-lg">
              <Search size={14} className="text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-400"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-600">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Query List */}
          <div className="max-h-72 overflow-y-auto">
            {Object.keys(groupedQueries).length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-slate-500">
                No templates match "{searchTerm}"
              </div>
            ) : (
              // Sort categories with Gold first
              Object.entries(groupedQueries)
                .sort(([a], [b]) => {
                  const aIdx = categoryOrder.indexOf(a);
                  const bIdx = categoryOrder.indexOf(b);
                  return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
                })
                .map(([category, categoryQueries]) => (
                <div key={category}>
                  <div className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide sticky top-0 ${
                    category === 'gold' 
                      ? 'bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-700 border-b border-amber-200' 
                      : 'bg-slate-50 text-slate-500'
                  }`}>
                    {categoryLabels[category] || category}
                  </div>
                  {categoryQueries.map((query) => {
                    const Icon = query.icon;
                    const isGold = query.isGold || category === 'gold';
                    return (
                      <button
                        key={query.id}
                        onClick={() => handleSelect(query)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors group ${
                          isGold 
                            ? 'hover:bg-amber-50 border-l-2 border-transparent hover:border-amber-400' 
                            : 'hover:bg-blue-50'
                        }`}
                      >
                        {isGold ? (
                          <GoldBadge variant="compact" size="xs" />
                        ) : (
                          <Icon size={14} className="text-gray-400 group-hover:text-blue-600 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium ${
                            isGold 
                              ? 'text-amber-800 group-hover:text-amber-900' 
                              : 'text-gray-800 group-hover:text-blue-700'
                          }`}>
                            {query.label}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {query.description}
                          </div>
                        </div>
                        <Play size={10} className={`opacity-0 group-hover:opacity-100 ${
                          isGold ? 'text-amber-500' : 'text-blue-500'
                        }`} />
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[10px] text-slate-500 flex items-center gap-1">
              <Check size={10} className="text-emerald-500" />
              Uses real GUIDs
            </span>
            <span className="text-[10px] text-slate-400">
              {filteredQueries.length} templates
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// TABLE SELECTOR - Atlan-style with smart filters
// =============================================================================

// Table category detection for smart filtering
const TABLE_CATEGORIES = {
  ENTITY: { pattern: /_ENTITY$/, label: 'Entity', color: 'violet' },
  RELATIONSHIP: { pattern: /RELATIONSHIP|_REL$/, label: 'Rel', color: 'blue' },
  GLOSSARY: { pattern: /GLOSSARY|TERM|CATEGORY/, label: 'Glossary', color: 'emerald' },
  LINEAGE: { pattern: /PROCESS|LINEAGE/, label: 'Lineage', color: 'amber' },
  BI: { pattern: /TABLEAU|POWERBI|LOOKER|SIGMA/, label: 'BI', color: 'pink' },
  DATA: { pattern: /TABLE|COLUMN|SCHEMA|DATABASE/, label: 'Data', color: 'cyan' },
};

function getTableCategory(tableName) {
  for (const [key, config] of Object.entries(TABLE_CATEGORIES)) {
    if (config.pattern.test(tableName)) {
      return { key, ...config };
    }
  }
  return { key: 'OTHER', label: 'Other', color: 'gray' };
}

function TableSelector({ 
  database, 
  schema, 
  discoveredTables, 
  onInsertTable,
  disabled = false,
  tableMetadata = {} // Optional: { TABLE_NAME: { rowCount, queryCount, popularity } }
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // all, popular, recent, entity
  const [sortBy, setSortBy] = useState('alpha'); // alpha, popular, rows
  const dropdownRef = useRef(null);
  
  // Convert Set to array with metadata
  const tables = useMemo(() => {
    if (!discoveredTables || discoveredTables.size === 0) return [];
    return [...discoveredTables]
      .map(name => ({
        name,
        fqn: `${database}.${schema}.${name}`,
        category: getTableCategory(name),
        meta: tableMetadata[name] || {},
        // Infer popularity from table name patterns
        isPopular: /^(TABLE_ENTITY|COLUMN_ENTITY|PROCESS_ENTITY|ATLASGLOSSARY)/.test(name),
        isCore: /_ENTITY$/.test(name) && !/RELATIONSHIP/.test(name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [discoveredTables, database, schema, tableMetadata]);
  
  // Filter and sort tables
  const filteredTables = useMemo(() => {
    let result = tables;
    
    // Search filter
    if (search) {
      const term = search.toLowerCase();
      result = result.filter(t => 
        t.name.toLowerCase().includes(term) ||
        t.category.label.toLowerCase().includes(term)
      );
    }
    
    // Category filter
    switch (activeFilter) {
      case 'popular':
        result = result.filter(t => t.isPopular || (t.meta.queryCount > 0));
        break;
      case 'entity':
        result = result.filter(t => t.isCore);
        break;
      case 'bi':
        result = result.filter(t => t.category.key === 'BI');
        break;
      case 'glossary':
        result = result.filter(t => t.category.key === 'GLOSSARY');
        break;
    }
    
    // Sort
    switch (sortBy) {
      case 'popular':
        result = [...result].sort((a, b) => (b.meta.queryCount || 0) - (a.meta.queryCount || 0));
        break;
      case 'rows':
        result = [...result].sort((a, b) => (b.meta.rowCount || 0) - (a.meta.rowCount || 0));
        break;
      default:
        // Keep alphabetical
        break;
    }
    
    return result;
  }, [tables, search, activeFilter, sortBy]);
  
  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const handleSelect = (table) => {
    onInsertTable?.(table.fqn, table.name);
    setIsOpen(false);
    setSearch('');
  };
  
  // Category badge colors (Atlan-inspired)
  const badgeColors = {
    violet: 'bg-gray-100 text-gray-700 border-gray-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    amber: 'bg-gray-100 text-gray-600 border-gray-200',
    pink: 'bg-gray-100 text-gray-600 border-gray-200',
    cyan: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    gray: 'bg-gray-100 text-gray-600 border-gray-200',
  };
  
  if (tables.length === 0) {
    return (
      <button
        disabled
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-lg cursor-not-allowed"
        title="No tables discovered"
      >
        <Table2 size={14} />
        <span>No tables</span>
      </button>
    );
  }
  
  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button - Atlan style */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:border-gray-400 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        title="Insert table name (FQN)"
      >
        <Table2 size={14} className="text-gray-500" />
        <span>Tables</span>
        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded-md text-xs font-semibold">
          {tables.length}
        </span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-96 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header with Search - Atlan style */}
          <div className="p-3 bg-gradient-to-b from-gray-50 to-white border-b border-gray-100">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search tables..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400 bg-white"
                autoFocus
              />
            </div>
            
            {/* Filter Pills - Atlan inspired */}
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {[
                { id: 'all', label: 'All', icon: Layers },
                { id: 'popular', label: 'Popular', icon: BarChart3 },
                { id: 'entity', label: 'Core Entities', icon: Database },
                { id: 'glossary', label: 'Glossary', icon: Type },
                { id: 'bi', label: 'BI Tools', icon: PieChart },
              ].map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg transition-all ${
                    activeFilter === filter.id
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <filter.icon size={12} />
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Table List */}
          <div className="max-h-80 overflow-y-auto">
            {filteredTables.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No tables match your filters
              </div>
            ) : (
              <div className="p-1.5">
                {filteredTables.map((table) => (
                  <button
                    key={table.name}
                    onClick={() => handleSelect(table)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-100 rounded-lg transition-colors group"
                  >
                    <Table2 size={14} className="text-gray-400 group-hover:text-gray-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800 text-sm truncate">
                          {table.name}
                        </span>
                        <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${badgeColors[table.category.color]}`}>
                          {table.category.label}
                        </span>
                        {table.isPopular && (
                          <Sparkles size={12} className="text-emerald-500" title="Popular table" />
                        )}
                      </div>
                      <div className="text-xs text-gray-500 truncate font-mono mt-0.5">
                        {table.fqn}
                      </div>
                      {/* Metadata row if available */}
                      {(table.meta.rowCount || table.meta.queryCount) && (
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                          {table.meta.rowCount && (
                            <span className="flex items-center gap-0.5">
                              <Hash size={10} />
                              {table.meta.rowCount.toLocaleString()} rows
                            </span>
                          )}
                          {table.meta.queryCount && (
                            <span className="flex items-center gap-0.5">
                              <BarChart3 size={10} />
                              {table.meta.queryCount} queries
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
            <span className="font-medium">{filteredTables.length}</span> of {tables.length} tables
            <span className="mx-2">•</span>
            Click to insert FQN at cursor
          </div>
        </div>
      )}
    </div>
  );
}


// =============================================================================
// RESIZABLE PANEL COMPONENT - Atlan-style with subtle handle
// =============================================================================

function ResizablePanel({ 
  direction = 'horizontal', 
  initialSize = 256, 
  minSize = 100, 
  maxSize = 500,
  children,
  className = '',
  onResize
}) {
  const [size, setSize] = useState(initialSize);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef(null);
  
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }, [direction]);
  
  useEffect(() => {
    if (!isResizing) return;
    
    const handleMouseMove = (e) => {
      if (direction === 'horizontal') {
        const newSize = e.clientX - panelRef.current.getBoundingClientRect().left;
        setSize(Math.min(maxSize, Math.max(minSize, newSize)));
      } else {
        const newSize = e.clientY - panelRef.current.getBoundingClientRect().top;
        setSize(Math.min(maxSize, Math.max(minSize, newSize)));
      }
      onResize?.(size);
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, direction, minSize, maxSize, onResize, size]);
  
  return (
    <div 
      ref={panelRef}
      className={`relative flex-shrink-0 ${className}`}
      style={{ [direction === 'horizontal' ? 'width' : 'height']: size }}
    >
      {children}
      {/* Resize handle - Atlan subtle style */}
      <div
        className={`absolute group ${
          direction === 'horizontal' 
            ? 'right-0 top-0 bottom-0 w-1 cursor-col-resize'
            : 'bottom-0 left-0 right-0 h-1 cursor-row-resize'
        } ${isResizing ? 'bg-gray-400' : 'bg-transparent hover:bg-gray-300'} transition-colors z-10`}
        onMouseDown={handleMouseDown}
      >
        {/* Visual grip indicator */}
        <div className={`absolute opacity-0 group-hover:opacity-100 transition-opacity ${
          direction === 'horizontal'
            ? 'left-0 top-1/2 -translate-y-1/2 w-1 h-8 flex flex-col items-center justify-center gap-0.5'
            : 'top-0 left-1/2 -translate-x-1/2 h-1 w-8 flex items-center justify-center gap-0.5'
        }`}>
          {[0, 1, 2].map(i => (
            <div key={i} className={`bg-gray-400 rounded-full ${
              direction === 'horizontal' ? 'w-0.5 h-0.5' : 'w-0.5 h-0.5'
            }`} />
          ))}
        </div>
      </div>
    </div>
  );
}
  
// =============================================================================
// TABLE HOVER PREVIEW - Shows table info on hover
// =============================================================================

function TableHoverPreview({ 
  tableName,
  database, 
  schema, 
  rowCount,
  position, 
  onMouseEnter,
  onMouseLeave,
  onViewTable, 
  onCopyName,
  onClose 
}) {
  console.log('[TableHoverPreview] Rendering for:', tableName, 'at position:', position);
  const fqn = buildSafeFQN(database, schema, tableName);
  
  return (
    <div 
      className="fixed z-[9999] bg-white rounded-lg shadow-xl border border-slate-200 w-64 animate-zoom-in-95"
      style={{
        top: position.top,
        left: position.left,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white rounded-t-lg">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-100 rounded-md">
            <Table2 size={14} className="text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-slate-900 truncate">
              {tableName}
            </div>
            <div className="text-[10px] text-slate-400 font-mono truncate">
              {database}.{schema}
            </div>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-600 border border-emerald-200">
            TABLE
          </span>
        </div>
      </div>
      
      {/* Stats Row */}
      {rowCount !== undefined && rowCount !== null && (
        <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/50 flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Rows3 size={12} className="text-purple-500" />
            <span className="text-xs text-slate-600">
              <span className="font-medium">
                {typeof rowCount === 'number' ? rowCount.toLocaleString() : rowCount}
              </span> rows
            </span>
          </div>
        </div>
      )}
      
      {/* Actions */}
      <div className="px-2 py-2 flex items-center gap-1.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            console.log('[TableHoverPreview] View Table clicked');
            onViewTable?.();
          }}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
        >
          <Eye size={12} />
          View Table
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            console.log('[TableHoverPreview] Copy clicked');
            onCopyName?.(fqn);
          }}
          className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
          title="Copy fully qualified name"
        >
          <Copy size={14} />
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// SCHEMA TREE COMPONENT - Atlan-style Database Explorer
// =============================================================================

function SchemaTree({ 
  database, 
  schema, 
  onSelectTable,
  onDatabaseChange,
  onSchemaChange,
  onRunQuery,
  connectionStatus 
}) {
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [databases, setDatabases] = useState([]);
  const [schemasMap, setSchemasMap] = useState({}); // { dbName: schemas[] }
  const [tablesMap, setTablesMap] = useState({}); // { "db.schema": tables[] }
  const [loading, setLoading] = useState(false);
  const [loadingSchemas, setLoadingSchemas] = useState({});
  const [loadingTables, setLoadingTables] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  
  // Hover preview state
  const [hoverPreview, setHoverPreview] = useState(null);
  const hoverTimeoutRef = useRef(null);  // For showing preview after delay
  const hideTimeoutRef = useRef(null);   // For hiding preview with delay (allows moving to preview)
  const [copiedToast, setCopiedToast] = useState(false);
  
  // Handlers for preview hover - allow mouse to move to preview without closing
  const cancelHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);
  
  const startHideTimeout = useCallback((tableName) => {
    cancelHideTimeout();
    hideTimeoutRef.current = setTimeout(() => {
      setHoverPreview(prev => prev?.tableName === tableName ? null : prev);
    }, 150);
  }, [cancelHideTimeout]);
  
  const { fetchDatabases, fetchSchemas, fetchTables } = useMetadata();
  
  // Load databases on mount
  useEffect(() => {
    if (connectionStatus?.connected) {
      setLoading(true);
      fetchDatabases()
        .then(dbs => {
          const dbList = dbs || [];
          setDatabases(dbList);
          // Auto-expand current database
          if (database) {
            setExpandedNodes(prev => new Set([...prev, database]));
          }
        })
        .catch(() => setDatabases([]))
        .finally(() => setLoading(false));
    }
  }, [connectionStatus?.connected, fetchDatabases]);
  
  // Auto-expand and load schemas for current database
  useEffect(() => {
    if (database && connectionStatus?.connected && !schemasMap[database]) {
      loadSchemasForDb(database);
    }
  }, [database, connectionStatus?.connected]);
  
  // Auto-expand and load tables for current schema
  useEffect(() => {
    const key = `${database}.${schema}`;
    if (database && schema && connectionStatus?.connected && !tablesMap[key]) {
      loadTablesForSchema(database, schema);
      setExpandedNodes(prev => new Set([...prev, database, key]));
    }
  }, [database, schema, connectionStatus?.connected]);
  
  const loadSchemasForDb = async (dbName) => {
    if (schemasMap[dbName]) return;
    setLoadingSchemas(prev => ({ ...prev, [dbName]: true }));
    try {
      const schemas = await fetchSchemas(dbName);
      setSchemasMap(prev => ({ ...prev, [dbName]: schemas || [] }));
    } catch (e) {
      console.error('Failed to load schemas:', e);
    } finally {
      setLoadingSchemas(prev => ({ ...prev, [dbName]: false }));
    }
  };
  
  const loadTablesForSchema = async (dbName, schemaName) => {
    const key = `${dbName}.${schemaName}`;
    if (tablesMap[key]) return;
    setLoadingTables(prev => ({ ...prev, [key]: true }));
    try {
      const tables = await fetchTables(dbName, schemaName);
      setTablesMap(prev => ({ ...prev, [key]: tables || [] }));
    } catch (e) {
      console.error('Failed to load tables:', e);
    } finally {
      setLoadingTables(prev => ({ ...prev, [key]: false }));
    }
  };
  
  const toggleNode = async (nodeId, type, dbName, schemaName) => {
    const isCurrentlyExpanded = expandedNodes.has(nodeId);
    
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
    
    // Load data if expanding
    if (!isCurrentlyExpanded) {
      if (type === 'database') {
        await loadSchemasForDb(dbName);
      } else if (type === 'schema') {
        await loadTablesForSchema(dbName, schemaName);
      }
    }
  };
  
  const isExpanded = (nodeId) => expandedNodes.has(nodeId);
  
  // Filter tables by search
  const filterTables = (tables) => {
    if (!searchQuery) return tables;
    return tables.filter(t => {
      const name = typeof t === 'string' ? t : t.name;
      return name.toLowerCase().includes(searchQuery.toLowerCase());
    });
  };
  
  // Get icon for database type
  const getDatabaseIcon = (dbName) => {
    if (dbName === 'memory' || dbName.includes('MEMORY')) {
      return <Settings size={14} className="text-slate-500" />;
    }
    return <Database size={14} className="text-blue-500" />;
  };
  
  return (
    <div className="flex flex-col h-full text-[13px] bg-slate-50" data-testid="schema-tree">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between">
          <span className="font-medium text-slate-700 text-sm">Attached databases</span>
          <button className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600">
            <ChevronDown size={14} />
          </button>
        </div>
      </div>
      
      {/* Search */}
      {connectionStatus?.connected && databases.length > 0 && (
        <div className="px-2 py-2 border-b border-slate-200">
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filter tables..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="schema-tree-search"
              className="w-full pl-7 pr-2 py-1.5 text-xs bg-slate-100 border-0 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-slate-400"
            />
          </div>
        </div>
      )}
          
      {/* Tree */}
      <div className="flex-1 overflow-auto py-1">
        {!connectionStatus?.connected ? (
          <div className="px-3 py-8 text-center text-slate-400 text-xs">
            <WifiOff size={24} className="mx-auto mb-3 opacity-50" />
            <p className="font-medium">Connect to see schema</p>
          </div>
        ) : loading ? (
          <div className="px-3 py-8 text-center text-slate-400">
            <Loader2 size={20} className="mx-auto animate-spin" />
          </div>
        ) : databases.length === 0 ? (
          <div className="px-3 py-8 text-center text-slate-400 text-xs">
            No databases found
          </div>
        ) : (
          <div className="space-y-0">
            {databases.map(db => {
              const dbName = typeof db === 'string' ? db : db.name;
              const isCurrentDb = dbName === database;
              const dbSchemas = schemasMap[dbName] || [];
              
              return (
                <div key={dbName}>
                  {/* Database node */}
                  <div
                    className={`flex items-center gap-1 px-2 py-1.5 cursor-pointer transition-colors group ${
                      isCurrentDb ? 'bg-blue-50' : 'hover:bg-slate-100'
                    }`}
                    onClick={() => toggleNode(dbName, 'database', dbName)}
                  >
                    <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                      {isExpanded(dbName) ? (
                        <ChevronDown size={12} className="text-slate-500" />
                      ) : (
                        <ChevronRight size={12} className="text-slate-400" />
                      )}
                    </span>
                    {getDatabaseIcon(dbName)}
                    <span className={`font-medium truncate ${isCurrentDb ? 'text-blue-700' : 'text-slate-800'}`}>
                      {dbName}
                    </span>
                    {/* Remote indicator or action icons */}
                    <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100">
                      {db.is_remote && (
                        <span className="text-slate-400" title={db.url}>
                          <Wifi size={12} />
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Schemas under database */}
                  {isExpanded(dbName) && (
                    <div className="ml-3">
                      {loadingSchemas[dbName] ? (
                        <div className="flex items-center gap-2 px-4 py-1.5 text-slate-400">
                          <Loader2 size={12} className="animate-spin" />
                          <span className="text-xs">Loading schemas...</span>
                        </div>
                      ) : dbSchemas.length === 0 ? (
                        <div className="px-6 py-1.5 text-xs text-slate-400">No schemas</div>
                      ) : (
                        dbSchemas.map(s => {
                          const schemaName = typeof s === 'string' ? s : s.name;
                          const schemaKey = `${dbName}.${schemaName}`;
                          const isCurrentSchema = dbName === database && schemaName === schema;
                          const schemaTables = tablesMap[schemaKey] || [];
                          const filteredTables = filterTables(schemaTables);
                          
                          return (
                            <div key={schemaKey}>
                              {/* Schema node */}
                              <div
                                className={`flex items-center gap-1 px-2 py-1 cursor-pointer transition-colors ${
                                  isCurrentSchema ? 'bg-blue-50/50' : 'hover:bg-slate-100'
                                }`}
                                onClick={() => toggleNode(schemaKey, 'schema', dbName, schemaName)}
                              >
                                <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                                  {isExpanded(schemaKey) ? (
                                    <ChevronDown size={11} className="text-slate-500" />
                                  ) : (
                                    <ChevronRight size={11} className="text-slate-400" />
                                  )}
                                </span>
                                <Layers size={13} className="text-blue-500 flex-shrink-0" />
                                <span className={`truncate ${isCurrentSchema ? 'text-blue-600 font-medium' : 'text-slate-700'}`}>
                                  {schemaName}
                                </span>
                                {schemaTables.length > 0 && (
                                  <span className="ml-auto text-[10px] text-slate-400 tabular-nums">
                                    {schemaTables.length}
                                  </span>
                                )}
                              </div>
                              
                              {/* Tables under schema */}
                              {isExpanded(schemaKey) && (
                                <div className="ml-4">
                                  {loadingTables[schemaKey] ? (
                                    <div className="flex items-center gap-2 px-4 py-1.5 text-slate-400">
                                      <Loader2 size={10} className="animate-spin" />
                                      <span className="text-xs">Loading tables...</span>
                                    </div>
                                  ) : filteredTables.length === 0 ? (
                                    <div className="px-6 py-1.5 text-xs text-slate-400">
                                      {searchQuery ? 'No matching tables' : 'No tables'}
                                    </div>
                                  ) : (
                                    filteredTables.map(table => {
                                      const tableName = typeof table === 'string' ? table : table.name;
                                      const tableRowKey = `${dbName}.${schemaName}.${tableName}`;
                                      return (
                                        <div
                                          key={tableName}
                                          className="flex items-center justify-between gap-1 px-2 py-1 hover:bg-blue-50 cursor-pointer rounded group"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            // Set the database/schema context first
                                            if (dbName !== database) onDatabaseChange?.(dbName);
                                            if (schemaName !== schema) onSchemaChange?.(schemaName);
                                            onSelectTable?.(tableName);
                                          }}
                                          onMouseEnter={(e) => {
                                            console.log('[SchemaTree] mouseEnter:', tableName);
                                            // Clear any existing timeout
                                            if (hoverTimeoutRef.current) {
                                              clearTimeout(hoverTimeoutRef.current);
                                            }
                                            // Capture rect immediately - React events are pooled and e.currentTarget becomes null after callback
                                            const target = e.currentTarget;
                                            const rect = target?.getBoundingClientRect();
                                            if (!rect) return;
                                            
                                            // Delay showing preview
                                            hoverTimeoutRef.current = setTimeout(() => {
                                              console.log('[SchemaTree] Setting hover preview for:', tableName, 'rect:', rect);
                                              setHoverPreview({
                                                tableName,
                                                database: dbName,
                                                schema: schemaName,
                                                rowCount: table.row_count,
                                                position: {
                                                  top: Math.min(rect.top, window.innerHeight - 200),
                                                  left: rect.right + 8,
                                                }
                                              });
                                            }, 400);
                                          }}
                                          onMouseLeave={() => {
                                            console.log('[SchemaTree] mouseLeave:', tableName);
                                            if (hoverTimeoutRef.current) {
                                              clearTimeout(hoverTimeoutRef.current);
                                            }
                                            // Small delay to allow moving to preview - uses shared timeout that preview can cancel
                                            startHideTimeout(tableName);
                                          }}
                                        >
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <Table2 size={11} className="text-slate-400 flex-shrink-0" />
                                            <span className="text-slate-600 truncate text-[12px]">{tableName}</span>
                                          </div>
                                          {table.row_count && (
                                            <span className="text-[10px] text-slate-400 tabular-nums opacity-60 group-hover:opacity-100">
                                              {typeof table.row_count === 'number' 
                                                ? table.row_count.toLocaleString() 
                                                : table.row_count}
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Hover Preview */}
      {hoverPreview && (
        <TableHoverPreview
          tableName={hoverPreview.tableName}
          database={hoverPreview.database}
          schema={hoverPreview.schema}
          rowCount={hoverPreview.rowCount}
          position={hoverPreview.position}
          onMouseEnter={() => {
            console.log('[SchemaTree] Mouse entered preview - canceling hide');
            cancelHideTimeout();
          }}
          onMouseLeave={() => {
            console.log('[SchemaTree] Mouse left preview - hiding');
            setHoverPreview(null);
          }}
          onViewTable={() => {
            console.log('[SchemaTree] View Table:', hoverPreview.tableName);
            const fqn = buildSafeFQN(hoverPreview.database, hoverPreview.schema, hoverPreview.tableName);
            const query = `SELECT * FROM ${fqn} LIMIT 100;`;
            console.log('[SchemaTree] Running query:', query);
            // Update context and run query
            if (hoverPreview.database !== database) onDatabaseChange?.(hoverPreview.database);
            if (hoverPreview.schema !== schema) onSchemaChange?.(hoverPreview.schema);
            onRunQuery?.(query, hoverPreview.database, hoverPreview.schema);
            setHoverPreview(null);
          }}
          onCopyName={async (fqn) => {
            console.log('[SchemaTree] Copy FQN:', fqn);
            try {
              await navigator.clipboard.writeText(fqn);
              setCopiedToast(true);
              setTimeout(() => setCopiedToast(false), 2000);
            } catch (err) {
              console.error('Failed to copy:', err);
            }
            setHoverPreview(null);
          }}
          onClose={() => {
            console.log('[SchemaTree] Closing preview');
            setHoverPreview(null);
          }}
        />
      )}
      
      {/* Copy toast */}
      {copiedToast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2 bg-slate-900 text-white text-sm rounded-lg shadow-lg flex items-center gap-2 animate-fade-in-up">
          <Copy size={14} className="text-emerald-400" />
          <span>Copied to clipboard</span>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// EXPLORATION PANEL - Tabbed view for Current Cell + Lineage
// =============================================================================

function ExplorationPanel({ 
  results, 
  selectedColumn, 
  onSelectColumn,
  selectedRowData,
  activeTab = 'cell',
  onTabChange,
  onOpenLineagePanel,
  database,
  schema
}) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Determine if we have entity data (has GUID)
  const hasEntityData = selectedRowData && (selectedRowData.GUID || selectedRowData.guid);
  const entityGuid = selectedRowData?.GUID || selectedRowData?.guid;
  const entityName = selectedRowData?.NAME || selectedRowData?.name || 'Selected Entity';
  const entityType = selectedRowData?.TYPENAME || selectedRowData?.typename || 'Unknown';
  
  // Tab buttons
  const tabs = [
    { id: 'cell', label: 'Current Cell', icon: Columns },
    { id: 'lineage', label: 'Lineage', icon: GitBranch, disabled: !hasEntityData }
  ];
  
  return (
    <div className="flex flex-col h-full text-[13px]">
      {/* Tab Header */}
      <div className="flex items-center border-b border-gray-200 bg-white">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && onTabChange?.(tab.id)}
              disabled={tab.disabled}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                isActive 
                  ? 'border-blue-500 text-blue-600' 
                  : tab.disabled
                    ? 'border-transparent text-gray-300 cursor-not-allowed'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon size={12} />
              {tab.label}
            </button>
          );
        })}
      </div>
      
      {/* Tab Content */}
      {activeTab === 'lineage' && hasEntityData ? (
        <LineageTabContent
          entityGuid={entityGuid}
          entityName={entityName}
          entityType={entityType}
          rowData={selectedRowData}
          database={database}
          schema={schema}
          onOpenFullLineage={onOpenLineagePanel}
        />
      ) : (
        <ColumnDiagnosticsContent
          results={results}
          selectedColumn={selectedColumn}
          onSelectColumn={onSelectColumn}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />
      )}
    </div>
  );
}

// Lineage tab content - shows lineage for selected entity
function LineageTabContent({ entityGuid, entityName, entityType, rowData, database, schema, onOpenFullLineage }) {
  return (
    <div className="flex-1 overflow-auto p-3 space-y-3">
      {/* Entity header */}
      <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center">
            <Table2 size={14} className="text-blue-600" />
          </div>
          <div>
            <span className="font-medium text-blue-900">{entityName}</span>
            <span className="text-xs text-blue-600 ml-2">{entityType}</span>
          </div>
        </div>
        <div className="text-[10px] text-blue-600 font-mono truncate">{entityGuid}</div>
      </div>
      
      {/* Quick lineage actions */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-gray-700">Lineage Actions</h4>
        
        <button
          onClick={() => onOpenFullLineage?.(rowData)}
          className="w-full flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-lg hover:border-amber-300 hover:bg-amber-50 transition-colors group"
        >
          <GitBranch size={14} className="text-amber-600" />
          <div className="text-left flex-1">
            <div className="text-sm font-medium text-gray-700 group-hover:text-amber-700">View Full Lineage</div>
            <div className="text-xs text-gray-500">Open lineage panel with graph for {entityName}</div>
          </div>
        </button>
        
        <div className="p-2 bg-gray-50 rounded-lg text-xs text-gray-600 border border-gray-100">
          <div className="font-medium mb-1">Upstream Query</div>
          <code className="block text-[10px] bg-white p-2 rounded border font-mono overflow-x-auto whitespace-pre-wrap">
            {`SELECT DISTINCT p."NAME" FROM ${database}.${schema}.PROCESS_ENTITY p,
LATERAL FLATTEN(INPUT => p."OUTPUTS") f WHERE f.value::VARCHAR ILIKE '%${entityGuid}%'`}
          </code>
        </div>
        
        <div className="p-2 bg-gray-50 rounded-lg text-xs text-gray-600 border border-gray-100">
          <div className="font-medium mb-1">Downstream Query</div>
          <code className="block text-[10px] bg-white p-2 rounded border font-mono overflow-x-auto whitespace-pre-wrap">
            {`SELECT DISTINCT p."NAME" FROM ${database}.${schema}.PROCESS_ENTITY p,
LATERAL FLATTEN(INPUT => p."INPUTS") f WHERE f.value::VARCHAR ILIKE '%${entityGuid}%'`}
          </code>
        </div>
      </div>
      
      {/* Entity details */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-gray-700">Entity Details</h4>
        <div className="space-y-1 text-xs">
          {Object.entries(rowData || {}).slice(0, 6).map(([key, value]) => (
            <div key={key} className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500 truncate flex-shrink-0 mr-2">{key}</span>
              <span className="text-gray-700 truncate text-right font-mono" title={String(value)}>
                {value === null ? <span className="text-gray-300 italic">null</span> : String(value).slice(0, 30)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Column diagnostics content (original functionality)
function ColumnDiagnosticsContent({ results, selectedColumn, onSelectColumn, searchTerm, onSearchChange }) {
  
  const columns = useMemo(() => {
    if (!results?.columns) return [];
    return results.columns.map((name, idx) => ({
      name,
      type: results.columnTypes?.[idx] || 'unknown',
      index: idx
    }));
  }, [results]);
  
  const filteredColumns = useMemo(() => {
    if (!searchTerm) return columns;
    const term = searchTerm.toLowerCase();
    return columns.filter(col => col.name.toLowerCase().includes(term));
  }, [columns, searchTerm]);
  
  // Calculate basic stats for each column
  const columnStats = useMemo(() => {
    if (!results?.rows || results.rows.length === 0) return {};
    
    const stats = {};
    columns.forEach((col, idx) => {
      const values = results.rows.map(row => row[idx]);
      const nullCount = values.filter(v => v === null || v === undefined).length;
      const nonNullValues = values.filter(v => v !== null && v !== undefined);
      const distinctCount = new Set(nonNullValues.map(String)).size;
      
      stats[col.name] = {
        nullCount,
        nullPct: Math.round((nullCount / values.length) * 100),
        distinctCount,
        total: values.length
      };
    });
    return stats;
  }, [results, columns]);
  
  const getTypeIcon = (type) => {
    const t = (type || '').toLowerCase();
    if (t.includes('int') || t.includes('number') || t.includes('float') || t.includes('decimal')) {
      return <Hash size={12} className="text-blue-500" />;
    }
    if (t.includes('date') || t.includes('time')) {
      return <Calendar size={12} className="text-purple-500" />;
    }
    if (t.includes('bool')) {
      return <ToggleLeft size={12} className="text-green-500" />;
    }
    return <Type size={12} className="text-gray-500" />;
  };
  
  // Simple sparkline for numeric columns
  const Sparkline = ({ values, type }) => {
    if (!values || values.length === 0) return null;
    
    const numericValues = values
      .filter(v => v !== null && !isNaN(Number(v)))
      .map(Number)
      .slice(0, 50);
    
    if (numericValues.length < 3) {
      return <span className="text-[10px] text-gray-400">{values.length} values</span>;
    }
    
    const min = Math.min(...numericValues);
    const max = Math.max(...numericValues);
    const range = max - min || 1;
    
    // Create histogram buckets
    const bucketCount = 20;
    const buckets = new Array(bucketCount).fill(0);
    numericValues.forEach(v => {
      const idx = Math.min(bucketCount - 1, Math.floor(((v - min) / range) * bucketCount));
      buckets[idx]++;
    });
    const maxBucket = Math.max(...buckets);
    
    return (
      <svg viewBox={`0 0 ${bucketCount * 4} 16`} className="w-20 h-4">
        {buckets.map((count, i) => (
          <rect
            key={i}
            x={i * 4}
            y={16 - (count / maxBucket) * 14}
            width={3}
            height={(count / maxBucket) * 14}
            fill="#94a3b8"
            rx={0.5}
          />
        ))}
      </svg>
    );
  };
  
  if (!results) {
    return (
      <div className="flex flex-col h-full text-[13px]">
        <div className="flex-1 flex items-center justify-center text-gray-400 text-xs">
          Run a query to see column diagnostics
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full text-[13px]">
      {/* Row count header */}
      <div className="px-3 py-2 border-b border-gray-200 bg-slate-50/50">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>{results.rows?.length?.toLocaleString() || 0} Rows</span>
          <span>•</span>
          <span>{columns.length} Columns</span>
        </div>
      </div>
      
      {/* Search */}
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search columns..."
            value={searchTerm}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="w-full pl-7 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded focus:outline-none focus:border-blue-400"
          />
        </div>
      </div>
      
      {/* Column list */}
      <div className="flex-1 overflow-auto">
        {filteredColumns.map(col => {
          const stats = columnStats[col.name] || {};
          const isSelected = selectedColumn === col.name;
          const values = results.rows?.map(row => row[col.index]) || [];
          
          return (
            <div
              key={col.name}
              onClick={() => onSelectColumn?.(col.name)}
              className={`flex items-center justify-between px-3 py-2 cursor-pointer border-b border-gray-50 ${
                isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {getTypeIcon(col.type)}
                <span className={`truncate ${isSelected ? 'text-blue-700 font-medium' : 'text-gray-700'}`}>
                  {col.name}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Sparkline values={values} type={col.type} />
                {stats.nullPct > 0 && (
                  <span className="text-[10px] text-teal-600 font-medium tabular-nums">
                    {stats.nullPct}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Selected column details */}
      {selectedColumn && (
        <div className="border-t border-gray-200 p-3 bg-slate-50">
          <div className="flex items-center gap-2 mb-2">
            {getTypeIcon(columns.find(c => c.name === selectedColumn)?.type)}
            <span className="font-medium text-gray-800">{selectedColumn}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Rows</span>
              <span className="text-gray-700 tabular-nums">{columnStats[selectedColumn]?.total?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Null %</span>
              <span className="text-gray-700 tabular-nums">{columnStats[selectedColumn]?.nullPct || 0}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Distinct</span>
              <span className="text-gray-700 tabular-nums">{columnStats[selectedColumn]?.distinctCount?.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// DATABASE/SCHEMA SELECTOR COMPONENT
// =============================================================================

function ContextSelector({ 
  connectionStatus,
  selectedDatabase,
  selectedSchema,
  onDatabaseChange,
  onSchemaChange
}) {
  const [databases, setDatabases] = useState([]);
  const [schemas, setSchemas] = useState([]);
  const [showDbDropdown, setShowDbDropdown] = useState(false);
  const [showSchemaDropdown, setShowSchemaDropdown] = useState(false);
  const [loadingDbs, setLoadingDbs] = useState(false);
  const [loadingSchemas, setLoadingSchemas] = useState(false);
  
  const { fetchDatabases, fetchSchemas } = useMetadata();
  const dbDropdownRef = useRef(null);
  const schemaDropdownRef = useRef(null);
  
  // Load databases when dropdown opens
  const handleOpenDbDropdown = useCallback(async () => {
    if (!connectionStatus?.connected) return;
    
    setShowDbDropdown(true);
    setShowSchemaDropdown(false);
    
    if (databases.length === 0) {
      setLoadingDbs(true);
      try {
        const dbs = await fetchDatabases();
        setDatabases(dbs || []);
      } catch (e) {
        console.error('Failed to fetch databases:', e);
      } finally {
        setLoadingDbs(false);
      }
    }
  }, [connectionStatus?.connected, databases.length, fetchDatabases]);
  
  // Load schemas when dropdown opens or database changes
  const handleOpenSchemaDropdown = useCallback(async () => {
    if (!connectionStatus?.connected || !selectedDatabase) return;
    
    setShowSchemaDropdown(true);
    setShowDbDropdown(false);
    
    setLoadingSchemas(true);
    try {
      const schemaList = await fetchSchemas(selectedDatabase);
      setSchemas(schemaList || []);
    } catch (e) {
      console.error('Failed to fetch schemas:', e);
    } finally {
      setLoadingSchemas(false);
    }
  }, [connectionStatus?.connected, selectedDatabase, fetchSchemas]);
  
  // Handle database selection
  const handleSelectDatabase = useCallback((dbName) => {
    onDatabaseChange?.(dbName);
    setShowDbDropdown(false);
    // Clear schemas when database changes
    setSchemas([]);
  }, [onDatabaseChange]);
  
  // Handle schema selection
  const handleSelectSchema = useCallback((schemaName) => {
    onSchemaChange?.(schemaName);
    setShowSchemaDropdown(false);
  }, [onSchemaChange]);
  
  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dbDropdownRef.current && !dbDropdownRef.current.contains(e.target)) {
        setShowDbDropdown(false);
      }
      if (schemaDropdownRef.current && !schemaDropdownRef.current.contains(e.target)) {
        setShowSchemaDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const isConnected = connectionStatus?.connected;
  
  return (
    <div className="flex items-center gap-1">
      {/* Database Selector */}
      <div className="relative" ref={dbDropdownRef}>
        <button
          onClick={handleOpenDbDropdown}
          disabled={!isConnected}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-sm ${
            isConnected 
              ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer' 
              : 'bg-slate-50 text-slate-400 cursor-not-allowed'
          } ${showDbDropdown ? 'ring-2 ring-blue-400 ring-opacity-50' : ''}`}
        >
          <Database size={12} className="text-blue-500" />
          <span className="font-mono max-w-[120px] truncate">{selectedDatabase}</span>
          <ChevronDown size={12} className={`transition-transform ${showDbDropdown ? 'rotate-180' : ''}`} />
        </button>
        
        {showDbDropdown && (
          <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 z-50 py-2 max-h-64 overflow-auto">
            <div className="px-2 py-1.5 text-[10px] font-medium text-slate-400 uppercase tracking-wider border-b border-slate-100">
              Databases
            </div>
            {loadingDbs ? (
              <div className="px-3 py-4 text-center">
                <Loader2 size={16} className="animate-spin text-slate-400 mx-auto" />
              </div>
            ) : databases.length > 0 ? (
              databases.map((db) => (
                <button
                  key={db.name}
                  onClick={() => handleSelectDatabase(db.name)}
                  className={`w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 flex items-center gap-2 ${
                    selectedDatabase === db.name ? 'bg-blue-50 text-blue-700' : 'text-slate-700'
                  }`}
                >
                  <Database size={12} className={selectedDatabase === db.name ? 'text-blue-500' : 'text-slate-400'} />
                  <span className="truncate">{db.name}</span>
                  {selectedDatabase === db.name && <Check size={12} className="ml-auto text-blue-500" />}
                </button>
              ))
            ) : (
              <div className="px-3 py-3 text-sm text-slate-400 text-center">
                No databases found
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Schema Selector */}
      <div className="relative" ref={schemaDropdownRef}>
        <button
          onClick={handleOpenSchemaDropdown}
          disabled={!isConnected || !selectedDatabase}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-sm ${
            isConnected && selectedDatabase
              ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer' 
              : 'bg-slate-50 text-slate-400 cursor-not-allowed'
          } ${showSchemaDropdown ? 'ring-2 ring-blue-400 ring-opacity-50' : ''}`}
        >
          <Layers size={12} className="text-blue-500" />
          <span className="font-mono max-w-[100px] truncate">{selectedSchema}</span>
          <ChevronDown size={12} className={`transition-transform ${showSchemaDropdown ? 'rotate-180' : ''}`} />
        </button>
        
        {showSchemaDropdown && (
          <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 z-50 py-2 max-h-64 overflow-auto">
            <div className="px-2 py-1.5 text-[10px] font-medium text-slate-400 uppercase tracking-wider border-b border-slate-100">
              Schemas in {selectedDatabase}
            </div>
            {loadingSchemas ? (
              <div className="px-3 py-4 text-center">
                <Loader2 size={16} className="animate-spin text-slate-400 mx-auto" />
              </div>
            ) : schemas.length > 0 ? (
              schemas.map((schema) => (
                <button
                  key={schema.name}
                  onClick={() => handleSelectSchema(schema.name)}
                  className={`w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 flex items-center gap-2 ${
                    selectedSchema === schema.name ? 'bg-blue-50 text-blue-700' : 'text-slate-700'
                  }`}
                >
                  <Layers size={12} className={selectedSchema === schema.name ? 'text-blue-500' : 'text-slate-400'} />
                  <span className="truncate">{schema.name}</span>
                  {selectedSchema === schema.name && <Check size={12} className="ml-auto text-blue-500" />}
                </button>
              ))
            ) : (
              <div className="px-3 py-3 text-sm text-slate-400 text-center">
                No schemas found
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN QUERY EDITOR COMPONENT
// =============================================================================

export default function QueryEditor({
  initialQuery,
  onOpenConnectionModal,
  onOpenLineagePanel,
  onSelectEntity, // Callback when a row is selected - triggers EntityDetailPanel
  globalDatabase,
  globalSchema,
  onDatabaseChange,
  onSchemaChange,
  discoveredTables = new Set(), // Tables discovered from schema scan
  sampleEntities = null, // Sample entities with GUIDs
}) {
  // Connection & query hooks
  const { 
    status: connectionStatus, 
    connect, 
    disconnect, 
    loading: connectionLoading 
  } = useConnection();
  
  const connStatus = connectionStatus;
  
  const {
    executeQuery,
    results,
    loading: queryLoading,
    error: queryError,
    clearResults
  } = useQuery();
  
  const { fetchHistory, history } = useQueryHistory();
  const { fetchTables } = useMetadata();
  
  // Local state for database/schema if not controlled externally
  const [localDatabase, setLocalDatabase] = useState(null);
  const [localSchema, setLocalSchema] = useState(null);
  const STORAGE_KEY = 'query_editor_sql';
  const [loadedFromStorage, setLoadedFromStorage] = useState(false);
  
  // Generate default query based on discovered tables
  const getDefaultQuery = useCallback(() => {
    const db = globalDatabase || 'FIELD_METADATA';
    const schema = globalSchema || 'PUBLIC';
    
    // Find the best entity table to query
    const priorityTables = ['TABLE_ENTITY', 'PROCESS_ENTITY', 'COLUMN_ENTITY'];
    let targetTable = 'TABLE_ENTITY';
    
    if (discoveredTables?.size > 0) {
      for (const t of priorityTables) {
        if (discoveredTables.has(t)) {
          targetTable = t;
          break;
        }
      }
      // If no priority table found, use first discovered table
      if (!discoveredTables.has(targetTable)) {
        targetTable = [...discoveredTables][0];
      }
    }
    
    return `-- 🔍 Explore your most popular ${targetTable.replace('_ENTITY', '').toLowerCase()}s
-- Click "Tables" above to browse all discovered tables

SELECT 
    NAME,
    GUID,
    TYPENAME,
    STATUS,
    POPULARITYSCORE
FROM ${db}.${schema}.${targetTable}
WHERE NAME IS NOT NULL
ORDER BY POPULARITYSCORE DESC NULLS LAST
LIMIT 25;`;
  }, [globalDatabase, globalSchema, discoveredTables]);
  
  const [sql, setSql] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ?? (initialQuery || getDefaultQuery());
    } catch {
      return initialQuery || getDefaultQuery();
    }
  });
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      setLoadedFromStorage(!!saved);
    } catch {
      setLoadedFromStorage(false);
    }
  }, []);
  useEffect(() => {
    try {
      if (sql !== undefined) localStorage.setItem(STORAGE_KEY, sql);
    } catch {}
  }, [sql]);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [selectedColumn, setSelectedColumn] = useState(null);
  const [editorHeight, setEditorHeight] = useState(250);
  const [showHistory, setShowHistory] = useState(false);

  // Row selection for EntityDetailPanel
  const [selectedRowIndex, setSelectedRowIndex] = useState(null);
  const [selectedRowData, setSelectedRowData] = useState(null);

  // Query loaded animation state
  const [queryLoadedAnimation, setQueryLoadedAnimation] = useState(false);
  const [queryLoadedLabel, setQueryLoadedLabel] = useState('');

  // Typewriter effect state
  const [isTypewriting, setIsTypewriting] = useState(false);
  const typewriterRef = useRef(null);

  // Success checkmark state
  const [showSuccessCheckmark, setShowSuccessCheckmark] = useState(false);
  const [successGlow, setSuccessGlow] = useState(false);

  const editorRef = useRef(null);
  const prevQueryLoadingRef = useRef(false);
  const containerRef = useRef(null);
  
  // Use global db/schema, then local state, then connection defaults
  const selectedDatabase = globalDatabase || localDatabase || connStatus?.database || 'FIELD_METADATA';
  const selectedSchema = globalSchema || localSchema || connStatus?.schema || 'PUBLIC';
  
  // Handlers for database/schema changes
  const handleDatabaseChange = useCallback((db) => {
    if (onDatabaseChange) {
      onDatabaseChange(db);
    } else {
      setLocalDatabase(db);
      // Reset schema when database changes (if not externally controlled)
      if (!onSchemaChange) {
        setLocalSchema('PUBLIC');
      }
    }
  }, [onDatabaseChange, onSchemaChange]);
  
  const handleSchemaChange = useCallback((schema) => {
    if (onSchemaChange) {
      onSchemaChange(schema);
    } else {
      setLocalSchema(schema);
    }
  }, [onSchemaChange]);
  
  // Update SQL when initial query changes (with animation)
  const prevInitialQueryRef = useRef(initialQuery);
  useEffect(() => {
    if (initialQuery && initialQuery !== prevInitialQueryRef.current) {
      setSql(initialQuery);
      // Trigger animation when query is loaded from outside
      setQueryLoadedLabel('Query loaded');
      setQueryLoadedAnimation(true);
      setTimeout(() => {
        setQueryLoadedAnimation(false);
        setQueryLoadedLabel('');
      }, 2000);
      prevInitialQueryRef.current = initialQuery;
    }
  }, [initialQuery]);
  
  // Update default query when discovered tables change (only if using default)
  useEffect(() => {
    if (!initialQuery && discoveredTables?.size > 0 && !loadedFromStorage) {
      const defaultQuery = getDefaultQuery();
      // Only update if current SQL still has placeholders or is the old default
      if (sql.includes('{{TABLE}}') || sql.includes('{{DATABASE}}') || sql.includes('TABLE_ENTITY')) {
        setSql(defaultQuery);
      }
    }
  }, [discoveredTables, initialQuery, getDefaultQuery, loadedFromStorage, sql]);

  // Cleanup typewriter on unmount
  useEffect(() => {
    return () => {
      if (typewriterRef.current) {
        clearInterval(typewriterRef.current);
      }
    };
  }, []);

  // Handle editor mount
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    
    // Add keyboard shortcut
    editor.addAction({
      id: 'run-query',
      label: 'Run Query',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => handleExecute()
    });
  };
  
  // Execute query
  const handleExecute = useCallback(() => {
    if (!sql.trim() || !connectionStatus?.connected) return;
    
    executeQuery(sql, {
      database: selectedDatabase,
      schema: selectedSchema,
        warehouse: connStatus?.warehouse
      });
    
      fetchHistory();
    setSelectedColumn(null);
    // Clear row selection when executing new query
    setSelectedRowIndex(null);
    setSelectedRowData(null);
  }, [sql, connectionStatus, selectedDatabase, selectedSchema, connStatus, executeQuery, fetchHistory]);
  
  // Handle row selection in results table - triggers EntityDetailPanel in parent
  const handleRowSelect = useCallback((rowIndex, rowData) => {
    setSelectedRowIndex(rowIndex);
    setSelectedRowData(rowData);
    // Notify parent to show EntityDetailPanel
    if (onSelectEntity && rowData) {
      onSelectEntity({
        name: rowData.NAME || rowData.name,
        table: rowData.NAME || rowData.TABLENAME || rowData.name,
        entity: rowData.TYPENAME || rowData.typename || 'Table',
        entityType: rowData.TYPENAME || rowData.typename || 'Table',
        guid: rowData.GUID || rowData.guid,
        description: rowData.USERDESCRIPTION || rowData.DESCRIPTION || rowData.description,
        ...rowData
      });
    }
  }, [onSelectEntity]);
  
  // Insert table into editor using safe FQN builder
  const handleSelectTable = (tableName) => {
    // Use buildSafeFQN to create a properly escaped fully-qualified name
    const fullName = buildSafeFQN(selectedDatabase, selectedSchema, tableName);
    if (editorRef.current && fullName) {
      const editor = editorRef.current;
      const position = editor.getPosition();
      editor.executeEdits('insertTable', [{
        range: {
          startLineNumber: position.lineNumber,
          startColumn: position.column,
          endLineNumber: position.lineNumber,
          endColumn: position.column
        },
        text: fullName
      }]);
      editor.focus();
    }
  };
  
  // Trigger confetti celebration
  const triggerConfetti = useCallback((intensity = 'normal') => {
    const configs = {
      subtle: { particleCount: 30, spread: 50, origin: { y: 0.7 } },
      normal: { particleCount: 80, spread: 70, origin: { y: 0.6 } },
      party: {
        particleCount: 150,
        spread: 100,
        origin: { y: 0.5 },
        colors: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981']
      }
    };
    confetti(configs[intensity] || configs.normal);
  }, []);

  // Typewriter effect - animate SQL appearing character by character
  const typewriterEffect = useCallback((targetSql, onComplete) => {
    // Cancel any existing typewriter
    if (typewriterRef.current) {
      clearInterval(typewriterRef.current);
    }

    setIsTypewriting(true);
    setSql('');

    let index = 0;
    const speed = Math.max(5, Math.min(30, 1500 / targetSql.length)); // Adaptive speed

    typewriterRef.current = setInterval(() => {
      if (index < targetSql.length) {
        // Add characters in chunks for longer queries
        const chunkSize = targetSql.length > 500 ? 5 : targetSql.length > 200 ? 3 : 1;
        const nextIndex = Math.min(index + chunkSize, targetSql.length);
        setSql(targetSql.substring(0, nextIndex));
        index = nextIndex;
      } else {
        clearInterval(typewriterRef.current);
        typewriterRef.current = null;
        setIsTypewriting(false);
        if (onComplete) onComplete();
      }
    }, speed);
  }, []);

  // Trigger success checkmark animation
  const triggerSuccessAnimation = useCallback((withConfetti = false) => {
    setShowSuccessCheckmark(true);
    setSuccessGlow(true);

    if (withConfetti) {
      triggerConfetti('subtle');
    }

    setTimeout(() => {
      setShowSuccessCheckmark(false);
    }, 2500);

    setTimeout(() => {
      setSuccessGlow(false);
    }, 1500);
  }, [triggerConfetti]);

  // Track previous loading state to detect query completion
  useEffect(() => {
    // Query just completed (was loading, now not loading)
    if (prevQueryLoadingRef.current && !queryLoading) {
      if (results?.rows?.length > 0 && !queryError) {
        // Success! Show checkmark and maybe confetti for large results
        const rowCount = results.rows.length;
        triggerSuccessAnimation(rowCount > 50); // Confetti for bigger results
      }
    }
    prevQueryLoadingRef.current = queryLoading;
  }, [queryLoading, results, queryError, triggerSuccessAnimation]);

  // Trigger query loaded animation
  const triggerQueryLoadedAnimation = useCallback((label = 'Query loaded') => {
    setQueryLoadedLabel(label);
    setQueryLoadedAnimation(true);
    // Clear animation after it completes
    setTimeout(() => {
      setQueryLoadedAnimation(false);
      setQueryLoadedLabel('');
    }, 2000);
  }, []);

  // Load query with animation (typewriter + confetti for special queries)
  const loadQueryWithAnimation = useCallback((newSql, label = 'Query loaded', options = {}) => {
    const { useTypewriter = true, celebrate = false } = options;

    // Determine if this is a "special" query worth celebrating
    const isSpecialQuery = celebrate ||
      label.toLowerCase().includes('lineage') ||
      label.toLowerCase().includes('popular') ||
      label.toLowerCase().includes('insight');

    if (useTypewriter && newSql.length < 800) {
      // Use typewriter for shorter queries
      typewriterEffect(newSql, () => {
        triggerQueryLoadedAnimation(label);
        if (isSpecialQuery) {
          triggerConfetti('subtle');
        }
        editorRef.current?.focus();
      });
    } else {
      // Direct set for longer queries
      setSql(newSql);
      triggerQueryLoadedAnimation(label);
      if (isSpecialQuery) {
        triggerConfetti('subtle');
      }
      editorRef.current?.focus();
    }
  }, [triggerQueryLoadedAnimation, typewriterEffect, triggerConfetti]);

  // Load query from history
  const handleSelectHistoryQuery = (query) => {
    loadQueryWithAnimation(query, 'History loaded');
    setShowHistory(false);
  };
  
  return (
    <div 
      ref={containerRef}
      data-testid="query-editor"
      className="flex h-[calc(100vh-200px)] min-h-[600px] bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-lg"
    >
      {/* Left Panel - Schema Explorer */}
      {showLeftPanel && (
        <ResizablePanel
          direction="horizontal"
          initialSize={240}
          minSize={180}
          maxSize={400}
          className="border-r border-gray-200 bg-slate-50"
        >
          <SchemaTree
            database={selectedDatabase}
            schema={selectedSchema}
            onSelectTable={handleSelectTable}
            onDatabaseChange={handleDatabaseChange}
            onSchemaChange={handleSchemaChange}
            onRunQuery={(query, db, sch) => {
              console.log('[QueryEditor] Running preview query:', query);
              setSql(query);
              executeQuery(query, {
                database: db || selectedDatabase,
                schema: sch || selectedSchema,
                warehouse: connStatus?.warehouse
              });
            }}
            connectionStatus={connectionStatus}
          />
        </ResizablePanel>
      )}
      
      {/* Center Panel - Editor + Results */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Toolbar */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-2">
          <button
            onClick={handleExecute}
            disabled={queryLoading || !sql.trim() || !connectionStatus?.connected}
            data-testid="query-editor-run"
              className="flex items-center gap-1.5 px-4 py-1.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {queryLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
                <Play size={14} />
            )}
              Run
          </button>
          
            <div className="h-5 w-px bg-gray-200 mx-1" />
            
            <ContextSelector
              connectionStatus={connectionStatus}
              selectedDatabase={selectedDatabase}
              selectedSchema={selectedSchema}
              onDatabaseChange={handleDatabaseChange}
              onSchemaChange={handleSchemaChange}
            />
            
            <div className="h-5 w-px bg-slate-200 mx-1" />
            
            {/* Query Suggestions - Atlan style dropdown */}
            <QuerySuggestionsDropdown
              database={selectedDatabase}
              schema={selectedSchema}
              discoveredTables={discoveredTables}
              sampleEntities={sampleEntities}
              onSelectQuery={(newSql, queryMeta) => {
                loadQueryWithAnimation(newSql, queryMeta?.label || 'Query loaded');
              }}
              disabled={!connectionStatus?.connected}
            />
            
            {/* Table Selector - Quick insert FQN */}
            <TableSelector
              database={selectedDatabase}
              schema={selectedSchema}
              discoveredTables={discoveredTables}
              onInsertTable={(fqn, tableName) => {
                if (editorRef.current) {
                  const editor = editorRef.current;
                  const position = editor.getPosition();
                  editor.executeEdits('insertTable', [{
                    range: {
                      startLineNumber: position.lineNumber,
                      startColumn: position.column,
                      endLineNumber: position.lineNumber,
                      endColumn: position.column
                    },
                    text: fqn
                  }]);
                  editor.focus();
                }
              }}
              disabled={!connectionStatus?.connected}
            />
          </div>
          
          <div className="flex items-center gap-1">
            {/* Format SQL Button */}
            <button
              onClick={() => {
                try {
                  const formatted = formatSQL(sql, {
                    language: 'snowflake',
                    tabWidth: 2,
                    keywordCase: 'upper',
                    linesBetweenQueries: 2
                  });
                  setSql(formatted);
                } catch (err) {
                  log.warn('SQL formatting failed:', err.message);
                }
              }}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600"
              title="Format SQL (beautify)"
            >
              <AlignLeft size={16} />
            </button>

            {/* Clear Editor Button */}
            <button
              onClick={() => {
                if (sql.trim() && window.confirm('Clear the editor?')) {
                  try { localStorage.removeItem(STORAGE_KEY); } catch {}
                  setSql('');
                }
              }}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500"
              title="Clear editor"
            >
              <Trash2 size={16} />
            </button>

            <div className="h-4 w-px bg-slate-200 mx-0.5" />

            <button
              onClick={() => setShowLeftPanel(!showLeftPanel)}
              className={`p-1.5 rounded hover:bg-gray-100 ${showLeftPanel ? 'text-blue-600' : 'text-gray-400'}`}
              title="Toggle schema browser"
            >
              <PanelLeft size={16} />
            </button>
            {onOpenLineagePanel && (
              <button
                onClick={onOpenLineagePanel}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-amber-600"
                title="View lineage panel"
              >
                <GitBranch size={16} />
              </button>
            )}
            <button
              onClick={() => {
                setShowHistory(!showHistory);
                if (!showHistory) fetchHistory();
              }}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
              title="Query history"
            >
              <History size={16} />
            </button>
          </div>
        </div>
        
        {/* Editor */}
        <ResizablePanel
          direction="vertical"
          initialSize={editorHeight}
          minSize={100}
          maxSize={500}
          onResize={setEditorHeight}
          className={`border-b border-gray-200 relative ${queryLoadedAnimation ? 'animate-query-loaded' : ''} ${queryLoading ? 'query-running' : ''}`}
        >
          {/* Query Loaded Badge */}
          {queryLoadedAnimation && (
            <div className="query-loaded-indicator animate-query-badge">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-500 text-white text-xs font-medium rounded-lg shadow-lg">
                <Sparkles size={12} className="animate-sparkle" />
                <span>{queryLoadedLabel}</span>
              </div>
            </div>
          )}
            <LazyMonacoEditor
              height="100%"
              language="sql"
              value={sql}
              onChange={setSql}
              onMount={handleEditorDidMount}
              theme="vs"
              options={{
                fontSize: 13,
                fontFamily: "'SF Mono', 'Monaco', 'Consolas', monospace",
                lineNumbers: 'on',
                padding: { top: 8, bottom: 8 },
                lineHeight: 20,
                renderLineHighlight: 'line',
                glyphMargin: false,
                lineDecorationsWidth: 8,
                lineNumbersMinChars: 3,
              }}
            />
        </ResizablePanel>
          
          {/* Results */}
        <div
          className={`flex-1 overflow-hidden flex flex-col relative ${successGlow ? 'animate-success-glow' : ''}`}
          data-testid="query-results"
        >
          {/* Success Checkmark Overlay */}
          {showSuccessCheckmark && (
            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
              <div className="success-checkmark-container">
                <svg className="w-20 h-20" viewBox="0 0 52 52">
                  <circle className="success-checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
                  <path className="success-checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                </svg>
              </div>
            </div>
          )}

          {/* Results header */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-b border-gray-100 text-xs text-gray-500">
            <span className="flex items-center gap-2">
              Query results
              {isTypewriting && (
                <span className="text-blue-500 flex items-center gap-1">
                  <Sparkles size={10} className="animate-pulse" />
                  typing...
                </span>
              )}
            </span>
            {results?.rows && (
              <div className="flex items-center gap-3">
                <span className="tabular-nums">{results.rows.length.toLocaleString()} Rows</span>
                <button className="p-1 hover:bg-gray-200 rounded" title="Filter">
                  <Filter size={12} />
                </button>
                <button className="p-1 hover:bg-gray-200 rounded" title="Copy">
                  <Copy size={12} />
                </button>
              </div>
            )}
          </div>

          {/* Results table */}
          <div className="flex-1 overflow-auto">
            {queryLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 size={24} className="animate-spin text-gray-400" />
              </div>
            ) : queryError ? (
              <div className="p-4 text-red-600 text-sm">
                <AlertTriangle size={16} className="inline mr-2" />
                {queryError}
              </div>
            ) : results?.rows ? (
              <table className="w-full text-[13px]" data-testid="query-results-table">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    {results.columns?.map((col, i) => (
                      <th 
                        key={col}
                        onClick={() => setSelectedColumn(col)}
                        className={`px-3 py-2 text-left font-medium border-b border-r border-gray-200 cursor-pointer hover:bg-slate-100 ${
                          selectedColumn === col ? 'bg-blue-50 text-blue-700' : 'text-gray-600'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-gray-400 font-mono">
                            {results.columnTypes?.[i]?.includes('INT') || results.columnTypes?.[i]?.includes('NUMBER') ? '123' : 'T'}
                          </span>
                          <span className="truncate">{col}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.rows.slice(0, 1000).map((row, rowIdx) => {
                    // Build row data object for selection
                    const rowData = {};
                    results.columns?.forEach((col, i) => {
                      rowData[col] = row[i];
                    });
                    const isRowSelected = selectedRowIndex === rowIdx;
                    
                    return (
                      <tr 
                        key={rowIdx} 
                        onClick={() => handleRowSelect(rowIdx, rowData)}
                        className={`cursor-pointer transition-colors ${
                          isRowSelected 
                            ? 'bg-blue-100 hover:bg-blue-100' 
                            : rowIdx % 2 === 0 
                              ? 'bg-white hover:bg-blue-50/50' 
                              : 'bg-slate-50/50 hover:bg-blue-50/50'
                        }`}
                      >
                        {row.map((cell, cellIdx) => (
                          <td 
                            key={cellIdx}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedColumn(results.columns[cellIdx]);
                              handleRowSelect(rowIdx, rowData);
                            }}
                            className={`px-3 py-1.5 border-b border-r border-gray-100 truncate max-w-[300px] ${
                              selectedColumn === results.columns[cellIdx] ? 'bg-blue-50/50' : ''
                            }`}
                          >
                            {cell === null ? (
                              <span className="text-gray-300 italic">null</span>
                            ) : (
                              String(cell)
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                Run a query to see results
              </div>
            )}
          </div>
        </div>
      </div>

      {/* History dropdown */}
      {showHistory && (
        <div className="absolute top-12 right-4 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-auto">
          <div className="px-3 py-2 border-b border-gray-100 font-medium text-sm text-gray-700">
            Query History
            </div>
          {history?.length > 0 ? (
            history.slice(0, 20).map((item, i) => (
              <div
                key={i}
                onClick={() => handleSelectHistoryQuery(item.query || item)}
                className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-50"
              >
                <div className="text-xs text-gray-500 mb-1">
                  {item.timestamp ? new Date(item.timestamp).toLocaleString() : `Query ${i + 1}`}
          </div>
                <div className="text-sm text-gray-700 font-mono truncate">
                  {(item.query || item).substring(0, 100)}...
        </div>
      </div>
            ))
          ) : (
            <div className="px-3 py-4 text-center text-gray-400 text-sm">
              No history yet
            </div>
          )}
        </div>
      )}
    </div>
  );
}
