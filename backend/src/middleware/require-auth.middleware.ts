/**
 * Authentication Middleware (Placeholder)
 *
 * Pass-through placeholder for authenticated routes. When cloud auth
 * services are restored, this should verify JWT tokens and attach
 * user info to the request.
 *
 * @module middleware/require-auth
 */

import type { Request, Response, NextFunction } from 'express';

/**
 * Placeholder auth middleware. Passes requests through without authentication.
 * TODO: Replace with a real authentication middleware when cloud services are restored.
 *
 * @param _req - Express request
 * @param _res - Express response
 * @param next - Express next function
 */
export const requireAuth = (_req: Request, _res: Response, next: NextFunction): void => {
  next();
};
