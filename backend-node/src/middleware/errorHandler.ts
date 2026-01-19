/**
 * Error Handler Middleware
 * Global error handling for API
 */

import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Create common errors
 */
export const errors = {
  notFound: (resource: string) => new ApiError(404, `${resource} not found`),
  badRequest: (message: string) => new ApiError(400, message),
  unauthorized: (message = 'Unauthorized') => new ApiError(401, message),
  internal: (message: string) => new ApiError(500, message),
};

/**
 * Global error handler middleware
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log error for debugging
  console.error('[Error]', err.message);
  if (err.stack && process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      details: err.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  // Handle custom API errors
  if (err instanceof ApiError) {
    const responseBody: { success: boolean; error: string; details?: unknown } = {
      success: false,
      error: err.message,
    };
    if (err.details) {
      responseBody.details = err.details;
    }
    res.status(err.statusCode).json(responseBody);
    return;
  }

  // Handle unknown errors
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
  });
}

/**
 * Async handler wrapper to catch promise rejections
 */
export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
