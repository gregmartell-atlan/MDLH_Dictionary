/**
 * Project Dashboard
 * 
 * Central hub for viewing generated plans, roadmaps, and metadata models.
 * Allows users to review finalized outputs from the Metadata Assistant.
 */

import { useAssistantStore } from '../../stores/assistantStore';
import { useModelStore } from '../../stores/modelStore';
import { 
  Layout, 
  Calendar, 
  Database, 
  Clock, 
  CheckCircle2, 
  ArrowRight,
  Target,
  Shield,
  Download,
  ExternalLink
} from 'lucide-react';


export function ProjectDashboard() {
  const { projects, activeProjectId, setActiveProject } = useAssistantStore();
  const setActivePlanId = useModelStore((state) => state.setActivePlanId);
  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0];

  const handleOpenInStudio = () => {
    if (!activeProject) return;
    // The project ID in assistantStore should match the plan ID in modelStore 
    // because convertProjectToPlan preserves the ID or we can find it by name
    setActivePlanId(activeProject.id);
    // We also need to trigger a navigation to the 'requirements' view
    // This is usually handled by the parent component or a global event
    window.dispatchEvent(new CustomEvent('navigate-to-governance-studio'));
  };

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <Layout className="w-16 h-16 mb-4 text-slate-300" />
        <h2 className="text-xl font-semibold text-slate-700">No Plans Yet</h2>
        <p className="max-w-md text-center mt-2">
          Use the Modeling Assistant to generate your first metadata implementation plan and roadmap.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-slate-50">
      {/* Sidebar: Project List */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Your Plans</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => setActiveProject(project.id)}
              className={`w-full text-left p-3 rounded-xl text-sm transition-all duration-200 ${
                activeProject?.id === project.id
                  ? 'bg-white text-blue-700 shadow-md ring-1 ring-blue-200 border-l-4 border-l-blue-600'
                  : 'text-slate-600 hover:bg-slate-50 border border-transparent hover:border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold truncate">{project.name}</div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  (project as any).status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-50 text-slate-500 border border-slate-200'
                } border`}>
                  {(project as any).status || 'draft'}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content: Project Details */}
      {activeProject ? (
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-5xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{activeProject.name}</h1>
                <p className="text-slate-600 mt-1">{activeProject.description}</p>
                <div className="flex items-center gap-4 mt-4 text-sm text-slate-500">
                  <span className="flex items-center gap-1">
                    <Database className="w-4 h-4" />
                    {activeProject.domains.join(', ')}
                  </span>
                  <span className="flex items-center gap-1">
                    <Target className="w-4 h-4" />
                    {activeProject.useCases.length} Use Cases
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleOpenInStudio}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-bold shadow-sm transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open in Governance Studio
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 text-sm font-medium">
                  <Download className="w-4 h-4" />
                  Export Plan
                </button>
              </div>
            </div>

            {/* Roadmap Section */}
            {activeProject.roadmap && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <h2 className="text-lg font-semibold text-slate-900">Implementation Roadmap</h2>
                  </div>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                    {activeProject.roadmap.totalDuration} Weeks
                  </span>
                </div>
                <div className="p-6">
                  <div className="space-y-6">
                    {activeProject.roadmap.phases.map((phase, idx) => (
                      <div key={idx} className="relative pl-8 pb-6 last:pb-0">
                        {/* Timeline Line */}
                        <div className="absolute left-3 top-3 bottom-0 w-0.5 bg-slate-200 last:hidden" />
                        <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-blue-100 border-2 border-blue-600 flex items-center justify-center text-xs font-bold text-blue-700 z-10">
                          {idx + 1}
                        </div>
                        
                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-slate-900">{phase.name}</h3>
                            <span className="text-xs text-slate-500">{phase.duration} days</span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Key Activities</h4>
                              <ul className="space-y-1">
                                {phase.keyActivities.map((area, i) => (
                                  <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-1 flex-shrink-0" />
                                    {area}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Deliverable</h4>
                              <ul className="space-y-1">
                                <li className="text-sm text-slate-700 flex items-start gap-2">
                                  <ArrowRight className="w-3 h-3 text-blue-400 mt-1 flex-shrink-0" />
                                  {phase.deliverable}
                                </li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Configuration Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Selected Patterns */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Target className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-lg font-semibold text-slate-900">Selected Patterns</h2>
                </div>
                {activeProject.selectedPatterns && activeProject.selectedPatterns.length > 0 ? (
                  <div className="space-y-3">
                    {activeProject.selectedPatterns.map((pattern) => (
                      <div key={pattern.id} className="p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                        <div className="font-medium text-indigo-900">{pattern.name}</div>
                        <div className="text-xs text-indigo-700 mt-1">{pattern.description}</div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {pattern.fields.filter(f => f.requirement === 'required').slice(0, 3).map(f => (
                            <span key={f.field} className="px-1.5 py-0.5 bg-white rounded text-xs text-indigo-600 border border-indigo-100">
                              {f.field}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 italic">No patterns selected.</p>
                )}
              </div>

              {/* Custom Metadata */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-5 h-5 text-purple-600" />
                  <h2 className="text-lg font-semibold text-slate-900">Custom Metadata</h2>
                </div>
                {activeProject.selectedCustomMetadata && activeProject.selectedCustomMetadata.length > 0 ? (
                  <div className="space-y-3">
                    {activeProject.selectedCustomMetadata.map((cm) => (
                      <div key={cm.id} className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                        <div className="font-medium text-purple-900">{cm.displayName}</div>
                        <div className="text-xs text-purple-700 mt-1">{cm.description}</div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {cm.attributes.slice(0, 3).map(attr => (
                            <span key={attr.id} className="px-1.5 py-0.5 bg-white rounded text-xs text-purple-600 border border-purple-100">
                              {attr.displayName}
                            </span>
                          ))}
                          {cm.attributes.length > 3 && (
                            <span className="px-1.5 py-0.5 text-xs text-purple-500">
                              +{cm.attributes.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 italic">No custom metadata configured.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-400">
          Select a plan to view details
        </div>
      )}
    </div>
  );
}
