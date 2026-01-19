import { BarChart3, TrendingUp } from 'lucide-react';
import { DaaPRadarChart } from './DaaPRadarChart';
import { CoverageHeatmap } from './CoverageHeatmap';
import { TrendChart } from './TrendChart';
import { usePlanMetricsStore } from '../../../stores/planMetricsStore';
import { useEnrichmentPlanStore } from '../../../stores/enrichmentPlanStore';

interface AnalyticsTabProps {
  planId?: string;
  matrix?: any;
  fieldCoverage?: any;
}

export function AnalyticsTab({ planId, matrix, fieldCoverage }: AnalyticsTabProps) {
  const plan = useEnrichmentPlanStore(s => planId ? s.getPlan(planId) : undefined);
  const latestComparison = usePlanMetricsStore(s => planId ? s.getLatestComparison(planId) : undefined);
  const trend = usePlanMetricsStore(s => planId ? s.getTrend(planId) : undefined);

  const comparisonResult = latestComparison?.result || (matrix && fieldCoverage ? {
      aggregateMetrics: { 
          averageCompletion: 0, 
          gapsByField: {},
          totalRequirements: 0,
          completedAssets: 0,
          partialAssets: 0,
          incompleteAssets: 0,
          overallQualityScore: 0
      },
      planId: planId || 'preview',
      planTitle: 'Preview',
      comparisonTimestamp: new Date().toISOString(),
      totalAssets: 0,
      assetSummaries: []
  } : null);

  if (!comparisonResult) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <BarChart3 size={48} className="mb-4 text-slate-300" />
        <p className="text-lg font-medium">No analytics data available yet</p>
        <p className="text-sm">Wait for the first sync to complete...</p>
      </div>
    );
  }

  const { aggregateMetrics } = comparisonResult;
  const gaps = Object.entries(aggregateMetrics.gapsByField || {})
    .map(([field, metrics]) => ({ field, ...metrics }))
    .sort((a, b) => a.coverage - b.coverage);

  // Dynamic recommendation logic
  const lowestGap = gaps[0];
  const recommendationText = lowestGap 
    ? `Focusing on **${lowestGap.field}** would have the highest impact, as it is missing in ${lowestGap.missing} assets.`
    : "Great job! All required fields are well-populated.";

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Governance Analytics</h2>
            <p className="text-slate-500 mt-1">Insights for {plan?.name || 'Current Plan'}</p>
          </div>
          <div className="text-sm text-slate-400">
            Last updated: {latestComparison ? new Date(latestComparison.timestamp).toLocaleString() : 'Live Preview'}
          </div>
        </div>

        {/* Top Row: Radar Chart & Summary Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Radar Chart - Takes up 1 column */}
          <div className="lg:col-span-1">
            <DaaPRadarChart comparison={comparisonResult} />
          </div>

          {/* Summary Stats - Takes up 2 columns */}
          <div className="lg:col-span-2 grid grid-cols-2 gap-4">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-slate-500 mb-2">
                  <BarChart3 size={18} />
                  <span className="font-semibold uppercase text-xs tracking-wider">Overall Completeness</span>
                </div>
                <div className="text-4xl font-bold text-slate-900">
                  {aggregateMetrics.averageCompletion}%
                </div>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full mt-4 overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full transition-all duration-1000" 
                  style={{ width: `${aggregateMetrics.averageCompletion}%` }}
                />
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h4 className="font-semibold text-slate-800 mb-4">Top Gaps</h4>
              <ul className="space-y-3">
                {gaps.slice(0, 3).map(gap => (
                    <li key={gap.field} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 capitalize">{gap.field}</span>
                      <span className="font-bold text-red-600">{gap.coverage}%</span>
                    </li>
                  ))}
                {gaps.length === 0 && (
                  <li className="text-slate-400 italic text-sm">No gaps found!</li>
                )}
              </ul>
            </div>

            <div className="col-span-2 bg-blue-50 border border-blue-100 p-6 rounded-xl flex gap-4">
              <div className="p-2 bg-blue-100 rounded-lg h-fit">
                <TrendingUp size={24} className="text-blue-600" />
              </div>
              <div>
                <h4 className="font-bold text-blue-900 mb-1">AI Recommendation</h4>
                <p className="text-blue-700 text-sm leading-relaxed">
                  {recommendationText.split('**').map((part, i) => 
                    i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Row: Trend Chart */}
        {trend && (
          <div>
            <TrendChart trend={trend} />
          </div>
        )}

        {/* Bottom Row: Heatmap */}
        <div>
          <CoverageHeatmap comparison={comparisonResult} />
        </div>

      </div>
    </div>
  );
}
