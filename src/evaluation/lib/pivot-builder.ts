/**
 * Pivot Builder Utilities
 * 
 * Functions to build pivot hierarchies from asset data for rollup views
 */

import type {
  RowDimension,
  PivotHierarchyNode,
  PivotAsset,
  FlattenedPivotRow,
  PivotNodeMetrics,
} from './pivot-types';
import { calculateMetricsForAssets, aggregateChildMetrics } from './pivot-measures';

// ============================================================================
// Dimension Value Extractors
// ============================================================================

/**
 * Extract dimension value from an asset
 */
function getDimensionValue(asset: PivotAsset, dimension: RowDimension): string {
  switch (dimension) {
    case 'connection':
      return asset.connectionName || 'Unknown Connection';
    case 'database':
      return asset.databaseName || 'No Database';
    case 'schema':
      return asset.schemaName || 'No Schema';
    case 'type':
      return asset.type || 'Unknown Type';
    case 'domain':
      // Use resolved domain name, or first GUID if not resolved, or 'No Domain'
      if (asset.domainName) return asset.domainName;
      if (asset.domainGUIDs && asset.domainGUIDs.length > 0) {
        return `Domain ${asset.domainGUIDs[0].slice(0, 8)}`;
      }
      return 'No Domain';
    case 'owner':
      return asset.ownerName || 'Unowned';
    case 'workstream':
      return asset.workstream || 'Unassigned';
    case 'phase':
      return asset.phase || 'Unassigned';
    case 'signalType':
      // For signal type grouping, we'll handle this specially
      return 'All Signals';
    default:
      return 'Unknown';
  }
}

// ============================================================================
// Build Pivot Hierarchy
// ============================================================================

/**
 * Build a hierarchical pivot structure from assets
 * 
 * @param assets - Array of assets to group
 * @param dimensions - Ordered list of dimensions to group by
 * @returns Root node of the hierarchy
 */
export function buildPivotHierarchy(
  assets: PivotAsset[],
  dimensions: RowDimension[]
): PivotHierarchyNode {
  // Build the tree recursively
  const root = buildHierarchyLevel(assets, dimensions, 0, 'root', {});
  
  return root;
}

/**
 * Recursively build a level of the hierarchy
 */
function buildHierarchyLevel(
  assets: PivotAsset[],
  dimensions: RowDimension[],
  dimensionIndex: number,
  parentId: string,
  parentContext: Record<string, string>
): PivotHierarchyNode {
  // If we've processed all dimensions, return a leaf node
  if (dimensionIndex >= dimensions.length) {
    const metrics = calculateMetricsForAssets(assets);
    return {
      id: parentId,
      label: 'Assets',
      level: 'root',
      ...parentContext,
      children: [],
      assetIds: assets.map(a => a.id),
      metrics,
    };
  }

  const currentDimension = dimensions[dimensionIndex];
  
  // Group assets by current dimension
  const groups = new Map<string, PivotAsset[]>();
  assets.forEach(asset => {
    const value = getDimensionValue(asset, currentDimension);
    if (!groups.has(value)) {
      groups.set(value, []);
    }
    groups.get(value)!.push(asset);
  });

  // Build child nodes for each group
  const children: PivotHierarchyNode[] = [];
  
  groups.forEach((groupAssets, value) => {
    const nodeId = parentId === 'root' 
      ? `${currentDimension}::${value}`
      : `${parentId}::${currentDimension}::${value}`;
    
    const childContext = {
      ...parentContext,
      [getDimensionContextKey(currentDimension)]: value,
    };

    // Recursively build children if more dimensions exist
    if (dimensionIndex < dimensions.length - 1) {
      const childNode = buildHierarchyLevel(
        groupAssets,
        dimensions,
        dimensionIndex + 1,
        nodeId,
        childContext
      );
      
      // Override this node's properties
      childNode.id = nodeId;
      childNode.label = value;
      childNode.level = currentDimension;
      
      children.push(childNode);
    } else {
      // Leaf node - calculate metrics directly from assets
      const metrics = calculateMetricsForAssets(groupAssets);
      children.push({
        id: nodeId,
        label: value,
        level: currentDimension,
        ...childContext,
        children: [],
        assetIds: groupAssets.map(a => a.id),
        metrics,
      });
    }
  });

  // Sort children by label
  children.sort((a, b) => a.label.localeCompare(b.label));

  // Calculate aggregated metrics for this level
  const childMetrics = children.map(c => c.metrics);
  const aggregatedMetrics = aggregateChildMetrics(childMetrics);
  const allAssetIds = children.flatMap(c => c.assetIds);

  // If this is the root call, return the root node
  if (dimensionIndex === 0) {
    return {
      id: 'root',
      label: 'All Assets',
      level: 'root',
      children,
      assetIds: allAssetIds,
      metrics: aggregatedMetrics,
    };
  }

  // Otherwise return a group node (will be modified by parent)
  return {
    id: parentId,
    label: parentId,
    level: currentDimension,
    ...parentContext,
    children,
    assetIds: allAssetIds,
    metrics: aggregatedMetrics,
  };
}

/**
 * Get the context key for a dimension
 */
