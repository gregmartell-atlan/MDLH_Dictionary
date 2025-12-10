/**
 * Demo Mode Data
 *
 * Provides sample data for running the app without a backend connection.
 * Used when deployed to GitHub Pages or when backend is unavailable.
 */

// Demo database/schema context
export const DEMO_DATABASE = 'DEMO_MDLH';
export const DEMO_SCHEMA = 'PUBLIC';

// Sample discovered tables (simulates INFORMATION_SCHEMA.TABLES)
export const DEMO_TABLES = [
  { TABLE_NAME: 'TABLE_ENTITY', ROW_COUNT: 15420, TABLE_TYPE: 'BASE TABLE' },
  { TABLE_NAME: 'COLUMN_ENTITY', ROW_COUNT: 245000, TABLE_TYPE: 'BASE TABLE' },
  { TABLE_NAME: 'PROCESS_ENTITY', ROW_COUNT: 8750, TABLE_TYPE: 'BASE TABLE' },
  { TABLE_NAME: 'ATLASGLOSSARYTERM_ENTITY', ROW_COUNT: 1250, TABLE_TYPE: 'BASE TABLE' },
  { TABLE_NAME: 'ATLASGLOSSARY_ENTITY', ROW_COUNT: 45, TABLE_TYPE: 'BASE TABLE' },
  { TABLE_NAME: 'ATLASGLOSSARYCATEGORY_ENTITY', ROW_COUNT: 320, TABLE_TYPE: 'BASE TABLE' },
  { TABLE_NAME: 'BIPROCESS_ENTITY', ROW_COUNT: 2100, TABLE_TYPE: 'BASE TABLE' },
  { TABLE_NAME: 'QUERY_ENTITY', ROW_COUNT: 52000, TABLE_TYPE: 'BASE TABLE' },
  { TABLE_NAME: 'SCHEMA_ENTITY', ROW_COUNT: 890, TABLE_TYPE: 'BASE TABLE' },
  { TABLE_NAME: 'DATABASE_ENTITY', ROW_COUNT: 125, TABLE_TYPE: 'BASE TABLE' },
];

// Sample entities for preview
export const DEMO_SAMPLE_ENTITIES = {
  tables: [
    { GUID: 'demo-guid-001', NAME: 'FACT_ORDERS', TYPENAME: 'Table', POPULARITYSCORE: 95, DESCRIPTION: 'Main orders fact table' },
    { GUID: 'demo-guid-002', NAME: 'DIM_CUSTOMERS', TYPENAME: 'Table', POPULARITYSCORE: 88, DESCRIPTION: 'Customer dimension table' },
    { GUID: 'demo-guid-003', NAME: 'DIM_PRODUCTS', TYPENAME: 'Table', POPULARITYSCORE: 82, DESCRIPTION: 'Product catalog dimension' },
    { GUID: 'demo-guid-004', NAME: 'FACT_SALES', TYPENAME: 'Table', POPULARITYSCORE: 78, DESCRIPTION: 'Sales transactions fact table' },
    { GUID: 'demo-guid-005', NAME: 'STG_RAW_ORDERS', TYPENAME: 'Table', POPULARITYSCORE: 65, DESCRIPTION: 'Staging table for raw order data' },
  ],
  columns: [
    { GUID: 'demo-col-001', NAME: 'ORDER_ID', TYPENAME: 'Column', TABLE_NAME: 'FACT_ORDERS', DATA_TYPE: 'NUMBER' },
    { GUID: 'demo-col-002', NAME: 'CUSTOMER_ID', TYPENAME: 'Column', TABLE_NAME: 'FACT_ORDERS', DATA_TYPE: 'NUMBER' },
    { GUID: 'demo-col-003', NAME: 'ORDER_DATE', TYPENAME: 'Column', TABLE_NAME: 'FACT_ORDERS', DATA_TYPE: 'TIMESTAMP_NTZ' },
    { GUID: 'demo-col-004', NAME: 'TOTAL_AMOUNT', TYPENAME: 'Column', TABLE_NAME: 'FACT_ORDERS', DATA_TYPE: 'NUMBER' },
  ],
  processes: [
    { GUID: 'demo-proc-001', NAME: 'Load_FACT_ORDERS', TYPENAME: 'Process', INPUTS: ['STG_RAW_ORDERS'], OUTPUTS: ['FACT_ORDERS'] },
    { GUID: 'demo-proc-002', NAME: 'Transform_Customers', TYPENAME: 'Process', INPUTS: ['RAW_CUSTOMERS'], OUTPUTS: ['DIM_CUSTOMERS'] },
  ],
  terms: [
    { GUID: 'demo-term-001', NAME: 'Revenue', TYPENAME: 'AtlasGlossaryTerm', DESCRIPTION: 'Total revenue from sales' },
    { GUID: 'demo-term-002', NAME: 'Customer Lifetime Value', TYPENAME: 'AtlasGlossaryTerm', DESCRIPTION: 'Predicted net profit from customer relationship' },
  ],
  loaded: true,
  loading: false,
};

