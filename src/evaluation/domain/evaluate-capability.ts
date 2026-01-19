import {
  EvidenceProvider,
  UseCaseSpec,
  ScoringConfig,
  assess,
} from '@atlan/assessment-lib';
import {
  EvaluationRun,
  createEvaluationId,
} from './models/evaluation';
import { GapEngine } from './engines/gap-engine';
import { ScoreEngine } from './engines/score-engine';
import { PlanEngine } from './engines/plan-engine';
import { mapEvidenceBundleToSignals } from './engines/signal-mapper';
import { getCapabilityRequirements } from './requirements/capability-requirements';
import { computeGapSummary } from './models/gaps';

/**
 * Main evaluation orchestrator
 * Runs a complete capability assessment: evidence → assessment → gaps → plans
 */
export async function evaluateCapability(params: {
  capabilityId: string;
  scopeId: string;
  provider: EvidenceProvider;
  useCaseSpec: UseCaseSpec;
  scoringConfig: ScoringConfig;
  providerMode: 'mock' | 'atlan';
}): Promise<EvaluationRun> {
  const {
    capabilityId,
    scopeId,
    provider,
    useCaseSpec,
    scoringConfig,
    providerMode,
  } = params;

  const startTime = Date.now();
  const timestamp = new Date();
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Step 1: Get evidence from provider
    const evidenceBundle = await provider.getEvidence(scopeId);
    const assetCount = evidenceBundle.assets.length;

    if (assetCount === 0) {
      warnings.push('No assets found in scope');
    }

    // Step 2: Run assessment (from scoring library)
    const assessmentResult = assess(useCaseSpec, scoringConfig, evidenceBundle);

    // Step 3: Map evidence to canonical signals
    const signalsMap = mapEvidenceBundleToSignals(evidenceBundle.assets);

    // Step 4: Get capability requirements
    const requirements = getCapabilityRequirements(capabilityId);
    if (!requirements) {
      throw new Error(`Unknown capability: ${capabilityId}`);
    }

    // Step 5: Compute gaps
    const gapEngine = new GapEngine();
    const { gaps, summary: gapSummary } = gapEngine.computeAllGaps(
      evidenceBundle.assets,
      signalsMap,
      requirements
    );

    // Step 6: Compute enriched scores
    const scoreEngine = new ScoreEngine();
    const scores = scoreEngine.computeSubjectScores(
      evidenceBundle.assets,
      signalsMap,
      requirements,
      assessmentResult
    );

    // Step 7: Generate remediation plan
    const planEngine = new PlanEngine();
    const plan = planEngine.generatePlan(capabilityId, scopeId, gaps);

    // Step 8: Determine readiness
    const readiness = {
      ready:
        assessmentResult.gatePass &&
        typeof assessmentResult.readiness === 'number' &&
        assessmentResult.readiness >= (scoringConfig.readyThreshold || 0.75),
      score:
        typeof assessmentResult.readiness === 'number'
          ? assessmentResult.readiness
          : 0,
      reason: assessmentResult.gatePass
        ? undefined
        : 'Gate failures prevent readiness',
      gateFailures: assessmentResult.blockers,
    };

    const durationMs = Date.now() - startTime;

    return {
      id: createEvaluationId(capabilityId, timestamp),
      capabilityId,
      capabilityName: requirements.name,
      scopeId,
      scopeDescription: `Scope: ${scopeId}`,
      timestamp: timestamp.toISOString(),
      providerMode,
      assessmentResult,
      scores,
      gaps,
      gapSummary,
      plan,
      readiness,
      execution: {
        assetCount,
        durationMs,
        errors,
        warnings,
      },
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(errorMessage);

    // Return partial evaluation with error
    throw new Error(`Evaluation failed: ${errorMessage}`);
  }
}
