import { useState } from 'react';
import { useModelStore } from '../../stores/modelStore';
import { useUIStore } from '../../stores/uiStore';
import { getCategoryInfo } from '../../types';

const EMPTY_ARRAY: any[] = [];

import AttributeEditor from './AttributeEditor';
import RelationshipEditor from './RelationshipEditor';
import CanvasAuditPanel from './CanvasAuditPanel';
import LineagePanel from './LineagePanel';
import EntityAuditPanel from './EntityAuditPanel';

type TabType = 'attributes' | 'relationships' | 'lineage' | 'audit' | 'info';

export default function EntityPanel() {
  const [activeTab, setActiveTab] = useState<TabType>('attributes');

  const selectedEntityId = useUIStore((state) => state.selectedEntityId);
  const isEntityPanelOpen = useUIStore((state) => state.isEntityPanelOpen);
  const toggleEntityPanel = useUIStore((state) => state.toggleEntityPanel);
  const selectEntity = useUIStore((state) => state.selectEntity);

  const entities = useModelStore((state) => {
    const activePage = state.model.pages.find(p => p.id === state.model.activePageId);
    return activePage?.entities || EMPTY_ARRAY;
  });
  const updateEntity = useModelStore((state) => state.updateEntity);
  const deleteEntity = useModelStore((state) => state.deleteEntity);
  const addEntity = useModelStore((state) => state.addEntity);

  const selectedEntity = entities.find((e) => e.id === selectedEntityId);

  // When no entity is selected, show the Canvas Audit panel
  if (!selectedEntity) {
    return (
      <div
        className={`bg-white border-l border-gray-200 flex flex-col transition-all duration-300 overflow-hidden ${
          isEntityPanelOpen ? 'w-80' : 'w-0'
        }`}
      >
        {isEntityPanelOpen && <CanvasAuditPanel />}
      </div>
    );
  }

  const categoryInfo = getCategoryInfo(selectedEntity.category);

  const handleDuplicate = () => {
    const newId = addEntity(
      selectedEntity.category,
      selectedEntity.assetType || 'CustomEntity',
      { x: selectedEntity.position.x + 50, y: selectedEntity.position.y + 50 }
    );
    selectedEntity.attributes.forEach(attr => {
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

  const handleDelete = () => {
    if (confirm(`Delete "${selectedEntity.displayName}"?`)) {
      deleteEntity(selectedEntity.id);
      selectEntity(null);
    }
  };

  return (
    <div
      className={`bg-white border-l border-gray-200 flex flex-col transition-all duration-300 ${
        isEntityPanelOpen ? 'w-80' : 'w-14'
      }`}
    >
      {/* Collapsed toggle */}
      {!isEntityPanelOpen && (
        <button
          onClick={toggleEntityPanel}
          className="p-4 hover:bg-gray-50 transition-colors"
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
          {/* Modern Header with Left Accent Border */}
          <div className="relative">
            <div
              className="absolute left-0 top-0 bottom-0 w-1"
              style={{ backgroundColor: categoryInfo?.color || '#6B7280' }}
            />
            <div className="px-5 py-4 bg-white border-b border-gray-200">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={selectedEntity.displayName}
                    onChange={(e) =>
                      updateEntity(selectedEntity.id, { displayName: e.target.value })
                    }
                    className="w-full bg-transparent border-b-2 border-transparent hover:border-gray-200 focus:border-blue-500 text-gray-900 font-semibold text-base focus:outline-none transition-colors py-1"
                    placeholder="Entity name"
                  />
                  <div className="text-xs font-medium mt-1.5" style={{ color: 'var(--text-muted)' }}>
                    {categoryInfo?.displayName} / {selectedEntity.assetType}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleDuplicate}
                    className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                    title="Duplicate"
                  >
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button
                    onClick={handleDelete}
                    className="p-2 hover:bg-red-50 rounded-md transition-colors group"
                    title="Delete"
                  >
                    <svg className="w-4 h-4 text-gray-600 group-hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                  <button
                    onClick={toggleEntityPanel}
                    className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                    title="Collapse"
                  >
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Modern Pill-Style Tabs */}
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <div className="flex gap-1 bg-white rounded-lg p-1 border border-gray-200">
              <button
                onClick={() => setActiveTab('attributes')}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                  activeTab === 'attributes'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-slate-50'
                }`}
              >
                Attributes ({selectedEntity.attributes.length})
              </button>
              <button
                onClick={() => setActiveTab('relationships')}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                  activeTab === 'relationships'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-slate-50'
                }`}
              >
                Relations
              </button>
              <button
                onClick={() => setActiveTab('lineage')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 flex items-center justify-center ${
                  activeTab === 'lineage'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-slate-50'
                }`}
                title="Lineage & dependencies"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </button>
              <button
                onClick={() => setActiveTab('audit')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 flex items-center justify-center ${
                  activeTab === 'audit'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-slate-50'
                }`}
                title="Metadata audit"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              <button
                onClick={() => setActiveTab('info')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 flex items-center justify-center ${
                  activeTab === 'info'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-slate-50'
                }`}
                title="Entity info"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'attributes' && (
              <AttributeEditor entity={selectedEntity} />
            )}
            {activeTab === 'relationships' && (
              <RelationshipEditor entity={selectedEntity} />
            )}
            {activeTab === 'lineage' && (
              <LineagePanel entity={selectedEntity} />
            )}
            {activeTab === 'audit' && (
              <EntityAuditPanel entity={selectedEntity} />
            )}
            {activeTab === 'info' && (
              <div className="p-4 space-y-4">
                {/* Technical Name */}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Technical Name
                  </label>
                  <input
                    type="text"
                    value={selectedEntity.name}
                    onChange={(e) => updateEntity(selectedEntity.id, { name: e.target.value })}
                    className="input-clean"
                    placeholder="e.g., customer_table"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Description
                  </label>
                  <textarea
                    value={selectedEntity.description || ''}
                    onChange={(e) => updateEntity(selectedEntity.id, { description: e.target.value })}
                    rows={3}
                    className="input-clean resize-none"
                    placeholder="Describe what this entity represents..."
                  />
                </div>

                {/* Stats */}
                <div className="border-t pt-4">
                  <h3 className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                    Statistics
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <div className="text-xs text-gray-500">Attributes</div>
                      <div className="text-lg font-semibold">{selectedEntity.attributes.length}</div>
                      <div className="text-xs text-gray-400">
                        {selectedEntity.attributes.filter(a => a.required).length} required
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <div className="text-xs text-gray-500">Relations</div>
                      <div className="text-lg font-semibold">{selectedEntity.relationships.length}</div>
                    </div>
                  </div>
                </div>

                {/* Entity ID */}
                <div className="border-t pt-4">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Entity ID
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="text-xs px-2 py-1 bg-gray-100 rounded font-mono text-gray-600 flex-1 truncate">
                      {selectedEntity.id}
                    </code>
                    <button
                      onClick={() => navigator.clipboard.writeText(selectedEntity.id)}
                      className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                      title="Copy ID"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Position */}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Canvas Position
                  </label>
                  <div className="text-xs font-mono text-gray-500">
                    X: {Math.round(selectedEntity.position.x)}, Y: {Math.round(selectedEntity.position.y)}
                  </div>
                </div>

                {/* Connector */}
                {selectedEntity.connectorName && (
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                      Connector
                    </label>
                    <span className="text-xs px-2 py-1 rounded-full bg-indigo-100 text-indigo-700">
                      {selectedEntity.connectorName}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
