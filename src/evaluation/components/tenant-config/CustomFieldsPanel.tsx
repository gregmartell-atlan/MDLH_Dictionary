/**
 * CustomFieldsPanel - Displays discovered custom metadata/custom fields
 */

import React from 'react';
import { useTenantConfigStore } from '../../stores/tenantConfigStore';
import { Tag, Database, FileText, AlertCircle } from 'lucide-react';

export function CustomFieldsPanel() {
  const { config, schemaSnapshot } = useTenantConfigStore();

  // Get custom fields from config or schema snapshot
  const customFields = config?.customFields || [];
  const customMetadata = schemaSnapshot?.customMetadata || [];

  // If we have custom metadata from schema snapshot, display it
  if (customMetadata.length > 0) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Tag size={20} className="text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Custom Metadata</h2>
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
            {customMetadata.length}
          </span>
        </div>

        <div className="grid gap-4">
          {customMetadata.map((cm, idx) => (
            <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-gray-900">{cm.displayName || cm.name}</h3>
                  {cm.name !== cm.displayName && (
                    <p className="text-xs text-gray-500 font-mono mt-0.5">{cm.name}</p>
                  )}
                </div>
              </div>
              
              {cm.attributes && cm.attributes.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-gray-600 mb-2">Attributes ({cm.attributes.length}):</p>
                  <div className="grid grid-cols-2 gap-2">
                    {cm.attributes.map((attr, attrIdx) => (
                      <div key={attrIdx} className="flex items-center gap-2 text-sm">
                        <FileText size={14} className="text-gray-400" />
                        <span className="text-gray-700">{attr.displayName || attr.name}</span>
                        <span className="text-xs text-gray-500 font-mono">({attr.type})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // If we have custom fields from config
  if (customFields.length > 0) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Tag size={20} className="text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Custom Fields</h2>
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
            {customFields.length}
          </span>
        </div>

        <div className="grid gap-4">
          {customFields.map((field, idx) => (
            <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
              <h3 className="font-semibold text-gray-900">{field.name || field.id}</h3>
              {field.description && (
                <p className="text-sm text-gray-600 mt-1">{field.description}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  return (
    <div className="p-6">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <AlertCircle size={24} className="text-yellow-600 mx-auto mb-3" />
        <h3 className="font-semibold text-gray-900 mb-2">No Custom Fields Discovered</h3>
        <p className="text-sm text-gray-600 mb-4">
          Custom metadata and custom fields will appear here after schema discovery.
        </p>
        <p className="text-xs text-gray-500">
          Custom fields can be discovered from MDLH CUSTOMMETADATA_RELATIONSHIP table or via Atlan API.
        </p>
      </div>
    </div>
  );
}
