/**
 * Filter entity data based on search term
 * @param {Array} data - Array of entity objects
 * @param {string} searchTerm - Search term to filter by
 * @returns {Array} Filtered array of entities
 */
export function filterEntities(data, searchTerm) {
  if (!data || !Array.isArray(data)) return [];
  if (!searchTerm || searchTerm.trim() === '') return data;

  const searchLower = searchTerm.toLowerCase();

  return data.filter((row) =>
    Object.values(row).some((val) =>
      val?.toString().toLowerCase().includes(searchLower)
    )
  );
}

/**
 * Filter queries based on search term
 * @param {Array} queries - Array of query objects with title, description, query
 * @param {string} searchTerm - Search term to filter by
 * @returns {Array} Filtered array of queries
 */
export function filterQueries(queries, searchTerm) {
  if (!queries || !Array.isArray(queries)) return [];
  if (!searchTerm || searchTerm.trim() === '') return queries;

  const searchLower = searchTerm.toLowerCase();

  return queries.filter(
    (q) =>
      q.title.toLowerCase().includes(searchLower) ||
      q.description.toLowerCase().includes(searchLower) ||
      q.query.toLowerCase().includes(searchLower)
  );
}
