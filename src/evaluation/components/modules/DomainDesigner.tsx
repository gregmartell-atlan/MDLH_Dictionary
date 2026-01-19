/**
 * DomainDesigner - Visual designer for data domain structure
 *
 * Features:
 * - Domain hierarchy builder
 * - Template selection (centralized, by-function, data-mesh)
 * - Domain ownership configuration
 * - Boundary rules editor
 * - Persisted via governanceStore
 */

import { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Users,
  Building2,
  Network,
  ChevronDown,
  ChevronRight,
  Settings,
  Save,
  FolderTree,
  Database,
  RefreshCw,
  BarChart2,
  X,
  Loader2,
} from 'lucide-react';
import {
  DOMAIN_TEMPLATES,
} from '../../types/domains';
import type {
  DomainModel,
  DomainTemplate,
  OwnershipStyle,
} from '../../types/domains';
import { useModelStore } from '../../stores/modelStore';
import { createId, pickFromPalette } from '../../utils/id';
import { fetchAssetsForDomain } from '../../services/atlanApi';
// import { AnalyticsTab } from './analytics/AnalyticsTab';
// import { createDefaultMatrix } from '../../types/model-designer';

const TEMPLATE_ICONS: Record<string, typeof Building2> = {
  'centralized': Building2,
  'by-function': Users,
  'data-mesh': Network,
};

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
];

// Internal state structure for managing multiple domains
interface DomainCollection {
  id: string;
  name: string;
  description: string;
  ownershipStyle: OwnershipStyle;
  domains: DomainModel[];
}

interface DomainDesignerProps {
  /** Optional callback when domains are saved (in addition to store persistence) */
  onSave?: (domains: DomainModel[]) => void;
}

// Helper to create a new domain
function createNewDomain(parentId?: string): DomainModel {
  const id = createId('domain');
  return {
    id,
    name: 'new-domain',
    description: '',
    color: pickFromPalette(id, COLORS),
    boundaryType: 'database',
    boundaryRules: [],
    ownershipModel: {
      style: 'distributed',
      stewardshipModel: 'federated',
      stewards: [],
      escalationPath: [],
    },
    metadataRequirements: [],
    taxonomySubset: [],
    glossaryScope: [],
    parentDomainId: parentId,
    childDomainIds: [],
  };
}

const EMPTY_ARRAY: any[] = [];

