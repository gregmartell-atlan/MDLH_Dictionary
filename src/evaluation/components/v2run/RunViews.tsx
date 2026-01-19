/**
 * RunViews - Plan, Model, and Export views for evaluation runs
 * 
 * Extracted to keep RunDashboard.tsx < 300 lines per design_review.md
 */

import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Download, FileText, RefreshCw } from 'lucide-react';
import { useEvaluationStore } from '../../stores/evaluationStore';
import { artifactApi } from '../../services/evaluationApi';
import type { Run, Gap, Plan, Artifact, ArtifactType } from '../../services/evaluationApi';
import { PlanTimeline } from './PlanTimeline';

// ============================================
// PLAN VIEW
// ============================================

export function PlanView() {
  const { run } = useOutletContext<{ run: Run }>();
  
  // Use individual selectors to avoid re-render loops
  const gaps = useEvaluationStore((s) => s.gaps);
  const plan = useEvaluationStore((s) => s.plan);
  const loadGaps = useEvaluationStore((s) => s.loadGaps);
  const recomputeGaps = useEvaluationStore((s) => s.recomputeGaps);
  const generatePlan = useEvaluationStore((s) => s.generatePlan);
  const loadPlan = useEvaluationStore((s) => s.loadPlan);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedPlan, setHasLoadedPlan] = useState(false);

  useEffect(() => {
    if (run?.id && run?.status === 'COMPLETED' && !hasLoadedPlan) {
      setHasLoadedPlan(true);
      loadGaps();
      loadPlan();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.id, run?.status, hasLoadedPlan]);

  const handleCompute = async () => {
    setLoading(true);
    setError(null);
    try {
      await recomputeGaps();
      await generatePlan();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to compute plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Remediation Plan</h2>
        <button
          onClick={handleCompute}
          disabled={loading}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          data-testid="compute-plan"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Computing...' : 'Compute Gaps + Generate Plan'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded text-red-700">
          {error}
        </div>
      )}

      {gaps.length > 0 && <GapsSection gaps={gaps} />}
      {plan && <PlanSection plan={plan} />}
      {plan && <PlanTimeline phases={plan.phases.map(p => ({
        name: p.name,
        actions: p.fields.map(f => ({
          workstream: f,
          scope: p.description,
          effortBucket: `${p.estimatedWeeks}w`,
          explanation: p.milestone,
        })),
      }))} />}
    </div>
  );
}

