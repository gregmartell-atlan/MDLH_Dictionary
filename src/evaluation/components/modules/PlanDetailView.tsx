import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ArrowLeft, Calendar, Users, Target, AlertCircle, CheckCircle2, Edit2, Save, Eye, BarChart3, Shield, UserPlus, MessageSquare } from 'lucide-react';
import { useEnrichmentPlanStore } from '../../stores/enrichmentPlanStore';
import { useCatalogStore } from '../../stores/catalogStore';
import type { EnrichmentPlanProgress } from '../../types/enrichment-plan';
import { calculatePlanMetrics } from '../../types/enrichment-plan';
import { usePlanHydration } from '../../hooks/usePlanHydration';
import { PlanLivePreview } from './PlanLivePreview';
import { AnalyticsTab } from './analytics/AnalyticsTab';
import { AssessmentTabMockup } from './assessment/AssessmentTabMockup';

interface PlanDetailViewProps {
  planId: string;
  onBack?: () => void;
}

type PlanDetailTab = 'overview' | 'requirements' | 'live-preview' | 'analytics' | 'assessment';

export function PlanDetailView({ planId, onBack }: PlanDetailViewProps) {
  const plan = useEnrichmentPlanStore((state) => state.getPlan(planId));
  const updatePlan = useEnrichmentPlanStore((state) => state.updatePlan);
  const updateProgress = useEnrichmentPlanStore((state) => state.updateProgress);
  const catalogAssets = useCatalogStore((state) => state.assets);
  const { hydratePlan } = usePlanHydration();

  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(plan?.name || '');
  const [expandedReqId, setExpandedReqId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PlanDetailTab>('overview');
  const [ownerDraft, setOwnerDraft] = useState(plan?.owner || '');
  const [newComment, setNewComment] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  // Pull live assets for this plan and hydrate analytics/progress when the Analytics tab is opened.
  useEffect(() => {
    if (!plan || activeTab !== 'analytics') return;
    
    hydratePlan(planId).catch((err) => console.error('Failed to hydrate plan analytics', err));
  }, [activeTab, plan, planId, hydratePlan]);

  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <h2 className="text-xl font-semibold text-slate-700">Plan not found</h2>
        <button onClick={onBack} className="mt-4 text-blue-600 hover:underline text-sm">
          ← Go back
        </button>
      </div>
    );
  }

  const metrics = calculatePlanMetrics(plan);
  const daysRemaining = Math.ceil(
    (new Date(plan.targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );
  const isOverdue = daysRemaining < 0;

  const handleSaveName = () => {
    if (editName.trim()) {
      updatePlan(planId, { name: editName });
      setIsEditingName(false);
    }
  };

  const handleStatusChange = (status: typeof plan.status) => {
    updatePlan(planId, { status });
  };

  const handleOwnerSave = () => {
    updatePlan(planId, { owner: ownerDraft });
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    const nextComment = {
      id: uuidv4(),
      author: 'you',
      text: newComment.trim(),
      createdAt: new Date().toISOString(),
      status: 'open' as const,
    };
    updatePlan(planId, {
      comments: [...(plan.comments || []), nextComment],
    });
    setNewComment('');
  };

  const handleUpdateRequirementProgress = (requirementId: string, updates: Partial<EnrichmentPlanProgress>) => {
    updateProgress(planId, requirementId, updates);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-6 bg-white border-b border-slate-200">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            title="Go back"
          >
            <ArrowLeft size={20} className="text-slate-600" />
          </button>

          <div className="flex-1">
            {isEditingName ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1 text-sm font-medium"
                >
                  <Save size={16} />
                  Save
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900">{plan.name}</h1>
                <button
                  onClick={() => setIsEditingName(true)}
                  className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                >
                  <Edit2 size={16} className="text-slate-400" />
                </button>
                <select
                  value={plan.status}
                  onChange={(e) => handleStatusChange(e.target.value as typeof plan.status)}
                  className="text-xs font-bold uppercase rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700"
                >
                  <option value="draft">draft</option>
                  <option value="in-progress">in-progress</option>
                  <option value="in-review">in-review</option>
                  <option value="completed">completed</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-5 gap-4 mt-6">
          {/* Completion */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target size={16} className="text-blue-600" />
              <span className="text-xs font-bold uppercase text-blue-600">Progress</span>
            </div>
            <div className="text-2xl font-bold text-blue-700">{metrics.requiredCompletion}%</div>
            <p className="text-xs text-blue-600 mt-1">of required fields</p>
          </div>

          {/* Timeline */}
          <div
            className={`rounded-lg p-4 ${
              isOverdue
                ? 'bg-gradient-to-br from-red-50 to-red-100'
                : daysRemaining < 14
                  ? 'bg-gradient-to-br from-amber-50 to-amber-100'
                  : 'bg-gradient-to-br from-emerald-50 to-emerald-100'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={16} className={isOverdue ? 'text-red-600' : daysRemaining < 14 ? 'text-amber-600' : 'text-emerald-600'} />
              <span className={`text-xs font-bold uppercase ${isOverdue ? 'text-red-600' : daysRemaining < 14 ? 'text-amber-600' : 'text-emerald-600'}`}>
                Timeline
              </span>
            </div>
            <div className={`text-2xl font-bold ${isOverdue ? 'text-red-700' : daysRemaining < 14 ? 'text-amber-700' : 'text-emerald-700'}`}>
              {isOverdue ? '❌' : daysRemaining > 0 ? daysRemaining : 0}
            </div>
            <p className={`text-xs ${isOverdue ? 'text-red-600' : daysRemaining < 14 ? 'text-amber-600' : 'text-emerald-600'} mt-1`}>
              {isOverdue ? 'Overdue' : daysRemaining > 0 ? `days left` : 'Target reached'}
            </p>
          </div>

          {/* Contributors */}
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users size={16} className="text-purple-600" />
              <span className="text-xs font-bold uppercase text-purple-600">Team</span>
            </div>
            <div className="text-2xl font-bold text-purple-700">{Object.keys(plan.contributors).length}</div>
            <p className="text-xs text-purple-600 mt-1">contributors</p>
            <div className="mt-2 text-xs text-purple-700">
              Owner: {plan.owner || 'Unassigned'}
            </div>
          </div>

          {/* Requirements */}
          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 size={16} className="text-indigo-600" />
              <span className="text-xs font-bold uppercase text-indigo-600">Total</span>
            </div>
            <div className="text-2xl font-bold text-indigo-700">{plan.requirements.length}</div>
            <p className="text-xs text-indigo-600 mt-1">requirements</p>
          </div>

          {/* Status Indicator */}
          <div
            className={`rounded-lg p-4 ${
              metrics.completionColor === 'green'
                ? 'bg-gradient-to-br from-emerald-50 to-emerald-100'
                : metrics.completionColor === 'yellow'
                  ? 'bg-gradient-to-br from-amber-50 to-amber-100'
                  : 'bg-gradient-to-br from-red-50 to-red-100'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {metrics.completionColor === 'green' ? (
                <CheckCircle2 size={16} className="text-emerald-600" />
              ) : metrics.completionColor === 'yellow' ? (
                <AlertCircle size={16} className="text-amber-600" />
              ) : (
                <AlertCircle size={16} className="text-red-600" />
              )}
              <span className={`text-xs font-bold uppercase ${
                metrics.completionColor === 'green'
                  ? 'text-emerald-600'
                  : metrics.completionColor === 'yellow'
                    ? 'text-amber-600'
                    : 'text-red-600'
              }`}>
                Health
              </span>
            </div>
            <div className={`text-lg font-bold ${
              metrics.completionColor === 'green'
                ? 'text-emerald-700'
                : metrics.completionColor === 'yellow'
                  ? 'text-amber-700'
                  : 'text-red-700'
            }`}>
              {metrics.completionColor === 'green' ? 'On Track' : metrics.completionColor === 'yellow' ? 'At Risk' : 'Behind'}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-6">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-4 px-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'text-blue-600 border-blue-600'
                : 'text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('requirements')}
            className={`py-4 px-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'requirements'
                ? 'text-blue-600 border-blue-600'
                : 'text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            Requirements ({plan.requirements.length})
          </button>
          <button
            onClick={() => setActiveTab('live-preview')}
            className={`py-4 px-2 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'live-preview'
                ? 'text-blue-600 border-blue-600'
                : 'text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            <Eye size={16} />
            Live Preview
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`py-4 px-2 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'analytics'
                ? 'text-blue-600 border-blue-600'
                : 'text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            <BarChart3 size={16} />
            Analytics
          </button>
          <button
            onClick={() => setActiveTab('assessment')}
            className={`py-4 px-2 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'assessment'
                ? 'text-blue-600 border-blue-600'
                : 'text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            <Shield size={16} />
            Assessment (V2)
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'assessment' ? (
          <AssessmentTabMockup />
        ) : activeTab === 'analytics' ? (
          <AnalyticsTab planId={planId} />
        ) : activeTab === 'live-preview' ? (
          <div className="h-full">
            <PlanLivePreview
              plan={plan}
              assets={catalogAssets}
              selectedAssetId={selectedAssetId || undefined}
              onSelectAsset={(asset) => setSelectedAssetId(asset.assetGuid)}
            />
          </div>
        ) : activeTab === 'requirements' ? (
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Requirements Breakdown</h2>

            {plan.requirements.length === 0 ? (
              <div className="text-center py-8 bg-white rounded-lg border border-slate-200">
                <p className="text-slate-500">No requirements added yet</p>
        ) : activeTab === 'overview' ? (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <UserPlus size={16} className="text-blue-600" />
                    <h3 className="text-sm font-semibold text-slate-900">Ownership</h3>
                  </div>
                  <button
                    className="text-xs text-blue-600 hover:underline"
                    onClick={handleOwnerSave}
                  >
                    Save owner
                  </button>
                </div>
                <label className="text-xs text-slate-500">Plan owner</label>
                <input
                  value={ownerDraft}
                  onChange={(e) => setOwnerDraft(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md text-sm"
                  placeholder="owner@company.com"
                />
                <div className="mt-3 text-xs text-slate-600">Managers: {plan.managers.join(', ') || 'None set'}</div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare size={16} className="text-emerald-600" />
                  <h3 className="text-sm font-semibold text-slate-900">Comments</h3>
                </div>
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {(plan.comments || []).length === 0 && (
                    <p className="text-sm text-slate-500">No comments yet.</p>
                  )}
                  {(plan.comments || []).map((c) => (
                    <div key={c.id} className="p-3 bg-slate-50 rounded-md border border-slate-200">
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                        <span>{c.author}</span>
                        <span>{new Date(c.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-slate-800">{c.text}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                    rows={3}
                    placeholder="Add a comment"
                  />
                  <button
                    onClick={handleAddComment}
                    className="mt-2 px-3 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700"
                  >
                    Post comment
                  </button>
                </div>
              </div>
            </div>
          </div>
                <p className="text-xs text-slate-400 mt-1">Add requirements to start tracking progress</p>
              </div>
            ) : (
            <div className="space-y-3">
              {plan.requirements.map((req) => {
                const progress = plan.progress.find((p) => p.requirementId === req.id);
                const isExpanded = expandedReqId === req.id;
                const percentComplete = progress?.percentComplete || 0;

                return (
                  <div key={req.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                    {/* Requirement Header */}
                    <button
                      onClick={() => setExpandedReqId(isExpanded ? null : req.id)}
                      className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-slate-900">{req.fieldType}</h3>
                          <span className={`px-2 py-0.5 text-xs font-bold rounded ${
                            req.statusType === 'required'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {req.statusType}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        {progress && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-600 font-medium">
                                {progress.currentCount} / {progress.targetCount} assets
                              </span>
                              <span className="text-xs font-bold text-slate-700">{percentComplete}%</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  percentComplete === 100
                                    ? 'bg-emerald-500'
                                    : percentComplete >= 80
                                      ? 'bg-blue-500'
                                      : 'bg-amber-500'
                                }`}
                                style={{ width: `${percentComplete}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </button>

                    {/* Expanded Details */}
                    {isExpanded && progress && (
                      <div className="border-t border-slate-200 bg-slate-50 p-4 space-y-4">
                        {/* Scope */}
                        <div>
                          <h4 className="text-xs font-bold uppercase text-slate-600 mb-2">Scope</h4>
                          <div className="text-sm text-slate-600 space-y-1">
                            {req.assetScope.domains && req.assetScope.domains.length > 0 && (
                              <div>Domains: {req.assetScope.domains.join(', ')}</div>
                            )}
                            {req.assetScope.qualityThreshold && (
                              <div>Quality: {req.assetScope.qualityThreshold}</div>
                            )}
                            {req.assetScope.tagsRequired && req.assetScope.tagsRequired.length > 0 && (
                              <div>Tags: {req.assetScope.tagsRequired.join(', ')}</div>
                            )}
                          </div>
                        </div>

                        {/* Progress Details */}
                        <div>
                          <h4 className="text-xs font-bold uppercase text-slate-600 mb-2">Progress Details</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-600">Completed:</span>
                              <span className="font-medium text-emerald-600">{progress.currentCount}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600">Remaining:</span>
                              <span className="font-medium text-amber-600">{Math.max(0, progress.targetCount - progress.currentCount)}</span>
                            </div>
                            {progress.completedByUser && Object.keys(progress.completedByUser).length > 0 && (
                              <div className="pt-2 border-t border-slate-200">
                                <p className="text-xs text-slate-500 mb-1">Contributors:</p>
                                {Object.entries(progress.completedByUser)
                                  .sort(([, a], [, b]) => b - a)
                                  .slice(0, 3)
                                  .map(([userId, count]) => (
                                    <div key={userId} className="flex justify-between text-xs">
                                      <span className="text-slate-600">{userId.split('@')[0]}</span>
                                      <span className="font-medium">{count}</span>
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Quick Update */}
                        {progress.currentCount < progress.targetCount && (
                          <div className="pt-2 border-t border-slate-200 space-y-2">
                            <label className="text-xs font-bold uppercase text-slate-600">Update Progress</label>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                min="0"
                                max={progress.targetCount - progress.currentCount}
                                defaultValue={1}
                                placeholder="How many to add?"
                                className="flex-1 px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                id={`qty-${req.id}`}
                              />
                              <button
                                onClick={() => {
                                  const input = document.getElementById(`qty-${req.id}`) as HTMLInputElement;
                                  const qty = parseInt(input?.value || '1');
                                  handleUpdateRequirementProgress(req.id, {
                                    currentCount: Math.min(progress.currentCount + qty, progress.targetCount),
                                    percentComplete: Math.round(
                                      ((progress.currentCount + qty) / progress.targetCount) * 100
                                    ),
                                    onTrack: true,
                                  });
                                }}
                                className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
            </div>
        ) : (
          /* Overview Tab */
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-4">Contributors</h2>
              {Object.keys(plan.contributors).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(plan.contributors)
                    .sort(([, a], [, b]) => b - a)
                    .map(([userId, count]) => (
                      <div key={userId} className="bg-white rounded-lg border border-slate-200 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-slate-900">{userId.split('@')[0]}</span>
                          <span className="text-sm text-slate-500">{userId.split('@')[1]}</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-blue-600">{count}</span>
                          <span className="text-sm text-slate-600">assets completed</span>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm">No contributors yet</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
