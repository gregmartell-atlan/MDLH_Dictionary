import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface EvidenceItem {
  id: string;
  planId?: string;
  title: string;
  type: 'log' | 'screenshot' | 'note' | 'query' | 'document';
  source: string;
  createdAt: string;
  owner: string;
  relatedAsset?: string;
  url?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

interface EvidenceStoreState {
  evidenceItems: EvidenceItem[];
  
  // Actions
  addEvidence: (item: EvidenceItem) => void;
  updateEvidence: (id: string, updates: Partial<EvidenceItem>) => void;
  removeEvidence: (id: string) => void;
  linkEvidenceToPlan: (evidenceId: string, planId: string) => void;
  
  // Queries
  getEvidenceByPlan: (planId: string) => EvidenceItem[];
  getEvidenceByAsset: (assetId: string) => EvidenceItem[];
}

export const useEvidenceStore = create<EvidenceStoreState>()(
  persist(
    (set, get) => ({
      evidenceItems: [],
      
      addEvidence: (item) => {
        set((state) => ({
          evidenceItems: [...state.evidenceItems, item],
        }));
      },
      
      updateEvidence: (id, updates) => {
        set((state) => ({
          evidenceItems: state.evidenceItems.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          ),
        }));
      },
      
      removeEvidence: (id) => {
        set((state) => ({
          evidenceItems: state.evidenceItems.filter((item) => item.id !== id),
        }));
      },
      
      linkEvidenceToPlan: (evidenceId, planId) => {
        set((state) => ({
          evidenceItems: state.evidenceItems.map((item) =>
            item.id === evidenceId ? { ...item, planId } : item
          ),
        }));
      },
      
      getEvidenceByPlan: (planId) => {
        const { evidenceItems } = get();
        return evidenceItems.filter((item) => item.planId === planId);
      },
      
      getEvidenceByAsset: (assetId) => {
        const { evidenceItems } = get();
        return evidenceItems.filter((item) => item.relatedAsset === assetId);
      },
    }),
    {
      name: 'evidence-store',
      version: 1,
    }
  )
);
