# Gold Layer Integration - Visual Examples

This document shows where and how Gold Layer queries appear throughout the MDLH Explorer app.

## 🎯 Quick Access

To see the demo page, add this route to your app:
```jsx
import GoldLayerDemo from './components/examples/GoldLayerDemo';

// In your router:
<Route path="/gold-demo" element={<GoldLayerDemo />} />
```

Or import it directly in any component to see examples.

---

## 📍 Where Gold Layer Appears

### 1. **Sidebar Navigation**
```
┌─────────────────────────┐
│ HOME                     │
│ GOLD LAYER  ⭐          │ ← New section at top
│   Gold Layer            │
│                         │
│ BROWSE                  │
│   Core                  │
│   Glossary              │
│   ...                   │
└─────────────────────────┘
```

### 2. **Query Editor Template Selector**

When you click the template button in Query Editor:

```
┌─────────────────────────────────────┐
│ Search templates...                 │
├─────────────────────────────────────┤
│ ⭐ GOLD LAYER (Curated)  [amber]   │ ← Featured section
│   ⭐ General Asset Slice            │
│   ⭐ Readme-Enriched Assets         │
│   ⭐ Relational Profile             │
├─────────────────────────────────────┤
│ Structure                            │
│   Popular Tables                     │
│   Column Types                       │
└─────────────────────────────────────┘
```

### 3. **Query Library Cards**

Gold queries have distinctive badges:

```
┌─────────────────────────────────────────────┐
│ [⭐ Gold] General Asset Slice        [Run] │
│ Browse Snowflake tables... (ASSETS, README) │
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ SELECT ASSET_NAME, GUID, ...         │   │
│ │ FROM GOLD.ASSETS                     │   │
│ │ WHERE ASSET_TYPE IN ('Table','View') │   │
│ └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### 4. **Query Library Landing Page**

When you select "Gold Layer" category:

```
┌─────────────────────────────────────────────┐
│ ⭐ Gold Layer Queries                       │
│ Curated, production-ready queries using     │
│ optimized GOLD schema views                 │
│                                             │
│ [GOLD.ASSETS] [GOLD.FULL_LINEAGE] ...      │
│ [Explore Queries]                          │
└─────────────────────────────────────────────┘
```

---

## 🎨 Badge Variants

### Default Badge
```
[⭐ Gold]
```
Used in query cards, headers

### Compact Badge
```
[⭐]
```
Used in lists, compact views

### Glow Badge (Animated)
```
[⭐ Gold] ← Pulsing glow effect
```
Used for emphasis, featured queries

### Premium Badge
```
[👑 Gold] ← With gradient border
```
Used for special highlights

---

## 💡 Smart Features

### Auto-Detection
The app automatically detects Gold Layer queries:
```javascript
isGoldLayerQuery(sql) // Returns true if query uses GOLD.* tables
getGoldTablesFromQuery(sql) // Returns ['GOLD.ASSETS', 'GOLD.README']
```

### Recommendations
When you write a raw entity query, the app can suggest a Gold Layer alternative:
```
┌─────────────────────────────────────────────┐
│ ⚡ Gold Layer Alternative Available          │
│ A curated, optimized version exists...       │
│                                             │
│ [Use Gold Query] [Keep Original]             │
└─────────────────────────────────────────────┘
```

---

## 📊 Query Examples

### Raw Entity Query (Before)
```sql
SELECT NAME, GUID, TYPENAME, QUALIFIEDNAME
FROM TABLE_ENTITY
WHERE CONNECTORNAME = 'snowflake'
```

### Gold Layer Query (After)
```sql
SELECT ASSET_NAME, GUID, ASSET_TYPE, ASSET_QUALIFIED_NAME
FROM GOLD.ASSETS
WHERE ASSET_TYPE IN ('Table','View') 
  AND CONNECTOR_NAME = 'snowflake'
```

**Benefits:**
- ✅ Pre-joined with enrichments
- ✅ Consistent naming (ASSET_NAME vs NAME)
- ✅ Includes README, tags, popularity in one query
- ✅ Production-ready and optimized

---

## 🎯 All 22 Gold Layer Queries

### Gold Assets (3)
1. General Asset Slice
2. Readme-Enriched Assets
3. Relational Profile

### Gold Lineage (6)
4. Base Lineage (Upstream + Downstream)
5. Downstream Dashboards for a Table
6. Column-Level Impact Analysis
7. Full Lineage Export (Enriched)
8. Pipeline Touchpoints (dbt/Airflow/Matillion)
9. Notification List (Owners to Ping)

### Gold Governance (4)
10. Tag Inventory (PII/Confidential)
11. Custom Metadata Values
12. Data Mesh Overview
13. Tag Propagation Across Lineage

### Gold Glossary (2)
14. Glossary Terms + Assignments
15. Term Rollup with Glossary Details

### Gold Quality (1)
16. Data Quality Checks (Anomalo/Soda/MC)

### Gold Completeness (2)
17. Enrichment Coverage by Asset Type
18. Base Metadata Export (Doc-Friendly)

### Gold History (3)
19. Latest Snapshot for an Asset
20. Certification Trend (Daily)
21. Changes by User in Time Window

---

## 🚀 Usage in Code

### Import Components
```javascript
import { 
  GoldBadge, 
  GoldLayerBanner,
  GoldQueryIndicator,
  isGoldLayerQuery 
} from './components/ui/GoldBadge';
```

### Use in Query Cards
```jsx
<QueryCard
  title="General Asset Slice"
  query={goldQuery}
  goldTables={['GOLD.ASSETS', 'GOLD.README']}
  // Badge automatically appears!
/>
```

### Check if Query is Gold
```javascript
if (isGoldLayerQuery(userQuery)) {
  // Show Gold badge, premium styling, etc.
}
```

---

## 🎨 Color Scheme

- **Primary**: Amber/Yellow (`amber-500`, `yellow-400`)
- **Background**: `from-amber-50 to-yellow-50`
- **Text**: `text-amber-700`, `text-amber-900`
- **Borders**: `border-amber-200`, `border-amber-300`
- **Icons**: Sparkles (⭐), Crown (👑)

---

## 📝 Next Steps

1. **View the Demo**: Navigate to `/gold-demo` (if route added)
2. **Try in Query Editor**: Click template button → See Gold queries at top
3. **Browse Gold Category**: Select "Gold Layer" from sidebar
4. **Run a Gold Query**: Click any Gold query → See badge in results

---

## 🔗 Related Files

- `src/data/goldLayerQueries.js` - All 22 queries
- `src/components/ui/GoldBadge.jsx` - Badge components
- `src/components/QueryEditor.jsx` - Template selector integration
- `src/components/QueryLibraryLayout.jsx` - Query card badges
- `src/components/examples/GoldLayerDemo.jsx` - Visual examples
