/**
 * PivotConfigPanel - Left sidebar with field list and drop zones
 *
 * Integrates DndContext for all drag-and-drop interactions.
 * Contains:
 * - Field list (available fields)
 * - Drop zones (rows, columns, values, filters)
 */

import React, { useState } from 'react';
import { DndContext, closestCenter, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { FieldList } from './FieldList';
import { DropZone } from './DropZone';
import { DraggableField } from './DraggableField';
import { TemplateSelector } from './TemplateSelector';

export function PivotConfigPanel({
  fields,
  fieldsLoading,
  fieldsError,
  config,
  onAddToZone,
  onRemoveFromZone,
  onReorderZone,
  recommendedTemplates,
  onApplyTemplate,
}) {
  const [activeField, setActiveField] = useState(null);

  // Configure sensors for drag-and-drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    })
  );

  const handleDragStart = (event) => {
    const { active } = event;
    setActiveField(active.data.current?.field || null);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveField(null);

    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    const sourceZone = activeData?.zone;
    const targetZone = overData?.zone;

    // Case 1: Drag from field list to drop zone
    if (!sourceZone && targetZone) {
      const field = activeData?.field;
      if (field) {
        onAddToZone(targetZone, field);
      }
      return;
    }

    // Case 2: Reorder within same zone
    if (sourceZone === targetZone && sourceZone) {
      const fromIndex = activeData?.index;
      const toIndex = overData?.index;
      if (fromIndex !== undefined && toIndex !== undefined && fromIndex !== toIndex) {
        onReorderZone(sourceZone, fromIndex, toIndex);
      }
      return;
    }

    // Case 3: Move between zones
    if (sourceZone && targetZone && sourceZone !== targetZone) {
      const field = activeData?.field;
      if (field) {
        onRemoveFromZone(sourceZone, field.fieldName);
        onAddToZone(targetZone, field);
      }
      return;
    }
  };

  // Handle field click (alternative to drag-drop)
  const handleFieldClick = (field) => {
    // Auto-add to appropriate zone based on field type
    if (field.fieldType === 'measure') {
      onAddToZone('values', field);
    } else {
      onAddToZone('rows', field);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 border-r border-slate-200">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Field List */}
        <div className="flex-shrink-0 p-4 border-b border-slate-200 max-h-96 overflow-hidden flex flex-col">
          <FieldList
            fields={fields}
            loading={fieldsLoading}
            error={fieldsError}
            onFieldClick={handleFieldClick}
          />
        </div>

        {/* Drop Zones */}
        <div className="flex-1 p-4 overflow-y-auto">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Configuration</h3>

          {/* Recommended Templates */}
          {recommendedTemplates && recommendedTemplates.length > 0 && (
            <TemplateSelector
              templates={recommendedTemplates}
              onApplyTemplate={onApplyTemplate}
              disabled={fieldsLoading}
            />
          )}

          {/* Rows Zone */}
          <DropZone
            zone="rows"
            label="Rows"
            description="Group data by these fields (vertical)"
            fields={config.rows}
            onRemove={(fieldName) => onRemoveFromZone('rows', fieldName)}
          />

          {/* Columns Zone - Phase 2 feature */}
          <DropZone
            zone="columns"
            label="Columns"
            description="Pivot data across these fields (horizontal)"
            fields={config.columns}
            onRemove={(fieldName) => onRemoveFromZone('columns', fieldName)}
            emptyMessage="Column pivoting coming in Phase 2"
          />

          {/* Values Zone */}
          <DropZone
            zone="values"
            label="Values"
            description="Aggregate these measures"
            fields={config.values}
            onRemove={(fieldName) => onRemoveFromZone('values', fieldName)}
            showAggregation={true}
          />

          {/* Filters Zone - Phase 3 feature */}
          <DropZone
            zone="filters"
            label="Filters"
            description="Filter data before aggregation"
            fields={config.filters}
            onRemove={(fieldName) => onRemoveFromZone('filters', fieldName)}
            emptyMessage="Filtering coming in Phase 3"
          />
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeField ? (
            <div className="bg-white rounded-lg shadow-xl">
              <DraggableField field={activeField} isDragging={true} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

export default PivotConfigPanel;
