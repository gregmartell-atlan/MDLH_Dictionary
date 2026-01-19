/**
 * Persona Profiles
 * Maps personas to their goals, use cases, and DaaP focus areas
 */

import type { PersonaProfile, PersonaType } from '../types/metadata-assistant';

export const PERSONA_PROFILES: PersonaProfile[] = [
  {
    persona: 'Data Governance Lead',
    primaryGoals: [
      'Standardize metadata across the organization',
      'Prove value quickly to secure continued investment',
      'Build repeatable governance processes',
      'Measure and report on metadata quality',
    ],
    topUseCases: ['Data Discovery', 'Compliance', 'Metrics Catalog'],
    primaryDaaPFocus: ['Trustworthy', 'Secure', 'Understandable'],
  },
  {
    persona: 'Data Steward',
    primaryGoals: [
      'Know exactly what to enrich and how',
      'Measure enrichment progress',
      'Maintain metadata quality over time',
      'Collaborate with domain experts efficiently',
    ],
    topUseCases: ['Data Discovery', 'Metrics Catalog', 'Compliance'],
    primaryDaaPFocus: ['Discoverable', 'Understandable', 'Trustworthy'],
  },
  {
    persona: 'Compliance Officer',
    primaryGoals: [
      'Reduce regulatory risk',
      'Track and protect PII and sensitive data',
      'Demonstrate compliance to auditors',
      'Automate compliance reporting',
    ],
    topUseCases: ['Compliance', 'Data Discovery'],
    primaryDaaPFocus: ['Secure', 'Addressable'],
  },
  {
    persona: 'Data Analyst',
    primaryGoals: [
      'Find and understand data without asking around',
      'Trust data quality and definitions',
      'Self-serve analytics needs',
      'Understand metric calculations and business logic',
    ],
    topUseCases: ['Data Discovery', 'Trusted Metrics', 'Metrics Catalog'],
    primaryDaaPFocus: ['Discoverable', 'Understandable', 'Trustworthy'],
  },
  {
    persona: 'Data Engineer',
    primaryGoals: [
      'Keep pipelines healthy and reduce support tickets',
      'Trace data lineage for troubleshooting',
      'Document operational context',
      'Automate metadata capture from pipelines',
    ],
    topUseCases: ['Root Cause Analysis', 'Impact Analysis'],
    primaryDaaPFocus: ['Interoperable', 'Natively accessible'],
  },
  {
    persona: 'Executive / CFO',
    primaryGoals: [
      'Trust key performance indicators (KPIs)',
      'Align on metric definitions across teams',
      'Reduce time to insights',
      'Ensure data-driven decisions are based on quality data',
    ],
    topUseCases: ['Metrics Catalog', 'Trusted Metrics'],
    primaryDaaPFocus: ['Understandable', 'Trustworthy'],
  },
  {
    persona: 'Atlan CSM / PS',
    primaryGoals: [
      'Deliver repeatable, fast implementations',
      'Demonstrate quick wins',
      'Build customer capability and confidence',
      'Scale best practices across accounts',
    ],
    topUseCases: ['Data Discovery', 'Metrics Catalog', 'Compliance', 'Trusted Metrics'],
    primaryDaaPFocus: ['Discoverable', 'Understandable', 'Trustworthy', 'Secure', 'Interoperable', 'Addressable', 'Natively accessible'],
  },
];

/**
 * Get persona profile by type
 */
export function getPersonaProfile(persona: PersonaType): PersonaProfile | undefined {
  return PERSONA_PROFILES.find(p => p.persona === persona);
}

/**
 * Recommend personas for a given use case
 */
export function getPersonasForUseCase(useCase: string): PersonaProfile[] {
  return PERSONA_PROFILES.filter(p => 
    p.topUseCases.some(uc => uc.toLowerCase().includes(useCase.toLowerCase()))
  );
}

/**
 * Get all unique personas
 */
export function getAllPersonas(): PersonaType[] {
  return PERSONA_PROFILES.map(p => p.persona);
}
