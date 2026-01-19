// ============================================
// RECOMMENDATIONS PANEL
// Display actionable recommendations based on audit results
// ============================================

import { useState } from 'react';
import {
  Lightbulb,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Users,
  FileText,
  Tag,
  GitBranch,
  Shield,
  DollarSign,
  Zap,
  CheckCircle,
} from 'lucide-react';
import type { AuditResult, FieldCoverage } from '../../types/priority';
import {
  getTopRecommendations,
  getQuickWinRecommendations,
  calculateHealthScore,
  type RecommendationMatch,
  type RecommendationCategory,
  type RecommendationPriority,
} from '../../data/recommendations';

interface RecommendationsPanelProps {
  audit: AuditResult | null;
  fieldCoverage: FieldCoverage[];
  maxItems?: number;
}

// Priority color and icon mapping
const priorityConfig: Record<
  RecommendationPriority,
  { color: string; bgColor: string; Icon: typeof AlertTriangle }
> = {
  critical: {
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    Icon: AlertTriangle,
  },
  high: {
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    Icon: AlertCircle,
  },
  medium: {
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    Icon: Info,
  },
  low: {
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    Icon: Info,
  },
};

// Category icon mapping
const categoryIcons: Record<RecommendationCategory, typeof Users> = {
  ownership: Users,
  documentation: FileText,
  governance: Shield,
  classification: Tag,
  lineage: GitBranch,
  quality: CheckCircle,
  cost: DollarSign,
};

function RecommendationCard({ match }: { match: RecommendationMatch }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { recommendation, currentCoverage, assetsAffected, potentialImpact } = match;
  const config = priorityConfig[recommendation.priority];
  const CategoryIcon = categoryIcons[recommendation.category];

  return (
    <div
      className={`rounded-lg border transition-all ${
        isExpanded ? 'border-gray-200' : 'border-gray-100'
      }`}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-start gap-3 text-left hover:bg-gray-50 transition-colors rounded-t-lg"
      >
        <div className={`p-2 rounded-lg ${config.bgColor}`}>
          <config.Icon size={16} className={config.color} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded ${config.bgColor} ${config.color}`}
            >
              {recommendation.priority}
            </span>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <CategoryIcon size={12} />
              {recommendation.category}
            </span>
          </div>

          <h4 className="font-medium text-sm text-gray-900 mb-1">
            {recommendation.title}
          </h4>

          <p className="text-xs text-gray-500 line-clamp-2">
            {recommendation.description}
          </p>

          {/* Stats */}
          {assetsAffected > 0 && (
            <div className="flex items-center gap-4 mt-2">
              <span className="text-xs text-gray-400">
                <span className="font-medium text-gray-600">
                  {assetsAffected.toLocaleString()}
                </span>{' '}
                assets affected
              </span>
              <span className="text-xs text-gray-400">
                Current:{' '}
                <span className="font-medium text-gray-600">{currentCoverage}%</span>
              </span>
              {potentialImpact > 0 && (
                <span className="text-xs text-green-600">
                  +{potentialImpact}% potential gain
                </span>
              )}
            </div>
          )}
        </div>

        {isExpanded ? (
          <ChevronDown size={16} className="text-gray-400 mt-1" />
        ) : (
          <ChevronRight size={16} className="text-gray-400 mt-1" />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          {/* Impact & Effort */}
          <div className="flex gap-4 py-3 border-b border-gray-50">
            <div className="flex-1">
              <span className="text-xs font-medium text-gray-400">Impact</span>
              <p className="text-sm text-gray-600 mt-0.5">
                {recommendation.impact}
              </p>
            </div>
            <div className="w-24">
              <span className="text-xs font-medium text-gray-400">Effort</span>
              <p className="text-sm text-gray-600 mt-0.5 capitalize">
                {recommendation.effort}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3">
            <span className="text-xs font-medium text-gray-400 mb-2 block">
              Recommended Actions
            </span>
            <div className="space-y-2">
              {recommendation.actions.map((action, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="w-5 h-5 rounded bg-white flex items-center justify-center text-gray-400 text-xs font-medium">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">
                        {action.label}
                      </span>
                      {action.atlanPath && (
                        <ExternalLink size={12} className="text-gray-400" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {action.description}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded ${
                      action.type === 'atlan_ui'
                        ? 'bg-blue-50 text-blue-600'
                        : action.type === 'bulk_update'
                        ? 'bg-purple-50 text-purple-600'
                        : action.type === 'workflow'
                        ? 'bg-green-50 text-green-600'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {action.type === 'atlan_ui'
                      ? 'Atlan UI'
                      : action.type === 'bulk_update'
                      ? 'Bulk'
                      : action.type === 'workflow'
                      ? 'Workflow'
                      : action.type === 'report'
                      ? 'Report'
                      : 'API'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HealthScoreCard({ audit }: { audit: AuditResult | null }) {
  const health = calculateHealthScore(audit);

  const gradeColors: Record<string, { bg: string; text: string; border: string }> = {
    A: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200' },
    B: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
    C: { bg: 'bg-yellow-50', text: 'text-yellow-600', border: 'border-yellow-200' },
    D: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' },
    F: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
  };

  const colors = gradeColors[health.grade];

  return (
    <div className={`rounded-lg p-4 border ${colors.bg} ${colors.border}`}>
      <div className="flex items-center gap-4">
        <div
          className={`w-16 h-16 rounded-xl flex items-center justify-center ${colors.text} font-bold text-3xl`}
          style={{ backgroundColor: 'white' }}
        >
          {health.grade}
        </div>
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${colors.text}`}>
              {health.score}%
            </span>
            <span className="text-sm text-gray-500">completeness</span>
          </div>
          <p className="text-sm text-gray-600 mt-1">{health.summary}</p>
        </div>
      </div>
    </div>
  );
}

