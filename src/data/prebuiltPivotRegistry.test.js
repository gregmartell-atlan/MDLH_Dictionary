import { describe, it, expect } from 'vitest';
import { buildCustomPivotSQL, generatePivotSQL } from './prebuiltPivotRegistry';

describe('prebuiltPivotRegistry column resolution', () => {
  it('replaces alternate column names in SQL templates', () => {
    const result = generatePivotSQL(
      'owner_accountability_certification',
      'ATLAN_GOLD.PUBLIC.ASSETS',
      {},
      {
        availableColumns: [
          'OWNER_GROUPS',
          'OWNER_USERS',
          'CERTIFICATE_STATUS',
          'STATUS'
        ]
      }
    );

    expect(result.sql).toContain('OWNER_GROUPS');
    expect(result.sql).toContain('OWNER_USERS');
    expect(result.sql).toContain('CERTIFICATE_STATUS');
    expect(result.missingColumns).toEqual([]);
  });

  it('resolves alternates in custom pivot generation', () => {
    const result = buildCustomPivotSQL(
      ['ownerGroup'],
      ['ownerCoverage'],
      'ATLAN_GOLD.PUBLIC.ASSETS',
      "STATUS = 'ACTIVE'",
      {
        availableColumns: [
          'OWNER_GROUPS',
          'OWNER_USERS',
          'STATUS'
        ]
      }
    );

    expect(result.sql).toContain('OWNER_GROUPS');
    expect(result.sql).toContain('OWNER_USERS');
    expect(result.missingColumns).toEqual([]);
  });
});
