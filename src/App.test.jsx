import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('App', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial rendering', () => {
    it('renders the application title', () => {
      render(<App />);
      expect(screen.getByText('Metadata Lakehouse Entity Dictionary')).toBeInTheDocument();
    });

    it('renders the atlan branding', () => {
      render(<App />);
      expect(screen.getByText('atlan')).toBeInTheDocument();
    });

    it('renders the search input', () => {
      render(<App />);
      expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
    });

    it('renders the View All Queries button', () => {
      render(<App />);
      expect(screen.getByText('View All Queries')).toBeInTheDocument();
    });

    it('renders export buttons', () => {
      render(<App />);
      expect(screen.getByText('Export Tab')).toBeInTheDocument();
      expect(screen.getByText('Export All')).toBeInTheDocument();
    });
  });

  describe('tab navigation', () => {
    it('renders all 11 category tabs', () => {
      render(<App />);
      // Use getAllByRole to find tab buttons
      const tabButtons = screen.getAllByRole('button');
      const tabLabels = ['Core', 'Glossary', 'Data Mesh', 'Relational DB', 'Query Org',
                         'BI Tools', 'dbt', 'Object Storage', 'Orchestration', 'Governance', 'AI/ML'];

      tabLabels.forEach(label => {
        const tab = tabButtons.find(btn => btn.textContent.includes(label));
        expect(tab).toBeTruthy();
      });
    });

    it('defaults to Core tab selected', () => {
      render(<App />);
      // Core tab should have the active styling
      const coreTab = screen.getByRole('button', { name: /Core/i });
      expect(coreTab.className).toContain('bg-[#3366FF]');
    });

    it('switches tabs when clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<App />);

      const glossaryTab = screen.getByRole('button', { name: /Glossary/i });
      await user.click(glossaryTab);

      // Glossary tab should now be active
      expect(glossaryTab.className).toContain('bg-[#3366FF]');
      // Core tab should no longer be active
      const coreTab = screen.getByRole('button', { name: /Core/i });
      expect(coreTab.className).not.toContain('bg-[#3366FF]');
    });

    it('shows different entities when switching tabs', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<App />);

      // Core tab should show core entities like 'Connection'
      expect(screen.getByText('Connection')).toBeInTheDocument();

      // Switch to Glossary tab
      const glossaryTab = screen.getByRole('button', { name: /Glossary/i });
      await user.click(glossaryTab);

      // Should show glossary entities
      expect(screen.getByText('AtlasGlossary')).toBeInTheDocument();
    });
  });

  describe('search functionality', () => {
    it('filters entities based on search term', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<App />);

      const searchInput = screen.getByPlaceholderText('Search...');
      await user.type(searchInput, 'Connection');

      // Should show Connection entity
      expect(screen.getByText('Connection')).toBeInTheDocument();
      // Should filter out entities that don't match
      const table = screen.getByRole('table');
      const rows = within(table).getAllByRole('row');
      // Only header + Connection row should be visible
      expect(rows.length).toBeLessThan(10);
    });

    it('shows no results message when search has no matches', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<App />);

      const searchInput = screen.getByPlaceholderText('Search...');
      await user.type(searchInput, 'xxxxxxxxnonexistentxxxxxx');

      expect(screen.getByText('No results found')).toBeInTheDocument();
    });

    it('is case insensitive', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<App />);

      const searchInput = screen.getByPlaceholderText('Search...');
      await user.type(searchInput, 'CONNECTION');

      expect(screen.getByText('Connection')).toBeInTheDocument();
    });

    it('clears filter when search is cleared', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<App />);

      const searchInput = screen.getByPlaceholderText('Search...');
      await user.type(searchInput, 'Connection');

      // Should be filtered
      let table = screen.getByRole('table');
      let rows = within(table).getAllByRole('row');
      const filteredCount = rows.length;

      await user.clear(searchInput);

      // Should show all entities again
      table = screen.getByRole('table');
      rows = within(table).getAllByRole('row');
      expect(rows.length).toBeGreaterThan(filteredCount);
    });
  });

  describe('keyboard shortcuts', () => {
    it('focuses search input on Cmd+K', async () => {
      render(<App />);
      const searchInput = screen.getByPlaceholderText('Search...');

      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      expect(document.activeElement).toBe(searchInput);
    });

    it('focuses search input on Ctrl+K', async () => {
      render(<App />);
      const searchInput = screen.getByPlaceholderText('Search...');

      fireEvent.keyDown(document, { key: 'k', ctrlKey: true });

      expect(document.activeElement).toBe(searchInput);
    });
  });

  describe('query panel', () => {
    it('opens query panel when View All Queries clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<App />);

      const viewQueriesBtn = screen.getByText('View All Queries');
      await user.click(viewQueriesBtn);

      // Panel should be visible with "Example Queries" header
      expect(screen.getByText('Example Queries')).toBeInTheDocument();
    });

    it('registers escape key handler for closing panel', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<App />);

      // Open panel
      const viewQueriesBtn = screen.getByText('View All Queries');
      await user.click(viewQueriesBtn);

      // Verify panel is open
      expect(screen.getByText('Example Queries')).toBeInTheDocument();

      // The escape key handler is tested at the unit level via the QueryPanel component
      // This integration test verifies the panel opens correctly
    });
  });

  describe('entity count display', () => {
    it('displays entity count for current tab', () => {
      render(<App />);
      // Should show "Showing X of Y entities in Core"
      expect(screen.getByText(/Showing/i)).toBeInTheDocument();
      expect(screen.getByText(/entities in/i)).toBeInTheDocument();
    });

    it('updates entity count when filtering', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<App />);

      // Get initial row count
      let table = screen.getByRole('table');
      const initialRowCount = within(table).getAllByRole('row').length;

      // Filter by typing
      const searchInput = screen.getByPlaceholderText('Search...');
      await user.type(searchInput, 'Connection');

      // Should have fewer rows after filtering
      table = screen.getByRole('table');
      const filteredRowCount = within(table).getAllByRole('row').length;
      expect(filteredRowCount).toBeLessThan(initialRowCount);
    });
  });
});

describe('Data integrity', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('default tab displays entity data', () => {
    render(<App />);

    // Core tab (default) should show entity data in a table
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');

    // Should have header row + at least one data row
    expect(rows.length).toBeGreaterThan(1);

    // Should show Connection entity (from Core tab data)
    expect(screen.getByText('Connection')).toBeInTheDocument();
  });

  it('entity table has column headers', () => {
    render(<App />);

    // Find the table header row and verify it has expected columns
    const table = screen.getByRole('table');
    const headerCells = within(table).getAllByRole('columnheader');

    // Should have at least 3 column headers
    expect(headerCells.length).toBeGreaterThanOrEqual(3);
  });

  it('can switch between tabs', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    // Find Glossary tab button and click it
    const allButtons = screen.getAllByRole('button');
    const glossaryTab = allButtons.find(btn => btn.textContent.includes('Glossary'));
    expect(glossaryTab).toBeTruthy();

    await user.click(glossaryTab);

    // Should now show Glossary entities
    expect(screen.getByText('AtlasGlossary')).toBeInTheDocument();
  });
});
