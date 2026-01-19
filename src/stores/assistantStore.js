/**
 * Metadata Assistant Store
 * 
 * Manages state for the Metadata Modeling Assistant wizard:
 * - Wizard navigation and step state
 * - Profile configuration (domains, use cases, connectors)
 * - User story selection
 * - Metadata model drafts
 * - Enrichment techniques
 * - Roadmap generation
 * 
 * Ported from atlan-metadata-evaluation/src/stores/assistantStore.ts
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * @typedef {Object} WizardProfile
 * @property {string} [projectName]
 * @property {string} [industry]
 * @property {string[]} domains
 * @property {string[]} useCases
 * @property {string[]} connectors
 */

/**
 * @typedef {Object} UserStory
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {string} persona
 * @property {string[]} requiredFields
 * @property {string[]} [useCases]
 * @property {number} [priority]
 * @property {boolean} [selected]
 */

/**
 * @typedef {Object} MetadataModelRow
 * @property {string} id
 * @property {string} assetType
 * @property {string} fieldName
 * @property {string} fieldType
 * @property {string} [source]
 * @property {boolean} required
 * @property {string} [enrichmentMethod]
 * @property {number} [initialAmount]
 */

/**
 * @typedef {Object} EnrichmentTechnique
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} method
 * @property {string[]} applicableFields
 * @property {number} [effortScore]
 * @property {number} [impactScore]
 */

/**
 * @typedef {Object} RoadmapMilestone
 * @property {string} id
 * @property {string} name
 * @property {string} [description]
 * @property {number} week
 * @property {string[]} tasks
 * @property {string[]} deliverables
 */

/**
 * @typedef {Object} ImplementationRoadmap
 * @property {string} name
 * @property {number} totalWeeks
 * @property {RoadmapMilestone[]} milestones
 * @property {number} totalAssets
 * @property {Date} startDate
 */

/**
 * @typedef {Object} AssistantProject
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} industry
 * @property {string[]} domains
 * @property {string[]} useCases
 * @property {string[]} connectors
 * @property {UserStory[]} userStories
 * @property {MetadataModelRow[]} metadataModel
 * @property {EnrichmentTechnique[]} enrichmentTechniques
 * @property {ImplementationRoadmap} [roadmap]
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {'draft' | 'in-progress' | 'complete'} status
 */

/**
 * @typedef {Object} WizardState
 * @property {number} currentStep
 * @property {number} totalSteps
 * @property {WizardProfile} profile
 * @property {UserStory[]} selectedUserStories
 * @property {MetadataModelRow[]} draftMetadataModel
 * @property {EnrichmentTechnique[]} selectedTechniques
 * @property {Object[]} selectedPatterns
 * @property {Object[]} selectedCustomMetadata
 * @property {Object[]} [stakeholders]
 * @property {ImplementationRoadmap} [proposedRoadmap]
 */

const initialProfile = {
  projectName: '',
  industry: '',
  domains: [],
  useCases: [],
  connectors: [],
};

const initialWizardState = {
  currentStep: 0,
  totalSteps: 6,
  profile: { ...initialProfile },
  selectedUserStories: [],
  draftMetadataModel: [],
  selectedTechniques: [],
  selectedPatterns: [],
  selectedCustomMetadata: [],
  stakeholders: [],
  proposedRoadmap: null,
};

