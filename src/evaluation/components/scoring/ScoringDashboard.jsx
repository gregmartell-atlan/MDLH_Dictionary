import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  RefreshCw,
  ShieldCheck,
  Target,
  TrendingUp,
} from 'lucide-react';
import { useConnection, useQuery } from '../../../hooks/useSnowflake';
import { escapeStringValue } from '../../../utils/queryHelpers';
import { normalizeQueryRows } from '../../../utils/queryResults';
import { createLogger } from '../../../utils/logger';

const SCORE_DB = 'METADATA_PLANNING';
const SCORE_SCHEMA = 'SCORE';
const EVIDENCE_SCHEMA = 'EVIDENCE';
const log = createLogger('ScoringDashboard');

const STATUS_COLORS = {
  READY: 'bg-emerald-500',
  IN_PROGRESS: 'bg-amber-500',
  INSUFFICIENT_EVIDENCE: 'bg-slate-400',
  FAILED_REQUIREMENT: 'bg-rose-500',
};

function formatPercent(value) {
  if (value === null || value === undefined) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined) return '—';
  return Number(value).toFixed(digits);
}

function formatCount(value) {
  if (value === null || value === undefined) return '—';
  return Number(value).toLocaleString();
}

function SectionHeader({ title, subtitle, icon: Icon }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm">
        <Icon size={18} />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, hint, tone = 'indigo' }) {
  const toneMap = {
    indigo: 'from-indigo-500/15 via-indigo-500/5 to-transparent text-indigo-700',
    emerald: 'from-emerald-500/15 via-emerald-500/5 to-transparent text-emerald-700',
    amber: 'from-amber-500/15 via-amber-500/5 to-transparent text-amber-700',
    rose: 'from-rose-500/15 via-rose-500/5 to-transparent text-rose-700',
  };
  return (
    <div className={`rounded-2xl border border-slate-200 bg-gradient-to-br ${toneMap[tone]} px-4 py-3`}>
      <div className="text-xs uppercase tracking-widest text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export function ScoringDashboard({ database, schema }) {
  const { status: connectionStatus } = useConnection();
  const isConnected = connectionStatus?.connected === true;
  const { executeQuery } = useQuery(connectionStatus);

  const [runs, setRuns] = useState([]);
  const [activeRunId, setActiveRunId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [summary, setSummary] = useState(null);
  const [statusBreakdown, setStatusBreakdown] = useState([]);
  const [assetTypes, setAssetTypes] = useState([]);
  const [parameterHealth, setParameterHealth] = useState([]);
  const [evidenceUsage, setEvidenceUsage] = useState([]);
  const [evidenceCounts, setEvidenceCounts] = useState([]);
  const [joinabilitySamples, setJoinabilitySamples] = useState([]);

  const loadRuns = useCallback(async () => {
    if (!isConnected) return;
    const sql = `
      SELECT run_id, run_ts, template_id, run_label
      FROM ${SCORE_DB}.${SCORE_SCHEMA}.ASSESSMENT_RUN
      ORDER BY run_ts DESC
      LIMIT 50
    `;
    log.info('Loading runs', { database: SCORE_DB, schema: SCORE_SCHEMA });
    try {
      const result = await executeQuery(sql, { database: SCORE_DB, schema: SCORE_SCHEMA, limit: 1000 });
      const rows = normalizeQueryRows(result);
      setRuns(rows);
      log.info('Runs loaded', { count: rows.length });
      if (!activeRunId && rows.length > 0) {
        setActiveRunId(rows[0].RUN_ID || rows[0].run_id);
      }
    } catch (err) {
      log.error('Failed to load runs', { error: err?.message });
      setError(err?.message || 'Failed to load runs.');
    }
  }, [executeQuery, isConnected, activeRunId]);

  const loadRunData = useCallback(async (runId) => {
    if (!isConnected || !runId) return;
    setLoading(true);
    setError(null);

    try {
      const safeRunId = escapeStringValue(runId);
      log.info('Loading run details', { runId });
      const summarySql = `
        SELECT
          COUNT(*) AS total_assets,
          AVG(quality_score) AS avg_quality,
          AVG(coverage) AS avg_coverage,
          AVG(confidence) AS avg_confidence,
          AVG(qtriplet_score) AS avg_qtriplet
        FROM ${SCORE_DB}.${SCORE_SCHEMA}.ASSESSMENT_RESULT
        WHERE run_id = ${safeRunId}
      `;
      const statusSql = `
        SELECT status, COUNT(*) AS count
        FROM ${SCORE_DB}.${SCORE_SCHEMA}.ASSESSMENT_RESULT
        WHERE run_id = ${safeRunId}
        GROUP BY status
        ORDER BY count DESC
      `;
      const assetSql = `
        SELECT asset_type, COUNT(*) AS count,
          AVG(quality_score) AS avg_quality,
          AVG(coverage) AS avg_coverage
        FROM ${SCORE_DB}.${SCORE_SCHEMA}.ASSESSMENT_RESULT
        WHERE run_id = ${safeRunId}
        GROUP BY asset_type
        ORDER BY count DESC
        LIMIT 25
      `;
      const parameterSql = `
        SELECT parameter_key,
          MAX(required_flag) AS required_flag,
          COUNT(*) AS total,
          SUM(IFF(state='ABSENT',1,0)) AS absent,
          SUM(IFF(state='UNKNOWN',1,0)) AS unknown,
          AVG(score) AS avg_score
        FROM ${SCORE_DB}.${SCORE_SCHEMA}.ASSESSMENT_PARAMETER_RESULT
        WHERE run_id = ${safeRunId}
        GROUP BY parameter_key
        ORDER BY absent DESC, unknown DESC
        LIMIT 30
      `;
      const evidenceSql = `
        SELECT evidence_key_used, COUNT(*) AS usage_count
        FROM ${SCORE_DB}.${SCORE_SCHEMA}.ASSESSMENT_PARAMETER_RESULT
        WHERE run_id = ${safeRunId}
        GROUP BY evidence_key_used
        ORDER BY usage_count DESC
        LIMIT 30
      `;
      const observationSql = `
        SELECT source, evidence_key, COUNT(*) AS row_count, MAX(observation_ts) AS latest_ts
        FROM ${SCORE_DB}.${EVIDENCE_SCHEMA}.EVIDENCE_OBSERVATION
        GROUP BY source, evidence_key
        ORDER BY row_count DESC
        LIMIT 30
      `;
      const joinabilitySql = `
        SELECT asset_key, evidence_key_used, state, score, evidence_value, evidence_confidence
        FROM ${SCORE_DB}.${SCORE_SCHEMA}.ASSESSMENT_PARAMETER_RESULT
        WHERE run_id = ${safeRunId} AND parameter_key = 'TPL_JOINABILITY'
        ORDER BY created_ts DESC
        LIMIT 25
      `;

      const [
        summaryRes,
        statusRes,
        assetRes,
        parameterRes,
        evidenceRes,
        observationRes,
        joinRes,
      ] = await Promise.all([
        executeQuery(summarySql, { database: SCORE_DB, schema: SCORE_SCHEMA, limit: 1000 }),
        executeQuery(statusSql, { database: SCORE_DB, schema: SCORE_SCHEMA, limit: 1000 }),
        executeQuery(assetSql, { database: SCORE_DB, schema: SCORE_SCHEMA, limit: 1000 }),
        executeQuery(parameterSql, { database: SCORE_DB, schema: SCORE_SCHEMA, limit: 1000 }),
        executeQuery(evidenceSql, { database: SCORE_DB, schema: SCORE_SCHEMA, limit: 1000 }),
        executeQuery(observationSql, { database: SCORE_DB, schema: EVIDENCE_SCHEMA, limit: 1000 }),
        executeQuery(joinabilitySql, { database: SCORE_DB, schema: SCORE_SCHEMA, limit: 1000 }),
      ]);

      const summaryRows = normalizeQueryRows(summaryRes);
      const statusRows = normalizeQueryRows(statusRes);
      const assetRows = normalizeQueryRows(assetRes);
      const parameterRows = normalizeQueryRows(parameterRes);
      const evidenceRows = normalizeQueryRows(evidenceRes);
      const observationRows = normalizeQueryRows(observationRes);
      const joinabilityRows = normalizeQueryRows(joinRes);

      setSummary(summaryRows[0] || null);
      setStatusBreakdown(statusRows);
      setAssetTypes(assetRows);
      setParameterHealth(parameterRows);
      setEvidenceUsage(evidenceRows);
      setEvidenceCounts(observationRows);
      setJoinabilitySamples(joinabilityRows);
      log.info('Run details loaded', {
        runId,
        statusRows: statusRows.length,
        assetRows: assetRows.length,
        parameterRows: parameterRows.length,
        evidenceRows: evidenceRows.length,
        observationRows: observationRows.length,
        joinabilityRows: joinabilityRows.length
      });
    } catch (err) {
      log.error('Failed to load run details', { runId, error: err?.message });
      setError(err?.message || 'Failed to load scoring data.');
    } finally {
      setLoading(false);
    }
  }, [executeQuery, isConnected]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    if (activeRunId) {
      loadRunData(activeRunId);
    }
  }, [activeRunId, loadRunData]);

  const activeRun = useMemo(
    () => runs.find((run) => (run.RUN_ID || run.run_id) === activeRunId) || null,
    [runs, activeRunId]
  );

  const totalAssets = summary?.TOTAL_ASSETS ?? summary?.total_assets;
  const avgQuality = summary?.AVG_QUALITY ?? summary?.avg_quality;
  const avgCoverage = summary?.AVG_COVERAGE ?? summary?.avg_coverage;
  const avgConfidence = summary?.AVG_CONFIDENCE ?? summary?.avg_confidence;
  const avgQTriplet = summary?.AVG_QTRIPLET ?? summary?.avg_qtriplet;

  const totalStatusCount = statusBreakdown.reduce(
    (sum, row) => sum + Number(row.COUNT ?? row.count ?? 0),
    0
  );

  return (
    <div className="min-h-full bg-slate-50 text-slate-900">
      <div className="max-w-7xl mx-auto px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Scoring Control Room</p>
            <h1 className="text-3xl font-semibold text-slate-900">Metadata Scoring Dashboard</h1>
          </div>
          <button
            onClick={() => {
              loadRuns();
              if (activeRunId) loadRunData(activeRunId);
            }}
            className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-6">
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <SectionHeader title="Run Context" subtitle="Score runs executed in Snowflake" icon={Database} />
              <div className="space-y-2 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <span>MDLH Context</span>
                  <span className="font-mono text-xs text-slate-800">{database}.{schema}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Scoring DB</span>
                  <span className="font-mono text-xs text-slate-800">{SCORE_DB}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Status</span>
                  <span className={`text-xs font-medium ${isConnected ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>

              <div className="mt-4">
                <label className="text-xs uppercase tracking-widest text-slate-400">Active Run</label>
                <select
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={activeRunId || ''}
                  onChange={(event) => setActiveRunId(event.target.value)}
                >
                  {runs.map((run) => {
                    const id = run.RUN_ID || run.run_id;
                    return (
                      <option key={id} value={id}>
                        {run.RUN_LABEL || run.run_label || 'run'} · {id.slice(0, 8)}
                      </option>
                    );
                  })}
                </select>
                {runs.length === 0 && (
                  <div className="mt-3 text-xs text-slate-500">
                    No scoring runs yet. Run the Snowflake procedures to generate data.
                  </div>
                )}
                {activeRun && (
                  <div className="mt-3 text-xs text-slate-500">
                    <div>Template: {activeRun.TEMPLATE_ID || activeRun.template_id}</div>
                    <div>Run TS: {activeRun.RUN_TS || activeRun.run_ts}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <SectionHeader title="Joinability Spotlight" subtitle="Evidence key used (Snowflake priority)" icon={Target} />
              <div className="space-y-3 text-xs text-slate-600 max-h-[360px] overflow-auto">
                {joinabilitySamples.length === 0 && <div>No joinability evidence yet.</div>}
                {joinabilitySamples.map((row, idx) => (
                  <div key={`${row.ASSET_KEY || row.asset_key}-${idx}`} className="rounded-lg border border-slate-100 p-2">
                    <div className="font-mono text-[11px] text-slate-900">
                      {(row.ASSET_KEY || row.asset_key || '').slice(0, 12)}
                    </div>
                    <div className="mt-1 text-[11px]">
                      {row.EVIDENCE_KEY_USED || row.evidence_key_used || '—'} · {row.STATE || row.state}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      score {row.SCORE ?? row.score ?? '—'} · conf {formatNumber(row.EVIDENCE_CONFIDENCE ?? row.evidence_confidence, 2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              <SummaryCard label="Total Assets" value={formatCount(totalAssets)} hint="Active universe in run" tone="indigo" />
              <SummaryCard label="Avg Quality" value={formatNumber(avgQuality)} hint="Known evidence only" tone="emerald" />
              <SummaryCard label="Avg Coverage" value={formatPercent(avgCoverage)} hint="Known weight / total weight" tone="amber" />
              <SummaryCard label="Q-Triplet" value={formatNumber(avgQTriplet)} hint="Quality × Coverage × Confidence" tone="rose" />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <SectionHeader title="Run Status Distribution" subtitle="Readiness states by asset" icon={Activity} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {statusBreakdown.length === 0 && (
                  <div className="text-sm text-slate-500">No status data available.</div>
                )}
                {statusBreakdown.map((row) => {
                  const status = row.STATUS || row.status;
                  const count = row.COUNT || row.count;
                  const pct = totalStatusCount ? (count / totalStatusCount) * 100 : 0;
                  return (
                    <div key={status} className="rounded-lg border border-slate-100 p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-800">{status}</span>
                        <span className="text-slate-500">{formatCount(count)}</span>
                      </div>
                      <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
                        <div
                          className={`h-2 rounded-full ${STATUS_COLORS[status] || 'bg-slate-300'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{pct.toFixed(1)}%</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <SectionHeader title="Asset Type Coverage" subtitle="Quality & coverage by type" icon={TrendingUp} />
              <div className="space-y-2 text-xs text-slate-600 max-h-[280px] overflow-auto">
                {assetTypes.length === 0 && <div>No asset metrics yet.</div>}
                {assetTypes.map((row) => (
                  <div key={row.ASSET_TYPE || row.asset_type} className="flex items-center justify-between gap-2">
                    <span className="text-slate-700">{row.ASSET_TYPE || row.asset_type}</span>
                    <span className="text-slate-400">count {formatCount(row.COUNT || row.count)}</span>
                    <span className="text-slate-800">q {formatNumber(row.AVG_QUALITY ?? row.avg_quality)}</span>
                      <span className="text-slate-800">cov {formatPercent(row.AVG_COVERAGE ?? row.avg_coverage)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <SectionHeader title="Evidence Inventory" subtitle="Observation volume by key" icon={ShieldCheck} />
              <div className="space-y-2 text-xs text-slate-600 max-h-[280px] overflow-auto">
                {evidenceCounts.length === 0 && <div>No evidence observations yet.</div>}
                {evidenceCounts.map((row) => (
                  <div key={`${row.SOURCE || row.source}-${row.EVIDENCE_KEY || row.evidence_key}`} className="flex items-center justify-between gap-2">
                    <span className="text-slate-700">{row.EVIDENCE_KEY || row.evidence_key}</span>
                    <span className="text-slate-400">{row.SOURCE || row.source}</span>
                    <span className="text-slate-800">{formatCount(row.ROW_COUNT || row.row_count)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <SectionHeader title="Parameter Health" subtitle="Absent & unknown signals" icon={AlertTriangle} />
              <div className="overflow-x-auto">
                <div className="min-w-[720px]">
                  <div className="grid grid-cols-[2fr_repeat(4,1fr)] text-xs uppercase tracking-widest text-slate-400 pb-2">
                    <span>Parameter</span>
                    <span className="text-center">Required</span>
                    <span className="text-center">Absent</span>
                    <span className="text-center">Unknown</span>
                    <span className="text-center">Avg Score</span>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-[340px] overflow-auto text-sm text-slate-600">
                    {parameterHealth.map((row) => {
                      const total = row.TOTAL || row.total || 0;
                      const absent = row.ABSENT || row.absent || 0;
                      const unknown = row.UNKNOWN || row.unknown || 0;
                      return (
                        <div key={row.PARAMETER_KEY || row.parameter_key} className="grid grid-cols-[2fr_repeat(4,1fr)] py-2 items-center">
                          <span className="text-slate-800">{row.PARAMETER_KEY || row.parameter_key}</span>
                          <span className="text-center">{row.REQUIRED_FLAG || row.required_flag ? 'Yes' : 'No'}</span>
                          <span className="text-center text-rose-500">{total ? `${Math.round((absent / total) * 100)}%` : '—'}</span>
                          <span className="text-center text-amber-500">{total ? `${Math.round((unknown / total) * 100)}%` : '—'}</span>
                          <span className="text-center">{formatNumber(row.AVG_SCORE ?? row.avg_score)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <SectionHeader title="Evidence Usage" subtitle="Which keys drive parameter results" icon={CheckCircle2} />
              <div className="grid grid-cols-[2fr_1fr] text-xs uppercase tracking-widest text-slate-400 pb-2">
                <span>Evidence Key Used</span>
                <span className="text-right">Usage</span>
              </div>
              <div className="divide-y divide-slate-100 max-h-[240px] overflow-auto text-sm text-slate-600">
                {evidenceUsage.length === 0 && (
                  <div className="py-2 text-slate-500">No evidence usage yet.</div>
                )}
                {evidenceUsage.map((row) => (
                  <div key={row.EVIDENCE_KEY_USED || row.evidence_key_used || 'unknown'} className="flex items-center justify-between py-2">
                    <span className="text-slate-800">{row.EVIDENCE_KEY_USED || row.evidence_key_used || 'unknown'}</span>
                    <span>{formatCount(row.USAGE_COUNT || row.usage_count)}</span>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                {error}
              </div>
            )}
            {loading && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                Loading scoring metrics...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ScoringDashboard;
