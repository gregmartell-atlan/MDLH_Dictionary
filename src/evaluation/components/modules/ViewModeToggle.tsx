/**
 * ViewModeToggle - Shared component for switching between Existing/Design views
 *
 * - Existing: Shows current state from canvas entities
 * - Design: Allows editing/designing new structures
 */

import { Eye, Pencil } from 'lucide-react';

export type ModuleViewMode = 'existing' | 'design';

interface ViewModeToggleProps {
  mode: ModuleViewMode;
  onModeChange: (mode: ModuleViewMode) => void;
  existingCount?: number;
  existingLabel?: string;
  designLabel?: string;
}

export function ViewModeToggle({
  mode,
  onModeChange,
  existingCount,
  existingLabel = 'Existing',
  designLabel = 'Design',
}: ViewModeToggleProps) {
  return (
    <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
      <button
        onClick={() => onModeChange('existing')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
          mode === 'existing'
            ? 'bg-white shadow text-blue-600'
            : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        <Eye size={14} />
        {existingLabel}
        {existingCount !== undefined && existingCount > 0 && (
          <span className={`px-1.5 py-0.5 text-xs rounded-full ${
            mode === 'existing' ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-600'
          }`}>
            {existingCount}
          </span>
        )}
      </button>
      <button
        onClick={() => onModeChange('design')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
          mode === 'design'
            ? 'bg-white shadow text-blue-600'
            : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        <Pencil size={14} />
        {designLabel}
      </button>
    </div>
  );
}

export default ViewModeToggle;
