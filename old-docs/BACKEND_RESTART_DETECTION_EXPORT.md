# Backend Restart Detection - Code Export

**Date:** December 6, 2024  
**Purpose:** Automatically detect backend restarts and clear stale sessions to prevent "zombie session" issues.

---

## Problem Solved

When the backend restarts:
- Its in-memory session store is wiped
- Frontend still has a `sessionId` in `sessionStorage`
- API calls fail mysteriously because the session doesn't exist
- Previously required manually killing the backend

**After this fix:** Backend restart is auto-detected, stale session is cleared, user sees "Not connected" and can cleanly reconnect.

---

## Files Changed

1. `backend/app/main.py` - Add SERVER_INSTANCE_ID
2. `backend/app/routers/connection.py` - Graceful unknown session handling
3. `src/hooks/useBackendInstanceGuard.js` - NEW: Detect backend restarts
4. `src/hooks/useSnowflake.js` - Listen for session-cleared events
5. `src/App.jsx` - Wire up the guard hook

---

## 1. backend/app/main.py

### Changes Made

```python
"""FastAPI application entry point."""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
import uvicorn
import time
import uuid  # <-- ADDED
from datetime import datetime

from app.config import settings

# =============================================================================
# SERVER INSTANCE ID - NEW
# =============================================================================
# This ID changes every time the backend process restarts.
# Frontend uses this to detect backend restarts and clear stale sessions.
SERVER_INSTANCE_ID = str(uuid.uuid4())
SERVER_START_TIME = datetime.utcnow().isoformat() + "Z"

# ... rest of file unchanged until health endpoint ...

@app.get("/health")
async def health_check():
    """
    Health check endpoint.
    
    Returns the server instance ID which changes on every backend restart.
    Frontend uses this to detect restarts and clear stale sessions.
    """
    return {
        "status": "healthy",
        "serverInstanceId": SERVER_INSTANCE_ID,  # <-- ADDED
        "startedAt": SERVER_START_TIME,          # <-- ADDED
    }
```

---

## 2. backend/app/routers/connection.py

### Changes Made (session status endpoint)

```python
@router.get("/session/status")
async def get_session_status(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
):
    """
    Check if a session is still valid.
    
    Response codes:
    - 200 { valid: true, ... } -> session good
    - 401 { valid: false, reason: "SESSION_NOT_FOUND" } -> session unknown (e.g., backend restarted)
    - 401 { valid: false, reason: "auth-error" } -> session truly dead (Snowflake rejected)
    - 503 { valid: true, reason: "snowflake-unreachable" } -> backend/Snowflake unreachable
    
    Frontend should treat 401 as "please reconnect" and 503 as "try again later".
    """
    if not x_session_id:
        logger.debug("[SessionStatus] No session ID provided")
        return JSONResponse(
            status_code=401,
            content={"valid": False, "reason": "NO_SESSION_ID", "message": "No session ID provided"}
        )
    
    session = session_manager.get_session(x_session_id)
    if session is None:
        # This is the key case: frontend has a stale session ID (e.g., backend restarted)
        # Return 401 with a clear reason so frontend knows to prompt for reconnect
        logger.info(f"[SessionStatus] Session {x_session_id[:8]}... not found (backend may have restarted)")
        return JSONResponse(
            status_code=401,
            content={"valid": False, "reason": "SESSION_NOT_FOUND", "message": "Session not found - please reconnect"}
        )
    
    # ... rest of existing logic unchanged ...
```

---

## 3. src/hooks/useBackendInstanceGuard.js (NEW FILE)

