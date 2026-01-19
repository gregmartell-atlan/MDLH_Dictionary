/**
 * Custom Fields Enrichment Readiness Module
 *
 * Assesses organizational, technical, and process readiness for custom field
 * enrichment adoption. Provides readiness scores, gap analysis, and prerequisite
 * checklists to guide phased implementation.
 */

import type { AssetType } from './custom-fields-asset-targeting';
import type { AssetBreakdown, FieldCoverage, MetadataFieldType } from '../types/priority';
import { COMPLETENESS_WEIGHTS } from '../types/priority';

// ============================================================================
// Readiness Assessment Types
// ============================================================================

export type ReadinessLevel = 'not-ready' | 'emerging' | 'capable' | 'optimized';
export type MaturityGrade = 'beginner' | 'intermediate' | 'advanced';

export interface PrerequisiteItem {
  name: string;
  description: string;
  status: 'not-started' | 'in-progress' | 'complete';
  effort: 'low' | 'medium' | 'high';
  estimatedWeeks: number;
  owner?: string;
  dependencies?: string[];
}

export interface OrganizationalReadiness {
  dimension: string;
  currentMaturity: MaturityGrade;
  readinessScore: number;
  strengths: string[];
  gaps: string[];
  recommendations: string[];
}

export interface ProcessReadiness {
  process: string;
  status: 'missing' | 'ad-hoc' | 'documented' | 'automated';
  readinessScore: number;
  currentTooling: string[];
  requiredTooling: string[];
  efforts: {
    defineProcess: number;
    implementTooling: number;
    trainTeam: number;
    total: number;
  };
}

export interface PrerequisiteChecklist {
  prerequisites: PrerequisiteItem[];
  completionPercentage: number;
  estimatedCompletionWeeks: number;
  blockers: string[];
  nextSteps: string[];
}

export interface AdoptionReadinessPhase {
  phase: string;
  duration: string;
  readinessRequirements: string[];
  successCriteria: string[];
  priorPhasePrerequisites: string[];
}

export interface ReadinessRisk {
  risk: string;
  likelihood: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  readinessMitigation: string;
}

export interface ReadinessAssessment {
  organization: string;
  assessmentDate: string;
  overallReadinessScore: number;
  overallReadinessLevel: ReadinessLevel;
  organizationalReadiness: OrganizationalReadiness[];
  processReadiness: ProcessReadiness[];
  assetTypeReadiness: Record<AssetType, number>;
  criticalGaps: string[];
  prerequisites: PrerequisiteChecklist;
  adoptionRoadmap: AdoptionReadinessPhase[];
  risks: ReadinessRisk[];
}

// =============================================================================
// Optional MDLH/Atlan coverage input
// =============================================================================

export interface MetadataCoverageSnapshot {
  fieldCoverage?: FieldCoverage[];
  assetBreakdown?: AssetBreakdown[];
  overallCompletenessScore?: number; // 0-100
}

const COVERAGE_GAP_LABELS: Array<{ field: MetadataFieldType; label: string }> = [
  { field: 'ownerUsers', label: 'Ownership coverage' },
  { field: 'description', label: 'Description coverage' },
  { field: 'lineage', label: 'Lineage coverage' },
  { field: 'atlanTags', label: 'Tag/classification coverage' },
  { field: 'glossaryTerms', label: 'Glossary coverage' },
];

function calculateCoverageScore(fieldCoverage?: FieldCoverage[]): number | null {
  if (!fieldCoverage || fieldCoverage.length === 0) return null;

  let totalWeight = 0;
  let weightedSum = 0;

  for (const entry of fieldCoverage) {
    const weight = COMPLETENESS_WEIGHTS[entry.field];
    if (!weight) continue;
    totalWeight += weight;
    weightedSum += entry.coveragePercent * weight;
  }

  if (totalWeight === 0) return null;
  return Math.round((weightedSum / totalWeight) * 100);
}

function mapAssetTypeToReadinessKey(typeName: string): AssetType | null {
  const lower = typeName.toLowerCase();
  if (lower.includes('column')) return 'Column';
  if (lower.includes('schema')) return 'Schema';
  if (lower.includes('database')) return 'Database';
  if (lower.includes('view') || lower.includes('table')) return 'Table';
  return null;
}

