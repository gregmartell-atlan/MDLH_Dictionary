# MDLH Dictionary - Full Codebase Export

**Exported:** $(date)  
**Project:** MDLH (Metadata Lakehouse) Dictionary

This is a complete export of the MDLH Dictionary codebase for external review.

---

## Table of Contents

1. [Frontend - React Application](#frontend)
   - App.jsx (Main App)
   - Hooks (useSnowflake, useBackendInstanceGuard, useSystemConfig)
   - Components (QueryEditor, StepWizard, etc.)
   - Query Flows (recipes, builders, SQL generators)
   - Context (SystemConfigContext)
   - Utils (logger, suggestions, discovery)
   - Data (entities, queries, constants)

2. [Backend - FastAPI Application](#backend)
   - main.py (Entry point)
   - Routers (connection, query, metadata, system)
   - Services (session, cache, snowflake)
   - Utils (logger)

---



# FRONTEND


## src/App.jsx

```jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Download, Copy, Check, Code2, X, Search, Command, Play, Loader2, Sparkles, Eye, FlaskConical, ArrowLeft, Database, Snowflake, Settings, Wifi, WifiOff, ChevronDown } from 'lucide-react';
import QueryEditor from './components/QueryEditor';
import ShowMyWork from './components/ShowMyWork';
import FlyoutQueryEditor from './components/FlyoutQueryEditor';
import ConnectionModal from './components/ConnectionModal';
import QueryPanelShell from './components/QueryPanelShell';
import TestQueryLayout from './components/TestQueryLayout';
import QueryLibraryLayout from './components/QueryLibraryLayout';
import { useConnection } from './hooks/useSnowflake';
import { createLogger } from './utils/logger';
import { SystemConfigProvider } from './context/SystemConfigContext';
import { useBackendInstanceGuard } from './hooks/useBackendInstanceGuard';

// Scoped loggers for App
const appLog = createLogger('App');
const uiLog = createLogger('UI');

// Import data and utilities from extracted modules
import { entities as data } from './data/entities';
import { exampleQueries } from './data/exampleQueries';
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

// Global connection status indicator for header
// Shows 4 explicit states: Disconnected, Connecting, Connected, Unreachable
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
    disconnected: 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 hover:border-gray-300',
    connecting: 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100',
    connected: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
    unreachable: 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100'
  };
  
  const stateIcons = {
    disconnected: <div className="w-2 h-2 rounded-full bg-gray-400" />,
    connecting: <Loader2 size={14} className="animate-spin text-blue-500" />,
    connected: <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />,
    unreachable: <WifiOff size={14} className="text-red-500" />
  };
  
  const stateLabels = {
    disconnected: 'Disconnected',
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

  const snowflakeColors = {
    disconnected: 'text-gray-400',
    connecting: 'text-blue-500',
    connected: 'text-green-600',
    unreachable: 'text-red-400'
  };
  
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${stateStyles[state]}`}
      title={stateTitles[state]}
    >
      {stateIcons[state]}
      <span className="hidden sm:inline">
        {stateLabels[state]}
      </span>
      <Snowflake size={14} className={snowflakeColors[state]} />
    </button>
  );
}

// Banner component for displaying unreachable API warning
function UnreachableBanner({ onRetry }) {
  return (
    <div className="bg-red-50 border-b border-red-200 px-6 py-3">
      <div className="flex items-center justify-between max-w-full">
        <div className="flex items-center gap-3">
          <WifiOff size={18} className="text-red-500 flex-shrink-0" />
          <div>
            <div className="text-sm font-semibold text-red-800">
              MDLH API is not responding
            </div>
            <div className="text-xs text-red-600">
              Your Snowflake session may still be valid, but the MDLH service cannot be reached. 
              Try refreshing, checking VPN / network, or restarting the MDLH backend service.
            </div>
          </div>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="ml-4 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-md transition-colors flex-shrink-0"
          >
            Retry Connection
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
          
          // Pre-validate all queries
          if (tables.size > 0) {
            const validationMap = preValidateAllQueries(
              exampleQueries, 
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
  }, [isConnected, selectedMDLHDatabase, selectedMDLHSchema]);
  
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
  const filteredQueries = (exampleQueries[activeTab] || []).map((q, index) => {
    const queryId = `${activeTab}-${index}`;
    const validation = queryValidationMap.get(queryId);
    
    return {
      ...q,
      // Use fixed query if available
      query: validation?.fixedQuery || q.query,
      validation,
      queryId
    };
  }).filter(q => {
    // Search filter
    const matchesSearch = 
      q.title.toLowerCase().includes(search.toLowerCase()) ||
      q.description.toLowerCase().includes(search.toLowerCase()) ||
      q.query.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    
    // Availability filter
    if (showOnlyAvailable && isConnected && queryValidationMap.size > 0) {
      // Show valid queries and auto-fixed queries
      return q.validation?.valid !== false;
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
  const findQueryForEntity = (entityName, tableName) => {
    const allQueries = exampleQueries[activeTab] || [];
    
    if (!tableName || tableName === '(abstract)') return null;
    
    const tableNameLower = tableName.toLowerCase();
    const entityNameLower = entityName.toLowerCase();
    
    // Priority 1: Exact table name match in query SQL (e.g., "FROM TABLE_ENTITY" or "TABLE_ENTITY")
    let matchedQuery = allQueries.find(q => {
      const queryLower = q.query.toLowerCase();
      return (
        queryLower.includes(`from ${tableNameLower}`) ||
        queryLower.includes(`from\n    ${tableNameLower}`) ||
        queryLower.includes(`from\n${tableNameLower}`) ||
        queryLower.includes(`join ${tableNameLower}`) ||
        // Also check for the table name as a standalone reference
        new RegExp(`\\b${tableNameLower.replace(/_/g, '_')}\\b`).test(queryLower)
      );
    });
    
    // Priority 2: Entity name explicitly in title (e.g., "Table" in title for TABLE_ENTITY)
    if (!matchedQuery) {
      matchedQuery = allQueries.find(q => {
        const titleLower = q.title.toLowerCase();
        // Match singular entity name (e.g., "Column" for Column entity, "Table" for Table)
        return (
          titleLower.includes(entityNameLower) ||
          titleLower.includes(entityNameLower + 's') || // plural
          titleLower.includes(entityNameLower + ' ')
        );
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
      <nav className="border-b border-gray-200 bg-white sticky top-0 z-30">
        <div className="max-w-full mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[#3366FF] font-bold text-xl">atlan</span>
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
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-64 pl-9 pr-16 py-2 bg-white border border-gray-300 rounded-full text-sm focus:outline-none focus:border-[#3366FF] focus:ring-2 focus:ring-[#3366FF]/20 transition-all duration-200 placeholder-gray-400"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
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
          <h1 className="text-3xl font-semibold mb-3 italic">
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
          
          {/* Database & Schema Selector for Query Context */}
          <div className="flex flex-col items-center gap-2 mt-4">
            <div className="flex items-center gap-2">
              <Database size={14} className="text-blue-100" />
              <span className="text-sm text-blue-100">Query Context:</span>
              <select
                value={selectedMDLHDatabase}
                onChange={(e) => setSelectedMDLHDatabase(e.target.value)}
                className="px-3 py-1.5 bg-white/20 text-white border border-white/30 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer appearance-none"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '16px', paddingRight: '32px' }}
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
                className="px-3 py-1.5 bg-white/20 text-white border border-white/30 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer appearance-none"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '16px', paddingRight: '32px' }}
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
      
      {/* Not Connected Banner - Shows when disconnected to explain benefits */}
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
      <div className="max-w-full mx-auto px-6 py-6">
        {/* Tab Navigation - Entity tabs + Editor tab with visual separator */}
        <div className="flex flex-wrap items-center gap-2 mb-6 pb-4 border-b border-gray-200">
          {/* Entity category tabs */}
          {tabs.filter(t => !t.isEditor).map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-[#3366FF] text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-[#3366FF] hover:text-[#3366FF]'
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
          
          {/* Editor tab - visually distinct */}
          {tabs.filter(t => t.isEditor).map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                }`}
                title={tab.description}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
        
        {/* MDLH Context Header - shows current database.schema context */}
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
    </div>
    </SystemConfigProvider>
  );
}

```

## src/main.jsx

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { initGlobalErrorLogging } from './utils/errorLogging'

// Initialize global error capture before rendering
initGlobalErrorLogging();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

```



# HOOKS


## src/hooks/useSnowflake.js

```javascript
/**
 * Snowflake hooks - React hooks for managing Snowflake operations
 * 
 * Updated to use session-based backend with X-Session-ID headers.
 * Includes fetch timeout support and improved error handling.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { createLogger } from '../utils/logger';
import { TIMEOUTS, CONNECTION_CONFIG } from '../data/constants';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const SESSION_KEY = 'snowflake_session';
const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds default timeout

// =============================================================================
// Scoped Loggers
// =============================================================================
const sessionLog = createLogger('Session');
const connectionLog = createLogger('useConnection');
const queryLog = createLogger('useQuery');
const metadataLog = createLogger('useMetadata');
const preflightLog = createLogger('usePreflight');
const historyLog = createLogger('useQueryHistory');
const explainLog = createLogger('useQueryExplanation');
const batchLog = createLogger('useBatchValidation');

// =============================================================================
// Shared Helpers (DRY)
// =============================================================================

/**
 * Get session ID from sessionStorage
 * @returns {string|null} Session ID or null
 */
function getSessionId() {
  const stored = sessionStorage.getItem(SESSION_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      sessionLog.debug('getSessionId()', {
        hasSession: !!parsed.sessionId,
        sessionPrefix: parsed.sessionId?.substring(0, 8),
        database: parsed.database,
        schema: parsed.schema
      });
      return parsed.sessionId;
    } catch (e) {
      sessionLog.error('getSessionId() parse error', { error: e.message });
      return null;
    }
  }
  sessionLog.debug('getSessionId() - no session in storage');
  return null;
}

/**
 * Fetch with timeout wrapper - prevents hanging requests
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @param {number} timeoutMs - Timeout in milliseconds (default: 30000)
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { 
      ...options, 
      signal: controller.signal 
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

// =============================================================================
// Session Management Hook
// =============================================================================

export function useConnection() {
  const [status, setStatus] = useState({ connected: false, unreachable: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const testConnectionRef = useRef(null);
  const testingInProgressRef = useRef(false); // Guard against double-calls
  const consecutiveStatusTimeoutsRef = useRef(0); // Track consecutive timeouts

  // Get session from storage
  const getStoredSession = useCallback(() => {
    const storedRaw = sessionStorage.getItem(SESSION_KEY);
    connectionLog.debug('getStoredSession()', { 
      hasValue: !!storedRaw,
      preview: storedRaw ? `${storedRaw.substring(0, 50)}...` : 'NULL'
    });
    
    if (storedRaw) {
      try {
        const parsed = JSON.parse(storedRaw);
        connectionLog.debug('getStoredSession() - parsed', {
          hasSessionId: !!parsed.sessionId,
          sessionIdPrefix: parsed.sessionId?.substring(0, 8) || 'N/A',
          database: parsed.database || 'N/A',
          keys: Object.keys(parsed)
        });
        return parsed;
      } catch (e) {
        connectionLog.error('getStoredSession() - parse error, clearing key', { error: e.message });
        sessionStorage.removeItem(SESSION_KEY);
      }
    }
    return null;
  }, []);

  // Check if session is valid
  // FIX: Don't delete session on network errors - only on explicit 401/404
  // FIX: After N consecutive timeouts, mark as unreachable
  const testConnection = useCallback(async () => {
    // Guard against double-calls (React StrictMode, rapid re-renders)
    if (testingInProgressRef.current) {
      connectionLog.debug('testConnection() already in progress - skipping');
      return status || { connected: false, unreachable: false };
    }
    testingInProgressRef.current = true;

    connectionLog.info('testConnection() called');
    setLoading(true);
    setError(null);

    const stored = getStoredSession();
    
    if (!stored?.sessionId) {
      connectionLog.warn('testConnection() - no stored session, setting connected=false');
      consecutiveStatusTimeoutsRef.current = 0;
      setStatus({ connected: false, unreachable: false });
      setLoading(false);
      testingInProgressRef.current = false;
      return { connected: false, unreachable: false };
    }

    connectionLog.info('testConnection() - checking session with backend', {
      sessionIdPrefix: stored.sessionId.substring(0, 8),
      database: stored.database,
      schema: stored.schema
    });

    const endTimer = connectionLog.time('Backend session check');

    try {
      const res = await fetchWithTimeout(
        `${API_URL}/api/session/status`,
        { headers: { 'X-Session-ID': stored.sessionId } },
        TIMEOUTS.SESSION_STATUS_MS
      );
      
      const durationMs = endTimer({ status: res.status, ok: res.ok });

      // Check for explicit "session invalid" responses
      if (res.status === 401 || res.status === 404) {
        connectionLog.warn('Session explicitly invalid (401/404) - removing from storage', { status: res.status });
        sessionStorage.removeItem(SESSION_KEY);
        consecutiveStatusTimeoutsRef.current = 0;
        setStatus({ connected: false, unreachable: false });
        setLoading(false);
        testingInProgressRef.current = false;
        return { connected: false, unreachable: false };
      }

      // Check for 503 (backend/Snowflake unreachable)
      if (res.status === 503) {
        consecutiveStatusTimeoutsRef.current += 1;
        connectionLog.warn('Backend returned 503 (Snowflake unreachable)', {
          consecutiveTimeouts: consecutiveStatusTimeoutsRef.current
        });
        
        // Fall through to timeout threshold check below
        throw new Error('Backend returned 503');
      }

      const data = await res.json();
      connectionLog.debug('Session status response', {
        valid: data.valid,
        user: data.user,
        database: data.database,
        durationMs
      });
      
      if (data.valid) {
        const sessionStatus = {
          connected: true,
          unreachable: false,
          sessionId: stored.sessionId,
          user: data.user,
          warehouse: data.warehouse,
          database: data.database,
          schema: data.schema_name,
          role: data.role
        };
        consecutiveStatusTimeoutsRef.current = 0; // Reset on success
        setStatus(sessionStatus);
        setLoading(false);
        testingInProgressRef.current = false;
        connectionLog.info('Session VALID - connected', { database: data.database, user: data.user });
        return sessionStatus;
      } else {
        connectionLog.warn('Backend says session INVALID - removing from storage', { data });
        sessionStorage.removeItem(SESSION_KEY);
        consecutiveStatusTimeoutsRef.current = 0;
        setStatus({ connected: false, unreachable: false });
        setLoading(false);
        testingInProgressRef.current = false;
        return { connected: false, unreachable: false };
      }
    } catch (err) {
      const isTimeout = err.name === 'AbortError';

      if (isTimeout) {
        consecutiveStatusTimeoutsRef.current += 1;
        connectionLog.warn('Session check TIMED OUT', { 
          sessionIdPrefix: stored.sessionId.substring(0, 8),
          consecutiveTimeouts: consecutiveStatusTimeoutsRef.current
        });
      } else {
        consecutiveStatusTimeoutsRef.current += 1;
        connectionLog.warn('Session check NETWORK ERROR', {
          message: err.message,
          sessionIdPrefix: stored.sessionId.substring(0, 8),
          consecutiveTimeouts: consecutiveStatusTimeoutsRef.current
        });
      }

      // After N timeouts -> mark backend unreachable
      if (consecutiveStatusTimeoutsRef.current >= CONNECTION_CONFIG.TIMEOUT_THRESHOLD) {
        connectionLog.warn('Too many session check timeouts - marking disconnected & unreachable');
        const unreachableStatus = {
          connected: false,
          unreachable: true
        };
        setStatus(unreachableStatus);
        setError('MDLH API is unreachable. Please check your connection or restart the app.');
        setLoading(false);
        testingInProgressRef.current = false;
        return unreachableStatus;
      }

      // Below threshold → optimistic mode: trust stored session
      const assumedSessionStatus = {
        connected: true,
        unreachable: false,
        sessionId: stored.sessionId,
        user: stored.user || 'unknown',
        warehouse: stored.warehouse,
        database: stored.database,
        schema: stored.schema,
        role: stored.role
      };
      setStatus(assumedSessionStatus);
      setLoading(false);
      testingInProgressRef.current = false;
      connectionLog.info('Keeping session valid despite backend unreachable (below threshold)', { 
        database: stored.database,
        consecutiveTimeouts: consecutiveStatusTimeoutsRef.current
      });
      return assumedSessionStatus;
    }
  }, [getStoredSession, status]);

  // Store ref for useEffect
  testConnectionRef.current = testConnection;

  // Listen for session change events (dispatched by ConnectionModal)
  // This ensures all useConnection() instances stay in sync
  useEffect(() => {
    const handleSessionChange = (event) => {
      connectionLog.debug('Session change event received in hook', { 
        connected: event.detail?.connected,
        hasSessionId: !!event.detail?.sessionId
      });
      
      // Re-check connection status when session changes
      testConnectionRef.current?.();
    };
    
    window.addEventListener('snowflake-session-changed', handleSessionChange);
    
    return () => {
      window.removeEventListener('snowflake-session-changed', handleSessionChange);
    };
  }, []);

  // Disconnect
  const disconnect = useCallback(async () => {
    connectionLog.info('disconnect() called');
    const stored = getStoredSession();
    if (stored?.sessionId) {
      try {
        const endTimer = connectionLog.time('Backend disconnect');
        await fetchWithTimeout(
          `${API_URL}/api/disconnect`,
          {
            method: 'POST',
            headers: { 'X-Session-ID': stored.sessionId }
          },
          TIMEOUTS.SESSION_STATUS_MS
        );
        endTimer();
        connectionLog.info('Disconnected from backend');
      } catch (err) {
        if (err.name !== 'AbortError') {
          connectionLog.warn('Disconnect request failed', { message: err.message });
        }
      }
    }
    sessionStorage.removeItem(SESSION_KEY);
    consecutiveStatusTimeoutsRef.current = 0;
    setStatus({ connected: false, unreachable: false });
    setError(null);
    connectionLog.info('Session cleared');
  }, [getStoredSession]);

  // Load session on mount
  useEffect(() => {
    connectionLog.debug('useConnection mounted - checking existing session');
    testConnectionRef.current?.();
  }, []);

  // Listen for session cleared events (e.g., from backend restart detection)
  useEffect(() => {
    function handleSessionCleared(event) {
      connectionLog.info('Session cleared by external event', { reason: event.detail?.reason });
      consecutiveStatusTimeoutsRef.current = 0;
      setStatus({ connected: false, unreachable: false });
      setError(null);
    }

    window.addEventListener('snowflake-session-cleared', handleSessionCleared);
    return () => {
      window.removeEventListener('snowflake-session-cleared', handleSessionCleared);
    };
  }, []);

  return { status, testConnection, disconnect, loading, error, getSessionId: () => getSessionId() };
}

// =============================================================================
// Query Execution Hook
// =============================================================================

export function useQuery(connectionStatus = null) {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check if backend is unreachable (passed from parent component's useConnection)
  const backendUnreachable = connectionStatus?.unreachable === true;

  const executeQuery = useCallback(async (sql, options = {}) => {
    // Early exit if backend is known to be unreachable
    if (backendUnreachable) {
      queryLog.warn('executeQuery() - backend unreachable, aborting');
      setError('MDLH API is unreachable. Queries cannot be run right now.');
      return null;
    }

    const sessionId = getSessionId();
    
    queryLog.info('executeQuery() called', {
      hasSession: !!sessionId,
      sqlPreview: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
      database: options.database,
      schema: options.schema
    });

    if (!sessionId) {
      queryLog.warn('executeQuery() - no active session, aborting');
      setError('Not connected. Please connect to Snowflake first.');
      return null;
    }

    setLoading(true);
    setError(null);

    const endTimer = queryLog.time('Query execution');

    try {
      const timeoutSeconds = options.timeout || 60;
      const timeoutMs = timeoutSeconds * 1000 + TIMEOUTS.QUERY_EXECUTE_BUFFER_MS;
      
      const response = await fetchWithTimeout(
        `${API_URL}/api/query/execute`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-ID': sessionId
          },
          body: JSON.stringify({
            sql,
            database: options.database,
            schema_name: options.schema,
            warehouse: options.warehouse,
            timeout: timeoutSeconds,
            limit: options.limit || 10000
          })
        },
        timeoutMs
      );

      queryLog.debug('executeQuery() - response meta', {
        status: response.status,
        ok: response.ok
      });

      // Handle session expiration
      if (response.status === 401) {
        queryLog.warn('Session expired (401) - clearing session');
        sessionStorage.removeItem(SESSION_KEY);
        setError('Session expired. Please reconnect.');
        setResults(null);
        endTimer({ status: 'session-expired' });
        return null;
      }

      const data = await response.json();
      queryLog.debug('executeQuery() - response body', {
        status: data.status,
        queryId: data.query_id,
        rowCount: data.row_count
      });

      if (data.status === 'SUCCESS') {
        // Fetch results
        const resultsRes = await fetchWithTimeout(
          `${API_URL}/api/query/${data.query_id}/results`,
          { headers: { 'X-Session-ID': sessionId } },
          TIMEOUTS.QUERY_RESULTS_MS
        );
        
        if (!resultsRes.ok) {
          queryLog.warn('Results fetch failed, using execute response', { status: resultsRes.status });
          const result = {
            columns: [],
            rows: [],
            rowCount: data.row_count || 0,
            executionTime: data.execution_time_ms,
            warning: `Results fetch failed: ${resultsRes.status}`
          };
          setResults(result);
          endTimer({ rowCount: result.rowCount, status: 'partial' });
          return result;
        }
        
        const resultsData = await resultsRes.json();

        const result = {
          columns: resultsData.columns || [],
          rows: resultsData.rows || [],
          rowCount: resultsData.total_rows ?? resultsData.rows?.length ?? data.row_count ?? 0,
          executionTime: data.execution_time_ms
        };
        setResults(result);
        
        const durationMs = endTimer({ rowCount: result.rowCount, status: 'success' });
        queryLog.info('executeQuery() - success', {
          rowCount: result.rowCount,
          columnCount: result.columns.length,
          executionTimeMs: result.executionTime,
          totalDurationMs: durationMs
        });
        
        return result;
      } else {
        queryLog.error('executeQuery() - backend returned error', { message: data.message });
        setError(data.message || 'Query failed');
        endTimer({ status: 'error' });
        return { success: false, error: data.message };
      }
    } catch (err) {
      const isTimeout = err.name === 'AbortError';
      const errorMsg = isTimeout 
        ? 'Query timed out. Try a shorter query, narrower filter, or increase the timeout.'
        : (err.message || 'Query failed');
      queryLog.error('executeQuery() - exception', {
        message: err.message,
        isTimeout
      });
      setError(errorMsg);
      endTimer({ status: isTimeout ? 'timeout' : 'exception' });
      return null;
    } finally {
      setLoading(false);
    }
  }, [backendUnreachable]);

  const clearResults = useCallback(() => {
    queryLog.debug('clearResults() called');
    setResults(null);
    setError(null);
  }, []);

  return { results, loading, error, executeQuery, clearResults };
}

// =============================================================================
// Preflight Check Hook
// =============================================================================

export function usePreflight() {
  const [preflightResult, setPreflightResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const runPreflight = useCallback(async (sql, options = {}) => {
    const sessionId = getSessionId();
    
    preflightLog.info('runPreflight() called', {
      hasSession: !!sessionId,
      sqlPreview: sql.substring(0, 80) + (sql.length > 80 ? '...' : '')
    });

    if (!sessionId) {
      preflightLog.warn('runPreflight() - no session');
      return { valid: false, message: 'Not connected' };
    }

    setLoading(true);
    setPreflightResult(null);

    const endTimer = preflightLog.time('Preflight check');

    try {
      const response = await fetchWithTimeout(
        `${API_URL}/api/query/preflight`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-ID': sessionId
          },
          body: JSON.stringify({
            sql,
            database: options.database,
            schema_name: options.schema
          })
        },
        15000
      );

      if (response.status === 401) {
        preflightLog.warn('Session expired during preflight');
        sessionStorage.removeItem(SESSION_KEY);
        return { valid: false, message: 'Session expired' };
      }

      const data = await response.json();
      setPreflightResult(data);
      
      endTimer({ valid: data.valid, issueCount: data.issues?.length || 0 });
      preflightLog.info('runPreflight() - complete', { valid: data.valid });
      
      return data;
    } catch (err) {
      const errorMsg = err.name === 'AbortError' 
        ? 'Preflight check timed out' 
        : err.message;
      preflightLog.error('runPreflight() - failed', { message: errorMsg });
      const error = { valid: false, message: errorMsg, issues: [errorMsg] };
      setPreflightResult(error);
      endTimer({ valid: false, error: true });
      return error;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearPreflight = useCallback(() => {
    preflightLog.debug('clearPreflight() called');
    setPreflightResult(null);
  }, []);

  return { preflightResult, loading, runPreflight, clearPreflight };
}

// =============================================================================
// Query History Hook
// =============================================================================

export function useQueryHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    const sessionId = getSessionId();
    if (!sessionId) {
      historyLog.warn('fetchHistory() - no session ID');
      return;
    }

    historyLog.info('fetchHistory() called');
    setLoading(true);
    
    const endTimer = historyLog.time('Fetch history');
    
    try {
      const res = await fetchWithTimeout(
        `${API_URL}/api/query/history?limit=50`,
        { headers: { 'X-Session-ID': sessionId } },
        10000
      );
      const data = await res.json();
      setHistory(data.items || []);
      endTimer({ itemCount: data.items?.length || 0 });
      historyLog.info('fetchHistory() - success', { itemCount: data.items?.length || 0 });
    } catch (err) {
      if (err.name !== 'AbortError') {
        historyLog.error('fetchHistory() - failed', { message: err.message });
      }
      endTimer({ error: true });
    } finally {
      setLoading(false);
    }
  }, []);

  return { history, fetchHistory, loading };
}

// =============================================================================
// Metadata Hook
// =============================================================================

export function useMetadata(connectionStatus = null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check if backend is unreachable (passed from parent component's useConnection)
  const backendUnreachable = connectionStatus?.unreachable === true;

  // Debouncing refs to prevent hammering the backend
  const lastDbRequestRef = useRef({ ts: 0, inFlight: false });
  const lastSchemaRequestRef = useRef({ ts: 0, inFlight: false, database: null });
  const lastTablesRequestRef = useRef({ ts: 0, inFlight: false, database: null, schema: null });

  const fetchDatabases = useCallback(async (refresh = false) => {
    const sessionId = getSessionId();
    if (!sessionId) {
      metadataLog.warn('fetchDatabases() - no session');
      return [];
    }

    // Early exit if backend is unreachable (unless explicitly refreshing)
    if (backendUnreachable && !refresh) {
      metadataLog.warn('fetchDatabases() - backend unreachable, aborting');
      setError('MDLH API is unreachable. Metadata cannot be refreshed right now.');
      return [];
    }

    const now = Date.now();

    // Debounce: skip if already in-flight or last attempt was <5s ago (unless refresh)
    if (!refresh) {
      if (lastDbRequestRef.current.inFlight) {
        metadataLog.debug('fetchDatabases() - skipped (already in flight)');
        return [];
      }
      if (now - lastDbRequestRef.current.ts < TIMEOUTS.DEBOUNCE_MS) {
        metadataLog.debug('fetchDatabases() - skipped (debounced)');
        return [];
      }
    }

    lastDbRequestRef.current = { ts: now, inFlight: true };

    metadataLog.info('fetchDatabases() called', { refresh });
    setLoading(true);
    
    const endTimer = metadataLog.time('Fetch databases');
    
    try {
      const res = await fetchWithTimeout(
        `${API_URL}/api/metadata/databases?refresh=${refresh}`,
        { headers: { 'X-Session-ID': sessionId } },
        TIMEOUTS.METADATA_DB_MS
      );

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        metadataLog.error('fetchDatabases() - non-OK response', {
          status: res.status,
          bodyPreview: text.substring(0, 200)
        });
        setError(`Failed to fetch databases: ${res.status}`);
        endTimer({ error: true, status: res.status });
        return [];
      }

      const data = await res.json();
      endTimer({ count: Array.isArray(data) ? data.length : 0 });
      metadataLog.debug('fetchDatabases() - success', { count: Array.isArray(data) ? data.length : 0 });
      return data;
    } catch (err) {
      const errorMsg = err.name === 'AbortError' ? 'Request timed out' : err.message;
      metadataLog.error('fetchDatabases() - failed', { message: errorMsg });
      setError(errorMsg);
      endTimer({ error: true });
      return [];
    } finally {
      lastDbRequestRef.current.inFlight = false;
      setLoading(false);
    }
  }, [backendUnreachable]);

  const fetchSchemas = useCallback(async (database, refresh = false) => {
    const sessionId = getSessionId();
    if (!sessionId) {
      metadataLog.warn('fetchSchemas() - no session');
      return [];
    }

    // Early exit if backend is unreachable (unless explicitly refreshing)
    if (backendUnreachable && !refresh) {
      metadataLog.warn('fetchSchemas() - backend unreachable, aborting');
      return [];
    }

    const now = Date.now();

    // Debounce: skip if already in-flight for same database, or last attempt was <5s ago
    if (!refresh) {
      if (lastSchemaRequestRef.current.inFlight && lastSchemaRequestRef.current.database === database) {
        metadataLog.debug('fetchSchemas() - skipped (already in flight for this database)');
        return [];
      }
      if (lastSchemaRequestRef.current.database === database && 
          now - lastSchemaRequestRef.current.ts < TIMEOUTS.DEBOUNCE_MS) {
        metadataLog.debug('fetchSchemas() - skipped (debounced)');
        return [];
      }
    }

    lastSchemaRequestRef.current = { ts: now, inFlight: true, database };

    metadataLog.info('fetchSchemas() called', { database, refresh });
    setLoading(true);
    
    const endTimer = metadataLog.time(`Fetch schemas for ${database}`);
    
    try {
      const res = await fetchWithTimeout(
        `${API_URL}/api/metadata/schemas?database=${encodeURIComponent(database)}&refresh=${refresh}`,
        { headers: { 'X-Session-ID': sessionId } },
        TIMEOUTS.METADATA_SCHEMAS_MS
      );
      const data = await res.json();
      endTimer({ count: Array.isArray(data) ? data.length : 0 });
      return data;
    } catch (err) {
      const errorMsg = err.name === 'AbortError' ? 'Request timed out' : err.message;
      metadataLog.error('fetchSchemas() - failed', { database, message: errorMsg });
      setError(errorMsg);
      endTimer({ error: true });
      return [];
    } finally {
      lastSchemaRequestRef.current.inFlight = false;
      setLoading(false);
    }
  }, [backendUnreachable]);

  const fetchTables = useCallback(async (database, schema, refresh = false) => {
    const sessionId = getSessionId();
    if (!sessionId) {
      metadataLog.warn('fetchTables() - no session');
      return [];
    }

    // Early exit if backend is unreachable (unless explicitly refreshing)
    if (backendUnreachable && !refresh) {
      metadataLog.warn('fetchTables() - backend unreachable, aborting');
      return [];
    }

    const now = Date.now();

    // Debounce: skip if already in-flight for same db.schema, or last attempt was <5s ago
    if (!refresh) {
      if (lastTablesRequestRef.current.inFlight && 
          lastTablesRequestRef.current.database === database &&
          lastTablesRequestRef.current.schema === schema) {
        metadataLog.debug('fetchTables() - skipped (already in flight for this db.schema)');
        return [];
      }
      if (lastTablesRequestRef.current.database === database && 
          lastTablesRequestRef.current.schema === schema &&
          now - lastTablesRequestRef.current.ts < TIMEOUTS.DEBOUNCE_MS) {
        metadataLog.debug('fetchTables() - skipped (debounced)');
        return [];
      }
    }

    lastTablesRequestRef.current = { ts: now, inFlight: true, database, schema };

    metadataLog.info('fetchTables() called', { database, schema, refresh });
    setLoading(true);
    
    const endTimer = metadataLog.time(`Fetch tables for ${database}.${schema}`);
    
    try {
      const res = await fetchWithTimeout(
        `${API_URL}/api/metadata/tables?database=${encodeURIComponent(database)}&schema=${encodeURIComponent(schema)}&refresh=${refresh}`,
        { headers: { 'X-Session-ID': sessionId } },
        TIMEOUTS.METADATA_TABLES_MS
      );
      const data = await res.json();
      endTimer({ count: Array.isArray(data) ? data.length : 0 });
      metadataLog.debug('fetchTables() - success', { count: Array.isArray(data) ? data.length : 0 });
      return data;
    } catch (err) {
      const errorMsg = err.name === 'AbortError' ? 'Request timed out' : err.message;
      metadataLog.error('fetchTables() - failed', { database, schema, message: errorMsg });
      setError(errorMsg);
      endTimer({ error: true });
      return [];
    } finally {
      lastTablesRequestRef.current.inFlight = false;
      setLoading(false);
    }
  }, [backendUnreachable]);

  const fetchColumns = useCallback(async (database, schema, table, refresh = false) => {
    const sessionId = getSessionId();
    if (!sessionId) {
      metadataLog.warn('fetchColumns() - no session');
      return [];
    }

    // Early exit if backend is unreachable (unless explicitly refreshing)
    if (backendUnreachable && !refresh) {
      metadataLog.warn('fetchColumns() - backend unreachable, aborting');
      return [];
    }

    metadataLog.debug('fetchColumns() called', { database, schema, table, refresh });
    setLoading(true);
    
    const endTimer = metadataLog.time(`Fetch columns for ${database}.${schema}.${table}`);
    
    try {
      const res = await fetchWithTimeout(
        `${API_URL}/api/metadata/columns?database=${encodeURIComponent(database)}&schema=${encodeURIComponent(schema)}&table=${encodeURIComponent(table)}&refresh=${refresh}`,
        { headers: { 'X-Session-ID': sessionId } },
        TIMEOUTS.METADATA_SCHEMAS_MS
      );
      const data = await res.json();
      endTimer({ count: Array.isArray(data) ? data.length : 0 });
      return data;
    } catch (err) {
      const errorMsg = err.name === 'AbortError' ? 'Request timed out' : err.message;
      metadataLog.error('fetchColumns() - failed', { table, message: errorMsg });
      setError(errorMsg);
      endTimer({ error: true });
      return [];
    } finally {
      setLoading(false);
    }
  }, [backendUnreachable]);

  const refreshCache = useCallback(async () => {
    metadataLog.info('refreshCache() called');
    setLoading(true);
    try {
      await fetchDatabases(true);
      metadataLog.info('refreshCache() - complete');
    } finally {
      setLoading(false);
    }
  }, [fetchDatabases]);

  return {
    loading,
    error,
    fetchDatabases,
    fetchSchemas,
    fetchTables,
    fetchColumns,
    refreshCache
  };
}

// =============================================================================
// Batch Validation Hook
// =============================================================================

export function useBatchValidation() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const validateBatch = useCallback(async (queries, options = {}) => {
    const sessionId = getSessionId();
    
    batchLog.info('validateBatch() called', {
      hasSession: !!sessionId,
      queryCount: queries.length,
      database: options.database
    });

    if (!sessionId) {
      batchLog.warn('validateBatch() - no session');
      setError('Not connected');
      return null;
    }

    setLoading(true);
    setError(null);

    const endTimer = batchLog.time('Batch validation');

    try {
      const response = await fetchWithTimeout(
        `${API_URL}/api/query/validate-batch`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-ID': sessionId
          },
          body: JSON.stringify({
            queries,
            database: options.database,
            schema_name: options.schema,
            include_samples: options.includeSamples ?? true,
            sample_limit: options.sampleLimit ?? 3
          })
        },
        60000
      );

      if (response.status === 401) {
        batchLog.warn('Session expired during batch validation');
        sessionStorage.removeItem(SESSION_KEY);
        setError('Session expired');
        endTimer({ error: 'session_expired' });
        return null;
      }

      const data = await response.json();
      setResults(data);
      
      const validCount = data.results?.filter(r => r.valid).length || 0;
      endTimer({ validCount, totalCount: queries.length });
      batchLog.info('validateBatch() - complete', { validCount, totalCount: queries.length });
      
      return data;
    } catch (err) {
      const errorMsg = err.name === 'AbortError' 
        ? 'Batch validation timed out' 
        : err.message;
      batchLog.error('validateBatch() - failed', { message: errorMsg });
      setError(errorMsg);
      endTimer({ error: true });
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    batchLog.debug('clearResults() called');
    setResults(null);
    setError(null);
  }, []);

  return { results, loading, error, validateBatch, clearResults };
}

// =============================================================================
// Query Explanation Hook
// =============================================================================

export function useQueryExplanation() {
  const [explanation, setExplanation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const explainQuery = useCallback(async (sql, options = {}) => {
    const sessionId = getSessionId();
    
    explainLog.info('explainQuery() called', {
      hasSession: !!sessionId,
      sqlPreview: sql.substring(0, 80) + (sql.length > 80 ? '...' : '')
    });
    
    setLoading(true);
    setError(null);

    const endTimer = explainLog.time('Query explanation');

    try {
      const response = await fetchWithTimeout(
        `${API_URL}/api/query/explain`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(sessionId && { 'X-Session-ID': sessionId })
          },
          body: JSON.stringify({
            sql,
            include_execution: options.includeExecution ?? !!sessionId
          })
        },
        30000
      );

      if (response.status === 401) {
        explainLog.warn('Session expired during explain');
        sessionStorage.removeItem(SESSION_KEY);
      }

      const data = await response.json();
      setExplanation(data);
      
      endTimer({ hasExplanation: !!data.explanation });
      explainLog.info('explainQuery() - complete');
      
      return data;
    } catch (err) {
      const errorMsg = err.name === 'AbortError' 
        ? 'Query explanation timed out' 
        : err.message;
      explainLog.error('explainQuery() - failed', { message: errorMsg });
      setError(errorMsg);
      endTimer({ error: true });
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearExplanation = useCallback(() => {
    explainLog.debug('clearExplanation() called');
    setExplanation(null);
    setError(null);
  }, []);

  return { explanation, loading, error, explainQuery, clearExplanation };
}

export default { useConnection, useQuery, useQueryHistory, useMetadata, usePreflight, useBatchValidation, useQueryExplanation };

```

## src/hooks/useBackendInstanceGuard.js

```javascript
/**
 * useBackendInstanceGuard Hook
 * 
 * Detects when the backend has restarted and clears stale sessions.
 * 
 * The backend generates a unique SERVER_INSTANCE_ID on startup.
 * When the frontend loads, it compares the current backend instance ID
 * to the one it saw last time. If they differ, the backend has restarted
 * and any stored session ID is stale.
 * 
 * This prevents the "zombie session" problem where:
 * - Backend restarts (losing all session state)
 * - Frontend still has a sessionId in sessionStorage
 * - API calls fail mysteriously because the session doesn't exist
 * 
 * Result: After backend restart, user sees "Not connected" and can cleanly reconnect.
 */

import { useEffect, useRef } from 'react';
import { createLogger } from '../utils/logger';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Keys in sessionStorage
const BACKEND_INSTANCE_KEY = 'MDLH_BACKEND_INSTANCE_ID';
const SESSION_KEY = 'snowflake_session'; // Must match useSnowflake.js

const log = createLogger('BackendGuard');

/**
 * Hook that runs on app load to detect backend restarts.
 * 
 * If the backend has restarted since last visit:
 * - Clears the stale session from sessionStorage
 * - User will see "Not connected" state and can reconnect cleanly
 * 
 * Usage:
 * ```jsx
 * function App() {
 *   useBackendInstanceGuard();
 *   // rest of app...
 * }
 * ```
 */
export function useBackendInstanceGuard() {
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    // Only run once per app mount
    if (hasCheckedRef.current) {
      return;
    }
    hasCheckedRef.current = true;

    async function checkBackendInstance() {
      try {
        const res = await fetch(`${API_URL}/health`, {
          // Short timeout - this is just a quick check
          signal: AbortSignal.timeout(5000),
        });

        if (!res.ok) {
          log.warn('Health check failed', { status: res.status });
          return;
        }

        const data = await res.json();
        const newInstanceId = data.serverInstanceId;

        if (!newInstanceId) {
          log.debug('No serverInstanceId in health response (old backend?)');
          return;
        }

        const storedInstanceId = window.sessionStorage.getItem(BACKEND_INSTANCE_KEY);

        // First run: just store the instance ID
        if (!storedInstanceId) {
          log.info('First visit - storing backend instance ID', { 
            instanceId: newInstanceId.substring(0, 8) + '...' 
          });
          window.sessionStorage.setItem(BACKEND_INSTANCE_KEY, newInstanceId);
          return;
        }

        // Check if backend restarted
        if (storedInstanceId !== newInstanceId) {
          log.warn('Backend restarted - clearing stale session', {
            oldInstance: storedInstanceId.substring(0, 8) + '...',
            newInstance: newInstanceId.substring(0, 8) + '...',
          });

          // Clear the stale session
          const hadSession = !!window.sessionStorage.getItem(SESSION_KEY);
          window.sessionStorage.removeItem(SESSION_KEY);
          
          // Store the new instance ID
          window.sessionStorage.setItem(BACKEND_INSTANCE_KEY, newInstanceId);

          if (hadSession) {
            log.info('Stale session cleared - user will need to reconnect');
            
            // Dispatch a custom event so components can react
            window.dispatchEvent(new CustomEvent('snowflake-session-cleared', {
              detail: { reason: 'backend-restart' }
            }));
          }
        } else {
          log.debug('Backend instance unchanged', { 
            instanceId: newInstanceId.substring(0, 8) + '...' 
          });
        }
      } catch (err) {
        // If health check fails, don't worry about it
        // The regular connection flow will handle errors
        if (err.name === 'TimeoutError' || err.name === 'AbortError') {
          log.debug('Health check timed out - backend may be slow/unreachable');
        } else {
          log.debug('Health check failed', { error: err.message });
        }
      }
    }

    checkBackendInstance();
  }, []);
}

/**
 * Utility to manually check if the backend has restarted.
 * Useful for programmatic checks outside React.
 * 
 * @returns {Promise<{restarted: boolean, cleared: boolean}>}
 */
export async function checkBackendRestart() {
  try {
    const res = await fetch(`${API_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return { restarted: false, cleared: false };
    }

    const data = await res.json();
    const newInstanceId = data.serverInstanceId;

    if (!newInstanceId) {
      return { restarted: false, cleared: false };
    }

    const storedInstanceId = window.sessionStorage.getItem(BACKEND_INSTANCE_KEY);

    if (!storedInstanceId) {
      window.sessionStorage.setItem(BACKEND_INSTANCE_KEY, newInstanceId);
      return { restarted: false, cleared: false };
    }

    if (storedInstanceId !== newInstanceId) {
      const hadSession = !!window.sessionStorage.getItem(SESSION_KEY);
      window.sessionStorage.removeItem(SESSION_KEY);
      window.sessionStorage.setItem(BACKEND_INSTANCE_KEY, newInstanceId);
      
      return { restarted: true, cleared: hadSession };
    }

    return { restarted: false, cleared: false };
  } catch {
    return { restarted: false, cleared: false };
  }
}

export default useBackendInstanceGuard;


```

## src/hooks/useSystemConfig.js

```javascript
/**
 * useSystemConfig Hook
 * 
 * Fetches and manages the SystemConfig from the backend.
 * This is the SINGLE SOURCE OF TRUTH for what's available in this Snowflake environment.
 * 
 * The SystemConfig contains:
 * - snowflake.entities: Map of logical entity names to physical locations
 * - queryDefaults: Default metadata DB/schema, row limits, timeouts
 * - features: Feature flags (lineage, glossary, dbt, etc.)
 * - catalog: Table/column catalog for suggestions
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useConnection } from './useSnowflake';
import { createLogger } from '../utils/logger';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const log = createLogger('useSystemConfig');

/**
 * Hook to fetch and manage SystemConfig.
 * 
 * Usage:
 * ```jsx
 * const { config, loading, error, refresh } = useSystemConfig();
 * 
 * // Access entities
 * const processTable = config?.snowflake?.entities?.PROCESS_ENTITY;
 * 
 * // Check features
 * const hasLineage = config?.features?.lineage;
 * ```
 */
export function useSystemConfig() {
  const { status: connStatus, getSessionId } = useConnection();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Prevent duplicate fetches
  const fetchingRef = useRef(false);
  const lastSessionRef = useRef(null);

  /**
   * Fetch the config from the backend.
   */
  const fetchConfig = useCallback(async (sessionId) => {
    if (!sessionId) {
      log.debug('fetchConfig: No session ID, skipping');
      return null;
    }

    if (fetchingRef.current) {
      log.debug('fetchConfig: Already fetching, skipping');
      return null;
    }

    fetchingRef.current = true;
    setLoading(true);
    setError(null);

    log.info('Fetching system config...');

    try {
      const response = await fetch(`${API_URL}/api/system/config?session_id=${sessionId}`, {
        headers: {
          'X-Session-ID': sessionId,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Session expired');
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      log.info('System config loaded', {
        entities: Object.keys(data?.snowflake?.entities || {}).length,
        tables: data?.catalog?.tables?.length || 0,
        features: data?.features,
      });

      setConfig(data);
      return data;
    } catch (err) {
      const errorMsg = err.message || 'Failed to load system config';
      log.error('Config fetch failed', { error: errorMsg });
      setError(errorMsg);
      return null;
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  /**
   * Refresh the config (force re-discovery).
   */
  const refresh = useCallback(async () => {
    const sessionId = getSessionId?.() || connStatus?.sessionId;
    if (!sessionId) {
      log.warn('refresh: No session ID');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/system/config/refresh?session_id=${sessionId}`, {
        method: 'POST',
        headers: {
          'X-Session-ID': sessionId,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      log.info('System config refreshed', {
        entities: Object.keys(data?.snowflake?.entities || {}).length,
      });

      setConfig(data);
    } catch (err) {
      log.error('Config refresh failed', { error: err.message });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [getSessionId, connStatus]);

  // Fetch config when connection becomes active
  useEffect(() => {
    const sessionId = getSessionId?.() || connStatus?.sessionId;
    const isConnected = connStatus?.connected;

    // Only fetch if connected and session changed
    if (isConnected && sessionId && sessionId !== lastSessionRef.current) {
      lastSessionRef.current = sessionId;
      fetchConfig(sessionId);
    }

    // Clear config if disconnected
    if (!isConnected && config) {
      log.debug('Connection lost, clearing config');
      setConfig(null);
      lastSessionRef.current = null;
    }
  }, [connStatus, getSessionId, fetchConfig, config]);

  return {
    config,
    loading,
    error,
    refresh,
    
    // Convenience accessors
    entities: config?.snowflake?.entities || {},
    features: config?.features || {},
    queryDefaults: config?.queryDefaults || {},
    catalog: config?.catalog || { tables: [], columns: [] },
    
    // Check if a specific entity exists
    hasEntity: (entityName) => !!config?.snowflake?.entities?.[entityName],
    
    // Get entity location
    getEntity: (entityName) => config?.snowflake?.entities?.[entityName] || null,
    
    // Get fully qualified table name
    getEntityFQN: (entityName) => {
      const entity = config?.snowflake?.entities?.[entityName];
      if (!entity) return null;
      return `"${entity.database}"."${entity.schema}"."${entity.table}"`;
    },
  };
}

export default useSystemConfig;


```



# COMPONENTS


## src/components/ConnectionModal.jsx

```jsx
/**
 * Connection Modal - Updated to work with session-based backend
 * 
 * Key changes from original:
 * 1. Stores session ID from backend response
 * 2. Saves session to sessionStorage for persistence
 * 3. onConnect callback receives session info including sessionId
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Database, Eye, EyeOff, Loader2, CheckCircle, AlertCircle, Info, Key } from 'lucide-react';
import { createLogger } from '../utils/logger';

const log = createLogger('ConnectionModal');

// API base URL - configurable for different environments
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function ConnectionModal({ isOpen, onClose, onConnect, currentSession }) {
  const [authMethod, setAuthMethod] = useState('token');
  const [formData, setFormData] = useState({
    account: '',
    user: '',
    token: '',
    warehouse: 'COMPUTE_WH',
    database: 'ATLAN_MDLH',
    schema: 'PUBLIC',
    role: ''
  });
  const [showSecret, setShowSecret] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saveToStorage, setSaveToStorage] = useState(true);
  
  // Ref to store the AbortController so we can cancel ongoing requests
  const abortControllerRef = useRef(null);
  const timeoutIdRef = useRef(null);

  // Cancel any ongoing connection attempt
  const cancelConnection = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
    setTesting(false);
  }, []);

  // Handle modal close - cancel any pending requests
  const handleClose = useCallback(() => {
    cancelConnection();
    onClose();
  }, [cancelConnection, onClose]);

  // Load saved config on open, cleanup on close
  useEffect(() => {
    if (isOpen) {
      setTestResult(null);
      const saved = localStorage.getItem('snowflake_config');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setFormData(prev => ({ ...prev, ...parsed, token: '' }));
          if (parsed.authMethod) setAuthMethod(parsed.authMethod);
        } catch (e) {
          log.warn('Failed to load saved config');
        }
      }
    } else {
      // Modal is closing - cancel any pending requests
      cancelConnection();
    }
  }, [isOpen, cancelConnection]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, []);

  const handleAuthMethodChange = (method) => {
    setAuthMethod(method);
    setTestResult(null);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    // Cancel any existing request first
    cancelConnection();
    
    setTesting(true);
    setTestResult(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    const timeoutMs = authMethod === 'sso' ? 120000 : 30000;
    timeoutIdRef.current = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const requestBody = {
        account: formData.account,
        user: formData.user,
        warehouse: formData.warehouse,
        database: formData.database,
        schema_name: formData.schema,  // Backend expects schema_name
        role: formData.role || undefined,
        auth_type: authMethod
      };

      if (authMethod === 'token') {
        requestBody.token = formData.token;
      }

      const response = await fetch(`${API_BASE_URL}/api/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
      const result = await response.json();

      if (result.connected && result.session_id) {
        // Success! We have a session
        const sessionInfo = {
          sessionId: result.session_id,
          user: result.user,
          warehouse: result.warehouse,
          database: result.database,
          role: result.role,
          connected: true
        };
        
        setTestResult(sessionInfo);

        // Save config (without token)
        if (saveToStorage) {
          const { token, ...configToSave } = formData;
          localStorage.setItem('snowflake_config', JSON.stringify({ 
            ...configToSave, 
            authMethod 
          }));
        }

        // Store session in sessionStorage for persistence across page loads
        const sessionData = {
          sessionId: result.session_id,
          user: result.user,
          warehouse: result.warehouse,
          database: result.database,
          schema: formData.schema || 'PUBLIC',
          role: result.role,
          timestamp: Date.now()
        };
        sessionStorage.setItem('snowflake_session', JSON.stringify(sessionData));
        log.info('Session saved to sessionStorage', {
          sessionId: result.session_id?.substring(0, 8) + '...',
          database: result.database,
          schema: formData.schema || 'PUBLIC',
          timestamp: new Date().toISOString()
        });
        
        // Verify it was saved
        const verify = sessionStorage.getItem('snowflake_session');
        log.debug('Session verification', { status: verify ? 'SAVED' : 'FAILED' });
        
        // Dispatch custom event to notify other components (including App.jsx)
        window.dispatchEvent(new CustomEvent('snowflake-session-changed', { 
          detail: { connected: true, sessionId: result.session_id }
        }));
        log.info('Dispatched snowflake-session-changed event');

        // Notify parent component
        onConnect?.(sessionInfo);
      } else if (result.connected) {
        // Legacy response without session_id (backward compatibility)
        setTestResult({
          connected: true,
          user: result.user,
          warehouse: result.warehouse,
          database: result.database,
          role: result.role
        });
        
        if (saveToStorage) {
          const { token, ...configToSave } = formData;
          localStorage.setItem('snowflake_config', JSON.stringify({ 
            ...configToSave, 
            authMethod 
          }));
        }
        
        onConnect?.(result);
      } else {
        setTestResult({ connected: false, error: result.error || 'Connection failed' });
      }
    } catch (err) {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
      if (err.name === 'AbortError') {
        // Check if this was a manual cancel vs timeout
        if (!abortControllerRef.current) {
          // Manual cancel - don't show error
          setTestResult(null);
        } else {
          setTestResult({
            connected: false,
            error: authMethod === 'sso'
              ? 'SSO login timed out or was cancelled. Complete the login in the browser window.'
              : 'Connection timed out. Is the backend server running?'
          });
        }
      } else {
        setTestResult({ connected: false, error: err.message });
      }
    } finally {
      setTesting(false);
      abortControllerRef.current = null;
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleTestConnection();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-[#3366FF] p-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Database size={24} />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Connect to Snowflake</h2>
                <p className="text-blue-100 text-sm">Enter your credentials to query MDLH</p>
              </div>
            </div>
            <button onClick={handleClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Auth Method Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Authentication Method</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleAuthMethodChange('token')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all ${
                  authMethod === 'token' ? 'border-[#3366FF] bg-blue-50 text-[#3366FF]' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <Key size={16} />
                <span className="font-medium">Access Token</span>
              </button>
              <button
                type="button"
                onClick={() => handleAuthMethodChange('sso')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all ${
                  authMethod === 'sso' ? 'border-[#3366FF] bg-blue-50 text-[#3366FF]' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <Database size={16} />
                <span className="font-medium">SSO / Browser</span>
              </button>
            </div>
          </div>

          {/* Account */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Identifier *</label>
            <input
              type="text"
              value={formData.account}
              onChange={(e) => handleChange('account', e.target.value)}
              placeholder="abc12345.us-east-1"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3366FF] focus:border-transparent outline-none"
              required
            />
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
              <Info size={12} />
              Found in your Snowflake URL or Admin → Accounts
            </p>
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
            <input
              type="text"
              value={formData.user}
              onChange={(e) => handleChange('user', e.target.value)}
              placeholder="your_username@company.com"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3366FF] focus:border-transparent outline-none"
              required
            />
            {authMethod === 'sso' && (
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <Info size={12} />
                Use your SSO email address
              </p>
            )}
          </div>

          {/* Token (only for token auth) */}
          {authMethod === 'token' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                <Key size={14} />
                Personal Access Token *
              </label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={formData.token}
                  onChange={(e) => handleChange('token', e.target.value)}
                  placeholder="Paste your PAT here..."
                  className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3366FF] focus:border-transparent outline-none font-mono text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <Info size={12} />
                Generate in Snowsight: User menu → Profile → Access Tokens
              </p>
            </div>
          )}

          {/* SSO Info */}
          {authMethod === 'sso' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800 flex items-start gap-2">
                <Info size={16} className="mt-0.5 flex-shrink-0" />
                <span>A browser window will open for SSO login. The backend must be running locally.</span>
              </p>
            </div>
          )}

          {/* Warehouse & Database */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse *</label>
              <input
                type="text"
                value={formData.warehouse}
                onChange={(e) => handleChange('warehouse', e.target.value)}
                placeholder="COMPUTE_WH"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3366FF] focus:border-transparent outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Database</label>
              <input
                type="text"
                value={formData.database}
                onChange={(e) => handleChange('database', e.target.value)}
                placeholder="ATLAN_MDLH"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3366FF] focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Schema & Role */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Schema</label>
              <input
                type="text"
                value={formData.schema}
                onChange={(e) => handleChange('schema', e.target.value)}
                placeholder="PUBLIC"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3366FF] focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <input
                type="text"
                value={formData.role}
                onChange={(e) => handleChange('role', e.target.value)}
                placeholder="ACCOUNTADMIN"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3366FF] focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Remember settings */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={saveToStorage}
              onChange={(e) => setSaveToStorage(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-[#3366FF] focus:ring-[#3366FF]"
            />
            <span className="text-sm text-gray-600">Remember connection settings</span>
          </label>

          {/* Test Result */}
          {testResult && (
            <div className={`p-4 rounded-lg flex items-start gap-3 ${
              testResult.connected ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              {testResult.connected ? (
                <CheckCircle className="text-green-500 flex-shrink-0 mt-0.5" size={20} />
              ) : (
                <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
              )}
              <div>
                <p className={`font-medium ${testResult.connected ? 'text-green-700' : 'text-red-700'}`}>
                  {testResult.connected ? 'Connected successfully!' : 'Connection failed'}
                </p>
                {testResult.connected ? (
                  <p className="text-green-600 text-sm mt-1">
                    {testResult.user}@{testResult.warehouse} • {testResult.sessionId ? 'Session active' : testResult.database}
                  </p>
                ) : (
                  <p className="text-red-600 text-sm mt-1">{testResult.error}</p>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              {testing ? 'Cancel' : 'Close'}
            </button>
            <button
              type="submit"
              disabled={testing || !formData.account || !formData.user || (authMethod === 'token' && !formData.token)}
              className="flex-1 px-4 py-2.5 bg-[#3366FF] text-white rounded-lg hover:bg-blue-600 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {testing ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {authMethod === 'sso' ? 'Waiting for SSO...' : 'Connecting...'}
                </>
              ) : (
                'Connect'
              )}
            </button>
          </div>
        </form>

        {/* Footer Note */}
        <div className="px-6 pb-5">
          <p className="text-xs text-gray-400 text-center">
            Your credentials are sent to the backend server at {API_BASE_URL}
          </p>
        </div>
      </div>
    </div>
  );
}

```

## src/components/EntityActions.jsx

```jsx
/**
 * EntityActions Component
 * 
 * Row-level actions for entity data in result tables.
 * Provides quick access to query flows for any entity row.
 */

import React, { useState, useMemo } from 'react';
import {
  MoreHorizontal,
  GitBranch,
  Activity,
  Table,
  Search,
  ChevronRight,
  Copy,
  Check,
  ArrowUpRight,
  ArrowDownRight,
  BarChart2,
} from 'lucide-react';
import { buildEntityContext, getAvailableFlows, buildFlowQuery } from '../queryFlows';

/**
 * Detect if a row looks like entity data (has GUID, name, typename, etc.)
 * @param {Object} row - Row data object
 * @param {string[]} columns - Column names
 * @returns {boolean}
 */
export function isEntityRow(row, columns) {
  const colLower = columns.map(c => c.toLowerCase());
  
  // Must have GUID or qualifiedname to be considered an entity
  const hasIdentifier = colLower.includes('guid') || colLower.includes('qualifiedname');
  // Should have a name
  const hasName = colLower.includes('name');
  
  return hasIdentifier && hasName;
}

/**
 * Build entity context from a result row
 * @param {Object} row - Row data object (keyed by column name)
 * @returns {import('../queryFlows/types').EntityContext}
 */
export function buildEntityFromRow(row) {
  return buildEntityContext(row);
}

/**
 * Inline action button for a single flow
 */
export function FlowActionButton({ 
  icon: Icon, 
  label, 
  onClick, 
  color = 'gray',
  size = 'sm',
}) {
  const colorClasses = {
    gray: 'text-gray-500 hover:text-gray-700 hover:bg-gray-100',
    blue: 'text-blue-500 hover:text-blue-700 hover:bg-blue-50',
    orange: 'text-orange-500 hover:text-orange-700 hover:bg-orange-50',
    emerald: 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50',
    purple: 'text-purple-500 hover:text-purple-700 hover:bg-purple-50',
  };
  
  const sizeClasses = {
    xs: 'p-1',
    sm: 'p-1.5',
    md: 'px-2 py-1.5',
  };

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded transition-colors ${colorClasses[color]} ${sizeClasses[size]}`}
      title={label}
    >
      <Icon size={14} />
      {size === 'md' && <span className="text-xs font-medium">{label}</span>}
    </button>
  );
}

/**
 * Quick action buttons for common entity flows
 */
export function EntityQuickActions({
  entity,
  availableTables = [],
  onSelectFlow,
  compact = false,
}) {
  const showLineage = ['TABLE', 'VIEW', 'COLUMN', 'PROCESS'].includes(entity?.type);
  const showSample = ['TABLE', 'VIEW'].includes(entity?.type);

  const handleFlow = (flowId, overrides = {}) => {
    if (onSelectFlow) {
      const builtQuery = buildFlowQuery(flowId, entity, overrides, availableTables);
      onSelectFlow(builtQuery, flowId);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-0.5">
        {showLineage && (
          <>
            <FlowActionButton
              icon={ArrowUpRight}
              label="Upstream lineage"
              onClick={() => handleFlow('LINEAGE', { direction: 'UPSTREAM' })}
              color="blue"
              size="xs"
            />
            <FlowActionButton
              icon={ArrowDownRight}
              label="Downstream lineage"
              onClick={() => handleFlow('LINEAGE', { direction: 'DOWNSTREAM' })}
              color="orange"
              size="xs"
            />
          </>
        )}
        <FlowActionButton
          icon={Search}
          label="Find by GUID"
          onClick={() => handleFlow('FIND_BY_GUID')}
          color="gray"
          size="xs"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {showLineage && (
        <>
          <FlowActionButton
            icon={ArrowUpRight}
            label="Upstream"
            onClick={() => handleFlow('LINEAGE', { direction: 'UPSTREAM' })}
            color="blue"
            size="md"
          />
          <FlowActionButton
            icon={ArrowDownRight}
            label="Downstream"
            onClick={() => handleFlow('LINEAGE', { direction: 'DOWNSTREAM' })}
            color="orange"
            size="md"
          />
        </>
      )}
      {showSample && (
        <FlowActionButton
          icon={Table}
          label="Sample"
          onClick={() => handleFlow('SAMPLE_ROWS')}
          color="emerald"
          size="md"
        />
      )}
    </div>
  );
}

/**
 * Full dropdown menu for all available flows
 */
export function EntityActionsMenu({
  row,
  columns,
  availableTables = [],
  onSelectFlow,
  position = 'bottom-end',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Build entity context from row
  const entity = useMemo(() => {
    return buildEntityFromRow(row);
  }, [row]);

  // Get available flows for this entity type
  const flows = useMemo(() => {
    if (!entity?.type) return [];
    return getAvailableFlows(entity);
  }, [entity]);

  // Handle flow selection
  const handleSelect = (flowId, overrides = {}) => {
    setIsOpen(false);
    if (onSelectFlow) {
      const builtQuery = buildFlowQuery(flowId, entity, overrides, availableTables);
      onSelectFlow(builtQuery, flowId);
    }
  };

  // Copy GUID
  const handleCopyGuid = async () => {
    if (entity.guid) {
      await navigator.clipboard.writeText(entity.guid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (flows.length === 0 && !entity.guid) {
    return null;
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        title="Entity actions"
      >
        <MoreHorizontal size={16} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          
          {/* Menu */}
          <div className={`absolute z-50 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 ${
            position === 'bottom-end' ? 'right-0 top-full mt-1' : 'left-0 top-full mt-1'
          }`}>
            {/* Entity header */}
            <div className="px-3 py-2 border-b border-gray-100">
              <div className="text-xs text-gray-500 uppercase tracking-wide">
                {entity.type || 'Entity'}
              </div>
              <div className="text-sm font-medium text-gray-900 truncate">
                {entity.name || entity.qualifiedName || 'Unknown'}
              </div>
            </div>

            {/* Copy GUID */}
            {entity.guid && (
              <button
                onClick={handleCopyGuid}
                className="w-full px-3 py-2 flex items-center gap-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                <span>{copied ? 'Copied!' : 'Copy GUID'}</span>
                <span className="ml-auto text-xs text-gray-400 font-mono">
                  {entity.guid.substring(0, 8)}...
                </span>
              </button>
            )}

            {/* Divider */}
            {entity.guid && flows.length > 0 && (
              <div className="border-t border-gray-100 my-1" />
            )}

            {/* Query flows */}
            {flows.slice(0, 6).map((flow) => (
              <button
                key={flow.id}
                onClick={() => handleSelect(flow.id)}
                className="w-full px-3 py-2 flex items-center gap-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <span className="flex-1 text-left">{flow.label}</span>
                <ChevronRight size={14} className="text-gray-400" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Add this to a results table row to enable entity actions
 */
export function EntityRowActions({
  row,
  columns,
  availableTables = [],
  onSelectFlow,
  variant = 'quick', // 'quick' | 'menu' | 'both'
}) {
  // Check if this row looks like entity data
  if (!isEntityRow(row, columns)) {
    return null;
  }

  const entity = buildEntityFromRow(row);

  if (variant === 'quick') {
    return (
      <EntityQuickActions
        entity={entity}
        availableTables={availableTables}
        onSelectFlow={onSelectFlow}
        compact
      />
    );
  }

  if (variant === 'menu') {
    return (
      <EntityActionsMenu
        row={row}
        columns={columns}
        availableTables={availableTables}
        onSelectFlow={onSelectFlow}
      />
    );
  }

  // Both
  return (
    <div className="flex items-center gap-1">
      <EntityQuickActions
        entity={entity}
        availableTables={availableTables}
        onSelectFlow={onSelectFlow}
        compact
      />
      <EntityActionsMenu
        row={row}
        columns={columns}
        availableTables={availableTables}
        onSelectFlow={onSelectFlow}
      />
    </div>
  );
}

export default EntityActionsMenu;


```

## src/components/FlyoutQueryEditor.jsx

```jsx
/**
 * FlyoutQueryEditor - Embedded SQL editor for the flyout panel
 * 
 * A compact SQL editor with execution capabilities that can be
 * embedded within the QueryPanel flyout for testing queries inline.
 * 
 * Features:
 * - Simplified 2-row header layout (can be hidden when used in TestQueryLayout)
 * - Unsaved changes tracking with callback
 * - Collapsible SQL editor
 * - Compact results table
 * - Smart query suggestions with auto-fix chips
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { 
  Play, X, Loader2, Check, AlertCircle, ChevronDown, ChevronRight,
  Copy, Database, Clock, RotateCcw, Maximize2, WifiOff, Snowflake, Trash2,
  Sparkles, Zap, GitBranch
} from 'lucide-react';
import { useQuery, useConnection, useMetadata } from '../hooks/useSnowflake';
import { createLogger } from '../utils/logger';
import { 
  getSuggestionsFromError, 
  buildSchemaCache,
  getProactiveSuggestions 
} from '../utils/querySuggestions';
import { SuggestionList, QuickFixChip } from './SuggestionChips';
import { QueryFlowMenu, QuickFlowButtons } from './QueryFlowMenu';
import { buildEntityContext } from '../queryFlows';
import ResultFlowSuggestions from './ResultFlowSuggestions';
import StepWizard from './StepWizard';

const log = createLogger('FlyoutQueryEditor');

// Parse SQL errors into friendly messages with missing table detection
function parseSqlError(error) {
  const errorStr = String(error);
  
  // Extract line number if present
  const lineMatch = errorStr.match(/line\s+(\d+)/i) || errorStr.match(/at\s+position.*?line\s+(\d+)/i);
  const line = lineMatch ? parseInt(lineMatch[1], 10) : null;
  
  // Extract missing table/object name from error
  let missingTable = null;
  const objectPatterns = [
    /Object\s+'([^']+)'\s+does not exist/i,
    /Table\s+'([^']+)'\s+does not exist/i,
    /relation\s+"([^"]+)"\s+does not exist/i,
    /Unknown table\s+'([^']+)'/i,
    /'([A-Z_]+_ENTITY)'\s+does not exist/i,
  ];
  
  for (const pattern of objectPatterns) {
    const match = errorStr.match(pattern);
    if (match) {
      missingTable = match[1];
      break;
    }
  }
  
  // Determine error type for better UI
  let errorType = 'generic';
  let suggestion = null;
  
  if (missingTable) {
    errorType = 'missing_table';
    suggestion = `Table "${missingTable}" doesn't exist. Run "SHOW TABLES;" to see available tables.`;
  } else {
    const typoPatterns = [
      { pattern: /syntax error.*?['"]?SELEC['"]?/i, suggestion: 'Did you mean SELECT?' },
      { pattern: /syntax error.*?['"]?FORM['"]?/i, suggestion: 'Did you mean FROM?' },
      { pattern: /syntax error.*?['"]?WEHERE['"]?/i, suggestion: 'Did you mean WHERE?' },
      { pattern: /syntax error.*?['"]?GRUOP['"]?/i, suggestion: 'Did you mean GROUP?' },
      { pattern: /syntax error.*?['"]?ODER['"]?/i, suggestion: 'Did you mean ORDER?' },
      { pattern: /unexpected end/i, suggestion: 'Query seems incomplete. Check for missing clauses.' },
      { pattern: /missing.*?from/i, suggestion: 'Add a FROM clause to specify the table.' },
      { pattern: /invalid identifier/i, suggestion: 'Column or table name not found. Check spelling.', type: 'invalid_identifier' },
      { pattern: /ambiguous.*?column/i, suggestion: 'Qualify the column with its table name (e.g., table.column).' },
      { pattern: /permission denied/i, suggestion: 'You don\'t have access to this object.', type: 'permission' },
      { pattern: /compilation error/i, suggestion: 'SQL syntax issue. Review the highlighted line.', type: 'syntax' },
      { pattern: /not authorized/i, suggestion: 'You don\'t have permission to access this object.', type: 'permission' },
    ];
    
    for (const { pattern, suggestion: sug, type } of typoPatterns) {
      if (pattern.test(errorStr)) {
        suggestion = sug;
        if (type) errorType = type;
        break;
      }
    }
  }
  
  let shortError = errorStr;
  if (shortError.length > 250) {
    const coreMatch = errorStr.match(/(?:error|failed):\s*(.{1,200})/i);
    if (coreMatch) {
      shortError = coreMatch[1] + '...';
    } else {
      shortError = errorStr.substring(0, 250) + '...';
    }
  }
  
  return { line, suggestion, shortError, fullError: errorStr, missingTable, errorType };
}

// Compact results table for the flyout
function CompactResultsTable({ results, loading, error, suggestions = [], onApplySuggestion }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-blue-600">
        <Loader2 size={24} className="animate-spin mr-2" />
        <span className="text-sm font-medium">Executing query...</span>
      </div>
    );
  }

  if (error) {
    const { line, suggestion, shortError, missingTable, errorType } = parseSqlError(error);
    
    const isMissingTable = errorType === 'missing_table';
    const bgColor = isMissingTable ? 'bg-amber-50' : 'bg-rose-50';
    const borderColor = isMissingTable ? 'border-amber-200' : 'border-rose-200';
    const iconBg = isMissingTable ? 'bg-amber-100' : 'bg-rose-100';
    const iconColor = isMissingTable ? 'text-amber-500' : 'text-rose-500';
    const textColor = isMissingTable ? 'text-amber-700' : 'text-rose-700';
    const subTextColor = isMissingTable ? 'text-amber-600' : 'text-rose-600';
    
    return (
      <div className="space-y-3">
        {/* Error Card */}
        <div className={`p-4 ${bgColor} border ${borderColor} rounded-xl`}>
          <div className="flex items-start gap-3">
            <div className={`p-1.5 ${iconBg} rounded-full flex-shrink-0`}>
              {isMissingTable ? (
                <Database size={16} className={iconColor} />
              ) : (
                <AlertCircle size={16} className={iconColor} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className={`font-medium ${textColor} text-sm`}>
                  {isMissingTable ? 'Table Not Found' : 'Query Error'}
                </p>
                {missingTable && (
                  <span className="text-xs px-2 py-0.5 bg-amber-200 text-amber-800 rounded font-mono">
                    {missingTable}
                  </span>
                )}
                {line && !missingTable && (
                  <span className="text-xs px-1.5 py-0.5 bg-rose-100 text-rose-600 rounded">
                    Line {line}
                  </span>
                )}
              </div>
              {suggestion && (
                <p className={`${subTextColor} text-sm mt-1.5 flex items-start gap-1.5`}>
                  <span className="flex-shrink-0">💡</span>
                  <span>{suggestion}</span>
                </p>
              )}
              
              {/* Quick fix chips for suggestions */}
              {suggestions.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium mb-2 flex items-center gap-1.5 opacity-80">
                    <Sparkles size={12} />
                    Try one of these tables instead:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.slice(0, 4).map((s, idx) => (
                      <QuickFixChip 
                        key={`${s.type}-${s.title}-${idx}`}
                        suggestion={s}
                        onApply={onApplySuggestion}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              <details className="mt-2">
                <summary className={`${subTextColor}/80 text-xs cursor-pointer hover:underline`}>
                  Show full error
                </summary>
                <p className={`${subTextColor}/70 text-xs mt-1 font-mono ${isMissingTable ? 'bg-amber-100/50' : 'bg-rose-100/50'} p-2 rounded break-words`}>
                  {shortError}
                </p>
              </details>
            </div>
          </div>
        </div>
        
        {/* Extended suggestions panel */}
        {suggestions.length > 4 && (
          <SuggestionList
            suggestions={suggestions.slice(4)}
            onApply={onApplySuggestion}
            title={`More suggestions (${suggestions.length - 4})`}
            layout="inline"
            maxVisible={6}
          />
        )}
      </div>
    );
  }

  if (!results) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-400">
        <Database size={32} className="mb-2 opacity-50" />
        <p className="text-sm">Click "Run query" to execute</p>
        <p className="text-xs mt-1 text-gray-300">⌘+Enter for quick run</p>
      </div>
    );
  }

  const { columns, rows, rowCount, executionTime } = results;

  if (rows.length === 0) {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="flex items-start gap-2">
          <AlertCircle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-700 text-sm">Query returned no rows</p>
            <p className="text-amber-600 text-xs mt-1">
              The table may be empty or no rows match your query conditions.
            </p>
            {columns?.length > 0 && (
              <p className="text-amber-600 text-xs mt-1">
                Columns found: {columns.slice(0, 5).map(c => typeof c === 'string' ? c : c.name).join(', ')}
                {columns.length > 5 && ` +${columns.length - 5} more`}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const colNames = columns?.map(c => typeof c === 'string' ? c : c.name) || Object.keys(rows[0] || {});

  return (
    <div>
      {/* Results header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Check size={12} className="text-green-500" />
            <strong className="text-gray-700">{rowCount?.toLocaleString() || rows.length}</strong> rows
          </span>
          {executionTime && (
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {(executionTime / 1000).toFixed(2)}s
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">{colNames.length} columns</span>
      </div>

      {/* Results table */}
      <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {colNames.slice(0, 8).map((col, i) => (
                <th key={i} className="px-3 py-2 text-left font-medium text-gray-600 border-b border-gray-200 whitespace-nowrap">
                  {col}
                </th>
              ))}
              {colNames.length > 8 && (
                <th className="px-3 py-2 text-left text-gray-400 border-b border-gray-200">
                  +{colNames.length - 8} more
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 50).map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-blue-50 border-b border-gray-100 last:border-0">
                {colNames.slice(0, 8).map((col, colIdx) => (
                  <td key={colIdx} className="px-3 py-2 max-w-[200px] truncate">
                    {row[colIdx] !== null && row[colIdx] !== undefined 
                      ? String(row[colIdx]).substring(0, 100)
                      : <span className="text-gray-300 italic">null</span>
                    }
                  </td>
                ))}
                {colNames.length > 8 && (
                  <td className="px-3 py-2 text-gray-300">...</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 50 && (
          <div className="px-3 py-2 bg-gray-50 text-xs text-gray-500 text-center border-t border-gray-200">
            Showing 50 of {rows.length} rows
          </div>
        )}
      </div>
    </div>
  );
}

// Copy button
function CopyButton({ text, size = 14 }) {
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
      className={`p-1.5 rounded transition-all ${
        copied 
          ? 'bg-green-100 text-green-600' 
          : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
      }`}
      title={copied ? 'Copied!' : 'Copy SQL'}
    >
      {copied ? <Check size={size} /> : <Copy size={size} />}
    </button>
  );
}

// ============================================================================
// FlyoutQueryEditorHeader - 2-row simplified header
// ============================================================================

function FlyoutQueryEditorHeader({
  title,
  hasUnsavedChanges,
  onRun,
  running,
  database,
  schema,
  isConnected,
  onOpenFullEditor,
  onClearResults,
  hasResults,
  onCopy,
  sql
}) {
  return (
    <div className="border-b border-gray-200 bg-white px-4 py-3 space-y-2 flex-shrink-0">
      {/* Row 1: Title + unsaved dot | Run button */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex-shrink-0">
            <Play size={14} />
          </span>
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 truncate">{title}</h3>
            {hasUnsavedChanges && (
              <span 
                className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" 
                title="Unsaved changes" 
              />
            )}
          </div>
        </div>
        <button
          onClick={onRun}
          disabled={running || !isConnected}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border border-emerald-500 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          <span>{running ? 'Running…' : 'Run query'}</span>
        </button>
      </div>

      {/* Row 2: Context | Utilities */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="inline-flex items-center gap-1.5">
          {isConnected ? (
            <>
              <Snowflake size={12} className="text-blue-500" />
              <span className="font-mono">
                {database || 'Default'}.{schema || 'PUBLIC'}
              </span>
            </>
          ) : (
            <>
              <WifiOff size={12} className="text-gray-400" />
              <span>Not connected</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <CopyButton text={sql} size={12} />
          {hasResults && onClearResults && (
            <button
              onClick={onClearResults}
              className="inline-flex items-center gap-1 hover:text-gray-700 transition-colors"
              title="Clear results"
            >
              <Trash2 size={12} />
              <span>Clear</span>
            </button>
          )}
          {onOpenFullEditor && (
            <button
              onClick={onOpenFullEditor}
              className="inline-flex items-center gap-1 hover:text-gray-700 transition-colors"
              title="Open in full Query Editor"
            >
              <Maximize2 size={12} />
              <span>Full editor</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main FlyoutQueryEditor Component
// ============================================================================

export default function FlyoutQueryEditor({ 
  initialQuery = '', 
  title = 'Test Query',
  onClose,
  onOpenFullEditor,
  database,
  schema,
  // New props for integration with TestQueryLayout
  hideHeader = false,
  onSqlChange = null,
  // Schema info for suggestions
  availableTables = [],
  tableColumns = {},
  // Entity context for query flows
  entityContext = null,
  // Show query flow controls
  showFlowControls = true,
}) {
  const editorRef = useRef(null);
  const [sql, setSql] = useState(initialQuery);
  const [isExpanded, setIsExpanded] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  
  // Wizard mode state
  const [wizardMode, setWizardMode] = useState(null); // null or { flowId, entity }
  
  const { status: connStatus } = useConnection();
  const { executeQuery, results, loading, error, clearResults } = useQuery();
  const { fetchTables, fetchColumns } = useMetadata();
  
  // Local state for discovered tables (if not passed as props)
  const [localTables, setLocalTables] = useState([]);
  const [localColumns, setLocalColumns] = useState({});
  
  // Fetch tables if not provided and connected
  useEffect(() => {
    if (availableTables.length === 0 && connStatus?.connected) {
      const db = database || connStatus?.database;
      const sch = schema || connStatus?.schema;
      if (db && sch) {
        log.debug('Fetching tables for suggestions', { db, sch });
        fetchTables(db, sch).then(tables => {
          if (Array.isArray(tables)) {
            setLocalTables(tables.map(t => typeof t === 'string' ? t : t.name));
          }
        });
      }
    }
  }, [availableTables, connStatus, database, schema, fetchTables]);
  
  // Build schema cache for suggestions
  const schemaCache = useMemo(() => {
    const allTables = availableTables.length > 0 ? availableTables : localTables;
    const allColumns = Object.keys(tableColumns).length > 0 ? tableColumns : localColumns;
    
    // Debug: log what tables we have (use strings for visibility)
    const debugInfo = {
      propsAvailableTables: availableTables?.length || 0,
      localTablesCount: localTables?.length || 0,
      allTablesCount: allTables?.length || 0,
      first5: JSON.stringify(allTables?.slice?.(0, 5) || []),
      hasProcessEntity: allTables?.some?.(t => t?.toUpperCase?.() === 'PROCESS_ENTITY') || false,
    };
    console.warn(`[FlyoutQueryEditor] schemaCache: props=${debugInfo.propsAvailableTables}, local=${debugInfo.localTablesCount}, total=${debugInfo.allTablesCount}, hasProcess=${debugInfo.hasProcessEntity}, first5=${debugInfo.first5}`);
    
    return buildSchemaCache(allTables, allColumns);
  }, [availableTables, localTables, tableColumns, localColumns]);
  
  // Generate suggestions when error occurs
  useEffect(() => {
    if (error && schemaCache.tables.length > 0) {
      const newSuggestions = getSuggestionsFromError(sql, error, schemaCache);
      setSuggestions(newSuggestions);
      log.info('Generated suggestions for error', { 
        suggestionCount: newSuggestions.length,
        errorPreview: error.substring(0, 50)
      });
    } else {
      setSuggestions([]);
    }
  }, [error, sql, schemaCache]);
  
  // Apply a suggestion to the SQL
  const handleApplySuggestion = useCallback((suggestion) => {
    log.info('Applying suggestion', { type: suggestion.type, title: suggestion.title });
    
    if (suggestion.type === 'rewrite' || suggestion.type === 'syntax') {
      // Full query replacement
      setSql(suggestion.fix);
    } else if (suggestion.type === 'table') {
      // Replace the missing table with the suggested one
      const newSql = sql.replace(
        new RegExp(`\\b${suggestion.title.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'gi'),
        suggestion.fix
      );
      // If no direct replacement worked, try to find and replace the table reference
      if (newSql === sql) {
        // Use the full query rewrite from the suggestion engine
        const rewriteSuggestion = suggestions.find(s => s.type === 'rewrite');
        if (rewriteSuggestion) {
          setSql(rewriteSuggestion.fix);
        }
      } else {
        setSql(newSql);
      }
    } else if (suggestion.type === 'column') {
      // Replace column name
      const newSql = sql.replace(
        new RegExp(`\\b${suggestion.title}\\b`, 'gi'),
        suggestion.fix
      );
      setSql(newSql);
    }
    
    // Clear errors after applying fix
    clearResults();
  }, [sql, suggestions, clearResults]);
  
  // Update SQL when initialQuery changes
  useEffect(() => {
    if (initialQuery) {
      setSql(initialQuery);
      clearResults();
    }
  }, [initialQuery, clearResults]);
  
  // Notify parent of SQL changes (for unsaved changes tracking)
  useEffect(() => {
    if (onSqlChange) {
      onSqlChange(sql, initialQuery);
    }
  }, [sql, initialQuery, onSqlChange]);

  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined' 
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
    : false;

  // Handle editor mount - auto-focus for immediate typing
  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    
    setTimeout(() => {
      editor.focus();
    }, 100);
    
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleExecute();
    });
  };

  // Execute query
  const handleExecute = useCallback(async () => {
    const queryText = sql.trim();
    if (!queryText) {
      log.warn('handleExecute() - empty query, aborting');
      return;
    }
    
    log.info('handleExecute() - running query', {
      sqlPreview: queryText.substring(0, 60) + (queryText.length > 60 ? '...' : ''),
      database: database || connStatus?.database,
      schema: schema || connStatus?.schema
    });
    
    await executeQuery(queryText, {
      database: database || connStatus?.database,
      schema: schema || connStatus?.schema,
      warehouse: connStatus?.warehouse
    });
  }, [sql, database, schema, connStatus, executeQuery]);

  // Reset to initial query
  const handleReset = useCallback(() => {
    setSql(initialQuery);
    clearResults();
  }, [initialQuery, clearResults]);
  
  // Clear results only
  const handleClearResults = useCallback(() => {
    clearResults();
  }, [clearResults]);
  
  // Open in full editor
  const handleOpenFullEditor = useCallback(() => {
    if (onOpenFullEditor) {
      onOpenFullEditor(sql);
    }
  }, [onOpenFullEditor, sql]);

  const isConnected = connStatus?.connected;
  const hasUnsavedChanges = sql !== initialQuery;

  // Build entity context from connection if not provided
  const effectiveEntityContext = useMemo(() => {
    if (entityContext) return entityContext;
    
    // Default entity context based on current connection
    const db = database || connStatus?.database;
    const sch = schema || connStatus?.schema;
    
    return {
      type: 'UNKNOWN',
      database: db,
      schema: sch,
    };
  }, [entityContext, database, schema, connStatus]);

  // Handle query flow selection
  const handleFlowSelect = useCallback((builtQuery, flowType) => {
    log.info('Query flow selected', { flowType, title: builtQuery.title });
    setSql(builtQuery.sql);
    clearResults();
  }, [clearResults]);

  // Handle opening wizard mode
  const handleOpenWizard = useCallback((flowId, entity) => {
    log.info('Opening wizard mode', { flowId, entityType: entity?.type });
    setWizardMode({ flowId, entity: entity || effectiveEntityContext });
    clearResults();
  }, [effectiveEntityContext, clearResults]);

  // Handle wizard completion
  const handleWizardComplete = useCallback(({ sql: finalSql, inputs }) => {
    log.info('Wizard complete', { sqlLength: finalSql?.length, inputs });
    setSql(finalSql);
    setWizardMode(null);
  }, []);

  // Handle using SQL from wizard
  const handleWizardUseSql = useCallback((wizardSql) => {
    log.info('Using SQL from wizard step', { sqlPreview: wizardSql?.substring(0, 50) });
    setSql(wizardSql);
    setWizardMode(null);
  }, []);

  return (
    <div 
      className="flex flex-col h-full bg-white"
      role="region"
      aria-label="SQL Query Editor"
    >
      {/* Header - hidden when used inside TestQueryLayout */}
      {!hideHeader && (
        <FlyoutQueryEditorHeader
          title={title}
          hasUnsavedChanges={hasUnsavedChanges}
          onRun={handleExecute}
          running={loading}
          database={database || connStatus?.database}
          schema={schema || connStatus?.schema}
          isConnected={isConnected}
          onOpenFullEditor={handleOpenFullEditor}
          onClearResults={handleClearResults}
          hasResults={!!results}
          sql={sql}
        />
      )}

      {/* Not connected warning */}
      {!isConnected && !wizardMode && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex-shrink-0">
          <p className="text-xs text-amber-700 flex items-center gap-2">
            <WifiOff size={14} />
            Connect to Snowflake to run queries
          </p>
        </div>
      )}

      {/* Wizard Mode */}
      {wizardMode && (
        <div className="flex-1 overflow-hidden">
          <StepWizard
            flowId={wizardMode.flowId}
            entity={wizardMode.entity}
            availableTables={schemaCache.tables || []}
            database={database || connStatus?.database}
            schema={schema || connStatus?.schema}
            onComplete={handleWizardComplete}
            onCancel={() => setWizardMode(null)}
            onUseSql={handleWizardUseSql}
          />
        </div>
      )}

      {/* Main Content Area - hidden when in wizard mode */}
      {!wizardMode && (
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Collapsible SQL Editor */}
        <div className={`border-b border-gray-200 ${prefersReducedMotion ? '' : 'transition-all duration-200'} ${isExpanded ? 'h-[200px]' : 'h-10'}`}>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 hover:bg-gray-100 text-xs font-medium text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
            aria-expanded={isExpanded}
            aria-controls="sql-editor"
          >
            <span className="flex items-center gap-2">
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              SQL Editor
              {hasUnsavedChanges && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              )}
            </span>
            <span className="text-gray-400">
              {sql.split('\n').length} lines
            </span>
          </button>
          
          {isExpanded && (
            <div id="sql-editor" className="h-[calc(100%-32px)]">
              <Editor
                height="100%"
                defaultLanguage="sql"
                value={sql}
                onChange={(value) => setSql(value || '')}
                onMount={handleEditorMount}
                theme="vs"
                options={{
                  minimap: { enabled: false },
                  fontSize: 12,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  automaticLayout: true,
                  tabSize: 2,
                  padding: { top: 8 },
                  lineNumbersMinChars: 3,
                  folding: false,
                  renderLineHighlight: 'line',
                  scrollbar: {
                    vertical: 'auto',
                    horizontal: 'auto',
                    verticalScrollbarSize: 8,
                    horizontalScrollbarSize: 8,
                  }
                }}
              />
            </div>
          )}
        </div>

        {/* Results Section - scrollable */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          <CompactResultsTable 
            results={results} 
            loading={loading} 
            error={error}
            suggestions={suggestions}
            onApplySuggestion={handleApplySuggestion}
          />
          
          {/* Show contextual flow suggestions after query execution */}
          {results?.rows?.length > 0 && !loading && !error && (
            <ResultFlowSuggestions
              results={results}
              availableTables={schemaCache.tables}
              onSelectFlow={handleFlowSelect}
            />
          )}
        </div>
      </div>
      )}

      {/* Query Flows Panel (if entity context is available) */}
      {!wizardMode && showFlowControls && effectiveEntityContext && (
        <div className="flex-shrink-0 px-4 py-3 border-t border-gray-100 bg-gradient-to-r from-indigo-50/50 to-purple-50/50">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <GitBranch size={14} className="text-indigo-500" />
              <span className="font-medium">Query Flows</span>
              {effectiveEntityContext.type !== 'UNKNOWN' && (
                <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs">
                  {effectiveEntityContext.type}
                </span>
              )}
            </div>
            <QueryFlowMenu
              entity={effectiveEntityContext}
              availableTables={schemaCache.tables}
              onSelectFlow={handleFlowSelect}
              onOpenWizard={handleOpenWizard}
              disabled={!isConnected}
              buttonClassName="text-xs"
            />
          </div>
          
          {/* Quick flow buttons for common actions */}
          {effectiveEntityContext.type !== 'UNKNOWN' && (
            <div className="mt-2">
              <QuickFlowButtons
                entity={effectiveEntityContext}
                availableTables={schemaCache.tables}
                onSelectFlow={handleFlowSelect}
              />
            </div>
          )}
        </div>
      )}

      {/* Sticky Footer with Actions - hidden in wizard mode */}
      {!wizardMode && (
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <button
            onClick={handleExecute}
            disabled={loading || !sql.trim() || !isConnected}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            aria-label="Execute SQL query"
          >
            {loading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            {loading ? 'Running...' : 'Run query'}
          </button>
          
          {hasUnsavedChanges && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 hover:bg-gray-200 text-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              title="Reset to original query"
              aria-label="Reset query to original"
            >
              <RotateCcw size={14} />
              Reset
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 hidden sm:inline">
            ⌘+Enter to run
          </span>
          {onOpenFullEditor && (
            <button
              onClick={handleOpenFullEditor}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              title="Open in full Query Editor"
              aria-label="Open query in full editor"
            >
              <Maximize2 size={14} />
              Full Editor
            </button>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

```

## src/components/QueryEditor.jsx

```jsx
/**
 * Query Editor - Main component for SQL editing and execution
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { 
  Play, Square, Trash2, History, Settings, 
  Check, X, Loader2, Database, Clock,
  Wifi, WifiOff, PanelLeft, PanelLeftClose,
  ChevronDown, Layers, AlertTriangle, Lightbulb, Sparkles
} from 'lucide-react';
import SchemaExplorer from './SchemaExplorer';
import ResultsTable from './ResultsTable';
import ConnectionModal from './ConnectionModal';
import { useConnection, useQuery, useQueryHistory, useMetadata, usePreflight } from '../hooks/useSnowflake';
import { createLogger } from '../utils/logger';

const log = createLogger('QueryEditor');

// Parse SQL to extract database/schema/table references
function parseSqlContext(sql) {
  if (!sql) return null;
  
  // Remove comments
  const cleanSql = sql
    .replace(/--[^\n]*/g, '')  // Single line comments
    .replace(/\/\*[\s\S]*?\*\//g, '');  // Block comments
  
  // Patterns for FROM/JOIN clauses
  const tablePatterns = [
    // Full: FROM database.schema.table
    /(?:FROM|JOIN)\s+([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)/gi,
    // Partial: FROM schema.table  
    /(?:FROM|JOIN)\s+([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)/gi,
    // Single: FROM table
    /(?:FROM|JOIN)\s+([A-Za-z_][A-Za-z0-9_]*)/gi
  ];
  
  const references = [];
  
  // Full database.schema.table
  let match;
  const fullPattern = /(?:FROM|JOIN)\s+([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)/gi;
  while ((match = fullPattern.exec(cleanSql)) !== null) {
    references.push({
      database: match[1].toUpperCase(),
      schema: match[2].toUpperCase(),
      table: match[3].toUpperCase(),
      full: `${match[1]}.${match[2]}.${match[3]}`.toUpperCase()
    });
  }
  
  // If we found full references, use the first one
  if (references.length > 0) {
    return references[0];
  }
  
  // Try partial schema.table (but skip if looks like db.schema from full match)
  const partialPattern = /(?:FROM|JOIN)\s+([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)(?!\.)/gi;
  while ((match = partialPattern.exec(cleanSql)) !== null) {
    // This could be database.table or schema.table - context dependent
    return {
      database: null, // Unknown - use default
      schema: match[1].toUpperCase(),
      table: match[2].toUpperCase(),
      partial: true
    };
  }
  
  // Try single table name
  const singlePattern = /(?:FROM|JOIN)\s+([A-Za-z_][A-Za-z0-9_]*)(?!\.)/gi;
  while ((match = singlePattern.exec(cleanSql)) !== null) {
    // Skip if it's a keyword
    const tableName = match[1].toUpperCase();
    const keywords = ['SELECT', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'AS'];
    if (!keywords.includes(tableName)) {
      return {
        database: null,
        schema: null, 
        table: tableName
      };
    }
  }
  
  return null;
}

function ConnectionBadge({ status, onConnect, loading }) {
  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs">
        <Loader2 size={12} className="animate-spin" />
        Connecting...
      </div>
    );
  }
  
  if (!status || !status.connected) {
    return (
      <button 
        onClick={onConnect}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs hover:bg-amber-100 font-medium"
      >
        <Database size={12} />
        Configure Connection
      </button>
    );
  }
  
  return (
    <button 
      onClick={onConnect}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-xs hover:bg-green-100"
      title="Click to reconfigure"
    >
      <Wifi size={12} />
      <span>{status.warehouse || 'Connected'}</span>
    </button>
  );
}

// Database/Schema Selector Dropdown
function ContextSelector({ 
  label, 
  icon: Icon, 
  value, 
  options, 
  onChange, 
  loading,
  placeholder = 'Select...'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm hover:border-gray-300 hover:bg-gray-50 min-w-[140px]"
      >
        <Icon size={14} className="text-gray-500" />
        <span className="truncate max-w-[120px] text-gray-700">
          {value || placeholder}
        </span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-80 overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {label}
            </div>
          </div>
          
          <div className="overflow-y-auto max-h-64">
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 size={16} className="animate-spin text-gray-400" />
              </div>
            ) : options.length === 0 ? (
              <div className="text-center py-4 text-gray-400 text-sm">
                No options available
              </div>
            ) : (
              options.map((option) => (
                <button
                  key={option.name}
                  onClick={() => {
                    onChange(option.name);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-blue-50 ${
                    value === option.name ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                  }`}
                >
                  <Icon size={14} className={value === option.name ? 'text-blue-500' : 'text-gray-400'} />
                  <span className="truncate">{option.name}</span>
                  {value === option.name && (
                    <Check size={14} className="ml-auto text-blue-500" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function QueryHistoryPanel({ isOpen, onClose, history, onSelectQuery, onRefresh, loading }) {
  if (!isOpen) return null;
  
  return (
    <div className="absolute right-0 top-full mt-2 w-96 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-96 overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-700">Query History</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>
      
      <div className="overflow-y-auto max-h-80">
        {history.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            No query history yet
          </div>
        ) : (
          history.map((item, i) => (
            <div 
              key={item.query_id}
              className="p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
              onClick={() => onSelectQuery(item.sql)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  item.status === 'SUCCESS' ? 'bg-green-100 text-green-700' :
                  item.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {item.status}
                </span>
                <span className="text-xs text-gray-400">
                  {item.row_count !== null && `${item.row_count} rows`}
                </span>
              </div>
              <code className="text-xs text-gray-600 line-clamp-2 block mt-1">
                {item.sql}
              </code>
              {item.duration_ms && (
                <span className="text-xs text-gray-400 mt-1 block">
                  {(item.duration_ms / 1000).toFixed(2)}s
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Preflight Warning Panel - shown when preflight finds issues
function PreflightWarningPanel({ 
  preflightResult, 
  loading,
  onUseSuggested, 
  onExecuteAnyway, 
  onDismiss 
}) {
  if (loading) {
    return (
      <div className="p-4 bg-blue-50 border-b border-blue-200">
        <div className="flex items-center gap-2 text-blue-600">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm font-medium">Checking query...</span>
        </div>
      </div>
    );
  }
  
  if (!preflightResult || preflightResult.valid) return null;
  
  const { issues, suggestions, suggested_query, tables_checked } = preflightResult;
  
  return (
    <div className="p-4 bg-amber-50 border-b border-amber-200">
      <div className="flex items-start gap-3">
        <AlertTriangle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
        
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-amber-800 mb-2">Query Issues Detected</h4>
          
          {/* Issues list */}
          <ul className="text-sm text-amber-700 space-y-1 mb-3">
            {issues?.map((issue, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-amber-400">•</span>
                <span>{issue}</span>
              </li>
            ))}
          </ul>
          
          {/* Suggestions */}
          {suggestions?.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center gap-1.5 text-sm font-medium text-amber-800 mb-2">
                <Lightbulb size={14} />
                <span>Tables with data you can query:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestions.slice(0, 8).map((s, i) => (
                  <span 
                    key={i}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded border border-amber-200 text-xs"
                    title={s.reason}
                  >
                    <Database size={12} className="text-amber-500" />
                    <span className="font-mono text-amber-700">{s.table_name}</span>
                    {s.row_count > 0 && (
                      <span className="text-amber-500">({s.row_count.toLocaleString()} rows)</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Suggested query */}
          {suggested_query && (
            <div className="bg-white rounded-lg border border-amber-200 p-3 mb-3">
              <div className="flex items-center gap-1.5 text-sm font-medium text-green-700 mb-2">
                <Sparkles size={14} />
                <span>Suggested query that will return results:</span>
              </div>
              <pre className="text-xs text-gray-700 bg-gray-50 p-2 rounded overflow-x-auto max-h-24">
                {suggested_query.substring(0, 500)}{suggested_query.length > 500 ? '...' : ''}
              </pre>
            </div>
          )}
          
          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-3">
            {suggested_query && (
              <button
                onClick={onUseSuggested}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium"
              >
                <Sparkles size={14} />
                Run Suggested Query
              </button>
            )}
            <button
              onClick={onExecuteAnyway}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded text-sm font-medium"
            >
              <Play size={14} />
              Run Anyway
            </button>
            <button
              onClick={onDismiss}
              className="px-3 py-1.5 text-gray-600 hover:text-gray-800 text-sm"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function QueryEditor({ 
  initialQuery = '', 
  onClose, 
  onOpenConnectionModal,
  // Global database/schema context from App.jsx (hero section dropdowns)
  globalDatabase = '',
  globalSchema = '',
  onDatabaseChange,
  onSchemaChange
}) {
  const editorRef = useRef(null);
  const [sql, setSql] = useState(initialQuery);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  
  // Use global modal if provided, otherwise fall back to local
  const openConnectionModal = onOpenConnectionModal || (() => setShowConnectionModal(true));
  
  // Database/Schema context - use global if provided, otherwise local state
  const [localDatabase, setLocalDatabase] = useState('');
  const [localSchema, setLocalSchema] = useState('');
  
  // Use global context if provided, otherwise fall back to local
  const selectedDatabase = globalDatabase || localDatabase;
  const selectedSchema = globalSchema || localSchema;
  
  // Handle database change - update global if handler provided, otherwise local
  const setSelectedDatabase = (db) => {
    if (onDatabaseChange) {
      onDatabaseChange(db);
    } else {
      setLocalDatabase(db);
    }
  };
  
  // Handle schema change - update global if handler provided, otherwise local
  const setSelectedSchema = (schema) => {
    if (onSchemaChange) {
      onSchemaChange(schema);
    } else {
      setLocalSchema(schema);
    }
  };
  const [databases, setDatabases] = useState([]);
  const [schemas, setSchemas] = useState([]);
  const [loadingDatabases, setLoadingDatabases] = useState(false);
  const [loadingSchemas, setLoadingSchemas] = useState(false);
  
  const { status: connStatus, testConnection, loading: connLoading } = useConnection();
  const { executeQuery, results, loading: queryLoading, error: queryError, clearResults } = useQuery();
  const { history, fetchHistory, loading: historyLoading } = useQueryHistory();
  const { fetchDatabases, fetchSchemas, fetchTables } = useMetadata();
  const { preflightResult, loading: preflightLoading, runPreflight, clearPreflight } = usePreflight();
  
  // FIX: Use hook's status directly, synced with local state for updates
  // Initialize from hook's status if available
  const [connectionStatus, setConnectionStatus] = useState(null);
  
  // FIX: Keep local connectionStatus in sync with hook's connStatus
  useEffect(() => {
    if (connStatus) {
      setConnectionStatus(connStatus);
    }
  }, [connStatus]);
  
  // State for error recovery / alternative suggestions
  const [alternatives, setAlternatives] = useState(null);
  const [alternativesLoading, setAlternativesLoading] = useState(false);
  
  // State for preflight warnings
  const [showPreflightWarning, setShowPreflightWarning] = useState(false);
  
  // Load databases when connected
  const loadDatabases = useCallback(async () => {
    setLoadingDatabases(true);
    try {
      const dbs = await fetchDatabases();
      setDatabases(dbs || []);
    } catch (err) {
      log.error('Failed to load databases', { error: err.message });
    } finally {
      setLoadingDatabases(false);
    }
  }, [fetchDatabases]);
  
  // Load schemas when database changes
  const loadSchemas = useCallback(async (database) => {
    if (!database) {
      setSchemas([]);
      return;
    }
    setLoadingSchemas(true);
    try {
      const schemaList = await fetchSchemas(database);
      setSchemas(schemaList || []);
    } catch (err) {
      log.error('Failed to load schemas', { error: err.message });
    } finally {
      setLoadingSchemas(false);
    }
  }, [fetchSchemas]);
  
  // Handle database selection
  const handleDatabaseChange = useCallback((database) => {
    setSelectedDatabase(database);
    setSelectedSchema(''); // Reset schema when database changes
    loadSchemas(database);
  }, [loadSchemas]);
  
  // Try to connect on mount (will fail gracefully if no env config)
  useEffect(() => {
    testConnection().then(status => {
      setConnectionStatus(status);
      // If not connected and no global modal handler, show local modal
      if (!status?.connected && !onOpenConnectionModal) {
        setShowConnectionModal(true);
      } else if (status?.connected) {
        // Load databases if connected
        loadDatabases();
        // Only set database/schema from connection if not already set by global context
        if (!globalDatabase && status?.database) {
          setSelectedDatabase(status.database);
          loadSchemas(status.database);
        } else if (globalDatabase) {
          // Load schemas for the global database
          loadSchemas(globalDatabase);
        }
        if (!globalSchema && status?.schema) {
          setSelectedSchema(status.schema);
        }
      }
    });
    fetchHistory();
  }, []);
  
  // Handle successful connection from modal
  const handleConnectionSuccess = (status) => {
    setConnectionStatus(status);
    setShowConnectionModal(false);
    
    // Load databases after successful connection
    loadDatabases();
    
    // Only set database/schema from connection if not already set by global context
    if (!globalDatabase && status?.database) {
      setSelectedDatabase(status.database);
      loadSchemas(status.database);
    } else if (globalDatabase) {
      // Load schemas for the global database
      loadSchemas(globalDatabase);
    }
    if (!globalSchema && status?.schema) {
      setSelectedSchema(status.schema);
    }
  };
  
  // Update SQL when initialQuery changes
  useEffect(() => {
    if (initialQuery) {
      setSql(initialQuery);
    }
  }, [initialQuery]);
  
  // Handle editor mount
  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    
    // Add keyboard shortcut for execute
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleExecute();
    });
    
    // Focus editor
    editor.focus();
  };
  
  // Run preflight check on query
  const handlePreflight = useCallback(async (queryText) => {
    const db = selectedDatabase || connStatus?.database;
    const schema = selectedSchema || connStatus?.schema;
    
    const result = await runPreflight(queryText, { database: db, schema });
    
    if (result && !result.valid && result.suggestions?.length > 0) {
      setShowPreflightWarning(true);
    }
    
    return result;
  }, [selectedDatabase, selectedSchema, connStatus, runPreflight]);
  
  // Execute query with optional preflight
  const handleExecute = useCallback(async (skipPreflight = false) => {
    const queryText = sql.trim();
    if (!queryText) return;
    
    // Clear previous state
    setAlternatives(null);
    clearPreflight();
    setShowPreflightWarning(false);
    
    // Run preflight check first (unless skipped)
    if (!skipPreflight) {
      const preflight = await handlePreflight(queryText);
      
      // If preflight found issues and has suggestions, show warning instead of executing
      if (preflight && !preflight.valid && preflight.suggested_query) {
        log.info('Preflight found issues, showing suggestions', { issueCount: result.issues?.length });
        setShowPreflightWarning(true);
        return; // Don't execute, let user review suggestions
      }
    }
    
    // Use selected database/schema, fallback to connection defaults
    await executeQuery(queryText, {
      database: selectedDatabase || connStatus?.database,
      schema: selectedSchema || connStatus?.schema,
      warehouse: connStatus?.warehouse
    });
    
    // Refresh history after execution
    fetchHistory();
  }, [sql, selectedDatabase, selectedSchema, connStatus, executeQuery, fetchHistory, handlePreflight, clearPreflight]);
  
  // Execute the suggested query from preflight
  const handleExecuteSuggested = useCallback(async () => {
    if (preflightResult?.suggested_query) {
      setSql(preflightResult.suggested_query);
      setShowPreflightWarning(false);
      clearPreflight();
      
      // Execute the suggested query (skip preflight since we just ran it)
      setTimeout(async () => {
        await executeQuery(preflightResult.suggested_query, {
          database: selectedDatabase || connStatus?.database,
          schema: selectedSchema || connStatus?.schema,
          warehouse: connStatus?.warehouse
        });
        fetchHistory();
      }, 100);
    }
  }, [preflightResult, selectedDatabase, selectedSchema, connStatus, executeQuery, fetchHistory, clearPreflight]);
  
  // Force execute anyway (ignore preflight warnings)
  const handleExecuteAnyway = useCallback(async () => {
    setShowPreflightWarning(false);
    clearPreflight();
    
    await executeQuery(sql.trim(), {
      database: selectedDatabase || connStatus?.database,
      schema: selectedSchema || connStatus?.schema,
      warehouse: connStatus?.warehouse
    });
    
    fetchHistory();
  }, [sql, selectedDatabase, selectedSchema, connStatus, executeQuery, fetchHistory, clearPreflight]);
  
  // Search for alternative tables when query fails
  // Dynamically parses the SQL to extract database/schema context
  const handleSearchAlternatives = useCallback(async (objectName, objectType = 'table') => {
    setAlternativesLoading(true);
    setAlternatives(null);
    
    try {
      // Parse SQL to extract the actual database/schema being referenced
      const sqlContext = parseSqlContext(sql);
      log.debug('Alternatives - parsed SQL context', sqlContext);
      
      // Priority: SQL context > selected values > connection defaults
      let db = sqlContext?.database || selectedDatabase || connStatus?.database;
      let schema = sqlContext?.schema || selectedSchema || connStatus?.schema;
      
      // Special handling: if we found a partial reference (schema.table),
      // the "schema" might actually be a database name
      if (sqlContext?.partial && !sqlContext.database) {
        // Try fetching from this as if it were a database first
        const schemasInPotentialDb = await fetchSchemas(sqlContext.schema);
        if (schemasInPotentialDb && schemasInPotentialDb.length > 0) {
          // It's a database! Use the default schema
          db = sqlContext.schema;
          schema = 'PUBLIC'; // Default to PUBLIC
          log.debug('Alternatives - detected schema as database, using PUBLIC', { detected: sqlContext.schema });
        }
      }
      
      log.debug('Alternatives - searching for tables', { database: db, schema, objectName });
      
      // Fetch all tables in the determined schema
      const tables = await fetchTables(db, schema);
      
      if (!tables || tables.length === 0) {
        log.debug('Alternatives - no tables found', { database: db, schema });
        setAlternatives([]);
        return;
      }
      
      log.debug('Alternatives - found tables', { database: db, schema, count: tables.length });
      
      // Filter to find similar tables
      const searchTerm = objectName.toUpperCase()
        .replace('_ENTITY', '')
        .replace('ATLAS', '')
        .replace(/_/g, ''); // Remove underscores for flexible matching
      
      const similar = tables
        .map(t => t.name || t)
        .filter(name => {
          const upperName = name.toUpperCase();
          const cleanName = upperName.replace(/_ENTITY/, '').replace(/_/g, '');
          
          // Exact match (table exists - shouldn't happen)
          if (upperName === objectName.toUpperCase()) return false;
          
          // Contains the key search term
          if (cleanName.includes(searchTerm) || searchTerm.includes(cleanName)) return true;
          
          // Fuzzy: shares significant substring
          if (searchTerm.length > 3) {
            for (let i = 0; i <= searchTerm.length - 3; i++) {
              if (cleanName.includes(searchTerm.substring(i, i + 3))) return true;
            }
          }
          
          return false;
        })
        .sort((a, b) => {
          // Prioritize exact base name matches
          const aClean = a.toUpperCase().replace('_ENTITY', '').replace(/_/g, '');
          const bClean = b.toUpperCase().replace('_ENTITY', '').replace(/_/g, '');
          
          // Exact match scores highest
          if (aClean === searchTerm) return -1;
          if (bClean === searchTerm) return 1;
          
          // Then starts with
          if (aClean.startsWith(searchTerm) && !bClean.startsWith(searchTerm)) return -1;
          if (bClean.startsWith(searchTerm) && !aClean.startsWith(searchTerm)) return 1;
          
          // Then shorter names
          return a.length - b.length;
        })
        .slice(0, 15); // Limit results
      
      // Store context for replacement
      setAlternatives({
        suggestions: similar,
        context: { database: db, schema: schema },
        originalObject: objectName
      });
    } catch (err) {
      log.error('Failed to search alternatives', { error: err.message });
      setAlternatives({ suggestions: [], error: err.message });
    } finally {
      setAlternativesLoading(false);
    }
  }, [sql, selectedDatabase, selectedSchema, connStatus, fetchTables, fetchSchemas]);
  
  // Select an alternative and re-run the query
  const handleSelectAlternative = useCallback((alternativeTable, originalTable) => {
    // Get context from alternatives (parsed from failed SQL) or fall back to defaults
    const ctx = alternatives?.context || {};
    const db = ctx.database || selectedDatabase || connStatus?.database;
    const schema = ctx.schema || selectedSchema || connStatus?.schema;
    const origTable = originalTable || alternatives?.originalObject;
    
    log.info('Alternative - replacing table', { from: origTable, to: alternativeTable, database: db, schema });
    
    // Build the fully qualified replacement
    const fullyQualified = `${db}.${schema}.${alternativeTable}`;
    
    // Create regex patterns to find and replace the table name
    // Order matters: match most specific patterns first
    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escaped = escapeRegex(origTable);
    
    let newSql = sql;
    
    // Pattern 1: full reference (db.schema.table)
    const fullPattern = new RegExp(
      `(FROM|JOIN)\\s+[A-Za-z_][A-Za-z0-9_]*\\.[A-Za-z_][A-Za-z0-9_]*\\.${escaped}\\b`,
      'gi'
    );
    newSql = newSql.replace(fullPattern, `$1 ${fullyQualified}`);
    
    // Pattern 2: partial reference (schema.table or db.table)
    const partialPattern = new RegExp(
      `(FROM|JOIN)\\s+[A-Za-z_][A-Za-z0-9_]*\\.${escaped}\\b`,
      'gi'
    );
    newSql = newSql.replace(partialPattern, `$1 ${fullyQualified}`);
    
    // Pattern 3: bare table name
    const barePattern = new RegExp(
      `(FROM|JOIN)\\s+${escaped}\\b`,
      'gi'
    );
    newSql = newSql.replace(barePattern, `$1 ${fullyQualified}`);
    
    log.debug('Alternative - new SQL generated', { sqlPreview: newSql.substring(0, 100) });
    
    // Update SQL and execute
    setSql(newSql);
    setAlternatives(null);
    
    // Execute with slight delay to let state update
    setTimeout(() => {
      executeQuery(newSql, {
        database: db,
        schema: schema,
        warehouse: connStatus?.warehouse
      });
      fetchHistory();
    }, 100);
  }, [sql, alternatives, selectedDatabase, selectedSchema, connStatus, executeQuery, fetchHistory]);
  
  // Insert text at cursor
  const handleInsertText = useCallback((text) => {
    if (editorRef.current) {
      const editor = editorRef.current;
      const selection = editor.getSelection();
      const id = { major: 1, minor: 1 };
      const op = {
        identifier: id,
        range: selection,
        text: text,
        forceMoveMarkers: true
      };
      editor.executeEdits("insertText", [op]);
      editor.focus();
    }
  }, []);
  
  // Clear editor
  const handleClear = () => {
    setSql('');
    clearResults();
    editorRef.current?.focus();
  };
  
  // Load query from history
  const handleSelectHistoryQuery = (query) => {
    setSql(query);
    setShowHistory(false);
    editorRef.current?.focus();
  };
  
  return (
    <div className="flex flex-col h-[calc(100vh-300px)] min-h-[500px] bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Connection Context Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            {connectionStatus?.connected ? (
              <>
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 rounded-lg border border-green-200">
                  <Wifi size={12} />
                  <span className="font-medium">Connected</span>
                </div>
                <span className="text-gray-400">to</span>
                <span className="font-mono px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-200">
                  {selectedDatabase || connStatus?.database || 'Default'}.{selectedSchema || connStatus?.schema || 'PUBLIC'}
                </span>
              </>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg border border-amber-200">
                <WifiOff size={12} />
                <span className="font-medium">Not connected</span>
              </div>
            )}
          </div>
          
          {/* Library query notice */}
          {initialQuery && sql === initialQuery && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              <Lightbulb size={12} />
              <span>Loaded from MDLH Library. Changes here don't affect the library.</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            Press
          </span>
          <kbd className="px-2 py-0.5 bg-gray-100 border border-gray-200 rounded text-xs text-gray-600 font-mono">
            ⌘+Enter
          </kbd>
          <span className="text-xs text-gray-400">
            to run query
          </span>
        </div>
      </div>
      
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-2 hover:bg-gray-200 rounded text-gray-500"
            title={showSidebar ? 'Hide schema browser' : 'Show schema browser'}
          >
            {showSidebar ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
          </button>
          
          <div className="h-4 w-px bg-gray-300" />
          
          <button
            onClick={handleExecute}
            disabled={queryLoading || !sql.trim() || !connectionStatus?.connected}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {queryLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            Run Query
          </button>
          
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-200 text-gray-600 rounded-lg text-sm"
          >
            <Trash2 size={14} />
            Clear
          </button>
          
          <div className="relative">
            <button
              onClick={() => {
                setShowHistory(!showHistory);
                if (!showHistory) fetchHistory();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-200 text-gray-600 rounded-lg text-sm"
            >
              <History size={14} />
              History
            </button>
            
            <QueryHistoryPanel
              isOpen={showHistory}
              onClose={() => setShowHistory(false)}
              history={history}
              onSelectQuery={handleSelectHistoryQuery}
              onRefresh={fetchHistory}
              loading={historyLoading}
            />
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Database Selector */}
          <ContextSelector
            label="Databases"
            icon={Database}
            value={selectedDatabase}
            options={databases}
            onChange={handleDatabaseChange}
            loading={loadingDatabases}
            placeholder="Database"
          />
          
          {/* Schema Selector */}
          <ContextSelector
            label="Schemas"
            icon={Layers}
            value={selectedSchema}
            options={schemas}
            onChange={setSelectedSchema}
            loading={loadingSchemas}
            placeholder="Schema"
          />
          
          <div className="h-4 w-px bg-gray-300" />
          
          <ConnectionBadge 
            status={connectionStatus} 
            onConnect={openConnectionModal} 
            loading={connLoading}
          />
        </div>
      </div>
      
      {/* Connection Modal */}
      <ConnectionModal
        isOpen={showConnectionModal}
        onClose={() => setShowConnectionModal(false)}
        onConnect={handleConnectionSuccess}
        currentStatus={connectionStatus}
      />
      
      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Schema Browser */}
        {showSidebar && (
          <div className="w-72 flex-shrink-0 border-r border-gray-200">
            <SchemaExplorer 
              onInsertText={handleInsertText}
              defaultDatabase={selectedDatabase || connStatus?.database}
              defaultSchema={selectedSchema || connStatus?.schema}
              isConnected={connectionStatus?.connected}
              connectionName={connStatus?.warehouse || 'snowflake'}
            />
          </div>
        )}
        
        {/* Editor + Results */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* SQL Editor */}
          <div className="h-1/2 border-b border-gray-200">
            <Editor
              height="100%"
              defaultLanguage="sql"
              value={sql}
              onChange={(value) => setSql(value || '')}
              onMount={handleEditorMount}
              theme="vs"
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                automaticLayout: true,
                tabSize: 2,
                padding: { top: 10 },
                suggestOnTriggerCharacters: true,
              }}
            />
          </div>
          
          {/* Results */}
          <div className="h-1/2 overflow-hidden flex flex-col">
            {/* Preflight Warning */}
            {(showPreflightWarning || preflightLoading) && (
              <PreflightWarningPanel
                preflightResult={preflightResult}
                loading={preflightLoading}
                onUseSuggested={handleExecuteSuggested}
                onExecuteAnyway={handleExecuteAnyway}
                onDismiss={() => {
                  setShowPreflightWarning(false);
                  clearPreflight();
                }}
              />
            )}
            
            {/* Results Table */}
            <div className="flex-1 overflow-hidden">
              <ResultsTable
                results={results}
                loading={queryLoading}
                error={queryError}
                onSearchAlternatives={handleSearchAlternatives}
                onSelectAlternative={handleSelectAlternative}
                alternatives={alternatives}
                alternativesLoading={alternativesLoading}
                onInsertIntoEditor={handleInsertText}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


```

## src/components/QueryFlowMenu.jsx

```jsx
/**
 * QueryFlowMenu Component
 * 
 * A dropdown menu showing available query flows for the current entity context.
 * Can be used as a toolbar button or context menu.
 * 
 * Features:
 * - Responsive positioning (opens upward if near bottom of screen)
 * - Scrollable menu with max height
 * - Entity-aware flow filtering
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  GitBranch,
  AlertTriangle,
  Activity,
  Table,
  Layers,
  CheckCircle,
  BookOpen,
  Search,
  BarChart2,
  List,
  AlertCircle,
  Sparkles,
  Play,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Database,
  Columns,
} from 'lucide-react';
import { getAvailableFlows, openQueryFlow, buildFlowQuery } from '../queryFlows';
import { QUERY_FLOW_CONFIG } from '../queryFlows/types';
import { getAvailableWizardFlowsForEntity, getAvailableWizardFlowsForDomain } from '../queryFlows/stepFlows';
import { useConfig } from '../context/SystemConfigContext';

const ICON_MAP = {
  GitBranch,
  AlertTriangle,
  Activity,
  Table,
  Layers,
  CheckCircle,
  BookOpen,
  Search,
  BarChart2,
  List,
  AlertCircle,
  Database,
  Columns,
};

function FlowIcon({ name, size = 16, className = '' }) {
  const Icon = ICON_MAP[name] || Sparkles;
  return <Icon size={size} className={className} />;
}

/**
 * Hook to calculate dropdown position
 */
function useDropdownPosition(buttonRef, isOpen) {
  const [position, setPosition] = useState({ openUp: false, maxHeight: 320 });

  useEffect(() => {
    if (!isOpen || !buttonRef.current) return;

    const updatePosition = () => {
      const button = buttonRef.current;
      if (!button) return;

      const rect = button.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      // Menu needs ~320px, but we can adjust
      const menuHeight = Math.min(320, Math.max(spaceBelow, spaceAbove) - 20);
      const openUp = spaceBelow < 200 && spaceAbove > spaceBelow;

      setPosition({ openUp, maxHeight: menuHeight });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, buttonRef]);

  return position;
}

/**
 * WizardSection - Shows all available wizards from QUERY_RECIPES
 */
function WizardSection({ entityType, onOpenWizard }) {
  const availableWizards = useMemo(() => {
    return getAvailableWizardFlowsForEntity(entityType || 'UNKNOWN');
  }, [entityType]);

  if (availableWizards.length === 0) return null;

  // Group wizards by intent
  const lineageWizards = availableWizards.filter(w => w.intent === 'LINEAGE');
  const discoveryWizards = availableWizards.filter(w => w.intent === 'DISCOVERY' || w.intent === 'SCHEMA');
  const profileWizards = availableWizards.filter(w => w.intent === 'PROFILE' || w.intent === 'QUALITY');
  const otherWizards = availableWizards.filter(w => 
    !['LINEAGE', 'DISCOVERY', 'SCHEMA', 'PROFILE', 'QUALITY'].includes(w.intent)
  );

  const renderWizardButton = (wizard) => (
    <button
      key={wizard.id}
      onClick={() => onOpenWizard(wizard.id)}
      className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-white hover:bg-indigo-50 
        border border-gray-200 hover:border-indigo-200 transition-all group"
    >
      <div className="p-1.5 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-sm">
        <FlowIcon name={wizard.icon} size={14} />
      </div>
      <div className="flex-1 text-left min-w-0">
        <div className="text-sm font-medium text-gray-800 group-hover:text-indigo-700 truncate">
          {wizard.label}
        </div>
        <div className="text-[10px] text-gray-500 truncate">
          {wizard.description}
        </div>
      </div>
      <span className="text-[9px] px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded-full font-medium shrink-0">
        Wizard
      </span>
    </button>
  );

  const renderWizardGroup = (title, wizards) => {
    if (wizards.length === 0) return null;
    return (
      <div className="space-y-1.5">
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1">
          {title}
        </div>
        {wizards.map(renderWizardButton)}
      </div>
    );
  };

  return (
    <div className="p-2 border-b border-gray-100 space-y-3">
      <div className="flex items-center gap-2">
        <Zap size={14} className="text-indigo-600" />
        <span className="text-xs font-semibold text-gray-700">Step-by-Step Wizards</span>
        <span className="text-[9px] px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded-full">
          {availableWizards.length} available
        </span>
      </div>
      
      {lineageWizards.length > 0 && renderWizardGroup('Lineage', lineageWizards)}
      {discoveryWizards.length > 0 && renderWizardGroup('Discovery', discoveryWizards)}
      {profileWizards.length > 0 && renderWizardGroup('Profiling', profileWizards)}
      {otherWizards.length > 0 && renderWizardGroup('Other', otherWizards)}
    </div>
  );
}

/**
 * Full query flow menu dropdown with responsive positioning
 */
export function QueryFlowMenu({ 
  entity, 
  availableTables = [], 
  onSelectFlow,
  onOpenWizard, // NEW: handler for wizard mode
  buttonClassName = '',
  disabled = false,
  compact = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef(null);
  const { openUp, maxHeight } = useDropdownPosition(buttonRef, isOpen);
  
  // Get SystemConfig for config-driven flows
  const systemConfig = useConfig();
  
  const flows = useMemo(() => {
    if (!entity?.type) return [];
    
    // Filter flows based on feature flags from SystemConfig
    const allFlows = getAvailableFlows(entity);
    
    // If we have feature flags, filter flows
    if (systemConfig?.features) {
      return allFlows.filter(flow => {
        // Lineage flows require lineage feature
        if (['LINEAGE', 'IMPACT'].includes(flow.id)) {
          return systemConfig.features.lineage !== false;
        }
        // Glossary flows require glossary feature
        if (['GLOSSARY_LOOKUP'].includes(flow.id)) {
          return systemConfig.features.glossary !== false;
        }
        // Usage flows require queryHistory feature (but allow by default)
        if (['USAGE'].includes(flow.id)) {
          return systemConfig.features.queryHistory !== false;
        }
        return true;
      });
    }
    
    return allFlows;
  }, [entity, systemConfig]);

  const handleSelect = (flowId, overrides = {}) => {
    setIsOpen(false);
    if (onSelectFlow) {
      // Pass systemConfig to buildFlowQuery for config-driven SQL generation
      const builtQuery = buildFlowQuery(flowId, entity, overrides, availableTables, systemConfig?.config);
      onSelectFlow(builtQuery, flowId);
    }
  };

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  if (flows.length === 0) {
    return null;
  }

  // Group flows by category
  const lineageFlows = flows.filter(f => ['LINEAGE', 'IMPACT'].includes(f.id));
  const dataFlows = flows.filter(f => ['SAMPLE_ROWS', 'COLUMN_PROFILE', 'TOP_VALUES', 'NULL_ANALYSIS'].includes(f.id));
  const discoveryFlows = flows.filter(f => ['SCHEMA_BROWSE', 'GLOSSARY_LOOKUP', 'FIND_BY_GUID', 'USAGE'].includes(f.id));
  const otherFlows = flows.filter(f => 
    !lineageFlows.includes(f) && !dataFlows.includes(f) && !discoveryFlows.includes(f)
  );

  const renderFlowGroup = (title, flowList, icon) => {
    if (flowList.length === 0) return null;
    return (
      <div key={title}>
        <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 bg-gray-50/50">
          {icon}
          {title}
        </div>
        {flowList.map((flow) => (
          <button
            key={flow.id}
            onClick={() => handleSelect(flow.id)}
            className="w-full px-3 py-2 flex items-start gap-2.5 hover:bg-indigo-50 transition-colors text-left group"
          >
            <div className="mt-0.5 p-1 rounded bg-gray-100 group-hover:bg-indigo-100 transition-colors">
              <FlowIcon name={flow.icon} size={14} className="text-gray-500 group-hover:text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-800 group-hover:text-indigo-700">{flow.label}</div>
              <div className="text-[11px] text-gray-500 mt-0.5 leading-tight">{flow.description}</div>
            </div>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg
          bg-gradient-to-r from-indigo-500 to-purple-500 text-white
          hover:from-indigo-600 hover:to-purple-600
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-all shadow-sm ${buttonClassName}`}
      >
        <Sparkles size={16} />
        {!compact && <span>Query Flows</span>}
        {openUp ? (
          <ChevronUp size={14} className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        ) : (
          <ChevronDown size={14} className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          
          {/* Menu - positioned above or below based on available space */}
          <div 
            className={`absolute z-50 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden
              ${openUp ? 'bottom-full mb-1' : 'top-full mt-1'}
              right-0`}
            style={{ maxHeight: `${maxHeight}px` }}
          >
            {/* Header */}
            <div className="p-3 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50 sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider">
                    Query Flows
                  </div>
                  <div className="text-sm font-medium text-gray-800 mt-0.5">
                    {entity?.name || entity?.type || 'Current Context'}
                  </div>
                </div>
                {entity?.type && (
                  <span className="text-[10px] px-2 py-0.5 bg-white/80 rounded-full text-gray-500 border">
                    {entity.type}
                  </span>
                )}
              </div>
            </div>
            
            {/* Scrollable content */}
            <div className="overflow-y-auto" style={{ maxHeight: `${maxHeight - 60}px` }}>
              {/* Guided Wizards - show all available wizards from recipes */}
              {onOpenWizard && (
                <WizardSection 
                  entityType={entity?.type} 
                  onOpenWizard={(flowId) => {
                    setIsOpen(false);
                    onOpenWizard(flowId, entity);
                  }}
                />
              )}

              {/* Quick Lineage Buttons for supported entities */}
              {lineageFlows.length > 0 && (
                <div className="p-2 border-b border-gray-100 bg-gray-50/30">
                  <div className="text-[10px] font-medium text-gray-500 mb-1.5 px-1">Quick Lineage (single query)</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSelect('LINEAGE', { direction: 'UPSTREAM' })}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg
                        bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
                    >
                      <ArrowUpRight size={14} />
                      Upstream
                    </button>
                    <button
                      onClick={() => handleSelect('LINEAGE', { direction: 'DOWNSTREAM' })}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg
                        bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200 transition-colors"
                    >
                      <ArrowDownRight size={14} />
                      Downstream
                    </button>
                  </div>
                </div>
              )}

              {/* Grouped Flows */}
              {renderFlowGroup('Data Exploration', dataFlows, <Table size={10} />)}
              {renderFlowGroup('Discovery', discoveryFlows, <Search size={10} />)}
              {renderFlowGroup('Analysis', otherFlows, <BarChart2 size={10} />)}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Quick action buttons for common flows
 */
export function QuickFlowButtons({
  entity,
  availableTables = [],
  onSelectFlow,
  className = '',
}) {
  // Get SystemConfig for config-driven flows
  const systemConfig = useConfig();
  
  const handleFlow = (flowId, overrides = {}) => {
    if (onSelectFlow) {
      // Pass systemConfig to buildFlowQuery for config-driven SQL generation
      const builtQuery = buildFlowQuery(flowId, entity, overrides, availableTables, systemConfig?.config);
      onSelectFlow(builtQuery, flowId);
    }
  };

  // Show different buttons based on entity type
  const showLineage = ['TABLE', 'VIEW', 'COLUMN', 'PROCESS'].includes(entity?.type);
  const showSample = ['TABLE', 'VIEW'].includes(entity?.type);
  const showProfile = entity?.type === 'COLUMN';

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {showLineage && (
        <>
          <button
            onClick={() => handleFlow('LINEAGE', { direction: 'UPSTREAM' })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full
              bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
            title="Find upstream dependencies"
          >
            <ArrowUpRight size={14} />
            Upstream
          </button>
          <button
            onClick={() => handleFlow('LINEAGE', { direction: 'DOWNSTREAM' })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full
              bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors"
            title="Find downstream dependencies"
          >
            <ArrowDownRight size={14} />
            Downstream
          </button>
        </>
      )}
      
      {showSample && (
        <button
          onClick={() => handleFlow('SAMPLE_ROWS')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full
            bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
          title="Preview sample data"
        >
          <Table size={14} />
          Sample
        </button>
      )}
      
      {showProfile && (
        <button
          onClick={() => handleFlow('COLUMN_PROFILE')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full
            bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors"
          title="Column statistics"
        >
          <BarChart2 size={14} />
          Profile
        </button>
      )}
      
      <button
        onClick={() => handleFlow('USAGE')}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full
          bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
        title="See usage"
      >
        <Activity size={14} />
        Usage
      </button>
    </div>
  );
}

/**
 * Compact flow selector for toolbar
 */
export function FlowSelector({
  entity,
  availableTables = [],
  onSelectFlow,
  selectedFlow,
}) {
  // Get SystemConfig for config-driven flows
  const systemConfig = useConfig();
  
  const flows = useMemo(() => {
    if (!entity?.type) return [];
    return getAvailableFlows(entity);
  }, [entity]);

  if (flows.length === 0) return null;

  return (
    <select
      value={selectedFlow || ''}
      onChange={(e) => {
        if (e.target.value && onSelectFlow) {
          // Pass systemConfig to buildFlowQuery for config-driven SQL generation
          const builtQuery = buildFlowQuery(e.target.value, entity, {}, availableTables, systemConfig?.config);
          onSelectFlow(builtQuery, e.target.value);
        }
      }}
      className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white
        focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
    >
      <option value="">Select a query flow...</option>
      {flows.map((flow) => (
        <option key={flow.id} value={flow.id}>
          {flow.label} - {flow.description}
        </option>
      ))}
    </select>
  );
}

export default QueryFlowMenu;


```

## src/components/QueryLibraryLayout.jsx

```jsx
/**
 * QueryLibraryLayout - Layout component for the Query Library mode in the flyout panel
 * 
 * Provides:
 * - Top header: "Query Library – {categoryLabel}" with close button
 * - Secondary context bar: database/schema info + optional filters
 * - Query cards list below
 */

import React, { useRef, useEffect } from 'react';
import { 
  X, Code2, Check, Loader2, Snowflake, Play, Eye, FlaskConical, 
  Sparkles, Copy, Database
} from 'lucide-react';

// ============================================================================
// QueryCard Component
// ============================================================================

function QueryCard({ 
  title, 
  description, 
  query, 
  defaultExpanded = false, 
  onRunInEditor, 
  validated = null, 
  tableAvailable = null, 
  autoFixed = false,
  validationResult = null,
  onShowMyWork = null,
  onTestQuery = null
}) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const [copied, setCopied] = React.useState(false);
  
  // Determine status for visual feedback
  const isValidated = validated === true || tableAvailable === true || validationResult?.status === 'success';
  const isUnavailable = tableAvailable === false || validationResult?.status === 'error';
  const isEmpty = validationResult?.status === 'empty';
  const isAutoFixed = autoFixed;
  const hasSuggestion = validationResult?.suggested_query;
  const rowCount = validationResult?.row_count;
  const sampleData = validationResult?.sample_data;
  
  const handleCopy = async (e) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(query);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  // Get status label for badges with consistent labels: "Valid" | "Auto-fixed" | "Needs fix"
  const getStatusLabel = () => {
    if (isValidated && !isAutoFixed) return { 
      text: rowCount ? `${rowCount.toLocaleString()} rows` : 'Valid', 
      color: 'bg-green-100 text-green-700',
      tooltip: 'Query validated successfully and will return results.'
    };
    if (isAutoFixed) return { 
      text: 'Auto-fixed', 
      color: 'bg-blue-100 text-blue-700', 
      tooltip: 'We updated this query to point to a discovered MDLH table.'
    };
    if (isEmpty) return { 
      text: 'Empty table', 
      color: 'bg-amber-100 text-amber-700',
      tooltip: 'The table exists but contains no rows.'
    };
    if (isUnavailable) return { 
      text: 'Needs fix', 
      color: 'bg-orange-100 text-orange-700',
      tooltip: 'Table not found in this database/schema. Click "Explain" for alternatives.'
    };
    return null;
  };
  
  const statusLabel = getStatusLabel();
  
  return (
    <div className={`bg-white rounded-xl border overflow-hidden transition-all duration-200 ${
      expanded 
        ? isValidated 
          ? 'border-green-300 shadow-md' 
          : 'border-blue-300 shadow-md'
        : isUnavailable || isEmpty
          ? 'border-orange-200 shadow-sm hover:shadow-md hover:border-orange-300'
          : 'border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300'
    }`}>
      {/* Card Header */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`p-2 rounded-lg flex-shrink-0 ${
            isValidated ? 'bg-green-100' : (isUnavailable || isEmpty) ? 'bg-orange-100' : 'bg-blue-50'
          }`}>
            {isValidated ? (
              <Check size={18} className="text-green-600" />
            ) : (isUnavailable || isEmpty) ? (
              hasSuggestion ? <Sparkles size={18} className="text-orange-500" /> : <X size={18} className="text-orange-500" />
            ) : (
              <Code2 size={18} className="text-blue-600" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-gray-900 text-sm truncate">{title}</h4>
              {statusLabel && (
                <span 
                  className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${statusLabel.color}`}
                  title={statusLabel.tooltip}
                >
                  {statusLabel.text}
                </span>
              )}
              {hasSuggestion && !isValidated && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-medium rounded-full">
                  <Sparkles size={10} /> Alternative
                </span>
              )}
            </div>
            <p className="text-gray-500 text-xs mt-0.5 truncate">{description}</p>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          {onShowMyWork && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onShowMyWork(query, validationResult);
              }}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-purple-50 hover:bg-purple-100 text-purple-700 transition-colors"
              title="Learn how this query works"
            >
              <Eye size={12} />
              <span className="hidden sm:inline">Explain</span>
            </button>
          )}
          {onTestQuery && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const queryToTest = hasSuggestion && (isUnavailable || isEmpty) 
                  ? validationResult.suggested_query 
                  : query;
                onTestQuery(queryToTest, title);
              }}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors"
              title="Test query in embedded editor"
            >
              <FlaskConical size={12} />
              <span className="hidden sm:inline">Test</span>
            </button>
          )}
          <button
            onClick={handleCopy}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
              copied 
                ? 'bg-green-500 text-white' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
            }`}
            title="Copy to clipboard"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
          {onRunInEditor && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (hasSuggestion && (isUnavailable || isEmpty)) {
                  onRunInEditor(validationResult.suggested_query);
                } else {
                  onRunInEditor(query);
                }
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                isValidated 
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : hasSuggestion
                    ? 'bg-purple-500 hover:bg-purple-600 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
              title={hasSuggestion && !isValidated ? "Run suggested alternative" : "Open in Query Editor"}
            >
              {hasSuggestion && !isValidated ? <Sparkles size={12} /> : <Play size={12} />}
              <span>Run</span>
            </button>
          )}
          <div className={`w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}>
            <span className="text-gray-500 text-xs">▶</span>
          </div>
        </div>
      </div>
      
      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50">
          {/* Sample data preview if available */}
          {isValidated && sampleData && sampleData.length > 0 && (
            <div className="mb-4">
              <h5 className="text-xs font-medium text-gray-600 mb-2">
                Sample Results ({rowCount?.toLocaleString()} total rows)
              </h5>
              <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
                <table className="w-full text-[10px]">
                  <thead className="bg-gray-100">
                    <tr>
                      {Object.keys(sampleData[0]).slice(0, 6).map((col, i) => (
                        <th key={i} className="px-2 py-1 text-left font-medium text-gray-600 border-b">
                          {col}
                        </th>
                      ))}
                      {Object.keys(sampleData[0]).length > 6 && (
                        <th className="px-2 py-1 text-left text-gray-400 border-b">...</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {sampleData.slice(0, 3).map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-blue-50">
                        {Object.values(row).slice(0, 6).map((val, colIdx) => (
                          <td key={colIdx} className="px-2 py-1 border-b border-gray-100 max-w-[150px] truncate">
                            {val !== null && val !== undefined ? String(val) : <span className="text-gray-300">null</span>}
                          </td>
                        ))}
                        {Object.keys(row).length > 6 && (
                          <td className="px-2 py-1 text-gray-300 border-b border-gray-100">...</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {/* Suggested query if original fails */}
          {hasSuggestion && (isUnavailable || isEmpty) && (
            <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-purple-500" />
                <span className="text-xs font-medium text-purple-700">
                  Suggested alternative ({validationResult.suggested_query_result?.row_count?.toLocaleString() || '?'} rows):
                </span>
              </div>
              <pre className="text-[10px] text-purple-800 font-mono bg-white p-2 rounded overflow-x-auto">
                {validationResult.suggested_query}
              </pre>
            </div>
          )}
          
          {/* Original query */}
          <div>
            <h5 className="text-xs font-medium text-gray-600 mb-2">SQL Query</h5>
            <pre className="text-xs text-gray-800 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed p-4 bg-white rounded-lg border border-gray-200">
              {query}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// QueryLibraryLayout Component
// ============================================================================

export default function QueryLibraryLayout({
  categoryLabel,
  onClose,
  queries,
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
  onOpenConnectionModal = null,
  onTestQuery = null,
  extractTableFromQuery = null
}) {
  const highlightedRef = useRef(null);
  
  // Helper to check if a query's table is available
  const getTableAvailability = (query) => {
    if (!isConnected || discoveredTables.size === 0) return null;
    if (!extractTableFromQuery) return null;
    const tableName = extractTableFromQuery(query);
    if (!tableName) return null;
    return discoveredTables.has(tableName.toUpperCase());
  };
  
  // Sort queries: validated first, then unavailable last
  const sortedQueries = [...queries].sort((a, b) => {
    const aAvailable = getTableAvailability(a.query);
    const bAvailable = getTableAvailability(b.query);
    if (aAvailable === true && bAvailable !== true) return -1;
    if (bAvailable === true && aAvailable !== true) return 1;
    if (aAvailable === false && bAvailable !== false) return 1;
    if (bAvailable === false && aAvailable !== false) return -1;
    return 0;
  });

  // Scroll to highlighted query when panel opens
  useEffect(() => {
    if (highlightedQuery && highlightedRef.current) {
      setTimeout(() => {
        highlightedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 350);
    }
  }, [highlightedQuery]);

  return (
    <>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Code2 size={20} className="text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Query Library
            </h2>
            <p className="text-sm text-gray-500">
              {categoryLabel} • {queries.length} queries
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          title="Close (Esc)"
        >
          <X size={20} />
        </button>
      </header>

      {/* Context bar */}
      <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 flex items-center justify-between text-xs text-gray-600 flex-shrink-0">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <Snowflake size={14} className="text-blue-500" />
              <span>
                Connected to{' '}
                <span className="font-medium text-gray-900">{selectedDatabase || 'Default'}</span>
                <span className="text-gray-400 mx-1">.</span>
                <span className="font-mono">{selectedSchema || 'PUBLIC'}</span>
              </span>
            </>
          ) : (
            <>
              <Database size={14} className="text-gray-400" />
              <span className="text-gray-500">Not connected</span>
            </>
          )}
        </div>
        
        {/* Validation stats */}
        {isConnected && queryValidationMap.size > 0 && (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-green-700">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              {[...queryValidationMap.values()].filter(v => v.valid === true).length} valid
            </span>
            <span className="flex items-center gap-1 text-amber-700">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              {[...queryValidationMap.values()].filter(v => v.valid === false).length} need fix
            </span>
          </div>
        )}
      </div>

      {/* Query list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {/* Connection status banner */}
        {isConnected && discoveredTables.size > 0 && (
          <div className="p-3 bg-green-50 rounded-xl border border-green-200 mb-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Check size={16} className="text-green-600" />
                <span className="text-sm text-green-700">
                  <strong>{discoveredTables.size} tables</strong> discovered in {selectedDatabase}.{selectedSchema}
                </span>
              </div>
              {onValidateAll && (
                <button
                  onClick={onValidateAll}
                  disabled={isBatchValidating}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {isBatchValidating ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      Validating...
                    </>
                  ) : (
                    <>
                      <Check size={12} />
                      Validate All
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
        
        {!isConnected && (
          <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-200 mb-4">
            <div className="flex items-center gap-2">
              <Snowflake size={16} className="text-amber-600" />
              <span className="text-sm text-amber-700">
                Connect to Snowflake to discover tables and validate queries
              </span>
            </div>
            {onOpenConnectionModal && (
              <button
                onClick={onOpenConnectionModal}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
              >
                <Snowflake size={12} />
                Connect
              </button>
            )}
          </div>
        )}
        
        {/* Loading indicators */}
        {isLoading && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl border border-blue-200 mb-4">
            <Loader2 size={16} className="animate-spin text-blue-600" />
            <span className="text-sm text-blue-700">Fetching table columns from Snowflake...</span>
          </div>
        )}
        
        {isBatchValidating && (
          <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-xl border border-purple-200 mb-4">
            <Loader2 size={16} className="animate-spin text-purple-600" />
            <span className="text-sm text-purple-700">Testing queries & finding alternatives...</span>
          </div>
        )}
        
        {/* Highlighted inline query at top if not in main queries */}
        {highlightedQuery && !queries.some(q => q.query === highlightedQuery) && (
          <div ref={highlightedRef}>
            <div className="mb-4 pb-4 border-b border-gray-200">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-medium">
                {highlightedQuery.includes('Connect to Snowflake') ? '⚠️ Not Connected' : '✨ Smart Query'}
              </p>
              <QueryCard 
                title="Entity Query" 
                description={highlightedQuery.includes('Connect to Snowflake') 
                  ? "Connect to Snowflake for intelligent column selection" 
                  : "Query generated with real column metadata"} 
                query={highlightedQuery}
                tableAvailable={getTableAvailability(highlightedQuery)} 
                defaultExpanded={true}
                onRunInEditor={onRunInEditor}
                onShowMyWork={onShowMyWork}
                onTestQuery={onTestQuery}
              />
            </div>
          </div>
        )}
        
        {/* Query cards */}
        {sortedQueries.length > 0 ? (
          <>
            {highlightedQuery && !queries.some(q => q.query === highlightedQuery) && (
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">
                More {categoryLabel} Queries
              </p>
            )}
            {sortedQueries.map((q, i) => {
              const isHighlighted = highlightedQuery && q.query === highlightedQuery;
              const tableAvailable = getTableAvailability(q.query);
              const isAutoFixed = q.validation?.autoFixed;
              const batchResult = batchValidationResults.get(`core_${i}`);
              
              return (
                <div key={q.queryId || i} ref={isHighlighted ? highlightedRef : null}>
                  <QueryCard 
                    title={isAutoFixed ? `${q.title} (Auto-Fixed)` : q.title}
                    description={isAutoFixed 
                      ? `${q.description} • Table changed: ${q.validation.changes.map(c => `${c.from} → ${c.to}`).join(', ')}`
                      : q.description
                    }
                    query={q.query} 
                    defaultExpanded={isHighlighted}
                    onRunInEditor={onRunInEditor}
                    tableAvailable={tableAvailable}
                    validated={q.validation?.valid}
                    autoFixed={isAutoFixed}
                    validationResult={batchResult}
                    onShowMyWork={onShowMyWork}
                    onTestQuery={onTestQuery}
                  />
                </div>
              );
            })}
          </>
        ) : !highlightedQuery ? (
          <div className="text-center py-16">
            <Code2 size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-600 font-medium">No queries available</p>
            <p className="text-gray-400 text-sm mt-1">Queries for this category are coming soon</p>
          </div>
        ) : null}
      </div>
    </>
  );
}


```

## src/components/QueryPanelShell.jsx

```jsx
/**
 * QueryPanelShell - Reusable shell component for the slide-out panel
 * 
 * Handles:
 * - Backdrop with blur effect
 * - Click-outside to close
 * - Escape key to close
 * - Smooth slide animation
 * - Clean container for content modes
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';

export default function QueryPanelShell({ 
  isOpen, 
  onClose, 
  children,
  // Optional: allow blocking close (e.g., unsaved changes)
  onBeforeClose = null,
  maxWidth = 'max-w-2xl'
}) {
  const panelRef = useRef(null);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  
  // Handle close with optional confirmation
  const handleClose = useCallback(() => {
    if (onBeforeClose) {
      const shouldBlock = onBeforeClose();
      if (shouldBlock) {
        setShowDiscardDialog(true);
        return;
      }
    }
    onClose();
  }, [onClose, onBeforeClose]);
  
  // Confirm discard and close
  const handleConfirmDiscard = useCallback(() => {
    setShowDiscardDialog(false);
    onClose();
  }, [onClose]);
  
  // Cancel discard
  const handleCancelDiscard = useCallback(() => {
    setShowDiscardDialog(false);
  }, []);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target) && isOpen) {
        handleClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, handleClose]);

  return (
    <div className={`fixed inset-0 z-40 ${isOpen ? '' : 'pointer-events-none'}`}>
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden="true"
      />
      
      {/* Panel */}
      <div
        ref={panelRef}
        className={`
          fixed top-0 right-0 h-full w-full ${maxWidth} bg-white shadow-xl
          transform transition-transform duration-300 ease-out flex flex-col
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
      
      {/* Discard Changes Dialog */}
      {showDiscardDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={handleCancelDiscard}
          />
          <div className="relative bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Discard changes?
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              You have unsaved changes to this query. Are you sure you want to discard them?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancelDiscard}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDiscard}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


```

## src/components/ResultFlowSuggestions.jsx

```jsx
/**
 * ResultFlowSuggestions Component
 * 
 * Shows contextual query flow suggestions based on query results.
 * Detects entity data (GUIDs, table names, etc.) and suggests relevant flows.
 * 
 * This enables the "progressive query" workflow:
 * 1. User runs a discovery query (e.g., SHOW TABLES)
 * 2. Results show tables with GUIDs
 * 3. This component suggests flows for those entities
 * 4. User clicks to explore lineage, samples, etc.
 */

import React, { useMemo, useState } from 'react';
import {
  Sparkles,
  GitBranch,
  Table,
  Activity,
  ChevronRight,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Layers,
  X,
  Lightbulb,
  Zap,
} from 'lucide-react';
import { buildFlowQuery, buildEntityContext } from '../queryFlows';

/**
 * Detect entity type from row data
 */
function detectEntityType(row, columns) {
  const colNames = columns.map(c => (c?.name || c)?.toUpperCase());
  
  // Check for explicit typename column
  if (row.TYPENAME || row.typename) {
    const type = String(row.TYPENAME || row.typename).toUpperCase();
    if (type.includes('TABLE')) return 'TABLE';
    if (type.includes('VIEW')) return 'VIEW';
    if (type.includes('COLUMN')) return 'COLUMN';
    if (type.includes('PROCESS')) return 'PROCESS';
    if (type.includes('DASHBOARD')) return 'DASHBOARD';
    if (type.includes('GLOSSARY')) return 'GLOSSARY_TERM';
    return type;
  }

  // Infer from columns present
  if (colNames.includes('COLUMN_NAME') || colNames.includes('COLUMNNAME')) return 'COLUMN';
  if (colNames.includes('TABLE_NAME') || colNames.includes('TABLENAME')) return 'TABLE';
  if (colNames.includes('VIEW_NAME') || colNames.includes('VIEWNAME')) return 'VIEW';
  if (colNames.includes('PROCESS_NAME') || colNames.includes('PROCESSNAME')) return 'PROCESS';
  
  // Check for GUID presence
  if (colNames.includes('GUID')) {
    // Try to infer from name patterns
    const name = row.NAME || row.name || '';
    if (name.toLowerCase().includes('process')) return 'PROCESS';
    return 'TABLE'; // Default assumption for entities with GUIDs
  }

  return 'UNKNOWN';
}

/**
 * Extract entities from query results
 */
function extractEntitiesFromResults(results, maxEntities = 5) {
  if (!results?.rows?.length || !results?.columns?.length) return [];

  const columns = results.columns;
  const colNames = columns.map(c => (c?.name || c)?.toUpperCase());
  
  // Check if this looks like entity data
  const hasGuid = colNames.includes('GUID');
  const hasName = colNames.includes('NAME') || colNames.includes('TABLE_NAME') || colNames.includes('QUALIFIED_NAME');
  
  if (!hasGuid && !hasName) return [];

  const entities = [];
  const seen = new Set();

  for (const row of results.rows.slice(0, maxEntities)) {
    const guid = row.GUID || row.guid;
    const name = row.NAME || row.name || row.TABLE_NAME || row.table_name;
    
    if (!guid && !name) continue;
    
    const key = guid || name;
    if (seen.has(key)) continue;
    seen.add(key);

    const entityType = detectEntityType(row, columns);
    
    entities.push({
      type: entityType,
      guid: guid,
      name: name,
      qualifiedName: row.QUALIFIEDNAME || row.qualified_name || row.QUALIFIED_NAME,
      database: row.DATABASE_NAME || row.database_name || row.DATABASE,
      schema: row.SCHEMA_NAME || row.schema_name || row.SCHEMA,
      table: row.TABLE_NAME || row.table_name,
      column: row.COLUMN_NAME || row.column_name,
      extra: row,
    });
  }

  return entities;
}

/**
 * Get suggested flows for an entity type
 */
function getSuggestedFlows(entityType) {
  const flows = [];

  if (['TABLE', 'VIEW', 'COLUMN', 'PROCESS'].includes(entityType)) {
    flows.push({
      id: 'LINEAGE_UP',
      flowId: 'LINEAGE',
      label: 'Upstream',
      description: 'Find source dependencies',
      icon: ArrowUpRight,
      color: 'blue',
      overrides: { direction: 'UPSTREAM' },
    });
    flows.push({
      id: 'LINEAGE_DOWN',
      flowId: 'LINEAGE',
      label: 'Downstream',
      description: 'Find impact',
      icon: ArrowDownRight,
      color: 'orange',
      overrides: { direction: 'DOWNSTREAM' },
    });
  }

  if (['TABLE', 'VIEW'].includes(entityType)) {
    flows.push({
      id: 'SAMPLE',
      flowId: 'SAMPLE_ROWS',
      label: 'Sample Rows',
      description: 'Preview data',
      icon: Table,
      color: 'emerald',
      overrides: {},
    });
  }

  if (entityType === 'COLUMN') {
    flows.push({
      id: 'PROFILE',
      flowId: 'COLUMN_PROFILE',
      label: 'Profile',
      description: 'Column statistics',
      icon: Activity,
      color: 'purple',
      overrides: {},
    });
  }

  flows.push({
    id: 'USAGE',
    flowId: 'USAGE',
    label: 'Usage',
    description: 'Recent queries',
    icon: Activity,
    color: 'gray',
    overrides: {},
  });

  return flows;
}

/**
 * Single entity card with flow buttons
 */
function EntityFlowCard({ entity, availableTables, onSelectFlow, onDismiss }) {
  const flows = useMemo(() => getSuggestedFlows(entity.type), [entity.type]);

  const handleFlow = (flow) => {
    const builtQuery = buildFlowQuery(flow.flowId, entity, flow.overrides, availableTables);
    onSelectFlow(builtQuery, flow.flowId);
  };

  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200',
    orange: 'bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200',
    emerald: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200',
    purple: 'bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200',
    gray: 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200',
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded bg-indigo-100">
            {entity.type === 'COLUMN' ? <Layers size={14} className="text-indigo-600" /> :
             entity.type === 'PROCESS' ? <GitBranch size={14} className="text-indigo-600" /> :
             <Table size={14} className="text-indigo-600" />}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate" title={entity.name}>
              {entity.name || entity.guid?.substring(0, 8) + '...'}
            </div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide">
              {entity.type}
            </div>
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={() => onDismiss(entity)}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {flows.slice(0, 4).map((flow) => {
          const Icon = flow.icon;
          return (
            <button
              key={flow.id}
              onClick={() => handleFlow(flow)}
              className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border transition-colors ${colorClasses[flow.color]}`}
              title={flow.description}
            >
              <Icon size={12} />
              {flow.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Main component - shows flow suggestions based on query results
 */
export default function ResultFlowSuggestions({
  results,
  availableTables = [],
  onSelectFlow,
  className = '',
}) {
  const [dismissed, setDismissed] = useState(new Set());
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);

  const entities = useMemo(() => {
    const all = extractEntitiesFromResults(results, 10);
    return all.filter(e => !dismissed.has(e.guid || e.name));
  }, [results, dismissed]);

  const handleDismiss = (entity) => {
    setDismissed(prev => new Set([...prev, entity.guid || entity.name]));
  };

  const handleDismissAll = () => {
    setIsMinimized(true);
  };

  if (entities.length === 0) return null;

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className={`flex items-center gap-2 px-3 py-2 text-sm text-indigo-600 hover:text-indigo-700 
          bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors ${className}`}
      >
        <Sparkles size={16} />
        <span>Show Query Flows ({entities.length} entities)</span>
      </button>
    );
  }

  return (
    <div className={`bg-gradient-to-r from-indigo-50/50 to-purple-50/50 rounded-xl border border-indigo-100 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-indigo-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500">
            <Lightbulb size={14} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-800">
              Continue Exploring
            </div>
            <div className="text-[11px] text-gray-500">
              {entities.length} entities detected in results
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            {isExpanded ? 'Collapse' : 'Expand'}
            <ChevronRight size={14} className={`transform transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
          </button>
          <button
            onClick={handleDismissAll}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
            title="Minimize"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {entities.slice(0, isExpanded ? 6 : 2).map((entity, idx) => (
              <EntityFlowCard
                key={entity.guid || entity.name || idx}
                entity={entity}
                availableTables={availableTables}
                onSelectFlow={onSelectFlow}
                onDismiss={handleDismiss}
              />
            ))}
          </div>

          {entities.length > 6 && (
            <div className="mt-3 text-center">
              <span className="text-xs text-gray-500">
                +{entities.length - 6} more entities in results
              </span>
            </div>
          )}

          {/* Quick tip */}
          <div className="mt-4 flex items-start gap-2 text-xs text-gray-500 bg-white/50 rounded-lg p-2">
            <Zap size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Tip:</strong> Click any entity's flow buttons to generate a query. 
              Use Upstream/Downstream for lineage, Sample for data preview.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact inline version for result rows
 */
export function InlineEntityFlows({ row, columns, availableTables, onSelectFlow }) {
  const entity = useMemo(() => {
    const entityType = detectEntityType(row, columns);
    return {
      type: entityType,
      guid: row.GUID || row.guid,
      name: row.NAME || row.name || row.TABLE_NAME,
      qualifiedName: row.QUALIFIEDNAME || row.qualified_name,
      database: row.DATABASE_NAME || row.database_name,
      schema: row.SCHEMA_NAME || row.schema_name,
      table: row.TABLE_NAME || row.table_name,
      column: row.COLUMN_NAME || row.column_name,
      extra: row,
    };
  }, [row, columns]);

  const flows = useMemo(() => getSuggestedFlows(entity.type).slice(0, 3), [entity.type]);

  const handleFlow = (flow) => {
    const builtQuery = buildFlowQuery(flow.flowId, entity, flow.overrides, availableTables);
    onSelectFlow(builtQuery, flow.flowId);
  };

  if (!entity.guid && !entity.name) return null;

  return (
    <div className="flex items-center gap-1">
      {flows.map((flow) => {
        const Icon = flow.icon;
        return (
          <button
            key={flow.id}
            onClick={(e) => {
              e.stopPropagation();
              handleFlow(flow);
            }}
            className="p-1 text-gray-400 hover:text-indigo-600 rounded hover:bg-indigo-50 transition-colors"
            title={`${flow.label}: ${flow.description}`}
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
}


```

## src/components/ResultsTable.jsx

```jsx
/**
 * Results Table - Display query results with pagination and export
 */

import React, { useMemo, useState, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table';
import { 
  ArrowUpDown, ArrowUp, ArrowDown, Download, Copy, Check,
  ChevronLeft, ChevronRight, Loader2, AlertCircle, Search, Wand2, Play,
  Table as TableIcon, Plus, GitBranch
} from 'lucide-react';
import { EntityRowActions, isEntityRow, buildEntityFromRow } from './EntityActions';

/**
 * Detect if results are from a SHOW TABLES or similar metadata query
 * @param {Object} results - Query results
 * @returns {Object|null} - { type: 'tables'|'databases'|'schemas', nameColumn: string }
 */
function detectMetadataResults(results) {
  if (!results?.columns || !results?.rows?.length) return null;
  
  const colNames = results.columns.map(c => 
    (typeof c === 'string' ? c : c.name || '').toLowerCase()
  );
  
  // SHOW TABLES results have "name" column and optionally "kind", "database_name", "schema_name"
  if (colNames.includes('name') && (colNames.includes('kind') || colNames.includes('database_name'))) {
    return { type: 'tables', nameColumn: 'name' };
  }
  
  // SHOW DATABASES results
  if (colNames.includes('name') && colNames.includes('created_on') && !colNames.includes('kind')) {
    return { type: 'databases', nameColumn: 'name' };
  }
  
  // SHOW SCHEMAS results
  if (colNames.includes('name') && colNames.includes('database_name') && !colNames.includes('kind')) {
    return { type: 'schemas', nameColumn: 'name' };
  }
  
  // Generic results with a "name" column - could be entity tables
  if (colNames.includes('name')) {
    return { type: 'generic', nameColumn: 'name' };
  }
  
  // Results with TABLE_NAME column (common in information_schema)
  if (colNames.includes('table_name')) {
    return { type: 'tables', nameColumn: 'table_name' };
  }
  
  return null;
}

// Parse error message to extract the missing table name
function parseErrorForMissingTable(error) {
  if (!error) return null;
  
  // Pattern: Object 'TABLE_NAME' does not exist
  const match1 = error.match(/Object\s+'([^']+)'\s+does not exist/i);
  if (match1) return match1[1];
  
  // Pattern: Table 'TABLE_NAME' does not exist
  const match2 = error.match(/Table\s+'([^']+)'\s+does not exist/i);
  if (match2) return match2[1];
  
  // Pattern: invalid identifier 'COLUMN_NAME'
  const match3 = error.match(/invalid identifier\s+'([^']+)'/i);
  if (match3) return { type: 'column', name: match3[1] };
  
  // Pattern: Schema 'SCHEMA' does not exist
  const match4 = error.match(/Schema\s+'([^']+)'\s+does not exist/i);
  if (match4) return { type: 'schema', name: match4[1] };
  
  return null;
}

// Component to show alternative suggestions
function AlternativeSuggestions({ 
  missingObject, 
  alternatives, 
  loading, 
  onSearch, 
  onSelectAlternative 
}) {
  if (!missingObject) return null;
  
  const objectName = typeof missingObject === 'string' ? missingObject : missingObject.name;
  const objectType = typeof missingObject === 'object' ? missingObject.type : 'table';
  
  // Extract suggestions array from alternatives object (new format) or use directly (old format)
  const suggestions = alternatives?.suggestions || (Array.isArray(alternatives) ? alternatives : null);
  const context = alternatives?.context;
  const hasSuggestions = suggestions && suggestions.length > 0;
  const hasSearched = alternatives !== null;
  
  return (
    <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
      <div className="flex items-center gap-2 text-blue-700 font-medium mb-2">
        <Wand2 size={16} />
        <span>Can't find: <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">{objectName}</code></span>
      </div>
      
      {!hasSearched && !loading && (
        <button
          onClick={() => onSearch(objectName, objectType)}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Search size={14} />
          Find similar {objectType}s in warehouse
        </button>
      )}
      
      {loading && (
        <div className="flex items-center gap-2 text-blue-600 text-sm">
          <Loader2 size={14} className="animate-spin" />
          Searching for alternatives...
        </div>
      )}
      
      {hasSuggestions && (
        <div className="space-y-2">
          {context && (
            <p className="text-xs text-blue-500 mb-2">
              Searching in: <code className="bg-blue-100 px-1 rounded">{context.database}.{context.schema}</code>
            </p>
          )}
          <p className="text-sm text-blue-600">Found {suggestions.length} similar {objectType}(s):</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.slice(0, 15).map((alt, i) => (
              <button
                key={i}
                onClick={() => onSelectAlternative(alt, objectName)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-sm font-mono text-blue-700 hover:bg-blue-100 hover:border-blue-400 transition-colors"
              >
                <Play size={12} />
                {alt}
              </button>
            ))}
          </div>
          <p className="text-xs text-blue-500 mt-2">Click to run query with this {objectType} instead</p>
        </div>
      )}
      
      {hasSearched && !hasSuggestions && (
        <div className="space-y-2">
          {context && (
            <p className="text-xs text-blue-500 mb-1">
              Searched in: <code className="bg-blue-100 px-1 rounded">{context.database}.{context.schema}</code>
            </p>
          )}
          <p className="text-sm text-blue-600">No similar {objectType}s found. Try a different database/schema.</p>
          {alternatives?.error && (
            <p className="text-xs text-red-500 mt-1">Error: {alternatives.error}</p>
          )}
        </div>
      )}
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <button
      onClick={handleCopy}
      className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-700"
      title="Copy to clipboard"
    >
      {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
    </button>
  );
}

export default function ResultsTable({ 
  results, 
  loading, 
  error,
  onPageChange,
  onExport,
  // New props for error recovery
  onSearchAlternatives,
  onSelectAlternative,
  alternatives,
  alternativesLoading,
  // New prop for inserting values into editor
  onInsertIntoEditor,
  // New props for query flows
  onOpenQueryFlow,
  availableTables = [],
}) {
  const [sorting, setSorting] = useState([]);
  const [copiedValue, setCopiedValue] = useState(null);
  
  // Parse error to find missing object
  const missingObject = useMemo(() => parseErrorForMissingTable(error), [error]);
  
  // Detect if this is a metadata query result (SHOW TABLES, etc.)
  const metadataInfo = useMemo(() => detectMetadataResults(results), [results]);
  
  // Detect if results contain entity data (has GUID, name, typename)
  const isEntityData = useMemo(() => {
    if (!results?.columns || !results?.rows?.length) return false;
    const colNames = results.columns.map(c => 
      (typeof c === 'string' ? c : c.name || '').toLowerCase()
    );
    return colNames.includes('guid') && colNames.includes('name');
  }, [results]);
  
  // Handle inserting a value into the editor
  const handleInsert = useCallback((value) => {
    if (onInsertIntoEditor) {
      onInsertIntoEditor(value);
      setCopiedValue(value);
      setTimeout(() => setCopiedValue(null), 1500);
    }
  }, [onInsertIntoEditor]);
  
  // Build columns from result metadata
  // Handles both string columns ["col1", "col2"] and object columns [{name: "col1"}, {name: "col2"}]
  const columns = useMemo(() => {
    if (!results?.columns) return [];
    
    const cols = results.columns.map((col, index) => {
      // Handle both string and object column formats
      const colName = typeof col === 'string' ? col : (col.name || `col_${index}`);
      const colType = typeof col === 'object' ? col.type : undefined;
      const colNameLower = colName.toLowerCase();
      
      // Check if this column should have clickable cells (for inserting into editor)
      const isClickableColumn = onInsertIntoEditor && metadataInfo && (
        colNameLower === metadataInfo.nameColumn ||
        colNameLower === 'name' ||
        colNameLower === 'table_name' ||
        colNameLower === 'schema_name' ||
        colNameLower === 'database_name'
      );
      
      return {
        id: colName || `col_${index}`,
        accessorKey: colName,
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 font-semibold text-gray-700 hover:text-gray-900"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            <span>{colName}</span>
            {isClickableColumn && <Plus size={12} className="text-emerald-500" />}
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp size={14} />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown size={14} />
            ) : (
              <ArrowUpDown size={14} className="opacity-50" />
            )}
          </button>
        ),
        cell: ({ getValue }) => {
          const value = getValue();
          if (value === null) return <span className="text-gray-400 italic">NULL</span>;
          if (typeof value === 'object') return JSON.stringify(value);
          
          const strValue = String(value);
          
          // Make clickable if this is an insertable column
          if (isClickableColumn && strValue) {
            const isInserted = copiedValue === strValue;
            return (
              <button
                onClick={() => handleInsert(strValue)}
                className={`group flex items-center gap-1.5 px-2 py-0.5 -mx-2 rounded transition-colors ${
                  isInserted 
                    ? 'bg-emerald-100 text-emerald-700' 
                    : 'hover:bg-emerald-50 text-gray-900 hover:text-emerald-700'
                }`}
                title={`Click to insert "${strValue}" into your query`}
              >
                {isInserted ? (
                  <Check size={12} className="text-emerald-600" />
                ) : (
                  <Plus size={12} className="opacity-0 group-hover:opacity-100 text-emerald-500" />
                )}
                <span className="font-mono text-sm">{strValue}</span>
                {!isInserted && (
                  <span className="text-xs text-emerald-500 opacity-0 group-hover:opacity-100 ml-1">
                    Insert
                  </span>
                )}
              </button>
            );
          }
          
          return strValue;
        },
        meta: { type: colType }
      };
    });
    
    // Add entity actions column if this looks like entity data and we have a flow handler
    if (isEntityData && onOpenQueryFlow) {
      const columnNames = results.columns.map(c => 
        typeof c === 'string' ? c : c.name
      );
      
      cols.push({
        id: '__entity_actions',
        header: () => (
          <div className="flex items-center gap-1 text-indigo-600">
            <GitBranch size={14} />
            <span>Flows</span>
          </div>
        ),
        cell: ({ row }) => (
          <EntityRowActions
            row={row.original}
            columns={columnNames}
            availableTables={availableTables}
            onSelectFlow={onOpenQueryFlow}
            variant="quick"
          />
        ),
        meta: { type: 'actions' }
      });
    }
    
    return cols;
  }, [results?.columns, metadataInfo, onInsertIntoEditor, copiedValue, handleInsert, isEntityData, onOpenQueryFlow, availableTables]);
  
  // Build data from rows
  // Handles both string and object column formats
  const data = useMemo(() => {
    if (!results?.rows || !results?.columns) return [];
    
    return results.rows.map(row => {
      const obj = {};
      results.columns.forEach((col, i) => {
        const colName = typeof col === 'string' ? col : col.name;
        obj[colName] = row[i];
      });
      return obj;
    });
  }, [results?.rows, results?.columns]);
  
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  
  const exportToCSV = () => {
    if (!results?.columns || !results?.rows) return;
    
    const headers = results.columns.map(c => c.name).join(',');
    const rows = results.rows.map(row => 
      row.map(cell => {
        if (cell === null) return '';
        if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return String(cell);
      }).join(',')
    ).join('\n');
    
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query_results_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-white">
        <div className="text-center">
          <Loader2 size={32} className="mx-auto text-blue-500 animate-spin mb-2" />
          <p className="text-gray-500">Executing query...</p>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-white p-4">
        <div className="text-center max-w-lg">
          <AlertCircle size={32} className="mx-auto text-red-500 mb-2" />
          <p className="text-red-600 font-medium">Query Failed</p>
          <p className="text-gray-500 text-sm mt-1 font-mono bg-gray-100 p-2 rounded">{error}</p>
          
          {/* Alternative suggestions for missing objects */}
          {onSearchAlternatives && (
            <AlternativeSuggestions
              missingObject={missingObject}
              alternatives={alternatives}
              loading={alternativesLoading}
              onSearch={onSearchAlternatives}
              onSelectAlternative={onSelectAlternative}
            />
          )}
        </div>
      </div>
    );
  }
  
  // Empty state
  if (!results) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center text-gray-400">
          <p className="text-lg">No results yet</p>
          <p className="text-sm">Execute a query to see results here</p>
        </div>
      </div>
    );
  }
  
  const rowCount = results.rowCount ?? results.total_rows ?? results.rows?.length ?? 0;
  const columnCount = results.columns?.length ?? 0;
  
  // Show empty table message when 0 rows but columns exist
  if (rowCount === 0 && columnCount > 0) {
    return (
      <div className="flex flex-col h-full bg-white">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span><strong>0</strong> rows</span>
            <span><strong>{columnCount}</strong> columns</span>
          </div>
        </div>
        
        {/* Empty results message */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-lg font-medium text-gray-700 mb-2">Query Returned No Rows</h3>
            <p className="text-sm text-gray-500 mb-4">
              The query executed successfully and found <strong>{columnCount} columns</strong>, but the table is empty or no rows matched your query conditions.
            </p>
            <div className="text-xs text-gray-400 bg-gray-50 rounded p-2 font-mono">
              Columns: {results.columns?.slice(0, 5).map(c => typeof c === 'string' ? c : c.name).join(', ')}
              {columnCount > 5 && ` ... +${columnCount - 5} more`}
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>
            <strong>{rowCount.toLocaleString()}</strong> rows
          </span>
          <span>
            <strong>{columnCount}</strong> columns
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>
      
      {/* Metadata hint banner */}
      {metadataInfo && onInsertIntoEditor && (
        <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2 text-sm text-emerald-700">
          <TableIcon size={14} />
          <span>
            <strong>Tip:</strong> Click any table name below to insert it into your query
          </span>
          <span className="ml-auto text-emerald-500 text-xs">
            {metadataInfo.type === 'tables' ? 'Tables' : metadataInfo.type === 'databases' ? 'Databases' : 'Results'}
          </span>
        </div>
      )}
      
      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className="px-4 py-2 text-left border-b border-gray-200 bg-gray-50"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} className="hover:bg-blue-50/50 border-b border-gray-100">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-4 py-2 max-w-xs truncate">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Pagination - only show if pagination info is available */}
      {results.has_more !== undefined && results.page !== undefined && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 bg-gray-50">
          <span className="text-sm text-gray-600">
            Page {results.page} of {Math.ceil((results.total_rows ?? results.rowCount ?? 0) / (results.page_size ?? 100))}
          </span>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange?.(results.page - 1)}
              disabled={results.page <= 1}
              className="p-1 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => onPageChange?.(results.page + 1)}
              disabled={!results.has_more}
              className="p-1 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


```

## src/components/SchemaExplorer.jsx

```jsx
/**
 * Schema Explorer - Atlan-style tree browser for databases, schemas, tables, and columns
 * Matches the Atlan UI pattern with expandable hierarchy and data types
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ChevronRight, ChevronDown, Database, Layers, Table2, 
  Eye, Columns, RefreshCw, Loader2, Hash, Type, Calendar,
  ToggleLeft, Code2, List, Braces, Search, Filter, X
} from 'lucide-react';
import { useMetadata } from '../hooks/useSnowflake';

// Type icons for different data types
const TypeIcon = ({ dataType }) => {
  const type = (dataType || '').toUpperCase().split('(')[0];
  
  if (['VARCHAR', 'CHAR', 'STRING', 'TEXT'].includes(type)) {
    return <Type size={12} className="text-green-500" />;
  }
  if (['NUMBER', 'INTEGER', 'INT', 'BIGINT', 'DECIMAL', 'FLOAT', 'DOUBLE'].includes(type)) {
    return <Hash size={12} className="text-blue-500" />;
  }
  if (['BOOLEAN', 'BOOL'].includes(type)) {
    return <ToggleLeft size={12} className="text-purple-500" />;
  }
  if (['DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'TIMESTAMP_NTZ', 'TIMESTAMP_LTZ', 'TIMESTAMP_TZ'].includes(type)) {
    return <Calendar size={12} className="text-amber-500" />;
  }
  if (['VARIANT', 'OBJECT'].includes(type)) {
    return <Braces size={12} className="text-pink-500" />;
  }
  if (['ARRAY'].includes(type)) {
    return <List size={12} className="text-pink-500" />;
  }
  return <Code2 size={12} className="text-gray-400" />;
};

// Format data type for display
const formatDataType = (dataType) => {
  if (!dataType) return '';
  const type = dataType.toUpperCase();
  
  // Simplify common types
  if (type.startsWith('VARCHAR')) return 'string';
  if (type.startsWith('NUMBER')) return 'number';
  if (type === 'BOOLEAN') return 'boolean';
  if (type.startsWith('TIMESTAMP')) return 'timestamp';
  if (type === 'DATE') return 'date';
  if (type === 'VARIANT') return 'variant';
  if (type === 'ARRAY') return 'array';
  if (type === 'OBJECT') return 'object';
  if (type.startsWith('FLOAT') || type.startsWith('DOUBLE')) return 'double';
  if (type.startsWith('INT') || type === 'BIGINT') return 'bigint';
  
  return type.toLowerCase();
};

// Context Header - shows current connection/database/schema
function ContextHeader({ 
  connectionName, 
  database, 
  schema, 
  onDatabaseClick, 
  onSchemaClick 
}) {
  return (
    <div className="border-b border-gray-200 bg-white">
      {/* Connection */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
        <div className="p-1.5 bg-amber-100 rounded">
          <Database size={16} className="text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-500">Connection</div>
          <div className="text-sm font-medium text-gray-900 truncate">
            {connectionName || 'snowflake'}
          </div>
        </div>
        <ChevronRight size={16} className="text-gray-300" />
      </div>
      
      {/* Database */}
      <button 
        onClick={onDatabaseClick}
        className="w-full flex items-center gap-2 px-3 py-2 border-b border-gray-100 hover:bg-gray-50 transition-colors"
      >
        <div className="p-1.5 bg-blue-100 rounded">
          <Database size={16} className="text-blue-600" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-xs text-gray-500">Database</div>
          <div className="text-sm font-medium text-gray-900 truncate">
            {database || 'Select database'}
          </div>
        </div>
        <ChevronRight size={16} className="text-gray-300" />
      </button>
      
      {/* Schema */}
      <button 
        onClick={onSchemaClick}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors"
      >
        <div className="p-1.5 bg-purple-100 rounded">
          <Layers size={16} className="text-purple-600" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-xs text-gray-500">Schema</div>
          <div className="text-sm font-medium text-gray-900 truncate">
            {schema || 'Select schema'}
          </div>
        </div>
        <ChevronRight size={16} className="text-gray-300" />
      </button>
    </div>
  );
}

// Table row in the tree
function TableRow({ 
  table, 
  isExpanded, 
  isLoading, 
  onToggle, 
  onInsert,
  columnCount
}) {
  const isView = table.kind === 'VIEW';
  
  return (
    <div 
      className="flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50 cursor-pointer group border-b border-gray-50"
      onClick={onToggle}
    >
      <button 
        className="p-0.5 hover:bg-gray-200 rounded"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        {isLoading ? (
          <Loader2 size={14} className="text-gray-400 animate-spin" />
        ) : isExpanded ? (
          <ChevronDown size={14} className="text-gray-400" />
        ) : (
          <ChevronRight size={14} className="text-gray-400" />
        )}
      </button>
      
      {isView ? (
        <Eye size={14} className="text-amber-500 flex-shrink-0" />
      ) : (
        <Table2 size={14} className="text-emerald-500 flex-shrink-0" />
      )}
      
      <span className="text-sm text-gray-800 truncate flex-1 font-medium">
        {table.name}
      </span>
      
      {/* Column count badge */}
      {columnCount !== undefined && (
        <span className="text-xs text-gray-400 tabular-nums">
          {columnCount}
        </span>
      )}
      
      {/* Insert button on hover */}
      <button 
        className="opacity-0 group-hover:opacity-100 text-xs text-blue-500 hover:text-blue-700 px-1.5 py-0.5 bg-blue-50 rounded transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          onInsert();
        }}
      >
        + Insert
      </button>
    </div>
  );
}

// Column row in the tree
function ColumnRow({ column, onInsert }) {
  const dataType = column.data_type || column.type || 'UNKNOWN';
  const formattedType = formatDataType(dataType);
  
  return (
    <div 
      className="flex items-center gap-2 pl-10 pr-3 py-1 hover:bg-gray-50 cursor-pointer group"
      onClick={() => onInsert(column.name)}
    >
      <TypeIcon dataType={dataType} />
      
      <span className="text-sm text-gray-700 truncate flex-1">
        {column.name}
      </span>
      
      <span className="text-xs text-gray-400 font-mono">
        {formattedType}
      </span>
    </div>
  );
}

// Search/Filter bar
function SearchBar({ value, onChange, placeholder }) {
  return (
    <div className="px-3 py-2 border-b border-gray-200">
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {value && (
          <button 
            onClick={() => onChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function SchemaExplorer({ 
  onInsertText, 
  defaultDatabase, 
  defaultSchema,
  isConnected,
  connectionName = 'snowflake'
}) {
  const { fetchDatabases, fetchSchemas, fetchTables, fetchColumns, refreshCache, loading } = useMetadata();
  
  const [selectedDatabase, setSelectedDatabase] = useState(defaultDatabase || '');
  const [selectedSchema, setSelectedSchema] = useState(defaultSchema || '');
  const [databases, setDatabases] = useState([]);
  const [schemas, setSchemas] = useState([]);
  const [tables, setTables] = useState([]);
  const [columns, setColumns] = useState({});
  const [expanded, setExpanded] = useState({});
  const [loadingNodes, setLoadingNodes] = useState({});
  const [searchFilter, setSearchFilter] = useState('');
  const [showDatabasePicker, setShowDatabasePicker] = useState(false);
  const [showSchemaPicker, setShowSchemaPicker] = useState(false);
  
  // Load databases on mount
  useEffect(() => {
    if (isConnected) {
      loadDatabases();
    }
  }, [isConnected]);
  
  // Update from props
  useEffect(() => {
    if (defaultDatabase && defaultDatabase !== selectedDatabase) {
      setSelectedDatabase(defaultDatabase);
    }
  }, [defaultDatabase]);
  
  useEffect(() => {
    if (defaultSchema && defaultSchema !== selectedSchema) {
      setSelectedSchema(defaultSchema);
    }
  }, [defaultSchema]);
  
  // Load schemas when database changes
  useEffect(() => {
    if (selectedDatabase) {
      loadSchemas(selectedDatabase);
    }
  }, [selectedDatabase]);
  
  // Load tables when schema changes
  useEffect(() => {
    if (selectedDatabase && selectedSchema) {
      loadTables(selectedDatabase, selectedSchema);
    }
  }, [selectedDatabase, selectedSchema]);
  
  const loadDatabases = async () => {
    const data = await fetchDatabases();
    setDatabases(data || []);
  };
  
  const loadSchemas = async (db) => {
    const data = await fetchSchemas(db);
    setSchemas(data || []);
  };
  
  const loadTables = async (db, schema) => {
    const data = await fetchTables(db, schema);
    setTables(data || []);
  };
  
  const toggleTable = async (tableName) => {
    const key = `table:${tableName}`;
    
    if (expanded[key]) {
      setExpanded(prev => ({ ...prev, [key]: false }));
      return;
    }
    
    // Load columns if not already loaded
    if (!columns[tableName]) {
      setLoadingNodes(prev => ({ ...prev, [key]: true }));
      const columnList = await fetchColumns(selectedDatabase, selectedSchema, tableName);
      setColumns(prev => ({ ...prev, [tableName]: columnList || [] }));
      setLoadingNodes(prev => ({ ...prev, [key]: false }));
    }
    
    setExpanded(prev => ({ ...prev, [key]: true }));
  };
  
  const handleRefresh = async () => {
    await refreshCache();
    setColumns({});
    setExpanded({});
    if (selectedDatabase && selectedSchema) {
      await loadTables(selectedDatabase, selectedSchema);
    }
  };
  
  const insertText = (text) => {
    onInsertText?.(text);
  };
  
  // Filter tables based on search
  const filteredTables = useMemo(() => {
    if (!searchFilter) return tables;
    const filter = searchFilter.toLowerCase();
    return tables.filter(t => t.name.toLowerCase().includes(filter));
  }, [tables, searchFilter]);
  
  // Group tables by type (tables vs views)
  const { regularTables, views } = useMemo(() => {
    const regular = filteredTables.filter(t => t.kind !== 'VIEW');
    const v = filteredTables.filter(t => t.kind === 'VIEW');
    return { regularTables: regular, views: v };
  }, [filteredTables]);
  
  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-200">
      {/* Context Header */}
      <ContextHeader
        connectionName={connectionName}
        database={selectedDatabase}
        schema={selectedSchema}
        onDatabaseClick={() => setShowDatabasePicker(!showDatabasePicker)}
        onSchemaClick={() => setShowSchemaPicker(!showSchemaPicker)}
      />
      
      {/* Database Picker Dropdown */}
      {showDatabasePicker && (
        <div className="border-b border-gray-200 bg-gray-50 max-h-48 overflow-y-auto">
          {databases.map(db => (
            <button
              key={db.name}
              onClick={() => {
                setSelectedDatabase(db.name);
                setSelectedSchema('');
                setTables([]);
                setShowDatabasePicker(false);
              }}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-blue-50 ${
                selectedDatabase === db.name ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
              }`}
            >
              {db.name}
            </button>
          ))}
        </div>
      )}
      
      {/* Schema Picker Dropdown */}
      {showSchemaPicker && selectedDatabase && (
        <div className="border-b border-gray-200 bg-gray-50 max-h-48 overflow-y-auto">
          {schemas.map(schema => (
            <button
              key={schema.name}
              onClick={() => {
                setSelectedSchema(schema.name);
                setShowSchemaPicker(false);
              }}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-blue-50 ${
                selectedSchema === schema.name ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
              }`}
            >
              {schema.name}
            </button>
          ))}
        </div>
      )}
      
      {/* Search Filter */}
      {tables.length > 0 && (
        <SearchBar
          value={searchFilter}
          onChange={setSearchFilter}
          placeholder="Filter tables..."
        />
      )}
      
      {/* Refresh Button & Stats */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
        <span className="text-xs text-gray-500">
          {tables.length} tables {searchFilter && `(${filteredTables.length} shown)`}
        </span>
        <button 
          onClick={handleRefresh}
          className="p-1.5 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-700"
          title="Refresh metadata"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      
      {/* Tables & Columns Tree */}
      <div className="flex-1 overflow-y-auto">
        {!selectedDatabase || !selectedSchema ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            <Database size={32} className="mx-auto mb-2 opacity-50" />
            <p>Select a database and schema</p>
            <p className="text-xs mt-1">to browse tables and columns</p>
          </div>
        ) : tables.length === 0 && !loading ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            <Table2 size={32} className="mx-auto mb-2 opacity-50" />
            <p>No tables found</p>
            <p className="text-xs mt-1">in {selectedDatabase}.{selectedSchema}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {/* Regular Tables */}
            {regularTables.map(table => (
              <div key={table.name}>
                <TableRow
                  table={table}
                  isExpanded={expanded[`table:${table.name}`]}
                  isLoading={loadingNodes[`table:${table.name}`]}
                  onToggle={() => toggleTable(table.name)}
                  onInsert={() => insertText(table.name)}
                  columnCount={columns[table.name]?.length}
                />
                
                {/* Columns */}
                {expanded[`table:${table.name}`] && columns[table.name] && (
                  <div className="bg-gray-50/50">
                    {columns[table.name].map(col => (
                      <ColumnRow
                        key={col.name}
                        column={col}
                        onInsert={insertText}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
            
            {/* Views section */}
            {views.length > 0 && (
              <>
                <div className="px-3 py-1.5 bg-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Views ({views.length})
                </div>
                {views.map(view => (
                  <div key={view.name}>
                    <TableRow
                      table={view}
                      isExpanded={expanded[`table:${view.name}`]}
                      isLoading={loadingNodes[`table:${view.name}`]}
                      onToggle={() => toggleTable(view.name)}
                      onInsert={() => insertText(view.name)}
                      columnCount={columns[view.name]?.length}
                    />
                    
                    {expanded[`table:${view.name}`] && columns[view.name] && (
                      <div className="bg-gray-50/50">
                        {columns[view.name].map(col => (
                          <ColumnRow
                            key={col.name}
                            column={col}
                            onInsert={insertText}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

```

## src/components/ShowMyWork.jsx

```jsx
/**
 * ShowMyWork - Educational SQL query explanation component
 * 
 * Helps SQL beginners understand queries step-by-step with:
 * - Plain English explanations
 * - Visual breakdown of SQL clauses
 * - Sample results preview
 * - Tips for writing SQL
 */

import React, { useState, useEffect } from 'react';
import { 
  X, BookOpen, Code2, Play, Lightbulb, CheckCircle, 
  AlertCircle, Database, Table, Columns, Loader2,
  ChevronDown, ChevronRight, Copy, Check, Sparkles
} from 'lucide-react';
import { useQueryExplanation } from '../hooks/useSnowflake';

// Copy button component
function CopyButton({ text, size = 14 }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <button
      onClick={handleCopy}
      className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-700"
      title="Copy to clipboard"
    >
      {copied ? <Check size={size} className="text-green-500" /> : <Copy size={size} />}
    </button>
  );
}

// Step card component
function StepCard({ step, isExpanded, onToggle }) {
  const clauseColors = {
    SELECT: 'bg-blue-100 text-blue-700 border-blue-200',
    FROM: 'bg-green-100 text-green-700 border-green-200',
    WHERE: 'bg-amber-100 text-amber-700 border-amber-200',
    JOIN: 'bg-purple-100 text-purple-700 border-purple-200',
    'ORDER BY': 'bg-pink-100 text-pink-700 border-pink-200',
    'GROUP BY': 'bg-indigo-100 text-indigo-700 border-indigo-200',
    LIMIT: 'bg-gray-100 text-gray-700 border-gray-200',
    WITH: 'bg-teal-100 text-teal-700 border-teal-200',
  };
  
  const colorClass = clauseColors[step.clause] || 'bg-gray-100 text-gray-700 border-gray-200';
  
  return (
    <div className={`rounded-lg border ${colorClass} overflow-hidden`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 text-left"
      >
        <div className="flex items-center gap-3">
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${colorClass}`}>
            {step.step_number}
          </span>
          <span className="font-mono font-medium">{step.clause}</span>
        </div>
        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      
      {isExpanded && (
        <div className="px-3 pb-3 pt-0">
          <div className="bg-white/50 rounded p-2 mb-2 font-mono text-xs overflow-x-auto">
            {step.sql_snippet}
          </div>
          <p className="text-sm" dangerouslySetInnerHTML={{ __html: step.explanation.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
          {step.tip && (
            <div className="flex items-start gap-2 mt-2 p-2 bg-white/50 rounded text-xs">
              <Lightbulb size={14} className="flex-shrink-0 mt-0.5" />
              <span>{step.tip}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Sample data preview
function SampleDataPreview({ columns, data, rowCount }) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Table size={32} className="mx-auto mb-2 opacity-50" />
        <p>No sample data available</p>
      </div>
    );
  }
  
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-600">
          Showing {data.length} of {rowCount?.toLocaleString() || '?'} rows
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-100">
              {columns.map((col, i) => (
                <th key={i} className="px-2 py-1 text-left border border-gray-200 font-medium">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-blue-50">
                {columns.map((col, colIdx) => (
                  <td key={colIdx} className="px-2 py-1 border border-gray-200 max-w-xs truncate">
                    {row[col] !== null && row[col] !== undefined ? String(row[col]) : <span className="text-gray-400 italic">null</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Main ShowMyWork modal
export default function ShowMyWork({ 
  isOpen, 
  onClose, 
  query,
  validationResult,
  onRunQuery,
  onRunSuggestedQuery 
}) {
  const { explanation, loading, explainQuery, clearExplanation } = useQueryExplanation();
  const [expandedSteps, setExpandedSteps] = useState(new Set([1, 2])); // Expand first two steps by default
  const [activeTab, setActiveTab] = useState('explanation');
  
  useEffect(() => {
    if (isOpen && query) {
      explainQuery(query, { includeExecution: true });
    }
    return () => clearExplanation();
  }, [isOpen, query]);
  
  if (!isOpen) return null;
  
  const toggleStep = (stepNum) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepNum)) {
        next.delete(stepNum);
      } else {
        next.add(stepNum);
      }
      return next;
    });
  };
  
  const expandAll = () => {
    if (explanation?.steps) {
      setExpandedSteps(new Set(explanation.steps.map(s => s.step_number)));
    }
  };
  
  const collapseAll = () => {
    setExpandedSteps(new Set());
  };

  // Determine if we have a suggested alternative
  const hasSuggestion = validationResult?.suggested_query && validationResult?.suggested_query !== query;
  const isQueryWorking = validationResult?.status === 'success' || (explanation?.executed && !explanation?.error_message && explanation?.row_count > 0);
  const isQueryEmpty = validationResult?.status === 'empty' || (explanation?.executed && !explanation?.error_message && explanation?.row_count === 0);
  const isQueryFailed = validationResult?.status === 'error' || (explanation?.executed && explanation?.error_message);
  
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BookOpen size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">Show My Work</h2>
              <p className="text-sm text-gray-500">Understanding this SQL query step-by-step</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg text-gray-500">
            <X size={20} />
          </button>
        </div>
        
        {/* Status Badge */}
        {!loading && (
          <div className="px-6 pt-4">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              isQueryWorking ? 'bg-green-100 text-green-700' :
              isQueryEmpty ? 'bg-amber-100 text-amber-700' :
              isQueryFailed ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {isQueryWorking && <><CheckCircle size={16} /> Query works! Returns {explanation?.row_count?.toLocaleString() || validationResult?.row_count?.toLocaleString()} rows</>}
              {isQueryEmpty && <><AlertCircle size={16} /> Query runs but returns 0 rows</>}
              {isQueryFailed && <><AlertCircle size={16} /> Query has errors</>}
            </div>
          </div>
        )}
        
        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4">
          <button
            onClick={() => setActiveTab('explanation')}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium ${
              activeTab === 'explanation' ? 'bg-white border border-b-0 border-gray-200' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📖 Step-by-Step
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium ${
              activeTab === 'sql' ? 'bg-white border border-b-0 border-gray-200' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Code2 size={14} className="inline mr-1" /> SQL Code
          </button>
          <button
            onClick={() => setActiveTab('results')}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium ${
              activeTab === 'results' ? 'bg-white border border-b-0 border-gray-200' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Table size={14} className="inline mr-1" /> Results
          </button>
          {hasSuggestion && (
            <button
              onClick={() => setActiveTab('suggestion')}
              className={`px-4 py-2 rounded-t-lg text-sm font-medium ${
                activeTab === 'suggestion' ? 'bg-white border border-b-0 border-gray-200' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Sparkles size={14} className="inline mr-1" /> Suggested Query
            </button>
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-auto p-6 bg-white border-t border-gray-200">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={32} className="animate-spin text-blue-500" />
              <span className="ml-3 text-gray-600">Analyzing query...</span>
            </div>
          ) : (
            <>
              {activeTab === 'explanation' && explanation && (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <h3 className="font-medium text-blue-800 mb-1">What this query does:</h3>
                    <p className="text-blue-700">{explanation.summary}</p>
                    
                    <div className="flex flex-wrap gap-4 mt-3 text-sm">
                      {explanation.tables_used?.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Database size={14} className="text-blue-500" />
                          <span className="text-blue-700">Tables: {explanation.tables_used.join(', ')}</span>
                        </div>
                      )}
                      {explanation.columns_selected?.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Columns size={14} className="text-blue-500" />
                          <span className="text-blue-700">
                            Columns: {explanation.columns_selected[0] === '*' ? 'All' : explanation.columns_selected.length}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Steps */}
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-700">Query Breakdown</h3>
                    <div className="flex gap-2 text-xs">
                      <button onClick={expandAll} className="text-blue-600 hover:text-blue-800">Expand all</button>
                      <span className="text-gray-300">|</span>
                      <button onClick={collapseAll} className="text-blue-600 hover:text-blue-800">Collapse all</button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {explanation.steps?.map(step => (
                      <StepCard
                        key={step.step_number}
                        step={step}
                        isExpanded={expandedSteps.has(step.step_number)}
                        onToggle={() => toggleStep(step.step_number)}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {activeTab === 'sql' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-700">Formatted SQL</h3>
                    <CopyButton text={query} />
                  </div>
                  <pre className="p-4 bg-gray-900 text-gray-100 rounded-lg overflow-x-auto text-sm font-mono whitespace-pre-wrap">
                    {explanation?.formatted_sql || query}
                  </pre>
                </div>
              )}
              
              {activeTab === 'results' && (
                <div>
                  <h3 className="font-medium text-gray-700 mb-3">Query Results</h3>
                  
                  {explanation?.error_message ? (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-red-700">Query Failed</p>
                          <p className="text-sm text-red-600 mt-1 font-mono">{explanation.error_message}</p>
                        </div>
                      </div>
                    </div>
                  ) : explanation?.sample_data ? (
                    <SampleDataPreview 
                      columns={explanation.columns_selected?.[0] === '*' ? Object.keys(explanation.sample_data[0] || {}) : explanation.columns_selected}
                      data={explanation.sample_data}
                      rowCount={explanation.row_count}
                    />
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <p>No results to display</p>
                    </div>
                  )}
                </div>
              )}
              
              {activeTab === 'suggestion' && hasSuggestion && (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Sparkles size={20} className="text-green-500 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-green-700">We found a similar query that returns results!</p>
                        <p className="text-sm text-green-600 mt-1">
                          The original query targets a table that's empty or doesn't exist. 
                          Here's an alternative that works:
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-gray-700">Suggested Query</h3>
                      <CopyButton text={validationResult.suggested_query} />
                    </div>
                    <pre className="p-4 bg-gray-900 text-gray-100 rounded-lg overflow-x-auto text-sm font-mono whitespace-pre-wrap">
                      {validationResult.suggested_query}
                    </pre>
                  </div>
                  
                  {validationResult.suggested_query_result && (
                    <div>
                      <h3 className="font-medium text-gray-700 mb-2">
                        ✅ Verified: Returns {validationResult.suggested_query_result.row_count?.toLocaleString()} rows
                      </h3>
                      <SampleDataPreview 
                        columns={validationResult.suggested_query_result.columns}
                        data={validationResult.suggested_query_result.sample_data}
                        rowCount={validationResult.suggested_query_result.row_count}
                      />
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-500">
            {explanation?.execution_time_ms && (
              <span>Query executed in {explanation.execution_time_ms}ms</span>
            )}
          </div>
          <div className="flex gap-2">
            {hasSuggestion && onRunSuggestedQuery && (
              <button
                onClick={() => {
                  onRunSuggestedQuery(validationResult.suggested_query);
                  onClose();
                }}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium"
              >
                <Sparkles size={16} />
                Run Suggested Query
              </button>
            )}
            {onRunQuery && (
              <button
                onClick={() => {
                  onRunQuery(query);
                  onClose();
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
              >
                <Play size={16} />
                Run This Query
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


```

## src/components/StepWizard.jsx

```jsx
/**
 * StepWizard Component
 * 
 * A guided multi-step query wizard that helps users build complex queries
 * incrementally, with each step providing context and data for the next.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  Play,
  Check,
  AlertCircle,
  Loader2,
  GitBranch,
  Table,
  Search,
  Code,
  ArrowRight,
  SkipForward,
  Copy,
  Sparkles,
  Zap,
  CheckCircle2,
  XCircle,
  Info,
  BookOpen,
  Layers,
  LayoutDashboard,
  BarChart2,
  Database,
  Activity,
} from 'lucide-react';
import { createWizardState, advanceWizard, WIZARD_STATUS } from '../queryFlows/stepFlows/types';
import { getWizardFlow, getAllWizardFlows } from '../queryFlows/stepFlows';
import { useQuery } from '../hooks/useSnowflake';
import { useConfig } from '../context/SystemConfigContext';

// Step icons - mapped by step ID or step kind
const STEP_ICONS = {
  // By step ID (legacy)
  discover_tables: Search,
  examine_structure: Table,
  sample_data: Sparkles,
  build_lineage_query: GitBranch,
  
  // By step kind (new pattern from recipes)
  DISCOVER: Search,
  INSPECT: Table,
  SAMPLE: Sparkles,
  BUILD_FINAL: Code,
  SEARCH: Search,
  VALIDATE: Check,
  
  // Domain-specific
  find_glossary_tables: BookOpen,
  list_glossaries: BookOpen,
  search_terms: Search,
  find_dbt_tables: Layers,
  list_models: Layers,
  find_bi_tables: LayoutDashboard,
  list_dashboards: LayoutDashboard,
  basic_stats: BarChart2,
  top_values: BarChart2,
  sample_values: Sparkles,
  list_tables: Database,
  pick_table: Table,
  sample_table: Sparkles,
  find_usage_tables: Activity,
  recent_queries: Activity,
  popularity_stats: Activity,
};

/**
 * Progress indicator showing all steps
 */
function StepProgress({ steps, currentIndex, stepResults }) {
  return (
    <div className="flex items-center gap-1 px-4 py-3 bg-gray-50 border-b border-gray-200">
      {steps.map((step, idx) => {
        const isComplete = idx < currentIndex;
        const isCurrent = idx === currentIndex;
        const result = stepResults[idx];
        const hasError = result && !result.success;
        
        const Icon = STEP_ICONS[step.id] || Code;
        
        return (
          <React.Fragment key={step.id}>
            {idx > 0 && (
              <div className={`h-0.5 w-6 ${isComplete ? 'bg-emerald-500' : 'bg-gray-300'}`} />
            )}
            <div 
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
                transition-colors
                ${isCurrent ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-500 ring-offset-1' : ''}
                ${isComplete && !hasError ? 'bg-emerald-100 text-emerald-700' : ''}
                ${hasError ? 'bg-red-100 text-red-700' : ''}
                ${!isCurrent && !isComplete && !hasError ? 'bg-gray-100 text-gray-500' : ''}
              `}
            >
              {isComplete && !hasError && <Check size={12} />}
              {hasError && <XCircle size={12} />}
              {!isComplete && !hasError && <Icon size={12} />}
              <span className="hidden sm:inline">Step {idx + 1}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

/**
 * SQL preview with syntax highlighting
 */
function SqlPreview({ sql, onCopy }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopy?.();
  };
  
  return (
    <div className="relative">
      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto max-h-64 overflow-y-auto font-mono">
        {sql.split('\n').map((line, i) => {
          // Simple syntax highlighting
          let highlighted = line;
          
          // Comments in green
          if (line.trim().startsWith('--')) {
            return <div key={i} className="text-emerald-400">{line}</div>;
          }
          
          // Keywords in blue
          const keywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'ON', 'AND', 'OR', 'ORDER', 'BY', 
                          'LIMIT', 'WITH', 'AS', 'UNION', 'ALL', 'RECURSIVE', 'INNER', 'LEFT',
                          'SHOW', 'TABLES', 'LIKE', 'IN', 'DESCRIBE', 'TABLE', 'IS', 'NOT', 'NULL',
                          'DISTINCT', 'ARRAY_CONSTRUCT', 'ARRAY_APPEND', 'ARRAY_CONTAINS', 'PARSE_JSON'];
          
          keywords.forEach(kw => {
            const regex = new RegExp(`\\b${kw}\\b`, 'gi');
            highlighted = highlighted.replace(regex, match => `<span class="text-blue-400">${match}</span>`);
          });
          
          return <div key={i} dangerouslySetInnerHTML={{ __html: highlighted }} />;
        })}
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-2 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 hover:text-white transition-colors"
        title="Copy SQL"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}

/**
 * Results preview table
 */
function ResultsPreview({ results, maxRows = 5 }) {
  if (!results?.rows?.length) {
    return (
      <div className="text-center py-6 text-gray-500">
        <AlertCircle className="mx-auto mb-2" size={24} />
        <p>No results returned</p>
      </div>
    );
  }
  
  const columns = results.columns || Object.keys(results.rows[0] || {});
  const rows = results.rows.slice(0, maxRows);
  
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col, i) => (
              <th key={i} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {typeof col === 'object' ? col.name : col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              {columns.map((col, j) => {
                const colName = typeof col === 'object' ? col.name : col;
                const value = row[colName] ?? row[colName.toUpperCase()] ?? row[colName.toLowerCase()];
                const displayValue = typeof value === 'object' ? JSON.stringify(value).substring(0, 50) + '...' : String(value ?? '');
                return (
                  <td key={j} className="px-3 py-2 text-gray-700 max-w-xs truncate" title={String(value ?? '')}>
                    {displayValue}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {results.rows.length > maxRows && (
        <p className="text-xs text-gray-500 mt-2 text-center">
          Showing {maxRows} of {results.rows.length} rows
        </p>
      )}
    </div>
  );
}

/**
 * Extracted data display
 */
function ExtractedData({ data, title = "Data for next step" }) {
  if (!data || Object.keys(data).length === 0) return null;
  
  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mt-3">
      <div className="flex items-center gap-2 text-indigo-700 text-sm font-medium mb-2">
        <Zap size={14} />
        {title}
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {Object.entries(data).map(([key, value]) => {
          if (key === 'discoveredTables' || key === 'processColumns' || key === 'sampleGuids' || key === 'sampleRows') {
            // Array data
            const arr = Array.isArray(value) ? value : [];
            return (
              <div key={key} className="col-span-2">
                <span className="text-gray-500">{key}:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {arr.slice(0, 5).map((item, i) => (
                    <span key={i} className="px-2 py-0.5 bg-white border border-indigo-200 rounded text-xs text-indigo-700">
                      {typeof item === 'object' ? JSON.stringify(item).substring(0, 30) : String(item)}
                    </span>
                  ))}
                  {arr.length > 5 && <span className="text-xs text-gray-400">+{arr.length - 5} more</span>}
                </div>
              </div>
            );
          }
          return (
            <div key={key}>
              <span className="text-gray-500">{key}:</span>{' '}
              <span className="text-indigo-700 font-medium">
                {typeof value === 'boolean' ? (value ? '✓ Yes' : '✗ No') : String(value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Main StepWizard component
 * 
 * This component is FLOW-AGNOSTIC. It works with any recipe from QUERY_RECIPES.
 * Pass a flowId (recipe ID) and it will build and execute that wizard.
 */
export default function StepWizard({
  flowId = 'lineage_downstream',  // Default to downstream lineage recipe
  entity,
  availableTables = [],
  database,
  schema,
  onComplete,
  onCancel,
  onUseSql,
}) {
  // Get SystemConfig for config-driven entity resolution
  const systemConfig = useConfig();
  
  // Get the flow from the global registry (built from recipes)
  const flow = getWizardFlow(flowId);
  
  // Initialize wizard state with SystemConfig
  const [wizardState, setWizardState] = useState(() => {
    // Get db/schema from SystemConfig if not provided
    const queryDefaults = systemConfig?.queryDefaults || {};
    const defaultDb = database || queryDefaults.metadataDb || 'FIELD_METADATA';
    const defaultSchema = schema || queryDefaults.metadataSchema || 'PUBLIC';
    
    const initialInputs = flow?.buildInitialInputs?.(entity, availableTables, systemConfig?.config) || {};
    return createWizardState(flowId, {
      ...initialInputs,
      database: defaultDb,
      schema: defaultSchema,
      // Pass SystemConfig through to steps
      systemConfig: systemConfig?.config,
    });
  });
  
  const [isRunning, setIsRunning] = useState(false);
  const [currentResults, setCurrentResults] = useState(null);
  const [currentError, setCurrentError] = useState(null);
  
  const { executeQuery } = useQuery();
  
  // Get current step
  const currentStep = useMemo(() => {
    return flow?.steps?.[wizardState.currentStepIndex] || null;
  }, [flow, wizardState.currentStepIndex]);
  
  // Generate SQL for current step
  const currentSql = useMemo(() => {
    if (!currentStep?.buildQuery) return '';
    return currentStep.buildQuery(entity, wizardState.inputs);
  }, [currentStep, entity, wizardState.inputs]);
  
  // Check if should skip current step
  useEffect(() => {
    if (currentStep?.shouldSkip?.(wizardState.inputs)) {
      // Auto-skip this step
      handleSkip();
    }
  }, [currentStep, wizardState.inputs]);
  
  // Run the current step
  const handleRunStep = useCallback(async () => {
    if (!currentSql || isRunning) return;
    
    setIsRunning(true);
    setCurrentError(null);
    setCurrentResults(null);
    
    try {
      const results = await executeQuery(currentSql, {
        database: wizardState.inputs.database,
        schema: wizardState.inputs.schema,
        timeout: 30,
      });
      
      if (results?.error) {
        setCurrentError(results.error);
        setCurrentResults(null);
      } else {
        setCurrentResults(results);
        setCurrentError(null);
      }
    } catch (err) {
      setCurrentError(err.message || 'Query execution failed');
    } finally {
      setIsRunning(false);
    }
  }, [currentSql, executeQuery, wizardState.inputs, isRunning]);
  
  // Continue to next step
  const handleContinue = useCallback(() => {
    if (!currentResults) return;
    
    // Extract data for next step
    const extractedData = currentStep?.extractDataForNext?.(currentResults) || {};
    
    const stepResult = {
      success: true,
      results: currentResults,
      extractedData,
    };
    
    const newState = advanceWizard(wizardState, stepResult, flow);
    setWizardState(newState);
    setCurrentResults(null);
    setCurrentError(null);
    
    // Check if flow is complete
    if (newState.isComplete) {
      // Generate final SQL
      const finalStep = flow.steps[flow.steps.length - 1];
      const finalSql = finalStep?.buildQuery?.(entity, newState.inputs) || '';
      onComplete?.({ sql: finalSql, inputs: newState.inputs });
    }
  }, [currentResults, currentStep, wizardState, flow, entity, onComplete]);
  
  // Skip current step
  const handleSkip = useCallback(() => {
    const stepResult = {
      success: true,
      results: null,
      extractedData: {},
      skipped: true,
    };
    
    const newState = advanceWizard(wizardState, stepResult, flow);
    setWizardState(newState);
    setCurrentResults(null);
    setCurrentError(null);
  }, [wizardState, flow]);
  
  // Go back to previous step
  const handleBack = useCallback(() => {
    if (wizardState.currentStepIndex === 0) return;
    
    setWizardState(prev => ({
      ...prev,
      currentStepIndex: prev.currentStepIndex - 1,
      stepResults: prev.stepResults.slice(0, -1),
    }));
    setCurrentResults(null);
    setCurrentError(null);
  }, [wizardState.currentStepIndex]);
  
  // Use current SQL in editor
  const handleUseSql = useCallback(() => {
    onUseSql?.(currentSql);
  }, [currentSql, onUseSql]);
  
  if (!flow) {
    return (
      <div className="p-4 text-center text-red-600">
        Unknown flow: {flowId}
      </div>
    );
  }
  
  const isLastStep = wizardState.currentStepIndex === flow.steps.length - 1;
  const canGoBack = wizardState.currentStepIndex > 0;
  const canContinue = currentResults && !currentError && !isLastStep;
  const canFinish = currentResults && !currentError && isLastStep;
  
  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-lg">
            <GitBranch size={20} />
          </div>
          <div>
            <h3 className="font-semibold">{flow.label}</h3>
            <p className="text-sm text-indigo-100">{flow.description}</p>
          </div>
        </div>
      </div>
      
      {/* Progress */}
      <StepProgress 
        steps={flow.steps} 
        currentIndex={wizardState.currentStepIndex}
        stepResults={wizardState.stepResults}
      />
      
      {/* Current step content */}
      <div className="flex-1 overflow-y-auto p-4">
        {currentStep && (
          <>
            {/* Step header */}
            <div className="mb-4">
              <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                {(() => {
                  const Icon = STEP_ICONS[currentStep.id] || Code;
                  return <Icon size={20} className="text-indigo-600" />;
                })()}
                {currentStep.title}
              </h4>
              <p className="text-sm text-gray-600 mt-1">{currentStep.description}</p>
            </div>
            
            {/* SQL Preview */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Generated SQL</span>
                <button
                  onClick={handleUseSql}
                  className="text-xs text-indigo-600 hover:text-indigo-700"
                >
                  Open in Editor →
                </button>
              </div>
              <SqlPreview sql={currentSql} />
            </div>
            
            {/* Run button */}
            {!currentResults && !currentError && (
              <div className="flex justify-center mb-4">
                <button
                  onClick={handleRunStep}
                  disabled={isRunning}
                  className={`
                    inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-white
                    transition-all
                    ${isRunning 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg hover:shadow-xl'}
                  `}
                >
                  {isRunning ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play size={18} />
                      Run This Step
                    </>
                  )}
                </button>
              </div>
            )}
            
            {/* Error */}
            {currentError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <XCircle className="text-red-600 shrink-0 mt-0.5" size={18} />
                  <div>
                    <h5 className="font-medium text-red-800">Query Failed</h5>
                    <p className="text-sm text-red-700 mt-1">{currentError}</p>
                    <button
                      onClick={() => {
                        setCurrentError(null);
                      }}
                      className="text-sm text-red-600 hover:text-red-700 mt-2 underline"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Results */}
            {currentResults && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="text-emerald-600" size={18} />
                  <span className="text-sm font-medium text-emerald-700">
                    Step completed! {currentResults.rows?.length || 0} rows returned
                  </span>
                </div>
                
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <ResultsPreview results={currentResults} />
                </div>
                
                {/* Extracted data */}
                {currentStep.extractDataForNext && (
                  <ExtractedData 
                    data={currentStep.extractDataForNext(currentResults)}
                    title="Extracted for next step"
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Footer with navigation */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
        <div>
          {canGoBack && (
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              <ChevronLeft size={16} />
              Back
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {currentStep?.optional && !currentResults && (
            <button
              onClick={handleSkip}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              <SkipForward size={14} />
              Skip
            </button>
          )}
          
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          
          {canContinue && (
            <button
              onClick={handleContinue}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
            >
              Continue
              <ChevronRight size={16} />
            </button>
          )}
          
          {canFinish && (
            <button
              onClick={() => {
                // Pass the final SQL to the editor
                onUseSql?.(currentSql);
                onComplete?.({ sql: currentSql, inputs: wizardState.inputs });
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium"
            >
              <Check size={16} />
              Use This Query
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


```

## src/components/SuggestionChips.jsx

```jsx
/**
 * SuggestionChips - Clickable suggestion chips for query fixes
 * 
 * Displays query suggestions as interactive chips that can be clicked
 * to auto-apply fixes. Supports table, column, syntax, and full rewrite suggestions.
 */

import React, { useState } from 'react';
import { 
  Table, Columns, Wrench, Sparkles, Check, Copy, Eye, 
  ChevronRight, Database, Zap, Info, HelpCircle, Lightbulb,
  Search, AlertTriangle
} from 'lucide-react';

/**
 * Single suggestion chip component
 */
function SuggestionChip({ 
  suggestion, 
  onApply, 
  showPreview = true,
  compact = false 
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [applied, setApplied] = useState(false);
  
  const handleApply = () => {
    setApplied(true);
    onApply(suggestion);
    // Reset after animation
    setTimeout(() => setApplied(false), 1500);
  };
  
  // Icon based on suggestion type
  const getIcon = () => {
    switch (suggestion.type) {
      case 'table':
        return <Table size={14} />;
      case 'column':
        return <Columns size={14} />;
      case 'syntax':
        return <Wrench size={14} />;
      case 'rewrite':
        return <Sparkles size={14} />;
      case 'info':
        return suggestion.isGuidance ? <Lightbulb size={14} /> : <Info size={14} />;
      default:
        return <Zap size={14} />;
    }
  };
  
  // Style based on suggestion type
  const getStyles = () => {
    if (applied) {
      return 'bg-green-100 text-green-700 border-green-300';
    }
    
    // Guidance items have a different style - not clickable to apply
    if (suggestion.isGuidance) {
      return 'bg-indigo-50 text-indigo-700 border-indigo-200 cursor-default';
    }
    
    // Helper queries (like "find GUIDs") have a distinct style
    if (suggestion.isHelper) {
      return 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100 hover:border-violet-300';
    }
    
    switch (suggestion.type) {
      case 'table':
        return 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:border-blue-300';
      case 'column':
        return 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 hover:border-purple-300';
      case 'syntax':
        return 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 hover:border-amber-300';
      case 'rewrite':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300';
      case 'info':
        return 'bg-slate-50 text-slate-700 border-slate-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 hover:border-gray-300';
    }
  };
  
  // Confidence indicator
  const confidencePercent = Math.round((suggestion.confidence || 0.5) * 100);
  const confidenceColor = confidencePercent >= 80 ? 'bg-green-400' : 
                          confidencePercent >= 60 ? 'bg-yellow-400' : 'bg-gray-400';
  
  // For guidance items without a fix, show as info card
  if (suggestion.isGuidance) {
    return (
      <div
        className={`relative rounded-lg border p-3 ${getStyles()}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex items-start gap-2">
          <div className="mt-0.5 flex-shrink-0">
            {getIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm">{suggestion.title}</div>
            <p className="text-xs opacity-80 mt-0.5">{suggestion.description}</p>
            
            {/* Show help text if available */}
            {suggestion.helpText && (
              <div className="mt-2 p-2 bg-white bg-opacity-50 rounded text-xs font-mono whitespace-pre-wrap">
                {suggestion.helpText}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  if (compact) {
    return (
      <button
        onClick={handleApply}
        disabled={!suggestion.fix}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border transition-all ${getStyles()} ${!suggestion.fix ? 'opacity-60 cursor-not-allowed' : ''}`}
        title={suggestion.description}
      >
        {applied ? <Check size={12} /> : getIcon()}
        <span>{suggestion.title}</span>
        {suggestion.badge && (
          <span className="text-[10px] px-1 bg-amber-200 text-amber-800 rounded">
            {suggestion.badge}
          </span>
        )}
      </button>
    );
  }
  
  return (
    <div
      className={`relative group rounded-lg border transition-all ${getStyles()} ${isHovered ? 'shadow-md' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        onClick={handleApply}
        disabled={!suggestion.fix}
        className={`w-full text-left p-3 ${!suggestion.fix ? 'cursor-not-allowed' : ''}`}
      >
        <div className="flex items-start gap-2">
          <div className="mt-0.5 flex-shrink-0">
            {applied ? <Check size={16} className="text-green-600" /> : getIcon()}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{suggestion.title}</span>
              {suggestion.badge && (
                <span className="text-[10px] px-1.5 py-0.5 bg-amber-200 text-amber-800 rounded-full font-medium">
                  {suggestion.badge}
                </span>
              )}
              {suggestion.rowCount !== undefined && (
                <span className="text-xs opacity-70">
                  ({suggestion.rowCount.toLocaleString()} rows)
                </span>
              )}
            </div>
            
            <p className="text-xs opacity-70 mt-0.5 line-clamp-2">
              {suggestion.description}
            </p>
            
            {/* Help text for helper queries */}
            {suggestion.isHelper && suggestion.helpText && (
              <p className="text-xs opacity-60 mt-1 italic">
                {suggestion.helpText}
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Confidence indicator */}
            {!suggestion.isHelper && (
              <div className="flex items-center gap-1" title={`${confidencePercent}% confidence`}>
                <div className="w-8 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${confidenceColor} transition-all`}
                    style={{ width: `${confidencePercent}%` }}
                  />
                </div>
              </div>
            )}
            
            {suggestion.fix && (
              <ChevronRight size={16} className="opacity-50 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
        </div>
        
        {/* Preview on hover */}
        {showPreview && suggestion.preview && isHovered && (
          <div className="mt-2 pt-2 border-t border-current border-opacity-20">
            <div className="flex items-center gap-1 text-xs opacity-70 mb-1">
              <Eye size={12} />
              <span>Preview</span>
            </div>
            <pre className="text-xs bg-black bg-opacity-5 rounded p-2 overflow-x-auto whitespace-pre-wrap font-mono">
              {suggestion.preview.length > 200 
                ? suggestion.preview.substring(0, 200) + '...' 
                : suggestion.preview}
            </pre>
          </div>
        )}
      </button>
    </div>
  );
}

/**
 * Container for multiple suggestion chips
 */
export function SuggestionList({ 
  suggestions = [], 
  onApply, 
  title = 'Suggestions',
  maxVisible = 5,
  layout = 'list', // 'list' | 'inline' | 'grid'
  emptyMessage = null
}) {
  const [showAll, setShowAll] = useState(false);
  
  if (!suggestions.length) {
    if (emptyMessage) {
      return (
        <div className="text-sm text-gray-500 italic py-2">
          {emptyMessage}
        </div>
      );
    }
    return null;
  }
  
  const visibleSuggestions = showAll ? suggestions : suggestions.slice(0, maxVisible);
  const hasMore = suggestions.length > maxVisible;
  
  // Group by type for better organization
  const groupedByType = layout === 'list' ? null : suggestions.reduce((acc, s) => {
    const type = s.type || 'other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(s);
    return acc;
  }, {});
  
  const layoutClasses = {
    list: 'flex flex-col gap-2',
    inline: 'flex flex-wrap gap-2',
    grid: 'grid grid-cols-2 gap-2'
  };
  
  return (
    <div className="space-y-2">
      {title && (
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Sparkles size={14} className="text-amber-500" />
          <span>{title}</span>
          <span className="text-xs text-gray-400">({suggestions.length})</span>
        </div>
      )}
      
      <div className={layoutClasses[layout] || layoutClasses.list}>
        {layout === 'inline' ? (
          // Inline chips (compact)
          visibleSuggestions.map((suggestion, idx) => (
            <SuggestionChip
              key={`${suggestion.type}-${suggestion.title}-${idx}`}
              suggestion={suggestion}
              onApply={onApply}
              compact={true}
            />
          ))
        ) : (
          // List or grid (full cards)
          visibleSuggestions.map((suggestion, idx) => (
            <SuggestionChip
              key={`${suggestion.type}-${suggestion.title}-${idx}`}
              suggestion={suggestion}
              onApply={onApply}
              showPreview={layout !== 'grid'}
            />
          ))
        )}
      </div>
      
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
        >
          {showAll 
            ? 'Show less' 
            : `Show ${suggestions.length - maxVisible} more suggestions`}
        </button>
      )}
    </div>
  );
}

/**
 * Quick fix inline chip for error messages
 */
export function QuickFixChip({ suggestion, onApply }) {
  const [applied, setApplied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  const handleClick = () => {
    setApplied(true);
    onApply(suggestion);
    setTimeout(() => setApplied(false), 1500);
  };
  
  // Style based on confidence
  const isHighConfidence = suggestion.confidence > 0.7;
  const hasData = suggestion.rowCount > 0;
  
  const baseStyle = applied 
    ? 'bg-green-100 text-green-700 border-green-300'
    : isHighConfidence
      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400'
      : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:border-blue-300';
  
  return (
    <div className="relative inline-block">
      <button
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border transition-all ${baseStyle}`}
        title={suggestion.description}
      >
        {applied ? (
          <Check size={12} className="text-green-600" />
        ) : isHighConfidence ? (
          <Sparkles size={12} />
        ) : (
          <Zap size={12} />
        )}
        <span>{suggestion.title}</span>
        {hasData && !applied && (
          <span className="text-[10px] opacity-60">
            ({suggestion.rowCount.toLocaleString()})
          </span>
        )}
      </button>
      
      {/* Tooltip on hover */}
      {isHovered && suggestion.description && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs bg-gray-900 text-white rounded shadow-lg whitespace-nowrap max-w-xs truncate">
          {suggestion.description}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}

/**
 * Autocomplete dropdown for proactive suggestions
 */
export function AutocompleteDropdown({ 
  suggestions = [], 
  onSelect, 
  position = { top: 0, left: 0 },
  visible = false 
}) {
  if (!visible || !suggestions.length) return null;
  
  return (
    <div 
      className="absolute z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-48 max-w-80 max-h-64 overflow-y-auto"
      style={{ top: position.top, left: position.left }}
    >
      {suggestions.map((suggestion, idx) => (
        <button
          key={`${suggestion.type}-${suggestion.title}-${idx}`}
          onClick={() => onSelect(suggestion)}
          className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center gap-2 text-sm"
        >
          {suggestion.type === 'table' && <Table size={14} className="text-blue-500" />}
          {suggestion.type === 'column' && <Columns size={14} className="text-purple-500" />}
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{suggestion.title}</div>
            <div className="text-xs text-gray-500 truncate">{suggestion.description}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

export default SuggestionChip;


```

## src/components/TestQueryLayout.jsx

```jsx
/**
 * TestQueryLayout - Layout component for the "Test Query" mode in the flyout panel
 * 
 * Provides a single header with gradient styling and embeds the FlyoutQueryEditor
 * without duplicate headers.
 */

import React from 'react';
import { ArrowLeft, FlaskConical, X } from 'lucide-react';
import FlyoutQueryEditor from './FlyoutQueryEditor';

export default function TestQueryLayout({
  testQueryMode,
  onBack,
  onClose,
  onOpenFullEditor,
  selectedDatabase,
  selectedSchema,
  // Pass through to check for unsaved changes
  onSqlChange = null,
  // Schema info for suggestions
  availableTables = [],
  tableColumns = {}
}) {
  return (
    <>
      {/* Test Mode Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-emerald-500 to-teal-500 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
            title="Back to queries"
          >
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <FlaskConical size={18} />
              Test Query
            </h2>
            <p className="text-sm text-emerald-100">
              {testQueryMode.title || 'Run this query against your MDLH connection.'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-white/20 text-white transition-colors"
          title="Close (Esc)"
        >
          <X size={18} />
        </button>
      </header>

      {/* Editor + results - FlyoutQueryEditor handles everything else */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <FlyoutQueryEditor
          title={testQueryMode.title}
          initialQuery={testQueryMode.query}
          database={selectedDatabase}
          schema={selectedSchema}
          onOpenFullEditor={onOpenFullEditor}
          onClose={onBack}
          // Hide the internal header since we have the Test Mode header above
          hideHeader={true}
          onSqlChange={onSqlChange}
          // Schema info for smart suggestions
          availableTables={availableTables}
          tableColumns={tableColumns}
        />
      </div>
    </>
  );
}


```



# CONTEXT


## src/context/SystemConfigContext.jsx

```jsx
/**
 * SystemConfigContext
 * 
 * Provides the SystemConfig to all components via React context.
 * This is the SINGLE SOURCE OF TRUTH for what's available in this Snowflake environment.
 * 
 * Usage:
 * ```jsx
 * // In App.jsx
 * import { SystemConfigProvider } from './context/SystemConfigContext';
 * 
 * <SystemConfigProvider>
 *   <YourApp />
 * </SystemConfigProvider>
 * 
 * // In any component
 * import { useConfig } from '../context/SystemConfigContext';
 * 
 * function MyComponent() {
 *   const config = useConfig();
 *   const hasLineage = config?.features?.lineage;
 *   const processEntity = config?.snowflake?.entities?.PROCESS_ENTITY;
 * }
 * ```
 */

import React, { createContext, useContext, useMemo } from 'react';
import { useSystemConfig } from '../hooks/useSystemConfig';

// Create context with null default
const SystemConfigContext = createContext(null);

/**
 * Provider component that wraps the app and provides SystemConfig.
 */
export function SystemConfigProvider({ children }) {
  const {
    config,
    loading,
    error,
    refresh,
    entities,
    features,
    queryDefaults,
    catalog,
    hasEntity,
    getEntity,
    getEntityFQN,
  } = useSystemConfig();

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    // Raw config
    config,
    loading,
    error,
    refresh,
    
    // Convenient accessors
    entities,
    features,
    queryDefaults,
    catalog,
    
    // Helper functions
    hasEntity,
    getEntity,
    getEntityFQN,
    
    // Metadata shortcuts
    metadataDb: queryDefaults?.metadataDb || 'FIELD_METADATA',
    metadataSchema: queryDefaults?.metadataSchema || 'PUBLIC',
    
    // Feature checks
    hasLineage: features?.lineage ?? false,
    hasGlossary: features?.glossary ?? false,
    hasDbt: features?.dbt ?? false,
    hasBiUsage: features?.biUsage ?? false,
    hasQueryHistory: features?.queryHistory ?? false,
  }), [
    config,
    loading,
    error,
    refresh,
    entities,
    features,
    queryDefaults,
    catalog,
    hasEntity,
    getEntity,
    getEntityFQN,
  ]);

  return (
    <SystemConfigContext.Provider value={value}>
      {children}
    </SystemConfigContext.Provider>
  );
}

/**
 * Hook to access the SystemConfig from context.
 * 
 * @returns {Object} The config context value
 */
export function useConfig() {
  const context = useContext(SystemConfigContext);
  
  // Return empty object if not in provider (for backwards compatibility)
  if (context === null) {
    return {
      config: null,
      loading: false,
      error: null,
      entities: {},
      features: {},
      queryDefaults: {},
      catalog: { tables: [], columns: [] },
      hasEntity: () => false,
      getEntity: () => null,
      getEntityFQN: () => null,
      metadataDb: 'FIELD_METADATA',
      metadataSchema: 'PUBLIC',
      hasLineage: true,  // Default to true for backwards compatibility
      hasGlossary: true,
      hasDbt: false,
      hasBiUsage: false,
      hasQueryHistory: false,
    };
  }
  
  return context;
}

/**
 * Hook to get metadata query context (db/schema for metadata queries).
 * 
 * Use this instead of hardcoded 'FIELD_METADATA.PUBLIC'.
 */
export function useMetadataQueryContext() {
  const { metadataDb, metadataSchema, config } = useConfig();
  
  return {
    metadataDb,
    metadataSchema,
    config,
    
    // Get a fully qualified name with the metadata context
    fqn: (tableName) => `"${metadataDb}"."${metadataSchema}"."${tableName}"`,
    
    // Get the metadata prefix for queries
    prefix: `${metadataDb}.${metadataSchema}`,
  };
}

export default SystemConfigContext;


```



# QUERY FLOWS


## src/queryFlows/index.js

```javascript
/**
 * Query Flows Module
 * 
 * Config-driven query flow system for all entity types and query types.
 * 
 * Usage:
 * ```js
 * import { openQueryFlow, getAvailableFlows, buildEntityContext } from './queryFlows';
 * 
 * // From MDLH entity data
 * const entity = buildEntityContext(mdlhRow);
 * 
 * // Get available flows for this entity type
 * const flows = getAvailableFlows(entity);
 * 
 * // Open a specific flow
 * openQueryFlow({
 *   flow: 'LINEAGE',
 *   entity,
 *   availableTables: discoveredTables,
 *   onOpen: (builtQuery) => {
 *     // Open in editor
 *     setSql(builtQuery.sql);
 *     setTitle(builtQuery.title);
 *   }
 * });
 * ```
 */

// Types
export { 
  ENTITY_TYPE_CONFIG, 
  QUERY_FLOW_CONFIG,
  mapTypenameToEntityType,
  buildEntityContext,
} from './types';

// Registry
export { 
  QUERY_FLOW_RECIPES,
  getFlowsForEntityType,
  buildFlowQuery,
  isFlowSupported,
} from './registry';

// Entry point helpers
export {
  openQueryFlow,
  getAvailableFlows,
  openLineageFlow,
  openSampleRowsFlow,
  openUsageFlow,
  openFindByGuidFlow,
  openSchemaBrowseFlow,
  openGlossaryFlow,
} from './openFlow';

// SQL Builders (for direct use if needed)
export { buildLineageQuery, buildLineageExplorationQuery } from './sql/lineage';
export { buildUsageQuery, buildPopularityQuery } from './sql/usage';
export { buildSampleRowsQuery, buildTableStatsQuery } from './sql/sampleRows';
export { buildSchemaBrowseQuery, buildTableSearchQuery, buildColumnDetailsQuery } from './sql/schemaBrowse';
export { buildGlossaryQuery, buildTermLinkedAssetsQuery, buildListGlossariesQuery } from './sql/glossary';
export { buildFindByGuidQuery, buildGuidDetailsQuery } from './sql/findByGuid';


```

## src/queryFlows/openFlow.js

```javascript
/**
 * Query Flow Entry Point
 * 
 * Helper function to open a query flow from any entity context.
 * This bridges the registry to the UI (FlyoutQueryEditor / TestQueryLayout).
 */

import { buildFlowQuery, getFlowsForEntityType, isFlowSupported } from './registry';
import { QUERY_FLOW_CONFIG, buildEntityContext } from './types';
import { createLogger } from '../utils/logger';

const flowLog = createLogger('QueryFlow');

/**
 * @typedef {Object} FlowOpenOptions
 * @property {import('./types').QueryFlowType} flow - The query flow to run
 * @property {import('./types').EntityContext} entity - Entity context
 * @property {Partial<import('./types').QueryFlowInputs>} [inputs] - Override inputs
 * @property {string[]} [availableTables] - Available tables for validation
 * @property {(query: import('./types').BuiltQuery) => void} onOpen - Callback when flow opens
 */

/**
 * Open a query flow for an entity
 * @param {FlowOpenOptions} options 
 * @returns {import('./types').BuiltQuery | null}
 */
export function openQueryFlow({ flow, entity, inputs = {}, availableTables = [], onOpen }) {
  flowLog.info('Opening query flow', {
    flow,
    entityType: entity.type,
    entityName: entity.name,
    entityGuid: entity.guid?.substring(0, 8),
  });

  // Check if flow is supported for this entity type
  if (!isFlowSupported(flow, entity.type)) {
    flowLog.warn('Flow not supported for entity type', { flow, entityType: entity.type });
    return null;
  }

  try {
    const builtQuery = buildFlowQuery(flow, entity, inputs, availableTables);
    
    flowLog.debug('Built query', {
      title: builtQuery.title,
      sqlLength: builtQuery.sql.length,
    });

    if (onOpen) {
      onOpen(builtQuery);
    }

    return builtQuery;
  } catch (err) {
    flowLog.error('Failed to build query', { error: err.message, flow, entity });
    return null;
  }
}

/**
 * Get available flows for an entity
 * @param {import('./types').EntityContext} entity 
 * @returns {Array<{id: string, label: string, description: string, icon: string}>}
 */
export function getAvailableFlows(entity) {
  const flows = getFlowsForEntityType(entity.type);
  
  return flows.map(recipe => ({
    id: recipe.id,
    label: recipe.label,
    description: recipe.description,
    icon: recipe.icon,
  }));
}

/**
 * Quick action: Open lineage flow
 * @param {import('./types').EntityContext} entity 
 * @param {'UPSTREAM' | 'DOWNSTREAM'} direction 
 * @param {string[]} availableTables 
 * @param {(query: import('./types').BuiltQuery) => void} onOpen 
 */
export function openLineageFlow(entity, direction, availableTables, onOpen) {
  return openQueryFlow({
    flow: 'LINEAGE',
    entity,
    inputs: { direction },
    availableTables,
    onOpen,
  });
}

/**
 * Quick action: Open sample rows flow
 * @param {import('./types').EntityContext} entity 
 * @param {(query: import('./types').BuiltQuery) => void} onOpen 
 */
export function openSampleRowsFlow(entity, onOpen) {
  return openQueryFlow({
    flow: 'SAMPLE_ROWS',
    entity,
    onOpen,
  });
}

/**
 * Quick action: Open usage flow
 * @param {import('./types').EntityContext} entity 
 * @param {string[]} availableTables 
 * @param {(query: import('./types').BuiltQuery) => void} onOpen 
 */
export function openUsageFlow(entity, availableTables, onOpen) {
  return openQueryFlow({
    flow: 'USAGE',
    entity,
    availableTables,
    onOpen,
  });
}

/**
 * Quick action: Find by GUID
 * @param {string} guid 
 * @param {string[]} availableTables 
 * @param {(query: import('./types').BuiltQuery) => void} onOpen 
 */
export function openFindByGuidFlow(guid, availableTables, onOpen) {
  const entity = {
    type: 'UNKNOWN',
    guid,
  };
  
  return openQueryFlow({
    flow: 'FIND_BY_GUID',
    entity,
    availableTables,
    onOpen,
  });
}

/**
 * Quick action: Schema browser
 * @param {string} database 
 * @param {string} schema 
 * @param {string[]} availableTables 
 * @param {(query: import('./types').BuiltQuery) => void} onOpen 
 */
export function openSchemaBrowseFlow(database, schema, availableTables, onOpen) {
  const entity = {
    type: 'SCHEMA',
    database,
    schema,
  };
  
  return openQueryFlow({
    flow: 'SCHEMA_BROWSE',
    entity,
    availableTables,
    onOpen,
  });
}

/**
 * Quick action: Glossary lookup
 * @param {string} term 
 * @param {string[]} availableTables 
 * @param {(query: import('./types').BuiltQuery) => void} onOpen 
 */
export function openGlossaryFlow(term, availableTables, onOpen) {
  const entity = {
    type: 'GLOSSARY_TERM',
    name: term,
  };
  
  return openQueryFlow({
    flow: 'GLOSSARY_LOOKUP',
    entity,
    inputs: { filters: { termName: term } },
    availableTables,
    onOpen,
  });
}

export default {
  openQueryFlow,
  getAvailableFlows,
  openLineageFlow,
  openSampleRowsFlow,
  openUsageFlow,
  openFindByGuidFlow,
  openSchemaBrowseFlow,
  openGlossaryFlow,
  buildEntityContext,
};


```

## src/queryFlows/queryRecipes.js

```javascript
/**
 * Query Recipes - Global Registry for All Multi-Step Wizard Flows
 * 
 * This is the SINGLE SOURCE OF TRUTH for all wizard flows across domains.
 * Each "wizard" is a recipe, not hardcoded JS.
 * 
 * To add a new wizard:
 * 1. Add an entry to QUERY_RECIPES
 * 2. Point steps to existing query templates
 * 3. Define inputBindings and outputBindings
 * 
 * That's it. No new wizard components needed.
 */

/**
 * High-level intent types for categorization and reuse
 */
export const QUERY_INTENTS = {
  LINEAGE: 'LINEAGE',
  PROFILE: 'PROFILE',
  DISCOVERY: 'DISCOVERY',
  QUALITY: 'QUALITY',
  USAGE: 'USAGE',
  GLOSSARY: 'GLOSSARY',
  SCHEMA: 'SCHEMA',
  SAMPLE: 'SAMPLE',
};

/**
 * Generic step kinds – lets the UI adapt copy/hints
 */
export const STEP_KINDS = {
  DISCOVER: 'DISCOVER',
  INSPECT: 'INSPECT',
  SAMPLE: 'SAMPLE',
  BUILD_FINAL: 'BUILD_FINAL',
  SEARCH: 'SEARCH',
  VALIDATE: 'VALIDATE',
};

/**
 * All wizard recipes across all domains.
 * 
 * Each recipe defines:
 * - id: unique identifier
 * - intent: categorization
 * - label: display name
 * - description: what this wizard does
 * - icon: lucide icon name
 * - domains: which tabs/categories this appears in
 * - supportedEntityTypes: which entity types can use this
 * - steps: array of step definitions
 */
export const QUERY_RECIPES = {
  // ============================================
  // CORE DOMAIN - Lineage & Process
  // ============================================
  
  lineage_downstream: {
    id: 'lineage_downstream',
    intent: QUERY_INTENTS.LINEAGE,
    label: 'Trace Downstream Lineage',
    description: 'Step-by-step guide to discover process tables, sample rows, and build a lineage query.',
    icon: 'GitBranch',
    domains: ['Core'],
    supportedEntityTypes: ['TABLE', 'VIEW', 'COLUMN', 'PROCESS', 'UNKNOWN'],
    defaultInputs: {
      direction: 'DOWNSTREAM',
    },
    
    steps: [
      {
        id: 'discover_process_tables',
        kind: STEP_KINDS.DISCOVER,
        queryId: 'core_show_process_tables',
        title: 'Step 1: Discover Lineage Tables',
        description: 'Find lineage/process tables (PROCESS_*) in this schema.',
        inputBindings: {
          database: 'database',
          schema: 'schema',
        },
        outputBindings: {
          discoveredTables: {
            fromColumn: 'name',
            mode: 'collectArray',
          },
          processTable: {
            fromColumn: 'name',
            mode: 'findFirst',
            match: 'PROCESS_ENTITY',
          },
          hasProcessTable: {
            mode: 'hasRows',
          },
        },
        optional: false,
      },
      
      {
        id: 'examine_structure',
        kind: STEP_KINDS.INSPECT,
        queryId: 'core_describe_process_table',
        title: 'Step 2: Examine Table Structure',
        description: 'See what columns are available in the process table.',
        inputBindings: {
          database: 'database',
          schema: 'schema',
          processTable: 'processTable',
        },
        outputBindings: {
          processColumns: {
            fromColumn: 'column_name',
            mode: 'collectArray',
          },
          hasInputsColumn: {
            fromColumn: 'column_name',
            mode: 'hasValue',
            match: 'INPUTS',
          },
          hasOutputsColumn: {
            fromColumn: 'column_name',
            mode: 'hasValue',
            match: 'OUTPUTS',
          },
        },
        shouldSkip: (inputs) => !inputs.processTable,
        skipMessage: 'No process table found. Check your schema configuration.',
        optional: false,
      },
      
      {
        id: 'sample_data',
        kind: STEP_KINDS.SAMPLE,
        queryId: 'core_sample_process_rows',
        title: 'Step 3: Find Assets to Trace',
        description: 'Sample lineage data and find an asset GUID to trace.',
        inputBindings: {
          database: 'database',
          schema: 'schema',
          processTable: 'processTable',
          entityGuid: 'entityGuid',
        },
        outputBindings: {
          sampleGuids: {
            fromColumnCandidates: ['guid', 'process_guid', 'GUID'],
            mode: 'uniqueArray',
            limit: 20,
          },
          sampleRows: {
            mode: 'rowsSlice',
            limit: 10,
          },
          hasLineageData: {
            mode: 'hasRows',
          },
        },
        optional: true,
      },
      
      {
        id: 'build_lineage_query',
        kind: STEP_KINDS.BUILD_FINAL,
        queryId: 'core_full_lineage_query',
        title: 'Step 4: Trace Lineage',
        description: 'Build the full lineage query to trace dependencies.',
        inputBindings: {
          database: 'database',
          schema: 'schema',
          processTable: 'processTable',
          guid: 'selectedGuid',
          direction: 'direction',
          entityGuid: 'entityGuid',
          entityName: 'entityName',
        },
        outputBindings: {},
        optional: false,
      },
    ],
  },
  
  lineage_upstream: {
    id: 'lineage_upstream',
    intent: QUERY_INTENTS.LINEAGE,
    label: 'Trace Upstream Lineage',
    description: 'Find all upstream sources that feed into an asset.',
    icon: 'ArrowUpRight',
    domains: ['Core'],
    supportedEntityTypes: ['TABLE', 'VIEW', 'COLUMN', 'PROCESS', 'UNKNOWN'],
    defaultInputs: {
      direction: 'UPSTREAM',
    },
    // Reuse the same steps as downstream, just with different default direction
    steps: [
      {
        id: 'discover_process_tables',
        kind: STEP_KINDS.DISCOVER,
        queryId: 'core_show_process_tables',
        title: 'Step 1: Discover Lineage Tables',
        description: 'Find lineage/process tables (PROCESS_*) in this schema.',
        inputBindings: { database: 'database', schema: 'schema' },
        outputBindings: {
          discoveredTables: { fromColumn: 'name', mode: 'collectArray' },
          processTable: { fromColumn: 'name', mode: 'findFirst', match: 'PROCESS_ENTITY' },
          hasProcessTable: { mode: 'hasRows' },
        },
      },
      {
        id: 'sample_data',
        kind: STEP_KINDS.SAMPLE,
        queryId: 'core_sample_process_rows',
        title: 'Step 2: Find Assets to Trace',
        description: 'Sample lineage data and find an asset GUID.',
        inputBindings: { database: 'database', schema: 'schema', processTable: 'processTable' },
        outputBindings: {
          sampleGuids: { fromColumnCandidates: ['guid', 'process_guid'], mode: 'uniqueArray', limit: 20 },
          hasLineageData: { mode: 'hasRows' },
        },
        optional: true,
      },
      {
        id: 'build_lineage_query',
        kind: STEP_KINDS.BUILD_FINAL,
        queryId: 'core_full_lineage_query',
        title: 'Step 3: Trace Upstream',
        description: 'Build the upstream lineage query.',
        inputBindings: { database: 'database', schema: 'schema', processTable: 'processTable', guid: 'selectedGuid', direction: 'direction' },
        outputBindings: {},
      },
    ],
  },

  // ============================================
  // CORE DOMAIN - Schema Discovery
  // ============================================
  
  schema_discovery: {
    id: 'schema_discovery',
    intent: QUERY_INTENTS.DISCOVERY,
    label: 'Schema Discovery Wizard',
    description: 'Explore available tables, columns, and data types in your schema.',
    icon: 'Database',
    domains: ['Core', 'Relational DB'],
    supportedEntityTypes: ['DATABASE', 'SCHEMA', 'UNKNOWN'],
    
    steps: [
      {
        id: 'list_tables',
        kind: STEP_KINDS.DISCOVER,
        queryId: 'core_show_all_tables',
        title: 'Step 1: List All Tables',
        description: 'Find all tables in the current schema.',
        inputBindings: { database: 'database', schema: 'schema' },
        outputBindings: {
          availableTables: { fromColumn: 'name', mode: 'collectArray' },
          tableCount: { mode: 'rowCount' },
        },
      },
      {
        id: 'pick_table',
        kind: STEP_KINDS.INSPECT,
        queryId: 'core_describe_table',
        title: 'Step 2: Examine Table',
        description: 'View columns and data types for a selected table.',
        inputBindings: { database: 'database', schema: 'schema', table: 'selectedTable' },
        outputBindings: {
          columns: { fromColumn: 'column_name', mode: 'collectArray' },
          columnTypes: { fromColumns: ['column_name', 'data_type'], mode: 'objectArray' },
        },
      },
      {
        id: 'sample_table',
        kind: STEP_KINDS.SAMPLE,
        queryId: 'core_sample_table_rows',
        title: 'Step 3: Preview Data',
        description: 'Sample rows from the selected table.',
        inputBindings: { database: 'database', schema: 'schema', table: 'selectedTable' },
        outputBindings: {
          sampleRows: { mode: 'rowsSlice', limit: 20 },
        },
      },
    ],
  },

  // ============================================
  // GLOSSARY DOMAIN
  // ============================================
  
  glossary_search: {
    id: 'glossary_search',
    intent: QUERY_INTENTS.GLOSSARY,
    label: 'Glossary Term Explorer',
    description: 'Search for glossary terms and find linked assets.',
    icon: 'BookOpen',
    domains: ['Glossary'],
    supportedEntityTypes: ['GLOSSARY_TERM', 'UNKNOWN'],
    
    steps: [
      {
        id: 'find_glossary_tables',
        kind: STEP_KINDS.DISCOVER,
        queryId: 'glossary_show_tables',
        title: 'Step 1: Find Glossary Tables',
        description: 'Discover glossary-related tables in your schema.',
        inputBindings: { database: 'database', schema: 'schema' },
        outputBindings: {
          glossaryTables: { fromColumn: 'name', mode: 'collectArray' },
          hasGlossary: { mode: 'hasRows' },
        },
      },
      {
        id: 'list_glossaries',
        kind: STEP_KINDS.INSPECT,
        queryId: 'glossary_list_all',
        title: 'Step 2: List Glossaries',
        description: 'View all available glossaries.',
        inputBindings: { database: 'database', schema: 'schema' },
        outputBindings: {
          glossaries: { fromColumnCandidates: ['name', 'displayname'], mode: 'uniqueArray' },
          glossaryGuids: { fromColumn: 'guid', mode: 'collectArray' },
        },
      },
      {
        id: 'search_terms',
        kind: STEP_KINDS.SEARCH,
        queryId: 'glossary_search_terms',
        title: 'Step 3: Search Terms',
        description: 'Find terms matching your search criteria.',
        inputBindings: { database: 'database', schema: 'schema', searchTerm: 'searchTerm' },
        outputBindings: {
          matchingTerms: { mode: 'rowsSlice', limit: 50 },
          termGuids: { fromColumn: 'guid', mode: 'collectArray' },
        },
      },
    ],
  },

  // ============================================
  // DATA QUALITY DOMAIN
  // ============================================
  
  column_profile: {
    id: 'column_profile',
    intent: QUERY_INTENTS.PROFILE,
    label: 'Column Profile Wizard',
    description: 'Analyze column statistics, null rates, and value distributions.',
    icon: 'BarChart2',
    domains: ['Core', 'Data Mesh', 'Governance'],
    supportedEntityTypes: ['COLUMN'],
    
    steps: [
      {
        id: 'basic_stats',
        kind: STEP_KINDS.INSPECT,
        queryId: 'profile_column_stats',
        title: 'Step 1: Basic Statistics',
        description: 'Get count, null rate, distinct values, min/max.',
        inputBindings: { database: 'database', schema: 'schema', table: 'table', column: 'column' },
        outputBindings: {
          totalCount: { fromColumn: 'total_count', mode: 'firstValue' },
          nullCount: { fromColumn: 'null_count', mode: 'firstValue' },
          distinctCount: { fromColumn: 'distinct_count', mode: 'firstValue' },
        },
      },
      {
        id: 'top_values',
        kind: STEP_KINDS.SAMPLE,
        queryId: 'profile_top_values',
        title: 'Step 2: Top Values',
        description: 'See the most common values in this column.',
        inputBindings: { database: 'database', schema: 'schema', table: 'table', column: 'column' },
        outputBindings: {
          topValues: { mode: 'rowsSlice', limit: 20 },
        },
      },
      {
        id: 'sample_values',
        kind: STEP_KINDS.SAMPLE,
        queryId: 'profile_sample_values',
        title: 'Step 3: Sample Values',
        description: 'Preview actual values from the column.',
        inputBindings: { database: 'database', schema: 'schema', table: 'table', column: 'column' },
        outputBindings: {
          sampleValues: { mode: 'rowsSlice', limit: 50 },
        },
      },
    ],
  },

  // ============================================
  // USAGE & POPULARITY
  // ============================================
  
  usage_analysis: {
    id: 'usage_analysis',
    intent: QUERY_INTENTS.USAGE,
    label: 'Usage Analysis Wizard',
    description: 'Analyze query patterns and popularity of assets.',
    icon: 'Activity',
    domains: ['Core', 'Query Org'],
    supportedEntityTypes: ['TABLE', 'VIEW', 'UNKNOWN'],
    
    steps: [
      {
        id: 'find_usage_tables',
        kind: STEP_KINDS.DISCOVER,
        queryId: 'usage_find_tables',
        title: 'Step 1: Find Usage Data',
        description: 'Locate query history and usage tables.',
        inputBindings: { database: 'database', schema: 'schema' },
        outputBindings: {
          usageTables: { fromColumn: 'name', mode: 'collectArray' },
          hasUsageData: { mode: 'hasRows' },
        },
      },
      {
        id: 'recent_queries',
        kind: STEP_KINDS.SAMPLE,
        queryId: 'usage_recent_queries',
        title: 'Step 2: Recent Queries',
        description: 'View recent queries that accessed this asset.',
        inputBindings: { database: 'database', schema: 'schema', assetName: 'entityName' },
        outputBindings: {
          recentQueries: { mode: 'rowsSlice', limit: 20 },
          queryCount: { mode: 'rowCount' },
        },
      },
      {
        id: 'popularity_stats',
        kind: STEP_KINDS.BUILD_FINAL,
        queryId: 'usage_popularity',
        title: 'Step 3: Popularity Analysis',
        description: 'Analyze usage patterns and popularity metrics.',
        inputBindings: { database: 'database', schema: 'schema', assetName: 'entityName' },
        outputBindings: {},
      },
    ],
  },

  // ============================================
  // DBT DOMAIN
  // ============================================
  
  dbt_model_lineage: {
    id: 'dbt_model_lineage',
    intent: QUERY_INTENTS.LINEAGE,
    label: 'dbt Model Lineage',
    description: 'Trace lineage through dbt models and sources.',
    icon: 'Layers',
    domains: ['dbt'],
    supportedEntityTypes: ['TABLE', 'VIEW', 'UNKNOWN'],
    
    steps: [
      {
        id: 'find_dbt_tables',
        kind: STEP_KINDS.DISCOVER,
        queryId: 'dbt_show_tables',
        title: 'Step 1: Find dbt Tables',
        description: 'Discover dbt model and source tables.',
        inputBindings: { database: 'database', schema: 'schema' },
        outputBindings: {
          dbtTables: { fromColumn: 'name', mode: 'collectArray' },
          hasDbtData: { mode: 'hasRows' },
        },
      },
      {
        id: 'list_models',
        kind: STEP_KINDS.INSPECT,
        queryId: 'dbt_list_models',
        title: 'Step 2: List Models',
        description: 'View all dbt models in the schema.',
        inputBindings: { database: 'database', schema: 'schema' },
        outputBindings: {
          models: { mode: 'rowsSlice', limit: 100 },
          modelGuids: { fromColumn: 'guid', mode: 'collectArray' },
        },
      },
      {
        id: 'model_lineage',
        kind: STEP_KINDS.BUILD_FINAL,
        queryId: 'dbt_model_dependencies',
        title: 'Step 3: Model Dependencies',
        description: 'Trace dependencies between dbt models.',
        inputBindings: { database: 'database', schema: 'schema', modelGuid: 'selectedModelGuid' },
        outputBindings: {},
      },
    ],
  },

  // ============================================
  // BI TOOLS DOMAIN
  // ============================================
  
  bi_dashboard_lineage: {
    id: 'bi_dashboard_lineage',
    intent: QUERY_INTENTS.LINEAGE,
    label: 'Dashboard Lineage',
    description: 'Trace data sources for BI dashboards and reports.',
    icon: 'LayoutDashboard',
    domains: ['BI Tools'],
    supportedEntityTypes: ['DASHBOARD', 'UNKNOWN'],
    
    steps: [
      {
        id: 'find_bi_tables',
        kind: STEP_KINDS.DISCOVER,
        queryId: 'bi_show_tables',
        title: 'Step 1: Find BI Entity Tables',
        description: 'Discover dashboard and report entity tables.',
        inputBindings: { database: 'database', schema: 'schema' },
        outputBindings: {
          biTables: { fromColumn: 'name', mode: 'collectArray' },
          hasBiData: { mode: 'hasRows' },
        },
      },
      {
        id: 'list_dashboards',
        kind: STEP_KINDS.INSPECT,
        queryId: 'bi_list_dashboards',
        title: 'Step 2: List Dashboards',
        description: 'View all dashboards in the catalog.',
        inputBindings: { database: 'database', schema: 'schema' },
        outputBindings: {
          dashboards: { mode: 'rowsSlice', limit: 50 },
          dashboardGuids: { fromColumn: 'guid', mode: 'collectArray' },
        },
      },
      {
        id: 'dashboard_sources',
        kind: STEP_KINDS.BUILD_FINAL,
        queryId: 'bi_dashboard_sources',
        title: 'Step 3: Find Data Sources',
        description: 'Trace which tables feed into this dashboard.',
        inputBindings: { database: 'database', schema: 'schema', dashboardGuid: 'selectedDashboardGuid' },
        outputBindings: {},
      },
    ],
  },
};

/**
 * Get recipes for a specific domain
 */
export function getRecipesForDomain(domain) {
  return Object.values(QUERY_RECIPES).filter(r => 
    r.domains?.includes(domain)
  );
}

/**
 * Get recipes for a specific entity type
 */
export function getRecipesForEntityType(entityType) {
  return Object.values(QUERY_RECIPES).filter(r =>
    !r.supportedEntityTypes ||
    r.supportedEntityTypes.includes(entityType) ||
    r.supportedEntityTypes.includes('UNKNOWN')
  );
}

/**
 * Get a recipe by ID
 */
export function getRecipe(recipeId) {
  return QUERY_RECIPES[recipeId] || null;
}

export default QUERY_RECIPES;


```

## src/queryFlows/registry.js

```javascript
/**
 * Query Flow Registry
 * 
 * Central registry of all query flow recipes.
 * Each recipe defines how to build SQL for a specific query type + entity type combination.
 */

import { buildLineageQuery, buildLineageExplorationQuery } from './sql/lineage';
import { buildUsageQuery, buildPopularityQuery } from './sql/usage';
import { buildSampleRowsQuery, buildTableStatsQuery } from './sql/sampleRows';
import { buildSchemaBrowseQuery, buildTableSearchQuery, buildColumnDetailsQuery } from './sql/schemaBrowse';
import { buildGlossaryQuery, buildTermLinkedAssetsQuery, buildListGlossariesQuery } from './sql/glossary';
import { buildFindByGuidQuery, buildGuidDetailsQuery } from './sql/findByGuid';

/**
 * @type {Record<import('./types').QueryFlowType, import('./types').QueryFlowRecipe>}
 */
export const QUERY_FLOW_RECIPES = {
  LINEAGE: {
    id: 'LINEAGE',
    label: 'Lineage',
    description: 'Trace upstream or downstream data dependencies.',
    icon: 'GitBranch',
    supportedEntityTypes: ['TABLE', 'VIEW', 'COLUMN', 'DASHBOARD', 'PIPELINE', 'PROCESS'],
    buildDefaults: (entity) => ({
      direction: 'DOWNSTREAM',
      maxHops: 3,
      assetTypes: ['TABLE', 'VIEW', 'DASHBOARD'],
      includeDashboards: true,
      includeColumns: entity.type === 'COLUMN',
      includeProcesses: true,
    }),
    buildQuery: (entity, inputs, availableTables) => 
      buildLineageQuery(entity, inputs, availableTables),
  },

  IMPACT: {
    id: 'IMPACT',
    label: 'Impact Analysis',
    description: 'See which downstream assets are affected if this changes.',
    icon: 'AlertTriangle',
    supportedEntityTypes: ['TABLE', 'VIEW', 'COLUMN'],
    buildDefaults: () => ({
      direction: 'DOWNSTREAM',
      maxHops: 4,
      assetTypes: ['TABLE', 'VIEW', 'DASHBOARD'],
      includeDashboards: true,
    }),
    buildQuery: (entity, inputs, availableTables) =>
      buildLineageQuery(entity, { ...inputs, direction: 'DOWNSTREAM' }, availableTables),
  },

  USAGE: {
    id: 'USAGE',
    label: 'Usage',
    description: 'See who queries this asset and when.',
    icon: 'Activity',
    supportedEntityTypes: ['TABLE', 'VIEW', 'COLUMN', 'DASHBOARD'],
    buildDefaults: () => ({
      daysBack: 30,
      rowLimit: 500,
    }),
    buildQuery: (entity, inputs, availableTables) => 
      buildUsageQuery(entity, inputs, availableTables),
  },

  SAMPLE_ROWS: {
    id: 'SAMPLE_ROWS',
    label: 'Sample Rows',
    description: 'Preview actual data from this table or view.',
    icon: 'Table',
    supportedEntityTypes: ['TABLE', 'VIEW'],
    buildDefaults: () => ({
      rowLimit: 100,
    }),
    buildQuery: (entity, inputs) => 
      buildSampleRowsQuery(entity, inputs),
  },

  SCHEMA_BROWSE: {
    id: 'SCHEMA_BROWSE',
    label: 'Schema Browser',
    description: 'Explore tables, columns, and data types.',
    icon: 'Layers',
    supportedEntityTypes: ['DATABASE', 'SCHEMA', 'TABLE', 'VIEW', 'UNKNOWN'],
    buildDefaults: (entity) => ({
      rowLimit: 1000,
      filters: {
        database: entity.database,
        schema: entity.schema,
      },
    }),
    buildQuery: (entity, inputs, availableTables) => 
      buildSchemaBrowseQuery(entity, inputs, availableTables),
  },

  QUALITY_CHECKS: {
    id: 'QUALITY_CHECKS',
    label: 'Quality Checks',
    description: 'Check data quality metrics and anomalies.',
    icon: 'CheckCircle',
    supportedEntityTypes: ['TABLE', 'VIEW', 'COLUMN'],
    buildDefaults: () => ({
      rowLimit: 100,
    }),
    buildQuery: (entity, inputs) => {
      // Build basic quality check query
      const table = entity.table || entity.name || '<TABLE>';
      const db = entity.database || '<DATABASE>';
      const schema = entity.schema || '<SCHEMA>';
      const fqn = `"${db}"."${schema}"."${table}"`;
      
      return {
        title: `✅ Quality: ${table}`,
        description: `Basic quality checks for ${fqn}.`,
        sql: `
-- Quality checks for ${fqn}

SELECT
    COUNT(*) AS total_rows,
    COUNT(*) - COUNT(DISTINCT *) AS duplicate_rows,
    SUM(CASE WHEN * IS NULL THEN 1 ELSE 0 END) AS null_rows
FROM ${fqn};
`.trim(),
        database: db,
        schema,
        timeoutSeconds: 60,
        flowType: 'QUALITY_CHECKS',
        entity,
      };
    },
  },

  GLOSSARY_LOOKUP: {
    id: 'GLOSSARY_LOOKUP',
    label: 'Glossary',
    description: 'Find glossary terms and linked assets.',
    icon: 'BookOpen',
    supportedEntityTypes: ['GLOSSARY_TERM', 'TABLE', 'COLUMN', 'UNKNOWN'],
    buildDefaults: (entity) => ({
      rowLimit: 200,
      filters: {
        termName: entity.name,
      },
    }),
    buildQuery: (entity, inputs, availableTables) => 
      buildGlossaryQuery(entity, inputs, availableTables),
  },

  FIND_BY_GUID: {
    id: 'FIND_BY_GUID',
    label: 'Find by GUID',
    description: 'Search for an asset by its metadata GUID.',
    icon: 'Search',
    supportedEntityTypes: ['UNKNOWN', 'TABLE', 'VIEW', 'COLUMN', 'PROCESS'],
    buildDefaults: (entity) => ({
      filters: {
        guid: entity.guid,
      },
    }),
    buildQuery: (entity, inputs, availableTables) => 
      buildFindByGuidQuery(entity, inputs, availableTables),
  },

  COLUMN_PROFILE: {
    id: 'COLUMN_PROFILE',
    label: 'Column Profile',
    description: 'Statistical profile of column values.',
    icon: 'BarChart2',
    supportedEntityTypes: ['COLUMN'],
    buildDefaults: () => ({
      rowLimit: 1000,
    }),
    buildQuery: (entity, inputs) => {
      const column = entity.column || entity.name || '<COLUMN>';
      const table = entity.table || '<TABLE>';
      const db = entity.database || '<DATABASE>';
      const schema = entity.schema || '<SCHEMA>';
      const fqn = `"${db}"."${schema}"."${table}"`;
      
      return {
        title: `📊 Profile: ${column}`,
        description: `Statistical profile for ${column} in ${table}.`,
        sql: `
-- Column profile for ${column} in ${fqn}

SELECT
    '${column}' AS column_name,
    COUNT(*) AS total_rows,
    COUNT("${column}") AS non_null_count,
    COUNT(*) - COUNT("${column}") AS null_count,
    ROUND((COUNT(*) - COUNT("${column}")) * 100.0 / NULLIF(COUNT(*), 0), 2) AS null_pct,
    COUNT(DISTINCT "${column}") AS distinct_count,
    MIN("${column}") AS min_value,
    MAX("${column}") AS max_value
FROM ${fqn};
`.trim(),
        database: db,
        schema,
        timeoutSeconds: 60,
        flowType: 'COLUMN_PROFILE',
        entity,
      };
    },
  },

  TOP_VALUES: {
    id: 'TOP_VALUES',
    label: 'Top Values',
    description: 'Most common values in this column.',
    icon: 'List',
    supportedEntityTypes: ['COLUMN'],
    buildDefaults: () => ({
      rowLimit: 20,
    }),
    buildQuery: (entity, inputs) => {
      const { rowLimit = 20 } = inputs;
      const column = entity.column || entity.name || '<COLUMN>';
      const table = entity.table || '<TABLE>';
      const db = entity.database || '<DATABASE>';
      const schema = entity.schema || '<SCHEMA>';
      const fqn = `"${db}"."${schema}"."${table}"`;
      
      return {
        title: `🏆 Top Values: ${column}`,
        description: `Most common values in ${column}.`,
        sql: `
-- Top ${rowLimit} values for ${column} in ${fqn}

SELECT
    "${column}" AS value,
    COUNT(*) AS frequency,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) AS percentage
FROM ${fqn}
GROUP BY "${column}"
ORDER BY frequency DESC
LIMIT ${rowLimit};
`.trim(),
        database: db,
        schema,
        timeoutSeconds: 60,
        flowType: 'TOP_VALUES',
        entity,
      };
    },
  },

  NULL_ANALYSIS: {
    id: 'NULL_ANALYSIS',
    label: 'Null Analysis',
    description: 'Find and analyze null values.',
    icon: 'AlertCircle',
    supportedEntityTypes: ['TABLE', 'VIEW', 'COLUMN'],
    buildDefaults: () => ({
      rowLimit: 100,
    }),
    buildQuery: (entity, inputs, availableTables) => {
      const table = entity.table || entity.name || '<TABLE>';
      const db = entity.database || '<DATABASE>';
      const schema = entity.schema || '<SCHEMA>';
      const fqn = `"${db}"."${schema}"."${table}"`;
      
      // Check if we have column entity for richer info
      const tables = (availableTables || []).map(t => t.toUpperCase());
      const hasColumnEntity = tables.includes('COLUMN_ENTITY');
      
      let sql;
      
      if (hasColumnEntity && entity.type !== 'COLUMN') {
        sql = `
-- Null analysis for ${fqn}
-- Using MDLH column metadata

SELECT
    c.name AS column_name,
    c.datatype AS data_type,
    c.isnullable AS is_nullable
FROM COLUMN_ENTITY c
WHERE c.tablename = '${table}'
  AND c.databasename = '${db}'
  AND c.schemaname = '${schema}'
ORDER BY c."ORDER";
`.trim();
      } else {
        sql = `
-- Null analysis for ${fqn}
-- Counting nulls per column (sample query - adjust columns)

SELECT 
    COUNT(*) AS total_rows,
    -- Add specific columns to check, e.g.:
    -- COUNT(*) - COUNT(column_name) AS column_name_nulls
    'Run DESCRIBE to see columns' AS note
FROM ${fqn};
`.trim();
      }
      
      return {
        title: `🔍 Nulls: ${table}`,
        description: `Null value analysis for ${fqn}.`,
        sql,
        database: db,
        schema,
        timeoutSeconds: 60,
        flowType: 'NULL_ANALYSIS',
        entity,
      };
    },
  },
};

/**
 * Get all flows available for an entity type
 * @param {import('./types').EntityType} entityType 
 * @returns {import('./types').QueryFlowRecipe[]}
 */
export function getFlowsForEntityType(entityType) {
  return Object.values(QUERY_FLOW_RECIPES).filter(
    recipe => recipe.supportedEntityTypes.includes(entityType) || 
              recipe.supportedEntityTypes.includes('UNKNOWN')
  );
}

/**
 * Build a query using a specific flow
 * 
 * @param {import('./types').QueryFlowType} flowType 
 * @param {import('./types').EntityContext} entity 
 * @param {Partial<import('./types').QueryFlowInputs>} [overrides] 
 * @param {string[]} [availableTables] 
 * @param {Object} [systemConfig] - The SystemConfig from the backend (optional)
 * @returns {import('./types').BuiltQuery}
 */
export function buildFlowQuery(flowType, entity, overrides = {}, availableTables = [], systemConfig = null) {
  const recipe = QUERY_FLOW_RECIPES[flowType];
  
  if (!recipe) {
    throw new Error(`Unknown query flow: ${flowType}`);
  }
  
  const defaults = recipe.buildDefaults(entity);
  const inputs = { ...defaults, ...overrides };
  
  // If systemConfig is provided, resolve entity locations from it
  const resolvedEntity = resolveEntityFromConfig(entity, systemConfig);
  
  // Pass systemConfig to the query builder (for recipes that support it)
  return recipe.buildQuery(resolvedEntity, inputs, availableTables, systemConfig);
}

/**
 * Resolve entity locations from SystemConfig.
 * 
 * If systemConfig is provided, use it to get the correct database/schema/table names.
 * This ensures we use the discovered locations instead of hardcoded defaults.
 * 
 * @param {import('./types').EntityContext} entity 
 * @param {Object} [systemConfig] 
 * @returns {import('./types').EntityContext}
 */
function resolveEntityFromConfig(entity, systemConfig) {
  if (!systemConfig?.snowflake?.entities) {
    return entity;
  }
  
  // Use queryDefaults from systemConfig if entity doesn't have db/schema
  const queryDefaults = systemConfig.queryDefaults || {};
  
  return {
    ...entity,
    database: entity.database || queryDefaults.metadataDb || 'FIELD_METADATA',
    schema: entity.schema || queryDefaults.metadataSchema || 'PUBLIC',
  };
}

/**
 * Check if a flow is supported for an entity type
 * @param {import('./types').QueryFlowType} flowType 
 * @param {import('./types').EntityType} entityType 
 * @returns {boolean}
 */
export function isFlowSupported(flowType, entityType) {
  const recipe = QUERY_FLOW_RECIPES[flowType];
  if (!recipe) return false;
  return recipe.supportedEntityTypes.includes(entityType) || 
         recipe.supportedEntityTypes.includes('UNKNOWN');
}

export default {
  QUERY_FLOW_RECIPES,
  getFlowsForEntityType,
  buildFlowQuery,
  isFlowSupported,
};


```

## src/queryFlows/types.js

```javascript
/**
 * Query Flow Types
 * 
 * Core type definitions for the config-driven query flow system.
 * This enables any entity type to use any query type through a unified pattern.
 */

/**
 * @typedef {'TABLE' | 'VIEW' | 'COLUMN' | 'DATABASE' | 'SCHEMA' | 'DASHBOARD' | 'PIPELINE' | 'GLOSSARY_TERM' | 'METRIC' | 'PROCESS' | 'CONNECTION' | 'UNKNOWN'} EntityType
 */

/**
 * @typedef {'LINEAGE' | 'IMPACT' | 'USAGE' | 'SAMPLE_ROWS' | 'SCHEMA_BROWSE' | 'QUALITY_CHECKS' | 'GLOSSARY_LOOKUP' | 'FIND_BY_GUID' | 'COLUMN_PROFILE' | 'TOP_VALUES' | 'NULL_ANALYSIS'} QueryFlowType
 */

/**
 * Context about the entity the user is exploring
 * @typedef {Object} EntityContext
 * @property {EntityType} type - The type of entity
 * @property {string} [guid] - Metadata GUID (Atlas/MDLH)
 * @property {string} [name] - Human-readable name
 * @property {string} [qualifiedName] - Fully qualified asset name
 * @property {string} [database] - Database name
 * @property {string} [schema] - Schema name
 * @property {string} [table] - Table name (for columns)
 * @property {string} [column] - Column name
 * @property {string} [typename] - MDLH typename (e.g., 'Table', 'Column')
 * @property {Record<string, any>} [extra] - Additional context
 */

/**
 * Input parameters for query flows (wizard knobs)
 * @typedef {Object} QueryFlowInputs
 * @property {'UPSTREAM' | 'DOWNSTREAM' | 'BOTH'} [direction] - Lineage direction
 * @property {number} [maxHops] - Max recursion depth for lineage
 * @property {string[]} [assetTypes] - Filter to specific asset types
 * @property {number} [daysBack] - For usage queries, how far back to look
 * @property {number} [rowLimit] - Result row limit
 * @property {boolean} [includeDashboards] - Include BI dashboards in lineage
 * @property {boolean} [includeColumns] - Include column-level lineage
 * @property {boolean} [includeProcesses] - Include process entities
 * @property {string} [searchTerm] - For search/discovery queries
 * @property {Record<string, any>} [filters] - Additional filters
 */

/**
 * The built query ready for execution
 * @typedef {Object} BuiltQuery
 * @property {string} title - Display title for the query
 * @property {string} description - What this query does
 * @property {string} sql - The SQL to execute
 * @property {string} [database] - Recommended database context
 * @property {string} [schema] - Recommended schema context
 * @property {number} [timeoutSeconds] - Query timeout
 * @property {number} [limit] - Row limit
 * @property {QueryFlowType} flowType - Which flow generated this
 * @property {EntityContext} entity - The entity context used
 */

/**
 * Recipe for a query flow type
 * @typedef {Object} QueryFlowRecipe
 * @property {QueryFlowType} id - Unique identifier
 * @property {string} label - Human-readable label
 * @property {string} description - What this flow does
 * @property {string} icon - Lucide icon name
 * @property {EntityType[]} supportedEntityTypes - Which entity types can use this
 * @property {(entity: EntityContext) => QueryFlowInputs} buildDefaults - Generate default inputs
 * @property {(entity: EntityContext, inputs: QueryFlowInputs, availableTables?: string[]) => BuiltQuery} buildQuery - Build the SQL query
 */

// Entity type display names and icons
export const ENTITY_TYPE_CONFIG = {
  TABLE: { label: 'Table', icon: 'Table2', color: 'emerald' },
  VIEW: { label: 'View', icon: 'Eye', color: 'amber' },
  COLUMN: { label: 'Column', icon: 'Columns', color: 'blue' },
  DATABASE: { label: 'Database', icon: 'Database', color: 'purple' },
  SCHEMA: { label: 'Schema', icon: 'Layers', color: 'indigo' },
  DASHBOARD: { label: 'Dashboard', icon: 'BarChart3', color: 'pink' },
  PIPELINE: { label: 'Pipeline', icon: 'GitBranch', color: 'orange' },
  GLOSSARY_TERM: { label: 'Glossary Term', icon: 'BookOpen', color: 'teal' },
  METRIC: { label: 'Metric', icon: 'TrendingUp', color: 'red' },
  PROCESS: { label: 'Process', icon: 'Workflow', color: 'cyan' },
  CONNECTION: { label: 'Connection', icon: 'Plug', color: 'gray' },
  UNKNOWN: { label: 'Asset', icon: 'Box', color: 'gray' },
};

// Query flow type display names and icons
export const QUERY_FLOW_CONFIG = {
  LINEAGE: { label: 'Lineage', icon: 'GitBranch', description: 'Trace data dependencies' },
  IMPACT: { label: 'Impact Analysis', icon: 'AlertTriangle', description: 'See what breaks if this changes' },
  USAGE: { label: 'Usage', icon: 'Activity', description: 'Who queries this and when' },
  SAMPLE_ROWS: { label: 'Sample Rows', icon: 'Table', description: 'Preview actual data' },
  SCHEMA_BROWSE: { label: 'Schema Browser', icon: 'Layers', description: 'Explore tables and columns' },
  QUALITY_CHECKS: { label: 'Quality Checks', icon: 'CheckCircle', description: 'Data quality metrics' },
  GLOSSARY_LOOKUP: { label: 'Glossary', icon: 'BookOpen', description: 'Find related terms' },
  FIND_BY_GUID: { label: 'Find by GUID', icon: 'Search', description: 'Look up asset by GUID' },
  COLUMN_PROFILE: { label: 'Column Profile', icon: 'BarChart2', description: 'Column statistics' },
  TOP_VALUES: { label: 'Top Values', icon: 'List', description: 'Most common values' },
  NULL_ANALYSIS: { label: 'Null Analysis', icon: 'AlertCircle', description: 'Find null/empty values' },
};

/**
 * Map MDLH typenames to our EntityType
 * @param {string} typename - MDLH typename (e.g., 'Table', 'AtlasGlossaryTerm')
 * @returns {EntityType}
 */
export function mapTypenameToEntityType(typename) {
  if (!typename) return 'UNKNOWN';
  
  const normalized = typename.toUpperCase().replace(/[^A-Z]/g, '');
  
  // Tables and views
  if (normalized.includes('TABLE')) return 'TABLE';
  if (normalized.includes('VIEW')) return 'VIEW';
  if (normalized.includes('COLUMN')) return 'COLUMN';
  
  // Infrastructure
  if (normalized.includes('DATABASE')) return 'DATABASE';
  if (normalized.includes('SCHEMA')) return 'SCHEMA';
  if (normalized.includes('CONNECTION')) return 'CONNECTION';
  
  // BI
  if (normalized.includes('DASHBOARD')) return 'DASHBOARD';
  if (normalized.includes('REPORT')) return 'DASHBOARD';
  if (normalized.includes('CHART')) return 'DASHBOARD';
  
  // Pipelines/ETL
  if (normalized.includes('PIPELINE')) return 'PIPELINE';
  if (normalized.includes('DAG')) return 'PIPELINE';
  if (normalized.includes('WORKFLOW')) return 'PIPELINE';
  if (normalized.includes('PROCESS')) return 'PROCESS';
  
  // Glossary
  if (normalized.includes('GLOSSARY') && normalized.includes('TERM')) return 'GLOSSARY_TERM';
  if (normalized.includes('GLOSSARY')) return 'GLOSSARY_TERM';
  
  // Metrics
  if (normalized.includes('METRIC')) return 'METRIC';
  if (normalized.includes('MEASURE')) return 'METRIC';
  
  return 'UNKNOWN';
}

/**
 * Build an EntityContext from MDLH entity data
 * @param {Object} mdlhEntity - Entity from MDLH query results
 * @returns {EntityContext}
 */
export function buildEntityContext(mdlhEntity) {
  const typename = mdlhEntity.typename || mdlhEntity.TYPENAME || '';
  const type = mapTypenameToEntityType(typename);
  
  return {
    type,
    guid: mdlhEntity.guid || mdlhEntity.GUID,
    name: mdlhEntity.name || mdlhEntity.NAME,
    qualifiedName: mdlhEntity.qualifiedname || mdlhEntity.QUALIFIEDNAME || mdlhEntity.qualifiedName,
    database: mdlhEntity.databasename || mdlhEntity.DATABASENAME || mdlhEntity.database,
    schema: mdlhEntity.schemaname || mdlhEntity.SCHEMANAME || mdlhEntity.schema,
    table: mdlhEntity.tablename || mdlhEntity.TABLENAME || mdlhEntity.table,
    column: mdlhEntity.columnname || mdlhEntity.COLUMNNAME || mdlhEntity.column,
    typename,
    extra: {
      connectorName: mdlhEntity.connectorname || mdlhEntity.CONNECTORNAME,
      connectionName: mdlhEntity.connectionname || mdlhEntity.CONNECTIONNAME,
      ownerUsers: mdlhEntity.ownerusers || mdlhEntity.OWNERUSERS,
      certificateStatus: mdlhEntity.certificatestatus || mdlhEntity.CERTIFICATESTATUS,
    }
  };
}

export default {
  ENTITY_TYPE_CONFIG,
  QUERY_FLOW_CONFIG,
  mapTypenameToEntityType,
  buildEntityContext,
};


```



## Query Flows - Step Flows


## src/queryFlows/stepFlows/extractors.js

```javascript
/**
 * Generic Extractors for Step Flow Results
 * 
 * These are reusable functions that extract data from Snowflake query results.
 * Used by the recipe builder to wire outputBindings without writing custom code.
 */

/**
 * Normalize Snowflake results to a consistent format.
 * Handles both array rows and object rows, uppercase and lowercase column names.
 */
export function normalizeResults(results) {
  if (!results || !Array.isArray(results.rows)) {
    return { columns: [], rows: [] };
  }

  // Extract column names, handling both string and object formats
  const colNames = (results.columns || []).map((c) =>
    typeof c === 'string' ? c : (c?.name || c?.NAME || String(c))
  );

  // If rows are arrays, convert to objects
  const rowsAsObjects = results.rows.map((row) => {
    if (Array.isArray(row)) {
      const obj = {};
      row.forEach((val, i) => {
        const k = colNames[i];
        if (k) obj[k] = val;
      });
      return obj;
    }
    return row;
  });

  return {
    ...results,
    columns: colNames,
    rows: rowsAsObjects,
  };
}

/**
 * Get a value from a row, trying multiple case variants
 */
export function getRowValue(row, columnName) {
  if (!row || !columnName) return undefined;
  return row[columnName] ?? 
         row[columnName.toUpperCase()] ?? 
         row[columnName.toLowerCase()] ??
         row[columnName.replace(/_/g, '')] ?? // try without underscores
         undefined;
}

/**
 * Collect all values from a single column into an array
 */
export function collectArrayFromColumn(columnName, limit = 100) {
  return (results) => {
    const normalized = normalizeResults(results);
    const items = [];
    
    for (const row of normalized.rows || []) {
      const val = getRowValue(row, columnName);
      if (val != null && val !== '') {
        items.push(val);
      }
      if (items.length >= limit) break;
    }
    
    return items;
  };
}

/**
 * Find the first row where a column matches a value (case-insensitive)
 */
export function findFirstMatch(columnName, matchValue) {
  return (results) => {
    const normalized = normalizeResults(results);
    
    for (const row of normalized.rows || []) {
      const val = getRowValue(row, columnName);
      if (val && String(val).toUpperCase().includes(matchValue.toUpperCase())) {
        return val;
      }
    }
    
    // Fallback: return first value if no match
    if (normalized.rows?.length > 0) {
      return getRowValue(normalized.rows[0], columnName);
    }
    
    return null;
  };
}

/**
 * Collect unique values from multiple candidate columns
 */
export function collectUniqueFromCandidates(columnNames, limit = 100) {
  return (results) => {
    const normalized = normalizeResults(results);
    const set = new Set();
    
    for (const row of normalized.rows || []) {
      for (const col of columnNames) {
        const val = getRowValue(row, col);
        if (val != null && val !== '') {
          set.add(val);
          if (set.size >= limit) break;
        }
      }
      if (set.size >= limit) break;
    }
    
    return Array.from(set);
  };
}

/**
 * Get the first value from a column
 */
export function firstValue(columnName) {
  return (results) => {
    const normalized = normalizeResults(results);
    if (normalized.rows?.length > 0) {
      return getRowValue(normalized.rows[0], columnName);
    }
    return null;
  };
}

/**
 * Check if any row has a specific value in a column
 */
export function hasValue(columnName, matchValue) {
  return (results) => {
    const normalized = normalizeResults(results);
    
    for (const row of normalized.rows || []) {
      const val = getRowValue(row, columnName);
      if (val && String(val).toUpperCase() === matchValue.toUpperCase()) {
        return true;
      }
    }
    
    return false;
  };
}

/**
 * Check if results have any rows
 */
export function hasRows() {
  return (results) => {
    const normalized = normalizeResults(results);
    return (normalized.rows?.length || 0) > 0;
  };
}

/**
 * Get the row count
 */
export function rowCount() {
  return (results) => {
    const normalized = normalizeResults(results);
    return normalized.rows?.length || 0;
  };
}

/**
 * Slice rows to a limit
 */
export function sliceRows(limit = 20) {
  return (results) => {
    const normalized = normalizeResults(results);
    return (normalized.rows || []).slice(0, limit);
  };
}

/**
 * Create an array of objects from multiple columns
 */
export function objectArrayFromColumns(columnNames) {
  return (results) => {
    const normalized = normalizeResults(results);
    
    return (normalized.rows || []).map(row => {
      const obj = {};
      for (const col of columnNames) {
        obj[col] = getRowValue(row, col);
      }
      return obj;
    });
  };
}

/**
 * Build an extractor function from a binding specification
 */
export function buildExtractor(spec) {
  if (!spec || !spec.mode) return () => null;
  
  switch (spec.mode) {
    case 'collectArray':
      return collectArrayFromColumn(spec.fromColumn, spec.limit);
      
    case 'findFirst':
      return findFirstMatch(spec.fromColumn, spec.match || '');
      
    case 'uniqueArray':
      return collectUniqueFromCandidates(spec.fromColumnCandidates || [spec.fromColumn], spec.limit);
      
    case 'firstValue':
      return firstValue(spec.fromColumn);
      
    case 'hasValue':
      return hasValue(spec.fromColumn, spec.match || '');
      
    case 'hasRows':
      return hasRows();
      
    case 'rowCount':
      return rowCount();
      
    case 'rowsSlice':
      return sliceRows(spec.limit);
      
    case 'objectArray':
      return objectArrayFromColumns(spec.fromColumns || []);
      
    default:
      console.warn(`[Extractors] Unknown mode: ${spec.mode}`);
      return () => null;
  }
}

/**
 * Build a complete extractor function from all output bindings
 */
export function buildExtractorFromBindings(outputBindings) {
  if (!outputBindings || Object.keys(outputBindings).length === 0) {
    return () => ({});
  }

  return (results) => {
    const extracted = {};

    for (const [key, spec] of Object.entries(outputBindings)) {
      if (!spec) continue;
      
      const extractor = buildExtractor(spec);
      extracted[key] = extractor(results);
    }

    return extracted;
  };
}

export default {
  normalizeResults,
  getRowValue,
  collectArrayFromColumn,
  findFirstMatch,
  collectUniqueFromCandidates,
  firstValue,
  hasValue,
  hasRows,
  rowCount,
  sliceRows,
  objectArrayFromColumns,
  buildExtractor,
  buildExtractorFromBindings,
};


```

## src/queryFlows/stepFlows/index.js

```javascript
/**
 * Step Flows Module
 * 
 * Multi-step query wizards that guide users through complex query building.
 * 
 * This module provides a GLOBAL, DATA-DRIVEN wizard system.
 * All wizards are defined as recipes in queryRecipes.js.
 * No domain-specific wizard components needed.
 */

export * from './types';
export { buildExtractorFromBindings, normalizeResults, getRowValue } from './extractors';
export { buildFlowFromRecipe, getSqlTemplate, registerSqlTemplate } from './recipeBuilder';

import { QUERY_RECIPES, getRecipe, getRecipesForDomain, getRecipesForEntityType } from '../queryRecipes';
import { buildFlowFromRecipe } from './recipeBuilder';

// Lazy-built cache so we don't rebuild flows on every render
const FLOW_CACHE = {};

/**
 * Get a MultiStepFlow by ID, built from QUERY_RECIPES.
 * This is the main entry point for the wizard system.
 * 
 * @param {string} flowId - The recipe ID (e.g., 'lineage_downstream')
 * @returns {import('./types').MultiStepFlow | null}
 */
export function getWizardFlow(flowId) {
  // Return from cache if already built
  if (FLOW_CACHE[flowId]) {
    return FLOW_CACHE[flowId];
  }

  // Get recipe from registry
  const recipe = getRecipe(flowId);
  if (!recipe) {
    console.warn(`[StepFlows] Unknown wizard flow: ${flowId}`);
    return null;
  }

  // Build the flow from the recipe
  const flow = buildFlowFromRecipe(recipe);
  
  // Cache it
  if (flow) {
    FLOW_CACHE[flowId] = flow;
  }
  
  return flow;
}

/**
 * Get all available wizard flows for a given entity type.
 * 
 * @param {string} entityType - The entity type (e.g., 'TABLE', 'COLUMN')
 * @returns {Array<{id: string, label: string, description: string, icon: string}>}
 */
export function getAvailableWizardFlowsForEntity(entityType) {
  const recipes = getRecipesForEntityType(entityType);
  
  return recipes.map(recipe => ({
    id: recipe.id,
    label: recipe.label,
    description: recipe.description,
    icon: recipe.icon,
    intent: recipe.intent,
    domains: recipe.domains,
  }));
}

/**
 * Get all available wizard flows for a given domain.
 * 
 * @param {string} domain - The domain (e.g., 'Core', 'Glossary', 'dbt')
 * @returns {Array<{id: string, label: string, description: string, icon: string}>}
 */
export function getAvailableWizardFlowsForDomain(domain) {
  const recipes = getRecipesForDomain(domain);
  
  return recipes.map(recipe => ({
    id: recipe.id,
    label: recipe.label,
    description: recipe.description,
    icon: recipe.icon,
    intent: recipe.intent,
  }));
}

/**
 * Get all available wizard flows.
 * 
 * @returns {Array<{id: string, label: string, description: string, icon: string, domains: string[]}>}
 */
export function getAllWizardFlows() {
  return Object.values(QUERY_RECIPES).map(recipe => ({
    id: recipe.id,
    label: recipe.label,
    description: recipe.description,
    icon: recipe.icon,
    intent: recipe.intent,
    domains: recipe.domains,
    supportedEntityTypes: recipe.supportedEntityTypes,
  }));
}

/**
 * Clear the flow cache (useful for hot reloading during development)
 */
export function clearFlowCache() {
  Object.keys(FLOW_CACHE).forEach(key => delete FLOW_CACHE[key]);
}

// Re-export recipe helpers for convenience
export { getRecipe, getRecipesForDomain, getRecipesForEntityType } from '../queryRecipes';
export { QUERY_RECIPES, QUERY_INTENTS, STEP_KINDS } from '../queryRecipes';

// Legacy export for backwards compatibility (can be removed later)
export { LINEAGE_WIZARD, getCurrentStep, canProceed } from './lineageWizard';

```

## src/queryFlows/stepFlows/lineageWizard.js

```javascript
/**
 * Lineage Discovery Wizard
 * 
 * A multi-step flow that guides users through:
 * 1. Discovering available lineage/process tables
 * 2. Examining the table structure
 * 3. Finding an asset to trace
 * 4. Building and running the final lineage query
 */

/**
 * @type {import('./types').MultiStepFlow}
 */
export const LINEAGE_WIZARD = {
  id: 'LINEAGE_WIZARD',
  label: 'Lineage Discovery Wizard',
  description: 'Step-by-step guide to trace asset lineage',
  icon: 'GitBranch',
  supportedEntityTypes: ['TABLE', 'VIEW', 'COLUMN', 'PROCESS', 'UNKNOWN'],
  
  buildInitialInputs: (entity, availableTables = []) => ({
    entityGuid: entity?.guid,
    entityName: entity?.name,
    entityType: entity?.type,
    database: entity?.database || 'FIELD_METADATA',
    schema: entity?.schema || 'PUBLIC',
    direction: 'DOWNSTREAM',
    availableTables,
  }),
  
  steps: [
    // Step 1: Discover process/lineage tables
    {
      id: 'discover_tables',
      title: 'Step 1: Discover Lineage Tables',
      description: 'First, let\'s find tables that contain lineage data (PROCESS tables store lineage relationships).',
      buildQuery: (entity, inputs) => {
        const db = inputs.database || 'FIELD_METADATA';
        const schema = inputs.schema || 'PUBLIC';
        return `-- Step 1: Find lineage/process tables in your schema
SHOW TABLES LIKE '%PROCESS%' IN ${db}.${schema};

-- Alternative: Show all entity tables
-- SHOW TABLES LIKE '%_ENTITY' IN ${db}.${schema};`;
      },
      extractDataForNext: (results) => {
        // Look for PROCESS_ENTITY or similar
        // SHOW TABLES returns lowercase column names
        const rows = results?.rows || [];
        const getName = (r) => r.name || r.NAME || r['name'] || r['NAME'];
        
        const processTable = rows.find(r => {
          const name = getName(r);
          return name?.toUpperCase()?.includes('PROCESS_ENTITY') ||
                 name?.toUpperCase() === 'PROCESS_ENTITY';
        });
        const processTableName = processTable ? getName(processTable) : rows[0] ? getName(rows[0]) : null;
        
        return {
          processTable: processTableName,
          discoveredTables: rows.map(r => getName(r)).filter(Boolean),
          hasProcessTable: !!processTableName,
        };
      },
      nextStep: 'examine_structure',
    },
    
    // Step 2: Examine table structure
    {
      id: 'examine_structure',
      title: 'Step 2: Examine Table Structure',
      description: 'Now let\'s see what columns are available in the process table to understand the lineage data model.',
      shouldSkip: (inputs) => !inputs.processTable,
      skipMessage: 'No process table found. You may need to check your schema configuration.',
      buildQuery: (entity, inputs) => {
        const table = inputs.processTable || 'PROCESS_ENTITY';
        const db = inputs.database || 'FIELD_METADATA';
        const schema = inputs.schema || 'PUBLIC';
        return `-- Step 2: Examine the structure of ${table}
DESCRIBE TABLE ${db}.${schema}.${table};

-- This shows you the column names and types
-- Look for columns like: INPUTS, OUTPUTS, GUID, NAME, QUALIFIEDNAME`;
      },
      extractDataForNext: (results) => {
        const columns = results?.rows?.map(r => r.column_name || r.COLUMN_NAME) || [];
        const hasInputs = columns.some(c => c?.toUpperCase() === 'INPUTS');
        const hasOutputs = columns.some(c => c?.toUpperCase() === 'OUTPUTS');
        const hasGuid = columns.some(c => c?.toUpperCase() === 'GUID');
        
        return {
          processColumns: columns,
          hasInputsColumn: hasInputs,
          hasOutputsColumn: hasOutputs,
          hasGuidColumn: hasGuid,
          lineageModel: hasInputs && hasOutputs ? 'inputs_outputs' : 'unknown',
        };
      },
      nextStep: 'sample_data',
    },
    
    // Step 3: Sample some data to find GUIDs
    {
      id: 'sample_data',
      title: 'Step 3: Find Assets to Trace',
      description: 'Let\'s look at some actual lineage data and find an asset GUID you can trace.',
      buildQuery: (entity, inputs) => {
        const table = inputs.processTable || 'PROCESS_ENTITY';
        const db = inputs.database || 'FIELD_METADATA';
        const schema = inputs.schema || 'PUBLIC';
        
        // If we have an entity GUID, search for it
        if (entity?.guid) {
          return `-- Step 3: Look for your asset in lineage data
-- Your asset GUID: ${entity.guid}
-- Note: inputs/outputs are ARRAY<OBJECT>, use TO_VARCHAR to convert for search

SELECT 
    guid AS process_guid,
    name AS process_name,
    ARRAY_SIZE(inputs) AS input_count,
    ARRAY_SIZE(outputs) AS output_count
FROM ${db}.${schema}.${table}
WHERE 
    TO_VARCHAR(inputs) ILIKE '%${entity.guid}%'
    OR TO_VARCHAR(outputs) ILIKE '%${entity.guid}%'
LIMIT 10;`;
        }
        
        // Otherwise just sample
        return `-- Step 3: Sample some lineage data to find assets
-- Note: inputs/outputs are ARRAY<OBJECT> types

SELECT 
    guid AS process_guid,
    name AS process_name,
    ARRAY_SIZE(inputs) AS input_count,
    ARRAY_SIZE(outputs) AS output_count
FROM ${db}.${schema}.${table}
WHERE ARRAY_SIZE(inputs) > 0 OR ARRAY_SIZE(outputs) > 0
LIMIT 10;

-- Tip: Click on a row to explore its lineage`;
      },
      extractDataForNext: (results) => {
        const rows = results?.rows || [];
        // Extract GUIDs from inputs/outputs (they're often JSON arrays)
        const allGuids = new Set();
        
        rows.forEach(row => {
          // Try to parse inputs/outputs as JSON
          try {
            const inputs = JSON.parse(row.inputs || row.INPUTS || '[]');
            const outputs = JSON.parse(row.outputs || row.OUTPUTS || '[]');
            inputs.forEach(i => {
              if (i.guid) allGuids.add(i.guid);
              if (i.uniqueAttributes?.qualifiedName) allGuids.add(i.uniqueAttributes.qualifiedName);
            });
            outputs.forEach(o => {
              if (o.guid) allGuids.add(o.guid);
              if (o.uniqueAttributes?.qualifiedName) allGuids.add(o.uniqueAttributes.qualifiedName);
            });
          } catch (e) {
            // Not JSON, might be string format
          }
          
          // Also capture the process GUID itself
          if (row.guid || row.GUID || row.process_guid) {
            allGuids.add(row.guid || row.GUID || row.process_guid);
          }
        });
        
        return {
          sampleGuids: Array.from(allGuids).slice(0, 10),
          sampleRows: rows.slice(0, 5),
          hasLineageData: rows.length > 0,
        };
      },
      nextStep: 'build_lineage_query',
    },
    
    // Step 4: Build the final lineage query
    {
      id: 'build_lineage_query',
      title: 'Step 4: Trace Lineage',
      description: 'Now let\'s build the full lineage query! This recursive CTE will trace dependencies.',
      buildQuery: (entity, inputs) => {
        const table = inputs.processTable || 'PROCESS_ENTITY';
        const db = inputs.database || 'FIELD_METADATA';
        const schema = inputs.schema || 'PUBLIC';
        const direction = inputs.direction || 'DOWNSTREAM';
        const guid = entity?.guid || inputs.sampleGuids?.[0] || '<YOUR_ASSET_GUID>';
        
        const directionColumn = direction === 'UPSTREAM' ? 'inputs' : 'outputs';
        const oppositeColumn = direction === 'UPSTREAM' ? 'outputs' : 'inputs';
        const directionLabel = direction === 'UPSTREAM' ? 'upstream' : 'downstream';
        
        return `-- Step 4: Full Lineage Query - ${direction} dependencies
-- Starting from: ${entity?.name || guid}
-- Direction: ${directionLabel}
-- Note: inputs/outputs are ARRAY<OBJECT>, using TO_VARCHAR for search

-- Find processes where your asset appears
SELECT 
    p.guid AS process_guid,
    p.name AS process_name,
    ARRAY_SIZE(p.inputs) AS input_count,
    ARRAY_SIZE(p.outputs) AS output_count
FROM ${db}.${schema}.${table} p
WHERE TO_VARCHAR(p.${oppositeColumn}) ILIKE '%${guid}%'
LIMIT 20;

-- To see the actual linked assets, use LATERAL FLATTEN:
-- SELECT 
--     p.guid AS process_guid,
--     p.name AS process_name,
--     f.value:guid::VARCHAR AS linked_asset_guid,
--     f.value:typeName::VARCHAR AS linked_asset_type
-- FROM ${db}.${schema}.${table} p,
-- LATERAL FLATTEN(input => p.${directionColumn}) f
-- WHERE TO_VARCHAR(p.${oppositeColumn}) ILIKE '%${guid}%'
-- LIMIT 50;`;
      },
      extractDataForNext: null, // Final step
      nextStep: null,
    },
  ],
};

/**
 * Get the current step from wizard state
 * @param {import('./types').WizardState} state 
 * @returns {import('./types').FlowStep | null}
 */
export function getCurrentStep(state) {
  return LINEAGE_WIZARD.steps[state.currentStepIndex] || null;
}

/**
 * Check if wizard can proceed to next step
 * @param {import('./types').WizardState} state 
 * @returns {boolean}
 */
export function canProceed(state) {
  const currentStep = getCurrentStep(state);
  if (!currentStep) return false;
  
  const lastResult = state.stepResults[state.stepResults.length - 1];
  return lastResult?.success && currentStep.nextStep !== null;
}

export default LINEAGE_WIZARD;


```

## src/queryFlows/stepFlows/recipeBuilder.js

```javascript
/**
 * Recipe Builder - Converts data-driven recipes into executable MultiStepFlows
 * 
 * This is the bridge between the declarative QUERY_RECIPES and the 
 * executable MultiStepFlow format that StepWizard consumes.
 * 
 * CONFIG-DRIVEN: All entity locations are resolved from SystemConfig when available.
 */

import { buildExtractorFromBindings } from './extractors';

/**
 * Resolve entity location from SystemConfig.
 * 
 * @param {string} entityName - Logical entity name (e.g., 'PROCESS_ENTITY')
 * @param {Object} systemConfig - SystemConfig from backend
 * @returns {{ database: string, schema: string, table: string } | null}
 */
function getEntityFromConfig(entityName, systemConfig) {
  if (!systemConfig?.snowflake?.entities) return null;
  return systemConfig.snowflake.entities[entityName] || null;
}

/**
 * Get the fully qualified table name from SystemConfig or defaults.
 * 
 * @param {string} entityName - Logical entity name
 * @param {Object} systemConfig - SystemConfig from backend
 * @param {string} defaultDb - Default database
 * @param {string} defaultSchema - Default schema
 * @returns {string} Fully qualified table name
 */
function getEntityFQN(entityName, systemConfig, defaultDb = 'FIELD_METADATA', defaultSchema = 'PUBLIC') {
  const entity = getEntityFromConfig(entityName, systemConfig);
  
  if (entity) {
    return `"${entity.database}"."${entity.schema}"."${entity.table}"`;
  }
  
  // Fallback to defaults
  return `"${defaultDb}"."${defaultSchema}"."${entityName}"`;
}

/**
 * Get metadata db/schema from SystemConfig or defaults.
 */
function getMetadataContext(systemConfig, fallbackDb = 'FIELD_METADATA', fallbackSchema = 'PUBLIC') {
  const defaults = systemConfig?.queryDefaults || {};
  return {
    db: defaults.metadataDb || fallbackDb,
    schema: defaults.metadataSchema || fallbackSchema,
  };
}

/**
 * SQL Query Templates - These are the actual SQL generators.
 * Each template is a function that takes params and returns SQL.
 * 
 * Add new templates here as you add queries to recipes.
 */
const SQL_TEMPLATES = {
  // ============================================
  // CORE - Process/Lineage Tables
  // ============================================
  
  core_show_process_tables: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    return `-- Find lineage/process tables in your schema
SHOW TABLES LIKE '%PROCESS%' IN ${db}.${schema};

-- Alternative: Show all entity tables
-- SHOW TABLES LIKE '%_ENTITY' IN ${db}.${schema};`;
  },

  core_describe_process_table: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    const table = params.processTable || 'PROCESS_ENTITY';
    return `-- Examine the structure of ${table}
DESCRIBE TABLE ${db}.${schema}.${table};

-- Look for columns like: INPUTS, OUTPUTS, GUID, NAME, QUALIFIEDNAME`;
  },

  core_sample_process_rows: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    const table = params.processTable || 'PROCESS_ENTITY';
    const guid = params.entityGuid;
    
    if (guid) {
      return `-- Look for your asset in lineage data
-- Your asset GUID: ${guid}
-- Note: inputs/outputs are ARRAY<OBJECT>, using TO_VARCHAR for search

SELECT 
    guid AS process_guid,
    name AS process_name,
    ARRAY_SIZE(inputs) AS input_count,
    ARRAY_SIZE(outputs) AS output_count
FROM ${db}.${schema}.${table}
WHERE 
    TO_VARCHAR(inputs) ILIKE '%${guid}%'
    OR TO_VARCHAR(outputs) ILIKE '%${guid}%'
LIMIT 10;`;
    }
    
    return `-- Sample lineage data to find assets
-- Note: inputs/outputs are ARRAY<OBJECT> types

SELECT 
    guid AS process_guid,
    name AS process_name,
    ARRAY_SIZE(inputs) AS input_count,
    ARRAY_SIZE(outputs) AS output_count
FROM ${db}.${schema}.${table}
WHERE ARRAY_SIZE(inputs) > 0 OR ARRAY_SIZE(outputs) > 0
LIMIT 10;`;
  },

  core_full_lineage_query: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    const table = params.processTable || 'PROCESS_ENTITY';
    const direction = params.direction || 'DOWNSTREAM';
    const guid = params.guid || params.entityGuid || '<YOUR_ASSET_GUID>';
    const entityName = params.entityName || guid;
    
    const oppositeColumn = direction === 'UPSTREAM' ? 'outputs' : 'inputs';
    const directionLabel = direction === 'UPSTREAM' ? 'upstream' : 'downstream';
    
    return `-- Full Lineage Query - ${direction} dependencies
-- Starting from: ${entityName}
-- Direction: ${directionLabel}
-- Note: inputs/outputs are ARRAY<OBJECT>, using TO_VARCHAR for search

SELECT 
    p.guid AS process_guid,
    p.name AS process_name,
    ARRAY_SIZE(p.inputs) AS input_count,
    ARRAY_SIZE(p.outputs) AS output_count
FROM ${db}.${schema}.${table} p
WHERE TO_VARCHAR(p.${oppositeColumn}) ILIKE '%${guid}%'
LIMIT 20;

-- To see the actual linked assets, use LATERAL FLATTEN:
-- SELECT 
--     p.guid AS process_guid,
--     p.name AS process_name,
--     f.value:guid::VARCHAR AS linked_asset_guid,
--     f.value:typeName::VARCHAR AS linked_asset_type
-- FROM ${db}.${schema}.${table} p,
-- LATERAL FLATTEN(input => p.${direction === 'UPSTREAM' ? 'inputs' : 'outputs'}) f
-- WHERE TO_VARCHAR(p.${oppositeColumn}) ILIKE '%${guid}%'
-- LIMIT 50;`;
  },

  // ============================================
  // CORE - Schema Discovery
  // ============================================
  
  core_show_all_tables: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    return `-- List all tables in the schema
SHOW TABLES IN ${db}.${schema};`;
  },

  core_describe_table: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    const table = params.table || params.selectedTable || 'TABLE_ENTITY';
    return `-- Describe table structure
DESCRIBE TABLE ${db}.${schema}.${table};`;
  },

  core_sample_table_rows: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    const table = params.table || params.selectedTable || 'TABLE_ENTITY';
    return `-- Sample rows from table
SELECT * FROM ${db}.${schema}.${table} LIMIT 20;`;
  },

  // ============================================
  // GLOSSARY
  // ============================================
  
  glossary_show_tables: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    return `-- Find glossary-related tables
SHOW TABLES LIKE '%GLOSSARY%' IN ${db}.${schema};`;
  },

  glossary_list_all: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    return `-- List all glossaries
SELECT guid, name, displayname, qualifiedname
FROM ${db}.${schema}.ATLASGLOSSARY_ENTITY
ORDER BY name
LIMIT 100;`;
  },

  glossary_search_terms: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    const searchTerm = params.searchTerm || '%';
    return `-- Search for glossary terms
SELECT guid, name, displayname, qualifiedname, description
FROM ${db}.${schema}.ATLASGLOSSARYTERM_ENTITY
WHERE name ILIKE '%${searchTerm}%' 
   OR displayname ILIKE '%${searchTerm}%'
ORDER BY name
LIMIT 50;`;
  },

  // ============================================
  // COLUMN PROFILING
  // ============================================
  
  profile_column_stats: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    const table = params.table;
    const column = params.column;
    return `-- Column statistics
SELECT 
    COUNT(*) AS total_count,
    COUNT(${column}) AS non_null_count,
    COUNT(*) - COUNT(${column}) AS null_count,
    ROUND(100.0 * (COUNT(*) - COUNT(${column})) / NULLIF(COUNT(*), 0), 2) AS null_percent,
    COUNT(DISTINCT ${column}) AS distinct_count
FROM ${db}.${schema}.${table};`;
  },

  profile_top_values: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    const table = params.table;
    const column = params.column;
    return `-- Top values by frequency
SELECT 
    ${column} AS value,
    COUNT(*) AS count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) AS percent
FROM ${db}.${schema}.${table}
WHERE ${column} IS NOT NULL
GROUP BY ${column}
ORDER BY count DESC
LIMIT 20;`;
  },

  profile_sample_values: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    const table = params.table;
    const column = params.column;
    return `-- Sample values
SELECT DISTINCT ${column} AS value
FROM ${db}.${schema}.${table}
WHERE ${column} IS NOT NULL
LIMIT 50;`;
  },

  // ============================================
  // USAGE
  // ============================================
  
  usage_find_tables: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    return `-- Find usage/query history tables
SHOW TABLES LIKE '%QUERY%' IN ${db}.${schema};`;
  },

  usage_recent_queries: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    const assetName = params.assetName || '';
    return `-- Recent queries referencing this asset
-- Note: This requires QUERY_HISTORY_ENTITY or Snowflake ACCOUNT_USAGE access
SELECT 
    guid,
    name,
    createtime,
    username
FROM ${db}.${schema}.QUERY_ENTITY
WHERE qualifiedname ILIKE '%${assetName}%'
ORDER BY createtime DESC
LIMIT 20;`;
  },

  usage_popularity: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    const assetName = params.assetName || '';
    return `-- Asset popularity analysis
-- Requires usage data in your schema
SELECT 
    name,
    COUNT(*) AS query_count,
    COUNT(DISTINCT username) AS unique_users
FROM ${db}.${schema}.QUERY_ENTITY
WHERE qualifiedname ILIKE '%${assetName}%'
GROUP BY name
ORDER BY query_count DESC
LIMIT 20;`;
  },

  // ============================================
  // DBT
  // ============================================
  
  dbt_show_tables: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    return `-- Find dbt-related tables
SHOW TABLES LIKE '%DBT%' IN ${db}.${schema};`;
  },

  dbt_list_models: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    return `-- List dbt models
SELECT guid, name, displayname, qualifiedname
FROM ${db}.${schema}.DBTMODEL_ENTITY
ORDER BY name
LIMIT 100;`;
  },

  dbt_model_dependencies: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    const modelGuid = params.modelGuid || params.selectedModelGuid || '<MODEL_GUID>';
    return `-- Find dbt model dependencies
SELECT 
    p.guid AS process_guid,
    p.name AS process_name,
    p.inputs,
    p.outputs
FROM ${db}.${schema}.PROCESS_ENTITY p
WHERE TO_VARCHAR(p.inputs) ILIKE '%${modelGuid}%'
   OR TO_VARCHAR(p.outputs) ILIKE '%${modelGuid}%'
LIMIT 20;`;
  },

  // ============================================
  // BI TOOLS
  // ============================================
  
  bi_show_tables: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    return `-- Find BI-related entity tables
SHOW TABLES LIKE '%DASHBOARD%' IN ${db}.${schema};`;
  },

  bi_list_dashboards: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    return `-- List dashboards (adjust table name for your BI tool)
SELECT guid, name, displayname, qualifiedname
FROM ${db}.${schema}.POWERBIDASHBOARD_ENTITY
ORDER BY name
LIMIT 50;`;
  },

  bi_dashboard_sources: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    const dashboardGuid = params.dashboardGuid || params.selectedDashboardGuid || '<DASHBOARD_GUID>';
    return `-- Find data sources for dashboard
SELECT 
    p.guid AS process_guid,
    p.name AS process_name,
    p.inputs AS data_sources
FROM ${db}.${schema}.BIPROCESS_ENTITY p
WHERE TO_VARCHAR(p.outputs) ILIKE '%${dashboardGuid}%'
LIMIT 20;`;
  },
};

/**
 * Get a SQL template by ID
 */
export function getSqlTemplate(queryId) {
  return SQL_TEMPLATES[queryId] || null;
}

/**
 * Build a FlowStep from a recipe step definition
 * 
 * @param {Object} step - Step definition from recipe
 * @param {number} stepIndex - Index of this step
 * @param {string|null} nextStepId - ID of the next step
 * @param {Object} [systemConfig] - SystemConfig for entity resolution
 */
function buildFlowStep(step, stepIndex, nextStepId, systemConfig = null) {
  const template = getSqlTemplate(step.queryId);
  
  if (!template) {
    console.warn(`[RecipeBuilder] Missing SQL template for queryId: ${step.queryId}`);
  }
  
  return {
    id: step.id,
    title: step.title || `Step ${stepIndex + 1}`,
    description: step.description || '',
    optional: !!step.optional,
    
    /**
     * Build SQL from template + inputs
     * 
     * Uses SystemConfig when available to resolve entity locations.
     */
    buildQuery: (entity, inputs) => {
      if (!template) {
        return `-- Missing SQL template for: ${step.queryId}
-- Add this template to SQL_TEMPLATES in recipeBuilder.js`;
      }
      
      // Get metadata context from SystemConfig
      const meta = getMetadataContext(inputs.systemConfig || systemConfig);
      
      // Build params from entity + inputs + inputBindings
      const params = {
        entity,
        entityGuid: entity?.guid,
        entityName: entity?.name,
        entityType: entity?.type,
        database: entity?.database || inputs.database || meta.db,
        schema: entity?.schema || inputs.schema || meta.schema,
        systemConfig: inputs.systemConfig || systemConfig,
        ...inputs,
      };
      
      // Apply input bindings (map wizard inputs to template params)
      if (step.inputBindings) {
        for (const [paramKey, inputKey] of Object.entries(step.inputBindings)) {
          if (inputs[inputKey] !== undefined) {
            params[paramKey] = inputs[inputKey];
          }
        }
      }
      
      return template(params);
    },
    
    /**
     * Extract data for next step using generic extractors
     */
    extractDataForNext: buildExtractorFromBindings(step.outputBindings),
    
    nextStep: nextStepId,
    shouldSkip: step.shouldSkip || null,
    skipMessage: step.skipMessage || '',
  };
}

/**
 * Build a complete MultiStepFlow from a recipe
 * 
 * @param {Object} recipe - The recipe definition
 * @param {Object} [systemConfig] - Optional SystemConfig for config-driven entity resolution
 */
export function buildFlowFromRecipe(recipe, systemConfig = null) {
  if (!recipe || !recipe.steps) {
    console.error('[RecipeBuilder] Invalid recipe:', recipe);
    return null;
  }
  
  // Build steps with proper next step linking
  const steps = recipe.steps.map((step, index) => {
    const nextStepId = recipe.steps[index + 1]?.id || null;
    return buildFlowStep(step, index, nextStepId, systemConfig);
  });
  
  /** @type {import('./types').MultiStepFlow} */
  const flow = {
    id: recipe.id,
    label: recipe.label,
    description: recipe.description,
    icon: recipe.icon,
    supportedEntityTypes: recipe.supportedEntityTypes || ['UNKNOWN'],
    domains: recipe.domains || [],
    intent: recipe.intent,
    steps,
    
    buildInitialInputs: (entity, availableTables = [], config = null) => {
      // Use SystemConfig to determine default db/schema
      const meta = getMetadataContext(config || systemConfig);
      
      return {
        // Standard entity context
        entityGuid: entity?.guid,
        entityName: entity?.name,
        entityType: entity?.type,
        database: entity?.database || meta.db,
        schema: entity?.schema || meta.schema,
        availableTables,
        
        // Pass systemConfig through for step builders
        systemConfig: config || systemConfig,
        
        // Recipe-specific defaults
        ...(recipe.defaultInputs || {}),
      };
    },
  };
  
  return flow;
}

/**
 * Register a custom SQL template
 */
export function registerSqlTemplate(queryId, templateFn) {
  SQL_TEMPLATES[queryId] = templateFn;
}

export default {
  buildFlowFromRecipe,
  getSqlTemplate,
  registerSqlTemplate,
};


```

## src/queryFlows/stepFlows/types.js

```javascript
/**
 * Multi-Step Query Flow Types
 * 
 * Defines the architecture for guided, step-by-step query wizards
 * that help users build complex queries incrementally.
 */

/**
 * @typedef {Object} FlowStepResult
 * @property {boolean} success - Whether the step executed successfully
 * @property {Object} results - Query results (columns, rows)
 * @property {Object} extractedData - Data extracted for next step
 * @property {string} [error] - Error message if failed
 */

/**
 * @typedef {Object} FlowStep
 * @property {string} id - Unique step identifier
 * @property {string} title - Display title for this step
 * @property {string} description - What this step does
 * @property {boolean} [optional] - Whether this step can be skipped
 * @property {function(EntityContext, Object, string[]): string} buildQuery - Generates SQL for this step
 * @property {function(Object): Object} [extractDataForNext] - Extracts data from results for next step
 * @property {string} [nextStep] - ID of next step (null = final)
 * @property {function(Object): boolean} [shouldSkip] - Condition to auto-skip this step
 * @property {string} [skipMessage] - Message shown when step is skipped
 */

/**
 * @typedef {Object} MultiStepFlow
 * @property {string} id - Flow identifier (e.g., 'LINEAGE_WIZARD')
 * @property {string} label - Display name
 * @property {string} description - Flow description
 * @property {string} icon - Icon name
 * @property {string[]} supportedEntityTypes - Entity types this flow supports
 * @property {FlowStep[]} steps - Ordered list of steps
 * @property {function(EntityContext): Object} buildInitialInputs - Creates initial inputs from entity
 */

/**
 * @typedef {Object} WizardState
 * @property {string} flowId - Current flow ID
 * @property {number} currentStepIndex - Current step (0-based)
 * @property {Object} inputs - Accumulated inputs from all steps
 * @property {FlowStepResult[]} stepResults - Results from each completed step
 * @property {boolean} isComplete - Whether the flow is finished
 * @property {string} [finalSql] - The final generated SQL
 */

export const WIZARD_STATUS = {
  IDLE: 'idle',
  RUNNING_STEP: 'running_step',
  AWAITING_INPUT: 'awaiting_input',
  STEP_COMPLETE: 'step_complete',
  FLOW_COMPLETE: 'flow_complete',
  ERROR: 'error',
};

/**
 * Create initial wizard state
 * @param {string} flowId 
 * @param {Object} initialInputs 
 * @returns {WizardState}
 */
export function createWizardState(flowId, initialInputs = {}) {
  return {
    flowId,
    currentStepIndex: 0,
    inputs: { ...initialInputs },
    stepResults: [],
    isComplete: false,
    finalSql: null,
    status: WIZARD_STATUS.IDLE,
  };
}

/**
 * Advance wizard to next step
 * @param {WizardState} state 
 * @param {FlowStepResult} stepResult 
 * @param {MultiStepFlow} flow 
 * @returns {WizardState}
 */
export function advanceWizard(state, stepResult, flow) {
  const newInputs = {
    ...state.inputs,
    ...(stepResult.extractedData || {}),
  };
  
  const newStepResults = [...state.stepResults, stepResult];
  const nextIndex = state.currentStepIndex + 1;
  const isComplete = nextIndex >= flow.steps.length;
  
  return {
    ...state,
    currentStepIndex: nextIndex,
    inputs: newInputs,
    stepResults: newStepResults,
    isComplete,
    status: isComplete ? WIZARD_STATUS.FLOW_COMPLETE : WIZARD_STATUS.STEP_COMPLETE,
  };
}


```



## Query Flows - SQL Builders


## src/queryFlows/sql/findByGuid.js

```javascript
/**
 * Find by GUID SQL Builder
 * 
 * Generates queries to find assets by their GUID.
 * Uses safe approaches that work across different schemas.
 */

/**
 * Build a query to find an asset by GUID
 * @param {import('../types').EntityContext} entity 
 * @param {import('../types').QueryFlowInputs} inputs 
 * @param {string[]} [availableTables]
 * @returns {import('../types').BuiltQuery}
 */
export function buildFindByGuidQuery(entity, inputs, availableTables = []) {
  const guid = entity.guid || inputs.filters?.guid || '<YOUR_GUID_HERE>';
  const db = entity.database || 'FIELD_METADATA';
  const schema = entity.schema || 'PUBLIC';
  
  // Find tables that likely contain GUIDs (end with _ENTITY)
  const tables = (availableTables || []).map(t => t.toUpperCase());
  const entityTables = tables.filter(t => t.endsWith('_ENTITY'));
  
  // If no entity tables, provide discovery query
  if (entityTables.length === 0) {
    const sql = `
-- No entity tables found in your schema
-- Let's discover what tables are available

SHOW TABLES LIKE '%_ENTITY%' IN ${db}.${schema};

-- Or search all tables:
-- SHOW TABLES IN ${db}.${schema};
`.trim();

    return {
      title: `🔍 Find Entity Tables`,
      description: `Discover tables that contain asset metadata.`,
      sql,
      database: db,
      schema,
      timeoutSeconds: 30,
      flowType: 'FIND_BY_GUID',
      entity,
    };
  }
  
  // Pick first few entity tables to search (don't try too many at once)
  const tablesToSearch = entityTables.slice(0, 5);
  
  // Build a simple search - use SELECT * to avoid column name issues
  const searchQueries = tablesToSearch.map(table => 
    `-- Search in ${table}\nSELECT * FROM ${db}.${schema}.${table} WHERE guid = '${guid}' LIMIT 1;`
  ).join('\n\n');
  
  const sql = `
-- Find asset by GUID: ${guid}
-- Searching ${tablesToSearch.length} entity tables

-- Run each query separately (Snowflake doesn't support multiple statements)
-- Or use UNION ALL below

${searchQueries}

-- Alternative: UNION ALL approach (may fail if column schemas differ)
/*
${tablesToSearch.map(table => 
  `SELECT '${table}' as source_table, * FROM ${db}.${schema}.${table} WHERE guid = '${guid}'`
).join('\nUNION ALL\n')}
LIMIT 1;
*/
`.trim();

  return {
    title: `🔍 Find: ${guid.substring(0, 12)}...`,
    description: `Search for GUID in ${tablesToSearch.length} entity tables.`,
    sql,
    database: db,
    schema,
    timeoutSeconds: 30,
    flowType: 'FIND_BY_GUID',
    entity,
  };
}

/**
 * Build a simple query to get full details from a specific table
 * This always works - just SELECT * WHERE guid = X
 */
export function buildGuidDetailsQuery(guid, entityTable, entity) {
  const db = entity?.database || 'FIELD_METADATA';
  const schema = entity?.schema || 'PUBLIC';
  
  const sql = `
-- Get full details for GUID: ${guid}
-- Table: ${entityTable}

SELECT *
FROM ${db}.${schema}.${entityTable}
WHERE guid = '${guid}'
LIMIT 1;
`.trim();

  return {
    title: `📄 Details: ${guid.substring(0, 12)}...`,
    description: `Full metadata from ${entityTable}.`,
    sql,
    database: db,
    schema,
    timeoutSeconds: 30,
    flowType: 'FIND_BY_GUID',
    entity,
  };
}

export default buildFindByGuidQuery;

```

## src/queryFlows/sql/glossary.js

```javascript
/**
 * Glossary SQL Builder
 * 
 * Generates queries for glossary term lookups and relationships.
 */

/**
 * Build a glossary lookup query
 * @param {import('../types').EntityContext} entity 
 * @param {import('../types').QueryFlowInputs} inputs 
 * @param {string[]} [availableTables]
 * @returns {import('../types').BuiltQuery}
 */
export function buildGlossaryQuery(entity, inputs, availableTables = []) {
  const { rowLimit = 200, filters = {} } = inputs;
  const termName = filters.termName || entity.name || '<TERM>';
  
  // Check available glossary tables
  const tables = (availableTables || []).map(t => t.toUpperCase());
  const glossaryTable = tables.includes('ATLASGLOSSARY_ENTITY') 
    ? 'ATLASGLOSSARY_ENTITY' 
    : tables.find(t => t.includes('GLOSSARY') && !t.includes('TERM') && !t.includes('CATEGORY'));
  
  const termTable = tables.includes('ATLASGLOSSARYTERM_ENTITY')
    ? 'ATLASGLOSSARYTERM_ENTITY'
    : tables.includes('GLOSSARYTERM_ENTITY')
    ? 'GLOSSARYTERM_ENTITY'
    : tables.find(t => t.includes('GLOSSARY') && t.includes('TERM'));
  
  if (!termTable) {
    return {
      title: `📖 Glossary: ${termName}`,
      description: 'No glossary tables found in schema.',
      sql: `-- No GLOSSARYTERM_ENTITY found\n-- Run this to find glossary tables:\nSHOW TABLES LIKE '%GLOSSARY%';`,
      flowType: 'GLOSSARY_LOOKUP',
      entity,
    };
  }

  const sql = `
-- Glossary: terms matching "${termName}"
-- Using ${termTable}

SELECT
    name AS term_name,
    guid,
    userdescription AS description,
    certificatestatus AS status,
    createdby AS created_by,
    anchor AS glossary_guids,
    categories AS category_guids
FROM ${termTable}
WHERE name ILIKE '%${termName}%'
   OR userdescription ILIKE '%${termName}%'
ORDER BY name
LIMIT ${rowLimit};
`.trim();

  return {
    title: `📖 Glossary: ${termName}`,
    description: `Glossary terms matching "${termName}".`,
    sql,
    database: entity.database || 'FIELD_METADATA',
    schema: entity.schema || 'PUBLIC',
    timeoutSeconds: 30,
    limit: rowLimit,
    flowType: 'GLOSSARY_LOOKUP',
    entity,
  };
}

/**
 * Build a query to find assets linked to a glossary term
 * @param {import('../types').EntityContext} entity 
 * @param {import('../types').QueryFlowInputs} inputs 
 * @param {string[]} [availableTables]
 * @returns {import('../types').BuiltQuery}
 */
export function buildTermLinkedAssetsQuery(entity, inputs, availableTables = []) {
  const { rowLimit = 200 } = inputs;
  const termGuid = entity.guid || '<TERM_GUID>';
  const termName = entity.name || '<TERM>';
  
  // Check for table entity
  const tables = (availableTables || []).map(t => t.toUpperCase());
  const hasTableEntity = tables.includes('TABLE_ENTITY');
  const hasColumnEntity = tables.includes('COLUMN_ENTITY');
  
  if (!hasTableEntity) {
    return {
      title: `🔗 Assets for: ${termName}`,
      description: 'TABLE_ENTITY not found.',
      sql: `-- TABLE_ENTITY not available\nSHOW TABLES;`,
      flowType: 'GLOSSARY_LOOKUP',
      entity,
    };
  }

  // MDLH stores term links in the MEANINGS array on assets
  const sql = `
-- Assets linked to glossary term: ${termName}
-- Term GUID: ${termGuid}

SELECT
    'TABLE' AS asset_type,
    t.name AS asset_name,
    t.guid AS asset_guid,
    t.databasename,
    t.schemaname,
    t.meanings
FROM TABLE_ENTITY t
WHERE ARRAY_CONTAINS('${termGuid}'::VARIANT, t.meanings)
${hasColumnEntity ? `
UNION ALL

SELECT
    'COLUMN' AS asset_type,
    c.name AS asset_name,
    c.guid AS asset_guid,
    c.databasename,
    c.schemaname,
    c.meanings
FROM COLUMN_ENTITY c
WHERE ARRAY_CONTAINS('${termGuid}'::VARIANT, c.meanings)
` : ''}
ORDER BY asset_type, asset_name
LIMIT ${rowLimit};
`.trim();

  return {
    title: `🔗 Assets linked to: ${termName}`,
    description: `Tables and columns linked to glossary term "${termName}".`,
    sql,
    database: entity.database || 'FIELD_METADATA',
    schema: entity.schema || 'PUBLIC',
    timeoutSeconds: 30,
    flowType: 'GLOSSARY_LOOKUP',
    entity,
  };
}

/**
 * Build a query to list all glossaries
 * @param {import('../types').EntityContext} entity 
 * @param {import('../types').QueryFlowInputs} inputs 
 * @param {string[]} [availableTables]
 * @returns {import('../types').BuiltQuery}
 */
export function buildListGlossariesQuery(entity, inputs, availableTables = []) {
  const { rowLimit = 100 } = inputs;
  
  const tables = (availableTables || []).map(t => t.toUpperCase());
  const glossaryTable = tables.includes('ATLASGLOSSARY_ENTITY')
    ? 'ATLASGLOSSARY_ENTITY'
    : tables.find(t => t.includes('GLOSSARY') && !t.includes('TERM') && !t.includes('CATEGORY'));
  
  if (!glossaryTable) {
    return {
      title: '📚 All Glossaries',
      description: 'No glossary table found.',
      sql: `-- No ATLASGLOSSARY_ENTITY found\nSHOW TABLES LIKE '%GLOSSARY%';`,
      flowType: 'GLOSSARY_LOOKUP',
      entity,
    };
  }

  const sql = `
-- List all glossaries

SELECT
    name AS glossary_name,
    guid,
    userdescription AS description,
    createdby AS created_by,
    TO_TIMESTAMP(createtime/1000) AS created_at
FROM ${glossaryTable}
ORDER BY name
LIMIT ${rowLimit};
`.trim();

  return {
    title: '📚 All Glossaries',
    description: 'List of all business glossaries.',
    sql,
    database: entity.database || 'FIELD_METADATA',
    schema: entity.schema || 'PUBLIC',
    timeoutSeconds: 30,
    flowType: 'GLOSSARY_LOOKUP',
    entity,
  };
}

export default buildGlossaryQuery;


```

## src/queryFlows/sql/lineage.js

```javascript
/**
 * Lineage SQL Builder
 * 
 * Generates lineage queries for any entity type with GUID.
 * Includes robust fallbacks when expected tables don't exist.
 * 
 * CONFIG-DRIVEN: Uses SystemConfig when available for entity resolution.
 */

/**
 * Find the best process table from SystemConfig or available tables
 * 
 * @param {string[]} availableTables - List of discovered tables
 * @param {Object} [systemConfig] - SystemConfig from backend
 * @returns {{ table: string, database: string, schema: string } | null}
 */
function findProcessTable(availableTables = [], systemConfig = null) {
  // First, check SystemConfig for known process entities
  const entities = systemConfig?.snowflake?.entities || {};
  
  // Priority order for process/lineage tables from SystemConfig
  const configCandidates = [
    'PROCESS_ENTITY',
    'COLUMNPROCESS_ENTITY', 
    'DBTPROCESS_ENTITY',
    'BIPROCESS_ENTITY',
  ];
  
  for (const candidate of configCandidates) {
    if (entities[candidate]) {
      const loc = entities[candidate];
      return {
        table: loc.table,
        database: loc.database,
        schema: loc.schema,
      };
    }
  }
  
  // Fallback to discovering from availableTables
  const tables = availableTables.map(t => t.toUpperCase());
  
  const discoveryPriority = [
    'PROCESS_ENTITY',
    'COLUMNPROCESS_ENTITY', 
    'DBTPROCESS_ENTITY',
    'BIPROCESS_ENTITY',
    'AIRFLOWTASK_ENTITY',
    'ADFPIPELINE_ENTITY',
    'ADFACTIVITY_ENTITY',
  ];
  
  for (const candidate of discoveryPriority) {
    if (tables.includes(candidate)) {
      // Use queryDefaults from SystemConfig if available
      const defaults = systemConfig?.queryDefaults || {};
      return {
        table: candidate,
        database: defaults.metadataDb || 'FIELD_METADATA',
        schema: defaults.metadataSchema || 'PUBLIC',
      };
    }
  }
  
  // Fallback: any table with PROCESS in name
  const processTable = availableTables.find(t => t.toUpperCase().includes('PROCESS'));
  if (processTable) {
    const defaults = systemConfig?.queryDefaults || {};
    return {
      table: processTable,
      database: defaults.metadataDb || 'FIELD_METADATA',
      schema: defaults.metadataSchema || 'PUBLIC',
    };
  }
  
  return null;
}

/**
 * Build a lineage query for the given entity
 * 
 * @param {import('../types').EntityContext} entity 
 * @param {import('../types').QueryFlowInputs} inputs 
 * @param {string[]} [availableTables]
 * @param {Object} [systemConfig] - SystemConfig for config-driven entity resolution
 * @returns {import('../types').BuiltQuery}
 */
export function buildLineageQuery(entity, inputs, availableTables = [], systemConfig = null) {
  const { 
    direction = 'DOWNSTREAM', 
    maxHops = 3, 
  } = inputs;
  
  const startGuid = entity.guid || '<YOUR_ASSET_GUID>';
  const startLabel = entity.name || entity.qualifiedName || startGuid;
  const isUpstream = direction === 'UPSTREAM';
  
  // Get db/schema from SystemConfig or entity
  const queryDefaults = systemConfig?.queryDefaults || {};
  const db = entity.database || queryDefaults.metadataDb || 'FIELD_METADATA';
  const schema = entity.schema || queryDefaults.metadataSchema || 'PUBLIC';
  
  // Find a process table (uses SystemConfig first, then discovery)
  const processLocation = findProcessTable(availableTables, systemConfig);
  
  // If no process table found, return a helpful discovery query instead
  if (!processLocation) {
    const sql = `
-- ⚠️ No lineage/process tables found in your schema
-- Let's discover what tables ARE available for lineage

-- Step 1: Find tables that might contain lineage data
SHOW TABLES LIKE '%PROCESS%' IN ${db}.${schema};

-- If no results, try these alternatives:
-- SHOW TABLES LIKE '%LINEAGE%' IN ${db}.${schema};
-- SHOW TABLES LIKE '%TASK%' IN ${db}.${schema};
-- SHOW TABLES LIKE '%PIPELINE%' IN ${db}.${schema};
`.trim();

    return {
      title: `🔍 Find Lineage Tables`,
      description: `No lineage tables found. Run this to discover available tables.`,
      sql,
      database: db,
      schema,
      timeoutSeconds: 30,
      flowType: 'LINEAGE',
      entity,
    };
  }
  
  const procDb = processLocation.database;
  const procSchema = processLocation.schema;
  const processTable = processLocation.table;
  const procFQN = `${procDb}.${procSchema}.${processTable}`;
  
  // First, let's check what columns the process table has
  // This is a safer approach than assuming column names
  const exploratorySQL = `
-- Lineage Exploration: ${direction} from ${startLabel}
-- Process table: ${procFQN}

-- Step 1: Explore the structure of ${processTable}
DESCRIBE TABLE ${procFQN};

-- Step 2: Preview the data (uncomment to run)
-- SELECT * FROM ${procFQN} LIMIT 10;

-- Step 3: If ${processTable} has 'inputs' and 'outputs' columns:
-- Find ${isUpstream ? 'upstream sources' : 'downstream targets'} for GUID: ${startGuid}
/*
SELECT 
    p.guid AS process_guid,
    p.name AS process_name,
    p.typename AS process_type,
    ${isUpstream ? 'p.inputs' : 'p.outputs'} AS related_assets
FROM ${procFQN} p
WHERE ARRAY_CONTAINS('${startGuid}'::VARCHAR, ${isUpstream ? 'p.outputs' : 'p.inputs'})
LIMIT 50;
*/
`.trim();

  return {
    title: `${isUpstream ? '⬆️ Upstream' : '⬇️ Downstream'} Lineage: ${startLabel}`,
    description: `Explore lineage using ${processTable}. GUID: ${startGuid.substring(0, 8)}...`,
    sql: exploratorySQL,
    database: procDb,
    schema: procSchema,
    timeoutSeconds: 60,
    limit: 1000,
    flowType: 'LINEAGE',
    entity,
  };
}

/**
 * Build a simple lineage exploration query
 * This just shows what's in the process table - always works if the table exists
 * 
 * @param {Object} entity - Entity context
 * @param {Object} inputs - Query inputs
 * @param {string[]} [availableTables] - Discovered tables
 * @param {Object} [systemConfig] - SystemConfig for config-driven entity resolution
 */
export function buildLineageExplorationQuery(entity, inputs, availableTables = [], systemConfig = null) {
  const queryDefaults = systemConfig?.queryDefaults || {};
  const db = entity.database || queryDefaults.metadataDb || 'FIELD_METADATA';
  const schema = entity.schema || queryDefaults.metadataSchema || 'PUBLIC';
  
  const processLocation = findProcessTable(availableTables, systemConfig);
  
  if (!processLocation) {
    return {
      title: `🔍 Find Lineage Tables`,
      description: `Search for tables containing lineage data.`,
      sql: `SHOW TABLES LIKE '%PROCESS%' IN ${db}.${schema};`,
      database: db,
      schema,
      timeoutSeconds: 30,
      flowType: 'LINEAGE',
      entity,
    };
  }
  
  const procFQN = `${processLocation.database}.${processLocation.schema}.${processLocation.table}`;
  
  const sql = `
-- Explore lineage data in ${processLocation.table}
-- This shows a sample of process/pipeline entities

SELECT *
FROM ${procFQN}
LIMIT 20;
`.trim();

  return {
    title: `📊 Lineage Data: ${processLocation.table}`,
    description: `Preview lineage/process entities in ${processLocation.table}.`,
    sql,
    database: processLocation.database,
    schema: processLocation.schema,
    timeoutSeconds: 30,
    flowType: 'LINEAGE',
    entity,
  };
}

export default buildLineageQuery;

```

## src/queryFlows/sql/sampleRows.js

```javascript
/**
 * Sample Rows SQL Builder
 * 
 * Generates queries to preview data from tables and views.
 */

/**
 * Build a sample rows query for the given entity
 * @param {import('../types').EntityContext} entity 
 * @param {import('../types').QueryFlowInputs} inputs 
 * @param {string[]} [availableTables]
 * @returns {import('../types').BuiltQuery}
 */
export function buildSampleRowsQuery(entity, inputs, availableTables = []) {
  const { rowLimit = 100 } = inputs;
  
  const db = entity.database || '<DATABASE>';
  const schema = entity.schema || '<SCHEMA>';
  const table = entity.table || entity.name || '<TABLE>';
  
  // Build fully qualified name
  const fqn = `"${db}"."${schema}"."${table}"`;
  
  const sql = `
-- Sample rows from ${fqn}
-- Limit: ${rowLimit} rows

SELECT *
FROM ${fqn}
LIMIT ${rowLimit};
`.trim();

  return {
    title: `👀 Sample: ${table}`,
    description: `Preview ${rowLimit} rows from ${fqn}.`,
    sql,
    database: db,
    schema,
    timeoutSeconds: 30,
    limit: rowLimit,
    flowType: 'SAMPLE_ROWS',
    entity,
  };
}

/**
 * Build a query to get row count and basic stats
 * @param {import('../types').EntityContext} entity 
 * @param {import('../types').QueryFlowInputs} inputs 
 * @returns {import('../types').BuiltQuery}
 */
export function buildTableStatsQuery(entity, inputs) {
  const db = entity.database || '<DATABASE>';
  const schema = entity.schema || '<SCHEMA>';
  const table = entity.table || entity.name || '<TABLE>';
  const fqn = `"${db}"."${schema}"."${table}"`;

  const sql = `
-- Table statistics for ${fqn}

SELECT
    COUNT(*) AS total_rows,
    COUNT(*) - COUNT(DISTINCT *) AS duplicate_rows,
    '${table}' AS table_name
FROM ${fqn};
`.trim();

  return {
    title: `📈 Stats: ${table}`,
    description: `Row count and basic statistics for ${fqn}.`,
    sql,
    database: db,
    schema,
    timeoutSeconds: 60,
    flowType: 'SAMPLE_ROWS',
    entity,
  };
}

export default buildSampleRowsQuery;


```

## src/queryFlows/sql/schemaBrowse.js

```javascript
/**
 * Schema Browse SQL Builder
 * 
 * Generates queries to explore database structure.
 * Uses SHOW TABLES and INFORMATION_SCHEMA which ALWAYS work.
 */

/**
 * Build a schema browse query - uses SHOW TABLES which always works
 * @param {import('../types').EntityContext} entity 
 * @param {import('../types').QueryFlowInputs} inputs 
 * @param {string[]} [availableTables]
 * @returns {import('../types').BuiltQuery}
 */
export function buildSchemaBrowseQuery(entity, inputs, availableTables = []) {
  const { rowLimit = 100, filters = {} } = inputs;
  const db = filters.database || entity.database || 'FIELD_METADATA';
  const schema = filters.schema || entity.schema || 'PUBLIC';
  
  // SHOW TABLES always works - this is the safest query
  const sql = `
-- List all tables in ${db}.${schema}
-- This query always works in Snowflake

SHOW TABLES IN ${db}.${schema};
`.trim();

  return {
    title: `📂 Tables in ${schema}`,
    description: `List all tables in ${db}.${schema}. Click table names in results to explore further.`,
    sql,
    database: db,
    schema,
    timeoutSeconds: 30,
    limit: rowLimit,
    flowType: 'SCHEMA_BROWSE',
    entity,
  };
}

/**
 * Build a query to find tables matching a pattern
 * @param {import('../types').EntityContext} entity 
 * @param {import('../types').QueryFlowInputs} inputs 
 * @param {string[]} [availableTables]
 * @returns {import('../types').BuiltQuery}
 */
export function buildTableSearchQuery(entity, inputs, availableTables = []) {
  const { searchTerm = '', rowLimit = 100 } = inputs;
  const db = entity.database || 'FIELD_METADATA';
  const schema = entity.schema || 'PUBLIC';
  
  // SHOW TABLES LIKE always works
  const sql = `
-- Find tables matching "${searchTerm || '*'}"
-- This query always works in Snowflake

SHOW TABLES LIKE '%${searchTerm}%' IN ${db}.${schema};
`.trim();

  return {
    title: `🔍 Find: ${searchTerm || 'tables'}`,
    description: `Tables matching "${searchTerm}" in ${db}.${schema}.`,
    sql,
    database: db,
    schema,
    timeoutSeconds: 30,
    flowType: 'SCHEMA_BROWSE',
    entity,
  };
}

/**
 * Build a query to get column details for a table
 * Uses DESCRIBE which always works
 * @param {import('../types').EntityContext} entity 
 * @param {import('../types').QueryFlowInputs} inputs 
 * @param {string[]} [availableTables]
 * @returns {import('../types').BuiltQuery}
 */
export function buildColumnDetailsQuery(entity, inputs, availableTables = []) {
  const tableName = entity.table || entity.name || '<TABLE>';
  const db = entity.database || 'FIELD_METADATA';
  const schema = entity.schema || 'PUBLIC';
  
  // DESCRIBE always works
  const sql = `
-- Show columns in ${tableName}
-- This query always works in Snowflake

DESCRIBE TABLE ${db}.${schema}.${tableName};
`.trim();

  return {
    title: `📋 Columns: ${tableName}`,
    description: `Column details for ${db}.${schema}.${tableName}.`,
    sql,
    database: db,
    schema,
    timeoutSeconds: 30,
    flowType: 'SCHEMA_BROWSE',
    entity,
  };
}

/**
 * Build a simple SELECT * query to explore a table
 * @param {string} tableName 
 * @param {string} db 
 * @param {string} schema 
 * @param {number} limit 
 * @returns {string}
 */
export function buildSimpleSelectQuery(tableName, db = 'FIELD_METADATA', schema = 'PUBLIC', limit = 10) {
  return `
-- Preview data from ${tableName}
-- Simple SELECT * always works

SELECT *
FROM ${db}.${schema}.${tableName}
LIMIT ${limit};
`.trim();
}

export default buildSchemaBrowseQuery;

```

## src/queryFlows/sql/usage.js

```javascript
/**
 * Usage SQL Builder
 * 
 * Generates queries to find how assets are being used.
 */

/**
 * Build a usage query for the given entity
 * @param {import('../types').EntityContext} entity 
 * @param {import('../types').QueryFlowInputs} inputs 
 * @param {string[]} [availableTables]
 * @returns {import('../types').BuiltQuery}
 */
export function buildUsageQuery(entity, inputs, availableTables = []) {
  const { daysBack = 30, rowLimit = 500 } = inputs;
  const assetName = entity.name || entity.qualifiedName || entity.guid || '<ASSET_NAME>';
  
  // Check if we have usage-related tables
  const tables = (availableTables || []).map(t => t.toUpperCase());
  const hasQueryHistory = tables.some(t => t.includes('QUERY') && t.includes('HISTORY'));
  
  let sql;
  
  if (hasQueryHistory) {
    // Use MDLH query history if available
    sql = `
-- Usage: queries referencing "${assetName}" in last ${daysBack} days

SELECT
    query_id,
    start_time,
    user_name,
    LEFT(query_text, 500) AS query_preview,
    rows_scanned,
    rows_returned,
    execution_time_ms
FROM QUERY_HISTORY_ENTITY
WHERE start_time >= DATEADD('day', -${daysBack}, CURRENT_TIMESTAMP())
  AND query_text ILIKE '%${assetName}%'
ORDER BY start_time DESC
LIMIT ${rowLimit};
`.trim();
  } else {
    // Fallback: use Snowflake's ACCOUNT_USAGE if accessible
    sql = `
-- Usage: queries referencing "${assetName}" in last ${daysBack} days
-- Note: Requires access to SNOWFLAKE.ACCOUNT_USAGE

SELECT
    query_id,
    start_time,
    user_name,
    LEFT(query_text, 500) AS query_preview,
    rows_produced,
    total_elapsed_time / 1000 AS execution_time_ms
FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
WHERE start_time >= DATEADD('day', -${daysBack}, CURRENT_TIMESTAMP())
  AND query_text ILIKE '%${assetName}%'
ORDER BY start_time DESC
LIMIT ${rowLimit};
`.trim();
  }

  return {
    title: `📊 Usage: ${assetName}`,
    description: `Queries that reference ${assetName} in the last ${daysBack} days.`,
    sql,
    database: entity.database,
    schema: entity.schema,
    timeoutSeconds: 60,
    limit: rowLimit,
    flowType: 'USAGE',
    entity,
  };
}

/**
 * Build a query to find popular assets
 * @param {import('../types').EntityContext} entity 
 * @param {import('../types').QueryFlowInputs} inputs 
 * @param {string[]} [availableTables]
 * @returns {import('../types').BuiltQuery}
 */
export function buildPopularityQuery(entity, inputs, availableTables = []) {
  const { rowLimit = 100 } = inputs;
  const db = entity.database || 'FIELD_METADATA';
  const schema = entity.schema || 'PUBLIC';
  
  const tables = (availableTables || []).map(t => t.toUpperCase());
  const hasTableEntity = tables.includes('TABLE_ENTITY');
  
  if (!hasTableEntity) {
    return {
      title: '🔥 Popular Assets',
      description: 'TABLE_ENTITY not found in schema.',
      sql: `-- TABLE_ENTITY not available\nSHOW TABLES;`,
      flowType: 'USAGE',
      entity,
    };
  }

  const sql = `
-- Popular tables by query count and popularity score

SELECT
    name,
    typename,
    guid,
    querycount AS query_count,
    queryusercount AS unique_users,
    popularityscore AS popularity_score,
    databasename,
    schemaname
FROM TABLE_ENTITY
WHERE querycount > 0
ORDER BY popularityscore DESC, querycount DESC
LIMIT ${rowLimit};
`.trim();

  return {
    title: '🔥 Most Popular Tables',
    description: `Tables ranked by usage and popularity in ${db}.${schema}.`,
    sql,
    database: db,
    schema,
    timeoutSeconds: 30,
    flowType: 'USAGE',
    entity,
  };
}

export default buildUsageQuery;


```



# UTILS


## src/utils/LRUCache.js

```javascript
/**
 * LRU (Least Recently Used) Cache Implementation
 * 
 * A bounded cache with time-to-live (TTL) support to prevent unbounded memory growth.
 * Used for caching query results, table metadata, and other frequently accessed data.
 */

export class LRUCache {
  /**
   * Create a new LRU cache
   * @param {number} maxSize - Maximum number of entries (default: 100)
   * @param {number} ttlMs - Time-to-live in milliseconds (default: 5 minutes)
   */
  constructor(maxSize = 100, ttlMs = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this.cache = new Map();
  }

  /**
   * Get a value from the cache
   * @param {string} key - Cache key
   * @returns {*} The cached value or undefined if not found/expired
   */
  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return undefined;
    }

    // Check if entry has expired
    if (this.ttlMs > 0 && Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    return entry.value;
  }

  /**
   * Set a value in the cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   */
  set(key, value) {
    // Delete existing entry to update position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict oldest entry if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  /**
   * Check if a key exists in the cache (without updating access time)
   * @param {string} key - Cache key
   * @returns {boolean}
   */
  has(key) {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // Check expiration
    if (this.ttlMs > 0 && Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Delete a key from the cache
   * @param {string} key - Cache key
   * @returns {boolean} True if the key was deleted
   */
  delete(key) {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries from the cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get the current size of the cache
   * @returns {number}
   */
  get size() {
    return this.cache.size;
  }

  /**
   * Get all keys in the cache (for debugging)
   * @returns {string[]}
   */
  keys() {
    return Array.from(this.cache.keys());
  }

  /**
   * Remove all expired entries
   * @returns {number} Number of entries removed
   */
  prune() {
    if (this.ttlMs <= 0) return 0;
    
    const now = Date.now();
    let removed = 0;
    
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.ttlMs) {
        this.cache.delete(key);
        removed++;
      }
    }
    
    return removed;
  }
}

/**
 * Create a cache with preset configurations
 */
export const createCache = {
  /**
   * Small cache for frequently changing data (short TTL)
   */
  small: () => new LRUCache(50, 60 * 1000), // 50 entries, 1 min TTL

  /**
   * Medium cache for general use
   */
  medium: () => new LRUCache(100, 5 * 60 * 1000), // 100 entries, 5 min TTL

  /**
   * Large cache for stable data (long TTL)
   */
  large: () => new LRUCache(500, 30 * 60 * 1000), // 500 entries, 30 min TTL

  /**
   * Session cache (no TTL, cleared on refresh)
   */
  session: () => new LRUCache(200, 0), // 200 entries, no expiration
};

export default LRUCache;


```

## src/utils/errorLogging.js

```javascript
/**
 * Global Error Logging
 * 
 * Captures uncaught errors and unhandled promise rejections.
 * Call initGlobalErrorLogging() in your app bootstrap (main.jsx).
 */

import { createLogger } from './logger';

const log = createLogger('Global');

/**
 * Initialize global error handlers
 * Captures window errors and unhandled promise rejections
 */
export function initGlobalErrorLogging() {
  // Catch synchronous errors
  window.addEventListener('error', (event) => {
    log.error('Uncaught error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error?.stack || String(event.error),
    });
  });

  // Catch async errors (unhandled promise rejections)
  window.addEventListener('unhandledrejection', (event) => {
    log.error('Unhandled promise rejection', {
      reason: event.reason?.message || String(event.reason),
      stack: event.reason?.stack,
    });
  });

  log.info('Global error logging initialized');
}

export default initGlobalErrorLogging;


```

## src/utils/logger.js

```javascript
/**
 * Structured Logger Utility
 * 
 * Creates namespaced, levelled loggers for consistent, searchable console output.
 * All logs are prefixed with timestamp and scope for easy filtering.
 * 
 * Usage:
 *   import { createLogger } from '../utils/logger';
 *   const log = createLogger('useConnection');
 *   log.info('testConnection() called', { sessionId: '...' });
 * 
 * Output:
 *   2025-12-05T18:30:00.123Z [MDLH][useConnection] testConnection() called { sessionId: '...' }
 */

const DEBUG_ENABLED =
  import.meta.env.MODE === 'development' ||
  import.meta.env.VITE_DEBUG_LOGS === 'true';

/**
 * Create a scoped logger instance
 * @param {string} scope - The namespace for this logger (e.g., 'useConnection', 'UI', 'App')
 * @returns {object} Logger with debug, info, warn, error, group, groupEnd methods
 */
export function createLogger(scope) {
  const prefix = `[MDLH][${scope}]`;

  const formatArgs = (args) => {
    return args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        try {
          // For objects, return as-is for console to format nicely
          return arg;
        } catch {
          return String(arg);
        }
      }
      return arg;
    });
  };

  const base = (level, ...args) => {
    if (!DEBUG_ENABLED) return;
    const ts = new Date().toISOString();
    const formatted = formatArgs(args);
    console[level](`${ts} ${prefix}`, ...formatted);
  };

  return {
    /**
     * Debug level - verbose details for tracing
     */
    debug: (...args) => base('debug', ...args),
    
    /**
     * Info level - significant events (connection established, query executed)
     */
    info: (...args) => base('info', ...args),
    
    /**
     * Warn level - recoverable issues (session timeout, retry)
     */
    warn: (...args) => base('warn', ...args),
    
    /**
     * Error level - failures that need attention
     */
    error: (...args) => base('error', ...args),
    
    /**
     * Start a collapsible group in console
     */
    group(label) {
      if (!DEBUG_ENABLED) return;
      console.group(`${prefix} ${label}`);
    },
    
    /**
     * End a collapsible group
     */
    groupEnd() {
      if (!DEBUG_ENABLED) return;
      console.groupEnd();
    },

    /**
     * Log with timing - useful for measuring async operations
     * @returns {function} Call this function when operation completes
     */
    time(label) {
      if (!DEBUG_ENABLED) return () => {};
      const start = performance.now();
      const ts = new Date().toISOString();
      console.debug(`${ts} ${prefix} ⏱ START: ${label}`);
      return (extra = {}) => {
        const duration = Math.round(performance.now() - start);
        const endTs = new Date().toISOString();
        console.debug(`${endTs} ${prefix} ⏱ END: ${label}`, { durationMs: duration, ...extra });
        return duration;
      };
    },
  };
}

/**
 * Check if debug logging is enabled
 * @returns {boolean}
 */
export function isDebugEnabled() {
  return DEBUG_ENABLED;
}

export default createLogger;


```

## src/utils/queryHelpers.js

```javascript
/**
 * Query Helper Utilities
 * 
 * Functions for query validation, pre-validation, and smart query generation.
 */

import { extractTableFromQuery, fixQueryForAvailableTables } from './tableDiscovery';

/**
 * Pre-validate all queries and return a validation map
 * @param {Object} allQueries - Object with category keys and query arrays
 * @param {Set<string>} discoveredTables - Set of discovered table names
 * @param {string} database - Database name
 * @param {string} schema - Schema name
 * @returns {Map} Map of queryId -> validation result
 */
export function preValidateAllQueries(allQueries, discoveredTables, database, schema) {
  const validationMap = new Map();
  
  Object.entries(allQueries).forEach(([category, queries]) => {
    queries.forEach((q, index) => {
      const queryId = `${category}-${index}`;
      const tableName = extractTableFromQuery(q.query);
      
      if (!tableName) {
        validationMap.set(queryId, { valid: null, tableName: null });
        return;
      }
      
      const tableExists = discoveredTables.has(tableName.toUpperCase());
      
      if (tableExists) {
        validationMap.set(queryId, { 
          valid: true, 
          tableName,
          originalQuery: q.query
        });
      } else {
        // Try to fix the query
        const fixed = fixQueryForAvailableTables(q.query, discoveredTables, database, schema);
        
        if (fixed.fixed) {
          validationMap.set(queryId, {
            valid: true,
            tableName: fixed.changes[0]?.to,
            originalQuery: q.query,
            fixedQuery: fixed.sql,
            changes: fixed.changes,
            autoFixed: true
          });
        } else {
          validationMap.set(queryId, {
            valid: false,
            tableName,
            originalQuery: q.query,
            error: `Table ${tableName} not found in ${database}.${schema}`
          });
        }
      }
    });
  });
  
  return validationMap;
}

/**
 * Sort queries with validated ones first, unavailable last
 * @param {Array} queries - Array of query objects
 * @param {Function} getAvailability - Function to check table availability
 * @returns {Array} Sorted queries
 */
export function sortQueriesByAvailability(queries, getAvailability) {
  return [...queries].sort((a, b) => {
    const availA = getAvailability(a.query);
    const availB = getAvailability(b.query);
    
    // Validated first (true), then unknown (null), then unavailable (false)
    if (availA === true && availB !== true) return -1;
    if (availB === true && availA !== true) return 1;
    if (availA === false && availB !== false) return 1;
    if (availB === false && availA !== false) return -1;
    return 0;
  });
}

/**
 * Generate query suggestions based on entity data and available tables
 * @param {string} entityType - Entity type name
 * @param {string} tableName - Table name
 * @param {Set<string>} discoveredTables - Available tables
 * @param {string} database - Database name
 * @param {string} schema - Schema name
 * @returns {Array<{title: string, query: string}>}
 */
export function generateQuerySuggestions(entityType, tableName, discoveredTables, database, schema) {
  const suggestions = [];
  
  if (!tableName || tableName === '(abstract)' || !discoveredTables.has(tableName.toUpperCase())) {
    return suggestions;
  }
  
  const fullTableRef = `${database}.${schema}.${tableName}`;
  
  // Basic count query
  suggestions.push({
    title: `Count ${entityType} records`,
    query: `SELECT COUNT(*) AS total_count FROM ${fullTableRef};`
  });
  
  // Sample rows
  suggestions.push({
    title: `Sample ${entityType} data`,
    query: `SELECT * FROM ${fullTableRef} LIMIT 10;`
  });
  
  // Recent records (if table has timestamp columns)
  suggestions.push({
    title: `Recently updated ${entityType}`,
    query: `SELECT NAME, GUID, TO_TIMESTAMP(UPDATETIME/1000) AS updated_at
FROM ${fullTableRef}
WHERE UPDATETIME IS NOT NULL
ORDER BY UPDATETIME DESC
LIMIT 20;`
  });
  
  return suggestions;
}

/**
 * Parse SQL to extract all table references
 * @param {string} sql - SQL query
 * @returns {Array<string>} Array of table names
 */
export function extractAllTablesFromQuery(sql) {
  if (!sql) return [];
  
  const tables = [];
  const patterns = [
    /FROM\s+(?:[\w.]+\.)?(\w+)/gi,
    /JOIN\s+(?:[\w.]+\.)?(\w+)/gi,
    /INTO\s+(?:[\w.]+\.)?(\w+)/gi,
    /UPDATE\s+(?:[\w.]+\.)?(\w+)/gi,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(sql)) !== null) {
      const tableName = match[1].toUpperCase();
      if (!tables.includes(tableName)) {
        tables.push(tableName);
      }
    }
  }
  
  return tables;
}

/**
 * Check if a query is read-only (SELECT/SHOW/DESCRIBE)
 * @param {string} sql - SQL query
 * @returns {boolean}
 */
export function isReadOnlyQuery(sql) {
  if (!sql) return true;
  
  const trimmed = sql.trim().toUpperCase();
  const readOnlyPrefixes = ['SELECT', 'SHOW', 'DESCRIBE', 'DESC', 'EXPLAIN', 'WITH'];
  
  return readOnlyPrefixes.some(prefix => trimmed.startsWith(prefix));
}

/**
 * Add LIMIT clause if not present (for safety)
 * @param {string} sql - SQL query
 * @param {number} limit - Default limit (default: 1000)
 * @returns {string}
 */
export function ensureQueryLimit(sql, limit = 1000) {
  if (!sql) return sql;
  
  const trimmed = sql.trim();
  
  // Only add limit to SELECT statements without existing LIMIT
  if (!trimmed.toUpperCase().startsWith('SELECT')) return sql;
  if (/LIMIT\s+\d+/i.test(trimmed)) return sql;
  
  // Remove trailing semicolon, add LIMIT, add semicolon back
  const withoutSemicolon = trimmed.replace(/;\s*$/, '');
  return `${withoutSemicolon} LIMIT ${limit};`;
}

/**
 * Format SQL for display (basic formatting)
 * @param {string} sql - SQL query
 * @returns {string}
 */
export function formatSQL(sql) {
  if (!sql) return '';
  
  // Basic keyword capitalization
  const keywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 
    'ON', 'AND', 'OR', 'GROUP', 'BY', 'ORDER', 'LIMIT', 'HAVING', 'UNION', 'ALL',
    'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'ALTER', 'DROP',
    'TABLE', 'VIEW', 'INDEX', 'AS', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX'];
  
  let formatted = sql;
  keywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    formatted = formatted.replace(regex, keyword);
  });
  
  return formatted;
}

export default {
  preValidateAllQueries,
  sortQueriesByAvailability,
  generateQuerySuggestions,
  extractAllTablesFromQuery,
  isReadOnlyQuery,
  ensureQueryLimit,
  formatSQL,
};


```

## src/utils/querySuggestions.js

```javascript
/**
 * Query Suggestions Utility
 * 
 * Provides intelligent SQL query suggestions including:
 * - Fuzzy matching for table/column names
 * - Query rewriting with available schema
 * - Proactive autocomplete suggestions
 */

import { createLogger } from './logger';

const log = createLogger('QuerySuggestions');

// =============================================================================
// Fuzzy Matching Algorithms
// =============================================================================

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Edit distance
 */
export function levenshteinDistance(a, b) {
  if (!a || !b) return Math.max(a?.length || 0, b?.length || 0);
  
  const matrix = [];
  const aLen = a.length;
  const bLen = b.length;

  // Initialize matrix
  for (let i = 0; i <= bLen; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= aLen; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= bLen; i++) {
    for (let j = 1; j <= aLen; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[bLen][aLen];
}

/**
 * Calculate similarity score (0-1) between two strings
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Similarity score (1 = identical)
 */
export function similarityScore(a, b) {
  if (!a || !b) return 0;
  const aUpper = a.toUpperCase();
  const bUpper = b.toUpperCase();
  
  if (aUpper === bUpper) return 1;
  
  const maxLen = Math.max(aUpper.length, bUpper.length);
  if (maxLen === 0) return 1;
  
  const distance = levenshteinDistance(aUpper, bUpper);
  return 1 - (distance / maxLen);
}

/**
 * Parse entity name into meaningful parts
 * e.g., "DBTMODELCOLUMN_ENTITY" → { prefix: "DBT", parts: ["MODEL", "COLUMN"], suffix: "ENTITY" }
 */
function parseEntityName(name) {
  const upper = name.toUpperCase();
  const withoutSuffix = upper.replace(/_ENTITY$/, '');
  
  // Common prefixes in MDLH
  const prefixes = ['DBT', 'ATLAS', 'POWERBI', 'TABLEAU', 'LOOKER', 'PRESET', 'METABASE', 'SIGMA', 'MODE', 'AIRFLOW', 'FIVETRAN', 'MONTE', 'SODA', 'S3', 'GCS', 'ADLS', 'AZURE', 'AWS'];
  let prefix = '';
  let remainder = withoutSuffix;
  
  for (const p of prefixes) {
    if (withoutSuffix.startsWith(p)) {
      prefix = p;
      remainder = withoutSuffix.slice(p.length);
      break;
    }
  }
  
  // Split camelCase or remaining parts
  const parts = remainder.split(/(?=[A-Z])/).filter(p => p.length > 0);
  
  return { prefix, parts, suffix: upper.endsWith('_ENTITY') ? 'ENTITY' : '', original: upper };
}

/**
 * Calculate semantic similarity between two entity names
 */
function entitySimilarity(target, candidate) {
  const t = parseEntityName(target);
  const c = parseEntityName(candidate);
  
  let score = 0;
  const reasons = [];
  
  // Same prefix is a strong signal (e.g., both DBT*)
  if (t.prefix && t.prefix === c.prefix) {
    score += 0.4;
    reasons.push(`Same ${t.prefix} family`);
  }
  
  // Check for shared parts
  const sharedParts = t.parts.filter(p => c.parts.includes(p));
  if (sharedParts.length > 0) {
    const partScore = (sharedParts.length / Math.max(t.parts.length, c.parts.length)) * 0.5;
    score += partScore;
    reasons.push(`Shares: ${sharedParts.join(', ')}`);
  }
  
  // Bonus for similar length (same complexity)
  const lengthRatio = Math.min(t.parts.length, c.parts.length) / Math.max(t.parts.length, c.parts.length);
  score += lengthRatio * 0.1;
  
  return { score: Math.min(score, 1), reasons };
}

/**
 * Find similar items from a list based on fuzzy matching
 * @param {string} target - Target string to match
 * @param {string[]} candidates - List of candidate strings
 * @param {number} minScore - Minimum similarity score (0-1)
 * @param {number} maxResults - Maximum results to return
 * @returns {Array<{name: string, score: number, reason: string}>}
 */
export function findSimilar(target, candidates, minScore = 0.25, maxResults = 8) {
  if (!target || !candidates?.length) return [];
  
  const targetUpper = target.toUpperCase();
  const results = [];
  
  for (const candidate of candidates) {
    const candidateUpper = candidate.toUpperCase();
    
    // Skip exact match (that's the one that doesn't exist!)
    if (candidateUpper === targetUpper) {
      continue;
    }
    
    // Try semantic entity matching first
    const semantic = entitySimilarity(target, candidate);
    if (semantic.score > 0.3) {
      results.push({ 
        name: candidate, 
        score: semantic.score, 
        reason: semantic.reasons.join(' • ') || 'Related entity'
      });
      continue;
    }
    
    // Remove common suffixes/prefixes for comparison
    const cleanTarget = targetUpper.replace(/_ENTITY$/, '').replace(/^ATLAS/, '');
    const cleanCandidate = candidateUpper.replace(/_ENTITY$/, '').replace(/^ATLAS/, '');
    
    // Same base entity type
    if (cleanCandidate === cleanTarget) {
      results.push({ name: candidate, score: 0.95, reason: 'Same entity type' });
      continue;
    }
    
    // One contains the other (partial match)
    if (cleanCandidate.includes(cleanTarget)) {
      const ratio = cleanTarget.length / cleanCandidate.length;
      results.push({ name: candidate, score: 0.6 + ratio * 0.3, reason: `Contains "${cleanTarget}"` });
      continue;
    }
    
    if (cleanTarget.includes(cleanCandidate)) {
      const ratio = cleanCandidate.length / cleanTarget.length;
      results.push({ name: candidate, score: 0.5 + ratio * 0.3, reason: `Part of "${cleanTarget}"` });
      continue;
    }
    
    // Levenshtein similarity as fallback
    const score = similarityScore(cleanTarget, cleanCandidate);
    if (score >= minScore) {
      results.push({ name: candidate, score, reason: `${Math.round(score * 100)}% similar` });
    }
  }
  
  // Sort by score descending
  results.sort((a, b) => b.score - a.score);
  
  // Deduplicate and limit
  const seen = new Set();
  const unique = results.filter(r => {
    if (seen.has(r.name.toUpperCase())) return false;
    seen.add(r.name.toUpperCase());
    return true;
  });
  
  return unique.slice(0, maxResults);
}

// =============================================================================
// SQL Parsing Utilities
// =============================================================================

/**
 * Extract table references from SQL query
 * @param {string} sql - SQL query
 * @returns {Array<{table: string, alias: string|null, position: number}>}
 */
export function extractTableReferences(sql) {
  if (!sql) return [];
  
  const tables = [];
  
  // Remove comments
  let cleanSql = sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Pattern for FROM/JOIN table references
  const patterns = [
    // FROM database.schema.table AS alias
    /(?:FROM|JOIN)\s+(?:(\w+)\.)?(?:(\w+)\.)?(\w+)(?:\s+(?:AS\s+)?(\w+))?/gi,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(cleanSql)) !== null) {
      const [fullMatch, db, schema, table, alias] = match;
      if (table && !['SELECT', 'WHERE', 'AND', 'OR', 'ON', 'AS'].includes(table.toUpperCase())) {
        tables.push({
          table: table.toUpperCase(),
          database: db?.toUpperCase() || null,
          schema: schema?.toUpperCase() || null,
          alias: alias || null,
          position: match.index,
          fullMatch
        });
      }
    }
  }
  
  return tables;
}

/**
 * Extract column references from SQL query
 * @param {string} sql - SQL query
 * @returns {Array<{column: string, table: string|null, position: number}>}
 */
export function extractColumnReferences(sql) {
  if (!sql) return [];
  
  const columns = [];
  
  // Remove comments
  let cleanSql = sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Find SELECT columns
  const selectMatch = cleanSql.match(/SELECT\s+([\s\S]*?)\s+FROM/i);
  if (selectMatch) {
    const selectPart = selectMatch[1];
    // Split by comma, handling functions
    const parts = selectPart.split(/,(?![^(]*\))/);
    
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed === '*') continue;
      
      // Handle table.column or just column
      const colMatch = trimmed.match(/^(?:(\w+)\.)?(\w+)(?:\s+AS\s+\w+)?$/i);
      if (colMatch) {
        columns.push({
          column: colMatch[2].toUpperCase(),
          table: colMatch[1]?.toUpperCase() || null,
          inSelect: true
        });
      }
    }
  }
  
  // Find WHERE columns
  const whereMatch = cleanSql.match(/WHERE\s+([\s\S]*?)(?:ORDER|GROUP|LIMIT|$)/i);
  if (whereMatch) {
    const wherePart = whereMatch[1];
    const colPattern = /(?:(\w+)\.)?(\w+)\s*(?:=|!=|<>|>|<|>=|<=|LIKE|IN|IS)/gi;
    let match;
    while ((match = colPattern.exec(wherePart)) !== null) {
      const col = match[2].toUpperCase();
      if (!['AND', 'OR', 'NOT', 'NULL', 'TRUE', 'FALSE'].includes(col)) {
        columns.push({
          column: col,
          table: match[1]?.toUpperCase() || null,
          inWhere: true
        });
      }
    }
  }
  
  return columns;
}

// =============================================================================
// Suggestion Generation
// =============================================================================

/**
 * @typedef {Object} QuerySuggestion
 * @property {'table'|'column'|'syntax'|'rewrite'} type - Suggestion type
 * @property {string} title - Short title for the chip
 * @property {string} description - Longer description
 * @property {string} fix - The fix to apply
 * @property {string} [preview] - Preview of fixed query
 * @property {number} confidence - Confidence score (0-1)
 */

/**
 * Generate table suggestions for a missing table
 * @param {string} missingTable - Table name that doesn't exist
 * @param {Set<string>|string[]} availableTables - Available tables
 * @param {Object} tableInfo - Optional info about tables (row counts, etc.)
 * @returns {QuerySuggestion[]}
 */
export function suggestTableAlternatives(missingTable, availableTables, tableInfo = {}) {
  const tables = Array.isArray(availableTables) ? availableTables : [...availableTables];
  const suggestions = [];
  
  const similar = findSimilar(missingTable, tables, 0.25, 8);
  
  for (const match of similar) {
    const info = tableInfo[match.name?.toUpperCase()] || tableInfo[match.name];
    const rowCount = info?.rowCount;
    
    // Build a helpful description
    let description = match.reason;
    if (rowCount !== undefined) {
      description += rowCount > 0 
        ? ` • ${rowCount.toLocaleString()} rows` 
        : ' • Empty table';
    }
    
    suggestions.push({
      type: 'table',
      title: match.name,
      description,
      fix: match.name,
      confidence: match.score,
      rowCount,
      // Add badge for high-confidence matches
      badge: match.score > 0.7 ? '⭐ Best match' : null
    });
  }
  
  // Sort: prioritize tables with data, then by confidence
  suggestions.sort((a, b) => {
    // Tables with data first
    if (a.rowCount > 0 && (!b.rowCount || b.rowCount === 0)) return -1;
    if (b.rowCount > 0 && (!a.rowCount || a.rowCount === 0)) return 1;
    // Then by confidence
    return b.confidence - a.confidence;
  });
  
  return suggestions;
}

/**
 * Generate column suggestions for a missing column
 * @param {string} missingColumn - Column name that doesn't exist
 * @param {string[]} availableColumns - Available columns in the table
 * @param {string} tableName - Table name for context
 * @returns {QuerySuggestion[]}
 */
export function suggestColumnAlternatives(missingColumn, availableColumns, tableName) {
  const suggestions = [];
  
  const similar = findSimilar(missingColumn, availableColumns, 0.4, 5);
  
  for (const match of similar) {
    suggestions.push({
      type: 'column',
      title: match.name,
      description: `${match.reason} in ${tableName}`,
      fix: match.name,
      confidence: match.score
    });
  }
  
  return suggestions;
}

/**
 * Generate a rewritten query with fixes applied
 * @param {string} originalSql - Original SQL with errors
 * @param {Object} replacements - Map of original -> replacement
 * @returns {QuerySuggestion}
 */
export function generateQueryRewrite(originalSql, replacements) {
  let fixedSql = originalSql;
  const changes = [];
  
  for (const [original, replacement] of Object.entries(replacements)) {
    if (original !== replacement) {
      // Replace in a case-insensitive way but preserve structure
      const regex = new RegExp(`\\b${escapeRegex(original)}\\b`, 'gi');
      if (regex.test(fixedSql)) {
        fixedSql = fixedSql.replace(regex, replacement);
        changes.push({ from: original, to: replacement });
      }
    }
  }
  
  if (changes.length === 0) {
    return null;
  }
  
  return {
    type: 'rewrite',
    title: 'Apply all fixes',
    description: changes.map(c => `${c.from} → ${c.to}`).join(', '),
    fix: fixedSql,
    preview: fixedSql,
    confidence: 0.9,
    changes
  };
}

/**
 * Escape special regex characters
 * @param {string} str - String to escape
 * @returns {string}
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// =============================================================================
// Proactive Suggestions (Autocomplete)
// =============================================================================

/**
 * Get proactive suggestions based on cursor position
 * @param {string} sql - Current SQL
 * @param {number} cursorPosition - Cursor position in the text
 * @param {Object} schema - Available schema info
 * @returns {QuerySuggestion[]}
 */
export function getProactiveSuggestions(sql, cursorPosition, schema) {
  if (!sql || !schema) return [];
  
  const suggestions = [];
  const textBeforeCursor = sql.substring(0, cursorPosition);
  const textAfterCursor = sql.substring(cursorPosition);
  
  // Check what context we're in
  const lastWord = textBeforeCursor.match(/(\w*)$/)?.[1] || '';
  const prevKeyword = textBeforeCursor.match(/\b(SELECT|FROM|JOIN|WHERE|AND|OR)\s+\w*$/i)?.[1]?.toUpperCase();
  
  // After FROM/JOIN - suggest tables
  if (prevKeyword === 'FROM' || prevKeyword === 'JOIN') {
    const tables = schema.tables || [];
    const filtered = lastWord 
      ? findSimilar(lastWord, tables, 0.2, 10)
      : tables.slice(0, 10).map(t => ({ name: t, score: 1, reason: 'Available table' }));
    
    for (const match of filtered) {
      suggestions.push({
        type: 'table',
        title: match.name,
        description: match.reason,
        fix: match.name,
        confidence: match.score,
        replaceFrom: cursorPosition - lastWord.length,
        replaceTo: cursorPosition
      });
    }
  }
  
  // After SELECT or in WHERE - suggest columns
  if (prevKeyword === 'SELECT' || prevKeyword === 'WHERE' || prevKeyword === 'AND' || prevKeyword === 'OR') {
    // Find which table we're querying
    const fromMatch = sql.match(/FROM\s+(?:\w+\.)?(?:\w+\.)?(\w+)/i);
    const tableName = fromMatch?.[1]?.toUpperCase();
    
    if (tableName && schema.columns?.[tableName]) {
      const columns = schema.columns[tableName];
      const filtered = lastWord
        ? findSimilar(lastWord, columns, 0.2, 10)
        : columns.slice(0, 10).map(c => ({ name: c, score: 1, reason: `Column in ${tableName}` }));
      
      for (const match of filtered) {
        suggestions.push({
          type: 'column',
          title: match.name,
          description: match.reason,
          fix: match.name,
          confidence: match.score,
          replaceFrom: cursorPosition - lastWord.length,
          replaceTo: cursorPosition
        });
      }
    }
  }
  
  return suggestions;
}

// =============================================================================
// Error-based Suggestions
// =============================================================================

/**
 * Detect placeholders in SQL that need to be replaced
 * @param {string} sql - SQL query
 * @returns {Array<{placeholder: string, type: string, suggestion: string}>}
 */
export function detectPlaceholders(sql) {
  const placeholders = [];
  
  // Common placeholder patterns
  const patterns = [
    // <PLACEHOLDER> style
    { 
      regex: /<([A-Z_]+)>/gi, 
      type: 'angle_bracket',
      getType: (match) => {
        const name = match[1].toUpperCase();
        if (name.includes('GUID')) return 'guid';
        if (name.includes('TABLE')) return 'table';
        if (name.includes('COLUMN')) return 'column';
        if (name.includes('DATABASE') || name.includes('DB')) return 'database';
        if (name.includes('SCHEMA')) return 'schema';
        if (name.includes('DATE')) return 'date';
        if (name.includes('VALUE')) return 'value';
        return 'generic';
      }
    },
    // YOUR_* style
    { 
      regex: /'YOUR_([A-Z_]+)'/gi, 
      type: 'your_prefix',
      getType: (match) => {
        const name = match[1].toUpperCase();
        if (name.includes('GUID')) return 'guid';
        if (name.includes('TABLE')) return 'table';
        return 'generic';
      }
    },
    // ${VARIABLE} style
    { 
      regex: /\$\{([A-Z_]+)\}/gi, 
      type: 'template',
      getType: () => 'generic'
    },
    // :variable style (bind parameters)
    { 
      regex: /:([a-zA-Z_][a-zA-Z0-9_]*)/g, 
      type: 'bind',
      getType: (match) => {
        const name = match[1].toLowerCase();
        if (name.includes('guid')) return 'guid';
        if (name.includes('id')) return 'id';
        return 'generic';
      }
    }
  ];
  
  for (const { regex, type, getType } of patterns) {
    let match;
    while ((match = regex.exec(sql)) !== null) {
      const placeholderType = getType(match);
      placeholders.push({
        placeholder: match[0],
        name: match[1],
        type: placeholderType,
        position: match.index
      });
    }
  }
  
  return placeholders;
}

/**
 * Find the best table in schema for querying GUIDs
 * ONLY returns tables that actually exist in the schema
 * @param {Object} schema - Available schema
 * @returns {string|null}
 */
function findBestGuidTable(schema) {
  const tables = schema.tables || [];
  if (tables.length === 0) return null;
  
  // Create a Set for O(1) lookup
  const tablesSet = new Set(tables.map(t => t.toUpperCase()));
  
  log.debug('findBestGuidTable - checking against tables', { 
    tableCount: tables.length,
    sampleTables: tables.slice(0, 10)
  });
  
  // Priority order for finding GUIDs (most likely to have useful data)
  const preferredTables = [
    'COLUMN_ENTITY',       // Usually has lots of data
    'TABLE_ENTITY',
    'VIEW_ENTITY', 
    'DATABASE_ENTITY',
    'SCHEMA_ENTITY',
    'PROCESS_ENTITY',      // Lineage - might not exist
    'ASSET_ENTITY',
    'CONNECTION_ENTITY'
  ];
  
  for (const preferred of preferredTables) {
    if (tablesSet.has(preferred)) {
      log.debug('findBestGuidTable - found preferred table', { table: preferred });
      return preferred;
    }
  }
  
  // Fall back to any _ENTITY table that actually exists
  const entityTable = tables.find(t => t.toUpperCase().endsWith('_ENTITY'));
  if (entityTable) {
    const result = entityTable.toUpperCase();
    log.debug('findBestGuidTable - using fallback entity table', { table: result });
    return result;
  }
  
  // Last resort: use first available table
  if (tables.length > 0) {
    const result = tables[0].toUpperCase();
    log.debug('findBestGuidTable - using first available table', { table: result });
    return result;
  }
  
  return null;
}

/**
 * Build a universal GUID search query across multiple entity tables
 * @param {string} guid - The GUID to search for
 * @param {Object} schema - Available schema
 * @returns {string|null} SQL query to find the GUID
 */
export function buildGuidSearchQuery(guid, schema) {
  const tables = schema.tables || [];
  const tablesSet = new Set(tables.map(t => t.toUpperCase()));
  
  // Common entity tables that have guid column
  const searchTables = [
    'TABLE_ENTITY',
    'VIEW_ENTITY',
    'COLUMN_ENTITY',
    'DATABASE_ENTITY',
    'SCHEMA_ENTITY',
    'CONNECTION_ENTITY',
    'GLOSSARYTERM_ENTITY',
    'ATLASGLOSSARYTERM_ENTITY',
    'PROCESS_ENTITY',
    'DBTMODEL_ENTITY',
    'POWERBIWORKSPACE_ENTITY'
  ].filter(t => tablesSet.has(t));
  
  if (searchTables.length === 0) {
    // Fall back to any _ENTITY tables
    const entityTables = tables.filter(t => t.toUpperCase().endsWith('_ENTITY')).slice(0, 5);
    if (entityTables.length === 0) return null;
    searchTables.push(...entityTables.map(t => t.toUpperCase()));
  }
  
  // Build UNION ALL query
  const unionParts = searchTables.map(table => 
    `SELECT '${table}' as source_table, guid, name, typename FROM ${table} WHERE guid = '${guid}'`
  );
  
  return `-- Search for GUID across multiple entity tables
${unionParts.join('\nUNION ALL\n')}
LIMIT 1;`;
}

/**
 * Generate suggestions for placeholder values
 * @param {Object} placeholder - Detected placeholder
 * @param {Object} schema - Available schema
 * @returns {QuerySuggestion[]}
 */
function suggestPlaceholderValues(placeholder, schema) {
  const suggestions = [];
  const tables = schema.tables || [];
  
  switch (placeholder.type) {
    case 'guid':
      // Find an actual table to suggest for GUID lookup
      const guidTable = findBestGuidTable(schema);
      
      // Double-check this table exists
      const tablesSetCheck = new Set(tables.map(t => t.toUpperCase()));
      const tableExists = guidTable && tablesSetCheck.has(guidTable);
      
      if (tableExists) {
        log.debug('suggestPlaceholderValues - using verified table for GUID lookup', { guidTable });
        
        suggestions.push({
          type: 'info',
          title: `Replace with a real GUID`,
          description: `Replace ${placeholder.placeholder} with an actual asset GUID`,
          fix: null,
          confidence: 1,
          helpText: `To find a GUID:\n1. Search by name in ${guidTable}\n2. Or use the universal GUID search below`,
          isGuidance: true
        });
        
        // Suggest a query to find GUIDs using an actual table
        suggestions.push({
          type: 'rewrite',
          title: `Search by name in ${guidTable}`,
          description: `Find GUIDs by asset name`,
          fix: `-- Find GUIDs by asset name\nSELECT guid, name, typename\nFROM ${guidTable}\nWHERE name ILIKE '%your_search_term%'\nORDER BY name\nLIMIT 10;`,
          confidence: 0.9,
          isHelper: true
        });
        
        // Also suggest a universal GUID search
        const searchTables = tables.filter(t => t.toUpperCase().endsWith('_ENTITY')).slice(0, 5);
        if (searchTables.length > 1) {
          suggestions.push({
            type: 'rewrite',
            title: `Search GUID across all tables`,
            description: `Search multiple entity tables for a specific GUID`,
            fix: `-- Search for a GUID across multiple tables\n-- Replace 'your-guid-here' with the actual GUID\n${searchTables.slice(0, 3).map(t => 
              `SELECT '${t}' as source, guid, name FROM ${t} WHERE guid = 'your-guid-here'`
            ).join('\nUNION ALL\n')}\nLIMIT 1;`,
            confidence: 0.85,
            isHelper: true
          });
        }
      } else {
        // No suitable entity tables found - suggest SHOW TABLES
        log.debug('suggestPlaceholderValues - no suitable GUID table found', { 
          guidTable, 
          tableExists,
          availableTables: tables.slice(0, 5)
        });
        
        suggestions.push({
          type: 'info',
          title: `Find available tables first`,
          description: `Run SHOW TABLES to see what's available in your schema`,
          fix: null,
          confidence: 0.8,
          helpText: `SHOW TABLES;\n\nThen query one of the *_ENTITY tables to find GUIDs.`,
          isGuidance: true
        });
      }
      break;
      
    case 'table':
      if (tables.length > 0) {
        // Show actual tables from their schema
        const entityTables = tables.filter(t => t.toUpperCase().endsWith('_ENTITY')).slice(0, 5);
        const displayTables = entityTables.length > 0 ? entityTables : tables.slice(0, 5);
        
        suggestions.push({
          type: 'info',
          title: 'Available tables',
          description: `${tables.length} tables in your schema`,
          fix: null,
          confidence: 0.8,
          helpText: `Available tables:\n${displayTables.map(t => `• ${t}`).join('\n')}${tables.length > 5 ? `\n... and ${tables.length - 5} more` : ''}`,
          isGuidance: true
        });
      }
      break;
      
    case 'date':
      suggestions.push({
        type: 'syntax',
        title: 'Use current date',
        description: 'Replace with CURRENT_DATE()',
        fix: 'CURRENT_DATE()',
        confidence: 0.7
      });
      break;
  }
  
  return suggestions;
}

/**
 * Suggest fixes for common MDLH lineage query patterns
 * Only suggests tables that actually exist in the schema
 * @param {string} sql - SQL query
 * @param {Object} schema - Available schema
 * @returns {QuerySuggestion[]}
 */
function suggestLineageQueryFixes(sql, schema) {
  const suggestions = [];
  const sqlUpper = sql.toUpperCase();
  const tables = schema.tables || [];
  const tablesUpper = new Set(tables.map(t => t.toUpperCase()));
  
  // Detect lineage query patterns
  const isLineageQuery = sqlUpper.includes('LINEAGE') || 
                         sqlUpper.includes('INPUTS') || 
                         sqlUpper.includes('OUTPUTS') ||
                         sqlUpper.includes('UPSTREAM') ||
                         sqlUpper.includes('DOWNSTREAM');
  
  if (!isLineageQuery) return suggestions;
  
  // Check for PROCESSEXECUTION_ENTITY (common mistake - should be PROCESS_ENTITY)
  if (sqlUpper.includes('PROCESSEXECUTION_ENTITY')) {
    if (tablesUpper.has('PROCESS_ENTITY')) {
      suggestions.push({
        type: 'table',
        title: 'PROCESS_ENTITY',
        description: '⭐ Correct table for lineage • Exists in your schema',
        fix: 'PROCESS_ENTITY',
        confidence: 0.95,
        badge: 'Recommended'
      });
    }
  }
  
  // Suggest COLUMNPROCESS_ENTITY for column-level lineage (only if it exists)
  if (sqlUpper.includes('COLUMN') && sqlUpper.includes('LINEAGE')) {
    if (tablesUpper.has('COLUMNPROCESS_ENTITY')) {
      suggestions.push({
        type: 'table',
        title: 'COLUMNPROCESS_ENTITY',
        description: 'For column-level lineage • Exists in your schema',
        fix: 'COLUMNPROCESS_ENTITY',
        confidence: 0.8
      });
    }
  }
  
  // Build dynamic lineage tips based on what tables actually exist
  const lineageTables = [];
  if (tablesUpper.has('PROCESS_ENTITY')) {
    lineageTables.push('• PROCESS_ENTITY - Table/view level lineage');
  }
  if (tablesUpper.has('COLUMNPROCESS_ENTITY')) {
    lineageTables.push('• COLUMNPROCESS_ENTITY - Column level lineage');
  }
  if (tablesUpper.has('ASSET_ENTITY')) {
    lineageTables.push('• ASSET_ENTITY - Base asset with inputs/outputs');
  }
  // Check for DBT-specific lineage tables
  if (tablesUpper.has('DBTPROCESS_ENTITY')) {
    lineageTables.push('• DBTPROCESS_ENTITY - dbt model lineage');
  }
  if (tablesUpper.has('DBTCOLUMNPROCESS_ENTITY')) {
    lineageTables.push('• DBTCOLUMNPROCESS_ENTITY - dbt column lineage');
  }
  
  if (lineageTables.length > 0) {
    suggestions.push({
      type: 'info',
      title: 'Lineage Tables in Your Schema',
      description: `${lineageTables.length} lineage-related tables available`,
      fix: null,
      confidence: 0.6,
      isGuidance: true,
      helpText: `Available lineage tables:\n${lineageTables.join('\n')}`
    });
  } else {
    // No lineage tables found - suggest checking available tables
    suggestions.push({
      type: 'info',
      title: 'No lineage tables found',
      description: 'Your schema may not have standard lineage tables',
      fix: null,
      confidence: 0.5,
      isGuidance: true,
      helpText: `Run SHOW TABLES to see available tables.\nLineage data may be in different tables in your MDLH setup.`
    });
  }
  
  return suggestions;
}

/**
 * Generate suggestions based on a query error
 * @param {string} sql - The SQL that failed
 * @param {string} error - Error message
 * @param {Object} schema - Available schema info
 * @returns {QuerySuggestion[]}
 */
export function getSuggestionsFromError(sql, error, schema) {
  const suggestions = [];
  const errorUpper = error.toUpperCase();
  
  // Extract the table that caused the error (if any)
  // We'll exclude this from suggestions since it clearly doesn't work
  let failedTable = null;
  const failedTableMatch = error.match(/Object\s+'([^']+)'\s+does not exist/i) ||
                           error.match(/Table\s+'([^']+)'\s+does not exist/i) ||
                           error.match(/'([A-Z_]+_ENTITY)'\s+does not exist/i);
  if (failedTableMatch) {
    failedTable = failedTableMatch[1].toUpperCase();
    log.debug('Table that caused error', { failedTable });
  }
  
  // Create a filtered schema that excludes the failed table
  const filteredSchema = {
    ...schema,
    tables: (schema.tables || []).filter(t => t.toUpperCase() !== failedTable)
  };
  
  // First, check for placeholders that need to be replaced
  const placeholders = detectPlaceholders(sql);
  if (placeholders.length > 0) {
    for (const ph of placeholders) {
      // Use filtered schema so we don't suggest the failed table
      const phSuggestions = suggestPlaceholderValues(ph, filteredSchema);
      suggestions.push(...phSuggestions);
    }
  }
  
  // Check for lineage query patterns and suggest fixes
  const lineageSuggestions = suggestLineageQueryFixes(sql, filteredSchema);
  suggestions.push(...lineageSuggestions);
  
  // Missing table - use the already extracted failedTable
  if (failedTable) {
    // Use filtered schema tables (excluding the failed table)
    const tables = filteredSchema.tables || [];
    
    // Don't add duplicate suggestions from lineage fixes
    const alreadySuggested = suggestions.some(s => s.type === 'table');
    if (!alreadySuggested) {
      const tableSuggestions = suggestTableAlternatives(failedTable, tables, schema.tableInfo);
      suggestions.push(...tableSuggestions);
    }
    
    // Also generate a full rewrite if we have a good match
    const bestTableMatch = suggestions.find(s => s.type === 'table' && s.confidence > 0.6);
    if (bestTableMatch) {
      const rewrite = generateQueryRewrite(sql, { [failedTable]: bestTableMatch.fix });
      if (rewrite) {
        suggestions.push(rewrite);
      }
    }
  }
  
  // Invalid column
  const columnMatch = error.match(/invalid identifier\s+'([^']+)'/i) ||
                      error.match(/column\s+'([^']+)'\s+not found/i);
  
  if (columnMatch) {
    const missingColumn = columnMatch[1].toUpperCase();
    
    // Find which table the column was supposed to be in
    const tableRefs = extractTableReferences(sql);
    for (const ref of tableRefs) {
      const columns = schema.columns?.[ref.table];
      if (columns) {
        const colSuggestions = suggestColumnAlternatives(missingColumn, columns, ref.table);
        suggestions.push(...colSuggestions);
      }
    }
  }
  
  // Syntax errors - common typos
  const syntaxSuggestions = [
    { pattern: /SELEC\s/i, fix: 'SELECT ', title: 'SELECT', reason: 'Fix typo: SELEC → SELECT' },
    { pattern: /FORM\s/i, fix: 'FROM ', title: 'FROM', reason: 'Fix typo: FORM → FROM' },
    { pattern: /WEHERE\s/i, fix: 'WHERE ', title: 'WHERE', reason: 'Fix typo: WEHERE → WHERE' },
    { pattern: /GRUOP\s/i, fix: 'GROUP ', title: 'GROUP', reason: 'Fix typo: GRUOP → GROUP' },
    { pattern: /ODER\s/i, fix: 'ORDER ', title: 'ORDER', reason: 'Fix typo: ODER → ORDER' },
    { pattern: /LIMT\s/i, fix: 'LIMIT ', title: 'LIMIT', reason: 'Fix typo: LIMT → LIMIT' },
  ];
  
  for (const { pattern, fix, title, reason } of syntaxSuggestions) {
    if (pattern.test(sql)) {
      const fixedSql = sql.replace(pattern, fix);
      suggestions.push({
        type: 'syntax',
        title,
        description: reason,
        fix: fixedSql,
        preview: fixedSql,
        confidence: 0.95
      });
    }
  }
  
  // Trailing comma before FROM
  if (errorUpper.includes('UNEXPECTED') && errorUpper.includes(',')) {
    const trailingCommaFix = sql.replace(/,(\s*FROM)/gi, '$1');
    if (trailingCommaFix !== sql) {
      suggestions.push({
        type: 'syntax',
        title: 'Remove trailing comma',
        description: 'Remove comma before FROM clause',
        fix: trailingCommaFix,
        preview: trailingCommaFix,
        confidence: 0.9
      });
    }
  }
  
  // Validate that ALL suggestions reference existing AND working tables
  // Use filteredSchema which excludes the table that just failed
  const tablesSet = new Set((filteredSchema.tables || []).map(t => t.toUpperCase()));
  
  // Helper to extract table names from SQL/text
  const extractTableRefs = (text) => {
    if (!text) return [];
    const matches = text.match(/\b([A-Z_]+_ENTITY)\b/gi) || [];
    return matches.map(m => m.toUpperCase());
  };
  
  const validatedSuggestions = suggestions.filter(s => {
    // For table-type suggestions, verify the table exists AND isn't the failed table
    if (s.type === 'table') {
      const tableName = s.fix?.toUpperCase();
      if (tableName === failedTable) {
        log.debug('Filtering out suggestion for the failed table', { table: s.fix });
        return false;
      }
      if (tableName && tablesSet.has(tableName)) return true;
      log.debug('Filtering out table suggestion for non-existent table', { table: s.fix });
      return false;
    }
    
    // For helper/rewrite suggestions that contain SQL, validate table references
    if (s.isHelper || s.type === 'rewrite') {
      const referencedTables = extractTableRefs(s.fix);
      for (const table of referencedTables) {
        // Skip if it references the failed table or a non-existent table
        if (table === failedTable || !tablesSet.has(table)) {
          log.debug('Filtering out suggestion with problematic table in SQL', { 
            type: s.type, 
            title: s.title,
            problematicTable: table,
            isFailedTable: table === failedTable
          });
          return false;
        }
      }
    }
    
    // For guidance with helpText, validate and fix references
    if (s.isGuidance && s.helpText) {
      const referencedTables = extractTableRefs(s.helpText);
      for (const table of referencedTables) {
        if (table === failedTable || !tablesSet.has(table)) {
          log.debug('Guidance references problematic table, finding replacement', { 
            title: s.title,
            problematicTable: table
          });
          // Update the helpText to use an actual working table
          const actualTable = findBestGuidTable(filteredSchema);
          if (actualTable && actualTable !== failedTable) {
            s.helpText = s.helpText.replace(new RegExp(table, 'gi'), actualTable);
          } else {
            // Can't find a good replacement, suggest SHOW TABLES instead
            s.helpText = `Run SHOW TABLES; to see available tables.`;
          }
        }
      }
    }
    
    return true;
  });
  
  // Sort suggestions: actionable fixes first, then guidance
  validatedSuggestions.sort((a, b) => {
    // Guidance/info items go last
    if (a.isGuidance && !b.isGuidance) return 1;
    if (b.isGuidance && !a.isGuidance) return -1;
    // High confidence first
    return (b.confidence || 0) - (a.confidence || 0);
  });
  
  log.debug('Generated suggestions from error', { 
    errorPreview: error.substring(0, 100),
    suggestionCount: validatedSuggestions.length,
    filteredCount: suggestions.length - validatedSuggestions.length,
    hasPlaceholders: placeholders.length > 0
  });
  
  return validatedSuggestions;
}

// =============================================================================
// Schema Cache
// =============================================================================

/**
 * @typedef {Object} SchemaCache
 * @property {string[]} tables - List of table names
 * @property {Object<string, string[]>} columns - Map of table -> columns
 * @property {Object<string, {rowCount: number}>} tableInfo - Table metadata
 */

/**
 * Build schema cache from metadata
 * @param {Array} tables - Tables from metadata API
 * @param {Object<string, Array>} columnsMap - Map of table -> columns
 * @returns {SchemaCache}
 */
export function buildSchemaCache(tables, columnsMap = {}) {
  const schema = {
    tables: [],
    columns: {},
    tableInfo: {}
  };
  
  for (const table of tables) {
    const name = typeof table === 'string' ? table : table.name;
    const upperName = name.toUpperCase();
    
    schema.tables.push(upperName);
    
    if (typeof table === 'object') {
      schema.tableInfo[upperName] = {
        rowCount: table.row_count || table.rowCount || 0
      };
    }
  }
  
  for (const [tableName, columns] of Object.entries(columnsMap)) {
    schema.columns[tableName.toUpperCase()] = columns.map(c => 
      typeof c === 'string' ? c.toUpperCase() : c.name?.toUpperCase()
    ).filter(Boolean);
  }
  
  log.info('Built schema cache', { 
    tableCount: schema.tables.length,
    tablesWithColumns: Object.keys(schema.columns).length
  });
  
  return schema;
}

export default {
  // Fuzzy matching
  levenshteinDistance,
  similarityScore,
  findSimilar,
  
  // SQL parsing
  extractTableReferences,
  extractColumnReferences,
  detectPlaceholders,
  
  // Suggestion generation
  suggestTableAlternatives,
  suggestColumnAlternatives,
  generateQueryRewrite,
  getProactiveSuggestions,
  getSuggestionsFromError,
  
  // Schema cache
  buildSchemaCache
};


```

## src/utils/tableDiscovery.js

```javascript
/**
 * Table Discovery Utilities
 * 
 * Functions for discovering which MDLH entity tables exist in a Snowflake database,
 * finding alternative table names, and fixing queries to use available tables.
 */

import { LRUCache } from './LRUCache';
import { createLogger } from './logger';

const log = createLogger('tableDiscovery');

// API base URL for fetching metadata
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Cache for discovered tables (LRU with 5-minute TTL)
const tableCache = new LRUCache(10, 5 * 60 * 1000);

// Cache for column metadata
const columnCache = new LRUCache(100, 10 * 60 * 1000);

/**
 * Get session ID from sessionStorage
 * @returns {string|null}
 */
function getSessionId() {
  const stored = sessionStorage.getItem('snowflake_session');
  log.debug('getSessionId() - raw storage', { exists: !!stored });
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      const sessionId = parsed.sessionId;
      log.debug('getSessionId() - parsed', {
        hasSessionId: !!sessionId,
        sessionIdPrefix: sessionId?.substring(0, 8),
        age: parsed.timestamp ? `${Math.round((Date.now() - parsed.timestamp) / 1000)}s` : 'unknown'
      });
      return sessionId;
    } catch (e) {
      log.error('getSessionId() - parse error', { error: e.message });
      return null;
    }
  }
  return null;
}

/**
 * Discover which MDLH entity tables exist in the connected database
 * @param {string} database - Database name
 * @param {string} schema - Schema name
 * @returns {Promise<Set<string>>} Set of table names (uppercase)
 */
export async function discoverMDLHTables(database, schema) {
  const cacheKey = `${database}.${schema}`;
  
  // Return cached if available
  const cached = tableCache.get(cacheKey);
  if (cached && cached.size > 0) {
    return cached;
  }
  
  try {
    const sessionId = getSessionId();
    
    if (!sessionId) {
      log.warn('discoverMDLHTables() - no session, cannot discover tables');
      return new Set();
    }
    
    // Force refresh if previous attempt returned empty
    const forceRefresh = !cached || cached.size === 0;
    
    // Fetch all tables in the schema
    const response = await fetch(
      `${API_BASE_URL}/api/metadata/tables?database=${database}&schema=${schema}&refresh=${forceRefresh}`,
      { headers: { 'X-Session-ID': sessionId } }
    );
    
    if (response.ok) {
      const tables = await response.json();
      const tableNames = new Set(tables.map(t => t.name?.toUpperCase() || t.toUpperCase()));
      
      // Update cache
      tableCache.set(cacheKey, tableNames);
      
      log.info('Discovered tables', { count: tableNames.size, database, schema });
      return tableNames;
    }
  } catch (err) {
    log.error('Failed to discover tables', { error: err.message });
  }
  
  return new Set();
}

/**
 * Find alternative table name if expected one doesn't exist
 * @param {string} expectedTable - Expected table name
 * @param {Set<string>} discoveredTables - Set of discovered table names
 * @returns {string|null} Alternative table name or null
 */
export function findAlternativeTable(expectedTable, discoveredTables) {
  if (!expectedTable || discoveredTables.size === 0) return null;
  
  const expected = expectedTable.toUpperCase();
  
  // If exact match exists, return it
  if (discoveredTables.has(expected)) return expected;
  
  // Try common variations
  const variations = [
    expected,
    expected.replace('_ENTITY', ''),  // TABLE_ENTITY -> TABLE
    expected + '_ENTITY',              // TABLE -> TABLE_ENTITY
    expected.replace('ATLAS', ''),     // ATLASGLOSSARY -> GLOSSARY
    'ATLAS' + expected,                // GLOSSARY -> ATLASGLOSSARY
  ];
  
  for (const variation of variations) {
    if (discoveredTables.has(variation)) return variation;
  }
  
  // Try fuzzy match - find tables containing the key part
  const keyPart = expected.replace('_ENTITY', '').replace('ATLAS', '');
  for (const table of discoveredTables) {
    if (table.includes(keyPart) && table.endsWith('_ENTITY')) {
      return table;
    }
  }
  
  return null;
}

/**
 * Fix a query to use available tables
 * @param {string} sql - SQL query
 * @param {Set<string>} discoveredTables - Set of discovered tables
 * @param {string} database - Database name
 * @param {string} schema - Schema name
 * @returns {{sql: string, fixed: boolean, changes: Array}} Fixed query info
 */
export function fixQueryForAvailableTables(sql, discoveredTables, database, schema) {
  if (!sql || discoveredTables.size === 0) return { sql, fixed: false, changes: [] };
  
  const changes = [];
  let fixedSql = sql;
  
  // Find all table references in the query (FROM/JOIN clauses)
  const tablePattern = /(?:FROM|JOIN)\s+(?:[\w.]+\.)?(\w+_ENTITY)/gi;
  let match;
  
  while ((match = tablePattern.exec(sql)) !== null) {
    const originalTable = match[1].toUpperCase();
    
    if (!discoveredTables.has(originalTable)) {
      const alternative = findAlternativeTable(originalTable, discoveredTables);
      
      if (alternative && alternative !== originalTable) {
        // Replace the table name in the query
        const fullRef = `${database}.${schema}.${alternative}`;
        fixedSql = fixedSql.replace(
          new RegExp(`(FROM|JOIN)\\s+(?:[\\w.]+\\.)?${match[1]}`, 'gi'),
          `$1 ${fullRef}`
        );
        changes.push({ from: originalTable, to: alternative });
      }
    }
  }
  
  return {
    sql: fixedSql,
    fixed: changes.length > 0,
    changes
  };
}

/**
 * Check if a table exists in the discovered tables
 * @param {string} tableName - Table name to check
 * @param {Set<string>} discoveredTables - Set of discovered tables
 * @returns {boolean}
 */
export function tableExists(tableName, discoveredTables) {
  if (!tableName || tableName === '(abstract)') return false;
  return discoveredTables.has(tableName.toUpperCase());
}

/**
 * Extract table name from a SQL query
 * @param {string} sql - SQL query
 * @returns {string|null} Table name or null
 */
export function extractTableFromQuery(sql) {
  if (!sql) return null;
  const match = sql.match(/FROM\s+(?:[\w.]+\.)?(\w+_ENTITY)/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Get all entity tables referenced in a category's queries and data
 * @param {Array} dataForCategory - Entity data
 * @param {Array} queriesForCategory - Query examples
 * @returns {Set<string>}
 */
export function getEntityTablesForCategory(dataForCategory, queriesForCategory) {
  const tables = new Set();
  
  // From entity data
  if (dataForCategory) {
    dataForCategory.forEach(row => {
      if (row.table && row.table !== '(abstract)') {
        tables.add(row.table.toUpperCase());
      }
    });
  }
  
  // From queries
  if (queriesForCategory) {
    queriesForCategory.forEach(q => {
      const match = q.query?.match(/FROM\s+(?:[\w.]+\.)?(\w+_ENTITY)/i);
      if (match) tables.add(match[1].toUpperCase());
    });
  }
  
  return tables;
}

/**
 * Validate a query by running it with LIMIT 0 (fast check)
 * @param {string} sql - SQL query
 * @param {string} database - Database name
 * @param {string} schema - Schema name
 * @returns {Promise<{valid: boolean, error?: string, columns?: Array}>}
 */
export async function validateQuery(sql, database, schema) {
  try {
    const sessionId = getSessionId();
    
    if (!sessionId) return { valid: false, error: 'Not connected' };
    
    // Modify query to add LIMIT 0 for fast validation (no data transfer)
    let testSql = sql.trim();
    // Remove existing LIMIT clause and add LIMIT 0
    testSql = testSql.replace(/LIMIT\s+\d+\s*;?\s*$/i, '');
    testSql = testSql.replace(/;?\s*$/, '') + ' LIMIT 0;';
    
    const response = await fetch(`${API_BASE_URL}/api/query/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': sessionId,
      },
      body: JSON.stringify({
        sql: testSql,
        database,
        schema,
        timeout: 10,
      }),
    });
    
    const result = await response.json();
    
    if (result.status === 'COMPLETED' || result.status === 'completed') {
      return { valid: true, columns: result.columns };
    } else {
      return { valid: false, error: result.error_message || result.error || 'Query failed' };
    }
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

/**
 * Fetch columns for a table from the backend
 * @param {string} database - Database name
 * @param {string} schema - Schema name
 * @param {string} table - Table name
 * @returns {Promise<Array>} Column definitions
 */
export async function fetchTableColumns(database, schema, table) {
  const cacheKey = `${database}.${schema}.${table}`;
  
  // Return cached columns if available
  const cached = columnCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  
  try {
    const sessionId = getSessionId();
    
    if (!sessionId) {
      log.warn('fetchTableColumns() - no session, cannot fetch columns');
      return [];
    }
    
    const response = await fetch(
      `${API_BASE_URL}/api/metadata/columns?database=${database}&schema=${schema}&table=${table}`,
      { headers: { 'X-Session-ID': sessionId } }
    );
    
    if (response.ok) {
      const columns = await response.json();
      columnCache.set(cacheKey, columns);
      return columns;
    }
  } catch (err) {
    log.error('Failed to fetch columns', { table, error: err.message });
  }
  
  return [];
}

/**
 * Clear all discovery caches
 */
export function clearDiscoveryCache() {
  tableCache.clear();
  columnCache.clear();
}

export default {
  discoverMDLHTables,
  findAlternativeTable,
  fixQueryForAvailableTables,
  tableExists,
  extractTableFromQuery,
  getEntityTablesForCategory,
  validateQuery,
  fetchTableColumns,
  clearDiscoveryCache,
};


```



# DATA


## src/data/constants.js

```javascript
/**
 * Shared Constants for MDLH Dictionary
 * 
 * Contains tab definitions, database configurations, and column mappings.
 */

import { 
  Table, 
  BookOpen, 
  Boxes, 
  Database, 
  FolderTree, 
  BarChart3, 
  GitBranch, 
  Cloud, 
  Workflow, 
  Shield, 
  Bot, 
  Terminal 
} from 'lucide-react';

/**
 * Tab definitions for the main navigation
 * Each tab includes a description for tooltips and context
 */
export const tabs = [
  { id: 'core', label: 'Core', icon: Table, description: 'Shared enterprise entities like Connection, Process, and Link' },
  { id: 'glossary', label: 'Glossary', icon: BookOpen, description: 'Business glossary terms, categories, and anchors' },
  { id: 'datamesh', label: 'Data Mesh', icon: Boxes, description: 'Data domains, products, and contracts' },
  { id: 'relational', label: 'Relational DB', icon: Database, description: 'Databases, schemas, tables, views, and columns' },
  { id: 'queries', label: 'Query Org', icon: FolderTree, description: 'Saved queries, collections, and folders' },
  { id: 'bi', label: 'BI Tools', icon: BarChart3, description: 'Tableau, PowerBI, Looker, Sigma, and more' },
  { id: 'dbt', label: 'dbt', icon: GitBranch, description: 'dbt models, sources, tests, and metrics' },
  { id: 'storage', label: 'Object Storage', icon: Cloud, description: 'S3, GCS, ADLS buckets and objects' },
  { id: 'orchestration', label: 'Orchestration', icon: Workflow, description: 'Airflow, Fivetran, Matillion pipelines' },
  { id: 'governance', label: 'Governance', icon: Shield, description: 'Tags, personas, purposes, and policies' },
  { id: 'ai', label: 'AI/ML', icon: Bot, description: 'AI models, applications, and ML entities' },
  { id: 'editor', label: 'Query Editor', icon: Terminal, isEditor: true, description: 'Write and execute SQL queries' },
];

/**
 * Default MDLH databases users can query
 * Note: Not all databases have the same tables - users should verify access
 */
export const MDLH_DATABASES = [
  { name: 'FIELD_METADATA', label: 'Field Metadata (atlan.atlan.com)', schema: 'PUBLIC' },
  { name: 'ATLAN_MDLH', label: 'Atlan MDLH', schema: 'PUBLIC' },
  { name: 'MDLH_GOVERNANCE', label: 'MDLH Governance', schema: 'PUBLIC', warning: 'May have different tables' },
  { name: 'MDLH_ATLAN_HOME', label: 'MDLH Atlan Home', schema: 'PUBLIC', warning: 'May have different tables' },
];

/**
 * Schema options for the selected database
 */
export const MDLH_SCHEMAS = ['PUBLIC', 'INFORMATION_SCHEMA'];

/**
 * Column definitions for each entity category tab
 */
export const columns = {
  core: ['entity', 'table', 'description', 'keyAttributes', 'relationships', 'notes'],
  glossary: ['entity', 'table', 'description', 'keyAttributes', 'relationships', 'qualifiedNamePattern', 'exampleQuery'],
  datamesh: ['entity', 'table', 'description', 'keyAttributes', 'relationships', 'qualifiedNamePattern', 'exampleQuery'],
  relational: ['entity', 'table', 'description', 'keyAttributes', 'relationships', 'qualifiedNamePattern', 'hierarchy'],
  queries: ['entity', 'table', 'description', 'keyAttributes', 'relationships', 'hierarchy', 'notes'],
  bi: ['entity', 'table', 'description', 'keyAttributes', 'relationships', 'connector', 'hierarchy'],
  dbt: ['entity', 'table', 'description', 'keyAttributes', 'relationships', 'qualifiedNamePattern', 'notes'],
  storage: ['entity', 'table', 'description', 'keyAttributes', 'relationships', 'connector', 'hierarchy'],
  orchestration: ['entity', 'table', 'description', 'keyAttributes', 'relationships', 'connector', 'hierarchy'],
  governance: ['entity', 'table', 'description', 'keyAttributes', 'relationships', 'notes'],
  ai: ['entity', 'table', 'description', 'keyAttributes', 'relationships', 'notes'],
};

/**
 * Human-readable column headers
 */
export const colHeaders = {
  entity: 'Entity Type',
  table: 'MDLH Table',
  description: 'Description',
  keyAttributes: 'Key Attributes',
  relationships: 'Relationships',
  qualifiedNamePattern: 'qualifiedName Pattern',
  hierarchy: 'Hierarchy',
  connector: 'Connector',
  notes: 'Notes',
  exampleQuery: 'Example Query',
};

/**
 * Inline select dropdown styles (for consistent appearance)
 */
export const selectDropdownStyles = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 8px center',
  backgroundSize: '16px',
  paddingRight: '32px'
};

/**
 * Default values for session/state
 */
export const DEFAULT_DATABASE = 'FIELD_METADATA';
export const DEFAULT_SCHEMA = 'PUBLIC';

/**
 * Timeout configuration (centralized to avoid magic numbers)
 * All values in milliseconds unless otherwise noted
 */
export const TIMEOUTS = {
  SESSION_STATUS_MS: 5000,       // Health check for session validity
  METADATA_DB_MS: 15000,         // Fetch databases
  METADATA_SCHEMAS_MS: 15000,    // Fetch schemas
  METADATA_TABLES_MS: 20000,     // Fetch tables
  QUERY_EXECUTE_BUFFER_MS: 5000, // Extra padding on top of Snowflake timeout
  QUERY_RESULTS_MS: 30000,       // Fetch query results
  QUERY_HISTORY_MS: 10000,       // Fetch query history
  DEBOUNCE_MS: 5000,             // Minimum time between repeated metadata calls
};

/**
 * Connection behavior thresholds
 */
export const CONNECTION_CONFIG = {
  TIMEOUT_THRESHOLD: 3,          // Consecutive timeouts before marking unreachable
};


```

## src/data/entities.js

```javascript
/**
 * MDLH Entity Definitions
 * 
 * Contains the data model for all entity types organized by category.
 * Each entity includes table name, description, key attributes, and relationships.
 */

export const entities = {
  core: [
    { entity: 'Referenceable', table: '(abstract)', description: 'Root of all entity types', keyAttributes: 'guid, qualifiedName', relationships: 'Base for all', notes: 'Not directly queryable' },
    { entity: 'Asset', table: '(abstract)', description: 'Base class for all assets', keyAttributes: 'name, description, ownerUsers, ownerGroups, certificateStatus, announcementType, createTime, updateTime, createdBy, updatedBy', relationships: 'Extends Referenceable', notes: 'Not directly queryable' },
    { entity: 'Catalog', table: '(abstract)', description: 'Base for technical/data assets', keyAttributes: 'connectionQualifiedName, connectorType', relationships: 'Extends Asset', notes: 'Parent for SQL, BI, dbt, etc.' },
    { entity: 'Connection', table: 'CONNECTION_ENTITY', description: 'Configured connection to data source', keyAttributes: 'connectorName, category, host, port, adminRoles, adminGroups, adminUsers', relationships: 'Contains databases, schemas', notes: 'Root of connector hierarchy' },
    { entity: 'Process', table: 'PROCESS_ENTITY', description: 'Transformation/lineage process', keyAttributes: 'inputs, outputs, sql, code, columnProcesses', relationships: 'Links assets in lineage', notes: 'Table-level lineage' },
    { entity: 'ColumnProcess', table: 'COLUMNPROCESS_ENTITY', description: 'Column-level lineage process', keyAttributes: 'inputs, outputs', relationships: 'Links columns in lineage', notes: 'Column-level lineage' },
    { entity: 'BIProcess', table: 'BIPROCESS_ENTITY', description: 'BI-specific transformation', keyAttributes: 'inputs, outputs', relationships: 'BI tool lineage', notes: 'Extends Process' },
    { entity: 'SparkJob', table: 'SPARKJOB_ENTITY', description: 'Apache Spark job', keyAttributes: 'sparkRunVersion, sparkRunOpenLineageState', relationships: 'Spark lineage', notes: 'OpenLineage integration' },
  ],
  glossary: [
    { entity: 'AtlasGlossary', table: 'ATLASGLOSSARY_ENTITY', description: 'Business glossary container', keyAttributes: 'name, shortDescription, longDescription, language, usage', relationships: 'Contains terms & categories', qualifiedNamePattern: 'Generated hash', exampleQuery: "SELECT GUID, NAME FROM ATLASGLOSSARY_ENTITY" },
    { entity: 'AtlasGlossaryTerm', table: 'ATLASGLOSSARYTERM_ENTITY', description: 'Business term with definition', keyAttributes: 'name, shortDescription, longDescription, examples, usage, abbreviation, anchor', relationships: 'anchor (glossary), categories, assignedEntities, seeAlso, synonyms, antonyms', qualifiedNamePattern: 'Generated hash', exampleQuery: "SELECT NAME, USERDESCRIPTION FROM ATLASGLOSSARYTERM_ENTITY WHERE CERTIFICATESTATUS='VERIFIED'" },
    { entity: 'AtlasGlossaryCategory', table: 'ATLASGLOSSARYCATEGORY_ENTITY', description: 'Hierarchical grouping of terms', keyAttributes: 'name, shortDescription, longDescription, anchor', relationships: 'anchor (glossary), parentCategory, childrenCategories, terms', qualifiedNamePattern: 'Generated hash', exampleQuery: "SELECT NAME, PARENTCATEGORY FROM ATLASGLOSSARYCATEGORY_ENTITY" },
  ],
  datamesh: [
    { entity: 'DataDomain', table: 'DATADOMAIN_ENTITY', description: 'Business domain grouping', keyAttributes: 'name, description, parentDomainQualifiedName, superDomainQualifiedName', relationships: 'dataProducts, parentDomain, subDomains', qualifiedNamePattern: 'default/domain/<lowerCamelCaseName>', exampleQuery: "SELECT NAME, USERDESCRIPTION FROM DATADOMAIN_ENTITY" },
    { entity: 'DataProduct', table: 'DATAPRODUCT_ENTITY', description: 'Self-contained data product', keyAttributes: 'name, description, dataProductStatus, dataProductCriticality, dataProductSensitivity, dataProductVisibility, dataProductAssetsDSL, dataProductScore', relationships: 'dataDomain, inputPorts, outputPorts, dataContractLatest', qualifiedNamePattern: '<parentDomainQN>/product/<name>', exampleQuery: "SELECT NAME, DATAPRODUCTSTATUS FROM DATAPRODUCT_ENTITY WHERE DATAPRODUCTSTATUS='Active'" },
    { entity: 'DataContract', table: 'DATACONTRACT_ENTITY', description: 'Formal data specification', keyAttributes: 'dataContractSpec, dataContractVersion, certificateStatus, dataContractAssetGuid', relationships: 'dataContractAsset, dataContractNextVersion', qualifiedNamePattern: 'Generated', exampleQuery: "SELECT DATACONTRACTVERSION, CERTIFICATESTATUS FROM DATACONTRACT_ENTITY" },
  ],
  relational: [
    { entity: 'Database', table: 'DATABASE_ENTITY', description: 'Database container', keyAttributes: 'name, schemaCount, connectionQualifiedName', relationships: 'schemas, connection', qualifiedNamePattern: 'default/<connector>/<epoch>/<db_name>', hierarchy: 'Connection → Database' },
    { entity: 'Schema', table: 'SCHEMA_ENTITY', description: 'Namespace within database', keyAttributes: 'name, tableCount, viewCount, databaseQualifiedName', relationships: 'tables, views, database', qualifiedNamePattern: '.../<db_name>/<schema_name>', hierarchy: 'Database → Schema' },
    { entity: 'Table', table: 'TABLE_ENTITY', description: 'Database table', keyAttributes: 'name, rowCount, columnCount, sizeBytes, partitionStrategy, schemaQualifiedName', relationships: 'columns, partitions, queries, schema', qualifiedNamePattern: '.../<schema>/<table_name>', hierarchy: 'Schema → Table' },
    { entity: 'View', table: 'VIEW_ENTITY', description: 'Database view', keyAttributes: 'name, columnCount, definition, schemaQualifiedName', relationships: 'columns, queries, schema', qualifiedNamePattern: '.../<schema>/<view_name>', hierarchy: 'Schema → View' },
    { entity: 'MaterialisedView', table: 'MATERIALISEDVIEW_ENTITY', description: 'Materialized/cached view', keyAttributes: 'name, definition, refreshMode, staleness', relationships: 'columns, schema', qualifiedNamePattern: '.../<schema>/<mv_name>', hierarchy: 'Schema → MaterialisedView' },
    { entity: 'Column', table: 'COLUMN_ENTITY', description: 'Table/view column', keyAttributes: 'name, dataType, maxLength, precision, scale, isPrimaryKey, isForeignKey, isNullable, isPartition, order', relationships: 'table/view, foreignKeyTo', qualifiedNamePattern: '.../<table>/<column_name>', hierarchy: 'Table/View → Column' },
    { entity: 'TablePartition', table: 'TABLEPARTITION_ENTITY', description: 'Partition of partitioned table', keyAttributes: 'name, partitionList, partitionStrategy', relationships: 'columns, parentTable', qualifiedNamePattern: '.../<table>/<partition>', hierarchy: 'Table → Partition' },
    { entity: 'Procedure', table: 'PROCEDURE_ENTITY', description: 'Stored procedure', keyAttributes: 'name, definition, schemaQualifiedName', relationships: 'schema', qualifiedNamePattern: '.../<schema>/<proc_name>', hierarchy: 'Schema → Procedure' },
    { entity: 'Function', table: 'FUNCTION_ENTITY', description: 'User-defined function', keyAttributes: 'name, definition, schemaQualifiedName', relationships: 'schema', qualifiedNamePattern: '.../<schema>/<func_name>', hierarchy: 'Schema → Function' },
    { entity: 'SnowflakeDynamicTable', table: 'SNOWFLAKEDYNAMICTABLE_ENTITY', description: 'Snowflake dynamic table', keyAttributes: 'name, definition, refreshMode', relationships: 'columns, schema', qualifiedNamePattern: 'Snowflake-specific', hierarchy: 'Schema → DynamicTable' },
    { entity: 'SnowflakePipe', table: 'SNOWFLAKEPIPE_ENTITY', description: 'Snowpipe ingestion', keyAttributes: 'name, definition, snowflakePipeNotificationChannelName', relationships: 'schema', qualifiedNamePattern: 'Snowflake-specific', hierarchy: 'Schema → Pipe' },
    { entity: 'SnowflakeStream', table: 'SNOWFLAKESTREAM_ENTITY', description: 'CDC stream', keyAttributes: 'name, snowflakeStreamType, snowflakeStreamSourceType', relationships: 'schema', qualifiedNamePattern: 'Snowflake-specific', hierarchy: 'Schema → Stream' },
    { entity: 'SnowflakeTag', table: 'SNOWFLAKETAG_ENTITY', description: 'Native Snowflake tag', keyAttributes: 'name, tagAllowedValues', relationships: 'schema, taggedAssets', qualifiedNamePattern: 'Snowflake-specific', hierarchy: 'Schema → Tag' },
  ],
  queries: [
    { entity: 'Namespace', table: '(abstract)', description: 'Base for organizational containers', keyAttributes: 'name, childrenQueries, childrenFolders', relationships: 'Base for Collection/Folder', hierarchy: 'Abstract parent', notes: 'Not directly queryable' },
    { entity: 'Collection', table: 'COLLECTION_ENTITY', description: 'Top-level query collection', keyAttributes: 'name, description, icon, iconType, adminUsers, adminGroups, viewerUsers, viewerGroups', relationships: 'childrenFolders, childrenQueries', hierarchy: 'Root container', notes: 'Atlan Insights collections' },
    { entity: 'Folder', table: 'FOLDER_ENTITY', description: 'Query folder within collection', keyAttributes: 'name, parentQualifiedName, collectionQualifiedName', relationships: 'parentFolder, childrenFolders, childrenQueries', hierarchy: 'Collection → Folder', notes: 'Can nest folders' },
    { entity: 'Query', table: 'QUERY_ENTITY', description: 'Saved SQL query', keyAttributes: 'name, rawQuery, defaultSchemaQualifiedName, defaultDatabaseQualifiedName, variablesSchemaBase64, isVisualQuery', relationships: 'parentFolder/collection, visualBuilderSchemaBase64', hierarchy: 'Folder/Collection → Query', notes: 'Saved queries in Insights' },
  ],
  bi: [
    { entity: 'TableauSite', table: 'TABLEAUSITE_ENTITY', description: 'Tableau site', keyAttributes: 'name, siteQualifiedName', relationships: 'projects', connector: 'Tableau', hierarchy: 'Root' },
    { entity: 'TableauProject', table: 'TABLEAUPROJECT_ENTITY', description: 'Tableau project', keyAttributes: 'name, isTopLevelProject', relationships: 'site, workbooks, datasources', connector: 'Tableau', hierarchy: 'Site → Project' },
    { entity: 'TableauWorkbook', table: 'TABLEAUWORKBOOK_ENTITY', description: 'Tableau workbook', keyAttributes: 'name, projectQualifiedName', relationships: 'project, dashboards, worksheets', connector: 'Tableau', hierarchy: 'Project → Workbook' },
    { entity: 'TableauDashboard', table: 'TABLEAUDASHBOARD_ENTITY', description: 'Tableau dashboard', keyAttributes: 'name, workbookQualifiedName', relationships: 'workbook, worksheets', connector: 'Tableau', hierarchy: 'Workbook → Dashboard' },
    { entity: 'TableauDatasource', table: 'TABLEAUDATASOURCE_ENTITY', description: 'Tableau data source', keyAttributes: 'name, hasExtracts', relationships: 'project, fields, upstreamTables', connector: 'Tableau', hierarchy: 'Project → Datasource' },
    { entity: 'TableauCalculatedField', table: 'TABLEAUCALCULATEDFIELD_ENTITY', description: 'Tableau calculated field', keyAttributes: 'name, formula, workbookQualifiedName', relationships: 'workbook, datasource', connector: 'Tableau', hierarchy: 'Workbook → CalculatedField' },
    { entity: 'PowerBIWorkspace', table: 'POWERBIWORKSPACE_ENTITY', description: 'Power BI workspace', keyAttributes: 'name, webUrl', relationships: 'reports, dashboards, datasets', connector: 'Power BI', hierarchy: 'Root' },
    { entity: 'PowerBIReport', table: 'POWERBIREPORT_ENTITY', description: 'Power BI report', keyAttributes: 'name, webUrl, workspaceQualifiedName', relationships: 'workspace, pages, dataset', connector: 'Power BI', hierarchy: 'Workspace → Report' },
    { entity: 'PowerBIDataset', table: 'POWERBIDATASET_ENTITY', description: 'Power BI dataset', keyAttributes: 'name, workspaceQualifiedName', relationships: 'workspace, tables, measures', connector: 'Power BI', hierarchy: 'Workspace → Dataset' },
    { entity: 'PowerBIMeasure', table: 'POWERBIMEASURE_ENTITY', description: 'Power BI measure', keyAttributes: 'name, powerBIMeasureExpression, table', relationships: 'dataset, table', connector: 'Power BI', hierarchy: 'Dataset → Measure' },
    { entity: 'LookerProject', table: 'LOOKERPROJECT_ENTITY', description: 'Looker project', keyAttributes: 'name', relationships: 'models, explores', connector: 'Looker', hierarchy: 'Root' },
    { entity: 'LookerModel', table: 'LOOKERMODEL_ENTITY', description: 'Looker model', keyAttributes: 'name, projectName', relationships: 'project, explores, views', connector: 'Looker', hierarchy: 'Project → Model' },
    { entity: 'LookerExplore', table: 'LOOKEREXPLORE_ENTITY', description: 'Looker explore', keyAttributes: 'name, modelName, connectionName', relationships: 'model, fields', connector: 'Looker', hierarchy: 'Model → Explore' },
    { entity: 'LookerDashboard', table: 'LOOKERDASHBOARD_ENTITY', description: 'Looker dashboard', keyAttributes: 'name, folderName', relationships: 'folder, tiles', connector: 'Looker', hierarchy: 'Folder → Dashboard' },
    { entity: 'MetabaseDashboard', table: 'METABASEDASHBOARD_ENTITY', description: 'Metabase dashboard', keyAttributes: 'name, collectionQualifiedName', relationships: 'collection, questions', connector: 'Metabase', hierarchy: 'Collection → Dashboard' },
    { entity: 'MetabaseQuestion', table: 'METABASEQUESTION_ENTITY', description: 'Metabase question/chart', keyAttributes: 'name, queryType', relationships: 'collection, dashboards', connector: 'Metabase', hierarchy: 'Collection → Question' },
    { entity: 'SigmaDataElement', table: 'SIGMADATAELEMENT_ENTITY', description: 'Sigma data element', keyAttributes: 'name, guid', relationships: 'workbook, dataset', connector: 'Sigma', hierarchy: 'Workbook → DataElement' },
  ],
  dbt: [
    { entity: 'DbtModel', table: 'DBTMODEL_ENTITY', description: 'dbt model (transformation)', keyAttributes: 'name, dbtAlias, dbtMaterialization, dbtModelSqlAssets, dbtCompiledSQL, dbtRawSQL', relationships: 'columns, sources, tests, metrics', qualifiedNamePattern: 'dbt-specific', notes: 'Links to SQL table/view' },
    { entity: 'DbtModelColumn', table: 'DBTMODELCOLUMN_ENTITY', description: 'Column in dbt model', keyAttributes: 'name, dbtModelQualifiedName, dataType', relationships: 'dbtModel, sqlColumn', qualifiedNamePattern: 'dbt-specific', notes: 'Links to SQL column' },
    { entity: 'DbtSource', table: 'DBTSOURCE_ENTITY', description: 'dbt source definition', keyAttributes: 'name, dbtSourceFreshnessCriteria', relationships: 'sqlAsset, dbtTests', qualifiedNamePattern: 'dbt-specific', notes: 'References source table' },
    { entity: 'DbtTest', table: 'DBTTEST_ENTITY', description: 'dbt test (schema/data)', keyAttributes: 'name, dbtTestState, dbtTestStatus, dbtTestCompiledSQL', relationships: 'dbtModel, dbtSource', qualifiedNamePattern: 'dbt-specific', notes: 'Test results' },
    { entity: 'DbtMetric', table: 'DBTMETRIC_ENTITY', description: 'dbt metric (semantic layer)', keyAttributes: 'name, dbtMetricType, dbtMetricFilters', relationships: 'dbtModel, columns', qualifiedNamePattern: 'dbt-specific', notes: 'Semantic layer metric' },
    { entity: 'DbtTag', table: 'DBTTAG_ENTITY', description: 'dbt meta tag', keyAttributes: 'name, dbtTagValue', relationships: 'taggedAssets', qualifiedNamePattern: 'dbt-specific', notes: 'Tags from dbt meta' },
    { entity: 'DbtProcess', table: 'DBTPROCESS_ENTITY', description: 'dbt lineage process', keyAttributes: 'inputs, outputs, dbtProcessJobStatus', relationships: 'dbtModel inputs/outputs', qualifiedNamePattern: 'dbt-specific', notes: 'Model-level lineage' },
    { entity: 'DbtColumnProcess', table: 'DBTCOLUMNPROCESS_ENTITY', description: 'dbt column lineage', keyAttributes: 'inputs, outputs', relationships: 'column inputs/outputs', qualifiedNamePattern: 'dbt-specific', notes: 'Column-level lineage' },
  ],
  storage: [
    { entity: 'S3Bucket', table: 'S3BUCKET_ENTITY', description: 'AWS S3 bucket', keyAttributes: 'name, s3BucketArn, awsRegion, s3ObjectCount', relationships: 's3Objects, connection', connector: 'AWS S3', hierarchy: 'Connection → Bucket' },
    { entity: 'S3Object', table: 'S3OBJECT_ENTITY', description: 'AWS S3 object', keyAttributes: 'name, s3ObjectKey, s3ObjectSize, s3ObjectContentType, s3ObjectLastModifiedTime', relationships: 's3Bucket', connector: 'AWS S3', hierarchy: 'Bucket → Object' },
    { entity: 'ADLSAccount', table: 'ADLSACCOUNT_ENTITY', description: 'Azure ADLS account', keyAttributes: 'name, adlsAccountQualifiedName', relationships: 'adlsContainers, connection', connector: 'Azure ADLS', hierarchy: 'Connection → Account' },
    { entity: 'ADLSContainer', table: 'ADLSCONTAINER_ENTITY', description: 'Azure ADLS container', keyAttributes: 'name, adlsContainerUrl', relationships: 'adlsAccount, adlsObjects', connector: 'Azure ADLS', hierarchy: 'Account → Container' },
    { entity: 'ADLSObject', table: 'ADLSOBJECT_ENTITY', description: 'Azure ADLS object', keyAttributes: 'name, adlsObjectUrl, adlsObjectSize, adlsObjectContentType', relationships: 'adlsContainer', connector: 'Azure ADLS', hierarchy: 'Container → Object' },
    { entity: 'GCSBucket', table: 'GCSBUCKET_ENTITY', description: 'Google Cloud Storage bucket', keyAttributes: 'name, gcsBucketName, gcsObjectCount', relationships: 'gcsObjects, connection', connector: 'GCS', hierarchy: 'Connection → Bucket' },
    { entity: 'GCSObject', table: 'GCSOBJECT_ENTITY', description: 'Google Cloud Storage object', keyAttributes: 'name, gcsObjectKey, gcsObjectSize, gcsObjectContentType', relationships: 'gcsBucket', connector: 'GCS', hierarchy: 'Bucket → Object' },
  ],
  orchestration: [
    { entity: 'AirflowDag', table: 'AIRFLOWDAG_ENTITY', description: 'Airflow DAG', keyAttributes: 'name, airflowDagSchedule, airflowDagScheduleInterval', relationships: 'airflowTasks, connection', connector: 'Airflow', hierarchy: 'Connection → DAG' },
    { entity: 'AirflowTask', table: 'AIRFLOWTASK_ENTITY', description: 'Airflow task within DAG', keyAttributes: 'name, airflowTaskOperatorClass, airflowTaskSql', relationships: 'airflowDag, inputAssets, outputAssets', connector: 'Airflow', hierarchy: 'DAG → Task' },
    { entity: 'AdfPipeline', table: 'ADFPIPELINE_ENTITY', description: 'Azure Data Factory pipeline', keyAttributes: 'name, adfPipelineAnnotations', relationships: 'adfActivities, adfDatasets', connector: 'ADF', hierarchy: 'Connection → Pipeline' },
    { entity: 'AdfActivity', table: 'ADFACTIVITY_ENTITY', description: 'ADF pipeline activity', keyAttributes: 'name, adfActivityType', relationships: 'adfPipeline', connector: 'ADF', hierarchy: 'Pipeline → Activity' },
    { entity: 'AdfDataflow', table: 'ADFDATAFLOW_ENTITY', description: 'ADF data flow', keyAttributes: 'name', relationships: 'adfPipeline, adfDatasets', connector: 'ADF', hierarchy: 'Pipeline → Dataflow' },
    { entity: 'AdfDataset', table: 'ADFDATASET_ENTITY', description: 'ADF dataset', keyAttributes: 'name, adfDatasetAnnotations', relationships: 'adfLinkedService, adfActivities', connector: 'ADF', hierarchy: 'Connection → Dataset' },
    { entity: 'AdfLinkedservice', table: 'ADFLINKEDSERVICE_ENTITY', description: 'ADF linked service', keyAttributes: 'name, adfLinkedserviceAnnotations', relationships: 'adfDatasets', connector: 'ADF', hierarchy: 'Connection → LinkedService' },
    { entity: 'MatillionGroup', table: 'MATILLIONGROUP_ENTITY', description: 'Matillion group', keyAttributes: 'name', relationships: 'matillionProjects', connector: 'Matillion', hierarchy: 'Connection → Group' },
    { entity: 'MatillionProject', table: 'MATILLIONPROJECT_ENTITY', description: 'Matillion project', keyAttributes: 'name', relationships: 'matillionGroup, matillionJobs', connector: 'Matillion', hierarchy: 'Group → Project' },
    { entity: 'MatillionJob', table: 'MATILLIONJOB_ENTITY', description: 'Matillion job', keyAttributes: 'name, matillionJobType', relationships: 'matillionProject, matillionComponents', connector: 'Matillion', hierarchy: 'Project → Job' },
    { entity: 'FivetranConnector', table: 'FIVETRANCONNECTOR_ENTITY', description: 'Fivetran connector', keyAttributes: 'name, fivetranConnectorSyncFrequency, fivetranConnectorSyncPaused', relationships: 'connection', connector: 'Fivetran', hierarchy: 'Connection → Connector' },
  ],
  governance: [
    { entity: 'Tag (Classification)', table: 'TAG_RELATIONSHIP', description: 'Classification tag for assets', keyAttributes: 'tagName, propagate, restrictPropagationThroughLineage', relationships: 'entityGuid (linked asset)', notes: 'Use TAG_RELATIONSHIP to find tagged assets' },
    { entity: 'CustomMetadata', table: 'CUSTOMMETADATA_RELATIONSHIP', description: 'Custom metadata attributes', keyAttributes: 'entityGuid, attributeDisplayName, attributeValue', relationships: 'entityGuid (linked asset)', notes: 'Join with entity tables on guid' },
    { entity: 'SnowflakeTag', table: 'SNOWFLAKETAG_ENTITY', description: 'Native Snowflake tag', keyAttributes: 'name, tagAllowedValues', relationships: 'taggedAssets', notes: 'Synced from Snowflake' },
    { entity: 'DatabricksUnityCatalogTag', table: 'DATABRICKSUNITYCATALOGTAG_ENTITY', description: 'Databricks Unity Catalog tag', keyAttributes: 'name', relationships: 'taggedAssets', notes: 'Synced from Databricks' },
    { entity: 'BigqueryTag', table: 'BIGQUERYTAG_ENTITY', description: 'BigQuery policy tag', keyAttributes: 'name', relationships: 'taggedAssets', notes: 'Synced from BigQuery' },
    { entity: 'Persona', table: 'PERSONA_ENTITY', description: 'Access control persona', keyAttributes: 'name, personaGroups, personaUsers', relationships: 'policies', notes: 'Defines what users can see/do' },
    { entity: 'Purpose', table: 'PURPOSE_ENTITY', description: 'Data access purpose', keyAttributes: 'name, purposeTags', relationships: 'policies', notes: 'Purpose-based access control' },
    { entity: 'BusinessPolicy', table: 'BUSINESSPOLICY_ENTITY', description: 'Data governance policy', keyAttributes: 'name, businessPolicyType, businessPolicyValiditySchedule', relationships: 'governedAssets, businessPolicyLogs', notes: 'Policy definitions' },
    { entity: 'BusinessPolicyLog', table: 'BUSINESSPOLICYLOG_ENTITY', description: 'Policy execution log', keyAttributes: 'businessPolicyLogMessage, businessPolicyLogTimestamp', relationships: 'businessPolicy', notes: 'Audit trail' },
  ],
  ai: [
    { entity: 'AIModel', table: 'AIMODEL_ENTITY', description: 'AI/ML model', keyAttributes: 'name, aiModelStatus, aiModelVersion, aiModelType', relationships: 'aiApplications, datasets (via Process)', notes: 'Model governance' },
    { entity: 'AIApplication', table: 'AIAPPLICATION_ENTITY', description: 'Application using AI models', keyAttributes: 'name, aiApplicationVersion, aiApplicationDevelopmentStage', relationships: 'aiModels', notes: 'App-level AI governance' },
  ],
};

export default entities;


```

## src/data/exampleQueries.js

```javascript
/**
 * Example SQL Queries for MDLH
 * 
 * Organized by category, these queries provide templates and examples
 * for common data exploration and analysis patterns.
 */

export const exampleQueries = {
  core: [
    {
      title: '✓ Verify Database Access',
      description: 'Check which MDLH databases you have access to before querying',
      query: `-- List all databases you can access
SHOW DATABASES;

-- Check tables in a specific database
SHOW TABLES IN FIELD_METADATA.PUBLIC;

-- Verify a specific table exists
SELECT COUNT(*) as row_count 
FROM FIELD_METADATA.PUBLIC.TABLE_ENTITY 
LIMIT 1;`
    },
    {
      title: 'List All MDLH Tables',
      description: 'Discover available entity tables in the current database',
      query: `-- List all tables in the current schema
SHOW TABLES;

-- Or specify a database.schema:
-- SHOW TABLES IN FIELD_METADATA.PUBLIC;`
    },
    {
      title: 'Explore Catalog Integrations',
      description: 'View configured catalog integrations',
      query: `SHOW CATALOG INTEGRATIONS;
DESCRIBE CATALOG INTEGRATION <integration_name>;`
    },
    {
      title: 'Switch MDLH Environment',
      description: 'Select which MDLH database to query',
      query: `-- Choose your MDLH environment
USE FIELD_METADATA;      -- For atlan.atlan.com
USE MDLH_GOVERNANCE;     -- For demo-governance.atlan.com
USE MDLH_ATLAN_HOME;     -- For home tenant`
    },
    {
      title: 'Time Travel Query',
      description: 'Query historical data using Iceberg time travel',
      query: `-- Query data from a specific timestamp
SELECT *
FROM ATLASGLOSSARY_ENTITY
AT(TIMESTAMP => '2025-07-22 12:00:00'::timestamp_tz)
LIMIT 10;

-- View snapshot history for a table
SELECT *
FROM TABLE(INFORMATION_SCHEMA.ICEBERG_TABLE_SNAPSHOT_REFRESH_HISTORY(
  TABLE_NAME => 'ATLASGLOSSARY_ENTITY'
));`
    },
    {
      title: 'Downstream Lineage (No Limit)',
      description: 'Find ALL downstream assets from a source - no recursion limit',
      query: `-- GET DOWNSTREAM ASSETS - NO DISTANCE, NO RECURSION LIMIT
-- Warning: May be slow for assets with extensive lineage
WITH RECURSIVE lineage_cte (guid) AS (
    -- Anchor: Start with your source GUID
    SELECT '<YOUR_SOURCE_GUID>'::VARCHAR AS guid

    UNION ALL
    
    -- Recursive: Find all downstream dependencies
    SELECT outputs_flat.value::VARCHAR
    FROM lineage_cte AS L
    JOIN PROCESS_ENTITY AS P ON L.guid = P.inputs::ARRAY[0]::VARCHAR
    , LATERAL FLATTEN(INPUT => P.outputs::ARRAY) AS outputs_flat
)
SELECT DISTINCT
    COALESCE(T.name, V.name, SGELEM.name) AS entity_name,
    L.guid AS entity_guid,
    CASE
        WHEN T.name IS NOT NULL THEN 'TABLE'
        WHEN V.name IS NOT NULL THEN 'VIEW'
        WHEN SGELEM.name IS NOT NULL THEN 'SIGMA DATA ELEMENT'
        ELSE 'UNKNOWN'
    END AS entity_type
FROM lineage_cte AS L
LEFT JOIN TABLE_ENTITY AS T ON T.guid = L.guid
LEFT JOIN VIEW_ENTITY AS V ON V.guid = L.guid
LEFT JOIN SIGMADATAELEMENT_ENTITY AS SGELEM ON SGELEM.guid = L.guid
ORDER BY entity_name ASC;`
    },
    {
      title: 'Downstream Lineage (With Limit)',
      description: 'Find downstream assets with recursion depth limit and distance tracking',
      query: `-- GET DOWNSTREAM ASSETS - WITH DISTANCE AND RECURSION LIMIT
WITH RECURSIVE lineage_cte (guid, level) AS (
    -- Anchor: Start with your source GUID
    SELECT '<YOUR_SOURCE_GUID>'::VARCHAR AS guid, 0 AS level

    UNION ALL
    
    -- Recursive: Find downstream, increment level each step
    SELECT outputs_flat.value::VARCHAR, L.level + 1
    FROM lineage_cte AS L
    JOIN PROCESS_ENTITY AS P ON L.guid = P.inputs::ARRAY[0]::VARCHAR
    , LATERAL FLATTEN(INPUT => P.outputs::ARRAY) AS outputs_flat
    WHERE L.level < 5  -- Stop at 5 hops
)
SELECT DISTINCT
    COALESCE(T.name, V.name, SF.name, SGELEM.name) AS entity_name,
    L.guid AS entity_guid,
    CASE
        WHEN T.name IS NOT NULL THEN 'TABLE'
        WHEN V.name IS NOT NULL THEN 'VIEW'
        WHEN SF.name IS NOT NULL THEN 'SALESFORCE OBJECT'
        WHEN SGELEM.name IS NOT NULL THEN 'SIGMA DATA ELEMENT'
        ELSE 'UNKNOWN'
    END AS entity_type,
    L.level AS distance
FROM lineage_cte AS L
LEFT JOIN TABLE_ENTITY AS T ON T.guid = L.guid
LEFT JOIN VIEW_ENTITY AS V ON V.guid = L.guid
LEFT JOIN SALESFORCEOBJECT_ENTITY AS SF ON SF.guid = L.guid
LEFT JOIN SIGMADATAELEMENT_ENTITY AS SGELEM ON SGELEM.guid = L.guid
WHERE L.level > 0  -- Exclude the starting asset
ORDER BY distance ASC;`
    },
    {
      title: 'Upstream Lineage (With Distance)',
      description: 'Find all upstream sources with distance tracking',
      query: `-- GET UPSTREAM ASSETS - WITH DISTANCE AND RECURSION LIMIT
WITH RECURSIVE lineage_cte (guid, level) AS (
    -- Anchor: Start with your target GUID
    SELECT '<YOUR_TARGET_GUID>'::VARCHAR AS guid, 0 AS level

    UNION ALL
    
    -- Recursive: Find upstream by joining on OUTPUTS
    SELECT inputs_flat.value::VARCHAR, L.level + 1
    FROM lineage_cte AS L
    -- Note: Join on OUTPUTS to go upstream
    JOIN PROCESS_ENTITY AS P ON L.guid = P.outputs::ARRAY[0]::VARCHAR
    , LATERAL FLATTEN(INPUT => P.inputs::ARRAY) AS inputs_flat
    WHERE L.level < 5  -- Stop at 5 hops
)
SELECT DISTINCT
    COALESCE(T.name, V.name, SF.name) AS entity_name,
    L.guid AS entity_guid,
    CASE
        WHEN T.name IS NOT NULL THEN 'TABLE'
        WHEN V.name IS NOT NULL THEN 'VIEW'
        WHEN SF.name IS NOT NULL THEN 'SALESFORCE OBJECT'
        ELSE 'UNKNOWN'
    END AS entity_type,
    L.level AS distance
FROM lineage_cte AS L
LEFT JOIN TABLE_ENTITY AS T ON T.guid = L.guid
LEFT JOIN VIEW_ENTITY AS V ON V.guid = L.guid
LEFT JOIN SALESFORCEOBJECT_ENTITY AS SF ON SF.guid = L.guid
WHERE L.level > 0  -- Exclude starting asset
ORDER BY distance ASC;`
    },
    {
      title: 'Bidirectional Lineage',
      description: 'Get both upstream and downstream lineage with positive/negative distance',
      query: `-- BIDIRECTIONAL LINEAGE - Both upstream and downstream
-- Positive distance = downstream, Negative = upstream
WITH RECURSIVE downstream_cte (guid, level) AS (
    SELECT '<YOUR_GUID>'::VARCHAR AS guid, 0 AS level
    UNION ALL
    SELECT outputs_flat.value::VARCHAR, L.level + 1
    FROM downstream_cte AS L
    JOIN PROCESS_ENTITY AS P ON L.guid = P.inputs::ARRAY[0]::VARCHAR
    , LATERAL FLATTEN(INPUT => P.outputs::ARRAY) AS outputs_flat
    WHERE L.level < 5
),
upstream_cte (guid, level) AS (
    SELECT '<YOUR_GUID>'::VARCHAR AS guid, 0 AS level
    UNION ALL
    SELECT inputs_flat.value::VARCHAR, L.level - 1  -- Negative for upstream
    FROM upstream_cte AS L
    JOIN PROCESS_ENTITY AS P ON L.guid = P.outputs::ARRAY[0]::VARCHAR
    , LATERAL FLATTEN(INPUT => P.inputs::ARRAY) AS inputs_flat
    WHERE L.level > -5
),
combined_lineage AS (
    SELECT * FROM downstream_cte
    UNION ALL
    SELECT * FROM upstream_cte
)
SELECT DISTINCT
    COALESCE(T.name, V.name, SF.name, SGELEM.name) AS entity_name,
    L.guid AS entity_guid,
    CASE
        WHEN T.name IS NOT NULL THEN 'TABLE'
        WHEN V.name IS NOT NULL THEN 'VIEW'
        WHEN SF.name IS NOT NULL THEN 'SALESFORCE OBJECT'
        WHEN SGELEM.name IS NOT NULL THEN 'SIGMA DATA ELEMENT'
        ELSE 'UNKNOWN'
    END AS entity_type,
    L.level AS distance  -- Negative = upstream, Positive = downstream
FROM combined_lineage AS L
LEFT JOIN TABLE_ENTITY AS T ON T.guid = L.guid
LEFT JOIN VIEW_ENTITY AS V ON V.guid = L.guid
LEFT JOIN SALESFORCEOBJECT_ENTITY AS SF ON SF.guid = L.guid
LEFT JOIN SIGMADATAELEMENT_ENTITY AS SGELEM ON SGELEM.guid = L.guid
WHERE L.level != 0  -- Exclude starting asset
ORDER BY distance ASC;`
    },
  ],
  glossary: [
    {
      title: 'List All Glossaries',
      description: 'View all business glossaries in your tenant with creator info',
      query: `-- First, see all Glossaries in your Atlan tenant
SELECT
  NAME,
  GUID,
  CREATEDBY
FROM ATLASGLOSSARY_ENTITY;

-- Note the GUID of the glossary you want to explore
-- You'll use it in subsequent queries with ARRAY_CONTAINS`
    },
    {
      title: 'Terms with Categories (Full Detail)',
      description: 'List glossary terms with their parent glossaries and categories resolved to names',
      query: `-- Comprehensive query to resolve term relationships
WITH glossary_lookup AS (
    SELECT GUID AS glossary_guid, NAME AS glossary_name
    FROM GLOSSARY_ENTITY
),
category_lookup AS (
    SELECT GUID AS category_guid, NAME AS category_name
    FROM GLOSSARYCATEGORY_ENTITY
),
term_anchors AS (
    SELECT TERM.GUID AS term_guid,
           anchor_elem.value::STRING AS glossary_guid
    FROM GLOSSARYTERM_ENTITY TERM,
         LATERAL FLATTEN(input => TERM.ANCHOR) AS anchor_elem
),
term_categories AS (
    SELECT TERM.GUID AS term_guid,
           category_elem.value::STRING AS category_guid
    FROM GLOSSARYTERM_ENTITY TERM,
         LATERAL FLATTEN(input => TERM.CATEGORIES) AS category_elem
),
term_glossary_names AS (
    SELECT TA.term_guid,
           LISTAGG(GL.glossary_name, ', ') WITHIN GROUP (ORDER BY GL.glossary_name) AS glossaries
    FROM term_anchors TA
    LEFT JOIN glossary_lookup GL ON TA.glossary_guid = GL.glossary_guid
    GROUP BY TA.term_guid
),
term_category_names AS (
    SELECT TC.term_guid,
           LISTAGG(CL.category_name, ', ') WITHIN GROUP (ORDER BY CL.category_name) AS categories
    FROM term_categories TC
    LEFT JOIN category_lookup CL ON TC.category_guid = CL.category_guid
    GROUP BY TC.term_guid
)
SELECT
    T.NAME,
    T.USERDESCRIPTION,
    TG.glossaries AS GLOSSARIES,
    TC.categories AS CATEGORIES,
    T.GUID
FROM GLOSSARYTERM_ENTITY T
LEFT JOIN term_glossary_names TG ON T.GUID = TG.term_guid
LEFT JOIN term_category_names TC ON T.GUID = TC.term_guid
LIMIT 100;`
    },
    {
      title: 'Terms by Glossary GUID',
      description: 'Get all terms belonging to a specific glossary',
      query: `SELECT GUID, NAME, USERDESCRIPTION
FROM ATLASGLOSSARYTERM_ENTITY
WHERE ARRAY_CONTAINS('<GLOSSARY_GUID>', ANCHOR);`
    },
    {
      title: 'Terms by Creator',
      description: 'Find all terms created by a specific user',
      query: `SELECT GUID, NAME
FROM ATLASGLOSSARYTERM_ENTITY
WHERE CREATEDBY = '<username>';`
    },
    {
      title: 'Certificate Status Distribution',
      description: 'Count terms by certification status',
      query: `SELECT CERTIFICATESTATUS, COUNT(GUID) as term_count
FROM ATLASGLOSSARYTERM_ENTITY
GROUP BY CERTIFICATESTATUS;`
    },
    {
      title: 'Find Duplicate Terms (Jaro-Winkler)',
      description: 'Identify similar terms across glossaries using fuzzy matching',
      query: `WITH core_terms AS (
  SELECT NAME AS core_name, GUID AS core_guid,
         USERDESCRIPTION AS core_description
  FROM ATLASGLOSSARYTERM_ENTITY
  WHERE ARRAY_CONTAINS('<CORE_GLOSSARY_GUID>', ANCHOR)
),
non_core_terms AS (
  SELECT NAME AS non_core_name, GUID AS non_core_guid,
         USERDESCRIPTION AS non_core_description,
         ANCHOR AS non_core_anchor_guid
  FROM ATLASGLOSSARYTERM_ENTITY
  WHERE NOT(ARRAY_CONTAINS('<CORE_GLOSSARY_GUID>', ANCHOR))
),
glossary_lookup AS (
  SELECT GUID AS glossary_guid, NAME AS glossary_name
  FROM ATLASGLOSSARY_ENTITY
)
SELECT DISTINCT
  T1.core_name AS source_of_truth_name,
  T2.non_core_name AS potential_duplicate_name,
  T3.glossary_name AS duplicate_glossary,
  JAROWINKLER_SIMILARITY(T1.core_name, T2.non_core_name) AS similarity_score
FROM core_terms T1
JOIN non_core_terms T2
  ON JAROWINKLER_SIMILARITY(T1.core_name, T2.non_core_name) >= 95
  AND T1.core_guid != T2.non_core_guid
JOIN glossary_lookup T3
  ON ARRAY_CONTAINS(T3.glossary_guid, T2.non_core_anchor_guid)
ORDER BY similarity_score DESC;`
    },
    {
      title: 'Find Substring Duplicates',
      description: 'Find terms where one name contains another',
      query: `WITH standardized_terms AS (
  SELECT NAME AS original_term_name, GUID AS term_guid,
         USERDESCRIPTION AS term_description,
         LOWER(REGEXP_REPLACE(NAME, '[ _-]', '', 1, 0)) AS standardized_name
  FROM ATLASGLOSSARYTERM_ENTITY
)
SELECT DISTINCT
  t1.original_term_name AS potential_duplicate_1_name,
  t2.original_term_name AS potential_duplicate_2_name,
  t1.term_guid AS potential_duplicate_1_guid,
  t2.term_guid AS potential_duplicate_2_guid
FROM standardized_terms t1
JOIN standardized_terms t2
  ON t1.standardized_name LIKE '%' || t2.standardized_name || '%'
  AND LENGTH(t1.standardized_name) > LENGTH(t2.standardized_name)
  AND t1.term_guid != t2.term_guid
ORDER BY potential_duplicate_1_name;`
    },
  ],
  datamesh: [
    {
      title: 'List Data Domains',
      description: 'View all data domains and their hierarchy',
      query: `SELECT NAME, USERDESCRIPTION, PARENTDOMAINQUALIFIEDNAME
FROM DATADOMAIN_ENTITY
ORDER BY NAME;`
    },
    {
      title: 'Active Data Products',
      description: 'Find all active data products with their status',
      query: `SELECT NAME, DATAPRODUCTSTATUS, DATAPRODUCTCRITICALITY
FROM DATAPRODUCT_ENTITY
WHERE DATAPRODUCTSTATUS = 'Active'
ORDER BY DATAPRODUCTCRITICALITY DESC;`
    },
    {
      title: 'Data Contracts Overview',
      description: 'View data contract versions and certification status',
      query: `SELECT DATACONTRACTVERSION, CERTIFICATESTATUS, DATACONTRACTASSETGUID
FROM DATACONTRACT_ENTITY
ORDER BY DATACONTRACTVERSION DESC;`
    },
  ],
  relational: [
    {
      title: 'Basic Table Exploration',
      description: 'View table metadata with row counts and sizes',
      query: `SELECT NAME, ROWCOUNT, COLUMNCOUNT, SIZEBYTES, POPULARITYSCORE
FROM TABLE_ENTITY
WHERE SIZEBYTES IS NOT NULL
ORDER BY SIZEBYTES DESC
LIMIT 100;`
    },
    {
      title: 'Full Column Metadata Export',
      description: 'Comprehensive column-level metadata with tags and custom metadata as JSON arrays',
      query: `-- Column-Level Metadata Query with Aggregated Custom Metadata and Tags
WITH FILTERED_COLUMNS AS (
    SELECT GUID
    FROM COLUMN_ENTITY
    WHERE CONNECTORNAME IN ('glue', 'snowflake')
),
-- Aggregate Custom Metadata for each column as JSON
CM_AGG AS (
    SELECT
        CM.ENTITYGUID,
        ARRAY_AGG(
            DISTINCT OBJECT_CONSTRUCT(
                'set_name', SETDISPLAYNAME,
                'field_name', ATTRIBUTEDISPLAYNAME,
                'field_value', ATTRIBUTEVALUE
            )
        ) AS CUSTOM_METADATA_JSON
    FROM CUSTOMMETADATA_RELATIONSHIP CM
    JOIN FILTERED_COLUMNS FC ON CM.ENTITYGUID = FC.GUID
    GROUP BY CM.ENTITYGUID
),
-- Aggregate Tags for each column as JSON
TR_AGG AS (
    SELECT
        TR.ENTITYGUID,
        '[' || LISTAGG(
            OBJECT_CONSTRUCT('name', TR.TAGNAME, 'value', TR.TAGVALUE)::STRING, ','
        ) WITHIN GROUP (ORDER BY TR.TAGNAME) || ']' AS TAG_JSON
    FROM TAG_RELATIONSHIP TR
    JOIN FILTERED_COLUMNS FC ON TR.ENTITYGUID = FC.GUID
    GROUP BY TR.ENTITYGUID
)
SELECT
    -- Asset Identifiers
    COL.NAME AS COL_NAME,
    COL.QUALIFIEDNAME AS COL_QUALIFIEDNAME,
    COL.GUID AS COL_GUID,
    COL.DESCRIPTION AS COL_DESCRIPTION,
    COL.USERDESCRIPTION AS COL_USERDESCRIPTION,
    COL.CONNECTORNAME, COL.CONNECTIONNAME,
    COL.DATABASENAME, COL.SCHEMANAME, COL.TABLENAME,
    -- Source Attributes
    COL.DATATYPE, COL.SUBDATATYPE,
    COL."ORDER" AS COL_ORDER,
    COL.ISPARTITION, COL.ISPRIMARY, COL.ISNULLABLE,
    COL.PRECISION, COL.MAXLENGTH,
    -- Atlan Metrics
    COL.STATUS, COL.HASLINEAGE, COL.POPULARITYSCORE,
    COL.QUERYCOUNT, COL.QUERYUSERCOUNT,
    -- Tags & Custom Metadata
    TR_AGG.TAG_JSON AS COL_TAGS,
    CM_AGG.CUSTOM_METADATA_JSON AS COL_CUSTOM_METADATA,
    -- Enrichment
    COL.CERTIFICATESTATUS, COL.MEANINGS,
    COL.OWNERUSERS, COL.OWNERGROUPS
FROM COLUMN_ENTITY COL
LEFT JOIN CM_AGG ON COL.GUID = CM_AGG.ENTITYGUID
LEFT JOIN TR_AGG ON COL.GUID = TR_AGG.ENTITYGUID
WHERE COL.CONNECTORNAME IN ('glue', 'snowflake')
LIMIT 100;`
    },
    {
      title: 'Tables Without Descriptions',
      description: 'Find tables missing documentation',
      query: `SELECT
  SUM(CASE WHEN DESCRIPTION IS NOT NULL THEN 1 ELSE 0 END) "WITH DESCRIPTIONS",
  SUM(CASE WHEN DESCRIPTION IS NULL THEN 1 ELSE 0 END) "WITHOUT DESCRIPTIONS"
FROM TABLE_ENTITY;`
    },
    {
      title: 'Storage Reclamation Analysis',
      description: 'Find large tables by size and popularity for storage optimization',
      query: `-- STORAGE RECLAMATION ANALYSIS
-- Show the largest tables and their popularity scores
-- Use this to identify large, unused tables for cleanup
SELECT
  NAME,
  ROWCOUNT,
  COLUMNCOUNT,
  SIZEBYTES,
  POPULARITYSCORE
FROM TABLE_ENTITY
WHERE SIZEBYTES IS NOT NULL
ORDER BY SIZEBYTES DESC;

-- Calculate total storage used by unpopular tables
SELECT SUM(SIZEBYTES) as bytes_in_unpopular_tables
FROM TABLE_ENTITY
WHERE POPULARITYSCORE < 0.05;`
    },
    {
      title: 'Most Popular Tables',
      description: 'Find tables with highest query counts',
      query: `SELECT NAME, QUERYCOUNT, POPULARITYSCORE, COLUMNCOUNT
FROM TABLE_ENTITY
ORDER BY QUERYCOUNT DESC
LIMIT 20;`
    },
    {
      title: 'Frequent Column Updaters',
      description: 'Find users who update columns most frequently - useful for identifying power users',
      query: `-- POPULARITY ANALYSIS
-- Shows users who update Columns most frequently in Atlan
-- Useful for identifying power users and data stewards
SELECT
  UPDATEDBY,
  TO_TIMESTAMP(MAX(UPDATETIME)/1000) AS LASTUPDATE,
  COUNT(*) AS UPDATECOUNT
FROM COLUMN_ENTITY
GROUP BY UPDATEDBY
ORDER BY UPDATECOUNT DESC;`
    },
    {
      title: 'Table-Column Join',
      description: 'Get column details with parent table information',
      query: `SELECT tbl.name AS table_name,
       col.name AS column_name,
       col.datatype,
       TO_TIMESTAMP(col.updatetime/1000) AS column_updated,
       tbl.rowcount
FROM COLUMN_ENTITY col
JOIN TABLE_ENTITY tbl ON col."TABLE"[0] = tbl.guid
LIMIT 50;`
    },
    {
      title: 'Find Column by GUID',
      description: 'Get parent table for a specific column',
      query: `SELECT name AS table_name, rowcount
FROM TABLE_ENTITY
WHERE ARRAY_CONTAINS('<COLUMN_GUID>', columns);`
    },
    {
      title: 'Untagged Tables',
      description: 'Find tables without any classification tags',
      query: `SELECT GUID, QUALIFIEDNAME, COLUMNCOUNT, ROWCOUNT
FROM TABLE_ENTITY
WHERE ASSETTAGS = '[]';`
    },
    {
      title: 'Inactive Tables',
      description: 'Find tables with inactive status',
      query: `SELECT GUID, QUALIFIEDNAME, COLUMNCOUNT, ROWCOUNT, QUERYCOUNT
FROM TABLE_ENTITY
WHERE STATUS = 'INACTIVE';

-- Status distribution
SELECT STATUS, COUNT(*)
FROM TABLE_ENTITY
GROUP BY STATUS;`
    },
  ],
  queries: [
    {
      title: 'List Collections',
      description: 'View all Insights collections',
      query: `SELECT * FROM COLLECTION_ENTITY;`
    },
    {
      title: 'Collection Hierarchy',
      description: 'See folders within collections',
      query: `SELECT c.NAME as collection_name, f.NAME as folder_name
FROM COLLECTION_ENTITY c
LEFT JOIN FOLDER_ENTITY f ON f.COLLECTIONQUALIFIEDNAME = c.QUALIFIEDNAME;`
    },
  ],
  bi: [
    {
      title: 'Tableau Calculated Field Duplicates',
      description: 'Find potential duplicate calculated fields by name',
      query: `WITH standardized_metrics AS (
  SELECT NAME AS original_metric_name, GUID AS metric_guid,
         FORMULA AS original_formula,
         LOWER(REGEXP_REPLACE(NAME, '[ _-]', '', 1, 0)) AS standardized_name
  FROM TABLEAUCALCULATEDFIELD_ENTITY
)
SELECT DISTINCT
  t1.original_metric_name AS duplicate_1_name,
  t1.metric_guid AS duplicate_1_guid,
  t1.original_formula AS duplicate_1_formula,
  t2.original_metric_name AS duplicate_2_name,
  t2.metric_guid AS duplicate_2_guid,
  t2.original_formula AS duplicate_2_formula
FROM standardized_metrics t1
JOIN standardized_metrics t2
  ON t1.standardized_name LIKE '%' || t2.standardized_name || '%'
  AND LENGTH(t1.standardized_name) > LENGTH(t2.standardized_name)
  AND t1.metric_guid != t2.metric_guid
ORDER BY duplicate_1_name;`
    },
    {
      title: 'Tableau Formula Duplicates',
      description: 'Find calculated fields with identical formulas',
      query: `WITH standardized_metrics AS (
  SELECT NAME AS metric_name, GUID AS metric_guid, FORMULA AS original_formula,
         LOWER(REGEXP_REPLACE(FORMULA, '[ _\\[\\]]', '', 1, 0)) AS standardized_formula
  FROM TABLEAUCALCULATEDFIELD_ENTITY
)
SELECT standardized_formula,
       COUNT(*) AS number_of_metrics,
       LISTAGG(metric_guid, ', ') WITHIN GROUP (ORDER BY metric_guid) AS all_guids,
       LISTAGG(metric_name, ', ') WITHIN GROUP (ORDER BY metric_name) AS all_names
FROM standardized_metrics
GROUP BY standardized_formula
HAVING COUNT(*) > 1
ORDER BY number_of_metrics DESC;`
    },
    {
      title: 'Power BI Measure Duplicates',
      description: 'Find measures with same name across tables',
      query: `SELECT
  t1.NAME "MEASURE 1 NAME",
  t1.GUID "MEASURE 1 GUID",
  t1.POWERBIMEASUREEXPRESSION "MEASURE 1 EXPRESSION",
  t2.NAME "MEASURE 2 NAME",
  t2.GUID "MEASURE 2 GUID",
  t2.POWERBIMEASUREEXPRESSION "MEASURE 2 EXPRESSION",
  t1."TABLE" "COMMON TABLE"
FROM POWERBIMEASURE_ENTITY t1
JOIN POWERBIMEASURE_ENTITY t2
  ON t1.NAME = t2.NAME
  AND GET(t1."TABLE", 0) = GET(t2."TABLE", 0)
WHERE t1.GUID < t2.GUID
ORDER BY "MEASURE 1 NAME";`
    },
    {
      title: 'Power BI Measures by Popularity',
      description: 'Find most popular Power BI measures',
      query: `SELECT NAME, POPULARITYSCORE, POWERBIMEASUREEXPRESSION
FROM POWERBIMEASURE_ENTITY
ORDER BY POPULARITYSCORE DESC
LIMIT 20;`
    },
    {
      title: 'Tables with Measures',
      description: 'Find Power BI tables that have measures',
      query: `SELECT * FROM POWERBITABLE_ENTITY
WHERE POWERBITABLEMEASURECOUNT > 0;`
    },
  ],
  dbt: [
    {
      title: 'dbt Job Status Summary',
      description: 'Count models by job status',
      query: `SELECT dbtJobStatus, COUNT(*)
FROM DBTMODELCOLUMN_ENTITY
GROUP BY dbtJobStatus;

SELECT assetDbtJobStatus, COUNT(*)
FROM TABLE_ENTITY
GROUP BY assetDbtJobStatus;`
    },
    {
      title: 'dbt Models Overview',
      description: 'View dbt models with materialization type',
      query: `SELECT NAME, DBTALIAS, DBTMATERIALIZATION, DBTRAWSQL
FROM DBTMODEL_ENTITY
LIMIT 50;`
    },
  ],
  storage: [
    {
      title: 'S3 Bucket Overview',
      description: 'List S3 buckets with object counts',
      query: `SELECT NAME, S3BUCKETARN, AWSREGION, S3OBJECTCOUNT
FROM S3BUCKET_ENTITY
ORDER BY S3OBJECTCOUNT DESC;`
    },
  ],
  orchestration: [
    {
      title: 'Airflow DAGs',
      description: 'List all Airflow DAGs with schedules',
      query: `SELECT NAME, AIRFLOWDAGSCHEDULE, AIRFLOWDAGSCHEDULEINTERVAL
FROM AIRFLOWDAG_ENTITY;`
    },
    {
      title: 'Workflow Entities',
      description: 'View all workflow definitions',
      query: `SELECT * FROM WORKFLOW_ENTITY;`
    },
  ],
  governance: [
    {
      title: 'Most Popular Tags',
      description: 'Find most frequently used classification tags',
      query: `SELECT TAGNAME, COUNT(TAGNAME) as usage_count
FROM TAG_RELATIONSHIP
GROUP BY TAGNAME
ORDER BY usage_count DESC;`
    },
    {
      title: 'Tagged Tables',
      description: 'List all tables with their assigned tags',
      query: `-- Get all tables that have tags and their tag names
-- Useful for auditing tag coverage
SELECT
  TB.GUID,
  TB.NAME AS TABLENAME,
  TG.TAGNAME
FROM TABLE_ENTITY TB
JOIN TAG_RELATIONSHIP TG ON TB.GUID = TG.ENTITYGUID
WHERE TB.NAME IS NOT NULL;`
    },
    {
      title: 'Untagged Tables (Compliance)',
      description: 'Find tables without tags for compliance - includes creator and database for notification',
      query: `-- TAG COMPLIANCE USE CASE
-- Some companies require all tables to have a tag
-- (e.g., specifying data retention period).
-- Tables without tags may be flagged for deletion.

-- Find all untagged tables with creator info for follow-up:
SELECT DISTINCT
  TB.GUID,
  TB.NAME AS TABLENAME,
  TB.CREATEDBY,
  TB.DATABASEQUALIFIEDNAME
FROM TABLE_ENTITY TB
LEFT JOIN TAG_RELATIONSHIP TG ON TB.GUID = TG.ENTITYGUID
WHERE TG.TAGNAME IS NULL;

-- Use this to notify creators to add required tags`
    },
    {
      title: 'Custom Metadata Query',
      description: 'Find assets with specific custom metadata values',
      query: `SELECT col.guid, col.name AS column_name,
       cm.attributedisplayname, cm.attributevalue
FROM COLUMN_ENTITY col
JOIN CUSTOMMETADATA_RELATIONSHIP cm ON col.guid = cm.entityguid
WHERE attributedisplayname = 'Cost Center Attribution'
  AND attributevalue = 'COGS';`
    },
    {
      title: 'Custom Metadata Overview',
      description: 'Explore all custom metadata attributes',
      query: `SELECT DISTINCT attributedisplayname, attributevalue, COUNT(*)
FROM CUSTOMMETADATA_RELATIONSHIP
GROUP BY attributedisplayname, attributevalue
ORDER BY COUNT(*) DESC;`
    },
    {
      title: 'Assets with Tags (Join Pattern)',
      description: 'List assets with their tags using JOIN pattern',
      query: `-- Pattern for listing any asset type with tags
SELECT
  TB.GUID,
  TB.NAME AS TABLENAME,
  TG.TAGNAME
FROM TABLE_ENTITY TB
JOIN TAG_RELATIONSHIP TG ON TB.GUID = TG.ENTITYGUID
WHERE TB.NAME IS NOT NULL;

-- Same pattern works for columns, views, etc.
-- Just replace TABLE_ENTITY with the entity type you need`
    },
  ],
  ai: [
    {
      title: 'AI Models Overview',
      description: 'List all AI/ML models with status',
      query: `SELECT NAME, AIMODELSTATUS, AIMODELVERSION, AIMODELTYPE
FROM AIMODEL_ENTITY
ORDER BY AIMODELVERSION DESC;`
    },
  ],
};

export default exampleQueries;


```



# BACKEND (Python/FastAPI)


## backend/app/main.py

```python
"""FastAPI application entry point."""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
import uvicorn
import time
import uuid
from datetime import datetime

from app.config import settings

# =============================================================================
# SERVER INSTANCE ID
# =============================================================================
# This ID changes every time the backend process restarts.
# Frontend uses this to detect backend restarts and clear stale sessions.
SERVER_INSTANCE_ID = str(uuid.uuid4())
SERVER_START_TIME = datetime.utcnow().isoformat() + "Z"
from app.routers import connection_router, metadata_router, query_router
from app.routers.system import router as system_router
from app.utils.logger import logger, generate_request_id, set_request_id


class TimingMiddleware(BaseHTTPMiddleware):
    """Middleware to log request timing with detailed information and request ID correlation."""
    
    async def dispatch(self, request: Request, call_next):
        # Skip OPTIONS (preflight) requests for cleaner logs
        if request.method == "OPTIONS":
            return await call_next(request)
        
        # Generate unique request ID for correlation
        request_id = generate_request_id()
        set_request_id(request_id)
        
        start_time = time.perf_counter()
        
        # Get session ID if present
        session_id = request.headers.get("X-Session-ID", "no-session")
        if session_id != "no-session":
            session_id = session_id[:8] + "..."
        
        # Log request start
        logger.info(f"[{request_id}] → {request.method} {request.url.path} [session: {session_id}]")
        
        # Process request
        response = await call_next(request)
        
        # Calculate timing
        end_time = time.perf_counter()
        duration_ms = (end_time - start_time) * 1000
        
        # Log response with timing
        status_emoji = "✓" if response.status_code < 400 else "✗"
        logger.info(
            f"[{request_id}] ← {status_emoji} {request.method} {request.url.path} "
            f"[{response.status_code}] {duration_ms:.2f}ms"
        )
        
        # Add headers to response for correlation
        response.headers["X-Response-Time"] = f"{duration_ms:.2f}ms"
        response.headers["X-Request-ID"] = request_id
        
        return response


# Create FastAPI app
app = FastAPI(
    title="Snowflake Query API",
    description="Backend API for MDLH Dictionary Snowflake query execution",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add timing middleware FIRST (outermost)
app.add_middleware(TimingMiddleware)

# Configure CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",      # Vite dev server
        "http://localhost:3000",      # Alternative dev port
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(connection_router)
app.include_router(metadata_router)
app.include_router(query_router)
app.include_router(system_router)


@app.get("/")
async def root():
    """Root endpoint with API info."""
    return {
        "name": "Snowflake Query API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "connection": "/api/connect",
            "metadata": "/api/metadata/*",
            "query": "/api/query/*"
        }
    }


@app.get("/health")
async def health_check():
    """
    Health check endpoint.
    
    Returns the server instance ID which changes on every backend restart.
    Frontend uses this to detect restarts and clear stale sessions.
    """
    return {
        "status": "healthy",
        "serverInstanceId": SERVER_INSTANCE_ID,
        "startedAt": SERVER_START_TIME,
    }


def start():
    """Start the server programmatically."""
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug
    )


if __name__ == "__main__":
    start()


```

## backend/app/config.py

```python
"""Application configuration from environment variables."""

from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    """Snowflake and server configuration."""
    
    # Snowflake Connection
    snowflake_account: str = ""
    snowflake_user: str = ""
    snowflake_private_key_path: Optional[str] = None
    snowflake_password: Optional[str] = None
    snowflake_warehouse: str = "COMPUTE_WH"
    snowflake_database: str = "ATLAN_MDLH"
    snowflake_schema: str = "PUBLIC"
    snowflake_role: Optional[str] = None
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False
    
    # Cache TTLs (seconds) - matches frontend TIMEOUTS
    cache_ttl_databases: int = 600  # 10 minutes
    cache_ttl_schemas: int = 600    # 10 minutes
    cache_ttl_tables: int = 600     # 10 minutes
    cache_ttl_columns: int = 900    # 15 minutes
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()


```



## Backend Routers


## backend/app/routers/connection.py

```python
"""Connection management endpoints with session support."""

from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
import snowflake.connector
from snowflake.connector.errors import DatabaseError, OperationalError, ProgrammingError
from app.services.session import session_manager
from app.utils.logger import logger

router = APIRouter(prefix="/api", tags=["connection"])


class ConnectionRequest(BaseModel):
    """Connection request with credentials."""
    account: str
    user: str
    token: Optional[str] = None
    auth_type: str = "token"
    warehouse: str = "COMPUTE_WH"
    database: str = "ATLAN_MDLH"
    schema_name: str = "PUBLIC"
    role: Optional[str] = None


class ConnectionResponse(BaseModel):
    """Connection response with session ID."""
    connected: bool
    session_id: Optional[str] = None
    user: Optional[str] = None
    warehouse: Optional[str] = None
    database: Optional[str] = None
    role: Optional[str] = None
    error: Optional[str] = None


class SessionStatusResponse(BaseModel):
    """Session status response."""
    valid: bool
    user: Optional[str] = None
    warehouse: Optional[str] = None
    database: Optional[str] = None
    schema_name: Optional[str] = None
    role: Optional[str] = None
    query_count: Optional[int] = None
    idle_seconds: Optional[float] = None
    message: Optional[str] = None


class DisconnectResponse(BaseModel):
    """Disconnect response."""
    disconnected: bool
    message: str


@router.post("/connect", response_model=ConnectionResponse)
async def connect(request: ConnectionRequest):
    """Establish Snowflake connection and return session ID."""
    try:
        connect_params = {
            "account": request.account,
            "user": request.user,
            "warehouse": request.warehouse,
            "database": request.database,
            "schema": request.schema_name,
            # Keep session alive to prevent silent disconnects
            "client_session_keep_alive": True,
            # Network timeout for connection operations
            "network_timeout": 10,
        }
        
        if request.role:
            connect_params["role"] = request.role
        
        if request.auth_type == "sso":
            connect_params["authenticator"] = "externalbrowser"
        elif request.auth_type == "token":
            if not request.token:
                return ConnectionResponse(
                    connected=False,
                    error="Personal Access Token required"
                )
            connect_params["token"] = request.token
            connect_params["authenticator"] = "oauth"
        else:
            return ConnectionResponse(
                connected=False,
                error=f"Unknown auth_type: {request.auth_type}"
            )
        
        logger.info(f"[Connect] {request.auth_type} auth for {request.user}@{request.account}")
        conn = snowflake.connector.connect(**connect_params)
        
        cursor = conn.cursor()
        cursor.execute("SELECT CURRENT_USER(), CURRENT_ROLE(), CURRENT_WAREHOUSE()")
        row = cursor.fetchone()
        cursor.close()
        
        session_id = session_manager.create_session(
            conn=conn,
            user=row[0],
            account=request.account,
            warehouse=row[2],
            database=request.database,
            schema=request.schema_name,
            role=row[1]
        )
        
        logger.info(f"[Connect] Session {session_id[:8]}... created for {row[0]}")
        
        return ConnectionResponse(
            connected=True,
            session_id=session_id,
            user=row[0],
            warehouse=row[2],
            database=request.database,
            role=row[1]
        )
        
    except DatabaseError as e:
        # Authentication errors -> 401
        error_msg = str(e)
        if "authentication" in error_msg.lower() or "password" in error_msg.lower() or "token" in error_msg.lower():
            logger.warning(f"[Connect] Auth failed: {e}")
            return JSONResponse(
                status_code=401,
                content={"connected": False, "error": "Authentication failed"}
            )
        # Other database errors -> return as is
        logger.error(f"[Connect] Database error: {e}")
        return ConnectionResponse(connected=False, error=str(e))
    except (OperationalError, TimeoutError) as e:
        # Network/timeout errors -> 503
        logger.error(f"[Connect] Network/timeout error: {e}")
        return JSONResponse(
            status_code=503,
            content={"connected": False, "error": "Snowflake connection timed out or unreachable"}
        )
    except Exception as e:
        logger.exception(f"[Connect] Unexpected error: {e}")
        return JSONResponse(
            status_code=500,
            content={"connected": False, "error": "Internal error while connecting"}
        )


@router.get("/session/status")
async def get_session_status(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
):
    """
    Check if a session is still valid.
    
    Response codes:
    - 200 { valid: true, ... } -> session good
    - 401 { valid: false, reason: "SESSION_NOT_FOUND" } -> session unknown (e.g., backend restarted)
    - 401 { valid: false, reason: "auth-error" } -> session truly dead (Snowflake rejected)
    - 503 { valid: true, reason: "snowflake-unreachable" } -> backend/Snowflake unreachable
    
    Frontend should treat 401 as "please reconnect" and 503 as "try again later".
    """
    if not x_session_id:
        logger.debug("[SessionStatus] No session ID provided")
        return JSONResponse(
            status_code=401,
            content={"valid": False, "reason": "NO_SESSION_ID", "message": "No session ID provided"}
        )
    
    session = session_manager.get_session(x_session_id)
    if session is None:
        # This is the key case: frontend has a stale session ID (e.g., backend restarted)
        # Return 401 with a clear reason so frontend knows to prompt for reconnect
        logger.info(f"[SessionStatus] Session {x_session_id[:8]}... not found (backend may have restarted)")
        return JSONResponse(
            status_code=401,
            content={"valid": False, "reason": "SESSION_NOT_FOUND", "message": "Session not found - please reconnect"}
        )
    
    # Perform a quick health check to verify Snowflake is reachable
    try:
        cursor = session.conn.cursor()
        cursor.execute("SELECT 1")
        cursor.fetchone()
        cursor.close()
    except (DatabaseError, ProgrammingError) as e:
        error_msg = str(e).lower()
        # Check if it's an auth error (session actually invalid)
        if "authentication" in error_msg or "session" in error_msg or "token" in error_msg:
            logger.warning(f"[SessionStatus] Session {x_session_id[:8]}... auth invalid: {e}")
            session_manager.remove_session(x_session_id)
            return JSONResponse(
                status_code=401,
                content={"valid": False, "reason": "auth-error", "message": str(e)}
            )
        # Otherwise it's a network/Snowflake issue -> 503
        logger.warning(f"[SessionStatus] Snowflake unreachable for session {x_session_id[:8]}...: {e}")
        return JSONResponse(
            status_code=503,
            content={"valid": True, "reason": "snowflake-unreachable", "message": "Snowflake health check failed"}
        )
    except (OperationalError, TimeoutError) as e:
        # Network errors -> 503, session may still be valid
        logger.warning(f"[SessionStatus] Network error for session {x_session_id[:8]}...: {e}")
        return JSONResponse(
            status_code=503,
            content={"valid": True, "reason": "snowflake-unreachable", "message": "Network timeout"}
        )
    except Exception as e:
        logger.error(f"[SessionStatus] Unexpected error for session {x_session_id[:8]}...: {e}")
        return JSONResponse(
            status_code=503,
            content={"valid": True, "reason": "status-check-error", "message": str(e)}
        )
    
    from datetime import datetime
    idle = (datetime.utcnow() - session.last_used).total_seconds()
    
    return SessionStatusResponse(
        valid=True,
        user=session.user,
        warehouse=session.warehouse,
        database=session.database,
        schema_name=session.schema,
        role=session.role,
        query_count=session.query_count,
        idle_seconds=idle
    )


@router.post("/disconnect", response_model=DisconnectResponse)
async def disconnect(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
):
    """Close session and release Snowflake connection."""
    if not x_session_id:
        return DisconnectResponse(disconnected=False, message="No session ID provided")
    
    removed = session_manager.remove_session(x_session_id)
    if removed:
        return DisconnectResponse(disconnected=True, message="Session closed")
    return DisconnectResponse(disconnected=False, message="Session not found")


@router.get("/sessions")
async def list_sessions():
    """Debug: list active sessions. Secure in production!"""
    return session_manager.get_stats()


@router.get("/health")
async def health():
    """Health check."""
    stats = session_manager.get_stats()
    return {"status": "healthy", "active_sessions": stats["active_sessions"]}

```

## backend/app/routers/metadata.py

```python
"""Metadata discovery endpoints for schema browser with session support."""

import re
from fastapi import APIRouter, HTTPException, Query, Header
from fastapi.responses import JSONResponse
from typing import List, Optional
import snowflake.connector.errors
from snowflake.connector.errors import OperationalError
from app.models.schemas import DatabaseInfo, SchemaInfo, TableInfo, ColumnInfo
from app.services.session import session_manager
from app.services import metadata_cache
from app.utils.logger import logger

router = APIRouter(prefix="/api/metadata", tags=["metadata"])


def _validate_identifier(name: str) -> str:
    """Validate and quote Snowflake identifier to prevent SQL injection."""
    if not name or not re.match(r'^[A-Za-z_][A-Za-z0-9_$]*$', name):
        if not re.match(r'^"[^"]*"$', name):  # Already quoted
            # Quote the identifier
            name = '"' + name.replace('"', '""') + '"'
    return name


def _get_session_or_none(session_id: Optional[str]):
    """Get session from header, returns None if invalid."""
    if not session_id:
        return None
    return session_manager.get_session(session_id)


def _handle_snowflake_error(e: Exception, context: str):
    """
    Handle Snowflake errors gracefully.
    
    Returns:
    - [] for permission/access issues
    - JSONResponse with 503 for network/timeout issues
    """
    error_msg = str(e)
    logger.warning(f"[Metadata] {context}: {error_msg}")
    
    # Network/timeout errors -> return 503 so frontend knows backend is unreachable
    if isinstance(e, (OperationalError, TimeoutError)):
        return JSONResponse(
            status_code=503,
            content={"error": "Snowflake unreachable", "detail": error_msg}
        )
    
    # Permission/access errors - return empty list instead of 500
    if isinstance(e, snowflake.connector.errors.ProgrammingError):
        error_code = getattr(e, 'errno', None)
        # Common permission-related error codes
        # 2003: Object does not exist or not authorized
        # 2043: Insufficient privileges
        # 90105: Cannot perform operation
        if error_code in (2003, 2043, 90105) or 'does not exist' in error_msg.lower() or 'not authorized' in error_msg.lower():
            return []
    
    # For other errors, still return empty list but log it
    # This prevents the UI from breaking on edge cases
    return []


@router.get("/databases", response_model=List[DatabaseInfo])
async def list_databases(
    refresh: bool = False,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
):
    """List all accessible databases."""
    session = _get_session_or_none(x_session_id)
    if not session:
        return []
    
    # Check cache first
    if not refresh:
        cached = metadata_cache.get_databases()
        if cached:
            return cached
    
    try:
        cursor = session.conn.cursor()
        cursor.execute("SHOW DATABASES")
        
        databases = []
        for row in cursor.fetchall():
            databases.append({
                "name": row[1],  # name is typically second column
                "owner": row[4] if len(row) > 4 else None,
                "created": str(row[9]) if len(row) > 9 else None,
                "comment": row[8] if len(row) > 8 else None
            })
        cursor.close()
        
        metadata_cache.set_databases(databases)
        return [DatabaseInfo(**db) for db in databases]
    except Exception as e:
        return _handle_snowflake_error(e, "list_databases")


@router.get("/schemas", response_model=List[SchemaInfo])
async def list_schemas(
    database: str = Query(..., description="Database name"),
    refresh: bool = False,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
):
    """List all schemas in a database."""
    session = _get_session_or_none(x_session_id)
    if not session:
        return []
    
    # Check cache first
    if not refresh:
        cached = metadata_cache.get_schemas(database)
        if cached:
            return cached
    
    try:
        safe_db = _validate_identifier(database)
        cursor = session.conn.cursor()
        cursor.execute(f"SHOW SCHEMAS IN DATABASE {safe_db}")
        
        schemas = []
        for row in cursor.fetchall():
            schemas.append({
                "name": row[1],
                "database": database,
                "owner": row[4] if len(row) > 4 else None,
                "comment": row[7] if len(row) > 7 else None
            })
        cursor.close()
        
        metadata_cache.set_schemas(database, schemas)
        return [SchemaInfo(**s) for s in schemas]
    except Exception as e:
        return _handle_snowflake_error(e, f"list_schemas({database})")


@router.get("/tables", response_model=List[TableInfo])
async def list_tables(
    database: str = Query(..., description="Database name"),
    schema: str = Query(..., description="Schema name"),
    refresh: bool = False,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
):
    """List all tables and views in a schema."""
    session = _get_session_or_none(x_session_id)
    if not session:
        return []
    
    # Check cache first
    if not refresh:
        cached = metadata_cache.get_tables(database, schema)
        if cached:
            return cached
    
    try:
        safe_db = _validate_identifier(database)
        safe_schema = _validate_identifier(schema)
        cursor = session.conn.cursor()
        cursor.execute(f"SHOW TABLES IN {safe_db}.{safe_schema}")
        
        tables = []
        for row in cursor.fetchall():
            tables.append({
                "name": row[1],
                "database": database,
                "schema": schema,
                "kind": "TABLE",
                "owner": row[4] if len(row) > 4 else None,
                "row_count": row[6] if len(row) > 6 else None,
                "comment": row[8] if len(row) > 8 else None
            })
        cursor.close()
        
        # Also get views
        cursor = session.conn.cursor()
        cursor.execute(f"SHOW VIEWS IN {safe_db}.{safe_schema}")
        
        for row in cursor.fetchall():
            tables.append({
                "name": row[1],
                "database": database,
                "schema": schema,
                "kind": "VIEW",
                "owner": row[4] if len(row) > 4 else None,
                "comment": row[7] if len(row) > 7 else None
            })
        cursor.close()
        
        metadata_cache.set_tables(database, schema, tables)
        logger.info(f"[Metadata] list_tables({database}.{schema}): Found {len(tables)} tables/views")
        
        # Create TableInfo models - wrap in try/except to see validation errors
        result = []
        for t in tables:
            try:
                result.append(TableInfo(**t))
            except Exception as ve:
                logger.warning(f"[Metadata] Validation error for table {t.get('name')}: {ve}")
        
        return result
    except Exception as e:
        return _handle_snowflake_error(e, f"list_tables({database}.{schema})")


@router.get("/columns", response_model=List[ColumnInfo])
async def list_columns(
    database: str = Query(..., description="Database name"),
    schema: str = Query(..., description="Schema name"),
    table: str = Query(..., description="Table name"),
    refresh: bool = False,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
):
    """Get column metadata for a table."""
    session = _get_session_or_none(x_session_id)
    if not session:
        return []
    
    # Check cache first
    if not refresh:
        cached = metadata_cache.get_columns(database, schema, table)
        if cached:
            return cached
    
    try:
        safe_db = _validate_identifier(database)
        safe_schema = _validate_identifier(schema)
        safe_table = _validate_identifier(table)
        
        cursor = session.conn.cursor()
        cursor.execute(f"DESCRIBE TABLE {safe_db}.{safe_schema}.{safe_table}")
        
        columns = []
        for row in cursor.fetchall():
            columns.append({
                "name": row[0],
                "type": row[1],
                "kind": "COLUMN",
                "nullable": row[3] == 'Y' if len(row) > 3 else True,
                "default": row[4] if len(row) > 4 else None,
                "primary_key": row[5] == 'Y' if len(row) > 5 else False,
                "unique_key": row[6] == 'Y' if len(row) > 6 else False,
                "comment": row[8] if len(row) > 8 else None
            })
        cursor.close()
        
        metadata_cache.set_columns(database, schema, table, columns)
        return [ColumnInfo(**c) for c in columns]
    except Exception as e:
        return _handle_snowflake_error(e, f"list_columns({database}.{schema}.{table})")


@router.post("/refresh")
async def refresh_cache(
    database: str = None,
    schema: str = None,
    table: str = None
):
    """Manually refresh cached metadata."""
    if table and schema and database:
        metadata_cache.clear_columns(database, schema, table)
    elif schema and database:
        metadata_cache.clear_tables(database, schema)
    elif database:
        metadata_cache.clear_schemas(database)
    else:
        metadata_cache.clear_all()
    
    return {"message": "Cache cleared", "scope": {
        "database": database,
        "schema": schema,
        "table": table
    }}

```

## backend/app/routers/query.py

```python
"""Query execution endpoints with session support."""

import logging
import re
import time
import uuid
from datetime import datetime
from typing import Optional, List, Tuple
from contextlib import contextmanager
from fastapi import APIRouter, HTTPException, Query as QueryParam, Header
from fastapi.responses import JSONResponse
from snowflake.connector.errors import DatabaseError, OperationalError, ProgrammingError

from app.models.schemas import (
    QueryRequest, QuerySubmitResponse, QueryStatusResponse,
    QueryResultsResponse, QueryHistoryResponse, QueryHistoryItem,
    QueryStatus, CancelQueryResponse,
    PreflightRequest, PreflightResponse, TableCheckResult, TableSuggestion,
    QueryValidationRequest, QueryValidationResult,
    BatchValidationRequest, BatchValidationResponse,
    QueryExplanationRequest, QueryExplanationResponse, QueryExplanationStep
)
from app.services.session import session_manager
from app.database import query_history_db
from app.utils.logger import logger, generate_request_id, set_request_id

router = APIRouter(prefix="/api/query", tags=["query"])

# =============================================================================
# Constants and Pre-compiled Patterns
# =============================================================================

# Maximum number of query results to store per session (LRU eviction)
MAX_STORED_QUERIES = 50

# Pre-compiled regex patterns for performance (avoid recompiling on each call)
BLOCK_COMMENT_PATTERN = re.compile(r'/\*.*?\*/', re.DOTALL)
LINE_COMMENT_PATTERN = re.compile(r'--.*?$', re.MULTILINE)
FULL_TABLE_PATTERN = re.compile(
    r'(?:FROM|JOIN)\s+([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)',
    re.IGNORECASE
)
PARTIAL_TABLE_PATTERN = re.compile(
    r'(?:FROM|JOIN)\s+([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)(?!\.)',
    re.IGNORECASE
)
BARE_TABLE_PATTERN = re.compile(
    r'(?:FROM|JOIN)\s+([A-Za-z_][A-Za-z0-9_]*)(?!\.)',
    re.IGNORECASE
)
SQL_KEYWORDS = frozenset({
    'SELECT', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'AS', 'ON',
    'LEFT', 'RIGHT', 'INNER', 'OUTER', 'CROSS'
})


@contextmanager
def get_cursor(session):
    """Context manager for safe cursor handling - ensures cleanup."""
    cursor = session.conn.cursor()
    try:
        yield cursor
    finally:
        try:
            cursor.close()
        except Exception as e:
            logger.warning(f"Failed to close cursor: {e}")


def _split_sql_statements(sql: str) -> List[str]:
    """
    Split SQL into individual statements, handling:
    - Single-line comments (-- ...)
    - Block comments (/* ... */)
    - String literals ('...' and "...")
    - Semicolons as statement separators
    
    Returns list of non-empty statements.
    """
    # Remove block comments (using pre-compiled pattern)
    sql = BLOCK_COMMENT_PATTERN.sub('', sql)
    
    # Remove single-line comments (using pre-compiled pattern)
    sql = LINE_COMMENT_PATTERN.sub('', sql)
    
    # Split on semicolons (simple approach - works for most cases)
    # For production, consider a proper SQL parser
    statements = []
    current = []
    in_string = False
    string_char = None
    
    for char in sql:
        if char in ("'", '"') and not in_string:
            in_string = True
            string_char = char
            current.append(char)
        elif char == string_char and in_string:
            in_string = False
            string_char = None
            current.append(char)
        elif char == ';' and not in_string:
            stmt = ''.join(current).strip()
            if stmt:
                statements.append(stmt)
            current = []
        else:
            current.append(char)
    
    # Don't forget the last statement (may not end with ;)
    stmt = ''.join(current).strip()
    if stmt:
        statements.append(stmt)
    
    return statements


def _count_statements(sql: str) -> int:
    """Count the number of SQL statements."""
    return len(_split_sql_statements(sql))


def _extract_tables_from_sql(sql: str) -> List[Tuple[str, str, str]]:
    """
    Extract table references from SQL.
    Returns list of (database, schema, table) tuples.
    Uses pre-compiled patterns for better performance.
    """
    # Remove comments using pre-compiled patterns
    clean_sql = LINE_COMMENT_PATTERN.sub('', sql)
    clean_sql = BLOCK_COMMENT_PATTERN.sub('', clean_sql)
    
    tables = []
    
    # Pattern for fully qualified: database.schema.table
    for match in FULL_TABLE_PATTERN.finditer(clean_sql):
        tables.append((match.group(1), match.group(2), match.group(3)))
    
    # Pattern for schema.table (no database)
    for match in PARTIAL_TABLE_PATTERN.finditer(clean_sql):
        # Only add if not already captured as full reference
        schema, table = match.group(1), match.group(2)
        if not any(t[2].upper() == table.upper() for t in tables):
            tables.append((None, schema, table))
    
    # Pattern for bare table name
    for match in BARE_TABLE_PATTERN.finditer(clean_sql):
        table = match.group(1)
        if table.upper() not in SQL_KEYWORDS and not any(t[2].upper() == table.upper() for t in tables):
            tables.append((None, None, table))
    
    return tables


def _check_table_exists(cursor, database: str, schema: str, table: str) -> dict:
    """Check if a table exists and get its row count."""
    result = {
        "exists": False,
        "row_count": None,
        "columns": [],
        "error": None
    }
    
    try:
        # Try to get table info
        fqn = f'"{database}"."{schema}"."{table}"'
        cursor.execute(f"DESCRIBE TABLE {fqn}")
        columns = [row[0] for row in cursor.fetchall()]
        result["columns"] = columns
        result["exists"] = True
        
        # Get approximate row count (fast)
        cursor.execute(f"SELECT COUNT(*) FROM {fqn} LIMIT 1")
        row = cursor.fetchone()
        result["row_count"] = row[0] if row else 0
        
    except Exception as e:
        error_msg = str(e)
        if "does not exist" in error_msg.lower() or "not authorized" in error_msg.lower():
            result["exists"] = False
            result["error"] = "Table does not exist or not authorized"
        else:
            result["error"] = error_msg
    
    return result


def _find_similar_tables(cursor, database: str, schema: str, target_table: str, limit: int = 10) -> List[dict]:
    """Find similar tables that have data."""
    similar = []
    
    try:
        # Get all tables in the schema
        cursor.execute(f'SHOW TABLES IN "{database}"."{schema}"')
        tables = cursor.fetchall()
        
        target_upper = target_table.upper().replace('_ENTITY', '').replace('_', '')
        
        for row in tables:
            table_name = row[1]  # name column
            row_count = row[6] if len(row) > 6 and row[6] else 0  # row_count column
            
            # Skip empty tables
            try:
                row_count = int(row_count) if row_count else 0
            except (ValueError, TypeError):
                row_count = 0
            
            if row_count == 0:
                continue
            
            # Calculate similarity
            table_upper = table_name.upper().replace('_ENTITY', '').replace('_', '')
            
            # Exact match scores highest
            if table_upper == target_upper:
                score = 1.0
                reason = "Exact match with data"
            # Contains target
            elif target_upper in table_upper or table_upper in target_upper:
                score = 0.8
                reason = f"Similar name, has {row_count:,} rows"
            # Shared prefix (at least 4 chars)
            elif len(target_upper) >= 4 and table_upper.startswith(target_upper[:4]):
                score = 0.6
                reason = f"Same category, has {row_count:,} rows"
            # Entity table with data
            elif table_name.upper().endswith('_ENTITY') and row_count > 0:
                score = 0.3
                reason = f"Entity table with {row_count:,} rows"
            else:
                continue
            
            similar.append({
                "table_name": table_name,
                "fully_qualified": f"{database}.{schema}.{table_name}",
                "row_count": row_count,
                "relevance_score": score,
                "reason": reason
            })
        
        # Sort by score descending, then by row_count
        similar.sort(key=lambda x: (-x["relevance_score"], -x["row_count"]))
        return similar[:limit]
        
    except Exception as e:
        logger.warning(f"Failed to find similar tables: {e}")
        return []


def _generate_suggested_query(original_sql: str, replacements: dict) -> str:
    """Generate a suggested query with table replacements."""
    suggested = original_sql
    
    for original, replacement in replacements.items():
        # Try different patterns
        patterns = [
            (rf'(FROM|JOIN)\s+{re.escape(original)}\b', rf'\1 {replacement}'),
            (rf'(FROM|JOIN)\s+[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*\.{re.escape(original.split(".")[-1])}\b', rf'\1 {replacement}'),
        ]
        
        for pattern, repl in patterns:
            suggested = re.sub(pattern, repl, suggested, flags=re.IGNORECASE)
    
    return suggested


VALID_STATUSES = {s.value for s in QueryStatus}


class QueryExecutionError(Exception):
    """Base exception for query execution issues."""
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class SessionNotFoundError(QueryExecutionError):
    def __init__(self):
        super().__init__(
            "Session not found or expired. Please reconnect.",
            status_code=401
        )


def _get_session_or_401(session_id: Optional[str]):
    """Get session from header or raise 401."""
    if not session_id:
        raise HTTPException(
            status_code=401, 
            detail="X-Session-ID header required. Please connect first."
        )
    
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=401,
            detail="Session not found or expired. Please reconnect."
        )
    
    return session


def _record_query_history(
    query_id: str,
    sql: str,
    request: QueryRequest,
    status: str,
    row_count: Optional[int] = None,
    error_message: Optional[str] = None,
    execution_time_ms: Optional[int] = None
) -> None:
    """Record query to history, logging failures without raising."""
    try:
        query_history_db.add_query(
            query_id=query_id,
            sql=sql,
            database=request.database,
            schema=request.schema_name,
            warehouse=request.warehouse,
            status=status,
            row_count=row_count,
            error_message=error_message,
            started_at=datetime.utcnow().isoformat(),
            completed_at=datetime.utcnow().isoformat(),
            duration_ms=execution_time_ms
        )
    except Exception as e:
        logger.error(f"Failed to record query history for {query_id}: {e}")


@router.post("/preflight", response_model=PreflightResponse)
async def preflight_check(
    request: PreflightRequest,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
):
    """
    Check a query before execution.
    
    Validates tables exist, checks row counts, and suggests alternatives
    if tables are empty or don't exist.
    """
    session = _get_session_or_401(x_session_id)
    
    # Default database/schema from request or session
    default_db = request.database or session.database or "FIELD_METADATA"
    default_schema = request.schema_name or session.schema or "PUBLIC"
    
    # Extract tables from SQL
    tables = _extract_tables_from_sql(request.sql)
    
    if not tables:
        return PreflightResponse(
            valid=True,
            message="No tables detected in query (might be a SHOW/DESCRIBE command)",
            tables_checked=[],
            suggestions=[],
            issues=[]
        )
    
    tables_checked = []
    issues = []
    suggestions = []
    replacements = {}
    
    # Use context manager for safe cursor cleanup
    with get_cursor(session) as cursor:
        try:
            for db, schema, table in tables:
                # Resolve defaults
                resolved_db = db or default_db
                resolved_schema = schema or default_schema
                fqn = f"{resolved_db}.{resolved_schema}.{table}"
                
                # Check table
                check_result = _check_table_exists(cursor, resolved_db, resolved_schema, table)
                
                table_check = TableCheckResult(
                    table_name=table,
                    fully_qualified=fqn,
                    exists=check_result["exists"],
                    row_count=check_result["row_count"],
                    columns=check_result["columns"],
                    error=check_result["error"]
                )
                tables_checked.append(table_check)
                
                # Collect issues
                if not check_result["exists"]:
                    issues.append(f"Table '{fqn}' does not exist or you don't have access")
                    
                    # Find alternatives
                    similar = _find_similar_tables(cursor, resolved_db, resolved_schema, table)
                    for s in similar:
                        suggestions.append(TableSuggestion(**s))
                        # Use first high-scoring suggestion for replacement
                        if s["relevance_score"] >= 0.6 and fqn not in replacements:
                            replacements[fqn] = s["fully_qualified"]
                            
                elif check_result["row_count"] == 0:
                    issues.append(f"Table '{fqn}' exists but is empty (0 rows)")
                    
                    # Find alternatives with data
                    similar = _find_similar_tables(cursor, resolved_db, resolved_schema, table)
                    for s in similar:
                        suggestions.append(TableSuggestion(**s))
                        # Suggest replacement for empty tables too
                        if s["relevance_score"] >= 0.5 and fqn not in replacements:
                            replacements[fqn] = s["fully_qualified"]
            
            # Generate suggested query if we have replacements
            suggested_query = None
            if replacements:
                suggested_query = _generate_suggested_query(request.sql, replacements)
            
            # Build response message
            if not issues:
                message = f"All {len(tables_checked)} table(s) exist and have data"
                valid = True
            else:
                message = f"Found {len(issues)} issue(s) with query"
                valid = False
            
            return PreflightResponse(
                valid=valid,
                tables_checked=tables_checked,
                issues=issues,
                suggestions=suggestions,
                suggested_query=suggested_query,
                message=message
            )
            
        except Exception as e:
            logger.error(f"Preflight check failed: {e}")
            return PreflightResponse(
                valid=False,
                message=f"Preflight check failed: {str(e)}",
                issues=[str(e)]
            )


def _evict_oldest_query_results(session) -> None:
    """Evict oldest query results if over limit (LRU eviction)."""
    if not hasattr(session, 'query_results'):
        return
    
    while len(session.query_results) >= MAX_STORED_QUERIES:
        # Find oldest by completed_at timestamp
        oldest_id = None
        oldest_time = None
        
        for qid, result in session.query_results.items():
            completed_at = result.get('completed_at', '')
            if oldest_time is None or completed_at < oldest_time:
                oldest_time = completed_at
                oldest_id = qid
        
        if oldest_id:
            del session.query_results[oldest_id]
            logger.debug(f"Evicted old query result: {oldest_id}")
        else:
            break


@router.post("/execute", response_model=QuerySubmitResponse)
async def execute_query(
    request: QueryRequest,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
):
    """
    Submit a SQL query for execution.
    
    Requires X-Session-ID header from successful /api/connect.
    
    Response codes:
    - 200 { status: 'SUCCESS', ... } -> query executed successfully
    - 200 { status: 'FAILED', ... } -> SQL error (syntax, permissions, etc.)
    - 401 -> session invalid
    - 503 -> Snowflake unreachable / network error
    - 504 -> Query timed out
    """
    # Generate request ID for correlation
    req_id = generate_request_id()
    set_request_id(req_id)
    
    if not request.sql or not request.sql.strip():
        raise HTTPException(status_code=400, detail="SQL query cannot be empty")
    
    session = _get_session_or_401(x_session_id)
    query_id = str(uuid.uuid4())
    start_time = time.time()
    
    # Initialize query_results if needed
    if not hasattr(session, 'query_results'):
        session.query_results = {}
    
    # LRU eviction: remove oldest results if at capacity
    _evict_oldest_query_results(session)
    
    # Use context manager for safe cursor cleanup
    with get_cursor(session) as cursor:
        try:
            # Set statement timeout from request (default 60s)
            timeout_seconds = request.timeout or 60
            cursor.execute(f"ALTER SESSION SET STATEMENT_TIMEOUT_IN_SECONDS = {timeout_seconds}")
            
            # Set query tag for correlation in Snowflake query history
            query_tag = f"MDLH:{req_id}"
            cursor.execute(f"ALTER SESSION SET QUERY_TAG = '{query_tag}'")
            
            logger.info(f"[{req_id}] Executing query with {timeout_seconds}s timeout")
            
            # Count statements (properly handles comments and strings)
            statement_count = _count_statements(request.sql)
            
            # Execute query (enable multi-statement if needed)
            columns = []
            rows = []
            
            if statement_count > 1:
                logger.info(f"[{req_id}] Executing {statement_count} statements")
                cursor.execute(request.sql, num_statements=statement_count)
                
                # For multi-statement, collect results from each statement
                # Keep the last non-empty result set (usually the SELECT/SHOW)
                while True:
                    if cursor.description:
                        current_columns = [desc[0] for desc in cursor.description]
                        current_rows = cursor.fetchall()
                        # Keep results if this statement returned rows
                        if current_rows or not rows:
                            columns = current_columns
                            rows = [list(row) for row in current_rows]
                            logger.info(f"[{req_id}] Statement returned {len(rows)} rows, {len(columns)} columns")
                    
                    # Move to next result set, break if none left
                    if not cursor.nextset():
                        break
            else:
                cursor.execute(request.sql)
                columns = [desc[0] for desc in cursor.description] if cursor.description else []
                rows = cursor.fetchall()
                rows = [list(row) for row in rows]
            
            execution_time_ms = int((time.time() - start_time) * 1000)
            
            # Store results in session for retrieval
            session.query_results[query_id] = {
                "columns": columns,
                "rows": rows,
                "row_count": len(rows),
                "status": QueryStatus.SUCCESS,
                "execution_time_ms": execution_time_ms,
                "started_at": datetime.utcnow().isoformat(),
                "completed_at": datetime.utcnow().isoformat()
            }
            
            _record_query_history(
                query_id, request.sql, request,
                QueryStatus.SUCCESS, len(rows), None, execution_time_ms
            )
            
            logger.info(f"[{req_id}] Query SUCCESS: {len(rows)} rows in {execution_time_ms}ms")
            
            return QuerySubmitResponse(
                query_id=query_id,
                status=QueryStatus.SUCCESS,
                message="Query executed successfully",
                execution_time_ms=execution_time_ms,
                row_count=len(rows)
            )
            
        except (OperationalError, TimeoutError) as e:
            # Network errors or timeouts -> 503 or 504
            execution_time_ms = int((time.time() - start_time) * 1000)
            error_msg = str(e).lower()
            
            # Check if it's a statement timeout
            if "timeout" in error_msg or "statement canceled" in error_msg:
                logger.warning(f"[{req_id}] Query TIMEOUT after {execution_time_ms}ms: {e}")
                return JSONResponse(
                    status_code=504,
                    content={
                        "query_id": query_id,
                        "status": "TIMEOUT",
                        "message": f"Query exceeded {timeout_seconds}s timeout",
                        "execution_time_ms": execution_time_ms
                    }
                )
            
            # Network/connection error -> 503
            logger.error(f"[{req_id}] Snowflake UNREACHABLE: {e}")
            return JSONResponse(
                status_code=503,
                content={
                    "query_id": query_id,
                    "status": "FAILED",
                    "message": "Snowflake unreachable",
                    "error": str(e),
                    "execution_time_ms": execution_time_ms
                }
            )
            
        except (DatabaseError, ProgrammingError) as e:
            # SQL errors (syntax, permissions, etc.) -> normal failure response
            execution_time_ms = int((time.time() - start_time) * 1000)
            error_msg = str(e)
            
            # Store failure info
            session.query_results[query_id] = {
                "status": QueryStatus.FAILED,
                "error_message": error_msg,
                "execution_time_ms": execution_time_ms,
                "started_at": datetime.utcnow().isoformat(),
                "completed_at": datetime.utcnow().isoformat()
            }
            
            _record_query_history(
                query_id, request.sql, request,
                QueryStatus.FAILED, None, error_msg, execution_time_ms
            )
            
            logger.warning(f"[{req_id}] Query FAILED: {error_msg[:100]}")
            
            return QuerySubmitResponse(
                query_id=query_id,
                status=QueryStatus.FAILED,
                message=error_msg,
                execution_time_ms=execution_time_ms
            )
            
        except Exception as e:
            execution_time_ms = int((time.time() - start_time) * 1000)
            error_msg = str(e)
            
            # Store failure info
            session.query_results[query_id] = {
                "status": QueryStatus.FAILED,
                "error_message": error_msg,
                "execution_time_ms": execution_time_ms,
                "started_at": datetime.utcnow().isoformat(),
                "completed_at": datetime.utcnow().isoformat()
            }
            
            _record_query_history(
                query_id, request.sql, request,
                QueryStatus.FAILED, None, error_msg, execution_time_ms
            )
            
            logger.error(f"[{req_id}] Unexpected error: {e}")
            
            return QuerySubmitResponse(
                query_id=query_id,
                status=QueryStatus.FAILED,
                message=error_msg,
                execution_time_ms=execution_time_ms
            )


@router.get("/{query_id}/status", response_model=QueryStatusResponse)
async def get_query_status(
    query_id: str,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
):
    """Get the status of a query."""
    session = _get_session_or_401(x_session_id)
    
    if not hasattr(session, 'query_results') or query_id not in session.query_results:
        raise HTTPException(status_code=404, detail=f"Query '{query_id}' not found")
    
    result = session.query_results[query_id]
    return QueryStatusResponse(
        query_id=query_id,
        status=result["status"],
        row_count=result.get("row_count"),
        execution_time_ms=result.get("execution_time_ms"),
        error_message=result.get("error_message"),
        started_at=result.get("started_at"),
        completed_at=result.get("completed_at")
    )


@router.get("/{query_id}/results", response_model=QueryResultsResponse)
async def get_query_results(
    query_id: str,
    page: int = QueryParam(1, ge=1, description="Page number"),
    page_size: int = QueryParam(100, ge=1, le=1000, description="Results per page"),
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
):
    """Get paginated results for a completed query."""
    session = _get_session_or_401(x_session_id)
    
    if not hasattr(session, 'query_results') or query_id not in session.query_results:
        raise HTTPException(status_code=404, detail=f"Query '{query_id}' not found")
    
    result = session.query_results[query_id]
    
    if result["status"] == QueryStatus.FAILED:
        raise HTTPException(
            status_code=400,
            detail=f"Query failed: {result.get('error_message', 'Unknown error')}"
        )
    
    if result["status"] == QueryStatus.RUNNING:
        raise HTTPException(status_code=202, detail="Query is still running")
    
    rows = result.get("rows", [])
    columns = result.get("columns", [])
    
    # Paginate
    start = (page - 1) * page_size
    end = start + page_size
    paginated_rows = rows[start:end]
    
    return QueryResultsResponse(
        columns=columns,
        rows=paginated_rows,
        total_rows=len(rows),
        page=page,
        page_size=page_size,
        has_more=end < len(rows)
    )


@router.post("/{query_id}/cancel", response_model=CancelQueryResponse)
async def cancel_query(
    query_id: str,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
):
    """Cancel a running query."""
    session = _get_session_or_401(x_session_id)
    
    if not hasattr(session, 'query_results') or query_id not in session.query_results:
        raise HTTPException(status_code=404, detail=f"Query '{query_id}' not found")
    
    result = session.query_results[query_id]
    
    if result["status"] != QueryStatus.RUNNING:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel query with status '{result['status']}'"
        )
    
    # Mark as cancelled
    result["status"] = QueryStatus.CANCELLED
    result["completed_at"] = datetime.utcnow().isoformat()
    
    return CancelQueryResponse(message="Query cancelled", query_id=query_id)


@router.get("/history", response_model=QueryHistoryResponse)
async def get_query_history(
    limit: int = QueryParam(50, ge=1, le=200, description="Number of queries to return"),
    offset: int = QueryParam(0, ge=0, description="Offset for pagination"),
    status: Optional[str] = QueryParam(None, description="Filter by status")
):
    """Get query execution history."""
    if status is not None and status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status filter '{status}'. Valid: {', '.join(sorted(VALID_STATUSES))}"
        )
    
    items, total = query_history_db.get_history(limit, offset, status)
    return QueryHistoryResponse(
        items=[QueryHistoryItem(**item) for item in items],
        total=total,
        limit=limit,
        offset=offset
    )


@router.delete("/history", response_model=dict)
async def clear_query_history():
    """Clear all query history."""
    query_history_db.clear_history()
    return {"message": "Query history cleared"}


# =============================================================================
# Batch Validation Endpoints
# =============================================================================

def _explain_sql_clause(clause_type: str, sql_snippet: str) -> Tuple[str, Optional[str]]:
    """Generate plain English explanation for a SQL clause."""
    explanations = {
        "SELECT": (
            f"**Choosing columns to display**: This tells the database which columns (fields) to include in the results.",
            "Tip: Use SELECT * to get all columns, or list specific ones like SELECT name, email"
        ),
        "FROM": (
            f"**Specifying the data source**: This tells the database which table to query.",
            "Tip: Tables in MDLH end with _ENTITY (e.g., TABLE_ENTITY stores info about tables)"
        ),
        "WHERE": (
            f"**Filtering rows**: Only rows matching these conditions will be included.",
            "Tip: Use AND to combine conditions, OR for alternatives"
        ),
        "ORDER BY": (
            f"**Sorting results**: Arranges rows in a specific order.",
            "Tip: Add DESC for descending order (newest/highest first)"
        ),
        "LIMIT": (
            f"**Restricting row count**: Only returns this many rows maximum.",
            "Tip: Start with LIMIT 10 to preview data before running large queries"
        ),
        "GROUP BY": (
            f"**Grouping data**: Combines rows with the same values for aggregation.",
            "Tip: Use with COUNT(), SUM(), AVG() to get statistics"
        ),
        "JOIN": (
            f"**Combining tables**: Connects data from multiple tables.",
            "Tip: JOIN connects tables using a common column (usually GUID)"
        ),
        "WITH": (
            f"**Creating a temporary result set**: Defines a named subquery for reuse.",
            "Tip: CTEs (WITH clauses) make complex queries more readable"
        ),
    }
    
    return explanations.get(clause_type, (f"SQL clause: {clause_type}", None))


def _parse_sql_for_explanation(sql: str) -> List[QueryExplanationStep]:
    """Parse SQL and generate step-by-step explanation."""
    steps = []
    step_num = 1
    
    # Clean up SQL
    clean_sql = re.sub(r'--[^\n]*', '', sql)  # Remove single-line comments
    clean_sql = re.sub(r'/\*.*?\*/', '', clean_sql, flags=re.DOTALL)  # Remove block comments
    clean_sql = ' '.join(clean_sql.split())  # Normalize whitespace
    
    # Pattern to find main clauses
    clause_patterns = [
        (r'\bWITH\s+(\w+)\s+AS\s*\(', 'WITH'),
        (r'\bSELECT\s+(.*?)(?=\bFROM\b|$)', 'SELECT'),
        (r'\bFROM\s+([\w."]+(?:\s*,\s*[\w."]+)*)', 'FROM'),
        (r'\b(LEFT|RIGHT|INNER|OUTER|CROSS)?\s*JOIN\s+([\w."]+)', 'JOIN'),
        (r'\bWHERE\s+(.*?)(?=\bGROUP BY\b|\bORDER BY\b|\bLIMIT\b|\bHAVING\b|$)', 'WHERE'),
        (r'\bGROUP BY\s+(.*?)(?=\bHAVING\b|\bORDER BY\b|\bLIMIT\b|$)', 'GROUP BY'),
        (r'\bHAVING\s+(.*?)(?=\bORDER BY\b|\bLIMIT\b|$)', 'HAVING'),
        (r'\bORDER BY\s+(.*?)(?=\bLIMIT\b|$)', 'ORDER BY'),
        (r'\bLIMIT\s+(\d+)', 'LIMIT'),
    ]
    
    for pattern, clause_type in clause_patterns:
        match = re.search(pattern, clean_sql, re.IGNORECASE | re.DOTALL)
        if match:
            snippet = match.group(0)[:100] + ('...' if len(match.group(0)) > 100 else '')
            explanation, tip = _explain_sql_clause(clause_type, snippet)
            
            steps.append(QueryExplanationStep(
                step_number=step_num,
                clause=clause_type,
                sql_snippet=snippet.strip(),
                explanation=explanation,
                tip=tip
            ))
            step_num += 1
    
    return steps


def _generate_query_summary(sql: str, tables: List[str], columns: List[str]) -> str:
    """Generate a one-line summary of what the query does."""
    table_str = tables[0] if len(tables) == 1 else f"{len(tables)} tables"
    
    if 'COUNT(*)' in sql.upper() or 'COUNT(' in sql.upper():
        return f"Counts records in {table_str}"
    elif 'SUM(' in sql.upper() or 'AVG(' in sql.upper():
        return f"Calculates statistics from {table_str}"
    elif 'GROUP BY' in sql.upper():
        return f"Groups and summarizes data from {table_str}"
    elif 'JOIN' in sql.upper():
        return f"Combines data from {table_str} based on matching values"
    elif len(columns) == 1 and columns[0] == '*':
        return f"Retrieves all columns from {table_str}"
    else:
        return f"Retrieves {len(columns)} columns from {table_str}"


def _execute_and_sample(cursor, sql: str, sample_limit: int = 3) -> dict:
    """Execute a query and return sample results."""
    result = {
        "success": False,
        "row_count": 0,
        "columns": [],
        "sample_data": [],
        "execution_time_ms": 0,
        "error_message": None
    }
    
    try:
        start = time.time()
        cursor.execute(sql)
        
        columns = [desc[0] for desc in cursor.description] if cursor.description else []
        rows = cursor.fetchall()
        
        result["success"] = True
        result["row_count"] = len(rows)
        result["columns"] = columns
        result["execution_time_ms"] = int((time.time() - start) * 1000)
        
        # Convert sample rows to dicts
        for row in rows[:sample_limit]:
            row_dict = {}
            for i, col in enumerate(columns):
                val = row[i]
                # Convert non-JSON-serializable types
                if isinstance(val, (datetime,)):
                    val = val.isoformat()
                elif isinstance(val, bytes):
                    val = val.decode('utf-8', errors='replace')
                row_dict[col] = val
            result["sample_data"].append(row_dict)
            
    except Exception as e:
        result["error_message"] = str(e)
        result["success"] = False
    
    return result


@router.post("/validate-batch", response_model=BatchValidationResponse)
async def validate_batch(
    request: BatchValidationRequest,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
):
    """
    Validate multiple queries at once.
    
    For each query:
    - Executes it to check if it works
    - Returns row count and sample data
    - If empty/failed, suggests a working alternative
    """
    session = _get_session_or_401(x_session_id)
    
    default_db = request.database or session.database or "FIELD_METADATA"
    default_schema = request.schema_name or session.schema or "PUBLIC"
    
    results = []
    summary = {"success": 0, "empty": 0, "error": 0}
    
    # Use context manager for safe cursor cleanup
    with get_cursor(session) as cursor:
        try:
            for query_req in request.queries:
                sql = query_req.sql.strip()
                
                # Execute the query
                exec_result = _execute_and_sample(
                    cursor, sql, 
                    request.sample_limit if request.include_samples else 0
                )
                
                # Determine status
                if exec_result["error_message"]:
                    status = "error"
                    summary["error"] += 1
                elif exec_result["row_count"] == 0:
                    status = "empty"
                    summary["empty"] += 1
                else:
                    status = "success"
                    summary["success"] += 1
                
                # Build result
                validation_result = QueryValidationResult(
                    query_id=query_req.query_id,
                    status=status,
                    row_count=exec_result["row_count"],
                    sample_data=exec_result["sample_data"] if request.include_samples else None,
                    columns=exec_result["columns"],
                    execution_time_ms=exec_result["execution_time_ms"],
                    error_message=exec_result["error_message"]
                )
                
                # If failed or empty, try to find alternative
                if status in ("error", "empty"):
                    # Extract table name from query
                    tables = _extract_tables_from_sql(sql)
                    if tables:
                        db, schema, table = tables[0]
                        resolved_db = db or default_db
                        resolved_schema = schema or default_schema
                        
                        # Find similar tables with data
                        similar = _find_similar_tables(
                            cursor, resolved_db, resolved_schema, table, limit=5
                        )
                        
                        if similar:
                            # Generate suggested query using first table with data
                            best = similar[0]
                            suggested_sql = re.sub(
                                rf'(FROM|JOIN)\s+[\w."]*{re.escape(table)}\b',
                                rf'\1 {best["fully_qualified"]}',
                                sql,
                                flags=re.IGNORECASE
                            )
                            
                            # Verify suggested query works
                            suggested_result = _execute_and_sample(cursor, suggested_sql, 3)
                            
                            if suggested_result["success"] and suggested_result["row_count"] > 0:
                                validation_result.suggested_query = suggested_sql
                                validation_result.suggested_query_result = {
                                    "row_count": suggested_result["row_count"],
                                    "sample_data": suggested_result["sample_data"],
                                    "columns": suggested_result["columns"]
                                }
                
                results.append(validation_result)
            
        except Exception as e:
            logger.error(f"Batch validation failed: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    return BatchValidationResponse(
        results=results,
        summary=summary,
        validated_at=datetime.utcnow().isoformat()
    )


@router.post("/explain", response_model=QueryExplanationResponse)
async def explain_query(
    request: QueryExplanationRequest,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
):
    """
    Explain a SQL query in plain English.
    
    Breaks down the query into steps with explanations suitable for SQL beginners.
    Optionally executes the query and shows sample results.
    """
    session = _get_session_or_401(x_session_id) if request.include_execution else None
    
    sql = request.sql.strip()
    
    # Parse SQL structure
    steps = _parse_sql_for_explanation(sql)
    
    # Extract tables and columns
    tables = _extract_tables_from_sql(sql)
    table_names = [f"{t[0] or ''}.{t[1] or ''}.{t[2]}".strip('.') for t in tables]
    
    # Extract selected columns
    select_match = re.search(r'SELECT\s+(.*?)\s+FROM', sql, re.IGNORECASE | re.DOTALL)
    if select_match:
        cols_str = select_match.group(1)
        if cols_str.strip() == '*':
            columns = ['*']
        else:
            columns = [c.strip().split()[-1] for c in cols_str.split(',')]
    else:
        columns = []
    
    # Generate summary
    summary = _generate_query_summary(sql, table_names, columns)
    
    # Format SQL nicely
    formatted = sql
    for keyword in ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'ORDER BY', 'GROUP BY', 'LIMIT', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN']:
        formatted = re.sub(rf'\b({keyword})\b', rf'\n\1', formatted, flags=re.IGNORECASE)
    formatted = formatted.strip()
    
    response = QueryExplanationResponse(
        original_sql=sql,
        formatted_sql=formatted,
        steps=steps,
        summary=summary,
        tables_used=table_names,
        columns_selected=columns
    )
    
    # Execute if requested
    if request.include_execution and session:
        with get_cursor(session) as cursor:
            exec_result = _execute_and_sample(cursor, sql, 5)
            
            response.executed = True
            response.row_count = exec_result["row_count"]
            response.sample_data = exec_result["sample_data"]
            response.execution_time_ms = exec_result["execution_time_ms"]
            response.error_message = exec_result["error_message"]
    
    return response

```

## backend/app/routers/system.py

```python
"""
System Configuration Router

Provides the /api/system/config endpoint that returns a SystemConfig
describing the available metadata tables, features, and catalog for the session.

This is the SINGLE SOURCE OF TRUTH for what's available in this Snowflake environment.
All query flows and wizards use this config to adapt per environment.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
import logging

from ..utils.logger import get_logger

router = APIRouter(prefix="/api/system", tags=["system"])
logger = get_logger("system")

# In-memory cache of SystemConfig per session
SYSTEM_CONFIG_CACHE: Dict[str, dict] = {}


# ============================================
# Models
# ============================================

class EntityLocation(BaseModel):
    """Physical location of a metadata entity table."""
    database: str
    schema_name: str  # 'schema' is reserved in Pydantic
    table: str


class CatalogTable(BaseModel):
    """A table in the catalog."""
    db: str
    schema_name: str
    name: str


class Features(BaseModel):
    """Feature flags based on available metadata."""
    lineage: bool = False
    glossary: bool = False
    queryHistory: bool = False
    biUsage: bool = False
    dbt: bool = False
    governance: bool = False


class QueryDefaults(BaseModel):
    """Default query settings."""
    metadataDb: str = "FIELD_METADATA"
    metadataSchema: str = "PUBLIC"
    defaultRowLimit: int = 10000
    defaultTimeoutSec: int = 60


class SystemConfig(BaseModel):
    """
    Full system configuration for a session.
    
    This is built by running read-only discovery queries against Snowflake
    and determines what features are available and how to query metadata.
    """
    snowflake: Dict[str, Any]  # entities map
    queryDefaults: QueryDefaults
    features: Features
    catalog: Dict[str, List[Any]]


# ============================================
# Known Logical Entities
# ============================================

# These are the logical entity names we look for.
# The discovery process tries to find tables matching these names.
KNOWN_ENTITIES = [
    "PROCESS_ENTITY",
    "COLUMNPROCESS_ENTITY",
    "BIPROCESS_ENTITY",
    "DBTPROCESS_ENTITY",
    "TABLE_ENTITY",
    "VIEW_ENTITY",
    "COLUMN_ENTITY",
    "DATABASE_ENTITY",
    "SCHEMA_ENTITY",
    "ATLASGLOSSARY_ENTITY",
    "ATLASGLOSSARYTERM_ENTITY",
    "ATLASGLOSSARYCATEGORY_ENTITY",
    "SIGMADATAELEMENT_ENTITY",
    "DBTMODEL_ENTITY",
    "DBTSOURCE_ENTITY",
    "POWERBIWORKSPACE_ENTITY",
    "POWERBIDASHBOARD_ENTITY",
    "POWERBIREPORT_ENTITY",
    "TABLEAUDASHBOARD_ENTITY",
    "LOOKEREXPLORE_ENTITY",
    "QUERY_ENTITY",
]


# ============================================
# Discovery Logic (READ-ONLY)
# ============================================

def build_system_config(conn, session_id: str) -> dict:
    """
    Build the SystemConfig by running read-only discovery queries.
    
    This function:
    1. Discovers metadata tables (*_ENTITY, glossary tables)
    2. Builds a mapping of logical entity names to physical locations
    3. Determines which features are available
    4. Builds a lightweight table catalog for suggestions
    
    Args:
        conn: Snowflake connection
        session_id: Session ID for logging
        
    Returns:
        SystemConfig as a dict
    """
    logger.info(f"[{session_id}] Building system config via read-only discovery")
    
    entities: Dict[str, dict] = {}
    catalog_tables: List[dict] = []
    
    # Default metadata location (will be updated if we find PROCESS_ENTITY)
    metadata_db = "FIELD_METADATA"
    metadata_schema = "PUBLIC"
    
    try:
        cursor = conn.cursor()
        
        # Step 1: Discover *_ENTITY tables
        logger.info(f"[{session_id}] Discovering metadata tables...")
        
        try:
            cursor.execute("""
                SELECT table_catalog, table_schema, table_name
                FROM information_schema.tables
                WHERE table_name LIKE '%_ENTITY'
                  AND table_schema NOT IN ('INFORMATION_SCHEMA')
                ORDER BY table_name
                LIMIT 500
            """)
            
            entity_rows = cursor.fetchall()
            logger.info(f"[{session_id}] Found {len(entity_rows)} *_ENTITY tables")
            
            # Build a lookup: table_name.upper() -> (db, schema, table)
            found_entities: Dict[str, tuple] = {}
            for row in entity_rows:
                db, schema, table = row
                key = table.upper()
                if key not in found_entities:
                    found_entities[key] = (db, schema, table)
            
            # Match known logical entities
            for logical_name in KNOWN_ENTITIES:
                key = logical_name.upper()
                if key in found_entities:
                    db, schema, table = found_entities[key]
                    entities[logical_name] = {
                        "database": db,
                        "schema": schema,
                        "table": table
                    }
                    logger.debug(f"[{session_id}] Matched {logical_name} -> {db}.{schema}.{table}")
            
            # Also add any other *_ENTITY tables we found
            for table_name, (db, schema, table) in found_entities.items():
                if table_name not in [k.upper() for k in entities.keys()]:
                    entities[table] = {
                        "database": db,
                        "schema": schema,
                        "table": table
                    }
            
            # Update metadata location based on PROCESS_ENTITY
            if "PROCESS_ENTITY" in entities:
                proc = entities["PROCESS_ENTITY"]
                metadata_db = proc["database"]
                metadata_schema = proc["schema"]
                logger.info(f"[{session_id}] Using metadata location from PROCESS_ENTITY: {metadata_db}.{metadata_schema}")
            else:
                logger.warning(f"[{session_id}] PROCESS_ENTITY not found, using default: {metadata_db}.{metadata_schema}")
                
        except Exception as e:
            logger.warning(f"[{session_id}] Entity discovery failed: {e}")
        
        # Step 2: Discover glossary tables (legacy names)
        try:
            cursor.execute("""
                SELECT table_catalog, table_schema, table_name
                FROM information_schema.tables
                WHERE table_name IN ('ATLASGLOSSARY', 'ATLASGLOSSARYTERM', 'ATLASGLOSSARYCATEGORY')
                  AND table_schema NOT IN ('INFORMATION_SCHEMA')
                LIMIT 10
            """)
            
            glossary_rows = cursor.fetchall()
            for row in glossary_rows:
                db, schema, table = row
                # Use the table name as the logical name
                entities[table] = {
                    "database": db,
                    "schema": schema,
                    "table": table
                }
                logger.debug(f"[{session_id}] Found glossary table: {db}.{schema}.{table}")
                
        except Exception as e:
            logger.warning(f"[{session_id}] Glossary discovery failed: {e}")
        
        # Step 3: Build table catalog
        logger.info(f"[{session_id}] Building table catalog...")
        
        try:
            cursor.execute("""
                SELECT table_catalog, table_schema, table_name
                FROM information_schema.tables
                WHERE table_type = 'BASE TABLE'
                  AND table_schema NOT IN ('INFORMATION_SCHEMA')
                ORDER BY table_catalog, table_schema, table_name
                LIMIT 1000
            """)
            
            table_rows = cursor.fetchall()
            for row in table_rows:
                db, schema, table = row
                catalog_tables.append({
                    "db": db,
                    "schema": schema,
                    "name": table
                })
            
            logger.info(f"[{session_id}] Catalog contains {len(catalog_tables)} tables")
            
        except Exception as e:
            logger.warning(f"[{session_id}] Table catalog discovery failed: {e}")
        
        cursor.close()
        
    except Exception as e:
        logger.error(f"[{session_id}] Discovery error: {e}")
    
    # Step 4: Determine feature flags
    features = determine_features(entities)
    logger.info(f"[{session_id}] Features: lineage={features.lineage}, glossary={features.glossary}, dbt={features.dbt}")
    
    # Build the config
    config = {
        "snowflake": {
            "entities": entities
        },
        "queryDefaults": {
            "metadataDb": metadata_db,
            "metadataSchema": metadata_schema,
            "defaultRowLimit": 10000,
            "defaultTimeoutSec": 60
        },
        "features": {
            "lineage": features.lineage,
            "glossary": features.glossary,
            "queryHistory": features.queryHistory,
            "biUsage": features.biUsage,
            "dbt": features.dbt,
            "governance": features.governance
        },
        "catalog": {
            "tables": catalog_tables,
            "columns": []  # Can be populated later if needed
        }
    }
    
    logger.info(f"[{session_id}] System config built: {len(entities)} entities, {len(catalog_tables)} tables")
    
    return config


def determine_features(entities: Dict[str, dict]) -> Features:
    """
    Determine which features are available based on discovered entities.
    
    Rules:
    - lineage: PROCESS_ENTITY and (TABLE_ENTITY or VIEW_ENTITY) must exist
    - glossary: ATLASGLOSSARY* or ATLASGLOSSARYTERM* must exist
    - dbt: DBTMODEL_ENTITY or DBTSOURCE_ENTITY must exist
    - biUsage: Any BI entity (POWERBI*, TABLEAU*, LOOKER*) must exist
    - queryHistory: QUERY_ENTITY must exist
    - governance: Always true (basic governance is always available)
    """
    entity_names = set(k.upper() for k in entities.keys())
    
    # Lineage requires process + table/view entities
    has_process = any(name in entity_names for name in [
        "PROCESS_ENTITY", "COLUMNPROCESS_ENTITY", "BIPROCESS_ENTITY", "DBTPROCESS_ENTITY"
    ])
    has_table_or_view = "TABLE_ENTITY" in entity_names or "VIEW_ENTITY" in entity_names
    lineage = has_process and has_table_or_view
    
    # Glossary
    glossary = any(name for name in entity_names if "GLOSSARY" in name)
    
    # dbt
    dbt = any(name for name in entity_names if name.startswith("DBT"))
    
    # BI Usage
    bi_prefixes = ["POWERBI", "TABLEAU", "LOOKER", "SIGMA"]
    biUsage = any(any(name.startswith(prefix) for prefix in bi_prefixes) for name in entity_names)
    
    # Query History
    queryHistory = "QUERY_ENTITY" in entity_names
    
    return Features(
        lineage=lineage,
        glossary=glossary,
        queryHistory=queryHistory,
        biUsage=biUsage,
        dbt=dbt,
        governance=True  # Always available
    )


# ============================================
# Endpoints
# ============================================

@router.get("/config")
async def get_system_config(session_id: str = None):
    """
    Get the SystemConfig for the current session.
    
    This endpoint returns the discovered configuration that describes:
    - Which metadata entities are available
    - Which features are enabled
    - The table catalog for suggestions
    
    If the config isn't cached, it will be built via discovery.
    """
    from ..routers.connection import get_session_store, SESSION_STORE
    
    # Get session from header (injected by middleware or passed directly)
    if not session_id:
        raise HTTPException(status_code=401, detail="No session ID provided")
    
    # Check cache first
    if session_id in SYSTEM_CONFIG_CACHE:
        logger.debug(f"[{session_id}] Returning cached system config")
        return SYSTEM_CONFIG_CACHE[session_id]
    
    # Need to build config - get the Snowflake connection
    session = SESSION_STORE.get(session_id)
    if not session:
        raise HTTPException(status_code=401, detail="Session not found")
    
    conn = session.get("connection")
    if not conn:
        raise HTTPException(status_code=500, detail="No Snowflake connection in session")
    
    # Build and cache config
    config = build_system_config(conn, session_id)
    SYSTEM_CONFIG_CACHE[session_id] = config
    
    return config


@router.post("/config/refresh")
async def refresh_system_config(session_id: str = None):
    """
    Force refresh the SystemConfig by re-running discovery.
    
    Useful when the database layout has changed after the initial connection.
    """
    from ..routers.connection import SESSION_STORE
    
    if not session_id:
        raise HTTPException(status_code=401, detail="No session ID provided")
    
    # Clear cache
    if session_id in SYSTEM_CONFIG_CACHE:
        del SYSTEM_CONFIG_CACHE[session_id]
    
    # Get connection and rebuild
    session = SESSION_STORE.get(session_id)
    if not session:
        raise HTTPException(status_code=401, detail="Session not found")
    
    conn = session.get("connection")
    if not conn:
        raise HTTPException(status_code=500, detail="No Snowflake connection in session")
    
    config = build_system_config(conn, session_id)
    SYSTEM_CONFIG_CACHE[session_id] = config
    
    logger.info(f"[{session_id}] System config refreshed")
    
    return config


def cache_config_for_session(session_id: str, config: dict):
    """Helper to cache a config for a session."""
    SYSTEM_CONFIG_CACHE[session_id] = config


def clear_config_for_session(session_id: str):
    """Helper to clear config when session ends."""
    if session_id in SYSTEM_CONFIG_CACHE:
        del SYSTEM_CONFIG_CACHE[session_id]
        logger.debug(f"[{session_id}] Cleared system config cache")


```



## Backend Services


## backend/app/services/cache.py

```python
"""Caching service for metadata."""

from cachetools import TTLCache
from typing import Any, Optional, Callable
from functools import wraps
import hashlib
import json

from app.config import settings


class MetadataCache:
    """TTL-based cache for Snowflake metadata."""
    
    def __init__(self):
        # Separate caches for different data types with different TTLs
        self._databases = TTLCache(maxsize=100, ttl=settings.cache_ttl_databases)
        self._schemas = TTLCache(maxsize=1000, ttl=settings.cache_ttl_schemas)
        self._tables = TTLCache(maxsize=5000, ttl=settings.cache_ttl_tables)
        self._columns = TTLCache(maxsize=10000, ttl=settings.cache_ttl_columns)
    
    def _make_key(self, *args) -> str:
        """Create a cache key from arguments."""
        key_str = json.dumps(args, sort_keys=True, default=str)
        return hashlib.md5(key_str.encode()).hexdigest()
    
    # Database cache
    def get_databases(self) -> Optional[Any]:
        return self._databases.get("all")
    
    def set_databases(self, data: Any):
        self._databases["all"] = data
    
    def clear_databases(self):
        self._databases.clear()
    
    # Schema cache
    def get_schemas(self, database: str) -> Optional[Any]:
        return self._schemas.get(database)
    
    def set_schemas(self, database: str, data: Any):
        self._schemas[database] = data
    
    def clear_schemas(self, database: Optional[str] = None):
        if database:
            self._schemas.pop(database, None)
        else:
            self._schemas.clear()
    
    # Table cache
    def get_tables(self, database: str, schema: str) -> Optional[Any]:
        key = self._make_key(database, schema)
        return self._tables.get(key)
    
    def set_tables(self, database: str, schema: str, data: Any):
        key = self._make_key(database, schema)
        self._tables[key] = data
    
    def clear_tables(self, database: Optional[str] = None, schema: Optional[str] = None):
        if database and schema:
            key = self._make_key(database, schema)
            self._tables.pop(key, None)
        else:
            self._tables.clear()
    
    # Column cache
    def get_columns(self, database: str, schema: str, table: str) -> Optional[Any]:
        key = self._make_key(database, schema, table)
        return self._columns.get(key)
    
    def set_columns(self, database: str, schema: str, table: str, data: Any):
        key = self._make_key(database, schema, table)
        self._columns[key] = data
    
    def clear_columns(self, database: Optional[str] = None, schema: Optional[str] = None, table: Optional[str] = None):
        if database and schema and table:
            key = self._make_key(database, schema, table)
            self._columns.pop(key, None)
        else:
            self._columns.clear()
    
    def clear_all(self):
        """Clear all caches."""
        self._databases.clear()
        self._schemas.clear()
        self._tables.clear()
        self._columns.clear()


# Global cache instance
metadata_cache = MetadataCache()


```

## backend/app/services/session.py

```python
"""
Session management for Snowflake connections.

Maintains persistent connections so users don't re-authenticate every query.
Sessions auto-expire after idle timeout and are cleaned up by background thread.
"""

import threading
import time
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from uuid import uuid4

import snowflake.connector


class SnowflakeSession:
    """Wrapper around a Snowflake connection with metadata."""
    
    def __init__(
        self,
        conn: snowflake.connector.SnowflakeConnection,
        user: str,
        account: str,
        warehouse: str,
        database: str,
        schema: str,
        role: Optional[str] = None
    ):
        self.conn = conn
        self.user = user
        self.account = account
        self.warehouse = warehouse
        self.database = database
        self.schema = schema
        self.role = role
        self.created_at = datetime.utcnow()
        self.last_used = datetime.utcnow()
        self.query_count = 0
    
    def touch(self):
        """Update last used timestamp."""
        self.last_used = datetime.utcnow()
        self.query_count += 1
    
    def is_expired(self, max_idle_minutes: int = 30) -> bool:
        """Check if session has been idle too long."""
        return datetime.utcnow() - self.last_used > timedelta(minutes=max_idle_minutes)
    
    def is_alive(self) -> bool:
        """Check if the underlying connection is still valid."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("SELECT 1")
            cursor.close()
            return True
        except Exception:
            return False
    
    def close(self):
        """Close the underlying connection."""
        try:
            self.conn.close()
        except Exception:
            pass
    
    def to_dict(self) -> Dict[str, Any]:
        """Return session info as dictionary."""
        return {
            "user": self.user,
            "account": self.account,
            "warehouse": self.warehouse,
            "database": self.database,
            "schema": self.schema,
            "role": self.role,
            "query_count": self.query_count,
            "created_at": self.created_at.isoformat(),
            "last_used": self.last_used.isoformat(),
            "idle_seconds": (datetime.utcnow() - self.last_used).total_seconds()
        }


class SessionManager:
    """Manages active Snowflake sessions with automatic cleanup."""
    
    def __init__(self, max_idle_minutes: int = 30, cleanup_interval_seconds: int = 60):
        self._sessions: Dict[str, SnowflakeSession] = {}
        self._lock = threading.RLock()
        self._max_idle_minutes = max_idle_minutes
        self._cleanup_interval = cleanup_interval_seconds
        self._running = True
        
        # Start background cleanup thread
        self._cleanup_thread = threading.Thread(target=self._cleanup_loop, daemon=True)
        self._cleanup_thread.start()
    
    def create_session(
        self,
        conn: snowflake.connector.SnowflakeConnection,
        user: str,
        account: str,
        warehouse: str,
        database: str,
        schema: str,
        role: Optional[str] = None
    ) -> str:
        """Create a new session and return its ID."""
        session_id = str(uuid4())
        session = SnowflakeSession(conn, user, account, warehouse, database, schema, role)
        
        with self._lock:
            self._sessions[session_id] = session
        
        return session_id
    
    def get_session(self, session_id: str) -> Optional[SnowflakeSession]:
        """Get a session by ID, returns None if not found or expired."""
        with self._lock:
            session = self._sessions.get(session_id)
            
            if session is None:
                return None
            
            # Check if expired
            if session.is_expired(self._max_idle_minutes):
                self._remove_session_unsafe(session_id)
                return None
            
            # Check if connection is still alive
            if not session.is_alive():
                self._remove_session_unsafe(session_id)
                return None
            
            session.touch()
            return session
    
    def remove_session(self, session_id: str) -> bool:
        """Explicitly remove a session (logout)."""
        with self._lock:
            return self._remove_session_unsafe(session_id)
    
    def _remove_session_unsafe(self, session_id: str) -> bool:
        """Internal: remove session without lock (caller must hold lock)."""
        session = self._sessions.pop(session_id, None)
        if session:
            session.close()
            return True
        return False
    
    def _cleanup_loop(self):
        """Background thread that cleans up expired sessions."""
        while self._running:
            time.sleep(self._cleanup_interval)
            self._cleanup_expired()
    
    def _cleanup_expired(self):
        """Remove all expired sessions."""
        with self._lock:
            expired = [
                sid for sid, session in self._sessions.items()
                if session.is_expired(self._max_idle_minutes)
            ]
            for sid in expired:
                self._remove_session_unsafe(sid)
            
            if expired:
                print(f"[SessionManager] Cleaned up {len(expired)} expired sessions")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get session manager statistics."""
        with self._lock:
            return {
                "active_sessions": len(self._sessions),
                "max_idle_minutes": self._max_idle_minutes,
                "sessions": [
                    {
                        "session_id": sid[:8] + "...",
                        "user": s.user,
                        "warehouse": s.warehouse,
                        "idle_seconds": (datetime.utcnow() - s.last_used).total_seconds(),
                        "query_count": s.query_count
                    }
                    for sid, s in self._sessions.items()
                ]
            }
    
    def shutdown(self):
        """Shutdown the session manager and close all connections."""
        self._running = False
        with self._lock:
            for session_id in list(self._sessions.keys()):
                self._remove_session_unsafe(session_id)


# Global session manager instance
session_manager = SessionManager(max_idle_minutes=30)


```

## backend/app/services/snowflake.py

```python
"""Snowflake connection and query service."""

import snowflake.connector
from snowflake.connector import DictCursor
from typing import Optional, List, Dict, Any, Tuple
from contextlib import contextmanager
import os
import re
from datetime import datetime, timedelta
import uuid
import threading
from collections import OrderedDict

from app.config import settings
from app.models.schemas import QueryStatus

# Max results to keep in memory (LRU cleanup)
MAX_QUERY_RESULTS = 100
RESULT_TTL_HOURS = 1


# Custom exceptions for better error handling
class SnowflakeError(Exception):
    """Base exception for Snowflake operations."""
    pass


class SnowflakeConnectionError(SnowflakeError):
    """Raised when connection to Snowflake fails or is lost."""
    pass


class SnowflakeSyntaxError(SnowflakeError):
    """Raised when SQL syntax is invalid."""
    pass


class SnowflakeTimeoutError(SnowflakeError):
    """Raised when a query times out."""
    pass


class SnowflakeService:
    """Manages Snowflake connections and query execution."""
    
    def __init__(self):
        self._connection: Optional[snowflake.connector.SnowflakeConnection] = None
        self._query_results: OrderedDict[str, Dict] = OrderedDict()  # LRU-style ordering
        self._results_lock = threading.RLock()  # Reentrant lock for nested calls
        self._connection_lock = threading.Lock()  # Separate lock for connection state
        self._last_connection_check: Optional[datetime] = None
        self._connection_check_cache_seconds = 5  # Cache connection status briefly
    
    @staticmethod
    def _validate_identifier(name: str) -> str:
        """Validate and quote a Snowflake identifier to prevent SQL injection.
        
        Snowflake identifiers:
        - Unquoted: start with letter or underscore, contain letters/digits/underscores/$
        - Quoted: can contain almost anything, double quotes escaped as ""
        
        We validate strictly and always return a safely quoted identifier.
        """
        if not name:
            raise ValueError("Identifier cannot be empty")
        
        if len(name) > 255:
            raise ValueError("Identifier exceeds maximum length of 255 characters")
        
        # Remove surrounding quotes if present (user may have pre-quoted)
        original_name = name
        if name.startswith('"') and name.endswith('"') and len(name) > 2:
            name = name[1:-1].replace('""', '"')  # Unescape internal quotes
        
        # Split by dots for qualified names (database.schema.table)
        # But be careful - dots inside quotes are literal
        parts = []
        current_part = ""
        in_quotes = False
        
        for char in name:
            if char == '"':
                in_quotes = not in_quotes
                current_part += char
            elif char == '.' and not in_quotes:
                if current_part:
                    parts.append(current_part)
                current_part = ""
            else:
                current_part += char
        
        if current_part:
            parts.append(current_part)
        
        if not parts:
            raise ValueError(f"Invalid identifier: '{original_name}'")
        
        validated_parts = []
        for part in parts:
            # Remove quotes from part for validation
            clean_part = part
            if part.startswith('"') and part.endswith('"'):
                clean_part = part[1:-1].replace('""', '"')
            
            # Strict allowlist: alphanumeric, underscore, dollar sign
            # This is MORE restrictive than Snowflake allows, which is intentional for security
            if not re.match(r'^[A-Za-z_][A-Za-z0-9_$]*$', clean_part):
                # Check if it's at least printable ASCII without dangerous chars
                if not clean_part or any(ord(c) < 32 or ord(c) > 126 for c in clean_part):
                    raise ValueError(f"Invalid identifier: '{clean_part}' contains invalid characters")
                # Additional check for SQL-like patterns (defense in depth)
                lower_part = clean_part.lower()
                if any(pattern in lower_part for pattern in [';', '--', '/*', '*/', 'union ', ' or ', ' and ']):
                    raise ValueError(f"Invalid identifier: '{clean_part}' contains suspicious patterns")
            
            # Escape any internal double quotes and wrap in quotes
            safe_part = clean_part.replace('"', '""')
            validated_parts.append(f'"{safe_part}"')
        
        return '.'.join(validated_parts)
    
    @staticmethod
    def _validate_snowflake_query_id(query_id: str) -> str:
        """Validate a Snowflake query ID format.
        
        Snowflake query IDs are UUIDs in format: 01234567-89ab-cdef-0123-456789abcdef
        """
        if not query_id:
            raise ValueError("Query ID cannot be empty")
        
        # Snowflake query IDs are UUID format
        uuid_pattern = r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        if not re.match(uuid_pattern, query_id.lower()):
            raise ValueError(f"Invalid Snowflake query ID format: {query_id}")
        
        return query_id
    
    def _cleanup_old_results(self):
        """Remove old query results to prevent memory leak. Must be called with lock held."""
        # Note: Caller must hold _results_lock
        if len(self._query_results) <= MAX_QUERY_RESULTS:
            return
        
        cutoff = datetime.utcnow() - timedelta(hours=RESULT_TTL_HOURS)
        to_remove = []
        
        for qid, result in self._query_results.items():
            completed = result.get("completed_at")
            if completed and completed < cutoff and result.get("status") != QueryStatus.RUNNING:
                to_remove.append(qid)
        
        for qid in to_remove:
            del self._query_results[qid]
        
        # If still over limit, remove oldest completed (LRU via OrderedDict order)
        while len(self._query_results) > MAX_QUERY_RESULTS:
            # Find first non-running query to remove
            for qid in list(self._query_results.keys()):
                if self._query_results[qid].get("status") != QueryStatus.RUNNING:
                    del self._query_results[qid]
                    break
            else:
                # All queries are running, can't remove any
                break
    
    def _get_private_key(self) -> Optional[bytes]:
        """Load private key from file if configured."""
        if not settings.snowflake_private_key_path:
            return None
        
        key_path = settings.snowflake_private_key_path
        if not os.path.isabs(key_path):
            key_path = os.path.join(os.path.dirname(__file__), "..", "..", key_path)
        
        if not os.path.exists(key_path):
            return None
        
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.backends import default_backend
        
        with open(key_path, "rb") as key_file:
            private_key = serialization.load_pem_private_key(
                key_file.read(),
                password=None,
                backend=default_backend()
            )
        
        return private_key.private_bytes(
            encoding=serialization.Encoding.DER,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        )
    
    def connect(
        self,
        warehouse: Optional[str] = None,
        database: Optional[str] = None,
        schema: Optional[str] = None
    ) -> snowflake.connector.SnowflakeConnection:
        """Establish connection to Snowflake."""
        with self._connection_lock:
            connect_params = {
                "account": settings.snowflake_account,
                "user": settings.snowflake_user,
                "warehouse": warehouse or settings.snowflake_warehouse,
                "database": database or settings.snowflake_database,
                "schema": schema or settings.snowflake_schema,
            }
            
            if settings.snowflake_role:
                connect_params["role"] = settings.snowflake_role
            
            # Try key-pair auth first, fall back to password
            private_key = self._get_private_key()
            if private_key:
                connect_params["private_key"] = private_key
            elif settings.snowflake_password:
                connect_params["password"] = settings.snowflake_password
            else:
                raise ValueError("No authentication method configured. Set SNOWFLAKE_PRIVATE_KEY_PATH or SNOWFLAKE_PASSWORD")
            
            self._connection = snowflake.connector.connect(**connect_params)
            self._last_connection_check = datetime.utcnow()
            return self._connection
    
    def is_connected(self) -> bool:
        """Check if there's an active connection. Caches result briefly to avoid round-trips."""
        with self._connection_lock:
            if self._connection is None:
                return False
            
            # Use cached result if recent enough
            if (self._last_connection_check and 
                (datetime.utcnow() - self._last_connection_check).total_seconds() < self._connection_check_cache_seconds):
                return True
            
            try:
                # Check is_closed attribute/method
                is_closed = getattr(self._connection, 'is_closed', None)
                if callable(is_closed):
                    if is_closed():
                        self._connection = None
                        return False
                elif is_closed is not None and is_closed:
                    self._connection = None
                    return False
                
                # Verify with a simple query
                cursor = self._connection.cursor()
                try:
                    cursor.execute("SELECT 1")
                    self._last_connection_check = datetime.utcnow()
                    return True
                finally:
                    cursor.close()
            except Exception:
                self._connection = None
                self._last_connection_check = None
                return False
    
    @contextmanager
    def get_cursor(self, dict_cursor: bool = True):
        """Get a database cursor with automatic cleanup."""
        if not self._connection:
            raise ValueError("No active Snowflake connection. Please connect first using the Configure Connection button.")
        
        cursor_method = getattr(self._connection, 'cursor', None)
        if cursor_method is None or not callable(cursor_method):
            with self._connection_lock:
                self._connection = None
            raise ValueError("Connection is invalid. Please reconnect using the Configure Connection button.")
        
        try:
            cursor_class = DictCursor if dict_cursor else None
            cursor = cursor_method(cursor_class)
            if cursor is None:
                raise ValueError("Failed to create cursor - connection may be closed")
        except TypeError as e:
            with self._connection_lock:
                self._connection = None
            raise ValueError(f"Connection lost. Please reconnect. Error: {str(e)}")
        except Exception as e:
            raise ValueError(f"Failed to create cursor: {str(e)}")
        
        try:
            yield cursor
        finally:
            try:
                cursor.close()
            except Exception:
                pass
    
    def test_connection(self) -> Dict[str, Any]:
        """Test connection and return connection info."""
        try:
            self.connect()
            with self.get_cursor() as cursor:
                cursor.execute("SELECT CURRENT_USER(), CURRENT_ACCOUNT(), CURRENT_WAREHOUSE(), CURRENT_DATABASE(), CURRENT_SCHEMA(), CURRENT_ROLE()")
                row = cursor.fetchone()
                return {
                    "connected": True,
                    "user": row["CURRENT_USER()"],
                    "account": row["CURRENT_ACCOUNT()"],
                    "warehouse": row["CURRENT_WAREHOUSE()"],
                    "database": row["CURRENT_DATABASE()"],
                    "schema": row["CURRENT_SCHEMA()"],
                    "role": row["CURRENT_ROLE()"],
                }
        except Exception as e:
            return {
                "connected": False,
                "error": str(e)
            }
    
    def connect_with_credentials(
        self,
        account: str,
        user: str,
        password: str,
        warehouse: Optional[str] = None,
        database: Optional[str] = None,
        schema: Optional[str] = None,
        role: Optional[str] = None
    ) -> Dict[str, Any]:
        """Connect with explicitly provided credentials (from UI)."""
        try:
            with self._connection_lock:
                connect_params = {
                    "account": account,
                    "user": user,
                    "password": password,
                    "warehouse": warehouse or "COMPUTE_WH",
                    "database": database or "ATLAN_MDLH",
                    "schema": schema or "PUBLIC",
                }
                
                if role:
                    connect_params["role"] = role
                
                self._connection = snowflake.connector.connect(**connect_params)
                self._last_connection_check = datetime.utcnow()
            
            with self.get_cursor() as cursor:
                cursor.execute("SELECT CURRENT_USER(), CURRENT_ACCOUNT(), CURRENT_WAREHOUSE(), CURRENT_DATABASE(), CURRENT_SCHEMA(), CURRENT_ROLE()")
                row = cursor.fetchone()
                return {
                    "connected": True,
                    "user": row["CURRENT_USER()"],
                    "account": row["CURRENT_ACCOUNT()"],
                    "warehouse": row["CURRENT_WAREHOUSE()"],
                    "database": row["CURRENT_DATABASE()"],
                    "schema": row["CURRENT_SCHEMA()"],
                    "role": row["CURRENT_ROLE()"],
                }
        except Exception as e:
            return {
                "connected": False,
                "error": str(e)
            }
    
    def connect_with_token(
        self,
        account: str,
        user: str,
        token: str,
        warehouse: Optional[str] = None,
        database: Optional[str] = None,
        schema: Optional[str] = None,
        role: Optional[str] = None
    ) -> Dict[str, Any]:
        """Connect using a Personal Access Token (PAT) or programmatic token."""
        
        base_params = {
            "account": account,
            "user": user,
            "warehouse": warehouse or "COMPUTE_WH",
            "database": database or "ATLAN_MDLH", 
            "schema": schema or "PUBLIC",
        }
        if role:
            base_params["role"] = role
        
        auth_attempts = [
            {"token": token, "authenticator": "programmatic_access_token"},
            {"token": token, "authenticator": "oauth"},
            {"password": token},
        ]
        
        errors = []
        
        for auth_params in auth_attempts:
            try:
                connect_params = {**base_params, **auth_params}
                with self._connection_lock:
                    self._connection = snowflake.connector.connect(**connect_params)
                    self._last_connection_check = datetime.utcnow()
                
                with self.get_cursor() as cursor:
                    cursor.execute("SELECT CURRENT_USER(), CURRENT_ACCOUNT(), CURRENT_WAREHOUSE(), CURRENT_DATABASE(), CURRENT_SCHEMA(), CURRENT_ROLE()")
                    row = cursor.fetchone()
                    return {
                        "connected": True,
                        "user": row["CURRENT_USER()"],
                        "account": row["CURRENT_ACCOUNT()"],
                        "warehouse": row["CURRENT_WAREHOUSE()"],
                        "database": row["CURRENT_DATABASE()"],
                        "schema": row["CURRENT_SCHEMA()"],
                        "role": row["CURRENT_ROLE()"],
                    }
            except Exception as e:
                error_msg = str(e)
                if error_msg not in errors:
                    errors.append(error_msg)
                continue
        
        error_summary = errors[0] if errors else "Unknown error"
        return {
            "connected": False,
            "error": f"Token authentication failed. Your PAT may have expired or lacks permissions. Error: {error_summary}"
        }
    
    def connect_with_sso(
        self,
        account: str,
        user: str,
        warehouse: Optional[str] = None,
        database: Optional[str] = None,
        schema: Optional[str] = None,
        role: Optional[str] = None
    ) -> Dict[str, Any]:
        """Connect using external browser (SSO/Okta) authentication."""
        try:
            with self._connection_lock:
                connect_params = {
                    "account": account,
                    "user": user,
                    "authenticator": "externalbrowser",
                    "warehouse": warehouse or "COMPUTE_WH",
                    "database": database or "ATLAN_MDLH",
                    "schema": schema or "PUBLIC",
                }
                
                if role:
                    connect_params["role"] = role
                
                self._connection = snowflake.connector.connect(**connect_params)
                self._last_connection_check = datetime.utcnow()
            
            with self.get_cursor() as cursor:
                cursor.execute("SELECT CURRENT_USER(), CURRENT_ACCOUNT(), CURRENT_WAREHOUSE(), CURRENT_DATABASE(), CURRENT_SCHEMA(), CURRENT_ROLE()")
                row = cursor.fetchone()
                return {
                    "connected": True,
                    "user": row["CURRENT_USER()"],
                    "account": row["CURRENT_ACCOUNT()"],
                    "warehouse": row["CURRENT_WAREHOUSE()"],
                    "database": row["CURRENT_DATABASE()"],
                    "schema": row["CURRENT_SCHEMA()"],
                    "role": row["CURRENT_ROLE()"],
                }
        except Exception as e:
            return {
                "connected": False,
                "error": f"SSO authentication failed. Make sure you complete the login in the browser window. Error: {str(e)}"
            }
    
    def disconnect(self):
        """Close the connection."""
        with self._connection_lock:
            if self._connection:
                try:
                    self._connection.close()
                except Exception:
                    pass
                self._connection = None
                self._last_connection_check = None
    
    # ============ Metadata Methods ============
    
    def get_databases(self) -> List[Dict[str, Any]]:
        """Get list of all databases."""
        with self.get_cursor() as cursor:
            cursor.execute("SHOW DATABASES")
            results = cursor.fetchall()
            return [
                {
                    "name": row["name"],
                    "created_on": row.get("created_on"),
                    "owner": row.get("owner")
                }
                for row in results
            ]
    
    def get_schemas(self, database: str) -> List[Dict[str, Any]]:
        """Get list of schemas in a database."""
        safe_db = self._validate_identifier(database)
        with self.get_cursor() as cursor:
            cursor.execute(f"SHOW SCHEMAS IN DATABASE {safe_db}")
            results = cursor.fetchall()
            return [
                {
                    "name": row["name"],
                    "database_name": database,
                    "created_on": row.get("created_on"),
                    "owner": row.get("owner")
                }
                for row in results
            ]
    
    def get_tables(self, database: str, schema: str) -> List[Dict[str, Any]]:
        """Get list of tables and views in a schema."""
        safe_db = self._validate_identifier(database)
        safe_schema = self._validate_identifier(schema)
        tables = []
        with self.get_cursor() as cursor:
            cursor.execute(f"SHOW TABLES IN SCHEMA {safe_db}.{safe_schema}")
            for row in cursor.fetchall():
                tables.append({
                    "name": row["name"],
                    "database_name": database,
                    "schema_name": schema,
                    "kind": "TABLE",
                    "rows": row.get("rows"),
                    "created_on": row.get("created_on"),
                    "owner": row.get("owner")
                })
            
            cursor.execute(f"SHOW VIEWS IN SCHEMA {safe_db}.{safe_schema}")
            for row in cursor.fetchall():
                tables.append({
                    "name": row["name"],
                    "database_name": database,
                    "schema_name": schema,
                    "kind": "VIEW",
                    "rows": None,
                    "created_on": row.get("created_on"),
                    "owner": row.get("owner")
                })
        
        return sorted(tables, key=lambda x: x["name"])
    
    def get_columns(self, database: str, schema: str, table: str) -> List[Dict[str, Any]]:
        """Get column metadata for a table."""
        safe_db = self._validate_identifier(database)
        safe_schema = self._validate_identifier(schema)
        safe_table = self._validate_identifier(table)
        with self.get_cursor() as cursor:
            cursor.execute(f"DESCRIBE TABLE {safe_db}.{safe_schema}.{safe_table}")
            results = cursor.fetchall()
            return [
                {
                    "name": row["name"],
                    "data_type": row["type"],
                    "nullable": row.get("null?", "Y") == "Y",
                    "default": row.get("default"),
                    "primary_key": row.get("primary key", "N") == "Y",
                    "comment": row.get("comment")
                }
                for row in results
            ]
    
    # ============ Query Execution Methods ============
    
    def execute_query(
        self,
        sql: str,
        database: Optional[str] = None,
        schema: Optional[str] = None,
        warehouse: Optional[str] = None,
        timeout: int = 60,
        limit: Optional[int] = None
    ) -> str:
        """Execute a query and return query_id."""
        query_id = str(uuid.uuid4())
        
        # Initialize with lock held, cleanup, then release before execution
        with self._results_lock:
            self._cleanup_old_results()
            self._query_results[query_id] = {
                "status": QueryStatus.RUNNING,
                "sql": sql,
                "database": database,
                "schema": schema,
                "warehouse": warehouse,
                "started_at": datetime.utcnow(),
                "completed_at": None,
                "row_count": None,
                "columns": [],
                "rows": [],
                "error_message": None,
                "snowflake_query_id": None
            }
            # Move to end for LRU ordering
            self._query_results.move_to_end(query_id)
        
        # Check connection (outside lock)
        if not self._connection:
            with self._results_lock:
                self._query_results[query_id].update({
                    "status": QueryStatus.FAILED,
                    "completed_at": datetime.utcnow(),
                    "error_message": "No active Snowflake connection. Please connect first."
                })
            return query_id
        
        try:
            with self.get_cursor(dict_cursor=False) as cursor:
                if warehouse:
                    safe_warehouse = self._validate_identifier(warehouse)
                    cursor.execute(f"USE WAREHOUSE {safe_warehouse}")
                if database:
                    safe_database = self._validate_identifier(database)
                    cursor.execute(f"USE DATABASE {safe_database}")
                if schema:
                    safe_schema = self._validate_identifier(schema)
                    cursor.execute(f"USE SCHEMA {safe_schema}")
                
                cursor.execute(sql)
                
                sf_query_id = cursor.sfqid
                with self._results_lock:
                    if query_id in self._query_results:
                        self._query_results[query_id]["snowflake_query_id"] = sf_query_id
                
                columns = []
                if cursor.description:
                    columns = [
                        {"name": col[0], "type": str(col[1]) if col[1] else "unknown"}
                        for col in cursor.description
                    ]
                
                # Use explicit None check to allow limit=0 (though it would return nothing)
                effective_limit = limit if limit is not None else 10000
                rows = cursor.fetchmany(effective_limit) if effective_limit > 0 else []
                
                processed_rows = []
                for row in rows:
                    processed_row = []
                    for val in row:
                        if val is None:
                            processed_row.append(None)
                        elif isinstance(val, datetime):
                            processed_row.append(val.isoformat())
                        elif isinstance(val, bytes):
                            processed_row.append(val.decode('utf-8', errors='replace'))
                        else:
                            processed_row.append(val)
                    processed_rows.append(processed_row)
                
                with self._results_lock:
                    if query_id in self._query_results:
                        self._query_results[query_id].update({
                            "status": QueryStatus.SUCCESS,
                            "completed_at": datetime.utcnow(),
                            "row_count": len(processed_rows),
                            "columns": columns,
                            "rows": processed_rows
                        })
                
        except Exception as e:
            with self._results_lock:
                if query_id in self._query_results:
                    self._query_results[query_id].update({
                        "status": QueryStatus.FAILED,
                        "completed_at": datetime.utcnow(),
                        "error_message": str(e)
                    })
        
        return query_id
    
    def get_query_status(self, query_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a query."""
        with self._results_lock:
            result = self._query_results.get(query_id)
            if not result:
                return None
            
            # Return a copy to avoid race conditions
            duration_ms = None
            if result["started_at"] and result["completed_at"]:
                duration_ms = int((result["completed_at"] - result["started_at"]).total_seconds() * 1000)
            
            return {
                "query_id": query_id,
                "status": result["status"],
                "row_count": result["row_count"],
                "execution_time_ms": duration_ms,
                "error_message": result["error_message"],
                "started_at": result["started_at"],
                "completed_at": result["completed_at"]
            }
    
    def get_query_results(
        self,
        query_id: str,
        page: int = 1,
        page_size: int = 100
    ) -> Optional[Dict[str, Any]]:
        """Get paginated results for a query."""
        with self._results_lock:
            result = self._query_results.get(query_id)
            if not result or result["status"] != QueryStatus.SUCCESS:
                return None
            
            total_rows = len(result["rows"])
            start_idx = (page - 1) * page_size
            end_idx = start_idx + page_size
            
            # Return copies of data
            return {
                "query_id": query_id,
                "columns": list(result["columns"]),
                "rows": list(result["rows"][start_idx:end_idx]),
                "total_rows": total_rows,
                "page": page,
                "page_size": page_size,
                "has_more": end_idx < total_rows
            }
    
    def cancel_query(self, query_id: str) -> bool:
        """Cancel a running query. Returns True if cancelled, False otherwise.
        
        Note: For more detailed error info, use cancel_query_with_reason().
        """
        success, _ = self.cancel_query_with_reason(query_id)
        return success
    
    def cancel_query_with_reason(self, query_id: str) -> Tuple[bool, Optional[str]]:
        """Cancel a running query. Returns (success, error_message)."""
        with self._results_lock:
            result = self._query_results.get(query_id)
            
            if not result:
                return False, "Query not found"
            
            if result["status"] != QueryStatus.RUNNING:
                return False, f"Query is not running (status: {result['status']})"
            
            sf_query_id = result.get("snowflake_query_id")
            
            # Mark as cancelled immediately
            result["status"] = QueryStatus.CANCELLED
            result["completed_at"] = datetime.utcnow()
        
        # Try to cancel on Snowflake (outside lock to avoid blocking)
        if sf_query_id and self._connection:
            try:
                validated_sf_qid = self._validate_snowflake_query_id(sf_query_id)
                with self.get_cursor() as cursor:
                    # Use parameterized query to prevent SQL injection
                    cursor.execute("SELECT SYSTEM$CANCEL_QUERY(%s)", (validated_sf_qid,))
            except ValueError as e:
                # Invalid query ID format - log but don't fail
                pass
            except Exception as e:
                # Snowflake cancel failed - query is still marked cancelled locally
                pass
        
        return True, None


# Global service instance
snowflake_service = SnowflakeService()

```

## backend/app/services/system_config.py

```python
"""
SystemConfig Discovery Service

Implements read-only discovery of Snowflake metadata to build a session-specific
SystemConfig. This config drives all query flows and wizards.

Rules:
- READ-ONLY: Only SELECT, SHOW, DESCRIBE, INFORMATION_SCHEMA queries
- NO HALLUCINATION: Only report what actually exists
- GRACEFUL DEGRADATION: Missing tables = feature disabled, not crash
"""

import logging
from typing import Dict, Any, Optional, List
from cachetools import TTLCache

logger = logging.getLogger(__name__)

# Cache config per session (5 minute TTL)
SYSTEM_CONFIG_CACHE: TTLCache = TTLCache(maxsize=100, ttl=300)

# Logical entity names we look for
KNOWN_ENTITIES = [
    "PROCESS_ENTITY",
    "TABLE_ENTITY",
    "VIEW_ENTITY",
    "COLUMN_ENTITY",
    "DATABASE_ENTITY",
    "SCHEMA_ENTITY",
    "SIGMADATAELEMENT_ENTITY",
    "ATLASGLOSSARY_ENTITY",
    "ATLASGLOSSARYTERM_ENTITY",
    "DBTMODEL_ENTITY",
    "DBTPROCESS_ENTITY",
    "POWERBIDASHBOARD_ENTITY",
    "TABLEAUDASHBOARD_ENTITY",
    "LOOKERQUERY_ENTITY",
]


def build_system_config(conn, session_id: str) -> Dict[str, Any]:
    """
    Build SystemConfig by discovering metadata tables.
    
    Args:
        conn: Active Snowflake connection
        session_id: Current session ID for caching
        
    Returns:
        SystemConfig dict with entities, features, catalog, etc.
    """
    # Check cache first
    cached = SYSTEM_CONFIG_CACHE.get(session_id)
    if cached:
        logger.info(f"Returning cached SystemConfig for session {session_id[:8]}...")
        return cached
    
    logger.info(f"Building SystemConfig for session {session_id[:8]}...")
    
    config = {
        "snowflake": {
            "entities": {},
        },
        "queryDefaults": {
            "metadataDb": "FIELD_METADATA",
            "metadataSchema": "PUBLIC",
            "defaultRowLimit": 10000,
            "defaultTimeoutSec": 60,
        },
        "features": {
            "lineage": False,
            "glossary": False,
            "queryHistory": False,
            "biUsage": False,
            "dbt": False,
            "governance": False,
        },
        "catalog": {
            "tables": [],
            "columns": [],
        },
        "discoveryStatus": {
            "success": False,
            "entitiesFound": 0,
            "tablesFound": 0,
            "errors": [],
        }
    }
    
    try:
        cursor = conn.cursor()
        
        # Step 1: Discover *_ENTITY tables
        entities = _discover_entities(cursor)
        config["snowflake"]["entities"] = entities
        config["discoveryStatus"]["entitiesFound"] = len(entities)
        
        # Step 2: Set metadata defaults based on discovered entities
        if "PROCESS_ENTITY" in entities:
            proc = entities["PROCESS_ENTITY"]
            config["queryDefaults"]["metadataDb"] = proc["database"]
            config["queryDefaults"]["metadataSchema"] = proc["schema"]
        
        # Step 3: Determine feature flags
        config["features"] = _determine_features(entities)
        
        # Step 4: Build table catalog
        catalog_tables = _discover_catalog_tables(cursor)
        config["catalog"]["tables"] = catalog_tables
        config["discoveryStatus"]["tablesFound"] = len(catalog_tables)
        
        config["discoveryStatus"]["success"] = True
        
        cursor.close()
        
    except Exception as e:
        logger.error(f"SystemConfig discovery error: {e}")
        config["discoveryStatus"]["errors"].append(str(e))
    
    # Cache the result
    SYSTEM_CONFIG_CACHE[session_id] = config
    
    logger.info(
        f"SystemConfig built: {len(config['snowflake']['entities'])} entities, "
        f"{len(config['catalog']['tables'])} catalog tables"
    )
    
    return config


def _discover_entities(cursor) -> Dict[str, Dict[str, str]]:
    """
    Discover metadata entity tables using INFORMATION_SCHEMA.
    
    Returns:
        Dict mapping logical entity names to {database, schema, table}
    """
    entities = {}
    
    try:
        # Query for *_ENTITY tables
        query = """
            SELECT table_catalog, table_schema, table_name
            FROM information_schema.tables
            WHERE (
                table_name LIKE '%_ENTITY'
                OR table_name IN ('ATLASGLOSSARY', 'ATLASGLOSSARYTERM')
            )
            AND table_schema NOT IN ('INFORMATION_SCHEMA')
            ORDER BY table_name
            LIMIT 500
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        
        for row in rows:
            db, schema, table = row[0], row[1], row[2]
            table_upper = table.upper()
            
            # Match against known logical entities
            for known in KNOWN_ENTITIES:
                if table_upper == known or table_upper == known.replace("_ENTITY", ""):
                    if known not in entities:
                        entities[known] = {
                            "database": db,
                            "schema": schema,
                            "table": table,
                        }
                        logger.debug(f"Matched entity: {known} -> {db}.{schema}.{table}")
                    else:
                        logger.warning(
                            f"Multiple matches for {known}: keeping first, ignoring {db}.{schema}.{table}"
                        )
                    break
        
    except Exception as e:
        logger.error(f"Entity discovery failed: {e}")
    
    return entities


def _determine_features(entities: Dict[str, Dict[str, str]]) -> Dict[str, bool]:
    """
    Determine which features are available based on discovered entities.
    
    Args:
        entities: Dict of discovered entity tables
        
    Returns:
        Dict of feature flags
    """
    return {
        # Lineage requires PROCESS_ENTITY + at least one of TABLE_ENTITY/VIEW_ENTITY
        "lineage": (
            "PROCESS_ENTITY" in entities 
            and ("TABLE_ENTITY" in entities or "VIEW_ENTITY" in entities)
        ),
        
        # Glossary requires either ATLASGLOSSARY or ATLASGLOSSARYTERM
        "glossary": (
            "ATLASGLOSSARY_ENTITY" in entities 
            or "ATLASGLOSSARYTERM_ENTITY" in entities
        ),
        
        # Query history - disabled by default, would need QUERY_ENTITY
        "queryHistory": False,
        
        # BI usage - check for dashboard entities
        "biUsage": (
            "POWERBIDASHBOARD_ENTITY" in entities
            or "TABLEAUDASHBOARD_ENTITY" in entities
            or "LOOKERQUERY_ENTITY" in entities
        ),
        
        # dbt - check for dbt entities
        "dbt": (
            "DBTMODEL_ENTITY" in entities
            or "DBTPROCESS_ENTITY" in entities
        ),
        
        # Governance - conservative, require TABLE_ENTITY at minimum
        "governance": "TABLE_ENTITY" in entities,
    }


def _discover_catalog_tables(cursor, limit: int = 1000) -> List[Dict[str, str]]:
    """
    Discover available tables for suggestions.
    
    Args:
        cursor: Snowflake cursor
        limit: Max tables to return
        
    Returns:
        List of {db, schema, name} dicts
    """
    tables = []
    
    try:
        query = f"""
            SELECT table_catalog, table_schema, table_name
            FROM information_schema.tables
            WHERE table_type IN ('BASE TABLE', 'VIEW')
            AND table_schema NOT IN ('INFORMATION_SCHEMA')
            ORDER BY table_catalog, table_schema, table_name
            LIMIT {limit}
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        
        for row in rows:
            tables.append({
                "db": row[0],
                "schema": row[1],
                "name": row[2],
            })
            
    except Exception as e:
        logger.error(f"Catalog discovery failed: {e}")
    
    return tables


def get_cached_config(session_id: str) -> Optional[Dict[str, Any]]:
    """Get cached config for a session, or None if not cached."""
    return SYSTEM_CONFIG_CACHE.get(session_id)


def invalidate_config(session_id: str):
    """Invalidate cached config for a session."""
    if session_id in SYSTEM_CONFIG_CACHE:
        del SYSTEM_CONFIG_CACHE[session_id]
        logger.info(f"Invalidated SystemConfig cache for session {session_id[:8]}...")


def refresh_config(conn, session_id: str) -> Dict[str, Any]:
    """Force refresh of SystemConfig for a session."""
    invalidate_config(session_id)
    return build_system_config(conn, session_id)


```

## backend/app/utils/logger.py

```python
"""Centralized logging configuration for the backend."""

import logging
import uuid
from contextvars import ContextVar

# Context variable for request correlation
request_id_ctx: ContextVar[str] = ContextVar('request_id', default='no-request')

# Configure logging format
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s.%(msecs)03d [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

# Named loggers for different modules
logger = logging.getLogger("MDLH")
api_logger = logging.getLogger("API")
query_logger = logging.getLogger("Query")
metadata_logger = logging.getLogger("Metadata")
session_logger = logging.getLogger("Session")


def generate_request_id() -> str:
    """Generate a unique request ID for correlation."""
    return str(uuid.uuid4())[:8]


def get_request_id() -> str:
    """Get the current request ID from context."""
    return request_id_ctx.get()


def set_request_id(request_id: str) -> None:
    """Set the current request ID in context."""
    request_id_ctx.set(request_id)


class RequestLogger:
    """Logger with request ID correlation."""
    
    def __init__(self, base_logger: logging.Logger):
        self._logger = base_logger
    
    def _format(self, message: str) -> str:
        req_id = get_request_id()
        if req_id != 'no-request':
            return f"[{req_id}] {message}"
        return message
    
    def debug(self, message: str, *args, **kwargs):
        self._logger.debug(self._format(message), *args, **kwargs)
    
    def info(self, message: str, *args, **kwargs):
        self._logger.info(self._format(message), *args, **kwargs)
    
    def warning(self, message: str, *args, **kwargs):
        self._logger.warning(self._format(message), *args, **kwargs)
    
    def error(self, message: str, *args, **kwargs):
        self._logger.error(self._format(message), *args, **kwargs)
    
    def exception(self, message: str, *args, **kwargs):
        self._logger.exception(self._format(message), *args, **kwargs)


# Create request-aware loggers
request_logger = RequestLogger(logger)


```



# CONFIG FILES


## package.json

```json
{
  "name": "mdlh-entity-dictionary",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "description": "Atlan Metadata Lakehouse Entity Dictionary - Interactive Reference Guide",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "deploy": "gh-pages -d dist"
  },
  "dependencies": {
    "@monaco-editor/react": "^4.7.0",
    "@tanstack/react-table": "^8.21.3",
    "lucide-react": "^0.454.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.3",
    "autoprefixer": "^10.4.20",
    "gh-pages": "^6.2.0",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.14",
    "vite": "^5.4.10"
  }
}

```

## vite.config.js

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // For GitHub Pages deployment
  base: '/MDLH_Dictionary/',
})


```

## tailwind.config.js

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}


```

## src/index.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* CSS Variables */
:root {
  --success-color: #10b981;
  --success-bg-color: #f0fdf4;
  --error-color: #ef4444;
  --error-bg-color: #fef2f2;
  --primary-color: #2563eb;
  --primary-hover: #1d4ed8;
  --radius: 0.75rem;
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  --shadow-card: 0 4px 24px rgba(0,0,0,0.15), 0 1.5px 4px rgba(0,0,0,0.08);
}

/* Base styles */
body {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* Custom scrollbar for dark theme */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #1f2937;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: #4b5563;
  border-radius: 4px;
  transition: background 0.2s;
}

::-webkit-scrollbar-thumb:hover {
  background: #6b7280;
}

/* Smooth scrolling */
html {
  scroll-behavior: smooth;
}

/* Selection color */
::selection {
  background-color: rgba(59, 130, 246, 0.3);
}

/* Enhanced Card Styles */
.card {
  background: #1f2937;
  padding: 1.5rem;
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.card:hover {
  box-shadow: 0 8px 32px rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.1);
}

/* Button Enhancements */
button {
  transition: all 0.2s ease;
  box-shadow: var(--shadow-sm);
}

button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

button:active:not(:disabled) {
  transform: translateY(0);
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Input Focus States */
input[type="text"],
input[type="search"] {
  transition: border 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

input[type="text"]:focus,
input[type="search"]:focus {
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

/* Table Row Hover */
tbody tr {
  transition: background-color 0.15s ease;
}

/* Query Card Animations */
.query-card {
  transition: all 0.2s ease;
}

.query-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

/* Code Block Styling */
pre, code {
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
}

/* Success/Error States */
.success-state {
  background-color: var(--success-bg-color);
  color: var(--success-color);
  border: 1px solid var(--success-color);
}

.error-state {
  background-color: var(--error-bg-color);
  color: var(--error-color);
  border: 1px solid var(--error-color);
}

/* Copy Button Animation */
.copy-success {
  animation: copyPulse 0.3s ease-out;
}

@keyframes copyPulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

/* Tab Button Active State */
.tab-active {
  position: relative;
}

.tab-active::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 50%;
  transform: translateX(-50%);
  width: 80%;
  height: 2px;
  background: currentColor;
  border-radius: 1px;
}

/* Expandable Query Animation */
.query-expand-enter {
  animation: expandIn 0.2s ease-out;
}

@keyframes expandIn {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 1000px;
  }
}

/* Loading Spinner */
.spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Modal Styles */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
}

.modal-content {
  animation: modalSlideIn 0.3s ease-out;
}

@keyframes modalSlideIn {
  from {
    transform: translateY(20px) scale(0.95);
    opacity: 0;
  }
  to {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

/* Tooltip */
.tooltip {
  position: relative;
}

.tooltip::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.5rem 0.75rem;
  background: #1f2937;
  color: white;
  font-size: 0.75rem;
  border-radius: 0.375rem;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  box-shadow: var(--shadow-md);
}

.tooltip:hover::after {
  opacity: 1;
}

/* Smooth page transitions */
.fade-in {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Badge styles */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 9999px;
  transition: all 0.2s ease;
}

.badge:hover {
  transform: scale(1.05);
}

/* Icon button */
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.375rem;
  transition: all 0.2s ease;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}


```

## backend/requirements.txt

```
fastapi==0.104.1
uvicorn[standard]==0.24.0
snowflake-connector-python==3.6.0
python-dotenv==1.0.0
pydantic==2.5.0
pydantic-settings==2.1.0
cachetools==5.3.2
cryptography==41.0.7


```



---

## Export Statistics


- Frontend files: 46
- Backend files: 18
- Total lines: 21265
