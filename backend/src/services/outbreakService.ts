import { getPool } from '../database/connection.js';
import { OutbreakCluster } from '../../types/index.js';

export interface OutbreakFilters {
  lat_min?: number;
  lat_max?: number;
  lng_min?: number;
  lng_max?: number;
  days?: number;
  disease_type?: string;
  severity_min?: number;
}

export interface OutbreakStats {
  total_cases: number;
  total_outbreaks: number;
  avg_severity: number;
  max_severity: number;
  min_severity: number;
}

export interface NearbyOutbreak {
  id: string;
  disease_type: string;
  case_count: number;
  severity_level: number;
  distance_km: number;
  created_at: string;
}

export class OutbreakService {
  private pool = getPool();

  async getOutbreaks(filters: OutbreakFilters): Promise<OutbreakCluster[]> {
    const {
      lat_min,
      lat_max,
      lng_min,
      lng_max,
      days = 30,
      disease_type,
      severity_min,
    } = filters;

    let query = `
      SELECT 
        id,
        disease_type,
        latitude,
        longitude,
        case_count,
        severity_level,
        confidence,
        symptoms,
        location_name,
        data_source,
        created_at as lastUpdated
      FROM outbreak_reports
      WHERE created_at >= NOW() - INTERVAL '${days} days'
    `;

    const queryParams: any[] = [];
    let paramIndex = 1;

    // Add geographic bounds filter
    if (lat_min !== undefined && lat_max !== undefined && 
        lng_min !== undefined && lng_max !== undefined) {
      query += ` AND latitude BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      query += ` AND longitude BETWEEN $${paramIndex + 2} AND $${paramIndex + 3}`;
      queryParams.push(lat_min, lat_max, lng_min, lng_max);
      paramIndex += 4;
    }

    // Add disease type filter
    if (disease_type) {
      query += ` AND disease_type = $${paramIndex}`;
      queryParams.push(disease_type);
      paramIndex++;
    }

    // Add severity filter
    if (severity_min !== undefined) {
      query += ` AND severity_level >= $${paramIndex}`;
      queryParams.push(severity_min);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT 1000`;

    const result = await this.pool.query(query, queryParams);
    
    return result.rows.map(row => ({
      id: row.id,
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      caseCount: row.case_count,
      severityLevel: row.severity_level,
      diseaseType: row.disease_type,
      confidence: parseFloat(row.confidence),
      lastUpdated: row.lastupdated.toISOString(),
      symptoms: row.symptoms || [],
      locationName: row.location_name,
    }));
  }

  async createOutbreak(data: Omit<OutbreakCluster, 'id' | 'lastUpdated'>): Promise<OutbreakCluster> {
    const query = `
      INSERT INTO outbreak_reports (
        disease_type, latitude, longitude, case_count, 
        severity_level, confidence, symptoms, location_name, data_source
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, created_at as lastUpdated
    `;

    const values = [
      data.diseaseType,
      data.latitude,
      data.longitude,
      data.caseCount,
      data.severityLevel,
      data.confidence || 0.8,
      data.symptoms || [],
      data.locationName,
      'user_report',
    ];

    const result = await this.pool.query(query, values);
    const { id, lastupdated } = result.rows[0];

    return {
      id,
      ...data,
      lastUpdated: lastupdated.toISOString(),
    };
  }

  async getOutbreakById(id: string): Promise<OutbreakCluster | null> {
    const query = `
      SELECT 
        id, disease_type, latitude, longitude, case_count,
        severity_level, confidence, symptoms, location_name,
        created_at as lastUpdated
      FROM outbreak_reports
      WHERE id = $1
    `;

    const result = await this.pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      caseCount: row.case_count,
      severityLevel: row.severity_level,
      diseaseType: row.disease_type,
      confidence: parseFloat(row.confidence),
      lastUpdated: row.lastupdated.toISOString(),
      symptoms: row.symptoms || [],
      locationName: row.location_name,
    };
  }

  async updateOutbreak(id: string, data: Partial<OutbreakCluster>): Promise<OutbreakCluster | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Build dynamic update query
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id' && key !== 'lastUpdated') {
        const dbField = this.mapFieldToDb(key);
        fields.push(`${dbField} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    if (fields.length === 0) {
      return this.getOutbreakById(id);
    }

    values.push(id);
    const query = `
      UPDATE outbreak_reports 
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING id, created_at as lastUpdated
    `;

    const result = await this.pool.query(query, values);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.getOutbreakById(id);
  }

  async deleteOutbreak(id: string): Promise<boolean> {
    const query = 'DELETE FROM outbreak_reports WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return result.rowCount > 0;
  }

  async getOutbreakStats(options: { disease_type?: string; days_back: number }): Promise<OutbreakStats> {
    const { disease_type, days_back } = options;
    
    let query = `
      SELECT 
        SUM(case_count) as total_cases,
        COUNT(*) as total_outbreaks,
        AVG(severity_level) as avg_severity,
        MAX(severity_level) as max_severity,
        MIN(severity_level) as min_severity
      FROM outbreak_reports
      WHERE created_at >= NOW() - INTERVAL '${days_back} days'
    `;

    const queryParams: any[] = [];

    if (disease_type) {
      query += ` AND disease_type = $1`;
      queryParams.push(disease_type);
    }

    const result = await this.pool.query(query, queryParams);
    const row = result.rows[0];

    return {
      total_cases: parseInt(row.total_cases) || 0,
      total_outbreaks: parseInt(row.total_outbreaks) || 0,
      avg_severity: parseFloat(row.avg_severity) || 0,
      max_severity: parseInt(row.max_severity) || 0,
      min_severity: parseInt(row.min_severity) || 0,
    };
  }

  async findNearbyOutbreaks(options: {
    latitude: number;
    longitude: number;
    radius_km: number;
    days_back: number;
  }): Promise<NearbyOutbreak[]> {
    const { latitude, longitude, radius_km, days_back } = options;

    const query = `
      SELECT 
        id, disease_type, case_count, severity_level,
        ST_Distance(
          ST_Point($1, $2)::geography,
          ST_Point(longitude, latitude)::geography
        ) / 1000 as distance_km,
        created_at
      FROM outbreak_reports
      WHERE 
        ST_DWithin(
          ST_Point($1, $2)::geography,
          ST_Point(longitude, latitude)::geography,
          $3 * 1000
        )
        AND created_at >= NOW() - INTERVAL '${days_back} days'
      ORDER BY distance_km ASC
      LIMIT 50
    `;

    const result = await this.pool.query(query, [longitude, latitude, radius_km]);
    
    return result.rows.map(row => ({
      id: row.id,
      disease_type: row.disease_type,
      case_count: row.case_count,
      severity_level: row.severity_level,
      distance_km: parseFloat(row.distance_km),
      created_at: row.created_at.toISOString(),
    }));
  }

  private mapFieldToDb(field: string): string {
    const fieldMap: Record<string, string> = {
      diseaseType: 'disease_type',
      caseCount: 'case_count',
      severityLevel: 'severity_level',
      locationName: 'location_name',
    };
    return fieldMap[field] || field;
  }
}

export const outbreakService = new OutbreakService();