export function DomainDesigner({ onSave }: DomainDesignerProps) {
  // Connect to model store
  const storedDomains = useModelStore((state) => state.model.domains || EMPTY_ARRAY);
  const setDomains = useModelStore((state) => state.setDomains);
  const addDomainToStore = useModelStore((state) => state.addDomain);
  const updateDomainInStore = useModelStore((state) => state.updateDomain);
  const removeDomainFromStore = useModelStore((state) => state.deleteDomain);
  
  // Determine initial step based on whether we have seeded domains
  const hasSeededDomains = storedDomains.length > 0;
  const [step, setStep] = useState<'template' | 'design'>(hasSeededDomains ? 'design' : 'template');
  
  // Sync & Analytics state
  const [isSyncing, setIsSyncing] = useState<string | null>(null); // domain ID
  const [showAnalytics, setShowAnalytics] = useState<string | null>(null); // domain ID
  const [analyticsData, setAnalyticsData] = useState<any>(null);

  const [collection, setCollection] = useState<Omit<DomainCollection, 'domains'> | null>(
    hasSeededDomains
      ? {
          id: 'collection-1',
          name: 'Domain Model',
          description: 'Seeded from imported assets',
          ownershipStyle: 'distributed',
        }
      : null
  );
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());

  const domains = storedDomains;

  // Helper to calculate coverage from Atlan assets
  const calculateCoverage = (assets: any[]) => {
    const fields = ['description', 'ownerUsers', 'certificateStatus', 'atlanTags', 'meanings'];
    const total = assets.length;
    if (total === 0) return [];

    return fields.map(field => {
      const populated = assets.filter(a => {
        const val = a.attributes?.[field] || a[field]; // Handle both structures
        return Array.isArray(val) ? val.length > 0 : !!val;
      }).length;
      
      return {
        field: field === 'ownerUsers' ? 'owner' : field === 'meanings' ? 'terms' : field === 'atlanTags' ? 'tags' : field,
        populated,
        total,
        percentage: Math.round((populated / total) * 100),
        byAssetType: {}
      };
    });
  };

  // Handle Sync
  const handleSync = async (domain: DomainModel) => {
    if (!domain.boundaryRules || domain.boundaryRules.length === 0) {
      // If no rules, try to create a default one based on boundaryType
      // This is a simplification for the UI
      return;
    }

    setIsSyncing(domain.id);
    try {
      const assets = await fetchAssetsForDomain(domain.boundaryRules);
      
      // Update domain with sync results
      updateDomainInStore(domain.id, {
        atlanAssets: assets.map(a => a.guid),
        assetCount: assets.length,
        lastSyncedAt: new Date().toISOString()
      });

      // Store full asset data for analytics (in memory for now)
      setAnalyticsData((prev: any) => ({
        ...prev,
        [domain.id]: {
          assets,
          coverage: calculateCoverage(assets)
        }
      }));

    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(null);
    }
  };

  // Handle Show Analytics
  const handleShowAnalytics = (domainId: string) => {
    if (!analyticsData?.[domainId]) {
      const domain = domains.find(d => d.id === domainId);
      if (domain) handleSync(domain).then(() => setShowAnalytics(domainId));
    } else {
      setShowAnalytics(domainId);
    }
  };

  // Handle template selection
  const handleSelectTemplate = (template: DomainTemplate) => {
    // Convert template domains (Partial<DomainModel>[]) to full DomainModel[]
    const templateDomains: DomainModel[] = template.domains.map((d, index) => ({
      id: d.id || `domain-${index}`,
      name: d.name || 'Domain',
      description: d.description || '',
      color: d.color || COLORS[index % COLORS.length],
      boundaryType: d.boundaryType || 'database',
      boundaryRules: d.boundaryRules || [],
      ownershipModel: d.ownershipModel || {
        style: template.style,
        stewardshipModel: 'federated',
        stewards: [],
        escalationPath: [],
      },
      metadataRequirements: d.metadataRequirements || [],
      taxonomySubset: d.taxonomySubset || [],
      glossaryScope: d.glossaryScope || [],
      childDomainIds: d.childDomainIds || [],
      parentDomainId: d.parentDomainId,
      position: d.position,
    }));

    // Persist to governance store
    setDomains(templateDomains);

    setCollection({
      id: 'collection-1',
      name: template.name,
      description: template.description,
      ownershipStyle: template.style,
    });
    setStep('design');
  };

  // Add a new domain
  const addDomain = (parentId?: string) => {
    const newDomain = createNewDomain(parentId);

    // Update parent's childDomainIds if this is a subdomain
    if (parentId) {
      const parent = domains.find((d) => d.id === parentId);
      if (parent) {
        updateDomainInStore(parentId, {
          childDomainIds: [...parent.childDomainIds, newDomain.id],
        });
      }
    }

    // Add new domain to store
    addDomainToStore(newDomain);

    if (parentId) {
      setExpandedDomains(new Set([...expandedDomains, parentId]));
    }

    setSelectedDomainId(newDomain.id);
  };

  // Delete a domain
  const deleteDomain = (domainId: string) => {
    const domainToDelete = domains.find((d) => d.id === domainId);
    if (!domainToDelete) return;

    // Update parent's childDomainIds to remove this domain
    if (domainToDelete.parentDomainId) {
      const parent = domains.find((d) => d.id === domainToDelete.parentDomainId);
      if (parent) {
        updateDomainInStore(domainToDelete.parentDomainId, {
          childDomainIds: parent.childDomainIds.filter((id) => id !== domainId),
        });
      }
    }

    // Remove from store
    removeDomainFromStore(domainId);

    if (selectedDomainId === domainId) {
      setSelectedDomainId(null);
    }
  };

  // Update domain
  const updateDomain = (domainId: string, updates: Partial<DomainModel>) => {
    // Persist to store
    updateDomainInStore(domainId, updates);
  };

  // Toggle domain expansion
  const toggleExpand = (domainId: string) => {
    const newExpanded = new Set(expandedDomains);
    if (newExpanded.has(domainId)) {
      newExpanded.delete(domainId);
    } else {
      newExpanded.add(domainId);
    }
    setExpandedDomains(newExpanded);
  };

  // Get root domains (no parent)
  const rootDomains = useMemo(() => {
    return domains.filter((d) => !d.parentDomainId);
  }, [domains]);

  // Render domain tree node
  const renderDomainNode = (domain: DomainModel, level: number = 0) => {
    const children = domains.filter((d) => d.parentDomainId === domain.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedDomains.has(domain.id);
    const isSelected = selectedDomainId === domain.id;

    return (
      <div key={domain.id}>
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors group ${
            isSelected
              ? 'bg-blue-100 border border-blue-300'
              : 'hover:bg-slate-100'
          }`}
          style={{ paddingLeft: `${12 + level * 20}px` }}
          onClick={() => setSelectedDomainId(domain.id)}
        >
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(domain.id);
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
            style={{ backgroundColor: domain.color }}
          />
          <span className="flex-1 text-sm font-medium text-slate-800">{domain.name}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              addDomain(domain.id);
            }}
            className="p-1 hover:bg-slate-200 rounded opacity-0 group-hover:opacity-100"
            title="Add sub-domain"
          >
            <Plus size={14} className="text-slate-500" />
          </button>
        </div>
        {isExpanded && children.map((child) => renderDomainNode(child, level + 1))}
      </div>
    );
  };

  // Template selection step
  if (step === 'template') {
    return (
      <div className="h-full flex flex-col bg-white">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">Domain Structure Designer</h2>
          <p className="text-sm text-slate-500 mt-1">
            Choose a domain model template to get started
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {DOMAIN_TEMPLATES.map((template) => {
              const Icon = TEMPLATE_ICONS[template.id] || Building2;
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
                    {template.domains.length} starting domains
                  </div>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => {
              // Clear domains in store
              setDomains([]);
              setCollection({
                id: 'collection-1',
                name: 'Custom Domain Model',
                description: '',
                ownershipStyle: 'distributed',
              });
              setStep('design');
            }}
            className="w-full mt-4 p-4 rounded-lg border border-dashed border-slate-300 text-slate-600 hover:bg-slate-50"
          >
            Start from scratch
          </button>

          {/* Option to use seeded domains if available */}
          {storedDomains.length > 0 && (
            <button
              onClick={() => {
                setCollection({
                  id: 'collection-1',
                  name: 'Imported Domain Model',
                  description: 'Seeded from imported assets',
                  ownershipStyle: 'distributed',
                });
                setStep('design');
              }}
              className="w-full mt-2 p-4 rounded-lg border-2 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center justify-center gap-2"
            >
              <Database size={18} />
              Use seeded domains ({storedDomains.length} domains from import)
            </button>
          )}
        </div>
      </div>
    );
  }

  // Design step
  const selectedDomain = domains.find((d) => d.id === selectedDomainId);



  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              {collection?.name || 'Domain Model'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {domains.length} domains defined
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
            {onSave && (
              <button
                onClick={() => onSave(domains)}
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
        {/* Domain Tree */}
        <div className="w-80 border-r border-slate-200 flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Domains</span>
            <button
              onClick={() => addDomain()}
              className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
            >
              <Plus size={14} />
              Add Root
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {rootDomains.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                No domains yet. Click "Add Root" to create one.
              </div>
            ) : (
              <div className="space-y-1">
                {rootDomains.map(domain => renderDomainNode(domain))}
              </div>
            )}
          </div>
        </div>

        {/* Domain Editor */}
        <div className="flex-1 p-6 overflow-y-auto">
          {selectedDomain ? (
            <div className="max-w-2xl space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Domain Name
                </label>
                <input
                  type="text"
                  value={selectedDomain.name}
                  onChange={(e) =>
                    updateDomain(selectedDomain.id, {
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
                  value={selectedDomain.description}
                  onChange={(e) =>
                    updateDomain(selectedDomain.id, { description: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Describe this domain's purpose and scope..."
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
                      onClick={() => updateDomain(selectedDomain.id, { color })}
                      className={`w-8 h-8 rounded-lg border-2 transition-transform ${
                        selectedDomain.color === color
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
                  Boundary Definition
                </label>
                <div className="flex gap-2 mb-2">
                  <select
                    value={selectedDomain.boundaryType}
                    onChange={(e) => {
                      const newType = e.target.value as DomainModel['boundaryType'];
                      updateDomainInStore(selectedDomain.id, {
                        boundaryType: newType,
                      });
                    }}
                    className="w-1/3 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="connector">Connector</option>
                    <option value="database">Database</option>
                    <option value="schema">Schema</option>
                    <option value="path">Path</option>
                    <option value="tag">Tag</option>
                    <option value="custom">Custom</option>
                  </select>
                  <input 
                    type="text"
                    placeholder={selectedDomain.boundaryType === 'tag' ? 'Tag name' : 'Name pattern (e.g. snowflake)'}
                    value={selectedDomain.boundaryRules?.[0]?.pattern || ''}
                    onChange={(e) => {
                      const newRules = [...(selectedDomain.boundaryRules || [])];
                      if (newRules.length === 0) {
                        newRules.push({
                          id: createId('rule'),
                          type: selectedDomain.boundaryType,
                          pattern: e.target.value,
                          isInclude: true
                        });
                      } else {
                        newRules[0] = { ...newRules[0], pattern: e.target.value, type: selectedDomain.boundaryType };
                      }
                      updateDomainInStore(selectedDomain.id, { boundaryRules: newRules });
                    }}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Sync Section */}
                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="text-sm">
                    <div className="font-medium text-slate-700">Atlan Assets</div>
                    <div className="text-slate-500">
                      {selectedDomain.assetCount ? `${selectedDomain.assetCount} assets linked` : 'No assets linked'}
                      {selectedDomain.lastSyncedAt && <span className="text-xs ml-2 text-slate-400">Synced {new Date(selectedDomain.lastSyncedAt).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {selectedDomain.assetCount && selectedDomain.assetCount > 0 && (
                      <button
                        onClick={() => handleShowAnalytics(selectedDomain.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-md text-sm hover:bg-slate-50"
                      >
                        <BarChart2 size={14} />
                        Analytics
                      </button>
                    )}
                    <button
                      onClick={() => handleSync(selectedDomain)}
                      disabled={isSyncing === selectedDomain.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isSyncing === selectedDomain.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                      Sync
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Ownership Style
                </label>
                <select
                  value={selectedDomain.ownershipModel.style}
                  onChange={(e) =>
                    updateDomain(selectedDomain.id, {
                      ownershipModel: {
                        ...selectedDomain.ownershipModel,
                        style: e.target.value as OwnershipStyle,
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="centralized">Centralized</option>
                  <option value="distributed">Distributed</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <button
                  onClick={() => deleteDomain(selectedDomain.id)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 size={16} />
                  Delete Domain
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <FolderTree size={24} className="mr-2" />
              Select a domain to edit
            </div>
          )}
        </div>
      </div>

      {/* Analytics Modal */}
      {showAnalytics && analyticsData?.[showAnalytics] && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-8 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Domain Analytics</h2>
                <p className="text-sm text-slate-500">
                  Analysis for {domains.find(d => d.id === showAnalytics)?.name}
                </p>
              </div>
              <button 
                onClick={() => setShowAnalytics(null)}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {/* <AnalyticsTab 
                matrix={createDefaultMatrix()} 
                fieldCoverage={analyticsData[showAnalytics].coverage}
              /> */}
              <div className="p-8 text-center text-slate-500">
                Analytics temporarily disabled for maintenance.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DomainDesigner;
