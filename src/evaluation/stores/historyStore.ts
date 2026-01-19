import { create } from 'zustand';
import type { MetadataModel } from '../types';

interface HistoryState {
  past: MetadataModel[];
  present: MetadataModel;
  future: MetadataModel[];

  // Actions
  undo: () => MetadataModel | undefined;
  redo: () => MetadataModel | undefined;
  push: (model: MetadataModel) => void;
  clear: () => void;

  // Getters
  canUndo: () => boolean;
  canRedo: () => boolean;
}

const MAX_HISTORY = 50;

const createEmptyModel = (): MetadataModel => ({
  id: '',
  name: 'Untitled Model',
  description: '',
  pages: [],
  activePageId: '',
  enrichmentPlans: [],
  domains: [],
  customMetadata: [],
  versions: [],
  requirementsMatrix: null,
  entities: [],
  edges: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  present: createEmptyModel(),
  future: [],

  push: (model: MetadataModel) => {
    const { present, past } = get();

    // Skip if reference-identical (cheap guard; deep compare is too expensive for large models)
    if (present === model) {
      return;
    }

    set({
      past: [...past.slice(-MAX_HISTORY + 1), present],
      present: model,
      future: [], // Clear future when new action is performed
    });
  },

  undo: () => {
    const { past, present } = get();
    if (past.length === 0) return;

    const previous = past[past.length - 1];
    const newPast = past.slice(0, -1);

    set({
      past: newPast,
      present: previous,
      future: [present, ...get().future],
    });

    return previous;
  },

  redo: () => {
    const { future, present } = get();
    if (future.length === 0) return;

    const next = future[0];
    const newFuture = future.slice(1);

    set({
      past: [...get().past, present],
      present: next,
      future: newFuture,
    });

    return next;
  },

  clear: () => {
    set({
      past: [],
      future: [],
    });
  },

  canUndo: () => {
    return get().past.length > 0;
  },

  canRedo: () => {
    return get().future.length > 0;
  },
}));
