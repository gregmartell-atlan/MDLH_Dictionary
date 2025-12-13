# MDLH Lineage Wizard - Code Export

Generated: 2025-12-06

## Overview

This export contains all the code for the multi-step Lineage Discovery Wizard feature. The wizard guides users through 4 steps to build lineage queries:

1. **Discover Lineage Tables** - Find PROCESS tables in the schema
2. **Examine Table Structure** - Understand column names and types
3. **Find Assets to Trace** - Sample data and find GUIDs
4. **Trace Lineage** - Build the final lineage query

## Known Issues

1. **ARRAY column handling**: `inputs` and `outputs` in PROCESS_ENTITY are `ARRAY<OBJECT>` types. Standard string functions like `LIKE` and `ARRAY_TO_STRING` don't work. Fixed to use `TO_VARCHAR()`.

2. **Column name casing**: Snowflake's `SHOW TABLES` returns lowercase column names (`name`), but code was looking for uppercase. Fixed with fallback checks.

3. **Data extraction**: The `extractDataForNext` functions need to handle both uppercase and lowercase column names from different Snowflake commands.

---

## File 1: `src/queryFlows/stepFlows/types.js`

```javascript
/**
 * Multi-Step Query Flow Types
 * 
 * Defines the architecture for guided, step-by-step query wizards
 * that help users build complex queries incrementally.
 */

/**
 * @typedef {Object} FlowStepResult
 * @property {boolean} success - Whether the step executed successfully
 * @property {Object} results - Query results (columns, rows)
 * @property {Object} extractedData - Data extracted for next step
 * @property {string} [error] - Error message if failed
 */

/**
 * @typedef {Object} FlowStep
 * @property {string} id - Unique step identifier
 * @property {string} title - Display title for this step
 * @property {string} description - What this step does
 * @property {boolean} [optional] - Whether this step can be skipped
 * @property {function(EntityContext, Object, string[]): string} buildQuery - Generates SQL for this step
 * @property {function(Object): Object} [extractDataForNext] - Extracts data from results for next step
 * @property {string} [nextStep] - ID of next step (null = final)
 * @property {function(Object): boolean} [shouldSkip] - Condition to auto-skip this step
 * @property {string} [skipMessage] - Message shown when step is skipped
 */

/**
 * @typedef {Object} MultiStepFlow
 * @property {string} id - Flow identifier (e.g., 'LINEAGE_WIZARD')
 * @property {string} label - Display name
 * @property {string} description - Flow description
 * @property {string} icon - Icon name
 * @property {string[]} supportedEntityTypes - Entity types this flow supports
 * @property {FlowStep[]} steps - Ordered list of steps
 * @property {function(EntityContext): Object} buildInitialInputs - Creates initial inputs from entity
 */

/**
 * @typedef {Object} WizardState
 * @property {string} flowId - Current flow ID
 * @property {number} currentStepIndex - Current step (0-based)
 * @property {Object} inputs - Accumulated inputs from all steps
 * @property {FlowStepResult[]} stepResults - Results from each completed step
 * @property {boolean} isComplete - Whether the flow is finished
 * @property {string} [finalSql] - The final generated SQL
 */

export const WIZARD_STATUS = {
  IDLE: 'idle',
  RUNNING_STEP: 'running_step',
  AWAITING_INPUT: 'awaiting_input',
  STEP_COMPLETE: 'step_complete',
  FLOW_COMPLETE: 'flow_complete',
  ERROR: 'error',
};

/**
 * Create initial wizard state
 * @param {string} flowId 
 * @param {Object} initialInputs 
 * @returns {WizardState}
 */
export function createWizardState(flowId, initialInputs = {}) {
  return {
    flowId,
    currentStepIndex: 0,
    inputs: { ...initialInputs },
    stepResults: [],
    isComplete: false,
    finalSql: null,
    status: WIZARD_STATUS.IDLE,
  };
}

/**
 * Advance wizard to next step
 * @param {WizardState} state 
 * @param {FlowStepResult} stepResult 
 * @param {MultiStepFlow} flow 
 * @returns {WizardState}
 */
export function advanceWizard(state, stepResult, flow) {
  const newInputs = {
    ...state.inputs,
    ...(stepResult.extractedData || {}),
  };
  
  const newStepResults = [...state.stepResults, stepResult];
  const nextIndex = state.currentStepIndex + 1;
  const isComplete = nextIndex >= flow.steps.length;
  
  return {
    ...state,
    currentStepIndex: nextIndex,
    inputs: newInputs,
    stepResults: newStepResults,
    isComplete,
    status: isComplete ? WIZARD_STATUS.FLOW_COMPLETE : WIZARD_STATUS.STEP_COMPLETE,
  };
}
```

