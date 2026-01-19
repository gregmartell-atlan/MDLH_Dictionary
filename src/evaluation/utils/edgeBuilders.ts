// ============================================
// EDGE BUILDERS
// Utilities for building relationship edges from Atlan assets
// ============================================

import { nanoid } from 'nanoid';
import type { EdgeKind } from '../types';

// Re-export for convenience
export type { EdgeKind } from '../types';

export interface EdgeBuilderContext {
  getNodeIdByGuid: (guid?: string | null) => string | undefined;
  getNodeIdByQualifiedName: (qn?: string | null) => string | undefined;
  existingEdgeKeys: Set<string>;
}

export interface BuiltEdge {
  id: string;
  source: string;
  target: string;
  type: 'relationship';
  label: string;
  data: {
    label: string;
    cardinality: string;
    kind: EdgeKind;
  };
  markerEnd: { type: 'arrowclosed' };
}

export interface AssetLike {
  guid?: string;
  qualifiedName?: string;
  typeName?: string;
  attributes?: Record<string, unknown>;
  relationships?: {
    schema?: { qualifiedName?: string; guid?: string };
    database?: { qualifiedName?: string; guid?: string };
    table?: { qualifiedName?: string; guid?: string };
    view?: { qualifiedName?: string; guid?: string };
    schemas?: Array<{ qualifiedName?: string; guid?: string }>;
    tables?: Array<{ qualifiedName?: string; guid?: string }>;
    views?: Array<{ qualifiedName?: string; guid?: string }>;
    columns?: Array<{ qualifiedName?: string; guid?: string }>;
    inputs?: Array<{ qualifiedName?: string; guid?: string }>;
    outputs?: Array<{ qualifiedName?: string; guid?: string }>;
    inputToProcesses?: Array<{ qualifiedName?: string; guid?: string }>;
    outputFromProcesses?: Array<{ qualifiedName?: string; guid?: string }>;
  };
}

/**
 * Generate a unique key for an edge to prevent duplicates
 */
export function edgeKey(params: { source: string; target: string; label: string; kind: EdgeKind }): string {
  return `${params.source}|${params.target}|${params.kind}|${(params.label || '').toLowerCase()}`;
}

function addEdgeIfPossible(
  edges: BuiltEdge[],
  ctx: EdgeBuilderContext,
  params: { sourceId?: string; targetId?: string; label: string; cardinality: string; kind: EdgeKind }
): void {
  const { sourceId, targetId, label, cardinality, kind } = params;
  if (!sourceId || !targetId || sourceId === targetId) return;

  const k = edgeKey({ source: sourceId, target: targetId, label, kind });
  if (ctx.existingEdgeKeys.has(k)) return;
  ctx.existingEdgeKeys.add(k);

  edges.push({
    id: `${sourceId}-${targetId}-${nanoid(6)}`,
    source: sourceId,
    target: targetId,
    type: 'relationship',
    label,
    data: { label, cardinality, kind },
    markerEnd: { type: 'arrowclosed' },
  });
}

// ============================================
// CONTAINMENT EDGES (DB→Schema→Table/View→Column)
// ============================================

export function buildContainmentEdges(
  assets: AssetLike[],
  ctx: EdgeBuilderContext
): BuiltEdge[] {
  const edges: BuiltEdge[] = [];
  const norm = (v: unknown): string => (v || '').toString().toLowerCase();

  const qnToNodeId = (qn?: string | null) => ctx.getNodeIdByQualifiedName(qn);
  const guidToNodeId = (guid?: string | null) => ctx.getNodeIdByGuid(guid);

  // Parent edge per asset using qualified-name hints
  (assets || []).forEach((asset) => {
    const childId = qnToNodeId(asset?.qualifiedName) || guidToNodeId(asset?.guid);
    if (!childId) return;

    const attrs = asset?.attributes || {};
    const rels = asset?.relationships || {};

    const schemaQn = rels?.schema?.qualifiedName || (attrs.schemaQualifiedName as string);
    const dbQn = rels?.database?.qualifiedName || (attrs.databaseQualifiedName as string);
    const tableQn = rels?.table?.qualifiedName || (attrs.tableQualifiedName as string);
    const viewQn = rels?.view?.qualifiedName || (attrs.viewQualifiedName as string);

    let parentQn: string | null = null;
    const typeName = norm(asset?.typeName);
    if (typeName.includes('column') || typeName.includes('field')) {
      parentQn = tableQn || viewQn || schemaQn || dbQn || null;
    } else if (typeName.includes('table') || typeName.includes('view')) {
      parentQn = schemaQn || dbQn || null;
    } else if (typeName.includes('schema') || typeName.includes('dataset')) {
      parentQn = dbQn || null;
    }

    if (!parentQn) return;
    const parentId = qnToNodeId(parentQn);
    addEdgeIfPossible(edges, ctx, {
      sourceId: parentId,
      targetId: childId,
      label: 'contains',
      cardinality: '1:N',
      kind: 'containment',
    });
  });

  // Relationship arrays for containment
  (assets || []).forEach((asset) => {
    const sourceId = qnToNodeId(asset?.qualifiedName) || guidToNodeId(asset?.guid);
    if (!sourceId) return;
    const rels = asset?.relationships || {};

    const addContainsFromArray = (relsArray: Array<{ qualifiedName?: string; guid?: string }> | undefined) => {
      if (!Array.isArray(relsArray)) return;
      relsArray.forEach((r) => {
        const targetId = qnToNodeId(r?.qualifiedName) || guidToNodeId(r?.guid);
        addEdgeIfPossible(edges, ctx, {
          sourceId,
          targetId,
          label: 'contains',
          cardinality: '1:N',
          kind: 'containment',
        });
      });
    };

    addContainsFromArray(rels.schemas);
    addContainsFromArray(rels.tables);
    addContainsFromArray(rels.views);
    addContainsFromArray(rels.columns);
  });

  return edges;
}

