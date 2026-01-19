/**
 * PlanTimeline - Simple timeline visualization for remediation plan phases
 * 
 * This is a simplified version that doesn't require frappe-gantt.
 * It displays phases as a horizontal timeline with progress indicators.
 */

import { useMemo } from 'react';
import { CheckCircle, Clock, ArrowRight } from 'lucide-react';

interface PlanAction {
  workstream?: string;
  scope?: string;
  effortBucket?: 'L' | 'M' | 'S';
  description?: string;
}

interface PlanPhase {
  name: string;
  description?: string;
  actions?: PlanAction[];
}

interface PlanTimelineProps {
  phases: PlanPhase[];
  className?: string;
}

const EFFORT_LABELS: Record<string, { label: string; color: string; days: number }> = {
  L: { label: 'Large', color: 'bg-red-100 text-red-700', days: 10 },
  M: { label: 'Medium', color: 'bg-yellow-100 text-yellow-700', days: 5 },
  S: { label: 'Small', color: 'bg-green-100 text-green-700', days: 2 },
};

export function PlanTimeline({ phases, className = '' }: PlanTimelineProps) {
  const totalActions = useMemo(() => {
    return phases.reduce((sum, phase) => sum + (phase.actions?.length || 0), 0);
  }, [phases]);

  const totalEffortDays = useMemo(() => {
    return phases.reduce((sum, phase) => {
      const phaseEffort = (phase.actions || []).reduce((actionSum, action) => {
        return actionSum + (EFFORT_LABELS[action.effortBucket || 'S']?.days || 2);
      }, 0);
      return sum + phaseEffort;
    }, 0);
  }, [phases]);

  if (!phases.length) {
    return (
      <div className={`bg-white rounded-lg border p-8 text-center text-gray-500 ${className}`}>
        No plan phases to display
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border overflow-hidden ${className}`}>
      {/* Summary Header */}
      <div className="bg-gray-50 border-b px-6 py-4 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Remediation Plan Timeline</h3>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>{phases.length} phases</span>
          <span>•</span>
          <span>{totalActions} actions</span>
          <span>•</span>
          <span>~{totalEffortDays} days estimated</span>
        </div>
      </div>

      {/* Timeline Phases */}
      <div className="p-6 space-y-6">
        {phases.map((phase, phaseIndex) => (
          <div key={phaseIndex} className="relative">
            {/* Phase Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold">
                {phaseIndex + 1}
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">{phase.name || `Phase ${phaseIndex + 1}`}</h4>
                {phase.description && (
                  <p className="text-sm text-gray-500 mt-0.5">{phase.description}</p>
                )}
              </div>
              {phase.actions && phase.actions.length > 0 && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  {phase.actions.length} action{phase.actions.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Actions List */}
            {phase.actions && phase.actions.length > 0 && (
              <div className="ml-11 space-y-2">
                {phase.actions.map((action, actionIndex) => {
                  const effort = EFFORT_LABELS[action.effortBucket || 'S'] || EFFORT_LABELS.S;
                  return (
                    <div
                      key={actionIndex}
                      className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100"
                    >
                      <Clock size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {action.workstream && (
                            <span className="text-sm font-medium text-gray-900">
                              {action.workstream}
                            </span>
                          )}
                          {action.scope && (
                            <span className="text-sm text-gray-500">
                              → {action.scope}
                            </span>
                          )}
                        </div>
                        {action.description && (
                          <p className="text-sm text-gray-600 mt-1">{action.description}</p>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded font-medium flex-shrink-0 ${effort.color}`}>
                        {effort.label} (~{effort.days}d)
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Connector Line (between phases) */}
            {phaseIndex < phases.length - 1 && (
              <div className="ml-4 mt-4 flex items-center gap-2 text-gray-300">
                <div className="flex-1 border-t border-dashed border-gray-200" />
                <ArrowRight size={16} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Effort Legend */}
      <div className="bg-gray-50 border-t px-6 py-3 flex items-center justify-end gap-4">
        <span className="text-xs text-gray-500">Effort:</span>
        {Object.entries(EFFORT_LABELS).map(([key, { label, color, days }]) => (
          <span key={key} className={`text-xs px-2 py-1 rounded ${color}`}>
            {label} (~{days}d)
          </span>
        ))}
      </div>
    </div>
  );
}

export default PlanTimeline;
