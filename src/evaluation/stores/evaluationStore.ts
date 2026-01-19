/**
 * Evaluation Store
 * Consolidated Zustand store for all evaluation state
 * 
 * Per design_review.md:
 * - Use shallow equality for selectors
 * - Provide defaults in store, not with || [] fallbacks
 * - NO `any` types
 * - Proper error handling
 */

import { create } from 'zustand';
import { shallow } from 'zustand/shallow';
import { 
  runApi, 
  catalogApi, 
  planApi, 
  artifactApi,
  type Run,
  type RunScope,
  type ScoringConfig,
  type Score,
  type DomainScore,
  type ScoreSummary,
  type Gap,
  type Plan,
  type Model,
  type Asset,
  type Artifact,
  type Quadrant,
} from '../services/evaluationApi';

// ============================================
// STATE INTERFACE
// ============================================

interface EvaluationState {
  // Run state
  currentRun: Run | null;
  runs: Run[];
  
  // Catalog & Scores
  catalog: Asset[];
  scores: Score[];
  scoreSummary: ScoreSummary | null;
  domainScores: DomainScore[];
  
  // Gaps & Plan
  gaps: Gap[];
  plan: Plan | null;
  modelSummary: Model['summary'] | null;
  
  // Artifacts
  artifacts: Artifact[];
  
  // UI State
  loading: boolean;
  error: string | null;
  selectedDomainId: string | null;
  selectedQuadrant: Quadrant | null;
  evidenceDrawerOpen: boolean;
  
  // Actions - Run lifecycle
  createRun: (scope: RunScope, capabilities?: string[], scoringConfig?: Partial<ScoringConfig>) => Promise<Run>;
  loadRun: (id: string) => Promise<void>;
  loadRuns: () => Promise<void>;
  deleteRun: (id: string) => Promise<void>;
  
  // Actions - Ingestion & Scoring
  ingestAssets: (options?: { database?: string; schema?: string; limit?: number }) => Promise<void>;
  computeScores: () => Promise<void>;
  ingestAndScore: (options?: { database?: string; schema?: string; limit?: number }) => Promise<void>;
  
  // Actions - Gaps & Plan
  loadGaps: () => Promise<void>;
  recomputeGaps: () => Promise<void>;
  loadPlan: () => Promise<void>;
  generatePlan: () => Promise<void>;
  loadModel: () => Promise<void>;
  
  // Actions - Catalog & Scores
  loadCatalog: () => Promise<void>;
  loadScores: () => Promise<void>;
  loadDomainScores: () => Promise<void>;
  
  // Actions - Artifacts
  loadArtifacts: () => Promise<void>;
  generateArtifacts: () => Promise<void>;
  
  // Actions - UI
  selectDomain: (id: string | null) => void;
  selectQuadrant: (quadrant: Quadrant | null) => void;
  openEvidenceDrawer: () => void;
  closeEvidenceDrawer: () => void;
  clearError: () => void;
  reset: () => void;
}

// ============================================
// INITIAL STATE
// ============================================

const initialState = {
  currentRun: null,
  runs: [],
  catalog: [],
  scores: [],
  scoreSummary: null,
  domainScores: [],
  gaps: [],
  plan: null,
  modelSummary: null,
  artifacts: [],
  loading: false,
  error: null,
  selectedDomainId: null,
  selectedQuadrant: null,
  evidenceDrawerOpen: false,
};

// ============================================
// STORE IMPLEMENTATION
// ============================================

