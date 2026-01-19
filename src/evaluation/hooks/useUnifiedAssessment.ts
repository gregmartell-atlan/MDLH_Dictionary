'use client';

/**
 * Unified Assessment Hooks
 *
 * React hooks for using the unified assessment system in UI components.
 * Provides seamless integration between the unified catalog/assessment
 * engine and the existing UI patterns.
 */

import { useMemo, useCallback, useState } from 'react';
import {
  convertToSignalCoverage,
  calculateUseCaseReadiness,
  convertSignalsToPriorities,
  buildFieldEvidence,
  filterSignalsByPersona,
  mapAdoptionPhase,
  type UnifiedSignalCoverage,
  type UseCaseReadiness,
  type FieldEvidence,
  type AdoptionPhase,
} from '@/lib/unified-assessment-adapter';
import type { FieldCoverage, PersonaType } from '@/lib/priority-types';

// Import types from unified catalog
import type {
  SignalType,
  SignalDefinition,
  UnifiedField,
  UseCaseProfile,
} from '@atlan/assessment-domain';

// =============================================================================
// SIGNAL EVIDENCE TYPE
// =============================================================================

export interface SignalEvidence {
  signal: SignalType;
  displayName: string;
  description: string;
  coveragePercent: number;
  severity: 'HIGH' | 'MED' | 'LOW';
  workstream: string;
  aggregationMethod: 'any' | 'all' | 'weighted_threshold';
  contributingFields: Array<{
    fieldId: string;
    fieldName: string;
    coverage: number;
    weight: number;
  }>;
  guidanceUrl?: string;
}

// =============================================================================
// MOCK DATA - Replace with actual imports when domain package is integrated
// =============================================================================

// These would normally come from the domain package
const MOCK_SIGNAL_DEFINITIONS: SignalDefinition[] = [
  {
    id: 'OWNERSHIP',
    displayName: 'Ownership',
    description: 'Asset has accountable owners or stewards assigned.',
    aggregation: { method: 'any' },
    workstream: 'OWNERSHIP',
    severity: 'HIGH',
    guidanceUrl: 'https://solutions.atlan.com/ownership-enrichment/',
  },
  {
    id: 'SEMANTICS',
    displayName: 'Semantics',
    description: 'Asset has documentation, descriptions, or glossary term links.',
    aggregation: { method: 'any' },
    workstream: 'SEMANTICS',
    severity: 'HIGH',
    guidanceUrl: 'https://solutions.atlan.com/description-enrichment/',
  },
  {
    id: 'LINEAGE',
    displayName: 'Lineage',
    description: 'Asset has documented upstream/downstream data flow relationships.',
    aggregation: { method: 'any' },
    workstream: 'LINEAGE',
    severity: 'MED',
    guidanceUrl: 'https://developer.atlan.com/lineage/',
  },
  {
    id: 'SENSITIVITY',
    displayName: 'Sensitivity',
    description: 'Asset has classification tags indicating data sensitivity.',
    aggregation: { method: 'any' },
    workstream: 'SENSITIVITY_ACCESS',
    severity: 'MED',
  },
  {
    id: 'ACCESS',
    displayName: 'Access Control',
    description: 'Asset has access policies defined.',
    aggregation: { method: 'any' },
    workstream: 'SENSITIVITY_ACCESS',
    severity: 'MED',
  },
  {
    id: 'QUALITY',
    displayName: 'Quality',
    description: 'Asset has data quality monitoring configured.',
    aggregation: { method: 'any' },
    workstream: 'QUALITY_FRESHNESS',
    severity: 'LOW',
  },
  {
    id: 'FRESHNESS',
    displayName: 'Freshness',
    description: 'Asset has freshness/timeliness monitoring.',
    aggregation: { method: 'any' },
    workstream: 'QUALITY_FRESHNESS',
    severity: 'LOW',
  },
  {
    id: 'USAGE',
    displayName: 'Usage',
    description: 'Asset has usage telemetry available.',
    aggregation: { method: 'any' },
    workstream: 'QUALITY_FRESHNESS',
    severity: 'LOW',
  },
  {
    id: 'AI_READY',
    displayName: 'AI Readiness',
    description: 'Asset is approved for AI/ML training and usage.',
    aggregation: { method: 'weighted_threshold', threshold: 0.7 },
    workstream: 'SENSITIVITY_ACCESS',
    severity: 'HIGH',
  },
  {
    id: 'TRUST',
    displayName: 'Trust',
    description: 'Asset has certification or trust markers.',
    aggregation: { method: 'any' },
    workstream: 'OWNERSHIP',
    severity: 'MED',
  },
];

