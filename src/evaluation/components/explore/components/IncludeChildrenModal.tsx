// ============================================
// INCLUDE CHILDREN MODAL
// Confirmation dialog when dragging container assets
// ============================================

import { useState } from 'react';
import { X, Database, Folder, Table, Columns, AlertCircle } from 'lucide-react';

interface IncludeChildrenModalProps {
  isOpen: boolean;
  entityName: string;
  entityType: string;
  childCounts: {
    schemas: number;
    tables: number;
    columns: number;
    total: number;
  };
  onConfirm: (includeChildren: boolean, includeColumns?: boolean) => void;
  onCancel: () => void;
}

export function IncludeChildrenModal({
  isOpen,
  entityName,
  entityType,
  childCounts,
  onConfirm,
  onCancel,
}: IncludeChildrenModalProps) {
  const [includeColumns, setIncludeColumns] = useState(false);

  if (!isOpen) return null;

  const hasChildren = childCounts.total > 0;
  const hasColumns = childCounts.columns > 0;

  // Calculate totals with/without columns
  const totalWithoutColumns = childCounts.schemas + childCounts.tables;
  const effectiveTotal = includeColumns ? childCounts.total : totalWithoutColumns;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              {entityType === 'Database' ? (
                <Database size={20} className="text-blue-600" />
              ) : (
                <Folder size={20} className="text-amber-600" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Add to Canvas</h3>
              <p className="text-sm text-slate-500">{entityName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4">
          {hasChildren ? (
            <>
              <p className="text-sm text-slate-600 mb-4">
                This {entityType.toLowerCase()} contains child assets. Would you like to include them?
              </p>

              {/* Child counts */}
              <div className="bg-slate-50 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  {childCounts.schemas > 0 && (
                    <div>
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <Folder size={16} className="text-amber-500" />
                        <span className="text-lg font-semibold text-slate-800">
                          {childCounts.schemas}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {childCounts.schemas === 1 ? 'Schema' : 'Schemas'}
                      </span>
                    </div>
                  )}
                  {childCounts.tables > 0 && (
                    <div>
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <Table size={16} className="text-emerald-500" />
                        <span className="text-lg font-semibold text-slate-800">
                          {childCounts.tables}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {childCounts.tables === 1 ? 'Table' : 'Tables'}
                      </span>
                    </div>
                  )}
                  {childCounts.columns > 0 && (
                    <div>
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <Columns size={16} className="text-slate-500" />
                        <span className="text-lg font-semibold text-slate-800">
                          {childCounts.columns}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {childCounts.columns === 1 ? 'Column' : 'Columns'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Include columns checkbox */}
              {hasColumns && (
                <label className="flex items-center gap-3 p-3 bg-slate-100 rounded-lg mb-4 cursor-pointer hover:bg-slate-150 transition-colors">
                  <input
                    type="checkbox"
                    checked={includeColumns}
                    onChange={(e) => setIncludeColumns(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-2">
                    <Columns size={16} className="text-purple-500" />
                    <span className="text-sm text-slate-700">
                      Include {childCounts.columns} column{childCounts.columns !== 1 ? 's' : ''}
                    </span>
                  </div>
                </label>
              )}

              {/* Warning for large selections */}
              {effectiveTotal > 50 && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                  <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">
                    Adding many entities at once may affect performance. Consider adding schemas individually.
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-600 mb-4">
              Add this {entityType.toLowerCase()} to the canvas?
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 py-4 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>

          {hasChildren ? (
            <>
              <button
                type="button"
                onClick={() => onConfirm(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Only {entityType}
              </button>
              <button
                type="button"
                onClick={() => onConfirm(true, includeColumns)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Include All ({effectiveTotal + 1})
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onConfirm(false)}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add to Canvas
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default IncludeChildrenModal;
