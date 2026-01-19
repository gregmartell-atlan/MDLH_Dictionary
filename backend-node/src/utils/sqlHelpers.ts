/**
 * SQL Helpers
 * Safe query building utilities for Snowflake
 */

/**
 * Build a fully-qualified name (DATABASE.SCHEMA.TABLE)
 * Escapes identifiers to prevent SQL injection
 */
export function buildSafeFQN(database: string, schema: string, table: string): string {
  return `${escapeIdentifier(database)}.${escapeIdentifier(schema)}.${escapeIdentifier(table)}`;
}

/**
 * Escape a SQL identifier (table name, column name, etc.)
 * Wraps in double quotes and escapes any embedded quotes
 */
export function escapeIdentifier(identifier: string): string {
  if (!identifier) {
    throw new Error('Identifier cannot be empty');
  }
  
  // Remove any existing quotes and escape embedded ones
  const cleaned = identifier.replace(/"/g, '""');
  return `"${cleaned}"`;
}

/**
 * Escape a string value for use in WHERE clauses
 * Returns the escaped value including surrounding quotes
 */
export function escapeStringValue(value: string): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  
  // Escape single quotes by doubling them
  const escaped = String(value).replace(/'/g, "''");
  return `'${escaped}'`;
}

/**
 * Build a safe LIMIT clause
 */
export function buildLimit(limit?: number, maxLimit = 50000): number {
  if (!limit || limit <= 0) return maxLimit;
  return Math.min(limit, maxLimit);
}

/**
 * Build a safe IN clause from an array of values
 */
export function buildInClause(values: string[]): string {
  if (!values || values.length === 0) {
    return "('')"; // Return empty match
  }
  
  const escaped = values.map(v => escapeStringValue(v));
  return `(${escaped.join(', ')})`;
}