```javascript
/**
 * useBackendInstanceGuard Hook
 * 
 * Detects when the backend has restarted and clears stale sessions.
 * 
 * The backend generates a unique SERVER_INSTANCE_ID on startup.
 * When the frontend loads, it compares the current backend instance ID
 * to the one it saw last time. If they differ, the backend has restarted
 * and any stored session ID is stale.
 * 
 * This prevents the "zombie session" problem where:
 * - Backend restarts (losing all session state)
 * - Frontend still has a sessionId in sessionStorage
 * - API calls fail mysteriously because the session doesn't exist
 * 
 * Result: After backend restart, user sees "Not connected" and can cleanly reconnect.
 */

import { useEffect, useRef } from 'react';
import { createLogger } from '../utils/logger';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Keys in sessionStorage
const BACKEND_INSTANCE_KEY = 'MDLH_BACKEND_INSTANCE_ID';
const SESSION_KEY = 'snowflake_session'; // Must match useSnowflake.js

const log = createLogger('BackendGuard');

/**
 * Hook that runs on app load to detect backend restarts.
 * 
 * If the backend has restarted since last visit:
 * - Clears the stale session from sessionStorage
 * - User will see "Not connected" state and can reconnect cleanly
 * 
 * Usage:
 * ```jsx
 * function App() {
 *   useBackendInstanceGuard();
 *   // rest of app...
 * }
 * ```
 */
export function useBackendInstanceGuard() {
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    // Only run once per app mount
    if (hasCheckedRef.current) {
      return;
    }
    hasCheckedRef.current = true;

    async function checkBackendInstance() {
      try {
        const res = await fetch(`${API_URL}/health`, {
          // Short timeout - this is just a quick check
          signal: AbortSignal.timeout(5000),
        });

        if (!res.ok) {
          log.warn('Health check failed', { status: res.status });
          return;
        }

        const data = await res.json();
        const newInstanceId = data.serverInstanceId;

        if (!newInstanceId) {
          log.debug('No serverInstanceId in health response (old backend?)');
          return;
        }

        const storedInstanceId = window.sessionStorage.getItem(BACKEND_INSTANCE_KEY);

        // First run: just store the instance ID
        if (!storedInstanceId) {
          log.info('First visit - storing backend instance ID', { 
            instanceId: newInstanceId.substring(0, 8) + '...' 
          });
          window.sessionStorage.setItem(BACKEND_INSTANCE_KEY, newInstanceId);
          return;
        }

        // Check if backend restarted
        if (storedInstanceId !== newInstanceId) {
          log.warn('Backend restarted - clearing stale session', {
            oldInstance: storedInstanceId.substring(0, 8) + '...',
            newInstance: newInstanceId.substring(0, 8) + '...',
          });

          // Clear the stale session
          const hadSession = !!window.sessionStorage.getItem(SESSION_KEY);
          window.sessionStorage.removeItem(SESSION_KEY);
          
          // Store the new instance ID
          window.sessionStorage.setItem(BACKEND_INSTANCE_KEY, newInstanceId);

          if (hadSession) {
            log.info('Stale session cleared - user will need to reconnect');
            
            // Dispatch a custom event so components can react
            window.dispatchEvent(new CustomEvent('snowflake-session-cleared', {
              detail: { reason: 'backend-restart' }
            }));
          }
        } else {
          log.debug('Backend instance unchanged', { 
            instanceId: newInstanceId.substring(0, 8) + '...' 
          });
        }
      } catch (err) {
        // If health check fails, don't worry about it
        // The regular connection flow will handle errors
        if (err.name === 'TimeoutError' || err.name === 'AbortError') {
          log.debug('Health check timed out - backend may be slow/unreachable');
        } else {
          log.debug('Health check failed', { error: err.message });
        }
      }
    }

    checkBackendInstance();
  }, []);
}

/**
 * Utility to manually check if the backend has restarted.
 * Useful for programmatic checks outside React.
 * 
 * @returns {Promise<{restarted: boolean, cleared: boolean}>}
 */
export async function checkBackendRestart() {
  try {
    const res = await fetch(`${API_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return { restarted: false, cleared: false };
    }

    const data = await res.json();
    const newInstanceId = data.serverInstanceId;

    if (!newInstanceId) {
      return { restarted: false, cleared: false };
    }

    const storedInstanceId = window.sessionStorage.getItem(BACKEND_INSTANCE_KEY);

    if (!storedInstanceId) {
      window.sessionStorage.setItem(BACKEND_INSTANCE_KEY, newInstanceId);
      return { restarted: false, cleared: false };
    }

    if (storedInstanceId !== newInstanceId) {
      const hadSession = !!window.sessionStorage.getItem(SESSION_KEY);
      window.sessionStorage.removeItem(SESSION_KEY);
      window.sessionStorage.setItem(BACKEND_INSTANCE_KEY, newInstanceId);
      
      return { restarted: true, cleared: hadSession };
    }

    return { restarted: false, cleared: false };
  } catch {
    return { restarted: false, cleared: false };
  }
}

