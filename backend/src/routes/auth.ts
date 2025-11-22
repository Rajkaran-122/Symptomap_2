import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { 
  authenticateToken, 
  rateLimit 
} from '../middleware/auth';
import { 
  validate, 
  loginSchema, 
  registerSchema, 
  refreshTokenSchema 
} from '../middleware/validation';
import { 
  AuthenticationError, 
  ValidationError, 
  ConflictError 
} from '../types';
import { logAuthentication, logSecurityEvent } from '../services/auditService';
import { UserService } from '../services/userService';

const router = Router();

// Initialize services
let userService: UserService;

export const initializeAuthRoutes = (pool: Pool): void => {
  userService = new UserService(pool);
};

/**
 * POST /api/v1/auth/login
 * User login
 */
router.post(
  '/login',
  rateLimit(5, 15 * 60 * 1000), // 5 attempts per 15 minutes
  validate(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, rememberMe = false } = req.body;

      // Get user by email
      const user = await userService.getUserByEmail(email);
      if (!user || !user.isActive) {
        await logAuthentication('login', '', req.ip, req.get('User-Agent') || '', 'failure', 'User not found or inactive');
        throw new AuthenticationError('Invalid credentials');
      }

      // Check password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        await logAuthentication('login', user.id, req.ip, req.get('User-Agent') || '', 'failure', 'Invalid password');
        throw new AuthenticationError('Invalid credentials');
      }

      // Check if account is locked
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        await logSecurityEvent('ACCOUNT_LOCKED', 'login_attempt', user.id, req.ip, req.get('User-Agent'), 'failure', { lockedUntil: user.lockedUntil });
        throw new AuthenticationError('Account is temporarily locked due to too many failed login attempts');
      }

      // Reset failed login attempts on successful login
      if (user.failedLoginAttempts > 0) {
        await userService.resetFailedLoginAttempts(user.id);
      }

      // Generate tokens
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      // Update last login
      await userService.updateLastLogin(user.id);

      // Log successful login
      await logAuthentication('login', user.id, req.ip, req.get('User-Agent') || '', 'success');

      res.json({
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          organizationId: user.organizationId,
          mfaEnabled: user.mfaEnabled,
          lastLogin: user.lastLogin
        },
        expiresIn: 3600, // 1 hour
        sessionTimeout: rememberMe ? 7 * 24 * 3600 : 15 * 60 // 7 days or 15 minutes
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/auth/register
 * User registration
 */
router.post(
  '/register',
  rateLimit(3, 60 * 60 * 1000), // 3 registrations per hour
  validate(registerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, firstName, lastName, organizationId } = req.body;

      // Check if user already exists
      const existingUser = await userService.getUserByEmail(email);
      if (existingUser) {
        throw new ConflictError('User with this email already exists');
      }

      // Hash password
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Create user
      const user = await userService.createUser({
        email,
        passwordHash,
        firstName,
        lastName,
        organizationId,
        role: 'viewer' // Default role
      });

      // Generate tokens
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      // Log registration
      await logAuthentication('register', user.id, req.ip, req.get('User-Agent') || '', 'success');

      res.status(201).json({
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          organizationId: user.organizationId,
          mfaEnabled: user.mfaEnabled,
          lastLogin: user.lastLogin
        },
        expiresIn: 3600,
        sessionTimeout: 15 * 60
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/auth/refresh
 * Refresh access token
 */
router.post(
  '/refresh',
  validate(refreshTokenSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;
      
      // Get user
      const user = await userService.getUserById(decoded.userId);
      if (!user || !user.isActive) {
        throw new AuthenticationError('Invalid refresh token');
      }

      // Generate new access token
      const newAccessToken = generateAccessToken(user);

      // Log token refresh
      await logAuthentication('token_refresh', user.id, req.ip, req.get('User-Agent') || '', 'success');

      res.json({
        accessToken: newAccessToken,
        expiresIn: 3600
      });
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        await logSecurityEvent('INVALID_REFRESH_TOKEN', 'token_refresh', undefined, req.ip, req.get('User-Agent'), 'failure', { error: error.message });
        return next(new AuthenticationError('Invalid refresh token'));
      }
      next(error);
    }
  }
);

/**
 * POST /api/v1/auth/logout
 * User logout
 */
router.post(
  '/logout',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // In a real implementation, you would invalidate the refresh token
      // by storing it in a blacklist or removing it from the database
      
      // Log logout
      await logAuthentication('logout', req.user!.id, req.ip, req.get('User-Agent') || '', 'success');

      res.json({
        message: 'Logged out successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/auth/me
 * Get current user profile
 */
router.get(
  '/me',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await userService.getUserById(req.user!.id);
      if (!user) {
        throw new AuthenticationError('User not found');
      }

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId: user.organizationId,
        mfaEnabled: user.mfaEnabled,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/v1/auth/me
 * Update current user profile
 */
router.put(
  '/me',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { firstName, lastName } = req.body;
      
      const updatedUser = await userService.updateUser(req.user!.id, {
        firstName,
        lastName
      });

      res.json({
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        organizationId: updatedUser.organizationId,
        mfaEnabled: updatedUser.mfaEnabled,
        lastLogin: updatedUser.lastLogin,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/auth/change-password
 * Change user password
 */
router.post(
  '/change-password',
  authenticateToken,
  rateLimit(5, 60 * 60 * 1000), // 5 attempts per hour
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        throw new ValidationError('Current password and new password are required', 'password', '', 'required');
      }

      if (newPassword.length < 8) {
        throw new ValidationError('New password must be at least 8 characters', 'newPassword', newPassword, 'min_length');
      }

      // Get user
      const user = await userService.getUserById(req.user!.id);
      if (!user) {
        throw new AuthenticationError('User not found');
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValidPassword) {
        await logSecurityEvent('INVALID_PASSWORD_CHANGE', 'password_change', user.id, req.ip, req.get('User-Agent'), 'failure', { reason: 'Invalid current password' });
        throw new AuthenticationError('Current password is incorrect');
      }

      // Hash new password
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await userService.updateUserPassword(user.id, newPasswordHash);

      // Log password change
      await logAuthentication('password_change', user.id, req.ip, req.get('User-Agent') || '', 'success');

      res.json({
        message: 'Password changed successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/auth/forgot-password
 * Request password reset
 */
router.post(
  '/forgot-password',
  rateLimit(3, 60 * 60 * 1000), // 3 requests per hour
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;

      if (!email) {
        throw new ValidationError('Email is required', 'email', '', 'required');
      }

      // Check if user exists
      const user = await userService.getUserByEmail(email);
      if (!user) {
        // Don't reveal if user exists or not for security
        res.json({
          message: 'If an account with that email exists, a password reset link has been sent',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Generate reset token (in a real implementation, you would store this in the database)
      const resetToken = jwt.sign(
        { userId: user.id, type: 'password_reset' },
        process.env.JWT_SECRET!,
        { expiresIn: '1h' }
      );

      // In a real implementation, you would send an email with the reset link
      // For now, we'll just log it
      console.log(`Password reset token for ${email}: ${resetToken}`);

      // Log password reset request
      await logSecurityEvent('PASSWORD_RESET_REQUESTED', 'forgot_password', user.id, req.ip, req.get('User-Agent'), 'success', { email });

      res.json({
        message: 'If an account with that email exists, a password reset link has been sent',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Generate access token
 */
function generateAccessToken(user: any): string {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      permissions: getUserPermissions(user.role)
    },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
  );
}

/**
 * Generate refresh token
 */
function generateRefreshToken(user: any): string {
  return jwt.sign(
    { userId: user.id, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
}

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

export default router;
