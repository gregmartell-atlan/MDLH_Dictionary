/**
 * SchemaDiscoveryPanel
 * 
 * A comprehensive multi-level filtering component for exploring MDLH structure.
 * Provides hierarchical navigation: Connection → Database → Schema → Table → Column
 * 
 * Features:
 * - Multi-level drill-down
 * - MDLH table detection
 * - Column type indicators
 * - Hierarchy-based filtering (connection, domain, asset type)
 * - Search/filter within each level
 * - Collapsible sections
 * - Selection state management
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Database,
  Layers,
  Table2,
  Columns3,
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  RefreshCw,
  Check,
  X,
  Plus,
  Minus,
  AlertCircle,
  Sparkles,
  Link2,
  Tags,
  FileText,
  Hash,
  Calendar,
  ToggleLeft,
  List,
  HelpCircle,
  Eye,
  EyeOff,
  Settings2,
} from 'lucide-react';
import { useMetadata, useConnection } from '../../hooks/useSnowflake';

// =============================================================================
// MDLH TABLE PATTERNS
// =============================================================================

const MDLH_CATEGORIES = {
  asset: {
    label: 'Asset Tables',
    icon: Database,
    color: 'text-blue-600 bg-blue-100',
    patterns: ['ASSETS', 'ASSET', 'GOLD_ASSETS', 'ALL_ASSETS', 'TABLE_ENTITY'],
  },
  lineage: {
    label: 'Lineage Tables',
    icon: Link2,
    color: 'text-amber-600 bg-amber-100',
    patterns: ['LINEAGE', 'RELATIONSHIPS', 'ASSET_LINKS', 'ENTITY_RELATIONSHIPS', 'PROCESSES'],
  },
  classification: {
    label: 'Classification Tables',
    icon: Tags,
    color: 'text-purple-600 bg-purple-100',
    patterns: ['CLASSIFICATIONS', 'TAGS', 'ASSET_TAGS', 'CLASSIFICATIONNAMES'],
  },
  glossary: {
    label: 'Glossary Tables',
    icon: FileText,
    color: 'text-emerald-600 bg-emerald-100',
    patterns: ['GLOSSARY', 'TERMS', 'GLOSSARY_TERMS', 'MEANINGS'],
  },
  quality: {
    label: 'Quality Tables',
    icon: Sparkles,
    color: 'text-cyan-600 bg-cyan-100',
    patterns: ['QUALITY', 'DQ_RESULTS', 'ANOMALO', 'SODA', 'CHECKS'],
  },
};

/**
 * Detect MDLH category for a table name
 */
function detectMdlhCategory(tableName) {
  const upper = tableName.toUpperCase();
  
  for (const [category, config] of Object.entries(MDLH_CATEGORIES)) {
    if (config.patterns.some(p => upper === p || upper.includes(p))) {
      return { category, ...config };
    }
  }
  
  return null;
}

// =============================================================================
// COLUMN TYPE ICONS
// =============================================================================

const COLUMN_TYPE_CONFIG = {
  array: { icon: List, label: 'Array', color: 'text-purple-500' },
  boolean: { icon: ToggleLeft, label: 'Boolean', color: 'text-blue-500' },
  number: { icon: Hash, label: 'Number', color: 'text-amber-500' },
  timestamp: { icon: Calendar, label: 'Timestamp', color: 'text-emerald-500' },
  string: { icon: FileText, label: 'String', color: 'text-slate-500' },
  variant: { icon: HelpCircle, label: 'Variant', color: 'text-pink-500' },
};

