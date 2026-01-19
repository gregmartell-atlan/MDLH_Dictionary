/**
 * Implementation Roadmap Generator
 * 
 * Generates phased implementation roadmaps based on:
 * - Daikin 8-week plan
 * - Raptive 3-month plan
 * - Metadata model scope
 */

import type { 
  ImplementationRoadmap, 
  RoadmapPhase, 
  RoadmapMilestone,
  MetadataModelRow 
} from '../types/metadata-assistant';
import { generateProjectMetrics } from './outcome-metrics';

/**
 * Generate a roadmap based on scope and timeline preferences
 */
export function generateRoadmap(params: {
  name: string;
  totalAssets: number;
  domains: string[];
  useCases: string[];
  timeline: 'fast' | 'standard' | 'extended'; // 4, 8, or 12 weeks
  metadataModel?: MetadataModelRow[];
}): ImplementationRoadmap {
  const { name, totalAssets, domains, useCases, timeline } = params;

  const phases = timeline === 'fast' 
    ? generateFastTrackPhases(totalAssets, domains)
    : timeline === 'extended'
    ? generateExtendedPhases(totalAssets, domains)
    : generateStandardPhases(totalAssets, domains);

  const milestones = generateMilestones(timeline, domains);
  const metrics = generateProjectMetrics(useCases);

  const totalDuration = phases.reduce((sum, phase) => sum + (phase.duration || 0), 0) / 7;

  return {
    id: `roadmap-${Date.now()}`,
    name,
    description: `${timeline === 'fast' ? '4' : timeline === 'standard' ? '8' : '12'}-week implementation roadmap for ${domains.join(', ')}`,
    totalDuration: Math.ceil(totalDuration),
    totalAssets,
    phases,
    milestones,
    metrics,
  };
}

/**
 * Generate standard 8-week phases (based on Daikin template)
 */
function generateStandardPhases(totalAssets: number, domains: string[]): RoadmapPhase[] {
  const assetsPerDomain = Math.ceil(totalAssets / Math.max(domains.length, 1));
  const primaryDomain = domains[0] || 'Data';
  const secondaryDomain = domains[1] || primaryDomain;

  return [
    {
      id: 'phase-sprint0-kickoff',
      name: 'Sprint 0 – Kickoff',
      week: 1,
      sprint: 'Sprint 0',
      domain: 'Cross-domain',
      assetsTarget: 0,
      keyActivities: [
        'Define metadata model & custom fields',
        `Identify ${primaryDomain} + ${secondaryDomain} owners`,
        'Enable Google Sheets / API integration',
        'Configure tracking custom metadata fields',
      ],
      deliverable: 'Metadata Model V1; sheet template ready',
      duration: 5,
      dependencies: [],
    },
    {
      id: 'phase-sprint0-setup',
      name: 'Sprint 0 – Setup',
      week: 2,
      sprint: 'Sprint 0',
      domain: 'Cross-domain',
      assetsTarget: Math.ceil(totalAssets * 0.3),
      keyActivities: [
        'Prioritize high-impact assets (most queried, business-critical)',
        'Upload baseline metadata (bulk owners, existing descriptions)',
        'Enable owner/tag assignment playbooks',
        'Set up domain workspaces',
      ],
      deliverable: 'Domain workspaces ready; baseline metadata loaded',
      duration: 5,
      dependencies: ['phase-sprint0-kickoff'],
    },
    {
      id: 'phase-sprint1-enrich-primary',
      name: `Sprint 1 – Enrich ${primaryDomain}`,
      week: 3,
      sprint: 'Sprint 1',
      domain: primaryDomain,
      assetsTarget: assetsPerDomain,
      keyActivities: [
        'Run AI-generated descriptions',
        'Apply classification playbooks (PII, domain tags)',
        'Bulk assign owners',
        'Sync edits via Google Sheets',
      ],
      deliverable: `${assetsPerDomain} ${primaryDomain} assets enriched`,
      duration: 7,
      dependencies: ['phase-sprint0-setup'],
    },
    {
      id: 'phase-sprint1-validate-primary',
      name: `Sprint 1 – Validate ${primaryDomain}`,
      week: 4,
      sprint: 'Sprint 1',
      domain: primaryDomain,
      assetsTarget: assetsPerDomain,
      keyActivities: [
        'Review certifications and classifications',
        'Link to glossary terms',
        'Compute completeness scores',
        'Domain owner approval',
      ],
      deliverable: `${primaryDomain} domain validated & scored`,
      duration: 7,
      dependencies: ['phase-sprint1-enrich-primary'],
    },
    {
      id: 'phase-sprint2-enrich-secondary',
      name: `Sprint 2 – Enrich ${secondaryDomain}`,
      week: 5,
      sprint: 'Sprint 2',
      domain: secondaryDomain,
      assetsTarget: assetsPerDomain,
      keyActivities: [
        'Bulk upload metadata for next domain',
        'Generate README templates for key assets',
        'Propagate tags via lineage',
        'Configure custom metadata badges',
      ],
      deliverable: `${assetsPerDomain} ${secondaryDomain} assets enriched`,
      duration: 7,
      dependencies: ['phase-sprint1-validate-primary'],
    },
    {
      id: 'phase-sprint2-validate-secondary',
      name: `Sprint 2 – Validate ${secondaryDomain}`,
      week: 6,
      sprint: 'Sprint 2',
      domain: secondaryDomain,
      assetsTarget: assetsPerDomain,
      keyActivities: [
        'Validate completeness scores & certifications',
        'Publish glossary terms & linking rules',
        'Review access policies for sensitive data',
      ],
      deliverable: `Verified ${secondaryDomain} metadata`,
      duration: 7,
      dependencies: ['phase-sprint2-enrich-secondary'],
    },
    {
      id: 'phase-sprint2-governance',
      name: 'Sprint 2 – Governance',
      week: 7,
      sprint: 'Sprint 2',
      domain: 'Cross-domain',
      assetsTarget: 0,
      keyActivities: [
        'Define completeness score weights by asset type',
        'Create governance tracking dashboard',
        'Set up automated reports for coverage metrics',
        'Document enrichment playbooks',
      ],
      deliverable: 'Governance tracking dashboard',
      duration: 7,
      dependencies: ['phase-sprint2-validate-secondary'],
    },
    {
      id: 'phase-wrapup',
      name: 'Wrap-up & Sustainment',
      week: 8,
      sprint: 'Wrap-up',
      domain: 'Cross-domain',
      assetsTarget: 0,
      keyActivities: [
        'Evaluate final completeness scores',
        'Schedule playbooks for ongoing sustainment',
        'Train additional domain owners',
        'Plan next rollout phase',
      ],
      deliverable: 'Handoff package & sustainment schedule',
      duration: 5,
      dependencies: ['phase-sprint2-governance'],
    },
  ];
}

