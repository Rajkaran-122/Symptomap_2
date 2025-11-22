import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { AuthenticationError, AuthorizationError } from '../types';
import { logAuditEvent } from '../services/auditService';
import { getUserById } from '../services/userService';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        organizationId?: string;
        permissions: string[];
      };
    }
  }
}

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  organizationId?: string;
  permissions: string[];
  iat: number;
  exp: number;
}

/**
 * JWT Authentication Middleware
 * Validates JWT tokens and populates req.user
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      throw new AuthenticationError('Access token required');
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
    
    // Check if user still exists and is active
    const user = await getUserById(decoded.userId);
    if (!user || !user.isActive) {
      throw new AuthenticationError('User not found or inactive');
    }

    // Set current user ID for RLS policies
    await setCurrentUserId(decoded.userId);

    // Populate request with user data
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      permissions: getUserPermissions(user.role)
    };

    // Log successful authentication
    await logAuditEvent({
      eventType: 'AUTHENTICATION_SUCCESS',
      eventCategory: 'authentication',
      eventAction: 'token_validation',
      userId: user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      resourceType: 'user',
      resourceId: user.id,
      outcome: 'success'
    });

    next();
  } catch (error) {
    // Log failed authentication
    await logAuditEvent({
      eventType: 'AUTHENTICATION_FAILURE',
      eventCategory: 'authentication',
      eventAction: 'token_validation',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      outcome: 'failure',
      errorMessage: error.message
    });

    if (error instanceof jwt.JsonWebTokenError) {
      return next(new AuthenticationError('Invalid token'));
    }
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AuthenticationError('Token expired'));
    }
    
    next(error);
  }
};

/**
 * Optional authentication middleware
 * Populates req.user if token is present but doesn't require it
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
      const user = await getUserById(decoded.userId);
      
      if (user && user.isActive) {
        await setCurrentUserId(decoded.userId);
        req.user = {
          id: user.id,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
          permissions: getUserPermissions(user.role)
        };
      }
    }

    next();
  } catch (error) {
    // Silently continue without authentication
    next();
  }
};

/**
 * Role-based authorization middleware
 */
export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      logAuditEvent({
        eventType: 'AUTHORIZATION_FAILURE',
        eventCategory: 'authorization',
        eventAction: 'role_check',
        userId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        eventData: { requiredRoles: roles, userRole: req.user.role },
        outcome: 'failure'
      });

      return next(new AuthorizationError(`Required role: ${roles.join(' or ')}`));
    }

    next();
  };
};

/**
 * Permission-based authorization middleware
 */
export const requirePermission = (resource: string, action: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'));
    }

    const permission = `${resource}:${action}`;
    if (!req.user.permissions.includes(permission)) {
      logAuditEvent({
        eventType: 'AUTHORIZATION_FAILURE',
        eventCategory: 'authorization',
        eventAction: 'permission_check',
        userId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        eventData: { requiredPermission: permission, userPermissions: req.user.permissions },
        outcome: 'failure'
      });

      return next(new AuthorizationError(`Required permission: ${permission}`));
    }

    next();
  };
};

/**
 * Organization-based authorization middleware
 * Ensures users can only access resources from their organization
 */
export const requireSameOrganization = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    return next(new AuthenticationError('Authentication required'));
  }

  // Super admins can access all organizations
  if (req.user.role === 'super_admin') {
    return next();
  }

  const resourceOrgId = req.params.organizationId || req.body.organizationId;
  if (resourceOrgId && resourceOrgId !== req.user.organizationId) {
    logAuditEvent({
      eventType: 'AUTHORIZATION_FAILURE',
      eventCategory: 'authorization',
      eventAction: 'organization_check',
      userId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      eventData: { 
        userOrganizationId: req.user.organizationId, 
        resourceOrganizationId: resourceOrgId 
      },
      outcome: 'failure'
    });

    return next(new AuthorizationError('Access denied: different organization'));
  }

  next();
};

/**
 * Rate limiting middleware
 */
export const rateLimit = (maxRequests: number, windowMs: number) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.user?.id || req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean up old entries
    for (const [k, v] of requests.entries()) {
      if (v.resetTime < now) {
        requests.delete(k);
      }
    }

    const userRequests = requests.get(key);
    
    if (!userRequests) {
      requests.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (userRequests.resetTime < now) {
      requests.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (userRequests.count >= maxRequests) {
      logAuditEvent({
        eventType: 'RATE_LIMIT_EXCEEDED',
        eventCategory: 'security',
        eventAction: 'rate_limit_check',
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        eventData: { 
          maxRequests, 
          currentRequests: userRequests.count,
          windowMs 
        },
        outcome: 'failure'
      });

      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((userRequests.resetTime - now) / 1000)
      });
    }

    userRequests.count++;
    next();
  };
};

/**
 * Get user permissions based on role
 */
function getUserPermissions(role: string): string[] {
  const permissions: Record<string, string[]> = {
    viewer: [
      'outbreak_reports:read',
      'diseases:read',
      'map_annotations:read',
      'predictions:read'
    ],
    analyst: [
      'outbreak_reports:read',
      'outbreak_reports:create',
      'outbreak_reports:update',
      'diseases:read',
      'map_annotations:read',
      'map_annotations:create',
      'map_annotations:update',
      'predictions:read',
      'exports:create'
    ],
    admin: [
      'outbreak_reports:read',
      'outbreak_reports:create',
      'outbreak_reports:update',
      'outbreak_reports:delete',
      'diseases:read',
      'diseases:create',
      'diseases:update',
      'map_annotations:read',
      'map_annotations:create',
      'map_annotations:update',
      'map_annotations:delete',
      'predictions:read',
      'exports:create',
      'users:read',
      'users:create',
      'users:update',
      'organizations:read',
      'organizations:update'
    ],
    super_admin: [
      'outbreak_reports:read',
      'outbreak_reports:create',
      'outbreak_reports:update',
      'outbreak_reports:delete',
      'diseases:read',
      'diseases:create',
      'diseases:update',
      'diseases:delete',
      'map_annotations:read',
      'map_annotations:create',
      'map_annotations:update',
      'map_annotations:delete',
      'predictions:read',
      'predictions:create',
      'exports:create',
      'users:read',
      'users:create',
      'users:update',
      'users:delete',
      'organizations:read',
      'organizations:create',
      'organizations:update',
      'organizations:delete',
      'system:admin',
      'audit_logs:read'
    ]
  };

  return permissions[role] || [];
}

/**
 * Set current user ID for RLS policies
 */
async function setCurrentUserId(userId: string): Promise<void> {
  // This would be implemented with a database connection
  // For now, we'll use a simple approach
  // In production, this would use a connection pool with user context
  process.env.CURRENT_USER_ID = userId;
}