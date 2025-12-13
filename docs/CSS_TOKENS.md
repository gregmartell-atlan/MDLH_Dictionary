# CSS Design Tokens

## Copy-Paste Ready CSS Variables

```css
:root {
  /* ============================================
     PRIMARY COLORS
     ============================================ */
  --color-primary: #3366FF;
  --color-primary-light: #EBF0FF;
  --color-primary-dark: #254EDB;
  --color-primary-hover: #2952CC;

  /* ============================================
     SLATE GRAY SCALE
     ============================================ */
  --color-slate-50: #F8FAFC;
  --color-slate-100: #F1F5F9;
  --color-slate-200: #E2E8F0;
  --color-slate-300: #CBD5E1;
  --color-slate-400: #94A3B8;
  --color-slate-500: #64748B;
  --color-slate-600: #475569;
  --color-slate-700: #334155;
  --color-slate-800: #1E293B;
  --color-slate-900: #0F172A;

  /* ============================================
     BLUE SCALE (for active/hover states)
     ============================================ */
  --color-blue-50: #EFF6FF;
  --color-blue-100: #DBEAFE;
  --color-blue-200: #BFDBFE;
  --color-blue-300: #93C5FD;
  --color-blue-400: #60A5FA;
  --color-blue-500: #3B82F6;
  --color-blue-600: #2563EB;
  --color-blue-700: #1D4ED8;

  /* ============================================
     SEMANTIC COLORS
     ============================================ */
  /* Success */
  --color-success: #2DA44E;
  --color-success-bg: #DAFBE1;
  --color-success-light: #ECFDF5;

  /* Error */
  --color-error: #CF222E;
  --color-error-bg: #FFEBE9;

  /* Warning */
  --color-warning: #BF8700;
  --color-warning-bg: #FFF8C5;

  /* Info */
  --color-info: #0969DA;
  --color-info-bg: #DDF4FF;

  /* ============================================
     ACCENT COLORS
     ============================================ */
  --color-emerald-500: #10B981;
  --color-emerald-700: #047857;
  --color-amber-500: #F59E0B;
  --color-indigo-50: #EEF2FF;

  /* ============================================
     TYPOGRAPHY
     ============================================ */
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'SF Mono', 'Fira Code', 'Consolas', monospace;

  --font-size-xs: 0.75rem;   /* 12px */
  --font-size-sm: 0.875rem;  /* 14px */
  --font-size-base: 1rem;    /* 16px */
  --font-size-lg: 1.125rem;  /* 18px */
  --font-size-xl: 1.25rem;   /* 20px */

  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  --line-height-tight: 1.25;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.625;

  /* ============================================
     SPACING
     ============================================ */
  --space-0: 0;
  --space-0-5: 0.125rem;  /* 2px */
  --space-1: 0.25rem;     /* 4px */
  --space-1-5: 0.375rem;  /* 6px */
  --space-2: 0.5rem;      /* 8px */
  --space-3: 0.75rem;     /* 12px */
  --space-4: 1rem;        /* 16px */
  --space-5: 1.25rem;     /* 20px */
  --space-6: 1.5rem;      /* 24px */
  --space-8: 2rem;        /* 32px */

  /* ============================================
     BORDER RADIUS
     ============================================ */
  --radius-sm: 0.25rem;   /* 4px */
  --radius-md: 0.375rem;  /* 6px */
  --radius-lg: 0.5rem;    /* 8px */
  --radius-xl: 0.75rem;   /* 12px */
  --radius-2xl: 1rem;     /* 16px */
  --radius-full: 9999px;

  /* ============================================
     SHADOWS
     ============================================ */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.03);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.05);
  --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
  --shadow-card: 0 4px 24px rgba(0,0,0,0.06), 0 1.5px 4px rgba(0,0,0,0.03);

  /* ============================================
     TRANSITIONS
     ============================================ */
  --transition-fast: 150ms ease;
  --transition-normal: 200ms ease;
  --transition-slow: 300ms ease;

  /* ============================================
     Z-INDEX SCALE
     ============================================ */
  --z-dropdown: 10;
  --z-sticky: 20;
  --z-fixed: 30;
  --z-modal-backdrop: 40;
  --z-modal: 50;
  --z-popover: 60;
  --z-tooltip: 70;
}
```

---

