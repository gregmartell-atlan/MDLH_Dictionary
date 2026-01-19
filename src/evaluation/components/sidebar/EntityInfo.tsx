import { useModelStore } from '../../stores/modelStore';
import type { EntityDefinition } from '../../types';
import { getCategoryInfo } from '../../types';

interface EntityInfoProps {
  entity: EntityDefinition;
}

export default function EntityInfo({ entity }: EntityInfoProps) {
  const categoryInfo = getCategoryInfo(entity.category);
  const activePage = useModelStore((state) => {
    return state.model.pages.find(p => p.id === state.model.activePageId);
  });

  return (
    <div className="p-4 border-b border-gray-100 space-y-3">
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
          Entity ID
        </label>
        <div className="flex items-center gap-2">
          <code className="text-xs px-2 py-1 bg-gray-100 rounded font-mono text-gray-600 flex-1 truncate">
            {entity.id}
          </code>
          <button
            onClick={() => navigator.clipboard.writeText(entity.id)}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title="Copy ID"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            Category
          </label>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: categoryInfo?.color || '#6B7280' }}
            />
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
              {categoryInfo?.displayName || entity.category}
            </span>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            Asset Type
          </label>
          <span className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>
            {entity.assetType}
          </span>
        </div>
      </div>

      {entity.connectorName && (
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            Connector
          </label>
          <span className="text-xs px-2 py-1 rounded-full bg-indigo-100 text-indigo-700">
            {entity.connectorName}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            Position
          </label>
          <div className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
            X: {Math.round(entity.position.x)}<br />
            Y: {Math.round(entity.position.y)}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            Page
          </label>
          <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
            {activePage?.name || 'Unknown'}
          </span>
        </div>
      </div>
    </div>
  );
}




