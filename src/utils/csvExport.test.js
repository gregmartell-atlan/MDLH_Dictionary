import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateCSV, downloadCSVFile } from './csvExport';

const mockData = [
  {
    entity: 'Table',
    table: 'TABLE_ENTITY',
    description: 'Database table',
  },
  {
    entity: 'Column',
    table: 'COLUMN_ENTITY',
    description: 'Table/view column',
  },
];

const mockColumns = ['entity', 'table', 'description'];

const mockColHeaders = {
  entity: 'Entity',
  table: 'Table Name',
  description: 'Description',
};

describe('generateCSV', () => {
  describe('generates valid CSV header', () => {
    it('generates header row with correct column names', () => {
      const csv = generateCSV(mockData, mockColumns, mockColHeaders);
      const lines = csv.split('\n');
      expect(lines[0]).toBe('Entity,Table Name,Description');
    });

    it('returns only header when data is empty', () => {
      const csv = generateCSV([], mockColumns, mockColHeaders);
      expect(csv).toBe('Entity,Table Name,Description');
    });

    it('returns only header when data is null', () => {
      const csv = generateCSV(null, mockColumns, mockColHeaders);
      expect(csv).toBe('Entity,Table Name,Description');
    });

    it('returns only header when data is undefined', () => {
      const csv = generateCSV(undefined, mockColumns, mockColHeaders);
      expect(csv).toBe('Entity,Table Name,Description');
    });
  });

  describe('generates valid CSV rows', () => {
    it('generates correct number of rows including header', () => {
      const csv = generateCSV(mockData, mockColumns, mockColHeaders);
      const lines = csv.split('\n');
      expect(lines).toHaveLength(3); // 1 header + 2 data rows
    });

    it('wraps cell values in double quotes', () => {
      const csv = generateCSV(mockData, mockColumns, mockColHeaders);
      const lines = csv.split('\n');
      expect(lines[1]).toBe('"Table","TABLE_ENTITY","Database table"');
    });

    it('includes all columns for each row', () => {
      const csv = generateCSV(mockData, mockColumns, mockColHeaders);
      const lines = csv.split('\n');
      // Each data row should have 3 values (matching 3 columns)
      expect(lines[1].split(',').length).toBe(3);
      expect(lines[2].split(',').length).toBe(3);
    });
  });

  describe('handles special characters', () => {
    it('escapes double quotes by doubling them', () => {
      const dataWithQuotes = [
        {
          entity: 'Test',
          table: 'TEST_TABLE',
          description: 'Has "quoted" text',
        },
      ];
      const csv = generateCSV(dataWithQuotes, mockColumns, mockColHeaders);
      const lines = csv.split('\n');
      expect(lines[1]).toBe('"Test","TEST_TABLE","Has ""quoted"" text"');
    });

    it('handles commas in cell values', () => {
      const dataWithCommas = [
        {
          entity: 'Test',
          table: 'TEST_TABLE',
          description: 'Has, comma, values',
        },
      ];
      const csv = generateCSV(dataWithCommas, mockColumns, mockColHeaders);
      const lines = csv.split('\n');
      expect(lines[1]).toBe('"Test","TEST_TABLE","Has, comma, values"');
    });

    it('handles newlines in cell values', () => {
      const dataWithNewlines = [
        {
          entity: 'Test',
          table: 'TEST_TABLE',
          description: 'Line1\nLine2',
        },
      ];
      const csv = generateCSV(dataWithNewlines, mockColumns, mockColHeaders);
      const lines = csv.split('\n');
      // The newline in the description should be preserved inside quotes
      expect(csv).toContain('"Line1\nLine2"');
    });
  });

  describe('handles missing values', () => {
    it('handles null values as empty strings', () => {
      const dataWithNull = [
        {
          entity: 'Test',
          table: null,
          description: 'Has null',
        },
      ];
      const csv = generateCSV(dataWithNull, mockColumns, mockColHeaders);
      const lines = csv.split('\n');
      expect(lines[1]).toBe('"Test","","Has null"');
    });

    it('handles undefined values as empty strings', () => {
      const dataWithUndefined = [
        {
          entity: 'Test',
          description: 'Missing table',
        },
      ];
      const csv = generateCSV(dataWithUndefined, mockColumns, mockColHeaders);
      const lines = csv.split('\n');
      expect(lines[1]).toBe('"Test","","Missing table"');
    });
  });

  describe('handles different column configurations', () => {
    it('works with single column', () => {
      const csv = generateCSV(mockData, ['entity'], { entity: 'Entity' });
      const lines = csv.split('\n');
      expect(lines[0]).toBe('Entity');
      expect(lines[1]).toBe('"Table"');
    });

    it('works with many columns', () => {
      const manyColumns = ['entity', 'table', 'description'];
      const csv = generateCSV(mockData, manyColumns, mockColHeaders);
      const lines = csv.split('\n');
      expect(lines[0].split(',').length).toBe(3);
    });
  });
});

describe('downloadCSVFile', () => {
  let mockCreateElement;
  let mockAnchor;

  beforeEach(() => {
    mockAnchor = {
      href: '',
      download: '',
      click: vi.fn(),
    };
    mockCreateElement = vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor);
  });

  it('creates a blob with CSV content', () => {
    const csvContent = 'Header1,Header2\n"Value1","Value2"';
    downloadCSVFile(csvContent, 'test.csv');

    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('sets correct filename on anchor element', () => {
    downloadCSVFile('test content', 'my-export.csv');

    expect(mockAnchor.download).toBe('my-export.csv');
  });

  it('triggers click on anchor element', () => {
    downloadCSVFile('test content', 'test.csv');

    expect(mockAnchor.click).toHaveBeenCalled();
  });

  it('revokes object URL after download', () => {
    downloadCSVFile('test content', 'test.csv');

    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
});
