import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Download, Copy, Check, Code2, X, Search, Command, Play, Loader2, Sparkles, Eye, FlaskConical, ArrowLeft, Database, Snowflake, Settings, Wifi, WifiOff, ChevronDown, Zap, Layers } from 'lucide-react';
import QueryEditor from './components/QueryEditor';
import ShowMyWork from './components/ShowMyWork';
import FlyoutQueryEditor from './components/FlyoutQueryEditor';
import ConnectionModal from './components/ConnectionModal';
import QueryPanelShell from './components/QueryPanelShell';
import TestQueryLayout from './components/TestQueryLayout';
import QueryLibraryLayout from './components/QueryLibraryLayout';
import RecommendedQueries from './components/RecommendedQueries';
import { useConnection, useSampleEntities } from './hooks/useSnowflake';
import { createLogger } from './utils/logger';
import { SystemConfigProvider } from './context/SystemConfigContext';
import { useBackendInstanceGuard } from './hooks/useBackendInstanceGuard';

// Scoped loggers for App
const appLog = createLogger('App');
const uiLog = createLogger('UI');

// Import data and utilities from extracted modules
import { entities as data } from './data/entities';
import { exampleQueries as staticExampleQueries, mergedExampleQueries as staticMergedQueries } from './data/exampleQueries';
import { 
  transformExampleQueries, 
  filterQueriesByAvailability,
  validateQueryTables,
  getSuggestedAlternatives 
} from './utils/dynamicExampleQueries';
import { 
  tabs, 
  MDLH_DATABASES, 
  MDLH_SCHEMAS, 
  columns, 
  colHeaders,
  selectDropdownStyles,
  DEFAULT_DATABASE,
  DEFAULT_SCHEMA
} from './data/constants';
import {
  discoverMDLHTables,
  findAlternativeTable,
  fixQueryForAvailableTables,
  tableExists,
  extractTableFromQuery,
  getEntityTablesForCategory,
  fetchTableColumns
} from './utils/tableDiscovery';
import { preValidateAllQueries } from './utils/queryHelpers';

// API base URL for backend calls
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Note: tabs, data, exampleQueries, columns, colHeaders, MDLH_DATABASES, MDLH_SCHEMAS 
// are now imported from ./data/* modules

// Legacy local definitions removed - now using imports from data modules
// See: src/data/entities.js, src/data/exampleQueries.js, src/data/constants.js

// ---------------------------------------------------------------------------
// COMPONENT DEFINITIONS START HERE  
// ---------------------------------------------------------------------------

// Atlan Logo Icon
function AtlanIcon({ size = 24, className = "" }) {
  return (
    <svg 
      viewBox="0 0 32 32" 
      width={size} 
      height={size} 
      className={className}
    >
      {/* Atlan "A" logomark */}
      <defs>
        <linearGradient id="atlan-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3366FF" />
          <stop offset="100%" stopColor="#5B8DEF" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="6" fill="url(#atlan-gradient)" />
      <path 
        d="M16 6L8 26h4l1.5-4h5l1.5 4h4L16 6zm0 6l2 6h-4l2-6z" 
        fill="white"
      />
    </svg>
  );
}

// Global connection status indicator for header
function ConnectionIndicator({ status, loading, onClick, database, schema }) {
  const isConnected = status?.connected;
  const isUnreachable = status?.unreachable;
  
  // Determine visual state (4 states now)
  const getState = () => {
    if (isUnreachable) return 'unreachable';
    if (loading) return 'connecting';
    if (isConnected) return 'connected';
    return 'disconnected';
  };
  const state = getState();
  
  const stateStyles = {
    disconnected: 'bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:bg-blue-50',
    connecting: 'bg-blue-50 text-blue-700 border-blue-300',
    connected: 'bg-blue-600 text-white border-blue-700 hover:bg-blue-500',
    unreachable: 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100'
  };
  
  const stateIcons = {
    disconnected: <div className="w-2 h-2 rounded-full bg-gray-400" />,
    connecting: <Loader2 size={14} className="animate-spin text-blue-600" />,
    connected: <div className="w-2 h-2 rounded-full bg-white" />,
    unreachable: <WifiOff size={14} className="text-red-500" />
  };
  
  const stateLabels = {
    disconnected: 'Connect',
    connecting: 'Connecting...',
    connected: `${database || status?.database || 'DB'}.${schema || status?.schema || 'PUBLIC'}`,
    unreachable: 'API Unreachable'
  };
  
  const stateTitles = {
    disconnected: 'Click to connect to Snowflake',
    connecting: 'Establishing connection...',
    connected: 'Connected to Snowflake – Click to manage',
    unreachable: 'MDLH API is not responding – Click to retry'
  };
  
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border-2 ${stateStyles[state]}`}
      title={stateTitles[state]}
    >
      {stateIcons[state]}
      <span className="hidden sm:inline font-mono">
        {stateLabels[state]}
      </span>
      <Snowflake size={14} className={state === 'connected' ? 'text-white' : 'text-gray-500'} />
    </button>
  );
}

// Banner component for displaying unreachable API warning
function UnreachableBanner({ onRetry }) {
  return (
    <div className="bg-orange-50 border-b-2 border-orange-200 px-6 py-3">
      <div className="flex items-center justify-between max-w-full">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <WifiOff size={18} className="text-orange-600" />
          </div>
          <div>
            <div className="text-sm font-semibold text-orange-800 font-mono">
              MDLH API is not responding
            </div>
            <div className="text-xs text-orange-700">
              Your Snowflake session may still be valid, but the MDLH service cannot be reached.
            </div>
          </div>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="ml-4 px-4 py-2 text-sm font-semibold text-orange-800 bg-orange-200 hover:bg-orange-300 rounded-xl transition-colors flex-shrink-0"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async (e) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
        copied 
          ? 'bg-green-500 text-white' 
          : 'bg-white border border-gray-200 text-gray-600 hover:border-[#3366FF] hover:text-[#3366FF]'
      }`}
      title="Copy to clipboard"
    >
      {copied ? (
        <>
          <Check size={12} />
          <span>Copied!</span>
        </>
      ) : (
        <>
          <Copy size={12} />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}


// Inline copy button for table cells
function CellCopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async (e) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  
  return (
    <button
      onClick={handleCopy}
      className={`ml-1.5 opacity-0 group-hover:opacity-100 inline-flex items-center justify-center w-5 h-5 rounded transition-all duration-150 ${
        copied 
          ? 'bg-green-500 text-white' 
          : 'bg-gray-200 hover:bg-[#3366FF] text-gray-500 hover:text-white'
      }`}
      title="Copy"
    >
      {copied ? <Check size={10} /> : <Copy size={10} />}
    </button>
  );
}

