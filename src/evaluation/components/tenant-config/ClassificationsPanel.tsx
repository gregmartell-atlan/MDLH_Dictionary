/**
 * ClassificationsPanel - Displays discovered classifications
 */

import React from 'react';
import { useTenantConfigStore } from '../../stores/tenantConfigStore';
import { Tag, AlertCircle, CheckCircle2 } from 'lucide-react';

export function ClassificationsPanel() {
  const { config, schemaSnapshot } = useTenantConfigStore();

  // Get classifications from config or schema snapshot
  const classificationMappings = config?.classificationMappings || [];
  const classifications = schemaSnapshot?.classifications || [];

  // If we have classifications from schema snapshot, display them
  if (classifications.length > 0) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Tag size={20} className="text-purple-600" />
          <h2 className="text-lg font-semibold text-gray-900">Classifications</h2>
          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
            {classifications.length}
          </span>
        </div>

        <div className="grid gap-3">
          {classifications.map((cls, idx) => (
            <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Tag size={16} className="text-purple-500" />
                    <h3 className="font-semibold text-gray-900">{cls.displayName || cls.name}</h3>
                  </div>
                  {cls.name !== cls.displayName && (
                    <p className="text-xs text-gray-500 font-mono mb-1">{cls.name}</p>
                  )}
                  {cls.description && (
                    <p className="text-sm text-gray-600 mt-1">{cls.description}</p>
                  )}
                </div>
                <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // If we have classification mappings from config
  if (classificationMappings.length > 0) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Tag size={20} className="text-purple-600" />
          <h2 className="text-lg font-semibold text-gray-900">Classification Mappings</h2>
          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
            {classificationMappings.length}
          </span>
        </div>

        <div className="grid gap-3">
          {classificationMappings.map((mapping, idx) => (
            <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-1">
                <Tag size={16} className="text-purple-500" />
                <h3 className="font-semibold text-gray-900">{mapping.name}</h3>
              </div>
              {mapping.indicatorType && (
                <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${
                  mapping.indicatorType === 'positive' 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  {mapping.indicatorType === 'positive' ? 'Positive' : 'Negative'} Indicator
                </span>
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
        <h3 className="font-semibold text-gray-900 mb-2">No Classifications Discovered</h3>
        <p className="text-sm text-gray-600 mb-4">
          Classifications will appear here after schema discovery.
        </p>
        <p className="text-xs text-gray-500">
          Classifications can be discovered from MDLH TAG_RELATIONSHIP table or via Atlan API.
        </p>
      </div>
    </div>
  );
}
