/**
 * Evaluation Dashboard
 * 
 * Main dashboard for metadata evaluation and assessment.
 * Shows signal coverage, quality quadrants, and gap analysis.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  createScoreEngine, 
  createGapEngine,
  createMDLHAssetFetcher,
  SIGNAL_DEFINITIONS,
  WORKSTREAM_DEFINITIONS,
} from '../../../evaluation';
import { useConnection, useQuery } from '../../../hooks/useSnowflake';
import { useMdlhContext } from '../../../context/MdlhContext';
import { DEFAULT_DATABASE, DEFAULT_SCHEMA } from '../../../data/constants';
import { MetadataAssistantWizard } from '../assistant/MetadataAssistantWizard';
import { ModelBuilder } from '../modelBuilder/ModelBuilder';
import { Sparkles, X, LayoutGrid, Target } from 'lucide-react';
import { createLogger } from '../../../utils/logger';

// =============================================================================
// QUADRANT COLORS
// =============================================================================

const QUADRANT_COLORS = {
  HH: { bg: 'var(--color-success-bg)', border: 'var(--color-success)', label: 'High Impact, High Quality' },
  HL: { bg: 'var(--color-error-bg)', border: 'var(--color-error)', label: 'High Impact, Low Quality' },
  LH: { bg: 'var(--color-info-bg)', border: 'var(--color-info)', label: 'Low Impact, High Quality' },
  LL: { bg: 'var(--color-neutral-bg)', border: 'var(--color-neutral)', label: 'Low Impact, Low Quality' },
  HU: { bg: 'var(--color-warning-bg)', border: 'var(--color-warning)', label: 'High Impact, Unknown Quality' },
  LU: { bg: 'var(--color-neutral-bg)', border: 'var(--color-neutral-dark)', label: 'Low Impact, Unknown Quality' },
};

// =============================================================================
// SIGNAL CARD COMPONENT
// =============================================================================

function SignalCard({ signal, coverage, total }) {
  const percent = total > 0 ? Math.round((coverage / total) * 100) : 0;
  const severityColors = {
    HIGH: 'var(--color-error)',
    MED: 'var(--color-warning)',
    LOW: 'var(--color-info)',
  };
  
  return (
    <div className="signal-card">
      <div className="signal-card-header">
        <span className="signal-name">{signal.displayName}</span>
        <span 
          className="signal-severity"
          style={{ color: severityColors[signal.severity] }}
        >
          {signal.severity}
        </span>
      </div>
      <div className="signal-progress">
        <div 
          className="signal-progress-bar"
          style={{ 
            width: `${percent}%`,
            backgroundColor: percent >= 70 ? 'var(--color-success)' : 
                           percent >= 40 ? 'var(--color-warning)' : 'var(--color-error)'
          }}
        />
      </div>
      <div className="signal-stats">
        <span>{coverage} / {total}</span>
        <span className="signal-percent">{percent}%</span>
      </div>
    </div>
  );
}

// =============================================================================
// QUADRANT CHART COMPONENT
// =============================================================================

function QuadrantChart({ distribution, onQuadrantClick }) {
  const total = Object.values(distribution).reduce((sum, v) => sum + v, 0);
  
  const quadrants = [
    { id: 'HL', label: 'High Priority', position: { top: 0, left: 0 } },
    { id: 'HH', label: 'Champions', position: { top: 0, left: '50%' } },
    { id: 'LL', label: 'Low Priority', position: { top: '50%', left: 0 } },
    { id: 'LH', label: 'Well-Documented', position: { top: '50%', left: '50%' } },
  ];
  
  return (
    <div className="quadrant-chart">
      <div className="quadrant-labels">
        <span className="quadrant-y-label">Impact →</span>
        <span className="quadrant-x-label">Quality →</span>
      </div>
      <div className="quadrant-grid">
        {quadrants.map(q => {
          const count = distribution[q.id] || 0;
          const percent = total > 0 ? Math.round((count / total) * 100) : 0;
          const colors = QUADRANT_COLORS[q.id];
          
          return (
            <div
              key={q.id}
              className="quadrant-cell"
              style={{ 
                top: q.position.top, 
                left: q.position.left,
                backgroundColor: colors.bg,
                borderColor: colors.border,
              }}
              onClick={() => onQuadrantClick?.(q.id)}
            >
              <span className="quadrant-count">{count}</span>
              <span className="quadrant-label">{q.label}</span>
              <span className="quadrant-percent">{percent}%</span>
            </div>
          );
        })}
      </div>
      {/* Unknown quadrants summary */}
      {(distribution.HU > 0 || distribution.LU > 0) && (
        <div className="quadrant-unknown">
          <span>Unknown Quality: {distribution.HU + distribution.LU} assets</span>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// GAP LIST COMPONENT
// =============================================================================

function GapList({ gaps, onGapClick }) {
  if (!gaps || gaps.length === 0) {
    return (
      <div className="gap-list-empty">
        <span>No gaps identified! 🎉</span>
      </div>
    );
  }
  
  return (
    <div className="gap-list">
      {gaps.slice(0, 10).map(gap => (
        <div 
          key={gap.id || gap.signalId}
          className="gap-item"
          onClick={() => onGapClick?.(gap)}
        >
          <div className="gap-header">
            <span className="gap-signal">{gap.signalDisplayName}</span>
            <span className={`gap-priority priority-${gap.priority}`}>
              P{gap.priority}
            </span>
          </div>
          <div className="gap-stats">
            <span>{gap.affectedAssetCount} assets affected</span>
            <span className="gap-coverage">{gap.coveragePercent}% coverage</span>
          </div>
          <div className="gap-workstream">
            {gap.workstreamDisplayName}
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// MAIN DASHBOARD COMPONENT
// =============================================================================

export function EvaluationDashboard({ database, schema, discoveredTables = [] }) {
  const log = createLogger('EvaluationDashboard');
  // Use the MDLH Explorer's existing connection hooks
  const { status: connectionStatus, loading: connectionLoading } = useConnection();
  const { context: mdlhContext, capabilities } = useMdlhContext();
  const { executeQuery: rawExecuteQuery } = useQuery(connectionStatus);
  
  // Derive connection state from status
  const isConnected = connectionStatus?.connected === true;
  const connection = {
    database: mdlhContext?.database || connectionStatus?.database || DEFAULT_DATABASE,
    schema: mdlhContext?.schema || connectionStatus?.schema || DEFAULT_SCHEMA,
  };
  
  // Wrapper to match expected interface
  const executeQuery = useCallback(async (sql) => {
    const result = await rawExecuteQuery(sql, {
      database: connection.database,
      schema: connection.schema,
    });
    return { rows: result?.rows || [], columns: result?.columns || [] };
  }, [rawExecuteQuery, connection.database, connection.schema]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [assessmentData, setAssessmentData] = useState(null);
  const [showWizard, setShowWizard] = useState(false);
  
  // Scope configuration
  const [scope, setScope] = useState({
    level: 'tenant',
    scopeId: null,
    assetTypes: ['Table', 'View'],
    sampleSize: 500,
  });
  
  /**
   * Run assessment
   */
  const runAssessment = useCallback(async () => {
    if (!isConnected) {
      setError('Not connected to Snowflake. Please connect first.');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      log.info('Assessment run started', {
        database: connection.database,
        schema: connection.schema,
        scope,
        profile: capabilities?.profile,
      });
      // Create fetcher and engines
      const fetcher = createMDLHAssetFetcher(
        { database: connection.database, schema: 'PUBLIC', capabilities },
        executeQuery
      );
      const scoreEngine = createScoreEngine();
      const gapEngine = createGapEngine();
      
      // Fetch assets
      const assets = await fetcher.fetchAssets(scope);
      log.info('Assessment assets fetched', { count: assets.length });
      
      if (assets.length === 0) {
        setError('No assets found matching the scope. Check your connection and try again.');
        setLoading(false);
        return;
      }
      
      // Compute scores
      const scores = scoreEngine.computeScores(assets);
      const quadrantDistribution = scoreEngine.getQuadrantDistribution(scores);
      const highPriorityAssets = scoreEngine.getHighPriorityAssets(scores);
      log.info('Assessment scoring complete', {
        scoreCount: scores.length,
        quadrantDistribution,
        highPriorityCount: highPriorityAssets.length,
      });
      
      // Analyze gaps
      const { assetGaps, aggregatedGaps, summary } = gapEngine.analyzeGaps(assets);
      log.info('Assessment gaps computed', {
        gapCount: aggregatedGaps.length,
        affectedAssets: assetGaps.length,
        summary,
      });
      
      // Compute signal coverage
      const signalCoverage = {};
      for (const signal of SIGNAL_DEFINITIONS) {
        const fieldsWithSignal = assets.filter(a => {
          const signals = scoreEngine.constructor.prototype.evaluateSignals 
            ? { OWNERSHIP: true } // Simplified
            : {};
          return true; // Placeholder
        });
        // For now, estimate from gap data
        const gap = aggregatedGaps.find(g => g.signalId === signal.id);
        signalCoverage[signal.id] = gap 
          ? assets.length - gap.affectedAssetCount 
          : assets.length;
      }
      
      setAssessmentData({
        assets,
        scores,
        quadrantDistribution,
        highPriorityAssets,
        aggregatedGaps,
        assetGaps,
        summary,
        signalCoverage,
        timestamp: new Date(),
      });
    } catch (err) {
      log.error('Assessment failed', { error: err.message });
      setError(err.message || 'Assessment failed');
    } finally {
      setLoading(false);
    }
  }, [isConnected, connection, executeQuery, scope]);
  
  /**
   * Handle quadrant click
   */
  const handleQuadrantClick = (quadrantId) => {
    console.log('Clicked quadrant:', quadrantId);
    // TODO: Open filtered asset list
  };
  
  /**
   * Handle gap click
   */
  const handleGapClick = (gap) => {
    console.log('Clicked gap:', gap);
    // TODO: Open gap detail / remediation view
  };
  
  // Track which view is active: 'dashboard' or 'modelBuilder'
  const [activeView, setActiveView] = useState('dashboard');
  
  // If showing model builder, render it full-screen
  if (activeView === 'modelBuilder') {
    return (
      <div className="evaluation-dashboard" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Minimal header with back button */}
        <div className="evaluation-header" style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
          <button 
            className="btn btn-secondary"
            onClick={() => setActiveView('dashboard')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            ← Back to Dashboard
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          <ModelBuilder 
            database={database}
            schema={schema}
            discoveredTables={discoveredTables}
          />
        </div>
        
        <style>{`
          .evaluation-dashboard {
            background: var(--color-bg);
            min-height: 100%;
          }
          .evaluation-header {
            background: var(--color-surface);
          }
          .btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 16px;
            border-radius: 6px;
            font-weight: 500;
            font-size: 14px;
            cursor: pointer;
            border: none;
            transition: all 0.15s ease;
          }
          .btn-secondary {
            background: var(--color-surface);
            color: var(--color-text);
            border: 1px solid var(--color-border);
          }
          .btn-secondary:hover {
            background: var(--color-bg-hover);
          }
        `}</style>
      </div>
    );
  }
  
  return (
    <div className="evaluation-dashboard">
      {/* Header */}
      <div className="evaluation-header">
        <div className="evaluation-title">
          <h1>Metadata Evaluation</h1>
          <p>Assess metadata quality and identify gaps</p>
        </div>
        <div className="evaluation-actions">
          <button 
            className="btn btn-secondary"
            onClick={() => setActiveView('modelBuilder')}
          >
            <LayoutGrid size={14} />
            Model Builder
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => setShowWizard(true)}
          >
            <Sparkles size={14} />
            Modeling Assistant
          </button>
          <button 
            className="btn btn-primary"
            onClick={runAssessment}
            disabled={loading || !isConnected}
          >
            {loading ? 'Assessing...' : 'Run Assessment'}
          </button>
        </div>
      </div>
      
      {/* Wizard Modal */}
      {showWizard && (
        <div className="wizard-modal-overlay">
          <div className="wizard-modal">
            <MetadataAssistantWizard 
              onComplete={(project) => {
                setShowWizard(false);
                console.log('Project created:', project);
              }}
              onClose={() => setShowWizard(false)}
            />
          </div>
        </div>
      )}
      
      {/* Connection Status */}
      {!isConnected && (
        <div className="evaluation-warning">
          <span>⚠️ Not connected to Snowflake. Please connect via Settings to run an assessment.</span>
        </div>
      )}
      
      {/* Error */}
      {error && (
        <div className="evaluation-error">
          <span>❌ {error}</span>
        </div>
      )}
      
      {/* Loading */}
      {loading && (
        <div className="evaluation-loading">
          <div className="spinner" />
          <span>Running assessment...</span>
        </div>
      )}
      
      {/* Results */}
      {assessmentData && !loading && (
        <div className="evaluation-results">
          {/* Summary Cards */}
          <div className="evaluation-summary">
            <div className="summary-card">
              <span className="summary-value">{assessmentData.assets.length}</span>
              <span className="summary-label">Assets Assessed</span>
            </div>
            <div className="summary-card">
              <span className="summary-value">{assessmentData.summary.assetsWithGaps}</span>
              <span className="summary-label">With Gaps</span>
            </div>
            <div className="summary-card">
              <span className="summary-value">{assessmentData.highPriorityAssets.length}</span>
              <span className="summary-label">High Priority</span>
            </div>
            <div className="summary-card">
              <span className="summary-value">{assessmentData.aggregatedGaps.length}</span>
              <span className="summary-label">Gap Types</span>
            </div>
          </div>
          
          {/* Main Grid */}
          <div className="evaluation-grid">
            {/* Quadrant Chart */}
            <div className="evaluation-section">
              <h2>Quality Quadrants</h2>
              <QuadrantChart 
                distribution={assessmentData.quadrantDistribution}
                onQuadrantClick={handleQuadrantClick}
              />
            </div>
            
            {/* Signal Coverage */}
            <div className="evaluation-section">
              <h2>Signal Coverage</h2>
              <div className="signal-grid">
                {SIGNAL_DEFINITIONS.map(signal => (
                  <SignalCard
                    key={signal.id}
                    signal={signal}
                    coverage={assessmentData.signalCoverage[signal.id] || 0}
                    total={assessmentData.assets.length}
                  />
                ))}
              </div>
            </div>
            
            {/* Top Gaps */}
            <div className="evaluation-section">
              <h2>Top Gaps</h2>
              <GapList 
                gaps={assessmentData.aggregatedGaps}
                onGapClick={handleGapClick}
              />
            </div>
          </div>
          
          {/* Timestamp */}
          <div className="evaluation-footer">
            <span>Last assessed: {assessmentData.timestamp.toLocaleString()}</span>
          </div>
        </div>
      )}
      
      {/* Empty State */}
      {!assessmentData && !loading && isConnected && (
        <div className="evaluation-empty">
          <div className="empty-icon">📊</div>
          <h2>Ready to Assess</h2>
          <p>Click "Run Assessment" to analyze your metadata quality.</p>
          <p className="empty-hint">
            Assessment will fetch up to {scope.sampleSize} {scope.assetTypes.join(' and ')} assets
            and evaluate them against 10 quality signals.
          </p>
        </div>
      )}
      
      {/* Styles */}
      <style>{`
        .evaluation-dashboard {
          padding: 24px;
          max-width: 1400px;
          margin: 0 auto;
        }
        
        .evaluation-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
        }
        
        .evaluation-title h1 {
          margin: 0 0 4px 0;
          font-size: 24px;
          font-weight: 600;
        }
        
        .evaluation-title p {
          margin: 0;
          color: var(--color-text-secondary);
        }
        
        .evaluation-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .evaluation-warning,
        .evaluation-error {
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 16px;
        }
        
        .evaluation-warning {
          background: var(--color-warning-bg);
          border: 1px solid var(--color-warning);
        }
        
        .evaluation-error {
          background: var(--color-error-bg);
          border: 1px solid var(--color-error);
        }
        
        .evaluation-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 48px;
          gap: 16px;
        }
        
        .evaluation-summary {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        
        .summary-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          padding: 16px;
          text-align: center;
        }
        
        .summary-value {
          display: block;
          font-size: 32px;
          font-weight: 600;
          color: var(--color-primary);
        }
        
        .summary-label {
          display: block;
          font-size: 12px;
          color: var(--color-text-secondary);
          margin-top: 4px;
        }
        
        .evaluation-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        
        .evaluation-section {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          padding: 16px;
        }
        
        .evaluation-section h2 {
          margin: 0 0 16px 0;
          font-size: 16px;
          font-weight: 600;
        }
        
        /* Quadrant Chart */
        .quadrant-chart {
          position: relative;
        }
        
        .quadrant-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
          gap: 4px;
          height: 200px;
        }
        
        .quadrant-cell {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          border: 2px solid;
          cursor: pointer;
          transition: transform 0.1s;
        }
        
        .quadrant-cell:hover {
          transform: scale(1.02);
        }
        
        .quadrant-count {
          font-size: 24px;
          font-weight: 600;
        }
        
        .quadrant-label {
          font-size: 11px;
          opacity: 0.8;
        }
        
        .quadrant-percent {
          font-size: 12px;
          font-weight: 500;
        }
        
        .quadrant-unknown {
          margin-top: 8px;
          font-size: 12px;
          color: var(--color-text-secondary);
          text-align: center;
        }
        
        /* Signal Cards */
        .signal-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        
        .signal-card {
          padding: 12px;
          border: 1px solid var(--color-border);
          border-radius: 6px;
        }
        
        .signal-card-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        
        .signal-name {
          font-weight: 500;
          font-size: 13px;
        }
        
        .signal-severity {
          font-size: 10px;
          font-weight: 600;
        }
        
        .signal-progress {
          height: 6px;
          background: var(--color-border);
          border-radius: 3px;
          overflow: hidden;
        }
        
        .signal-progress-bar {
          height: 100%;
          transition: width 0.3s;
        }
        
        .signal-stats {
          display: flex;
          justify-content: space-between;
          margin-top: 4px;
          font-size: 11px;
          color: var(--color-text-secondary);
        }
        
        .signal-percent {
          font-weight: 500;
        }
        
        /* Gap List */
        .gap-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 300px;
          overflow-y: auto;
        }
        
        .gap-list-empty {
          padding: 24px;
          text-align: center;
          color: var(--color-success);
        }
        
        .gap-item {
          padding: 12px;
          border: 1px solid var(--color-border);
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.1s;
        }
        
        .gap-item:hover {
          background: var(--color-hover);
        }
        
        .gap-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
        }
        
        .gap-signal {
          font-weight: 500;
        }
        
        .gap-priority {
          font-size: 11px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 4px;
        }
        
        .gap-priority.priority-1 {
          background: var(--color-error-bg);
          color: var(--color-error);
        }
        
        .gap-priority.priority-2 {
          background: var(--color-warning-bg);
          color: var(--color-warning);
        }
        
        .gap-priority.priority-3 {
          background: var(--color-info-bg);
          color: var(--color-info);
        }
        
        .gap-stats {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: var(--color-text-secondary);
        }
        
        .gap-workstream {
          font-size: 11px;
          color: var(--color-text-tertiary);
          margin-top: 4px;
        }
        
        /* Empty State */
        .evaluation-empty {
          text-align: center;
          padding: 64px 24px;
        }
        
        .empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }
        
        .evaluation-empty h2 {
          margin: 0 0 8px 0;
        }
        
        .evaluation-empty p {
          margin: 0;
          color: var(--color-text-secondary);
        }
        
        .empty-hint {
          font-size: 12px;
          margin-top: 12px !important;
        }
        
        .evaluation-footer {
          margin-top: 16px;
          text-align: right;
          font-size: 12px;
          color: var(--color-text-tertiary);
        }
        
        .btn {
          padding: 8px 16px;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
          border: none;
          transition: background 0.1s;
        }
        
        .btn-primary {
          background: var(--color-primary);
          color: white;
        }
        
        .btn-primary:hover:not(:disabled) {
          background: var(--color-primary-dark);
        }
        
        .btn-secondary {
          background: white;
          color: var(--color-text);
          border: 1px solid var(--color-border);
          display: flex;
          align-items: center;
          gap: 6px;
        }
        
        .btn-secondary:hover {
          background: var(--color-hover);
          border-color: var(--color-primary);
          color: var(--color-primary);
        }
        
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        /* Wizard Modal */
        .wizard-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        
        .wizard-modal {
          background: white;
          border-radius: 12px;
          width: 100%;
          max-width: 900px;
          max-height: 90vh;
          overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        }
        
        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid var(--color-border);
          border-top-color: var(--color-primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default EvaluationDashboard;
