import { useState } from 'react';
import { Plus, ChevronRight, Zap, AlertCircle, Clock, User } from 'lucide-react';
import { useEnrichmentPlanStore } from '../../stores/enrichmentPlanStore';
import type { EnrichmentPlan } from '../../types/enrichment-plan';
import { v4 as uuidv4 } from 'uuid';

interface EnrichmentPlansTabProps {
  onSelectPlan?: (planId: string) => void;
}

export function EnrichmentPlansTab({ onSelectPlan }: EnrichmentPlansTabProps) {
  const plans = useEnrichmentPlanStore((state) => state.plans);
  const addPlan = useEnrichmentPlanStore((state) => state.addPlan);
  const setPlanStatus = useEnrichmentPlanStore((state) => state.setPlanStatus);
  const clonePlan = useEnrichmentPlanStore((state) => state.clonePlan);
  const getPlanMetrics = useEnrichmentPlanStore((state) => state.getPlanMetrics);

  const [filterStatus, setFilterStatus] = useState<EnrichmentPlan['status'] | 'all'>('all');
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);

  const handleCreatePlan = () => {
    const newPlan: EnrichmentPlan = {
      id: uuidv4(),
      name: 'New Enrichment Plan',
      description: 'Click to edit description',
      domains: [],
      status: 'draft',
      targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      managers: [],
      contributors: {},
      requirements: [],
      progress: [],
      currentMatrix: {
        id: uuidv4(),
        name: 'New Enrichment Plan',
        description: '',
        status: 'draft',
        assetTypeRequirements: [],
        domainOverrides: [],
        certificationRules: [],
        conditionalRules: [],
        connectorOverrides: [],
      },
      versions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'user',
    };
    addPlan(newPlan);
    onSelectPlan?.(newPlan.id);
  };

  const filteredPlans = filterStatus === 'all' ? plans : plans.filter((p) => p.status === filterStatus);

  const groupedPlans = {
    'In Progress': filteredPlans.filter((p) => p.status === 'in-progress'),
    Draft: filteredPlans.filter((p) => p.status === 'draft'),
    Completed: filteredPlans.filter((p) => p.status === 'completed'),
    Archived: filteredPlans.filter((p) => p.status === 'archived'),
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="px-6 py-6 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Enrichment Plans</h2>
            <p className="text-sm text-slate-500 mt-1">Track metadata improvement projects</p>
          </div>
          <button
            onClick={handleCreatePlan}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium"
          >
            <Plus size={18} />
            New Plan
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {(['all', 'in-progress', 'draft', 'completed', 'archived'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filterStatus === status
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {status === 'all' ? 'All' : status.replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Plans List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {Object.entries(groupedPlans).map(([group, groupPlans]) => {
          if (groupPlans.length === 0) return null;

          return (
            <div key={group}>
              <h3 className="text-xs font-bold uppercase text-slate-500 mb-3">{group}</h3>
              <div className="space-y-3">
                {groupPlans.map((plan) => {
                  const metrics = getPlanMetrics(plan.id);
                  const isExpanded = expandedPlanId === plan.id;
                  const daysRemaining = Math.ceil(
                    (new Date(plan.targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                  );

                  return (
                    <div key={plan.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                      {/* Plan Header */}
                      <button
                        onClick={() => setExpandedPlanId(isExpanded ? null : plan.id)}
                        className="w-full p-4 flex items-start justify-between hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex-1 text-left">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-semibold text-slate-900">{plan.name}</h4>
                            <span
                              className={`px-2 py-0.5 text-xs font-bold uppercase rounded-full ${
                                plan.status === 'in-progress'
                                  ? 'bg-blue-100 text-blue-700'
                                  : plan.status === 'draft'
                                    ? 'bg-slate-100 text-slate-600'
                                    : plan.status === 'completed'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : 'bg-slate-50 text-slate-500'
                              }`}
                            >
                              {plan.status}
                            </span>
                          </div>

                          <p className="text-sm text-slate-600">{plan.description}</p>

                          {/* Progress Bar */}
                          {metrics && (
                            <div className="mt-3 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-600 font-medium">
                                  {metrics.requiredCompletion}% of requirements met
                                </span>
                                <span className="text-xs text-slate-500">
                                  {daysRemaining > 0 ? `${daysRemaining} days left` : 'Target date passed'}
                                </span>
                              </div>
                              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    metrics.completionColor === 'green'
                                      ? 'bg-emerald-500'
                                      : metrics.completionColor === 'yellow'
                                        ? 'bg-amber-500'
                                        : 'bg-red-500'
                                  }`}
                                  style={{ width: `${metrics.requiredCompletion}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Quick Stats */}
                          <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Zap size={14} className="text-slate-400" />
                              {plan.requirements.length} requirements
                            </span>
                            <span className="flex items-center gap-1">
                              <User size={14} className="text-slate-400" />
                              {Object.keys(plan.contributors).length} contributors
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock size={14} className="text-slate-400" />
                              {plan.domains.length > 0 ? plan.domains.length + ' domain(s)' : 'No domains assigned'}
                            </span>
                          </div>
                        </div>

                        <div className="ml-4 pt-1">
                          <ChevronRight
                            size={20}
                            className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          />
                        </div>
                      </button>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="border-t border-slate-200 bg-slate-50 p-4 space-y-4">
                          {/* Requirements Summary */}
                          {plan.requirements.length > 0 ? (
                            <div>
                              <h5 className="text-xs font-bold uppercase text-slate-600 mb-2">Requirements</h5>
                              <div className="space-y-2">
                                {plan.requirements.slice(0, 3).map((req) => {
                                  const progress = plan.progress.find((p) => p.requirementId === req.id);
                                  return (
                                    <div key={req.id} className="flex items-center justify-between text-xs">
                                      <span className="text-slate-700">{req.fieldType}</span>
                                      <div className="flex items-center gap-2">
                                        <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                          <div
                                            className="h-full bg-blue-500 rounded-full"
                                            style={{
                                              width: `${progress?.percentComplete || 0}%`,
                                            }}
                                          />
                                        </div>
                                        <span className="w-10 text-right font-medium text-slate-600">
                                          {progress?.percentComplete || 0}%
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                                {plan.requirements.length > 3 && (
                                  <p className="text-xs text-slate-500 pt-1">+{plan.requirements.length - 3} more</p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500">No requirements added yet</p>
                          )}

                          {/* Contributors */}
                          {Object.keys(plan.contributors).length > 0 && (
                            <div>
                              <h5 className="text-xs font-bold uppercase text-slate-600 mb-2">Top Contributors</h5>
                              <div className="space-y-1">
                                {Object.entries(plan.contributors)
                                  .sort(([, a], [, b]) => b - a)
                                  .slice(0, 3)
                                  .map(([userId, count]) => (
                                    <div key={userId} className="flex items-center justify-between text-xs">
                                      <span className="text-slate-700">{userId.split('@')[0]}</span>
                                      <span className="font-medium text-slate-600">{count} assets</span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex gap-2 pt-2 border-t border-slate-200">
                            {plan.status === 'draft' && (
                              <button
                                onClick={() => setPlanStatus(plan.id, 'in-progress')}
                                className="flex-1 px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                              >
                                Start Plan
                              </button>
                            )}
                            {plan.status === 'in-progress' && (
                              <button
                                onClick={() => setPlanStatus(plan.id, 'completed')}
                                className="flex-1 px-3 py-2 bg-emerald-600 text-white text-xs font-medium rounded hover:bg-emerald-700 transition-colors"
                              >
                                Mark Complete
                              </button>
                            )}
                            <button
                              onClick={() => {
                                const cloned = clonePlan(plan.id, `${plan.name} (Copy)`);
                                if (cloned) onSelectPlan?.(cloned.id);
                              }}
                              className="flex-1 px-3 py-2 bg-slate-200 text-slate-700 text-xs font-medium rounded hover:bg-slate-300 transition-colors"
                            >
                              Clone
                            </button>
                            <button
                              onClick={() => onSelectPlan?.(plan.id)}
                              className="flex-1 px-3 py-2 bg-slate-100 text-slate-700 text-xs font-medium rounded hover:bg-slate-200 transition-colors"
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {filteredPlans.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <AlertCircle size={48} className="text-slate-300 mb-4" />
            <h3 className="text-slate-600 font-medium mb-1">No plans found</h3>
            <p className="text-sm text-slate-500">Create your first enrichment plan to get started</p>
            <button
              onClick={handleCreatePlan}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium"
            >
              <Plus size={18} />
              Create Plan
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
