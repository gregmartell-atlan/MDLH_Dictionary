/**
 * QueryLibraryEnhanced - Premium redesign of Query Library with animations
 * and smart recommendations
 *
 * Features:
 * - Staggered entrance animations
 * - Rich visual hierarchy with gradients
 * - Recommended/Trending queries section
 * - Recently run queries
 * - Smooth micro-interactions
 */

import React, { useRef, useEffect, useMemo, useState } from 'react';
import {
  X, Code2, Check, Loader2, Snowflake, Play, Eye, FlaskConical,
  Sparkles, Copy, Database, AlertTriangle, TrendingUp, MessageCircle,
  Info, Clock, Zap, Star, ChevronRight, ArrowRight, Flame, History,
  Lightbulb, Target, BarChart3, Search, Filter, BookOpen
} from 'lucide-react';
import { FREQUENCY_STYLES } from '../data/queryTemplates';
import { validateQueryTables, getSuggestedAlternatives } from '../utils/dynamicExampleQueries';
import { getTableFriendlyName, categorizeMissingTables } from '../utils/queryAvailability';

// ============================================================================
// CSS Keyframes (injected once)
// ============================================================================
const injectStyles = () => {
  if (document.getElementById('query-library-enhanced-styles')) return;

  const style = document.createElement('style');
  style.id = 'query-library-enhanced-styles';
  style.textContent = `
    @keyframes slideInFromRight {
      from {
        opacity: 0;
        transform: translateX(20px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    @keyframes fadeInScale {
      from {
        opacity: 0;
        transform: scale(0.96);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    @keyframes pulseGlow {
      0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
      50% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
    }

    @keyframes expandHeight {
      from {
        opacity: 0;
        max-height: 0;
      }
      to {
        opacity: 1;
        max-height: 1000px;
      }
    }

    .query-card-enter {
      animation: slideInFromRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      opacity: 0;
    }

    .query-card-expand {
      animation: expandHeight 0.3s ease-out forwards;
      overflow: hidden;
    }

    .shimmer-bg {
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
      background-size: 200% 100%;
      animation: shimmer 2s infinite;
    }

    .pulse-glow {
      animation: pulseGlow 2s infinite;
    }

    .gradient-text {
      background: linear-gradient(135deg, #1e293b 0%, #475569 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .card-hover-lift {
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .card-hover-lift:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 30px rgba(0,0,0,0.12), 0 4px 10px rgba(0,0,0,0.06);
    }

    .button-press {
      transition: transform 0.1s ease;
    }

    .button-press:active {
      transform: scale(0.96);
    }

    .priority-badge-gradient {
      position: relative;
      overflow: hidden;
    }

    .priority-badge-gradient::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 50%);
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);
};

// ============================================================================
// Enhanced Priority Badge with Gradient
// ============================================================================
const PRIORITY_GRADIENTS = {
  'Very High': {
    bg: 'bg-gradient-to-br from-rose-500 to-red-600',
    text: 'text-white',
    glow: 'shadow-rose-500/25',
    icon: Flame
  },
  'High': {
    bg: 'bg-gradient-to-br from-amber-400 to-orange-500',
    text: 'text-white',
    glow: 'shadow-amber-500/25',
    icon: TrendingUp
  },
  'Medium': {
    bg: 'bg-gradient-to-br from-sky-400 to-blue-500',
    text: 'text-white',
    glow: 'shadow-sky-500/25',
    icon: BarChart3
  },
  'Low': {
    bg: 'bg-gradient-to-br from-slate-300 to-slate-400',
    text: 'text-slate-700',
    glow: 'shadow-slate-400/20',
    icon: Target
  }
};

function PriorityBadge({ priority, detail, compact = false }) {
  if (!priority) return null;

  const style = PRIORITY_GRADIENTS[priority] || PRIORITY_GRADIENTS['Medium'];
  const Icon = style.icon;

  if (compact) {
    return (
      <span
        className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${style.bg} ${style.text} shadow-lg ${style.glow} priority-badge-gradient`}
        title={`${priority} priority${detail ? ` (${detail})` : ''}`}
      >
        <Icon size={10} strokeWidth={2.5} />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold tracking-wide uppercase rounded-full ${style.bg} ${style.text} shadow-lg ${style.glow} priority-badge-gradient`}
      title={detail ? `${priority} (${detail})` : priority}
    >
      <Icon size={10} strokeWidth={2.5} />
      {priority}
    </span>
  );
}

// ============================================================================
// Recommended Queries Section
// ============================================================================
function RecommendedSection({
  title,
  icon: Icon,
  queries,
  onRunQuery,
  accentColor = 'emerald',
  emptyMessage = 'No recommendations available'
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!queries || queries.length === 0) {
    return null;
  }

  const colorClasses = {
    emerald: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      icon: 'text-emerald-600',
      text: 'text-emerald-700',
      hover: 'hover:bg-emerald-100',
      badge: 'bg-emerald-100 text-emerald-700'
    },
    amber: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      icon: 'text-amber-600',
      text: 'text-amber-700',
      hover: 'hover:bg-amber-100',
      badge: 'bg-amber-100 text-amber-700'
    },
    violet: {
      bg: 'bg-violet-50',
      border: 'border-violet-200',
      icon: 'text-violet-600',
      text: 'text-violet-700',
      hover: 'hover:bg-violet-100',
      badge: 'bg-violet-100 text-violet-700'
    },
    sky: {
      bg: 'bg-sky-50',
      border: 'border-sky-200',
      icon: 'text-sky-600',
      text: 'text-sky-700',
      hover: 'hover:bg-sky-100',
      badge: 'bg-sky-100 text-sky-700'
    }
  };

  const colors = colorClasses[accentColor] || colorClasses.emerald;

  return (
    <div className={`rounded-xl border ${colors.border} ${colors.bg} overflow-hidden mb-4 query-card-enter`}>
      {/* Section Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between px-4 py-3 ${colors.hover} transition-colors`}
      >
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-lg ${colors.badge}`}>
            <Icon size={14} className={colors.icon} />
          </div>
          <span className={`font-semibold text-sm ${colors.text}`}>{title}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${colors.badge}`}>
            {queries.length}
          </span>
        </div>
        <ChevronRight
          size={16}
          className={`${colors.icon} transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
        />
      </button>

      {/* Query Pills */}
      {isExpanded && (
        <div className="px-4 pb-3 flex flex-wrap gap-2 query-card-expand">
          {queries.slice(0, 5).map((q, i) => (
            <button
              key={q.id || i}
              onClick={() => onRunQuery(q.query || q.sql)}
              className={`group flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border ${colors.border}
                hover:border-slate-300 hover:shadow-md transition-all duration-200 button-press`}
            >
              <span className="text-xs text-slate-700 font-medium truncate max-w-[180px]">
                {q.title || q.label || q.name}
              </span>
              <ArrowRight size={12} className="text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all" />
            </button>
          ))}
          {queries.length > 5 && (
            <span className="text-xs text-slate-400 self-center ml-1">
              +{queries.length - 5} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Enhanced Query Card
// ============================================================================
function QueryCardEnhanced({
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
  userIntent = null,
  frequency = null,
  frequencyDetail = null,
  source = null,
  warning = null,
  confidence = null,
  index = 0
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Status computation
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

  // Status indicator
  const getStatusIndicator = () => {
    if (isValidated) return {
      color: 'bg-emerald-500',
      glow: 'shadow-emerald-500/50',
      text: rowCount ? `${rowCount.toLocaleString()} rows` : 'Valid',
      textColor: 'text-emerald-600'
    };
    if (isAutoFixed) return {
      color: 'bg-blue-500',
      glow: 'shadow-blue-500/50',
      text: 'Auto-fixed',
      textColor: 'text-blue-600'
    };
    if (isEmpty) return {
      color: 'bg-slate-300',
      glow: '',
      text: 'Empty',
      textColor: 'text-slate-500'
    };
    if (isUnavailable) return {
      color: 'bg-amber-400',
      glow: '',
      text: 'Needs fix',
      textColor: 'text-amber-600'
    };
    return null;
  };

  const status = getStatusIndicator();

  return (
    <div
      className={`query-card-enter card-hover-lift bg-white rounded-xl border overflow-hidden transition-all duration-200 ${
        expanded
          ? 'border-slate-300 shadow-lg'
          : 'border-slate-200 hover:border-slate-300'
      }`}
      style={{ animationDelay: `${index * 50}ms` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Card Header */}
      <div
        className={`flex items-center justify-between px-4 py-3.5 cursor-pointer transition-colors ${
          isHovered && !expanded ? 'bg-slate-50/50' : ''
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0 flex items-start gap-3">
          {/* Priority Badge - Compact */}
          <div className="flex-shrink-0 pt-0.5">
            <PriorityBadge priority={frequency} detail={frequencyDetail} compact />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-slate-900 text-sm truncate">
                {title}
              </h4>

              {/* Status dot with glow */}
              {status && (
                <span
                  className={`w-2 h-2 rounded-full ${status.color} ${status.glow ? `shadow-lg ${status.glow}` : ''}`}
                  title={status.text}
                />
              )}
            </div>

            <p className="text-slate-500 text-xs mt-0.5 line-clamp-1">
              {description}
            </p>

            {/* Row count badge */}
            {isValidated && rowCount && (
              <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-emerald-600 font-medium">
                <Database size={10} />
                {rowCount.toLocaleString()} rows
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
          {/* Text actions - visible on hover */}
          <div className={`hidden sm:flex items-center gap-1 transition-opacity duration-200 ${
            isHovered || expanded ? 'opacity-100' : 'opacity-0'
          }`}>
            {onShowMyWork && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onShowMyWork(query, validationResult);
                }}
                className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all button-press"
              >
                Explain
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
                className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all button-press"
              >
                Test
              </button>
            )}
            <button
              onClick={handleCopy}
              className={`px-2.5 py-1 text-xs rounded-lg transition-all button-press ${
                copied
                  ? 'text-emerald-600 bg-emerald-50'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              {copied ? (
                <span className="flex items-center gap-1">
                  <Check size={12} /> Copied
                </span>
              ) : 'Copy'}
            </button>
          </div>

          {/* Primary Run button */}
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
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold
                bg-gradient-to-br from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800
                text-white shadow-lg shadow-slate-900/25 transition-all duration-200 button-press"
            >
              <Play size={11} fill="currentColor" />
              <span>Run</span>
            </button>
          )}

          {/* Expand chevron */}
          <ChevronRight
            size={16}
            className={`text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
          />
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-slate-100 bg-gradient-to-b from-slate-50 to-white query-card-expand">
          <div className="p-4 space-y-4">
            {/* Warning Banner */}
            {warning && (
              <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800">
                  <span className="font-semibold">Warning: </span>
                  {warning}
                </div>
              </div>
            )}

            {/* User Intent */}
            {userIntent && (
              <div className="flex items-start gap-3 p-3 bg-sky-50 border border-sky-200 rounded-lg">
                <MessageCircle size={14} className="text-sky-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-sky-800">
                  <span className="font-semibold">Users ask: </span>
                  <span className="italic">"{userIntent}"</span>
                </div>
              </div>
            )}

            {/* Sample Data Preview */}
            {isValidated && sampleData && sampleData.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-2">
                  <Eye size={12} />
                  Sample Results ({rowCount?.toLocaleString()} total)
                </h5>
                <div className="overflow-x-auto bg-white rounded-lg border border-slate-200 shadow-sm">
                  <table className="w-full text-[10px]">
                    <thead className="bg-gradient-to-r from-slate-100 to-slate-50">
                      <tr>
                        {Object.keys(sampleData[0]).slice(0, 6).map((col, i) => (
                          <th key={i} className="px-3 py-2 text-left font-semibold text-slate-600 border-b border-slate-200">
                            {col}
                          </th>
                        ))}
                        {Object.keys(sampleData[0]).length > 6 && (
                          <th className="px-3 py-2 text-left text-slate-400 border-b border-slate-200">...</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {sampleData.slice(0, 3).map((row, rowIdx) => (
                        <tr key={rowIdx} className="hover:bg-sky-50/50 transition-colors">
                          {Object.values(row).slice(0, 6).map((val, colIdx) => (
                            <td key={colIdx} className="px-3 py-2 border-b border-slate-100 max-w-[150px] truncate font-mono">
                              {val !== null && val !== undefined
                                ? String(val)
                                : <span className="text-slate-300 italic">null</span>
                              }
                            </td>
                          ))}
                          {Object.keys(row).length > 6 && (
                            <td className="px-3 py-2 text-slate-300 border-b border-slate-100">...</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Suggested Alternative */}
            {hasSuggestion && (isUnavailable || isEmpty) && (
              <div className="p-3 bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={14} className="text-violet-600" />
                  <span className="text-xs font-semibold text-violet-700">
                    Suggested Alternative ({validationResult.suggested_query_result?.row_count?.toLocaleString() || '?'} rows)
                  </span>
                </div>
                <pre className="text-[10px] text-violet-800 font-mono bg-white/80 p-3 rounded overflow-x-auto">
                  {validationResult.suggested_query}
                </pre>
              </div>
            )}

            {/* SQL Query */}
            <div>
              <h5 className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-2">
                <Code2 size={12} />
                SQL Query
              </h5>
              <pre className="text-xs text-slate-800 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed p-4 bg-slate-900 text-slate-100 rounded-lg shadow-inner">
                {query}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================
export default function QueryLibraryEnhanced({
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
  extractTableFromQuery = null,
  // New props for recommendations
  recentlyRunQueries = [],
  trendingQueries = [],
  relatedQueries = []
}) {
  const highlightedRef = useRef(null);
  const [searchFilter, setSearchFilter] = useState('');

  // Inject custom styles on mount
  useEffect(() => {
    injectStyles();
  }, []);

  // Query validation helper
  const getQueryValidation = useMemo(() => {
    const cache = new Map();
    return (query) => {
      if (!isConnected || discoveredTables.size === 0) return { valid: null, missingTables: [] };
      if (!query) return { valid: null, missingTables: [] };

      if (cache.has(query)) return cache.get(query);

      const result = validateQueryTables(query, discoveredTables);
      cache.set(query, result);
      return result;
    };
  }, [isConnected, discoveredTables]);

  const getTableAvailability = (query) => {
    const validation = getQueryValidation(query);
    return validation.valid;
  };

  // Frequency ordering
  const frequencyOrder = { 'Very High': 0, 'High': 1, 'Medium': 2, 'Low': 3 };

  // Sort and filter queries
  const sortedQueries = useMemo(() => {
    let filtered = [...queries];

    // Apply search filter
    if (searchFilter.trim()) {
      const search = searchFilter.toLowerCase();
      filtered = filtered.filter(q =>
        (q.title || q.label || '').toLowerCase().includes(search) ||
        (q.description || '').toLowerCase().includes(search) ||
        (q.userIntent || '').toLowerCase().includes(search)
      );
    }

    return filtered.sort((a, b) => {
      const aFreq = frequencyOrder[a.frequency] ?? 4;
      const bFreq = frequencyOrder[b.frequency] ?? 4;
      if (aFreq !== bFreq) return aFreq - bFreq;

      const aValidation = getQueryValidation(a.query || a.sql);
      const bValidation = getQueryValidation(b.query || b.sql);

      if (aValidation.valid === true && bValidation.valid !== true) return -1;
      if (bValidation.valid === true && aValidation.valid !== true) return 1;
      if (aValidation.valid === false && bValidation.valid !== false) return 1;
      if (bValidation.valid === false && aValidation.valid !== false) return -1;
      return 0;
    });
  }, [queries, getQueryValidation, searchFilter]);

  // Generate smart recommendations based on category
  const smartRecommendations = useMemo(() => {
    // Get top high-frequency queries that are validated
    return queries
      .filter(q => (q.frequency === 'Very High' || q.frequency === 'High') &&
        getQueryValidation(q.query || q.sql).valid !== false)
      .slice(0, 5);
  }, [queries, getQueryValidation]);

  // Scroll to highlighted query
  useEffect(() => {
    if (highlightedQuery && highlightedRef.current) {
      setTimeout(() => {
        highlightedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 350);
    }
  }, [highlightedQuery]);

  // Stats
  const validCount = [...queryValidationMap.values()].filter(v => v.valid === true).length;
  const needsFixCount = [...queryValidationMap.values()].filter(v => v.valid === false).length;

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-50 to-white">
      {/* Header - Premium styling */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-white flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg shadow-lg">
              <BookOpen size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold gradient-text">
                Query Library
              </h2>
              <p className="text-xs text-slate-500">
                {categoryLabel} &bull; {queries.length} queries
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all button-press"
          title="Close (Esc)"
        >
          <X size={18} />
        </button>
      </header>

      {/* Context bar with stats */}
      <div className="px-5 py-3 border-b border-slate-100 bg-white/80 backdrop-blur flex items-center justify-between text-xs flex-shrink-0">
        <div className="flex items-center gap-3">
          {isConnected ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-500 pulse-glow" />
              <span className="font-medium text-emerald-700">
                {selectedDatabase || 'Default'}.{selectedSchema || 'PUBLIC'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-full">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span className="text-slate-600">Not connected</span>
            </div>
          )}

          {/* Search filter */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filter queries..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-300
                placeholder-slate-400 w-48 transition-all"
            />
          </div>
        </div>

        {/* Validation stats */}
        {isConnected && queryValidationMap.size > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-emerald-600">
              <Check size={14} />
              <span className="font-semibold">{validCount}</span>
              <span className="text-slate-400">valid</span>
            </div>
            {needsFixCount > 0 && (
              <>
                <span className="text-slate-300">|</span>
                <div className="flex items-center gap-1.5 text-amber-600">
                  <AlertTriangle size={14} />
                  <span className="font-semibold">{needsFixCount}</span>
                  <span className="text-slate-400">need fix</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Connection Banner */}
        {isConnected && discoveredTables.size > 0 && (
          <div className="flex items-center justify-between gap-3 p-4 bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl shadow-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg">
                <Database size={18} className="text-emerald-400" />
              </div>
              <div>
                <span className="text-white font-semibold">
                  {discoveredTables.size} tables
                </span>
                <span className="text-slate-400 ml-2">available for queries</span>
              </div>
            </div>
            {onValidateAll && (
              <button
                onClick={onValidateAll}
                disabled={isBatchValidating}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-white hover:bg-slate-100
                  text-slate-900 rounded-lg transition-all disabled:opacity-50 button-press"
              >
                {isBatchValidating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    Validate All
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {!isConnected && (
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-200 rounded-xl">
            <div className="flex items-center gap-3">
              <Snowflake size={20} className="text-sky-500" />
              <span className="text-slate-700 font-medium">Connect to Snowflake to validate queries</span>
            </div>
            {onOpenConnectionModal && (
              <button
                onClick={onOpenConnectionModal}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold
                  bg-gradient-to-br from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500
                  text-white rounded-lg shadow-lg shadow-sky-500/25 transition-all button-press"
              >
                <Snowflake size={14} />
                Connect
              </button>
            )}
          </div>
        )}

        {/* Loading states */}
        {(isLoading || isBatchValidating) && (
          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <Loader2 size={18} className="animate-spin text-slate-500" />
            <span className="text-sm text-slate-600 font-medium">
              {isBatchValidating ? 'Testing all queries...' : 'Loading...'}
            </span>
            <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-slate-400 to-slate-500 shimmer-bg" style={{ width: '60%' }} />
            </div>
          </div>
        )}

        {/* Recommended Sections */}
        {smartRecommendations.length > 0 && !searchFilter && (
          <RecommendedSection
            title="Recommended Queries"
            icon={Sparkles}
            queries={smartRecommendations}
            onRunQuery={onRunInEditor}
            accentColor="emerald"
          />
        )}

        {recentlyRunQueries.length > 0 && !searchFilter && (
          <RecommendedSection
            title="Recently Run"
            icon={History}
            queries={recentlyRunQueries}
            onRunQuery={onRunInEditor}
            accentColor="violet"
          />
        )}

        {trendingQueries.length > 0 && !searchFilter && (
          <RecommendedSection
            title="Trending This Week"
            icon={Flame}
            queries={trendingQueries}
            onRunQuery={onRunInEditor}
            accentColor="amber"
          />
        )}

        {relatedQueries.length > 0 && !searchFilter && (
          <RecommendedSection
            title="Related Queries"
            icon={Lightbulb}
            queries={relatedQueries}
            onRunQuery={onRunInEditor}
            accentColor="sky"
          />
        )}

        {/* Highlighted Query */}
        {highlightedQuery && !queries.some(q => q.query === highlightedQuery) && (
          <div ref={highlightedRef} className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={14} className="text-amber-500" />
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                Smart Query
              </span>
            </div>
            <QueryCardEnhanced
              title="Generated Query"
              description="Query generated based on current context"
              query={highlightedQuery}
              tableAvailable={getTableAvailability(highlightedQuery)}
              defaultExpanded={true}
              onRunInEditor={onRunInEditor}
              onShowMyWork={onShowMyWork}
              onTestQuery={onTestQuery}
              frequency="Very High"
              index={0}
            />
          </div>
        )}

        {/* Section Header */}
        {sortedQueries.length > 0 && (
          <div className="flex items-center justify-between pt-2">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {searchFilter ? `Filtered Results (${sortedQueries.length})` : 'All Queries'}
            </h3>
            <span className="text-xs text-slate-400">
              Sorted by frequency &bull; validity
            </span>
          </div>
        )}

        {/* Query Cards */}
        <div className="space-y-3">
          {sortedQueries.map((q, i) => {
            const isHighlighted = highlightedQuery && q.query === highlightedQuery;
            const queryValidation = getQueryValidation(q.query || q.sql);
            const tableAvailable = queryValidation.valid;
            const isAutoFixed = q.validation?.autoFixed;
            const batchResult = batchValidationResults.get(`core_${i}`);

            let enhancedDescription = q.description;
            if (queryValidation.missingTables && queryValidation.missingTables.length > 0) {
              const { message } = categorizeMissingTables(queryValidation.missingTables);
              enhancedDescription = `${q.description} • ${message}`;
            }

            return (
              <div key={q.queryId || q.id || i} ref={isHighlighted ? highlightedRef : null}>
                <QueryCardEnhanced
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
                  userIntent={q.userIntent}
                  frequency={q.frequency}
                  frequencyDetail={q.frequencyDetail}
                  source={q.source}
                  warning={q.warning}
                  confidence={q.confidence}
                  index={i}
                />
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {sortedQueries.length === 0 && !highlightedQuery && (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
              <Code2 size={32} className="text-slate-400" />
            </div>
            <p className="text-slate-700 font-semibold text-lg">
              {searchFilter ? 'No matching queries' : 'No queries available'}
            </p>
            <p className="text-slate-500 text-sm mt-2">
              {searchFilter
                ? `Try adjusting your search for "${searchFilter}"`
                : 'Queries for this category are coming soon'
              }
            </p>
            {searchFilter && (
              <button
                onClick={() => setSearchFilter('')}
                className="mt-4 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800
                  bg-slate-100 hover:bg-slate-200 rounded-lg transition-all button-press"
              >
                Clear filter
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
