/**
 * Wizard Step 3: Field Selection
 * 
 * Select and configure metadata fields based on use cases.
 */

import React, { useMemo } from 'react';
import { useAssistantStore } from '../../../stores/assistantStore';
import { UNIFIED_FIELD_CATALOG, getCoreFieldsForUseCase, getFieldsForUseCase } from '../../../evaluation/catalog/unifiedFields';
import { SIGNAL_DEFINITIONS } from '../../../evaluation/catalog/signalDefinitions';
import { Check, Plus, Minus, Info } from 'lucide-react';

export function WizardStep3Fields() {
  const { wizardState, addMetadataModelRow, removeMetadataModelRow } = useAssistantStore();
  const { profile, draftMetadataModel } = wizardState;
  const selectedUseCases = profile.useCases || [];

  // Get recommended fields based on selected use cases
  const recommendedFields = useMemo(() => {
    if (selectedUseCases.length === 0) {
      return UNIFIED_FIELD_CATALOG.filter(f => f.status === 'active').slice(0, 10);
    }

    // Collect core fields for all selected use cases
    const coreFieldIds = new Set();
    const optionalFieldIds = new Set();

    for (const useCaseId of selectedUseCases) {
      const coreFields = getCoreFieldsForUseCase(useCaseId);
      const allFields = getFieldsForUseCase(useCaseId);

      coreFields.forEach(f => coreFieldIds.add(f.id));
      allFields.forEach(f => {
        if (!coreFieldIds.has(f.id)) {
          optionalFieldIds.add(f.id);
        }
      });
    }

    // Get field objects
    const coreFields = UNIFIED_FIELD_CATALOG.filter(f => coreFieldIds.has(f.id));
    const optionalFields = UNIFIED_FIELD_CATALOG.filter(f => optionalFieldIds.has(f.id));

    return { core: coreFields, optional: optionalFields };
  }, [selectedUseCases]);

  // Check if a field is in the model
  const isFieldSelected = (fieldId) => {
    return draftMetadataModel.some(row => row.id === fieldId);
  };

  // Toggle field selection
  const toggleField = (field) => {
    if (isFieldSelected(field.id)) {
      removeMetadataModelRow(field.id);
    } else {
      addMetadataModelRow({
        id: field.id,
        assetType: '*',
        fieldName: field.displayName,
        fieldType: field.category,
        source: field.source.type,
        required: field.coreForUseCases?.length > 0,
        enrichmentMethod: 'manual',
        initialAmount: 0,
      });
    }
  };

  // Add all recommended core fields
  const addAllCore = () => {
    if (!recommendedFields.core) return;
    for (const field of recommendedFields.core) {
      if (!isFieldSelected(field.id)) {
        addMetadataModelRow({
          id: field.id,
          assetType: '*',
          fieldName: field.displayName,
          fieldType: field.category,
          source: field.source.type,
          required: true,
          enrichmentMethod: 'manual',
          initialAmount: 0,
        });
      }
    }
  };

  // Render field card
  const renderFieldCard = (field, isCore = false) => {
    const selected = isFieldSelected(field.id);
    const signals = field.contributesToSignals || [];
    const signalNames = signals.map(s => {
      const def = SIGNAL_DEFINITIONS.find(sd => sd.id === s.signal);
      return def?.displayName || s.signal;
    });

    return (
      <div
        key={field.id}
        className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
          selected
            ? 'bg-emerald-50 border-emerald-500'
            : 'bg-white border-slate-200 hover:border-slate-300'
        }`}
        onClick={() => toggleField(field)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className={`font-medium ${selected ? 'text-emerald-900' : 'text-slate-900'}`}>
                {field.displayName}
              </h4>
              {isCore && (
                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                  Core
                </span>
              )}
            </div>
            <p className={`text-sm mt-1 ${selected ? 'text-emerald-700' : 'text-slate-500'}`}>
              {field.description}
            </p>
            
            {/* Signals */}
            {signalNames.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {signalNames.map(name => (
                  <span
                    key={name}
                    className={`text-xs px-2 py-0.5 rounded ${
                      selected ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {name}
                  </span>
                ))}
              </div>
            )}
            
            {/* MDLH Column */}
            {field.mdlhColumn && (
              <div className={`text-xs mt-2 font-mono ${selected ? 'text-emerald-600' : 'text-slate-400'}`}>
                MDLH: {field.mdlhColumn}
              </div>
            )}
          </div>
          
          <div className={`p-1.5 rounded-full ${
            selected ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
          }`}>
            {selected ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </div>
        </div>
      </div>
    );
  };

  // Group by category
  const categories = [...new Set(UNIFIED_FIELD_CATALOG.map(f => f.category))];

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">
          Configure Your Metadata Model
        </h2>
        <p className="text-sm text-slate-500">
          Based on your selected use cases, we recommend the following metadata fields.
          Select the fields you want to include in your model.
        </p>
      </div>

      {/* Recommended core fields */}
      {recommendedFields.core && recommendedFields.core.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-700 uppercase tracking-wide">
              Core Fields ({recommendedFields.core.length})
            </h3>
            <button
              onClick={addAllCore}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Add All Core
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recommendedFields.core.map(field => renderFieldCard(field, true))}
          </div>
        </div>
      )}

      {/* Optional fields */}
      {recommendedFields.optional && recommendedFields.optional.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-slate-700 uppercase tracking-wide">
            Optional Fields ({recommendedFields.optional.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recommendedFields.optional.slice(0, 8).map(field => renderFieldCard(field, false))}
          </div>
        </div>
      )}

      {/* All fields by category (collapsed) */}
      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-slate-700 hover:text-slate-900">
          Browse All Fields by Category →
        </summary>
        <div className="mt-4 space-y-6">
          {categories.map(category => {
            const categoryFields = UNIFIED_FIELD_CATALOG.filter(f => f.category === category && f.status === 'active');
            if (categoryFields.length === 0) return null;
            
            return (
              <div key={category} className="space-y-3">
                <h4 className="text-sm font-medium text-slate-600 capitalize">
                  {category} ({categoryFields.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {categoryFields.map(field => renderFieldCard(field, false))}
                </div>
              </div>
            );
          })}
        </div>
      </details>

      {/* Summary */}
      <div className="p-4 bg-slate-100 rounded-lg">
        <h3 className="text-sm font-medium text-slate-700 mb-2">
          Selected Fields ({draftMetadataModel.length})
        </h3>
        {draftMetadataModel.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {draftMetadataModel.map(row => (
              <span
                key={row.id}
                className="inline-flex items-center gap-1 px-3 py-1 bg-white text-slate-700 rounded-full text-sm border border-slate-200"
              >
                {row.fieldName}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeMetadataModelRow(row.id);
                  }}
                  className="p-0.5 hover:bg-slate-200 rounded-full"
                >
                  <Minus className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            No fields selected. Add at least a few core fields to build your model.
          </p>
        )}
      </div>

      {/* Info */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">About MDLH Integration</p>
          <p>
            Fields marked with "MDLH: column_name" map directly to MDLH Snowflake columns.
            The evaluation will assess coverage based on these mappings.
          </p>
        </div>
      </div>
    </div>
  );
}

export default WizardStep3Fields;
