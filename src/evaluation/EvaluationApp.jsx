/**
 * EvaluationApp - Main Evaluation Platform Component
 * 
 * This is the entry point for the full evaluation platform ported from
 * atlan-metadata-evaluation. It provides:
 * - V2 Run Dashboard (new consolidated evaluation system)
 * - Integrated with MDLH Explorer's Snowflake connection
 * 
 * Uses MemoryRouter to encapsulate routing within the evaluation tab
 */

import React, { useState, useEffect } from 'react';
import {
  MemoryRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from 'react-router-dom';
import {
  BarChart3,
  Play,
  AlertCircle,
  Database,
  Plus,
  Settings2,
} from 'lucide-react';
import { useConnection } from '../hooks/useSnowflake';
import { 
  configureMDLHBridge, 
} from './services/mdlhBridge';
import { useEvaluationStore } from './stores/evaluationStore';
import { healthApi } from './services/evaluationApi';
import { AssetContextSelector, SELECTION_MODE } from '../components/common/AssetContextSelector';

// V2 Run Components
import { StartScreen } from './components/v2run/StartScreen';
import { 
  RunDashboard, 
  AssessmentView, 
  PlanView, 
  ExportView, 
  ModelView,
  RunRoutesFallback 
} from './components/v2run/RunDashboard';

// ============================================
// STATUS BADGE
// ============================================

function StatusBadge({ status }) {
  const styles = {
    CREATED: 'bg-gray-100 text-gray-700',
    INGESTING: 'bg-blue-100 text-blue-700',
    SCORING: 'bg-purple-100 text-purple-700',
    COMPLETED: 'bg-green-100 text-green-700',
    FAILED: 'bg-red-100 text-red-700',
  };
  
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status] || styles.CREATED}`}>
      {status}
    </span>
  );
}

// ============================================
// EVALUATION HOME - Run List
// ============================================

function EvaluationHome({ database, schema }) {
  // Use individual selectors for better performance
  const runs = useEvaluationStore((state) => state.runs);
  const loading = useEvaluationStore((state) => state.loading);
  const error = useEvaluationStore((state) => state.error);
  const loadRuns = useEvaluationStore((state) => state.loadRuns);
  const deleteRun = useEvaluationStore((state) => state.deleteRun);
  const navigate = useNavigate();
  const [backendReady, setBackendReady] = useState(null);
  const [hasLoadedRuns, setHasLoadedRuns] = useState(false);

  useEffect(() => {
    let cancelled = false;
    healthApi.ready()
      .then(ready => {
        if (!cancelled) setBackendReady(ready);
      })
      .catch(() => {
        if (!cancelled) setBackendReady(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (backendReady && !hasLoadedRuns) {
      setHasLoadedRuns(true);
      loadRuns();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendReady, hasLoadedRuns]);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (confirm('Delete this run and all associated data?')) {
      await deleteRun(id);
    }
  };

  const handleStartNew = () => {
    navigate('/new');
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Metadata Evaluation</h1>
          <p className="text-gray-500 mt-1">
            Assess your metadata catalog against best practices
          </p>
        </div>
        <button
          onClick={handleStartNew}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          New Assessment
        </button>
      </div>

      {/* Backend Status */}
      {backendReady === false && (
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-6 flex items-start gap-3">
          <AlertCircle className="text-yellow-600 mt-0.5" size={20} />
          <div>
            <div className="font-medium text-yellow-800">Evaluation backend unavailable</div>
            <div className="text-sm text-yellow-700 mt-1">
              Make sure the Node.js evaluation API is running on port 8001
            </div>
          </div>
        </div>
      )}

      {/* Connection Context */}
      <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg mb-6 flex items-center gap-3">
        <Database size={18} className="text-gray-500" />
        <span className="text-sm text-gray-600">MDLH Context:</span>
        <span className="font-mono text-sm px-2 py-1 bg-white border rounded">
          {database}.{schema}
        </span>
      </div>

      {/* Runs List */}
      {loading && (
        <div className="text-center py-12 text-gray-500">
          Loading runs...
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {!loading && runs.length === 0 && backendReady && (
        <div className="text-center py-16">
          <BarChart3 size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">No assessment runs yet</h3>
          <p className="text-gray-500 mb-6">
            Start a new assessment to evaluate your metadata catalog
          </p>
          <button
            onClick={handleStartNew}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            <Play size={18} />
            Start Your First Assessment
          </button>
        </div>
      )}

      {!loading && runs.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-4 font-medium text-gray-500 text-sm">Run ID</th>
                <th className="text-left p-4 font-medium text-gray-500 text-sm">Status</th>
                <th className="text-left p-4 font-medium text-gray-500 text-sm">Created</th>
                <th className="text-left p-4 font-medium text-gray-500 text-sm">Scope</th>
                <th className="text-left p-4 font-medium text-gray-500 text-sm">Assets</th>
                <th className="text-right p-4 font-medium text-gray-500 text-sm">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {runs.map(run => (
                <tr
                  key={run.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/run/${run.id}`)}
                >
                  <td className="p-4 font-mono text-sm text-blue-600">{run.id.slice(0, 8)}</td>
                  <td className="p-4">
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="p-4 text-sm text-gray-600">
                    {new Date(run.createdAt).toLocaleString()}
                  </td>
                  <td className="p-4 text-sm font-mono text-gray-600">
                    {run.scope?.database && run.scope?.schema
                      ? `${run.scope.database}.${run.scope.schema}`
                      : '-'}
                  </td>
                  <td className="p-4 text-sm text-gray-600">
                    {run.stats?.assetCount?.toLocaleString() || '-'}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={(e) => handleDelete(run.id, e)}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================
