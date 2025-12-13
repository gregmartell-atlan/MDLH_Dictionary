# Implementation Plan: Global Connection & Flyout Improvements

## Overview
Move Snowflake connection management to the global header and ensure flyout query editor properly uses the configured database/schema context.

---

## Part 1: Global Connection in Header

### 1.1 App.jsx - State & Imports
**Location:** Top of App.jsx

**Changes:**
- [x] Import `ConnectionModal` component
- [x] Import `useConnection` hook
- [x] Import additional icons (`Snowflake`, `Wifi`, `WifiOff`)
- [ ] Add `showConnectionModal` state
- [ ] Use `useConnection` hook at App level for global connection state

```javascript
// New state
const [showConnectionModal, setShowConnectionModal] = useState(false);

// Use connection hook at App level
const { 
  status: globalConnectionStatus, 
  testConnection, 
  loading: connectionLoading 
} = useConnection();
```

### 1.2 Header Connection Indicator Component
**Location:** New component in App.jsx (or separate file)

**Purpose:** Visual indicator showing connection status, clickable to open modal

**Design:**
```
Disconnected:  [🔴 Connect to Snowflake ▾]
Connected:     [🟢 FIELD_METADATA.PUBLIC ▾]  
Connecting:    [⟳ Connecting...]
```

**Component:**
```jsx
function ConnectionIndicator({ status, loading, onClick, database, schema }) {
  const isConnected = status?.connected;
  
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
        isConnected 
          ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
          : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
      }`}
    >
      {loading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : isConnected ? (
        <div className="w-2 h-2 rounded-full bg-green-500" />
      ) : (
        <div className="w-2 h-2 rounded-full bg-gray-400" />
      )}
      <span>
        {loading 
          ? 'Connecting...' 
          : isConnected 
            ? `${database || status.database}.${schema || status.schema}`
            : 'Connect to Snowflake'
        }
      </span>
      <ChevronDown size={14} />
    </button>
  );
}
```

### 1.3 Nav Bar Update
**Location:** `<nav>` element in App.jsx (~line 1441)

**Current:**
```jsx
<nav className="border-b border-gray-200 bg-white sticky top-0 z-30">
  <div className="...flex items-center justify-between">
    <div>atlan logo</div>
    <div>search bar</div>  // Only search currently
  </div>
</nav>
```

**Updated:**
```jsx
<nav className="border-b border-gray-200 bg-white sticky top-0 z-30">
  <div className="...flex items-center justify-between">
    <div>atlan logo</div>
    <div className="flex items-center gap-4">
      <ConnectionIndicator 
        status={globalConnectionStatus}
        loading={connectionLoading}
        onClick={() => setShowConnectionModal(true)}
        database={selectedMDLHDatabase}
        schema={selectedMDLHSchema}
      />
      <div>search bar</div>
    </div>
  </div>
</nav>
```

### 1.4 ConnectionModal at App Level
**Location:** End of App.jsx return, before closing `</div>`

```jsx
<ConnectionModal
  isOpen={showConnectionModal}
  onClose={() => setShowConnectionModal(false)}
  onConnect={(status) => {
    setShowConnectionModal(false);
    // Trigger table discovery after connection
  }}
  currentStatus={globalConnectionStatus}
