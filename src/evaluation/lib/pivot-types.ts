/**
 * Pivot Configuration Types for Assessment Rollups
 * 
 * Defines the structure for configurable pivot views with hierarchical rollups
 */

// ============================================================================
// Dimension Types
// ============================================================================

/**
 * Row dimensions for grouping assets in pivot tables
 */
export type RowDimension = 
  | 'connection'      // Data connection (e.g., Snowflake, BigQuery)
  | 'database'        // Database within connection
  | 'schema'          // Schema within database
  | 'type'            // Asset type (Table, View, Column)
  | 'domain'          // Data domain the asset belongs to
  | 'owner'           // Primary owner of the asset
  | 'workstream'      // Assessment workstream (OWNERSHIP, SEMANTICS, etc.)
  | 'phase'           // Assessment phase (MVP, EXPANDED, HARDENING)
  | 'signalType';     // Signal type (ownership, lineage, semantics, etc.)

/**
 * Predefined dimension hierarchies
 */
export type DimensionHierarchy = 
  | 'connection-hierarchy'  // Connection → Database → Schema → Type
  | 'domain-hierarchy'      // Domain → Type
  | 'owner-hierarchy'       // Owner → Type
  | 'workstream-hierarchy'  // Workstream → Phase
  | 'signal-hierarchy';     // SignalType → Assets

export const DIMENSION_HIERARCHIES: Record<DimensionHierarchy, RowDimension[]> = {
  'connection-hierarchy': ['connection', 'database', 'schema', 'type'],
  'domain-hierarchy': ['domain', 'type'],
  'owner-hierarchy': ['owner', 'type'],
  'workstream-hierarchy': ['workstream', 'phase'],
  'signal-hierarchy': ['signalType', 'type'],
};

// ============================================================================
// Signal Types
// ============================================================================

/**
 * Signal types for metadata assessment
 */
export type SignalType =
  | 'ownership'
  | 'semantics'
  | 'lineage'
  | 'sensitivity'
  | 'access'
  | 'usage'
  | 'freshness';

// ============================================================================
// Measure Types
// ============================================================================

/**
 * Available measures for pivot calculations
 */
export type Measure = 
  | 'assetCount'           // Number of assets
  | 'signalCoverage'       // Overall signal coverage %
  | 'gapCount'             // Total gaps
  | 'highSeverityGaps'     // High severity gaps
  | 'ownershipCoverage'    // % with owners
  | 'lineageCoverage'      // % with lineage
  | 'semanticsCoverage'    // % with descriptions
  | 'sensitivityCoverage'  // % with classifications
  | 'accessCoverage'       // % with access policies
  | 'usageCoverage'        // % with usage data
  | 'freshnessCoverage';   // % with DQ/freshness data

/**
 * How to display measure values
 */
export type MeasureDisplayMode = 'numeric' | 'percentage' | 'visual' | 'auto';

export interface MeasureDisplayConfig {
  measure: Measure;
  mode: MeasureDisplayMode;
}

export interface MeasureDefinition {
  id: Measure;
  label: string;
  description: string;
  rollupLogic: 'sum' | 'average' | 'weighted_average';
  format: 'number' | 'percent';
}

/**
 * All available measure definitions
 */
export const MEASURE_DEFINITIONS: MeasureDefinition[] = [
  {
    id: 'assetCount',
    label: '# Assets',
    description: 'Number of assets',
    rollupLogic: 'sum',
    format: 'number',
  },
  {
    id: 'signalCoverage',
    label: 'Signal Coverage',
    description: 'Overall signal coverage percentage',
    rollupLogic: 'weighted_average',
    format: 'percent',
  },
  {
    id: 'gapCount',
    label: 'Gaps',
    description: 'Total number of gaps',
    rollupLogic: 'sum',
    format: 'number',
  },
  {
    id: 'highSeverityGaps',
    label: 'High Severity',
    description: 'Critical gaps requiring immediate attention',
    rollupLogic: 'sum',
    format: 'number',
  },
  {
    id: 'ownershipCoverage',
    label: 'Ownership',
    description: 'Percentage of assets with owners assigned',
    rollupLogic: 'average',
    format: 'percent',
  },
  {
    id: 'lineageCoverage',
    label: 'Lineage',
    description: 'Percentage of assets with lineage captured',
    rollupLogic: 'average',
    format: 'percent',
  },
  {
    id: 'semanticsCoverage',
    label: 'Semantics',
    description: 'Percentage of assets with descriptions',
    rollupLogic: 'average',
    format: 'percent',
  },
  {
    id: 'sensitivityCoverage',
    label: 'Sensitivity',
    description: 'Percentage of assets with classifications',
    rollupLogic: 'average',
    format: 'percent',
  },
  {
    id: 'accessCoverage',
    label: 'Access',
    description: 'Percentage of assets with access policies',
    rollupLogic: 'average',
    format: 'percent',
  },
  {
    id: 'usageCoverage',
    label: 'Usage',
    description: 'Percentage of assets with usage data',
    rollupLogic: 'average',
    format: 'percent',
  },
  {
    id: 'freshnessCoverage',
    label: 'Freshness',
    description: 'Percentage of assets with DQ/freshness data',
    rollupLogic: 'average',
    format: 'percent',
  },
];

