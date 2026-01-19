/**
 * TaxonomyBuilder - Visual taxonomy tree builder
 *
 * Features:
 * - Hierarchical taxonomy visualization
 * - Template selection (sensitivity, quality, lifecycle)
 * - Propagation rule configuration
 * - Import/export taxonomy
 * - Persisted via governanceStore
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as ReactWindow from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';

// Workaround for type issues with react-window and react-virtualized-auto-sizer
const List = (ReactWindow as any).FixedSizeList || (ReactWindow as any).default?.FixedSizeList;
const AutoSizerAny = AutoSizer as any;
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Settings,
  Save,
  Shield,
  AlertTriangle,
  Clock,
  Tag,
  Database,
} from 'lucide-react';
import { TAXONOMY_TEMPLATES } from '../../types/taxonomy';
import type {
  TaxonomyDesign,
  TaxonomyNode,
  TaxonomyTemplate,
} from '../../types/taxonomy';
import { useGovernanceStore } from '../../stores/governanceStore';
import { createId, pickFromPalette } from '../../utils/id';

const TEMPLATE_ICONS: Record<string, typeof Shield> = {
  'data-sensitivity': Shield,
  'data-quality': AlertTriangle,
  'data-lifecycle': Clock,
};

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
];

interface TaxonomyBuilderProps {
  /** Optional callback when taxonomy is saved (in addition to store persistence) */
  onSave?: (taxonomy: TaxonomyDesign) => void;
}

interface FlattenedNode extends TaxonomyNode {
  level: number;
}

// Helper to create taxonomy from template
function createTaxonomyFromTemplate(
  template: TaxonomyTemplate,
  id: string
): TaxonomyDesign {
  return {
    id,
    name: template.name,
    description: template.description,
    purpose: template.useCase,
    structure: [...template.nodes],
    propagationRules: [],
    policyMappings: [],
  };
}

