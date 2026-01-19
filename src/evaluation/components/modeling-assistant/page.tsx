'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  Target,
  Layers,
  Filter,
  Download,
  ClipboardList,
  ShieldCheck,
  Activity,
  Database,
  AlertTriangle,
  BadgeCheck,
  Tag,
  Users,
  FileText,
  BookOpen,
  CheckCircle2,
  Link2,
  Puzzle,
  XCircle,
} from 'lucide-react';
import { fieldCatalog, relationshipFields } from '@/lib/field-catalog';
import { AssetBrowser, SelectedAsset } from '@/components/AssetBrowser';
import type { AtlanConfig } from '@/components/AtlanConnectionModal';
import {
  getAtlanTypeNames,
  isCustomMetadataField,
  toAtlanAttributeCandidates,
} from '@/lib/atlan-compatibility';

interface FieldInfo {
  description: string;
  sourceDocUrl: string;
  assetTypes: string[];
  useCases: string[];
  coreVsRecommended: string;
  sampleEnumValues: string;
}

interface UseCaseRow {
  useCase: string;
  assetTypes: string[];
  objectives: string[];
  coreFields: string[];
  recommendedFields: string[];
}

interface StarterModel {
  name: string;
  targetVertical: string;
  primaryUseCases: string[];
  assetTypes: string[];
  recommendedFields: string[];
  notes: string;
}

interface GovernancePattern {
  patternName: string;
  primaryUseCases: string[];
  targetAssetTypes: string[];
  description: string;
  requiredFields: string[];
  optionalFields: string[];
}

interface CoverageSummary {
  total: number;
  hasOwner: number;
  hasDescription: number;
  hasReadme: number;
  hasCertificate: number;
}

interface CompatibilitySummary {
  supported: string[];
  unsupported: string[];
  customMetadata: string[];
  classificationFields: string[];
  derivedFields: string[];
  documented: string[];
  relationshipFields: string[];
}

interface AvailabilitySummary {
  available: string[];
  missing: string[];
  matchedAliases: Record<string, string>;
}

interface EvidenceResult {
  fieldName: string;
  assets: Array<{
    guid: string;
    name: string;
    qualifiedName: string;
    description?: string;
  }>;
}

const MODEL_DATA = fieldCatalog as {
  fieldLibrary: Record<string, FieldInfo>;
  useCaseGrid: UseCaseRow[];
  starterModels: StarterModel[];
  governancePatterns: GovernancePattern[];
  relationshipFields: string[];
};

const DEFAULT_USE_CASES = ['Self-service discovery', 'Business glossary & metrics'];

const FIELD_REASON_RULES: Array<{ test: RegExp; reason: string }> = [
  { test: /owner|raci/i, reason: 'Accountability and stewardship' },
  { test: /description|readme|definition|examples|scope/i, reason: 'Context for understanding' },
  {
    test: /name|qualified_name|column_name|metric_name|term_name|data_product_name/i,
    reason: 'Reliable identification and matching',
  },
  { test: /tag|category|domain/i, reason: 'Organization and discoverability' },
  { test: /pii|sensitivity|classification|data_subject/i, reason: 'Privacy and risk control' },
  { test: /policy/i, reason: 'Policy governance and compliance' },
  { test: /certificate|badge|dq_score|quality|profile/i, reason: 'Trust and quality signal' },
  { test: /lineage|source_|target_/i, reason: 'Impact and root-cause analysis' },
  { test: /contract/i, reason: 'Contract lifecycle and expectations' },
  { test: /data_product/i, reason: 'Data product clarity and ownership' },
  { test: /ai_|ml_|model|training/i, reason: 'AI governance and model risk' },
  { test: /sla|slo|uptime|availability|freshness/i, reason: 'Operational reliability' },
  { test: /usage|consumption|views/i, reason: 'Adoption and impact tracking' },
  { test: /criticality|impact|risk/i, reason: 'Prioritization and risk management' },
];

const ENRICHMENT_ACTIONS = [
  {
    id: 'owners',
    label: 'Assign accountable owners',
    hint: 'Drive ownership for critical assets and dashboards.',
    fields: ['owner_users', 'owner_groups', 'cm_raci_responsible', 'cm_raci_accountable'],
    icon: Users,
  },
  {
    id: 'documentation',
    label: 'Add clear descriptions and READMEs',
    hint: 'Improve self-service and reduce context switching.',
    fields: ['description', 'readme', 'term_definition_short', 'term_definition_long'],
    icon: FileText,
  },
  {
    id: 'glossary',
    label: 'Link glossary terms and metric definitions',
    hint: 'Align business language to data assets.',
    fields: ['glossary_terms', 'metric_formula', 'metric_source_asset'],
    icon: BookOpen,
  },
  {
    id: 'trust',
    label: 'Apply trust signals and quality indicators',
    hint: 'Use certificates, dq scores, and badges for fast trust.',
    fields: ['certificate_status', 'dq_score', 'badge_name'],
    icon: ShieldCheck,
  },
  {
    id: 'privacy',
    label: 'Tag PII, sensitivity, and regulatory scope',
    hint: 'Keep compliance and access decisions consistent.',
    fields: ['pii_flag', 'pii_type', 'sensitivity_classification', 'regulatory_scope'],
    icon: AlertTriangle,
  },
];

function getReason(fieldName: string, useCase: string) {
  const rule = FIELD_REASON_RULES.find((item) => item.test.test(fieldName));
  return rule ? rule.reason : `Supports ${useCase.toLowerCase()}`;
}

function toPercent(count: number, total: number) {
  if (!total) return '0%';
  return `${Math.round((count / total) * 100)}%`;
}

