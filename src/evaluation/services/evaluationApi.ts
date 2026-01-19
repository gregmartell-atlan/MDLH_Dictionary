/**
 * Evaluation API Service
 * Unified API client for Node.js backend
 * Replaces mdlhBridge.js and v2Api.ts with single consolidated service
 * 
 * Per design_review.md: No `any` types, proper error handling
 */

// ============================================
// TYPES (from backend)
// ============================================

export type RunStatus = 'CREATED' | 'INGESTING' | 'SCORING' | 'COMPLETED' | 'FAILED';
export type Quadrant = 'HH' | 'HL' | 'LH' | 'LL' | 'HU' | 'LU';
export type Priority = 'P0' | 'P1' | 'P2' | 'P3';
export type ArtifactType = 'CSV' | 'JSON' | 'MARKDOWN';

export interface RunScope {
  database?: string;
  schema?: string;
  connectorFilter?: string;
  assetTypeFilter?: string[];
  limit?: number;
}

// Methodology types
export type MethodologyType = 
  | 'WEIGHTED_DIMENSIONS'
  | 'WEIGHTED_MEASURES'
  | 'CHECKLIST'
  | 'QTRIPLET'
  | 'MATURITY';

export type UnknownPolicy = 'IGNORE_IN_ROLLUP' | 'TREAT_UNKNOWN_AS_ZERO';

export interface ScoringConfig {
  methodology: MethodologyType;
  unknownPolicy: UnknownPolicy;
  readyThreshold: number;
  impactThreshold: number;
  qualityThreshold: number;
}

export interface Run {
  id: string;
  sessionId: string;
  status: RunStatus;
  scope: RunScope;
  capabilities: string[];
  scoringConfig?: ScoringConfig;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  stats?: RunStats;
}

export interface RunStats {
  assetCount: number;
  scoreCount: number;
  gapCount: number;
  hasPlan: boolean;
}

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

export interface ScoreSummary {
  total: number;
  byQuadrant: Record<Quadrant, number>;
  avgImpact: number;
  avgQuality: number | null;
  unknownCount: number;
}

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

export interface ModelSummary {
  totalGaps: number;
  totalEffortHours: number;
  byPriority: Record<string, number>;
  estimatedWeeks: number;
  phaseCount: number;
}

export interface Model {
  gaps: Gap[];
  plan: Plan | null;
  summary: ModelSummary;
}

export interface AssetAttributes {
  ownerUsers: string[];
  ownerGroups: string[];
  description: string | null;
  tags: string[];
  termGuids: string[];
  hasLineage: boolean;
  certificateStatus: string | null;
  popularityScore: number | null;
  readmeGuid: string | null;
}

export interface Asset {
  guid: string;
  name: string;
  typeName: string;
  qualifiedName: string;
  connector: string;
  attributes: AssetAttributes;
}

export interface Artifact {
  type: ArtifactType;
  format: string;
  createdAt: string;
}

export interface DomainStats {
  totalAssets: number;
  avgImpact: number;
  avgQuality: number | null;
  quadrantCounts: Record<Quadrant, number>;
  topIssues: string[];
}

export interface DomainAssets {
  assets: Score[];
  stats: DomainStats;
}

// ============================================
// API RESPONSE TYPES
// ============================================

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// API CLIENT
// ============================================

/**
 * Get the Node.js backend URL
 * In development with Vite proxy, returns empty string (relative URLs)
 * In production, uses VITE_EVALUATION_API_URL environment variable
 */
function getApiUrl(): string {
  // In dev mode with proxy, use relative URLs
  if (import.meta.env?.DEV) {
    return '';
  }
  return import.meta.env?.VITE_EVALUATION_API_URL || 'http://localhost:8001';
}

const API_URL = getApiUrl();
const SESSION_STORAGE_KEY = 'snowflake_session';

/**
 * Get session ID from sessionStorage
 */
function getSessionId(): string | null {
  const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return parsed.sessionId || null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Base fetch function with session handling
 */
async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const sessionId = getSessionId();
  
  if (!sessionId) {
    throw new Error('Not connected. Please connect to Snowflake first.');
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Session-ID': sessionId,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage: string;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error || `API error: ${response.status}`;
    } catch {
      errorMessage = errorText || `API error: ${response.status}`;
    }
    throw new Error(errorMessage);
  }

  const result = await response.json() as ApiResponse<T>;
  
  if (!result.success) {
    throw new Error(result.error || 'Unknown error');
  }

  return result.data as T;
}

// ============================================
// RUN API
// ============================================