function GapsSection({ gaps }: { gaps: Gap[] }) {
  const priorityColors: Record<string, string> = {
    P0: 'bg-red-100 text-red-800',
    P1: 'bg-orange-100 text-orange-800',
    P2: 'bg-yellow-100 text-yellow-800',
    P3: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-bold mb-4">Metadata Gaps</h3>
      <div className="space-y-3">
        {gaps.map((gap, i) => (
          <div key={gap.id || i} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-semibold text-gray-900">{gap.field}</span>
                <span className={`ml-2 px-2 py-0.5 rounded text-xs font-bold ${priorityColors[gap.priority]}`}>
                  {gap.priority}
                </span>
              </div>
              <div className="text-right text-sm">
                <div className="text-gray-600">{gap.effortHours.toFixed(1)} hrs effort</div>
              </div>
            </div>
            <div className="mt-2 flex gap-4 text-sm text-gray-600">
              <div>Current: {(gap.currentCoverage * 100).toFixed(0)}%</div>
              <div>Target: {(gap.targetCoverage * 100).toFixed(0)}%</div>
              <div className="text-red-600 font-medium">Gap: {(gap.gapPercent * 100).toFixed(0)}%</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanSection({ plan }: { plan: Plan }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow" data-testid="generated-plan">
      <h3 className="text-lg font-bold mb-4">
        Remediation Phases ({plan.totalWeeks} weeks total)
      </h3>
      <div className="space-y-4">
        {plan.phases.map((phase, i) => (
          <div key={i} className="border-l-4 border-blue-500 pl-4 py-2">
            <div className="font-bold text-lg">{phase.name}</div>
            <div className="text-sm text-gray-600 mt-1">{phase.description}</div>
            <div className="flex flex-wrap gap-2 mt-2">
              {phase.fields.map(field => (
                <span key={field} className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs">
                  {field}
                </span>
              ))}
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Est. {phase.estimatedWeeks} weeks • Milestone: {phase.milestone}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// MODEL VIEW
// ============================================

export function ModelView() {
  const { run } = useOutletContext<{ run: Run }>();
  
  // Use individual selectors to avoid re-render loops
  const gaps = useEvaluationStore((s) => s.gaps);
  const plan = useEvaluationStore((s) => s.plan);
  const modelSummary = useEvaluationStore((s) => s.modelSummary);
  const loadModel = useEvaluationStore((s) => s.loadModel);
  
  const [hasLoadedModel, setHasLoadedModel] = useState(false);

  useEffect(() => {
    if (run?.id && run?.status === 'COMPLETED' && !hasLoadedModel) {
      setHasLoadedModel(true);
      loadModel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.id, run?.status, hasLoadedModel]);

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <h2 className="text-xl font-bold">Metadata Model</h2>
      
      {modelSummary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <SummaryCard label="Total Gaps" value={modelSummary.totalGaps} />
          <SummaryCard label="Effort (hrs)" value={modelSummary.totalEffortHours.toFixed(0)} />
          <SummaryCard label="Est. Weeks" value={modelSummary.estimatedWeeks} />
          <SummaryCard label="Phases" value={modelSummary.phaseCount} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="font-bold mb-4">Gaps by Priority</h3>
          {modelSummary && (
            <div className="space-y-2">
              {Object.entries(modelSummary.byPriority).map(([priority, count]) => (
                <div key={priority} className="flex justify-between items-center">
                  <span className="font-medium">{priority}</span>
                  <span className="text-gray-600">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="font-bold mb-4">Field Coverage Gaps</h3>
          <div className="space-y-3">
            {gaps.slice(0, 6).map((gap, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="font-medium">{gap.field}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${gap.currentCoverage * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 w-12 text-right">
                    {(gap.currentCoverage * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white p-4 rounded-lg shadow text-center">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

// ============================================
// EXPORT VIEW
// ============================================

export function ExportView() {
  const { run } = useOutletContext<{ run: Run }>();
  const { generateArtifacts, loadArtifacts } = useEvaluationStore();
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    if (run?.id) {
      setLoading(true);
      artifactApi.list(run.id)
        .then(setArtifacts)
        .catch(e => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, [run?.id]);

  const handleGenerate = async () => {
    if (!run?.id) return;
    setGenerating(true);
    setError(null);
    try {
      const newArtifacts = await artifactApi.generate(run.id);
      setArtifacts(newArtifacts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate');
    } finally {
      setGenerating(false);
    }
  };

  const handlePreview = async (type: ArtifactType) => {
    if (!run?.id) return;
    try {
      const content = await artifactApi.download(run.id, type);
      setPreviews(prev => ({ ...prev, [type]: content }));
    } catch (e) {
      console.error('Preview failed:', e);
    }
  };

  const handleDownload = async (type: ArtifactType) => {
    if (!run?.id) return;
    try {
      const { blob, filename } = await artifactApi.downloadBlob(run.id, type);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download failed:', e);
    }
  };

  const artifactTypes: ArtifactType[] = ['CSV', 'JSON', 'MARKDOWN'];

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-xl font-bold">Export Artifacts</h2>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 disabled:bg-gray-300"
            data-testid="generate-artifacts"
          >
            <FileText size={16} />
            {generating ? 'Generating...' : 'Generate All Artifacts'}
          </button>
        </div>
        {error && (
          <div className="bg-red-50 border border-red-200 p-3 rounded text-red-700 text-sm">
            {error}
          </div>
        )}
      </div>

      {loading && (
        <div className="text-center py-12 text-gray-500">Loading artifacts...</div>
      )}

      {!loading && artifacts.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {artifactTypes.map(type => {
            const artifact = artifacts.find(a => a.type === type);
            if (!artifact) return null;

            return (
              <div key={type} className="bg-white p-6 rounded-lg shadow">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg">{type}</h3>
                  <div className="flex gap-2">
                    {!previews[type] && (
                      <button
                        onClick={() => handlePreview(type)}
                        className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded"
                      >
                        Preview
                      </button>
                    )}
                    <button
                      onClick={() => handleDownload(type)}
                      className="flex items-center gap-1 text-sm bg-blue-100 hover:bg-blue-200 px-3 py-1 rounded text-blue-700"
                    >
                      <Download size={14} /> Download
                    </button>
                  </div>
                </div>
                {previews[type] ? (
                  <div className="h-64 overflow-auto bg-gray-50 p-3 rounded border">
                    <pre className="text-xs whitespace-pre-wrap font-mono">
                      {previews[type].substring(0, 2000)}
                      {previews[type].length > 2000 && '...'}
                    </pre>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">Click Preview to view content</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && artifacts.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No artifacts generated yet. Click "Generate All Artifacts" to create exports.
        </div>
      )}
    </div>
  );
}
