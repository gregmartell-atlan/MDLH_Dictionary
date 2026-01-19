/**
 * Wizard Step 5: Implementation Roadmap
 * 
 * Review the proposed implementation roadmap with phases, timelines, and metrics.
 */

import { useAssistantStore } from '../../stores/assistantStore';
import { Calendar, CheckCircle2, Target, TrendingUp, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { 
  generateReadinessAssessment
} from '../../data/custom-fields-enrichment-readiness';
import { 
  generateAssetEnrichmentSummary,
  type AssetType 
} from '../../data/custom-fields-asset-targeting';
import { useAtlanAudit } from '../../hooks/useAtlanAudit';

export function WizardStep5Roadmap() {
  const { wizardState } = useAssistantStore();
  const { proposedRoadmap, selectedPatterns, selectedCustomMetadata } = wizardState;
  const { audit, fieldCoverage, usingSampleData, dataSource } = useAtlanAudit();
  
  const [showReadinessDetails, setShowReadinessDetails] = useState(false);
  const [showEnrichmentRoadmap, setShowEnrichmentRoadmap] = useState(false);

  // Generate readiness assessment
  const readinessAssessment = generateReadinessAssessment(
    {
      name: 'Your Organization',
      currentMaturity: 'intermediate' as const,
      teamSize: 50,
      governanceMaturity: 'intermediate' as const,
    },
    usingSampleData
      ? undefined
      : {
          fieldCoverage,
          assetBreakdown: audit?.assetBreakdown,
          overallCompletenessScore: audit?.summary?.overallCompletenessScore,
        }
  );
  
  // Generate enrichment summaries for key asset types
  const tableEnrichment = generateAssetEnrichmentSummary('Table' as AssetType);
  const columnEnrichment = generateAssetEnrichmentSummary('Column' as AssetType);

  if (!proposedRoadmap) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">Generating roadmap...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Implementation Roadmap</h2>
        <p className="text-slate-600">
          {proposedRoadmap.totalDuration}-week implementation plan for {proposedRoadmap.totalAssets} assets.
        </p>
      </div>

      {/* Selected Configurations Summary */}
      {(selectedPatterns.length > 0 || selectedCustomMetadata.length > 0) && (
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <h3 className="font-semibold text-slate-900 mb-3">Configuration Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {selectedPatterns.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-2">Selected Patterns</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedPatterns.map(p => (
                    <span key={p.id} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded border border-blue-100">
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {selectedCustomMetadata.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-2">Custom Metadata</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedCustomMetadata.map(cm => (
                    <span key={cm.id} className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded border border-purple-100">
                      {cm.displayName}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Roadmap Overview */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-slate-700">Duration</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{proposedRoadmap.totalDuration} weeks</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-5 h-5 text-emerald-600" />
            <span className="text-sm font-medium text-slate-700">Assets</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{proposedRoadmap.totalAssets}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-slate-700">Phases</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{proposedRoadmap.phases.length}</div>
        </div>
      </div>

      {/* Readiness Assessment Section */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-slate-900">Enrichment Readiness Assessment</h3>
            </div>
            <div className="flex items-center gap-4 mb-2">
              <div>
                <span className="text-2xl font-bold text-blue-700">{readinessAssessment.overallReadinessScore}</span>
                <span className="text-sm text-slate-600">/100</span>
              </div>
              <div className="flex-1">
                <div className="w-full bg-slate-200 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full ${
                      readinessAssessment.overallReadinessScore >= 60 ? 'bg-emerald-500' : 
                      readinessAssessment.overallReadinessScore >= 40 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${readinessAssessment.overallReadinessScore}%` }}
                  />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs font-semibold ${
                    readinessAssessment.overallReadinessLevel === 'optimized' ? 'text-emerald-700' :
                    readinessAssessment.overallReadinessLevel === 'capable' ? 'text-blue-700' :
                    readinessAssessment.overallReadinessLevel === 'emerging' ? 'text-amber-700' : 'text-red-700'
                  }`}>
                    {readinessAssessment.overallReadinessLevel.toUpperCase()}
                  </span>
                  {readinessAssessment.overallReadinessScore < 60 && (
                    <span className="text-xs text-amber-700 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Foundation work recommended before scaling
                    </span>
                  )}
                </div>
              </div>
            </div>
            {!usingSampleData && (
              <p className="text-xs text-slate-500 mb-2">
                Live coverage source: {dataSource === 'mdlh' ? 'MDLH (Snowflake)' : 'Atlan API'}
              </p>
            )}
            {readinessAssessment.criticalGaps.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-xs font-medium text-slate-700">Critical Gaps:</span>
                {readinessAssessment.criticalGaps.slice(0, 3).map((gap, idx) => (
                  <span key={idx} className="px-2 py-0.5 text-xs bg-amber-100 text-amber-800 rounded">
                    {gap}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setShowReadinessDetails(!showReadinessDetails)}
            className="px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 rounded transition-colors"
          >
            {showReadinessDetails ? 'Hide' : 'Details'}
          </button>
        </div>

        {showReadinessDetails && (
          <div className="mt-4 pt-4 border-t border-blue-200 space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Prerequisites</h4>
              <div className="space-y-2">
                {readinessAssessment.prerequisites.prerequisites.slice(0, 5).map((prereq) => (
                  <div key={prereq.name} className="bg-white rounded p-2 border border-slate-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle2 className={`w-4 h-4 ${
                            prereq.status === 'complete' ? 'text-emerald-500' :
                            prereq.status === 'in-progress' ? 'text-blue-500' : 'text-slate-300'
                          }`} />
                          <span className="text-sm font-medium text-slate-900">{prereq.name}</span>
                        </div>
                        <p className="text-xs text-slate-600 ml-6">{prereq.description}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-medium text-slate-700">{prereq.estimatedWeeks}w</div>
                        <div className="text-xs text-slate-500">{prereq.effort}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Top Risks</h4>
              <ul className="space-y-1">
                {readinessAssessment.risks.slice(0, 3).map((riskItem, idx) => (
                  <li key={idx} className="text-xs text-slate-700 flex items-start gap-2">
                    <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5" />
                    <span>{riskItem.risk}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Custom Fields Enrichment Roadmap */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-900">Custom Fields Enrichment Plan</h3>
          <button
            onClick={() => setShowEnrichmentRoadmap(!showEnrichmentRoadmap)}
            className="px-3 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-100 rounded transition-colors"
          >
            {showEnrichmentRoadmap ? 'Hide' : 'Show Plan'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-slate-50 rounded p-3 border border-slate-200">
            <div className="text-xs text-slate-600 mb-1">Tables</div>
            <div className="text-lg font-bold text-slate-900">{tableEnrichment.totalFields} fields</div>
            <div className="text-xs text-slate-600">{tableEnrichment.automationReadiness.fullyAutomated + tableEnrichment.automationReadiness.semiAutomated} automated</div>
          </div>
          <div className="bg-slate-50 rounded p-3 border border-slate-200">
            <div className="text-xs text-slate-600 mb-1">Columns</div>
            <div className="text-lg font-bold text-slate-900">{columnEnrichment.totalFields} fields</div>
            <div className="text-xs text-slate-600">{columnEnrichment.automationReadiness.fullyAutomated + columnEnrichment.automationReadiness.semiAutomated} automated</div>
          </div>
        </div>

        {showEnrichmentRoadmap && (
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Table Enrichment Phases</h4>
              <div className="space-y-2">
                {tableEnrichment.enrichmentRoadmap.map((roadmapPhase, idx) => (
                  <div key={idx} className="bg-gradient-to-r from-purple-50 to-blue-50 rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-slate-900">{roadmapPhase.phase}</span>
                      <span className="text-xs text-slate-600">{roadmapPhase.estimatedEffort}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {roadmapPhase.fieldsToEnrich.slice(0, 8).map((field) => (
                        <span key={field.fieldId} className="px-2 py-0.5 text-xs bg-white border border-slate-200 rounded">
                          {field.fieldId}
                        </span>
                      ))}
                      {roadmapPhase.fieldsToEnrich.length > 8 && (
                        <span className="px-2 py-0.5 text-xs text-slate-500">
                          +{roadmapPhase.fieldsToEnrich.length - 8} more
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-700">
                      {roadmapPhase.fieldsToEnrich.length} fields, {roadmapPhase.prerequisites.length} prerequisites
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Column Enrichment Phases</h4>
              <div className="space-y-2">
                {columnEnrichment.enrichmentRoadmap.map((roadmapPhase, idx) => (
                  <div key={idx} className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-slate-900">{roadmapPhase.phase}</span>
                      <span className="text-xs text-slate-600">{roadmapPhase.estimatedEffort}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {roadmapPhase.fieldsToEnrich.slice(0, 8).map((field) => (
                        <span key={field.fieldId} className="px-2 py-0.5 text-xs bg-white border border-slate-200 rounded">
                          {field.fieldId}
                        </span>
                      ))}
                      {roadmapPhase.fieldsToEnrich.length > 8 && (
                        <span className="px-2 py-0.5 text-xs text-slate-500">
                          +{roadmapPhase.fieldsToEnrich.length - 8} more
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-700">
                      {roadmapPhase.fieldsToEnrich.length} fields, {roadmapPhase.prerequisites.length} prerequisites
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <p className="text-xs text-blue-900">
                <strong>Automation Opportunity:</strong> {((tableEnrichment.automationReadiness.fullyAutomated + tableEnrichment.automationReadiness.semiAutomated) / tableEnrichment.totalFields * 100).toFixed(0)}% of table fields 
                and {((columnEnrichment.automationReadiness.fullyAutomated + columnEnrichment.automationReadiness.semiAutomated) / columnEnrichment.totalFields * 100).toFixed(0)}% of column fields can be automated or semi-automated.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Timeline</h3>
        <div className="space-y-4">
          {proposedRoadmap.phases.map((phase, idx) => (
            <div key={phase.id} className="flex items-start gap-4">
              {/* Week indicator */}
              <div className="flex-shrink-0 w-16 text-right">
                <span className="text-sm font-medium text-slate-600">
                  Week {phase.week || idx + 1}
                </span>
              </div>

              {/* Timeline connector */}
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-blue-100 border-2 border-blue-500 flex items-center justify-center">
                  <span className="text-sm font-bold text-blue-700">{idx + 1}</span>
                </div>
                {idx < proposedRoadmap.phases.length - 1 && (
                  <div className="w-0.5 h-full min-h-[60px] bg-slate-200" />
                )}
              </div>

              {/* Phase details */}
              <div className="flex-1 pb-6">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-slate-900">{phase.name}</h4>
                    {phase.assetsTarget > 0 && (
                      <span className="text-sm font-medium text-blue-600">
                        {phase.assetsTarget} assets
                      </span>
                    )}
                  </div>
                  {phase.sprint && (
                    <div className="text-xs text-slate-500 mb-2">{phase.sprint}</div>
                  )}
                  <ul className="text-sm text-slate-700 space-y-1 mb-2">
                    {phase.keyActivities.map((activity, actIdx) => (
                      <li key={actIdx} className="flex items-start gap-2">
                        <span className="text-slate-400 mt-0.5">•</span>
                        <span>{activity}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="text-sm font-medium text-emerald-700 mt-2">
                    ✓ {phase.deliverable}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Success Metrics */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Success Metrics</h3>
        <div className="grid grid-cols-2 gap-4">
          {proposedRoadmap.metrics.slice(0, 6).map((metric) => (
            <div key={metric.id} className="border border-slate-200 rounded-lg p-4">
              <div className="text-sm font-medium text-slate-900 mb-2">{metric.name}</div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">
                  Baseline: <span className="font-medium">{metric.baseline}</span>
                </span>
                <span className="text-emerald-600">
                  Target: <span className="font-medium">{metric.target}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>Ready to proceed?</strong> Click "Finalize & Create Project" to save this metadata model and roadmap.
          You can refine it further after creation.
        </p>
      </div>
    </div>
  );
}
