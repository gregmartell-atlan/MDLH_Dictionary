/**
 * Auth Middleware
 * Session validation for API routes
 */

import type { Request, Response, NextFunction } from 'express';
import { checkSession } from '../services/snowflake.js';

// Extend Express Request to include session
declare global {
  namespace Express {
    interface Request {
      sessionId?: string;
    }
  }
}

/**
 * Validate session from X-Session-ID header
 * For evaluation routes, session is optional but recommended
 */
export function validateSession(req: Request, _res: Response, next: NextFunction): void {
  const sessionId = req.headers['x-session-id'] as string | undefined;
  
  if (sessionId) {
    req.sessionId = sessionId;
  }
  
  next();
}

/**
 * Require session - use for routes that need an active session
 */
export function requireSession(req: Request, res: Response, next: NextFunction): void {
  const sessionId = req.headers['x-session-id'] as string | undefined;
  
  if (!sessionId) {
    res.status(401).json({
      success: false,
      error: 'Session required. Provide X-Session-ID header.',
    });
    return;
  }

  checkSession(sessionId)
    .then((valid) => {
      if (!valid) {
        res.status(401).json({
          success: false,
          error: 'Invalid or expired session.',
        });
        return;
      }

      req.sessionId = sessionId;
      next();
    })
    .catch(() => {
      res.status(503).json({
        success: false,
        error: 'Session validation failed. Try again later.',
      });
    });
}
