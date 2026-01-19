import { useModelStore } from '../../stores/modelStore';
import { useUIStore } from '../../stores/uiStore';
import { getCategoryInfo } from '../../types';

const EMPTY_ARRAY: any[] = [];

export default function MultiSelectPanel() {
  const selectedEntityIds = useUIStore((state) => state.selectedEntityIds || EMPTY_ARRAY);
  const selectEntity = useUIStore((state) => state.selectEntity);
  const clearSelection = useUIStore((state) => state.clearSelection);
  const deleteEntity = useModelStore((state) => state.deleteEntity);
  const isEntityPanelOpen = useUIStore((state) => state.isEntityPanelOpen);
  const toggleEntityPanel = useUIStore((state) => state.toggleEntityPanel);

  const entities = useModelStore((state) => {
    const activePage = state.model.pages.find(p => p.id === state.model.activePageId);
    return activePage?.entities || EMPTY_ARRAY;
  });

  const selectedEntities = entities.filter(e => selectedEntityIds.includes(e.id));

  if (selectedEntityIds.length < 2) return null;

  const handleDeleteAll = () => {
    if (confirm(`Delete ${selectedEntityIds.length} selected entities?`)) {
      selectedEntityIds.forEach(id => deleteEntity(id));
      clearSelection();
    }
  };

  const totalAttributes = selectedEntities.reduce((sum, e) => sum + e.attributes.length, 0);
  const totalRelationships = selectedEntities.reduce((sum, e) => sum + e.relationships.length, 0);

  return (
    <div
      className={`bg-white border-l border-gray-200 flex flex-col transition-all duration-300 ${
        isEntityPanelOpen ? 'w-80' : 'w-14'
      }`}
    >
      {!isEntityPanelOpen && (
        <button
          onClick={toggleEntityPanel}
          className="p-4 hover:bg-gray-100 transition-colors"
          title="Expand panel"
        >
          <svg
            className="w-5 h-5"
            style={{ color: 'var(--text-secondary)' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 5l7 7-7 7M5 5l7 7-7 7"
            />
          </svg>
        </button>
      )}

      {isEntityPanelOpen && (
        <>
          {/* Header */}
          <div className="p-4 border-b" style={{ background: 'var(--primary-blue-light)' }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                  {selectedEntityIds.length} Selected
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  Multiple entities selected
                </p>
              </div>
              <button
                onClick={toggleEntityPanel}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                title="Collapse panel"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <button
              onClick={clearSelection}
              className="w-full btn-secondary text-xs"
            >
              Clear Selection
            </button>
          </div>

          {/* Stats */}
          <div className="p-4 border-b bg-slate-50">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-lg p-2 border border-slate-200">
                <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Total Attributes</div>
                <div className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {totalAttributes}
                </div>
              </div>
              <div className="bg-white rounded-lg p-2 border border-slate-200">
                <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Total Relations</div>
                <div className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {totalRelationships}
                </div>
              </div>
            </div>
          </div>

          {/* Entity List */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-2 space-y-1">
              {selectedEntities.map(entity => {
                const categoryInfo = getCategoryInfo(entity.category);
                return (
                  <button
                    key={entity.id}
                    onClick={() => selectEntity(entity.id)}
                    className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-slate-50 transition-all group focus:ring-2 focus:ring-blue-500/20"
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                        style={{ backgroundColor: categoryInfo?.color || '#6B7280' }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                          {entity.displayName || entity.name}
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {entity.assetType}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                            {entity.attributes.length} attrs
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                            {entity.relationships.length} rels
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-gray-200 space-y-2">
            <button
              onClick={handleDeleteAll}
              className="w-full btn-ghost text-sm flex items-center justify-center gap-2"
              style={{ color: 'var(--error-color)' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete All ({selectedEntityIds.length})
            </button>
          </div>
        </>
      )}
    </div>
  );
}




