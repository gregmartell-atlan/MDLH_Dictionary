import { useMemo } from 'react';
import type { PlanComparisonResult } from '../../../services/planComparisonEngine';

interface CoverageHeatmapProps {
  comparison: PlanComparisonResult;
}

export function CoverageHeatmap({ comparison }: CoverageHeatmapProps) {
  // Extract asset types from asset summaries
  const assetTypes = useMemo(() => {
    const types = new Set<string>();
    comparison.assetSummaries.forEach(a => types.add(a.assetType));
    return Array.from(types).sort();
  }, [comparison]);

  // Fields from aggregate metrics
  const fields = Object.keys(comparison.aggregateMetrics.gapsByField);

  const getColor = (percentage: number) => {
    // Red to Green gradient
    if (percentage === 0) return 'bg-red-100 text-red-700';
    if (percentage < 25) return 'bg-red-200 text-red-800';
    if (percentage < 50) return 'bg-orange-200 text-orange-800';
    if (percentage < 75) return 'bg-yellow-200 text-yellow-800';
    if (percentage < 100) return 'bg-emerald-200 text-emerald-800';
    return 'bg-emerald-500 text-white';
  };

  if (comparison.totalAssets === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
        <p className="text-slate-500">No assets analyzed yet.</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-white p-6 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
      <h3 className="text-lg font-bold text-slate-800 mb-6">Metadata Coverage Heatmap</h3>
      
      <div className="min-w-[600px]">
        {/* Header Row */}
        <div className="flex">
          <div className="w-32 shrink-0 p-2 font-semibold text-slate-500 text-sm">Asset Type</div>
          {fields.map(field => (
            <div key={field} className="flex-1 p-2 font-semibold text-slate-700 text-sm text-center capitalize rotate-0">
              {field.replace(/([A-Z])/g, ' $1').trim()}
            </div>
          ))}
        </div>

        {/* Data Rows */}
        {assetTypes.map(type => (
          <div key={type} className="flex border-t border-slate-100 hover:bg-slate-50 transition-colors">
            <div className="w-32 shrink-0 p-3 font-medium text-slate-700 text-sm flex items-center">
              {type}
            </div>
            {fields.map(field => {
              // Calculate coverage for this specific type and field
              const assetsOfType = comparison.assetSummaries.filter(a => a.assetType === type);
              const total = assetsOfType.length;
              
              // Count how many assets of this type have this field populated
              // We need to look at fieldResults for each asset
              const populated = assetsOfType.filter(a => {
                const fieldResult = a.fieldResults.find(f => f.fieldName === field);
                return fieldResult && fieldResult.status !== 'missing';
              }).length;

              const percentage = total > 0 ? Math.round((populated / total) * 100) : 0;

              return (
                <div key={`${type}-${field}`} className="flex-1 p-1">
                  <div 
                    className={`h-full min-h-[40px] rounded flex items-center justify-center text-xs font-bold transition-all ${
                      total > 0 ? getColor(percentage) : 'bg-slate-100 text-slate-300'
                    }`}
                    title={`${type} - ${field}: ${percentage}% (${populated}/${total})`}
                  >
                    {total > 0 ? `${percentage}%` : '-'}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      
      <div className="mt-6 flex items-center gap-4 text-xs text-slate-500 justify-end">
        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-100 rounded"></div> 0%</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-orange-200 rounded"></div> &lt;50%</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-yellow-200 rounded"></div> &lt;75%</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-500 rounded"></div> 100%</div>
      </div>
    </div>
  );
}
