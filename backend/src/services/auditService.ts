import { getPool } from '../database/connection.js';

export interface AuditEvent {
  user_id?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  details?: any;
  ip_address?: string;
  user_agent?: string;
}

export class AuditService {
  private pool = getPool();

  async logAuditEvent(event: AuditEvent): Promise<void> {
    try {
      const query = `
        INSERT INTO audit_logs (
          user_id, action, resource_type, resource_id, 
          details, ip_address, user_agent
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;

      const values = [
        event.user_id || null,
        event.action,
        event.resource_type || null,
        event.resource_id || null,
        JSON.stringify(event.details || {}),
        event.ip_address || null,
        event.user_agent || null,
      ];

      await this.pool.query(query, values);
    } catch (error) {
      // Don't throw error for audit logging failures
      console.error('Failed to log audit event:', error);
    }
  }

  async getAuditLogs(filters: {
    user_id?: string;
    action?: string;
    resource_type?: string;
    resource_id?: string;
    start_date?: Date;
    end_date?: Date;
    limit?: number;
    offset?: number;
  } = {}): Promise<any[]> {
    let query = `
      SELECT 
        id, user_id, action, resource_type, resource_id,
        details, ip_address, user_agent, created_at
      FROM audit_logs
      WHERE 1=1
    `;

    const queryParams: any[] = [];
    let paramIndex = 1;

    if (filters.user_id) {
      query += ` AND user_id = $${paramIndex}`;
      queryParams.push(filters.user_id);
      paramIndex++;
    }

    if (filters.action) {
      query += ` AND action = $${paramIndex}`;
      queryParams.push(filters.action);
      paramIndex++;
    }

    if (filters.resource_type) {
      query += ` AND resource_type = $${paramIndex}`;
      queryParams.push(filters.resource_type);
      paramIndex++;
    }

    if (filters.resource_id) {
      query += ` AND resource_id = $${paramIndex}`;
      queryParams.push(filters.resource_id);
      paramIndex++;
    }

    if (filters.start_date) {
      query += ` AND created_at >= $${paramIndex}`;
      queryParams.push(filters.start_date);
      paramIndex++;
    }

    if (filters.end_date) {
      query += ` AND created_at <= $${paramIndex}`;
      queryParams.push(filters.end_date);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT $${paramIndex}`;
      queryParams.push(filters.limit);
      paramIndex++;
    }

    if (filters.offset) {
      query += ` OFFSET $${paramIndex}`;
      queryParams.push(filters.offset);
    }

    const result = await this.pool.query(query, queryParams);
    
    return result.rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      action: row.action,
      resource_type: row.resource_type,
      resource_id: row.resource_id,
      details: JSON.parse(row.details),
      ip_address: row.ip_address,
      user_agent: row.user_agent,
      created_at: row.created_at.toISOString(),
    }));
  }
}

export const auditService = new AuditService();