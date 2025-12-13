# CLAUDE.md - MDLH Dictionary Project Context

## Project Overview
The MDLH (Metadata Lakehouse) Dictionary is a React frontend with FastAPI backend that provides a SQL query interface for Snowflake metadata exploration. Key components include Query Wizard, connection management, batch validation, and intelligent query suggestions.

## Build & Run Commands
```bash
# Frontend
npm install
npm run dev          # Start dev server (port 5173)
npm run build        # Production build
npm run test         # Run tests
npm run test:coverage # Run with coverage

# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Testing
- **Framework**: Vitest + React Testing Library
- **Coverage threshold**: 85% (lines, branches, functions)
- **Test Plan**: See `docs/TEST_PLAN.md` for comprehensive test specifications
- **Run tests**: `npm test`
- **Watch mode**: `npm run test:watch`
- **Coverage**: `npm run test:coverage`

### Test Summary (172 tests)
| Suite | Tests | Status |
|-------|-------|--------|
| discoveryQueries | 38 | Passing |
| resultFormatters | 59 | Passing |
| securityValidation | 57 | Passing |
| EmptyResultsState | 18 | Passing |

## Architecture
```
src/
├── components/       # React UI components
│   └── StepWizard.jsx       # Multi-step query wizard
├── hooks/            # React hooks
│   └── useSnowflake.js      # Snowflake connection & queries
├── utils/            # Utility functions
│   ├── queryHelpers.js      # SQL building & validation
│   └── resultFormatters.js  # Value formatting by type (NEW)
├── queryFlows/       # Query flow definitions
│   └── stepFlows/           # Wizard flow recipes
└── context/          # React context providers
```

---

## Spec Summary: Query Patterns & Results Display

### 1. Schema-Agnostic Query Building (Discovery-First)

**Principle**: Every query flow starts by discovering what's available, not assuming.

#### Step 1: Discover Tables with Row Counts
```sql
SELECT table_name, row_count, bytes
FROM information_schema.tables
WHERE table_schema = 'PUBLIC' AND table_name LIKE '%_ENTITY'
ORDER BY row_count DESC;
```

#### Step 2: Discover Columns
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = '${selectedTable}'
ORDER BY ordinal_position;
```

#### Safe Identifier Handling
- **Always validate**: Use `IDENTIFIER_REGEX = /^[A-Z_][A-Z0-9_]*$/i`
- **Always allowlist**: Check against discovered tables
- **Always quote**: `"${name.toUpperCase()}"`

### 2. Smart Column Type Detection

| Column Pattern | Data Type | Display Strategy |
|---------------|-----------|------------------|
| guid, qualifiedName | VARCHAR | Clickable link / badge |
| inputs, outputs | ARRAY | Expandable tree + count badge |
| attributes, meanings | VARIANT | Collapsible JSON viewer |
| createdAt, updatedAt | TIMESTAMP | Relative time ("2 hours ago") |
| count, size, bytes | NUMBER | Formatted with units ("1.2M") |

### 3. Value Formatters (NEW)

```javascript
// Key formatters to implement
formatCellValue(value, columnName, dataType)  // Main dispatcher
formatRelativeTime(date)                       // "2 hours ago"
formatNumber(value, columnName)                // "1.2M rows"
isGuid(value)                                  // GUID detection
looksLikeTimestamp(value)                      // ISO string detection
```

### 4. Empty State Patterns

Three types:
1. **No Data Exists**: Amber warning + "Try different table"
2. **Filters Too Narrow**: Show query + "Adjust filters"
3. **Wrong Table**: Dropdown with row counts

```jsx
// EmptyResultsState component structure
<EmptyResultsState
  query={query}
  availableTables={tables}
  onTableChange={handler}
  emptyType="no_data|filters_narrow|wrong_table"
/>
```

### 5. Enhanced Column Headers

