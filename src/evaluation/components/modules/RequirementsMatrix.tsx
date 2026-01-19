/**
 * RequirementsMatrix - Grid view of metadata requirements by asset type
 *
 * Features:
 * - Asset types as columns, fields as rows
 * - Editable requirement levels
 * - Domain overrides
 * - Export to CSV/Markdown
 */

import { useState, useMemo } from 'react';
import {
  Download,
  ChevronDown,
  Check,
  AlertCircle,
  Info,
  Grid,
  Search,
  FileSpreadsheet,
  Clock,
  History,
  Calendar,
  User,
  Edit2,
  PlayCircle,
  ArrowLeft,
  ChevronRight,
  Share2,
  MoreHorizontal,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  X,
  Database,
  Globe
} from 'lucide-react';
import {
  METADATA_FIELDS,
  createDefaultMatrix,
} from '../../types/model-designer';
import type {
  RequirementsMatrix as RequirementsMatrixType,
  AssetType,
  RequirementType,
  MetadataFieldType,
  ConnectorOverride,
} from '../../types/model-designer';
import type { FieldCoverageResult } from '../../hooks/useFieldCoverage';
import { PatternWizard, type PatternWizardResult } from './PatternWizard';
import { useModelStore } from '../../stores/modelStore';

const ASSET_TYPES: AssetType[] = [
  'Table',
  'Column',
  'View',
  'Dashboard',
  'Report',
  'Database',
  'Schema',
  'Pipeline',
];

const CONNECTORS = [
  'Snowflake',
  'dbt',
  'Tableau',
  'PowerBI',
  'Databricks',
  'Redshift',
  'BigQuery',
  'Postgres',
];

const REQUIREMENT_COLORS: Record<RequirementType, { bg: string; text: string; label: string }> = {
  required: { bg: 'bg-red-100', text: 'text-red-700', label: 'Required' },
  recommended: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Recommended' },
  optional: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Optional' },
  'not-applicable': { bg: 'bg-slate-50', text: 'text-slate-400', label: 'N/A' },
};

const EMPTY_ARRAY: any[] = [];

interface RequirementsMatrixProps {
  initialMatrix?: RequirementsMatrixType;
  fieldCoverage?: FieldCoverageResult[];
  onSave?: (matrix: RequirementsMatrixType) => void;
}

interface SampleData {
  id: string;
  assetType: AssetType;
  values: Record<string, string>;
}