// ============================================
// LINEAGE EDGES (Asset → Process → Asset)
// ============================================

export function buildLineageEdges(assets: AssetLike[], ctx: EdgeBuilderContext): BuiltEdge[] {
  const edges: BuiltEdge[] = [];
  const qnToNodeId = (qn?: string | null) => ctx.getNodeIdByQualifiedName(qn);
  const guidToNodeId = (guid?: string | null) => ctx.getNodeIdByGuid(guid);
  const norm = (v: unknown): string => (v || '').toString().toLowerCase();

  const isProcessLike = (typeName: unknown): boolean => {
    const t = norm(typeName);
    return t.includes('process');
  };

  // Build lineage edges using the imported asset relationship arrays:
  // - asset.relationships.inputToProcesses: Asset → Process
  // - asset.relationships.outputFromProcesses: Process → Asset
  (assets || []).forEach((asset) => {
    const assetId = qnToNodeId(asset?.qualifiedName) || guidToNodeId(asset?.guid);
    if (!assetId) return;
    const rels = asset?.relationships || {};

    const inputTo = rels?.inputToProcesses;
    if (Array.isArray(inputTo)) {
      inputTo.forEach((p) => {
        const procId = qnToNodeId(p?.qualifiedName) || guidToNodeId(p?.guid);
        addEdgeIfPossible(edges, ctx, {
          sourceId: assetId,
          targetId: procId,
          label: 'input to',
          cardinality: 'N:N',
          kind: 'lineage',
        });
      });
    }

    const outputFrom = rels?.outputFromProcesses;
    if (Array.isArray(outputFrom)) {
      outputFrom.forEach((p) => {
        const procId = qnToNodeId(p?.qualifiedName) || guidToNodeId(p?.guid);
        addEdgeIfPossible(edges, ctx, {
          sourceId: procId,
          targetId: assetId,
          label: 'outputs',
          cardinality: 'N:N',
          kind: 'lineage',
        });
      });
    }
  });

  // Additionally, if Process nodes are present, connect their inputs/outputs directly:
  // - process.relationships.inputs: Asset → Process
  // - process.relationships.outputs: Process → Asset
  (assets || []).forEach((asset) => {
    if (!isProcessLike(asset?.typeName)) return;
    const procId = qnToNodeId(asset?.qualifiedName) || guidToNodeId(asset?.guid);
    if (!procId) return;
    const rels = asset?.relationships || {};

    const inputs = rels?.inputs;
    if (Array.isArray(inputs)) {
      inputs.forEach((a) => {
        const assetId = qnToNodeId(a?.qualifiedName) || guidToNodeId(a?.guid);
        addEdgeIfPossible(edges, ctx, {
          sourceId: assetId,
          targetId: procId,
          label: 'input to',
          cardinality: 'N:N',
          kind: 'lineage',
        });
      });
    }

    const outputs = rels?.outputs;
    if (Array.isArray(outputs)) {
      outputs.forEach((a) => {
        const assetId = qnToNodeId(a?.qualifiedName) || guidToNodeId(a?.guid);
        addEdgeIfPossible(edges, ctx, {
          sourceId: procId,
          targetId: assetId,
          label: 'outputs',
          cardinality: 'N:N',
          kind: 'lineage',
        });
      });
    }
  });

  return edges;
}

// ============================================
// PLACEHOLDER BUILDERS (for future expansion)
// ============================================

export function buildGlossaryEdges(assets: AssetLike[], ctx: EdgeBuilderContext): BuiltEdge[] {
  void assets;
  void ctx;
  return [];
}

export function buildGovernanceEdges(assets: AssetLike[], ctx: EdgeBuilderContext): BuiltEdge[] {
  void assets;
  void ctx;
  return [];
}
