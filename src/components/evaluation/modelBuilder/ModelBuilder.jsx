/**
 * Model Builder - Metadata Modeling Assistant
 * 
 * A three-panel interface for building metadata models:
 * - Left: Use case selector and starter templates
 * - Center: Model builder with field table
 * - Right: Live MDLH view with coverage scanning
 * 
 * Now includes dynamic schema selection across your entire Snowflake.
 * DYNAMICALLY ADAPTS to whatever MDLH structure is present:
 * - Discovers available tables and columns
 * - Maps fields to available MDLH columns
 * - Only shows fields that can be queried
 * - Hierarchy-aware filtering
 * 
 * Ported from atlan-metadata-evaluation assessment package.
 */

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
  BadgeCheck,
  Users,
  FileText,
  BookOpen,
  CheckCircle2,
  Link2,
  Puzzle,
  XCircle,
  AlertTriangle,
  Settings2,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Table2,
  Eye,
  EyeOff,
  Zap,
} from 'lucide-react';
import { fieldCatalog, relationshipFields } from '../../../data/fieldCatalogLoader';
import { useConnection, useQuery } from '../../../hooks/useSnowflake';
import { useMDLHSchema } from '../../../hooks/useMDLHSchema';
import { useDynamicFieldCatalog } from '../../../hooks/useDynamicFieldCatalog';
import { isCustomMetadataField, getAtlanTypeNames, toAtlanAttributeCandidates } from '../../../utils/atlanCompatibility';
import { UNIFIED_FIELD_CATALOG, getFieldById } from '../../../evaluation/catalog/unifiedFields';
import { AssetContextSelector, SELECTION_MODE } from '../../common/AssetContextSelector';
import { escapeIdentifier, escapeStringValue, buildSafeFQN } from '../../../utils/queryHelpers';
import { normalizeQueryRows } from '../../../utils/queryResults';

// Build centralized field-to-MDLH-column mapping from unified catalog
const FIELD_TO_MDLH_COLUMN = UNIFIED_FIELD_CATALOG.reduce((acc, field) => {
  if (field.mdlhColumn) {
    acc[field.id] = field.mdlhColumn;
  }
  return acc;
}, {});

// Additional mappings for fields not in unified catalog (from fieldCatalog.json)
const ADDITIONAL_FIELD_MAPPINGS = {
  'name': 'ASSET_NAME',
  'qualified_name': 'ASSET_QUALIFIED_NAME',
  'domain': 'CONNECTOR_NAME', // Closest mapping in ASSETS table
  'term_guids': 'TERM_GUIDS',
  'readme': 'README_GUID',
  'tags': 'TAGS',
  'has_lineage': 'HAS_LINEAGE',
};

// Combined field-to-column map
const COMPLETE_FIELD_TO_COLUMN = { ...FIELD_TO_MDLH_COLUMN, ...ADDITIONAL_FIELD_MAPPINGS };

const MODEL_DATA = fieldCatalog;

const DEFAULT_USE_CASES = ['Self-service discovery', 'Business glossary & metrics'];


