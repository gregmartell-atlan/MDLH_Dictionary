/**
 * Plan Live Preview
 *
 * Shows a side-by-side comparison of:
 * - Plan requirements (what we want)
 * - Current asset metadata (what exists)
 * - Gaps and quality issues
 */

import { useMemo } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  Eye,
  ExternalLink,
} from 'lucide-react';
import type { EnrichmentPlan } from '../../types/enrichment-plan';
import type { AtlanAssetSummary } from '../../services/atlanApi';
import { comparePlanToAssets } from '../../services/planComparisonEngine';
import type { AssetComparisonSummary } from '../../services/planComparisonEngine';
import { getAtlanConfig } from '../../services/atlanApi';

interface PlanLivePreviewProps {
  plan: EnrichmentPlan;
  assets: AtlanAssetSummary[];
  selectedAssetId?: string;
  onSelectAsset?: (asset: AssetComparisonSummary) => void;
}

export function PlanLivePreview({ plan, assets, selectedAssetId, onSelectAsset }: PlanLivePreviewProps) {
  const comparison = useMemo(
    () => comparePlanToAssets(plan, assets),
    [plan, assets]
  );

  const selectedAsset = useMemo(() => {
    if (!selectedAssetId) return comparison.assetSummaries[0] || null;
    return comparison.assetSummaries.find((a) => a.assetGuid === selectedAssetId) || comparison.assetSummaries[0] || null;
  }, [comparison.assetSummaries, selectedAssetId]);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1 grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-4 overflow-hidden">
            {/* Asset List */}
            <div className="overflow-y-auto divide-y divide-slate-200">
              {comparison.assetSummaries.map((assetSummary) => {
                const isSelected = selectedAsset?.assetGuid === assetSummary.assetGuid;
                return (
                  <div
                    key={assetSummary.assetGuid}
                    className={`p-4 border-l-4 cursor-pointer transition-colors ${
                      isSelected ? 'ring-1 ring-blue-300' : 'hover:bg-slate-100'
                    } ${
                      assetSummary.completionPercentage === 100
                        ? 'border-emerald-500 bg-emerald-50'
                        : assetSummary.completionPercentage >= 50
                          ? 'border-amber-500 bg-amber-50'
                          : 'border-red-500 bg-red-50'
                    }`}
                    onClick={() => onSelectAsset?.(assetSummary)}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900">{assetSummary.assetName}</h3>
                        <p className="text-xs text-slate-500">{assetSummary.assetType}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <a
                          href={`${getAtlanConfig()?.baseUrl}/assets/${assetSummary.assetGuid}/overview`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Open in Atlan"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink size={18} />
                        </a>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-slate-900">
                            {assetSummary.completionPercentage}%
                          </div>
                          <div className="text-xs text-slate-600">complete</div>
                        </div>
                      </div>
                    </div>

                    <div className="w-full bg-slate-200 rounded-full h-2 mb-3 overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          assetSummary.completionPercentage === 100
                            ? 'bg-emerald-500'
                            : assetSummary.completionPercentage >= 50
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                        }`}
                        style={{ width: `${assetSummary.completionPercentage}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex gap-4">
                        <span className="flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 size={14} />
                          {assetSummary.completedCount} Complete
                        </span>
                        <span className="flex items-center gap-1 text-amber-700">
                          <AlertCircle size={14} />
                          {assetSummary.partialCount} Partial
                        </span>
                        <span className="flex items-center gap-1 text-red-700">
                          <XCircle size={14} />
                          {assetSummary.missingCount} Missing
                        </span>
                      </div>
                      <span className="font-semibold text-slate-900">Quality: {assetSummary.qualityScore}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detail */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 overflow-y-auto">
              {selectedAsset ? (
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Selected asset</p>
                      <h3 className="text-lg font-semibold text-slate-900">{selectedAsset.assetName}</h3>
                      <p className="text-xs text-slate-500">{selectedAsset.assetType}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">{selectedAsset.completionPercentage}%</p>
                      <p className="text-xs text-slate-500">complete</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                      <p className="text-emerald-700 font-semibold">Complete</p>
                      <p className="text-emerald-900 text-lg">{selectedAsset.completedCount}</p>
                    </div>
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <p className="text-amber-700 font-semibold">Partial</p>
                      <p className="text-amber-900 text-lg">{selectedAsset.partialCount}</p>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                      <p className="text-red-700 font-semibold">Missing</p>
                      <p className="text-red-900 text-lg">{selectedAsset.missingCount}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Fields by status</p>
                    <div className="space-y-2">
                      {(selectedAsset.fieldResults || []).map((field) => (
                        <div
                          key={field.requirementId}
                          className={`flex items-center justify-between px-3 py-2 rounded-md border text-sm ${
                            field.status === 'complete'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : field.status === 'partial'
                                ? 'bg-amber-50 border-amber-200 text-amber-800'
                                : 'bg-red-50 border-red-200 text-red-800'
                          }`}
                        >
                          <span>{field.fieldName}</span>
                          <span className="text-xs uppercase font-semibold">{field.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Select an asset to view details.</p>
              )}
            </div>
          </div>
        </div>

        {/* Empty State */}
        {comparison.assetSummaries.length === 0 && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Eye size={48} className="mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">No Assets to Compare</h3>
              <p className="text-sm text-gray-500 max-w-md">
                Select a plan and domain to fetch assets for comparison against your enrichment requirements.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Field Coverage Summary */}
      <div className="bg-white border-t border-slate-200 px-6 py-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Field Coverage</h3>
        <div className="space-y-2">
          {Object.entries(comparison.aggregateMetrics.gapsByField)
            .sort(([, a], [, b]) => b.coverage - a.coverage)
            .slice(0, 5)
            .map(([fieldName, metrics]) => (
              <div key={fieldName} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">{fieldName}</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full ${
                        metrics.coverage === 100
                          ? 'bg-emerald-500'
                          : metrics.coverage >= 50
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                      }`}
                      style={{ width: `${metrics.coverage}%` }}
                    />
                  </div>
                  <span className="font-semibold text-slate-900 w-12 text-right">
                    {metrics.coverage}%
                  </span>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
