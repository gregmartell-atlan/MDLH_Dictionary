# MDLH Dictionary - Design Specifications

## Table of Contents
1. [Design System Overview](#design-system-overview)
2. [Color Palette](#color-palette)
3. [Typography](#typography)
4. [Spacing & Layout](#spacing--layout)
5. [Component Specifications](#component-specifications)
6. [Icons](#icons)
7. [Interaction Patterns](#interaction-patterns)

---

## Design System Overview

**Design Philosophy:** Clean, minimal, professional - inspired by DuckDB, Atlan, and modern SQL editors.

**Key Principles:**
- White backgrounds with subtle borders
- Blue as primary accent color
- Consistent 8px grid system
- Subtle shadows and transitions
- Clear visual hierarchy

---

## Color Palette

### Primary Colors
```css
--primary-blue: #3366FF;
--primary-blue-light: #EBF0FF;
--primary-blue-dark: #254EDB;
```

### Slate Gray Scale (UI)
| Token | Hex | Usage |
|-------|-----|-------|
| `slate-50` | #F8FAFC | Backgrounds, hover states |
| `slate-100` | #F1F5F9 | Secondary backgrounds, badges |
| `slate-200` | #E2E8F0 | Borders, dividers |
| `slate-300` | #CBD5E1 | Disabled borders |
| `slate-400` | #94A3B8 | Muted text, icons |
| `slate-500` | #64748B | Secondary text |
| `slate-600` | #475569 | Body text |
| `slate-700` | #334155 | Headings |
| `slate-800` | #1E293B | Primary text |
| `slate-900` | #0F172A | Bold headings |

### Semantic Colors
| State | Background | Border | Text |
|-------|------------|--------|------|
| Success | `#DAFBE1` | `#2DA44E` | `#1A7F37` |
| Error | `#FFEBE9` | `#CF222E` | `#CF222E` |
| Warning | `#FFF8C5` | `#BF8700` | `#9A6700` |
| Info | `#DDF4FF` | `#54AEFF` | `#0969DA` |

### Status Indicators
```css
/* Connected */
.status-connected { background: #10B981; } /* emerald-500 */

/* Disconnected */
.status-disconnected { background: #94A3B8; } /* slate-400 */

/* Loading */
.status-loading { background: #3B82F6; } /* blue-500 */
```

---

## Typography

### Font Family
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
font-family-mono: 'SF Mono', 'Fira Code', 'Consolas', monospace;
```

### Font Sizes
| Token | Size | Line Height | Usage |
|-------|------|-------------|-------|
| `text-xs` | 12px | 16px | Badges, hints, metadata |
| `text-sm` | 14px | 20px | Body text, descriptions |
| `text-base` | 16px | 24px | Primary content |
| `text-lg` | 18px | 28px | Section headings |
| `text-xl` | 20px | 28px | Panel titles |

### Font Weights
| Token | Weight | Usage |
|-------|--------|-------|
| `font-normal` | 400 | Body text |
| `font-medium` | 500 | Labels, buttons |
| `font-semibold` | 600 | Headings, emphasis |
| `font-bold` | 700 | Primary headings |

---

## Spacing & Layout

### Spacing Scale (8px base)
| Token | Value | Usage |
|-------|-------|-------|
| `0.5` | 2px | Micro spacing |
| `1` | 4px | Icon gaps |
| `1.5` | 6px | Tight padding |
| `2` | 8px | Standard gap |
| `3` | 12px | Section padding |
| `4` | 16px | Card padding |
| `5` | 20px | Large padding |
| `6` | 24px | Section margins |

### Border Radius
| Token | Value | Usage |
|-------|-------|-------|
| `rounded` | 4px | Buttons, badges |
| `rounded-lg` | 8px | Cards, inputs |
| `rounded-xl` | 12px | Modals, panels |
| `rounded-2xl` | 16px | Hero cards |
| `rounded-full` | 9999px | Pills, avatars |

### Shadows
```css
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.03);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.05);
--shadow-card: 0 4px 24px rgba(0,0,0,0.06), 0 1.5px 4px rgba(0,0,0,0.03);
```

---

## Component Specifications

### 1. EntityDetailPanel (Unified Sidebar)

**Dimensions:**
- Width: `384px` (w-96)
- Full height of parent container

**Structure:**
```
┌─────────────────────────────────────┐
│ [Details] [Queries 6] [Test]    [X] │  ← Tabs (h-12)
├─────────────────────────────────────┤
│ [Icon] Entity Name                  │  ← Header (p-4)
│        Type Badge  GUID...  [copy]  │
├─────────────────────────────────────┤
│                                     │
│         Tab Content                 │  ← Content (flex-1, overflow-y-auto)
│                                     │
├─────────────────────────────────────┤
│ database.schema    Context hint     │  ← Footer (h-12)
└─────────────────────────────────────┘
```

**Tab Styling:**
```css
/* Inactive Tab */
.tab-inactive {
  color: #64748B; /* slate-500 */
  background: transparent;
}
.tab-inactive:hover {
  color: #334155; /* slate-700 */
  background: #F8FAFC; /* slate-50 */
}

/* Active Tab */
.tab-active {
  color: #2563EB; /* blue-600 */
  background: rgba(239, 246, 255, 0.5); /* blue-50/50 */
  border-bottom: 2px solid #2563EB;
}
```

**Tab Badge:**
```css
.tab-badge {
  padding: 2px 6px;
  font-size: 10px;
  border-radius: 9999px;
  background: #F1F5F9; /* slate-100 */
  color: #64748B; /* slate-500 */
}
.tab-badge-active {
  background: #DBEAFE; /* blue-100 */
  color: #1D4ED8; /* blue-700 */
}
```

---

### 2. Query Card

**Dimensions:**
- Full width of container
- Padding: 12px (p-3)
- Min height: ~64px

**Structure:**
```
┌─────────────────────────────────────────────┐
│ [Icon]  Query Title                 [>]     │
│   32px  Description text...                 │
└─────────────────────────────────────────────┘
```

**States:**
```css
/* Default */
.query-card {
  background: white;
  border: 1px solid #E2E8F0; /* slate-200 */
  border-radius: 8px;
  transition: all 150ms;
}

/* Hover */
.query-card:hover {
  border-color: #93C5FD; /* blue-300 */
  background: rgba(239, 246, 255, 0.3); /* blue-50/30 */
}

/* Icon Box - Default */
.query-card-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #F1F5F9; /* slate-100 */
  color: #64748B; /* slate-500 */
}

/* Icon Box - Hover */
.query-card:hover .query-card-icon {
  background: #DBEAFE; /* blue-100 */
  color: #2563EB; /* blue-600 */
}
```

**Copy Button (on hover):**
```css
.query-card-copy {
  opacity: 0;
  transition: opacity 150ms;
}
.query-card:hover .query-card-copy {
  opacity: 1;
}
```

---

### 3. View Lineage Graph Card (Hero Action)

**Dimensions:**
- Full width
- Padding: 16px (p-4)
- Border radius: 12px (rounded-xl)

**Structure:**
```
┌─────────────────────────────────────────────┐
│  ┌──────┐                                   │
│  │      │  View Lineage Graph          [>]  │
│  │ Icon │  Visualize upstream and...        │
│  │      │                                   │
│  └──────┘                                   │
└─────────────────────────────────────────────┘
```

**Styling:**
```css
.hero-card {
  background: linear-gradient(to bottom right, #EFF6FF, #EEF2FF);
  /* from-blue-50 to-indigo-50 */
  border: 1px solid #BFDBFE; /* blue-200 */
  border-radius: 12px;
  transition: all 200ms;
}

.hero-card:hover {
  border-color: #93C5FD; /* blue-300 */
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}

.hero-card-icon-box {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid #BFDBFE; /* blue-200 */
}

.hero-card:hover .hero-card-icon-box {
  transform: scale(1.05);
}

.hero-card-chevron {
  color: #60A5FA; /* blue-400 */
  transition: transform 200ms;
}

.hero-card:hover .hero-card-chevron {
  transform: translateX(4px);
}
```

---

### 4. Category Header

**Styling:**
```css
.category-header {
  font-size: 12px; /* text-xs */
  font-weight: 600; /* font-semibold */
  color: #94A3B8; /* slate-400 */
  text-transform: uppercase;
  letter-spacing: 0.05em; /* tracking-wider */
  padding: 0 4px;
  margin-bottom: 8px;
}
```

---

### 5. Entity Header (Always Visible)

**Structure:**
```
┌─────────────────────────────────────────────┐
│  ┌──────┐  Entity Name                      │
│  │ Icon │  [Type] abc123... [copy]          │
│  └──────┘                                   │
└─────────────────────────────────────────────┘
```

**Styling:**
```css
.entity-header {
  padding: 16px;
  border-bottom: 1px solid #F1F5F9; /* slate-100 */
  background: rgba(248, 250, 252, 0.5); /* slate-50/50 */
}

.entity-icon-box {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: #DBEAFE; /* blue-100 */
  color: #2563EB; /* blue-600 */
}

.entity-name {
  font-size: 16px; /* text-base */
  font-weight: 600; /* font-semibold */
  color: #0F172A; /* slate-900 */
}

.entity-type-badge {
  padding: 2px 8px;
  font-size: 12px;
  font-weight: 500;
  background: #F1F5F9; /* slate-100 */
  color: #475569; /* slate-600 */
  border-radius: 4px;
}

.entity-guid {
  font-size: 12px;
  font-family: monospace;
  color: #94A3B8; /* slate-400 */
}
```

---

### 6. LineagePanel (Flyout)

**Dimensions:**
- Margin: 24px horizontal, 16px vertical (mx-6 mt-4 mb-4)
- Full available height

**Section Spacing:**
```css
.lineage-panel section {
  margin-bottom: 16px; /* space-y-4 */
}
```

**Header Row:**
```css
.lineage-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.lineage-title {
  font-size: 14px; /* text-sm */
  font-weight: 600; /* font-semibold */
  color: #0F172A; /* slate-900 */
}

.lineage-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 9999px;
  font-family: monospace;
}

.lineage-badge-live {
  background: #ECFDF5; /* emerald-50 */
  color: #047857; /* emerald-700 */
  border: 1px solid #A7F3D0; /* emerald-200 */
}

.lineage-badge-example {
  background: #F9FAFB; /* gray-50 */
  color: #6B7280; /* gray-500 */
  border: 1px solid #E5E7EB; /* gray-200 */
}
```

---

### 7. Results Table

**Structure:**
```
┌─────────────────────────────────────────────┐
│ [Search...] [X]                   123 rows  │  ← Search Bar
├─────────────────────────────────────────────┤
│ Column1  │ Column2  │ Column3  │ ...        │  ← Header
├─────────────────────────────────────────────┤
│ value    │ value    │ value    │ ...        │  ← Rows
│ value    │ value    │ value    │ ...        │
└─────────────────────────────────────────────┘
│ Showing 50 of 1,234                         │  ← Footer (if truncated)
└─────────────────────────────────────────────┘
```

**Styling:**
```css
/* Table Container */
.results-table-container {
  border: 1px solid #E2E8F0; /* slate-200 */
  border-radius: 8px;
  overflow: hidden;
  background: white;
}

/* Header */
.results-table th {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 500;
  color: #475569; /* slate-600 */
  background: #F8FAFC; /* slate-50 */
  border-bottom: 1px solid #E2E8F0;
  text-align: left;
  white-space: nowrap;
}

/* Sortable Header */
.results-table th.sortable {
  cursor: pointer;
}
.results-table th.sortable:hover {
  background: #F1F5F9; /* slate-100 */
}

/* Cells */
.results-table td {
  padding: 8px 12px;
  font-size: 13px;
  color: #1E293B; /* slate-800 */
  border-bottom: 1px solid #F1F5F9; /* slate-100 */
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Row Hover */
.results-table tr:hover td {
  background: #F8FAFC; /* slate-50 */
}

/* Null Values */
.results-table .null-value {
  color: #CBD5E1; /* slate-300 */
  font-style: italic;
}
```

**Search Bar:**
```css
.results-search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid #E2E8F0;
  background: #F8FAFC; /* slate-50 */
}

.results-search input {
  flex: 1;
  font-size: 14px;
  background: transparent;
  border: none;
  outline: none;
}

.results-search input::placeholder {
  color: #94A3B8; /* slate-400 */
}

.results-search .row-count {
  font-size: 12px;
  color: #64748B; /* slate-500 */
}
```

---

### 8. Query Editor Toolbar

**Structure:**
```
┌─────────────────────────────────────────────┐
│ [Templates ▼] [Format] [History] [Clear]    │
└─────────────────────────────────────────────┘
```

**Button Styling:**
```css
/* Toolbar Button */
.toolbar-btn {
  padding: 6px;
  border-radius: 4px;
  color: #94A3B8; /* slate-400 */
  transition: all 150ms;
}

.toolbar-btn:hover {
  background: #F1F5F9; /* slate-100 */
  color: #2563EB; /* blue-600 */
}

/* Templates Dropdown Trigger */
.templates-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  font-size: 13px;
  font-weight: 500;
  color: #334155; /* slate-700 */
  background: white;
  border: 1px solid #E2E8F0; /* slate-200 */
  border-radius: 6px;
}

.templates-trigger:hover {
  border-color: #CBD5E1; /* slate-300 */
  background: #F8FAFC; /* slate-50 */
}
```

---

### 9. Export Menu

**Structure:**
```
┌──────────────────────┐
│ [CSV] Export CSV     │
│ [{}] Export JSON     │
├──────────────────────┤
│ [Copy] Copy All      │
│ [Copy] Copy Row      │
└──────────────────────┘
```

**Styling:**
```css
.export-menu {
  min-width: 160px;
  background: white;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
  overflow: hidden;
}

.export-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  font-size: 13px;
  color: #334155; /* slate-700 */
  text-align: left;
}

.export-menu-item:hover {
  background: #F8FAFC; /* slate-50 */
}

.export-menu-separator {
  height: 1px;
  background: #E2E8F0; /* slate-200 */
  margin: 4px 0;
}
```

---

## Icons

**Icon Library:** Lucide React

**Standard Sizes:**
| Context | Size | Usage |
|---------|------|-------|
| Inline | 12px | Badges, status indicators |
| Small | 14px | Toolbar buttons, tabs |
| Medium | 16px | List items, cards |
| Large | 20px | Headers, hero cards |
| XL | 24px | Empty states, hero icons |

**Common Icons:**
| Icon | Component | Usage |
|------|-----------|-------|
| `Table2` | Entity type | Tables, datasets |
| `GitBranch` | Lineage | Lineage queries |
| `ArrowUpRight` | Upstream | Upstream lineage |
| `ArrowDownRight` | Downstream | Downstream lineage |
| `Layers` | Full chain | Recursive lineage |
| `Network` | Graph | Lineage visualization |
| `FlaskConical` | Test | Test queries |
| `Sparkles` | Recommendations | Query suggestions |
| `Copy` | Copy action | Copy to clipboard |
| `Check` | Success | Confirmation |
| `AlertCircle` | Error/Warning | Errors, health checks |
| `ChevronRight` | Navigate | Expandable items |
| `ChevronDown` | Collapse | Collapsible sections |
| `X` | Close | Close buttons |
| `Play` | Run | Execute query |
| `Loader2` | Loading | Spinner (animate-spin) |

---

## Interaction Patterns

### 1. Query Card Click Flow
```
User clicks query card
  → Card shows hover state (blue border, icon highlight)
  → Switches to Test tab
  → Query loaded in editor
  → User sees "⌘+Enter to run" hint
```

### 2. Copy Action
```
User clicks copy button
  → Icon changes to checkmark (emerald)
  → Text changes to "Copied!"
  → Reverts after 2 seconds
```

### 3. Expandable Sections
```
Collapsed: ChevronRight icon
Expanded: ChevronDown icon (rotate-180)
Transition: 150ms ease
```

### 4. Tab Switching
```
Click tab → Active state applied immediately
Content → Switches without animation
Badge count → Updates dynamically
```

### 5. Hover States
```css
/* Standard transition for all interactive elements */
transition: all 150ms ease;

/* Button hover */
:hover {
  background: var(--hover-bg);
  color: var(--hover-color);
}

/* Card hover */
:hover {
  border-color: var(--hover-border);
  box-shadow: var(--hover-shadow);
}
```

### 6. Loading States
```css
/* Spinner */
.loading-spinner {
  animation: spin 1s linear infinite;
}

/* Disabled during load */
.loading-disabled {
  opacity: 0.5;
  pointer-events: none;
}
```

---

## Responsive Considerations

### Panel Width
- **Minimum:** 320px
- **Default:** 384px (w-96)
- **Maximum:** 480px (if needed)

### Breakpoints
| Breakpoint | Width | Behavior |
|------------|-------|----------|
| Mobile | < 640px | Panel becomes full-width overlay |
| Tablet | 640-1024px | Panel width 320px |
| Desktop | > 1024px | Panel width 384px |

---

## Accessibility

### Focus States
```css
:focus-visible {
  outline: 2px solid #3B82F6; /* blue-500 */
  outline-offset: 2px;
}
```

### ARIA Labels
- All buttons have `title` attributes
- Tabs use `role="tab"` and `aria-selected`
- Expandable sections use `aria-expanded`

### Keyboard Navigation
- Tab: Navigate between interactive elements
- Enter/Space: Activate buttons
- Escape: Close panels/modals
- ⌘+Enter: Run query

---

## Animation Timings

| Animation | Duration | Easing |
|-----------|----------|--------|
| Hover states | 150ms | ease |
| Tab transitions | 150ms | ease |
| Panel open/close | 200ms | ease-out |
| Chevron rotate | 150ms | ease |
| Icon scale | 200ms | ease |
| Fade in/out | 150ms | ease |

---

*Last updated: December 2024*