---

## File 2: `src/queryFlows/stepFlows/lineageWizard.js`

```javascript
/**
 * Lineage Discovery Wizard
 * 
 * A multi-step flow that guides users through:
 * 1. Discovering available lineage/process tables
 * 2. Examining the table structure
 * 3. Finding an asset to trace
 * 4. Building and running the final lineage query
 */

/**
 * @type {import('./types').MultiStepFlow}
 */
export const LINEAGE_WIZARD = {
  id: 'LINEAGE_WIZARD',
  label: 'Lineage Discovery Wizard',
  description: 'Step-by-step guide to trace asset lineage',
  icon: 'GitBranch',
  supportedEntityTypes: ['TABLE', 'VIEW', 'COLUMN', 'PROCESS', 'UNKNOWN'],
  
  buildInitialInputs: (entity, availableTables = []) => ({
    entityGuid: entity?.guid,
    entityName: entity?.name,
    entityType: entity?.type,
    database: entity?.database || 'FIELD_METADATA',
    schema: entity?.schema || 'PUBLIC',
    direction: 'DOWNSTREAM',
    availableTables,
  }),
  
  steps: [
    // Step 1: Discover process/lineage tables
    {
      id: 'discover_tables',
      title: 'Step 1: Discover Lineage Tables',
      description: 'First, let\'s find tables that contain lineage data (PROCESS tables store lineage relationships).',
      buildQuery: (entity, inputs) => {
        const db = inputs.database || 'FIELD_METADATA';
        const schema = inputs.schema || 'PUBLIC';
        return `-- Step 1: Find lineage/process tables in your schema
SHOW TABLES LIKE '%PROCESS%' IN ${db}.${schema};

-- Alternative: Show all entity tables
-- SHOW TABLES LIKE '%_ENTITY' IN ${db}.${schema};`;
      },
      extractDataForNext: (results) => {
        // Look for PROCESS_ENTITY or similar
        // SHOW TABLES returns lowercase column names
        const rows = results?.rows || [];
        const getName = (r) => r.name || r.NAME || r['name'] || r['NAME'];
        
        const processTable = rows.find(r => {
          const name = getName(r);
          return name?.toUpperCase()?.includes('PROCESS_ENTITY') ||
                 name?.toUpperCase() === 'PROCESS_ENTITY';
        });
        const processTableName = processTable ? getName(processTable) : rows[0] ? getName(rows[0]) : null;
        
        return {
          processTable: processTableName,
          discoveredTables: rows.map(r => getName(r)).filter(Boolean),
          hasProcessTable: !!processTableName,
        };
      },
      nextStep: 'examine_structure',
    },
    
    // Step 2: Examine table structure
    {
      id: 'examine_structure',
      title: 'Step 2: Examine Table Structure',
      description: 'Now let\'s see what columns are available in the process table to understand the lineage data model.',
      shouldSkip: (inputs) => !inputs.processTable,
      skipMessage: 'No process table found. You may need to check your schema configuration.',
      buildQuery: (entity, inputs) => {
        const table = inputs.processTable || 'PROCESS_ENTITY';
        const db = inputs.database || 'FIELD_METADATA';
        const schema = inputs.schema || 'PUBLIC';
        return `-- Step 2: Examine the structure of ${table}
DESCRIBE TABLE ${db}.${schema}.${table};

