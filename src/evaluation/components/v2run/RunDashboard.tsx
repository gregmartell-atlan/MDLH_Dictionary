/**
 * RunDashboard - Main evaluation run dashboard
 * 
 * Refactored to use consolidated evaluationStore and evaluationApi
 * Per design_review.md: < 300 lines, no inline styles, Tailwind only
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useOutletContext, useParams } from 'react-router-dom';
import { CheckCircle, Loader2, ChevronLeft } from 'lucide-react';
import { useEvaluationStore } from '../../stores/evaluationStore';
import type { DomainScore, Score, Run } from '../../services/evaluationApi';
import { EvidenceDrawer } from './EvidenceDrawer';
import { PlanTimeline } from './PlanTimeline';

// ============================================
// RUN DASHBOARD
// ============================================

export function RunDashboard() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  
  // Use individual selectors to avoid infinite loops
  const currentRun = useEvaluationStore((s) => s.currentRun);
  const loading = useEvaluationStore((s) => s.loading);
  const error = useEvaluationStore((s) => s.error);
  const loadRun = useEvaluationStore((s) => s.loadRun);
  const ingestAndScore = useEvaluationStore((s) => s.ingestAndScore);
  
  const [hasLoadedRun, setHasLoadedRun] = useState(false);
  const [hasTriggeredIngest, setHasTriggeredIngest] = useState(false);

  // Load run on mount
  useEffect(() => {
    if (!id || hasLoadedRun) return;
    setHasLoadedRun(true);
    loadRun(id);
  }, [id, hasLoadedRun, loadRun]);
  
  // Poll for updates while run is in progress
  useEffect(() => {
    if (!id || !currentRun) return;
    if (currentRun.status === 'COMPLETED' || currentRun.status === 'FAILED') return;
    
    const interval = setInterval(() => {
      loadRun(id);
    }, 5000);

    return () => clearInterval(interval);
  }, [id, currentRun?.status, loadRun]);

  // Auto-trigger ingest if run is CREATED
  useEffect(() => {
    if (currentRun?.status === 'CREATED' && id && !hasTriggeredIngest) {
      const scope = currentRun.scope;
      if (scope?.database && scope?.schema) {
        setHasTriggeredIngest(true);
        ingestAndScore({
          database: scope.database,
          schema: scope.schema,
          limit: scope.limit,
        });
      }
    }
  }, [currentRun?.status, currentRun?.scope, id, hasTriggeredIngest, ingestAndScore]);

  if (loading && !currentRun) {
    return (
      <div className="p-8 flex items-center gap-2" role="status" aria-live="polite">
        <Loader2 className="animate-spin" />
        Loading Run...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 p-4 rounded text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!currentRun) {
    return (
      <div className="p-8 text-gray-500">
        Run not found
      </div>
    );
  }

  const isRunning = ['CREATED', 'INGESTING', 'SCORING'].includes(currentRun.status);
  const activeTab = location.pathname.split('/').pop();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" data-testid="run-dashboard">
      <RunHeader run={currentRun} isRunning={isRunning} />
      <RunTabs runId={currentRun.id} activeTab={activeTab} />
      <div className="flex-1 overflow-auto" role="tabpanel" id={`run-panel-${activeTab || 'assessment'}`}>
        <Outlet context={{ run: currentRun }} />
      </div>
    </div>
  );
}

// ============================================
// HEADER COMPONENT
// ============================================

function RunHeader({ run, isRunning }: { run: Run; isRunning: boolean }) {
  return (
    <div className="bg-white border-b px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold">Assessment Run</h1>
        <p className="text-sm text-gray-500">{run.id}</p>
      </div>
      <div className="flex items-center gap-2" role="status" aria-live="polite" aria-label="Run status">
        {isRunning ? (
          <span className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-1 rounded-full text-sm font-medium">
            <Loader2 className="animate-spin" size={16} />
            {run.status}
          </span>
        ) : (
          <span className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1 rounded-full text-sm font-medium">
            <CheckCircle size={16} />
            {run.status}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================
// TABS COMPONENT
// ============================================

function RunTabs({ runId, activeTab }: { runId: string; activeTab?: string }) {
  const tabs = ['assessment', 'model', 'plan', 'export'];
  
  return (
    <div className="px-4 sm:px-8 mt-6">
      <nav className="border-b" aria-label="Run tabs">
        <div className="flex flex-wrap gap-4" role="tablist">
          {tabs.map(tab => (
            <Link
              key={tab}
              to={`/run/${runId}/${tab}`}
              className={`pb-3 px-2 capitalize font-medium ${
                activeTab === tab 
                  ? 'border-b-2 border-blue-600 text-blue-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={`run-panel-${tab}`}
              data-testid={`run-tab-${tab}`}
            >
              {tab}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

// ============================================
// ASSESSMENT VIEW
// ============================================

export function AssessmentView() {
  const { run } = useOutletContext<{ run: Run }>();
  
  // Use individual selectors to avoid re-render loops
  const scores = useEvaluationStore((s) => s.scores);
  const domainScores = useEvaluationStore((s) => s.domainScores);
  const selectedDomainId = useEvaluationStore((s) => s.selectedDomainId);
  const loadScores = useEvaluationStore((s) => s.loadScores);
  const loadDomainScores = useEvaluationStore((s) => s.loadDomainScores);
  const selectDomain = useEvaluationStore((s) => s.selectDomain);
  const gaps = useEvaluationStore((s) => s.gaps);
  
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<{ qualifiedName: string; name: string } | null>(null);
  const [bucketFilter, setBucketFilter] = useState<string | null>(null);
  const [domainAssets, setDomainAssets] = useState<Score[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [hasLoadedScores, setHasLoadedScores] = useState(false);

  useEffect(() => {
    if (run?.id && run?.status === 'COMPLETED' && !hasLoadedScores) {
      setHasLoadedScores(true);
      loadScores();
      loadDomainScores();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.id, run?.status, hasLoadedScores]);

  const grouped = useMemo(() => {
    const buckets: Record<string, DomainScore[]> = {};
    for (const s of domainScores) {
      const quad = mapQuadrantToBucket(s.quadrant);
      buckets[quad] = buckets[quad] ? [...buckets[quad], s] : [s];
    }
    return buckets;
  }, [domainScores]);

  const selectedDomain = selectedDomainId 
    ? domainScores.find(d => d.subjectId === selectedDomainId)
    : null;

  const handleSelectDomain = async (domain: DomainScore) => {
    selectDomain(domain.subjectId);
    setLoadingAssets(true);
    // Filter scores for this domain - in a real impl, we'd call the API
    const filtered = scores.filter(s => s.assetType === domain.subjectId);
    setDomainAssets(filtered);
    setLoadingAssets(false);
  };

  const formatQuality = (qualityScore: number | null, qualityUnknown: boolean): string => {
    if (qualityUnknown || qualityScore === null) return 'UNKNOWN';
    return `${Math.round(qualityScore * 100)}%`;
  };

  if (selectedDomain) {
    return (
      <DomainDrilldown
        domain={selectedDomain}
        assets={domainAssets}
        loading={loadingAssets}
        onBack={() => selectDomain(null)}
        onAssetClick={(asset) => {
          setSelectedAsset({ qualifiedName: asset.qualifiedName || '', name: asset.subjectName || '' });
          setDrawerOpen(true);
        }}
        formatQuality={formatQuality}
      />
    );
  }

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <SummaryCards assetCount={scores.length} gapCount={gaps.length} />
      <ImpactQualityMatrix 
        grouped={grouped} 
        bucketFilter={bucketFilter} 
        onFilterChange={setBucketFilter}
      />
      <DomainScoreTable
        domains={bucketFilter ? (grouped[bucketFilter] || []) : domainScores}
        onSelectDomain={handleSelectDomain}
        formatQuality={formatQuality}
      />
      <EvidenceDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        assetQualifiedName={selectedAsset?.qualifiedName || ''}
        assetName={selectedAsset?.name || ''}
        runId={run.id}
      />
    </div>
  );
}

// Helper: Map quadrant code to bucket name
function mapQuadrantToBucket(quadrant: string): string {
  const map: Record<string, string> = {
    HH: 'HIGH_IMPACT_HIGH_QUALITY',
    HL: 'HIGH_IMPACT_LOW_QUALITY',
    LH: 'LOW_IMPACT_HIGH_QUALITY',
    LL: 'LOW_IMPACT_LOW_QUALITY',
    HU: 'QUALITY_UNKNOWN',
    LU: 'QUALITY_UNKNOWN',
  };
  return map[quadrant] || 'QUALITY_UNKNOWN';
}

// ============================================
// SUB-COMPONENTS (extracted to keep < 300 lines)
// ============================================

function SummaryCards({ assetCount, gapCount }: { assetCount: number; gapCount: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="text-sm text-gray-500">Assets Scanned</div>
        <div className="text-3xl font-bold">{assetCount}</div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="text-sm text-gray-500">Gaps Found</div>
        <div className="text-3xl font-bold text-amber-600">{gapCount}</div>
      </div>
    </div>
  );
}

// Import remaining components from separate file to keep this < 300 lines
export { PlanView, ExportView, ModelView } from './RunViews';
export function RunRoutesFallback() {
  return <Navigate to="assessment" replace />;
}

// Placeholder components - will be in RunViews.tsx
function ImpactQualityMatrix({ grouped, bucketFilter, onFilterChange }: {
  grouped: Record<string, DomainScore[]>;
  bucketFilter: string | null;
  onFilterChange: (filter: string | null) => void;
}) {
  return (
    <div data-testid="assessment-matrix">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-xl font-bold">Impact × Quality Matrix (Domains)</h2>
        {bucketFilter && (
          <button className="text-sm text-blue-600 hover:underline" onClick={() => onFilterChange(null)}>
            Clear filter
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 max-w-3xl mx-auto">
        {['HIGH_IMPACT_LOW_QUALITY', 'HIGH_IMPACT_HIGH_QUALITY', 'LOW_IMPACT_LOW_QUALITY', 'LOW_IMPACT_HIGH_QUALITY'].map(bucket => (
          <button
            key={bucket}
            onClick={() => onFilterChange(bucket)}
            className={`p-4 rounded-lg border transition h-24 flex flex-col justify-between text-left
              ${bucketFilter === bucket ? 'ring-2 ring-blue-500' : ''}
              ${bucket.includes('HIGH_QUALITY') ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}
            `}
          >
            <div className="text-sm font-medium">{bucket.replace(/_/g, ' ')}</div>
            <div className="text-2xl font-bold">{grouped[bucket]?.length || 0}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function DomainScoreTable({ domains, onSelectDomain, formatQuality }: {
  domains: DomainScore[];
  onSelectDomain: (d: DomainScore) => void;
  formatQuality: (q: number | null, u: boolean) => string;
}) {
  return (
    <div className="bg-white rounded-lg shadow overflow-x-auto" data-testid="domain-score-table">
      <table className="min-w-full text-left">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="p-4 font-medium text-gray-500">Domain/System</th>
            <th className="p-4 font-medium text-gray-500">Assets</th>
            <th className="p-4 font-medium text-gray-500">Impact</th>
            <th className="p-4 font-medium text-gray-500">Quality</th>
            <th className="p-4 font-medium text-gray-500">Quadrant</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {domains.map(score => (
            <tr
              key={score.id}
              className="hover:bg-gray-50 cursor-pointer"
              onClick={() => onSelectDomain(score)}
              tabIndex={0}
              role="button"
            >
              <td className="p-4 font-medium text-blue-600">{score.subjectId || 'UNKNOWN'}</td>
              <td className="p-4">{score.assetCount}</td>
              <td className="p-4">{Math.round(score.impactScore * 100)}%</td>
              <td className="p-4">{formatQuality(score.qualityScore, score.qualityUnknown)}</td>
              <td className="p-4">
                <span className="px-2 py-1 rounded text-xs font-bold bg-gray-100">
                  {score.quadrant}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DomainDrilldown({ domain, assets, loading, onBack, onAssetClick, formatQuality }: {
  domain: DomainScore;
  assets: Score[];
  loading: boolean;
  onBack: () => void;
  onAssetClick: (a: Score) => void;
  formatQuality: (q: number | null, u: boolean) => string;
}) {
  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-blue-600 hover:underline">
          <ChevronLeft size={16} /> Back to Matrix
        </button>
        <div className="text-right">
          <h2 className="text-xl font-bold">{domain.subjectId}</h2>
          <p className="text-sm text-gray-500">{domain.assetCount} assets</p>
        </div>
      </div>
      {loading && <div className="text-gray-500">Loading assets...</div>}
      {!loading && assets.length === 0 && <div className="text-gray-500">No assets found</div>}
      {!loading && assets.length > 0 && (
        <div className="space-y-3">
          {assets.map(a => (
            <div
              key={a.subjectId}
              className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
              onClick={() => onAssetClick(a)}
            >
              <div className="font-semibold">{a.subjectName}</div>
              <div className="text-sm text-gray-500">{a.assetType}</div>
              <div className="text-xs text-gray-400 mt-1">
                Impact: {Math.round(a.impactScore * 100)}% | Quality: {formatQuality(a.qualityScore, a.qualityUnknown)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