function mergeAssetReadinessFromCoverage(
  base: Record<AssetType, number>,
  breakdown?: AssetBreakdown[]
): Record<AssetType, number> {
  if (!breakdown || breakdown.length === 0) return base;

  const totals = new Map<AssetType, { sum: number; count: number }>();

  for (const row of breakdown) {
    const key = mapAssetTypeToReadinessKey(row.assetType);
    if (!key) continue;
    const current = totals.get(key) || { sum: 0, count: 0 };
    current.sum += row.avgCompleteness;
    current.count += 1;
    totals.set(key, current);
  }

  const next = { ...base };
  for (const [key, stat] of totals.entries()) {
    if (stat.count > 0) {
      next[key] = Math.round(stat.sum / stat.count);
    }
  }

  return next;
}

// ============================================================================
// Organizational Readiness Assessment
// ============================================================================

const ORGANIZATIONAL_READINESS_DIMENSIONS: Record<string, OrganizationalReadiness> = {
  'data-governance': {
    dimension: 'Data Governance Maturity',
    currentMaturity: 'intermediate',
    readinessScore: 65,
    strengths: ['Established governance framework', 'Clear data ownership', 'Policy documentation'],
    gaps: ['Custom field policy absence', 'Limited cross-team collaboration'],
    recommendations: ['Create custom field governance policy', 'Establish governance council'],
  },

  'data-quality': {
    dimension: 'Data Quality Culture',
    currentMaturity: 'beginner',
    readinessScore: 40,
    strengths: ['Quality awareness', 'Manual quality checks'],
    gaps: ['Lack of automation', 'Limited accountability', 'No quality SLAs'],
    recommendations: ['Establish data quality CoE', 'Define quality metrics and SLAs'],
  },

  'metadata-management': {
    dimension: 'Metadata Management Maturity',
    currentMaturity: 'intermediate',
    readinessScore: 60,
    strengths: ['Metadata catalog in use', 'Basic documentation', 'Ownership assignment'],
    gaps: ['Limited custom metadata', 'Inconsistent documentation', 'No enrichment automation'],
    recommendations: ['Expand metadata model for custom fields', 'Implement metadata automation'],
  },

  'organizational-alignment': {
    dimension: 'Cross-Functional Alignment',
    currentMaturity: 'intermediate',
    readinessScore: 55,
    strengths: ['Interdepartmental communication'],
    gaps: ['Siloed priorities', 'Competing initiatives', 'Resource constraints'],
    recommendations: ['Establish steering committee', 'Create shared roadmap'],
  },

  'skills-and-training': {
    dimension: 'Skills & Training Readiness',
    currentMaturity: 'beginner',
    readinessScore: 35,
    strengths: ['Technical expertise available'],
    gaps: ['Limited custom field knowledge', 'No enrichment certification'],
    recommendations: ['Create custom field training curriculum', 'Develop certification program'],
  },

  'change-management': {
    dimension: 'Change Management Capability',
    currentMaturity: 'beginner',
    readinessScore: 40,
    strengths: ['Change management team exists'],
    gaps: ['Limited process standardization', 'Inconsistent communication'],
    recommendations: ['Develop change management plan', 'Create stakeholder communication strategy'],
  },
};

// ============================================================================
// Process Readiness Assessment
// ============================================================================

const PROCESS_READINESS_AREAS: ProcessReadiness[] = [
  {
    process: 'Field Definition & Standardization',
    status: 'ad-hoc',
    readinessScore: 45,
    currentTooling: ['Spreadsheet', 'Wiki pages'],
    requiredTooling: ['Field registry', 'Version control', 'Approval workflow'],
    efforts: { defineProcess: 2, implementTooling: 4, trainTeam: 1, total: 7 },
  },

  {
    process: 'Data Enrichment & Automation',
    status: 'missing',
    readinessScore: 20,
    currentTooling: [],
    requiredTooling: ['Rules engine', 'Workflow orchestration'],
    efforts: { defineProcess: 3, implementTooling: 6, trainTeam: 2, total: 11 },
  },

  {
    process: 'Enrichment Quality Assurance',
    status: 'ad-hoc',
    readinessScore: 35,
    currentTooling: ['Manual reviews'],
    requiredTooling: ['QA automation', 'Validation rules'],
    efforts: { defineProcess: 2, implementTooling: 3, trainTeam: 1, total: 6 },
  },

  {
    process: 'Compliance & Audit Tracking',
    status: 'documented',
    readinessScore: 60,
    currentTooling: ['Audit logs', 'Manual reports'],
    requiredTooling: ['Automated audit', 'Compliance dashboard'],
    efforts: { defineProcess: 1, implementTooling: 2, trainTeam: 0.5, total: 3.5 },
  },

  {
    process: 'Enrichment Metrics & Reporting',
    status: 'ad-hoc',
    readinessScore: 30,
    currentTooling: ['Manual reports'],
    requiredTooling: ['Analytics platform', 'Custom dashboards'],
    efforts: { defineProcess: 2, implementTooling: 4, trainTeam: 1, total: 7 },
  },
];

