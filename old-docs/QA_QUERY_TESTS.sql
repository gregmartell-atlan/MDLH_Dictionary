-- ============================================================================
-- MDLH Query Dictionary - QA Test Suite
-- ============================================================================
-- Run these tests sequentially to validate all query patterns work
-- Each section tests a specific pattern used in the application
-- ============================================================================

-- ============================================================================
-- SECTION 0: Schema Discovery (Run First!)
-- ============================================================================

-- 0.1 List all entity tables and their row counts
SELECT 
    TABLE_NAME,
    ROW_COUNT,
    BYTES
FROM FIELD_METADATA.INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = 'PUBLIC'
  AND TABLE_NAME LIKE '%_ENTITY'
ORDER BY ROW_COUNT DESC NULLS LAST
LIMIT 50;

-- 0.2 Check column types for key tables
DESCRIBE TABLE FIELD_METADATA.PUBLIC.TABLE_ENTITY;
DESCRIBE TABLE FIELD_METADATA.PUBLIC.PROCESS_ENTITY;
DESCRIBE TABLE FIELD_METADATA.PUBLIC.ATLASGLOSSARYTERM_ENTITY;

-- 0.3 Sample VARIANT column structures
SELECT 
    "NAME",
    "GUID",
    TYPEOF("INPUTS") AS inputs_type,
    "INPUTS"
FROM FIELD_METADATA.PUBLIC.PROCESS_ENTITY
WHERE "INPUTS" IS NOT NULL
LIMIT 3;

-- ============================================================================
-- SECTION 1: ARRAY_TO_STRING Pattern Tests
-- ============================================================================
-- These test the ARRAY_TO_STRING(column, '||') ILIKE pattern

-- 1.1 Test ARRAY_TO_STRING on INPUTS column
-- Expected: Works if INPUTS is ARRAY type
SELECT 
    "GUID",
    "NAME",
    ARRAY_TO_STRING("INPUTS", ', ') AS inputs_str
FROM FIELD_METADATA.PUBLIC.PROCESS_ENTITY
WHERE "INPUTS" IS NOT NULL
LIMIT 5;

-- 1.2 Test ARRAY_TO_STRING for searching (fuzzy match)
SELECT 
    "GUID",
    "NAME"
FROM FIELD_METADATA.PUBLIC.PROCESS_ENTITY
WHERE ARRAY_TO_STRING("INPUTS", '||') ILIKE '%test%'
LIMIT 5;

-- 1.3 Test ARRAY_TO_STRING on ANCHOR column (Glossary)
SELECT 
    t."GUID",
    t."NAME",
    ARRAY_TO_STRING(t."ANCHOR", '||') AS anchor_str
FROM FIELD_METADATA.PUBLIC.ATLASGLOSSARYTERM_ENTITY t
WHERE t."ANCHOR" IS NOT NULL
LIMIT 5;

-- ============================================================================
-- SECTION 2: Alternative Pattern - TRY_CAST to VARCHAR
-- ============================================================================
-- If ARRAY_TO_STRING fails, try direct VARCHAR cast

-- 2.1 Test TRY_CAST pattern
SELECT 
    "GUID",
    "NAME",
    TRY_CAST("INPUTS" AS VARCHAR) AS inputs_str
FROM FIELD_METADATA.PUBLIC.PROCESS_ENTITY
WHERE "INPUTS" IS NOT NULL
LIMIT 5;

-- 2.2 Test TRY_CAST for searching
SELECT 
    "GUID",
    "NAME"
FROM FIELD_METADATA.PUBLIC.PROCESS_ENTITY
WHERE TRY_CAST("INPUTS" AS VARCHAR) ILIKE '%test%'
LIMIT 5;

-- ============================================================================
-- SECTION 3: TO_JSON Pattern (Most Compatible)
-- ============================================================================
-- TO_JSON works on any VARIANT and returns a string

-- 3.1 Test TO_JSON pattern
SELECT 
    "GUID",
    "NAME",
    TO_JSON("INPUTS") AS inputs_json
FROM FIELD_METADATA.PUBLIC.PROCESS_ENTITY
WHERE "INPUTS" IS NOT NULL
LIMIT 5;

-- 3.2 Test TO_JSON for searching
SELECT 
    "GUID",
    "NAME"
FROM FIELD_METADATA.PUBLIC.PROCESS_ENTITY
WHERE TO_JSON("INPUTS") ILIKE '%test%'
LIMIT 5;

-- ============================================================================
-- SECTION 4: FLATTEN Pattern (For Complex Structures)
-- ============================================================================
-- Use FLATTEN to extract values from array elements

