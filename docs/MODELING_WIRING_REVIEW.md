# Modeling & Scoring Configuration Wiring Review

## Executive Summary

The current modeling/scoring logic needs a **two-phase validation approach**:
1. **Phase 1 - Atlan Data Model Check**: Verify if an attribute exists in Atlan's type system
2. **Phase 2 - MDLH Snowflake Check**: Verify if the attribute is actually populated in MDLH tables

---

## Current Architecture

### 1. Field Catalog Sources

| File | Purpose | Status |
|------|---------|--------|
| `src/data/fieldCatalog.json` | UI-focused field library with use cases | ✅ Active |
| `src/evaluation/catalog/unifiedFields.js` | Scoring-focused catalog with signal mappings | ✅ Active |
| `src/utils/atlanCompatibility.js` | Field → Atlan attribute mappings | ✅ Active |

### 2. Current Field Definition Structure

```javascript
// From unifiedFields.js - each field has:
{
  id: 'owner_users',
  displayName: 'Owner Users',
  description: 'Individual users accountable for the asset.',
  category: 'ownership',
  source: { type: 'native', attribute: 'ownerUsers' },  // Atlan API attribute
  mdlhColumn: 'OWNERUSERS',                              // MDLH Snowflake column
  supportedAssetTypes: ['*'],
  contributesToSignals: [{ signal: 'OWNERSHIP', weight: 1.0 }],
  // ...
}
```

### 3. Current Validation Flow

```
Model Builder selects fields
    ↓
fieldToColumnMap (hardcoded in ModelBuilder.jsx:424-437)
    ↓
Query ASSETS table with COUNT_IF expressions
    ↓
Return coverage percentages
```

**Problem**: The current flow only checks MDLH, doesn't validate Atlan schema first.

---

## Gap Analysis

### Missing: Atlan Schema Discovery

Currently there's NO runtime check for:
- Whether an attribute exists in Atlan's type system
- Whether it's available for the selected asset type
- Whether it's a native vs. custom metadata attribute

### Current MDLH Column Mapping

The `ModelBuilder.jsx` has a **hardcoded** mapping that's incomplete:

```javascript
// Current mapping in ModelBuilder.jsx:424-437
const fieldToColumnMap = {
  'owner_users': 'OWNER_USERS',
  'owner_groups': 'OWNER_GROUPS', 
  'description': 'DESCRIPTION',
  'certificate_status': 'CERTIFICATE_STATUS',
  'tags': 'TAGS',
  'term_guids': 'TERM_GUIDS',
  'readme': 'README_GUID',
  // ... only 12 fields mapped!
};
```

**Problem**: Only 12 of ~40+ fields are mapped. Missing:
- `POPULARITYSCORE`
- `QUERYCOUNT`
- `CLASSIFICATIONNAMES`
- `DOMAINGUIDS`
- `HAS_LINEAGE` / `__HASLINEAGE`
- All quality fields (`ASSETSODADQSTATUS`, etc.)
- All hierarchy fields (`CONNECTIONQUALIFIEDNAME`, etc.)

### Field Sources vs MDLH Columns Mismatch

From `unifiedFields.js`, here's the complete mapping that exists but isn't being used:

| Field ID | Atlan Attribute | MDLH Column | In ModelBuilder? |
|----------|-----------------|-------------|------------------|
| owner_users | ownerUsers | OWNERUSERS | ✅ |
| owner_groups | ownerGroups | OWNERGROUPS | ✅ |
| steward_users | adminUsers | ADMINUSERS | ❌ |
| description | description/userDescription | DESCRIPTION | ✅ |
| readme | readme (relationship) | README | ❌ (has README_GUID) |
| glossary_terms | meanings | ASSIGNEDTERMS | ❌ |
| has_lineage | __hasLineage | __HASLINEAGE | ❌ |
| is_primary_key | isPrimary | ISPRIMARYKEY | ❌ |
| is_foreign_key | isForeign | ISFOREIGNKEY | ❌ |
| classifications | classificationNames | CLASSIFICATIONNAMES | ❌ |
| policy_count | assetPoliciesCount | ASSETPOLICIESCOUNT | ❌ |
| dq_soda_status | assetSodaDQStatus | ASSETSODADQSTATUS | ❌ |
| mc_is_monitored | assetMcIsMonitored | ASSETMCISMONITORED | ❌ |
| popularity_score | popularityScore | POPULARITYSCORE | ❌ |
| query_count | queryCount | QUERYCOUNT | ❌ |
| query_user_count | queryUserCount | QUERYUSERCOUNT | ❌ |
| certificate_status | certificateStatus | CERTIFICATESTATUS | ✅ |
| domain_guids | domainGUIDs | DOMAINGUIDS | ❌ |

