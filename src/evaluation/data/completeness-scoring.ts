/**
 * Completeness Scoring Engine
 * 
 * Implements the scoring algorithm from spec v2:
 * score = 25*cert_verified + 20*owner + 15*description + 10*readme + 10*glossary + 5*tags + 5*dq
 */

import type { MetadataFieldType, CompletenessScoreConfig } from '../types/metadata-assistant';

export interface AssetMetadata {
  certificateStatus?: string;
  ownerUsers?: string[];
  description?: string;
  readme?: string;
  glossaryTerms?: string[];
  atlanTags?: string[];
  customMetadata?: Record<string, unknown>;
}

/**
 * Calculate completeness score for an asset
 */
export function calculateCompletenessScore(
  metadata: AssetMetadata,
  config: CompletenessScoreConfig
): {
  score: number;
  breakdown: Record<string, number>;
  missingFields: MetadataFieldType[];
  isComplete: boolean;
} {
  const breakdown: Record<string, number> = {};
  const missingFields: MetadataFieldType[] = [];
  
  // Certificate (25 points if Verified)
  if (metadata.certificateStatus === 'VERIFIED') {
    breakdown.certificate = config.weights.certificateStatus || 25;
  } else {
    missingFields.push('certificateStatus');
    breakdown.certificate = 0;
  }
  
  // Owner (20 points if present)
  if (metadata.ownerUsers && metadata.ownerUsers.length > 0) {
    breakdown.owner = config.weights.ownerUsers || 20;
  } else {
    missingFields.push('ownerUsers');
    breakdown.owner = 0;
  }
  
  // Description (15 points if >100 chars)
  if (metadata.description && metadata.description.length > 100) {
    breakdown.description = config.weights.description || 15;
  } else {
    missingFields.push('description');
    breakdown.description = 0;
  }
  
  // README or Glossary (10 points)
  if (metadata.readme && metadata.readme.length > 0) {
    breakdown.readme = config.weights.readme || 10;
  } else {
    breakdown.readme = 0;
  }
  
  // Glossary links (10 points)
  if (metadata.glossaryTerms && metadata.glossaryTerms.length > 0) {
    breakdown.glossary = config.weights.glossaryTerms || 10;
  } else {
    missingFields.push('glossaryTerms');
    breakdown.glossary = 0;
  }
  
  // Tags (5 points)
  if (metadata.atlanTags && metadata.atlanTags.length > 0) {
    breakdown.tags = config.weights.atlanTags || 5;
  } else {
    breakdown.tags = 0;
  }
  
  // DQ Config (5 points if custom metadata has DQ fields)
  if (metadata.customMetadata && (
    metadata.customMetadata['dq_score'] !== undefined ||
    metadata.customMetadata['completeness_score'] !== undefined
  )) {
    breakdown.dq = config.weights.customMetadata || 5;
  } else {
    breakdown.dq = 0;
  }
  
  const totalScore = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
  
  return {
    score: totalScore,
    breakdown,
    missingFields,
    isComplete: totalScore >= config.threshold,
  };
}

/**
 * Determine adoption phase based on completeness score
 */
export function getAdoptionPhase(score: number): {
  phase: 'Seeding' | 'Gamification' | 'Operationalization';
  recommendation: string;
  tactics: string[];
} {
  if (score < 20) {
    return {
      phase: 'Seeding',
      recommendation: 'Focus on automated enrichment - crawlers, AI descriptions, bulk imports',
      tactics: [
        'Enable Snowflake/dbt comment crawling',
        'Use Atlan AI for description drafts',
        'Bulk CSV upload for owners',
        'Set up Playbooks for tag automation',
      ],
    };
  }
  
  if (score < 50) {
    return {
      phase: 'Gamification',
      recommendation: 'Engage stewards with gamification and working sessions',
      tactics: [
        'Launch Metadata Bingo campaigns',
        'Run Treasure Hunt challenges',
        'Host steward enrichment sprints',
        'Celebrate top contributors',
      ],
    };
  }
  
  return {
    phase: 'Operationalization',
    recommendation: 'Lock in gains with process changes and automation',
    tactics: [
      'Add metadata checks to CI/CD pipelines',
      'Update PR templates to require metadata',
      'Enable Metadata Propagator',
      'Set up governance approval workflows',
      'Monitor completeness dashboards',
    ],
  };
}

/**
 * Calculate MCP readiness (AI-readiness) for an asset
 */
export function calculateMCPReadiness(metadata: AssetMetadata, assetType: string): {
  isReady: boolean;
  score: number;
  missingRequirements: string[];
} {
  const requirements: Record<string, boolean> = {
    'Description (>100 chars)': !!(metadata.description && metadata.description.length > 100),
    'Owner': !!(metadata.ownerUsers && metadata.ownerUsers.length > 0),
    'Domain/Tags': !!(metadata.atlanTags && metadata.atlanTags.length > 0),
  };
  
  // Add asset-type specific requirements
  if (assetType.includes('Dashboard') || assetType.includes('Report')) {
    requirements['Glossary Terms'] = !!(metadata.glossaryTerms && metadata.glossaryTerms.length > 0);
    requirements['Certificate'] = metadata.certificateStatus === 'VERIFIED';
  }
  
  const met = Object.values(requirements).filter(Boolean).length;
  const total = Object.keys(requirements).length;
  const score = Math.round((met / total) * 100);
  
  const missingRequirements = Object.entries(requirements)
    .filter(([, met]) => !met)
    .map(([req]) => req);
  
  return {
    isReady: score >= 80,
    score,
    missingRequirements,
  };
}

/**
 * Generate completeness report for a set of assets
 */
export function generateCompletenessReport(
  assets: Array<{ name: string; metadata: AssetMetadata }>,
  config: CompletenessScoreConfig
): {
  averageScore: number;
  distribution: Record<string, number>;
  topGaps: Array<{ field: string; missing: number }>;
  adoptionPhase: ReturnType<typeof getAdoptionPhase>;
} {
  const scores = assets.map(asset => calculateCompletenessScore(asset.metadata, config));
  const averageScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
  
  // Score distribution
  const distribution = {
    '0-20': 0,
    '20-50': 0,
    '50-80': 0,
    '80-100': 0,
  };
  
  scores.forEach(({ score }) => {
    if (score < 20) distribution['0-20']++;
    else if (score < 50) distribution['20-50']++;
    else if (score < 80) distribution['50-80']++;
    else distribution['80-100']++;
  });
  
  // Top gaps
  const fieldCounts: Record<string, number> = {};
  scores.forEach(({ missingFields }) => {
    missingFields.forEach(field => {
      fieldCounts[field] = (fieldCounts[field] || 0) + 1;
    });
  });
  
  const topGaps = Object.entries(fieldCounts)
    .map(([field, missing]) => ({ field, missing }))
    .sort((a, b) => b.missing - a.missing)
    .slice(0, 5);
  
  return {
    averageScore,
    distribution,
    topGaps,
    adoptionPhase: getAdoptionPhase(averageScore),
  };
}
