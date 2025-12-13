# MDLH / Snowflake / Query Wizard – Cursor Implementation Guide

_This file describes exactly how MDLH should work with Snowflake, query flows, and the wizard.  
Cursor: follow this. Do not guess. Do not invent tables, schemas, or endpoints._

---

## 0. TL;DR

**Core goals:**

1. **Read-only Snowflake**  
   - The app must never write to customer Snowflake.  
   - Only `SELECT`, `SHOW`, `DESCRIBE`, `INFORMATION_SCHEMA` queries.

2. **Config-driven, plug-and-play**  
   - After connecting to Snowflake, backend runs a **read-only discovery**.  
   - It builds a `SystemConfig` describing:
     - Where Atlan metadata lives (`*_ENTITY`, glossary, etc.).
     - Which features are available (lineage, glossary, etc.).
     - A basic catalog of tables (and optionally columns) for suggestions.
   - Frontend uses `SystemConfig` so all flows & wizards **adapt per environment**, not via hardcoded names.

3. **Multi-step, guided query wizards**  
   - Query flows (lineage, glossary, dbt, BI, etc.) should be **wizards**, not "drop a giant SQL string and pray."  
   - Wizards **use previous step outputs as inputs** to later steps.

4. **No hallucinations**  
   - All suggestions (DBs, schemas, tables, columns, entities) come from:
     - The discovery config, or
     - Actual query results.  
   - If we haven't seen it, we don't suggest it.

---

## 1. System Overview

### 1.1 Runtime behavior

On successful Snowflake connect:

1. Backend:
   - Uses the Snowflake connection to:
     - Discover metadata tables (e.g. `PROCESS_ENTITY`, `TABLE_ENTITY`, etc.).
     - Collect a lightweight list of tables for suggestions.
   - Builds a `SystemConfig` object for that **session**.
   - Caches it in memory keyed by session ID.

2. Frontend:
   - Once a session is active:
     - Fetches `/api/system/config`.
     - Exposes it via a React context (`SystemConfigContext` + `useConfig()`).

3. Query flows & wizards:
   - Use `SystemConfig` to:
     - Resolve DB/schema/table names.
     - Check which features are available.
     - Drive suggestions and step-based flows.

4. Session behavior:
   - Timeouts/network errors: assume session still valid, keep it.
   - 401/404: clear session, force reconnect.

### 1.2 Non-negotiable constraints

- **Read-only:** no DDL/DML to Snowflake in runtime code.
- **Config-driven:** no new hardcoded metadata DB/schema/table combos.
- **Grounded suggestions:** no invented physical objects.
- **Graceful degradation:** missing config → features disable or fall back, not crash.

---

## 2. Backend: SystemConfig & Discovery

### 2.1 SystemConfig shape

```jsonc
{
  "snowflake": {
    "entities": {
      "PROCESS_ENTITY": { "database": "FIELD_METADATA", "schema": "PUBLIC", "table": "PROCESS_ENTITY" },
      "TABLE_ENTITY":   { "database": "FIELD_METADATA", "schema": "PUBLIC", "table": "TABLE_ENTITY" },
      "VIEW_ENTITY":    { "database": "FIELD_METADATA", "schema": "PUBLIC", "table": "VIEW_ENTITY" },
      "SIGMADATAELEMENT_ENTITY": { "database": "FIELD_METADATA", "schema": "PUBLIC", "table": "SIGMADATAELEMENT_ENTITY" },
      "ATLASGLOSSARY":      { "database": "FIELD_METADATA", "schema": "PUBLIC", "table": "ATLASGLOSSARY" },
      "ATLASGLOSSARYTERM":  { "database": "FIELD_METADATA", "schema": "PUBLIC", "table": "ATLASGLOSSARYTERM" }
    }
  },
  "queryDefaults": {
    "metadataDb": "FIELD_METADATA",
    "metadataSchema": "PUBLIC",
    "defaultRowLimit": 10000,
    "defaultTimeoutSec": 60
  },
  "features": {
    "lineage": true,
    "glossary": true,
    "queryHistory": false,
    "biUsage": false,
    "dbt": false,
    "governance": true
  },
  "catalog": {
    "tables": [
      { "db": "FIELD_METADATA", "schema": "PUBLIC", "name": "PROCESS_ENTITY" }
    ],
    "columns": []
  }
}
```

### 2.2 Discovery logic (read-only)

After a successful Snowflake connection:

1. Use `INFORMATION_SCHEMA.TABLES` to find candidate metadata tables:
```sql
SELECT table_catalog, table_schema, table_name
FROM information_schema.tables
WHERE table_name LIKE '%_ENTITY'
  AND table_schema NOT IN ('INFORMATION_SCHEMA')
LIMIT 500;
```

2. Match logical metadata entities (case-insensitive)
3. Build feature flags based on what entities exist
4. Build table catalog from `INFORMATION_SCHEMA.TABLES`

### 2.3 Caching & endpoint

- Cache per session: `SYSTEM_CONFIG_CACHE[session_id] = config`
- Expose: `GET /api/system/config`

---

## 3. Frontend: Config Context & Integration

### 3.1 Hook to load config
- `useSystemConfig()` fetches `/api/system/config` when session exists

### 3.2 Context
- `SystemConfigProvider` + `useConfig()` to access config globally

### 3.3 Helper for metadata context
- `useMetadataQueryContext()` returns `{ metadataDb, metadataSchema, config }`

---

## 4. Query Flows: Config-Driven & Global

### 4.1 buildFlowQuery signature
```typescript
buildFlowQuery(flowId, entity, overrides, availableTables, systemConfig)
```

### 4.2 Flow recipes using config
- Resolve DB/schema/table from `config.snowflake.entities`
- Quote identifiers: `"DB"."SCHEMA"."TABLE"`
- Fall back to defaults if config is missing

### 4.3 Feature flags for flow visibility
- Use `config.features` to show/hide flows

---

## 5. Multi-step Query Wizards

### 5.1 Wizard steps for Lineage

1. **Step 1 – Select starting asset**
2. **Step 2 – Choose lineage intent** (direction, max hops, filters)
3. **Step 3 – Helper lineage query** (show candidate assets)
4. **Step 4 – Final query generation**
5. **Step 5 – Execution & actions**

---

## 6. Rules

1. **Read-only**: No DDL/DML to Snowflake
2. **Config-driven**: No hardcoded DB/schema/table combos
3. **Grounded suggestions**: Only suggest what we've seen
4. **Graceful degradation**: Missing config = feature disabled, not crash

---

## 7. Task Checklist

1. Backend: `build_system_config(conn)` + `/api/system/config`
2. Frontend: `useSystemConfig()` + `SystemConfigProvider` + `useConfig()`
3. Query Flows: Update to use `systemConfig`
4. Lineage Wizard: Full 5-step implementation

