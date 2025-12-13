/**
 * QueryLibraryLayout - Layout component for the Query Library mode in the flyout panel
 * 
 * Provides:
 * - Top header: "Query Library – {categoryLabel}" with close button
 * - Secondary context bar: database/schema info + optional filters
 * - Query cards list below
 */

import React, { useRef, useEffect, useMemo } from 'react';
import { 
  X, Code2, Check, Loader2, Snowflake, Play, Eye, FlaskConical, 
  Sparkles, Copy, Database, AlertTriangle, TrendingUp, MessageCircle
} from 'lucide-react';
import { FREQUENCY_STYLES } from '../data/queryTemplates';
import { validateQueryTables, getSuggestedAlternatives } from '../utils/dynamicExampleQueries';

// ============================================================================
// QueryCard Component
// ============================================================================

// Frequency Badge Component
function FrequencyBadge({ frequency, detail }) {
  if (!frequency) return null;
  
  const styles = FREQUENCY_STYLES[frequency] || FREQUENCY_STYLES['Medium'];
  
  return (
    <span 
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${styles.bg} ${styles.text} border ${styles.border}`}
      title={detail ? `Frequency: ${frequency} (${detail})` : `Frequency: ${frequency}`}
    >
      <TrendingUp size={10} />
      {frequency}
    </span>
  );
}

// Warning Banner Component
function WarningBanner({ warning }) {
  if (!warning) return null;
  
  return (
    <div className="flex items-start gap-2 p-3 mb-3 bg-amber-50 border border-amber-200 rounded-lg">
      <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="text-xs text-amber-800">
        <span className="font-medium">⚠️ Warning: </span>
        {warning}
      </div>
    </div>
  );
}

// User Intent Display
function UserIntentDisplay({ userIntent }) {
  if (!userIntent) return null;
  
  return (
    <div className="flex items-start gap-2 mb-3 p-2 bg-blue-50 border border-blue-100 rounded-lg">
      <MessageCircle size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
      <div className="text-xs text-blue-700">
        <span className="font-medium">Users ask: </span>
        <span className="italic">"{userIntent}"</span>
      </div>
    </div>
  );
}

function QueryCard({ 
  title, 
  description, 
  query, 
  defaultExpanded = false, 
  onRunInEditor, 
  validated = null, 
  tableAvailable = null, 
  autoFixed = false,
  validationResult = null,
  onShowMyWork = null,
  onTestQuery = null,
  // New props for user research queries
  userIntent = null,
  frequency = null,
  frequencyDetail = null,
  source = null,
  warning = null,
  confidence = null
}) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const [copied, setCopied] = React.useState(false);
  
  // Determine status for visual feedback
  const isValidated = validated === true || tableAvailable === true || validationResult?.status === 'success';
  const isUnavailable = tableAvailable === false || validationResult?.status === 'error';
  const isEmpty = validationResult?.status === 'empty';
  const isAutoFixed = autoFixed;
  const hasSuggestion = validationResult?.suggested_query;
  const rowCount = validationResult?.row_count;
  const sampleData = validationResult?.sample_data;
  
  const handleCopy = async (e) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(query);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  // Get status label for badges with consistent labels: "Valid" | "Auto-fixed" | "Needs fix"
  const getStatusLabel = () => {
    if (isValidated && !isAutoFixed) return { 
      text: rowCount ? `${rowCount.toLocaleString()} rows` : 'Valid', 
      color: 'bg-green-100 text-green-700',
      tooltip: 'Query validated successfully and will return results.'
    };
    if (isAutoFixed) return { 
      text: 'Auto-fixed', 
      color: 'bg-blue-100 text-blue-700', 
      tooltip: 'We updated this query to point to a discovered MDLH table.'
    };
    if (isEmpty) return { 
      text: 'Empty table', 
      color: 'bg-amber-100 text-amber-700',
      tooltip: 'The table exists but contains no rows.'
    };
    if (isUnavailable) return { 
      text: 'Needs fix', 
      color: 'bg-orange-100 text-orange-700',
      tooltip: 'Table not found in this database/schema. Click "Explain" for alternatives.'
    };
    return null;
  };
  
  const statusLabel = getStatusLabel();
  
  return (
    <div className={`bg-white rounded-xl border overflow-hidden transition-all duration-200 ${
      expanded 
        ? isValidated 
          ? 'border-green-300 shadow-md' 
          : 'border-blue-300 shadow-md'
        : isUnavailable || isEmpty
          ? 'border-orange-200 shadow-sm hover:shadow-md hover:border-orange-300'
          : 'border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300'
    }`}>
      {/* Card Header */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`p-2 rounded-lg flex-shrink-0 ${
            isValidated ? 'bg-green-100' : (isUnavailable || isEmpty) ? 'bg-orange-100' : 'bg-blue-50'
          }`}>
            {isValidated ? (
              <Check size={18} className="text-green-600" />
            ) : (isUnavailable || isEmpty) ? (
              hasSuggestion ? <Sparkles size={18} className="text-orange-500" /> : <X size={18} className="text-orange-500" />
            ) : (
              <Code2 size={18} className="text-blue-600" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-gray-900 text-sm truncate">{title}</h4>
              {/* Frequency Badge */}
              <FrequencyBadge frequency={frequency} detail={frequencyDetail} />
              {statusLabel && (
                <span 
                  className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${statusLabel.color}`}
                  title={statusLabel.tooltip}
                >
                  {statusLabel.text}
                </span>
              )}
              {hasSuggestion && !isValidated && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-medium rounded-full">
                  <Sparkles size={10} /> Alternative
                </span>
              )}
              {/* Confidence indicator */}
              {confidence && confidence !== 'high' && (
                <span 
                  className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${
                    confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                  }`}
                  title={`Confidence level: ${confidence}`}
                >
                  {confidence}
                </span>
              )}
            </div>
            <p className="text-gray-500 text-xs mt-0.5 truncate">{description}</p>
            {/* Source attribution */}
            {source && (
              <p className="text-gray-400 text-[10px] mt-0.5 truncate" title={source}>
                Source: {source}
              </p>
            )}
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          {onShowMyWork && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onShowMyWork(query, validationResult);
              }}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-purple-50 hover:bg-purple-100 text-purple-700 transition-colors"
              title="Learn how this query works"
            >
              <Eye size={12} />
              <span className="hidden sm:inline">Explain</span>
            </button>
          )}
          {onTestQuery && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const queryToTest = hasSuggestion && (isUnavailable || isEmpty) 
                  ? validationResult.suggested_query 
                  : query;
                onTestQuery(queryToTest, title);
              }}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors"
              title="Test query in embedded editor"
            >
              <FlaskConical size={12} />
              <span className="hidden sm:inline">Test</span>
            </button>
          )}
          <button
            onClick={handleCopy}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
              copied 
                ? 'bg-green-500 text-white' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
            }`}
            title="Copy to clipboard"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
          {onRunInEditor && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (hasSuggestion && (isUnavailable || isEmpty)) {
                  onRunInEditor(validationResult.suggested_query);
                } else {
                  onRunInEditor(query);
                }
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                isValidated 
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : hasSuggestion
                    ? 'bg-purple-500 hover:bg-purple-600 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
              title={hasSuggestion && !isValidated ? "Run suggested alternative" : "Open in Query Editor"}
            >
              {hasSuggestion && !isValidated ? <Sparkles size={12} /> : <Play size={12} />}
              <span>Run</span>
            </button>
          )}
          <div className={`w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}>
            <span className="text-gray-500 text-xs">▶</span>
          </div>
        </div>
      </div>
      
      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50">
          {/* Warning Banner for queries with warnings */}
          <WarningBanner warning={warning} />
          
          {/* User Intent Display */}
          <UserIntentDisplay userIntent={userIntent} />
          
          {/* Sample data preview if available */}
          {isValidated && sampleData && sampleData.length > 0 && (
            <div className="mb-4">
              <h5 className="text-xs font-medium text-gray-600 mb-2">
                Sample Results ({rowCount?.toLocaleString()} total rows)
              </h5>
              <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
                <table className="w-full text-[10px]">
                  <thead className="bg-gray-100">
                    <tr>
                      {Object.keys(sampleData[0]).slice(0, 6).map((col, i) => (
                        <th key={i} className="px-2 py-1 text-left font-medium text-gray-600 border-b">
                          {col}
                        </th>
                      ))}
                      {Object.keys(sampleData[0]).length > 6 && (
                        <th className="px-2 py-1 text-left text-gray-400 border-b">...</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {sampleData.slice(0, 3).map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-blue-50">
                        {Object.values(row).slice(0, 6).map((val, colIdx) => (
                          <td key={colIdx} className="px-2 py-1 border-b border-gray-100 max-w-[150px] truncate">
                            {val !== null && val !== undefined ? String(val) : <span className="text-gray-300">null</span>}
                          </td>
                        ))}
                        {Object.keys(row).length > 6 && (
                          <td className="px-2 py-1 text-gray-300 border-b border-gray-100">...</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {/* Suggested query if original fails */}
          {hasSuggestion && (isUnavailable || isEmpty) && (
            <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-purple-500" />
                <span className="text-xs font-medium text-purple-700">
                  Suggested alternative ({validationResult.suggested_query_result?.row_count?.toLocaleString() || '?'} rows):
                </span>
              </div>
              <pre className="text-[10px] text-purple-800 font-mono bg-white p-2 rounded overflow-x-auto">
                {validationResult.suggested_query}
              </pre>
            </div>
          )}
          
          {/* Original query */}
          <div>
            <h5 className="text-xs font-medium text-gray-600 mb-2">SQL Query</h5>
            <pre className="text-xs text-gray-800 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed p-4 bg-white rounded-lg border border-gray-200">
              {query}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// QueryLibraryLayout Component
// ============================================================================

export default function QueryLibraryLayout({
  categoryLabel,
  onClose,
  queries,
  highlightedQuery,
  onRunInEditor,
  isLoading,
  discoveredTables = new Set(),
  isConnected = false,
  batchValidationResults = new Map(),
  onShowMyWork = null,
  isBatchValidating = false,
  selectedDatabase = '',
  selectedSchema = '',
  queryValidationMap = new Map(),
  onValidateAll = null,
  onOpenConnectionModal = null,
  onTestQuery = null,
  extractTableFromQuery = null
}) {
  const highlightedRef = useRef(null);
  
  // Helper to check if ALL tables in a query are available
  // Uses the new comprehensive validation that checks all referenced tables
  const getQueryValidation = useMemo(() => {
    const cache = new Map();
    return (query) => {
      if (!isConnected || discoveredTables.size === 0) return { valid: null, missingTables: [] };
      if (!query) return { valid: null, missingTables: [] };
      
      // Use cached result if available
      if (cache.has(query)) return cache.get(query);
      
      // Validate all tables in the query
      const result = validateQueryTables(query, discoveredTables);
      cache.set(query, result);
      return result;
    };
  }, [isConnected, discoveredTables]);
  
  // Legacy helper for backwards compatibility
  const getTableAvailability = (query) => {
    const validation = getQueryValidation(query);
    return validation.valid;
  };
  
  // Frequency order for sorting (Very High → Low)
  const frequencyOrder = { 'Very High': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
  
  // Sort queries: by frequency first, then validated, then unavailable last
  const sortedQueries = useMemo(() => {
    return [...queries].sort((a, b) => {
      // First sort by frequency (if available)
      const aFreq = frequencyOrder[a.frequency] ?? 4;
      const bFreq = frequencyOrder[b.frequency] ?? 4;
      if (aFreq !== bFreq) return aFreq - bFreq;
      
      // Then by table availability (using full query validation)
      const aValidation = getQueryValidation(a.query || a.sql);
      const bValidation = getQueryValidation(b.query || b.sql);
      
      // Valid queries first, then unknown, then invalid
      if (aValidation.valid === true && bValidation.valid !== true) return -1;
      if (bValidation.valid === true && aValidation.valid !== true) return 1;
      if (aValidation.valid === false && bValidation.valid !== false) return 1;
      if (bValidation.valid === false && aValidation.valid !== false) return -1;
      return 0;
    });
  }, [queries, getQueryValidation]);

  // Scroll to highlighted query when panel opens
  useEffect(() => {
    if (highlightedQuery && highlightedRef.current) {
      setTimeout(() => {
        highlightedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 350);
    }
  }, [highlightedQuery]);

  return (
    <>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Code2 size={20} className="text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Query Library
            </h2>
            <p className="text-sm text-gray-500">
              {categoryLabel} • {queries.length} queries
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          title="Close (Esc)"
        >
          <X size={20} />
        </button>
      </header>

      {/* Context bar */}
      <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 flex items-center justify-between text-xs text-gray-600 flex-shrink-0">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <Snowflake size={14} className="text-blue-500" />
              <span>
                Connected to{' '}
                <span className="font-medium text-gray-900">{selectedDatabase || 'Default'}</span>
                <span className="text-gray-400 mx-1">.</span>
                <span className="font-mono">{selectedSchema || 'PUBLIC'}</span>
              </span>
            </>
          ) : (
            <>
              <Database size={14} className="text-gray-400" />
              <span className="text-gray-500">Not connected</span>
            </>
          )}
        </div>
        
        {/* Validation stats */}
        {isConnected && queryValidationMap.size > 0 && (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-green-700">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              {[...queryValidationMap.values()].filter(v => v.valid === true).length} valid
            </span>
            <span className="flex items-center gap-1 text-amber-700">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              {[...queryValidationMap.values()].filter(v => v.valid === false).length} need fix
            </span>
          </div>
        )}
      </div>

      {/* Query list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {/* Connection status banner */}
        {isConnected && discoveredTables.size > 0 && (
          <div className="p-3 bg-green-50 rounded-xl border border-green-200 mb-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Check size={16} className="text-green-600" />
                <span className="text-sm text-green-700">
                  <strong>{discoveredTables.size} tables</strong> discovered in {selectedDatabase}.{selectedSchema}
                </span>
              </div>
              {onValidateAll && (
                <button
                  onClick={onValidateAll}
                  disabled={isBatchValidating}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {isBatchValidating ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      Validating...
                    </>
                  ) : (
                    <>
                      <Check size={12} />
                      Validate All
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
        
        {!isConnected && (
          <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-200 mb-4">
            <div className="flex items-center gap-2">
              <Snowflake size={16} className="text-amber-600" />
              <span className="text-sm text-amber-700">
                Connect to Snowflake to discover tables and validate queries
              </span>
            </div>
            {onOpenConnectionModal && (
              <button
                onClick={onOpenConnectionModal}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
              >
                <Snowflake size={12} />
                Connect
              </button>
            )}
          </div>
        )}
        
        {/* Loading indicators */}
        {isLoading && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl border border-blue-200 mb-4">
            <Loader2 size={16} className="animate-spin text-blue-600" />
            <span className="text-sm text-blue-700">Fetching table columns from Snowflake...</span>
          </div>
        )}
        
        {isBatchValidating && (
          <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-xl border border-purple-200 mb-4">
            <Loader2 size={16} className="animate-spin text-purple-600" />
            <span className="text-sm text-purple-700">Testing queries & finding alternatives...</span>
          </div>
        )}
        
        {/* Highlighted inline query at top if not in main queries */}
        {highlightedQuery && !queries.some(q => q.query === highlightedQuery) && (
          <div ref={highlightedRef}>
            <div className="mb-4 pb-4 border-b border-gray-200">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-medium">
                {highlightedQuery.includes('Connect to Snowflake') ? '⚠️ Not Connected' : '✨ Smart Query'}
              </p>
              <QueryCard 
                title="Entity Query" 
                description={highlightedQuery.includes('Connect to Snowflake') 
                  ? "Connect to Snowflake for intelligent column selection" 
                  : "Query generated with real column metadata"} 
                query={highlightedQuery}
                tableAvailable={getTableAvailability(highlightedQuery)} 
                defaultExpanded={true}
                onRunInEditor={onRunInEditor}
                onShowMyWork={onShowMyWork}
                onTestQuery={onTestQuery}
              />
            </div>
          </div>
        )}
        
        {/* Query cards */}
        {sortedQueries.length > 0 ? (
          <>
            {highlightedQuery && !queries.some(q => q.query === highlightedQuery) && (
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">
                More {categoryLabel} Queries
              </p>
            )}
            {sortedQueries.map((q, i) => {
              const isHighlighted = highlightedQuery && q.query === highlightedQuery;
              const queryValidation = getQueryValidation(q.query || q.sql);
              const tableAvailable = queryValidation.valid;
              const isAutoFixed = q.validation?.autoFixed;
              const batchResult = batchValidationResults.get(`core_${i}`);
              
              // Build enhanced description with missing tables info
              let enhancedDescription = q.description;
              if (queryValidation.missingTables && queryValidation.missingTables.length > 0) {
                enhancedDescription = `${q.description} • Missing tables: ${queryValidation.missingTables.join(', ')}`;
              }
              
              return (
                <div key={q.queryId || q.id || i} ref={isHighlighted ? highlightedRef : null}>
                  <QueryCard 
                    title={isAutoFixed ? `${q.title || q.label} (Auto-Fixed)` : (q.title || q.label)}
                    description={isAutoFixed 
                      ? `${q.description} • Table changed: ${q.validation.changes.map(c => `${c.from} → ${c.to}`).join(', ')}`
                      : enhancedDescription
                    }
                    query={q.query || q.sql} 
                    defaultExpanded={isHighlighted}
                    onRunInEditor={onRunInEditor}
                    tableAvailable={tableAvailable}
                    validated={q.validation?.valid}
                    autoFixed={isAutoFixed}
                    validationResult={batchResult}
                    onShowMyWork={onShowMyWork}
                    onTestQuery={onTestQuery}
                    // New props for user research queries
                    userIntent={q.userIntent}
                    frequency={q.frequency}
                    frequencyDetail={q.frequencyDetail}
                    source={q.source}
                    warning={q.warning}
                    confidence={q.confidence}
                  />
                </div>
              );
            })}
          </>
        ) : !highlightedQuery ? (
          <div className="text-center py-16">
            <Code2 size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-600 font-medium">No queries available</p>
            <p className="text-gray-400 text-sm mt-1">Queries for this category are coming soon</p>
          </div>
        ) : null}
      </div>
    </>
  );
}

