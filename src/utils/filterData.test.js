import { describe, it, expect } from 'vitest';
import { filterEntities, filterQueries } from './filterData';

const mockEntities = [
  {
    entity: 'Connection',
    table: 'CONNECTION_ENTITY',
    description: 'Configured connection to data source',
    keyAttributes: 'connectorName, host, port',
  },
  {
    entity: 'Column',
    table: 'COLUMN_ENTITY',
    description: 'Field within a relation',
    keyAttributes: 'name, dataType, isPrimaryKey',
  },
  {
    entity: 'View',
    table: 'VIEW_ENTITY',
    description: 'Virtual relation from query',
    keyAttributes: 'name, definition',
  },
  {
    entity: 'Schema',
    table: 'SCHEMA_ENTITY',
    description: 'Namespace container',
    keyAttributes: 'name, objectCount',
  },
];

const mockQueries = [
  {
    title: 'Basic Table Exploration',
    description: 'View table metadata with row counts',
    query: 'SELECT NAME, ROWCOUNT FROM TABLE_ENTITY',
  },
  {
    title: 'Column Details',
    description: 'Get column data types',
    query: 'SELECT NAME, DATATYPE FROM COLUMN_ENTITY',
  },
  {
    title: 'Downstream Lineage',
    description: 'Find downstream assets',
    query: 'WITH RECURSIVE lineage_cte AS (SELECT guid FROM PROCESS_ENTITY)',
  },
];

describe('filterEntities', () => {
  describe('handles invalid inputs', () => {
    it('returns empty array when data is null', () => {
      expect(filterEntities(null, 'search')).toEqual([]);
    });

    it('returns empty array when data is undefined', () => {
      expect(filterEntities(undefined, 'search')).toEqual([]);
    });

    it('returns empty array when data is not an array', () => {
      expect(filterEntities('not an array', 'search')).toEqual([]);
    });
  });

  describe('returns all data when search is empty', () => {
    it('returns all entities when searchTerm is empty string', () => {
      expect(filterEntities(mockEntities, '')).toEqual(mockEntities);
    });

    it('returns all entities when searchTerm is null', () => {
      expect(filterEntities(mockEntities, null)).toEqual(mockEntities);
    });

    it('returns all entities when searchTerm is undefined', () => {
      expect(filterEntities(mockEntities, undefined)).toEqual(mockEntities);
    });

    it('returns all entities when searchTerm is whitespace', () => {
      expect(filterEntities(mockEntities, '   ')).toEqual(mockEntities);
    });
  });

  describe('filters by entity name', () => {
    it('filters by exact entity name', () => {
      const result = filterEntities(mockEntities, 'Connection');
      expect(result).toHaveLength(1);
      expect(result[0].entity).toBe('Connection');
    });

    it('filters by partial entity name', () => {
      const result = filterEntities(mockEntities, 'Col');
      expect(result).toHaveLength(1);
      expect(result[0].entity).toBe('Column');
    });

    it('is case insensitive', () => {
      const result = filterEntities(mockEntities, 'CONNECTION');
      expect(result).toHaveLength(1);
      expect(result[0].entity).toBe('Connection');
    });
  });

  describe('filters by table name', () => {
    it('filters by table name', () => {
      const result = filterEntities(mockEntities, 'COLUMN_ENTITY');
      expect(result).toHaveLength(1);
      expect(result[0].entity).toBe('Column');
    });

    it('filters by partial table name', () => {
      const result = filterEntities(mockEntities, '_ENTITY');
      expect(result).toHaveLength(4); // All entities have _ENTITY in table name
    });
  });

  describe('filters by description', () => {
    it('filters by description content', () => {
      const result = filterEntities(mockEntities, 'relation');
      expect(result).toHaveLength(2); // Column and View both mention relation
      expect(result.map((e) => e.entity)).toContain('Column');
      expect(result.map((e) => e.entity)).toContain('View');
    });

    it('filters by unique description term', () => {
      const result = filterEntities(mockEntities, 'Namespace');
      expect(result).toHaveLength(1);
      expect(result[0].entity).toBe('Schema');
    });
  });

  describe('filters by any field', () => {
    it('filters by keyAttributes content', () => {
      const result = filterEntities(mockEntities, 'isPrimaryKey');
      expect(result).toHaveLength(1);
      expect(result[0].entity).toBe('Column');
    });

    it('returns multiple matches across different fields', () => {
      const result = filterEntities(mockEntities, 'name');
      expect(result).toHaveLength(4); // All entities have 'name' in keyAttributes (connectorName, name, name, name)
    });
  });

  describe('handles edge cases', () => {
    it('returns empty array when no matches found', () => {
      const result = filterEntities(mockEntities, 'nonexistent');
      expect(result).toEqual([]);
    });

    it('handles special characters in search', () => {
      const result = filterEntities(mockEntities, 'data source');
      expect(result).toHaveLength(1);
      expect(result[0].entity).toBe('Connection');
    });
  });
});

describe('filterQueries', () => {
  describe('handles invalid inputs', () => {
    it('returns empty array when queries is null', () => {
      expect(filterQueries(null, 'search')).toEqual([]);
    });

    it('returns empty array when queries is undefined', () => {
      expect(filterQueries(undefined, 'search')).toEqual([]);
    });

    it('returns empty array when queries is not an array', () => {
      expect(filterQueries('not an array', 'search')).toEqual([]);
    });
  });

  describe('returns all queries when search is empty', () => {
    it('returns all queries when searchTerm is empty string', () => {
      expect(filterQueries(mockQueries, '')).toEqual(mockQueries);
    });

    it('returns all queries when searchTerm is null', () => {
      expect(filterQueries(mockQueries, null)).toEqual(mockQueries);
    });

    it('returns all queries when searchTerm is whitespace', () => {
      expect(filterQueries(mockQueries, '   ')).toEqual(mockQueries);
    });
  });

  describe('filters by title', () => {
    it('filters by exact title match', () => {
      const result = filterQueries(mockQueries, 'Basic Table Exploration');
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Basic Table Exploration');
    });

    it('filters by partial title match', () => {
      const result = filterQueries(mockQueries, 'Lineage');
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Downstream Lineage');
    });

    it('is case insensitive for title', () => {
      const result = filterQueries(mockQueries, 'COLUMN DETAILS');
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Column Details');
    });
  });

  describe('filters by description', () => {
    it('filters by description content', () => {
      const result = filterQueries(mockQueries, 'row counts');
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Basic Table Exploration');
    });

    it('filters by unique description term', () => {
      const result = filterQueries(mockQueries, 'downstream assets');
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Downstream Lineage');
    });
  });

  describe('filters by query SQL', () => {
    it('filters by SQL keyword', () => {
      const result = filterQueries(mockQueries, 'RECURSIVE');
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Downstream Lineage');
    });

    it('filters by table name in query', () => {
      const result = filterQueries(mockQueries, 'TABLE_ENTITY');
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Basic Table Exploration');
    });

    it('filters by column name in query', () => {
      const result = filterQueries(mockQueries, 'DATATYPE');
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Column Details');
    });
  });

  describe('handles edge cases', () => {
    it('returns empty array when no matches found', () => {
      const result = filterQueries(mockQueries, 'nonexistent');
      expect(result).toEqual([]);
    });

    it('returns multiple matches when search matches multiple queries', () => {
      const result = filterQueries(mockQueries, 'NAME');
      expect(result).toHaveLength(2); // Basic Table and Column Details have NAME in query
    });
  });
});
