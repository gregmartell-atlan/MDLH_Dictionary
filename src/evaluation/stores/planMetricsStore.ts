/**
 * Plan Metrics Store
 *
 * Tracks historical comparison results and quality metrics
 * to show progress towards enrichment plan targets over time
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlanComparisonResult } from '../services/planComparisonEngine';

// ============================================
// TYPES
// ============================================

export interface StoredComparison {
  planId: string;
  timestamp: string;
  result: PlanComparisonResult;
}

export interface PlanTrend {
  planId: string;
  timestamps: string[];
  completionTrend: number[];
  qualityTrend: number[];
  assetsAnalyzed: number[];
}

// ============================================
// STORE
// ============================================

interface PlanMetricsState {
  // Data
  comparisons: StoredComparison[];
  
  // Actions
  storeComparison: (comparison: PlanComparisonResult) => void;
  getLatestComparison: (planId: string) => StoredComparison | null;
  getComparisonHistory: (planId: string, limitDays?: number) => StoredComparison[];
  getTrend: (planId: string) => PlanTrend | null;
  clearComparisons: (planId?: string) => void;
}

export const usePlanMetricsStore = create<PlanMetricsState>()(
  persist(
    (set, get) => ({
      comparisons: [],

      storeComparison: (comparison) => {
        const state = get();
        const latest = state.getLatestComparison(comparison.planId);
        
        // THROTTLING LOGIC:
        // 1. If no previous comparison, store it.
        // 2. If quality score changed by more than 0.5%, store it.
        // 3. If more than 4 hours have passed, store it anyway as a heartbeat.
        
        let shouldStore = false;
        
        if (!latest) {
          shouldStore = true;
        } else {
          const scoreDiff = Math.abs(
            latest.result.aggregateMetrics.overallQualityScore - 
            comparison.aggregateMetrics.overallQualityScore
          );
          
          const timeDiff = Date.now() - new Date(latest.timestamp).getTime();
          const fourHours = 4 * 60 * 60 * 1000;
          
          if (scoreDiff > 0.5 || timeDiff > fourHours) {
            shouldStore = true;
          }
        }

        if (shouldStore) {
          set((state) => ({
            comparisons: [
              ...state.comparisons,
              {
                planId: comparison.planId,
                timestamp: comparison.comparisonTimestamp,
                result: comparison,
              },
            ].slice(-100), // Keep only last 100 snapshots to prevent bloat
          }));
        }
      },

      getLatestComparison: (planId) => {
        const state = get();
        const planComparisons = state.comparisons
          .filter((c) => c.planId === planId)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return planComparisons[0] || null;
      },

      getComparisonHistory: (planId, limitDays = 30) => {
        const state = get();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - limitDays);

        return state.comparisons
          .filter(
            (c) =>
              c.planId === planId &&
              new Date(c.timestamp).getTime() >= cutoffDate.getTime()
          )
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      },

      getTrend: (planId) => {
        const state = get();
        const history = state.comparisons
          .filter((c) => c.planId === planId)
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        if (history.length === 0) return null;

        return {
          planId,
          timestamps: history.map((c) => c.timestamp),
          completionTrend: history.map((c) => c.result.aggregateMetrics.averageCompletion),
          qualityTrend: history.map((c) => c.result.aggregateMetrics.overallQualityScore),
          assetsAnalyzed: history.map((c) => c.result.totalAssets),
        };
      },

      clearComparisons: (planId) => {
        set((state) => ({
          comparisons: planId
            ? state.comparisons.filter((c) => c.planId !== planId)
            : [],
        }));
      },
    }),
    {
      name: 'plan-metrics-store',
    }
  )
);