---

## Proposed Two-Phase Validation

### Phase 1: Atlan Type System Check

**Purpose**: Verify field exists in Atlan's data model before showing it as an option

```javascript
// New service: src/evaluation/services/atlanSchemaService.js

export async function validateFieldInAtlan(fieldId, assetType) {
  const field = getFieldById(fieldId);
  if (!field) return { exists: false, reason: 'Unknown field' };
  
  // Check if field is supported for this asset type
  if (!field.supportedAssetTypes.includes('*') && 
      !field.supportedAssetTypes.includes(assetType)) {
    return { exists: false, reason: `Not supported for ${assetType}` };
  }
  
  // For native fields, check Atlan API if connected
  if (field.source.type === 'native') {
    // Query Atlan /api/meta/types/{typeName} endpoint
    // Verify attribute exists
  }
  
  // For custom metadata, check if CM type exists in tenant
  if (field.source.type === 'custom_metadata') {
    // Query Atlan /api/meta/types/businessmetadata
    // Verify CM attribute exists
  }
  
  return { exists: true };
}
```

### Phase 2: MDLH Column Availability Check

**Purpose**: Verify the column actually exists in Snowflake MDLH tables

```javascript
// Enhanced: src/evaluation/services/mdlhSchemaService.js

export async function discoverMDLHColumns(database, schema, tableName = 'ASSETS') {
  const fqn = `"${database}"."${schema}"."${tableName}"`;
  
  const result = await executeQuery(`
    SELECT COLUMN_NAME, DATA_TYPE 
    FROM ${database}.INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = '${schema}' 
      AND TABLE_NAME = '${tableName}'
  `);
  
  return new Map(result.map(r => [r.COLUMN_NAME, r.DATA_TYPE]));
}

export async function validateFieldInMDLH(fieldId, discoveredColumns) {
  const field = getFieldById(fieldId);
  if (!field?.mdlhColumn) {
    return { exists: false, reason: 'No MDLH column mapped' };
  }
  
  const exists = discoveredColumns.has(field.mdlhColumn);
  return { exists, column: field.mdlhColumn };
}
```

### Combined Validation Flow

```
User selects field in Model Builder
    ↓
╔═══════════════════════════════════════════════╗
║ Phase 1: Atlan Type Check                     ║
║ - Is field supported for this asset type?    ║
║ - Does attribute exist in Atlan schema?      ║
║ - Is it native or custom metadata?           ║
╚═══════════════════════════════════════════════╝
    ↓ (field is valid in Atlan)
╔═══════════════════════════════════════════════╗
║ Phase 2: MDLH Snowflake Check                 ║
║ - Does column exist in ASSETS table?         ║
║ - Or in entity-specific table?               ║
║ - What's the data type?                       ║
╚═══════════════════════════════════════════════╝
    ↓ (column exists)
╔═══════════════════════════════════════════════╗
║ Phase 3: Coverage Scan                        ║
║ - COUNT_IF(column IS NOT NULL) AS populated  ║
║ - Calculate coverage percentage              ║
╚═══════════════════════════════════════════════╝
    ↓
Show field with validation status badge
```

---

## Implementation Roadmap

### Step 1: Centralize Field-to-Column Mapping

Replace hardcoded mapping in `ModelBuilder.jsx` with lookup from `unifiedFields.js`:

```javascript
// Instead of hardcoded fieldToColumnMap:
import { getFieldById, UNIFIED_FIELD_CATALOG } from '../../../evaluation/catalog/unifiedFields';

const fieldToColumnMap = UNIFIED_FIELD_CATALOG.reduce((acc, field) => {
  if (field.mdlhColumn) {
    acc[field.id] = field.mdlhColumn;
  }
  return acc;
}, {});
```

### Step 2: Add MDLH Schema Discovery

Create a hook that discovers available columns on connection:

```javascript
// src/hooks/useMDLHSchema.js
export function useMDLHSchema(database, schema, isConnected) {
  const [columns, setColumns] = useState(new Map());
  
  useEffect(() => {
    if (!isConnected || !database || !schema) return;
    
    discoverMDLHColumns(database, schema, 'ASSETS')
      .then(setColumns);
  }, [database, schema, isConnected]);
  
  return { columns, hasColumn: (col) => columns.has(col) };
}
```

### Step 3: Update Model Builder UI

Show validation status for each field:

