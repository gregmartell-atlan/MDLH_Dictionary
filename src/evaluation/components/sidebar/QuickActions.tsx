import { useModelStore } from '../../stores/modelStore';
import { useUIStore } from '../../stores/uiStore';
import type { EntityDefinition } from '../../types';

const EMPTY_ARRAY: any[] = [];

interface QuickActionsProps {
  entity: EntityDefinition;
}

export default function QuickActions({ entity }: QuickActionsProps) {
  const deleteEntity = useModelStore((state) => state.deleteEntity);
  const addEntity = useModelStore((state) => state.addEntity);
  const selectEntity = useUIStore((state) => state.selectEntity);
  const entities = useModelStore((state) => {
    const activePage = state.model.pages.find(p => p.id === state.model.activePageId);
    return activePage?.entities || EMPTY_ARRAY;
  });

  const handleDuplicate = () => {
    const newId = addEntity(
      entity.category,
      entity.assetType || 'CustomEntity',
      { x: entity.position.x + 50, y: entity.position.y + 50 }
    );
    
    // Copy all attributes
    entity.attributes.forEach(attr => {
      useModelStore.getState().addAttribute(newId, {
        name: attr.name,
        displayName: attr.displayName,
        type: attr.type,
        required: attr.required,
        value: attr.value,
        description: attr.description,
        enumValues: attr.enumValues,
      });
    });
    
    selectEntity(newId);
  };

  const handleCopyToClipboard = async () => {
    const entityData = {
      name: entity.name,
      displayName: entity.displayName,
      category: entity.category,
      assetType: entity.assetType,
      description: entity.description,
      attributes: entity.attributes,
      relationships: entity.relationships,
    };
    await navigator.clipboard.writeText(JSON.stringify(entityData, null, 2));
    // Could show a toast notification here
  };

  const handleDelete = () => {
    if (confirm(`Delete "${entity.displayName}"? This will also remove all relationships.`)) {
      deleteEntity(entity.id);
      selectEntity(null);
    }
  };

  const relatedEntities = entities.filter(e => 
    entity.relationships.some(rel => rel.targetEntityId === e.id) ||
    e.relationships.some(rel => rel.targetEntityId === entity.id)
  );

  return (
    <div className="p-4 border-b border-gray-100">
      <h3 className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
        Quick Actions
      </h3>
      <div className="space-y-2">
        <button
          onClick={handleDuplicate}
          className="w-full btn-secondary text-sm flex items-center justify-center gap-2"
          title="Duplicate entity (Cmd/Ctrl+D)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Duplicate
        </button>
        <button
          onClick={handleCopyToClipboard}
          className="w-full btn-secondary text-sm flex items-center justify-center gap-2"
          title="Copy entity data to clipboard"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy JSON
        </button>
        {relatedEntities.length > 0 && (
          <div className="pt-2 border-t border-gray-100">
            <div className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
              Related Entities ({relatedEntities.length})
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {relatedEntities.map(related => (
                <button
                  key={related.id}
                  onClick={() => selectEntity(related.id)}
                  className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-gray-100 transition-colors flex items-center justify-between"
                >
                  <span className="truncate" style={{ color: 'var(--text-primary)' }}>
                    {related.displayName}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 ml-2 flex-shrink-0">
                    {related.assetType}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="pt-2 border-t border-gray-100">
          <button
            onClick={handleDelete}
            className="w-full btn-ghost text-sm flex items-center justify-center gap-2"
            style={{ color: 'var(--error-color)' }}
            title="Delete entity"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Entity
          </button>
        </div>
      </div>
    </div>
  );
}




