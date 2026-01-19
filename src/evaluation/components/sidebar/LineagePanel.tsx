// ============================================
// LINEAGE PANEL
// Shows upstream/downstream connections for an entity
// Fetches live lineage from Atlan API when available
// See: https://developer.atlan.com/snippets/common-examples/lineage/traverse/
// ============================================

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  GitBranch,
  ArrowUpRight,
  ArrowDownRight,
  Database,
  Layers,
  Table2,
  Eye,
  ChevronRight,
  ExternalLink,
  AlertCircle,
  Loader2,
  RefreshCw,
  TrendingUp,
  Users,
  Search,
  Clock,
} from 'lucide-react';
import { useModelStore } from '../../stores/modelStore';
import { useUIStore } from '../../stores/uiStore';
import {
  fetchFullLineage,
  fetchAssetPopularity,
  isConfigured,
  type LineageAsset,
  type LineageResult,
  type AssetPopularity,
} from '../../services/atlanApi';
import type { EntityDefinition, EdgeDefinition } from '../../types';

// ============================================
// TYPES
// ============================================

interface LineageConnection {
  entity?: EntityDefinition;
  lineageAsset?: LineageAsset;
  relationshipType: string;
  depth: number;
  isOnCanvas: boolean;
}

interface LineagePanelProps {
  entity: EntityDefinition;
}

// ============================================
// ICON MAPPING
// ============================================

const TYPE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Database: Database,
  Schema: Layers,
  Table: Table2,
  View: Eye,
  Column: Layers,
  // Add more Atlan type mappings
  SnowflakeTable: Table2,
  SnowflakeView: Eye,
  SnowflakeDatabase: Database,
  SnowflakeSchema: Layers,
  BigQueryTable: Table2,
  BigQueryView: Eye,
  DatabricksTable: Table2,
};

// ============================================
// COMPONENT
// ============================================

