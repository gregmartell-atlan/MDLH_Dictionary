/**
 * Persona × Field Importance Matrix
 * Maps personas to metadata field priorities
 * 
 * Helps persona-driven workflows understand which fields matter to each role
 */

import type { PersonaType, MetadataFieldType } from '../types/metadata-assistant';

export interface PersonaFieldImportance {
  persona: PersonaType;
  role: string;
  fieldPriorities: Array<{
    field: MetadataFieldType;
    importance: 'critical' | 'important' | 'helpful';
    reason: string;
  }>;
  workflowContext: string;
}

export const PERSONA_FIELD_MATRIX: PersonaFieldImportance[] = [
  {
    persona: 'Data Governance Lead' as const,
    role: 'Chief Data Officer / Data Governance Officer',
    fieldPriorities: [
      {
        field: 'certificateStatus',
        importance: 'critical',
        reason: 'Understand data quality trust level at a glance',
      },
      {
        field: 'ownerUsers',
        importance: 'critical',
        reason: 'RACI accountability — who owns what data',
      },
      {
        field: 'customMetadata',
        importance: 'critical',
        reason: 'Enforce governance policies (DQ rules, compliance tags, retention)',
      },
      {
        field: 'lineage',
        importance: 'important',
        reason: 'Impact analysis when governance changes; identify critical chains',
      },
      {
        field: 'glossaryTerms',
        importance: 'important',
        reason: 'Standardize business terminology across org',
      },
      {
        field: 'description',
        importance: 'helpful',
        reason: 'Context for policy enforcement decisions',
      },
    ],
    workflowContext: 'Sets governance policy, reviews compliance dashboards, approves data access',
  },
  {
    persona: 'Data Steward' as const,
    role: 'Domain Data Steward / Business Data Owner',
    fieldPriorities: [
      {
        field: 'ownerUsers',
        importance: 'critical',
        reason: 'Track stewardship responsibilities; delegate tasks',
      },
      {
        field: 'customMetadata',
        importance: 'critical',
        reason: 'Apply domain-specific tags (confidentiality, retention, DQ rules)',
      },
      {
        field: 'certificateStatus',
        importance: 'important',
        reason: 'Monitor quality; certify data ready for downstream use',
      },
      {
        field: 'readme',
        importance: 'important',
        reason: 'Document data assumptions, refresh cycles, known issues',
      },
      {
        field: 'lineage',
        importance: 'important',
        reason: 'Understand upstream dependencies; detect downstream impacts',
      },
      {
        field: 'glossaryTerms',
        importance: 'helpful',
        reason: 'Map domain concepts to enterprise glossary',
      },
    ],
    workflowContext: 'Curates metadata daily; owns quality; responds to data issues; trains users',
  },
  {
    persona: 'Compliance Officer' as const,
    role: 'Regulatory / Compliance Manager',
    fieldPriorities: [
      {
        field: 'customMetadata',
        importance: 'critical',
        reason: 'Regulatory tags (HIPAA, GDPR, SOX, PII, retention, audit trail)',
      },
      {
        field: 'certificateStatus',
        importance: 'critical',
        reason: 'Verify compliant data certified before use',
      },
      {
        field: 'ownerUsers',
        importance: 'important',
        reason: 'Audit trail: who touched what data, when, why',
      },
      {
        field: 'lineage',
        importance: 'important',
        reason: 'Regulatory impact analysis: which systems affected by law change',
      },
      {
        field: 'description',
        importance: 'helpful',
        reason: 'Understand data context for compliance review',
      },
    ],
    workflowContext: 'Audits compliance; reports to board; responds to regulators; sets policies',
  },
  {
    persona: 'Data Analyst' as const,
    role: 'Data / Business / Analytics Analyst',
    fieldPriorities: [
      {
        field: 'glossaryTerms',
        importance: 'critical',
        reason: 'Understand standardized metrics & definitions; avoid miscalculation',
      },
      {
        field: 'description',
        importance: 'critical',
        reason: 'Quick context: what is this table/field, how is it calculated',
      },
      {
        field: 'readme',
        importance: 'important',
        reason: 'Learn refresh cycle, data quality caveats, sample values',
      },
      {
        field: 'customMetadata',
        importance: 'important',
        reason: 'Tags help filter by business context (KPI, confidential, deprecated)',
      },
      {
        field: 'ownerUsers',
        importance: 'important',
        reason: 'Find data owner to ask clarifying questions; escalate issues',
      },
      {
        field: 'lineage',
        importance: 'helpful',
        reason: 'Optional: trace back to source when debugging calculations',
      },
    ],
    workflowContext: 'Discovers data; builds queries; creates dashboards; troubleshoots metrics',
  },
  {
    persona: 'Data Engineer' as const,
    role: 'Data / ETL Engineer',
    fieldPriorities: [
      {
        field: 'lineage',
        importance: 'critical',
        reason: 'Track transformations; detect breaking changes; reimplement logic',
      },
      {
        field: 'readme',
        importance: 'important',
        reason: 'Understand source structure, refresh schedule, error handling',
      },
      {
        field: 'description',
        importance: 'important',
        reason: 'Field-level context for ETL mappings & transformations',
      },
      {
        field: 'customMetadata',
        importance: 'important',
        reason: 'Automation flags, schema versioning, SLA expectations',
      },
      {
        field: 'certificateStatus',
        importance: 'helpful',
        reason: 'Understand quality expectations for data production',
      },
    ],
    workflowContext: 'Develops ETL; monitors pipelines; optimizes performance; handles incidents',
  },
  {
    persona: 'Executive / CFO' as const,
    role: 'C-Suite / Business Unit Leader',
    fieldPriorities: [
      {
        field: 'description',
        importance: 'critical',
        reason: 'Plain-language summary; no jargon',
      },
      {
        field: 'customMetadata',
        importance: 'critical',
        reason: 'Tags indicate: KPI status, growth lever, strategic initiative',
      },
      {
        field: 'glossaryTerms',
        importance: 'important',
        reason: 'Standardized metrics & definitions; confidence in decisions',
      },
      {
        field: 'certificateStatus',
        importance: 'important',
        reason: 'Trust signal: is this data suitable for board-level reporting',
      },
    ],
    workflowContext: 'Reviews dashboards; makes strategic decisions; audits key metrics',
  },
  {
    persona: 'Atlan CSM / PS' as const,
    role: 'CSM / Account Manager',
    fieldPriorities: [
      {
        field: 'description',
        importance: 'critical',
        reason: 'Customer communication: what this metric means, how it helps them',
      },
      {
        field: 'glossaryTerms',
        importance: 'important',
        reason: 'Consistent language with customer communications & reports',
      },
      {
        field: 'customMetadata',
        importance: 'important',
        reason: 'Tags show: customer relevance, sensitivity, reporting frequency',
      },
      {
        field: 'readme',
        importance: 'helpful',
        reason: 'Known limitations to explain during customer conversations',
      },
    ],
    workflowContext: 'Onboards customers; delivers reports; handles data questions; builds relationships',
  },
];