```jsx
// Type icons for headers
VARCHAR  → <Type />     (Abc)
NUMBER   → <Hash />     (#)
ARRAY    → <List />     (list)
OBJECT   → <Braces />   ({})
TIMESTAMP → <Clock />   (clock)
BOOLEAN  → <ToggleLeft />
```

---

## Spec Summary: Wizard Fix

### Key Fixes Applied
1. **State persistence**: `sessionStorage` with 30min TTL
2. **Back navigation**: Cache step results, restore on back
3. **Null results handling**: Show error when `executeQuery` returns null
4. **Empty SQL**: Display "No SQL generated" message
5. **extractDataForNext validation**: Try/catch + type checking

### Session Storage Keys
- `MDLH_WIZARD_STATE`: Wizard progress + inputs

---

## Implementation Checklist

### Query Builder Changes
- [ ] Add discovery step to wizard flows (INFORMATION_SCHEMA.TABLES)
- [ ] Validate identifiers against discovery results
- [ ] Select table with highest row_count (not alphabetical)
- [ ] Add column discovery for smart formatting

### Results Display Changes
- [ ] Replace green checkmark → amber warning (0 rows)
- [ ] Add EmptyResultsState component
- [ ] Implement formatCellValue() dispatcher
- [ ] Add ArrayPreview, JsonPreview, GuidBadge components
- [ ] Add column type icons to headers
- [ ] Add client-side sorting/filtering

### Wizard Flow Changes
- [ ] Block Continue when requiresData=true and rows.length === 0
- [ ] Add table selector when multiple tables discovered
- [ ] Show row counts in dropdown
- [ ] Validate extractDataForNext before continue
- [ ] Persist state to sessionStorage

---

## Quality Gates (TDD)

| Metric | Threshold |
|--------|-----------|
| Line coverage | ≥85% |
| Branch coverage | ≥85% |
| Function coverage | ≥85% |
| All tests passing | 100% |

### Test Categories
1. **Unit tests**: Formatters, validators, helpers
2. **Component tests**: EmptyResultsState, ResultsTable
3. **Integration tests**: StepWizard flow

---

## Style Guidelines
- Use Tailwind CSS for styling
- Icons from lucide-react
- Follow existing patterns in codebase
- No emojis in code/comments

---

## UI Consistency Rules (MUST VERIFY)

Before completing UI work, Claude must check:

### Sidebar/Panel Symmetry
- [ ] Left and right sidebars use shared components from `src/components/ui/SidebarStyles.jsx`
- [ ] Never duplicate RailButton, PinButton, ResizeHandle, SidebarHeader inline
- [ ] Collapsed width: always use `SIDEBAR_STYLES.railWidth` (w-14 = 56px)
- [ ] Min/max expanded widths: use `SIDEBAR_STYLES.minExpandedWidth/maxExpandedWidth`

### Shared Constants (no hardcoding)
```javascript
// Import from SidebarStyles.jsx, don't hardcode:
SIDEBAR_STYLES.railWidth        // 'w-14'
SIDEBAR_STYLES.railWidthPx      // 56
SIDEBAR_STYLES.minExpandedWidth // 200
SIDEBAR_STYLES.maxExpandedWidth // 600
SIDEBAR_STYLES.borderColor      // 'border-slate-200'
SIDEBAR_STYLES.transition       // 'transition-all duration-200 ease-in-out'
```

### Ref Forwarding
- Components wrapping DOM elements that may need refs MUST use `React.forwardRef`
- Pattern: `export const Foo = React.forwardRef(function Foo(props, ref) { ... });`

### Hover Behavior
- Enter delay: 150ms (prevent accidental triggers)
- Leave delay: 300ms (prevent premature close)
- Both sidebars must use identical timing

### After UI Changes
1. Run `npm run build` to catch syntax errors
2. Verify left/right panels match visually when collapsed
3. Test hover-to-expand on both sides
4. Test pin/unpin on both sides