export default useBackendInstanceGuard;
```

---

## 4. src/hooks/useSnowflake.js

### Changes Made (in useConnection hook)

```javascript
// Added event listener for session-cleared events
useEffect(() => {
  function handleSessionCleared(event) {
    connectionLog.info('Session cleared by external event', { reason: event.detail?.reason });
    consecutiveStatusTimeoutsRef.current = 0;
    setStatus({ connected: false, unreachable: false });
    setError(null);
  }

  window.addEventListener('snowflake-session-cleared', handleSessionCleared);
  return () => {
    window.removeEventListener('snowflake-session-cleared', handleSessionCleared);
  };
}, []);

// Also added getSessionId to the return value
return { status, testConnection, disconnect, loading, error, getSessionId: () => getSessionId() };
```

---

## 5. src/App.jsx

### Changes Made

```javascript
// Added import
import { useBackendInstanceGuard } from './hooks/useBackendInstanceGuard';

// In App component - FIRST thing before any other hooks
export default function App() {
  // =========================================================================
  // Backend Restart Detection
  // =========================================================================
  // This MUST be first - it clears stale sessions before any other hooks run
  useBackendInstanceGuard();
  
  // ... rest of component unchanged ...
}
```

---

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│ App loads                                                   │
├─────────────────────────────────────────────────────────────┤
│ 1. useBackendInstanceGuard() runs                           │
│    └─► Fetches /health for serverInstanceId                 │
│                                                             │
│ 2. Compare with stored MDLH_BACKEND_INSTANCE_ID             │
│    ├─► Same → No action needed                              │
│    └─► Different → Backend restarted!                       │
│        └─► Clear snowflake_session from sessionStorage      │
│        └─► Dispatch 'snowflake-session-cleared' event       │
│                                                             │
│ 3. useConnection() receives event                           │
│    └─► Sets status = { connected: false }                   │
│                                                             │
│ 4. UI shows "Not connected" → User clicks Connect           │
│    └─► Fresh SSO flow, new session, everything works        │
└─────────────────────────────────────────────────────────────┘
```

---

## Testing Checklist

- [ ] Start backend, connect in UI, verify session works
- [ ] Restart backend (Ctrl+C, then start again)
- [ ] Refresh UI - should see "Not connected" (not broken state)
- [ ] Click Connect - should work normally
- [ ] Check console logs for `[BackendGuard]` messages

---

## SessionStorage Keys Used

| Key | Purpose |
|-----|---------|
| `MDLH_BACKEND_INSTANCE_ID` | Stores the last-seen backend instance ID |
| `snowflake_session` | Stores the Snowflake session data |

---

## API Changes

### GET /health

**Before:**
```json
{ "status": "healthy" }
```

**After:**
```json
{
  "status": "healthy",
  "serverInstanceId": "abc123-def456-...",
  "startedAt": "2024-12-06T12:00:00.000Z"
}
```

### GET /api/session/status (when session not found)

**Before:** Could return various errors

**After:**
```json
{
  "valid": false,
  "reason": "SESSION_NOT_FOUND",
  "message": "Session not found - please reconnect"
}
```
Status code: `401`

