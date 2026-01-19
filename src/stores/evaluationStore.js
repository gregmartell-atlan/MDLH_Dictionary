/**
 * Evaluation Store
 * 
 * Manages state for metadata evaluation including:
 * - Assessment sessions and results
 * - Signal scores and gap analysis
 * - Scope configuration
 * 
 * Uses Zustand for state management with persistence.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * @typedef {Object} AssessmentSession
 * @property {string} id
 * @property {string} name
 * @property {Date} createdAt
 * @property {Date} updatedAt
 * @property {'draft' | 'running' | 'complete' | 'error'} status
 * @property {AssessmentScope} scope
 * @property {AssessmentResults | null} results
 * @property {string} [error]
 */

/**
 * @typedef {Object} AssessmentScope
 * @property {'tenant' | 'connection' | 'database' | 'schema' | 'domain'} level
 * @property {string | null} scopeId
 * @property {string[]} assetTypes
 * @property {number} sampleSize
 * @property {Record<string, any>} [filters]
 */

/**
 * @typedef {Object} AssessmentResults
 * @property {number} totalAssets
 * @property {Object[]} scores - Array of SubjectScore objects
 * @property {Record<string, number>} quadrantDistribution
 * @property {Object[]} aggregatedGaps
 * @property {Object} summary
 * @property {Record<string, number>} signalCoverage
 * @property {Date} completedAt
 */

const initialScope = {
  level: 'tenant',
  scopeId: null,
  assetTypes: ['Table', 'View'],
  sampleSize: 500,
  filters: {},
};

