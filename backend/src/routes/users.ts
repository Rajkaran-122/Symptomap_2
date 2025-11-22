import { Router, Request, Response, NextFunction } from 'express';
import { 
  authenticateToken, 
  requireRole, 
  requirePermission,
  requireSameOrganization 
} from '../middleware/auth';
import { 
  validate, 
  validateQuery, 
  createUserSchema, 
  updateUserSchema,
  paginationSchema 
} from '../middleware/validation';
import { NotFoundError, AuthorizationError } from '../types';
import { logDataAccess } from '../services/auditService';
import { getUserService } from '../services/userService';

const router = Router();

/**
 * GET /api/v1/users
 * Get users with filtering and pagination
 */
router.get(
  '/',
  authenticateToken,
  requirePermission('users', 'read'),
  validateQuery(paginationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { limit, offset } = req.query as any;
      const { search, organizationId } = req.query as any;

      const userService = getUserService();
      let result;

      if (search) {
        // Search users
        const users = await userService.searchUsers(
          search, 
          req.user!.role === 'super_admin' ? organizationId : req.user!.organizationId,
          limit
        );
        result = { users, total: users.length };
      } else {
        // Get users by organization
        const orgId = req.user!.role === 'super_admin' ? organizationId : req.user!.organizationId;
        if (!orgId) {
          throw new AuthorizationError('Organization ID required');
        }

        result = await userService.getUsersByOrganization(orgId, limit, offset);
      }

      await logDataAccess(
        'users',
        'list',
        'read',
        req.user!.id,
        req.ip,
        req.get('User-Agent') || '',
        'success',
        { search, organizationId }
      );

      res.json({
        data: result.users,
        meta: {
          total: result.total,
          limit,
          offset,
          hasMore: offset + limit < result.total
        }
      });
    } catch (error) {
      await logDataAccess(
        'users',
        'list',
        'read',
        req.user!.id,
        req.ip,
        req.get('User-Agent') || '',
        'failure',
        { error: error.message }
      );
      next(error);
    }
  }
);

/**
 * GET /api/v1/users/:id
 * Get specific user
 */
router.get(
  '/:id',
  authenticateToken,
  requirePermission('users', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userService = getUserService();

      const user = await userService.getUserById(id);
      if (!user) {
        throw new NotFoundError('User', id);
      }

      // Check organization access
      if (user.organizationId !== req.user!.organizationId && req.user!.role !== 'super_admin') {
        throw new AuthorizationError('Access denied: different organization');
      }

      await logDataAccess(
        'users',
        id,
        'read',
        req.user!.id,
        req.ip,
        req.get('User-Agent') || '',
        'success'
      );

      // Remove sensitive data
      const { passwordHash, mfaSecret, failedLoginAttempts, lockedUntil, ...safeUser } = user;

      res.json({
        data: safeUser
      });
    } catch (error) {
      await logDataAccess(
        'users',
        req.params.id,
        'read',
        req.user!.id,
        req.ip,
        req.get('User-Agent') || '',
        'failure',
        { error: error.message }
      );
      next(error);
    }
  }
);

/**
 * POST /api/v1/users
 * Create new user
 */
router.post(
  '/',
  authenticateToken,
  requirePermission('users', 'create'),
  validate(createUserSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData = {
        ...req.body,
        organizationId: req.body.organizationId || req.user!.organizationId
      };

      // Check organization access
      if (userData.organizationId !== req.user!.organizationId && req.user!.role !== 'super_admin') {
        throw new AuthorizationError('Cannot create user in different organization');
      }

      const userService = getUserService();
      const user = await userService.createUser(userData);

      await logDataAccess(
        'users',
        user.id,
        'create',
        req.user!.id,
        req.ip,
        req.get('User-Agent') || '',
        'success',
        { email: user.email, role: user.role }
      );

      // Remove sensitive data
      const { passwordHash, mfaSecret, failedLoginAttempts, lockedUntil, ...safeUser } = user;

      res.status(201).json({
        data: safeUser
      });
    } catch (error) {
      await logDataAccess(
        'users',
        'new',
        'create',
        req.user!.id,
        req.ip,
        req.get('User-Agent') || '',
        'failure',
        { error: error.message, data: req.body }
      );
      next(error);
    }
  }
);

