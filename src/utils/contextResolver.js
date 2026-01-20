import { buildSafeFQN } from './queryHelpers.js';
import { getCapabilitiesTableColumns } from './capabilityHelpers.js';

export function resolveProfile(capabilities) {
  if (!capabilities?.profile) return 'UNKNOWN';
  return capabilities.profile;
}

export function resolvePreferredTableName(capabilities, fallback = 'ASSETS') {
  if (!capabilities?.tables?.length) return fallback;
  const tables = capabilities.tables.map((t) => t.toUpperCase());
  if (resolveProfile(capabilities) === 'ATLAN_GOLD' && tables.includes('ASSETS')) {
    return 'ASSETS';
  }
  if (resolveProfile(capabilities) === 'FIELD_METADATA' && tables.includes('TABLE_ENTITY')) {
    return 'TABLE_ENTITY';
  }
  return capabilities.tables[0] || fallback;
}

export function resolveTableFqn(capabilities, context = {}, fallbackTable = 'ASSETS') {
  const tableName = resolvePreferredTableName(capabilities, fallbackTable);
  if (!context?.database || !context?.schema) return null;
  return buildSafeFQN(context.database, context.schema, tableName);
}

export function resolveAvailableColumns(capabilities, tableFqnOrName, fallbackColumns = []) {
  const capColumns = getCapabilitiesTableColumns(capabilities, tableFqnOrName);
  if (capColumns.length > 0) return capColumns;
  return fallbackColumns || [];
}