// INNER ROUTES (uses router hooks)
// ============================================

function EvaluationRoutes({ database, schema, isConnected }) {
  return (
    <div className="evaluation-app min-h-full bg-gray-50">
      {/* Connection Warning */}
      {!isConnected && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-3 flex items-center gap-3">
          <AlertCircle size={16} className="text-yellow-600" />
          <span className="text-sm text-yellow-800">
            Connect to Snowflake to run assessments and scans.
          </span>
        </div>
      )}
      
      {/* V2 Routing */}
      <Routes>
        {/* Home - list of runs */}
        <Route 
          index 
          element={<EvaluationHome database={database} schema={schema} />} 
        />
        
        {/* Create new run */}
        <Route path="new" element={<StartScreen />} />
        
        {/* Run dashboard with nested routes */}
        <Route path="run/:id" element={<RunDashboard />}>
          <Route index element={<RunRoutesFallback />} />
          <Route path="assessment" element={<AssessmentView />} />
          <Route path="model" element={<ModelView />} />
          <Route path="plan" element={<PlanView />} />
          <Route path="export" element={<ExportView />} />
        </Route>
        
        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

// ============================================
// MAIN COMPONENT (wraps with MemoryRouter)
// ============================================

export function EvaluationApp({ database: propDatabase, schema: propSchema, discoveredTables = [] }) {
  const { status: connectionStatus } = useConnection();
  const isConnected = connectionStatus?.connected === true;
  
  // Dynamic context selection
  const [selectedContext, setSelectedContext] = useState([]);
  const [showContextSelector, setShowContextSelector] = useState(false);
  
  // Use selected context or fall back to props
  const activeContext = selectedContext.length > 0 ? selectedContext[0] : null;
  const database = activeContext?.database || propDatabase;
  const schema = activeContext?.schema || propSchema;
  
  // Initialize context from props
  useEffect(() => {
    if (propDatabase && propSchema && selectedContext.length === 0) {
      setSelectedContext([{
        database: propDatabase,
        schema: propSchema,
        label: `${propDatabase}.${propSchema}`,
      }]);
    }
  }, [propDatabase, propSchema]);

  // Configure the MDLH bridge when connection changes
  useEffect(() => {
    configureMDLHBridge({
      database,
      schema,
      connected: isConnected,
    });
  }, [database, schema, isConnected]);

  return (
    <MemoryRouter>
      <div data-testid="evaluation-app">
        {/* Context Selector Header */}
        <div className="px-6 pt-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database size={18} className="text-gray-500" />
            <span className="text-sm text-gray-600">MDLH Context:</span>
            <button
              onClick={() => setShowContextSelector(!showContextSelector)}
              className={`font-mono text-sm px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-2 ${
                showContextSelector
                  ? 'bg-slate-100 border-slate-300'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>{database}.{schema}</span>
              <Settings2 size={14} className="text-slate-400" />
            </button>
          </div>
        </div>
        
        {/* Context Selector Dropdown */}
        {showContextSelector && (
          <div className="px-6 pb-4 pt-2">
            <AssetContextSelector
              selectedSchemas={selectedContext}
              onSelectionChange={(newSelection) => {
                setSelectedContext(newSelection);
                if (newSelection.length > 0) {
                  setShowContextSelector(false);
                }
              }}
              selectionMode={SELECTION_MODE.SINGLE_SCHEMA}
              title="Select Assessment Context"
              placeholder="Choose the database and schema to assess"
              defaultExpanded={true}
            />
          </div>
        )}
        
        <EvaluationRoutes 
          database={database} 
          schema={schema} 
          isConnected={isConnected} 
        />
      </div>
    </MemoryRouter>
  );
}

export default EvaluationApp;
