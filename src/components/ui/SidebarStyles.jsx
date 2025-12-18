/**
 * SidebarStyles - Shared styling components for left/right sidebars
 *
 * Ensures consistent UX across:
 * - EntityBrowser (left nav)
 * - EntityPanel (right panel)
 *
 * Shared components:
 * - RailButton: Icon button for collapsed rail
 * - PinButton: Pin/unpin toggle
 * - ResizeHandle: Draggable resize bar
 * - SidebarHeader: Consistent header styling
 */

import React from 'react';
import { Pin, PinOff, GripVertical, X } from 'lucide-react';

// =============================================================================
// Shared Style Constants
// =============================================================================

export const SIDEBAR_STYLES = {
  // Widths
  railWidth: 'w-14',
  railWidthPx: 56,
  minExpandedWidth: 200,
  maxExpandedWidth: 600,

  // Colors
  borderColor: 'border-slate-200',
  bgColor: 'bg-white',
  hoverBg: 'hover:bg-slate-50',
  activeBg: 'bg-blue-50',
  activeText: 'text-blue-600',
  mutedText: 'text-slate-500',

  // Transitions - fast and snappy
  transition: 'transition-all duration-150 ease-out',
  transitionFast: 'transition-all duration-100 ease-out',
};

// =============================================================================
// RailButton - Icon button for collapsed rail mode
// =============================================================================

export function RailButton({
  icon: Icon,
  label,
  isActive,
  onClick,
  badge,
  position = 'left', // 'left' or 'right'
}) {
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

export function PinButton({
  isPinned,
  onToggle,
  size = 'md', // 'sm', 'md', 'lg'
  showLabel = false,
  className = '',
}) {
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

export function ResizeHandle({
  onMouseDown,
  isResizing,
  position = 'right', // 'left' or 'right' edge
}) {
  const positionClasses = position === 'right'
    ? 'right-0 translate-x-1/2'
    : 'left-0 -translate-x-1/2';

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

export function SidebarHeader({
  title,
  subtitle,
  isPinned,
  onTogglePin,
  onClose,
  children,
  className = '',
}) {
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
          <PinButton isPinned={isPinned} onToggle={onTogglePin} size="sm" />
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

export function SidebarFooter({ children, className = '' }) {
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

export const CollapsedRailContainer = React.forwardRef(function CollapsedRailContainer({
  children,
  onMouseEnter,
  onMouseLeave,
  position = 'left', // 'left' or 'right'
  className = '',
}, ref) {
  const borderClass = position === 'left' ? 'border-r' : 'border-l';

  return (
    <div
      ref={ref}
      className={`
        w-14 ${borderClass} border-slate-200
        bg-white flex flex-col flex-shrink-0
        transition-all duration-150 ease-out
        ${className}
      `}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  );
});

// =============================================================================
// ExpandedContainer - Wrapper for expanded mode
// =============================================================================

export const ExpandedContainer = React.forwardRef(function ExpandedContainer({
  children,
  width,
  onMouseEnter,
  onMouseLeave,
  isResizing,
  position = 'left',
  className = '',
}, ref) {
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
        transition: isResizing ? 'none' : 'width 0.15s ease-out',
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  );
});

export default {
  SIDEBAR_STYLES,
  RailButton,
  PinButton,
  ResizeHandle,
  SidebarHeader,
  SidebarFooter,
  CollapsedRailContainer,
  ExpandedContainer,
};