function normalizeFieldId(fieldName: string) {
  return fieldName.trim().toLowerCase();
}

function hasDocModelMatch(docsModelFieldSet: Set<string> | null, fieldName: string) {
  if (!docsModelFieldSet) return false;
  return docsModelFieldSet.has(normalizeFieldId(fieldName));
}

export default function ModelingAssistantPage() {
  const [selectedUseCases, setSelectedUseCases] = useState<string[]>(DEFAULT_USE_CASES);
  const [selectedAssetType, setSelectedAssetType] = useState<string>('Tables');
  const [promotedFields, setPromotedFields] = useState<Set<string>>(new Set());
  const [fieldQuery, setFieldQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const [atlanConfig, setAtlanConfig] = useState<AtlanConfig | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<SelectedAsset | null>(null);
  const [coverage, setCoverage] = useState<CoverageSummary | null>(null);
  const [coverageError, setCoverageError] = useState<string | null>(null);
  const [coverageLoading, setCoverageLoading] = useState(false);
  const [compatibility, setCompatibility] = useState<CompatibilitySummary | null>(null);
  const [compatibilityLoading, setCompatibilityLoading] = useState(false);
  const [compatibilityError, setCompatibilityError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<AvailabilitySummary | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [docsIndex, setDocsIndex] = useState<{ generatedAt: string; pageCount: number } | null>(null);
  const [docsModelFieldSet, setDocsModelFieldSet] = useState<Set<string> | null>(null);
  const [docsSyncing, setDocsSyncing] = useState(false);
  const [docsModelLinks, setDocsModelLinks] = useState<Record<string, string>>({});
  const [evidenceResults, setEvidenceResults] = useState<EvidenceResult[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [evidenceByField, setEvidenceByField] = useState<Record<string, EvidenceResult>>({});
  const [evidenceLoadingField, setEvidenceLoadingField] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('atlan_config');
    if (saved) {
      try {
        setAtlanConfig(JSON.parse(saved));
      } catch {
        setAtlanConfig(null);
      }
    }

    const handleConfigUpdate = () => {
      const next = localStorage.getItem('atlan_config');
      if (!next) {
        setAtlanConfig(null);
        return;
      }
      try {
        setAtlanConfig(JSON.parse(next));
      } catch {
        setAtlanConfig(null);
      }
    };

    window.addEventListener('storage', handleConfigUpdate);
    window.addEventListener('atlan-config-updated', handleConfigUpdate);
    return () => {
      window.removeEventListener('storage', handleConfigUpdate);
      window.removeEventListener('atlan-config-updated', handleConfigUpdate);
    };
  }, []);

  useEffect(() => {
    const loadDocsIndex = async () => {
      try {
        const res = await fetch('/api/atlan/docs-cache');
        const data = await res.json();
        if (data.success && data.index) {
          setDocsIndex({
            generatedAt: data.index.generatedAt,
            pageCount: data.index.pageCount,
          });
        }
      } catch {
        // ignore
      }
    };
    loadDocsIndex();
  }, []);

  useEffect(() => {
    const loadDocLinks = async () => {
      try {
        const res = await fetch('/api/atlan/docs-cache?type=model');
        const data = await res.json();
        if (data.success && data.index?.fields) {
          const map: Record<string, string> = {};
          const fieldSet = new Set<string>();
          data.index.fields.forEach((item: { fieldName: string; primaryDocUrl: string; mentions?: number }) => {
            if (item.primaryDocUrl) {
              map[item.fieldName] = item.primaryDocUrl;
            }
            if ((item.mentions || 0) > 0) {
              fieldSet.add(normalizeFieldId(item.fieldName));
            }
          });
          setDocsModelLinks(map);
          setDocsModelFieldSet(fieldSet);
        }
      } catch {
        // ignore
      }
    };
    loadDocLinks();
  }, []);

  const isConnected = atlanConfig?.isConnected ?? false;
  const relationshipFieldSet = useMemo(
    () => new Set(relationshipFields.map((field) => normalizeFieldId(field))),
    []
  );

  const useCaseOptions = useMemo(() => {
    const grouped = new Map<string, { objectives: string[]; assetTypes: Set<string> }>();
    MODEL_DATA.useCaseGrid.forEach((row) => {
      if (!grouped.has(row.useCase)) {
        grouped.set(row.useCase, { objectives: row.objectives, assetTypes: new Set() });
      }
      const entry = grouped.get(row.useCase);
      row.assetTypes.forEach((asset) => entry?.assetTypes.add(asset));
    });
    return Array.from(grouped.entries()).map(([useCase, info]) => ({
      useCase,
      objectives: info.objectives,
      assetTypes: Array.from(info.assetTypes),
    }));
  }, []);

  const assetTypeOptions = useMemo(() => {
    const assets = new Set<string>();
    MODEL_DATA.useCaseGrid.forEach((row) => {
      if (selectedUseCases.includes(row.useCase)) {
        row.assetTypes.forEach((asset) => assets.add(asset));
      }
    });
    return Array.from(assets);
  }, [selectedUseCases]);

  useEffect(() => {
    if (!assetTypeOptions.length) return;
    if (!assetTypeOptions.includes(selectedAssetType)) {
      setSelectedAssetType(assetTypeOptions[0]);
    }
  }, [assetTypeOptions, selectedAssetType]);

  const modelRows = useMemo(() => {
    const fieldMap = new Map<string, { core: boolean; useCases: Set<string> }>();
    MODEL_DATA.useCaseGrid.forEach((row) => {
      if (!selectedUseCases.includes(row.useCase)) return;
      if (!row.assetTypes.includes(selectedAssetType)) return;

      row.coreFields.forEach((field) => {
        const entry = fieldMap.get(field) || { core: false, useCases: new Set() };
        entry.core = true;
        entry.useCases.add(row.useCase);
        fieldMap.set(field, entry);
      });

      row.recommendedFields.forEach((field) => {
        const entry = fieldMap.get(field) || { core: false, useCases: new Set() };
        entry.useCases.add(row.useCase);
        fieldMap.set(field, entry);
      });
    });

    const rows = Array.from(fieldMap.entries()).map(([fieldName, info]) => {
      const fieldInfo = MODEL_DATA.fieldLibrary[fieldName];
      const description = fieldInfo?.description || '—';
      const phase = info.core || promotedFields.has(fieldName) ? 'Phase 1' : 'Phase 2';
      const coreVsRecommended = info.core ? 'Core' : 'Recommended';
      const useCases = Array.from(info.useCases).join(', ');
      return {
        fieldName,
        description,
        coreVsRecommended,
        phase,
        useCases,
        reason: getReason(fieldName, Array.from(info.useCases)[0] || 'Use case'),
      };
    });

    const normalizedQuery = fieldQuery.trim().toLowerCase();
    const filtered = normalizedQuery
      ? rows.filter((row) =>
          row.fieldName.toLowerCase().includes(normalizedQuery) ||
          row.description.toLowerCase().includes(normalizedQuery)
        )
      : rows;

    return filtered.sort((a, b) => {
      if (a.coreVsRecommended !== b.coreVsRecommended) {
        return a.coreVsRecommended === 'Core' ? -1 : 1;
      }
      return a.fieldName.localeCompare(b.fieldName);
    });
  }, [selectedUseCases, selectedAssetType, promotedFields, fieldQuery]);

  const totalCore = modelRows.filter((row) => row.coreVsRecommended === 'Core').length;
  const totalPhase1 = modelRows.filter((row) => row.phase === 'Phase 1').length;
  const totalPhase2 = modelRows.filter((row) => row.phase === 'Phase 2').length;

  const matchingGovernancePatterns = useMemo(() => {
    return MODEL_DATA.governancePatterns.filter((pattern) =>
      pattern.primaryUseCases.some((useCase) => selectedUseCases.includes(useCase))
    );
  }, [selectedUseCases]);

  const applyTemplate = useCallback((model: StarterModel) => {
    setSelectedTemplate(model.name);
    setSelectedUseCases(model.primaryUseCases);
  }, []);

  const toggleUseCase = useCallback((useCase: string) => {
    setSelectedTemplate(null);
    setSelectedUseCases((prev) =>
      prev.includes(useCase)
        ? prev.filter((item) => item !== useCase)
        : [...prev, useCase]
    );
  }, []);

  const togglePromoteField = useCallback((fieldName: string) => {
    setPromotedFields((prev) => {
      const next = new Set(prev);
      if (next.has(fieldName)) {
        next.delete(fieldName);
      } else {
        next.add(fieldName);
      }
      return next;
    });
  }, []);

  const exportModel = useCallback(() => {
    const byAssetType = MODEL_DATA.useCaseGrid.reduce((acc, row) => {
      if (!selectedUseCases.includes(row.useCase)) return acc;
      row.assetTypes.forEach((asset) => {
        if (!acc[asset]) acc[asset] = { core: new Set<string>(), recommended: new Set<string>() };
        row.coreFields.forEach((field) => acc[asset].core.add(field));
        row.recommendedFields.forEach((field) => acc[asset].recommended.add(field));
      });
      return acc;
    }, {} as Record<string, { core: Set<string>; recommended: Set<string> }>);

    const payload = {
      generatedAt: new Date().toISOString(),
      useCases: selectedUseCases,
      assetTypes: Object.keys(byAssetType),
      fieldsByAssetType: Object.entries(byAssetType).map(([asset, fields]) => ({
        assetType: asset,
        coreFields: Array.from(fields.core),
        recommendedFields: Array.from(fields.recommended),
        promotedFields: Array.from(promotedFields),
      })),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'metadata-model.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [selectedUseCases, promotedFields]);

  const runCoverageScan = useCallback(async () => {
    setCoverageError(null);
    setCoverage(null);

    if (!selectedAsset || !atlanConfig?.baseUrl || !atlanConfig?.apiToken) {
      setCoverageError('Select a schema in the live Atlan view first.');
      return;
    }

    if (selectedAsset.type !== 'schema') {
      setCoverageError('Coverage scan currently supports schema-level selection.');
      return;
    }

    setCoverageLoading(true);
    try {
      const res = await fetch('/api/atlan/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: atlanConfig.baseUrl,
          apiToken: atlanConfig.apiToken,
          assetType: 'table',
          parentQualifiedName: selectedAsset.qualifiedName,
          limit: 200,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setCoverageError(data.error || 'Failed to load assets.');
        return;
      }

      const assets = data.assets || [];
      const summary = assets.reduce(
        (acc: CoverageSummary, asset: any) => {
          const ownerUsers = Array.isArray(asset.ownerUsers) ? asset.ownerUsers : [];
          const ownerGroups = Array.isArray(asset.ownerGroups) ? asset.ownerGroups : [];
          const hasOwner = ownerUsers.length > 0 || ownerGroups.length > 0;
          const hasDescription = typeof asset.description === 'string' && asset.description.trim().length > 0;
          const hasReadme =
            (typeof asset.readme === 'string' && asset.readme.trim().length > 0) ||
            (asset.readme && typeof asset.readme === 'object');
          const hasCertificate = asset.certificateStatus && asset.certificateStatus !== 'NONE';
          return {
            total: acc.total + 1,
            hasOwner: acc.hasOwner + (hasOwner ? 1 : 0),
            hasDescription: acc.hasDescription + (hasDescription ? 1 : 0),
            hasReadme: acc.hasReadme + (hasReadme ? 1 : 0),
            hasCertificate: acc.hasCertificate + (hasCertificate ? 1 : 0),
          };
        },
        { total: 0, hasOwner: 0, hasDescription: 0, hasReadme: 0, hasCertificate: 0 }
      );

      setCoverage(summary);
    } catch (error) {
      setCoverageError(error instanceof Error ? error.message : 'Coverage scan failed.');
    } finally {
      setCoverageLoading(false);
    }
  }, [selectedAsset, atlanConfig]);

  const actionPlan = useMemo(() => {
    const selectedFields = new Set(modelRows.map((row) => row.fieldName));
    return ENRICHMENT_ACTIONS.map((action) => {
      const relevant = action.fields.some((field) => selectedFields.has(field));
      return { ...action, relevant };
    });
  }, [modelRows]);

  const supportMap = useMemo(() => {
    const map = new Map<string, { source: string; documented: boolean }>();
    modelRows.forEach((row) => {
      const documented = hasDocModelMatch(docsModelFieldSet, row.fieldName);
      map.set(row.fieldName, { source: 'unknown', documented });
    });
    if (!compatibility) return map;
    compatibility.supported.forEach((field) => {
      map.set(field, { source: 'atlan', documented: compatibility.documented.includes(field) });
    });
    compatibility.customMetadata.forEach((field) => {
      map.set(field, { source: 'cm', documented: compatibility.documented.includes(field) });
    });
    compatibility.classificationFields.forEach((field) => {
      map.set(field, { source: 'classification', documented: compatibility.documented.includes(field) });
    });
    compatibility.derivedFields.forEach((field) => {
      map.set(field, { source: 'derived', documented: compatibility.documented.includes(field) });
    });
    compatibility.unsupported.forEach((field) => {
      map.set(field, { source: 'unsupported', documented: compatibility.documented.includes(field) });
    });
    compatibility.relationshipFields.forEach((field) => {
      map.set(field, { source: 'relationship', documented: compatibility.documented.includes(field) });
    });
    return map;
  }, [compatibility, modelRows, docsModelFieldSet]);

  const modelSupportMap = useMemo(() => {
    const map = new Map<string, 'supported' | 'unsupported'>();
    if (!compatibility) return map;
    const supportedSet = new Set([
      ...compatibility.supported,
      ...compatibility.customMetadata,
      ...compatibility.relationshipFields,
      ...compatibility.classificationFields,
      ...compatibility.derivedFields,
    ]);
    supportedSet.forEach((field) => map.set(field, 'supported'));
    compatibility.unsupported.forEach((field) => map.set(field, 'unsupported'));
    return map;
  }, [compatibility]);

  const runEvidenceScan = useCallback(async () => {
    setEvidenceError(null);
    setEvidenceResults([]);

    if (!selectedAsset || selectedAsset.type !== 'schema') {
      setEvidenceError('Select a schema to scan missing fields.');
      return;
    }
    if (!atlanConfig?.baseUrl || !atlanConfig?.apiToken) {
      setEvidenceError('Connect to Atlan to scan evidence.');
      return;
    }

    const candidates = modelRows.filter((row) => row.phase === 'Phase 1');
    const targetFields = candidates
      .filter((row) => !isCustomMetadataField(row.fieldName))
      .filter((row) => !compatibility?.unsupported.includes(row.fieldName))
      .slice(0, 3);

    if (!targetFields.length) {
      setEvidenceError('No phase 1 fields available for evidence scanning.');
      return;
    }

    setEvidenceLoading(true);
    try {
      const responses = await Promise.all(
        targetFields.map(async (row) => {
          const fieldCandidates = toAtlanAttributeCandidates(row.fieldName);
          const res = await fetch('/api/atlan/evidence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              baseUrl: atlanConfig.baseUrl,
              apiToken: atlanConfig.apiToken,
              assetType: 'table',
              parentQualifiedName: selectedAsset.qualifiedName,
              fieldCandidates,
              limit: 5,
            }),
          });
          const data = await res.json();
          return {
            fieldName: row.fieldName,
            assets: data.success ? data.assets : [],
          } as EvidenceResult;
        })
      );
      setEvidenceResults(responses);
    } catch (error) {
      setEvidenceError(error instanceof Error ? error.message : 'Evidence scan failed.');
    } finally {
      setEvidenceLoading(false);
    }
  }, [selectedAsset, atlanConfig, modelRows, compatibility]);

  const runAvailabilityCheck = useCallback(async () => {
    setAvailabilityError(null);
    setAvailability(null);

    if (!atlanConfig?.baseUrl || !atlanConfig?.apiToken) {
      setAvailabilityError('Connect to Atlan to run availability checks.');
      return;
    }

    if (!getAtlanTypeNames(selectedAssetType).length) {
      setAvailabilityError(`Population check not supported for asset type: ${selectedAssetType}`);
      return;
    }

    const fieldNames = modelRows.map((row) => row.fieldName);
    if (!fieldNames.length) return;

    setAvailabilityLoading(true);
    try {
      const shouldScopeToSchema = new Set([
        'Tables',
        'Views',
        'Tables; views',
        'Columns',
        'Tables containing PII',
        'Columns with PII',
        'Training datasets',
      ]).has(selectedAssetType);
      const res = await fetch('/api/atlan/field-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: atlanConfig.baseUrl,
          apiToken: atlanConfig.apiToken,
          assetType: selectedAssetType,
          fieldNames,
          parentQualifiedName:
            shouldScopeToSchema && selectedAsset?.type === 'schema'
              ? selectedAsset.qualifiedName
              : undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setAvailabilityError(data.error || 'Population check failed.');
        return;
      }

      const results = (data.results || {}) as Record<string, { exists: boolean; matched?: string }>;
      const available: string[] = [];
      const missing: string[] = [];
      const matchedAliases: Record<string, string> = {};

      Object.entries(results).forEach(([fieldName, result]) => {
        if (result.exists) {
          available.push(fieldName);
          if (result.matched) {
            matchedAliases[fieldName] = result.matched;
          }
        } else {
          missing.push(fieldName);
        }
      });

      setAvailability({ available, missing, matchedAliases });
    } catch (error) {
      setAvailabilityError(error instanceof Error ? error.message : 'Population check failed.');
    } finally {
      setAvailabilityLoading(false);
    }
  }, [atlanConfig, modelRows, selectedAssetType, selectedAsset]);

  const runFieldEvidenceScan = useCallback(
    async (fieldName: string) => {
      setEvidenceError(null);

      if (!selectedAsset || selectedAsset.type !== 'schema') {
        setEvidenceError('Select a schema to scan missing fields.');
        return;
      }
      if (!atlanConfig?.baseUrl || !atlanConfig?.apiToken) {
        setEvidenceError('Connect to Atlan to scan evidence.');
        return;
      }

      setEvidenceLoadingField(fieldName);
      try {
        const fieldCandidates = toAtlanAttributeCandidates(fieldName);
        const res = await fetch('/api/atlan/evidence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            baseUrl: atlanConfig.baseUrl,
            apiToken: atlanConfig.apiToken,
            assetType: 'table',
            parentQualifiedName: selectedAsset.qualifiedName,
            fieldCandidates,
            limit: 5,
          }),
        });
        const data = await res.json();
        if (!data.success) {
          setEvidenceError(data.error || 'Evidence scan failed.');
          return;
        }

        setEvidenceByField((prev) => ({
          ...prev,
          [fieldName]: {
            fieldName,
            assets: data.assets || [],
          },
        }));
      } catch (error) {
        setEvidenceError(error instanceof Error ? error.message : 'Evidence scan failed.');
      } finally {
        setEvidenceLoadingField(null);
      }
    },
    [selectedAsset, atlanConfig]
  );

  const runCompatibilityCheck = useCallback(async () => {
    setCompatibilityError(null);
    setCompatibility(null);

    if (!docsModelFieldSet) {
      setCompatibilityError('Docs-based model reference not loaded.');
      return;
    }

    setCompatibilityLoading(true);
    try {
      const supported: string[] = [];
      const unsupported: string[] = [];
      const customMetadata: string[] = [];
      const classificationFieldsList: string[] = [];
      const derivedFieldsList: string[] = [];
      const documented: string[] = [];
      const relationshipFieldList: string[] = [];
      const classificationFields = new Set([
        'tags',
        'tag',
        'classifications',
        'pii_flag',
        'pii_type',
        'sensitivity_classification',
        'regulatory_scope',
        'data_subject_category',
        'processing_activity',
        'legal_basis',
        'retention_rule',
      ]);
      const derivedFields = new Set<string>();

      modelRows.forEach((row) => {
        if (isCustomMetadataField(row.fieldName)) {
          customMetadata.push(row.fieldName);
          return;
        }
        const docMatch = hasDocModelMatch(docsModelFieldSet, row.fieldName);
        if (docMatch) {
          documented.push(row.fieldName);
        }
        if (classificationFields.has(row.fieldName)) {
          classificationFieldsList.push(row.fieldName);
          return;
        }
        if (derivedFields.has(row.fieldName)) {
          derivedFieldsList.push(row.fieldName);
          return;
        }
        if (relationshipFieldSet.has(normalizeFieldId(row.fieldName))) {
          if (docMatch) {
            relationshipFieldList.push(row.fieldName);
          } else {
            unsupported.push(row.fieldName);
          }
          return;
        }
        if (docMatch) {
          supported.push(row.fieldName);
        } else {
          unsupported.push(row.fieldName);
        }
      });

      setCompatibility({
        supported,
        unsupported,
        customMetadata,
        classificationFields: classificationFieldsList,
        derivedFields: derivedFieldsList,
        documented,
        relationshipFields: relationshipFieldList,
      });
    } catch (error) {
      setCompatibilityError(error instanceof Error ? error.message : 'Model check failed.');
    } finally {
      setCompatibilityLoading(false);
    }
  }, [modelRows, docsModelFieldSet, relationshipFieldSet]);

  const syncDocs = useCallback(async () => {
    setDocsSyncing(true);
    try {
      const res = await fetch('/api/atlan/docsync', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.result) {
        setDocsIndex({
          generatedAt: data.result.generatedAt,
          pageCount: data.result.pageCount,
        });
        if (isConnected && docsModelFieldSet) {
          await runCompatibilityCheck();
        }
      }
    } finally {
      setDocsSyncing(false);
    }
  }, [isConnected, docsModelFieldSet, runCompatibilityCheck]);

  useEffect(() => {
    if (!docsModelFieldSet || compatibilityLoading) return;
    if (compatibility) {
      runCompatibilityCheck();
    }
  }, [docsModelFieldSet, compatibilityLoading, compatibility, runCompatibilityCheck]);

