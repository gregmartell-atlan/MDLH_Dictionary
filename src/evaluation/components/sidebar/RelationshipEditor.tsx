import { useState } from 'react';
import { useModelStore } from '../../stores/modelStore';
import type { EntityDefinition, Cardinality, RelationshipDefinition } from '../../types';

const EMPTY_ARRAY: any[] = [];

interface RelationshipEditorProps {
  entity: EntityDefinition;
}

const CARDINALITY_OPTIONS: { value: Cardinality; label: string; shortLabel: string; color: string }[] = [
  { value: 'one-to-one', label: 'One to One', shortLabel: '1:1', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'one-to-many', label: 'One to Many', shortLabel: '1:N', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'many-to-many', label: 'Many to Many', shortLabel: 'N:N', color: 'bg-purple-100 text-purple-700 border-purple-200' },
];

function getCardinalityInfo(cardinality: Cardinality) {
  return CARDINALITY_OPTIONS.find(opt => opt.value === cardinality) || CARDINALITY_OPTIONS[1];
}

interface RelationshipRowProps {
  relationship: RelationshipDefinition;
  entityId: string;
  targetEntity: EntityDefinition | undefined;
  onExpand: () => void;
  isExpanded: boolean;
}

function RelationshipRow({
  relationship,
  entityId,
  targetEntity,
  onExpand,
  isExpanded,
}: RelationshipRowProps) {
  const updateRelationship = useModelStore((state) => state.updateRelationship);
  const deleteRelationship = useModelStore((state) => state.deleteRelationship);
  const entities = useModelStore((state) => {
    const activePage = state.model.pages.find(p => p.id === state.model.activePageId);
    return activePage?.entities || EMPTY_ARRAY;
  });

  const cardinalityInfo = getCardinalityInfo(relationship.cardinality);

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <div
        className="px-4 py-4 flex items-center gap-3 hover:bg-slate-50 cursor-pointer transition-all duration-150 group"
        onClick={onExpand}
      >
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
            isExpanded ? 'rotate-90' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>

        <svg
          className="w-4 h-4 text-gray-400 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
          />
        </svg>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 truncate">
              {relationship.name}
            </span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${cardinalityInfo.color}`}>
              {cardinalityInfo.shortLabel}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            <span className="truncate">{targetEntity?.displayName || 'Unknown'}</span>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 animate-fadeIn">
          <div className="bg-slate-50 rounded-lg p-4 space-y-3.5 border border-slate-200">
            <div>
              <label className="block text-xs font-medium mb-1.5 text-gray-700">Relationship Name</label>
              <input
                type="text"
                value={relationship.name}
                onChange={(e) =>
                  updateRelationship(entityId, relationship.id, {
                    name: e.target.value,
                  })
                }
                className="input-clean text-sm"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 text-gray-700">Target Entity</label>
              <select
                value={relationship.targetEntityId}
                onChange={(e) =>
                  updateRelationship(entityId, relationship.id, {
                    targetEntityId: e.target.value,
                  })
                }
                className="input-clean text-sm"
                onClick={(e) => e.stopPropagation()}
              >
                {entities
                  .filter((e) => e.id !== entityId)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.displayName} ({e.assetType})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 text-gray-700">Cardinality</label>
              <select
                value={relationship.cardinality}
                onChange={(e) =>
                  updateRelationship(entityId, relationship.id, {
                    cardinality: e.target.value as Cardinality,
                  })
                }
                className="input-clean text-sm"
                onClick={(e) => e.stopPropagation()}
              >
                {CARDINALITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} ({opt.shortLabel})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 text-gray-700">Description</label>
              <input
                type="text"
                value={relationship.description || ''}
                onChange={(e) =>
                  updateRelationship(entityId, relationship.id, {
                    description: e.target.value,
                  })
                }
                className="input-clean text-sm"
                placeholder="Optional description..."
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            <div className="pt-2 border-t border-slate-300">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Delete this relationship?')) {
                    deleteRelationship(entityId, relationship.id);
                  }
                }}
                className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
              >
                Delete relationship
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RelationshipEditor({ entity }: RelationshipEditorProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newRel, setNewRel] = useState({
    name: '',
    targetEntityId: '',
    cardinality: 'one-to-many' as Cardinality,
  });

  const entities = useModelStore((state) => {
    const activePage = state.model.pages.find(p => p.id === state.model.activePageId);
    return activePage?.entities || EMPTY_ARRAY;
  });
  const addRelationship = useModelStore((state) => state.addRelationship);

  const availableTargets = entities.filter((e) => e.id !== entity.id);

  const handleAdd = () => {
    if (!newRel.name.trim() || !newRel.targetEntityId) return;

    addRelationship(entity.id, newRel.targetEntityId, {
      name: newRel.name,
      cardinality: newRel.cardinality,
    });

    setNewRel({
      name: '',
      targetEntityId: '',
      cardinality: 'one-to-many',
    });
    setIsAdding(false);
  };

  return (
    <div>
      {/* Relationship List */}
      {entity.relationships.length > 0 ? (
        <div>
          {entity.relationships.map((rel) => (
            <RelationshipRow
              key={rel.id}
              relationship={rel}
              entityId={entity.id}
              targetEntity={entities.find((e) => e.id === rel.targetEntityId)}
              isExpanded={expandedId === rel.id}
              onExpand={() =>
                setExpandedId(expandedId === rel.id ? null : rel.id)
              }
            />
          ))}
        </div>
      ) : (
        !isAdding && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-purple-50 flex items-center justify-center">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-900 mb-1">No relationships yet</p>
            <p className="text-sm text-gray-500 mb-4">
              Connect entities by dragging from one<br />node to another on the canvas
            </p>
          </div>
        )
      )}

      {/* Add New Relationship */}
      {availableTargets.length > 0 && (
        <>
          {isAdding ? (
            <div className="p-4 space-y-3 border-t border-gray-200 bg-purple-50 animate-fadeIn">
              <div>
                <label className="block text-xs font-medium mb-1.5 text-gray-700">
                  Relationship Name
                </label>
                <input
                  type="text"
                  value={newRel.name}
                  onChange={(e) =>
                    setNewRel({ ...newRel, name: e.target.value })
                  }
                  className="input-clean text-sm"
                  placeholder="e.g., contains, references, belongs_to"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5 text-gray-700">
                  Target Entity
                </label>
                <select
                  value={newRel.targetEntityId}
                  onChange={(e) =>
                    setNewRel({ ...newRel, targetEntityId: e.target.value })
                  }
                  className="input-clean text-sm"
                >
                  <option value="">Select target entity...</option>
                  {availableTargets.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.displayName} ({e.assetType})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5 text-gray-700">
                  Cardinality
                </label>
                <select
                  value={newRel.cardinality}
                  onChange={(e) =>
                    setNewRel({
                      ...newRel,
                      cardinality: e.target.value as Cardinality,
                    })
                  }
                  className="input-clean text-sm"
                >
                  {CARDINALITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} ({opt.shortLabel})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  disabled={!newRel.name.trim() || !newRel.targetEntityId}
                  className="btn-primary flex-1 text-sm"
                >
                  Add Relationship
                </button>
                <button
                  onClick={() => setIsAdding(false)}
                  className="btn-secondary text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="sticky bottom-0 bg-white border-t border-gray-200">
              <button
                onClick={() => setIsAdding(true)}
                className="w-full p-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 hover:bg-slate-50"
                style={{ color: 'var(--primary-blue)' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Relationship
              </button>
            </div>
          )}
        </>
      )}

      {availableTargets.length === 0 && !isAdding && entity.relationships.length > 0 && (
        <div className="p-4 text-center text-sm text-gray-400 border-t">
          Add more entities to create relationships
        </div>
      )}
    </div>
  );
}