// Slide-out Query Panel - Now uses extracted shell + layout components
function QueryPanel({ 
  isOpen, 
  onClose, 
  queries, 
  categoryLabel, 
  highlightedQuery, 
  onRunInEditor, 
  isLoading, 
  discoveredTables = new Set(), 
  isConnected = false,
  batchValidationResults = new Map(),
  onShowMyWork = null,
  isBatchValidating = false,
  selectedDatabase = '',
  selectedSchema = '',
  queryValidationMap = new Map(),
  onValidateAll = null,
  onOpenConnectionModal = null
}) {
  // State for test query mode - shows embedded editor
  const [testQueryMode, setTestQueryMode] = useState(null); // { query, title }
  
  // Track if there are unsaved changes in the flyout editor
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Reset test mode and unsaved changes when panel closes
  useEffect(() => {
    if (!isOpen) {
      setTestQueryMode(null);
      setHasUnsavedChanges(false);
    }
  }, [isOpen]);
  
  // Handler for test query action
  const handleTestQuery = useCallback((query, title) => {
    uiLog.info('Enter Test Query mode', { title, queryPreview: query.substring(0, 50) });
    setTestQueryMode({ query, title });
    setHasUnsavedChanges(false);
  }, []);
  
  // Handler to open in full editor
  const handleOpenFullEditor = useCallback((sql) => {
    uiLog.info('Open Full Editor from flyout', { sqlPreview: sql.substring(0, 50) });
    onRunInEditor(sql);
    onClose();
  }, [onRunInEditor, onClose]);
  
  // Handler for back button in test mode
  const handleBackFromTest = useCallback(() => {
    uiLog.info('Back from Test Query mode');
    setTestQueryMode(null);
    setHasUnsavedChanges(false);
  }, []);
  
  // Handler for close - check for unsaved changes
  const handleBeforeClose = useCallback(() => {
    // Only block if in test mode with unsaved changes
    if (testQueryMode && hasUnsavedChanges) {
      return true; // Block close, show confirmation
    }
    return false;
  }, [testQueryMode, hasUnsavedChanges]);
  
  // Handle SQL changes from the flyout editor
  const handleSqlChange = useCallback((sql, initialQuery) => {
    setHasUnsavedChanges(sql !== initialQuery);
  }, []);

  return (
    <QueryPanelShell 
      isOpen={isOpen} 
      onClose={onClose}
      onBeforeClose={handleBeforeClose}
    >
      {testQueryMode ? (
        <TestQueryLayout
          testQueryMode={testQueryMode}
          onBack={handleBackFromTest}
          onClose={onClose}
          onOpenFullEditor={handleOpenFullEditor}
          selectedDatabase={selectedDatabase}
          selectedSchema={selectedSchema}
          onSqlChange={handleSqlChange}
          availableTables={[...discoveredTables]}
        />
      ) : (
        <QueryLibraryLayout
          categoryLabel={categoryLabel}
          onClose={onClose}
          queries={queries}
          highlightedQuery={highlightedQuery}
          onRunInEditor={onRunInEditor}
          isLoading={isLoading}
          discoveredTables={discoveredTables}
          isConnected={isConnected}
          batchValidationResults={batchValidationResults}
          onShowMyWork={onShowMyWork}
          isBatchValidating={isBatchValidating}
          selectedDatabase={selectedDatabase}
          selectedSchema={selectedSchema}
          queryValidationMap={queryValidationMap}
          onValidateAll={onValidateAll}
          onOpenConnectionModal={onOpenConnectionModal}
          onTestQuery={handleTestQuery}
          extractTableFromQuery={extractTableFromQuery}
        />
      )}
    </QueryPanelShell>
  );
}

// Play button for running a query
function PlayQueryButton({ onClick, hasQuery, tableAvailable, isConnected }) {
  if (!hasQuery) return null;
  
  // Determine button state based on table availability
  const isValidated = isConnected && tableAvailable === true;
  const isUnavailable = isConnected && tableAvailable === false;
  const isUnknown = !isConnected || tableAvailable === null;
  
  if (isUnavailable) {
    return (
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 hover:bg-orange-200 text-orange-700 transition-all duration-200 border border-orange-200"
        title="Table not found - query may fail"
      >
        <Code2 size={12} />
        <span>Query</span>
      </button>
    );
  }
  
  if (isValidated) {
    return (
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500 hover:bg-green-600 text-white transition-all duration-200 shadow-sm hover:shadow-md"
        title="✓ Table verified - click to run query"
      >
        <Check size={12} />
        <span>Query</span>
      </button>
    );
  }
  
  // Unknown state (not connected)
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#3366FF] hover:bg-blue-600 text-white transition-all duration-200 shadow-sm hover:shadow-md"
      title="View query"
    >
      <Code2 size={12} />
      <span>Query</span>
    </button>
  );
}

// Note: MDLH_DATABASES, MDLH_SCHEMAS, and fetchTableColumns are imported from data/constants.js and utils/tableDiscovery.js

// Local columnCache for table column caching
const columnCache = new Map();

// Local fetchTableColumns - keeping for backward compat until full migration
async function localFetchTableColumns(database, schema, table) {
  const cacheKey = `${database}.${schema}.${table}`;
  
  // Return cached columns if available
  if (columnCache.has(cacheKey)) {
    return columnCache.get(cacheKey);
  }
  
  try {
    // Get session ID from sessionStorage
    const sessionData = sessionStorage.getItem('snowflake_session');
    const sessionId = sessionData ? JSON.parse(sessionData).sessionId : null;
    
    if (!sessionId) {
      appLog.warn('fetchColumnsForTable() - no session, cannot fetch columns');
      return null;
    }
    
    const response = await fetch(
      `${API_BASE_URL}/api/metadata/columns?database=${database}&schema=${schema}&table=${table}&refresh=false`,
      { headers: { 'X-Session-ID': sessionId } }
    );
    
    if (response.ok) {
      const columns = await response.json();
      // Cache the result
      columnCache.set(cacheKey, columns);
      return columns;
    }
  } catch (err) {
    appLog.error('fetchColumnsForTable() - failed', { error: err.message });
  }
  
  return null;
}

// Pick best columns for a query based on available columns and entity type
function selectQueryColumns(columns, entityName, maxColumns = 8) {
  if (!columns || columns.length === 0) return null;
  
  const colNames = columns.map(c => (typeof c === 'string' ? c : c.name).toUpperCase());
  const entityLower = entityName.toLowerCase();
  
  // Priority columns by category
  const priorityColumns = {
    identity: ['NAME', 'GUID', 'QUALIFIEDNAME', 'DISPLAYNAME'],
    hierarchy: ['DATABASENAME', 'SCHEMANAME', 'TABLENAME', 'CONNECTIONNAME', 'CONNECTORNAME'],
    description: ['DESCRIPTION', 'USERDESCRIPTION', 'SHORTDESCRIPTION'],
    metadata: ['TYPENAME', 'DATATYPE', 'STATUS'],
    governance: ['CERTIFICATESTATUS', 'OWNERUSERS', 'OWNERGROUPS'],
    metrics: ['QUERYCOUNT', 'POPULARITYSCORE', 'ROWCOUNT', 'COLUMNCOUNT'],
    timestamps: ['CREATETIME', 'UPDATETIME'],
    // Entity-specific priority columns
    process: ['INPUTS', 'OUTPUTS', 'SQL', 'CODE'],
    glossary: ['ANCHOR', 'CATEGORIES', 'TERMS'],
    column: ['ISPRIMARYKEY', 'ISFOREIGNKEY', 'ISNULLABLE', 'ORDER'],
    dbt: ['DBTPACKAGENAME', 'DBTSTATUS', 'DBTMATERIALIZEDTYPE'],
    bi: ['PROJECTQUALIFIEDNAME', 'WORKBOOKQUALIFIEDNAME', 'DASHBOARDQUALIFIEDNAME'],
  };
  
  // Determine which category columns to prioritize
  let categoryPriority = [];
  if (entityLower.includes('process') || entityLower.includes('lineage')) {
    categoryPriority = priorityColumns.process;
  } else if (entityLower.includes('glossary') || entityLower.includes('term') || entityLower.includes('category')) {
    categoryPriority = priorityColumns.glossary;
  } else if (entityLower === 'column') {
    categoryPriority = priorityColumns.column;
  } else if (entityLower.includes('dbt')) {
    categoryPriority = priorityColumns.dbt;
  } else if (['tableau', 'powerbi', 'looker', 'sigma', 'mode', 'preset', 'superset', 'domo', 'qlik', 'metabase'].some(bi => entityLower.includes(bi))) {
    categoryPriority = priorityColumns.bi;
  }
  
  // Build ordered list of columns to select
  const orderedPriority = [
    ...priorityColumns.identity,
    ...categoryPriority,
    ...priorityColumns.hierarchy,
    ...priorityColumns.description,
    ...priorityColumns.metadata,
    ...priorityColumns.governance,
    ...priorityColumns.metrics,
    ...priorityColumns.timestamps,
  ];
  
  // Select columns that exist
  const selected = [];
  for (const col of orderedPriority) {
    if (colNames.includes(col) && !selected.includes(col)) {
      selected.push(col);
      if (selected.length >= maxColumns) break;
    }
  }
  
  // If we didn't find enough priority columns, add others
  if (selected.length < maxColumns) {
    for (const col of colNames) {
      if (!selected.includes(col)) {
        selected.push(col);
        if (selected.length >= maxColumns) break;
      }
    }
  }
  
  return selected;
}