export const useEvaluationStore = create(
  persist(
    (set, get) => ({
      // =========================================================================
      // STATE
      // =========================================================================
      
      // Sessions
      sessions: [],
      activeSessionId: null,
      
      // Current assessment state
      currentScope: { ...initialScope },
      isAssessing: false,
      assessmentError: null,
      
      // Last results (for quick access without loading session)
      lastResults: null,
      
      // UI state
      selectedQuadrant: null,
      selectedGapId: null,
      viewMode: 'quadrants', // 'quadrants' | 'signals' | 'gaps' | 'assets'
      
      // =========================================================================
      // SESSION ACTIONS
      // =========================================================================
      
      /**
       * Create a new assessment session
       * @param {string} name
       * @param {AssessmentScope} [scope]
       * @returns {AssessmentSession}
       */
      createSession: (name, scope = null) => {
        const session = {
          id: `session-${Date.now()}`,
          name: name || `Assessment ${new Date().toLocaleDateString()}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'draft',
          scope: scope || { ...get().currentScope },
          results: null,
        };
        
        set(state => ({
          sessions: [session, ...state.sessions],
          activeSessionId: session.id,
        }));
        
        return session;
      },
      
      /**
       * Update a session
       * @param {string} sessionId
       * @param {Partial<AssessmentSession>} updates
       */
      updateSession: (sessionId, updates) => {
        set(state => ({
          sessions: state.sessions.map(s => 
            s.id === sessionId 
              ? { ...s, ...updates, updatedAt: new Date() }
              : s
          ),
        }));
      },
      
      /**
       * Delete a session
       * @param {string} sessionId
       */
      deleteSession: (sessionId) => {
        set(state => ({
          sessions: state.sessions.filter(s => s.id !== sessionId),
          activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId,
        }));
      },
      
      /**
       * Set active session
       * @param {string | null} sessionId
       */
      setActiveSession: (sessionId) => {
        const session = get().sessions.find(s => s.id === sessionId);
        set({
          activeSessionId: sessionId,
          currentScope: session?.scope || { ...initialScope },
          lastResults: session?.results || null,
        });
      },
      
      /**
       * Get active session
       * @returns {AssessmentSession | null}
       */
      getActiveSession: () => {
        const { sessions, activeSessionId } = get();
        return sessions.find(s => s.id === activeSessionId) || null;
      },
      
      // =========================================================================
      // SCOPE ACTIONS
      // =========================================================================
      
      /**
       * Update scope configuration
       * @param {Partial<AssessmentScope>} updates
       */
      updateScope: (updates) => {
        set(state => ({
          currentScope: { ...state.currentScope, ...updates },
        }));
      },
      
      /**
       * Reset scope to defaults
       */
      resetScope: () => {
        set({ currentScope: { ...initialScope } });
      },
      
      /**
       * Set asset types to assess
       * @param {string[]} assetTypes
       */
      setAssetTypes: (assetTypes) => {
        set(state => ({
          currentScope: { ...state.currentScope, assetTypes },
        }));
      },
      
      /**
       * Set sample size
       * @param {number} size
       */
      setSampleSize: (size) => {
        set(state => ({
          currentScope: { ...state.currentScope, sampleSize: size },
        }));
      },
      
      // =========================================================================
      // ASSESSMENT ACTIONS
      // =========================================================================
      
      /**
       * Start assessment
       */
      startAssessment: () => {
        set({ isAssessing: true, assessmentError: null });
        
        // Create or update session
        const activeSession = get().getActiveSession();
        if (activeSession) {
          get().updateSession(activeSession.id, { status: 'running' });
        } else {
          get().createSession();
          get().updateSession(get().activeSessionId, { status: 'running' });
        }
      },
      
      /**
       * Complete assessment with results
       * @param {AssessmentResults} results
       */
      completeAssessment: (results) => {
        const resultsWithTimestamp = {
          ...results,
          completedAt: new Date(),
        };
        
        set({
          isAssessing: false,
          lastResults: resultsWithTimestamp,
        });
        
        const activeSessionId = get().activeSessionId;
        if (activeSessionId) {
          get().updateSession(activeSessionId, {
            status: 'complete',
            results: resultsWithTimestamp,
          });
        }
      },
      
      /**
       * Fail assessment with error
       * @param {string} error
       */
      failAssessment: (error) => {
        set({
          isAssessing: false,
          assessmentError: error,
        });
        
        const activeSessionId = get().activeSessionId;
        if (activeSessionId) {
          get().updateSession(activeSessionId, {
            status: 'error',
            error,
          });
        }
      },
      
      /**
       * Clear last results
       */
      clearResults: () => {
        set({ lastResults: null, assessmentError: null });
      },
      
      // =========================================================================
      // UI ACTIONS
      // =========================================================================
      
      /**
       * Select a quadrant to filter
       * @param {string | null} quadrant
       */
      setSelectedQuadrant: (quadrant) => {
        set({ selectedQuadrant: quadrant });
      },
      
      /**
       * Select a gap to view details
       * @param {string | null} gapId
       */
      setSelectedGap: (gapId) => {
        set({ selectedGapId: gapId });
      },
      
      /**
       * Set view mode
       * @param {'quadrants' | 'signals' | 'gaps' | 'assets'} mode
       */
      setViewMode: (mode) => {
        set({ viewMode: mode });
      },
      
      // =========================================================================
      // COMPUTED GETTERS
      // =========================================================================
      
      /**
       * Get assets in a specific quadrant
       * @param {string} quadrant
       * @returns {Object[]}
       */
      getAssetsByQuadrant: (quadrant) => {
        const results = get().lastResults;
        if (!results?.scores) return [];
        return results.scores.filter(s => s.quadrant === quadrant);
      },
      
      /**
       * Get high priority assets (HL and HU quadrants)
       * @returns {Object[]}
       */
      getHighPriorityAssets: () => {
        const results = get().lastResults;
        if (!results?.scores) return [];
        return results.scores.filter(s => s.quadrant === 'HL' || s.quadrant === 'HU');
      },
      
      /**
       * Get gap by ID
       * @param {string} gapId
       * @returns {Object | undefined}
       */
      getGapById: (gapId) => {
        const results = get().lastResults;
        if (!results?.aggregatedGaps) return undefined;
        return results.aggregatedGaps.find(g => g.id === gapId || g.signalId === gapId);
      },
      
      /**
       * Get recent sessions (last 10)
       * @returns {AssessmentSession[]}
       */
      getRecentSessions: () => {
        return get().sessions.slice(0, 10);
      },
    }),
    {
      name: 'mdlh-evaluation-store',
      partialize: (state) => ({
        sessions: state.sessions.slice(0, 20), // Keep last 20 sessions
        currentScope: state.currentScope,
      }),
    }
  )
);

export default useEvaluationStore;
