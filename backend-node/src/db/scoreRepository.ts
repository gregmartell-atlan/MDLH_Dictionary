/**
 * Score Repository
 * Database operations for scores
 */

import { getDatabase } from './sqlite.js';
import type { Score, DomainScore, Quadrant } from '../types/run.js';

// ============================================
// SCORE OPERATIONS
// ============================================

export function storeScores(runId: string, scores: Score[]): number {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO scores 
    (run_id, subject_type, subject_id, subject_name, asset_type, qualified_name,
     impact_score, quality_score, quality_unknown, quadrant, explanations_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((items: Score[]) => {
    let count = 0;
    for (const score of items) {
      stmt.run(
        runId,
        score.subjectType,
        score.subjectId,
        score.subjectName || null,
        score.assetType || null,
        score.qualifiedName || null,
        score.impactScore,
        score.qualityScore,
        score.qualityUnknown ? 1 : 0,
        score.quadrant,
        JSON.stringify(score.explanations)
      );
      count++;
    }
    return count;
  });

  return insertMany(scores);
}

export function getScores(runId: string): Score[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, run_id, subject_type, subject_id, subject_name, asset_type, qualified_name,
           impact_score, quality_score, quality_unknown, quadrant, explanations_json
    FROM scores WHERE run_id = ?
  `);

  const rows = stmt.all(runId) as Array<{
    id: number;
    run_id: string;
    subject_type: 'ASSET' | 'SCHEMA' | 'DATABASE';
    subject_id: string;
    subject_name: string | null;
    asset_type: string | null;
    qualified_name: string | null;
    impact_score: number;
    quality_score: number | null;
    quality_unknown: number;
    quadrant: Quadrant;
    explanations_json: string | null;
  }>;

  return rows.map(row => ({
    id: row.id,
    runId: row.run_id,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    subjectName: row.subject_name || undefined,
    assetType: row.asset_type || undefined,
    qualifiedName: row.qualified_name || undefined,
    impactScore: row.impact_score,
    qualityScore: row.quality_score,
    qualityUnknown: row.quality_unknown === 1,
    quadrant: row.quadrant,
    explanations: JSON.parse(row.explanations_json || '[]'),
  }));
}

export function getDomainScores(runId: string): DomainScore[] {
  const db = getDatabase();
  
  // Aggregate scores by connector (domain)
  const stmt = db.prepare(`
    SELECT 
      c.connector_name as domain,
      COUNT(*) as asset_count,
      COUNT(CASE WHEN s.quality_unknown = 0 THEN 1 END) as known_asset_count,
      AVG(s.impact_score) as avg_impact,
      AVG(CASE WHEN s.quality_unknown = 0 THEN s.quality_score END) as avg_quality
    FROM catalog c
    LEFT JOIN scores s ON c.run_id = s.run_id AND c.guid = s.subject_id
    WHERE c.run_id = ?
    GROUP BY c.connector_name
    ORDER BY asset_count DESC
  `);

  const rows = stmt.all(runId) as Array<{
    domain: string | null;
    asset_count: number;
    known_asset_count: number;
    avg_impact: number | null;
    avg_quality: number | null;
  }>;

  return rows.map((row, index) => {
    const domain = row.domain || 'Unknown';
    const impactScore = row.avg_impact || 0.25;
    const qualityScore = row.avg_quality;
    const qualityUnknown = row.known_asset_count === 0;
    
    // Compute quadrant
    let quadrant: Quadrant;
    const highImpact = impactScore >= 0.5;
    
    if (qualityUnknown || qualityScore === null) {
      quadrant = highImpact ? 'HU' : 'LU';
    } else {
      const highQuality = qualityScore >= 0.7;
      if (highImpact && highQuality) quadrant = 'HH';
      else if (highImpact && !highQuality) quadrant = 'HL';
      else if (!highImpact && highQuality) quadrant = 'LH';
      else quadrant = 'LL';
    }

    return {
      id: `domain-${index}`,
      runId,
      subjectType: 'CONNECTOR',
      subjectId: domain,
      impactScore,
      qualityScore,
      qualityUnknown,
      quadrant,
      assetCount: row.asset_count,
      knownAssetCount: row.known_asset_count,
    };
  });
}

export function getScoresByQuadrant(runId: string, quadrant: Quadrant): Score[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, run_id, subject_type, subject_id, subject_name, asset_type, qualified_name,
           impact_score, quality_score, quality_unknown, quadrant, explanations_json
    FROM scores WHERE run_id = ? AND quadrant = ?
  `);

  const rows = stmt.all(runId, quadrant) as Array<{
    id: number;
    run_id: string;
    subject_type: 'ASSET' | 'SCHEMA' | 'DATABASE';
    subject_id: string;
    subject_name: string | null;
    asset_type: string | null;
    qualified_name: string | null;
    impact_score: number;
    quality_score: number | null;
    quality_unknown: number;
    quadrant: Quadrant;
    explanations_json: string | null;
  }>;

  return rows.map(row => ({
    id: row.id,
    runId: row.run_id,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    subjectName: row.subject_name || undefined,
    assetType: row.asset_type || undefined,
    qualifiedName: row.qualified_name || undefined,
    impactScore: row.impact_score,
    qualityScore: row.quality_score,
    qualityUnknown: row.quality_unknown === 1,
    quadrant: row.quadrant,
    explanations: JSON.parse(row.explanations_json || '[]'),
  }));
}

export function clearScores(runId: string): void {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM scores WHERE run_id = ?');
  stmt.run(runId);
}
