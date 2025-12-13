/**
 * StepWizard Component
 * 
 * A guided multi-step query wizard that helps users build complex queries
 * incrementally, with each step providing context and data for the next.
 * 
 * Features:
 * - State persistence to sessionStorage (survives page refresh)
 * - Cached step results for back/forward navigation
 * - Resume previous session prompt
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  Play,
  Check,
  AlertCircle,
  Loader2,
  GitBranch,
  Table,
  Search,
  Code,
  ArrowRight,
  SkipForward,
  Copy,
  Sparkles,
  Zap,
  CheckCircle2,
  XCircle,
  Info,
  BookOpen,
  Layers,
  LayoutDashboard,
  BarChart2,
  Database,
  Activity,
  Type,
  Hash,
  List,
  Braces,
  Clock,
  ToggleLeft,
  Circle,
} from 'lucide-react';
import { createWizardState, advanceWizard, WIZARD_STATUS } from '../queryFlows/stepFlows/types';
import { getWizardFlow, getAllWizardFlows } from '../queryFlows/stepFlows';
import { useQuery } from '../hooks/useSnowflake';
import { useConfig } from '../context/SystemConfigContext';
import { formatCellValue, getTypeIcon } from '../utils/resultFormatters';
import EmptyResultsState, { determineEmptyStateType } from './EmptyResultsState';
import {
  normalizeRows,
  extractColumnNames,
  getRowCount,
  isEmptyResult,
  hasNoResult,
} from '../utils/queryResultAdapter';

// Step icons - mapped by step ID or step kind
const STEP_ICONS = {
  // By step ID (legacy)
  discover_tables: Search,
  examine_structure: Table,
  sample_data: Sparkles,
  build_lineage_query: GitBranch,
  
  // By step kind (new pattern from recipes)
  DISCOVER: Search,
  INSPECT: Table,
  SAMPLE: Sparkles,
  BUILD_FINAL: Code,
  SEARCH: Search,
  VALIDATE: Check,
  
  // Domain-specific
  find_glossary_tables: BookOpen,
  list_glossaries: BookOpen,
  search_terms: Search,
  find_dbt_tables: Layers,
  list_models: Layers,
  find_bi_tables: LayoutDashboard,
  list_dashboards: LayoutDashboard,
  basic_stats: BarChart2,
  top_values: BarChart2,
  sample_values: Sparkles,
  list_tables: Database,
  pick_table: Table,
  sample_table: Sparkles,
  find_usage_tables: Activity,
  recent_queries: Activity,
  popularity_stats: Activity,
};

// =============================================================================
// Session Storage Persistence
// =============================================================================

const WIZARD_STATE_KEY = 'MDLH_WIZARD_STATE';

/**
 * Save wizard state to sessionStorage
 */
