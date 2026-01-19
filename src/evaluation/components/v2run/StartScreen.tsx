/**
 * StartScreen - Create a new evaluation run
 * 
 * Refactored to use evaluationStore and connect to MDLH backend
 * Per design_review.md: < 300 lines, Tailwind only
 * 
 * Enhanced with dynamic schema validation to show what signals
 * can be evaluated before starting the run.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Database, RefreshCw, AlertCircle, Settings2, CheckCircle, XCircle, Zap, Eye } from 'lucide-react';
import { useEvaluationStore } from '../../stores/evaluationStore';
import { healthApi, type RunScope, type MethodologyType, type ScoringConfig } from '../../services/evaluationApi';

// Capabilities - could be loaded from a config file
const CAPABILITIES = [
  { id: 'ownership', name: 'Ownership Coverage', group: 'Governance' },
  { id: 'documentation', name: 'Documentation Quality', group: 'Discoverability' },
  { id: 'lineage', name: 'Lineage Completeness', group: 'Trust' },
  { id: 'classification', name: 'Data Classification', group: 'Compliance' },
  { id: 'glossary', name: 'Glossary Linking', group: 'Semantics' },
  { id: 'certification', name: 'Certification Status', group: 'Trust' },
];

// Scoring methodologies
const METHODOLOGIES: { id: MethodologyType; name: string; description: string }[] = [
  { id: 'WEIGHTED_DIMENSIONS', name: 'Weighted Dimensions', description: 'Equal weight across all observable signals (default)' },
  { id: 'QTRIPLET', name: 'Quality Triplet (QTriplet)', description: 'Groups signals into Completeness, Consistency, and Accuracy' },
  { id: 'CHECKLIST', name: 'Checklist', description: 'Pass/fail checklist with required and optional signals' },
  { id: 'MATURITY', name: 'Maturity Model', description: 'Levels 1-5 based on cumulative signal requirements' },
];

export function StartScreen() {
  const navigate = useNavigate();
  const { createRun } = useEvaluationStore();
  
  // Form state
  const [database, setDatabase] = useState('');
  const [schema, setSchema] = useState('');
  const [limit, setLimit] = useState<number>(10000);
  const [selectedCaps, setSelectedCaps] = useState<string[]>([]);
  const [methodology, setMethodology] = useState<MethodologyType>('WEIGHTED_DIMENSIONS');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [impactThreshold, setImpactThreshold] = useState(0.5);
  const [qualityThreshold, setQualityThreshold] = useState(0.7);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendReady, setBackendReady] = useState<boolean | null>(null);
  const [showSchemaPreview, setShowSchemaPreview] = useState(false);
  const [schemaPreview, setSchemaPreview] = useState<{
    columns: string[];
    signals: { signal: string; canEvaluate: boolean; coverage: number }[];
    loading: boolean;
    error: string | null;
  }>({ columns: [], signals: [], loading: false, error: null });
  
  // Connection state from sessionStorage
  const [connection, setConnection] = useState<{
    database?: string;
    schema?: string;
    connected: boolean;
  }>({ connected: false });

  // Check backend health
  useEffect(() => {
    healthApi.ready()
      .then(ready => setBackendReady(ready))
      .catch(() => setBackendReady(false));
  }, []);

  // Load connection from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem('snowflake_session');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setConnection({
          database: parsed.database,
          schema: parsed.schema,
          connected: !!parsed.sessionId,
        });
        // Pre-fill form if connected
        if (parsed.database) setDatabase(parsed.database);
        if (parsed.schema) setSchema(parsed.schema);
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  const handleToggleCap = useCallback((id: string) => {
    setSelectedCaps(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedCaps.length === CAPABILITIES.length) {
      setSelectedCaps([]);
    } else {
      setSelectedCaps(CAPABILITIES.map(c => c.id));
    }
  }, [selectedCaps.length]);

  // Validate schema - check what signals can be evaluated
  const validateSchema = useCallback(async () => {
    if (!database || !schema || !connection.connected) return;
    
    setSchemaPreview(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      // Get session ID from storage
      const stored = sessionStorage.getItem('snowflake_session');
      const sessionId = stored ? JSON.parse(stored).sessionId : null;
      
      if (!sessionId) {
        setSchemaPreview(prev => ({ ...prev, loading: false, error: 'No active session' }));
        return;
      }
      
      // Query INFORMATION_SCHEMA to get columns
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId,
        },
        body: JSON.stringify({
          query: `
            SELECT COLUMN_NAME, DATA_TYPE
            FROM "${database}".INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = '${schema}'
              AND TABLE_NAME = 'ASSETS'
            ORDER BY ORDINAL_POSITION
          `,
          database,
          schema,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch schema');
      }
      
      const data = await response.json();
      const columns: string[] = [];
      
      // Normalize response
      if (data.rows) {
        for (const row of data.rows) {
          const colName = Array.isArray(row) ? row[0] : (row.COLUMN_NAME || row.column_name);
          if (colName) columns.push(colName.toUpperCase());
        }
      }
      
      // Map to signals - simplified version
      const signalColumnMap: Record<string, string[]> = {
        OWNERSHIP: ['OWNERUSERS', 'OWNER_USERS', 'OWNERGROUPS', 'OWNER_GROUPS'],
        SEMANTICS: ['DESCRIPTION', 'README', 'USERDESCRIPTION'],
        LINEAGE: ['HASLINEAGE', 'HAS_LINEAGE', '__HASLINEAGE'],
        SENSITIVITY: ['CLASSIFICATIONNAMES', 'CLASSIFICATION_NAMES', 'TAGS'],
        TRUST: ['CERTIFICATESTATUS', 'CERTIFICATE_STATUS'],
        USAGE: ['POPULARITYSCORE', 'POPULARITY_SCORE'],
      };
      
      const signals = Object.entries(signalColumnMap).map(([signal, requiredCols]) => {
        const foundCols = requiredCols.filter(col => columns.includes(col));
        const canEvaluate = foundCols.length > 0;
        const coverage = requiredCols.length > 0 ? (foundCols.length / requiredCols.length * 100) : 0;
        return { signal, canEvaluate, coverage };
      });
      
      setSchemaPreview({
        columns,
        signals,
        loading: false,
        error: null,
      });
    } catch (e) {
      setSchemaPreview(prev => ({
        ...prev,
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to validate schema',
      }));
    }
  }, [database, schema, connection.connected]);

  const handleStart = async () => {
    if (!database || !schema) {
      setError('Database and schema are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const scope: RunScope = {
        database,
        schema,
        limit: limit || 10000,
      };

      const scoringConfig: Partial<ScoringConfig> = {
        methodology,
        impactThreshold,
        qualityThreshold,
      };

      const run = await createRun(scope, selectedCaps, scoringConfig);
      navigate(`/run/${run.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start run');
    } finally {
      setLoading(false);
    }
  };

  const canStart = database && schema && selectedCaps.length > 0 && !loading;

  return (
    <main className="max-w-2xl mx-auto py-8 sm:py-12 px-4 sm:px-0">
      <h1 className="text-3xl font-bold mb-2">New Assessment Run</h1>
      <p className="text-gray-600 mb-8">
        Evaluate your metadata catalog against best practices
      </p>

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

      {/* Connection Status */}
      {!connection.connected && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-6 flex items-start gap-3">
          <Database className="text-blue-600 mt-0.5" size={20} />
          <div>
            <div className="font-medium text-blue-800">Connect to Snowflake first</div>
            <div className="text-sm text-blue-700 mt-1">
              Use the main connection panel to connect to your MDLH Gold layer
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow space-y-6">
        {/* Scope Section */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Database size={20} />
            MDLH Scope
          </h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="database" className="block text-sm font-medium text-gray-700 mb-1">
                Database *
              </label>
              <input
                id="database"
                type="text"
                value={database}
                onChange={e => setDatabase(e.target.value)}
                placeholder="e.g., ATLAN_MDLH"
                className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                data-testid="scope-database"
              />
            </div>
            <div>
              <label htmlFor="schema" className="block text-sm font-medium text-gray-700 mb-1">
                Schema *
              </label>
              <input
                id="schema"
                type="text"
                value={schema}
                onChange={e => setSchema(e.target.value)}
                placeholder="e.g., GOLD"
                className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                data-testid="scope-schema"
              />
            </div>
          </div>

          <div className="mt-4 flex items-end gap-4">
            <div>
              <label htmlFor="limit" className="block text-sm font-medium text-gray-700 mb-1">
                Asset Limit (optional)
              </label>
              <input
                id="limit"
                type="number"
                value={limit}
                onChange={e => setLimit(parseInt(e.target.value) || 10000)}
                min={100}
                max={50000}
                className="w-32 border rounded-md p-2"
                data-testid="scope-limit"
              />
              <span className="text-sm text-gray-500 ml-2">max 50,000</span>
            </div>
            
            {/* Validate Schema Button */}
            <button
              type="button"
              onClick={() => {
                setShowSchemaPreview(!showSchemaPreview);
                if (!showSchemaPreview && schemaPreview.columns.length === 0) {
                  validateSchema();
                }
              }}
              disabled={!database || !schema || !connection.connected}
              className="px-4 py-2 text-sm border border-gray-300 rounded-md flex items-center gap-2 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Eye size={16} />
              {showSchemaPreview ? 'Hide' : 'Preview'} Schema
            </button>
          </div>
          
          {/* Schema Preview Panel */}
          {showSchemaPreview && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Zap size={16} className="text-amber-500" />
                  Signal Evaluation Preview
                </h3>
                <button
                  type="button"
                  onClick={validateSchema}
                  disabled={schemaPreview.loading}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <RefreshCw size={12} className={schemaPreview.loading ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>
              
              {schemaPreview.error ? (
                <div className="text-sm text-red-600">{schemaPreview.error}</div>
              ) : schemaPreview.loading ? (
                <div className="text-sm text-gray-500 flex items-center gap-2">
                  <RefreshCw size={14} className="animate-spin" />
                  Validating schema...
                </div>
              ) : schemaPreview.signals.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {schemaPreview.signals.map(sig => (
                      <div
                        key={sig.signal}
                        className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 ${
                          sig.canEvaluate
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {sig.canEvaluate ? (
                          <CheckCircle size={14} />
                        ) : (
                          <XCircle size={14} />
                        )}
                        <span className="font-medium">{sig.signal}</span>
                        {sig.canEvaluate && (
                          <span className="text-xs opacity-75">{sig.coverage.toFixed(0)}%</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-xs text-gray-500">
                    Found {schemaPreview.columns.length} columns in ASSETS table.
                    {schemaPreview.signals.filter(s => !s.canEvaluate).length > 0 && (
                      <span className="text-amber-600 ml-1">
                        Some signals cannot be evaluated due to missing columns.
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-500">
                  Enter database and schema, then click to preview available signals.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Scoring Methodology Section */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Settings2 size={20} />
            Scoring Methodology
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {METHODOLOGIES.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMethodology(m.id)}
                className={`p-4 border rounded-lg text-left transition-colors ${
                  methodology === m.id
                    ? 'border-purple-500 bg-purple-50 ring-1 ring-purple-500'
                    : 'border-gray-200 hover:border-purple-300'
                }`}
                aria-pressed={methodology === m.id}
                data-testid={`methodology-${m.id}`}
              >
                <div className="font-medium">{m.name}</div>
                <div className="text-xs text-gray-500 mt-1">{m.description}</div>
              </button>
            ))}
          </div>
          
          {/* Advanced Settings Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="mt-4 text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
          >
            <Settings2 size={14} />
            {showAdvanced ? 'Hide' : 'Show'} advanced thresholds
          </button>
          
          {showAdvanced && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
              <div>
                <label htmlFor="impactThreshold" className="block text-sm font-medium text-gray-700 mb-1">
                  Impact Threshold (High vs Low)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="impactThreshold"
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={impactThreshold}
                    onChange={e => setImpactThreshold(parseFloat(e.target.value))}
                    className="w-40"
                  />
                  <span className="text-sm font-mono">{(impactThreshold * 100).toFixed(0)}%</span>
                </div>
              </div>
              <div>
                <label htmlFor="qualityThreshold" className="block text-sm font-medium text-gray-700 mb-1">
                  Quality Threshold (High vs Low)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="qualityThreshold"
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={qualityThreshold}
                    onChange={e => setQualityThreshold(parseFloat(e.target.value))}
                    className="w-40"
                  />
                  <span className="text-sm font-mono">{(qualityThreshold * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Capabilities Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Select Capabilities</h2>
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {selectedCaps.length === CAPABILITIES.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="list">
            {CAPABILITIES.map(cap => (
              <button
                key={cap.id}
                type="button"
                onClick={() => handleToggleCap(cap.id)}
                className={`p-4 border rounded-lg text-left transition-colors ${
                  selectedCaps.includes(cap.id)
                    ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
                aria-pressed={selectedCaps.includes(cap.id)}
                data-testid={`capability-${cap.id}`}
              >
                <div className="font-medium">{cap.name}</div>
                <div className="text-xs text-gray-500 mt-1">{cap.group}</div>
              </button>
            ))}
          </div>
          
          {selectedCaps.length === 0 && (
            <p className="text-sm text-amber-600 mt-2">
              Select at least one capability to assess
            </p>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 p-3 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Start Button */}
        <button
          onClick={handleStart}
          disabled={!canStart}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          data-testid="start-assessment"
        >
          {loading ? (
            <>
              <RefreshCw size={18} className="animate-spin" />
              Starting...
            </>
          ) : (
            <>
              <Play size={18} />
              Start Assessment
            </>
          )}
        </button>
      </div>

      {/* Help Text */}
      <div className="mt-6 text-sm text-gray-500 space-y-2">
        <p>
          <strong>What happens next:</strong>
        </p>
        <ol className="list-decimal list-inside space-y-1 ml-2">
          <li>Assets are fetched from the MDLH ASSETS table</li>
          <li>Signals are evaluated (ownership, documentation, lineage, etc.)</li>
          <li>Impact and quality scores are computed</li>
          <li>Gaps are identified and remediation plan generated</li>
        </ol>
      </div>
    </main>
  );
}