/**
 * PUT /api/v1/users/:id
 * Update user
 */
router.put(
  '/:id',
  authenticateToken,
  requirePermission('users', 'update'),
  validate(updateUserSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const userService = getUserService();
      const existingUser = await userService.getUserById(id);
      if (!existingUser) {
        throw new NotFoundError('User', id);
      }

      // Check organization access
      if (existingUser.organizationId !== req.user!.organizationId && req.user!.role !== 'super_admin') {
        throw new AuthorizationError('Access denied: different organization');
      }

      // Regular users can't change roles or organizations
      if (req.user!.role !== 'super_admin') {
        delete updateData.role;
        delete updateData.organizationId;
      }

      const user = await userService.updateUser(id, updateData);

      await logDataAccess(
        'users',
        id,
        'update',
        req.user!.id,
        req.ip,
        req.get('User-Agent') || '',
        'success',
        { changes: Object.keys(updateData) }
      );

      // Remove sensitive data
      const { passwordHash, mfaSecret, failedLoginAttempts, lockedUntil, ...safeUser } = user;

      res.json({
        data: safeUser
      });
    } catch (error) {
      await logDataAccess(
        'users',
        req.params.id,
        'update',
        req.user!.id,
        req.ip,
        req.get('User-Agent') || '',
        'failure',
        { error: error.message, data: req.body }
      );
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/users/:id
 * Deactivate user (soft delete)
 */
router.delete(
  '/:id',
  authenticateToken,
  requirePermission('users', 'delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const userService = getUserService();
      const existingUser = await userService.getUserById(id);
      if (!existingUser) {
        throw new NotFoundError('User', id);
      }

      // Check organization access
      if (existingUser.organizationId !== req.user!.organizationId && req.user!.role !== 'super_admin') {
        throw new AuthorizationError('Access denied: different organization');
      }

      // Can't delete yourself
      if (id === req.user!.id) {
        throw new AuthorizationError('Cannot delete your own account');
      }

      await userService.deactivateUser(id);

      await logDataAccess(
        'users',
        id,
        'delete',
        req.user!.id,
        req.ip,
        req.get('User-Agent') || '',
        'success'
      );

      res.status(204).send();
    } catch (error) {
      await logDataAccess(
        'users',
        req.params.id,
        'delete',
        req.user!.id,
        req.ip,
        req.get('User-Agent') || '',
        'failure',
        { error: error.message }
      );
      next(error);
    }
  }
);

/**
 * POST /api/v1/users/:id/reset-password
 * Reset user password (admin only)
 */
router.post(
  '/:id/reset-password',
  authenticateToken,
  requireRole('admin', 'super_admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 8) {
        throw new Error('New password must be at least 8 characters');
      }

      const userService = getUserService();
      const user = await userService.getUserById(id);
      if (!user) {
        throw new NotFoundError('User', id);
      }

      // Check organization access
      if (user.organizationId !== req.user!.organizationId && req.user!.role !== 'super_admin') {
        throw new AuthorizationError('Access denied: different organization');
      }

      // Hash new password
      const bcrypt = require('bcrypt');
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
      const passwordHash = await bcrypt.hash(newPassword, saltRounds);

      await userService.updateUserPassword(id, passwordHash);

      await logDataAccess(
        'users',
        id,
        'password_reset',
        req.user!.id,
        req.ip,
        req.get('User-Agent') || '',
        'success'
      );

      res.json({
        message: 'Password reset successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      await logDataAccess(
        'users',
        req.params.id,
        'password_reset',
        req.user!.id,
        req.ip,
        req.get('User-Agent') || '',
        'failure',
        { error: error.message }
      );
      next(error);
    }
  }
);

export default router;