export const runApi = {
  /**
   * Create a new evaluation run
   */
  create: async (
    scope: RunScope,
    capabilities: string[] = [],
    scoringConfig?: Partial<ScoringConfig>
  ): Promise<Run> => {
    return apiFetch<Run>('/api/runs', {
      method: 'POST',
      body: JSON.stringify({ scope, capabilities, scoringConfig }),
    });
  },

  /**
   * Get a run by ID
   */
  get: async (id: string): Promise<Run> => {
    return apiFetch<Run>(`/api/runs/${id}`);
  },

  /**
   * List all runs for current session
   */
  list: async (): Promise<Run[]> => {
    return apiFetch<Run[]>('/api/runs');
  },

  /**
   * Delete a run
   */
  delete: async (id: string): Promise<void> => {
    await apiFetch<{ message: string }>(`/api/runs/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Ingest assets from MDLH
   */
  ingest: async (
    id: string,
    options?: { database?: string; schema?: string; limit?: number }
  ): Promise<{ assetCount: number }> => {
    return apiFetch<{ assetCount: number }>(`/api/runs/${id}/ingest`, {
      method: 'POST',
      body: JSON.stringify(options || {}),
    });
  },

  /**
   * Compute scores for ingested assets
   */
  score: async (id: string): Promise<{ scoreCount: number }> => {
    return apiFetch<{ scoreCount: number }>(`/api/runs/${id}/score`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  /**
   * Combined ingest and score operation
   */
  ingestAndScore: async (
    id: string,
    options?: { database?: string; schema?: string; limit?: number }
  ): Promise<{ assetCount: number; scoreCount: number }> => {
    return apiFetch<{ assetCount: number; scoreCount: number }>(
      `/api/runs/${id}/ingest-and-score`,
      {
        method: 'POST',
        body: JSON.stringify(options || {}),
      }
    );
  },
};

// ============================================
// CATALOG API
// ============================================

export const catalogApi = {
  /**
   * Get ingested assets
   */
  getAssets: async (runId: string): Promise<Asset[]> => {
    return apiFetch<Asset[]>(`/api/runs/${runId}/catalog`);
  },

  /**
   * Get all scores for a run
   */
  getScores: async (
    runId: string
  ): Promise<{ scores: Score[]; summary: ScoreSummary }> => {
    return apiFetch<{ scores: Score[]; summary: ScoreSummary }>(
      `/api/runs/${runId}/scores`
    );
  },

  /**
   * Get domain-level aggregated scores
   */
  getDomainScores: async (runId: string): Promise<DomainScore[]> => {
    return apiFetch<DomainScore[]>(`/api/runs/${runId}/scores/domains`);
  },

  /**
   * Get assets for a specific domain
   */
  getDomainAssets: async (
    runId: string,
    domainId: string
  ): Promise<DomainAssets> => {
    return apiFetch<DomainAssets>(
      `/api/runs/${runId}/domains/${encodeURIComponent(domainId)}/assets`
    );
  },

  /**
   * Get scores by quadrant
   */
  getScoresByQuadrant: async (
    runId: string,
    quadrant: Quadrant
  ): Promise<Score[]> => {
    return apiFetch<Score[]>(`/api/runs/${runId}/scores/quadrant/${quadrant}`);
  },
};

// ============================================
// PLAN API
// ============================================

export const planApi = {
  /**
   * Get gaps for a run
   */
  getGaps: async (runId: string): Promise<Gap[]> => {
    return apiFetch<Gap[]>(`/api/runs/${runId}/gaps`);
  },

  /**
   * Recompute gaps from current catalog
   */
  recomputeGaps: async (runId: string): Promise<Gap[]> => {
    return apiFetch<Gap[]>(`/api/runs/${runId}/gaps/recompute`, {
      method: 'POST',
    });
  },

  /**
   * Get model (gaps + plan combined)
   */
  getModel: async (runId: string): Promise<Model> => {
    return apiFetch<Model>(`/api/runs/${runId}/model`);
  },

  /**
   * Get current plan
   */
  getPlan: async (runId: string): Promise<Plan | null> => {
    return apiFetch<Plan | null>(`/api/runs/${runId}/plan`);
  },

  /**
   * Generate a new plan from gaps
   */
  generatePlan: async (runId: string): Promise<Plan> => {
    return apiFetch<Plan>(`/api/runs/${runId}/plan`, {
      method: 'POST',
    });
  },
};

// ============================================
// ARTIFACT API
// ============================================

export const artifactApi = {
  /**
   * List artifacts for a run
   */
  list: async (runId: string): Promise<Artifact[]> => {
    return apiFetch<Artifact[]>(`/api/runs/${runId}/artifacts`);
  },

  /**
   * Generate all artifacts
   */
  generate: async (runId: string): Promise<Artifact[]> => {
    return apiFetch<Artifact[]>(`/api/runs/${runId}/artifacts`, {
      method: 'POST',
    });
  },

  /**
   * Download an artifact
   */
  download: async (runId: string, type: ArtifactType): Promise<string> => {
    const sessionId = getSessionId();
    if (!sessionId) {
      throw new Error('Not connected');
    }

    const response = await fetch(
      `${API_URL}/api/runs/${runId}/artifacts/${type.toLowerCase()}`,
      {
        headers: {
          'X-Session-ID': sessionId,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    return response.text();
  },

  /**
   * Download artifact as blob for file save
   */
  downloadBlob: async (
    runId: string,
    type: ArtifactType
  ): Promise<{ blob: Blob; filename: string }> => {
    const content = await artifactApi.download(runId, type);
    
    const mimeTypes: Record<ArtifactType, string> = {
      CSV: 'text/csv',
      JSON: 'application/json',
      MARKDOWN: 'text/markdown',
    };

    const extensions: Record<ArtifactType, string> = {
      CSV: 'csv',
      JSON: 'json',
      MARKDOWN: 'md',
    };

    const blob = new Blob([content], { type: mimeTypes[type] });
    const filename = `evaluation-${runId}.${extensions[type]}`;

    return { blob, filename };
  },
};

// ============================================
// HEALTH CHECK
// ============================================

export const healthApi = {
  /**
   * Check if backend is available
   */
  check: async (): Promise<{ status: string; timestamp: string }> => {
    const response = await fetch(`${API_URL}/health`);
    if (!response.ok) {
      throw new Error('Backend unavailable');
    }
    return response.json();
  },

  /**
   * Check if backend is ready
   */
  ready: async (): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/health/ready`);
      if (!response.ok) return false;
      const data = await response.json();
      return data.status === 'ready';
    } catch {
      return false;
    }
  },
};

// ============================================
// EXPORT DEFAULT
// ============================================

export default {
  runApi,
  catalogApi,
  planApi,
  artifactApi,
  healthApi,
};
