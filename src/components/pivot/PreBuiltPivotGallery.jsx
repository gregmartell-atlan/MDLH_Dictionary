/**
 * Pre-Built Pivot Gallery
 * 
 * A gallery UI for browsing and selecting pre-built pivot configurations.
 * Shows pivot cards organized by category, with previews and one-click execution.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  LayoutGrid,
  BarChart3,
  Users,
  Building2,
  Link2,
  BookOpen,
  Flame,
  Clock,
  Lock,
  ChevronRight,
  Play,
  Copy,
  Eye,
  Filter,
  Search,
  Database,
  Table2,
  CheckCircle,
  AlertCircle,
  Info,
  TrendingUp,
} from 'lucide-react';
import {
  PREBUILT_PIVOTS,
  PIVOT_DIMENSIONS,
  PIVOT_MEASURES,
  getPivotCategories,
  getPivotsByCategory,
  generatePivotSQL,
  buildCustomPivotSQL,
} from '../../data/prebuiltPivotRegistry';

// =============================================================================
// ICONS & COLORS
// =============================================================================

const CATEGORY_CONFIG = {
  Completeness: { icon: BarChart3, color: 'blue', bgClass: 'bg-blue-50', textClass: 'text-blue-600', borderClass: 'border-blue-200' },
  Quality: { icon: TrendingUp, color: 'purple', bgClass: 'bg-purple-50', textClass: 'text-purple-600', borderClass: 'border-purple-200' },
  Accountability: { icon: Users, color: 'amber', bgClass: 'bg-amber-50', textClass: 'text-amber-600', borderClass: 'border-amber-200' },
  Lineage: { icon: Link2, color: 'cyan', bgClass: 'bg-cyan-50', textClass: 'text-cyan-600', borderClass: 'border-cyan-200' },
  Semantics: { icon: BookOpen, color: 'indigo', bgClass: 'bg-indigo-50', textClass: 'text-indigo-600', borderClass: 'border-indigo-200' },
  Usage: { icon: Flame, color: 'orange', bgClass: 'bg-orange-50', textClass: 'text-orange-600', borderClass: 'border-orange-200' },
  Freshness: { icon: Clock, color: 'emerald', bgClass: 'bg-emerald-50', textClass: 'text-emerald-600', borderClass: 'border-emerald-200' },
  Compliance: { icon: Lock, color: 'red', bgClass: 'bg-red-50', textClass: 'text-red-600', borderClass: 'border-red-200' },
};

const getIconForPivot = (pivot) => {
  const config = CATEGORY_CONFIG[pivot.category];
  return config?.icon || BarChart3;
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/**
 * Category filter tabs
 */
