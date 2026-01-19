// ============================================
// STAT CARD
// Reusable stat card component for Explore dashboard
// ============================================

import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: LucideIcon;
  iconBgClass?: string;
  iconColorClass?: string;
  trend?: {
    direction: 'up' | 'down' | 'stable';
    value: string;
  };
  progress?: {
    value: number; // 0-100
    color?: 'green' | 'blue' | 'amber' | 'red';
  };
  valueColor?: string;
}

export function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  iconBgClass = 'bg-blue-100',
  iconColorClass = 'text-blue-600',
  trend,
  progress,
  valueColor,
}: StatCardProps) {
  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend.direction === 'up') return '↑';
    if (trend.direction === 'down') return '↓';
    return '→';
  };

  const getTrendColor = () => {
    if (!trend) return '';
    if (trend.direction === 'up') return 'text-green-600';
    if (trend.direction === 'down') return 'text-red-600';
    return 'text-gray-500';
  };

  const getProgressColor = () => {
    if (!progress) return '';
    switch (progress.color) {
      case 'green':
        return 'var(--success-color)';
      case 'amber':
        return 'var(--warning-color)';
      case 'red':
        return 'var(--error-color)';
      default:
        return 'var(--primary-blue)';
    }
  };

  return (
    <div className="explore-stat-card">
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-sm font-medium"
          style={{ color: 'var(--explore-text-secondary)' }}
        >
          {label}
        </span>
        <div
          className={`explore-stat-icon ${iconBgClass}`}
        >
          <Icon size={16} className={iconColorClass} />
        </div>
      </div>
      <div
        className="text-3xl font-bold"
        style={{ color: valueColor || 'var(--explore-text-primary)' }}
      >
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      {sublabel && (
        <p
          className="text-xs mt-1"
          style={{ color: 'var(--explore-text-muted)' }}
        >
          {sublabel}
        </p>
      )}
      {trend && (
        <div className={`flex items-center gap-1 mt-1 text-xs ${getTrendColor()}`}>
          <span>{getTrendIcon()}</span>
          <span>{trend.value}</span>
        </div>
      )}
      {progress && (
        <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
          <div
            className="h-1.5 rounded-full transition-all"
            style={{
              width: `${Math.min(100, Math.max(0, progress.value))}%`,
              backgroundColor: getProgressColor(),
            }}
          />
        </div>
      )}
    </div>
  );
}

// Compact stat for inline display
export function StatBadge({
  label,
  value,
  color = 'gray',
}: {
  label: string;
  value: string | number;
  color?: 'gray' | 'blue' | 'green' | 'amber' | 'red';
}) {
  const colorClasses = {
    gray: 'bg-gray-100 text-gray-700',
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${colorClasses[color]}`}>
      <span className="text-xs font-medium opacity-70">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

export default StatCard;
