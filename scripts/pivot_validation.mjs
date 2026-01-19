#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import process from 'process';
import { PREBUILT_PIVOTS, PIVOT_DIMENSIONS, PIVOT_MEASURES, generatePivotSQL } from '../src/data/prebuiltPivotRegistry.js';

const DEFAULT_TABLE = 'TABLE_ENTITY';
const DEFAULT_LIMIT = 1000;

const SQL_KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'AS',
  'ON', 'JOIN', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'INNER', 'CROSS', 'GROUP',
  'BY', 'ORDER', 'LIMIT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'DISTINCT',
  'TRUE', 'FALSE', 'ASC', 'DESC', 'ILIKE', 'LIKE', 'BETWEEN'
]);

const SQL_FUNCTIONS = new Set([
  'COUNT', 'COUNT_IF', 'ROUND', 'COALESCE', 'NULLIF', 'ARRAY_SIZE',
  'SPLIT_PART', 'DATEDIFF', 'DATEADD', 'TO_TIMESTAMP', 'CURRENT_TIMESTAMP'
]);

const SQL_TYPES = new Set([
  'STRING', 'TEXT', 'NUMBER', 'FLOAT', 'BOOLEAN', 'DATE', 'TIMESTAMP',
  'TIMESTAMP_NTZ', 'TIMESTAMP_LTZ', 'TIMESTAMP_TZ'
]);

const SQL_DATE_PARTS = new Set([
  'DAY', 'HOUR', 'MINUTE', 'SECOND', 'WEEK', 'MONTH', 'YEAR'
]);

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const [key, value] = arg.split('=');
    if (value !== undefined) {
      args[key.slice(2)] = value;
    } else {
      args[key.slice(2)] = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function normalizeIdentifier(value) {
  return value.replace(/^"|"$/g, '').toUpperCase();
}

function extractColumnsFromSql(sql) {
  const scrubbed = sql
    .replace(/'[^']*'/g, ' ')
    .replace(/"[^"]*"/g, (match) => ` ${match} `)
    .replace(/\{\{TABLE\}\}/g, ' ');

  const columns = new Set();
  const quoted = scrubbed.match(/"[^"]+"/g) || [];
  quoted.forEach((token) => {
    const normalized = normalizeIdentifier(token);
    if (!SQL_KEYWORDS.has(normalized) && !SQL_FUNCTIONS.has(normalized) && !SQL_TYPES.has(normalized) && !SQL_DATE_PARTS.has(normalized)) {
      columns.add(normalized);
    }
  });

  const tokens = scrubbed.match(/\b[A-Z_][A-Z0-9_]*\b/g) || [];
  tokens.forEach((token) => {
    const normalized = normalizeIdentifier(token);
    if (SQL_KEYWORDS.has(normalized)) return;
    if (SQL_FUNCTIONS.has(normalized)) return;
    if (SQL_TYPES.has(normalized)) return;
    if (SQL_DATE_PARTS.has(normalized)) return;
    columns.add(normalized);
  });

  return columns;
}

function requiredColumnsForPivot(pivot) {
  const required = new Set();
  const suggestions = [];

  pivot.rowDimensions.forEach((dimensionId) => {
    const dim = PIVOT_DIMENSIONS[dimensionId];
    if (!dim) return;
    if (dim.mdlhColumn) required.add(dim.mdlhColumn.toUpperCase());
    if (dim.extractFn) {
      extractColumnsFromSql(dim.extractFn).forEach((col) => required.add(col));
    }
  });

  pivot.measures.forEach((measureId) => {
    const measure = PIVOT_MEASURES[measureId];
    if (!measure) return;
    if (measure.sql) {
      extractColumnsFromSql(measure.sql).forEach((col) => required.add(col));
    }
  });

  if (pivot.sqlTemplate) {
    extractColumnsFromSql(pivot.sqlTemplate).forEach((col) => required.add(col));
  }

  pivot.rowDimensions.forEach((dimensionId) => {
    const dim = PIVOT_DIMENSIONS[dimensionId];
    if (!dim?.alternates?.length) return;
    suggestions.push({ target: dim.mdlhColumn, alternates: dim.alternates });
  });

  return { required, suggestions };
}

async function apiFetch(url, sessionId, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      'X-Session-ID': sessionId
    }
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`${response.status} ${response.statusText}: ${text}`);
  }
  return response.json();
}