export function LineagePanel({ entity }: LineagePanelProps) {
  const selectEntity = useUIStore((state) => state.selectEntity);

  // Get active page data from store
  const activePage = useModelStore((state) =>
    state.model.pages.find(p => p.id === state.model.activePageId)
  );
  const entities: EntityDefinition[] = activePage?.entities || [];
  const edges: EdgeDefinition[] = activePage?.edges || [];

  // State for Atlan lineage
  const [atlanLineage, setAtlanLineage] = useState<LineageResult | null>(null);
  const [popularity, setPopularity] = useState<AssetPopularity | null>(null);
  const [isLoadingLineage, setIsLoadingLineage] = useState(false);
  const [isLoadingPopularity, setIsLoadingPopularity] = useState(false);
  const [lineageError, setLineageError] = useState<string | null>(null);

  // Check if entity has Atlan GUID (imported from Atlan)
  const hasAtlanGuid = !!entity.atlanGuid;
  const isAtlanConfigured = isConfigured();

  // Create entity lookup maps for O(1) access - memoized to avoid recreation
  const { entityMap, entityByGuidMap } = useMemo(() => {
    const byId = new Map<string, EntityDefinition>(entities.map(e => [e.id, e]));
    const byGuid = new Map<string, EntityDefinition>(
      entities
        .filter((e): e is EntityDefinition & { atlanGuid: string } => !!e.atlanGuid)
        .map(e => [e.atlanGuid, e])
    );
    return { entityMap: byId, entityByGuidMap: byGuid };
  }, [entities]);

  // Check if entity has lineage indicator from Atlan
  const hasAtlanLineage = useMemo(() => {
    const lineageAttr = entity.attributes.find(a => a.name === 'lineage' || a.name === '__hasLineage');
    return lineageAttr?.value === true || lineageAttr?.value === 'true';
  }, [entity.attributes]);

  // Fetch lineage from Atlan API - wrapped in useCallback
  const fetchAtlanLineageData = useCallback(async () => {
    if (!entity.atlanGuid || !isAtlanConfigured) return;

    setIsLoadingLineage(true);
    setLineageError(null);

    try {
      const result = await fetchFullLineage(entity.atlanGuid, 3, 50);
      setAtlanLineage(result);
    } catch (err) {
      console.error('[LineagePanel] Failed to fetch lineage:', err);
      setLineageError(err instanceof Error ? err.message : 'Failed to fetch lineage');
    } finally {
      setIsLoadingLineage(false);
    }
  }, [entity.atlanGuid, isAtlanConfigured]);

  // Fetch popularity metrics - wrapped in useCallback
  const fetchPopularityMetrics = useCallback(async () => {
    if (!entity.atlanGuid || !isAtlanConfigured) return;

    setIsLoadingPopularity(true);
    try {
      const result = await fetchAssetPopularity(entity.atlanGuid);
      setPopularity(result);
    } catch (err) {
      console.error('[LineagePanel] Failed to fetch popularity:', err);
    } finally {
      setIsLoadingPopularity(false);
    }
  }, [entity.atlanGuid, isAtlanConfigured]);

  // Auto-fetch on entity change if connected
  useEffect(() => {
    if (hasAtlanGuid && isAtlanConfigured) {
      fetchAtlanLineageData();
      fetchPopularityMetrics();
    }
  }, [hasAtlanGuid, isAtlanConfigured, fetchAtlanLineageData, fetchPopularityMetrics]);

  // Calculate canvas-based connections (upstream) - O(1) lookups with entityMap
  const canvasUpstream = useMemo((): LineageConnection[] => {
    const connections: LineageConnection[] = [];
    const incomingEdges = edges.filter(e => e.target === entity.id);

    incomingEdges.forEach(edge => {
      const sourceEntity = entityMap.get(edge.source);
      if (sourceEntity) {
        connections.push({
          entity: sourceEntity,
          relationshipType: edge.label || 'contains',
          depth: 1,
          isOnCanvas: true,
        });
      }
    });

    return connections;
  }, [entity.id, entityMap, edges]);

  // Calculate canvas-based connections (downstream) - O(1) lookups with entityMap
  const canvasDownstream = useMemo((): LineageConnection[] => {
    const connections: LineageConnection[] = [];
    const outgoingEdges = edges.filter(e => e.source === entity.id);

    outgoingEdges.forEach(edge => {
      const targetEntity = entityMap.get(edge.target);
      if (targetEntity) {
        connections.push({
          entity: targetEntity,
          relationshipType: edge.label || 'contains',
          depth: 1,
          isOnCanvas: true,
        });
      }
    });

    return connections;
  }, [entity.id, entityMap, edges]);

  // Find parent entity based on qualified name hierarchy
  const entityQualifiedName = entity.atlanQualifiedName || entity.qualifiedName;
  const parentEntity = useMemo((): EntityDefinition | null => {
    if (!entityQualifiedName) return null;

    // Split qualified name and look for parent (e.g., remove last segment)
    const parts = entityQualifiedName.split('/').filter(Boolean);
    if (parts.length <= 1) return null;

    // Try to find entity with parent qualified name
    const parentQn = parts.slice(0, -1).join('/');

    // Search through entities (could optimize with another map if needed)
    for (const e of entities) {
      const eQn = e.atlanQualifiedName || e.qualifiedName;
      if (eQn === parentQn || eQn === '/' + parentQn) {
        return e;
      }
    }
    return null;
  }, [entityQualifiedName, entities]);

  // Find child entities based on qualified name hierarchy (e.g., columns under tables)
  const childEntities = useMemo((): EntityDefinition[] => {
    if (!entityQualifiedName) return [];

    // Find entities whose qualified name starts with this entity's qualified name + /
    const prefix = entityQualifiedName.endsWith('/') ? entityQualifiedName : entityQualifiedName + '/';
    return entities.filter(e => {
      if (e.id === entity.id) return false;
      const eQn = e.atlanQualifiedName || e.qualifiedName;
      if (!eQn) return false;
      // Direct children only (one level deeper)
      if (eQn.startsWith(prefix)) {
        const remainder = eQn.slice(prefix.length);
        return !remainder.includes('/'); // No further nesting
      }
      return false;
    });
  }, [entity.id, entityQualifiedName, entities]);

  // Merge Atlan lineage with canvas entities - O(1) lookups with entityByGuidMap
  const allUpstream = useMemo((): LineageConnection[] => {
    const connections = [...canvasUpstream];

    if (atlanLineage) {
      atlanLineage.upstream.forEach(asset => {
        // Check if this asset is already on canvas - O(1) lookup
        const onCanvas = entityByGuidMap.has(asset.guid);
        if (!onCanvas) {
          connections.push({
            lineageAsset: asset,
            relationshipType: 'lineage',
            depth: 1,
            isOnCanvas: false,
          });
        }
      });
    }

    return connections;
  }, [canvasUpstream, atlanLineage, entityByGuidMap]);

  const allDownstream = useMemo((): LineageConnection[] => {
    const connections = [...canvasDownstream];

    if (atlanLineage) {
      atlanLineage.downstream.forEach(asset => {
        // Check if this asset is already on canvas - O(1) lookup
        const onCanvas = entityByGuidMap.has(asset.guid);
        if (!onCanvas) {
          connections.push({
            lineageAsset: asset,
            relationshipType: 'lineage',
            depth: 1,
            isOnCanvas: false,
          });
        }
      });
    }

    return connections;
  }, [canvasDownstream, atlanLineage, entityByGuidMap]);

  // Get qualified name parts for hierarchy display
  const qualifiedNameParts = useMemo(() => {
    const qn = entity.atlanQualifiedName || entity.name;
    return qn.split('/').filter(Boolean);
  }, [entity.atlanQualifiedName, entity.name]);

  // Memoized click handler
  const handleEntityClick = useCallback((conn: LineageConnection) => {
    if (conn.entity) {
      selectEntity(conn.entity.id);
    }
    // TODO: For off-canvas assets, could offer to add to canvas
  }, [selectEntity]);

  // Memoized connection renderer
  const renderConnection = useCallback((conn: LineageConnection, direction: 'up' | 'down') => {
    const name = conn.entity?.displayName || conn.lineageAsset?.name || 'Unknown';
    const typeName = conn.entity?.assetType || conn.lineageAsset?.typeName || '';
    const Icon = TYPE_ICONS[typeName] || Database;
    const ArrowIcon = direction === 'up' ? ArrowUpRight : ArrowDownRight;

    return (
      <button
        key={conn.entity?.id || conn.lineageAsset?.guid}
        onClick={() => handleEntityClick(conn)}
        disabled={!conn.isOnCanvas}
        className={`w-full flex items-center gap-2 p-2 rounded-lg border transition-colors text-left group ${
          conn.isOnCanvas
            ? 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 cursor-pointer'
            : 'border-dashed border-gray-200 bg-gray-50/50 cursor-default opacity-75'
        }`}
      >
        <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${
          direction === 'up' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'
        }`}>
          <Icon size={12} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-gray-900 truncate flex items-center gap-1">
            {name}
            {!conn.isOnCanvas && (
              <span className="text-[10px] text-gray-400">(not on canvas)</span>
            )}
          </div>
          <div className="text-[10px] text-gray-500 flex items-center gap-1">
            <ArrowIcon size={10} />
            <span className="capitalize">{conn.relationshipType}</span>
            {typeName && <span className="text-gray-400">• {typeName}</span>}
          </div>
        </div>
        {conn.isOnCanvas && (
          <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
        )}
      </button>
    );
  }, [handleEntityClick]);

  return (
    <div className="p-4 space-y-4">
      {/* Lineage Status Header */}
      <div className={`flex items-center gap-2 p-3 rounded-lg ${
        hasAtlanLineage || (atlanLineage && (atlanLineage.upstream.length > 0 || atlanLineage.downstream.length > 0))
          ? 'bg-green-50 border border-green-200'
          : 'bg-gray-50 border border-gray-200'
      }`}>
        <GitBranch size={16} className={hasAtlanLineage ? 'text-green-600' : 'text-gray-400'} />
        <div className="flex-1">
          <div className={`text-sm font-medium ${hasAtlanLineage ? 'text-green-700' : 'text-gray-600'}`}>
            {isLoadingLineage ? 'Loading lineage...' : hasAtlanLineage ? 'Lineage Available' : 'Canvas Relationships'}
          </div>
          <div className="text-[10px] text-gray-500">
            {hasAtlanGuid
              ? isAtlanConfigured
                ? 'Live lineage from Atlan'
                : 'Connect to Atlan for lineage'
              : 'Showing canvas relationships only'}
          </div>
        </div>
        {hasAtlanGuid && isAtlanConfigured && (
          <button
            onClick={fetchAtlanLineageData}
            disabled={isLoadingLineage}
            className="p-1.5 hover:bg-green-100 rounded transition-colors"
            title="Refresh lineage"
          >
            {isLoadingLineage ? (
              <Loader2 size={14} className="text-green-600 animate-spin" />
            ) : (
              <RefreshCw size={14} className="text-green-600" />
            )}
          </button>
        )}
        {hasAtlanGuid && (
          <a
            href={`https://atlan.com/assets/${entity.atlanGuid}/lineage`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 hover:bg-green-100 rounded transition-colors"
            title="View in Atlan"
          >
            <ExternalLink size={14} className="text-green-600" />
          </a>
        )}
      </div>

      {lineageError && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 text-red-600 text-xs">
          <AlertCircle size={14} />
          {lineageError}
        </div>
      )}

      {/* Popularity / Discoverability Metrics */}
      {popularity && (
        <div className="border rounded-lg p-3 bg-blue-50/50">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
            <TrendingUp size={12} />
            Discoverability
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {popularity.popularityScore !== undefined && (
              <div className="text-center p-2 bg-white rounded border">
                <div className="text-lg font-bold text-blue-600">{Math.round(popularity.popularityScore)}</div>
                <div className="text-[10px] text-gray-500">Popularity</div>
              </div>
            )}
            {popularity.queryCount !== undefined && (
              <div className="text-center p-2 bg-white rounded border">
                <div className="text-lg font-bold text-purple-600 flex items-center justify-center gap-1">
                  <Search size={14} />
                  {popularity.queryCount.toLocaleString()}
                </div>
                <div className="text-[10px] text-gray-500">Queries</div>
              </div>
            )}
            {popularity.userCount !== undefined && (
              <div className="text-center p-2 bg-white rounded border">
                <div className="text-lg font-bold text-green-600 flex items-center justify-center gap-1">
                  <Users size={14} />
                  {popularity.userCount}
                </div>
                <div className="text-[10px] text-gray-500">Users</div>
              </div>
            )}
            {popularity.lastAccessedAt && (
              <div className="text-center p-2 bg-white rounded border">
                <div className="text-xs font-medium text-gray-700 flex items-center justify-center gap-1">
                  <Clock size={12} />
                  {new Date(popularity.lastAccessedAt).toLocaleDateString()}
                </div>
                <div className="text-[10px] text-gray-500">Last Accessed</div>
              </div>
            )}
          </div>
        </div>
      )}

      {isLoadingPopularity && !popularity && (
        <div className="flex items-center justify-center p-3 text-gray-400">
          <Loader2 size={16} className="animate-spin" />
        </div>
      )}

      {/* Hierarchy Path */}
      {qualifiedNameParts.length > 1 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Hierarchy
          </h4>
          <div className="flex flex-wrap items-center gap-1 text-xs">
            {qualifiedNameParts.map((part, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={12} className="text-gray-300" />}
                <span className={`px-2 py-0.5 rounded ${
                  i === qualifiedNameParts.length - 1
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {part}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Parent Entity */}
      {parentEntity && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
            <ArrowUpRight size={12} className="text-indigo-500" />
            Parent Container
          </h4>
          <button
            onClick={() => selectEntity(parentEntity.id)}
            className="w-full flex items-center gap-2 p-2 rounded-lg border border-indigo-200 bg-indigo-50/50 hover:border-indigo-300 transition-colors text-left group"
          >
            <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 bg-indigo-100 text-indigo-600">
              {TYPE_ICONS[parentEntity.assetType || ''] ? (
                (() => {
                  const ParentIcon = TYPE_ICONS[parentEntity.assetType || ''] || Database;
                  return <ParentIcon size={12} />;
                })()
              ) : (
                <Database size={12} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-gray-900 truncate">{parentEntity.displayName || parentEntity.name}</div>
              <div className="text-[10px] text-gray-500">{parentEntity.assetType}</div>
            </div>
            <ChevronRight size={14} className="text-gray-300 group-hover:text-indigo-500 transition-colors" />
          </button>
        </div>
      )}

      {/* Child Entities (e.g., Columns under Table) */}
      {childEntities.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Layers size={12} className="text-purple-500" />
            Contains ({childEntities.length})
          </h4>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {childEntities.map((child) => {
              const ChildIcon = TYPE_ICONS[child.assetType || ''] || Layers;
              return (
                <button
                  key={child.id}
                  onClick={() => selectEntity(child.id)}
                  className="w-full flex items-center gap-2 p-2 rounded-lg border border-purple-200 bg-purple-50/30 hover:border-purple-300 hover:bg-purple-50 transition-colors text-left group"
                >
                  <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 bg-purple-100 text-purple-600">
                    <ChildIcon size={10} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-900 truncate">{child.displayName || child.name}</div>
                    <div className="text-[10px] text-gray-500">{child.assetType}</div>
                  </div>
                  <ChevronRight size={12} className="text-gray-300 group-hover:text-purple-500 transition-colors" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Upstream (Dependencies) */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
          <ArrowUpRight size={12} className="text-amber-500" />
          Upstream ({allUpstream.length})
          {atlanLineage?.hasMoreUpstream && <span className="text-gray-400">+</span>}
        </h4>
        {isLoadingLineage ? (
          <div className="flex items-center justify-center p-4 text-gray-400">
            <Loader2 size={16} className="animate-spin" />
          </div>
        ) : allUpstream.length === 0 ? (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 text-gray-500 text-xs">
            <AlertCircle size={14} />
            <span>No upstream dependencies found</span>
          </div>
        ) : (
          <div className="space-y-2">
            {allUpstream.map((conn) => renderConnection(conn, 'up'))}
          </div>
        )}
      </div>

      {/* Downstream (Dependents) */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
          <ArrowDownRight size={12} className="text-green-500" />
          Downstream ({allDownstream.length})
          {atlanLineage?.hasMoreDownstream && <span className="text-gray-400">+</span>}
        </h4>
        {isLoadingLineage ? (
          <div className="flex items-center justify-center p-4 text-gray-400">
            <Loader2 size={16} className="animate-spin" />
          </div>
        ) : allDownstream.length === 0 ? (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 text-gray-500 text-xs">
            <AlertCircle size={14} />
            <span>No downstream dependents found</span>
          </div>
        ) : (
          <div className="space-y-2">
            {allDownstream.map((conn) => renderConnection(conn, 'down'))}
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="border-t pt-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-amber-50 rounded-lg p-3 text-center border border-amber-200">
            <div className="text-lg font-bold text-amber-700">{allUpstream.length}</div>
            <div className="text-[10px] text-amber-600 uppercase tracking-wider">Upstream</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
            <div className="text-lg font-bold text-green-700">{allDownstream.length}</div>
            <div className="text-[10px] text-green-600 uppercase tracking-wider">Downstream</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LineagePanel;
