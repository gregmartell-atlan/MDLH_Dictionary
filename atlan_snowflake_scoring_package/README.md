# Atlan Gold + Snowflake Evidence → Dynamic Scoring Framework (Snowflake-native)

This package implements a Snowflake-native metadata scoring framework:
- **INTENT** schema: scoring templates, parameters, bindings
- **EVIDENCE** schema: asset universe + evidence observations (+ latest evidence view)
- **SCORE** schema: run tracking + parameter-level and aggregate results
- Adapters:
  - `atlan_gold.public.*` → evidence keys
  - `SNOWFLAKE.ACCOUNT_USAGE.*` → PK/FK + masking evidence keys

## Execution order (Snowflake Worksheets)
Run the SQL files in this order:

1. `sql/00_bootstrap.sql`
2. `sql/01_intent_schema.sql`
3. `sql/02_evidence_schema.sql`
4. `sql/03_score_schema.sql`
5. `sql/04_scoring_procedure.sql`
6. `sql/05_template_seed_pack.sql`
7. `sql/06_atlan_gold_adapter.sql`
8. `sql/07_snowflake_account_usage_adapter.sql`
9. `sql/08_gap_playbook.sql`
10. `sql/09_runbook_examples.sql`

## Typical run
```sql
CALL EVIDENCE.REFRESH_FROM_ATLAN_GOLD('snowflake');
CALL EVIDENCE.REFRESH_FROM_SNOWFLAKE_ACCOUNT_USAGE();
CALL SCORE.RUN_ALL_ACTIVE_TEMPLATES('daily_atlan_gold_plus_snowflake');
```

## Validation snippets
### Evidence counts by key
```sql
SELECT evidence_key, source, COUNT(*) AS rows
FROM EVIDENCE.EVIDENCE_OBSERVATION
GROUP BY 1,2
ORDER BY 1,2;
```

### Joinability should use Snowflake keys (priority=1)
```sql
SELECT
  apr.asset_key,
  apr.parameter_key,
  apr.evidence_key_used,
  apr.state,
  apr.score
FROM SCORE.ASSESSMENT_PARAMETER_RESULT apr
WHERE apr.template_id = 'TPL_JOINABILITY'
ORDER BY apr.created_ts DESC
LIMIT 200;
```

## Notes
- `SNOWFLAKE.ACCOUNT_USAGE` views require grants and may lag; acceptable for maturity scoring.
- Atlan qualified names are parsed assuming:
  - Table: `.../<DB>/<SCHEMA>/<TABLE>`
  - Column: `.../<DB>/<SCHEMA>/<TABLE>/<COLUMN>`
