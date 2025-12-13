# MDLH Dictionary - Component Catalog

## Quick Reference

### Component Hierarchy

```
App
├── QueryEditor (main editor panel)
│   ├── Monaco Editor
│   ├── QuerySuggestionsDropdown (templates)
│   └── Toolbar (format, clear, history)
│
├── ResultsTable
│   ├── SearchBar (global filter)
│   ├── ColumnHeaders (sortable)
│   ├── DataRows
│   └── ExportMenu (CSV, JSON, Copy)
│
├── EntityDetailPanel (unified sidebar)
│   ├── TabBar (Details, Queries, Test)
│   ├── EntityHeader (always visible)
│   ├── QueriesTab
│   │   ├── HeroCard (View Lineage Graph)
│   │   └── QueryCards (by category)
│   ├── DetailsTab (entity info)
│   └── TestTab (embedded FlyoutQueryEditor)
│
├── LineagePanel (flyout)
│   ├── LineageRail (graph visualization)
│   ├── TabbedCodeCard (SQL preview)
│   └── RecommendedQueries
│
└── SchemaExplorer (left sidebar)
    └── TableList
```

---

## Component Specifications

### 1. EntityDetailPanel

**File:** `src/components/EntityDetailPanel.jsx`

**Props:**
```typescript
interface EntityDetailPanelProps {
  selectedEntity: {
    table?: string;
    NAME?: string;
    name?: string;
    entity?: string;
    guid?: string;
    GUID?: string;
    entityType?: string;
    TYPENAME?: string;
    description?: string;
    [key: string]: any;
  };
  category?: string;                    // default: 'core'
  database?: string;                    // default: 'FIELD_METADATA'
  schema?: string;                      // default: 'PUBLIC'
  onOpenInEditor?: (sql: string, query: object) => void;
  onOpenLineage?: (entity: object) => void;
  onClose?: () => void;
  discoveredTables?: Set<string>;       // default: new Set()
  sampleEntities?: object;              // default: null
  initialTestQuery?: string;            // default: ''
  availableTables?: string[];           // default: []
  tableColumns?: Record<string, string[]>; // default: {}
}
```

**Internal State:**
```typescript
activeTab: 'cell' | 'lineage' | 'test'  // default: 'lineage'
isQueriesExpanded: boolean              // default: true
copied: boolean                         // GUID copy state
testQuery: string                       // current test query
```

**Key Features:**
- 3 tabs: Details, Queries (with badge), Test
- Entity header always visible
- Click query card → loads in Test tab
- Embedded FlyoutQueryEditor in Test tab

---

### 2. QueryItem (Query Card)

**File:** `src/components/EntityDetailPanel.jsx` (internal)

**Props:**
```typescript
interface QueryItemProps {
  query: {
    id: string;
    label: string;
    description: string;
    category: string;
    sql: string;
    icon?: React.ComponentType;
  };
  onRun: (sql: string, query: object) => void;
  icon?: React.ComponentType;  // override default icon
}
```

**Behavior:**
- Click → calls `onRun(sql, query)`
- Hover → shows copy button
- Copy button → copies SQL to clipboard

**CSS Classes:**
```
Base: group w-full flex items-center gap-3 px-3 py-3 rounded-lg
      border border-slate-200 bg-white hover:border-blue-300
      hover:bg-blue-50/30 transition-all text-left

Icon box: flex-shrink-0 w-8 h-8 rounded-lg bg-slate-100
          group-hover:bg-blue-100 flex items-center justify-center

Title: text-sm font-medium text-slate-800 group-hover:text-blue-700
Description: text-xs text-slate-500 truncate
Chevron: text-slate-300 group-hover:text-blue-500
```

---

### 3. LineagePanel

**File:** `src/components/lineage/LineagePanel.jsx`

**Props:**
```typescript
interface LineagePanelProps {
  isConnected: boolean;
  database: string;
  schema: string;
  editorQuery?: string;
  lineageData?: {
    nodes: Array<{id, label, type, column, row}>;
    edges: Array<{from, to}>;
    metadata?: object;
    rawProcesses?: object[];
  };
  loading: boolean;
  error?: string;
  currentTable?: string;
  selectedEntity?: object;
  onRefresh?: () => void;
  onRunQuery?: (sql: string, query: object) => void;
}
```

**Sections:**
1. Header (title + Live/Example badge + Refresh button)
2. Graph + SQL Preview (2-column grid on xl)
3. Lineage Queries (TabbedCodeCard)
4. Recommended Queries (QueryCards by category)

---

### 4. QueryCard (LineagePanel version)

**File:** `src/components/lineage/LineagePanel.jsx` (internal)

**Props:**
```typescript
interface QueryCardProps {
  icon: React.ComponentType;
  title: string;
  description: string;
  sql: string;
  onRun?: (sql: string, query: object) => void;
  onCopy?: (sql: string) => void;
}
```

**Same styling as QueryItem** - consistent across both panels.

---

### 5. ResultsTable

**File:** `src/components/ResultsTable.jsx`

**Props:**
```typescript
interface ResultsTableProps {
  data: Array<Record<string, any>>;
  columns?: Array<{
    accessorKey: string;
    header: string;
  }>;
  loading?: boolean;
  error?: string;
  onRowClick?: (row: object) => void;
}
```

