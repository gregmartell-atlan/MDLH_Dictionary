/**
 * Plan Service
 * 
 * API service for enrichment plan persistence and retrieval.
 */

import type { EnrichmentPlan } from '../types/enrichment-plan';

const API_BASE = '/api';

export const planService = {
  /**
   * Create a new plan
   */
  async createPlan(plan: EnrichmentPlan): Promise<EnrichmentPlan> {
    const response = await fetch(`${API_BASE}/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plan),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create plan: ${response.statusText}`);
    }
    
    return response.json();
  },

  /**
   * Get a plan by ID
   */
  async getPlan(planId: string): Promise<EnrichmentPlan> {
    const response = await fetch(`${API_BASE}/plans/${planId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch plan: ${response.statusText}`);
    }
    
    return response.json();
  },

  /**
   * Update an existing plan
   */
  async updatePlan(planId: string, updates: Partial<EnrichmentPlan>): Promise<EnrichmentPlan> {
    const response = await fetch(`${API_BASE}/plans/${planId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update plan: ${response.statusText}`);
    }
    
    return response.json();
  },

  /**
   * Delete a plan
   */
  async deletePlan(planId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/plans/${planId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete plan: ${response.statusText}`);
    }
  },

  /**
   * Submit plan for review
   */
  async submitPlanForReview(planId: string): Promise<EnrichmentPlan> {
    const response = await fetch(`${API_BASE}/plans/${planId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to submit plan: ${response.statusText}`);
    }
    
    return response.json();
  },

  /**
   * Update stakeholders
   */
  async updateStakeholders(planId: string, stakeholders: { reviewers?: string[]; owners?: string[] }): Promise<EnrichmentPlan> {
    const response = await fetch(`${API_BASE}/plans/${planId}/stakeholders`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stakeholders),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update stakeholders: ${response.statusText}`);
    }
    
    return response.json();
  },

  /**
   * Add comment to plan
   */
  async addComment(planId: string, comment: { author: string; text: string }): Promise<EnrichmentPlan> {
    const response = await fetch(`${API_BASE}/plans/${planId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(comment),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to add comment: ${response.statusText}`);
    }
    
    return response.json();
  },
};
