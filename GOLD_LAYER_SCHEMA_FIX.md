# Gold Layer Schema Resolution Fix

## Problem

The Gold Layer queries were hardcoded to use `GOLD.ASSETS`, `GOLD.FULL_LINEAGE`, etc., but the error showed:
```
SQL compilation error: Schema 'ATLAN_GOLD.GOLD' does not exist or not authorized.
```

This means the `GOLD` schema doesn't exist in your database - the tables are likely in the `PUBLIC` schema instead.

## Solution

I've implemented **automatic schema resolution** that:

1. **Detects available schemas** - Checks if `GOLD` schema exists
2. **Falls back to current schema** - Uses `PUBLIC` (or your selected schema) if `GOLD` doesn't exist
3. **Resolves table paths** - Converts `GOLD.ASSETS` → `ATLAN_GOLD.PUBLIC.ASSETS` automatically

## How It Works

### 1. Query Template Processing

When you select a Gold Layer query, the `fillTemplate()` function:

```javascript
// Original query:
FROM GOLD.ASSETS

// Step 1: Resolver converts to current schema (if GOLD doesn't exist)
FROM ATLAN_GOLD.PUBLIC.ASSETS

// Step 2: Other placeholders get filled
// Result: Ready-to-run query
```

### 2. Automatic Resolution

The `resolveGoldTablesInSQL()` function:
- Checks if `GOLD` schema exists in discovered tables
- If yes: Uses `GOLD.ASSETS`
- If no: Uses `{{DATABASE}}.{{SCHEMA}}.ASSETS` (defaults to `PUBLIC`)

### 3. Discovery Query

**NEW**: First query in Gold Layer category is a discovery query:

```sql
-- Discover Gold Layer Tables
SELECT table_schema, table_name, row_count
FROM ATLAN_GOLD.information_schema.tables
WHERE table_schema IN ('GOLD', 'PUBLIC')
  AND table_name IN ('ASSETS', 'FULL_LINEAGE', ...)
```

**Run this first** to see what Gold tables are available in your database!

## Files Changed

1. **`src/utils/goldTableResolver.js`** (NEW)
   - Resolves `GOLD.*` table references
   - Handles schema detection and fallback

2. **`src/data/queryTemplates.js`**
   - Updated `fillTemplate()` to resolve Gold tables automatically
   - Runs resolver BEFORE placeholder replacement

3. **`src/data/goldLayerQueries.js`**
   - Added discovery query at the top
   - All queries keep `GOLD.*` references (resolver handles them)

## Usage

### Option 1: Run Discovery Query First
1. Select "Gold Layer" category
2. Run "🔍 Discover Gold Layer Tables" (first query)
3. See which tables exist in your database
4. Run other Gold queries - they'll automatically use the correct schema

### Option 2: Just Run Gold Queries
The resolver will automatically:
- Try `GOLD` schema first
- Fall back to `PUBLIC` schema if `GOLD` doesn't exist
- Use discovered table names if available

## What If Tables Don't Exist?

If Gold Layer tables don't exist in your database:

1. **Check the discovery query** - See what's actually available
2. **Use raw entity queries** - The regular MDLH queries use `TABLE_ENTITY`, `COLUMN_ENTITY`, etc.
3. **Contact your admin** - Gold Layer views may need to be created in your MDLH instance

## Example Resolution

### Before (Error):
```sql
FROM GOLD.ASSETS
-- Error: Schema 'ATLAN_GOLD.GOLD' does not exist
```

### After (Auto-Resolved):
```sql
FROM ATLAN_GOLD.PUBLIC.ASSETS
-- ✅ Works if ASSETS table exists in PUBLIC schema
```

## Testing

To test the fix:

1. **Run Discovery Query**:
   ```sql
   SELECT table_schema, table_name
   FROM ATLAN_GOLD.information_schema.tables
   WHERE table_schema IN ('GOLD', 'PUBLIC')
     AND table_name LIKE '%ASSET%'
   ```

2. **Run a Gold Query**:
   - Select "General Asset Slice" from Gold Layer
   - Check the resolved SQL (should show `ATLAN_GOLD.PUBLIC.ASSETS`)

3. **Verify**:
   - If `GOLD` schema exists → Uses `GOLD.ASSETS`
   - If not → Uses `PUBLIC.ASSETS` (or your current schema)

## Next Steps

If Gold tables don't exist, you may need to:
- Check with your MDLH administrator about Gold Layer views
- Use the raw entity queries instead (`TABLE_ENTITY`, etc.)
- Create Gold Layer views if you have permissions

The app will now gracefully handle both cases! 🎉
