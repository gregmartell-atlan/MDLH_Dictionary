/**
 * Metadata Assistant Store
 * 
 * Manages state for the Metadata Modeling Assistant wizard,
 * including projects, user story selection, metadata model drafts,
 * and roadmap generation.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AssistantProject,
  WizardState,
  UserStory,
  MetadataModelRow,
  EnrichmentTechnique,
  ImplementationRoadmap,
  PatternTemplate,
  CustomMetadataDesign,
} from '../types/metadata-assistant';
import { getRecommendedUserStories } from '../data/user-story-library';
import { getRecommendedTemplateRows } from '../data/metadata-model-templates';
import { generateRoadmap } from '../data/roadmap-generator';

interface AssistantState {
  // Projects
  projects: AssistantProject[];
  activeProjectId: string | null;

  // Wizard state
  wizardState: WizardState;
  wizardInProgress: boolean;

  // Project actions
  createProject: (name: string, description: string) => AssistantProject;
  updateProject: (id: string, updates: Partial<AssistantProject>) => void;
  deleteProject: (id: string) => void;
  setActiveProject: (id: string | null) => void;
  getActiveProject: () => AssistantProject | null;

  // Wizard actions
  initializeWizard: () => void;
  updateWizardProfile: (updates: Partial<WizardState['profile']>) => void;
  nextStep: () => void;
  previousStep: () => void;
  setStep: (step: number) => void;
  saveWizardProgress: () => void;
  loadWizardProgress: () => void;

  // User story actions
  addUserStory: (story: UserStory) => void;
  removeUserStory: (storyId: string) => void;
  updateUserStory: (storyId: string, updates: Partial<UserStory>) => void;
  generateRecommendedUserStories: () => void;

  // Metadata model actions
  addMetadataModelRow: (row: MetadataModelRow) => void;
  removeMetadataModelRow: (rowId: string) => void;
  updateMetadataModelRow: (rowId: string, updates: Partial<MetadataModelRow>) => void;
  generateRecommendedMetadataModel: () => void;

  // Enrichment technique actions
  addEnrichmentTechnique: (technique: EnrichmentTechnique) => void;
  removeEnrichmentTechnique: (techniqueId: string) => void;

  // Pattern & Custom Metadata actions
  togglePattern: (pattern: PatternTemplate) => void;
  updatePattern: (pattern: PatternTemplate) => void;
  toggleCustomMetadata: (template: CustomMetadataDesign) => void;
  updateCustomMetadata: (template: CustomMetadataDesign) => void;

  // Stakeholder actions
  addStakeholder: (stakeholder: { name: string; email: string; role: string }) => void;
  removeStakeholder: (email: string) => void;
  updateStakeholder: (email: string, updates: { name?: string; role?: string }) => void;

  // Roadmap actions
  generateProjectRoadmap: () => void;
  updateRoadmap: (roadmap: ImplementationRoadmap) => void;

  // Finalize and save
  finalizeWizard: () => AssistantProject | null;
  resetWizard: () => void;
}

const initialWizardState: WizardState = {
  currentStep: 0,
  totalSteps: 6, // Updated to 6 steps (0-5) with Strategy Scout
  profile: {
    domains: [],
    useCases: [],
    connectors: [],
  },
  selectedUserStories: [],
  draftMetadataModel: [],
  selectedTechniques: [],
  selectedPatterns: [],
  selectedCustomMetadata: [],
};

export const useAssistantStore = create<AssistantState>()(
  persist(
    (set, get) => ({
      // Initial state
      projects: [],
      activeProjectId: null,
      wizardState: initialWizardState,
      wizardInProgress: false,

      // Project actions
      createProject: (name, description) => {
        const project: AssistantProject = {
          id: `project-${Date.now()}`,
          name,
          description,
          industry: 'Other',
          domains: [],
          useCases: [],
          connectors: [],
          userStories: [],
          metadataModel: [],
          enrichmentTechniques: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'draft',
        };
        set((state) => ({
          projects: [...state.projects, project],
          activeProjectId: project.id,
        }));
        return project;
      },

      updateProject: (id, updates) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
          ),
        }));
      },

      deleteProject: (id) => {
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
        }));
      },

      setActiveProject: (id) => {
        set({ activeProjectId: id });
      },

      getActiveProject: () => {
        const { projects, activeProjectId } = get();
        return projects.find((p) => p.id === activeProjectId) || null;
      },

      // Wizard actions
      initializeWizard: () => {
        set({ wizardState: initialWizardState });
      },

      updateWizardProfile: (updates) => {
        set((state) => ({
          wizardState: {
            ...state.wizardState,
            profile: {
              ...state.wizardState.profile,
              ...updates,
            },
          },
        }));
      },

      nextStep: () => {
        set((state) => ({
          wizardState: {
            ...state.wizardState,
            currentStep: Math.min(
              state.wizardState.currentStep + 1,
              state.wizardState.totalSteps - 1
            ),
          },
        }));
      },

      previousStep: () => {
        set((state) => ({
          wizardState: {
            ...state.wizardState,
            currentStep: Math.max(state.wizardState.currentStep - 1, 0),
          },
        }));
      },

      setStep: (step) => {
        set((state) => ({
          wizardState: {
            ...state.wizardState,
            currentStep: Math.max(0, Math.min(step, state.wizardState.totalSteps - 1)),
          },
        }));
      },

      saveWizardProgress: () => {
        set({ wizardInProgress: true });
      },

      loadWizardProgress: () => {
        const { wizardInProgress } = get();
        if (!wizardInProgress) {
          set({ wizardState: initialWizardState });
        }
      },

      // User story actions
      addUserStory: (story) => {
        set((state) => ({
          wizardState: {
            ...state.wizardState,
            selectedUserStories: [...state.wizardState.selectedUserStories, story],
          },
        }));
      },

      removeUserStory: (storyId) => {
        set((state) => ({
          wizardState: {
            ...state.wizardState,
            selectedUserStories: state.wizardState.selectedUserStories.filter(
              (s) => s.id !== storyId
            ),
          },
        }));
      },

      updateUserStory: (storyId, updates) => {
        set((state) => ({
          wizardState: {
            ...state.wizardState,
            selectedUserStories: state.wizardState.selectedUserStories.map((s) =>
              s.id === storyId ? { ...s, ...updates } : s
            ),
          },
        }));
      },

      generateRecommendedUserStories: () => {
        const { wizardState } = get();
        const recommended = getRecommendedUserStories(wizardState.profile.useCases);
        set((state) => ({
          wizardState: {
            ...state.wizardState,
            selectedUserStories: recommended.slice(0, 10), // Top 10 recommendations
          },
        }));
      },

      // Metadata model actions
      addMetadataModelRow: (row) => {
        set((state) => ({
          wizardState: {
            ...state.wizardState,
            draftMetadataModel: [...state.wizardState.draftMetadataModel, row],
          },
        }));
      },

      removeMetadataModelRow: (rowId) => {
        set((state) => ({
          wizardState: {
            ...state.wizardState,
            draftMetadataModel: state.wizardState.draftMetadataModel.filter(
              (r) => r.id !== rowId
            ),
          },
        }));
      },

      updateMetadataModelRow: (rowId, updates) => {
        set((state) => ({
          wizardState: {
            ...state.wizardState,
            draftMetadataModel: state.wizardState.draftMetadataModel.map((r) =>
              r.id === rowId ? { ...r, ...updates } : r
            ),
          },
        }));
      },

      generateRecommendedMetadataModel: () => {
        const { wizardState } = get();
        const recommended = getRecommendedTemplateRows(
          wizardState.profile.connectors
        );
        set((state) => ({
          wizardState: {
            ...state.wizardState,
            draftMetadataModel: recommended,
          },
        }));
      },

      // Enrichment technique actions
      addEnrichmentTechnique: (technique) => {
        set((state) => ({
          wizardState: {
            ...state.wizardState,
            selectedTechniques: [...state.wizardState.selectedTechniques, technique],
          },
        }));
      },

      removeEnrichmentTechnique: (techniqueId) => {
        set((state) => ({
          wizardState: {
            ...state.wizardState,
            selectedTechniques: state.wizardState.selectedTechniques.filter(
              (t) => t.id !== techniqueId
            ),
          },
        }));
      },

      // Pattern & Custom Metadata actions
      togglePattern: (pattern) => {
        set((state) => {
          const exists = state.wizardState.selectedPatterns.some((p) => p.id === pattern.id);
          return {
            wizardState: {
              ...state.wizardState,
              selectedPatterns: exists
                ? state.wizardState.selectedPatterns.filter((p) => p.id !== pattern.id)
                : [...state.wizardState.selectedPatterns, pattern],
            },
          };
        });
      },

      toggleCustomMetadata: (template) => {
        set((state) => {
          const exists = state.wizardState.selectedCustomMetadata.some((t) => t.id === template.id);
          return {
            wizardState: {
              ...state.wizardState,
              selectedCustomMetadata: exists
                ? state.wizardState.selectedCustomMetadata.filter((t) => t.id !== template.id)
                : [...state.wizardState.selectedCustomMetadata, template],
            },
          };
        });
      },

      updatePattern: (pattern) => {
        set((state) => ({
          wizardState: {
            ...state.wizardState,
            selectedPatterns: state.wizardState.selectedPatterns.map((p) => 
              p.id === pattern.id ? pattern : p
            ),
          },
        }));
      },

      updateCustomMetadata: (template) => {
        set((state) => ({
          wizardState: {
            ...state.wizardState,
            selectedCustomMetadata: state.wizardState.selectedCustomMetadata.map((t) => 
              t.id === template.id ? template : t
            ),
          },
        }));
      },

      // Stakeholder actions
      addStakeholder: (stakeholder) => {
        set((state) => ({
          wizardState: {
            ...state.wizardState,
            stakeholders: [...(state.wizardState.stakeholders || []), stakeholder],
          },
        }));
      },

      removeStakeholder: (email) => {
        set((state) => ({
          wizardState: {
            ...state.wizardState,
            stakeholders: (state.wizardState.stakeholders || []).filter((s) => s.email !== email),
          },
        }));
      },

      updateStakeholder: (email, updates) => {
        set((state) => ({
          wizardState: {
            ...state.wizardState,
            stakeholders: (state.wizardState.stakeholders || []).map((s) =>
              s.email === email ? { ...s, ...updates } : s
            ),
          },
        }));
      },

      // Roadmap actions
      generateProjectRoadmap: () => {
        const { wizardState } = get();
        const totalAssets = wizardState.draftMetadataModel.reduce(
          (sum, row) => sum + row.initialAmount,
          0
        );

        const roadmap = generateRoadmap({
          name: 'Implementation Roadmap',
          totalAssets,
          domains: wizardState.profile.domains,
          useCases: wizardState.profile.useCases,
          timeline: 'standard', // Default to 8-week plan
          metadataModel: wizardState.draftMetadataModel,
        });

        set((state) => ({
          wizardState: {
            ...state.wizardState,
            proposedRoadmap: roadmap,
          },
        }));
      },

      updateRoadmap: (roadmap) => {
        set((state) => ({
          wizardState: {
            ...state.wizardState,
            proposedRoadmap: roadmap,
          },
        }));
      },

      // Finalize and save
      finalizeWizard: () => {
        const { wizardState, createProject, updateProject } = get();
        const { 
          profile, 
          selectedUserStories, 
          draftMetadataModel, 
          selectedTechniques, 
          proposedRoadmap,
          selectedPatterns,
          selectedCustomMetadata,
          stakeholders,
        } = wizardState;

        const defaultName = `${profile.industry || 'Metadata'} Model - ${new Date().toLocaleDateString()}`;
        const project = createProject(
          profile.projectName || defaultName,
          `Metadata model for ${profile.domains.join(', ')}`
        );

        updateProject(project.id, {
          industry: profile.industry,
          domains: profile.domains,
          useCases: profile.useCases,
          connectors: profile.connectors,
          userStories: selectedUserStories,
          metadataModel: draftMetadataModel,
          enrichmentTechniques: selectedTechniques,
          roadmap: proposedRoadmap,
          selectedPatterns,
          selectedCustomMetadata,
          stakeholders: stakeholders || [],
          status: 'in-progress',
        });

        // Reset wizard
        set({ wizardInProgress: false });
        get().resetWizard();

        return project;
      },

      resetWizard: () => {
        set({ wizardState: initialWizardState });
      },
    }),
    {
      name: 'assistant-storage',
      partialize: (state) => ({
        projects: state.projects,
        activeProjectId: state.activeProjectId,
        wizardState: state.wizardInProgress ? state.wizardState : initialWizardState,
        wizardInProgress: state.wizardInProgress,
      }),
    }
  )
);