-- This shows you the column names and types
-- Look for columns like: INPUTS, OUTPUTS, GUID, NAME, QUALIFIEDNAME`;
      },
      extractDataForNext: (results) => {
        const columns = results?.rows?.map(r => r.column_name || r.COLUMN_NAME) || [];
        const hasInputs = columns.some(c => c?.toUpperCase() === 'INPUTS');
        const hasOutputs = columns.some(c => c?.toUpperCase() === 'OUTPUTS');
        const hasGuid = columns.some(c => c?.toUpperCase() === 'GUID');
        
        return {
          processColumns: columns,
          hasInputsColumn: hasInputs,
          hasOutputsColumn: hasOutputs,
          hasGuidColumn: hasGuid,
          lineageModel: hasInputs && hasOutputs ? 'inputs_outputs' : 'unknown',
        };
      },
      nextStep: 'sample_data',
    },
    
    // Step 3: Sample some data to find GUIDs
    {
      id: 'sample_data',
      title: 'Step 3: Find Assets to Trace',
      description: 'Let\'s look at some actual lineage data and find an asset GUID you can trace.',
      buildQuery: (entity, inputs) => {
        const table = inputs.processTable || 'PROCESS_ENTITY';
        const db = inputs.database || 'FIELD_METADATA';
        const schema = inputs.schema || 'PUBLIC';
        
        // If we have an entity GUID, search for it
        if (entity?.guid) {
          return `-- Step 3: Look for your asset in lineage data
-- Your asset GUID: ${entity.guid}
-- Note: inputs/outputs are ARRAY<OBJECT>, use TO_VARCHAR to convert for search

SELECT 
    guid AS process_guid,
    name AS process_name,
    ARRAY_SIZE(inputs) AS input_count,
    ARRAY_SIZE(outputs) AS output_count
FROM ${db}.${schema}.${table}
WHERE 
    TO_VARCHAR(inputs) ILIKE '%${entity.guid}%'
    OR TO_VARCHAR(outputs) ILIKE '%${entity.guid}%'
LIMIT 10;`;
        }
        
        // Otherwise just sample
        return `-- Step 3: Sample some lineage data to find assets
-- Note: inputs/outputs are ARRAY<OBJECT> types

SELECT 
    guid AS process_guid,
    name AS process_name,
    ARRAY_SIZE(inputs) AS input_count,
    ARRAY_SIZE(outputs) AS output_count
FROM ${db}.${schema}.${table}
WHERE ARRAY_SIZE(inputs) > 0 OR ARRAY_SIZE(outputs) > 0
LIMIT 10;

-- Tip: Click on a row to explore its lineage`;
      },
      extractDataForNext: (results) => {
        const rows = results?.rows || [];
        // Extract GUIDs from inputs/outputs (they're often JSON arrays)
        const allGuids = new Set();
        
        rows.forEach(row => {
          // Try to parse inputs/outputs as JSON
          try {
            const inputs = JSON.parse(row.inputs || row.INPUTS || '[]');
            const outputs = JSON.parse(row.outputs || row.OUTPUTS || '[]');
            inputs.forEach(i => {
              if (i.guid) allGuids.add(i.guid);
              if (i.uniqueAttributes?.qualifiedName) allGuids.add(i.uniqueAttributes.qualifiedName);
            });
            outputs.forEach(o => {
              if (o.guid) allGuids.add(o.guid);
              if (o.uniqueAttributes?.qualifiedName) allGuids.add(o.uniqueAttributes.qualifiedName);
            });
          } catch (e) {
            // Not JSON, might be string format
          }
          
          // Also capture the process GUID itself
          if (row.guid || row.GUID || row.process_guid) {
            allGuids.add(row.guid || row.GUID || row.process_guid);
          }
        });
        
        return {
          sampleGuids: Array.from(allGuids).slice(0, 10),
          sampleRows: rows.slice(0, 5),
          hasLineageData: rows.length > 0,
        };
      },
      nextStep: 'build_lineage_query',
    },
    
    // Step 4: Build the final lineage query
    {
      id: 'build_lineage_query',
      title: 'Step 4: Trace Lineage',
      description: 'Now let\'s build the full lineage query! This recursive CTE will trace dependencies.',
      buildQuery: (entity, inputs) => {
        const table = inputs.processTable || 'PROCESS_ENTITY';
        const db = inputs.database || 'FIELD_METADATA';
        const schema = inputs.schema || 'PUBLIC';
        const direction = inputs.direction || 'DOWNSTREAM';
        const guid = entity?.guid || inputs.sampleGuids?.[0] || '<YOUR_ASSET_GUID>';
        
        const directionColumn = direction === 'UPSTREAM' ? 'inputs' : 'outputs';
        const oppositeColumn = direction === 'UPSTREAM' ? 'outputs' : 'inputs';
        const directionLabel = direction === 'UPSTREAM' ? 'upstream' : 'downstream';
        
        return `-- Step 4: Full Lineage Query - ${direction} dependencies
