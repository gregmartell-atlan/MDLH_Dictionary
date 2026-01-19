/**
 * Wizard Step 3: Metadata Model
 * 
 * Review and customize the recommended metadata model rows.
 */

import { useAssistantStore } from '../../stores/assistantStore';
import { useState } from 'react';
import { Database, Table, Columns, BookOpen, TrendingUp, GitBranch, Check, X, Edit2 } from 'lucide-react';
import { PATTERN_TEMPLATES, type PatternTemplate } from '../../types/patterns';
import { FieldSelector, type FieldSelectorResult } from '../modules/FieldSelector';
import { 
  generateAssetFieldMatrix, 
  getCriticalFieldsForAsset, 
  generateAssetEnrichmentSummary,
  type AssetType 
} from '../../data/custom-fields-asset-targeting';
import { 
  generateReadinessAssessment
} from '../../data/custom-fields-enrichment-readiness';
import { 
  getDefaultPropagationRegistry
} from '../../data/custom-fields-propagation-rules';
import { useAtlanAudit } from '../../hooks/useAtlanAudit';

export function WizardStep3MetadataModel() {
  const { wizardState, togglePattern, updatePattern } = useAssistantStore();
  const { draftMetadataModel, selectedPatterns } = wizardState;
  const { audit, fieldCoverage, usingSampleData, dataSource } = useAtlanAudit();
  
  const [selectedAssetType, setSelectedAssetType] = useState<AssetType>('Table');
  const [showReadinessPanel, setShowReadinessPanel] = useState(false);
  const [showPropagationPanel, setShowPropagationPanel] = useState(false);
  const [editingPattern, setEditingPattern] = useState<PatternTemplate | null>(null);

  const handlePatternUpdate = (result: FieldSelectorResult) => {
    if (!editingPattern) return;
    
    // Create a new pattern object with updated requirements
    const updatedPattern = { ...editingPattern };
    
    // Update existing fields based on overrides
    updatedPattern.fields = updatedPattern.fields.map(f => ({
        ...f,
        requirement: result.fieldRequirements.get(f.field) || f.requirement
    }));
    
    updatePattern(updatedPattern);
    setEditingPattern(null);
  };

  const totalAssets = draftMetadataModel.reduce((sum, row) => sum + row.initialAmount, 0);
  const automatedRows = draftMetadataModel.filter((row) => row.automationPossible).length;

  // Generate custom field recommendations for selected asset type
  const assetFieldMatrix = generateAssetFieldMatrix(selectedAssetType);
  const criticalFields = getCriticalFieldsForAsset(selectedAssetType);
  const enrichmentSummary = generateAssetEnrichmentSummary(selectedAssetType);
  
  // Generate readiness assessment
  const readinessAssessment = generateReadinessAssessment(
    {
      name: 'Your Organization',
      currentMaturity: 'intermediate' as const,
      teamSize: 50,
      governanceMaturity: 'intermediate' as const,
    },
    usingSampleData
      ? undefined
      : {
          fieldCoverage,
          assetBreakdown: audit?.assetBreakdown,
          overallCompletenessScore: audit?.summary?.overallCompletenessScore,
        }
  );
  
  // Get propagation rules
  const propagationRegistry = getDefaultPropagationRegistry();
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assetTypeIcons: Record<AssetType, any> = {
    Database: Database,
    Schema: Database,
    Table: Table,
    Column: Columns,
    README: BookOpen,
    Asset: Database,
    Process: GitBranch,
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Review Metadata Model</h2>
        <p className="text-slate-600">
          Based on your selected user stories and connectors, here's your recommended metadata model.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-slate-900">{draftMetadataModel.length}</div>
          <div className="text-sm text-slate-600">Model Rows</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-slate-900">{totalAssets}</div>
          <div className="text-sm text-slate-600">Total Assets</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-emerald-600">{automatedRows}</div>
          <div className="text-sm text-slate-600">Automated Rows</div>
        </div>
      </div>

      {/* Pattern Selection */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900">Recommended Patterns</h3>
        <p className="text-sm text-slate-600">Select the patterns that align with your goals to refine the metadata model.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PATTERN_TEMPLATES.map((pattern) => {
            const isSelected = selectedPatterns.some(p => p.id === pattern.id);
            // Use the stored pattern if selected, otherwise the template
            const displayPattern = isSelected ? selectedPatterns.find(p => p.id === pattern.id)! : pattern;
            
            return (
              <div 
                key={pattern.id} 
                className={`border rounded-lg p-4 transition-colors relative group ${
                  isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'
                }`} 
              >
                <div 
                    className="cursor-pointer"
                    onClick={() => togglePattern(pattern)}
                >
                    <div className="flex justify-between items-start">
                    <div>
                        <h4 className="font-medium text-slate-900">{displayPattern.name}</h4>
                        <p className="text-sm text-slate-600 mt-1">{displayPattern.description}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ml-2 ${
                        isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                    }`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                    {displayPattern.outcomes.slice(0, 2).map((outcome, i) => (
                        <span key={i} className="text-xs bg-white border border-slate-200 px-2 py-1 rounded text-slate-600">
                        {outcome}
                        </span>
                    ))}
                    </div>
                </div>
                
                {isSelected && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setEditingPattern(displayPattern);
                        }}
                        className="absolute top-2 right-10 p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                        title="Customize Pattern"
                    >
                        <Edit2 className="w-4 h-4" />
                    </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Pattern Modal */}
      {editingPattern && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-slate-200">
                    <h3 className="text-lg font-semibold text-slate-900">Customize {editingPattern.name}</h3>
                    <button 
                        onClick={() => setEditingPattern(null)}
                        className="p-2 hover:bg-slate-100 rounded-full text-slate-500"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                    <FieldSelector 
                        initialPattern={editingPattern}
                        initialStep="fields"
                        onComplete={handlePatternUpdate}
                    />
                </div>
            </div>
        </div>
      )}

      {/* Readiness Assessment Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-slate-900">Enrichment Readiness: {readinessAssessment.overallReadinessLevel}</h3>
            </div>
            <p className="text-sm text-slate-700 mb-2">
              Overall score: <span className="font-bold text-blue-700">{readinessAssessment.overallReadinessScore}/100</span> 
              {' '}— {readinessAssessment.overallReadinessScore >= 60 ? 'Ready to proceed' : 'Foundational work needed'}
            </p>
            {!usingSampleData && (
              <p className="text-xs text-slate-500 mb-2">
                Live coverage source: {dataSource === 'mdlh' ? 'MDLH (Snowflake)' : 'Atlan API'}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {readinessAssessment.criticalGaps.slice(0, 3).map((gap, idx) => (
                <span key={idx} className="px-2 py-1 text-xs bg-amber-100 text-amber-800 rounded">
                  {gap}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={() => setShowReadinessPanel(!showReadinessPanel)}
            className="px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 rounded transition-colors"
          >
            {showReadinessPanel ? 'Hide Details' : 'View Details'}
          </button>
        </div>
        
        {showReadinessPanel && (
          <div className="mt-4 pt-4 border-t border-blue-200 space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Readiness Dimensions</h4>
              <div className="grid grid-cols-2 gap-2">
                {readinessAssessment.organizationalReadiness.map((dimension) => (
                  <div key={dimension.dimension} className="bg-white rounded p-2 border border-slate-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-700">{dimension.dimension}</span>
                      <span className={`text-xs font-bold ${
                        dimension.readinessScore >= 60 ? 'text-emerald-600' : 
                        dimension.readinessScore >= 40 ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {dimension.readinessScore}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5">
                      <div 
                        className={`h-1.5 rounded-full ${
                          dimension.readinessScore >= 60 ? 'bg-emerald-500' : 
                          dimension.readinessScore >= 40 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${dimension.readinessScore}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Prerequisites ({readinessAssessment.prerequisites.prerequisites.length})</h4>
              <ul className="text-xs text-slate-700 space-y-1">
                {readinessAssessment.prerequisites.prerequisites.slice(0, 5).map((prereq) => (
                  <li key={prereq.name} className="flex items-start gap-2">
                    <span className={prereq.status === 'complete' ? 'text-emerald-500' : 'text-amber-500'}>
                      {prereq.status === 'complete' ? '✓' : '○'}
                    </span>
                    <span>{prereq.name} ({prereq.estimatedWeeks}w)</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Asset Type Selector */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <h3 className="font-semibold text-slate-900 mb-3">Custom Field Recommendations by Asset Type</h3>
        <div className="flex gap-2 mb-4">
          {(['Database', 'Table', 'Column', 'README'] as AssetType[]).map((assetType) => {
            const Icon = assetTypeIcons[assetType];
            return (
              <button
                key={assetType}
                onClick={() => setSelectedAssetType(assetType)}
                className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors ${
                  selectedAssetType === assetType
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {assetType}
              </button>
            );
          })}
        </div>

        {/* Field Recommendations */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-900">
              {criticalFields.length} Critical Fields for {selectedAssetType}
            </h4>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                Automated ({assetFieldMatrix.fields.filter(f => f.enrichmentStrategy.automationLevel === 'fully-automated').length})
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                Semi-auto ({assetFieldMatrix.fields.filter(f => f.enrichmentStrategy.automationLevel === 'semi-automated').length})
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-slate-400" />
                Manual ({assetFieldMatrix.fields.filter(f => f.enrichmentStrategy.automationLevel === 'manual').length})
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
            {criticalFields.map((field) => (
              <div 
                key={field.fieldId} 
                className="bg-slate-50 border border-slate-200 rounded p-3"
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="text-sm font-medium text-slate-900">{field.fieldId.replace('_', ' ')}</span>
                  <span className={`px-1.5 py-0.5 text-xs rounded ${
                    field.enrichmentStrategy.automationLevel === 'fully-automated' ? 'bg-emerald-100 text-emerald-700' :
                    field.enrichmentStrategy.automationLevel === 'semi-automated' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-200 text-slate-700'
                  }`}>
                    {field.enrichmentStrategy.automationLevel === 'fully-automated' ? 'Auto' : 
                     field.enrichmentStrategy.automationLevel === 'semi-automated' ? 'Semi' : 'Manual'}
                  </span>
                </div>
                {field.isInheritable && (
                  <div className="flex items-center gap-1 text-xs text-blue-600">
                    <GitBranch className="w-3 h-3" />
                    {field.inheritancePattern}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Enrichment Summary */}
        <div className="mt-4 pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-900">Implementation Roadmap</h4>
            <span className="text-xs text-slate-600">
              3 phases • {enrichmentSummary.totalFields} fields
            </span>
          </div>
          <div className="space-y-2">
            {enrichmentSummary.enrichmentRoadmap.map((roadmapPhase, idx) => (
              <div key={idx} className="bg-gradient-to-r from-slate-50 to-slate-100 rounded p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-900">{roadmapPhase.phase}</span>
                  <span className="text-xs text-slate-600">{roadmapPhase.estimatedEffort}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {roadmapPhase.fieldsToEnrich.slice(0, 5).map((field) => (
                    <span key={field.fieldId} className="px-1.5 py-0.5 text-xs bg-white border border-slate-200 rounded">
                      {field.fieldId}
                    </span>
                  ))}
                  {roadmapPhase.fieldsToEnrich.length > 5 && (
                    <span className="px-1.5 py-0.5 text-xs text-slate-500">
                      +{roadmapPhase.fieldsToEnrich.length - 5} more
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Propagation Rules Panel */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold text-slate-900">Metadata Propagation Rules</h3>
          </div>
          <button
            onClick={() => setShowPropagationPanel(!showPropagationPanel)}
            className="px-3 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-100 rounded transition-colors"
          >
            {showPropagationPanel ? 'Hide Rules' : 'View Rules'}
          </button>
        </div>
        
        <p className="text-sm text-slate-600 mb-3">
          {propagationRegistry.getAllRulesOrderedByPriority().length} active rules governing metadata inheritance across 4 levels (Database → Schema → Table → Column)
        </p>
        
        {showPropagationPanel && (
          <div className="space-y-3">
            {/* Hierarchy visualization */}
            <div>
              <h4 className="text-xs font-semibold text-slate-700 mb-2">Asset Hierarchy</h4>
              <div className="flex items-center gap-2 text-xs">
                {(['Database', 'Schema', 'Table', 'Column'] as const).map((asset: string, idx: number) => (
                  <div key={asset} className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-slate-100 rounded font-medium">{asset}</span>
                    {idx < 3 && (
                      <span className="text-slate-400">→</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Sample propagation rules */}
            <div>
              <h4 className="text-xs font-semibold text-slate-700 mb-2">Active Rules (Top 5 by Priority)</h4>
              <div className="space-y-2">
                {propagationRegistry.getAllRulesOrderedByPriority().slice(0, 5).map((rule) => (
                  <div key={rule.ruleId} className="bg-slate-50 rounded p-2 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-slate-900">
                        {rule.sourceAsset} → {rule.targetAsset}
                      </span>
                      <span className="text-slate-500">Priority: {rule.priority}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                        {rule.fieldId}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded ${
                        rule.propagationType === 'copy' ? 'bg-emerald-100 text-emerald-700' :
                        rule.propagationType === 'aggregate' ? 'bg-purple-100 text-purple-700' :
                        rule.propagationType === 'filter' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-200 text-slate-700'
                      }`}>
                        {rule.propagationType}
                      </span>
                      <span className="text-slate-600">
                        {rule.conflictResolution}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Model Rows Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-700">Source</th>
                <th className="px-4 py-3 text-left font-medium text-slate-700">Asset Type</th>
                <th className="px-4 py-3 text-left font-medium text-slate-700">Metadata Elements</th>
                <th className="px-4 py-3 text-left font-medium text-slate-700">Scope</th>
                <th className="px-4 py-3 text-left font-medium text-slate-700">Assets</th>
                <th className="px-4 py-3 text-left font-medium text-slate-700">Automation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {draftMetadataModel.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-900">{row.sourceSystem}</td>
                  <td className="px-4 py-3 text-slate-900">{row.assetType}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {row.metadataElements.slice(0, 3).map((elem) => (
                        <span
                          key={elem}
                          className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded"
                        >
                          {elem}
                        </span>
                      ))}
                      {row.metadataElements.length > 3 && (
                        <span className="px-2 py-0.5 text-xs text-slate-500">
                          +{row.metadataElements.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.manageableAmount}</td>
                  <td className="px-4 py-3 text-slate-900 font-medium">{row.initialAmount}</td>
                  <td className="px-4 py-3">
                    {row.automationPossible ? (
                      <span className="px-2 py-1 text-xs font-medium bg-emerald-100 text-emerald-700 rounded">
                        Auto
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded">
                        Manual
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