```jsx
{modelRows.map(row => {
  const field = getFieldById(row.fieldName);
  const mdlhColumn = field?.mdlhColumn;
  const inMDLH = mdlhColumn && discoveredColumns.has(mdlhColumn);
  
  return (
    <tr key={row.fieldName}>
      <td>{row.fieldName}</td>
      <td>
        {inMDLH ? (
          <Badge color="green">In MDLH</Badge>
        ) : mdlhColumn ? (
          <Badge color="yellow">Column: {mdlhColumn} (not found)</Badge>
        ) : (
          <Badge color="gray">No MDLH mapping</Badge>
        )}
      </td>
    </tr>
  );
})}
```

### Step 4: Dynamic Coverage Query

Generate coverage queries only for fields that exist in MDLH:

```javascript
const buildCoverageQuery = (fields, assetsFQN, assetTypeFilter) => {
  const validFields = fields.filter(f => {
    const fieldDef = getFieldById(f.fieldName);
    return fieldDef?.mdlhColumn && discoveredColumns.has(fieldDef.mdlhColumn);
  });
  
  if (validFields.length === 0) {
    return null; // No checkable fields
  }
  
  const countExpressions = validFields.map(f => {
    const col = getFieldById(f.fieldName).mdlhColumn;
    return buildCountExpression(col, f.fieldName);
  }).join(',\n');
  
  return `SELECT COUNT(*) AS total, ${countExpressions}
          FROM ${assetsFQN}
          WHERE STATUS = 'ACTIVE' AND ${assetTypeFilter}`;
};
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/evaluation/modelBuilder/ModelBuilder.jsx` | Use centralized field mapping, add validation badges |
| `src/evaluation/catalog/unifiedFields.js` | Add missing `mdlhColumn` mappings |
| `src/hooks/useMDLHSchema.js` | **NEW** - Discover MDLH columns |
| `src/evaluation/services/mdlhSchemaService.js` | **NEW** - Schema discovery queries |
| `src/evaluation/ModelingApp.jsx` | Pass schema discovery down to child components |

---

## Quick Wins (Can Do Now)

1. **Fix `unifiedFields.js`** - Add missing `mdlhColumn` mappings for all 40+ fields
2. **Update `ModelBuilder.jsx`** - Import from `unifiedFields.js` instead of hardcoding
3. **Add INFORMATION_SCHEMA query** - Discover available columns dynamically

---

## Testing Checklist

- [ ] Model Builder shows correct validation status per field
- [ ] Coverage scan only queries fields that exist in MDLH
- [ ] Fields without MDLH mapping show appropriate warning
- [ ] Asset type filtering works correctly
- [ ] Connection status correctly enables/disables validation

---

## End-to-End Field Presence Check Script

A Python script is available to run comprehensive field presence checks:

```bash
# From project root
cd backend && source venv/bin/activate
python ../scripts/field_presence_check.py
```

### What the Script Does

1. **Loads Unified Field Catalog** (31 fields across 9 categories)
2. **Discovers Schema** via backend `/api/tenant-config/schema` endpoint
3. **Finds Primary Assets Table** (ASSETS, GOLD_ASSETS, etc.)
4. **Checks Field Presence** - matches canonical fields to actual columns
5. **Runs Coverage Query** - counts populated values per field
6. **Compares Schemas** - shows side-by-side comparison

### Schemas to Test

| Schema | Description |
|--------|-------------|
| `ATLAN_GOLD.PUBLIC` | Standard Atlan MDLH Gold layer |
| `WIDE_WORLD_IMPORTERS.PROCESSED_GOLD` | Custom processed Gold layer |

### Field Categories Checked

| Category | Fields | Description |
|----------|--------|-------------|
| identity | 6 | GUID, name, type, qualified_name, status, connector |
| ownership | 4 | owner_users, owner_groups, admin_users, admin_groups |
| documentation | 3 | description, readme, glossary_terms |
| lineage | 3 | has_lineage, is_primary_key, is_foreign_key |
| governance | 4 | tags, certificate_status, certificate_message, policy_count |
| quality | 2 | dq_soda_status, mc_is_monitored |
| usage | 3 | popularity_score, query_count, query_user_count |
| hierarchy | 4 | connection/database/schema_qualified_name, domain_guids |
| lifecycle | 2 | created_at, updated_at |

### Sample Output

```
ATLAN_GOLD.PUBLIC:
  Primary Table: ASSETS
  Columns: 45
  Fields Found: 28/31 (90.3%)

WIDE_WORLD_IMPORTERS.PROCESSED_GOLD:
  Primary Table: GOLD_ASSETS
  Columns: 38
  Fields Found: 24/31 (77.4%)
```
