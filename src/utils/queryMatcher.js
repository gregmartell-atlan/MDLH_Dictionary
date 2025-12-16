/**
 * Find a query related to an entity by searching for table name in query SQL
 * @param {string} entityName - The name of the entity
 * @param {string} tableName - The database table name
 * @param {Array} queries - Array of query objects with title, description, query properties
 * @returns {Object|null} Matching query object or null
 */
export function findQueryForEntity(entityName, tableName, queries) {
  if (!queries || queries.length === 0) return null;
  if (!tableName || tableName === '(abstract)') return null;

  const tableNameLower = tableName.toLowerCase();
  const entityNameLower = entityName.toLowerCase();

  // Priority 1: Exact table name match in query SQL (e.g., "FROM TABLE_ENTITY" or "TABLE_ENTITY")
  let matchedQuery = queries.find((q) => {
    const queryLower = q.query.toLowerCase();
    return (
      queryLower.includes(`from ${tableNameLower}`) ||
      queryLower.includes(`from\n    ${tableNameLower}`) ||
      queryLower.includes(`from\n${tableNameLower}`) ||
      queryLower.includes(`join ${tableNameLower}`) ||
      // Also check for the table name as a standalone reference
      new RegExp(`\\b${tableNameLower.replace(/_/g, '_')}\\b`).test(queryLower)
    );
  });

  // Priority 2: Entity name explicitly in title (e.g., "Table" in title for TABLE_ENTITY)
  if (!matchedQuery) {
    matchedQuery = queries.find((q) => {
      const titleLower = q.title.toLowerCase();
      // Match singular entity name (e.g., "Column" for Column entity, "Table" for Table)
      return (
        titleLower.includes(entityNameLower) ||
        titleLower.includes(entityNameLower + 's') || // plural
        titleLower.includes(entityNameLower + ' ')
      );
    });
  }

  return matchedQuery || null;
}

/**
 * Check if an entity has a related query
 * @param {string} entityName - The name of the entity
 * @param {string} tableName - The database table name
 * @param {string|undefined} exampleQuery - Inline example query from entity data
 * @param {Array} queries - Array of query objects
 * @returns {boolean} True if entity has a related query
 */
export function hasQueryForEntity(entityName, tableName, exampleQuery, queries) {
  if (exampleQuery) return true;
  if (!tableName || tableName === '(abstract)') return false;
  return findQueryForEntity(entityName, tableName, queries) !== null;
}