-- 4.1 Test FLATTEN on INPUTS
SELECT 
    p."GUID" AS process_guid,
    p."NAME" AS process_name,
    f.value:"guid"::VARCHAR AS input_guid,
    f.value:"typeName"::VARCHAR AS input_type
FROM FIELD_METADATA.PUBLIC.PROCESS_ENTITY p,
LATERAL FLATTEN(INPUT => p."INPUTS", OUTER => TRUE) f
WHERE p."INPUTS" IS NOT NULL
LIMIT 10;

-- 4.2 Test FLATTEN for GUID searching
SELECT DISTINCT
    p."GUID" AS process_guid,
    p."NAME" AS process_name
FROM FIELD_METADATA.PUBLIC.PROCESS_ENTITY p,
LATERAL FLATTEN(INPUT => p."INPUTS", OUTER => TRUE) f
WHERE f.value:"guid"::VARCHAR ILIKE '%test%'
LIMIT 10;

-- ============================================================================
-- SECTION 5: JOIN Pattern Tests
-- ============================================================================

-- 5.1 Test glossary term to glossary join (ANCHOR column)
SELECT 
    t."NAME" AS term_name,
    g."NAME" AS glossary_name
FROM FIELD_METADATA.PUBLIC.ATLASGLOSSARYTERM_ENTITY t
LEFT JOIN FIELD_METADATA.PUBLIC.ATLASGLOSSARY_ENTITY g 
    ON TO_JSON(t."ANCHOR") ILIKE '%' || g."GUID" || '%'
WHERE t."NAME" IS NOT NULL
LIMIT 10;

-- 5.2 Alternative join using FLATTEN
SELECT 
    t."NAME" AS term_name,
    g."NAME" AS glossary_name
FROM FIELD_METADATA.PUBLIC.ATLASGLOSSARYTERM_ENTITY t
LEFT JOIN LATERAL FLATTEN(INPUT => t."ANCHOR", OUTER => TRUE) a
LEFT JOIN FIELD_METADATA.PUBLIC.ATLASGLOSSARY_ENTITY g 
    ON a.value:"guid"::VARCHAR = g."GUID"
WHERE t."NAME" IS NOT NULL
LIMIT 10;

-- ============================================================================
-- SECTION 6: Lineage Query Tests
-- ============================================================================

-- 6.1 Get a sample GUID for testing
SELECT 
    "GUID",
    "NAME",
    ARRAY_SIZE("INPUTS") AS input_count,
    ARRAY_SIZE("OUTPUTS") AS output_count
FROM FIELD_METADATA.PUBLIC.PROCESS_ENTITY
WHERE ARRAY_SIZE("INPUTS") > 0 OR ARRAY_SIZE("OUTPUTS") > 0
LIMIT 5;

-- 6.2 Test downstream lineage (using TO_JSON pattern)
-- Replace <GUID> with an actual GUID from query 6.1
SELECT 
    "GUID" AS process_guid,
    "NAME" AS process_name,
    "TYPENAME" AS process_type
FROM FIELD_METADATA.PUBLIC.PROCESS_ENTITY
WHERE TO_JSON("INPUTS") ILIKE '%<GUID>%'
LIMIT 20;

-- 6.3 Test upstream lineage
SELECT 
    "GUID" AS process_guid,
    "NAME" AS process_name,
    "TYPENAME" AS process_type
FROM FIELD_METADATA.PUBLIC.PROCESS_ENTITY
WHERE TO_JSON("OUTPUTS") ILIKE '%<GUID>%'
LIMIT 20;

-- ============================================================================
-- SECTION 7: Determine Best Pattern for Your Environment
-- ============================================================================
-- Run each pattern and note which ones work. Use the first one that works.

-- Pattern A: ARRAY_TO_STRING (Best if columns are true ARRAY type)
SELECT COUNT(*) FROM FIELD_METADATA.PUBLIC.PROCESS_ENTITY 
WHERE ARRAY_TO_STRING("INPUTS", '||') IS NOT NULL;

-- Pattern B: TO_JSON (Best for VARIANT columns)
SELECT COUNT(*) FROM FIELD_METADATA.PUBLIC.PROCESS_ENTITY 
WHERE TO_JSON("INPUTS") IS NOT NULL;

-- Pattern C: ::VARCHAR cast (May fail on complex structures)
SELECT COUNT(*) FROM FIELD_METADATA.PUBLIC.PROCESS_ENTITY 
WHERE TRY_CAST("INPUTS" AS VARCHAR) IS NOT NULL;

-- Pattern D: FLATTEN (Best for extracting specific fields)
SELECT COUNT(*) FROM (
    SELECT p."GUID"
    FROM FIELD_METADATA.PUBLIC.PROCESS_ENTITY p,
    LATERAL FLATTEN(INPUT => p."INPUTS", OUTER => TRUE) f
    WHERE f.value IS NOT NULL
) sub;