// Generate a context-aware example query for an entity
function generateEntityQuery(entityName, tableName, database, schema, columns = null, options = {}) {
  const db = database || 'FIELD_METADATA';
  const sch = schema || 'PUBLIC';
  const table = tableName || `${entityName.toUpperCase()}_ENTITY`;
  const limit = options.limit || 10;
  const fullTableRef = `${db}.${sch}.${table}`;
  const entityLower = entityName.toLowerCase();
  
  // Select best columns if we have column metadata
  const selectedCols = selectQueryColumns(columns, entityName);
  const colList = selectedCols ? selectedCols.join(',\n    ') : '*';
  const hasColumns = selectedCols && selectedCols.length > 0;
  
  // Header comment for all queries
  const header = `-- Query ${entityName} entities
-- Database: ${db} | Schema: ${sch}
-- Columns: ${hasColumns ? `${selectedCols.length} selected from ${columns.length} available` : 'Using SELECT * (connect to see available columns)'}

`;

  // ============================================
  // SMART QUERY GENERATION (uses real columns when available)
  // ============================================
  
  // If we have column metadata, use smart column selection
  if (hasColumns) {
    // Determine ORDER BY clause based on available columns
    let orderBy = '';
    if (selectedCols.includes('CREATETIME')) orderBy = 'ORDER BY CREATETIME DESC';
    else if (selectedCols.includes('UPDATETIME')) orderBy = 'ORDER BY UPDATETIME DESC';
    else if (selectedCols.includes('POPULARITYSCORE')) orderBy = 'ORDER BY POPULARITYSCORE DESC NULLS LAST';
    else if (selectedCols.includes('NAME')) orderBy = 'ORDER BY NAME';
    
    // Determine WHERE clause based on available columns and entity type
    let whereClause = '';
    if (selectedCols.includes('STATUS')) {
      whereClause = "WHERE STATUS = 'ACTIVE'";
    }
    
    return header + `SELECT 
    ${colList}
FROM ${fullTableRef}
${whereClause}
${orderBy}
LIMIT ${limit};`.replace(/\n\n+/g, '\n');
  }
  
  // ============================================
  // FALLBACK QUERIES (when no column metadata)
  // ============================================
  
  if (entityLower === 'connection') {
    return header + `SELECT *
FROM ${fullTableRef}
LIMIT ${limit};

-- Common columns: NAME, CONNECTORNAME, CATEGORY, HOST, CREATETIME`;
  }
  
  if (entityLower.includes('process') && !entityLower.includes('dbt')) {
    return header + `SELECT *
FROM ${fullTableRef}
LIMIT ${limit};

-- Common columns: NAME, TYPENAME, INPUTS, OUTPUTS, SQL, CREATETIME`;
  }

  // ============================================
  // GLOSSARY ENTITIES - Fallback (when not connected)
  // ============================================
  
  if (entityLower === 'atlasglossary') {
    return header + `SELECT * FROM ${fullTableRef} LIMIT ${limit};
-- Hint: NAME, SHORTDESCRIPTION, LANGUAGE, CREATETIME, CREATEDBY`;
  }
  
  if (entityLower === 'atlasglossaryterm') {
    return header + `SELECT * FROM ${fullTableRef} LIMIT ${limit};
-- Hint: NAME, USERDESCRIPTION, ANCHOR, UPDATETIME`;
  }
  
  if (entityLower === 'atlasglossarycategory') {
    return header + `SELECT * FROM ${fullTableRef} LIMIT ${limit};
-- Hint: NAME, SHORTDESCRIPTION, ANCHOR, PARENTCATEGORY`;
  }

  // ============================================
  // DATA MESH ENTITIES
  // ============================================
  
  if (entityLower === 'datadomain') {
    return header + `SELECT * FROM ${fullTableRef} LIMIT ${limit};
-- Hint: NAME, USERDESCRIPTION, PARENTDOMAINQUALIFIEDNAME, OWNERUSERS`;
  }
  
  if (entityLower === 'dataproduct') {
    return header + `SELECT * FROM ${fullTableRef} LIMIT ${limit};
-- Hint: NAME, DATAPRODUCTSTATUS, DATAPRODUCTCRITICALITY, DATAPRODUCTSCORE`;
  }
  
  if (entityLower === 'datacontract') {
    return header + `SELECT * FROM ${fullTableRef} LIMIT ${limit};
-- Hint: NAME, DATACONTRACTVERSION, DATACONTRACTASSETGUID, CREATETIME`;
  }

  // ============================================
  // RELATIONAL DB ENTITIES
  // ============================================
  
  if (entityLower === 'database') {
    return header + `SELECT * FROM ${fullTableRef} LIMIT ${limit};
-- Hint: NAME, CONNECTORNAME, SCHEMACOUNT, POPULARITYSCORE`;
  }
  
  if (entityLower === 'schema' && !entityLower.includes('registry')) {
    return header + `SELECT * FROM ${fullTableRef} LIMIT ${limit};
-- Hint: NAME, DATABASENAME, TABLECOUNT, VIEWCOUNT`;
  }
  
  if (entityLower === 'table') {
    return header + `SELECT * FROM ${fullTableRef} LIMIT ${limit};
-- Hint: NAME, SCHEMANAME, COLUMNCOUNT, POPULARITYSCORE`;
  }
  
  if (entityLower === 'view' || entityLower === 'materialisedview') {
    return header + `SELECT * FROM ${fullTableRef} LIMIT ${limit};
-- Hint: NAME, SCHEMANAME, DEFINITION`;
  }
  
  if (entityLower === 'column') {
    return header + `SELECT * FROM ${fullTableRef} LIMIT ${limit};
-- Hint: NAME, TABLENAME, DATATYPE, ISNULLABLE`;
  }
  
  if (entityLower === 'tablepartition') {
    return header + `SELECT * FROM ${fullTableRef} LIMIT ${limit};`;
  }
  
  if (entityLower === 'procedure' || entityLower === 'function') {
    return header + `SELECT * FROM ${fullTableRef} LIMIT ${limit};`;
  }
  
  // Snowflake-specific
  if (entityLower.includes('snowflake')) {
    return header + `SELECT * FROM ${fullTableRef} LIMIT ${limit};`;
  }

  // ============================================
  // QUERY ORG ENTITIES
  // ============================================
  
  if (entityLower === 'collection') {
    return header + `SELECT * FROM ${fullTableRef} LIMIT ${limit};`;
  }
  
  if (entityLower === 'folder') {
    return header + `SELECT * FROM ${fullTableRef} LIMIT ${limit};`;
  }
  
  if (entityLower === 'query') {
    return header + `SELECT * FROM ${fullTableRef} LIMIT ${limit};
-- Hint: NAME, RAWQUERY, CREATEDBY, CREATETIME`;
  }

  // ============================================
  // BI TOOLS (Tableau, PowerBI, Looker, Sigma, etc.)
  // ============================================
  
  if (entityLower.includes('dashboard') || entityLower.includes('report')) {
    return header + `SELECT * FROM ${fullTableRef} LIMIT ${limit};`;
  }
  
  if (entityLower.includes('workbook') || entityLower.includes('project') || entityLower.includes('workspace')) {
    return header + `SELECT * FROM ${fullTableRef} LIMIT ${limit};`;
  }
  
  if (entityLower.includes('dataset') || entityLower.includes('datasource')) {
    return header + `SELECT * FROM ${fullTableRef} LIMIT ${limit};`;
  }
  
  if (entityLower.includes('chart') || entityLower.includes('tile') || entityLower.includes('visual')) {
    return header + `SELECT * FROM ${fullTableRef} LIMIT ${limit};`;
  }
  
  if (entityLower.includes('field') || entityLower.includes('measure') || entityLower.includes('dimension')) {
    return header + `SELECT * FROM ${fullTableRef} LIMIT ${limit};`;
  }

  // ============================================
  // DBT ENTITIES
  // ============================================
  
  if (entityLower.includes('dbt')) {
    return header + `SELECT * FROM ${fullTableRef} LIMIT ${limit};`;
  }

  // ============================================
  // OBJECT STORAGE (S3, GCS, ADLS)
  // ============================================
  
  if (entityLower.includes('bucket') || entityLower.includes('container') || 
      entityLower.includes('object') || entityLower.includes('file')) {
    return header + `SELECT * FROM ${fullTableRef} LIMIT ${limit};`;
  }

  // ============================================
  // ORCHESTRATION (Airflow, Fivetran, Matillion)
  // ============================================
  
  if (entityLower.includes('dag') || entityLower.includes('pipeline') || 
      entityLower.includes('job') || entityLower.includes('task') ||
      entityLower.includes('connector')) {
    return header + `SELECT * FROM ${fullTableRef} LIMIT ${limit};`;
  }

  // ============================================
  // GOVERNANCE, AI/ML, STREAMING ENTITIES
  // ============================================
  
  if (entityLower.includes('tag') || entityLower === 'persona' || 
      entityLower === 'purpose' || entityLower.includes('policy') ||
      entityLower.includes('aimodel') || entityLower.includes('aiapplication') ||
      entityLower.includes('topic') || entityLower.includes('consumer') ||
      entityLower.includes('custommetadata')) {
    return header + `SELECT * FROM ${fullTableRef} LIMIT ${limit};`;
  }

  // ============================================
  // DEFAULT FALLBACK - Use SELECT * for safety
  // ============================================
  
  return header + `SELECT * FROM ${fullTableRef} LIMIT ${limit};

-- 💡 Connect to Snowflake for smart column selection
-- Or run: DESCRIBE TABLE ${fullTableRef};`;
}

