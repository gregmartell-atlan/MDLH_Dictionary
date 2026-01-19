import { useState } from 'react';
import { 
  Settings, 
  ArrowLeft, 
  Share2,
  Grid3X3,
  Database,
  FileText,
  History,
  FlaskConical,
  Info,
  X,
  PieChart,
  ChevronRight
} from 'lucide-react';
import { useModelStore } from '../../stores/modelStore';
import { RequirementsMatrix } from './RequirementsMatrix';
import { DomainDesigner } from './DomainDesigner';
import { CustomMetadataDesigner } from './CustomMetadataDesigner';
import { SpreadsheetView } from '../spreadsheet/SpreadsheetView';
import { AnalyticsTab } from './analytics/AnalyticsTab';
import type { RequirementsMatrix as RequirementsMatrixType } from '../../types/requirements';
import type { FieldCoverageResult } from '../../hooks/useFieldCoverage';

const EMPTY_ARRAY: any[] = [];

interface PlanWorkspaceProps {
  planId: string;
  onBack: () => void;
  fieldCoverage?: FieldCoverageResult[];
}

type Tab = 'overview' | 'domains' | 'requirements' | 'definitions' | 'preview' | 'history' | 'analytics';

export function PlanWorkspace({ planId, onBack, fieldCoverage }: PlanWorkspaceProps) {
  const plans = useModelStore((state) => state.model.enrichmentPlans || EMPTY_ARRAY);
  const updatePlan = useModelStore((state) => state.updatePlan);
  const customMetadata = useModelStore((state) => state.model.customMetadata || EMPTY_ARRAY);
  const setCustomMetadata = useModelStore((state) => state.setCustomMetadata);
  
  const plan = plans.find(p => p.id === planId);
  const [activeTab, setActiveTab] = useState<Tab>('requirements');
  const [showSettings, setShowSettings] = useState(false);

  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <h2 className="text-xl font-semibold text-slate-700">Plan not found</h2>
        <button onClick={onBack} className="mt-4 text-blue-600 hover:underline">
          Return to Plan List
        </button>
      </div>
    );
  }

  const handleSaveMatrix = (updatedMatrix: RequirementsMatrixType) => {
    // Update the current matrix
    updatePlan(plan.id, {
      currentMatrix: updatedMatrix,
      updatedAt: new Date().toISOString()
    });
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Workspace Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
              <span>Governance Studio</span>
              <ChevronRight size={10} />
              <span className="text-blue-600">Enrichment Plan</span>
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900">{plan.name}</h1>
              <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full ${
                plan.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
              }`}>
                {plan.status}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              <span>{plan.domains?.length > 0 ? plan.domains.join(', ') : 'No domains'}</span>
              <span>•</span>
              <span>Last updated {new Date(plan.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 mr-4 shadow-inner">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'overview' ? 'bg-white text-blue-700 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
              }`}
            >
              <Info size={14} />
              Overview
            </button>
            <div className="w-px h-4 bg-slate-300 self-center mx-1" />
            <button
              onClick={() => setActiveTab('domains')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'domains' ? 'bg-white text-blue-700 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
              }`}
            >
              <Grid3X3 size={14} />
              Domains
            </button>
            <button
              onClick={() => setActiveTab('definitions')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'definitions' ? 'bg-white text-blue-700 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
              }`}
            >
              <FileText size={14} />
              Definitions
            </button>
            <div className="w-px h-4 bg-slate-300 self-center mx-1" />
            <button
              onClick={() => setActiveTab('requirements')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'requirements' ? 'bg-white text-blue-700 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
              }`}
            >
              <Database size={14} />
              Requirements
            </button>
            <div className="w-px h-4 bg-slate-300 self-center mx-1" />
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'analytics' ? 'bg-white text-blue-700 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
              }`}
            >
              <PieChart size={14} />
              Analytics
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'preview' ? 'bg-white text-blue-700 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
              }`}
            >
              <FlaskConical size={14} />
              Live Preview
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'history' ? 'bg-white text-blue-700 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
              }`}
            >
              <History size={14} />
              History
            </button>
          </div>

          <button 
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              alert('Plan link copied to clipboard!');
            }}
            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Share Plan"
          >
            <Share2 size={18} />
          </button>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-colors ${
              showSettings ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
            title="Plan Settings"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden relative flex">
        <div className="flex-1 overflow-hidden relative">
          {activeTab === 'domains' && (
            <div className="h-full overflow-hidden">
              <DomainDesigner 
                onSave={() => {
                  alert('Domain structure saved!');
                }}
              />
            </div>
          )}

          {activeTab === 'requirements' && (
            <RequirementsMatrix 
              key={plan.id} // Force reset when plan changes
              initialMatrix={plan.currentMatrix}
              onSave={handleSaveMatrix}
              fieldCoverage={fieldCoverage}
            />
          )}

          {activeTab === 'definitions' && (
            <div className="h-full overflow-hidden">
              <CustomMetadataDesigner 
                initialSchemas={customMetadata}
                onSave={(schemas) => {
                  setCustomMetadata(schemas);
                  alert('Custom metadata schemas saved!');
                }}
              />
            </div>
          )}

          {activeTab === 'analytics' && (
            <AnalyticsTab 
              matrix={plan.currentMatrix}
              fieldCoverage={fieldCoverage}
            />
          )}

          {activeTab === 'overview' && (
            <div className="p-8 max-w-4xl mx-auto">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 mb-8">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">Plan Overview</h3>
                <p className="text-blue-700">
                  This plan defines the metadata requirements for <strong>{plan.domains?.length || 0} domains</strong>.
                  It is currently in <strong>{plan.status}</strong> status.
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                  <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Completion</h4>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-bold text-slate-900">
                      {Math.round(((plan.currentMatrix?.assetTypeRequirements || []).reduce((acc, curr) => acc + (curr.requirements?.length || 0), 0) / ((plan.currentMatrix?.assetTypeRequirements?.length || 0) * 5 || 1)) * 100)}%
                    </span>
                    <span className="text-sm text-slate-500 mb-1">of target</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full mt-4 overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${Math.round(((plan.currentMatrix?.assetTypeRequirements || []).reduce((acc, curr) => acc + (curr.requirements?.length || 0), 0) / ((plan.currentMatrix?.assetTypeRequirements?.length || 0) * 5 || 1)) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                  <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Asset Coverage</h4>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-bold text-slate-900">
                      {plan.currentMatrix?.assetTypeRequirements?.length || 0}
                    </span>
                    <span className="text-sm text-slate-500 mb-1">asset types defined</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="h-full overflow-hidden">
              <SpreadsheetView />
            </div>
          )}

          {activeTab === 'history' && (
            <div className="p-8 max-w-3xl mx-auto">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Version History</h3>
              <div className="space-y-6">
                {(plan.versions || []).map((version, i) => (
                  <div key={version.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full bg-blue-500 mt-1.5" />
                      {i < (plan.versions?.length || 0) - 1 && <div className="w-0.5 flex-1 bg-slate-200 my-1" />}
                    </div>
                    <div className="pb-6">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-slate-900">Version {version.versionNumber}</span>
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          {new Date(version.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-slate-600 text-sm">{version.description}</p>
                      <div className="mt-2 text-xs text-slate-500">
                        Created by {version.createdBy}
                      </div>
                    </div>
                  </div>
                ))}
                {(plan.versions?.length || 0) === 0 && (
                  <p className="text-slate-500 italic">No history available.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Settings Sidebar */}
        {showSettings && (
          <div className="w-80 border-l border-slate-200 bg-slate-50 p-6 overflow-y-auto animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-slate-900">Plan Settings</h3>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Plan Name</label>
                <input 
                  type="text" 
                  value={plan.name}
                  onChange={(e) => updatePlan(plan.id, { name: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Status</label>
                <select 
                  value={plan.status}
                  onChange={(e) => updatePlan(plan.id, { status: e.target.value as any })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="pt-6 border-t border-slate-200">
                <button 
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this plan?')) {
                      onBack();
                    }
                  }}
                  className="w-full px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-lg text-sm font-bold hover:bg-red-100 transition-colors"
                >
                  Delete Plan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
