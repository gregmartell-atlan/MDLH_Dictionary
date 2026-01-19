import React from 'react';
import {
  Database,
  Table,
  FileText,
  Users,
  Tag,
  BookOpen,
  Award,
  ChevronRight,
  Filter,
  X,
  Layers,
  GitBranch,
  Settings,
  AlertTriangle,
  CheckCircle,
  BarChart3,
} from 'lucide-react';
import { useImportAnalysis } from '../../hooks/useImportAnalysis';
import { useScopeFilter } from '../../hooks/useScopeFilter';

interface ImportDashboardProps {
  onNavigate: (view: string) => void;
}

// Asset type icon mapping
const getAssetIcon = (type: string) => {
  const iconMap: Record<string, React.ReactNode> = {
    Table: <Table className="w-4 h-4" />,
    View: <FileText className="w-4 h-4" />,
    Column: <GitBranch className="w-4 h-4" />,
    Database: <Database className="w-4 h-4" />,
    Schema: <Layers className="w-4 h-4" />,
  };
  return iconMap[type] || <FileText className="w-4 h-4" />;
};

// Coverage status color
const getCoverageColor = (percentage: number) => {
  if (percentage >= 80) return 'bg-emerald-500';
  if (percentage >= 50) return 'bg-amber-500';
  return 'bg-red-500';
};

const getCoverageTextColor = (percentage: number) => {
  if (percentage >= 80) return 'text-emerald-400';
  if (percentage >= 50) return 'text-amber-400';
  return 'text-red-400';
};

