/**
 * Express Request Augmentation
 *
 * Extends the default Express Request type with application-specific properties.
 * This file must be included in tsconfig's `include` glob so TypeScript picks
 * it up automatically across all controllers and middlewares.
 *
 * Why: Without this, `req.user` and `req.correlationId` would be typed as `any`
 * or trigger TypeScript errors in strict mode, hiding real type violations.
 */

declare global {
  namespace Express {
    interface Request {
      /**
       * Populated by `authenticateToken` middleware after JWT verification.
       * Undefined on unauthenticated routes.
       */
      user?: AuthenticatedUser;

      /**
       * Unique request identifier injected by `requestCorrelation` middleware.
       * Used for distributed tracing and structured log correlation.
       */
      correlationId?: string;
    }
  }
}

/**
 * Represents the authenticated user payload extracted from the JWT token.
 * Mirrors the fields encoded during token signing in `auth.service.ts`.
 */
export interface AuthenticatedUser {
  /** Primary key from the `admins` table */
  id: number;
  /** Login username */
  username: string;
  /** Role-based access control: 'admin' | 'viewer' */
  role: string;
}

export {};
