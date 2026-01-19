/**
 * Strategy Scout - Value vs Viability Matrix (VVM)
 * Module A from spec v2
 * 
 * Helps determine where to pilot metadata initiatives
 * using value/viability scoring.
 */

import type { DomainScore, VVMClassification, StrategyScoutResult } from '../types/metadata-assistant';

/**
 * Calculate VVM classification based on value and viability scores
 */
export function calculateVVMClassification(valueScore: number, viabilityScore: number): VVMClassification {
  const maxValue = 15; // 3 dimensions × 5 points
  const maxViability = 20; // 4 dimensions × 5 points
  
  const valuePercent = (valueScore / maxValue) * 100;
  const viabilityPercent = (viabilityScore / maxViability) * 100;
  
  const highValue = valuePercent >= 60;
  const highViability = viabilityPercent >= 60;
  
  if (highValue && highViability) return 'Quick Win';
  if (highValue && !highViability) return 'Big Bet';
  if (!highValue && highViability) return 'Game Changer';
  return 'Backlog';
}

/**
 * Generate rationale for domain classification
 */
export function generateRationale(score: DomainScore): string {
  const { classification, valueScore, viabilityScore, domain } = score;
  
  const rationales: Record<VVMClassification, string> = {
    'Quick Win': `${domain} has strong business value (${valueScore}/15) and high implementation viability (${viabilityScore}/20). Perfect pilot candidate - start here.`,
    'Big Bet': `${domain} offers significant value (${valueScore}/15) but faces implementation challenges (${viabilityScore}/20). Consider after building momentum with quick wins.`,
    'Game Changer': `${domain} is highly viable (${viabilityScore}/20) but lower immediate value (${valueScore}/15). Good for building capability and confidence.`,
    'Backlog': `${domain} has lower value (${valueScore}/15) and viability (${viabilityScore}/20). Defer until higher-priority domains are complete.`,
  };
  
  return rationales[classification];
}

/**
 * Score a domain using VVM criteria
 */
export function scoreDomain(input: {
  domain: string;
  businessImpact: number;
  userReach: number;
  regulatoryPressure: number;
  leadershipSponsorship: number;
  smeAvailability: number;
  existingDocumentation: number;
  toolingReadiness: number;
}): DomainScore {
  const valueScore = input.businessImpact + input.userReach + input.regulatoryPressure;
  const viabilityScore = input.leadershipSponsorship + input.smeAvailability + input.existingDocumentation + input.toolingReadiness;
  
  const classification = calculateVVMClassification(valueScore, viabilityScore);
  
  const score: DomainScore = {
    domain: input.domain,
    businessImpact: input.businessImpact,
    userReach: input.userReach,
    regulatoryPressure: input.regulatoryPressure,
    valueScore,
    leadershipSponsorship: input.leadershipSponsorship,
    smeAvailability: input.smeAvailability,
    existingDocumentation: input.existingDocumentation,
    toolingReadiness: input.toolingReadiness,
    viabilityScore,
    classification,
    rationale: '',
  };
  
  score.rationale = generateRationale(score);
  
  return score;
}

/**
 * Analyze multiple domains and recommend pilot
 */
export function analyzeDomainsForPilot(domains: Array<{
  domain: string;
  businessImpact: number;
  userReach: number;
  regulatoryPressure: number;
  leadershipSponsorship: number;
  smeAvailability: number;
  existingDocumentation: number;
  toolingReadiness: number;
}>): StrategyScoutResult {
  const scores = domains.map(scoreDomain);
  
  // Sort by Quick Wins first, then by combined score
  const sorted = scores.sort((a, b) => {
    if (a.classification === 'Quick Win' && b.classification !== 'Quick Win') return -1;
    if (a.classification !== 'Quick Win' && b.classification === 'Quick Win') return 1;
    return (b.valueScore + b.viabilityScore) - (a.valueScore + a.viabilityScore);
  });
  
  const recommended = sorted[0];
  
  return {
    domains: sorted,
    recommendedPilot: recommended.domain,
    recommendation: `Start with **${recommended.domain}** (${recommended.classification}): ${recommended.rationale}`,
  };
}

/**
 * Generate sample VVM scoring for common domains
 */
export function getSampleDomainScores(): DomainScore[] {
  const samples = [
    {
      domain: 'Finance',
      businessImpact: 5,
      userReach: 4,
      regulatoryPressure: 5,
      leadershipSponsorship: 5,
      smeAvailability: 4,
      existingDocumentation: 3,
      toolingReadiness: 5,
    },
    {
      domain: 'Marketing',
      businessImpact: 4,
      userReach: 5,
      regulatoryPressure: 2,
      leadershipSponsorship: 3,
      smeAvailability: 4,
      existingDocumentation: 2,
      toolingReadiness: 4,
    },
    {
      domain: 'Supply Chain',
      businessImpact: 5,
      userReach: 3,
      regulatoryPressure: 3,
      leadershipSponsorship: 2,
      smeAvailability: 2,
      existingDocumentation: 1,
      toolingReadiness: 2,
    },
  ];
  
  return samples.map(scoreDomain);
}