-- Starting from: ${entity?.name || guid}
-- Direction: ${directionLabel}
-- Note: inputs/outputs are ARRAY<OBJECT>, using TO_VARCHAR for search

-- Find processes where your asset appears
SELECT 
    p.guid AS process_guid,
    p.name AS process_name,
    ARRAY_SIZE(p.inputs) AS input_count,
    ARRAY_SIZE(p.outputs) AS output_count
FROM ${db}.${schema}.${table} p
WHERE TO_VARCHAR(p.${oppositeColumn}) ILIKE '%${guid}%'
LIMIT 20;

-- To see the actual linked assets, use LATERAL FLATTEN:
-- SELECT 
--     p.guid AS process_guid,
--     p.name AS process_name,
--     f.value:guid::VARCHAR AS linked_asset_guid,
--     f.value:typeName::VARCHAR AS linked_asset_type
-- FROM ${db}.${schema}.${table} p,
-- LATERAL FLATTEN(input => p.${directionColumn}) f
-- WHERE TO_VARCHAR(p.${oppositeColumn}) ILIKE '%${guid}%'
-- LIMIT 50;`;
      },
      extractDataForNext: null, // Final step
      nextStep: null,
    },
  ],
};

/**
 * Get the current step from wizard state
 * @param {import('./types').WizardState} state 
 * @returns {import('./types').FlowStep | null}
 */
export function getCurrentStep(state) {
  return LINEAGE_WIZARD.steps[state.currentStepIndex] || null;
}

/**
 * Check if wizard can proceed to next step
 * @param {import('./types').WizardState} state 
 * @returns {boolean}
 */
export function canProceed(state) {
  const currentStep = getCurrentStep(state);
  if (!currentStep) return false;
  
  const lastResult = state.stepResults[state.stepResults.length - 1];
  return lastResult?.success && currentStep.nextStep !== null;
}

export default LINEAGE_WIZARD;
```

---

## File 3: `src/queryFlows/stepFlows/index.js`

```javascript
/**
 * Step Flows Module
 * 
 * Multi-step query wizards that guide users through complex query building.
 */

export * from './types';
export { LINEAGE_WIZARD, getCurrentStep, canProceed } from './lineageWizard';

// Export all wizard flows
export const WIZARD_FLOWS = {
  LINEAGE_WIZARD: () => import('./lineageWizard').then(m => m.LINEAGE_WIZARD),
};
```

---

## File 4: `src/components/StepWizard.jsx`