function getColumnTypeConfig(dataType) {
  const upper = (dataType || '').toUpperCase();
  
  if (upper.includes('ARRAY')) return COLUMN_TYPE_CONFIG.array;
  if (upper.includes('BOOLEAN')) return COLUMN_TYPE_CONFIG.boolean;
  if (upper.includes('NUMBER') || upper.includes('INT') || upper.includes('FLOAT') || upper.includes('DECIMAL')) {
    return COLUMN_TYPE_CONFIG.number;
  }
  if (upper.includes('TIMESTAMP') || upper.includes('DATE') || upper.includes('TIME')) {
    return COLUMN_TYPE_CONFIG.timestamp;
  }
  if (upper.includes('VARIANT') || upper.includes('OBJECT')) return COLUMN_TYPE_CONFIG.variant;
  
  return COLUMN_TYPE_CONFIG.string;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function SearchInput({ value, onChange, placeholder }) {
  return (
    <div className="relative">
      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg 
                   focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

function MdlhBadge({ category }) {
  if (!category) return null;
  
  const CategoryIcon = category.icon;
  
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${category.color}`}>
      <CategoryIcon size={10} />
      {category.label.replace(' Tables', '')}
    </span>
  );
}

function ColumnTypeIcon({ dataType }) {
  const config = getColumnTypeConfig(dataType);
  const Icon = config.icon;
  
  return (
    <span title={`${config.label}: ${dataType}`}>
      <Icon size={14} className={config.color} />
    </span>
  );
}

function TreeNode({
  icon: Icon,
  label,
  badge,
  isExpanded,
  isSelected,
  isLoading,
  onToggleExpand,
  onSelect,
  children,
  depth = 0,
  selectable = true,
}) {
  const hasChildren = React.Children.count(children) > 0 || isLoading;
  
  return (
    <div>
      <div
        className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer transition-colors rounded-md ${
          isSelected ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={(e) => {
          e.stopPropagation();
          if (selectable) {
            onSelect?.();
          }
          if (hasChildren) {
            onToggleExpand?.();
          }
        }}
      >
        {/* Expand/collapse icon */}
        {hasChildren && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleExpand?.(); }}
            className="p-0.5"
          >
            {isLoading ? (
              <RefreshCw size={12} className="animate-spin text-slate-400" />
            ) : isExpanded ? (
              <ChevronDown size={12} className="text-slate-400" />
            ) : (
              <ChevronRight size={12} className="text-slate-400" />
            )}
          </button>
        )}
        
        {/* Node icon */}
        <Icon size={14} className={isSelected ? 'text-indigo-600' : 'text-slate-400'} />
        
        {/* Label */}
        <span className={`flex-1 text-sm truncate ${isSelected ? 'font-medium' : ''}`}>
          {label}
        </span>
        
        {/* Badge */}
        {badge}
        
        {/* Selection indicator */}
        {isSelected && (
          <Check size={14} className="text-indigo-600" />
        )}
      </div>
      
      {/* Children */}
      {isExpanded && children && (
        <div className="ml-2">
          {children}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function SchemaDiscoveryPanel({
  // Selection state
  selection = {},
  onSelectionChange,
  
  // Mode
  mode = 'table', // 'database' | 'schema' | 'table' | 'column'
  multiSelect = false,
  
  // Filters
  showOnlyMdlh = true,
  showColumns = false,
  
  // Display
  maxHeight = '500px',
  compact = false,
  title = 'Schema Explorer',
}) {
  const { status: connectionStatus } = useConnection();
  const { fetchDatabases, fetchSchemas, fetchTables, loading: metadataLoading } = useMetadata(connectionStatus);
  
  const isConnected = connectionStatus?.connected === true;
  
  // ==========================================================================
  // STATE
  // ==========================================================================
  
  const [databases, setDatabases] = useState([]);
  const [schemasMap, setSchemasMap] = useState({}); // { dbName: schemas[] }
  const [tablesMap, setTablesMap] = useState({});   // { dbName.schemaName: tables[] }
  const [columnsMap, setColumnsMap] = useState({}); // { dbName.schemaName.tableName: columns[] }
  
  const [expanded, setExpanded] = useState(new Set());
  const [loadingSchemas, setLoadingSchemas] = useState(new Set());
  const [loadingTables, setLoadingTables] = useState(new Set());
  const [loadingColumns, setLoadingColumns] = useState(new Set());
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showMdlhOnly, setShowMdlhOnly] = useState(showOnlyMdlh);
  const [showColumnDetails, setShowColumnDetails] = useState(showColumns);
  
  const [error, setError] = useState(null);
  
  // ==========================================================================
  // DATA LOADING
  // ==========================================================================
  
  // Load databases on mount
  useEffect(() => {
    if (isConnected && databases.length === 0) {
      setError(null);
      fetchDatabases()
        .then((dbs) => {
          const dbList = (Array.isArray(dbs) ? dbs : []).map(d => 
            typeof d === 'string' ? { name: d } : d
          ).filter(d => d.name);
          setDatabases(dbList);
        })
        .catch((err) => {
          setError('Failed to load databases');
          console.error('[SchemaDiscoveryPanel] Error loading databases:', err);
        });
    }
  }, [isConnected, fetchDatabases]);
  
  // Load schemas for a database
  const loadSchemas = useCallback(async (dbName) => {
    if (schemasMap[dbName] || loadingSchemas.has(dbName)) return;
    
    setLoadingSchemas(prev => new Set(prev).add(dbName));
    
    try {
      const schemas = await fetchSchemas(dbName);
      const schemaList = (Array.isArray(schemas) ? schemas : []).map(s =>
        typeof s === 'string' ? { name: s } : s
      ).filter(s => s.name && s.name.toUpperCase() !== 'INFORMATION_SCHEMA');
      
      setSchemasMap(prev => ({ ...prev, [dbName]: schemaList }));
    } catch (err) {
      console.error(`[SchemaDiscoveryPanel] Error loading schemas for ${dbName}:`, err);
    } finally {
      setLoadingSchemas(prev => {
        const next = new Set(prev);
        next.delete(dbName);
        return next;
      });
    }
  }, [fetchSchemas, schemasMap, loadingSchemas]);
  
  // Load tables for a schema
  const loadTables = useCallback(async (dbName, schemaName) => {
    const key = `${dbName}.${schemaName}`;
    if (tablesMap[key] || loadingTables.has(key)) return;
    
    setLoadingTables(prev => new Set(prev).add(key));
    
    try {
      const tables = await fetchTables(dbName, schemaName);
      const tableList = (Array.isArray(tables) ? tables : []).map(t =>
        typeof t === 'string' ? { name: t } : t
      ).filter(t => t.name);
      
      // Enhance with MDLH category
      const enhanced = tableList.map(t => ({
        ...t,
        mdlhCategory: detectMdlhCategory(t.name),
      }));
      
      setTablesMap(prev => ({ ...prev, [key]: enhanced }));
    } catch (err) {
      console.error(`[SchemaDiscoveryPanel] Error loading tables for ${key}:`, err);
    } finally {
      setLoadingTables(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, [fetchTables, tablesMap, loadingTables]);
  
  // ==========================================================================
  // EXPANSION
  // ==========================================================================
  
  const toggleExpand = useCallback((key, loadFn) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        // Trigger load if provided
        if (loadFn) loadFn();
      }
      return next;
    });
  }, []);
  
  // ==========================================================================
  // SELECTION
  // ==========================================================================
  
  const handleSelect = useCallback((level, value) => {
    let newSelection = { ...selection };
    
    switch (level) {
      case 'database':
        newSelection = { database: value };
        break;
      case 'schema':
        newSelection = { database: selection.database, schema: value };
        break;
      case 'table':
        newSelection = { database: selection.database, schema: selection.schema, table: value };
        break;
      case 'column':
        newSelection = { ...selection, column: value };
        break;
    }
    
    onSelectionChange?.(newSelection);
  }, [selection, onSelectionChange]);
  
  // ==========================================================================
  // FILTERING
  // ==========================================================================
  
  const filteredDatabases = useMemo(() => {
    if (!searchTerm) return databases;
    const term = searchTerm.toLowerCase();
    return databases.filter(db => db.name.toLowerCase().includes(term));
  }, [databases, searchTerm]);
  
  const filterTables = useCallback((tables) => {
    if (!tables) return [];
    
    let filtered = tables;
    
    if (showMdlhOnly) {
      filtered = filtered.filter(t => t.mdlhCategory);
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(t => t.name.toLowerCase().includes(term));
    }
    
    return filtered;
  }, [showMdlhOnly, searchTerm]);
  
  // ==========================================================================
  // RENDER
  // ==========================================================================
  
  if (!isConnected) {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-center gap-3">
          <AlertCircle className="text-amber-600" size={20} />
          <div>
            <h4 className="font-medium text-amber-800">Connection Required</h4>
            <p className="text-sm text-amber-700">
              Connect to Snowflake to browse the schema.
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
          <Layers size={18} className="text-slate-500" />
          <h3 className="font-medium text-slate-700">{title}</h3>
        </div>
        
        <div className="flex items-center gap-2">
          {/* MDLH filter toggle */}
          <button
            onClick={() => setShowMdlhOnly(!showMdlhOnly)}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
              showMdlhOnly
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
            title={showMdlhOnly ? 'Showing MDLH tables only' : 'Showing all tables'}
          >
            {showMdlhOnly ? <Eye size={12} /> : <EyeOff size={12} />}
            MDLH Only
          </button>
          
          {/* Refresh */}
          <button
            onClick={() => {
              setDatabases([]);
              setSchemasMap({});
              setTablesMap({});
              setExpanded(new Set());
            }}
            disabled={metadataLoading}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} className={metadataLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
      
      {/* Search */}
      <div className="px-4 py-2 border-b border-slate-100">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search databases, schemas, tables..."
        />
      </div>
      
      {/* Error */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border-b border-red-100 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
      
      {/* Tree */}
      <div 
        className="overflow-y-auto p-2"
        style={{ maxHeight }}
      >
        {databases.length === 0 && !metadataLoading ? (
          <div className="text-center py-8 text-slate-400">
            No databases available
          </div>
        ) : metadataLoading && databases.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-8 text-slate-500">
            <RefreshCw size={16} className="animate-spin" />
            <span>Loading databases...</span>
          </div>
        ) : (
          filteredDatabases.map(db => {
            const dbKey = db.name;
            const isDbExpanded = expanded.has(dbKey);
            const isDbSelected = selection.database === db.name && !selection.schema;
            const schemas = schemasMap[db.name] || [];
            
            return (
              <TreeNode
                key={dbKey}
                icon={Database}
                label={db.name}
                isExpanded={isDbExpanded}
                isSelected={isDbSelected}
                isLoading={loadingSchemas.has(db.name)}
                onToggleExpand={() => toggleExpand(dbKey, () => loadSchemas(db.name))}
                onSelect={() => handleSelect('database', db.name)}
                depth={0}
                selectable={mode === 'database'}
              >
                {isDbExpanded && schemas.map(schema => {
                  const schemaKey = `${db.name}.${schema.name}`;
                  const isSchemaExpanded = expanded.has(schemaKey);
                  const isSchemaSelected = selection.database === db.name && selection.schema === schema.name && !selection.table;
                  const tables = tablesMap[schemaKey] || [];
                  const filteredTableList = filterTables(tables);
                  const mdlhCount = filteredTableList.filter(t => t.mdlhCategory).length;
                  
                  return (
                    <TreeNode
                      key={schemaKey}
                      icon={Layers}
                      label={schema.name}
                      badge={mdlhCount > 0 ? (
                        <span className="text-[10px] text-indigo-600 font-medium">
                          {mdlhCount} MDLH
                        </span>
                      ) : null}
                      isExpanded={isSchemaExpanded}
                      isSelected={isSchemaSelected}
                      isLoading={loadingTables.has(schemaKey)}
                      onToggleExpand={() => toggleExpand(schemaKey, () => loadTables(db.name, schema.name))}
                      onSelect={() => handleSelect('schema', schema.name)}
                      depth={1}
                      selectable={mode === 'schema' || mode === 'database'}
                    >
                      {isSchemaExpanded && filteredTableList.map(table => {
                        const tableKey = `${schemaKey}.${table.name}`;
                        const isTableSelected = selection.database === db.name && 
                                                selection.schema === schema.name && 
                                                selection.table === table.name;
                        
                        return (
                          <TreeNode
                            key={tableKey}
                            icon={Table2}
                            label={table.name}
                            badge={<MdlhBadge category={table.mdlhCategory} />}
                            isExpanded={false}
                            isSelected={isTableSelected}
                            onSelect={() => handleSelect('table', table.name)}
                            depth={2}
                            selectable={mode === 'table' || mode === 'column'}
                          />
                        );
                      })}
                      
                      {isSchemaExpanded && filteredTableList.length === 0 && !loadingTables.has(schemaKey) && (
                        <div className="text-xs text-slate-400 pl-10 py-2">
                          {showMdlhOnly ? 'No MDLH tables found' : 'No tables found'}
                        </div>
                      )}
                    </TreeNode>
                  );
                })}
              </TreeNode>
            );
          })
        )}
      </div>
      
      {/* Selection summary */}
      {(selection.database || selection.schema || selection.table) && (
        <div className="px-4 py-2 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Selected:</span>
            <span className="font-medium text-indigo-600">
              {[selection.database, selection.schema, selection.table].filter(Boolean).join('.')}
            </span>
            <button
              onClick={() => onSelectionChange?.({})}
              className="ml-auto text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SchemaDiscoveryPanel;