const MOCK_UNIFIED_FIELDS: UnifiedField[] = [
  {
    id: 'owner_users',
    displayName: 'Owner Users',
    description: 'Individual users accountable for the asset.',
    category: 'ownership',
    source: { type: 'native', attribute: 'ownerUsers' },
    supportedAssetTypes: ['*'],
    contributesToSignals: [{ signal: 'OWNERSHIP', weight: 1.0 }],
    completenessWeight: 20,
    useCases: ['*'],
    coreForUseCases: ['self_service_discovery', 'data_governance'],
    status: 'active',
  },
  {
    id: 'description',
    displayName: 'Description',
    description: "Short prose description of the asset's purpose.",
    category: 'documentation',
    source: { type: 'native_any', attributes: ['description', 'userDescription'] },
    supportedAssetTypes: ['*'],
    contributesToSignals: [{ signal: 'SEMANTICS', weight: 1.0 }],
    completenessWeight: 15,
    useCases: ['*'],
    coreForUseCases: ['self_service_discovery', 'rag', 'text_to_sql'],
    atlanDocsUrl: 'https://solutions.atlan.com/asset-export-basic/',
    status: 'active',
  },
  {
    id: 'glossary_terms',
    displayName: 'Linked Glossary Terms',
    description: 'Business glossary terms linked to the asset.',
    category: 'documentation',
    source: { type: 'relationship', relation: 'meanings' },
    supportedAssetTypes: ['Table', 'View', 'Column'],
    contributesToSignals: [{ signal: 'SEMANTICS', weight: 0.6 }],
    completenessWeight: 10,
    useCases: ['business_glossary', 'text_to_sql'],
    coreForUseCases: ['business_glossary'],
    status: 'active',
  },
  {
    id: 'certificate_status',
    displayName: 'Certificate Status',
    description: 'Certification status of the asset.',
    category: 'governance',
    source: { type: 'native', attribute: 'certificateStatus' },
    supportedAssetTypes: ['*'],
    contributesToSignals: [
      { signal: 'TRUST', weight: 1.0 },
      { signal: 'SENSITIVITY', weight: 0.3 },
    ],
    completenessWeight: 25,
    useCases: ['*'],
    coreForUseCases: ['data_governance'],
    status: 'active',
  },
  {
    id: 'atlan_tags',
    displayName: 'Atlan Tags',
    description: 'Classification tags applied to the asset.',
    category: 'classification',
    source: { type: 'classification' },
    supportedAssetTypes: ['*'],
    contributesToSignals: [
      { signal: 'SENSITIVITY', weight: 0.8 },
      { signal: 'ACCESS', weight: 0.5 },
    ],
    completenessWeight: 5,
    useCases: ['compliance', 'dsar_retention'],
    coreForUseCases: ['compliance'],
    status: 'active',
  },
  {
    id: 'lineage_upstream',
    displayName: 'Upstream Lineage',
    description: 'Assets that feed data into this asset.',
    category: 'lineage',
    source: { type: 'relationship', relation: 'inputToProcesses', direction: 'upstream' },
    supportedAssetTypes: ['Table', 'View', 'Column'],
    contributesToSignals: [{ signal: 'LINEAGE', weight: 0.5 }],
    useCases: ['impact_analysis', 'root_cause_analysis'],
    coreForUseCases: ['root_cause_analysis'],
    status: 'active',
  },
  {
    id: 'lineage_downstream',
    displayName: 'Downstream Lineage',
    description: 'Assets that consume data from this asset.',
    category: 'lineage',
    source: { type: 'relationship', relation: 'outputFromProcesses', direction: 'downstream' },
    supportedAssetTypes: ['Table', 'View', 'Column'],
    contributesToSignals: [{ signal: 'LINEAGE', weight: 0.5 }],
    useCases: ['impact_analysis'],
    coreForUseCases: ['impact_analysis'],
    status: 'active',
  },
];

