/**
 * SidebarStyles - Shared styling components for left/right sidebars
 *
 * Pulled from MDLH Dictionary for consistent UX across:
 * - CategorySidebar (left nav)
 * - EntityPanel (right panel)
 *
 * Shared components:
 * - RailButton: Icon button for collapsed rail
 * - PinButton: Pin/unpin toggle
 * - ResizeHandle: Draggable resize bar
 * - SidebarHeader: Consistent header styling
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Pin, PinOff, GripVertical, X } from 'lucide-react';

// =============================================================================
// RailButton - Icon button for collapsed rail mode
// =============================================================================

interface RailButtonProps {
  icon: LucideIcon;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
  badge?: number;
  position?: 'left' | 'right';
}

export function RailButton({
  icon: Icon,
  label,
  isActive,
  onClick,
  badge,
  position = 'left',
}: RailButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        relative w-full p-3 flex justify-center transition-colors
        ${isActive
          ? 'text-blue-600 bg-blue-50'
          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
        }
      `}
      title={label}
    >
      <Icon size={20} />
      {badge != null && badge > 0 && (
        <span className={`
          absolute top-1 w-4 h-4 text-[9px] font-medium
          bg-blue-500 text-white rounded-full
          flex items-center justify-center
          ${position === 'left' ? 'right-1' : 'left-1'}
        `}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

// =============================================================================
// PinButton - Consistent pin/unpin toggle
// =============================================================================

interface PinButtonProps {
  isPinned: boolean;
  onToggle: () => void;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function PinButton({
  isPinned,
  onToggle,
  size = 'md',
  showLabel = false,
  className = '',
}: PinButtonProps) {
  const sizeClasses = {
    sm: 'p-1',
    md: 'p-1.5',
    lg: 'p-2',
  };

  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 18,
  };

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`
        rounded transition-colors flex items-center gap-1.5
        ${sizeClasses[size]}
        ${isPinned
          ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
          : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'
        }
        ${className}
      `}
      title={isPinned ? 'Unpin (collapse on mouse leave)' : 'Pin open'}
    >
      {isPinned ? <PinOff size={iconSizes[size]} /> : <Pin size={iconSizes[size]} />}
      {showLabel && (
        <span className="text-xs font-medium">
          {isPinned ? 'Unpin' : 'Pin'}
        </span>
      )}
    </button>
  );
}

// =============================================================================
// ResizeHandle - Draggable resize bar
// =============================================================================

interface ResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
  isResizing?: boolean;
  position?: 'left' | 'right';
}

export function ResizeHandle({
  onMouseDown,
  isResizing,
  position = 'right',
}: ResizeHandleProps) {
  const gripPosition = position === 'right'
    ? 'right-0 translate-x-1/2'
    : 'left-0 -translate-x-1/2';

  return (
    <div
      onMouseDown={onMouseDown}
      className={`
        absolute ${position}-0 top-0 bottom-0 w-1
        cursor-col-resize group z-10
        ${isResizing ? 'bg-blue-500' : 'hover:bg-blue-400'}
      `}
      title="Drag to resize"
    >
      <div className={`
        absolute ${gripPosition} top-1/2 -translate-y-1/2
        p-1 rounded bg-slate-100 border border-slate-200
        opacity-0 group-hover:opacity-100 transition-opacity
        ${isResizing ? 'opacity-100' : ''}
      `}>
        <GripVertical size={12} className="text-slate-400" />
      </div>
    </div>
  );
}

// =============================================================================
// SidebarHeader - Consistent header styling
// =============================================================================

interface SidebarHeaderProps {
  title: string;
  subtitle?: string;
  isPinned?: boolean;
  onTogglePin?: () => void;
  onClose?: () => void;
  children?: React.ReactNode;
  className?: string;
}

export function SidebarHeader({
  title,
  subtitle,
  isPinned,
  onTogglePin,
  onClose,
  children,
  className = '',
}: SidebarHeaderProps) {
  return (
    <div className={`
      px-3 py-2.5 border-b border-slate-200
      flex items-center justify-between
      bg-slate-50/50
      ${className}
    `}>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-slate-800 truncate">
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-slate-500 truncate">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
        {children}
        {onTogglePin && (
          <PinButton isPinned={isPinned || false} onToggle={onTogglePin} size="sm" />
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
            title="Close"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// SidebarFooter - Consistent footer styling
// =============================================================================

interface SidebarFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function SidebarFooter({ children, className = '' }: SidebarFooterProps) {
  return (
    <div className={`
      px-3 py-2 border-t border-slate-200
      bg-slate-50/50 flex-shrink-0
      ${className}
    `}>
      {children}
    </div>
  );
}

// =============================================================================
// CollapsedRailContainer - Wrapper for rail mode
// =============================================================================

interface CollapsedRailContainerProps {
  children: React.ReactNode;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  position?: 'left' | 'right';
  className?: string;
}

export const CollapsedRailContainer = React.forwardRef<HTMLDivElement, CollapsedRailContainerProps>(
  function CollapsedRailContainer(
    {
      children,
      onMouseEnter,
      onMouseLeave,
      position = 'left',
      className = '',
    },
    ref
  ) {
    const borderClass = position === 'left' ? 'border-r' : 'border-l';

    return (
      <div
        ref={ref}
        className={`
          w-14 ${borderClass} border-slate-200
          bg-white flex flex-col flex-shrink-0
          transition-all duration-200
          ${className}
        `}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {children}
      </div>
    );
  }
);

// =============================================================================
// ExpandedContainer - Wrapper for expanded mode
// =============================================================================

interface ExpandedContainerProps {
  children: React.ReactNode;
  width: number;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  isResizing?: boolean;
  position?: 'left' | 'right';
  className?: string;
}

export const ExpandedContainer = React.forwardRef<HTMLDivElement, ExpandedContainerProps>(
  function ExpandedContainer(
    {
      children,
      width,
      onMouseEnter,
      onMouseLeave,
      isResizing,
      position = 'left',
      className = '',
    },
    ref
  ) {
    const borderClass = position === 'left' ? 'border-r' : 'border-l';

    return (
      <div
        ref={ref}
        className={`
          ${borderClass} border-slate-200
          bg-white flex flex-col flex-shrink-0
          relative shadow-sm
          ${className}
        `}
        style={{
          width,
          transition: isResizing ? 'none' : 'width 0.2s ease',
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {children}
      </div>
    );
  }
);
