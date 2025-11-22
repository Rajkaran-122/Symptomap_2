import { Pool } from 'pg';
import { User, CreateUserRequest, UpdateUserRequest } from '../types';

export class UserService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<User | null> {
    const query = `
      SELECT 
        u.id, u.email, u.password_hash, u.first_name, u.last_name, u.role,
        u.organization_id, u.last_login, u.mfa_secret, u.mfa_enabled,
        u.is_active, u.failed_login_attempts, u.locked_until,
        u.created_at, u.updated_at,
        o.name as organization_name
      FROM users u
      LEFT JOIN organizations o ON u.organization_id = o.id
      WHERE u.id = $1
    `;

    const result = await this.pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role,
      organizationId: row.organization_id,
      lastLogin: row.last_login,
      mfaSecret: row.mfa_secret,
      mfaEnabled: row.mfa_enabled,
      isActive: row.is_active,
      failedLoginAttempts: row.failed_login_attempts,
      lockedUntil: row.locked_until,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const query = `
      SELECT 
        u.id, u.email, u.password_hash, u.first_name, u.last_name, u.role,
        u.organization_id, u.last_login, u.mfa_secret, u.mfa_enabled,
        u.is_active, u.failed_login_attempts, u.locked_until,
        u.created_at, u.updated_at,
        o.name as organization_name
      FROM users u
      LEFT JOIN organizations o ON u.organization_id = o.id
      WHERE u.email = $1
    `;

