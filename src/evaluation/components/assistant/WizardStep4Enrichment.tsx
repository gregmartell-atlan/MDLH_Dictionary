/**
 * Wizard Step 4: Enrichment Techniques
 * 
 * Review recommended enrichment techniques for each metadata element.
 */

import { useAssistantStore } from '../../stores/assistantStore';
import { CUSTOM_METADATA_TEMPLATES, createCustomMetadataFromTemplate, type CustomMetadataTemplate, type CustomMetadataDesign } from '../../types/custom-metadata';
import { CustomMetadataDesigner } from '../modules/CustomMetadataDesigner';
import { Check, X, Edit2 } from 'lucide-react';
import { useState } from 'react';

export function WizardStep4Enrichment() {
  const { wizardState, toggleCustomMetadata, updateCustomMetadata } = useAssistantStore();
  const { draftMetadataModel, selectedCustomMetadata } = wizardState;
  const [editingDesign, setEditingDesign] = useState<CustomMetadataDesign | null>(null);

  const handleToggleTemplate = (template: CustomMetadataTemplate) => {
    const existing = selectedCustomMetadata.find(cm => cm.id === template.id);
    if (existing) {
        toggleCustomMetadata(existing);
    } else {
        const newDesign = createCustomMetadataFromTemplate(template, template.id);
        toggleCustomMetadata(newDesign);
    }
  };

  const handleDesignUpdate = (schemas: CustomMetadataDesign[]) => {
    if (schemas.length > 0) {
        updateCustomMetadata(schemas[0]);
    }
    setEditingDesign(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Enrichment Techniques</h2>
        <p className="text-slate-600">
          For each metadata element in your model, here are the recommended enrichment techniques based on proven customer implementations.
        </p>
      </div>

      {/* Custom Metadata Selection */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900">Custom Metadata Templates</h3>
        <p className="text-sm text-slate-600">Select standard metadata sets to enrich your assets.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CUSTOM_METADATA_TEMPLATES.map((template) => {
                const isSelected = selectedCustomMetadata.some(cm => cm.id === template.id);
                // Use stored design if selected, otherwise template
                const displayDesign = isSelected ? selectedCustomMetadata.find(cm => cm.id === template.id)! : template.schema;
                const attributeCount = displayDesign.attributes?.length || 0;

                return (
                    <div 
                        key={template.id} 
                        className={`border rounded-lg p-4 transition-colors relative group ${isSelected ? 'border-purple-500 bg-purple-50' : 'border-slate-200 hover:border-purple-300'}`}
                    >
                        <div 
                            className="cursor-pointer"
                            onClick={() => handleToggleTemplate(template)}
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="font-medium text-slate-900">{template.name}</h4>
                                    <p className="text-sm text-slate-600 mt-1">{template.description}</p>
                                </div>
                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ml-2 ${isSelected ? 'bg-purple-600 border-purple-600' : 'border-slate-300'}`}>
                                    {isSelected && <Check className="w-3 h-3 text-white" />}
                                </div>
                            </div>
                            <div className="mt-3">
                                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Attributes:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {displayDesign.attributes?.slice(0, 3).map(attr => (
                                        <span key={attr.id} className="text-xs bg-white border border-slate-200 px-2 py-1 rounded text-slate-600">{attr.displayName}</span>
                                    ))}
                                    {attributeCount > 3 && (
                                        <span className="text-xs text-slate-500 px-1 py-1">+{ attributeCount - 3 } more</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {isSelected && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingDesign(selectedCustomMetadata.find(cm => cm.id === template.id)!);
                                }}
                                className="absolute top-2 right-10 p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-100 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                                title="Customize Metadata"
                            >
                                <Edit2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
      </div>

      {/* Edit Custom Metadata Modal */}
      {editingDesign && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-slate-200">
                    <h3 className="text-lg font-semibold text-slate-900">Customize {editingDesign.displayName}</h3>
                    <button 
                        onClick={() => setEditingDesign(null)}
                        className="p-2 hover:bg-slate-100 rounded-full text-slate-500"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex-1 overflow-hidden">
                    <CustomMetadataDesigner 
                        initialSchemas={[editingDesign]}
                        onSave={handleDesignUpdate}
                    />
                </div>
            </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Enrichment Summary</h3>
        <div className="space-y-4">
          {/* Group by metadata element */}
          {Array.from(new Set(draftMetadataModel.flatMap((r) => r.metadataElements))).map((element) => {
            const relevantRows = draftMetadataModel.filter((r) =>
              r.metadataElements.includes(element)
            );
            const totalAssets = relevantRows.reduce((sum, r) => sum + r.initialAmount, 0);
            const automatedCount = relevantRows.filter((r) => r.automationPossible).length;

            return (
              <div key={element} className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-slate-900">{element}</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">{totalAssets} assets</span>
                    {automatedCount > 0 && (
                      <span className="px-2 py-1 text-xs font-medium bg-emerald-100 text-emerald-700 rounded">
                        {automatedCount} automated
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-sm text-slate-600 space-y-1">
                  {relevantRows.map((row) => (
                    <div key={row.id} className="flex items-center justify-between">
                      <span>
                        {row.sourceSystem} {row.assetType}
                      </span>
                      <span className="text-xs text-slate-500">{row.curationProcess}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
        <p className="text-sm text-emerald-900">
          <strong>Next:</strong> We'll generate an implementation roadmap based on these techniques.
        </p>
      </div>
    </div>
  );
}
