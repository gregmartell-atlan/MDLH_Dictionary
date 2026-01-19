// ============================================
// OVERVIEW TAB
// Main overview showing stats, coverage, and recommendations
// ============================================

import {
  BarChart3,
  Layers,
  Tag,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Users,
  FileText,
  BookOpen,
  ArrowRight,
  ClipboardList,
} from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { CoverageBar } from '../components/CoverageBar';
import type { ExploreDataState } from '../../../hooks/useExploreData';
import { useEnrichmentPlanStore } from '../../../stores/enrichmentPlanStore';

interface OverviewTabProps {
  data: ExploreDataState;
  onNavigate?: (view: string) => void;
  onSimulateField?: (field: string) => void;
  onSwitchTab?: (tab: string) => void;
}

export function OverviewTab({ data, onNavigate, onSimulateField, onSwitchTab }: OverviewTabProps) {
  const {
    totalAssets,
    assetBreakdown,
    metadataCoverage,
    healthScore,
    gaps,
    mode,
    importedAssetCount,
  } = data;

  const plans = useEnrichmentPlanStore((s) => s.plans);
  const activePlans = plans.filter(p => p.status === 'in-progress' || p.status === 'draft'); // Show drafts too for now


  // Calculate risk level
  const getRiskLevel = (score: number) => {
    if (score >= 70) return { label: 'Low Risk', color: 'var(--success-color)' };
    if (score >= 40) return { label: 'Medium Risk', color: 'var(--warning-color)' };
    return { label: 'High Risk', color: 'var(--error-color)' };
  };

  const risk = getRiskLevel(healthScore);

  // Get health grade
  const getHealthGrade = (score: number) => {
    if (score >= 90) return { grade: 'A', color: 'var(--success-color)', bg: 'var(--success-bg-color)' };
    if (score >= 80) return { grade: 'B', color: 'var(--success-color)', bg: 'var(--success-bg-color)' };
    if (score >= 70) return { grade: 'C', color: 'var(--warning-color)', bg: 'var(--warning-bg-color)' };
    if (score >= 60) return { grade: 'D', color: 'var(--warning-color)', bg: 'var(--warning-bg-color)' };
    return { grade: 'F', color: 'var(--error-color)', bg: 'var(--error-bg-color)' };
  };

  const healthGrade = getHealthGrade(healthScore);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Assets"
          value={totalAssets}
          sublabel={
            mode === 'imported'
              ? 'Imported'
              : mode === 'hybrid'
              ? `Live from Atlan • Imported baseline: ${importedAssetCount.toLocaleString()}`
              : mode === 'live'
              ? 'Live from Atlan'
              : 'No data'
          }
          icon={Layers}
          iconBgClass="bg-purple-100"
          iconColorClass="text-purple-600"
        />

        <StatCard
          label="Asset Types"
          value={assetBreakdown.length}
          sublabel={assetBreakdown.slice(0, 3).map(a => a.type).join(', ')}
          icon={BarChart3}
          iconBgClass="bg-blue-100"
          iconColorClass="text-blue-600"
        />

        <StatCard
          label="Health Score"
          value={`${healthScore}%`}
          sublabel={risk.label}
          icon={healthScore >= 70 ? CheckCircle : AlertTriangle}
          iconBgClass={healthScore >= 70 ? 'bg-green-100' : 'bg-red-100'}
          iconColorClass={healthScore >= 70 ? 'text-green-600' : 'text-red-600'}
          valueColor={healthGrade.color}
          progress={{ value: healthScore, color: healthScore >= 70 ? 'green' : healthScore >= 40 ? 'amber' : 'red' }}
        />

        <StatCard
          label="Tags Found"
          value={data.existingTags.length}
          sublabel="Unique classifications"
          icon={Tag}
          iconBgClass="bg-amber-100"
          iconColorClass="text-amber-600"
        />
      </div>

      {/* Active Plans Banner */}
      {activePlans.length > 0 && (
        <div className="explore-card p-4 bg-blue-50 border-blue-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                <ClipboardList size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-blue-900">
                  {activePlans.length} Enrichment Plan{activePlans.length !== 1 ? 's' : ''}
                </h3>
                <p className="text-sm text-blue-700">
                  {activePlans.reduce((acc, p) => acc + (p.progress?.reduce((sum, prog) => sum + prog.currentCount, 0) || 0), 0)} assets enriched so far
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => onSwitchTab && onSwitchTab('assets')}
                className="px-4 py-2 bg-white text-blue-600 text-sm font-medium rounded-md border border-blue-200 hover:bg-blue-50 transition-colors flex items-center gap-2"
              >
                View Assets
                <Layers size={16} />
              </button>
              <button 
                onClick={() => onSwitchTab && onSwitchTab('plans')}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm"
              >
                View Plans
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Metadata Coverage - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          {/* Coverage Section */}
          <div className="explore-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3
                className="text-base font-semibold"
                style={{ color: 'var(--explore-text-primary)' }}
              >
                Metadata Coverage
              </h3>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('requirements')}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                >
                  <BarChart3 size={12} />
                  View Full Matrix
                </button>
              )}
            </div>
            <div className="space-y-4">
              {metadataCoverage.map((item) => (
                <CoverageBar
                  key={item.field}
                  field={item.field}
                  label={item.label}
                  percentage={item.percentage}
                  count={item.count}
                  total={item.total}
                />
              ))}
              {metadataCoverage.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  No coverage data available
                </p>
              )}
            </div>
          </div>

          {/* Gaps Section */}
          {(gaps.missingOwners > 0 || gaps.missingDescriptions > 0 || gaps.missingTags > 0 || gaps.missingTerms > 0) && (
            <div className="explore-card p-5">
              <h3
                className="text-base font-semibold mb-4"
                style={{ color: 'var(--explore-text-primary)' }}
              >
                Gaps Identified
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {gaps.missingOwners > 0 && (
                  <div className="explore-gap-card critical">
                    <div className="flex items-center gap-2 mb-1">
                      <Users size={14} style={{ color: 'var(--error-color)' }} />
                      <span className="text-sm" style={{ color: 'var(--error-color)' }}>
                        Missing Owners
                      </span>
                    </div>
                    <p className="text-xl font-semibold" style={{ color: 'var(--error-color)' }}>
                      {gaps.missingOwners.toLocaleString()}
                    </p>
                  </div>
                )}
                {gaps.missingDescriptions > 0 && (
                  <div className="explore-gap-card critical">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText size={14} style={{ color: 'var(--error-color)' }} />
                      <span className="text-sm" style={{ color: 'var(--error-color)' }}>
                        No Description
                      </span>
                    </div>
                    <p className="text-xl font-semibold" style={{ color: 'var(--error-color)' }}>
                      {gaps.missingDescriptions.toLocaleString()}
                    </p>
                  </div>
                )}
                {gaps.missingTags > 0 && (
                  <div className="explore-gap-card warning">
                    <div className="flex items-center gap-2 mb-1">
                      <Tag size={14} style={{ color: 'var(--warning-color)' }} />
                      <span className="text-sm" style={{ color: 'var(--warning-color)' }}>
                        Untagged
                      </span>
                    </div>
                    <p className="text-xl font-semibold" style={{ color: 'var(--warning-color)' }}>
                      {gaps.missingTags.toLocaleString()}
                    </p>
                  </div>
                )}
                {gaps.missingTerms > 0 && (
                  <div className="explore-gap-card warning">
                    <div className="flex items-center gap-2 mb-1">
                      <BookOpen size={14} style={{ color: 'var(--warning-color)' }} />
                      <span className="text-sm" style={{ color: 'var(--warning-color)' }}>
                        No Terms
                      </span>
                    </div>
                    <p className="text-xl font-semibold" style={{ color: 'var(--warning-color)' }}>
                      {gaps.missingTerms.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Health Score Card - 1/3 width */}
        <div className="lg:col-span-1">
          <div className="explore-card p-5">
            <h3
              className="text-base font-semibold mb-4"
              style={{ color: 'var(--explore-text-primary)' }}
            >
              Health Grade
            </h3>
            <div className="text-center py-4">
              <div
                className="inline-flex items-center justify-center w-20 h-20 rounded-2xl text-4xl font-bold"
                style={{
                  background: healthGrade.bg,
                  color: healthGrade.color,
                }}
              >
                {healthGrade.grade}
              </div>
              <p
                className="mt-3 text-2xl font-bold"
                style={{ color: healthGrade.color }}
              >
                {healthScore}%
              </p>
              <p
                className="text-sm mt-1"
                style={{ color: 'var(--explore-text-secondary)' }}
              >
                Overall Completeness
              </p>
            </div>

            {/* Quick Actions */}
            <div className="border-t pt-4 mt-4" style={{ borderColor: 'var(--explore-border)' }}>
              <p
                className="text-xs font-medium uppercase tracking-wider mb-3"
                style={{ color: 'var(--explore-text-muted)' }}
              >
                Quick Actions
              </p>
              <div className="space-y-2">
                {metadataCoverage
                  .filter(c => c.percentage < 50)
                  .slice(0, 3)
                  .map(item => (
                    <button
                      key={item.field}
                      onClick={() => onSimulateField?.(item.field)}
                      className="w-full text-left p-2 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                      style={{ color: 'var(--explore-text-secondary)' }}
                    >
                      <span className="flex items-center justify-between">
                        <span>Improve {item.label}</span>
                        <TrendingUp size={14} className="text-green-500" />
                      </span>
                      <span className="text-xs text-gray-400">
                        Currently at {item.percentage}%
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OverviewTab;