/**
 * Generate fast-track 4-week phases
 */
function generateFastTrackPhases(totalAssets: number, domains: string[]): RoadmapPhase[] {
  const primaryDomain = domains[0] || 'Data';

  return [
    {
      id: 'phase-week1-setup',
      name: 'Week 1 – Foundation',
      week: 1,
      domain: 'Cross-domain',
      assetsTarget: 0,
      keyActivities: [
        'Define metadata model',
        'Identify owners and stewards',
        'Configure automation (playbooks, workflows)',
        'Prioritize top 50-100 assets',
      ],
      deliverable: 'Metadata model and automation ready',
      duration: 7,
      dependencies: [],
    },
    {
      id: 'phase-week2-enrich',
      name: 'Week 2 – Rapid Enrichment',
      week: 2,
      domain: primaryDomain,
      assetsTarget: Math.ceil(totalAssets * 0.6),
      keyActivities: [
        'Bulk load existing metadata',
        'AI-generate descriptions',
        'Auto-tag PII and classifications',
        'Assign owners via bulk edit',
      ],
      deliverable: 'Core assets enriched',
      duration: 7,
      dependencies: ['phase-week1-setup'],
    },
    {
      id: 'phase-week3-validate',
      name: 'Week 3 – Validation & Certification',
      week: 3,
      domain: primaryDomain,
      assetsTarget: Math.ceil(totalAssets * 0.6),
      keyActivities: [
        'Domain owners review and refine',
        'Link to glossary',
        'Apply certifications',
        'Compute completeness scores',
      ],
      deliverable: 'Validated, certified assets',
      duration: 7,
      dependencies: ['phase-week2-enrich'],
    },
    {
      id: 'phase-week4-scale',
      name: 'Week 4 – Scale & Sustain',
      week: 4,
      domain: 'Cross-domain',
      assetsTarget: Math.ceil(totalAssets * 0.4),
      keyActivities: [
        'Roll out to remaining assets',
        'Set up governance dashboard',
        'Schedule ongoing automation',
        'Train extended team',
      ],
      deliverable: 'Full coverage + sustainment plan',
      duration: 7,
      dependencies: ['phase-week3-validate'],
    },
  ];
}