const MOCK_USE_CASE_PROFILES: UseCaseProfile[] = [
  {
    id: 'rag',
    displayName: 'RAG (Retrieval Augmented Generation)',
    description: 'Use data assets in LLM-powered retrieval systems.',
    signals: [
      { signal: 'SEMANTICS', weight: 0.4, required: true },
      { signal: 'AI_READY', weight: 0.3, required: true },
      { signal: 'OWNERSHIP', weight: 0.15 },
      { signal: 'TRUST', weight: 0.15 },
    ],
    relevantAssetTypes: ['Table', 'View', 'Column', 'Dashboard'],
    thresholds: { ready: 80, partial: 50 },
    defaultMethodology: 'WEIGHTED_MEASURES',
  },
  {
    id: 'ai_agents',
    displayName: 'AI Agents',
    description: 'Enable AI agents to discover and query data assets.',
    signals: [
      { signal: 'SEMANTICS', weight: 0.35, required: true },
      { signal: 'LINEAGE', weight: 0.25 },
      { signal: 'OWNERSHIP', weight: 0.2, required: true },
      { signal: 'AI_READY', weight: 0.2, required: true },
    ],
    relevantAssetTypes: ['Table', 'View', 'Database', 'Schema'],
    thresholds: { ready: 75, partial: 45 },
    defaultMethodology: 'WEIGHTED_MEASURES',
  },
  {
    id: 'text_to_sql',
    displayName: 'Text-to-SQL',
    description: 'Enable natural language queries to be converted to SQL.',
    signals: [
      { signal: 'SEMANTICS', weight: 0.5, required: true },
      { signal: 'LINEAGE', weight: 0.2 },
      { signal: 'TRUST', weight: 0.15 },
      { signal: 'QUALITY', weight: 0.15 },
    ],
    relevantAssetTypes: ['Table', 'View', 'Column'],
    thresholds: { ready: 70, partial: 40 },
    defaultMethodology: 'WEIGHTED_MEASURES',
  },
  {
    id: 'compliance',
    displayName: 'Compliance & Governance',
    description: 'Meet regulatory and governance requirements.',
    signals: [
      { signal: 'SENSITIVITY', weight: 0.3, required: true },
      { signal: 'ACCESS', weight: 0.25, required: true },
      { signal: 'OWNERSHIP', weight: 0.25, required: true },
      { signal: 'LINEAGE', weight: 0.2 },
    ],
    relevantAssetTypes: ['*'],
    thresholds: { ready: 85, partial: 60 },
    defaultMethodology: 'CHECKLIST',
  },
  {
    id: 'self_service_discovery',
    displayName: 'Self-Service Discovery',
    description: 'Enable users to find and understand data assets.',
    signals: [
      { signal: 'SEMANTICS', weight: 0.35, required: true },
      { signal: 'OWNERSHIP', weight: 0.25 },
      { signal: 'TRUST', weight: 0.2 },
      { signal: 'USAGE', weight: 0.2 },
    ],
    relevantAssetTypes: ['*'],
    thresholds: { ready: 70, partial: 40 },
    defaultMethodology: 'WEIGHTED_MEASURES',
  },
];

// =============================================================================
// MAIN HOOK: useUnifiedAssessment
// =============================================================================

export interface UnifiedAssessmentState {
  // Signal coverage
  signalCoverage: UnifiedSignalCoverage[];
  filteredSignalCoverage: UnifiedSignalCoverage[];

  // Use case readiness
  useCaseReadiness: UseCaseReadiness[];
  selectedUseCaseReadiness: UseCaseReadiness | null;

  // Priorities (legacy format for backward compatibility)
  priorities: ReturnType<typeof convertSignalsToPriorities>;

  // Adoption phase
  adoptionPhase: ReturnType<typeof mapAdoptionPhase>;

  // Evidence
  selectedFieldEvidence: FieldEvidence | null;
  selectedSignalEvidence: SignalEvidence | null;

  // State
  selectedPersona: PersonaType;
  selectedUseCaseId: string | null;

  // Actions
  setPersona: (persona: PersonaType) => void;
  selectUseCase: (useCaseId: string | null) => void;
  selectField: (fieldId: string | null) => void;
  selectSignal: (signalId: SignalType | null) => void;

  // Loading state
  isLoading: boolean;
}

