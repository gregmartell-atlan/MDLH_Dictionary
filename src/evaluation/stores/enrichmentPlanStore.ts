import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type {
  EnrichmentPlan,
  EnrichmentPlanRequirement,
  EnrichmentPlanProgress,
  PlanMetrics,
} from '../types/enrichment-plan';
import { calculatePlanMetrics } from '../types/enrichment-plan';
import type { MetadataFieldType } from '../types/metadata-fields';

// ============================================
// STORE STATE
// ============================================

interface EnrichmentPlanStoreState {
  // Data
  plans: EnrichmentPlan[];
  activePlanId: string | null;

  // Actions: Plans
  addPlan: (plan: EnrichmentPlan) => void;
  updatePlan: (planId: string, updates: Partial<EnrichmentPlan>) => void;
  deletePlan: (planId: string) => void;
  setPlanStatus: (planId: string, status: EnrichmentPlan['status']) => void;
  setActivePlanId: (planId: string | null) => void;
  clonePlan: (planId: string, name: string) => EnrichmentPlan | null;

  // Actions: Requirements
  addRequirement: (planId: string, requirement: EnrichmentPlanRequirement) => void;
  updateRequirement: (planId: string, requirementId: string, updates: Partial<EnrichmentPlanRequirement>) => void;
  removeRequirement: (planId: string, requirementId: string) => void;

  // Actions: Progress Tracking
  updateProgress: (planId: string, requirementId: string, progress: Partial<EnrichmentPlanProgress>) => void;
  updateContributor: (planId: string, userId: string, assetsCompleted: number) => void;

  // Actions: Collaboration
  addComment: (planId: string, comment: { author: string; text: string; status?: 'open' | 'resolved' }) => void;
  resolveComment: (planId: string, commentId: string) => void;
  addReviewer: (planId: string, reviewerEmail: string) => void;
  removeReviewer: (planId: string, reviewerEmail: string) => void;
  updateOwners: (planId: string, owners: string[]) => void;
  
  // Actions: Versioning
  createVersionSnapshot: (planId: string, description?: string) => void;
  restoreVersion: (planId: string, versionId: string) => void;
  
  // Queries
  getActivePlan: () => EnrichmentPlan | null;
  getPlan: (planId: string) => EnrichmentPlan | null;
  getPlansByStatus: (status: EnrichmentPlan['status']) => EnrichmentPlan[];
  getPlansByDomain: (domainId: string) => EnrichmentPlan[];
  getPlansRequiringField: (fieldType: MetadataFieldType) => EnrichmentPlan[];
  getPlanMetrics: (planId: string) => PlanMetrics | null;

  // Bulk operations
  recalculateMetrics: (planId: string) => void;
}

// ============================================
// STORE IMPLEMENTATION
// ============================================