export function TaxonomyBuilder({ onSave }: TaxonomyBuilderProps) {
  // Connect to governance store
  const storedTaxonomy = useGovernanceStore((state) => state.taxonomy);
  const setTaxonomyInStore = useGovernanceStore((state) => state.setTaxonomy);

  // URL state management
  const [searchParams, setSearchParams] = useSearchParams();
  const nodeIdFromUrl = searchParams.get('node');

  // Determine initial step based on whether we have seeded taxonomy
  const hasSeededTaxonomy = storedTaxonomy !== null && storedTaxonomy.structure.length > 0;
  const [step, setStep] = useState<'template' | 'design'>(hasSeededTaxonomy ? 'design' : 'template');
  const taxonomy = storedTaxonomy;
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(nodeIdFromUrl);

  // Sync URL with selected node
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedNodeId) {
      params.set('node', selectedNodeId);
    }
    setSearchParams(params, { replace: true });
  }, [selectedNodeId, setSearchParams]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
    // Expand seeded root nodes by default
    if (storedTaxonomy?.structure) {
      return new Set(storedTaxonomy.structure.map(n => n.id));
    }
    return new Set(['root']);
  });

  // Handle template selection
  const handleSelectTemplate = (template: TaxonomyTemplate) => {
    const baseTaxonomy = createTaxonomyFromTemplate(template, 'taxonomy-1');
    setTaxonomyInStore(baseTaxonomy);
    // Expand all top-level nodes
    const topLevelIds = new Set(baseTaxonomy.structure.map((n: TaxonomyNode) => n.id));
    setExpandedNodes(topLevelIds);
    setStep('design');
  };

  // Find node by ID in tree
  const findNode = (nodes: TaxonomyNode[], id: string): TaxonomyNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findNode(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  // Update node in tree
  const updateNodeInTree = (
    nodes: TaxonomyNode[],
    id: string,
    updates: Partial<TaxonomyNode>
  ): TaxonomyNode[] => {
    return nodes.map((node) => {
      if (node.id === id) {
        return { ...node, ...updates };
      }
      if (node.children) {
        return {
          ...node,
          children: updateNodeInTree(node.children, id, updates),
        };
      }
      return node;
    });
  };

  // Delete node from tree
  const deleteNodeFromTree = (nodes: TaxonomyNode[], id: string): TaxonomyNode[] => {
    return nodes
      .filter((node) => node.id !== id)
      .map((node) => ({
        ...node,
        children: node.children ? deleteNodeFromTree(node.children, id) : [],
      }));
  };

  // Add child to node
  const addChildToNode = (parentId: string | null) => {
    if (!taxonomy) return;

    const id = createId('node');
    const newNode: TaxonomyNode = {
      id,
      name: 'new-tag',
      displayName: 'New Tag',
      description: '',
      color: pickFromPalette(id, COLORS),
      parentId: parentId || undefined,
      children: [],
      applicableAssetTypes: ['Table', 'Column'],
      autoDetectionPatterns: [],
      isLeaf: true,
      order: 0,
    };

    if (parentId === null) {
      // Add to root
      setTaxonomyInStore({
        ...taxonomy,
        structure: [...taxonomy.structure, newNode],
      });
    } else {
      // Add to parent's children
      const addChild = (nodes: TaxonomyNode[]): TaxonomyNode[] => {
        return nodes.map((node) => {
          if (node.id === parentId) {
            return {
              ...node,
              children: [...(node.children || []), newNode],
              isLeaf: false,
            };
          }
          if (node.children) {
            return { ...node, children: addChild(node.children) };
          }
          return node;
        });
      };

      setTaxonomyInStore({
        ...taxonomy,
        structure: addChild(taxonomy.structure),
      });
      setExpandedNodes(new Set([...expandedNodes, parentId]));
    }

    setSelectedNodeId(newNode.id);
  };

  // Update node
  const updateNode = (id: string, updates: Partial<TaxonomyNode>) => {
    if (!taxonomy) return;
    setTaxonomyInStore({
      ...taxonomy,
      structure: updateNodeInTree(taxonomy.structure, id, updates),
    });
  };

  // Delete node
  const deleteNode = (id: string) => {
    if (!taxonomy) return;
    setTaxonomyInStore({
      ...taxonomy,
      structure: deleteNodeFromTree(taxonomy.structure, id),
    });
    if (selectedNodeId === id) {
      setSelectedNodeId(null);
    }
  };

  // Toggle expand
  const toggleExpand = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  // Flatten tree for virtualization
  const getFlattenedNodes = (nodes: TaxonomyNode[], level = 0): FlattenedNode[] => {
    let result: FlattenedNode[] = [];
    for (const node of nodes) {
      result.push({ ...node, level });
      if (expandedNodes.has(node.id) && node.children && node.children.length > 0) {
        result = [...result, ...getFlattenedNodes(node.children, level + 1)];
      }
    }
    return result;
  };

  const flattenedNodes = taxonomy ? getFlattenedNodes(taxonomy.structure) : [];

  // Row renderer for virtualization
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const node = flattenedNodes[index];
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = selectedNodeId === node.id;

    return (
      <div style={style}>
        <div
          className={`flex items-center gap-2 px-3 py-2 mx-2 rounded-lg cursor-pointer transition-colors group ${
            isSelected
              ? 'bg-blue-100 border border-blue-300'
              : 'hover:bg-slate-100'
          }`}
          style={{ paddingLeft: `${12 + node.level * 20}px` }}
          onClick={() => setSelectedNodeId(node.id)}
        >
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.id);
              }}
              className="p-0.5 hover:bg-slate-200 rounded"
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className="w-5" />
          )}
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: node.color }}
          />
          <span className="flex-1 text-sm font-medium text-slate-800 truncate">
            {node.displayName}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              addChildToNode(node.id);
            }}
            className="p-1 hover:bg-slate-200 rounded opacity-0 group-hover:opacity-100"
            title="Add child tag"
          >
            <Plus size={14} className="text-slate-500" />
          </button>
        </div>
      </div>
    );
  };

  // Template selection step
  if (step === 'template') {
    return (
      <div className="h-full flex flex-col bg-white">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">Taxonomy Builder</h2>
          <p className="text-sm text-slate-500 mt-1">
            Choose a taxonomy template or start from scratch
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TAXONOMY_TEMPLATES.map((template) => {
              const Icon = TEMPLATE_ICONS[template.id] || Tag;
              return (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className="p-6 rounded-xl border-2 border-slate-200 hover:border-blue-400 hover:shadow-lg transition-all text-left"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-4">
                    <Icon size={24} className="text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-2">{template.name}</h3>
                  <p className="text-sm text-slate-500 mb-3">{template.description}</p>
                  <div className="text-xs text-slate-400">
                    Use case: {template.useCase}
                  </div>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => {
              setTaxonomyInStore({
                id: 'taxonomy-1',
                name: 'Custom Taxonomy',
                description: '',
                purpose: '',
                structure: [],
                propagationRules: [],
                policyMappings: [],
              });
              setStep('design');
            }}
            className="w-full mt-4 p-4 rounded-lg border border-dashed border-slate-300 text-slate-600 hover:bg-slate-50"
          >
            Start from scratch
          </button>

          {/* Option to use seeded taxonomy if available */}
          {storedTaxonomy && storedTaxonomy.structure.length > 0 && (
            <button
              onClick={() => {
                setExpandedNodes(new Set(storedTaxonomy.structure.map(n => n.id)));
                setStep('design');
              }}
              className="w-full mt-2 p-4 rounded-lg border-2 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center justify-center gap-2"
            >
              <Database size={18} />
              Use seeded taxonomy ({storedTaxonomy.structure.reduce((acc, n) => acc + 1 + (n.children?.length || 0), 0)} tags from import)
            </button>
          )}
        </div>
      </div>
    );
  }

  // Design step
  const selectedNode = taxonomy
    ? findNode(taxonomy.structure, selectedNodeId || '')
    : null;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              {taxonomy?.name || 'Taxonomy'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Build your tag hierarchy
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStep('template')}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <Settings size={16} />
              Change Template
            </button>
            {onSave && taxonomy && (
              <button
                onClick={() => onSave(taxonomy)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                <Save size={16} />
                Save
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Taxonomy Tree */}
        <div className="w-80 border-r border-slate-200 flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Tags</span>
            <button
              onClick={() => addChildToNode(null)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
            >
              <Plus size={14} />
              Add Root Tag
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            {flattenedNodes.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                No tags yet. Click "Add Root Tag" to create one.
              </div>
            ) : (
              <AutoSizerAny>
                {({ height, width }: any) => (
                  <List
                    height={height}
                    itemCount={flattenedNodes.length}
                    itemSize={40}
                    width={width}
                  >
                    {Row}
                  </List>
                )}
              </AutoSizerAny>
            )}
          </div>
        </div>

        {/* Node Editor */}
        <div className="flex-1 p-6 overflow-y-auto">
          {selectedNode ? (
            <div className="max-w-2xl space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tag Name
                </label>
                <input
                  type="text"
                  value={selectedNode.displayName}
                  onChange={(e) =>
                    updateNode(selectedNode.id, {
                      displayName: e.target.value,
                      name: e.target.value.toLowerCase().replace(/\s+/g, '-'),
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  value={selectedNode.description}
                  onChange={(e) =>
                    updateNode(selectedNode.id, { description: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Describe this tag's meaning and usage..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => updateNode(selectedNode.id, { color })}
                      className={`w-8 h-8 rounded-lg border-2 transition-transform ${
                        selectedNode.color === color
                          ? 'border-slate-900 scale-110'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Auto-Detection Patterns (one per line)
                </label>
                <textarea
                  value={selectedNode.autoDetectionPatterns.join('\n')}
                  onChange={(e) =>
                    updateNode(selectedNode.id, {
                      autoDetectionPatterns: e.target.value.split('\n').filter(Boolean),
                    })
                  }
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  placeholder="e.g., *email* &#10;*phone*"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Glob patterns to auto-detect this tag on columns
                </p>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <button
                  onClick={() => deleteNode(selectedNode.id)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 size={16} />
                  Delete Tag
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              Select a tag to edit
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TaxonomyBuilder;
