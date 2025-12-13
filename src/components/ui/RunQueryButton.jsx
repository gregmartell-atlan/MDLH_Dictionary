/**
 * RunQueryButton - Reusable pill-style run button
 *
 * Clean, minimal design:
 * - Rounded pill shape
 * - Play icon + text
 * - Optional dropdown chevron
 * - Loading state with spinner
 */

import React from 'react';
import { Play, Loader2, ChevronDown } from 'lucide-react';

export function RunQueryButton({
  onClick,
  loading = false,
  disabled = false,
  showDropdown = false,
  size = 'md',
  variant = 'default',
  className = '',
}) {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-sm gap-2',
  };

  const variantClasses = {
    default: `
      text-slate-700 bg-white border border-slate-200
      hover:border-slate-300 hover:bg-slate-50
      disabled:opacity-50 disabled:cursor-not-allowed
    `,
    primary: `
      text-white bg-slate-900 border border-slate-900
      hover:bg-slate-800
      disabled:opacity-50 disabled:cursor-not-allowed
    `,
    ghost: `
      text-slate-600 bg-transparent border border-transparent
      hover:bg-slate-100
      disabled:opacity-50 disabled:cursor-not-allowed
    `,
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center
        font-medium rounded-full
        transition-colors
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${className}
      `}
    >
      {loading ? (
        <Loader2 size={size === 'sm' ? 12 : 14} className="animate-spin" />
      ) : (
        <Play size={size === 'sm' ? 12 : 14} />
      )}
      <span>{loading ? 'Running...' : 'Run query'}</span>
      {showDropdown && !loading && (
        <ChevronDown size={size === 'sm' ? 12 : 14} className="text-slate-400 -mr-1" />
      )}
    </button>
  );
}

export default RunQueryButton;