// ============================================================================
// Pivot Configuration
// ============================================================================

export interface PivotConfig {
  rowDimensions: RowDimension[];
  measures: Measure[];
  measureDisplayModes?: MeasureDisplayConfig[];
}

// ============================================================================
// Pivot Hierarchy Node
// ============================================================================

export interface PivotHierarchyNode {
  id: string;
  label: string;
  level: RowDimension | 'root';
  
  // Hierarchy context
  connectionName?: string;
  databaseName?: string;
  schemaName?: string;
  typeName?: string;
  domainName?: string;
  ownerName?: string;
  workstream?: string;
  phase?: string;
  signalType?: string;
  
  // Children and assets
  children: PivotHierarchyNode[];
  assetIds: string[];
  
  // Aggregated metrics
  metrics: PivotNodeMetrics;
}

export interface PivotNodeMetrics {
  assetCount: number;
  signalCoverage: number;
  gapCount: number;
  highSeverityGaps: number;
  ownershipCoverage: number;
  lineageCoverage: number;
  semanticsCoverage: number;
  sensitivityCoverage: number;
  accessCoverage: number;
  usageCoverage: number;
  freshnessCoverage: number;
}

// ============================================================================
// Flattened Row for Table Display
// ============================================================================

export interface FlattenedPivotRow {
  id: string;
  path: string[];
  node: PivotHierarchyNode;
  depth: number;
  isExpanded: boolean;
  hasChildren: boolean;
}

// ============================================================================
// Asset Data (input to pivot builder)
// ============================================================================

export interface PivotAsset {
  id: string;
  name: string;
  type: string;
  qualifiedName: string;
  
  // Hierarchy fields
  connectionName?: string;
  databaseName?: string;
  schemaName?: string;
  
  // Domain/Owner fields
  domainGUIDs?: string[];  // Domain GUIDs the asset belongs to
  domainName?: string;     // Resolved domain name (first domain)
  ownerName?: string;      // Primary owner name
  
  // Signal presence (tri-state: true, false, unknown)
  signals: {
    ownership: boolean | 'UNKNOWN';
    lineage: boolean | 'UNKNOWN';
    semantics: boolean | 'UNKNOWN';
    sensitivity: boolean | 'UNKNOWN';
    access: boolean | 'UNKNOWN';
    usage: boolean | 'UNKNOWN';
    freshness: boolean | 'UNKNOWN';
  };
  
  // Gap data
  gapCount: number;
  highSeverityGaps: number;
  
  // Workstream/phase (if applicable)
  workstream?: string;
  phase?: string;
}

// ============================================================================
// Dimension Labels & Icons
// ============================================================================

export const DIMENSION_LABELS: Record<RowDimension, string> = {
  connection: 'Connection',
  database: 'Database',
  schema: 'Schema',
  type: 'Asset Type',
  domain: 'Domain',
  owner: 'Owner',
  workstream: 'Workstream',
  phase: 'Phase',
  signalType: 'Signal Type',
};

export const HIERARCHY_LABELS: Record<DimensionHierarchy, string> = {
  'connection-hierarchy': 'By Connection',
  'domain-hierarchy': 'By Domain',
  'owner-hierarchy': 'By Owner',
  'workstream-hierarchy': 'By Workstream',
  'signal-hierarchy': 'By Signal Type',
};

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_PIVOT_CONFIG: PivotConfig = {
  rowDimensions: ['connection', 'database', 'schema', 'type'],
  measures: ['assetCount', 'signalCoverage', 'gapCount', 'ownershipCoverage', 'lineageCoverage'],
};