// ============================================================================
// Readiness Assessment Generation
// ============================================================================

export function generateReadinessAssessment(
  org: {
  name: string;
  currentMaturity: MaturityGrade;
  teamSize: number;
  governanceMaturity: MaturityGrade;
},
  metadataCoverage?: MetadataCoverageSnapshot
): ReadinessAssessment {
  const organizationalReadiness = Object.values(ORGANIZATIONAL_READINESS_DIMENSIONS);
  const processReadiness = PROCESS_READINESS_AREAS;

  const assetTypeReadiness: Record<AssetType, number> = {
    Database: 65,
    Schema: 60,
    Table: 70,
    Column: 55,
    README: 40,
    Asset: 50,
    Process: 45,
  };

  // Adjust based on maturity
  if (org.currentMaturity === 'beginner') {
    (Object.keys(assetTypeReadiness) as AssetType[]).forEach((key) => {
      assetTypeReadiness[key] = Math.max(20, assetTypeReadiness[key] - 15);
    });
  } else if (org.currentMaturity === 'advanced') {
    (Object.keys(assetTypeReadiness) as AssetType[]).forEach((key) => {
      assetTypeReadiness[key] = Math.min(95, assetTypeReadiness[key] + 15);
    });
  }

  // Compute overall readiness
  const allScores = [
    ...organizationalReadiness.map((o) => o.readinessScore),
    ...processReadiness.map((p) => p.readinessScore),
  ];
  const baselineScore = Math.round(allScores.reduce((a, b) => a + b) / allScores.length);
  const coverageScore = metadataCoverage?.overallCompletenessScore ?? calculateCoverageScore(metadataCoverage?.fieldCoverage);
  const overallScore = coverageScore === null
    ? baselineScore
    : Math.round((baselineScore * 0.7) + (coverageScore * 0.3));

  const overallLevel: ReadinessLevel =
    overallScore < 40 ? 'not-ready' : overallScore < 60 ? 'emerging' : overallScore < 80 ? 'capable' : 'optimized';

  // Identify critical gaps
  const criticalGaps: string[] = [];
  organizationalReadiness
    .filter((o) => o.readinessScore < 50)
    .forEach((o) => criticalGaps.push(`${o.dimension}: ${o.gaps.join(', ')}`));

  if (metadataCoverage?.fieldCoverage) {
    for (const { field, label } of COVERAGE_GAP_LABELS) {
      const entry = metadataCoverage.fieldCoverage.find((c) => c.field === field);
      if (entry && entry.coveragePercent < 0.4) {
        criticalGaps.push(`${label} below 40%`);
      }
    }
  }

  const mergedAssetTypeReadiness = mergeAssetReadinessFromCoverage(
    assetTypeReadiness,
    metadataCoverage?.assetBreakdown
  );

  // Build prerequisites
  const allPrerequisites: PrerequisiteItem[] = [
    {
      name: 'Metadata infrastructure',
      description: 'Support for custom fields in metadata store',
      status: 'in-progress',
      effort: 'high',
      estimatedWeeks: 4,
    },
    {
      name: 'Data classification capability',
      description: 'Automated classification scanning',
      status: 'not-started',
      effort: 'high',
      estimatedWeeks: 6,
    },
    {
      name: 'Governance policy',
      description: 'Define custom field governance standards',
      status: 'not-started',
      effort: 'medium',
      estimatedWeeks: 2,
    },
    {
      name: 'Team training',
      description: 'Train teams on custom field best practices',
      status: 'not-started',
      effort: 'medium',
      estimatedWeeks: 2,
    },
  ];

  const completionPercentage = Math.round(
    (allPrerequisites.filter((p) => p.status === 'complete').length / allPrerequisites.length) * 100
  );
  const estimatedWeeks = allPrerequisites
    .filter((p) => p.status !== 'complete')
    .reduce((sum, p) => sum + p.estimatedWeeks, 0);
  const blockers = allPrerequisites.filter((p) => p.status === 'not-started').map((p) => p.name);

  // Build adoption roadmap
  const adoptionRoadmap: AdoptionReadinessPhase[] = [
    {
      phase: 'Phase 1: Readiness Assessment & Planning (Weeks 1-2)',
      duration: '2 weeks',
      readinessRequirements: ['Governance framework aligned', 'Stakeholder buy-in obtained'],
      successCriteria: ['Assessment completed', 'Roadmap approved'],
      priorPhasePrerequisites: [],
    },
    {
      phase: 'Phase 2: Foundation Setup (Weeks 3-8)',
      duration: '6 weeks',
      readinessRequirements: ['Metadata store updated', 'Basic automation in place'],
      successCriteria: ['Infrastructure deployed', 'First fields defined'],
      priorPhasePrerequisites: ['Phase 1 complete'],
    },
    {
      phase: 'Phase 3: Enrichment Scaling (Weeks 9-16)',
      duration: '8 weeks',
      readinessRequirements: ['Advanced automation operational', 'Quality gates in place'],
      successCriteria: ['All priority fields enriched', 'Adoption targets met'],
      priorPhasePrerequisites: ['Phase 2 complete'],
    },
  ];

  // Identify risks
  const risks: ReadinessRisk[] = [
    {
      risk: 'Technical infrastructure gaps',
      likelihood: overallScore < 50 ? 'high' : 'medium',
      impact: 'high',
      readinessMitigation: 'Prioritize critical infrastructure; phased rollout by asset type',
    },
    {
      risk: 'Insufficient organizational alignment',
      likelihood: org.governanceMaturity === 'beginner' ? 'high' : 'medium',
      impact: 'high',
      readinessMitigation: 'Establish governance council; secure executive sponsorship',
    },
    {
      risk: 'Team skill gaps',
      likelihood: org.currentMaturity === 'beginner' ? 'high' : 'medium',
      impact: 'medium',
      readinessMitigation: 'Invest in training; establish CoE',
    },
    {
      risk: 'Change management resistance',
      likelihood: org.teamSize > 100 ? 'high' : 'medium',
      impact: 'medium',
      readinessMitigation: 'Strong communication plan; early wins',
    },
  ];

  return {
    organization: org.name,
    assessmentDate: new Date().toISOString().split('T')[0],
    overallReadinessScore: overallScore,
    overallReadinessLevel: overallLevel,
    organizationalReadiness,
    processReadiness,
    assetTypeReadiness: mergedAssetTypeReadiness,
    criticalGaps,
    prerequisites: {
      prerequisites: allPrerequisites,
      completionPercentage,
      estimatedCompletionWeeks: estimatedWeeks,
      blockers,
      nextSteps: blockers.length > 0 ? blockers.slice(0, 3) : ['All prerequisites met; ready for Phase 1'],
    },
    adoptionRoadmap,
    risks,
  };
}