function persistWizardState(flowId, state) {
  try {
    const toSave = {
      flowId,
      currentStepIndex: state.currentStepIndex,
      inputs: state.inputs,
      stepResults: state.stepResults,
      savedAt: Date.now(),
    };
    sessionStorage.setItem(WIZARD_STATE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.warn('Failed to persist wizard state:', e);
  }
}

/**
 * Load wizard state from sessionStorage
 */
function loadWizardState(flowId) {
  try {
    const saved = sessionStorage.getItem(WIZARD_STATE_KEY);
    if (!saved) return null;
    
    const parsed = JSON.parse(saved);
    
    // Only restore if same flow and not too old (30 minutes)
    if (parsed.flowId !== flowId) return null;
    if (Date.now() - parsed.savedAt > 30 * 60 * 1000) return null;
    
    return parsed;
  } catch (e) {
    console.warn('Failed to load wizard state:', e);
    return null;
  }
}

/**
 * Clear persisted wizard state
 */
function clearWizardState() {
  try {
    sessionStorage.removeItem(WIZARD_STATE_KEY);
  } catch (e) {
    // Ignore
  }
}

/**
 * Progress indicator showing all steps
 */
function StepProgress({ steps, currentIndex, stepResults }) {
  return (
    <div className="flex items-center gap-1 px-4 py-3 bg-gray-50 border-b border-gray-200">
      {steps.map((step, idx) => {
        const isComplete = idx < currentIndex;
        const isCurrent = idx === currentIndex;
        const result = stepResults[idx];
        const hasError = result && !result.success;
        
        const Icon = STEP_ICONS[step.id] || Code;
        
        return (
          <React.Fragment key={step.id}>
            {idx > 0 && (
              <div className={`h-0.5 w-6 ${isComplete ? 'bg-emerald-500' : 'bg-gray-300'}`} />
            )}
            <div 
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
                transition-colors
                ${isCurrent ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-500 ring-offset-1' : ''}
                ${isComplete && !hasError ? 'bg-emerald-100 text-emerald-700' : ''}
                ${hasError ? 'bg-red-100 text-red-700' : ''}
                ${!isCurrent && !isComplete && !hasError ? 'bg-gray-100 text-gray-500' : ''}
              `}
            >
              {isComplete && !hasError && <Check size={12} />}
              {hasError && <XCircle size={12} />}
              {!isComplete && !hasError && <Icon size={12} />}
              <span className="hidden sm:inline">Step {idx + 1}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

/**
 * SQL preview with syntax highlighting
 */
function SqlPreview({ sql, onCopy }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    if (!sql) return;
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopy?.();
  };
  
  // Handle empty/null SQL
  if (!sql || typeof sql !== 'string' || sql.trim() === '') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-700 text-sm">
        <AlertCircle className="inline mr-2" size={16} />
        No SQL generated. Check if the step has the required inputs.
      </div>
    );
  }
  
  return (
    <div className="relative">
      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto max-h-64 overflow-y-auto font-mono">
        {sql.split('\n').map((line, i) => {
          // Simple syntax highlighting
          let highlighted = line;
          
          // Comments in green
          if (line.trim().startsWith('--')) {
            return <div key={i} className="text-emerald-400">{line}</div>;
          }
          
          // Keywords in blue
          const keywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'ON', 'AND', 'OR', 'ORDER', 'BY', 
                          'LIMIT', 'WITH', 'AS', 'UNION', 'ALL', 'RECURSIVE', 'INNER', 'LEFT',
                          'SHOW', 'TABLES', 'LIKE', 'IN', 'DESCRIBE', 'TABLE', 'IS', 'NOT', 'NULL',
                          'DISTINCT', 'ARRAY_CONSTRUCT', 'ARRAY_APPEND', 'ARRAY_CONTAINS', 'PARSE_JSON'];
          
          keywords.forEach(kw => {
            const regex = new RegExp(`\\b${kw}\\b`, 'gi');
            highlighted = highlighted.replace(regex, match => `<span class="text-blue-400">${match}</span>`);
          });
          
          return <div key={i} dangerouslySetInnerHTML={{ __html: highlighted }} />;
        })}
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-2 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 hover:text-white transition-colors"
        title="Copy SQL"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}

// Type icon mapping
const TYPE_ICONS = {
  Type,
  Hash,
  List,
  Braces,
  Clock,
  ToggleLeft,
  Circle,
};

/**
 * Formatted cell value component
 */
function FormattedCell({ value, columnName, dataType }) {
  const formatted = formatCellValue(value, columnName, dataType);
  
  if (formatted.type === 'null') {
    return <span className="text-gray-400 italic">null</span>;
  }
  
  if (formatted.type === 'guid') {
    return (
      <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded" title={formatted.raw}>
        {formatted.display.substring(0, 8)}...
      </span>
    );
  }
  
  if (formatted.type === 'timestamp') {
    return (
      <span title={formatted.display}>
        {formatted.relative}
      </span>
    );
  }
  
  if (formatted.type === 'number') {
    return <span>{formatted.formatted}</span>;
  }
  
  if (formatted.type === 'array') {
    return (
      <span className="flex items-center gap-1">
        <span className="bg-indigo-100 text-indigo-700 text-xs px-1.5 py-0.5 rounded">
          {formatted.count} items
        </span>
      </span>
    );
  }
  
  if (formatted.type === 'object') {
    return (
      <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded" title={formatted.display}>
        {'{...}'}
      </span>
    );
  }
  
  // String - truncate if too long
  const display = formatted.display.length > 50 
    ? formatted.display.substring(0, 50) + '...' 
    : formatted.display;
  
  return <span title={formatted.display}>{display}</span>;
}

/**
 * Column header with type icon
 */
function ColumnHeader({ column }) {
  const colName = typeof column === 'object' ? column.name : column;
  const dataType = typeof column === 'object' ? column.type : null;
  const iconName = getTypeIcon(dataType);
  const Icon = TYPE_ICONS[iconName] || Circle;
  
  return (
    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
      <div className="flex items-center gap-1">
        <Icon size={12} className="text-gray-400" title={dataType || 'unknown'} />
        <span>{colName}</span>
      </div>
    </th>
  );
}

/**
 * Results preview table with smart formatting
 * 
 * Uses the adapter pattern to normalize rows ONCE via useMemo,
 * ensuring reliable column access regardless of input format.
 */
function ResultsPreview({ results, maxRows = 5, query, availableTables, onTableChange }) {
  // =========================================================================
  // ADAPTER LAYER: Normalize transport shape → render shape (once!)
  // =========================================================================
  const normalizedRows = useMemo(
    () => results ? normalizeRows(results) : [],
    [results]
  );
  
  const columnNames = useMemo(
    () => results ? extractColumnNames(results) : [],
    [results]
  );
  
  const rowCount = getRowCount(results);
  
  // =========================================================================
  // Handle null/undefined results
  // =========================================================================
  if (hasNoResult(results)) {
    return (
      <EmptyResultsState
        emptyType="no_data"
        availableTables={availableTables}
        onTableChange={onTableChange}
      />
    );
  }
  
  // =========================================================================
  // Handle empty rows array (query succeeded but returned 0 rows)
  // =========================================================================
  if (isEmptyResult(results)) {
    const emptyType = determineEmptyStateType({
      results,
      query,
      availableTables,
    });
    
    return (
      <EmptyResultsState
        emptyType={emptyType}
        query={query}
        availableTables={availableTables}
        onTableChange={onTableChange}
      />
    );
  }
  
  // =========================================================================
  // Render table with normalized rows (object access, not index!)
  // =========================================================================
  const columns = results.columns || [];
  const displayRows = normalizedRows.slice(0, maxRows);
  
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col, i) => (
              <ColumnHeader key={i} column={col} />
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {displayRows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              {columns.map((col, j) => {
                const colName = typeof col === 'object' ? col.name : col;
                const dataType = typeof col === 'object' ? col.type : null;
                // Access by column NAME (object property), not index!
                const value = row[colName];
                
                return (
                  <td key={j} className="px-3 py-2 text-gray-700 max-w-xs">
                    <FormattedCell 
                      value={value} 
                      columnName={colName} 
                      dataType={dataType} 
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {rowCount > maxRows && (
        <p className="text-xs text-gray-500 mt-2 text-center">
          Showing {maxRows} of {rowCount} rows
        </p>
      )}
    </div>
  );
}

/**
 * Extracted data display
 */
function ExtractedData({ data, title = "Data for next step" }) {
  if (!data || Object.keys(data).length === 0) return null;
  
  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mt-3">
      <div className="flex items-center gap-2 text-indigo-700 text-sm font-medium mb-2">
        <Zap size={14} />
        {title}
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {Object.entries(data).map(([key, value]) => {
          if (key === 'discoveredTables' || key === 'processColumns' || key === 'sampleGuids' || key === 'sampleRows') {
            // Array data
            const arr = Array.isArray(value) ? value : [];
            return (
              <div key={key} className="col-span-2">
                <span className="text-gray-500">{key}:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {arr.slice(0, 5).map((item, i) => (
                    <span key={i} className="px-2 py-0.5 bg-white border border-indigo-200 rounded text-xs text-indigo-700">
                      {typeof item === 'object' ? JSON.stringify(item).substring(0, 30) : String(item)}
                    </span>
                  ))}
                  {arr.length > 5 && <span className="text-xs text-gray-400">+{arr.length - 5} more</span>}
                </div>
              </div>
            );
          }
          return (
            <div key={key}>
              <span className="text-gray-500">{key}:</span>{' '}
              <span className="text-indigo-700 font-medium">
                {typeof value === 'boolean' ? (value ? '✓ Yes' : '✗ No') : String(value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Main StepWizard component
 * 
 * This component is FLOW-AGNOSTIC. It works with any recipe from QUERY_RECIPES.
 * Pass a flowId (recipe ID) and it will build and execute that wizard.
 */
export default function StepWizard({
  flowId = 'lineage_downstream',  // Default to downstream lineage recipe
  entity,
  availableTables = [],
  database,
  schema,
  onComplete,
  onCancel,
  onUseSql,
}) {
  // Get SystemConfig for config-driven entity resolution
  const systemConfig = useConfig();
  
  // Get the flow from the global registry (built from recipes)
  const flow = getWizardFlow(flowId);
  
  // Check for saved state on mount
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const savedStateRef = useRef(null);
  
  // Step result cache - keyed by step index + inputs hash
  const stepResultCacheRef = useRef({});
  
  // Initialize wizard state with SystemConfig (or restored state)
  const [wizardState, setWizardState] = useState(() => {
    // Check for saved state first
    const saved = loadWizardState(flowId);
    if (saved && saved.currentStepIndex > 0) {
      savedStateRef.current = saved;
      // We'll show resume prompt in useEffect
    }
    
    // Get db/schema from SystemConfig if not provided
    const queryDefaults = systemConfig?.queryDefaults || {};
    const defaultDb = database || queryDefaults.metadataDb || 'FIELD_METADATA';
    const defaultSchema = schema || queryDefaults.metadataSchema || 'PUBLIC';
    
    const initialInputs = flow?.buildInitialInputs?.(entity, availableTables, systemConfig?.config) || {};
    return createWizardState(flowId, {
      ...initialInputs,
      database: defaultDb,
      schema: defaultSchema,
      // Pass SystemConfig through to steps
      systemConfig: systemConfig?.config,
    });
  });
  
  const [isRunning, setIsRunning] = useState(false);
  const [currentResults, setCurrentResults] = useState(null);
  const [currentError, setCurrentError] = useState(null);
  
  const { executeQuery } = useQuery();
  
  // Check for saved state and show resume prompt
  useEffect(() => {
    if (savedStateRef.current && savedStateRef.current.currentStepIndex > 0) {
      setShowResumePrompt(true);
    }
  }, []);
  
  // Persist state on changes (debounced)
  useEffect(() => {
    if (wizardState.currentStepIndex > 0 || wizardState.stepResults.length > 0) {
      persistWizardState(flowId, wizardState);
    }
  }, [flowId, wizardState]);
  
  // Handle resume from saved state
  const handleResume = useCallback(() => {
    if (savedStateRef.current) {
      setWizardState(prev => ({
        ...prev,
        currentStepIndex: savedStateRef.current.currentStepIndex,
        inputs: { ...prev.inputs, ...savedStateRef.current.inputs },
        stepResults: savedStateRef.current.stepResults || [],
      }));
      savedStateRef.current = null;
    }
    setShowResumePrompt(false);
  }, []);
  
  // Handle start fresh
  const handleStartFresh = useCallback(() => {
    clearWizardState();
    savedStateRef.current = null;
    setShowResumePrompt(false);
  }, []);
  
  // Get current step
  const currentStep = useMemo(() => {
    return flow?.steps?.[wizardState.currentStepIndex] || null;
  }, [flow, wizardState.currentStepIndex]);
  
  // Generate SQL for current step
  const currentSql = useMemo(() => {
    if (!currentStep?.buildQuery) return '';
    return currentStep.buildQuery(entity, wizardState.inputs);
  }, [currentStep, entity, wizardState.inputs]);
  
  // Check if should skip current step
  useEffect(() => {
    if (currentStep?.shouldSkip?.(wizardState.inputs)) {
      // Auto-skip this step
      handleSkip();
    }
  }, [currentStep, wizardState.inputs]);
  
  // Run the current step
  const handleRunStep = useCallback(async () => {
    if (!currentSql || isRunning) return;
    
    setIsRunning(true);
    setCurrentError(null);
    setCurrentResults(null);
    
    try {
      const results = await executeQuery(currentSql, {
        database: wizardState.inputs.database,
        schema: wizardState.inputs.schema,
        timeout: 30,
      });
      
      // FIX: Properly handle null results (returned when not connected or query fails)
      if (!results) {
        // executeQuery already set the error via its internal state
        // but we need to capture it here for display
        setCurrentError('Query failed. Check your connection and try again.');
        setCurrentResults(null);
      } else if (results.error) {
        setCurrentError(results.error);
        setCurrentResults(null);
      } else if (results.rows && results.rows.length >= 0) {
        // Valid results with rows array
        setCurrentResults(results);
        setCurrentError(null);
      } else {
        // Unexpected response format
        console.warn('Unexpected query result format:', results);
        setCurrentError('Unexpected response format from query');
        setCurrentResults(null);
      }
    } catch (err) {
      setCurrentError(err.message || 'Query execution failed');
      setCurrentResults(null);
    } finally {
      setIsRunning(false);
    }
  }, [currentSql, executeQuery, wizardState.inputs, isRunning]);
  
  // Handle cancel - clear persisted state (moved up for proper ordering)
  const handleCancel = useCallback(() => {
    clearWizardState();
    onCancel?.();
  }, [onCancel]);
  
  // Handle complete - clear persisted state (moved up - must be defined before handleContinue)
  const handleComplete = useCallback((result) => {
    clearWizardState();
    onComplete?.(result);
  }, [onComplete]);
  
  // Continue to next step
  const handleContinue = useCallback(() => {
    if (!currentResults) return;
    
    // Extract data for next step with validation
    let extractedData = {};
    try {
      extractedData = currentStep?.extractDataForNext?.(currentResults) || {};
      
      // Validate extracted data shape (basic validation)
      if (extractedData && typeof extractedData !== 'object') {
        console.warn('extractDataForNext returned non-object, using empty object');
        extractedData = {};
      }
    } catch (err) {
      console.error('Error in extractDataForNext:', err);
      extractedData = {};
    }
    
    // Cache the current step results
    const cacheKey = `step-${wizardState.currentStepIndex}`;
    stepResultCacheRef.current[cacheKey] = {
      results: currentResults,
      extractedData,
    };
    
    const stepResult = {
      success: true,
      results: currentResults,
      extractedData,
    };
    
    const newState = advanceWizard(wizardState, stepResult, flow);
    setWizardState(newState);
    setCurrentResults(null);
    setCurrentError(null);
    
    // Check if flow is complete
    if (newState.isComplete) {
      // Generate final SQL
      const finalStep = flow.steps[flow.steps.length - 1];
      const finalSql = finalStep?.buildQuery?.(entity, newState.inputs) || '';
      handleComplete({ sql: finalSql, inputs: newState.inputs });
    }
  }, [currentResults, currentStep, wizardState, flow, entity, handleComplete]);
  
  // Skip current step
  const handleSkip = useCallback(() => {
    const stepResult = {
      success: true,
      results: null,
      extractedData: {},
      skipped: true,
    };
    
    const newState = advanceWizard(wizardState, stepResult, flow);
    setWizardState(newState);
    setCurrentResults(null);
    setCurrentError(null);
  }, [wizardState, flow]);
  
  // Go back to previous step (preserve cached results)
  const handleBack = useCallback(() => {
    if (wizardState.currentStepIndex === 0) return;
    
    const prevIndex = wizardState.currentStepIndex - 1;
    
    // Cache current step results if we have them
    if (currentResults) {
      const cacheKey = `step-${wizardState.currentStepIndex}`;
      stepResultCacheRef.current[cacheKey] = {
        results: currentResults,
        extractedData: currentStep?.extractDataForNext?.(currentResults) || {},
      };
    }
    
    setWizardState(prev => ({
      ...prev,
      currentStepIndex: prevIndex,
      // Don't slice stepResults - keep them for forward navigation
    }));
    
    // Restore cached results for previous step
    const prevCacheKey = `step-${prevIndex}`;
    const cachedPrev = stepResultCacheRef.current[prevCacheKey];
    if (cachedPrev) {
      setCurrentResults(cachedPrev.results);
    } else {
      setCurrentResults(null);
    }
    setCurrentError(null);
  }, [wizardState.currentStepIndex, currentResults, currentStep]);
  
  // Use current SQL in editor
  const handleUseSql = useCallback(() => {
    onUseSql?.(currentSql);
  }, [currentSql, onUseSql]);

  if (!flow) {
    return (
      <div className="p-4 text-center text-red-600">
        Unknown flow: {flowId}
      </div>
    );
  }
  
  // Show resume prompt if we have saved state
  if (showResumePrompt && savedStateRef.current) {
    const savedStep = savedStateRef.current.currentStepIndex + 1;
    const totalSteps = flow.steps.length;
    
    return (
      <div className="flex flex-col items-center justify-center h-full bg-white rounded-lg border border-gray-200 p-8">
        <div className="text-center max-w-md">
          <div className="p-3 bg-indigo-100 rounded-full w-fit mx-auto mb-4">
            <Info className="text-indigo-600" size={32} />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Resume Previous Session?
          </h3>
          <p className="text-gray-600 mb-6">
            You have a saved wizard session at step {savedStep} of {totalSteps}.
            Would you like to continue where you left off?
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleStartFresh}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Start Fresh
            </button>
            <button
              onClick={handleResume}
              className="px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
            >
              Resume Session
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  const isLastStep = wizardState.currentStepIndex === flow.steps.length - 1;
  const canGoBack = wizardState.currentStepIndex > 0;
  const canContinue = currentResults && !currentError && !isLastStep;
  const canFinish = currentResults && !currentError && isLastStep;
  
  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-lg">
            <GitBranch size={20} />
          </div>
          <div>
            <h3 className="font-semibold">{flow.label}</h3>
            <p className="text-sm text-indigo-100">{flow.description}</p>
          </div>
        </div>
      </div>
      
      {/* Progress */}
      <StepProgress 
        steps={flow.steps} 
        currentIndex={wizardState.currentStepIndex}
        stepResults={wizardState.stepResults}
      />
      
      {/* Current step content */}
      <div className="flex-1 overflow-y-auto p-4">
        {currentStep && (
          <>
            {/* Step header */}
            <div className="mb-4">
              <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                {(() => {
                  const Icon = STEP_ICONS[currentStep.id] || Code;
                  return <Icon size={20} className="text-indigo-600" />;
                })()}
                {currentStep.title}
              </h4>
              <p className="text-sm text-gray-600 mt-1">{currentStep.description}</p>
            </div>
            
            {/* SQL Preview */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Generated SQL</span>
                <button
                  onClick={handleUseSql}
                  className="text-xs text-indigo-600 hover:text-indigo-700"
                >
                  Open in Editor →
                </button>
              </div>
              <SqlPreview sql={currentSql} />
            </div>
            
            {/* Run button */}
            {!currentResults && !currentError && (
              <div className="flex justify-center mb-4">
                <button
                  onClick={handleRunStep}
                  disabled={isRunning}
                  className={`
                    inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-white
                    transition-all
                    ${isRunning 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg hover:shadow-xl'}
                  `}
                >
                  {isRunning ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play size={18} />
                      Run This Step
                    </>
                  )}
                </button>
              </div>
            )}
            
            {/* Error */}
            {currentError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <XCircle className="text-red-600 shrink-0 mt-0.5" size={18} />
                  <div>
                    <h5 className="font-medium text-red-800">Query Failed</h5>
                    <p className="text-sm text-red-700 mt-1">{currentError}</p>
                    <button
                      onClick={() => {
                        setCurrentError(null);
                      }}
                      className="text-sm text-red-600 hover:text-red-700 mt-2 underline"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Results */}
            {currentResults && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="text-emerald-600" size={18} />
                  <span className="text-sm font-medium text-emerald-700">
                    Step completed! {currentResults.rows?.length || 0} rows returned
                  </span>
                </div>
                
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <ResultsPreview results={currentResults} />
                </div>
                
                {/* Extracted data */}
                {currentStep.extractDataForNext && (
                  <ExtractedData 
                    data={currentStep.extractDataForNext(currentResults)}
                    title="Extracted for next step"
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Footer with navigation */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
        <div>
          {canGoBack && (
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              <ChevronLeft size={16} />
              Back
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {currentStep?.optional && !currentResults && (
            <button
              onClick={handleSkip}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              <SkipForward size={14} />
              Skip
            </button>
          )}
          
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          
          {canContinue && (
            <button
              onClick={handleContinue}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
            >
              Continue
              <ChevronRight size={16} />
            </button>
          )}
          
          {canFinish && (
            <button
              onClick={() => {
                // Pass the final SQL to the editor
                onUseSql?.(currentSql);
                handleComplete({ sql: currentSql, inputs: wizardState.inputs });
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium"
            >
              <Check size={16} />
              Use This Query
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

