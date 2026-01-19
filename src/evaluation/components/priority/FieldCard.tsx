import { TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';
import type {
  Priority,
  FieldCoverage,
  MetadataFieldType,
} from '../../types/priority';
import {
  COMPLETENESS_WEIGHTS,
  formatFieldName,
} from '../../types/priority';
import { PriorityBadge } from './PriorityBadge';

interface FieldCardProps {
  field: MetadataFieldType;
  coverage: FieldCoverage;
  priority: Priority;
  onSimulate?: () => void;
  compact?: boolean;
}

export function FieldCard({
  field,
  coverage,
  priority,
  onSimulate,
  compact = false,
}: FieldCardProps) {
  const weight = COMPLETENESS_WEIGHTS[field];

  const getProgressColor = () => {
    if (priority.level === 'P0') return '#DC2626';
    if (priority.level === 'P1') return '#EA580C';
    if (priority.level === 'P2') return '#CA8A04';
    return '#6B7280';
  };

  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
        <div className="flex items-center gap-3">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: getProgressColor() }}
          />
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {formatFieldName(field)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {(coverage.coveragePercent * 100).toFixed(0)}%
          </span>
          <PriorityBadge priority={priority} size="sm" />
        </div>
      </div>
    );
  }

  return (
    <div className="card p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
          {formatFieldName(field)}
        </h3>
        <PriorityBadge priority={priority} showScore />
      </div>

      <div className="space-y-3">
        {/* Coverage Progress */}
        <div>
          <div className="flex justify-between text-sm mb-1.5">
            <span style={{ color: 'var(--text-secondary)' }}>Coverage</span>
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
              {(coverage.coveragePercent * 100).toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{
                width: `${coverage.coveragePercent * 100}%`,
                backgroundColor: getProgressColor(),
              }}
            />
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex justify-between text-sm">
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>Weight: </span>
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
              {weight} pts
            </span>
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>Assets: </span>
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
              {coverage.totalAssets.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Trend */}
        {coverage.trend && (
          <div className="flex items-center gap-2 text-sm">
            {coverage.trend.direction === 'up' && (
              <>
                <TrendingUp size={14} className="text-green-600" />
                <span className="text-green-600">
                  +{Math.abs(coverage.trend.changePercent).toFixed(1)}%
                </span>
              </>
            )}
            {coverage.trend.direction === 'down' && (
              <>
                <TrendingDown size={14} className="text-red-600" />
                <span className="text-red-600">
                  -{Math.abs(coverage.trend.changePercent).toFixed(1)}%
                </span>
              </>
            )}
            {coverage.trend.direction === 'stable' && (
              <>
                <Minus size={14} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Stable</span>
              </>
            )}
            <span style={{ color: 'var(--text-muted)' }}>
              ({coverage.trend.periodDays}d)
            </span>
          </div>
        )}

        {/* Reasoning */}
        {priority.reasoning.length > 0 && (
          <div className="pt-3 border-t border-gray-100">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {priority.reasoning[0]}
            </p>
          </div>
        )}

        {/* Simulate Button */}
        {onSimulate && (
          <button
            onClick={onSimulate}
            className="w-full mt-2 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            style={{
              color: 'var(--primary-blue)',
              backgroundColor: 'var(--primary-blue-light)',
            }}
          >
            <Zap size={14} />
            Simulate impact
          </button>
        )}
      </div>
    </div>
  );
}

interface FieldCardGridProps {
  fields: {
    field: MetadataFieldType;
    coverage: FieldCoverage;
    priority: Priority;
  }[];
  onSimulate?: (field: MetadataFieldType) => void;
}

export function FieldCardGrid({ fields, onSimulate }: FieldCardGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {fields.map(({ field, coverage, priority }) => (
        <FieldCard
          key={field}
          field={field}
          coverage={coverage}
          priority={priority}
          onSimulate={onSimulate ? () => onSimulate(field) : undefined}
        />
      ))}
    </div>
  );
}
