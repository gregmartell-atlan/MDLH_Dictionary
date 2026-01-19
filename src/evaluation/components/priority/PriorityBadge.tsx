import type { Priority } from '../../types/priority';
import { PRIORITY_BADGE_CONFIG } from '../../types/priority';

interface PriorityBadgeProps {
  priority: Priority;
  showScore?: boolean;
  showReasoning?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function PriorityBadge({
  priority,
  showScore = false,
  showReasoning = false,
  size = 'md',
}: PriorityBadgeProps) {
  const config = PRIORITY_BADGE_CONFIG.find(c => c.level === priority.level);

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  };

  return (
    <div className="inline-flex items-center gap-2">
      <span
        className={`rounded-full font-medium ${sizeClasses[size]} transition-colors`}
        style={{
          backgroundColor: `${config?.color}15`,
          color: config?.color,
        }}
      >
        {priority.level}
        {showScore && ` (${priority.score})`}
      </span>

      {showReasoning && priority.reasoning.length > 0 && (
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {priority.reasoning[0]}
        </span>
      )}
    </div>
  );
}

interface PriorityIndicatorProps {
  level: Priority['level'];
  size?: number;
}

export function PriorityIndicator({ level, size = 8 }: PriorityIndicatorProps) {
  const config = PRIORITY_BADGE_CONFIG.find(c => c.level === level);

  return (
    <span
      className="inline-block rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: config?.color,
      }}
      title={`${level}: ${config?.label}`}
    />
  );
}

interface PriorityLabelProps {
  level: Priority['level'];
}

export function PriorityLabel({ level }: PriorityLabelProps) {
  const config = PRIORITY_BADGE_CONFIG.find(c => c.level === level);

  return (
    <div className="flex items-center gap-2">
      <PriorityIndicator level={level} />
      <span className="text-sm font-medium" style={{ color: config?.color }}>
        {config?.label}
      </span>
    </div>
  );
}