export const useEvaluationStore = create<EvaluationState>((set, get) => ({
  ...initialState,

  // ==============================
  // RUN LIFECYCLE
  // ==============================

  createRun: async (scope, capabilities = [], scoringConfig) => {
    set({ loading: true, error: null });
    try {
      const run = await runApi.create(scope, capabilities, scoringConfig);
      set({ 
        currentRun: run, 
        loading: false,
        // Reset related state for new run
        catalog: [],
        scores: [],
        scoreSummary: null,
        domainScores: [],
        gaps: [],
        plan: null,
        modelSummary: null,
        artifacts: [],
      });
      return run;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to create run';
      set({ error: message, loading: false });
      throw e;
    }
  },

  loadRun: async (id) => {
    set({ loading: true, error: null });
    try {
      const run = await runApi.get(id);
      set({ currentRun: run, loading: false });
      
      // Load related data if run is completed
      if (run.status === 'COMPLETED') {
        const store = get();
        await Promise.all([
          store.loadScores(),
          store.loadDomainScores(),
          store.loadGaps(),
          store.loadPlan(),
        ]);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load run';
      set({ error: message, loading: false });
    }
  },

  loadRuns: async () => {
    set({ loading: true, error: null });
    try {
      const runs = await runApi.list();
      set({ runs, loading: false });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load runs';
      set({ error: message, loading: false });
    }
  },

  deleteRun: async (id) => {
    set({ loading: true, error: null });
    try {
      await runApi.delete(id);
      const { currentRun, runs } = get();
      
      // Remove from list
      const updatedRuns = runs.filter(r => r.id !== id);
      
      // Clear current if it was deleted
      if (currentRun?.id === id) {
        set({ 
          ...initialState,
          runs: updatedRuns,
          loading: false,
        });
      } else {
        set({ runs: updatedRuns, loading: false });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to delete run';
      set({ error: message, loading: false });
    }
  },

  // ==============================
  // INGESTION & SCORING
  // ==============================

  ingestAssets: async (options) => {
    const { currentRun } = get();
    if (!currentRun) {
      set({ error: 'No run selected' });
      return;
    }

    set({ loading: true, error: null });
    try {
      await runApi.ingest(currentRun.id, options);
      // Reload run to get updated status
      await get().loadRun(currentRun.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to ingest assets';
      set({ error: message, loading: false });
    }
  },

  computeScores: async () => {
    const { currentRun } = get();
    if (!currentRun) {
      set({ error: 'No run selected' });
      return;
    }

    set({ loading: true, error: null });
    try {
      await runApi.score(currentRun.id);
      await get().loadRun(currentRun.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to compute scores';
      set({ error: message, loading: false });
    }
  },

  ingestAndScore: async (options) => {
    const { currentRun } = get();
    if (!currentRun) {
      set({ error: 'No run selected' });
      return;
    }

    set({ loading: true, error: null });
    try {
      await runApi.ingestAndScore(currentRun.id, options);
      await get().loadRun(currentRun.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to ingest and score';
      set({ error: message, loading: false });
    }
  },

  // ==============================
  // GAPS & PLAN
  // ==============================

  loadGaps: async () => {
    const { currentRun } = get();
    if (!currentRun) return;

    try {
      const gaps = await planApi.getGaps(currentRun.id);
      set({ gaps });
    } catch (e) {
      console.error('Failed to load gaps:', e);
    }
  },

  recomputeGaps: async () => {
    const { currentRun } = get();
    if (!currentRun) {
      set({ error: 'No run selected' });
      return;
    }

    set({ loading: true, error: null });
    try {
      const gaps = await planApi.recomputeGaps(currentRun.id);
      set({ gaps, loading: false });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to recompute gaps';
      set({ error: message, loading: false });
    }
  },

  loadPlan: async () => {
    const { currentRun } = get();
    if (!currentRun) return;

    try {
      const plan = await planApi.getPlan(currentRun.id);
      set({ plan });
    } catch (e) {
      console.error('Failed to load plan:', e);
    }
  },

  generatePlan: async () => {
    const { currentRun } = get();
    if (!currentRun) {
      set({ error: 'No run selected' });
      return;
    }

    set({ loading: true, error: null });
    try {
      const plan = await planApi.generatePlan(currentRun.id);
      set({ plan, loading: false });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to generate plan';
      set({ error: message, loading: false });
    }
  },

  loadModel: async () => {
    const { currentRun } = get();
    if (!currentRun) return;

    set({ loading: true, error: null });
    try {
      const model = await planApi.getModel(currentRun.id);
      set({
        gaps: model.gaps,
        plan: model.plan,
        modelSummary: model.summary,
        loading: false,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load model';
      set({ error: message, loading: false });
    }
  },

  // ==============================
  // CATALOG & SCORES
  // ==============================

  loadCatalog: async () => {
    const { currentRun } = get();
    if (!currentRun) return;

    try {
      const catalog = await catalogApi.getAssets(currentRun.id);
      set({ catalog });
    } catch (e) {
      console.error('Failed to load catalog:', e);
    }
  },

  loadScores: async () => {
    const { currentRun } = get();
    if (!currentRun) return;

    try {
      const result = await catalogApi.getScores(currentRun.id);
      set({ 
        scores: result.scores, 
        scoreSummary: result.summary,
      });
    } catch (e) {
      console.error('Failed to load scores:', e);
    }
  },

  loadDomainScores: async () => {
    const { currentRun } = get();
    if (!currentRun) return;

    try {
      const domainScores = await catalogApi.getDomainScores(currentRun.id);
      set({ domainScores });
    } catch (e) {
      console.error('Failed to load domain scores:', e);
    }
  },

  // ==============================
  // ARTIFACTS
  // ==============================

  loadArtifacts: async () => {
    const { currentRun } = get();
    if (!currentRun) return;

    try {
      const artifacts = await artifactApi.list(currentRun.id);
      set({ artifacts });
    } catch (e) {
      console.error('Failed to load artifacts:', e);
    }
  },

  generateArtifacts: async () => {
    const { currentRun } = get();
    if (!currentRun) {
      set({ error: 'No run selected' });
      return;
    }

    set({ loading: true, error: null });
    try {
      const artifacts = await artifactApi.generate(currentRun.id);
      set({ artifacts, loading: false });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to generate artifacts';
      set({ error: message, loading: false });
    }
  },

  // ==============================
  // UI ACTIONS
  // ==============================

  selectDomain: (id) => set({ selectedDomainId: id }),
  selectQuadrant: (quadrant) => set({ selectedQuadrant: quadrant }),
  openEvidenceDrawer: () => set({ evidenceDrawerOpen: true }),
  closeEvidenceDrawer: () => set({ evidenceDrawerOpen: false }),
  clearError: () => set({ error: null }),
  reset: () => set(initialState),
}));

// ============================================
// SHALLOW SELECTORS (per design_review.md)
// ============================================

/**
 * Select run state with shallow equality
 */
export const useRunState = () => useEvaluationStore(
  s => ({
    currentRun: s.currentRun,
    runs: s.runs,
    loading: s.loading,
    error: s.error,
  }),
  shallow
);

/**
 * Select score state with shallow equality
 */
export const useScoreState = () => useEvaluationStore(
  s => ({
    scores: s.scores,
    scoreSummary: s.scoreSummary,
    domainScores: s.domainScores,
    selectedDomainId: s.selectedDomainId,
    selectedQuadrant: s.selectedQuadrant,
  }),
  shallow
);

/**
 * Select plan state with shallow equality
 */
export const usePlanState = () => useEvaluationStore(
  s => ({
    gaps: s.gaps,
    plan: s.plan,
    modelSummary: s.modelSummary,
  }),
  shallow
);

/**
 * Select UI state
 */
export const useUIState = () => useEvaluationStore(
  s => ({
    loading: s.loading,
    error: s.error,
    evidenceDrawerOpen: s.evidenceDrawerOpen,
  }),
  shallow
);

/**
 * Select actions only (stable reference)
 */
export const useEvaluationActions = () => useEvaluationStore(
  s => ({
    createRun: s.createRun,
    loadRun: s.loadRun,
    loadRuns: s.loadRuns,
    deleteRun: s.deleteRun,
    ingestAssets: s.ingestAssets,
    computeScores: s.computeScores,
    ingestAndScore: s.ingestAndScore,
    loadGaps: s.loadGaps,
    recomputeGaps: s.recomputeGaps,
    loadPlan: s.loadPlan,
    generatePlan: s.generatePlan,
    loadModel: s.loadModel,
    loadCatalog: s.loadCatalog,
    loadScores: s.loadScores,
    loadDomainScores: s.loadDomainScores,
    loadArtifacts: s.loadArtifacts,
    generateArtifacts: s.generateArtifacts,
    selectDomain: s.selectDomain,
    selectQuadrant: s.selectQuadrant,
    openEvidenceDrawer: s.openEvidenceDrawer,
    closeEvidenceDrawer: s.closeEvidenceDrawer,
    clearError: s.clearError,
    reset: s.reset,
  }),
  shallow
);

export default useEvaluationStore;