**Features:**
- Global search filter
- Column sorting (click headers)
- Export menu (CSV, JSON, Copy All)
- Row count display
- Truncated columns (max-width: 200px)

---

### 6. FlyoutQueryEditor

**File:** `src/components/FlyoutQueryEditor.jsx`

**Props:**
```typescript
interface FlyoutQueryEditorProps {
  initialQuery?: string;          // default: ''
  title?: string;                 // default: 'Test Query'
  onClose?: () => void;
  onOpenFullEditor?: (sql: string) => void;
  database?: string;
  schema?: string;
  hideHeader?: boolean;           // default: false
  onSqlChange?: (sql: string, initialQuery: string) => void;
  availableTables?: string[];     // default: []
  tableColumns?: Record<string, string[]>; // default: {}
  entityContext?: object;         // default: null
  showFlowControls?: boolean;     // default: true
}
```

**Internal Components:**
- FlyoutQueryEditorHeader
- CompactResultsTable
- Monaco Editor
- PlaceholderSuggestions
- StepWizard (when in wizard mode)

---

### 7. QuerySuggestionsDropdown

**File:** `src/components/QueryEditor.jsx` (internal)

**Props:**
```typescript
interface QuerySuggestionsDropdownProps {
  queries: Array<{
    id: string;
    label: string;
    sql: string;
    category: string;
    rowCount?: number;
  }>;
  onSelect: (sql: string) => void;
}
```

**Features:**
- Search filter
- Category grouping (LINEAGE, STRUCTURE, GOVERNANCE, etc.)
- Row count badges
- Scrollable (max-height: 320px)

---

### 8. TabbedCodeCard

**File:** `src/components/ui/TabbedCodeCard.jsx`

**Props:**
```typescript
interface TabbedCodeCardProps {
  languages: Array<{id: string, label: string}>;
  variants: Array<{id: string, label: string}>;
  snippets: Array<{
    language: string;
    variantId: string;
    code: string;
  }>;
}
```

**Features:**
- Language tabs (SQL, Python)
- Variant tabs (Upstream, Downstream)
- Syntax highlighted code
- Copy button

---

## Icon Usage by Component

| Component | Icons Used |
|-----------|------------|
| EntityDetailPanel | Table2, GitBranch, FlaskConical, X, Copy, Check, ChevronRight, ChevronDown, Network, Sparkles, ArrowUpRight, ArrowDownRight, Layers, Database, Columns, Tag, BarChart3, FileText |
| LineagePanel | Loader2, AlertTriangle, RefreshCw, Zap, GitBranch, Settings, AlertCircle, Copy, Check, ChevronRight, ArrowUpRight, ArrowDownRight, Layers, Play |
| ResultsTable | Search, X, Download, FileSpreadsheet, Braces, Copy, ArrowUpDown, ChevronUp, ChevronDown |
| QueryEditor | ChevronDown, Search, AlignLeft, History, Trash2, Code2, FileCode |

---

## Query Categories

| Category | Icon | Color | Description |
|----------|------|-------|-------------|
| lineage | GitBranch | slate | Upstream/downstream queries |
| structure | Columns | slate | Table/column info |
| governance | Tag | slate | Tags, classifications |
| usage | BarChart3 | slate | Popularity, usage stats |
| glossary | FileText | slate | Business terms |
| default | Database | slate | General queries |

---

## State Management

### EntityDetailPanel State Flow

```
selectedEntity changes
  ↓
useMemo: Build dynamicQueries from discoveredTables
  ↓
useMemo: Build lineageQueries from entity GUID
  ↓
useMemo: Categorize queries (structure, governance, other)
  ↓
Render query cards by category
```

### Query Execution Flow

```
User clicks QueryItem
  ↓
handleRunQuery(sql, query)
  ↓
setTestQuery(sql)
  ↓
setActiveTab('test')
  ↓
FlyoutQueryEditor receives new initialQuery
  ↓
User presses ⌘+Enter
  ↓
executeQuery(sql, {database, schema, warehouse})
  ↓
Results displayed in CompactResultsTable
```

---

## CSS Utilities

### Commonly Used Tailwind Classes

**Layout:**
```
flex flex-col flex-1 overflow-hidden
flex items-center justify-between gap-3
w-full min-w-0 truncate
```

**Spacing:**
```
p-3 p-4 px-3 py-2 gap-2 gap-3 space-y-2 space-y-4
mb-4 mt-3
```

**Typography:**
```
text-xs text-sm text-base
font-medium font-semibold
text-slate-400 text-slate-500 text-slate-700 text-slate-900
```

**Borders & Backgrounds:**
```
border border-slate-200 rounded-lg rounded-xl
bg-white bg-slate-50 bg-blue-50
hover:bg-slate-50 hover:border-blue-300
```

**Transitions:**
```
transition-all transition-colors transition-transform
group-hover:opacity-100 group-hover:text-blue-600
```

---

## Testing Checklist

- [ ] Tab switching works correctly
- [ ] Query cards show hover state
- [ ] Copy button shows success feedback
- [ ] Click query → loads in Test tab
- [ ] Test tab runs queries with ⌘+Enter
- [ ] Lineage graph loads when entity has GUID
- [ ] Results table sorts and filters
- [ ] Export menu downloads files
- [ ] Panel closes with X button
- [ ] Entity header updates with selection

---

*Last updated: December 2024*
