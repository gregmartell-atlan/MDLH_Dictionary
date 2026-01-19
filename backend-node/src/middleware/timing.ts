/**
 * Timing Middleware
 * Request logging and performance tracking
 */

import type { Request, Response, NextFunction } from 'express';

/**
 * Log request timing and details
 */
export function requestTiming(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const requestId = generateRequestId();
  
  // Attach request ID for correlation
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  
  // Log request start
  const logPrefix = `[${requestId}]`;
  console.log(`${logPrefix} ${req.method} ${req.path} - started`);
  
  // Hook into response finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const statusIndicator = status >= 400 ? '❌' : '✅';
    
    console.log(
      `${logPrefix} ${req.method} ${req.path} - ${statusIndicator} ${status} (${duration}ms)`
    );
  });
  
  next();
}

/**
 * Generate a short unique request ID
 */
function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 10);
}