/>
```

### 1.5 Connection Success Handler
**Purpose:** After successful connection, trigger table discovery

```javascript
const handleConnectionSuccess = useCallback((status) => {
  setShowConnectionModal(false);
  // Table discovery is already triggered by useEffect watching isConnected
}, []);
```

---

## Part 2: QueryEditor Updates

### 2.1 Remove Duplicate Connection Modal
**Location:** `QueryEditor.jsx`

**Changes:**
- Remove local `showConnectionModal` state
- Remove local `ConnectionModal` render
- Accept `onOpenConnectionModal` prop to open global modal
- Remove auto-open behavior on mount

**Props to add:**
```javascript
function QueryEditor({ 
  initialQuery = '',
  globalConnectionStatus,      // From App
  onOpenConnectionModal,       // Opens global modal
}) {
```

### 2.2 Update ConnectionBadge Click Handler
**Current:**
```jsx
<ConnectionBadge 
  status={connectionStatus} 
  onConnect={() => setShowConnectionModal(true)}  // Local modal
/>
```

**Updated:**
```jsx
<ConnectionBadge 
  status={globalConnectionStatus} 
  onConnect={onOpenConnectionModal}  // Opens global modal
/>
```

---

## Part 3: Flyout Query Editor Improvements

### 3.1 Display Current Context (DONE ✓)
Already fixed - shows `database.schema` from props

### 3.2 Add Context Badge
**Purpose:** Make it very clear which database/schema the query will run against

**Location:** FlyoutQueryEditor header area

```jsx
<div className="flex items-center gap-2 px-2 py-1 bg-blue-50 rounded text-xs">
  <Database size={12} className="text-blue-500" />
  <span className="text-blue-700 font-medium">
    {database}.{schema}
  </span>
</div>
```

### 3.3 Connection Warning
**Purpose:** If not connected, show clear warning with action

```jsx
{!isConnected && (
  <div className="mx-4 my-2 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
    <WifiOff size={16} className="text-amber-600" />
    <span className="text-sm text-amber-800">
      Not connected to Snowflake. Connect via the header to run queries.
    </span>
  </div>
)}
```

### 3.4 Sync with Hero Dropdowns
**Current behavior:** Flyout receives database/schema when opened
**Desired behavior:** If user changes dropdown while flyout is open, it should update

**Solution:** The props flow from App → QueryPanel → FlyoutQueryEditor, so changes to `selectedMDLHDatabase`/`selectedMDLHSchema` will automatically propagate.

---

## Part 4: Hero Section Database/Schema Selectors

### 4.1 Visual Connection to Global State
**Purpose:** Make it clear these selectors define the query context

**Add label:**
```jsx
<div className="flex items-center gap-3 mt-4">
  <span className="text-blue-200 text-sm flex items-center gap-1">
    <Database size={14} />
    Query Context:
  </span>
  <select value={selectedMDLHDatabase} ...>
  <select value={selectedMDLHSchema} ...>
</div>
```

### 4.2 Connection Status in Hero
**Add indicator showing if connected to selected database:**

```jsx
{isConnected ? (
  <span className="text-green-300 text-xs flex items-center gap-1">
    <Check size={12} /> Connected
  </span>
) : (
  <button 
    onClick={() => setShowConnectionModal(true)}
    className="text-blue-200 text-xs underline hover:text-white"
  >
    Connect to validate tables
  </button>
)}
```

---

## Implementation Order

### Phase 1: Global Connection (Priority: High)
1. [ ] Add `showConnectionModal` state to App.jsx
2. [ ] Create `ConnectionIndicator` component
3. [ ] Add indicator to nav bar
4. [ ] Render ConnectionModal at App level
5. [ ] Wire up connection success handler

### Phase 2: QueryEditor Cleanup (Priority: Medium)
6. [ ] Add props for global connection state
7. [ ] Remove local ConnectionModal
8. [ ] Update ConnectionBadge to use global modal
9. [ ] Remove auto-open on mount

### Phase 3: Flyout Improvements (Priority: Medium)
10. [ ] Add prominent context badge showing database.schema
11. [ ] Add connection warning banner when disconnected
12. [ ] Verify props update when hero dropdowns change

### Phase 4: Polish (Priority: Low)
13. [ ] Add visual connection between hero selectors and connection state
14. [ ] Add "Connect" prompt in hero when disconnected
15. [ ] Test all flows end-to-end

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/App.jsx` | Add ConnectionIndicator, modal state, nav bar update |
| `src/components/QueryEditor.jsx` | Remove local modal, accept global props |
| `src/components/FlyoutQueryEditor.jsx` | Add context badge, connection warning |
| `src/components/ConnectionModal.jsx` | No changes needed |

---

## Testing Checklist

- [ ] Can connect via header indicator
- [ ] Connection persists across tab changes
- [ ] QueryEditor shows global connection status
- [ ] Flyout shows correct database.schema context
- [ ] Flyout executes against configured database/schema
- [ ] Changing hero dropdowns updates flyout context
- [ ] Disconnecting shows appropriate warnings everywhere
- [ ] Session persists on page refresh

