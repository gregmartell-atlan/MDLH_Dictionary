// ============================================
// COVERAGE BAR
// Reusable coverage progress bar component
// ============================================

import type { LucideIcon } from 'lucide-react';
import {
  Users,
  FileText,
  Tag,
  BookOpen,
  Award,
  GitBranch,
  Shield,
  Settings,
  Star,
  Link,
} from 'lucide-react';

// Field to icon mapping
const FIELD_ICONS: Record<string, LucideIcon> = {
  ownerUsers: Users,
  ownerGroups: Users,
  description: FileText,
  userDescription: FileText,
  readme: FileText,
  atlanTags: Tag,
  glossaryTerms: BookOpen,
  meanings: BookOpen,
  certificateStatus: Award,
  lineage: GitBranch,
  accessPolicies: Shield,
  customMetadata: Settings,
  starredBy: Star,
  links: Link,
};

interface CoverageBarProps {
  field: string;
  label: string;
  percentage: number;
  count?: number;
  total?: number;
  showIcon?: boolean;
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function CoverageBar({
  field,
  label,
  percentage,
  count,
  total,
  showIcon = true,
  showDetails = true,
  size = 'md',
}: CoverageBarProps) {
  const Icon = FIELD_ICONS[field] || FileText;

  const getCoverageLevel = (pct: number): 'high' | 'medium' | 'low' => {
    if (pct >= 80) return 'high';
    if (pct >= 50) return 'medium';
    return 'low';
  };

  const getCoverageTextColor = (pct: number) => {
    if (pct >= 80) return 'var(--success-color)';
    if (pct >= 50) return 'var(--warning-color)';
    return 'var(--error-color)';
  };

  const level = getCoverageLevel(percentage);
  const barHeight = size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2';

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {showIcon && (
            <Icon
              size={size === 'sm' ? 12 : size === 'lg' ? 18 : 14}
              style={{ color: 'var(--explore-text-muted)' }}
            />
          )}
          <span
            className={`font-medium ${size === 'sm' ? 'text-xs' : 'text-sm'}`}
            style={{ color: 'var(--explore-text-secondary)' }}
          >
            {label}
          </span>
        </div>
        {showDetails && (
          <div className="flex items-center gap-2">
            <span
              className={`font-medium ${size === 'sm' ? 'text-xs' : 'text-sm'}`}
              style={{ color: getCoverageTextColor(percentage) }}
            >
              {percentage}%
            </span>
            {count !== undefined && total !== undefined && (
              <span
                className="text-xs"
                style={{ color: 'var(--explore-text-muted)' }}
              >
                ({count.toLocaleString()} / {total.toLocaleString()})
              </span>
            )}
          </div>
        )}
      </div>
      <div className={`coverage-bar ${barHeight}`}>
        <div
          className={`coverage-bar-fill ${level}`}
          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
        />
      </div>
    </div>
  );
}

// Coverage item for list display
export function CoverageItem({
  field,
  label,
  percentage,
  count,
  total,
  onClick,
}: CoverageBarProps & { onClick?: () => void }) {
  const Icon = FIELD_ICONS[field] || FileText;

  const getCoverageColor = (pct: number) => {
    if (pct >= 80) return 'bg-emerald-500';
    if (pct >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors ${
        onClick ? 'cursor-pointer' : ''
      }`}
      onClick={onClick}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ background: 'var(--color-slate-100)' }}
      >
        <Icon size={16} style={{ color: 'var(--color-slate-500)' }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium truncate" style={{ color: 'var(--explore-text-primary)' }}>
            {label}
          </span>
          <span
            className="text-sm font-semibold ml-2"
            style={{
              color:
                percentage >= 80
                  ? 'var(--success-color)'
                  : percentage >= 50
                  ? 'var(--warning-color)'
                  : 'var(--error-color)',
            }}
          >
            {percentage}%
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${getCoverageColor(percentage)} transition-all duration-500`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          {count !== undefined && total !== undefined && (
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {count.toLocaleString()} / {total.toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Coverage grid for dashboard
export function CoverageGrid({
  items,
  columns = 2,
}: {
  items: Array<{
    field: string;
    label: string;
    percentage: number;
    count?: number;
    total?: number;
  }>;
  columns?: 1 | 2 | 3;
}) {
  const gridClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  }[columns];

  return (
    <div className={`grid ${gridClass} gap-3`}>
      {items.map((item) => (
        <CoverageBar
          key={item.field}
          {...item}
        />
      ))}
    </div>
  );
}

export default CoverageBar;