/**
 * Get field priorities for a persona
 */
export function getFieldPrioritiesForPersona(persona: PersonaType): PersonaFieldImportance | undefined {
  return PERSONA_FIELD_MATRIX.find(p => p.persona === persona);
}

/**
 * Get all critical fields for a persona
 */
export function getCriticalFieldsForPersona(persona: PersonaType): MetadataFieldType[] {
  const pf = getFieldPrioritiesForPersona(persona);
  if (!pf) return [];
  return pf.fieldPriorities
    .filter(fp => fp.importance === 'critical')
    .map(fp => fp.field);
}

/**
 * Get all recommended fields (critical + important) for a persona
 */
export function getRecommendedFieldsForPersona(persona: PersonaType): MetadataFieldType[] {
  const pf = getFieldPrioritiesForPersona(persona);
  if (!pf) return [];
  return pf.fieldPriorities
    .filter(fp => fp.importance === 'critical' || fp.importance === 'important')
    .map(fp => fp.field);
}

/**
 * Find all personas that prioritize a specific field
 */
export function getPersonasForField(field: MetadataFieldType, importance?: 'critical' | 'important' | 'helpful'): PersonaType[] {
  return PERSONA_FIELD_MATRIX
    .filter(pf => {
      const fp = pf.fieldPriorities.find(f => f.field === field);
      if (!fp) return false;
      return !importance || fp.importance === importance;
    })
    .map(pf => pf.persona);
}