    const result = await this.pool.query(query, [email]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role,
      organizationId: row.organization_id,
      lastLogin: row.last_login,
      mfaSecret: row.mfa_secret,
      mfaEnabled: row.mfa_enabled,
      isActive: row.is_active,
      failedLoginAttempts: row.failed_login_attempts,
      lockedUntil: row.locked_until,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Create new user
   */
  async createUser(data: CreateUserRequest): Promise<User> {
    const {
      email,
      passwordHash,
      firstName,
      lastName,
      role = 'viewer',
      organizationId
    } = data;

    const query = `
      INSERT INTO users (
        email, password_hash, first_name, last_name, role, organization_id
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [email, passwordHash, firstName, lastName, role, organizationId];
    const result = await this.pool.query(query, values);
    const row = result.rows[0];

    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role,
      organizationId: row.organization_id,
      lastLogin: row.last_login,
      mfaSecret: row.mfa_secret,
      mfaEnabled: row.mfa_enabled,
      isActive: row.is_active,
      failedLoginAttempts: row.failed_login_attempts,
      lockedUntil: row.locked_until,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Update user
   */
  async updateUser(id: string, data: UpdateUserRequest): Promise<User> {
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    // Build dynamic update query
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        updateFields.push(`${dbKey} = $${++paramCount}`);
        values.push(value);
      }
    });

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(id); // WHERE clause parameter

    const query = `
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id = $${++paramCount}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role,
      organizationId: row.organization_id,
      lastLogin: row.last_login,
      mfaSecret: row.mfa_secret,
      mfaEnabled: row.mfa_enabled,
      isActive: row.is_active,
      failedLoginAttempts: row.failed_login_attempts,
      lockedUntil: row.locked_until,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Update user password
   */
  async updateUserPassword(id: string, passwordHash: string): Promise<void> {
    const query = `
      UPDATE users 
      SET password_hash = $1, updated_at = NOW()
      WHERE id = $2
    `;

    const result = await this.pool.query(query, [passwordHash, id]);
    
    if (result.rowCount === 0) {
      throw new Error('User not found');
    }
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(id: string): Promise<void> {
    const query = `
      UPDATE users 
      SET last_login = NOW(), updated_at = NOW()
      WHERE id = $1
    `;

    await this.pool.query(query, [id]);
  }

  /**
   * Increment failed login attempts
   */
  async incrementFailedLoginAttempts(id: string): Promise<void> {
    const maxAttempts = parseInt(process.env.MAX_FAILED_ATTEMPTS || '5');
    const lockDuration = 15 * 60 * 1000; // 15 minutes

    const query = `
      UPDATE users 
      SET 
        failed_login_attempts = failed_login_attempts + 1,
        locked_until = CASE 
          WHEN failed_login_attempts + 1 >= $2 THEN NOW() + INTERVAL '15 minutes'
          ELSE locked_until
        END,
        updated_at = NOW()
      WHERE id = $1
    `;

    await this.pool.query(query, [id, maxAttempts]);
  }

  /**
   * Reset failed login attempts
   */
  async resetFailedLoginAttempts(id: string): Promise<void> {
    const query = `
      UPDATE users 
      SET 
        failed_login_attempts = 0,
        locked_until = NULL,
        updated_at = NOW()
      WHERE id = $1
    `;

    await this.pool.query(query, [id]);
  }

  /**
   * Enable MFA for user
   */
  async enableMFA(id: string, secret: string): Promise<void> {
    const query = `
      UPDATE users 
      SET 
        mfa_secret = $1,
        mfa_enabled = true,
        updated_at = NOW()
      WHERE id = $2
    `;

    await this.pool.query(query, [secret, id]);
  }

  /**
   * Disable MFA for user
   */
  async disableMFA(id: string): Promise<void> {
    const query = `
      UPDATE users 
      SET 
        mfa_secret = NULL,
        mfa_enabled = false,
        updated_at = NOW()
      WHERE id = $1
    `;

    await this.pool.query(query, [id]);
  }

  /**
   * Deactivate user account
   */
  async deactivateUser(id: string): Promise<void> {
    const query = `
      UPDATE users 
      SET 
        is_active = false,
        updated_at = NOW()
      WHERE id = $1
    `;

    await this.pool.query(query, [id]);
  }

  /**
   * Get users by organization
   */
  async getUsersByOrganization(organizationId: string, limit: number = 50, offset: number = 0): Promise<{
    users: User[];
    total: number;
  }> {
    // Get total count
    const countQuery = `
      SELECT COUNT(*) 
      FROM users 
      WHERE organization_id = $1 AND is_active = true
    `;
    const countResult = await this.pool.query(countQuery, [organizationId]);
    const total = parseInt(countResult.rows[0].count);

    // Get users
    const usersQuery = `
      SELECT 
        u.id, u.email, u.first_name, u.last_name, u.role,
        u.organization_id, u.last_login, u.mfa_enabled,
        u.is_active, u.created_at, u.updated_at
      FROM users u
      WHERE u.organization_id = $1 AND u.is_active = true
      ORDER BY u.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await this.pool.query(usersQuery, [organizationId, limit, offset]);
    const users: User[] = result.rows.map(row => ({
      id: row.id,
      email: row.email,
      passwordHash: '', // Don't return password hash
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role,
      organizationId: row.organization_id,
      lastLogin: row.last_login,
      mfaSecret: '', // Don't return MFA secret
      mfaEnabled: row.mfa_enabled,
      isActive: row.is_active,
      failedLoginAttempts: 0, // Don't return sensitive info
      lockedUntil: null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    return { users, total };
  }

  /**
   * Search users
   */
  async searchUsers(query: string, organizationId?: string, limit: number = 20): Promise<User[]> {
    let whereClause = 'is_active = true';
    const values: any[] = [];
    let paramCount = 0;

    if (organizationId) {
      whereClause += ` AND organization_id = $${++paramCount}`;
      values.push(organizationId);
    }

    whereClause += ` AND (email ILIKE $${++paramCount} OR first_name ILIKE $${++paramCount} OR last_name ILIKE $${++paramCount})`;
    const searchTerm = `%${query}%`;
    values.push(searchTerm, searchTerm, searchTerm);

    const searchQuery = `
      SELECT 
        u.id, u.email, u.first_name, u.last_name, u.role,
        u.organization_id, u.last_login, u.mfa_enabled,
        u.is_active, u.created_at, u.updated_at
      FROM users u
      WHERE ${whereClause}
      ORDER BY u.last_login DESC NULLS LAST
      LIMIT $${++paramCount}
    `;

    values.push(limit);
    const result = await this.pool.query(searchQuery, values);

    return result.rows.map(row => ({
      id: row.id,
      email: row.email,
      passwordHash: '',
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role,
      organizationId: row.organization_id,
      lastLogin: row.last_login,
      mfaSecret: '',
      mfaEnabled: row.mfa_enabled,
      isActive: row.is_active,
      failedLoginAttempts: 0,
      lockedUntil: null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }
}

// Export singleton instance
let userService: UserService;

export const initializeUserService = (pool: Pool): void => {
  userService = new UserService(pool);
};

export const getUserService = (): UserService => {
  if (!userService) {
    throw new Error('User service not initialized');
  }
  return userService;
};