/**
 * Generate extended 12-week phases (based on Raptive 3-month plan)
 */
function generateExtendedPhases(totalAssets: number, domains: string[]): RoadmapPhase[] {
  const assetsPerDomain = Math.ceil(totalAssets / Math.max(domains.length, 2));

  return [
    {
      id: 'phase-month1-foundation',
      name: 'Month 1 – Foundation & Strategy',
      week: 1,
      domain: 'Cross-domain',
      assetsTarget: 0,
      keyActivities: [
        'Stakeholder alignment on goals',
        'Define metadata model and standards',
        'Set up Atlan environment (connectors, users)',
        'Create governance framework',
        'Train core team',
      ],
      deliverable: 'Strategy document, governance framework, trained team',
      duration: 21,
      dependencies: [],
    },
    {
      id: 'phase-month2-pilot',
      name: 'Month 2 – Pilot Implementation',
      week: 4,
      domain: domains[0] || 'Data',
      assetsTarget: assetsPerDomain,
      keyActivities: [
        'Implement first use case (Discovery or Metrics)',
        'Enrich pilot domain assets',
        'Configure automation and playbooks',
        'Gather feedback from pilot users',
        'Refine processes',
      ],
      deliverable: 'Pilot domain fully enriched with proven processes',
      duration: 21,
      dependencies: ['phase-month1-foundation'],
    },
    {
      id: 'phase-month3-rollout',
      name: 'Month 3 – Scaled Rollout',
      week: 7,
      domain: 'Cross-domain',
      assetsTarget: totalAssets - assetsPerDomain,
      keyActivities: [
        'Roll out to additional domains',
        'Enable contributor-led enrichment',
        'Implement additional use cases (Compliance, RCA)',
        'Launch governance dashboards',
        'Advocate for adoption across organization',
      ],
      deliverable: 'Organization-wide rollout with sustained adoption',
      duration: 21,
      dependencies: ['phase-month2-pilot'],
    },
    {
      id: 'phase-month3-optimize',
      name: 'Month 3 – Optimization & EBR',
      week: 10,
      domain: 'Cross-domain',
      assetsTarget: 0,
      keyActivities: [
        'Measure outcomes against KPIs',
        'Optimize completeness scores and weights',
        'Executive Business Review (EBR)',
        'Plan next phase / advanced use cases',
      ],
      deliverable: 'EBR presentation, optimization recommendations',
      duration: 14,
      dependencies: ['phase-month3-rollout'],
    },
  ];
}

/**
 * Generate milestones for roadmap
 */
function generateMilestones(timeline: string, domains: string[]): RoadmapMilestone[] {
  const baseMilestones: RoadmapMilestone[] = [
    {
      id: 'milestone-foundation',
      name: 'Foundation Complete',
      description: 'Metadata model defined, automation configured, team trained',
      completionCriteria: [
        'Metadata model document approved',
        'Playbooks and workflows configured',
        'Domain owners identified and trained',
      ],
      deliverables: [
        'Metadata model spreadsheet',
        'Automation configuration',
        'Training materials',
      ],
    },
    {
      id: 'milestone-first-domain',
      name: 'First Domain Enriched',
      description: `${domains[0] || 'Primary domain'} assets fully enriched and validated`,
      completionCriteria: [
        'Average completeness score ≥ 70',
        'All business-critical assets have owners',
        'PII tagged and access controls applied',
      ],
      deliverables: [
        'Enriched asset catalog',
        'Completeness score report',
      ],
    },
    {
      id: 'milestone-governance',
      name: 'Governance Established',
      description: 'Governance framework, dashboards, and sustainment plan in place',
      completionCriteria: [
        'Governance dashboard published',
        'Completeness score thresholds defined',
        'Automated sustainment playbooks scheduled',
      ],
      deliverables: [
        'Governance dashboard',
        'Sustainment playbook schedule',
      ],
    },
  ];

  if (timeline === 'extended') {
    baseMilestones.push({
      id: 'milestone-scaled-adoption',
      name: 'Scaled Adoption',
      description: 'Organization-wide rollout with measurable impact',
      completionCriteria: [
        'All domains have ≥60% completeness',
        'User satisfaction score ≥ 4.0',
        'Self-service rate ≥ 70%',
      ],
      deliverables: [
        'EBR presentation',
        'Impact metrics report',
      ],
    });
  }

  return baseMilestones;
}