export const ImportDashboard: React.FC<ImportDashboardProps> = ({ onNavigate }) => {
  const analysis = useImportAnalysis();
  const { filter, options, setConnector, setDatabase, setSchema, clearAll, isFiltered } = useScopeFilter();

  // Calculate overall health score
  const healthScore = analysis.metadataCoverage.length > 0
    ? Math.round(
        analysis.metadataCoverage.reduce((sum, item) => sum + item.percentage, 0) /
        analysis.metadataCoverage.length
      )
    : 0;

  return (
    <div className="h-full overflow-auto bg-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">Import Overview</h1>
            {analysis.importedAt && (
              <p className="text-sm text-slate-400 mt-1">
                {analysis.connector && `${analysis.connector} • `}
                Imported {new Date(analysis.importedAt).toLocaleDateString()} at{' '}
                {new Date(analysis.importedAt).toLocaleTimeString()}
              </p>
            )}
          </div>

          {/* Scope Filter Dropdown */}
          <div className="flex items-center gap-2">
            {isFiltered && (
              <button
                onClick={clearAll}
                className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-white rounded bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                <X className="w-3 h-3" />
                Clear Filter
              </button>
            )}
            <div className="flex items-center gap-1 text-sm">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={filter.connector || ''}
                onChange={(e) => setConnector(e.target.value || null)}
                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                <option value="">All Connectors</option>
                {options.connectors.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {filter.connector && (
                <select
                  value={filter.database || ''}
                  onChange={(e) => setDatabase(e.target.value || null)}
                  className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="">All Databases</option>
                  {options.databases.map((d) => (
                    <option key={d.name} value={d.name}>{d.name}</option>
                  ))}
                </select>
              )}
              {filter.database && (
                <select
                  value={filter.schema || ''}
                  onChange={(e) => setSchema(e.target.value || null)}
                  className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="">All Schemas</option>
                  {options.schemas.map((s) => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/20">
                <Database className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{analysis.totalAssets}</p>
                <p className="text-sm text-slate-400">Total Assets</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/20">
                <Layers className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{analysis.assetBreakdown.length}</p>
                <p className="text-sm text-slate-400">Asset Types</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Tag className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{analysis.existingTags.length}</p>
                <p className="text-sm text-slate-400">Tags Found</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${healthScore >= 50 ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                {healthScore >= 50 ? (
                  <CheckCircle className={`w-5 h-5 ${healthScore >= 50 ? 'text-emerald-400' : 'text-red-400'}`} />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                )}
              </div>
              <div>
                <p className={`text-2xl font-bold ${getCoverageTextColor(healthScore)}`}>{healthScore}%</p>
                <p className="text-sm text-slate-400">Health Score</p>
              </div>
            </div>
          </div>
        </div>

        {/* Asset Breakdown */}
        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
          <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-4">
            Asset Breakdown
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {analysis.assetBreakdown.map((item) => (
              <div
                key={item.type}
                className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-slate-400">{getAssetIcon(item.type)}</span>
                  <span className="text-xs text-slate-400 truncate">{item.type}</span>
                </div>
                <p className="text-xl font-semibold text-white">{item.count}</p>
                <p className="text-xs text-slate-500">{item.percentage}%</p>
              </div>
            ))}
          </div>
        </div>

        {/* Metadata Coverage */}
        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider">
              Metadata Coverage
            </h2>
            <button
              onClick={() => onNavigate('requirements')}
              className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              <BarChart3 className="w-3 h-3" />
              View Full Matrix
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-3">
            {analysis.metadataCoverage.map((item) => (
              <div key={item.field} className="group">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {item.field === 'ownerUsers' && <Users className="w-4 h-4 text-slate-400" />}
                    {item.field === 'description' && <FileText className="w-4 h-4 text-slate-400" />}
                    {item.field === 'atlanTags' && <Tag className="w-4 h-4 text-slate-400" />}
                    {item.field === 'glossaryTerms' && <BookOpen className="w-4 h-4 text-slate-400" />}
                    {item.field === 'certificateStatus' && <Award className="w-4 h-4 text-slate-400" />}
                    {item.field === 'userDescription' && <FileText className="w-4 h-4 text-slate-400" />}
                    {item.field === 'readme' && <FileText className="w-4 h-4 text-slate-400" />}
                    <span className="text-sm text-slate-300">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${getCoverageTextColor(item.percentage)}`}>
                      {item.percentage}%
                    </span>
                    <span className="text-xs text-slate-500">
                      ({item.count} / {item.total})
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getCoverageColor(item.percentage)} transition-all duration-500`}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pre-populate Suggestions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Domain Suggestions */}
          <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700 hover:border-cyan-500/50 transition-colors group">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-cyan-500/20">
                <Layers className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-white font-medium">Domain Structure</h3>
                <p className="text-xs text-slate-400">
                  {analysis.hierarchySuggestions.databases.length} databases,{' '}
                  {analysis.hierarchySuggestions.schemas.length} schemas
                </p>
              </div>
            </div>
            <div className="space-y-2 mb-4">
              {analysis.hierarchySuggestions.databases.slice(0, 3).map((db) => (
                <div key={db.name} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300 truncate">{db.name}</span>
                  <span className="text-slate-500">{db.assetCount} assets</span>
                </div>
              ))}
              {analysis.hierarchySuggestions.databases.length > 3 && (
                <p className="text-xs text-slate-500">
                  +{analysis.hierarchySuggestions.databases.length - 3} more
                </p>
              )}
            </div>
            <button
              onClick={() => onNavigate('domains')}
              className="w-full py-2 px-3 rounded-lg bg-cyan-500/10 text-cyan-400 text-sm font-medium hover:bg-cyan-500/20 transition-colors flex items-center justify-center gap-2 group-hover:bg-cyan-500/20"
            >
              Create Domains
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Taxonomy Suggestions */}
          <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700 hover:border-violet-500/50 transition-colors group">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-violet-500/20">
                <Tag className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h3 className="text-white font-medium">Taxonomy</h3>
                <p className="text-xs text-slate-400">
                  {analysis.existingTags.length} tags discovered
                </p>
              </div>
            </div>
            <div className="space-y-2 mb-4">
              {analysis.existingTags.slice(0, 3).map((tag) => (
                <div key={tag.name} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300 truncate">{tag.name}</span>
                  <span className="text-slate-500">{tag.count} uses</span>
                </div>
              ))}
              {analysis.existingTags.length > 3 && (
                <p className="text-xs text-slate-500">
                  +{analysis.existingTags.length - 3} more
                </p>
              )}
              {analysis.existingTags.length === 0 && (
                <p className="text-sm text-slate-500 italic">No tags found in import</p>
              )}
            </div>
            <button
              onClick={() => onNavigate('taxonomy')}
              className="w-full py-2 px-3 rounded-lg bg-violet-500/10 text-violet-400 text-sm font-medium hover:bg-violet-500/20 transition-colors flex items-center justify-center gap-2 group-hover:bg-violet-500/20"
            >
              Build Taxonomy
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Custom Metadata Suggestions */}
          <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700 hover:border-amber-500/50 transition-colors group">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Settings className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-white font-medium">Custom Metadata</h3>
                <p className="text-xs text-slate-400">
                  {analysis.existingBusinessAttributes.length} schemas detected
                </p>
              </div>
            </div>
            <div className="space-y-2 mb-4">
              {analysis.existingBusinessAttributes.slice(0, 3).map((schema) => (
                <div key={schema.setName} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300 truncate">{schema.setName}</span>
                  <span className="text-slate-500">{schema.attributes.length} attrs</span>
                </div>
              ))}
              {analysis.existingBusinessAttributes.length > 3 && (
                <p className="text-xs text-slate-500">
                  +{analysis.existingBusinessAttributes.length - 3} more
                </p>
              )}
              {analysis.existingBusinessAttributes.length === 0 && (
                <p className="text-sm text-slate-500 italic">No business attributes found</p>
              )}
            </div>
            <button
              onClick={() => onNavigate('custom-metadata')}
              className="w-full py-2 px-3 rounded-lg bg-amber-500/10 text-amber-400 text-sm font-medium hover:bg-amber-500/20 transition-colors flex items-center justify-center gap-2 group-hover:bg-amber-500/20"
            >
              Design Metadata
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Gaps Identified */}
        {(analysis.gaps.missingOwners.length > 0 || analysis.gaps.missingDescriptions.length > 0) && (
          <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
            <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-4">
              Gaps Identified
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-red-300">Missing Owners</span>
                </div>
                <p className="text-xl font-semibold text-red-400">
                  {analysis.gaps.missingOwners.length}
                </p>
              </div>
              <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-red-300">No Description</span>
                </div>
                <p className="text-xl font-semibold text-red-400">
                  {analysis.gaps.missingDescriptions.length}
                </p>
              </div>
              <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <Tag className="w-4 h-4 text-amber-400" />
                  <span className="text-sm text-amber-300">Untagged</span>
                </div>
                <p className="text-xl font-semibold text-amber-400">
                  {analysis.gaps.missingTags.length}
                </p>
              </div>
              <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen className="w-4 h-4 text-amber-400" />
                  <span className="text-sm text-amber-300">No Terms</span>
                </div>
                <p className="text-xl font-semibold text-amber-400">
                  {analysis.gaps.missingTerms.length}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportDashboard;