export const useEnrichmentPlanStore = create<EnrichmentPlanStoreState>()(
  persist(
    (set, get) => ({
      plans: [],
      activePlanId: null,

      // ============================================
      // PLAN MANAGEMENT
      // ============================================

      addPlan: (plan) => {
        set((state) => ({
          plans: [...state.plans, plan],
        }));
      },

      updatePlan: (planId, updates) => {
        set((state) => ({
          plans: state.plans.map((p) =>
            p.id === planId
              ? {
                  ...p,
                  ...updates,
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));
      },

      deletePlan: (planId) => {
        set((state) => ({
          plans: state.plans.filter((p) => p.id !== planId),
          activePlanId: state.activePlanId === planId ? null : state.activePlanId,
        }));
      },

      setPlanStatus: (planId, status) => {
        set((state) => ({
          plans: state.plans.map((p) =>
            p.id === planId
              ? {
                  ...p,
                  status,
                  startDate: status === 'in-progress' && !p.startDate ? new Date().toISOString() : p.startDate,
                  actualCompletionDate: status === 'completed' ? new Date().toISOString() : p.actualCompletionDate,
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));
      },

      setActivePlanId: (planId) => {
        set({ activePlanId: planId });
      },

      clonePlan: (planId, name) => {
        const { plans } = get();
        const original = plans.find((p) => p.id === planId);
        if (!original) return null;

        const cloned: EnrichmentPlan = {
          ...original,
          id: uuidv4(),
          name,
          status: 'draft',
          startDate: undefined,
          actualCompletionDate: undefined,
          requirements: original.requirements.map((r) => ({
            ...r,
            id: uuidv4(),
          })),
          progress: [],
          contributors: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        set((state) => ({
          plans: [...state.plans, cloned],
        }));

        return cloned;
      },

      // ============================================
      // REQUIREMENT MANAGEMENT
      // ============================================

      addRequirement: (planId, requirement) => {
        set((state) => ({
          plans: state.plans.map((p) =>
            p.id === planId
              ? {
                  ...p,
                  requirements: [...p.requirements, requirement],
                  // Add corresponding progress entry
                  progress: [
                    ...p.progress,
                    {
                      requirementId: requirement.id,
                      currentCount: 0,
                      targetCount: requirement.targetCount || 0,
                      percentComplete: 0,
                      assetsWithoutField: [],
                      assetsWithField: [],
                      lastUpdated: new Date().toISOString(),
                      onTrack: true,
                    },
                  ],
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));
      },

      updateRequirement: (planId, requirementId, updates) => {
        set((state) => ({
          plans: state.plans.map((p) =>
            p.id === planId
              ? {
                  ...p,
                  requirements: p.requirements.map((r) =>
                    r.id === requirementId ? { ...r, ...updates } : r
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));
      },

      removeRequirement: (planId, requirementId) => {
        set((state) => ({
          plans: state.plans.map((p) =>
            p.id === planId
              ? {
                  ...p,
                  requirements: p.requirements.filter((r) => r.id !== requirementId),
                  progress: p.progress.filter((pr) => pr.requirementId !== requirementId),
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));
      },

      // ============================================
      // PROGRESS TRACKING
      // ============================================

      updateProgress: (planId, requirementId, progressUpdates) => {
        set((state) => ({
          plans: state.plans.map((p) =>
            p.id === planId
              ? {
                  ...p,
                  progress: p.progress.map((pr) =>
                    pr.requirementId === requirementId
                      ? {
                          ...pr,
                          ...progressUpdates,
                          lastUpdated: new Date().toISOString(),
                        }
                      : pr
                  ),
                  updatedAt: new Date().toISOString(),
                  lastProgressCheck: new Date().toISOString(),
                }
              : p
          ),
        }));
      },

      updateContributor: (planId, userId, assetsCompleted) => {
        set((state) => ({
          plans: state.plans.map((p) =>
            p.id === planId
              ? {
                  ...p,
                  contributors: {
                    ...p.contributors,
                    [userId]: (p.contributors[userId] || 0) + assetsCompleted,
                  },
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));
      },

      // ============================================
      // QUERIES
      // ============================================

      getActivePlan: () => {
        const { plans, activePlanId } = get();
        if (!activePlanId) return null;
        return plans.find((p) => p.id === activePlanId) || null;
      },

      getPlan: (planId) => {
        const { plans } = get();
        return plans.find((p) => p.id === planId) || null;
      },

      getPlansByStatus: (status) => {
        const { plans } = get();
        return plans.filter((p) => p.status === status);
      },

      getPlansByDomain: (domainId) => {
        const { plans } = get();
        return plans.filter((p) => p.domains.includes(domainId));
      },

      getPlansRequiringField: (fieldType) => {
        const { plans } = get();
        return plans.filter((p) =>
          p.requirements.some((r) => r.fieldType === fieldType)
        );
      },

      getPlanMetrics: (planId) => {
        const plan = get().getPlan(planId);
        if (!plan) return null;
        return calculatePlanMetrics(plan);
      },

      // ============================================
      // BULK OPERATIONS
      // ============================================

      recalculateMetrics: (planId) => {
        const plan = get().getPlan(planId);
        if (!plan) return;

        const metrics = calculatePlanMetrics(plan);
        set((state) => ({
          plans: state.plans.map((p) =>
            p.id === planId
              ? {
                  ...p,
                  metrics,
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));
      },

      // ============================================
      // COLLABORATION
      // ============================================

      addComment: (planId, comment) => {
        set((state) => ({
          plans: state.plans.map((p) =>
            p.id === planId
              ? {
                  ...p,
                  comments: [
                    ...(p.comments || []),
                    {
                      id: uuidv4(),
                      ...comment,
                      createdAt: new Date().toISOString(),
                      status: comment.status || 'open',
                    },
                  ],
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));
      },

      resolveComment: (planId, commentId) => {
        set((state) => ({
          plans: state.plans.map((p) =>
            p.id === planId
              ? {
                  ...p,
                  comments: (p.comments || []).map((c) =>
                    c.id === commentId ? { ...c, status: 'resolved' as const } : c
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));
      },

      addReviewer: (planId, reviewerEmail) => {
        set((state) => ({
          plans: state.plans.map((p) =>
            p.id === planId
              ? {
                  ...p,
                  reviewers: [...(p.reviewers || []), reviewerEmail],
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));
      },

      removeReviewer: (planId, reviewerEmail) => {
        set((state) => ({
          plans: state.plans.map((p) =>
            p.id === planId
              ? {
                  ...p,
                  reviewers: (p.reviewers || []).filter((r) => r !== reviewerEmail),
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));
      },

      updateOwners: (planId, owners) => {
        set((state) => ({
          plans: state.plans.map((p) =>
            p.id === planId
              ? {
                  ...p,
                  owners,
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));
      },

      // ============================================
      // VERSIONING
      // ============================================

      createVersionSnapshot: (planId, description) => {
        const plan = get().getPlan(planId);
        if (!plan) return;

        const nextVersionNumber = plan.versions.length + 1;
        const snapshot: PlanVersion = {
          id: uuidv4(),
          versionNumber: nextVersionNumber,
          createdAt: new Date().toISOString(),
          createdBy: 'user',
          description,
          matrix: plan.currentMatrix,
          changeLog: [`Version ${nextVersionNumber} snapshot created`],
        };

        set((state) => ({
          plans: state.plans.map((p) =>
            p.id === planId
              ? {
                  ...p,
                  versions: [...p.versions, snapshot],
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));
      },

      restoreVersion: (planId, versionId) => {
        const plan = get().getPlan(planId);
        if (!plan) return;

        const version = plan.versions.find((v) => v.id === versionId);
        if (!version) return;

        set((state) => ({
          plans: state.plans.map((p) =>
            p.id === planId
              ? {
                  ...p,
                  currentMatrix: version.matrix,
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));
      },
    }),
    {
      name: 'enrichment-plan-store',
      version: 1,
    }
  )
);

// ============================================
// CONVENIENCE HOOKS
// ============================================

/**
 * Hook to get all active plans for a specific domain
 */
export const useDomainsActivePlans = (domainId: string) => {
  return useEnrichmentPlanStore((state) => {
    const plans = state.getPlansByDomain(domainId);
    return plans.filter((p) => p.status === 'in-progress' || p.status === 'draft');
  });
};

/**
 * Hook to get required fields from active plans
 */
export const useRequiredFieldsFromPlans = (domainId?: string) => {
  return useEnrichmentPlanStore((state) => {
    let plans = state.plans.filter(
      (p) => p.status === 'in-progress' || p.status === 'draft'
    );
    if (domainId) {
      plans = plans.filter((p) => p.domains.includes(domainId));
    }

    const requiredFields = new Set<MetadataFieldType>();
    plans.forEach((plan) => {
      plan.requirements
        .filter((r) => r.statusType === 'required')
        .forEach((r) => requiredFields.add(r.fieldType));
    });

    return Array.from(requiredFields);
  });
};