function getDimensionContextKey(dimension: RowDimension): string {
  switch (dimension) {
    case 'connection': return 'connectionName';
    case 'database': return 'databaseName';
    case 'schema': return 'schemaName';
    case 'type': return 'typeName';
    case 'domain': return 'domainName';
    case 'owner': return 'ownerName';
    case 'workstream': return 'workstream';
    case 'phase': return 'phase';
    case 'signalType': return 'signalType';
    default: return dimension;
  }
}

// ============================================================================
// Build Signal-Based Hierarchy
// ============================================================================

/**
 * Build a hierarchy grouped by signal type
 * Shows which signals are present/missing across assets
 */
export function buildSignalHierarchy(assets: PivotAsset[]): PivotHierarchyNode {
  const signalTypes = [
    'ownership',
    'lineage',
    'semantics',
    'sensitivity',
    'access',
    'usage',
    'freshness',
  ] as const;

  const children: PivotHierarchyNode[] = signalTypes.map(signalType => {
    // Filter assets that have this signal
    const presentAssets = assets.filter(a => a.signals[signalType] === true);
    const missingAssets = assets.filter(a => a.signals[signalType] === false);
    const unknownAssets = assets.filter(a => a.signals[signalType] === 'UNKNOWN');

    const presentMetrics = calculateMetricsForAssets(presentAssets);
    const missingMetrics = calculateMetricsForAssets(missingAssets);
    const unknownMetrics = calculateMetricsForAssets(unknownAssets);

    const signalChildren: PivotHierarchyNode[] = [];

    if (presentAssets.length > 0) {
      signalChildren.push({
        id: `${signalType}::present`,
        label: 'Present',
        level: 'type',
        signalType,
        children: [],
        assetIds: presentAssets.map(a => a.id),
        metrics: presentMetrics,
      });
    }

    if (missingAssets.length > 0) {
      signalChildren.push({
        id: `${signalType}::missing`,
        label: 'Missing',
        level: 'type',
        signalType,
        children: [],
        assetIds: missingAssets.map(a => a.id),
        metrics: missingMetrics,
      });
    }

    if (unknownAssets.length > 0) {
      signalChildren.push({
        id: `${signalType}::unknown`,
        label: 'Unknown',
        level: 'type',
        signalType,
        children: [],
        assetIds: unknownAssets.map(a => a.id),
        metrics: unknownMetrics,
      });
    }

    const allMetrics = aggregateChildMetrics(
      signalChildren.map(c => c.metrics)
    );

    return {
      id: `signal::${signalType}`,
      label: signalType.charAt(0).toUpperCase() + signalType.slice(1),
      level: 'signalType',
      signalType,
      children: signalChildren,
      assetIds: assets.map(a => a.id),
      metrics: allMetrics,
    };
  });

  const rootMetrics = aggregateChildMetrics(children.map(c => c.metrics));

  return {
    id: 'root',
    label: 'All Signals',
    level: 'root',
    children,
    assetIds: assets.map(a => a.id),
    metrics: rootMetrics,
  };
}

// ============================================================================
// Flatten Hierarchy for Table Display
// ============================================================================

/**
 * Flatten a hierarchy tree for table display
 * 
 * @param node - Root node of the hierarchy
 * @param expandedIds - Set of expanded node IDs
 * @param depth - Current depth (for rendering)
 * @param path - Current path in the tree
 * @param isRoot - Whether this is the root node
 * @returns Flattened array of rows for table rendering
 */
export function flattenHierarchyForTable(
  node: PivotHierarchyNode,
  expandedIds: Set<string>,
  depth: number = 0,
  path: string[] = [],
  isRoot: boolean = true
): FlattenedPivotRow[] {
  const result: FlattenedPivotRow[] = [];
  const currentPath = [...path, node.label];
  const isExpanded = expandedIds.has(node.id);
  const hasChildren = node.children.length > 0;

  // Skip the root node itself but include all other nodes
  if (!isRoot) {
    result.push({
      id: node.id,
      path: currentPath,
      node,
      depth,
      isExpanded,
      hasChildren,
    });
  }

  // Add children if expanded (or if this is the root)
  if ((isExpanded || isRoot) && hasChildren) {
    node.children.forEach(child => {
      result.push(
        ...flattenHierarchyForTable(child, expandedIds, isRoot ? 0 : depth + 1, currentPath, false)
      );
    });
  }

  return result;
}

// ============================================================================
// Collect All Node IDs
// ============================================================================

/**
 * Collect all node IDs from a hierarchy (for expand all)
 */
export function collectAllNodeIds(node: PivotHierarchyNode): string[] {
  const ids: string[] = [node.id];
  node.children.forEach(child => {
    ids.push(...collectAllNodeIds(child));
  });
  return ids;
}

/**
 * Collect only parent node IDs (nodes with children)
 */
export function collectParentNodeIds(node: PivotHierarchyNode): string[] {
  const ids: string[] = [];
  if (node.children.length > 0) {
    ids.push(node.id);
    node.children.forEach(child => {
      ids.push(...collectParentNodeIds(child));
    });
  }
  return ids;
}