export function RequirementsMatrix({ initialMatrix, fieldCoverage, onSave }: RequirementsMatrixProps) {
  const [matrix, setMatrix] = useState<RequirementsMatrixType>(
    initialMatrix || createDefaultMatrix()
  );
  const [viewMode, setViewMode] = useState<'matrix' | 'preview'>('matrix');
  const [selectedAssetTypes, setSelectedAssetTypes] = useState<AssetType[]>(ASSET_TYPES.slice(0, 5));
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  const [editingCell, setEditingCell] = useState<{ field: string; assetType: AssetType } | null>(null);
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [requirementFilter, setRequirementFilter] = useState<RequirementType | 'all'>('all');

  // Context State
  const [viewContext, setViewContext] = useState<'global' | 'domain' | 'connector'>('global');
  const [activeContextId, setActiveContextId] = useState<string>('');

  const customMetadata = useModelStore(state => state.model.customMetadata || EMPTY_ARRAY);
  
  const allFields = useMemo(() => {
    const customFields = customMetadata.flatMap(cm => 
      cm.attributes.map(attr => ({
        id: attr.id,
        displayName: attr.displayName,
        description: attr.description || '',
        purpose: 'Custom Metadata',
        whenNeeded: cm.isRequired ? 'Required' : 'Optional',
        weight: 5,
        effort: 'medium' as const,
        effortMinutes: 4,
        autoPopulated: false,
        bulkAssignable: true,
      }))
    );
    return [...METADATA_FIELDS, ...customFields];
  }, [customMetadata]);

  const updatePlanDetails = (updates: Partial<RequirementsMatrixType>) => {
    setMatrix(prev => ({ ...prev, ...updates }));
  };

  const handleWizardComplete = (result: PatternWizardResult) => {
    // Merge wizard results into matrix
    const newMatrix = { ...matrix };
    
    // Apply field requirements to all selected asset types
    // In a real app, we might want to let the user choose which asset types to apply to
    // For now, we'll apply to all currently selected asset types in the matrix
    
    result.fieldRequirements.forEach((requirement, fieldId) => {
      selectedAssetTypes.forEach(assetType => {
        let assetReqs = newMatrix.assetTypeRequirements.find(r => r.assetType === assetType);
        if (!assetReqs) {
          assetReqs = { assetType, requirements: [] };
          newMatrix.assetTypeRequirements.push(assetReqs);
        }
        
        const existingReq = assetReqs.requirements.find(r => r.field === fieldId);
        if (existingReq) {
          existingReq.requirement = requirement;
        } else {
          assetReqs.requirements.push({ field: fieldId, requirement });
        }
      });
    });

    setMatrix(newMatrix);
    setShowWizard(false);
    
    // Auto-save if callback provided
    if (onSave) {
      onSave(newMatrix);
    }
  };
  
  // Sample data state
  const [sampleData, setSampleData] = useState<SampleData[]>(() => {
    // Initialize with one sample row per selected asset type
    return ASSET_TYPES.slice(0, 5).map((type, i) => ({
      id: `sample-${i}`,
      assetType: type,
      values: {
        name: `Sample ${type} ${i + 1}`,
        description: `Description for ${type}...`,
      }
    }));
  });

  // Get coverage for a specific field
  const getCoverage = (fieldId: string): FieldCoverageResult | undefined => {
    return fieldCoverage?.find(c => c.field === fieldId);
  };

  // Get coverage percentage for a field/asset type combination
  const getCoverageForAssetType = (fieldId: string, assetType: AssetType): number | null => {
    const coverage = getCoverage(fieldId);
    if (!coverage) return null;
    const assetCoverage = coverage.byAssetType[assetType];
    if (!assetCoverage || assetCoverage.total === 0) return null;
    return Math.round((assetCoverage.populated / assetCoverage.total) * 100);
  };

  // Get requirement for a field/asset type combination
  const getRequirement = (field: MetadataFieldType | string, assetType: AssetType): RequirementType => {
    // Check for connector overrides first if in connector view
    if (viewContext === 'connector' && activeContextId) {
      const connectorOverride = matrix.connectorOverrides?.find(c => c.connectorName === activeContextId);
      const override = connectorOverride?.overrides.find(o => o.assetType === assetType && o.field === field);
      if (override) {
        return override.requirement;
      }
    }

    // Fallback to global requirements
    const assetReqs = matrix.assetTypeRequirements.find(r => r.assetType === assetType);
    if (!assetReqs) return 'optional';
    const fieldReq = assetReqs.requirements.find(r => r.field === field);
    return fieldReq?.requirement || 'optional';
  };

  // Filtered fields
  const filteredFields = useMemo(() => {
    return allFields.filter(field => {
      const matchesText = field.displayName.toLowerCase().includes(filterText.toLowerCase()) || 
                         field.description?.toLowerCase().includes(filterText.toLowerCase());
      
      if (!matchesText) return false;
      if (requirementFilter === 'all') return true;
      
      // Check if any selected asset type has this requirement level
      return selectedAssetTypes.some(type => getRequirement(field.id, type) === requirementFilter);
    });
  }, [filterText, requirementFilter, selectedAssetTypes, matrix, allFields, viewContext, activeContextId]);

  // Calculate total effort
  const totalEffortMinutes = useMemo(() => {
    let total = 0;
    allFields.forEach(field => {
      selectedAssetTypes.forEach(assetType => {
        const req = getRequirement(field.id, assetType);
        if (req === 'required') {
          total += field.effortMinutes || 0;
        } else if (req === 'recommended') {
          total += (field.effortMinutes || 0) * 0.5; // Assume 50% effort for recommended
        }
      });
    });
    return Math.round(total);
  }, [matrix, selectedAssetTypes, allFields, viewContext, activeContextId]);

  // Get help text for a cell
  const getHelpText = (field: MetadataFieldType | string, assetType: AssetType): string | undefined => {
    const assetReqs = matrix.assetTypeRequirements.find(r => r.assetType === assetType);
    if (!assetReqs) return undefined;
    const fieldReq = assetReqs.requirements.find(r => r.field === field);
    return fieldReq?.helpText;
  };

  // Update requirement for a cell
  const updateRequirement = (
    field: MetadataFieldType | string,
    assetType: AssetType,
    requirement: RequirementType
  ) => {
    const newMatrix = { ...matrix };

    if (viewContext === 'connector' && activeContextId) {
      // Handle Connector Override
      if (!newMatrix.connectorOverrides) {
        newMatrix.connectorOverrides = [];
      }

      let connectorOverride = newMatrix.connectorOverrides.find(c => c.connectorName === activeContextId);
      if (!connectorOverride) {
        connectorOverride = { connectorName: activeContextId, overrides: [] };
        newMatrix.connectorOverrides.push(connectorOverride);
      }

      const existingOverride = connectorOverride.overrides.find(o => o.assetType === assetType && o.field === field);
      if (existingOverride) {
        existingOverride.requirement = requirement;
      } else {
        connectorOverride.overrides.push({
          assetType,
          field: typeof field === 'string' ? field : field.id,
          requirement,
          reason: 'Manual override'
        });
      }
    } else {
      // Handle Global Requirement
      let assetReqs = newMatrix.assetTypeRequirements.find(r => r.assetType === assetType);

      if (!assetReqs) {
        assetReqs = { assetType, requirements: [] };
        newMatrix.assetTypeRequirements.push(assetReqs);
      }

      const existingReq = assetReqs.requirements.find(r => r.field === field);
      if (existingReq) {
        existingReq.requirement = requirement;
      } else {
        assetReqs.requirements.push({ field, requirement });
      }
    }

    setMatrix(newMatrix);
    setEditingCell(null);
  };

  // Toggle asset type visibility
  const toggleAssetType = (assetType: AssetType) => {
    if (selectedAssetTypes.includes(assetType)) {
      setSelectedAssetTypes(selectedAssetTypes.filter(t => t !== assetType));
    } else {
      setSelectedAssetTypes([...selectedAssetTypes, assetType]);
    }
  };

  const bulkSetRequirement = (requirement: RequirementType) => {
    const newMatrix = { ...matrix };
    
    filteredFields.forEach(field => {
      selectedAssetTypes.forEach(assetType => {
        let assetReqs = newMatrix.assetTypeRequirements.find(r => r.assetType === assetType);
        if (!assetReqs) {
          assetReqs = { assetType, requirements: [] };
          newMatrix.assetTypeRequirements.push(assetReqs);
        }
        
        const existingReq = assetReqs.requirements.find(r => r.field === field.id);
        if (existingReq) {
          existingReq.requirement = requirement;
        } else {
          assetReqs.requirements.push({ field: field.id, requirement });
        }
      });
    });

    setMatrix(newMatrix);
    if (onSave) onSave(newMatrix);
  };

  const resetMatrix = () => {
    if (window.confirm('Are you sure you want to reset the matrix to default? All custom changes will be lost.')) {
      const defaultMatrix = createDefaultMatrix();
      setMatrix(defaultMatrix);
      if (onSave) onSave(defaultMatrix);
    }
  };

  // Export functions
  const exportToCSV = () => {
    const headers = ['Field', ...selectedAssetTypes].join(',');
    const rows = allFields.map(field => {
      const values = selectedAssetTypes.map(assetType => getRequirement(field.id, assetType));
      return [field.displayName, ...values].join(',');
    });
    const csv = [headers, ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'requirements-matrix.csv';
    a.click();
  };

  const exportToMarkdown = () => {
    const headers = ['Field', ...selectedAssetTypes];
    const headerRow = `| ${headers.join(' | ')} |`;
    const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;

    const dataRows = allFields.map(field => {
      const values = selectedAssetTypes.map(assetType => {
        const req = getRequirement(field.id, assetType);
        return req === 'required' ? 'Required' :
               req === 'recommended' ? 'Recommended' :
               req === 'not-applicable' ? 'N/A' : 'Optional';
      });
      return `| ${[field.displayName, ...values].join(' | ')} |`;
    });

    const markdown = [headerRow, separatorRow, ...dataRows].join('\n');

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'requirements-matrix.md';
    a.click();
  };

  const exportDataTemplate = () => {
    // Create headers: Asset Type, then all fields
    const headers = ['Asset Type', ...allFields.map(f => {
      // Mark required fields with *
      return f.displayName;
    })];

    // Create sample rows based on requirements
    const rows = selectedAssetTypes.map(assetType => {
      const rowValues = allFields.map(field => {
        const req = getRequirement(field.id, assetType);
        return req === 'required' ? '[REQUIRED]' : '';
      });
      return [assetType, ...rowValues].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'metadata-template.csv';
    a.click();
  };

  // Count stats
  const stats = useMemo(() => {
    let required = 0;
    let recommended = 0;

    selectedAssetTypes.forEach(assetType => {
      allFields.forEach(field => {
        const req = getRequirement(field.id, assetType);
        if (req === 'required') required++;
        else if (req === 'recommended') recommended++;
      });
    });

    return { required, recommended };
  }, [matrix, selectedAssetTypes, allFields, viewContext, activeContextId]);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Breadcrumbs & Global Actions */}
      <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('navigate-to-plans'))}
            className="flex items-center gap-1 text-slate-500 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft size={14} />
            Plans
          </button>
          <ChevronRight size={14} className="text-slate-300" />
          <span className="font-medium text-slate-900 truncate max-w-[200px]">{matrix.name}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded-md shadow-sm">
            <ShieldCheck size={14} className="text-emerald-500" />
            Governance Plan
          </div>
          <button 
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(matrix, null, 2));
              alert('Matrix configuration copied to clipboard!');
            }}
            className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
            title="Copy Matrix JSON"
          >
            <Share2 size={16} />
          </button>
          <div className="relative">
            <button 
              onClick={() => setShowBulkMenu(!showBulkMenu)}
              className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <MoreHorizontal size={16} />
            </button>
            {showBulkMenu && (
              <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20">
                <button
                  onClick={() => { resetMatrix(); setShowBulkMenu(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <History size={14} />
                  Reset Matrix
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="px-6 py-6 border-b border-slate-200 bg-white">
        <div className="flex items-start justify-between gap-8">
          <div className="flex-1">
            {isEditingHeader ? (
              <div className="space-y-3 max-w-2xl bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Plan Name</label>
                    <input
                      type="text"
                      value={matrix.name}
                      onChange={(e) => updatePlanDetails({ name: e.target.value })}
                      className="text-lg font-bold text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none w-full"
                      placeholder="Plan Name"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Description</label>
                    <textarea
                      value={matrix.description}
                      onChange={(e) => updatePlanDetails({ description: e.target.value })}
                      className="text-sm text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none w-full h-20 resize-none"
                      placeholder="Plan Description"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Owner</label>
                    <div className="relative">
                      <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={matrix.owner || ''}
                        onChange={(e) => updatePlanDetails({ owner: e.target.value })}
                        className="text-sm text-slate-600 bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none w-full"
                        placeholder="Owner"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Target Date</label>
                    <div className="relative">
                      <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="date"
                        value={matrix.targetDate || ''}
                        onChange={(e) => updatePlanDetails({ targetDate: e.target.value })}
                        className="text-sm text-slate-600 bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none w-full"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <div className="flex gap-2">
                    {(['draft', 'in-review', 'approved'] as const).map(status => (
                      <button
                        key={status}
                        onClick={() => updatePlanDetails({ status })}
                        className={`px-3 py-1 rounded-md text-xs font-bold capitalize border transition-all ${
                          matrix.status === status 
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {status === 'in-review' ? 'In Review' : status}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setIsEditingHeader(false)}
                    className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-all"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            ) : (
              <div className="group relative">
                <div className="flex items-center gap-4">
                  <h2 className="text-2xl font-bold text-slate-900">{matrix.name}</h2>
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                    matrix.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    matrix.status === 'in-review' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    'bg-slate-50 text-slate-600 border-slate-200'
                  }`}>
                    {matrix.status === 'approved' ? <CheckCircle2 size={14} /> : 
                     matrix.status === 'in-review' ? <Clock size={14} /> : <FileSpreadsheet size={14} />}
                    {matrix.status === 'approved' ? 'Approved' :
                     matrix.status === 'in-review' ? 'In Review' : 'Draft'}
                  </div>
                  <button
                    onClick={() => setIsEditingHeader(true)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-all"
                    title="Edit Plan Details"
                  >
                    <Edit2 size={16} />
                  </button>
                </div>
                <p className="text-slate-500 mt-1 max-w-3xl">{matrix.description}</p>
                
                <div className="flex items-center gap-8 mt-6">
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Owner</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600">
                          {(matrix.owner || 'U')[0].toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-slate-700">{matrix.owner || 'Unassigned'}</span>
                      </div>
                    </div>
                    <div className="w-px h-8 bg-slate-100" />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Target Date</span>
                      <div className="flex items-center gap-2 mt-0.5 text-sm font-medium text-slate-700">
                        <Calendar size={14} className="text-slate-400" />
                        <span>{matrix.targetDate ? new Date(matrix.targetDate).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : 'Not set'}</span>
                      </div>
                    </div>
                    <div className="w-px h-8 bg-slate-100" />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Est. Effort</span>
                      <div className="flex items-center gap-2 mt-0.5 text-sm font-medium text-blue-600">
                        <Clock size={14} />
                        <span>{Math.round(totalEffortMinutes / 60)}h {totalEffortMinutes % 60}m <span className="text-slate-400 font-normal">/ asset</span></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-4">
            <div className="flex items-center gap-2">
              {/* Pattern Wizard Button */}
              <button
                onClick={() => setShowWizard(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-sm hover:shadow-md"
              >
                <Sparkles size={18} />
                Use Pattern Wizard
              </button>

              {/* View Toggle */}
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
                <button
                  onClick={() => setViewMode('matrix')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    viewMode === 'matrix'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Grid size={18} />
                  Matrix
                </button>
                <button
                  onClick={() => setViewMode('preview')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    viewMode === 'preview'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <PlayCircle size={18} />
                  Sandbox
                </button>
              </div>

              <div className="relative">
                <button
                  onClick={() => setShowBulkMenu(!showBulkMenu)}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition-all active:scale-95"
                >
                  <MoreHorizontal size={18} className="text-slate-500" />
                  Bulk Actions
                  <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${showBulkMenu ? 'rotate-180' : ''}`} />
                </button>
                {showBulkMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                    <div className="px-3 py-1.5 mb-1 border-b border-slate-50">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Apply to Filtered</span>
                    </div>
                    <button
                      onClick={() => { bulkSetRequirement('required'); setShowBulkMenu(false); }}
                      className="w-full px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                    >
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm shadow-red-200" />
                      Mark as Required
                    </button>
                    <button
                      onClick={() => { bulkSetRequirement('recommended'); setShowBulkMenu(false); }}
                      className="w-full px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                    >
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-200" />
                      Mark as Recommended
                    </button>
                    <button
                      onClick={() => { bulkSetRequirement('optional'); setShowBulkMenu(false); }}
                      className="w-full px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                    >
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-300 shadow-sm shadow-slate-200" />
                      Mark as Optional
                    </button>
                    <div className="h-px bg-slate-100 my-1.5" />
                    <button
                      onClick={() => { resetMatrix(); setShowBulkMenu(false); }}
                      className="w-full px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
                    >
                      <History size={16} />
                      Reset to Default
                    </button>
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition-all active:scale-95"
                >
                  <Download size={18} className="text-slate-500" />
                  Export
                  <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${showExportMenu ? 'rotate-180' : ''}`} />
                </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                  <div className="px-3 py-1.5 mb-1 border-b border-slate-50">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Download Options</span>
                  </div>
                  <button
                    onClick={() => { exportToCSV(); setShowExportMenu(false); }}
                    className="w-full px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                  >
                    <FileSpreadsheet size={16} className="text-slate-400" />
                    Matrix as CSV
                  </button>
                  <button
                    onClick={() => { exportToMarkdown(); setShowExportMenu(false); }}
                    className="w-full px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                  >
                    <FileText size={16} className="text-slate-400" />
                    Matrix as Markdown
                  </button>
                  <div className="h-px bg-slate-100 my-1.5" />
                  <button
                    onClick={() => { exportDataTemplate(); setShowExportMenu(false); }}
                    className="w-full px-3 py-2.5 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-3 transition-colors"
                  >
                    <Sparkles size={16} className="text-blue-500" />
                    Enrichment Template
                  </button>
                </div>
              )}
            </div>
          </div>
          {onSave && (
            <button
              onClick={() => onSave(matrix)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              <Check size={16} />
              Save
            </button>
          )}
        </div>
      </div>

      {/* Context Selector */}
      <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-6">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">View Context</span>
          <div className="flex bg-slate-200/50 rounded-xl p-1 shadow-inner">
            <button
              onClick={() => { setViewContext('global'); setActiveContextId(''); }}
              className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                viewContext === 'global'
                  ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
              }`}
            >
              <Globe size={14} />
              Global Rules
            </button>
            <button
              onClick={() => { setViewContext('connector'); setActiveContextId(CONNECTORS[0]); }}
              className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                viewContext === 'connector'
                  ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
              }`}
            >
              <Database size={14} />
              Source Overrides
            </button>
          </div>
        </div>

        {viewContext === 'connector' && (
          <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-4 duration-200">
            <div className="w-px h-6 bg-slate-200" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Source</span>
            <div className="relative group">
              <select
                value={activeContextId}
                onChange={(e) => setActiveContextId(e.target.value)}
                className="appearance-none pl-3 pr-10 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm cursor-pointer hover:border-slate-300 transition-all min-w-[160px]"
              >
                {CONNECTORS.map(connector => (
                  <option key={connector} value={connector}>{connector}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-slate-600 transition-colors" />
            </div>
            
            <div className="flex items-center gap-2 text-[11px] text-amber-600 bg-amber-50/50 px-3 py-1.5 rounded-lg border border-amber-100/50">
              <Info size={14} className="text-amber-500" />
              <span>Overrides apply only to <strong>{activeContextId}</strong>. Unset fields inherit global rules.</span>
            </div>
          </div>
        )}
      </div>

        {/* Stats & Filters */}
        {viewMode === 'matrix' && (
          <div className="flex flex-col gap-4 mt-6 bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Required Fields</span>
                  <span className="text-lg font-bold text-red-600">{stats.required}</span>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Recommended</span>
                  <span className="text-lg font-bold text-amber-600">{stats.recommended}</span>
                </div>
                {fieldCoverage && fieldCoverage.length > 0 && (
                  <>
                    <div className="w-px h-8 bg-slate-200" />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Import Coverage</span>
                      <span className="text-lg font-bold text-emerald-600">
                        {Math.round(fieldCoverage.reduce((acc, c) => acc + c.percentage, 0) / fieldCoverage.length)}%
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search fields by name or description..."
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    className="pl-10 pr-10 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none w-72 shadow-sm transition-all"
                  />
                  {filterText && (
                    <button 
                      onClick={() => setFilterText('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <select
                  value={requirementFilter}
                  onChange={(e) => setRequirementFilter(e.target.value as any)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-medium text-slate-700 shadow-sm"
                >
                  <option value="all">All Requirements</option>
                  <option value="required">Required Only</option>
                  <option value="recommended">Recommended Only</option>
                  <option value="optional">Optional Only</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Asset Types:</span>
              <div className="flex items-center gap-2 flex-wrap">
                {ASSET_TYPES.map(assetType => (
                  <button
                    key={assetType}
                    onClick={() => toggleAssetType(assetType)}
                    className={`px-3 py-1 text-xs font-bold rounded-full transition-all border ${
                      selectedAssetTypes.includes(assetType)
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {assetType}
                  </button>
                ))}
              </div>
              <div className="ml-auto">
                <span className="text-xs text-slate-400 italic">
                  Showing {filteredFields.length} of {allFields.length} fields
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Matrix Grid */}
      <div className="flex-1 overflow-auto">
        {viewMode === 'matrix' ? (
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-slate-50 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200 bg-slate-50 sticky left-0">
                  Field
                </th>
                {selectedAssetTypes.map(assetType => (
                  <th
                    key={assetType}
                    className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200 min-w-[100px]"
                  >
                    {assetType}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredFields.map((field, index) => (
                <tr
                  key={field.id}
                  className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
                >
                  <td className="px-4 py-3 border-b border-slate-100 sticky left-0 bg-inherit">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-slate-900">
                        {field.displayName}
                      </span>
                      {field.autoPopulated && (
                        <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 text-[10px] rounded">
                          Auto
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 max-w-[200px] truncate">
                      {field.purpose}
                    </div>
                  </td>
                  {selectedAssetTypes.map(assetType => {
                    const requirement = getRequirement(field.id, assetType);
                    const helpText = getHelpText(field.id, assetType);
                    const colors = REQUIREMENT_COLORS[requirement];
                    const isEditing = editingCell?.field === field.id && editingCell?.assetType === assetType;
                    const coveragePct = getCoverageForAssetType(field.id, assetType);

                    return (
                      <td
                        key={assetType}
                        className="px-2 py-2 border-b border-slate-100 text-center relative"
                      >
                        {isEditing ? (
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white shadow-2xl border border-slate-200 rounded-xl p-1.5 z-50 flex flex-col gap-1 min-w-[140px]">
                            <div className="px-2 py-1 mb-1 border-b border-slate-100">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Set Requirement</span>
                            </div>
                            {(['required', 'recommended', 'optional', 'not-applicable'] as RequirementType[]).map(req => (
                              <button
                                key={req}
                                onClick={() => updateRequirement(field.id, assetType, req)}
                                className={`px-3 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-between group ${REQUIREMENT_COLORS[req].bg} ${REQUIREMENT_COLORS[req].text} hover:brightness-95 active:scale-95`}
                              >
                                <span>{REQUIREMENT_COLORS[req].label}</span>
                                {requirement === req && <CheckCircle2 size={12} className="opacity-60" />}
                              </button>
                            ))}
                            <div className="h-px bg-slate-100 my-1" />
                            <button
                              onClick={() => setEditingCell(null)}
                              className="px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded-lg transition-colors flex items-center justify-center"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <button
                              onClick={() => setEditingCell({ field: field.id, assetType })}
                              className={`group inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${colors.bg} ${colors.text} border-transparent hover:border-current hover:shadow-sm active:scale-95`}
                              title={helpText}
                            >
                              {requirement === 'required' && <AlertCircle size={12} className="animate-pulse" />}
                              {requirement === 'not-applicable' ? 'N/A' : colors.label}
                              <ChevronDown size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                            {coveragePct !== null && (
                              <span
                                className={`text-[10px] font-medium ${
                                  coveragePct >= 80
                                    ? 'text-emerald-600'
                                    : coveragePct >= 50
                                    ? 'text-amber-600'
                                    : 'text-red-500'
                                }`}
                                title={`${coveragePct}% of ${assetType}s have this field populated`}
                              >
                                {coveragePct}%
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
              <Info className="text-blue-600 mt-0.5" size={18} />
              <div>
                <h3 className="text-sm font-medium text-blue-900">Enrichment Sandbox</h3>
                <p className="text-sm text-blue-700 mt-1">
                  Share this view with business users to validate requirements. They can enter sample data to test if the requirements are realistic.
                  Fields marked with <span className="text-red-600 font-bold">*</span> are required based on your matrix configuration.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full border-collapse min-w-max">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200 sticky left-0 bg-slate-50 z-10">
                      Asset Type
                    </th>
                    {allFields.map(field => (
                      <th
                        key={field.id}
                        className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200 min-w-[150px]"
                      >
                        {field.displayName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sampleData
                    .filter(row => selectedAssetTypes.includes(row.assetType))
                    .map((row) => (
                    <tr key={row.id} className="bg-white hover:bg-slate-50">
                      <td className="px-4 py-2 border-b border-slate-100 sticky left-0 bg-inherit font-medium text-sm text-slate-900">
                        {row.assetType}
                      </td>
                      {allFields.map(field => {
                        const req = getRequirement(field.id, row.assetType);
                        const isRequired = req === 'required';
                        const isNA = req === 'not-applicable';
                        
                        return (
                          <td key={field.id} className={`px-2 py-2 border-b border-slate-100 ${isNA ? 'bg-slate-50' : ''}`}>
                            {isNA ? (
                              <span className="text-xs text-slate-400 italic px-2">N/A</span>
                            ) : (
                              <input
                                type="text"
                                value={row.values[field.id] || ''}
                                onChange={(e) => {
                                  const newSampleData = sampleData.map(r => {
                                    if (r.id === row.id) {
                                      return {
                                        ...r,
                                        values: { ...r.values, [field.id]: e.target.value }
                                      };
                                    }
                                    return r;
                                  });
                                  setSampleData(newSampleData);
                                }}
                                placeholder={isRequired ? 'Required...' : ''}
                                className={`w-full px-2 py-1.5 text-sm border rounded transition-colors ${
                                  isRequired && !row.values[field.id]
                                    ? 'border-red-200 bg-red-50 focus:border-red-400 focus:ring-red-200'
                                    : 'border-slate-200 focus:border-blue-400 focus:ring-blue-200'
                                }`}
                              />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <button
              onClick={() => {
                const newRow: SampleData = {
                  id: `sample-${Date.now()}`,
                  assetType: selectedAssetTypes[0] || 'Table',
                  values: {}
                };
                setSampleData([...sampleData, newRow]);
              }}
              className="mt-4 flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              + Add Sample Row
            </button>
          </div>
        )}
      </div>

      {/* Legend */}
      {viewMode === 'matrix' && (
        <div className="px-6 py-3 border-t border-slate-200 flex items-center gap-4">
          <span className="text-xs text-slate-500">Legend:</span>
          {Object.entries(REQUIREMENT_COLORS).map(([key, colors]) => (
            <div key={key} className="flex items-center gap-1">
              <span className={`px-2 py-0.5 text-xs rounded ${colors.bg} ${colors.text}`}>
                {colors.label}
              </span>
            </div>
          ))}
        </div>
      )}
      {/* Pattern Wizard Modal */}
      {showWizard && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Pattern Wizard</h3>
              <button 
                onClick={() => setShowWizard(false)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-500"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <PatternWizard 
                onComplete={handleWizardComplete}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
