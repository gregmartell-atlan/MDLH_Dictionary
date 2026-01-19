/**
 * Run, Score, Gap, Plan Types
 * Core domain types for evaluation system
 */

import type { RunScope, ScoringConfig, MethodologyType, UnknownPolicy } from './api.js';

// ============================================
// RUN TYPES
// ============================================

export type RunStatus = 'CREATED' | 'INGESTING' | 'SCORING' | 'COMPLETED' | 'FAILED';

export interface Run {
  id: string;
  sessionId: string;
  status: RunStatus;
  scope: RunScope;
  capabilities: string[];
  scoringConfig: ScoringConfig;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// Re-export for convenience
export type { MethodologyType, UnknownPolicy, ScoringConfig } from './api.js';

// ============================================
// SCORING TYPES
// ============================================

export type Quadrant = 'HH' | 'HL' | 'LH' | 'LL' | 'HU' | 'LU';

export interface Explanation {
  title: string;
  reasoning: string;
  evidenceRefs?: string[];
}

export interface Score {
  id?: number;
  runId: string;
  subjectType: 'ASSET' | 'SCHEMA' | 'DATABASE';
  subjectId: string;
  subjectName?: string;
  assetType?: string;
  qualifiedName?: string;
  impactScore: number;
  qualityScore: number | null;
  qualityUnknown: boolean;
  quadrant: Quadrant;
  explanations: Explanation[];
}

export interface DomainScore {
  id: string;
  runId: string;
  subjectType: string;
  subjectId: string;
  impactScore: number;
  qualityScore: number | null;
  qualityUnknown: boolean;
  quadrant: Quadrant;
  assetCount: number;
  knownAssetCount: number;
}

// ============================================
// GAP TYPES
// ============================================

export type Priority = 'P0' | 'P1' | 'P2' | 'P3';

export interface Gap {
  id?: number;
  runId: string;
  field: string;
  assetType?: string;
  currentCoverage: number;
  targetCoverage: number;
  gapPercent: number;
  priority: Priority;
  effortHours: number;
}

// ============================================
// PLAN TYPES
// ============================================

export interface PlanPhase {
  name: string;
  description: string;
  fields: string[];
  estimatedWeeks: number;
  milestone: string;
}

export interface Plan {
  id: string;
  runId: string;
  phases: PlanPhase[];
  totalWeeks: number;
  createdAt: string;
}

// ============================================
// ARTIFACT TYPES
// ============================================

export type ArtifactType = 'CSV' | 'JSON' | 'MARKDOWN';

export interface Artifact {
  id?: number;
  runId: string;
  type: ArtifactType;
  format: string;
  content: string;
  createdAt: string;
}
