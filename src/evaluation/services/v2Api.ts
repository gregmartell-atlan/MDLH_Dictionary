/**
 * v2Api.ts - DEPRECATED
 * 
 * This file is maintained for backwards compatibility only.
 * All functions re-export from evaluationApi.ts which has proper session handling.
 * 
 * NEW CODE SHOULD IMPORT FROM evaluationApi.ts DIRECTLY.
 */

import {
  runApi,
  catalogApi,
  planApi,
  artifactApi,
  type Run,
  type RunScope,
  type Score,
  type DomainScore as EvalDomainScore,
  type DomainAssets,
  type Gap,
  type Plan,
  type Artifact as EvalArtifact,
  type Asset,
} from './evaluationApi';

// Re-export types with original names for backwards compatibility
export type RunStatus = 'CREATED' | 'INGESTING' | 'SCORING' | 'COMPLETED' | 'FAILED';

export interface RunDetails {
  id: string;
  createdAt: string;
  status: RunStatus;
  scope?: string;
  selectedCapabilities: string[];
  scores?: unknown[];
  gaps?: unknown[];
  plans?: unknown[];
  artifacts?: unknown[];
}

export { type RunScope };

// ============================================
// RUN FUNCTIONS
// ============================================

export async function createRun(
  scope: RunScope | string | undefined,
  capabilities: string[]
): Promise<RunDetails> {
  // Handle legacy string scope
  const parsedScope: RunScope = typeof scope === 'string' 
    ? JSON.parse(scope) 
    : scope || {};
  
  const run = await runApi.create(parsedScope, capabilities);
  
  return {
    id: run.id,
    createdAt: run.createdAt,
    status: run.status,
    scope: JSON.stringify(run.scope),
    selectedCapabilities: run.capabilities,
  };
}

export async function getRun(
  id: string
): Promise<RunDetails & { scores: unknown[]; gaps: unknown[]; plans: unknown[]; artifacts: unknown[] }> {
  const run = await runApi.get(id);
  
  // Fetch additional data
  let scores: unknown[] = [];
  let gaps: unknown[] = [];
  let plans: unknown[] = [];
  let artifacts: unknown[] = [];
  
  try {
    const scoresResult = await catalogApi.getScores(id);
    scores = scoresResult.scores;
  } catch { /* ignore */ }
  
  try {
    gaps = await planApi.getGaps(id);
  } catch { /* ignore */ }
  
  try {
    const plan = await planApi.getPlan(id);
    plans = plan ? [plan] : [];
  } catch { /* ignore */ }
  
  try {
    artifacts = await artifactApi.list(id);
  } catch { /* ignore */ }
  
  return {
    id: run.id,
    createdAt: run.createdAt,
    status: run.status,
    scope: JSON.stringify(run.scope),
    selectedCapabilities: run.capabilities,
    scores,
    gaps,
    plans,
    artifacts,
  };
}

// ============================================
// MODEL FUNCTIONS
// ============================================

/**
 * @deprecated Templates are not implemented in the backend
 */
export async function createModelFromTemplate(
  _runId: string,
  _templateId: string
): Promise<unknown> {
  console.warn('createModelFromTemplate is deprecated - templates are not implemented');
  throw new Error('Templates feature is not implemented');
}

export async function getModel(runId: string): Promise<unknown> {
  try {
    return await planApi.getModel(runId);
  } catch (err) {
    if ((err as Error).message?.includes('404')) return null;
    throw err;
  }
}

export async function getCatalog(runId: string): Promise<Asset[]> {
  return catalogApi.getAssets(runId);
}

/**
 * @deprecated Model entities API is not implemented in the backend
 */
export async function attachRequirements(
  _runId: string,
  _nodeId: string,
  _requirementIds: string[]
): Promise<unknown> {
  console.warn('attachRequirements is deprecated - model entities API is not implemented');
  throw new Error('Model entities feature is not implemented');
}

/**
 * @deprecated Model entities API is not implemented in the backend
 */
export async function addEntity(
  _runId: string,
  _entity: { name: string; type: string; requirementIds?: string[] }
): Promise<unknown> {
  console.warn('addEntity is deprecated - model entities API is not implemented');
  throw new Error('Model entities feature is not implemented');
}

/**
 * @deprecated Model entities API is not implemented in the backend
 */