export const useAssistantStore = create(
  persist(
    (set, get) => ({
      // =========================================================================
      // STATE
      // =========================================================================
      
      // Projects
      projects: [],
      activeProjectId: null,
      
      // Wizard state
      wizardState: { ...initialWizardState },
      wizardInProgress: false,
      
      // =========================================================================
      // PROJECT ACTIONS
      // =========================================================================
      
      /**
       * Create a new project
       * @param {string} name
       * @param {string} description
       * @returns {AssistantProject}
       */
      createProject: (name, description) => {
        const project = {
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
        
        set(state => ({
          projects: [...state.projects, project],
          activeProjectId: project.id,
        }));
        
        return project;
      },
      
      /**
       * Update a project
       * @param {string} id
       * @param {Partial<AssistantProject>} updates
       */
      updateProject: (id, updates) => {
        set(state => ({
          projects: state.projects.map(p =>
            p.id === id
              ? { ...p, ...updates, updatedAt: new Date().toISOString() }
              : p
          ),
        }));
      },
      
      /**
       * Delete a project
       * @param {string} id
       */
      deleteProject: (id) => {
        set(state => ({
          projects: state.projects.filter(p => p.id !== id),
          activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
        }));
      },
      
      /**
       * Set active project
       * @param {string | null} id
       */
      setActiveProject: (id) => {
        set({ activeProjectId: id });
      },
      
      /**
       * Get active project
       * @returns {AssistantProject | null}
       */
      getActiveProject: () => {
        const { projects, activeProjectId } = get();
        return projects.find(p => p.id === activeProjectId) || null;
      },
      
      // =========================================================================
      // WIZARD ACTIONS
      // =========================================================================
      
      /**
       * Initialize wizard
       */
      initializeWizard: () => {
        set({
          wizardState: { ...initialWizardState },
          wizardInProgress: true,
        });
      },
      
      /**
       * Update wizard profile
       * @param {Partial<WizardProfile>} updates
       */
      updateWizardProfile: (updates) => {
        set(state => ({
          wizardState: {
            ...state.wizardState,
            profile: { ...state.wizardState.profile, ...updates },
          },
        }));
      },
      
      /**
       * Go to next step
       */
      nextStep: () => {
        set(state => ({
          wizardState: {
            ...state.wizardState,
            currentStep: Math.min(
              state.wizardState.currentStep + 1,
              state.wizardState.totalSteps - 1
            ),
          },
        }));
      },
      
      /**
       * Go to previous step
       */
      previousStep: () => {
        set(state => ({
          wizardState: {
            ...state.wizardState,
            currentStep: Math.max(state.wizardState.currentStep - 1, 0),
          },
        }));
      },
      
      /**
       * Set step directly
       * @param {number} step
       */
      setStep: (step) => {
        set(state => ({
          wizardState: {
            ...state.wizardState,
            currentStep: Math.max(0, Math.min(step, state.wizardState.totalSteps - 1)),
          },
        }));
      },
      
      /**
       * Save wizard progress
       */
      saveWizardProgress: () => {
        set({ wizardInProgress: true });
      },
      
      /**
       * Load wizard progress
       */
      loadWizardProgress: () => {
        const { wizardInProgress } = get();
        if (!wizardInProgress) {
          set({ wizardState: { ...initialWizardState } });
        }
      },
      
      // =========================================================================
      // USER STORY ACTIONS
      // =========================================================================
      
      /**
       * Add user story
       * @param {UserStory} story
       */
      addUserStory: (story) => {
        set(state => ({
          wizardState: {
            ...state.wizardState,
            selectedUserStories: [...state.wizardState.selectedUserStories, story],
          },
        }));
      },
      
      /**
       * Remove user story
       * @param {string} storyId
       */
      removeUserStory: (storyId) => {
        set(state => ({
          wizardState: {
            ...state.wizardState,
            selectedUserStories: state.wizardState.selectedUserStories.filter(
              s => s.id !== storyId
            ),
          },
        }));
      },
      
      /**
       * Update user story
       * @param {string} storyId
       * @param {Partial<UserStory>} updates
       */
      updateUserStory: (storyId, updates) => {
        set(state => ({
          wizardState: {
            ...state.wizardState,
            selectedUserStories: state.wizardState.selectedUserStories.map(s =>
              s.id === storyId ? { ...s, ...updates } : s
            ),
          },
        }));
      },
      
      /**
       * Set selected user stories (bulk)
       * @param {UserStory[]} stories
       */
      setSelectedUserStories: (stories) => {
        set(state => ({
          wizardState: {
            ...state.wizardState,
            selectedUserStories: stories,
          },
        }));
      },
      
      // =========================================================================
      // METADATA MODEL ACTIONS
      // =========================================================================
      
      /**
       * Add metadata model row
       * @param {MetadataModelRow} row
       */
      addMetadataModelRow: (row) => {
        set(state => ({
          wizardState: {
            ...state.wizardState,
            draftMetadataModel: [...state.wizardState.draftMetadataModel, row],
          },
        }));
      },
      
      /**
       * Remove metadata model row
       * @param {string} rowId
       */
      removeMetadataModelRow: (rowId) => {
        set(state => ({
          wizardState: {
            ...state.wizardState,
            draftMetadataModel: state.wizardState.draftMetadataModel.filter(
              r => r.id !== rowId
            ),
          },
        }));
      },
      
      /**
       * Update metadata model row
       * @param {string} rowId
       * @param {Partial<MetadataModelRow>} updates
       */
      updateMetadataModelRow: (rowId, updates) => {
        set(state => ({
          wizardState: {
            ...state.wizardState,
            draftMetadataModel: state.wizardState.draftMetadataModel.map(r =>
              r.id === rowId ? { ...r, ...updates } : r
            ),
          },
        }));
      },
      
      /**
       * Set draft metadata model (bulk)
       * @param {MetadataModelRow[]} rows
       */
      setDraftMetadataModel: (rows) => {
        set(state => ({
          wizardState: {
            ...state.wizardState,
            draftMetadataModel: rows,
          },
        }));
      },
      
      // =========================================================================
      // ENRICHMENT TECHNIQUE ACTIONS
      // =========================================================================
      
      /**
       * Add enrichment technique
       * @param {EnrichmentTechnique} technique
       */
      addEnrichmentTechnique: (technique) => {
        set(state => ({
          wizardState: {
            ...state.wizardState,
            selectedTechniques: [...state.wizardState.selectedTechniques, technique],
          },
        }));
      },
      
      /**
       * Remove enrichment technique
       * @param {string} techniqueId
       */
      removeEnrichmentTechnique: (techniqueId) => {
        set(state => ({
          wizardState: {
            ...state.wizardState,
            selectedTechniques: state.wizardState.selectedTechniques.filter(
              t => t.id !== techniqueId
            ),
          },
        }));
      },
      
      /**
       * Set selected techniques (bulk)
       * @param {EnrichmentTechnique[]} techniques
       */
      setSelectedTechniques: (techniques) => {
        set(state => ({
          wizardState: {
            ...state.wizardState,
            selectedTechniques: techniques,
          },
        }));
      },
      
      // =========================================================================
      // PATTERN ACTIONS
      // =========================================================================
      
      /**
       * Toggle pattern selection
       * @param {Object} pattern
       */
      togglePattern: (pattern) => {
        set(state => {
          const exists = state.wizardState.selectedPatterns.some(p => p.id === pattern.id);
          return {
            wizardState: {
              ...state.wizardState,
              selectedPatterns: exists
                ? state.wizardState.selectedPatterns.filter(p => p.id !== pattern.id)
                : [...state.wizardState.selectedPatterns, pattern],
            },
          };
        });
      },
      
      /**
       * Toggle custom metadata selection
       * @param {Object} template
       */
      toggleCustomMetadata: (template) => {
        set(state => {
          const exists = state.wizardState.selectedCustomMetadata.some(t => t.id === template.id);
          return {
            wizardState: {
              ...state.wizardState,
              selectedCustomMetadata: exists
                ? state.wizardState.selectedCustomMetadata.filter(t => t.id !== template.id)
                : [...state.wizardState.selectedCustomMetadata, template],
            },
          };
        });
      },
      
      // =========================================================================
      // STAKEHOLDER ACTIONS
      // =========================================================================
      
      /**
       * Add stakeholder
       * @param {{name: string, email: string, role: string}} stakeholder
       */
      addStakeholder: (stakeholder) => {
        set(state => ({
          wizardState: {
            ...state.wizardState,
            stakeholders: [...(state.wizardState.stakeholders || []), stakeholder],
          },
        }));
      },
      
      /**
       * Remove stakeholder
       * @param {string} email
       */
      removeStakeholder: (email) => {
        set(state => ({
          wizardState: {
            ...state.wizardState,
            stakeholders: (state.wizardState.stakeholders || []).filter(
              s => s.email !== email
            ),
          },
        }));
      },
      
      // =========================================================================
      // ROADMAP ACTIONS
      // =========================================================================
      
      /**
       * Set proposed roadmap
       * @param {ImplementationRoadmap} roadmap
       */
      setProposedRoadmap: (roadmap) => {
        set(state => ({
          wizardState: {
            ...state.wizardState,
            proposedRoadmap: roadmap,
          },
        }));
      },
      
      /**
       * Generate simple roadmap from current state
       */
      generateSimpleRoadmap: () => {
        const { wizardState } = get();
        const totalAssets = wizardState.draftMetadataModel.reduce(
          (sum, row) => sum + (row.initialAmount || 0),
          0
        );
        
        const roadmap = {
          name: 'Implementation Roadmap',
          totalWeeks: 8,
          totalAssets,
          startDate: new Date(),
          milestones: [
            {
              id: 'milestone-1',
              name: 'Foundation',
              week: 1,
              tasks: ['Set up governance framework', 'Configure field mappings'],
              deliverables: ['Governance guidelines', 'Field mapping configuration'],
            },
            {
              id: 'milestone-2',
              name: 'Ownership Enrichment',
              week: 3,
              tasks: ['Assign owners to critical assets', 'Set up stewardship'],
              deliverables: ['Ownership assignments', 'Steward role definitions'],
            },
            {
              id: 'milestone-3',
              name: 'Documentation',
              week: 5,
              tasks: ['Add descriptions to key assets', 'Link glossary terms'],
              deliverables: ['Asset descriptions', 'Glossary linkages'],
            },
            {
              id: 'milestone-4',
              name: 'Validation & Rollout',
              week: 8,
              tasks: ['Validate enrichment quality', 'Train users'],
              deliverables: ['Quality report', 'Training materials'],
            },
          ],
        };
        
        set(state => ({
          wizardState: {
            ...state.wizardState,
            proposedRoadmap: roadmap,
          },
        }));
      },
      
      // =========================================================================
      // FINALIZE ACTIONS
      // =========================================================================
      
      /**
       * Finalize wizard and create project
       * @returns {AssistantProject | null}
       */
      finalizeWizard: () => {
        const { wizardState, createProject, updateProject } = get();
        const { profile, selectedUserStories, draftMetadataModel, selectedTechniques, proposedRoadmap, stakeholders, selectedPatterns, selectedCustomMetadata } = wizardState;
        
        const defaultName = `${profile.industry || 'Metadata'} Model - ${new Date().toLocaleDateString()}`;
        const project = createProject(
          profile.projectName || defaultName,
          `Metadata model for ${profile.domains.join(', ') || 'all domains'}`
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
      
      /**
       * Reset wizard to initial state
       */
      resetWizard: () => {
        set({ wizardState: { ...initialWizardState } });
      },
    }),
    {
      name: 'mdlh-assistant-store',
      partialize: (state) => ({
        projects: state.projects.slice(0, 10), // Keep last 10 projects
        activeProjectId: state.activeProjectId,
        wizardState: state.wizardInProgress ? state.wizardState : initialWizardState,
        wizardInProgress: state.wizardInProgress,
      }),
    }
  )
);

export default useAssistantStore;