export default function App() {
  // =========================================================================
  // Backend Restart Detection
  // =========================================================================
  // This MUST be first - it clears stale sessions before any other hooks run
  useBackendInstanceGuard();
  
  const [activeTab, setActiveTab] = useState('core');
  const [search, setSearch] = useState('');
  const [showQueries, setShowQueries] = useState(false);
  const [highlightedQuery, setHighlightedQuery] = useState(null);
  const [editorQuery, setEditorQuery] = useState('');
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [selectedMDLHDatabase, setSelectedMDLHDatabase] = useState('FIELD_METADATA');
  const [selectedMDLHSchema, setSelectedMDLHSchema] = useState('PUBLIC');
  const searchRef = useRef(null);
  
  // State for table discovery and validation
  const [discoveredTables, setDiscoveredTables] = useState(new Set());
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [validatedQueries, setValidatedQueries] = useState(new Map()); // queryId -> { valid, error, columns }
  const [isValidating, setIsValidating] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(true); // Filter to show only queryable entities
  const [queryValidationMap, setQueryValidationMap] = useState(new Map()); // Pre-validated queries
  
  // Dynamic queries - transformed to use actual discovered table names with FQNs
  const [exampleQueries, setExampleQueries] = useState(staticExampleQueries);
  const [mergedExampleQueries, setMergedExampleQueries] = useState(staticMergedQueries);
  
  // State for batch validation results (with suggestions)
  const [batchValidationResults, setBatchValidationResults] = useState(new Map()); // queryId -> full validation result
  const [isBatchValidating, setIsBatchValidating] = useState(false);
  
  // State for Show My Work modal
  const [showMyWorkQuery, setShowMyWorkQuery] = useState(null);
  const [showMyWorkValidation, setShowMyWorkValidation] = useState(null);
  
  // Global connection modal state
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  
  // Use global connection hook
  const { 
    status: globalConnectionStatus, 
    testConnection: globalTestConnection, 
    loading: globalConnectionLoading 
  } = useConnection();
  
  // Use sample entities hook - loads real GUIDs from discovered tables
  const {
    samples: sampleEntities,
    loadSamples: loadSampleEntities,
    clearSamples: clearSampleEntities
  } = useSampleEntities();
  
  // Handle successful connection from global modal
  const handleGlobalConnectionSuccess = useCallback((status) => {
    uiLog.info('Connection success from modal', { database: status?.database });
    setShowConnectionModal(false);
    setIsConnected(true);
    // Table discovery will be triggered by the useEffect watching isConnected
  }, []);
  
  // Check connection status on mount and when session changes
  // FIX: Sync local isConnected state with globalConnectionStatus from useConnection hook
  useEffect(() => {
    let lastStatus = null; // Track last status to avoid spammy logs
    
    // Helper function with timeout to prevent hanging
    const fetchWithTimeout = async (url, options, timeoutMs = 5000) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        return response;
      } finally {
        clearTimeout(id);
      }
    };
    
    const checkConnection = async (source = 'poll') => {
      const sessionData = sessionStorage.getItem('snowflake_session');
      if (!sessionData) {
        if (lastStatus !== 'disconnected') {
          lastStatus = 'disconnected';
          if (source !== 'poll') {
            appLog.info('Connection status: Not connected (no session)');
          }
        }
        setIsConnected(false);
        return;
      }
      
      // Validate session with backend (with timeout!)
      try {
        const { sessionId, database, schema } = JSON.parse(sessionData);
        const response = await fetchWithTimeout(
          `${API_BASE_URL}/api/session/status`,
          { headers: { 'X-Session-ID': sessionId } },
          5000 // 5-second timeout to match useConnection hook
        );
        const status = await response.json();
        
        if (status.valid) {
          if (lastStatus !== 'connected') {
            lastStatus = 'connected';
            appLog.info('Connection status: Connected (session valid)', { database: status.database });
          }
          setIsConnected(true);
        } else {
          // Session expired or invalid - clear it
          sessionStorage.removeItem('snowflake_session');
          if (lastStatus !== 'expired') {
            lastStatus = 'expired';
            appLog.warn('Connection status: Session expired, cleared');
          }
          setIsConnected(false);
        }
      } catch (err) {
        // FIX: On timeout or network error, assume session is still valid (like useConnection does)
        if (err.name === 'AbortError') {
          appLog.warn('Session check timed out - assuming still valid');
          setIsConnected(true);
        } else {
          // For other errors, also assume valid if we have a session
          appLog.warn('Session check error - assuming still valid', { error: err.message });
          setIsConnected(true);
        }
      }
    };
    checkConnection('mount');
    
    // Listen for custom session change event (dispatched by ConnectionModal)
    const handleSessionChange = (event) => {
      appLog.info('Session change event received', { 
          hasSession: !!event.detail?.sessionId,
          database: event.detail?.database
        });
      lastStatus = null; // Reset so we log the new status
      
      // FIX: Immediately set connected if event indicates connected
      if (event.detail?.connected || event.detail?.sessionId) {
        setIsConnected(true);
      }
      
      checkConnection('event');
    };
    window.addEventListener('snowflake-session-changed', handleSessionChange);
    
    // Also listen for storage changes (in case session is modified from another tab)
    const handleStorageChange = () => checkConnection('storage');
    window.addEventListener('storage', handleStorageChange);
    
    // Periodic check as fallback (less frequent - 30 seconds)
    const interval = setInterval(() => checkConnection('poll'), 30000);
    
    return () => {
      window.removeEventListener('snowflake-session-changed', handleSessionChange);
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);
  
  // Discover tables and pre-validate queries when database/schema changes or connection is made
  useEffect(() => {
    if (isConnected && selectedMDLHDatabase && selectedMDLHSchema) {
      setIsDiscovering(true);
      discoverMDLHTables(selectedMDLHDatabase, selectedMDLHSchema)
        .then(tables => {
          setDiscoveredTables(tables);
          appLog.info('Discovered tables', { count: tables.size, database: selectedMDLHDatabase, schema: selectedMDLHSchema });
          
          // Load sample entities for real GUIDs in recommended queries
          if (tables.size > 0) {
            loadSampleEntities(selectedMDLHDatabase, selectedMDLHSchema, tables);
            appLog.info('Loading sample entities for recommended queries');
          }
          
          // DYNAMIC QUERIES: Transform static queries to use actual discovered table names with FQNs
          if (tables.size > 0) {
            const transformedQueries = transformExampleQueries(
              staticExampleQueries,
              selectedMDLHDatabase,
              selectedMDLHSchema,
              tables
            );
            setExampleQueries(transformedQueries);
            
            const transformedMerged = transformExampleQueries(
              staticMergedQueries,
              selectedMDLHDatabase,
              selectedMDLHSchema,
              tables
            );
            setMergedExampleQueries(transformedMerged);
            
            appLog.info('Transformed queries to use discovered tables with FQNs');
            
            // Pre-validate all transformed queries
            const validationMap = preValidateAllQueries(
              transformedQueries, 
              tables, 
              selectedMDLHDatabase, 
              selectedMDLHSchema
            );
            setQueryValidationMap(validationMap);
            
            // Log validation summary
            const valid = [...validationMap.values()].filter(v => v.valid === true).length;
            const invalid = [...validationMap.values()].filter(v => v.valid === false).length;
            const autoFixed = [...validationMap.values()].filter(v => v.autoFixed).length;
            appLog.info('Query validation complete', { valid, invalid, autoFixed });
          }
        })
        .finally(() => setIsDiscovering(false));
    }
  }, [isConnected, selectedMDLHDatabase, selectedMDLHSchema, loadSampleEntities]);
  
  // Run batch validation on entity example queries to get sample data and suggestions
  const runBatchValidation = useCallback(async () => {
    if (!isConnected) return;
    
    const sessionData = sessionStorage.getItem('snowflake_session');
    if (!sessionData) return;
    
    const { sessionId } = JSON.parse(sessionData);
    
    // Collect entity queries to validate
    const queriesToValidate = [];
    Object.entries(exampleQueries).forEach(([category, queries]) => {
      if (category === 'core') {
        queries.forEach((q, i) => {
          queriesToValidate.push({
            query_id: `core_${i}`,
            sql: q.query,
            entity_type: 'core',
            description: q.title
          });
        });
      }
    });
    
    // Also add entity-specific queries from data
    Object.values(data).flat().filter(e => e.exampleQuery).forEach(entity => {
      queriesToValidate.push({
        query_id: `entity_${entity.table || entity.name}`,
        sql: entity.exampleQuery,
        entity_type: entity.name,
        description: `Example query for ${entity.name}`
      });
    });
    
    if (queriesToValidate.length === 0) return;
    
    setIsBatchValidating(true);
    appLog.info('Running batch validation', { queryCount: queriesToValidate.length });
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/query/validate-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId
        },
        body: JSON.stringify({
          queries: queriesToValidate,
          database: selectedMDLHDatabase,
          schema_name: selectedMDLHSchema,
          include_samples: true,
          sample_limit: 3
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Build results map
        const resultsMap = new Map();
        data.results.forEach(result => {
          resultsMap.set(result.query_id, result);
        });
        
        setBatchValidationResults(resultsMap);
        
        appLog.info('Batch validation complete', data.summary);
      } else {
        appLog.error('Batch validation failed', { status: response.status });
      }
    } catch (err) {
      appLog.error('Batch validation error', { error: err.message });
    } finally {
      setIsBatchValidating(false);
    }
  }, [isConnected, selectedMDLHDatabase, selectedMDLHSchema]);
  
  // Trigger batch validation after table discovery completes
  useEffect(() => {
    if (isConnected && discoveredTables.size > 0 && !isDiscovering) {
      runBatchValidation();
    }
  }, [isConnected, discoveredTables, isDiscovering, runBatchValidation]);
  
  // Handler for "Show My Work" button
  const handleShowMyWork = useCallback((query, validationResult) => {
    uiLog.info('Show My Work clicked', { 
      queryPreview: query.substring(0, 50),
      valid: validationResult?.valid 
    });
    setShowMyWorkQuery(query);
    setShowMyWorkValidation(validationResult);
  }, []);
  
  // Get warning for selected database
  const selectedDbConfig = MDLH_DATABASES.find(db => db.name === selectedMDLHDatabase);
  const dbWarning = selectedDbConfig?.warning;
  
  // Check if a table exists in the discovered tables
  const isTableAvailable = useCallback((tableName) => {
    if (!tableName || tableName === '(abstract)') return null; // Abstract tables
    if (!isConnected || discoveredTables.size === 0) return null; // Unknown
    return discoveredTables.has(tableName.toUpperCase());
  }, [isConnected, discoveredTables]);

  // Keyboard shortcut: Cmd/Ctrl + K to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Function to open Query Editor with a specific query
  const openInEditor = (query) => {
    setEditorQuery(query);
    setActiveTab('editor');
    setShowQueries(false);
  };

  // Skip filtering for editor tab
  // Filter entities - optionally only show those with available tables
  const filteredData = activeTab === 'editor' ? [] : (data[activeTab] || []).filter(row => {
    // Search filter
    const matchesSearch = Object.values(row).some(val => 
      val?.toString().toLowerCase().includes(search.toLowerCase())
    );
    if (!matchesSearch) return false;
    
    // Availability filter (only when connected and filter is enabled)
    if (showOnlyAvailable && isConnected && discoveredTables.size > 0) {
      // Abstract tables are always shown
      if (row.table === '(abstract)') return true;
      // Check if table exists
      return discoveredTables.has(row.table?.toUpperCase());
    }
    
    return true;
  });

  // Filter and enhance queries with validation status
  // Use merged queries which include user research queries
  // CRITICAL: Filter out queries that reference non-existent tables!
  const filteredQueries = (mergedExampleQueries[activeTab] || exampleQueries[activeTab] || []).map((q, index) => {
    const queryId = `${activeTab}-${index}`;
    const validation = queryValidationMap.get(queryId);
    
    // If no pre-computed validation, do inline validation against discovered tables
    // This catches any queries with hardcoded entity names that don't exist
    let inlineValidation = null;
    if (!validation && isConnected && discoveredTables.size > 0) {
      inlineValidation = validateQueryTables(q.query, discoveredTables);
    }
    
    return {
      ...q,
      // Use fixed query if available
      query: validation?.fixedQuery || q.query,
      validation: validation || inlineValidation,
      queryId
    };
  }).filter(q => {
    // Search filter
    const matchesSearch = 
      q.title.toLowerCase().includes(search.toLowerCase()) ||
      q.description.toLowerCase().includes(search.toLowerCase()) ||
      q.query.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    
    // Availability filter - ALWAYS filter when connected with discovered tables
    // This is the KEY fix: filter out queries that reference non-existent tables
    if (isConnected && discoveredTables.size > 0) {
      // Use pre-computed validation or inline validation
      const isValid = q.validation?.valid !== false;
      
      // If showOnlyAvailable is off, show everything but mark unavailable ones
      // If showOnlyAvailable is on, only show valid queries
      if (showOnlyAvailable) {
        return isValid;
      }
    }
    
    return true;
  });
  
  // Count available vs total for display
  const totalEntities = (data[activeTab] || []).length;
  const availableEntities = (data[activeTab] || []).filter(row => {
    if (row.table === '(abstract)') return true;
    return discoveredTables.has(row.table?.toUpperCase());
  }).length;

  // Find a query related to an entity by searching for table name in query SQL
  // CRITICAL: Only return queries whose referenced tables exist!
  const findQueryForEntity = (entityName, tableName) => {
    const allQueries = exampleQueries[activeTab] || [];
    
    if (!tableName || tableName === '(abstract)') return null;
    
    const tableNameLower = tableName.toLowerCase();
    const entityNameLower = entityName.toLowerCase();
    
    // Helper to check if a query's tables are valid
    const isQueryValid = (q) => {
      if (!isConnected || discoveredTables.size === 0) return true; // No validation without discovery
      const validation = validateQueryTables(q.query, discoveredTables);
      return validation.valid;
    };
    
    // Priority 1: Exact table name match in query SQL (e.g., "FROM TABLE_ENTITY" or "TABLE_ENTITY")
    let matchedQuery = allQueries.find(q => {
      const queryLower = q.query.toLowerCase();
      const hasMatch = (
        queryLower.includes(`from ${tableNameLower}`) ||
        queryLower.includes(`from\n    ${tableNameLower}`) ||
        queryLower.includes(`from\n${tableNameLower}`) ||
        queryLower.includes(`join ${tableNameLower}`) ||
        // Also check for the table name as a standalone reference
        new RegExp(`\\b${tableNameLower.replace(/_/g, '_')}\\b`).test(queryLower)
      );
      return hasMatch && isQueryValid(q);
    });
    
    // Priority 2: Entity name explicitly in title (e.g., "Table" in title for TABLE_ENTITY)
    if (!matchedQuery) {
      matchedQuery = allQueries.find(q => {
        const titleLower = q.title.toLowerCase();
        // Match singular entity name (e.g., "Column" for Column entity, "Table" for Table)
        const hasMatch = (
          titleLower.includes(entityNameLower) ||
          titleLower.includes(entityNameLower + 's') || // plural
          titleLower.includes(entityNameLower + ' ')
        );
        return hasMatch && isQueryValid(q);
      });
    }
    
    return matchedQuery || null;
  };

  // Open panel with highlighted query
  // State for loading columns
  const [loadingColumns, setLoadingColumns] = useState(false);

  const openQueryForEntity = async (entityName, tableName, exampleQuery) => {
    setShowQueries(true);
    
    // Priority 1: Generate a context-aware query using selected database and schema
    if (tableName && tableName !== '(abstract)') {
      setLoadingColumns(true);
      
      try {
        // Fetch real columns from Snowflake if connected
        const columns = await fetchTableColumns(
          selectedMDLHDatabase, 
          selectedMDLHSchema, 
          tableName
        );
        
        const dynamicQuery = generateEntityQuery(
          entityName, 
          tableName, 
          selectedMDLHDatabase, 
          selectedMDLHSchema,
          columns  // Pass fetched columns for smart selection
        );
        setHighlightedQuery(dynamicQuery);
      } catch (err) {
        appLog.error('Error fetching columns', { table: tableName, error: err.message });
        // Fallback to basic query
        const dynamicQuery = generateEntityQuery(
          entityName, 
          tableName, 
          selectedMDLHDatabase, 
          selectedMDLHSchema,
          null
        );
        setHighlightedQuery(dynamicQuery);
      } finally {
        setLoadingColumns(false);
      }
    } 
    // Priority 2: Use inline exampleQuery if no table
    else if (exampleQuery) {
      setHighlightedQuery(exampleQuery);
    } 
    // Priority 3: Find related query from exampleQueries
    else {
      const matchedQuery = findQueryForEntity(entityName, tableName);
      setHighlightedQuery(matchedQuery?.query || null);
    }
  };

  // Check if entity has a related query
  const hasQueryForEntity = (entityName, tableName, exampleQuery) => {
    if (exampleQuery) return true;
    if (!tableName || tableName === '(abstract)') return false;
    return findQueryForEntity(entityName, tableName) !== null;
  };

  const downloadCSV = () => {
    const cols = columns[activeTab];
    const header = cols.map(c => colHeaders[c]).join(',');
    const rows = filteredData.map(row => 
      cols.map(c => `"${(row[c] || '').toString().replace(/"/g, '""')}"`).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mdlh_${activeTab}_entities.csv`;
    a.click();
  };

  const downloadAllCSV = () => {
    Object.keys(data).forEach(tabId => {
      const cols = columns[tabId];
      const header = cols.map(c => colHeaders[c]).join(',');
      const rows = data[tabId].map(row => 
        cols.map(c => `"${(row[c] || '').toString().replace(/"/g, '""')}"`).join(',')
      );
      const csv = [header, ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mdlh_${tabId}_entities.csv`;
      a.click();
    });
  };

  return (
    <SystemConfigProvider>
    <div className="min-h-screen bg-white text-gray-900">
      {/* Navigation Bar */}
      <nav className="border-b border-gray-200 bg-white/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-full mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AtlanIcon size={28} />
            <span className="font-semibold text-lg text-gray-900">MDLH</span>
          </div>
          <div className="flex items-center gap-4">
            {/* Global Snowflake Connection Indicator */}
            <ConnectionIndicator
              status={globalConnectionStatus}
              loading={globalConnectionLoading}
              onClick={() => setShowConnectionModal(true)}
              database={selectedMDLHDatabase}
              schema={selectedMDLHSchema}
            />
            
            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search entities..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-64 pl-9 pr-16 py-2 bg-white border border-gray-300 rounded-full text-sm focus:outline-none focus:border-[#3366FF] focus:ring-2 focus:ring-[#3366FF]/20 transition-all duration-200 placeholder-gray-400"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                <Command size={10} />
                <span>K</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Unreachable Banner - shown when backend is down */}
      {globalConnectionStatus?.unreachable && (
        <UnreachableBanner onRetry={globalTestConnection} />
      )}

      {/* Hero Section */}
      <div className="bg-[#3366FF] rounded-2xl mx-6 mt-6 p-8 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl font-semibold mb-3">
            Metadata Lakehouse Entity Dictionary
          </h1>
          <p className="text-blue-100 text-lg">
            Reference guide for MDLH entity types, tables, attributes, and example queries
          </p>
          
          {/* Quick Action Buttons */}
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            <button
              onClick={() => {
                setHighlightedQuery(null);
                setShowQueries(true);
              }}
              className="px-5 py-2.5 bg-white text-[#3366FF] rounded-full text-sm font-medium hover:bg-blue-50 transition-all duration-200 flex items-center gap-2"
            >
              <Code2 size={16} />
              View All Queries
            </button>
            <button
              onClick={downloadCSV}
              className="px-5 py-2.5 bg-white/20 text-white border border-white/30 rounded-full text-sm font-medium hover:bg-white/30 transition-all duration-200 flex items-center gap-2"
            >
              <Download size={14} />
              Export Tab
            </button>
            <button
              onClick={downloadAllCSV}
              className="px-5 py-2.5 bg-white/20 text-white border border-white/30 rounded-full text-sm font-medium hover:bg-white/30 transition-all duration-200 flex items-center gap-2"
            >
              <Download size={14} />
              Export All
            </button>
          </div>
          
          {/* Database & Schema Selector */}
          <div className="flex flex-col items-center gap-2 mt-4">
            <div className="flex items-center gap-2">
              <Database size={14} className="text-blue-100" />
              <span className="text-sm text-blue-100">Query Context:</span>
              <select
                value={selectedMDLHDatabase}
                onChange={(e) => setSelectedMDLHDatabase(e.target.value)}
                className="px-3 py-1.5 bg-white/20 text-white border border-white/30 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer"
              >
                {MDLH_DATABASES.map(db => (
                  <option key={db.name} value={db.name} className="text-gray-900">
                    {db.name}
                  </option>
                ))}
              </select>
              <span className="text-blue-100">.</span>
              <select
                value={selectedMDLHSchema}
                onChange={(e) => setSelectedMDLHSchema(e.target.value)}
                className="px-3 py-1.5 bg-white/20 text-white border border-white/30 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer"
              >
                {MDLH_SCHEMAS.map(sch => (
                  <option key={sch} value={sch} className="text-gray-900">
                    {sch}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Connection status and availability toggle */}
            {isConnected && discoveredTables.size > 0 ? (
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1.5 text-xs text-green-200 bg-green-500/20 px-3 py-1.5 rounded-full">
                  <Check size={12} />
                  <span><strong>{discoveredTables.size}</strong> tables found • <strong>{availableEntities}</strong>/{totalEntities} entities queryable</span>
                </div>
                <label className="flex items-center gap-2 text-xs text-blue-100 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showOnlyAvailable}
                    onChange={(e) => setShowOnlyAvailable(e.target.checked)}
                    className="w-4 h-4 rounded border-white/30 bg-white/20 text-green-500 focus:ring-green-500"
                  />
                  <span>Show only queryable</span>
                </label>
              </div>
            ) : isConnected ? (
              <div className="flex items-center gap-1.5 text-xs text-blue-200 bg-blue-500/20 px-3 py-1.5 rounded-full mt-2">
                {isDiscovering ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    <span>Checking MDLH for available tables in {selectedMDLHDatabase}.{selectedMDLHSchema}…</span>
                  </>
                ) : (
                  <>
                    <Database size={12} />
                    <span>No MDLH tables found in {selectedMDLHDatabase}.{selectedMDLHSchema}. Try another schema or check your deployment.</span>
                  </>
                )}
              </div>
            ) : (
              <button 
                onClick={() => setShowConnectionModal(true)}
                className="flex items-center gap-1.5 text-xs text-blue-200 bg-blue-500/20 hover:bg-blue-500/30 px-3 py-1.5 rounded-full mt-2 transition-colors cursor-pointer"
              >
                <Snowflake size={12} />
                <span>Click to connect to Snowflake</span>
              </button>
            )}
            
            {dbWarning && (
              <div className="flex items-center gap-1.5 text-xs text-yellow-200 bg-yellow-500/20 px-3 py-1 rounded-full">
                <span>⚠️</span>
                <span>{dbWarning} - verify table exists before running</span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Not Connected Banner */}
      {!isConnected && !globalConnectionLoading && (
        <div className="mx-6 mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Snowflake size={18} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-amber-800">Connect to Snowflake to unlock full features</p>
              <p className="text-xs text-amber-600 mt-0.5">
                See which MDLH tables exist, validate queries, and execute SQL directly
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowConnectionModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Snowflake size={14} />
            Connect
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className={`mx-auto ${activeTab === 'editor' ? 'px-4 py-3' : 'max-w-full px-6 py-6'}`}>
        {/* Tab Navigation - DuckDB style when in editor mode */}
        {activeTab === 'editor' ? (
          <div className="flex items-center gap-3 mb-3">
            {/* Language tabs like DuckDB */}
            <div className="flex items-center gap-1 px-2 py-1.5 bg-slate-100 rounded-xl">
              <button className="px-3 py-1 text-xs font-medium bg-white text-slate-800 rounded-lg shadow-sm">
                SQL
              </button>
              <button className="px-3 py-1 text-xs font-medium text-slate-400 rounded-lg cursor-not-allowed" disabled>
                Python
              </button>
              <button className="px-3 py-1 text-xs font-medium text-slate-400 rounded-lg cursor-not-allowed" disabled>
                R
              </button>
            </div>
            
            <div className="h-5 w-px bg-slate-200" />
            
            {/* Quick switch back to dictionary */}
            <button
              onClick={() => setActiveTab('core')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:border-blue-400 hover:text-blue-600 transition-colors"
            >
              <Layers size={12} />
              Dictionary
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 mb-6 pb-4 border-b border-gray-200">
            {/* Entity category tabs */}
            {tabs.filter(t => !t.isEditor).map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 shadow-sm ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-blue-200'
                      : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600'
                  }`}
                  title={tab.description}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
            
            {/* Divider before Editor */}
            <div className="h-6 w-px bg-gray-300 mx-2" />
            
            {/* Editor tab */}
            {tabs.filter(t => t.isEditor).map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 shadow-sm ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-emerald-200'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-400'
                  }`}
                  title={tab.description}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}
        
        {/* MDLH Context Header */}
        {activeTab !== 'editor' && (
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900">
                {tabs.find(t => t.id === activeTab)?.label}
              </h2>
              <span className="text-sm text-gray-500">
                {tabs.find(t => t.id === activeTab)?.description}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Database size={14} className="text-gray-400" />
              <span>MDLH context:</span>
              <span className="font-mono px-2 py-0.5 bg-gray-100 rounded text-gray-800">
                {selectedMDLHDatabase}.{selectedMDLHSchema}
              </span>
            </div>
          </div>
        )}

        {/* Conditional Content: Query Editor or Data Table */}
        {activeTab === 'editor' ? (
          <QueryEditor 
            initialQuery={editorQuery} 
            onOpenConnectionModal={() => setShowConnectionModal(true)}
            globalDatabase={selectedMDLHDatabase}
            globalSchema={selectedMDLHSchema}
            onDatabaseChange={setSelectedMDLHDatabase}
            onSchemaChange={setSelectedMDLHSchema}
            discoveredTables={discoveredTables}
            sampleEntities={sampleEntities}
          />
        ) : (
          <>
            {/* Filter bar - availability toggle */}
            <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center gap-3">
                {/* Availability filter toggle */}
                <button
                  onClick={() => setShowOnlyAvailable(!showOnlyAvailable)}
                  disabled={!isConnected || discoveredTables.size === 0}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    showOnlyAvailable && isConnected && discoveredTables.size > 0
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                      : 'bg-gray-100 text-gray-600 border border-gray-200'
                  } ${!isConnected || discoveredTables.size === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:border-emerald-400'}`}
                  title={!isConnected ? 'Connect to Snowflake to filter by availability' : showOnlyAvailable ? 'Showing only queryable tables' : 'Show all tables'}
                >
                  {showOnlyAvailable && isConnected ? <Check size={14} /> : <Database size={14} />}
                  <span>{showOnlyAvailable ? 'Showing queryable only' : 'Show only queryable'}</span>
                </button>
                
                {/* Stats badges */}
                {isConnected && discoveredTables.size > 0 && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="px-2 py-1 bg-green-50 text-green-700 rounded-full">
                      {availableEntities} queryable
                    </span>
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                      {totalEntities} total
                    </span>
                  </div>
                )}
              </div>
              
              {/* Discovery status */}
              {isDiscovering && (
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <Loader2 size={14} className="animate-spin" />
                  <span>Discovering tables...</span>
                </div>
              )}
            </div>
            
            <div className="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    {columns[activeTab]?.map(col => (
                      <th key={col} className="px-4 py-3 text-left font-semibold text-gray-700 border-b border-gray-200 text-xs uppercase tracking-wider">
                        {colHeaders[col]}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b border-gray-200 text-xs uppercase tracking-wider w-32">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredData.length > 0 ? (
                    filteredData.map((row, i) => (
                      <tr key={i} className="group hover:bg-blue-50/50 transition-colors duration-150">
                        {columns[activeTab]?.map(col => (
                          <td key={col} className="px-4 py-3 align-top">
                            {col === 'entity' ? (
                              <span className="inline-flex items-center">
                                <span className="font-semibold text-[#3366FF]">{row[col]}</span>
                                <CellCopyButton text={row[col]} />
                              </span>
                            ) : col === 'table' ? (
                              <span className="inline-flex items-center gap-1.5">
                                {/* Table availability indicator */}
                                {row[col] === '(abstract)' ? (
                                  <span 
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs"
                                    title="This is an abstract concept with no direct table representation"
                                  >
                                    <span className="text-gray-400">⚬</span>
                                    Abstract
                                  </span>
                                ) : (
                                  <>
                                    {isConnected && discoveredTables.size > 0 && (
                                      isTableAvailable(row[col]) ? (
                                        <span title="Table exists in MDLH" className="text-green-500">
                                          <Check size={14} />
                                        </span>
                                      ) : (
                                        <span title="Table not found in this database/schema" className="text-orange-400">
                                          <X size={14} />
                                        </span>
                                      )
                                    )}
                                    {isDiscovering && (
                                      <Loader2 size={14} className="animate-spin text-gray-400" />
                                    )}
                                    <span className={`font-mono px-2 py-0.5 rounded text-xs ${
                                      isTableAvailable(row[col]) === false
                                        ? 'text-orange-600 bg-orange-50'
                                        : 'text-emerald-600 bg-emerald-50'
                                    }`}>{row[col]}</span>
                                    <CellCopyButton text={row[col]} />
                                  </>
                                )}
                              </span>
                            ) : col === 'exampleQuery' ? (
                              <span className="inline-flex items-center">
                                <code className="text-gray-600 bg-gray-100 px-2 py-0.5 rounded text-xs break-all">{row[col]}</code>
                                {row[col] && <CellCopyButton text={row[col]} />}
                              </span>
                            ) : (
                              <span className="text-gray-600">{row[col]}</span>
                            )}
                          </td>
                        ))}
                        <td className="px-4 py-3 align-top">
                          <div className="flex items-center gap-1">
                            {/* View/Test Query button */}
                            <PlayQueryButton 
                              hasQuery={hasQueryForEntity(row.entity, row.table, row.exampleQuery)}
                              onClick={() => openQueryForEntity(row.entity, row.table, row.exampleQuery)}
                              tableAvailable={isTableAvailable(row.table)}
                              isConnected={isConnected}
                            />
                            {/* Recommended Queries button */}
                            {row.table && row.table !== '(abstract)' && (
                              <button
                                onClick={() => {
                                  setSelectedEntity({
                                    entity: row.entity,
                                    table: row.table,
                                    entityType: row.entityType || 'TABLE',
                                    description: row.description
                                  });
                                  setShowRecommendations(true);
                                }}
                                className="opacity-0 group-hover:opacity-100 px-2 py-1 rounded text-xs font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50 transition-all flex items-center gap-1"
                                title="Show recommended queries for this entity"
                              >
                                <Zap size={12} />
                                <span className="hidden lg:inline">Recommend</span>
                              </button>
                            )}
                            {/* Copy table name - only for non-abstract */}
                            {row.table && row.table !== '(abstract)' && (
                              <button
                                onClick={() => navigator.clipboard.writeText(row.table)}
                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
                                title="Copy table name"
                              >
                                <Copy size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={(columns[activeTab]?.length || 0) + 1} className="px-4 py-12 text-center">
                        {isConnected && showOnlyAvailable && discoveredTables.size > 0 ? (
                          <>
                            <Database size={32} className="mx-auto text-gray-300 mb-2" />
                            <p className="text-gray-600 font-medium">No queryable tables found</p>
                            <p className="text-gray-400 text-sm mt-1">
                              No tables for this category exist in {selectedMDLHDatabase}.{selectedMDLHSchema}
                            </p>
                            <button
                              onClick={() => setShowOnlyAvailable(false)}
                              className="mt-3 text-sm text-blue-600 hover:text-blue-700"
                            >
                              Show all entities
                            </button>
                          </>
                        ) : (
                          <>
                            <Search size={32} className="mx-auto text-gray-300 mb-2" />
                            <p className="text-gray-600 font-medium">No results found</p>
                            <p className="text-gray-400 text-xs mt-1">Try adjusting your search terms</p>
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing <span className="text-gray-900 font-medium">{filteredData.length}</span> of <span className="text-gray-900 font-medium">{data[activeTab]?.length || 0}</span> entities in <span className="text-[#3366FF] font-medium">{tabs.find(t => t.id === activeTab)?.label}</span>
              </p>
              <p className="text-sm text-gray-400">
                Press <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-gray-600 font-mono text-xs">⌘K</kbd> to search • Click <span className="text-[#3366FF]">Query</span> buttons for SQL examples
              </p>
            </div>
          </>
        )}
      </div>

      {/* Query Side Panel */}
      <QueryPanel 
        isOpen={showQueries} 
        onClose={() => {
          setShowQueries(false);
          setHighlightedQuery(null);
        }} 
        queries={filteredQueries}
        categoryLabel={tabs.find(t => t.id === activeTab)?.label}
        highlightedQuery={highlightedQuery}
        onRunInEditor={openInEditor}
        isLoading={loadingColumns}
        discoveredTables={discoveredTables}
        isConnected={isConnected}
        batchValidationResults={batchValidationResults}
        onShowMyWork={handleShowMyWork}
        isBatchValidating={isBatchValidating}
        selectedDatabase={selectedMDLHDatabase}
        selectedSchema={selectedMDLHSchema}
        queryValidationMap={queryValidationMap}
        onValidateAll={runBatchValidation}
        onOpenConnectionModal={() => setShowConnectionModal(true)}
      />
      
      {/* Show My Work Modal */}
      {/* Global Connection Modal */}
      <ConnectionModal
        isOpen={showConnectionModal}
        onClose={() => setShowConnectionModal(false)}
        onConnect={handleGlobalConnectionSuccess}
        currentStatus={globalConnectionStatus}
      />
      
      {/* Show My Work Modal */}
      <ShowMyWork
        isOpen={!!showMyWorkQuery}
        onClose={() => {
          setShowMyWorkQuery(null);
          setShowMyWorkValidation(null);
        }}
        query={showMyWorkQuery}
        validationResult={showMyWorkValidation}
        onRunQuery={(sql) => {
          openInEditor(sql);
          setShowMyWorkQuery(null);
          setShowMyWorkValidation(null);
        }}
        onRunSuggestedQuery={(sql) => {
          openInEditor(sql);
          setShowMyWorkQuery(null);
          setShowMyWorkValidation(null);
        }}
      />
      
      {/* Recommended Queries Panel */}
      <RecommendedQueries
        entity={selectedEntity}
        entityContext={{
          database: selectedMDLHDatabase,
          schema: selectedMDLHSchema,
          table: selectedEntity?.table,
          entityType: selectedEntity?.entityType
        }}
        isOpen={showRecommendations}
        onClose={() => {
          setShowRecommendations(false);
          setSelectedEntity(null);
        }}
        onRunQuery={(sql, query) => {
          openInEditor(sql);
          setShowRecommendations(false);
          setSelectedEntity(null);
        }}
        database={selectedMDLHDatabase}
        schema={selectedMDLHSchema}
        availableTables={[...discoveredTables]}
        sampleEntities={sampleEntities}
      />
    </div>
    </SystemConfigProvider>
  );
}
