/**
 * Artifact Service
 * Generates export artifacts (CSV, JSON, Markdown)
 */

import * as planRepo from '../db/planRepository.js';
import * as scoreRepo from '../db/scoreRepository.js';
import * as runRepo from '../db/runRepository.js';
import type { Artifact, ArtifactType } from '../types/run.js';

/**
 * Get list of artifacts for a run
 */
export function getArtifacts(runId: string): Artifact[] {
  return planRepo.getArtifacts(runId);
}

/**
 * Get a specific artifact
 */
export function getArtifact(runId: string, type: ArtifactType): Artifact | null {
  return planRepo.getArtifact(runId, type);
}

/**
 * Generate all artifacts for a run
 */
export function generateArtifacts(runId: string): Artifact[] {
  const artifacts: Artifact[] = [];

  // Generate CSV
  const csv = generateCsvArtifact(runId);
  if (csv) {
    const stored = planRepo.storeArtifact(runId, 'CSV', 'text/csv', csv);
    artifacts.push(stored);
  }

  // Generate JSON
  const json = generateJsonArtifact(runId);
  if (json) {
    const stored = planRepo.storeArtifact(runId, 'JSON', 'application/json', json);
    artifacts.push(stored);
  }

  // Generate Markdown
  const markdown = generateMarkdownArtifact(runId);
  if (markdown) {
    const stored = planRepo.storeArtifact(runId, 'MARKDOWN', 'text/markdown', markdown);
    artifacts.push(stored);
  }

  return artifacts;
}

/**
 * Generate CSV export of scores
 */
function generateCsvArtifact(runId: string): string | null {
  const scores = scoreRepo.getScores(runId);
  
  if (scores.length === 0) return null;

  const headers = [
    'GUID',
    'Name',
    'Type',
    'Qualified Name',
    'Impact Score',
    'Quality Score',
    'Quadrant',
  ];

  const rows = scores.map(s => [
    s.subjectId,
    escapeCsv(s.subjectName || ''),
    escapeCsv(s.assetType || ''),
    escapeCsv(s.qualifiedName || ''),
    s.impactScore.toFixed(3),
    s.qualityScore !== null ? s.qualityScore.toFixed(3) : 'UNKNOWN',
    s.quadrant,
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

/**
 * Generate JSON export
 */
function generateJsonArtifact(runId: string): string | null {
  const run = runRepo.getRun(runId);
  const scores = scoreRepo.getScores(runId);
  const gaps = planRepo.getGaps(runId);
  const plan = planRepo.getPlan(runId);

  if (!run) return null;

  const exportData = {
    run: {
      id: run.id,
      status: run.status,
      scope: run.scope,
      createdAt: run.createdAt,
      completedAt: run.completedAt,
    },
    summary: {
      totalAssets: scores.length,
      avgImpact: scores.length > 0 
        ? scores.reduce((sum, s) => sum + s.impactScore, 0) / scores.length 
        : 0,
      quadrantCounts: getQuadrantCounts(scores),
    },
    gaps: gaps.map(g => ({
      field: g.field,
      currentCoverage: g.currentCoverage,
      targetCoverage: g.targetCoverage,
      gapPercent: g.gapPercent,
      priority: g.priority,
      effortHours: g.effortHours,
    })),
    plan: plan ? {
      phases: plan.phases,
      totalWeeks: plan.totalWeeks,
    } : null,
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Generate Markdown report
 */
function generateMarkdownArtifact(runId: string): string | null {
  const run = runRepo.getRun(runId);
  const scores = scoreRepo.getScores(runId);
  const gaps = planRepo.getGaps(runId);
  const plan = planRepo.getPlan(runId);

  if (!run) return null;

  const lines: string[] = [];
  
  // Header
  lines.push('# Metadata Evaluation Report');
  lines.push('');
  lines.push(`**Run ID:** ${run.id}`);
  lines.push(`**Status:** ${run.status}`);
  lines.push(`**Created:** ${run.createdAt}`);
  if (run.completedAt) {
    lines.push(`**Completed:** ${run.completedAt}`);
  }
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Total Assets:** ${scores.length}`);
  
  const avgImpact = scores.length > 0
    ? (scores.reduce((sum, s) => sum + s.impactScore, 0) / scores.length * 100).toFixed(1)
    : '0';
  lines.push(`- **Average Impact:** ${avgImpact}%`);

  const knownScores = scores.filter(s => !s.qualityUnknown);
  const avgQuality = knownScores.length > 0
    ? (knownScores.reduce((sum, s) => sum + (s.qualityScore || 0), 0) / knownScores.length * 100).toFixed(1)
    : 'N/A';
  lines.push(`- **Average Quality:** ${avgQuality}%`);
  lines.push('');

  // Quadrant breakdown
  lines.push('### Quadrant Distribution');
  lines.push('');
  lines.push('| Quadrant | Count | Percentage |');
  lines.push('|----------|-------|------------|');
  
  const quadrantCounts = getQuadrantCounts(scores);
  for (const [quadrant, count] of Object.entries(quadrantCounts)) {
    const pct = scores.length > 0 ? ((count / scores.length) * 100).toFixed(1) : '0';
    lines.push(`| ${quadrant} | ${count} | ${pct}% |`);
  }
  lines.push('');

  // Gaps
  if (gaps.length > 0) {
    lines.push('## Metadata Gaps');
    lines.push('');
    lines.push('| Field | Current | Target | Gap | Priority | Effort (hrs) |');
    lines.push('|-------|---------|--------|-----|----------|--------------|');
    
    for (const gap of gaps) {
      lines.push(
        `| ${gap.field} | ${(gap.currentCoverage * 100).toFixed(0)}% | ${(gap.targetCoverage * 100).toFixed(0)}% | ${(gap.gapPercent * 100).toFixed(0)}% | ${gap.priority} | ${gap.effortHours.toFixed(1)} |`
      );
    }
    lines.push('');
  }

  // Plan
  if (plan && plan.phases.length > 0) {
    lines.push('## Remediation Plan');
    lines.push('');
    lines.push(`**Total Duration:** ${plan.totalWeeks} weeks`);
    lines.push('');

    for (const phase of plan.phases) {
      lines.push(`### ${phase.name} (${phase.estimatedWeeks} weeks)`);
      lines.push('');
      lines.push(phase.description);
      lines.push('');
      lines.push('**Fields:** ' + phase.fields.join(', '));
      lines.push('');
      lines.push('**Milestone:** ' + phase.milestone);
      lines.push('');
    }
  }

  return lines.join('\n');
}

// Helpers

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function getQuadrantCounts(scores: { quadrant: string }[]): Record<string, number> {
  const counts: Record<string, number> = { HH: 0, HL: 0, LH: 0, LL: 0, HU: 0, LU: 0 };
  for (const score of scores) {
    counts[score.quadrant] = (counts[score.quadrant] || 0) + 1;
  }
  return counts;
}
