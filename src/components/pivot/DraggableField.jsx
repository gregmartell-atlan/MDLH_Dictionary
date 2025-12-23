/**
 * DraggableField - Draggable field chip component
 *
 * Represents a field that can be dragged from the field list
 * or between drop zones (rows, columns, values, filters).
 */

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';

export function DraggableField({
  field,
  zone,
  index,
  onRemove,
  showAggregation = false,
  isDragging = false,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: `${zone}-${field.fieldName}`,
    data: {
      field,
      zone,
      index,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging || isDragging ? 0.5 : 1,
  };

  // Render icon component
  const IconComponent = field.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg
        hover:border-blue-400 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing
        ${isSortableDragging || isDragging ? 'shadow-lg ring-2 ring-blue-400' : ''}
      `}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600"
      >
        <GripVertical size={16} />
      </div>

      {/* Field icon */}
      {IconComponent && (
        <div className="text-slate-500">
          <IconComponent size={14} />
        </div>
      )}

      {/* Field name */}
      <span className="text-sm font-medium text-slate-700 flex-1">
        {field.fieldName}
      </span>

      {/* Aggregation badge (for values zone) */}
      {showAggregation && field.aggregation && (
        <span className="px-2 py-0.5 text-xs font-semibold text-blue-700 bg-blue-100 rounded">
          {field.aggregation}
        </span>
      )}

      {/* Data type badge */}
      <span className="px-2 py-0.5 text-xs text-slate-500 bg-slate-100 rounded">
        {field.dataType}
      </span>

      {/* Remove button */}
      {onRemove && (
        <button
          onClick={() => onRemove(field.fieldName)}
          className="text-slate-400 hover:text-red-600 transition-colors"
          title="Remove field"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/**
 * StaticField - Non-draggable field chip (for field list)
 */
export function StaticField({ field, onAdd }) {
  const IconComponent = field.icon;

  return (
    <div
      onClick={() => onAdd && onAdd(field)}
      className={`
        flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg
        hover:border-blue-400 hover:shadow-sm transition-all
        ${onAdd ? 'cursor-pointer' : ''}
      `}
    >
      {/* Field icon */}
      {IconComponent && (
        <div className="text-slate-500">
          <IconComponent size={14} />
        </div>
      )}

      {/* Field name */}
      <span className="text-sm font-medium text-slate-700 flex-1">
        {field.fieldName}
      </span>

      {/* Field type badge */}
      <span
        className={`
          px-2 py-0.5 text-xs font-semibold rounded
          ${field.fieldType === 'measure'
            ? 'text-green-700 bg-green-100'
            : 'text-purple-700 bg-purple-100'
          }
        `}
        title={field.fieldType === 'measure' ? 'Numeric (aggregatable)' : 'Categorical (groupable)'}
      >
        {field.fieldType === 'measure' ? '123' : 'ABC'}
      </span>

      {/* Data type */}
      <span className="px-2 py-0.5 text-xs text-slate-500 bg-slate-100 rounded">
        {field.dataType}
      </span>
    </div>
  );
}

export default DraggableField;