-- ============================================================================
-- SECTION 8: Common Query Templates - Validated
-- ============================================================================

-- 8.1 Asset Discovery - Verified Tables
SELECT 
    "GUID",
    "NAME",
    "TYPENAME",
    "DATABASENAME",
    "SCHEMANAME",
    "CERTIFICATESTATUS",
    "STATUS"
FROM FIELD_METADATA.PUBLIC.TABLE_ENTITY
WHERE "CERTIFICATESTATUS" = 'VERIFIED'
  AND "STATUS" = 'ACTIVE'
ORDER BY "DATABASENAME", "SCHEMANAME", "NAME"
LIMIT 50;

-- 8.2 Asset Counts by Connector
SELECT 
    "CONNECTORNAME",
    "DATABASENAME",
    COUNT(*) AS asset_count
FROM FIELD_METADATA.PUBLIC.TABLE_ENTITY
WHERE "CONNECTORNAME" IS NOT NULL
GROUP BY "CONNECTORNAME", "DATABASENAME"
ORDER BY asset_count DESC
LIMIT 50;

-- 8.3 Find Assets Missing Descriptions
SELECT 
    "GUID",
    "NAME",
    "TYPENAME",
    "DATABASENAME",
    "SCHEMANAME"
FROM FIELD_METADATA.PUBLIC.TABLE_ENTITY
WHERE ("DESCRIPTION" IS NULL OR "DESCRIPTION" = '')
  AND ("USERDESCRIPTION" IS NULL OR "USERDESCRIPTION" = '')
ORDER BY "DATABASENAME", "SCHEMANAME", "NAME"
LIMIT 50;

-- 8.4 Glossary Terms with Definitions
SELECT 
    t."GUID",
    t."NAME" AS term_name,
    t."SHORTDESCRIPTION",
    t."LONGDESCRIPTION",
    g."NAME" AS glossary_name
FROM FIELD_METADATA.PUBLIC.ATLASGLOSSARYTERM_ENTITY t
LEFT JOIN FIELD_METADATA.PUBLIC.ATLASGLOSSARY_ENTITY g 
    ON TO_JSON(t."ANCHOR") ILIKE '%' || g."GUID" || '%'
WHERE t."NAME" IS NOT NULL
  AND (t."SHORTDESCRIPTION" IS NOT NULL OR t."LONGDESCRIPTION" IS NOT NULL)
ORDER BY glossary_name, term_name
LIMIT 50;

-- 8.5 Data Domain Products
SELECT 
    dp."GUID",
    dp."NAME" AS product_name,
    dp."USERDESCRIPTION",
    dp."STATUS",
    dp."CERTIFICATESTATUS",
    dd."NAME" AS domain_name
FROM FIELD_METADATA.PUBLIC.DATAPRODUCT_ENTITY dp
LEFT JOIN FIELD_METADATA.PUBLIC.DATADOMAIN_ENTITY dd 
    ON TO_JSON(dp."DOMAINGUIDS") ILIKE '%' || dd."GUID" || '%'
ORDER BY domain_name, product_name
LIMIT 50;

-- ============================================================================
-- SECTION 9: QA RESULTS TEMPLATE
-- ============================================================================
/*
After running these tests, document results:

| Section | Pattern | Status | Notes |
|---------|---------|--------|-------|
| 1.1 | ARRAY_TO_STRING display | [ ] PASS / [ ] FAIL | |
| 1.2 | ARRAY_TO_STRING search | [ ] PASS / [ ] FAIL | |
| 1.3 | ARRAY_TO_STRING ANCHOR | [ ] PASS / [ ] FAIL | |
| 2.1 | TRY_CAST display | [ ] PASS / [ ] FAIL | |
| 2.2 | TRY_CAST search | [ ] PASS / [ ] FAIL | |
| 3.1 | TO_JSON display | [ ] PASS / [ ] FAIL | |
| 3.2 | TO_JSON search | [ ] PASS / [ ] FAIL | |
| 4.1 | FLATTEN extract | [ ] PASS / [ ] FAIL | |
| 4.2 | FLATTEN search | [ ] PASS / [ ] FAIL | |
| 5.1 | JOIN with TO_JSON | [ ] PASS / [ ] FAIL | |
| 5.2 | JOIN with FLATTEN | [ ] PASS / [ ] FAIL | |

RECOMMENDED PATTERN: ________________

Notes:
- 
- 
*/

-- ============================================================================
-- END OF QA TEST SUITE
-- ============================================================================