```jsx
/**
 * StepWizard Component
 * 
 * A guided multi-step query wizard that helps users build complex queries
 * incrementally, with each step providing context and data for the next.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
} from 'lucide-react';
import { createWizardState, advanceWizard, WIZARD_STATUS } from '../queryFlows/stepFlows/types';
import { LINEAGE_WIZARD } from '../queryFlows/stepFlows/lineageWizard';
import { useQuery } from '../hooks/useSnowflake';

// Map flow IDs to flow definitions
const WIZARD_FLOWS = {
  LINEAGE_WIZARD: LINEAGE_WIZARD,
};

// Step icons
const STEP_ICONS = {
  discover_tables: Search,
  examine_structure: Table,
  sample_data: Sparkles,
  build_lineage_query: GitBranch,
};

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
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopy?.();
  };
  
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

/**
 * Results preview table
 */
function ResultsPreview({ results, maxRows = 5 }) {
  if (!results?.rows?.length) {
    return (
      <div className="text-center py-6 text-gray-500">
        <AlertCircle className="mx-auto mb-2" size={24} />
        <p>No results returned</p>
      </div>
    );
  }
  
  const columns = results.columns || Object.keys(results.rows[0] || {});
  const rows = results.rows.slice(0, maxRows);
  
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col, i) => (
              <th key={i} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {typeof col === 'object' ? col.name : col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              {columns.map((col, j) => {
                const colName = typeof col === 'object' ? col.name : col;
                const value = row[colName] ?? row[colName.toUpperCase()] ?? row[colName.toLowerCase()];
                const displayValue = typeof value === 'object' ? JSON.stringify(value).substring(0, 50) + '...' : String(value ?? '');
                return (
                  <td key={j} className="px-3 py-2 text-gray-700 max-w-xs truncate" title={String(value ?? '')}>
                    {displayValue}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {results.rows.length > maxRows && (
        <p className="text-xs text-gray-500 mt-2 text-center">
          Showing {maxRows} of {results.rows.length} rows
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
 */
export default function StepWizard({
  flowId = 'LINEAGE_WIZARD',
  entity,
  availableTables = [],
  database,
  schema,
  onComplete,
  onCancel,
  onUseSql,
}) {
  const flow = WIZARD_FLOWS[flowId];
  
  // Initialize wizard state
  const [wizardState, setWizardState] = useState(() => {
    const initialInputs = flow?.buildInitialInputs?.(entity, availableTables) || {};
    return createWizardState(flowId, {
      ...initialInputs,
      database: database || initialInputs.database,
      schema: schema || initialInputs.schema,
    });
  });
  
  const [isRunning, setIsRunning] = useState(false);
  const [currentResults, setCurrentResults] = useState(null);
  const [currentError, setCurrentError] = useState(null);
  
  const { executeQuery } = useQuery();
  
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
      
      if (results?.error) {
        setCurrentError(results.error);
        setCurrentResults(null);
      } else {
        setCurrentResults(results);
        setCurrentError(null);
      }
    } catch (err) {
      setCurrentError(err.message || 'Query execution failed');
    } finally {
      setIsRunning(false);
    }
  }, [currentSql, executeQuery, wizardState.inputs, isRunning]);
  
  // Continue to next step
  const handleContinue = useCallback(() => {
    if (!currentResults) return;
    
    // Extract data for next step
    const extractedData = currentStep?.extractDataForNext?.(currentResults) || {};
    
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
      onComplete?.({ sql: finalSql, inputs: newState.inputs });
    }
  }, [currentResults, currentStep, wizardState, flow, entity, onComplete]);
  
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
  
  // Go back to previous step
  const handleBack = useCallback(() => {
    if (wizardState.currentStepIndex === 0) return;
    
    setWizardState(prev => ({
      ...prev,
      currentStepIndex: prev.currentStepIndex - 1,
      stepResults: prev.stepResults.slice(0, -1),
    }));
    setCurrentResults(null);
    setCurrentError(null);
  }, [wizardState.currentStepIndex]);
  
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
            onClick={onCancel}
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
                onComplete?.({ sql: currentSql, inputs: wizardState.inputs });
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
```

---

## Integration Points

The wizard is integrated into `FlyoutQueryEditor.jsx` via:

1. **Import**: `import StepWizard from './StepWizard';`
2. **State**: `const [wizardMode, setWizardMode] = useState(null);`
3. **Handler in QueryFlowMenu**: `onOpenWizard={handleOpenWizard}`
4. **Conditional render**: When `wizardMode` is set, render `<StepWizard />` instead of the editor

The `QueryFlowMenu.jsx` component shows the "Guided Lineage Wizard" option with the "Step-by-Step" badge.

---

## Recommendations for Review

1. **Test with your actual Snowflake schema** - The SQL generation makes assumptions about column names and types that may differ

2. **Add more robust column name handling** - Consider querying `INFORMATION_SCHEMA.COLUMNS` to get actual column names before building queries

3. **Consider LATERAL FLATTEN** - For ARRAY<OBJECT> columns, LATERAL FLATTEN is the proper way to unnest and query

4. **Add error recovery** - If a step fails, provide alternative queries or manual input options

5. **Schema introspection step** - Consider adding a "schema introspection" step that dynamically discovers the actual column structure before building queries

