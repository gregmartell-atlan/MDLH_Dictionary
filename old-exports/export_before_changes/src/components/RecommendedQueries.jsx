import React, { useMemo } from 'react';
import { 
  X, Database, Snowflake, Code2, Play, Copy, Check,
  ArrowUpRight, ArrowDownRight, Tag, BookOpen, BarChart3,
  Layers, Shield, Clock, Zap, FileText, Sparkles, AlertCircle
} from 'lucide-react';
import { buildDynamicRecommendations, getAvailableQueryCategories } from '../utils/dynamicQueryBuilder';

// Icon mapping for query categories
const categoryIcons = {
  structure: Database,
  lineage: Layers,
  governance: Shield,
  usage: BarChart3,
  quality: FileText,
  glossary: BookOpen,
  default: Code2
};

// Query card component - queries are already built with real values
function QueryChip({ query, onRun, onCopy }) {
  const [copied, setCopied] = React.useState(false);
  const Icon = categoryIcons[query.category] || categoryIcons.default;
  
  // SQL is already filled with real values from dynamic builder
  const sql = query.sql;
  
  // Check if this query uses real sample data (no more placeholders)
  const usesRealData = useMemo(() => {
    return !sql.includes('<YOUR_GUID_HERE>') && 
           !sql.includes("'<") &&
           !sql.includes('<TABLE>');
  }, [sql]);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopy?.(query);
  };
  
  const handleRun = () => {
    onRun?.(sql, query);
  };
  
  return (
    <div className="group flex items-center justify-between p-2.5 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Icon size={14} className="text-gray-400 flex-shrink-0" />
        <span className="text-sm font-medium text-gray-700 truncate" title={query.label}>
          {query.label}
        </span>
        {usesRealData && (
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-medium rounded" title="Uses real data from your database">
            <Sparkles size={10} />
            Ready
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleCopy}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          title="Copy SQL"
        >
          {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
        </button>
        <button
          onClick={handleRun}
          className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
          title="Run in Editor"
        >
          <Play size={14} />
        </button>
      </div>
    </div>
  );
}

// Main component
export default function RecommendedQueries({ 
  entity,
  entityContext,
  isOpen, 
  onClose,
  onRunQuery,
  database,
  schema,
  availableTables = [], // Discovered tables from schema scan
  sampleEntities = null, // Sample GUIDs/entities from discovered tables
}) {
  // Build context from entity and props
  const ctx = useMemo(() => ({
    database: database || entityContext?.database,
    schema: schema || entityContext?.schema,
    table: entity?.table || entityContext?.table,
    column: entityContext?.column,
    guid: entity?.guid || entityContext?.guid,
    qualifiedName: entityContext?.qualifiedName,
    entityType: entity?.entityType || entityContext?.entityType || 'TABLE',
    daysBack: 30
  }), [entity, entityContext, database, schema]);
  
  // Get dynamic recommendations based on ACTUAL discovered tables
  // No hardcoded table names - everything comes from the scan
  const recommendations = useMemo(() => {
    if (!availableTables || availableTables.length === 0) {
      return [];
    }
    
    return buildDynamicRecommendations({
      database: ctx.database,
      schema: ctx.schema,
      discoveredTables: new Set(availableTables),
      samples: sampleEntities || {},
      context: ctx
    });
  }, [ctx, availableTables, sampleEntities]);
  
  // Get info about what query categories are available
  const availableCategories = useMemo(() => {
    if (!availableTables || availableTables.length === 0) {
      return null;
    }
    return getAvailableQueryCategories(new Set(availableTables));
  }, [availableTables]);
  
  // Check if we have sample data for real GUIDs
  const hasSamples = sampleEntities && (
    sampleEntities.tables?.length > 0 || 
    sampleEntities.columns?.length > 0 ||
    sampleEntities.processes?.length > 0
  );
  
  // Split into MDLH and Snowflake queries
  const { mdlhQueries, snowflakeQueries } = useMemo(() => {
    const mdlh = [];
    const sf = [];
    
    // Dynamic recommendations are query objects directly (not wrapped in {query, priority})
    recommendations.forEach((item) => {
      const query = item.query || item; // Handle both formats
      if (query.layer === 'mdlh') {
        mdlh.push(query);
      } else if (query.layer === 'snowflake') {
        sf.push(query);
      }
    });
    
    return { mdlhQueries: mdlh, snowflakeQueries: sf };
  }, [recommendations]);
  
  const handleRunQuery = (sql, query) => {
    onRunQuery?.(sql, query);
    // Optionally close after running
    // onClose?.();
  };
  
  if (!isOpen) return null;
  
  const entityName = entity?.entity || entity?.name || ctx.table || 'Entity';
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[85vh] overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-[#3366FF] to-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Zap size={18} />
                Recommended Queries
              </h2>
              <p className="text-blue-100 text-sm mt-0.5">
                for <span className="font-mono font-medium">{entityName}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          
          {/* Context badges */}
          <div className="flex flex-wrap gap-2 mt-3">
            {ctx.database && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-white/20 rounded text-xs text-white font-mono">
                <Database size={12} />
                {ctx.database}
              </span>
            )}
            {ctx.schema && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-white/20 rounded text-xs text-white font-mono">
                {ctx.schema}
              </span>
            )}
            {ctx.table && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-white/20 rounded text-xs text-white font-mono">
                {ctx.table}
              </span>
            )}
            {ctx.entityType && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600/50 rounded text-xs text-white">
                {ctx.entityType}
              </span>
            )}
          </div>
        </div>
        
        {/* Content - Two columns */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* MDLH Column */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-purple-100 rounded-lg">
                  <Database size={16} className="text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Atlan Metadata</h3>
                  <p className="text-xs text-gray-500">MDLH catalog queries</p>
                </div>
              </div>
              
              <div className="space-y-2">
                {mdlhQueries.length > 0 ? (
                  mdlhQueries.map((query, i) => (
                    <QueryChip 
                      key={query.id || i} 
                      query={query} 
                      onRun={handleRunQuery}
                    />
                  ))
                ) : (
                  <p className="text-sm text-gray-400 italic py-4 text-center">
                    No MDLH queries available for discovered tables
                  </p>
                )}
              </div>
            </div>
            
            {/* Snowflake Column */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-blue-100 rounded-lg">
                  <Snowflake size={16} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Snowflake Platform</h3>
                  <p className="text-xs text-gray-500">Live system queries</p>
                </div>
              </div>
              
              <div className="space-y-2">
                {snowflakeQueries.length > 0 ? (
                  snowflakeQueries.map((query, i) => (
                    <QueryChip 
                      key={query.id || i} 
                      query={query} 
                      onRun={handleRunQuery}
                    />
                  ))
                ) : (
                  <p className="text-sm text-gray-400 italic py-4 text-center">
                    No Snowflake queries available
                  </p>
                )}
              </div>
            </div>
          </div>
          
          {/* Dynamic Query Info Banner */}
          {availableCategories && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <Database size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-800">Queries Built From Your Schema</p>
                  <p className="text-xs text-blue-600 mt-0.5">
                    Found {availableCategories.tableCount} table entities
                    {availableCategories.processCount > 0 && `, ${availableCategories.processCount} process entities`}
                    {availableCategories.glossaryCount > 0 && `, ${availableCategories.glossaryCount} glossary tables`}
                    . All queries use your actual table names.
                  </p>
                  {hasSamples && (
                    <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                      <Sparkles size={10} />
                      Queries marked "Ready" have real GUIDs - run immediately!
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* No tables warning */}
          {(!availableTables || availableTables.length === 0) && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">No Tables Discovered</p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    Connect to Snowflake and select a database/schema to discover available tables.
                    Queries will be generated based on what exists in your schema.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          {(mdlhQueries.length > 0 || snowflakeQueries.length > 0) && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <Zap size={16} className="text-amber-500" />
                <h3 className="font-semibold text-gray-900">Quick Actions</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {availableCategories?.lineage && (
                  <>
                    <button
                      onClick={() => {
                        const lineageQuery = mdlhQueries.find(q => q.id?.includes('upstream'));
                        if (lineageQuery) handleRunQuery(lineageQuery.sql, lineageQuery);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors"
                    >
                      <Layers size={14} />
                      Upstream Lineage
                    </button>
                    <button
                      onClick={() => {
                        const lineageQuery = mdlhQueries.find(q => q.id?.includes('downstream'));
                        if (lineageQuery) handleRunQuery(lineageQuery.sql, lineageQuery);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors"
                    >
                      <Layers size={14} />
                      Downstream Lineage
                    </button>
                  </>
                )}
                {availableCategories?.governance && (
                  <button
                    onClick={() => {
                      const tagQuery = mdlhQueries.find(q => q.id?.includes('tagged'));
                      if (tagQuery) handleRunQuery(tagQuery.sql, tagQuery);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                  >
                    <Tag size={14} />
                    Tagged Assets
                  </button>
                )}
                {mdlhQueries.length > 0 && (
                  <button
                    onClick={() => {
                      const previewQuery = mdlhQueries.find(q => q.id?.includes('preview'));
                      if (previewQuery) handleRunQuery(previewQuery.sql, previewQuery);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                  >
                    <FileText size={14} />
                    Preview Data
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            {recommendations.length} queries available for this context
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

