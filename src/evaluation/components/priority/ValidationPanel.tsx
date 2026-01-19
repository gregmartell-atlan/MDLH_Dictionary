import { AlertTriangle, AlertCircle, Info, CheckCircle, Clock, ChevronRight } from 'lucide-react';
import type {
  ValidationIssue,
  RecommendedFix,
} from '../../types/priority';
import { formatFieldName } from '../../types/priority';

interface ValidationPanelProps {
  issues: ValidationIssue[];
  fixes?: RecommendedFix[];
  onIssueClick?: (issue: ValidationIssue) => void;
}

export function ValidationPanel({
  issues,
  fixes,
  onIssueClick,
}: ValidationPanelProps) {
  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');
  const infos = issues.filter(i => i.severity === 'info');

  if (issues.length === 0) {
    return (
      <div className="card p-6 text-center">
        <div
          className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'var(--success-bg-color)' }}
        >
          <CheckCircle size={24} style={{ color: 'var(--success-color)' }} />
        </div>
        <h3 className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
          No Issues Found
        </h3>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Your metadata model passes all validation checks.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex gap-3">
        {errors.length > 0 && (
          <div
            className="flex-1 p-3 rounded-lg"
            style={{ backgroundColor: 'var(--error-bg-color)' }}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} style={{ color: 'var(--error-color)' }} />
              <span className="font-semibold" style={{ color: 'var(--error-color)' }}>
                {errors.length}
              </span>
              <span className="text-sm" style={{ color: 'var(--error-color)' }}>
                {errors.length === 1 ? 'Error' : 'Errors'}
              </span>
            </div>
          </div>
        )}
        {warnings.length > 0 && (
          <div
            className="flex-1 p-3 rounded-lg"
            style={{ backgroundColor: 'var(--warning-bg-color)' }}
          >
            <div className="flex items-center gap-2">
              <AlertCircle size={16} style={{ color: 'var(--warning-color)' }} />
              <span className="font-semibold" style={{ color: 'var(--warning-color)' }}>
                {warnings.length}
              </span>
              <span className="text-sm" style={{ color: 'var(--warning-color)' }}>
                {warnings.length === 1 ? 'Warning' : 'Warnings'}
              </span>
            </div>
          </div>
        )}
        {infos.length > 0 && (
          <div className="flex-1 p-3 rounded-lg bg-blue-50">
            <div className="flex items-center gap-2">
              <Info size={16} className="text-blue-600" />
              <span className="font-semibold text-blue-600">{infos.length}</span>
              <span className="text-sm text-blue-600">
                {infos.length === 1 ? 'Suggestion' : 'Suggestions'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Issues List */}
      <div className="space-y-3">
        {issues.map((issue) => (
          <ValidationIssueCard
            key={issue.id}
            issue={issue}
            fix={fixes?.find(f => f.issue.id === issue.id)}
            onClick={onIssueClick ? () => onIssueClick(issue) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

interface ValidationIssueCardProps {
  issue: ValidationIssue;
  fix?: RecommendedFix;
  onClick?: () => void;
}

export function ValidationIssueCard({ issue, fix, onClick }: ValidationIssueCardProps) {
  const getSeverityStyles = () => {
    switch (issue.severity) {
      case 'error':
        return {
          icon: AlertTriangle,
          bgColor: 'var(--error-bg-color)',
          color: 'var(--error-color)',
          borderColor: '#fecaca',
        };
      case 'warning':
        return {
          icon: AlertCircle,
          bgColor: 'var(--warning-bg-color)',
          color: 'var(--warning-color)',
          borderColor: '#fde68a',
        };
      case 'info':
        return {
          icon: Info,
          bgColor: '#eff6ff',
          color: '#2563eb',
          borderColor: '#bfdbfe',
        };
    }
  };

  const styles = getSeverityStyles();
  const Icon = styles.icon;

  return (
    <div
      className={`card p-4 border-l-4 ${onClick ? 'cursor-pointer hover:shadow-md' : ''} transition-all`}
      style={{ borderLeftColor: styles.color }}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div
          className="p-2 rounded-lg flex-shrink-0"
          style={{ backgroundColor: styles.bgColor }}
        >
          <Icon size={16} style={{ color: styles.color }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h4 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              {issue.title}
            </h4>
            {fix?.quickWin && (
              <span className="badge badge-green text-xs">Quick Win</span>
            )}
          </div>

          <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
            {issue.description}
          </p>

          {/* Affected Fields */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {issue.affectedFields.map((field) => (
              <span
                key={field}
                className="text-xs px-2 py-0.5 rounded-full bg-gray-100"
                style={{ color: 'var(--text-secondary)' }}
              >
                {formatFieldName(field)}
              </span>
            ))}
          </div>

          {/* Recommendation */}
          <div
            className="p-2.5 rounded-lg text-sm"
            style={{ backgroundColor: '#f9fafb' }}
          >
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
              Recommendation:{' '}
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>
              {issue.recommendation}
            </span>
          </div>

          {/* Fix metadata */}
          {fix && (
            <div className="flex items-center gap-4 mt-3 text-xs">
              <div className="flex items-center gap-1.5">
                <Clock size={12} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>
                  {fix.estimatedEffort}
                </span>
              </div>
              {fix.dependencies.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <AlertCircle size={12} style={{ color: 'var(--warning-color)' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {fix.dependencies.length} dependencies
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {onClick && (
          <ChevronRight
            size={16}
            className="flex-shrink-0"
            style={{ color: 'var(--text-muted)' }}
          />
        )}
      </div>
    </div>
  );
}

interface ValidationSummaryProps {
  errors: number;
  warnings: number;
  infos: number;
  riskScore: number;
}

export function ValidationSummary({
  errors,
  warnings,
  infos,
  riskScore,
}: ValidationSummaryProps) {
  const getRiskColor = () => {
    if (riskScore >= 80) return 'var(--success-color)';
    if (riskScore >= 50) return 'var(--warning-color)';
    return 'var(--error-color)';
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
          Validation Summary
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Risk Score:
          </span>
          <span
            className="text-lg font-bold"
            style={{ color: getRiskColor() }}
          >
            {riskScore}
          </span>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: 'var(--error-color)' }}
          />
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {errors} errors
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: 'var(--warning-color)' }}
          />
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {warnings} warnings
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {infos} suggestions
          </span>
        </div>
      </div>
    </div>
  );
}
