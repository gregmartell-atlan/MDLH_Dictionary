# Pivot Validation Harness

This script validates prebuilt pivots against a live Snowflake session and generates a report with
missing column diagnostics and execution results.

## Usage

```bash
MDLH_SESSION_ID=... \
MDLH_API_URL=http://localhost:8000 \
MDLH_DATABASE=FIELD_METADATA \
MDLH_SCHEMA=PUBLIC \
MDLH_TABLE=TABLE_ENTITY \
npm run pivot:validate
```

## Arguments

- `--api-url` default: `http://localhost:8000`
- `--session-id` (required if `MDLH_SESSION_ID` not set)
- `--database` / `--schema` (used if `--table` is not fully-qualified)
- `--table` default: `TABLE_ENTITY`

## Output

Writes `reports/pivot_validation.json` with:
- required vs missing columns per pivot
- alternate column suggestions
- execution results and row counts

## Notes

- Uses the active Snowflake session via backend `/api/query/*` endpoints.
- Only read-only queries are executed.