export function RecommendationsPanel({
  audit,
  fieldCoverage,
  maxItems = 5,
}: RecommendationsPanelProps) {
  const [showQuickWins, setShowQuickWins] = useState(true);

  const allRecommendations = getTopRecommendations(audit, fieldCoverage, maxItems);
  const quickWins = getQuickWinRecommendations(audit, fieldCoverage);

  const displayedRecommendations = showQuickWins
    ? quickWins.slice(0, maxItems)
    : allRecommendations;

  if (!audit) {
    return (
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
            <Lightbulb size={20} className="text-amber-500" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Recommendations</h3>
            <p className="text-sm text-gray-500">
              Connect to Atlan to get personalized recommendations
            </p>
          </div>
        </div>
        <div className="text-center py-8 text-gray-400">
          <Info size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">No audit data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Lightbulb size={20} className="text-amber-500" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Recommendations</h3>
              <p className="text-sm text-gray-500">
                Based on your metadata coverage
              </p>
            </div>
          </div>

          {/* Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQuickWins(true)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                showQuickWins
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Zap size={12} />
              Quick Wins
            </button>
            <button
              onClick={() => setShowQuickWins(false)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                !showQuickWins
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All
            </button>
          </div>
        </div>
      </div>

      {/* Health Score */}
      <div className="p-4 border-b border-gray-100">
        <HealthScoreCard audit={audit} />
      </div>

      {/* Recommendations List */}
      <div className="p-4 space-y-3">
        {displayedRecommendations.length > 0 ? (
          displayedRecommendations.map((match) => (
            <RecommendationCard key={match.recommendation.id} match={match} />
          ))
        ) : (
          <div className="text-center py-8">
            <CheckCircle size={32} className="mx-auto mb-2 text-green-500" />
            <p className="text-sm text-gray-600 font-medium">Looking good!</p>
            <p className="text-xs text-gray-400 mt-1">
              {showQuickWins
                ? 'No quick wins needed - your metadata is well-covered'
                : 'All critical recommendations addressed'}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      {displayedRecommendations.length > 0 && (
        <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
          <p className="text-xs text-gray-500 text-center">
            Showing {displayedRecommendations.length} of{' '}
            {allRecommendations.length} recommendations
          </p>
        </div>
      )}
    </div>
  );
}

export default RecommendationsPanel;