async function executeQuery(apiUrl, sessionId, sql, database, schema) {
  const submit = await apiFetch(`${apiUrl}/api/query/execute`, sessionId, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, database, schema_name: schema, timeout: 60, limit: DEFAULT_LIMIT })
  });

  if (submit.status !== 'SUCCESS') {
    return { status: submit.status, error: submit.message || 'Query failed' };
  }

  const results = await apiFetch(`${apiUrl}/api/query/${submit.query_id}/results`, sessionId);
  return {
    status: submit.status,
    query_id: submit.query_id,
    row_count: results.total_rows ?? results.rows?.length ?? 0,
    columns: results.columns || [],
    rows_sample: (results.rows || []).slice(0, 5),
    execution_time_ms: submit.execution_time_ms
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const apiUrl = args['api-url'] || process.env.MDLH_API_URL || 'http://localhost:8000';
  const sessionId = args['session-id'] || process.env.MDLH_SESSION_ID;
  const database = args.database || process.env.MDLH_DATABASE || 'FIELD_METADATA';
  const schema = args.schema || process.env.MDLH_SCHEMA || 'PUBLIC';
  const tableArg = args.table || process.env.MDLH_TABLE || DEFAULT_TABLE;

  if (!sessionId) {
    console.error('Missing session id. Set --session-id or MDLH_SESSION_ID.');
    process.exit(1);
  }

  const tableFqn = tableArg.includes('.')
    ? tableArg
    : `${database}.${schema}.${tableArg}`;

  const [tableDb, tableSchema, tableName] = tableFqn.split('.');

  const columns = await apiFetch(
    `${apiUrl}/api/metadata/columns?database=${encodeURIComponent(tableDb)}&schema=${encodeURIComponent(tableSchema)}&table=${encodeURIComponent(tableName)}`,
    sessionId
  );
  const availableColumns = new Set(
    (Array.isArray(columns) ? columns : [])
      .map((c) => c.name?.toUpperCase())
      .filter(Boolean)
  );

  const results = [];
  const recommendations = [];

  for (const pivot of PREBUILT_PIVOTS) {
    const { required, suggestions } = requiredColumnsForPivot(pivot);
    const missing = [...required].filter((col) => !availableColumns.has(col));
    const availableAlternates = [];

    for (const hint of suggestions) {
      if (!hint.target) continue;
      if (!missing.includes(hint.target.toUpperCase())) continue;
      const alternate = hint.alternates.find((alt) => availableColumns.has(alt.toUpperCase()));
      if (alternate) {
        availableAlternates.push({ column: hint.target, alternate });
      }
    }

    const resolved = generatePivotSQL(
      pivot.id,
      tableFqn,
      { database: tableDb, schema: tableSchema },
      { availableColumns: Array.from(availableColumns) }
    );
    const sql = resolved.sql || null;
    const resolvedMissing = resolved.missingColumns ?? missing;
    let execution = null;

    if (sql && resolvedMissing.length === 0) {
      const sqlNoSemicolon = sql.trim().replace(/;+\s*$/, '');
      const sqlToRun = /\bLIMIT\b/i.test(sqlNoSemicolon)
        ? sqlNoSemicolon
        : `${sqlNoSemicolon}\nLIMIT ${DEFAULT_LIMIT}`;
      execution = await executeQuery(apiUrl, sessionId, sqlToRun, tableDb, tableSchema);
    }

    results.push({
      pivot_id: pivot.id,
      name: pivot.name,
      category: pivot.category,
      table: tableFqn,
      required_columns: [...required].sort(),
      missing_columns: resolvedMissing,
      alternate_suggestions: availableAlternates,
      execution
    });

    const missingForRecommendation = resolvedMissing;
    if (missingForRecommendation.length > 0) {
      recommendations.push({
        pivot_id: pivot.id,
        missing_columns: missingForRecommendation,
        alternates: availableAlternates
      });
    }
  }

  const report = {
    generated_at: new Date().toISOString(),
    table: tableFqn,
    pivots_tested: PREBUILT_PIVOTS.length,
    results,
    recommendations
  };

  const outputDir = path.join(process.cwd(), 'reports');
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, 'pivot_validation.json');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`Pivot validation report written to ${outputPath}`);
}

main().catch((err) => {
  console.error(`Pivot validation failed: ${err.message}`);
  process.exit(1);
});
