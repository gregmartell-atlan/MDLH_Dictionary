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