## Tailwind Config Reference

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#3366FF',
          light: '#EBF0FF',
          dark: '#254EDB',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['SF Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'card': '0 4px 24px rgba(0,0,0,0.06), 0 1.5px 4px rgba(0,0,0,0.03)',
      },
    },
  },
}
```

---

## Component-Specific Tokens

### Query Card
```css
.query-card {
  /* Default */
  --card-bg: white;
  --card-border: var(--color-slate-200);
  --card-radius: var(--radius-lg);
  --card-padding: var(--space-3);

  /* Icon */
  --icon-size: 32px;
  --icon-bg: var(--color-slate-100);
  --icon-color: var(--color-slate-500);
  --icon-radius: var(--radius-lg);

  /* Hover */
  --card-border-hover: var(--color-blue-300);
  --card-bg-hover: rgba(239, 246, 255, 0.3);
  --icon-bg-hover: var(--color-blue-100);
  --icon-color-hover: var(--color-blue-600);
}
```

### Tab Bar
```css
.tab-bar {
  --tab-padding-x: var(--space-2);
  --tab-padding-y: var(--space-3);
  --tab-font-size: var(--font-size-xs);
  --tab-font-weight: var(--font-weight-medium);

  /* Inactive */
  --tab-color: var(--color-slate-500);
  --tab-bg: transparent;

  /* Hover */
  --tab-color-hover: var(--color-slate-700);
  --tab-bg-hover: var(--color-slate-50);

  /* Active */
  --tab-color-active: var(--color-blue-600);
  --tab-bg-active: rgba(239, 246, 255, 0.5);
  --tab-border-active: var(--color-blue-600);
}
```

### Entity Header
```css
.entity-header {
  --header-padding: var(--space-4);
  --header-bg: rgba(248, 250, 252, 0.5);
  --header-border: var(--color-slate-100);

  /* Icon Box */
  --entity-icon-size: 40px;
  --entity-icon-bg: var(--color-blue-100);
  --entity-icon-color: var(--color-blue-600);
  --entity-icon-radius: var(--radius-lg);

  /* Title */
  --entity-title-size: var(--font-size-base);
  --entity-title-weight: var(--font-weight-semibold);
  --entity-title-color: var(--color-slate-900);

  /* Badge */
  --entity-badge-padding: 2px 8px;
  --entity-badge-size: var(--font-size-xs);
  --entity-badge-bg: var(--color-slate-100);
  --entity-badge-color: var(--color-slate-600);
}
```

### Hero Card
```css
.hero-card {
  --hero-padding: var(--space-4);
  --hero-radius: var(--radius-xl);
  --hero-bg: linear-gradient(to bottom right, #EFF6FF, #EEF2FF);
  --hero-border: var(--color-blue-200);

  /* Hover */
  --hero-border-hover: var(--color-blue-300);
  --hero-shadow-hover: var(--shadow-md);

  /* Icon Box */
  --hero-icon-size: 48px;
  --hero-icon-radius: var(--radius-xl);
  --hero-icon-bg: rgba(255, 255, 255, 0.8);
  --hero-icon-border: var(--color-blue-200);

  /* Chevron */
  --hero-chevron-color: var(--color-blue-400);
  --hero-chevron-transform: translateX(4px);
}
```

### Results Table
```css
.results-table {
  --table-border: var(--color-slate-200);
  --table-radius: var(--radius-lg);

  /* Header */
  --th-padding: var(--space-2) var(--space-3);
  --th-font-size: var(--font-size-xs);
  --th-font-weight: var(--font-weight-medium);
  --th-color: var(--color-slate-600);
  --th-bg: var(--color-slate-50);
  --th-border: var(--color-slate-200);

  /* Cells */
  --td-padding: var(--space-2) var(--space-3);
  --td-font-size: 13px;
  --td-color: var(--color-slate-800);
  --td-border: var(--color-slate-100);
  --td-max-width: 200px;

  /* Hover */
  --row-bg-hover: var(--color-slate-50);
}
```

---

## Icon Sizes

```css
:root {
  --icon-xs: 12px;   /* Inline badges, status */
  --icon-sm: 14px;   /* Toolbar, tabs */
  --icon-md: 16px;   /* List items, cards */
  --icon-lg: 20px;   /* Headers */
  --icon-xl: 24px;   /* Empty states, heroes */
  --icon-2xl: 32px;  /* Large empty states */
}
```

---

## Animation Keyframes

```css
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

---

## Utility Classes Quick Reference

```css
/* Layout */
.flex-center { display: flex; align-items: center; justify-content: center; }
.flex-between { display: flex; align-items: center; justify-content: space-between; }

/* Text Truncation */
.truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

/* Visibility */
.show-on-hover { opacity: 0; transition: opacity 150ms; }
.group:hover .show-on-hover { opacity: 1; }

/* Focus */
.focus-ring:focus-visible {
  outline: 2px solid var(--color-blue-500);
  outline-offset: 2px;
}
```

---

*Generated: December 2024*
