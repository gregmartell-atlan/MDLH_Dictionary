export function getCapabilitiesTableColumns(capabilities, tableFqnOrName) {
  if (!capabilities?.columns || !tableFqnOrName) return [];
  const rawTable = tableFqnOrName
    .split('.')
    .map((part) => part.replace(/^"|"$/g, ''))
    .filter(Boolean);
  const tableName = rawTable[rawTable.length - 1];
  if (!tableName) return [];
  const upperTable = tableName.toUpperCase();
  const matchKey = Object.keys(capabilities.columns).find(
    (key) => key.toUpperCase() === upperTable
  );
  const columns = matchKey ? capabilities.columns[matchKey] : [];
  return (Array.isArray(columns) ? columns : [])
    .map((col) => col?.name)
    .filter(Boolean);
}
