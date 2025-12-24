/**
 * TemplateSelector - Display and apply recommended pivot templates
 *
 * Shows context-aware pivot templates based on the selected table
 * and available fields. Clicking a template applies it to the pivot configuration.
 */

import React, { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, Info } from 'lucide-react';

export function TemplateSelector({ templates, onApplyTemplate, disabled = false }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  if (!templates || templates.length === 0) {
    return null;
  }

  const handleTemplateClick = (template) => {
    setSelectedTemplate(template.id);
    onApplyTemplate(template);
  };

  return (
    <div className="mb-4 border border-blue-200 rounded-lg bg-blue-50">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-blue-100 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-blue-600" />
          <span className="text-sm font-semibold text-blue-900">
            Recommended Analyses
          </span>
          <span className="px-2 py-0.5 text-xs font-semibold text-blue-700 bg-blue-200 rounded">
            {templates.length}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp size={16} className="text-blue-600" />
        ) : (
          <ChevronDown size={16} className="text-blue-600" />
        )}
      </button>

      {/* Template List */}
      {isExpanded && (
        <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
          <p className="text-xs text-blue-700 mb-3">
            Click a template to quickly configure your pivot analysis
          </p>

          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => handleTemplateClick(template)}
              disabled={disabled}
              className={`
                w-full text-left p-3 rounded-lg border-2 transition-all
                ${
                  selectedTemplate === template.id
                    ? 'border-blue-500 bg-white shadow-md'
                    : 'border-blue-200 bg-white hover:border-blue-400 hover:shadow-sm'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {/* Template Header */}
              <div className="flex items-start gap-2 mb-1">
                <span className="text-lg">{template.icon}</span>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-slate-800">
                    {template.name}
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {template.description}
                  </p>
                </div>
              </div>

              {/* Configuration Preview */}
              <div className="mt-2 pt-2 border-t border-blue-100 flex flex-wrap gap-2 text-xs">
                {template.enrichedConfig.rows.length > 0 && (
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                    Rows: {template.enrichedConfig.rows.map(f => f.fieldName).join(', ')}
                  </span>
                )}
                {template.enrichedConfig.values.length > 0 && (
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded">
                    Values: {template.enrichedConfig.values.map(v =>
                      `${v.aggregation}(${v.fieldName})`
                    ).join(', ')}
                  </span>
                )}
              </div>

              {/* Missing Optional Fields Warning */}
              {template.optionalFields && template.optionalFields.length > 0 && (
                <div className="mt-2 flex items-start gap-1 text-xs text-amber-700">
                  <Info size={12} className="mt-0.5 flex-shrink-0" />
                  <span>
                    Some optional fields may be missing: {' '}
                    {template.optionalFields.slice(0, 2).join(', ')}
                    {template.optionalFields.length > 2 && '...'}
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default TemplateSelector;
