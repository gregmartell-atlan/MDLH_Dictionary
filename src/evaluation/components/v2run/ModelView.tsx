import { useEffect, useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getModel, recomputeGaps, getGaps } from '../../services/v2Api';
import { planApi } from '../../services/evaluationApi';
import { Loader2, RefreshCw, AlertTriangle, Info } from 'lucide-react';
import { ModelerCanvas } from './ModelerCanvas';

// ModelView: Displays model data (gaps + plan) from the evaluation run
// Note: Templates and entity management features have been removed as the backend
// does not support these endpoints. The view now focuses on gap analysis and planning.
// See: docs/V2_ARCHITECTURE.md

export function ModelView() {
  const { run } = useOutletContext<{ run: any }>();
  const [model, setModel] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [gaps, setGaps] = useState<any[]>([]);
  const [recomputing, setRecomputing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Group gaps by field
  const gapsByField = useMemo(() => {
    const map = new Map<string, any[]>();
    gaps.forEach(gap => {
      const field = gap.field || 'Unknown';
      if (!map.has(field)) {
        map.set(field, []);
      }
      map.get(field)!.push(gap);
    });
    return map;
  }, [gaps]);

  useEffect(() => {
    if (!run?.id) return;
    fetchModel();
    fetchGaps();
  }, [run?.id]);

  const fetchModel = async () => {
    if (!run?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getModel(run.id);
      setModel(data);
    } catch (e) {
      console.error('Failed to fetch model:', e);
      setError('Failed to load model data');
    } finally {
      setLoading(false);
    }
  };

  const fetchGaps = async () => {
    if (!run?.id) return;
    try {
      const data = await getGaps(run.id);
      setGaps(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch gaps:', e);
      setGaps([]);
    }
  };

  const handleRecomputeGaps = async () => {
    if (!run?.id) return;
    setRecomputing(true);
    setError(null);
    try {
      const result = await recomputeGaps(run.id);
      // Result is the gap array directly
      const gapArray = Array.isArray(result) ? result : [];
      setGaps(gapArray);
      // Also refresh model to get updated summary
      await fetchModel();
    } catch (e) {
      console.error('Failed to recompute gaps:', e);
      setError('Failed to recompute gaps');
    } finally {
      setRecomputing(false);
    }
  };

  const handleGeneratePlan = async () => {
    if (!run?.id) return;
    setLoading(true);
    setError(null);
    try {
      await planApi.generatePlan(run.id);
      await fetchModel();
    } catch (e) {
      console.error('Failed to generate plan:', e);
      setError('Failed to generate remediation plan');
    } finally {
      setLoading(false);
    }
  };

  if (!run) return null;
  
  if (loading && !model) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin mr-2" />
        <span>Loading model data...</span>
      </div>
    );
  }

  // Priority color helper
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'P0': return 'bg-red-100 text-red-800 border-red-300';
      case 'P1': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'P2': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'P3': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="p-4 sm:p-8 h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold">Gap Analysis & Planning</h2>
          <p className="text-sm text-gray-500">
            {gaps.length} gaps detected across {gapsByField.size} metadata fields
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleRecomputeGaps}
            disabled={recomputing}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 transition"
            aria-disabled={recomputing}
            aria-label="Recompute gaps"
          >
            {recomputing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Recompute Gaps
          </button>
          {gaps.length > 0 && !model?.plan && (
            <button 
              onClick={handleGeneratePlan}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
              aria-label="Generate plan"
            >
              Generate Plan
            </button>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* No gaps message */}
      {gaps.length === 0 && !loading && (
        <div className="mb-6 p-6 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-700">
            <Info size={18} />
            <span className="font-medium">No gaps detected</span>
          </div>
          <p className="text-sm text-green-600 mt-1">
            All metadata fields meet their target coverage thresholds. 
            Run an ingestion to check for new gaps.
          </p>
        </div>
      )}

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
        {/* Gaps by Field */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Metadata Gaps</h3>
          </div>
          <div className="p-4 max-h-[60vh] overflow-auto">
            {gaps.length === 0 ? (
              <p className="text-gray-500 text-sm">No gaps to display</p>
            ) : (
              <div className="space-y-3">
                {gaps.map((gap, idx) => (
                  <div 
                    key={gap.id || idx} 
                    className={`border rounded-lg p-3 ${getPriorityColor(gap.priority)}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{gap.field}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded">
                        {gap.priority}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-gray-600">Current:</span>{' '}
                        <span className="font-medium">{(gap.currentCoverage * 100).toFixed(0)}%</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Target:</span>{' '}
                        <span className="font-medium">{(gap.targetCoverage * 100).toFixed(0)}%</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Effort:</span>{' '}
                        <span className="font-medium">{gap.effortHours?.toFixed(1)}h</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Plan */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Remediation Plan</h3>
          </div>
          <div className="p-4 max-h-[60vh] overflow-auto">
            {!model?.plan ? (
              <div className="text-gray-500 text-sm">
                {gaps.length > 0 
                  ? 'Click "Generate Plan" to create a remediation roadmap'
                  : 'No gaps detected - no plan needed'
                }
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-gray-600 mb-4">
                  Total estimated duration: <strong>{model.plan.totalWeeks} weeks</strong>
                </div>
                {model.plan.phases?.map((phase: any, idx: number) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-900">{phase.name}</h4>
                      <span className="text-xs text-gray-500">{phase.estimatedWeeks} weeks</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{phase.description}</p>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {phase.fields?.map((field: string) => (
                        <span 
                          key={field}
                          className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs"
                        >
                          {field}
                        </span>
                      ))}
                    </div>
                    <div className="text-xs text-gray-500">
                      <strong>Milestone:</strong> {phase.milestone}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      {model?.summary && (
        <div className="mt-6 bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Summary</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{model.summary.totalGaps}</div>
              <div className="text-xs text-gray-500">Total Gaps</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{model.summary.totalEffortHours?.toFixed(0)}h</div>
              <div className="text-xs text-gray-500">Total Effort</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{model.summary.estimatedWeeks}</div>
              <div className="text-xs text-gray-500">Weeks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{model.summary.phaseCount}</div>
              <div className="text-xs text-gray-500">Phases</div>
            </div>
          </div>
          {/* Priority breakdown */}
          {model.summary.byPriority && (
            <div className="mt-4 flex gap-4 justify-center">
              {Object.entries(model.summary.byPriority).map(([priority, count]) => (
                <div key={priority} className={`px-3 py-1 rounded ${getPriorityColor(priority)}`}>
                  <span className="font-semibold">{priority}:</span> {count as number}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Visual modeler - if we have gap data */}
      {gaps.length > 0 && (
        <div className="mt-6 bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="font-semibold text-gray-900">Gap Visualization</h3>
              <p className="text-xs text-gray-500">Visual representation of metadata gaps by priority</p>
            </div>
          </div>
          <ModelerCanvas 
            graph={{
              nodes: gaps.map((gap, idx) => ({
                id: `gap-${idx}`,
                name: gap.field,
                type: gap.priority,
                data: gap
              })),
              edges: []
            }} 
          />
        </div>
      )}
    </div>
  );
}
