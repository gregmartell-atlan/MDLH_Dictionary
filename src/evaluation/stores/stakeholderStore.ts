import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Stakeholder {
  id: string;
  planId?: string;
  name: string;
  email: string;
  role: 'Owner' | 'Reviewer' | 'Approver' | 'Contributor';
  status: 'pending' | 'reviewing' | 'approved' | 'declined';
  assignedAt?: string;
  respondedAt?: string;
  notes?: string;
}

export interface StakeholderAssignment {
  stakeholderId: string;
  planId: string;
  taskDescription?: string;
  dueDate?: string;
  status: 'assigned' | 'in-progress' | 'completed';
}

interface StakeholderStoreState {
  stakeholders: Stakeholder[];
  assignments: StakeholderAssignment[];
  
  // Actions: Stakeholders
  addStakeholder: (stakeholder: Stakeholder) => void;
  updateStakeholder: (id: string, updates: Partial<Stakeholder>) => void;
  removeStakeholder: (id: string) => void;
  assignStakeholderToPlan: (stakeholderId: string, planId: string, role: Stakeholder['role']) => void;
  updateStakeholderStatus: (id: string, status: Stakeholder['status']) => void;
  
  // Actions: Assignments
  createAssignment: (assignment: StakeholderAssignment) => void;
  updateAssignmentStatus: (stakeholderId: string, planId: string, status: StakeholderAssignment['status']) => void;
  
  // Queries
  getStakeholdersByPlan: (planId: string) => Stakeholder[];
  getStakeholdersByRole: (planId: string, role: Stakeholder['role']) => Stakeholder[];
  getAssignmentsByPlan: (planId: string) => StakeholderAssignment[];
}

export const useStakeholderStore = create<StakeholderStoreState>()(
  persist(
    (set, get) => ({
      stakeholders: [],
      assignments: [],
      
      addStakeholder: (stakeholder) => {
        set((state) => ({
          stakeholders: [...state.stakeholders, stakeholder],
        }));
      },
      
      updateStakeholder: (id, updates) => {
        set((state) => ({
          stakeholders: state.stakeholders.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        }));
      },
      
      removeStakeholder: (id) => {
        set((state) => ({
          stakeholders: state.stakeholders.filter((s) => s.id !== id),
          assignments: state.assignments.filter((a) => a.stakeholderId !== id),
        }));
      },
      
      assignStakeholderToPlan: (stakeholderId, planId, role) => {
        set((state) => ({
          stakeholders: state.stakeholders.map((s) =>
            s.id === stakeholderId
              ? { ...s, planId, role, assignedAt: new Date().toISOString() }
              : s
          ),
        }));
      },
      
      updateStakeholderStatus: (id, status) => {
        set((state) => ({
          stakeholders: state.stakeholders.map((s) =>
            s.id === id
              ? { ...s, status, respondedAt: new Date().toISOString() }
              : s
          ),
        }));
      },
      
      createAssignment: (assignment) => {
        set((state) => ({
          assignments: [...state.assignments, assignment],
        }));
      },
      
      updateAssignmentStatus: (stakeholderId, planId, status) => {
        set((state) => ({
          assignments: state.assignments.map((a) =>
            a.stakeholderId === stakeholderId && a.planId === planId
              ? { ...a, status }
              : a
          ),
        }));
      },
      
      getStakeholdersByPlan: (planId) => {
        const { stakeholders } = get();
        return stakeholders.filter((s) => s.planId === planId);
      },
      
      getStakeholdersByRole: (planId, role) => {
        const { stakeholders } = get();
        return stakeholders.filter((s) => s.planId === planId && s.role === role);
      },
      
      getAssignmentsByPlan: (planId) => {
        const { assignments } = get();
        return assignments.filter((a) => a.planId === planId);
      },
    }),
    {
      name: 'stakeholder-store',
      version: 1,
    }
  )
);