// Sample lineage data
export const DEMO_LINEAGE_DATA = {
  nodes: [
    { id: 'stg-orders', label: 'STG_RAW_ORDERS', type: 'table', column: 0, row: 0 },
    { id: 'proc-load', label: 'Load_FACT_ORDERS', type: 'process', column: 1, row: 0 },
    { id: 'fact-orders', label: 'FACT_ORDERS', type: 'table', column: 2, row: 0 },
    { id: 'proc-agg', label: 'Aggregate_Daily', type: 'process', column: 3, row: 0 },
    { id: 'fact-daily', label: 'FACT_DAILY_ORDERS', type: 'table', column: 4, row: 0 },
  ],
  edges: [
    { from: 'stg-orders', to: 'proc-load' },
    { from: 'proc-load', to: 'fact-orders' },
    { from: 'fact-orders', to: 'proc-agg' },
    { from: 'proc-agg', to: 'fact-daily' },
  ],
  metadata: {
    tableName: 'FACT_ORDERS',
    tableGuid: 'demo-guid-001',
    upstreamCount: 1,
    downstreamCount: 1,
    processCount: 2,
  },
  rawProcesses: [
    { name: 'Load_FACT_ORDERS', inputs: ['STG_RAW_ORDERS'], outputs: ['FACT_ORDERS'] },
    { name: 'Aggregate_Daily', inputs: ['FACT_ORDERS'], outputs: ['FACT_DAILY_ORDERS'] },
  ],
};

// Sample query results for common queries
export const DEMO_QUERY_RESULTS = {
  'SHOW TABLES': {
    columns: ['name', 'database_name', 'schema_name', 'kind', 'row_count'],
    rows: DEMO_TABLES.map(t => [t.TABLE_NAME, DEMO_DATABASE, DEMO_SCHEMA, t.TABLE_TYPE, t.ROW_COUNT]),
    rowCount: DEMO_TABLES.length,
  },
  'SELECT * FROM TABLE_ENTITY': {
    columns: ['GUID', 'NAME', 'TYPENAME', 'POPULARITYSCORE', 'DESCRIPTION', 'CREATETIME', 'UPDATETIME'],
    rows: DEMO_SAMPLE_ENTITIES.tables.map(t => [
      t.GUID, t.NAME, t.TYPENAME, t.POPULARITYSCORE, t.DESCRIPTION,
      Date.now() - 86400000 * 30, Date.now() - 86400000 * 2
    ]),
    rowCount: DEMO_SAMPLE_ENTITIES.tables.length,
  },
};

// Check if we're in demo mode (no backend available)
export function isDemoMode() {
  // Demo mode when:
  // 1. Explicitly set via env var
  // 2. Running on GitHub Pages (not localhost)
  const isGitHubPages = typeof window !== 'undefined' &&
    window.location.hostname.includes('github.io');
  const isExplicitDemo = import.meta.env.VITE_DEMO_MODE === 'true';

  return isExplicitDemo || isGitHubPages;
}

// Demo connection status
export const DEMO_CONNECTION_STATUS = {
  isConnected: true,
  database: DEMO_DATABASE,
  schema: DEMO_SCHEMA,
  user: 'demo_user',
  role: 'DEMO_ROLE',
  warehouse: 'DEMO_WH',
  isDemoMode: true,
};

export default {
  isDemoMode,
  DEMO_DATABASE,
  DEMO_SCHEMA,
  DEMO_TABLES,
  DEMO_SAMPLE_ENTITIES,
  DEMO_LINEAGE_DATA,
  DEMO_QUERY_RESULTS,
  DEMO_CONNECTION_STATUS,
};