/**
 * Generate readiness report as markdown
 */
export function generateReadinessReport(assessment: ReadinessAssessment): string {
  let report = `# Custom Fields Enrichment Readiness Assessment\n\n`;
  report += `**Organization:** ${assessment.organization}\n`;
  report += `**Assessment Date:** ${assessment.assessmentDate}\n\n`;

  report += `## Overall Readiness\n\n`;
  report += `**Readiness Score:** ${assessment.overallReadinessScore}/100 (${assessment.overallReadinessLevel})\n\n`;

  report += `### Asset Type Readiness\n\n`;
  Object.entries(assessment.assetTypeReadiness).forEach(([asset, score]) => {
    const level = score < 40 ? '🔴' : score < 60 ? '🟡' : '🟢';
    report += `- ${level} **${asset}:** ${score}/100\n`;
  });
  report += '\n';

  report += `## Organizational Readiness\n\n`;
  assessment.organizationalReadiness.forEach((o) => {
    report += `### ${o.dimension}\n`;
    report += `- **Maturity:** ${o.currentMaturity}\n`;
    report += `- **Score:** ${o.readinessScore}/100\n`;
    report += `- **Gaps:** ${o.gaps.join(', ')}\n\n`;
  });

  report += `## Critical Gaps\n\n`;
  assessment.criticalGaps.forEach((gap) => {
    report += `- 🔴 ${gap}\n`;
  });

  return report;
}