export async function removeEntity(
  _runId: string,
  _nodeId: string
): Promise<unknown> {
  console.warn('removeEntity is deprecated - model entities API is not implemented');
  throw new Error('Model entities feature is not implemented');
}

// ============================================
// GAP FUNCTIONS
// ============================================

export async function recomputeGaps(runId: string): Promise<Gap[]> {
  return planApi.recomputeGaps(runId);
}

export async function getGaps(runId: string): Promise<Gap[]> {
  return planApi.getGaps(runId);
}

// ============================================
// PLAN FUNCTIONS
// ============================================

export async function generatePlan(runId: string): Promise<Plan> {
  // Note: v2Api used /plans (plural), but backend uses /plan (singular)
  return planApi.generatePlan(runId);
}

export async function getPlan(runId: string): Promise<Plan | null> {
  try {
    return await planApi.getPlan(runId);
  } catch (err) {
    if ((err as Error).message?.includes('404')) return null;
    throw err;
  }
}

// ============================================
// INGEST/SCORE FUNCTIONS
// ============================================

export async function ingestRun(
  runId: string,
  _atlanUrl?: string,
  _apiKey?: string
): Promise<{ assetCount: number }> {
  // Note: atlanUrl and apiKey are ignored - backend gets these from session
  return runApi.ingest(runId);
}

export async function scoreRun(runId: string): Promise<{ scoreCount: number }> {
  return runApi.score(runId);
}

// ============================================
// SCORE TYPES & FUNCTIONS
// ============================================

export interface DomainScore {
  id: string;
  runId: string;
  subjectType: string;
  subjectId: string;
  impactScore: number;
  qualityScore: number | null;
  qualityUnknown: boolean;
  quadrant: string;
  assetCount: number;
  knownAssetCount: number;
  explanationsJson: unknown[];
}

export async function getDomainScores(runId: string): Promise<DomainScore[]> {
  const scores = await catalogApi.getDomainScores(runId);
  
  // Map to legacy format
  return scores.map((s: EvalDomainScore) => ({
    id: s.id,
    runId: s.runId,
    subjectType: s.subjectType,
    subjectId: s.subjectId,
    impactScore: s.impactScore,
    qualityScore: s.qualityScore,
    qualityUnknown: s.qualityUnknown,
    quadrant: s.quadrant,
    assetCount: s.assetCount,
    knownAssetCount: s.knownAssetCount,
    explanationsJson: [],
  }));
}

export interface DomainAsset {
  assetGuid: string;
  name: string;
  type: string;
  qualifiedName: string | null;
  atlanUrl: string | null;
  signals: Array<{ key: string; present: boolean; evidenceRefs: string[] }>;
  score: {
    impactScore: number;
    qualityScore: number | null;
    qualityUnknown: boolean;
  } | null;
  quadrant: string;
}

export async function getDomainAssets(
  runId: string,
  domainId: string
): Promise<DomainAsset[]> {
  const result = await catalogApi.getDomainAssets(runId, domainId);
  
  // Map to legacy format
  return result.assets.map((score: Score) => ({
    assetGuid: score.subjectId,
    name: score.subjectName || '',
    type: score.assetType || '',
    qualifiedName: score.qualifiedName || null,
    atlanUrl: null,
    signals: [],
    score: {
      impactScore: score.impactScore,
      qualityScore: score.qualityScore,
      qualityUnknown: score.qualityUnknown,
    },
    quadrant: score.quadrant,
  }));
}

// ============================================
// ARTIFACT TYPES & FUNCTIONS
// ============================================

export interface Artifact {
  type: string;
  format: string;
}

export async function generateArtifacts(runId: string): Promise<Artifact[]> {
  const artifacts = await artifactApi.generate(runId);
  return artifacts.map((a: EvalArtifact) => ({
    type: a.type,
    format: a.format,
  }));
}

export async function getArtifacts(runId: string): Promise<Artifact[]> {
  const artifacts = await artifactApi.list(runId);
  return artifacts.map((a: EvalArtifact) => ({
    type: a.type,
    format: a.format,
  }));
}

export async function getArtifactContent(
  runId: string,
  type: string
): Promise<string> {
  return artifactApi.download(runId, type.toUpperCase() as 'CSV' | 'JSON' | 'MARKDOWN');
}