return (
    <div className="h-full overflow-auto">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Atlan Metadata Modeling Assistant</p>
              <h1 className="text-3xl font-bold text-gray-900 mt-2">Build fast, high-value metadata models</h1>
              <p className="text-gray-600 mt-2 max-w-2xl">
                Choose the outcomes, match the Atlan-standard use cases, and generate a metadata enrichment plan that maps
                directly to live assets.
              </p>
            </div>
            <button
              onClick={exportModel}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold shadow-sm hover:bg-gray-800"
            >
              <Download className="w-4 h-4" />
              Export model
            </button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-3 space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-blue-600" />
                <h2 className="font-semibold text-gray-900">Use case selector</h2>
              </div>
              <p className="text-xs text-gray-500 mb-4">Pick the outcomes you want to drive. We’ll tailor the model for each asset type.</p>
              <div className="space-y-3">
                {useCaseOptions.map((option) => (
                  <button
                    key={option.useCase}
                    onClick={() => toggleUseCase(option.useCase)}
                    className={`w-full text-left px-3 py-3 rounded-lg border transition-colors ${
                      selectedUseCases.includes(option.useCase)
                        ? 'border-blue-500 bg-blue-50 text-blue-900'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{option.useCase}</span>
                      {selectedUseCases.includes(option.useCase) && (
                        <BadgeCheck className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {option.objectives.join(' • ')}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-2">
                      {option.assetTypes.slice(0, 4).join(', ')}{option.assetTypes.length > 4 ? '…' : ''}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-5 h-5 text-amber-600" />
                <h2 className="font-semibold text-gray-900">Starter templates</h2>
              </div>
              <p className="text-xs text-gray-500 mb-4">Apply a proven template to seed your model and adapt from there.</p>
              <div className="space-y-3">
                {MODEL_DATA.starterModels.map((model) => (
                  <button
                    key={model.name}
                    onClick={() => applyTemplate(model)}
                    className={`w-full text-left px-3 py-3 rounded-lg border transition-colors ${
                      selectedTemplate === model.name
                        ? 'border-amber-500 bg-amber-50 text-amber-900'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{model.name}</span>
                      <span className="text-[11px] uppercase tracking-wide text-gray-400">{model.targetVertical}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">{model.primaryUseCases.join(' • ')}</p>
                    <p className="text-[11px] text-gray-400 mt-2">{model.notes}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h2 className="font-semibold text-gray-900">Governance add-ons</h2>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Recommended governance patterns for the selected use cases.
              </p>
              <div className="space-y-3">
                {matchingGovernancePatterns.map((pattern) => (
                  <div key={pattern.patternName} className="rounded-lg border border-gray-200 p-3">
                    <p className="text-sm font-semibold text-gray-900">{pattern.patternName}</p>
                    <p className="text-xs text-gray-500 mt-1">{pattern.description}</p>
                    <p className="text-[11px] text-gray-400 mt-2">
                      Required: {pattern.requiredFields.slice(0, 4).join(', ')}{pattern.requiredFields.length > 4 ? '…' : ''}
                    </p>
                  </div>
                ))}
                {!matchingGovernancePatterns.length && (
                  <p className="text-xs text-gray-400">Select a use case to see governance recommendations.</p>
                )}
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-6 space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div>
                  <h2 className="font-semibold text-gray-900">Model builder</h2>
                  <p className="text-xs text-gray-500">Phase 1 = core + promoted fields. Phase 2 = deferred enrichment.</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full">Phase 1: {totalPhase1}</span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full">Phase 2: {totalPhase2}</span>
                  <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full">Core: {totalCore}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {assetTypeOptions.map((assetType) => (
                  <button
                    key={assetType}
                    onClick={() => setSelectedAssetType(assetType)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      selectedAssetType === assetType
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {assetType}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={fieldQuery}
                    onChange={(event) => setFieldQuery(event.target.value)}
                    placeholder="Filter fields by name or description"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-[11px] text-gray-600 mb-3">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
                  <CheckCircle2 className="w-3 h-3" />
                  Atlan core
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-50 text-indigo-700">
                  <Puzzle className="w-3 h-3" />
                  Custom metadata
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-teal-50 text-teal-700">
                  <Link2 className="w-3 h-3" />
                  Relationship
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 text-amber-700">
                  <XCircle className="w-3 h-3" />
                  Unsupported
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                  Needs Atlan check
                </span>
              </div>

              <div className="overflow-auto border border-gray-200 rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Field</th>
                      <th className="px-3 py-2 text-left">Description</th>
                      <th className="px-3 py-2 text-left">Core/Rec</th>
                      <th className="px-3 py-2 text-left">Phase</th>
                      <th className="px-3 py-2 text-left">Why it matters</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {modelRows.map((row) => (
                      <tr key={row.fieldName} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-900">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => togglePromoteField(row.fieldName)}
                              className={`text-[11px] px-2 py-0.5 rounded-full border ${
                                row.phase === 'Phase 1'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-gray-100 text-gray-500 border-gray-200'
                              }`}
                            >
                              {row.phase}
                            </button>
                            <span>{row.fieldName}</span>
                          </div>
                          <p className="text-[11px] text-gray-400 mt-1">{row.useCases}</p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {modelSupportMap.get(row.fieldName) === 'supported' && (
                              <span className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                                <CheckCircle2 className="w-3 h-3" />
                                In model
                              </span>
                            )}
                            {modelSupportMap.get(row.fieldName) === 'unsupported' && (
                              <span className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700">
                                <XCircle className="w-3 h-3" />
                                Not in model
                              </span>
                            )}
                            {supportMap.get(row.fieldName)?.source === 'atlan' && (
                              <span className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                                <CheckCircle2 className="w-3 h-3" />
                                Atlan core
                              </span>
                            )}
                            {supportMap.get(row.fieldName)?.source === 'cm' && (
                              <span className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                                <Puzzle className="w-3 h-3" />
                                Custom metadata
                              </span>
                            )}
                            {supportMap.get(row.fieldName)?.source === 'unsupported' && (
                              <span className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                                <XCircle className="w-3 h-3" />
                                Unsupported
                              </span>
                            )}
                            {supportMap.get(row.fieldName)?.source === 'relationship' && (
                              <span className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">
                                <Link2 className="w-3 h-3" />
                                Relationship
                              </span>
                            )}
                            {supportMap.get(row.fieldName)?.source === 'classification' && (
                              <span className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700">
                                <Tag className="w-3 h-3" />
                                Classification
                              </span>
                            )}
                            {supportMap.get(row.fieldName)?.source === 'derived' && (
                              <span className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                Derived
                              </span>
                            )}
                            {supportMap.get(row.fieldName)?.source === 'unknown' && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                Model check needed
                              </span>
                            )}
                            {availability?.available.includes(row.fieldName) && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                Populated in scope
                              </span>
                            )}
                            {availability?.missing.includes(row.fieldName) && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                No data in scope
                              </span>
                            )}
                            {supportMap.get(row.fieldName)?.documented && docsModelLinks[row.fieldName] && (
                              <a
                                href={docsModelLinks[row.fieldName] || '#'}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
                              >
                                Doc reference
                              </a>
                            )}
                          </div>
                          {availability?.matchedAliases[row.fieldName] && (
                            <p
                              className={`text-[11px] mt-2 ${
                                availability?.available.includes(row.fieldName)
                                  ? 'text-emerald-700'
                                  : 'text-amber-700'
                              }`}
                            >
                                  {availability?.available.includes(row.fieldName) ? 'Populated as' : 'Mapped to'}:{' '}
                                  {availability.matchedAliases[row.fieldName]}
                                </p>
                              )}
                          {supportMap.get(row.fieldName)?.source !== 'unsupported' && (
                            <div className="mt-2">
                              <button
                                onClick={() => runFieldEvidenceScan(row.fieldName)}
                                disabled={!isConnected || evidenceLoadingField === row.fieldName}
                                className="text-[11px] px-2 py-1 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                              >
                                {evidenceLoadingField === row.fieldName ? 'Scanning…' : 'Evidence'}
                              </button>
                              {evidenceByField[row.fieldName]?.assets && (
                                <ul className="mt-2 space-y-1">
                                  {evidenceByField[row.fieldName].assets.length === 0 ? (
                                    <li className="text-[11px] text-gray-400">No missing assets found.</li>
                                  ) : (
                                    evidenceByField[row.fieldName].assets.map((asset) => (
                                      <li key={asset.guid} className="text-[11px] text-gray-500">
                                        {asset.name}
                                      </li>
                                    ))
                                  )}
                                </ul>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-600 max-w-[260px]">{row.description}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`text-[11px] font-semibold px-2 py-1 rounded-full ${
                              row.coreVsRecommended === 'Core'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {row.coreVsRecommended}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-500 text-xs">{row.phase}</td>
                        <td className="px-3 py-2 text-gray-500 text-xs">{row.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-4">
                <ClipboardList className="w-5 h-5 text-indigo-600" />
                <h2 className="font-semibold text-gray-900">Implementation checklist</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {actionPlan.map((action) => {
                  const Icon = action.icon;
                  return (
                    <div
                      key={action.id}
                      className={`rounded-lg border p-3 ${
                        action.relevant ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${action.relevant ? 'text-indigo-600' : 'text-gray-400'}`} />
                        <p className={`text-sm font-semibold ${action.relevant ? 'text-indigo-700' : 'text-gray-700'}`}>
                          {action.label}
                        </p>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">{action.hint}</p>
                      <p className="text-[11px] text-gray-400 mt-2">
                        Triggered by: {action.fields.slice(0, 3).join(', ')}{action.fields.length > 3 ? '…' : ''}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-3 space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Database className="w-5 h-5 text-slate-600" />
                <h2 className="font-semibold text-gray-900">Live Atlan view</h2>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Scope your model to live assets and track enrichment coverage.
              </p>
              <div className={`rounded-lg border p-3 mb-3 ${isConnected ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-gray-50'}`}>
                <p className="text-xs font-semibold text-gray-700">Connection status</p>
                <p className={`text-sm font-semibold ${isConnected ? 'text-emerald-700' : 'text-gray-600'}`}>
                  {isConnected ? 'Connected to Atlan' : 'Not connected'}
                </p>
                {atlanConfig?.baseUrl && (
                  <p className="text-[11px] text-gray-500 mt-1">{atlanConfig.baseUrl}</p>
                )}
              </div>

              {isConnected ? (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                    <p className="text-xs font-semibold text-gray-700">Choose a schema</p>
                  </div>
                  <div className="p-2 h-[320px]">
                    <AssetBrowser
                      selectedAsset={selectedAsset}
                      onAssetSelect={setSelectedAsset}
                      className="h-full"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-xs text-gray-400">Connect to Atlan from the left nav to enable live asset browsing.</div>
              )}

              <div className="mt-4">
                <button
                  onClick={runCoverageScan}
                  disabled={!isConnected || coverageLoading}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold disabled:opacity-50"
                >
                  {coverageLoading ? 'Scanning…' : 'Run coverage scan'}
                  <Activity className="w-4 h-4" />
                </button>
                {coverageError && (
                  <p className="text-xs text-red-600 mt-2">{coverageError}</p>
                )}
                {coverage && (
                  <div className="mt-3 space-y-2 text-xs text-gray-600">
                    <div className="flex items-center justify-between">
                      <span>Total assets</span>
                      <span className="font-semibold text-gray-900">{coverage.total}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Has owner</span>
                      <span className="font-semibold text-gray-900">{toPercent(coverage.hasOwner, coverage.total)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Has description</span>
                      <span className="font-semibold text-gray-900">{toPercent(coverage.hasDescription, coverage.total)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Has readme</span>
                      <span className="font-semibold text-gray-900">{toPercent(coverage.hasReadme, coverage.total)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Certified</span>
                      <span className="font-semibold text-gray-900">{toPercent(coverage.hasCertificate, coverage.total)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-5 h-5 text-indigo-600" />
                <h2 className="font-semibold text-gray-900">Model coverage</h2>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Check which fields are defined in your tenant’s Atlan model, and whether they are populated in scope.
              </p>
              <p className="text-[11px] text-gray-400 mb-3">Docs-based coverage</p>
              <div className="flex items-center justify-between text-[11px] text-gray-500 mb-3">
                <span>
                  Docs cache: {docsIndex ? `${docsIndex.pageCount} pages` : 'not synced'}
                </span>
                {docsIndex && <span>Updated {new Date(docsIndex.generatedAt).toLocaleDateString()}</span>}
              </div>
              <div className="flex gap-2 mb-3">
                <button
                  onClick={syncDocs}
                  disabled={docsSyncing}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-indigo-200 text-indigo-700 text-xs font-semibold hover:bg-indigo-50 disabled:opacity-50"
                >
                  {docsSyncing ? 'Syncing docs…' : 'Sync docs'}
                </button>
                <button
                  onClick={runCompatibilityCheck}
                  disabled={compatibilityLoading}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold disabled:opacity-50"
                >
                  {compatibilityLoading ? 'Checking…' : 'Model check'}
                </button>
                <button
                  onClick={runAvailabilityCheck}
                  disabled={!isConnected || availabilityLoading}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50"
                >
                  {availabilityLoading ? 'Checking…' : 'Population check'}
                </button>
              </div>
              {compatibilityError && (
                <p className="text-xs text-red-600 mt-2">{compatibilityError}</p>
              )}
              {availabilityError && (
                <p className="text-xs text-red-600 mt-2">{availabilityError}</p>
              )}
              {compatibility && (
                <div className="mt-3 space-y-2 text-xs text-gray-600">
                  <div className="flex items-center justify-between">
                    <span>In model</span>
                    <span className="font-semibold text-gray-900">{compatibility.supported.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Custom metadata</span>
                    <span className="font-semibold text-gray-900">{compatibility.customMetadata.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Relationship fields</span>
                    <span className="font-semibold text-gray-900">{compatibility.relationshipFields.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Classification fields</span>
                    <span className="font-semibold text-gray-900">{compatibility.classificationFields.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Unsupported fields</span>
                    <span className="font-semibold text-gray-900">{compatibility.unsupported.length}</span>
                  </div>
                  {compatibility.unsupported.length > 0 && (
                    <p className="text-[11px] text-amber-600">
                      Review unsupported fields for mapping or CM setup.
                    </p>
                  )}
                </div>
              )}
              {availability && (
                <div className="mt-3 space-y-2 text-xs text-gray-600">
                  <div className="flex items-center justify-between">
                    <span>Populated in scope</span>
                    <span className="font-semibold text-gray-900">{availability.available.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>No data in scope</span>
                    <span className="font-semibold text-gray-900">{availability.missing.length}</span>
                  </div>
                </div>
              )}
              <div className="mt-4 border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-700">Evidence scan</p>
                  <button
                    onClick={runEvidenceScan}
                    disabled={!isConnected || evidenceLoading}
                    className="text-[11px] px-2 py-1 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {evidenceLoading ? 'Scanning…' : 'Scan missing fields'}
                  </button>
                </div>
                {evidenceError && (
                  <p className="text-xs text-red-600">{evidenceError}</p>
                )}
                {evidenceResults.length > 0 && (
                  <div className="space-y-3 text-xs text-gray-600">
                    {evidenceResults.map((result) => (
                      <div key={result.fieldName} className="rounded-lg border border-gray-200 p-2">
                        <p className="text-xs font-semibold text-gray-900">{result.fieldName}</p>
                        {result.assets.length === 0 ? (
                          <p className="text-[11px] text-gray-400 mt-1">No missing assets found.</p>
                        ) : (
                          <ul className="mt-1 space-y-1">
                            {result.assets.map((asset) => (
                              <li key={asset.guid} className="text-[11px] text-gray-500">
                                {asset.name}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-5 h-5 text-rose-600" />
                <h2 className="font-semibold text-gray-900">Phase plan</h2>
              </div>
              <div className="space-y-3 text-xs text-gray-600">
                <div className="flex items-start gap-2">
                  <span className="w-6 h-6 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center font-semibold">1</span>
                  <div>
                    <p className="font-semibold text-gray-900">Focus on phase 1 fields</p>
                    <p>Target 10–20 fields per asset type for the first domain.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-6 h-6 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center font-semibold">2</span>
                  <div>
                    <p className="font-semibold text-gray-900">Hydrate metadata on top assets</p>
                    <p>Pick the 20–50 most used assets and enrich first.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-6 h-6 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center font-semibold">3</span>
                  <div>
                    <p className="font-semibold text-gray-900">Apply trust signals</p>
                    <p>Attach badges and certificates once coverage hits 70%+.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
