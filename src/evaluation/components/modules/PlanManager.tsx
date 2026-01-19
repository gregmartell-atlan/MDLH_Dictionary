import { useState } from 'react';
import {
  Plus,
  Search,
  Calendar,
  User,
  Trash2,
  Copy,
  FileSpreadsheet,
  CheckCircle,
  Clock,
  ArrowRight,
  Download,
  X,
  LayoutGrid,
  List,
  ChevronRight,
  Activity,
  Database
} from 'lucide-react';
import { useModelStore } from '../../stores/modelStore';
import { useAssistantStore } from '../../stores/assistantStore';
import { createEmptyPlan } from '../../types/enrichment-plan';
import type { EnrichmentPlan } from '../../types/enrichment-plan';
import type { PlanStatus } from '../../types/model-designer';
import type { AssistantProject } from '../../types/metadata-assistant';
import { convertProjectToPlan } from '../../utils/projectToPlan';
import { v4 as uuidv4 } from 'uuid';

interface PlanManagerProps {
  onSelectPlan: (planId: string) => void;
}

const EMPTY_PLANS: EnrichmentPlan[] = [];

export function PlanManager({ onSelectPlan }: PlanManagerProps) {
  const plans = useModelStore((state) => state.model.enrichmentPlans || EMPTY_PLANS);
  const addPlan = useModelStore((state) => state.addPlan);
  const deletePlan = useModelStore((state) => state.deletePlan);
  const assistantProjects = useAssistantStore((state) => state.projects);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<PlanStatus | 'all'>('all');
  const [showImportModal, setShowImportModal] = useState(false);
  const [viewType, setViewType] = useState<'grid' | 'list'>('grid');

  const handleImportProject = (project: AssistantProject) => {
    const newPlan = convertProjectToPlan(project);
    addPlan(newPlan);
    setShowImportModal(false);
    onSelectPlan(newPlan.id);
  };

  const handleCreatePlan = () => {
    const newPlan = createEmptyPlan(
      'Untitled Enrichment Plan',
      'New metadata enrichment plan'
    );
    addPlan(newPlan);
    onSelectPlan(newPlan.id);
  };

  const handleDeletePlan = (e: React.MouseEvent, planId: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this plan?')) {
      deletePlan(planId);
    }
  };

  const handleDuplicatePlan = (e: React.MouseEvent, plan: EnrichmentPlan) => {
    e.stopPropagation();
    const newPlan: EnrichmentPlan = {
      ...plan,
      id: uuidv4(),
      name: `${plan.name} (Copy)`,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    addPlan(newPlan);
  };

  const filteredPlans = plans.filter(plan => {
    const matchesSearch = plan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          plan.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || plan.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: PlanStatus) => {
    switch (status) {
      case 'approved': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'in-review': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getStatusIcon = (status: PlanStatus) => {
    switch (status) {
      case 'approved': return <CheckCircle size={14} />;
      case 'in-review': return <Clock size={14} />;
      default: return <FileSpreadsheet size={14} />;
    }
  };

  // Mock completion percentage based on requirements defined
  const getCompletion = (plan: EnrichmentPlan) => {
    const matrix = plan.currentMatrix;
    if (!matrix || !matrix.assetTypeRequirements) return 0;
    
    const total = matrix.assetTypeRequirements.length * 5; // Mock total
    if (total === 0) return 0;
    const defined = matrix.assetTypeRequirements.reduce((acc, curr) => acc + curr.requirements.length, 0);
    return Math.min(Math.round((defined / total) * 100), 100);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="px-8 py-8 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Enrichment Plans</h1>
              <p className="text-slate-500 mt-1">
                Manage metadata requirements across domains and teams
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 shadow-sm transition-all text-sm font-medium"
              >
                <Download size={18} />
                Import from Assistant
              </button>
              <button
                onClick={handleCreatePlan}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm transition-all text-sm font-medium"
              >
                <Plus size={18} />
                New Plan
              </button>
            </div>
          </div>

          {/* Filters & View Toggle */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Search plans..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
              <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200">
                {(['all', 'draft', 'in-review', 'approved'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all ${
                      filterStatus === status
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {status === 'in-review' ? 'In Review' : status}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
              <button
                onClick={() => setViewType('grid')}
                className={`p-1.5 rounded-md transition-all ${
                  viewType === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <LayoutGrid size={18} />
              </button>
              <button
                onClick={() => setViewType('list')}
                className={`p-1.5 rounded-md transition-all ${
                  viewType === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <List size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto">
          {filteredPlans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white border-2 border-dashed border-slate-200 rounded-2xl">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <FileSpreadsheet className="text-slate-300" size={32} />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">No plans found</h3>
              <p className="text-slate-500 mt-1 max-w-xs text-center">
                {searchQuery || filterStatus !== 'all' 
                  ? "Try adjusting your filters or search query."
                  : "Get started by creating a new enrichment plan or importing from the Assistant."}
              </p>
              {!searchQuery && filterStatus === 'all' && (
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    Import from Assistant
                  </button>
                  <button
                    onClick={handleCreatePlan}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                  >
                    Create New Plan
                  </button>
                </div>
              )}
            </div>
          ) : viewType === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPlans.map((plan) => {
                const completion = getCompletion(plan);
                return (
                  <div
                    key={plan.id}
                    onClick={() => onSelectPlan(plan.id)}
                    className="group bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex flex-col"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={`px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${getStatusColor(plan.status || 'draft')}`}>
                        {getStatusIcon(plan.status || 'draft')}
                        {plan.status === 'in-review' ? 'In Review' : plan.status || 'Draft'}
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDuplicatePlan(e, plan); }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all"
                          title="Duplicate"
                        >
                          <Copy size={16} />
                        </button>
                        <button 
                          onClick={(e) => handleDeletePlan(e, plan.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-700 transition-colors truncate">
                      {plan.name}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1 line-clamp-2 flex-1">
                      {plan.description}
                    </p>

                    <div className="mt-6 space-y-4">
                      {/* Progress Bar */}
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-slate-500 font-medium">Enrichment Progress</span>
                          <span className="text-blue-600 font-bold">{completion}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 rounded-full transition-all duration-500"
                            style={{ width: `${completion}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <User size={14} className="text-slate-400" />
                            <span className="truncate max-w-[80px]">{plan.owner || 'Unassigned'}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Calendar size={14} className="text-slate-400" />
                            <span>{plan.currentMatrix?.targetDate ? new Date(plan.currentMatrix.targetDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No date'}</span>
                          </div>
                        </div>
                        <div className="text-blue-600 opacity-0 group-hover:opacity-100 transition-all translate-x-[-4px] group-hover:translate-x-0">
                          <ArrowRight size={18} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Plan Name</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Owner</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Target Date</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Progress</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPlans.map((plan) => {
                    const completion = getCompletion(plan);
                    return (
                      <tr 
                        key={plan.id}
                        onClick={() => onSelectPlan(plan.id)}
                        className="hover:bg-slate-50 cursor-pointer transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900 group-hover:text-blue-700">{plan.name}</div>
                          <div className="text-xs text-slate-500 truncate max-w-xs">{plan.description}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${getStatusColor(plan.status || 'draft')}`}>
                            {getStatusIcon(plan.status || 'draft')}
                            {plan.status === 'in-review' ? 'In Review' : plan.status || 'Draft'}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {plan.owner || '—'}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {plan.currentMatrix.targetDate ? new Date(plan.currentMatrix.targetDate).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-[60px]">
                              <div 
                                className="h-full bg-blue-500 rounded-full"
                                style={{ width: `${completion}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-slate-700">{completion}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDuplicatePlan(e, plan); }}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            >
                              <Copy size={16} />
                            </button>
                            <button 
                              onClick={(e) => handleDeletePlan(e, plan.id)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <Trash2 size={16} />
                            </button>
                            <div className="p-2 text-slate-300 group-hover:text-blue-600 transition-colors">
                              <ChevronRight size={20} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Import from Assistant</h3>
                <p className="text-sm text-slate-500 mt-1">Select a generated project to convert into an enrichment plan</p>
              </div>
              <button 
                onClick={() => setShowImportModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-full shadow-sm transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto bg-white">
              {assistantProjects.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <Activity className="text-slate-300" size={32} />
                  </div>
                  <h4 className="text-lg font-semibold text-slate-900">No Assistant Projects</h4>
                  <p className="text-slate-500 mt-2 max-w-xs">
                    You haven't generated any projects using the Metadata Assistant yet.
                  </p>
                  <button
                    onClick={() => { /* Navigate to assistant */ }}
                    className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all"
                  >
                    Launch Assistant
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {assistantProjects.map(project => (
                    <button
                      key={project.id}
                      onClick={() => handleImportProject(project)}
                      className="w-full text-left p-5 hover:bg-blue-50/50 rounded-xl transition-all border border-slate-100 hover:border-blue-200 group relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-all" />
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                            {project.name}
                          </div>
                          <div className="text-sm text-slate-500 mt-1 line-clamp-1">
                            {project.description}
                          </div>
                          <div className="flex items-center gap-4 mt-4">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                              <Database size={12} />
                              {project.domains[0]}{project.domains.length > 1 ? ` +${project.domains.length - 1}` : ''}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                              <Clock size={12} />
                              {new Date(project.updatedAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-sm group-hover:border-blue-200 group-hover:text-blue-600 transition-all">
                          <Plus size={20} />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-6 py-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
