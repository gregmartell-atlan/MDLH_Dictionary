/**
 * DropZone - Drag-and-drop zone for pivot configuration
 *
 * Accepts fields from the field list or other zones.
 * Displays fields as draggable chips that can be reordered.
 */

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { DraggableField } from './DraggableField';

export function DropZone({
  zone,
  label,
  description,
  fields,
  onRemove,
  emptyMessage = 'Drag fields here',
  showAggregation = false,
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: zone,
    data: { zone },
  });

  return (
    <div className="mb-4">
      {/* Zone header */}
      <div className="mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700">{label}</span>
          {fields.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-semibold text-slate-600 bg-slate-200 rounded-full">
              {fields.length}
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs text-slate-500 mt-1">{description}</p>
        )}
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`
          min-h-24 p-3 rounded-lg border-2 border-dashed transition-colors
          ${isOver
            ? 'border-blue-400 bg-blue-50'
            : 'border-slate-300 bg-slate-50'
          }
        `}
      >
        {fields.length === 0 ? (
          // Empty state
          <div className="flex items-center justify-center h-full min-h-16">
            <span className="text-sm text-slate-400">{emptyMessage}</span>
          </div>
        ) : (
          // Field list with drag-drop reordering
          <SortableContext
            items={fields.map(f => `${zone}-${f.fieldName}`)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {fields.map((field, index) => (
                <DraggableField
                  key={`${zone}-${field.fieldName}`}
                  field={field}
                  zone={zone}
                  index={index}
                  onRemove={onRemove}
                  showAggregation={showAggregation}
                />
              ))}
            </div>
          </SortableContext>
        )}
      </div>
    </div>
  );
}

export default DropZone;