/**
 * Get field importance reason for a persona
 */
export function getFieldImportanceReason(persona: PersonaType, field: MetadataFieldType): string | undefined {
  const pf = getFieldPrioritiesForPersona(persona);
  if (!pf) return undefined;
  const fp = pf.fieldPriorities.find(f => f.field === field);
  return fp?.reason;
}

/**
 * Build persona-driven field checklist for metadata design
 */
export function buildPersonaFieldChecklist(personas: PersonaType[]): {
  field: MetadataFieldType;
  priority: 'must-have' | 'should-have' | 'nice-to-have';
  relevantPersonas: PersonaType[];
  reasons: string[];
} [] {
  const fieldMap: Map<MetadataFieldType, { personas: PersonaType[]; importances: ('critical' | 'important' | 'helpful')[] }> = new Map();

  personas.forEach(persona => {
    const pf = getFieldPrioritiesForPersona(persona);
    if (!pf) return;
    
    pf.fieldPriorities.forEach(fp => {
      const existing = fieldMap.get(fp.field) || { personas: [], importances: [] };
      if (!existing.personas.includes(persona)) {
        existing.personas.push(persona);
      }
      existing.importances.push(fp.importance);
      fieldMap.set(fp.field, existing);
    });
  });

  return Array.from(fieldMap.entries()).map(([field, { personas: personasForField, importances }]) => {
    const criticalCount = importances.filter(i => i === 'critical').length;
    const importantCount = importances.filter(i => i === 'important').length;

    let priority: 'must-have' | 'should-have' | 'nice-to-have' = 'nice-to-have';
    if (criticalCount >= 2 || (criticalCount >= 1 && importantCount >= 1)) {
      priority = 'must-have';
    } else if (criticalCount >= 1 || importantCount >= 2) {
      priority = 'should-have';
    }

    const reasons = personasForField
      .flatMap(p => {
        const pf = getFieldPrioritiesForPersona(p);
        if (!pf) return [];
        const fp = pf.fieldPriorities.find(f => f.field === field);
        return fp ? [`[${p}] ${fp.reason}`] : [];
      });

    return {
      field,
      priority,
      relevantPersonas: personasForField,
      reasons,
    };
  }).sort((a, b) => {
    const priorityOrder = { 'must-have': 0, 'should-have': 1, 'nice-to-have': 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * Generate persona field report
 */
export function generatePersonaFieldReport(persona: PersonaType): string {
  const pf = getFieldPrioritiesForPersona(persona);
  if (!pf) return '';

  const critical = pf.fieldPriorities.filter(f => f.importance === 'critical');
  const important = pf.fieldPriorities.filter(f => f.importance === 'important');
  const helpful = pf.fieldPriorities.filter(f => f.importance === 'helpful');

  return `
# Metadata Fields for **${pf.persona}** (${pf.role})

**Workflow:** ${pf.workflowContext}

## 🔴 Critical Fields (Must Have)
${critical.map(f => `- **${f.field}** — ${f.reason}`).join('\n')}

## 🟡 Important Fields (Should Have)
${important.map(f => `- **${f.field}** — ${f.reason}`).join('\n')}

## 🟢 Helpful Fields (Nice to Have)
${helpful.map(f => `- **${f.field}** — ${f.reason}`).join('\n')}
`;
}