const FIELD_REASON_RULES = [
  { test: /owner|raci/i, reason: 'Accountability and stewardship' },
  { test: /description|readme|definition|examples|scope/i, reason: 'Context for understanding' },
  { test: /name|qualified_name|column_name|metric_name|term_name|data_product_name/i, reason: 'Reliable identification and matching' },
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

function getReason(fieldName, useCase) {
  const rule = FIELD_REASON_RULES.find((item) => item.test.test(fieldName));
  return rule ? rule.reason : `Supports ${useCase.toLowerCase()}`;
}

function toPercent(count, total) {
  if (!total) return '0%';
  return `${Math.round((count / total) * 100)}%`;
}

function normalizeFieldId(fieldName) {
  return fieldName.trim().toLowerCase();
}

export function ModelBuilder({ database: propDatabase, schema: propSchema, discoveredTables = [] }) {
  const { status: connectionStatus, loading: connectionLoading, error: connectionError } = useConnection();
  const { executeQuery, loading: queryLoading, error: queryError } = useQuery(connectionStatus);
  
  // Derive isConnected from status
  const isConnected = connectionStatus?.connected === true;
  
  // Dynamic context selection - allows switching between different database/schemas
  const [selectedContext, setSelectedContext] = useState([]);
  const [showContextSelector, setShowContextSelector] = useState(false);
  
  // Use the first selected context or fall back to props
  const activeContext = selectedContext.length > 0 ? selectedContext[0] : null;
  const database = activeContext?.database || propDatabase;
  const schema = activeContext?.schema || propSchema;
  
  // Selected table for analysis (dynamic based on discovered MDLH tables)
  const [selectedTable, setSelectedTable] = useState('ASSETS');
  const [discoveredMdlhTables, setDiscoveredMdlhTables] = useState([]);
  const [showOnlyAvailableFields, setShowOnlyAvailableFields] = useState(false);
  
  // Initialize context from props
  useEffect(() => {
    if (propDatabase && propSchema && selectedContext.length === 0) {
      setSelectedContext([{
        database: propDatabase,
        schema: propSchema,
        label: `${propDatabase}.${propSchema}`,
      }]);
    }
  }, [propDatabase, propSchema]);
  
  // MDLH Schema discovery - validates which columns actually exist in Snowflake
  const { 
    columns: mdlhColumns,
    hasColumn: hasMDLHColumn,
    getFieldAvailability,
    availableFields: mdlhAvailableFields,
    loading: schemaLoading,
  } = useMDLHSchema(database, schema, selectedTable);
  
  // Dynamic field catalog - adapts to available columns
  const {
    dynamicCatalog,
    availableFields: dynamicAvailableFields,
    missingFields: dynamicMissingFields,
    availableSignals,
    canEvaluateSignal,
    computeCoverage,
    loading: dynamicCatalogLoading,
    refresh: refreshDynamicCatalog,
  } = useDynamicFieldCatalog(database, schema, selectedTable);
  
  const connectionString = database && schema ? `${database}.${schema}` : null;
  
  // ==========================================================================
  // DYNAMIC MDLH TABLE DISCOVERY
  // ==========================================================================
  
  // Discover MDLH tables in the selected schema
  useEffect(() => {
    if (!isConnected || !database || !schema) {
      setDiscoveredMdlhTables([]);
      return;
    }
    
    const discoverTables = async () => {
      try {
        const query = `
          SELECT TABLE_NAME, TABLE_TYPE
          FROM ${escapeIdentifier(database)}.INFORMATION_SCHEMA.TABLES
          WHERE TABLE_SCHEMA = ${escapeStringValue(schema)}
            AND TABLE_TYPE IN ('BASE TABLE', 'VIEW')
          ORDER BY TABLE_NAME
        `;
        
        const result = await executeQuery(query, { database, schema });
        
        const tables = normalizeQueryRows(result).map(r => ({
          name: r.TABLE_NAME || r.table_name,
          type: r.TABLE_TYPE || r.table_type,
        })).filter(t => t.name);
        
        // Filter to MDLH tables
        const mdlhPatterns = ['ASSETS', 'ASSET', 'GOLD', 'LINEAGE', 'GLOSSARY', 'TERMS', 'QUALITY'];
        const mdlhTables = tables.filter(t => 
          mdlhPatterns.some(p => t.name.toUpperCase().includes(p))
        );
        
        setDiscoveredMdlhTables(mdlhTables);
        
        // Auto-select first MDLH table if none selected
        if (mdlhTables.length > 0 && !mdlhTables.find(t => t.name === selectedTable)) {
          const assetsTable = mdlhTables.find(t => t.name.toUpperCase() === 'ASSETS');
          setSelectedTable(assetsTable?.name || mdlhTables[0].name);
        }
      } catch (e) {
        console.error('[ModelBuilder] Failed to discover MDLH tables:', e);
      }
    };
    
    discoverTables();
  }, [isConnected, database, schema, executeQuery]);
  
  const [selectedUseCases, setSelectedUseCases] = useState(DEFAULT_USE_CASES);
  const [selectedAssetType, setSelectedAssetType] = useState('Tables');
  const [promotedFields, setPromotedFields] = useState(new Set());
  const [fieldQuery, setFieldQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [coverage, setCoverage] = useState(null);
  const [coverageLoading, setCoverageLoading] = useState(false);
  const [coverageError, setCoverageError] = useState(null);
  const [populationData, setPopulationData] = useState(null);
  const [populationLoading, setPopulationLoading] = useState(false);
  const [populationError, setPopulationError] = useState(null);

  const relationshipFieldSet = useMemo(
    () => new Set((relationshipFields || []).map((field) => normalizeFieldId(field))),
    []
  );

  const useCaseOptions = useMemo(() => {
    const useCaseGrid = MODEL_DATA.useCaseGrid || [];
    const grouped = new Map();
    useCaseGrid.forEach((row) => {
      if (!grouped.has(row.useCase)) {
        grouped.set(row.useCase, { objectives: row.objectives || [], assetTypes: new Set() });
      }
      const entry = grouped.get(row.useCase);
      (row.assetTypes || []).forEach((asset) => entry?.assetTypes.add(asset));
    });
    return Array.from(grouped.entries()).map(([useCase, info]) => ({
      useCase,
      objectives: info.objectives,
      assetTypes: Array.from(info.assetTypes),
    }));
  }, []);

  const assetTypeOptions = useMemo(() => {
    const useCaseGrid = MODEL_DATA.useCaseGrid || [];
    const assets = new Set();
    useCaseGrid.forEach((row) => {
      if (selectedUseCases.includes(row.useCase)) {
        (row.assetTypes || []).forEach((asset) => assets.add(asset));
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
    const useCaseGrid = MODEL_DATA.useCaseGrid || [];
    const fieldLibrary = MODEL_DATA.fieldLibrary || {};
    const fieldMap = new Map();
    
    useCaseGrid.forEach((row) => {
      if (!selectedUseCases.includes(row.useCase)) return;
      if (!(row.assetTypes || []).includes(selectedAssetType)) return;

      (row.coreFields || []).forEach((field) => {
        const entry = fieldMap.get(field) || { core: false, useCases: new Set() };
        entry.core = true;
        entry.useCases.add(row.useCase);
        fieldMap.set(field, entry);
      });

      (row.recommendedFields || []).forEach((field) => {
        const entry = fieldMap.get(field) || { core: false, useCases: new Set() };
        entry.useCases.add(row.useCase);
        fieldMap.set(field, entry);
      });
    });

    // Build dynamic field availability map from the dynamic catalog
    const dynamicFieldMap = new Map(
      dynamicCatalog.map(f => [f.id, f])
    );

    const rows = Array.from(fieldMap.entries()).map(([fieldName, info]) => {
      const fieldInfo = fieldLibrary[fieldName];
      const description = fieldInfo?.description || '—';
      const phase = info.core || promotedFields.has(fieldName) ? 'Phase 1' : 'Phase 2';
      const coreVsRecommended = info.core ? 'Core' : 'Recommended';
      const useCases = Array.from(info.useCases).join(', ');
      
      // Two-phase validation: Check field availability in Atlan catalog + MDLH
      // First check dynamic catalog (discovered columns)
      const dynamicField = dynamicFieldMap.get(fieldName);
      
      // Fallback to legacy method
      const availability = getFieldAvailability(fieldName);
      const mdlhColumn = dynamicField?.matchedColumn || COMPLETE_FIELD_TO_COLUMN[fieldName] || availability.mdlhColumn;
      
      // Use dynamic availability if we have it, otherwise fall back to legacy
      const inMDLH = dynamicField?.available ?? (mdlhColumn ? hasMDLHColumn(mdlhColumn) : false);
      
      // Get signal contributions for this field
      const signalContributions = dynamicField?.contributesToSignals || [];
      
      return {
        fieldName,
        description,
        coreVsRecommended,
        phase,
        useCases,
        reason: getReason(fieldName, Array.from(info.useCases)[0] || 'Use case'),
        // Availability info - enhanced with dynamic catalog
        mdlhColumn,
        matchedColumn: dynamicField?.matchedColumn,
        inCatalog: availability.inCatalog,
        inMDLH,
        availabilityStatus: dynamicField?.available ? 'available' : (availability.status || 'unknown'),
        availabilityMessage: dynamicField?.available 
          ? `Column "${dynamicField.matchedColumn}" available`
          : availability.message,
        // Signal info
        signalContributions,
        canQuery: dynamicField?.available === true,
      };
    });

    // Apply filters
    let filtered = rows;
    
    // Filter by search query
    const normalizedQuery = fieldQuery.trim().toLowerCase();
    if (normalizedQuery) {
      filtered = filtered.filter((row) =>
        row.fieldName.toLowerCase().includes(normalizedQuery) ||
        row.description.toLowerCase().includes(normalizedQuery)
      );
    }
    
    // Filter to only show available fields if enabled
    if (showOnlyAvailableFields) {
      filtered = filtered.filter((row) => row.inMDLH);
    }

    return filtered.sort((a, b) => {
      if (a.coreVsRecommended !== b.coreVsRecommended) {
        return a.coreVsRecommended === 'Core' ? -1 : 1;
      }
      return a.fieldName.localeCompare(b.fieldName);
    });
  }, [selectedUseCases, selectedAssetType, promotedFields, fieldQuery, getFieldAvailability, hasMDLHColumn, dynamicCatalog, showOnlyAvailableFields]);

  const totalCore = modelRows.filter((row) => row.coreVsRecommended === 'Core').length;
  const totalPhase1 = modelRows.filter((row) => row.phase === 'Phase 1').length;
  const totalPhase2 = modelRows.filter((row) => row.phase === 'Phase 2').length;
  
  // MDLH availability stats for two-phase validation
  const totalInMDLH = modelRows.filter((row) => row.inMDLH).length;
  const totalMissing = modelRows.filter((row) => row.mdlhColumn && !row.inMDLH).length;
  const totalNoMapping = modelRows.filter((row) => !row.mdlhColumn).length;

  const matchingGovernancePatterns = useMemo(() => {
    const patterns = MODEL_DATA.governancePatterns || [];
    return patterns.filter((pattern) =>
      (pattern.primaryUseCases || []).some((useCase) => selectedUseCases.includes(useCase))
    );
  }, [selectedUseCases]);

  const applyTemplate = useCallback((model) => {
    setSelectedTemplate(model.name);
    setSelectedUseCases(model.primaryUseCases || []);
  }, []);

  const toggleUseCase = useCallback((useCase) => {
    setSelectedTemplate(null);
    setSelectedUseCases((prev) =>
      prev.includes(useCase)
        ? prev.filter((item) => item !== useCase)
        : [...prev, useCase]
    );
  }, []);

  const togglePromoteField = useCallback((fieldName) => {
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
    const useCaseGrid = MODEL_DATA.useCaseGrid || [];
    const byAssetType = useCaseGrid.reduce((acc, row) => {
      if (!selectedUseCases.includes(row.useCase)) return acc;
      (row.assetTypes || []).forEach((asset) => {
        if (!acc[asset]) acc[asset] = { core: new Set(), recommended: new Set() };
        (row.coreFields || []).forEach((field) => acc[asset].core.add(field));
        (row.recommendedFields || []).forEach((field) => acc[asset].recommended.add(field));
      });
      return acc;
    }, {});

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

  // Build the FQN for the ASSETS table
  const getAssetsFQN = useCallback(() => {
    // discoveredTables can be a Set or array of table names
    const tableSet = discoveredTables instanceof Set 
      ? discoveredTables 
      : new Set((discoveredTables || []).map(t => typeof t === 'string' ? t.toUpperCase() : t?.name?.toUpperCase()));
    
    // Check if ASSETS table is in discovered tables  
    const hasAssetsTable = tableSet.has('ASSETS');
    
    // Use database/schema if we have them
    if (database && schema) {
      return `"${database}"."${schema}"."ASSETS"`;
    }
    return null;
  }, [discoveredTables, database, schema]);

  const runCoverageScan = useCallback(async () => {
    setCoverageError(null);
    setCoverage(null);

    console.log('[ModelBuilder] runCoverageScan called', { isConnected, database, schema, discoveredTables });

    if (!isConnected) {
      setCoverageError('Connect to Snowflake to run coverage scan.');
      return;
    }

    if (!database || !schema) {
      setCoverageError(`Missing database (${database}) or schema (${schema}). Please ensure connection is properly configured.`);
      return;
    }

    const assetsFQN = getAssetsFQN();
    console.log('[ModelBuilder] ASSETS FQN:', assetsFQN);
    
    if (!assetsFQN) {
      setCoverageError('No ASSETS table found. Check your database/schema configuration.');
      return;
    }

    setCoverageLoading(true);
    try {
      // Map selected asset type to MDLH ASSET_TYPE values
      const assetTypeMapping = {
        'Tables': "ASSET_TYPE IN ('Table', 'SnowflakeTable', 'DatabricksTable')",
        'Views': "ASSET_TYPE IN ('View', 'SnowflakeView', 'MaterializedView')",
        'Columns': "ASSET_TYPE IN ('Column', 'SnowflakeColumn', 'DatabricksColumn')",
        'Dashboards': "ASSET_TYPE IN ('Dashboard', 'TableauDashboard', 'PowerBIDashboard', 'LookerDashboard')",
        'Glossary terms': "ASSET_TYPE = 'AtlasGlossaryTerm'",
        'Metric terms / KPIs': "ASSET_TYPE = 'AtlasGlossaryTerm'",
      };
      
      const assetTypeFilter = assetTypeMapping[selectedAssetType] || "1=1";
      
      // MDLH Gold Layer coverage query based on MDLH_FOUNDATION.md
      const coverageQuery = `
        SELECT
          COUNT(*) AS total,
          COUNT_IF(DESCRIPTION IS NOT NULL AND DESCRIPTION <> '') AS with_description,
          COUNT_IF(OWNER_USERS IS NOT NULL AND ARRAY_SIZE(OWNER_USERS) > 0) AS with_owners,
          COUNT_IF(TAGS IS NOT NULL AND ARRAY_SIZE(TAGS) > 0) AS with_tags,
          COUNT_IF(README_GUID IS NOT NULL) AS with_readme,
          COUNT_IF(CERTIFICATE_STATUS IS NOT NULL AND CERTIFICATE_STATUS <> '' AND CERTIFICATE_STATUS <> 'NONE') AS with_certificate
        FROM ${assetsFQN}
        WHERE STATUS = 'ACTIVE'
          AND ${assetTypeFilter}
      `;

      console.log('[ModelBuilder] Coverage query:', coverageQuery);
      
      const result = await executeQuery(coverageQuery, { database, schema });

      console.log('[ModelBuilder] Coverage result:', result);

      const rows = normalizeQueryRows(result);
      if (rows.length > 0) {
        const row = rows[0];
        console.log('[ModelBuilder] Coverage row:', row);
        setCoverage({
          total: row.TOTAL || row.total || 0,
          hasDescription: row.WITH_DESCRIPTION || row.with_description || 0,
          hasOwner: row.WITH_OWNERS || row.with_owners || 0,
          hasTags: row.WITH_TAGS || row.with_tags || 0,
          hasReadme: row.WITH_README || row.with_readme || 0,
          hasCertificate: row.WITH_CERTIFICATE || row.with_certificate || 0,
        });
      } else {
        console.error('[ModelBuilder] No data returned from coverage query. Result:', result);
        setCoverageError('No data returned from coverage query. Check that ASSETS table exists and has data.');
      }
    } catch (error) {
      console.error('[ModelBuilder] Coverage scan error:', error);
      setCoverageError(error instanceof Error ? error.message : String(error) || 'Coverage scan failed.');
    } finally {
      setCoverageLoading(false);
    }
  }, [isConnected, executeQuery, database, schema, selectedAssetType, getAssetsFQN, discoveredTables]);

  // Population check - query which fields from the model have data
  const runPopulationCheck = useCallback(async () => {
    setPopulationError(null);
    setPopulationData(null);

    console.log('[ModelBuilder] runPopulationCheck called', { isConnected, database, schema });

    if (!isConnected) {
      setPopulationError('Connect to Snowflake to run population check.');
      return;
    }

    if (!database || !schema) {
      setPopulationError(`Missing database (${database}) or schema (${schema}). Please ensure connection is properly configured.`);
      return;
    }

    const assetsFQN = getAssetsFQN();
    console.log('[ModelBuilder] Population check - ASSETS FQN:', assetsFQN);
    
    if (!assetsFQN) {
      setPopulationError('No ASSETS table found. Check your database/schema configuration.');
      return;
    }

    setPopulationLoading(true);
    try {
      // Use centralized field-to-MDLH-column mapping
      // This uses UNIFIED_FIELD_CATALOG + additional mappings defined at top of file

      // Get current model fields
      const currentFields = modelRows.slice(0, 10).map(r => r.fieldName);
      const checkableFields = currentFields.filter(f => COMPLETE_FIELD_TO_COLUMN[f]);
      
      if (checkableFields.length === 0) {
        setPopulationError('No checkable fields in current model selection.');
        setPopulationLoading(false);
        return;
      }

      // Build dynamic query to check each field
      const assetTypeMapping = {
        'Tables': "ASSET_TYPE IN ('Table', 'SnowflakeTable', 'DatabricksTable')",
        'Views': "ASSET_TYPE IN ('View', 'SnowflakeView', 'MaterializedView')",
        'Columns': "ASSET_TYPE IN ('Column', 'SnowflakeColumn', 'DatabricksColumn')",
        'Dashboards': "ASSET_TYPE IN ('Dashboard', 'TableauDashboard', 'PowerBIDashboard', 'LookerDashboard')",
        'Glossary terms': "ASSET_TYPE = 'AtlasGlossaryTerm'",
      };
      
      const assetTypeFilter = assetTypeMapping[selectedAssetType] || "1=1";
      
      const countExpressions = checkableFields.map(field => {
        const col = COMPLETE_FIELD_TO_COLUMN[field];
        // Handle array vs scalar columns (MDLH uses ARRAY types for these)
        if (['OWNER_USERS', 'OWNER_GROUPS', 'OWNERUSERS', 'OWNERGROUPS', 'TAGS', 'TERM_GUIDS', 'CLASSIFICATIONNAMES', 'DOMAINGUIDS'].includes(col)) {
          return `COUNT_IF(${col} IS NOT NULL AND ARRAY_SIZE(${col}) > 0) AS "${field}"`;
        } else if (col === 'README_GUID') {
          return `COUNT_IF(${col} IS NOT NULL) AS "${field}"`;
        } else {
          return `COUNT_IF(${col} IS NOT NULL AND ${col} <> '') AS "${field}"`;
        }
      }).join(',\n          ');

      const populationQuery = `
        SELECT
          COUNT(*) AS total,
          ${countExpressions}
        FROM ${assetsFQN}
        WHERE STATUS = 'ACTIVE'
          AND ${assetTypeFilter}
      `;

      const result = await executeQuery(populationQuery, { database, schema });

      const rows = normalizeQueryRows(result);
      if (rows.length > 0) {
        const row = rows[0];
        const total = row.TOTAL || row.total || 0;
        const populated = [];
        const missing = [];
        
        checkableFields.forEach(field => {
          const count = row[field] || row[field.toUpperCase()] || 0;
          const percent = total > 0 ? Math.round((count / total) * 100) : 0;
          if (percent > 0) {
            populated.push({ field, count, percent });
          } else {
            missing.push({ field, count: 0, percent: 0 });
          }
        });
        
        setPopulationData({ total, populated, missing });
      } else {
        setPopulationError('No data returned from population query.');
      }
    } catch (error) {
      setPopulationError(error instanceof Error ? error.message : 'Population check failed.');
    } finally {
      setPopulationLoading(false);
    }
  }, [isConnected, executeQuery, database, schema, selectedAssetType, getAssetsFQN, modelRows]);

  const actionPlan = useMemo(() => {
    const selectedFields = new Set(modelRows.map((row) => row.fieldName));
    return ENRICHMENT_ACTIONS.map((action) => {
      const relevant = action.fields.some((field) => selectedFields.has(field));
      return { ...action, relevant };
    });
  }, [modelRows]);

  const starterModels = MODEL_DATA.starterModels || [];

  return (
    <div className="h-full overflow-auto bg-slate-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Atlan Metadata Modeling Assistant</p>
              <h1 className="text-3xl font-bold text-slate-900 mt-2">Build fast, high-value metadata models</h1>
              <p className="text-slate-600 mt-2 max-w-2xl">
                Choose the outcomes, match the Atlan-standard use cases, and generate a metadata enrichment plan that maps
                directly to live assets.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowContextSelector(!showContextSelector)}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showContextSelector
                    ? 'bg-slate-200 text-slate-700'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Settings2 className="w-4 h-4" />
                {database && schema ? `${database}.${schema}` : 'Select Context'}
              </button>
              <button
                onClick={exportModel}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold shadow-sm hover:bg-slate-800"
              >
                <Download className="w-4 h-4" />
                Export model
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Context Selector */}
        {showContextSelector && (
          <div className="mb-6">
            <AssetContextSelector
              selectedSchemas={selectedContext}
              onSelectionChange={(newSelection) => {
                setSelectedContext(newSelection);
                if (newSelection.length > 0) {
                  setShowContextSelector(false); // Auto-hide after selection
                }
              }}
              selectionMode={SELECTION_MODE.SINGLE_SCHEMA}
              title="Select Analysis Context"
              placeholder="Choose the database and schema to analyze"
              defaultExpanded={true}
            />
          </div>
        )}

        <div className="grid grid-cols-12 gap-6">
          {/* Left Panel - Use Case Selector */}
          <div className="col-span-12 lg:col-span-3 space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-blue-600" />
                <h2 className="font-semibold text-slate-900">Use case selector</h2>
              </div>
              <p className="text-xs text-slate-500 mb-4">Pick the outcomes you want to drive. We'll tailor the model for each asset type.</p>
              <div className="space-y-3">
                {useCaseOptions.map((option) => (
                  <button
                    key={option.useCase}
                    onClick={() => toggleUseCase(option.useCase)}
                    className={`w-full text-left px-3 py-3 rounded-lg border transition-colors ${
                      selectedUseCases.includes(option.useCase)
                        ? 'border-blue-500 bg-blue-50 text-blue-900'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{option.useCase}</span>
                      {selectedUseCases.includes(option.useCase) && (
                        <BadgeCheck className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      {(option.objectives || []).join(' • ')}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-2">
                      {option.assetTypes.slice(0, 4).join(', ')}{option.assetTypes.length > 4 ? '…' : ''}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-5 h-5 text-amber-600" />
                <h2 className="font-semibold text-slate-900">Starter templates</h2>
              </div>
              <p className="text-xs text-slate-500 mb-4">Apply a proven template to seed your model and adapt from there.</p>
              <div className="space-y-3">
                {starterModels.map((model) => (
                  <button
                    key={model.name}
                    onClick={() => applyTemplate(model)}
                    className={`w-full text-left px-3 py-3 rounded-lg border transition-colors ${
                      selectedTemplate === model.name
                        ? 'border-amber-500 bg-amber-50 text-amber-900'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{model.name}</span>
                      <span className="text-[11px] uppercase tracking-wide text-slate-400">{model.targetVertical}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">{(model.primaryUseCases || []).join(' • ')}</p>
                    <p className="text-[11px] text-slate-400 mt-2">{model.notes}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h2 className="font-semibold text-slate-900">Governance add-ons</h2>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Recommended governance patterns for the selected use cases.
              </p>
              <div className="space-y-3">
                {matchingGovernancePatterns.map((pattern) => (
                  <div key={pattern.patternName} className="rounded-lg border border-slate-200 p-3">
                    <p className="text-sm font-semibold text-slate-900">{pattern.patternName}</p>
                    <p className="text-xs text-slate-500 mt-1">{pattern.description}</p>
                    <p className="text-[11px] text-slate-400 mt-2">
                      Required: {(pattern.requiredFields || []).slice(0, 4).join(', ')}{(pattern.requiredFields || []).length > 4 ? '…' : ''}
                    </p>
                  </div>
                ))}
                {!matchingGovernancePatterns.length && (
                  <p className="text-xs text-slate-400">Select a use case to see governance recommendations.</p>
                )}
              </div>
            </div>
          </div>

          {/* Center Panel - Model Builder */}
          <div className="col-span-12 lg:col-span-6 space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div>
                  <h2 className="font-semibold text-slate-900">Model builder</h2>
                  <p className="text-xs text-slate-500">Phase 1 = core + promoted fields. Phase 2 = deferred enrichment.</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                  <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full">Phase 1: {totalPhase1}</span>
                  <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-full">Phase 2: {totalPhase2}</span>
                  <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full">Core: {totalCore}</span>
                  <span className="h-4 w-px bg-slate-200" />
                  {isConnected && mdlhColumns.size > 0 ? (
                    <>
                      <span className="px-2 py-1 bg-green-50 text-green-700 rounded-full" title="Fields with columns in MDLH">
                        ✓ MDLH: {totalInMDLH}
                      </span>
                      {totalMissing > 0 && (
                        <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-full" title="Fields with mappings but missing columns">
                          ⚠ Missing: {totalMissing}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-full">
                      Connect to check MDLH
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {assetTypeOptions.map((assetType) => (
                  <button
                    key={assetType}
                    onClick={() => setSelectedAssetType(assetType)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      selectedAssetType === assetType
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {assetType}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={fieldQuery}
                    onChange={(event) => setFieldQuery(event.target.value)}
                    placeholder="Filter fields by name or description"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-[11px] text-slate-600 mb-3">
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
              </div>

              <div className="overflow-auto border border-slate-200 rounded-lg max-h-[500px]">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">Field</th>
                      <th className="px-3 py-2 text-left">Description</th>
                      <th className="px-3 py-2 text-left">Core/Rec</th>
                      <th className="px-3 py-2 text-left">MDLH</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {modelRows.map((row) => (
                      <tr key={row.fieldName} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium text-slate-900">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => togglePromoteField(row.fieldName)}
                              className={`text-[11px] px-2 py-0.5 rounded-full border ${
                                row.phase === 'Phase 1'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-slate-100 text-slate-500 border-slate-200'
                              }`}
                            >
                              {row.phase}
                            </button>
                            <span>{row.fieldName}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">{row.useCases}</p>
                        </td>
                        <td className="px-3 py-2 text-slate-600 max-w-[260px]">{row.description}</td>
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
                        {/* MDLH Availability Status - Two-phase validation */}
                        <td className="px-3 py-2">
                          {schemaLoading ? (
                            <span className="text-[10px] text-slate-400">checking...</span>
                          ) : row.inMDLH ? (
                            <span 
                              className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1"
                              title={`Column: ${row.mdlhColumn}`}
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              In MDLH
                            </span>
                          ) : row.mdlhColumn ? (
                            <span 
                              className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1"
                              title={`Column "${row.mdlhColumn}" not found in ASSETS table`}
                            >
                              <AlertTriangle className="w-3 h-3" />
                              Missing
                            </span>
                          ) : (
                            <span 
                              className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200"
                              title="No MDLH column mapping for this field"
                            >
                              No mapping
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-4">
                <ClipboardList className="w-5 h-5 text-indigo-600" />
                <h2 className="font-semibold text-slate-900">Implementation checklist</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {actionPlan.map((action) => {
                  const Icon = action.icon;
                  return (
                    <div
                      key={action.id}
                      className={`rounded-lg border p-3 ${
                        action.relevant ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${action.relevant ? 'text-indigo-600' : 'text-slate-400'}`} />
                        <p className={`text-sm font-semibold ${action.relevant ? 'text-indigo-700' : 'text-slate-700'}`}>
                          {action.label}
                        </p>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">{action.hint}</p>
                      <p className="text-[11px] text-slate-400 mt-2">
                        Triggered by: {action.fields.slice(0, 3).join(', ')}{action.fields.length > 3 ? '…' : ''}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Panel - Live MDLH View */}
          <div className="col-span-12 lg:col-span-3 space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Database className="w-5 h-5 text-slate-600" />
                <h2 className="font-semibold text-slate-900">Live MDLH view</h2>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Scope your model to live assets and track enrichment coverage.
              </p>
              <div className={`rounded-lg border p-3 mb-3 ${isConnected ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                <p className="text-xs font-semibold text-slate-700">Connection status</p>
                <p className={`text-sm font-semibold ${isConnected ? 'text-emerald-700' : 'text-slate-600'}`}>
                  {isConnected ? 'Connected' : 'Not connected'}
                </p>
                {connectionString && (
                  <p className="text-[11px] text-slate-500 mt-1 truncate">{connectionString}</p>
                )}
              </div>

              <div className="text-xs text-slate-400 mb-3">
                {isConnected 
                  ? 'Select a schema in the sidebar to scope coverage scans.'
                  : 'Connect to Snowflake to enable live asset browsing.'}
              </div>

              <div className="mt-4">
                <button
                  onClick={runCoverageScan}
                  disabled={!isConnected || coverageLoading}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-50"
                >
                  {coverageLoading ? 'Scanning…' : 'Run coverage scan'}
                  <Activity className="w-4 h-4" />
                </button>
                {coverageError && (
                  <p className="text-xs text-amber-600 mt-2">{coverageError}</p>
                )}
                {coverage && !coverageError && (
                  <div className="mt-3 space-y-2 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span>Total assets ({selectedAssetType})</span>
                      <span className="font-semibold text-slate-900">{coverage.total.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Has owner</span>
                      <span className="font-semibold text-slate-900">{toPercent(coverage.hasOwner, coverage.total)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Has description</span>
                      <span className="font-semibold text-slate-900">{toPercent(coverage.hasDescription, coverage.total)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Has tags</span>
                      <span className="font-semibold text-slate-900">{toPercent(coverage.hasTags, coverage.total)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Has readme</span>
                      <span className="font-semibold text-slate-900">{toPercent(coverage.hasReadme, coverage.total)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Certified</span>
                      <span className="font-semibold text-slate-900">{toPercent(coverage.hasCertificate, coverage.total)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-5 h-5 text-indigo-600" />
                <h2 className="font-semibold text-slate-900">Model coverage</h2>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Check which fields are defined in your tenant's Atlan model, and whether they are populated in scope.
              </p>
              <div className="flex gap-2 mb-3">
                <button
                  onClick={runPopulationCheck}
                  disabled={!isConnected || populationLoading}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50 hover:bg-emerald-700"
                >
                  {populationLoading ? 'Checking...' : 'Population check'}
                </button>
              </div>
              {populationError && (
                <p className="text-xs text-amber-600 mb-2">{populationError}</p>
              )}
              {populationData && !populationError && (
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Total assets checked</span>
                    <span className="font-semibold text-slate-900">{populationData.total.toLocaleString()}</span>
                  </div>
                  {populationData.populated.length > 0 && (
                    <div>
                      <p className="text-emerald-700 font-semibold mb-1">Populated in scope ({populationData.populated.length})</p>
                      <div className="space-y-1">
                        {populationData.populated.map(({ field, percent }) => (
                          <div key={field} className="flex items-center justify-between text-slate-600">
                            <span className="font-mono text-[11px]">{field}</span>
                            <span className="text-emerald-700 font-semibold">{percent}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {populationData.missing.length > 0 && (
                    <div>
                      <p className="text-amber-700 font-semibold mb-1">No data in scope ({populationData.missing.length})</p>
                      <div className="space-y-1">
                        {populationData.missing.map(({ field }) => (
                          <div key={field} className="flex items-center justify-between text-slate-600">
                            <span className="font-mono text-[11px]">{field}</span>
                            <span className="text-amber-600">0%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-5 h-5 text-rose-600" />
                <h2 className="font-semibold text-slate-900">Phase plan</h2>
              </div>
              <div className="space-y-3 text-xs text-slate-600">
                <div className="flex items-start gap-2">
                  <span className="w-6 h-6 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center font-semibold">1</span>
                  <div>
                    <p className="font-semibold text-slate-900">Focus on phase 1 fields</p>
                    <p>Target 10–20 fields per asset type for the first domain.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-6 h-6 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center font-semibold">2</span>
                  <div>
                    <p className="font-semibold text-slate-900">Hydrate metadata on top assets</p>
                    <p>Pick the 20–50 most used assets and enrich first.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-6 h-6 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center font-semibold">3</span>
                  <div>
                    <p className="font-semibold text-slate-900">Apply trust signals</p>
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

export default ModelBuilder;