export function useUnifiedAssessment(
  fieldCoverage: FieldCoverage[]
): UnifiedAssessmentState {
  // Local state
  const [selectedPersona, setSelectedPersona] = useState<PersonaType>('all');
  const [selectedUseCaseId, setSelectedUseCaseId] = useState<string | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [selectedSignalId, setSelectedSignalId] = useState<SignalType | null>(null);

  // Compute signal coverage from field coverage
  const signalCoverage = useMemo(() => {
    return convertToSignalCoverage(
      fieldCoverage,
      MOCK_SIGNAL_DEFINITIONS,
      MOCK_UNIFIED_FIELDS
    );
  }, [fieldCoverage]);

  // Filter by persona
  const filteredSignalCoverage = useMemo(() => {
    return filterSignalsByPersona(signalCoverage, selectedPersona);
  }, [signalCoverage, selectedPersona]);

  // Compute use case readiness for all profiles
  const useCaseReadiness = useMemo(() => {
    return MOCK_USE_CASE_PROFILES.map((profile) =>
      calculateUseCaseReadiness(signalCoverage, profile)
    );
  }, [signalCoverage]);

  // Get selected use case readiness
  const selectedUseCaseReadiness = useMemo(() => {
    if (!selectedUseCaseId) return null;
    return useCaseReadiness.find((r) => r.useCaseId === selectedUseCaseId) || null;
  }, [useCaseReadiness, selectedUseCaseId]);

  // Convert to legacy priorities
  const priorities = useMemo(() => {
    return convertSignalsToPriorities(filteredSignalCoverage);
  }, [filteredSignalCoverage]);

  // Compute adoption phase
  const adoptionPhase = useMemo(() => {
    // Calculate overall coverage
    const avgCoverage =
      signalCoverage.reduce((sum, s) => sum + s.coveragePercent, 0) /
      signalCoverage.length;

    // Map to adoption phase
    let phase: AdoptionPhase = 'FOUNDATION';
    if (avgCoverage >= 0.8) phase = 'EXCELLENCE';
    else if (avgCoverage >= 0.6) phase = 'OPTIMIZATION';
    else if (avgCoverage >= 0.4) phase = 'EXPANSION';

    return mapAdoptionPhase(phase);
  }, [signalCoverage]);

  // Build field evidence
  const selectedFieldEvidence = useMemo(() => {
    if (!selectedFieldId) return null;

    const field = MOCK_UNIFIED_FIELDS.find((f) => f.id === selectedFieldId);
    if (!field) return null;

    // Find matching field coverage
    const legacyField = field.source.type === 'native'
      ? field.source.attribute
      : field.source.type === 'native_any'
        ? (field.source.attributes as string[])[0]
        : field.id;
    const coverage = fieldCoverage.find((fc) => fc.field === legacyField);

    return buildFieldEvidence(field, coverage, MOCK_SIGNAL_DEFINITIONS);
  }, [selectedFieldId, fieldCoverage]);

  // Build signal evidence
  const selectedSignalEvidence = useMemo<SignalEvidence | null>(() => {
    if (!selectedSignalId) return null;

    const signalCov = signalCoverage.find((s) => s.signal === selectedSignalId);
    const signalDef = MOCK_SIGNAL_DEFINITIONS.find((s) => s.id === selectedSignalId);

    if (!signalCov || !signalDef) return null;

    return {
      signal: signalCov.signal,
      displayName: signalCov.displayName,
      description: signalCov.description,
      coveragePercent: signalCov.coveragePercent * 100,
      severity: signalCov.severity,
      workstream: signalCov.workstream,
      aggregationMethod: signalDef.aggregation.method,
      contributingFields: signalCov.contributingFields,
      guidanceUrl: signalDef.guidanceUrl,
    };
  }, [selectedSignalId, signalCoverage]);

  // Actions
  const setPersona = useCallback((persona: PersonaType) => {
    setSelectedPersona(persona);
  }, []);

  const selectUseCase = useCallback((useCaseId: string | null) => {
    setSelectedUseCaseId(useCaseId);
  }, []);

  const selectField = useCallback((fieldId: string | null) => {
    setSelectedFieldId(fieldId);
    setSelectedSignalId(null); // Clear signal selection
  }, []);

  const selectSignal = useCallback((signalId: SignalType | null) => {
    setSelectedSignalId(signalId);
    setSelectedFieldId(null); // Clear field selection
  }, []);

  return {
    signalCoverage,
    filteredSignalCoverage,
    useCaseReadiness,
    selectedUseCaseReadiness,
    priorities,
    adoptionPhase,
    selectedFieldEvidence,
    selectedSignalEvidence,
    selectedPersona,
    selectedUseCaseId,
    setPersona,
    selectUseCase,
    selectField,
    selectSignal,
    isLoading: false,
  };
}

// =============================================================================
// HELPER HOOKS
// =============================================================================

/**
 * Hook for getting signal definitions
 */
export function useSignalDefinitions(): SignalDefinition[] {
  return MOCK_SIGNAL_DEFINITIONS;
}

/**
 * Hook for getting unified field definitions
 */
export function useUnifiedFields(): UnifiedField[] {
  return MOCK_UNIFIED_FIELDS;
}

/**
 * Hook for getting use case profiles
 */
export function useUseCaseProfiles(): UseCaseProfile[] {
  return MOCK_USE_CASE_PROFILES;
}

/**
 * Hook for getting a specific use case profile
 */
export function useUseCaseProfile(useCaseId: string): UseCaseProfile | undefined {
  return useMemo(() => {
    return MOCK_USE_CASE_PROFILES.find((p) => p.id === useCaseId);
  }, [useCaseId]);
}

/**
 * Hook for getting a specific signal definition
 */
export function useSignalDefinition(signalId: SignalType): SignalDefinition | undefined {
  return useMemo(() => {
    return MOCK_SIGNAL_DEFINITIONS.find((s) => s.id === signalId);
  }, [signalId]);
}

/**
 * Hook for getting a specific unified field
 */
export function useUnifiedField(fieldId: string): UnifiedField | undefined {
  return useMemo(() => {
    return MOCK_UNIFIED_FIELDS.find((f) => f.id === fieldId);
  }, [fieldId]);
}