function CategoryTabs({ categories, selectedCategory, onSelect }) {
  return (
    <div className="flex gap-2 flex-wrap">
      <button
        onClick={() => onSelect(null)}
        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
          selectedCategory === null
            ? 'bg-slate-700 text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        }`}
      >
        All
      </button>
      {categories.map(cat => {
        const config = CATEGORY_CONFIG[cat] || {};
        return (
          <button
            key={cat}
            onClick={() => onSelect(cat)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === cat
                ? `${config.bgClass || 'bg-slate-100'} ${config.textClass || 'text-slate-700'} ring-1 ${config.borderClass || 'ring-slate-300'}`
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {cat}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Dimension chip
 */
function DimensionChip({ dimensionId }) {
  const dim = PIVOT_DIMENSIONS[dimensionId];
  if (!dim) return <span className="text-xs text-slate-400">{dimensionId}</span>;
  
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded text-xs font-medium text-slate-600">
      <span>{dim.icon}</span>
      {dim.label}
    </span>
  );
}

/**
 * Measure chip
 */
function MeasureChip({ measureId }) {
  const measure = PIVOT_MEASURES[measureId];
  if (!measure) return <span className="text-xs text-slate-400">{measureId}</span>;
  
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600">
      {measure.label}
    </span>
  );
}

/**
 * Insight indicator
 */
function InsightIndicator({ type }) {
  const config = {
    danger: { icon: AlertCircle, color: 'text-red-500' },
    warning: { icon: AlertCircle, color: 'text-amber-500' },
    success: { icon: CheckCircle, color: 'text-emerald-500' },
    info: { icon: Info, color: 'text-blue-500' },
  };
  
  const { icon: Icon, color } = config[type] || config.info;
  return <Icon size={12} className={color} />;
}

/**
 * Single pivot card
 */
function PivotCard({ pivot, onSelect, onPreview, onCopySQL, tableFqn }) {
  const config = CATEGORY_CONFIG[pivot.category] || {};
  const Icon = config.icon || BarChart3;
  
  return (
    <div 
      className={`bg-white border ${config.borderClass || 'border-slate-200'} rounded-xl p-5 hover:shadow-lg transition-all group cursor-pointer`}
      onClick={() => onSelect(pivot)}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className={`p-2.5 rounded-lg ${config.bgClass || 'bg-slate-100'}`}>
          <Icon size={20} className={config.textClass || 'text-slate-600'} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-800 truncate group-hover:text-slate-900">
            {pivot.name}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
            {pivot.description}
          </p>
        </div>
      </div>
      
      {/* Dimensions */}
      <div className="mb-3">
        <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1.5">
          Row Dimensions
        </div>
        <div className="flex flex-wrap gap-1">
          {pivot.rowDimensions.map(dim => (
            <DimensionChip key={dim} dimensionId={dim} />
          ))}
        </div>
      </div>
      
      {/* Measures */}
      <div className="mb-4">
        <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1.5">
          Measures
        </div>
        <div className="flex flex-wrap gap-1">
          {pivot.measures.slice(0, 4).map(measure => (
            <MeasureChip key={measure} measureId={measure} />
          ))}
          {pivot.measures.length > 4 && (
            <span className="text-xs text-slate-400">+{pivot.measures.length - 4} more</span>
          )}
        </div>
      </div>
      
      {/* Insights preview */}
      {pivot.insights && pivot.insights.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide text-slate-400">Insights:</span>
          <div className="flex gap-1">
            {pivot.insights.map((insight, idx) => (
              <InsightIndicator key={idx} type={insight.type} />
            ))}
          </div>
        </div>
      )}
      
      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(pivot); }}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium ${config.bgClass || 'bg-slate-100'} ${config.textClass || 'text-slate-700'} hover:opacity-90 transition-opacity`}
        >
          <Play size={14} />
          Run Pivot
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onPreview(pivot); }}
          className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          title="Preview SQL"
        >
          <Eye size={16} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onCopySQL(pivot); }}
          className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          title="Copy SQL"
        >
          <Copy size={16} />
        </button>
      </div>
    </div>
  );
}

/**
 * SQL Preview Modal
 */
function SQLPreviewModal({ pivot, tableFqn, onClose }) {
  const sql = useMemo(() => {
    return generatePivotSQL(pivot.id, tableFqn || '{{DATABASE}}.{{SCHEMA}}.ASSETS');
  }, [pivot, tableFqn]);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(sql);
  };
  
  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-800">{pivot.name}</h2>
            <p className="text-sm text-slate-500">SQL Query Preview</p>
          </div>
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-700 flex items-center gap-1.5"
          >
            <Copy size={14} />
            Copy SQL
          </button>
        </div>
        
        {/* SQL */}
        <div className="p-6 overflow-auto max-h-[60vh]">
          <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap font-mono">
            {sql}
          </pre>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 text-xs text-slate-500">
          <strong>Note:</strong> Replace <code className="bg-slate-200 px-1 rounded">{'{{DATABASE}}.{{SCHEMA}}.ASSETS'}</code> with your actual MDLH table reference.
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function PreBuiltPivotGallery({ 
  onSelectPivot, 
  tableFqn,
  className = '',
}) {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [previewPivot, setPreviewPivot] = useState(null);
  
  const categories = useMemo(() => getPivotCategories(), []);
  
  const filteredPivots = useMemo(() => {
    let pivots = selectedCategory 
      ? getPivotsByCategory(selectedCategory)
      : PREBUILT_PIVOTS;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      pivots = pivots.filter(p => 
        p.name.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term)
      );
    }
    
    return pivots;
  }, [selectedCategory, searchTerm]);
  
  const handleSelect = useCallback((pivot) => {
    const sql = generatePivotSQL(pivot.id, tableFqn || '{{DATABASE}}.{{SCHEMA}}.ASSETS');
    onSelectPivot?.({
      ...pivot,
      generatedSQL: sql,
    });
  }, [tableFqn, onSelectPivot]);
  
  const handleCopySQL = useCallback((pivot) => {
    const sql = generatePivotSQL(pivot.id, tableFqn || '{{DATABASE}}.{{SCHEMA}}.ASSETS');
    navigator.clipboard.writeText(sql);
  }, [tableFqn]);
  
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <LayoutGrid size={22} className="text-indigo-500" />
            Pre-Built Pivot Gallery
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {filteredPivots.length} pivot configurations ready to use
          </p>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search pivots..."
            className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-64"
          />
        </div>
      </div>
      
      {/* Category tabs */}
      <CategoryTabs 
        categories={categories}
        selectedCategory={selectedCategory}
        onSelect={setSelectedCategory}
      />
      
      {/* Pivot grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPivots.map(pivot => (
          <PivotCard
            key={pivot.id}
            pivot={pivot}
            tableFqn={tableFqn}
            onSelect={handleSelect}
            onPreview={setPreviewPivot}
            onCopySQL={handleCopySQL}
          />
        ))}
      </div>
      
      {/* Empty state */}
      {filteredPivots.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <BarChart3 size={48} className="mx-auto mb-4 opacity-30" />
          <p>No pivots match your search</p>
        </div>
      )}
      
      {/* SQL Preview Modal */}
      {previewPivot && (
        <SQLPreviewModal
          pivot={previewPivot}
          tableFqn={tableFqn}
          onClose={() => setPreviewPivot(null)}
        />
      )}
    </div>
  );
}

export default PreBuiltPivotGallery;
