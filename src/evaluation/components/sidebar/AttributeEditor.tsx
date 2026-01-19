import { useState } from 'react';
import { useModelStore } from '../../stores/modelStore';
import type { EntityDefinition, AttributeType, AttributeDefinition } from '../../types';

interface AttributeEditorProps {
  entity: EntityDefinition;
}

const ATTRIBUTE_TYPES: { value: AttributeType; label: string }[] = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' },
  { value: 'enum', label: 'Enum' },
  { value: 'array', label: 'Array' },
  { value: 'user', label: 'User' },
  { value: 'group', label: 'Group' },
];

interface AttributeRowProps {
  attribute: AttributeDefinition;
  entityId: string;
  onExpand: () => void;
  isExpanded: boolean;
}

function AttributeRow({ attribute, entityId, onExpand, isExpanded }: AttributeRowProps) {
  const updateAttribute = useModelStore((state) => state.updateAttribute);
  const deleteAttribute = useModelStore((state) => state.deleteAttribute);

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <div
        className="px-4 py-4 flex items-center gap-3 hover:bg-slate-50 cursor-pointer transition-all duration-150 group"
        onClick={onExpand}
      >
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 truncate">
              {attribute.name}
            </span>
            {attribute.required && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                Required
              </span>
            )}
          </div>
          {attribute.displayName && attribute.displayName !== attribute.name && (
            <div className="text-xs text-gray-500 mt-0.5 truncate">
              {attribute.displayName}
            </div>
          )}
        </div>

        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
          {attribute.type}
        </span>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 animate-fadeIn">
          <div className="bg-slate-50 rounded-lg p-4 space-y-3.5 border border-slate-200">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1.5 text-gray-700">Name</label>
                <input
                  type="text"
                  value={attribute.name}
                  onChange={(e) => updateAttribute(entityId, attribute.id, { name: e.target.value })}
                  className="input-clean text-sm"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5 text-gray-700">Display Name</label>
                <input
                  type="text"
                  value={attribute.displayName}
                  onChange={(e) => updateAttribute(entityId, attribute.id, { displayName: e.target.value })}
                  className="input-clean text-sm"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1.5 text-gray-700">Type</label>
                <select
                  value={attribute.type}
                  onChange={(e) => updateAttribute(entityId, attribute.id, { type: e.target.value as AttributeType })}
                  className="input-clean text-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  {ATTRIBUTE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={attribute.required}
                    onChange={(e) => updateAttribute(entityId, attribute.id, { required: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300"
                    style={{ accentColor: 'var(--primary-blue)' }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="text-gray-700">Required</span>
                </label>
              </div>
            </div>

            {attribute.type === 'enum' && (
              <div>
                <label className="block text-xs font-medium mb-1.5 text-gray-700">
                  Enum Values (comma-separated)
                </label>
                <input
                  type="text"
                  value={attribute.enumValues?.join(', ') || ''}
                  onChange={(e) => updateAttribute(entityId, attribute.id, { enumValues: e.target.value.split(',').map((v) => v.trim()) })}
                  className="input-clean text-sm"
                  placeholder="value1, value2, value3"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium mb-1.5 text-gray-700">Description</label>
              <input
                type="text"
                value={attribute.description || ''}
                onChange={(e) => updateAttribute(entityId, attribute.id, { description: e.target.value })}
                className="input-clean text-sm"
                placeholder="Optional description..."
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            <div className="pt-2 border-t border-slate-300">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Delete this attribute?')) deleteAttribute(entityId, attribute.id);
                }}
                className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
              >
                Delete attribute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AttributeEditor({ entity }: AttributeEditorProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newAttr, setNewAttr] = useState({
    name: '',
    displayName: '',
    type: 'string' as AttributeType,
    required: false,
  });

  const addAttribute = useModelStore((state) => state.addAttribute);

  const filteredAttributes = entity.attributes.filter(attr => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      attr.name.toLowerCase().includes(query) ||
      attr.displayName?.toLowerCase().includes(query) ||
      attr.type.toLowerCase().includes(query) ||
      attr.description?.toLowerCase().includes(query)
    );
  });

  const handleAdd = () => {
    if (!newAttr.name.trim()) return;
    addAttribute(entity.id, {
      name: newAttr.name,
      displayName: newAttr.displayName || newAttr.name,
      type: newAttr.type,
      required: newAttr.required,
    });
    setNewAttr({ name: '', displayName: '', type: 'string', required: false });
    setIsAdding(false);
  };

  return (
    <div>
      {/* Search */}
      {entity.attributes.length > 3 && (
        <div className="p-3 border-b border-gray-100">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search attributes..."
              className="input-clean pl-9 pr-8 text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
              >
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {searchQuery && (
            <div className="text-xs mt-2 text-gray-500">
              {filteredAttributes.length} of {entity.attributes.length} attributes
            </div>
          )}
        </div>
      )}

      {/* Attribute List */}
      <div>
        {filteredAttributes.length > 0 ? (
          filteredAttributes.map((attr) => (
          <AttributeRow
            key={attr.id}
            attribute={attr}
            entityId={entity.id}
            isExpanded={expandedId === attr.id}
            onExpand={() => setExpandedId(expandedId === attr.id ? null : attr.id)}
          />
          ))
        ) : entity.attributes.length > 0 ? (
          <div className="p-8 text-center">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-sm font-medium text-gray-900 mb-1">No matches found</p>
            <p className="text-sm text-gray-500">
              No attributes match "{searchQuery}"
            </p>
          </div>
        ) : null}
      </div>

      {/* Empty State */}
      {entity.attributes.length === 0 && !isAdding && (
        <div className="p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-900 mb-1">No attributes yet</p>
          <p className="text-sm text-gray-500 mb-4">
            Add attributes to define the structure<br />of this entity
          </p>
        </div>
      )}

      {/* Add New Attribute */}
      {isAdding ? (
        <div className="p-4 space-y-3 border-t border-gray-200 bg-blue-50 animate-fadeIn">
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              value={newAttr.name}
              onChange={(e) => setNewAttr({ ...newAttr, name: e.target.value })}
              className="input-clean text-sm"
              placeholder="Attribute name"
              autoFocus
            />
            <select
              value={newAttr.type}
              onChange={(e) => setNewAttr({ ...newAttr, type: e.target.value as AttributeType })}
              className="input-clean text-sm"
            >
              {ATTRIBUTE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={newAttr.required}
              onChange={(e) => setNewAttr({ ...newAttr, required: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
              style={{ accentColor: 'var(--primary-blue)' }}
            />
            <span className="text-gray-700">Required</span>
          </label>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!newAttr.name.trim()}
              className="btn-primary flex-1 text-sm"
            >
              Add Attribute
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
            Add Attribute
          </button>
        </div>
      )}
    </div>
  );
}
