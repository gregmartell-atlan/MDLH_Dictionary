import { describe, it, expect } from 'vitest';
import { findQueryForEntity, hasQueryForEntity } from './queryMatcher';

const mockQueries = [
  {
    title: 'Basic Table Exploration',
    description: 'View table metadata with row counts',
    query: `SELECT NAME, ROWCOUNT FROM TABLE_ENTITY WHERE SIZEBYTES IS NOT NULL`,
  },
  {
    title: 'List All Columns',
    description: 'Get column details for tables',
    query: `SELECT NAME, DATATYPE FROM COLUMN_ENTITY ORDER BY NAME`,
  },
  {
    title: 'Join Tables and Views',
    description: 'Complex query with joins',
    query: `SELECT t.NAME, v.NAME
FROM TABLE_ENTITY t
JOIN VIEW_ENTITY v ON t.guid = v.tableGuid`,
  },
  {
    title: 'Glossary Terms Overview',
    description: 'View glossary terms',
    query: `SELECT NAME, USERDESCRIPTION FROM ATLASGLOSSARYTERM_ENTITY`,
  },
];

describe('findQueryForEntity', () => {
  describe('returns null for invalid inputs', () => {
    it('returns null when queries array is empty', () => {
      expect(findQueryForEntity('Table', 'TABLE_ENTITY', [])).toBeNull();
    });

    it('returns null when queries is null', () => {
      expect(findQueryForEntity('Table', 'TABLE_ENTITY', null)).toBeNull();
    });

    it('returns null when tableName is null', () => {
      expect(findQueryForEntity('Table', null, mockQueries)).toBeNull();
    });

    it('returns null when tableName is (abstract)', () => {
      expect(findQueryForEntity('Asset', '(abstract)', mockQueries)).toBeNull();
    });

    it('returns null when tableName is empty string', () => {
      expect(findQueryForEntity('Table', '', mockQueries)).toBeNull();
    });
  });

  describe('matches by table name in query SQL', () => {
    it('matches table name in FROM clause', () => {
      const result = findQueryForEntity('Table', 'TABLE_ENTITY', mockQueries);
      expect(result).not.toBeNull();
      expect(result.title).toBe('Basic Table Exploration');
    });

    it('matches table name in JOIN clause', () => {
      const result = findQueryForEntity('View', 'VIEW_ENTITY', mockQueries);
      expect(result).not.toBeNull();
      expect(result.title).toBe('Join Tables and Views');
    });

    it('is case insensitive for table name matching', () => {
      const result = findQueryForEntity('Table', 'table_entity', mockQueries);
      expect(result).not.toBeNull();
      expect(result.title).toBe('Basic Table Exploration');
    });

    it('matches column entity correctly', () => {
      const result = findQueryForEntity('Column', 'COLUMN_ENTITY', mockQueries);
      expect(result).not.toBeNull();
      expect(result.title).toBe('List All Columns');
    });
  });

  describe('falls back to entity name in title', () => {
    it('matches entity name in query title when table not found', () => {
      const queriesWithTitleMatch = [
        {
          title: 'Data Domain Overview',
          description: 'View data domains',
          query: 'SELECT * FROM SOME_OTHER_TABLE',
        },
      ];
      const result = findQueryForEntity('Domain', 'DOMAIN_ENTITY', queriesWithTitleMatch);
      expect(result).not.toBeNull();
      expect(result.title).toBe('Data Domain Overview');
    });

    it('matches plural entity name in title', () => {
      const queriesWithPlural = [
        {
          title: 'List All Columns',
          description: 'Get columns',
          query: 'SELECT * FROM UNRELATED_TABLE',
        },
      ];
      const result = findQueryForEntity('Column', 'NONEXISTENT_ENTITY', queriesWithPlural);
      expect(result).not.toBeNull();
      expect(result.title).toBe('List All Columns');
    });
  });

  describe('returns null when no match found', () => {
    it('returns null when entity and table do not match any query', () => {
      const result = findQueryForEntity('SomeRandomEntity', 'RANDOM_TABLE', mockQueries);
      expect(result).toBeNull();
    });
  });
});

describe('hasQueryForEntity', () => {
  describe('returns true when query exists', () => {
    it('returns true when exampleQuery is provided', () => {
      expect(hasQueryForEntity('Entity', 'TABLE', 'SELECT * FROM TABLE', [])).toBe(true);
    });

    it('returns true when matching query found', () => {
      expect(hasQueryForEntity('Table', 'TABLE_ENTITY', undefined, mockQueries)).toBe(true);
    });
  });

  describe('returns false when no query exists', () => {
    it('returns false for abstract entities', () => {
      expect(hasQueryForEntity('Asset', '(abstract)', undefined, mockQueries)).toBe(false);
    });

    it('returns false when tableName is null', () => {
      expect(hasQueryForEntity('Entity', null, undefined, mockQueries)).toBe(false);
    });

    it('returns false when no matching query found', () => {
      expect(hasQueryForEntity('Random', 'RANDOM_TABLE', undefined, mockQueries)).toBe(false);
    });

    it('returns false when queries array is empty', () => {
      expect(hasQueryForEntity('Table', 'TABLE_ENTITY', undefined, [])).toBe(false);
    });
  });
});
