import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/server.js';
import { getPool } from '../../src/database/connection.js';

describe('Outbreaks API Integration Tests', () => {
  let pool: any;

  beforeAll(async () => {
    pool = getPool();
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM outbreak_reports WHERE data_source = $1', ['test']);
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await pool.query('DELETE FROM outbreak_reports WHERE data_source = $1', ['test']);
  });

  describe('GET /api/v1/outbreaks', () => {
    it('should return empty array when no outbreaks exist', async () => {
      const response = await request(app)
        .get('/api/v1/outbreaks')
        .expect(200);

      expect(response.body.data).toEqual([]);
      expect(response.body.meta.total).toBe(0);
    });

    it('should return outbreaks with filters', async () => {
      // Insert test data
      await pool.query(`
        INSERT INTO outbreak_reports (
          disease_type, latitude, longitude, case_count, 
          severity_level, confidence, symptoms, location_name, data_source
        ) VALUES 
        ('covid-19', 40.7128, -74.0060, 25, 3, 0.85, ARRAY['fever', 'cough'], 'NYC', 'test'),
        ('influenza', 34.0522, -118.2437, 15, 2, 0.75, ARRAY['fever'], 'LA', 'test')
      `);

      const response = await request(app)
        .get('/api/v1/outbreaks')
        .query({
          lat_min: 40.0,
          lat_max: 41.0,
          lng_min: -75.0,
          lng_max: -73.0,
          days: 30,
        })
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data[0]).toMatchObject({
        diseaseType: 'covid-19',
        latitude: 40.7128,
        longitude: -74.0060,
        caseCount: 25,
        severityLevel: 3,
        confidence: 0.85,
        symptoms: ['fever', 'cough'],
        locationName: 'NYC',
      });
    });

    it('should filter by disease type', async () => {
      // Insert test data
      await pool.query(`
        INSERT INTO outbreak_reports (
          disease_type, latitude, longitude, case_count, 
          severity_level, confidence, symptoms, location_name, data_source
        ) VALUES 
        ('covid-19', 40.7128, -74.0060, 25, 3, 0.85, ARRAY['fever'], 'NYC', 'test'),
        ('influenza', 34.0522, -118.2437, 15, 2, 0.75, ARRAY['fever'], 'LA', 'test')
      `);

      const response = await request(app)
        .get('/api/v1/outbreaks')
        .query({ disease_type: 'covid-19' })
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data.every((o: any) => o.diseaseType === 'covid-19')).toBe(true);
    });

    it('should filter by severity level', async () => {
      // Insert test data
      await pool.query(`
        INSERT INTO outbreak_reports (
          disease_type, latitude, longitude, case_count, 
          severity_level, confidence, symptoms, location_name, data_source
        ) VALUES 
        ('covid-19', 40.7128, -74.0060, 25, 3, 0.85, ARRAY['fever'], 'NYC', 'test'),
        ('influenza', 34.0522, -118.2437, 15, 2, 0.75, ARRAY['fever'], 'LA', 'test')
      `);

      const response = await request(app)
        .get('/api/v1/outbreaks')
        .query({ severity_min: 3 })
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data.every((o: any) => o.severityLevel >= 3)).toBe(true);
    });

    it('should validate geographic bounds', async () => {
      const response = await request(app)
        .get('/api/v1/outbreaks')
        .query({
          lat_min: 'invalid',
          lat_max: 41.0,
          lng_min: -75.0,
          lng_max: -73.0,
        })
        .expect(400);

      expect(response.body.error).toBe('Validation Error');
    });
  });

  describe('POST /api/v1/outbreaks', () => {
    it('should create a new outbreak report', async () => {
      const outbreakData = {
        disease_type: 'covid-19',
        latitude: 40.7128,
        longitude: -74.0060,
        case_count: 25,
        severity_level: 3,
        confidence: 0.85,
        symptoms: ['fever', 'cough'],
        location_name: 'New York City',
      };

      const response = await request(app)
        .post('/api/v1/outbreaks')
        .send(outbreakData)
        .expect(201);

      expect(response.body.data).toMatchObject({
        diseaseType: outbreakData.disease_type,
        latitude: outbreakData.latitude,
        longitude: outbreakData.longitude,
        caseCount: outbreakData.case_count,
        severityLevel: outbreakData.severity_level,
        confidence: outbreakData.confidence,
        symptoms: outbreakData.symptoms,
        locationName: outbreakData.location_name,
      });
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.lastUpdated).toBeDefined();
    });

    it('should validate required fields', async () => {
      const invalidData = {
        disease_type: '',
        latitude: 200, // Invalid latitude
        longitude: -74.0060,
        case_count: 0, // Invalid case count
        severity_level: 6, // Invalid severity level
      };

      const response = await request(app)
        .post('/api/v1/outbreaks')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBe('Validation Error');
      expect(response.body.details).toBeDefined();
    });

    it('should validate data types', async () => {
      const invalidData = {
        disease_type: 'covid-19',
        latitude: 'invalid', // Should be number
        longitude: -74.0060,
        case_count: 25,
        severity_level: 3,
      };

      const response = await request(app)
        .post('/api/v1/outbreaks')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBe('Validation Error');
    });
  });

  describe('GET /api/v1/outbreaks/:id', () => {
    it('should get outbreak by ID', async () => {
      // Insert test outbreak
      const result = await pool.query(`
        INSERT INTO outbreak_reports (
          disease_type, latitude, longitude, case_count, 
          severity_level, confidence, symptoms, location_name, data_source
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `, ['covid-19', 40.7128, -74.0060, 25, 3, 0.85, ['fever'], 'NYC', 'test']);

      const outbreakId = result.rows[0].id;

      const response = await request(app)
        .get(`/api/v1/outbreaks/${outbreakId}`)
        .expect(200);

      expect(response.body.data.id).toBe(outbreakId);
      expect(response.body.data.diseaseType).toBe('covid-19');
    });

    it('should return 404 for non-existent ID', async () => {
      const response = await request(app)
        .get('/api/v1/outbreaks/00000000-0000-0000-0000-000000000000')
        .expect(404);

      expect(response.body.error).toBe('Not Found');
    });

    it('should validate UUID format', async () => {
      const response = await request(app)
        .get('/api/v1/outbreaks/invalid-uuid')
        .expect(400);

      expect(response.body.error).toBe('Invalid UUID');
    });
  });

  describe('PUT /api/v1/outbreaks/:id', () => {
    it('should update outbreak', async () => {
      // Insert test outbreak
      const result = await pool.query(`
        INSERT INTO outbreak_reports (
          disease_type, latitude, longitude, case_count, 
          severity_level, confidence, symptoms, location_name, data_source
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `, ['covid-19', 40.7128, -74.0060, 25, 3, 0.85, ['fever'], 'NYC', 'test']);

      const outbreakId = result.rows[0].id;

      const updateData = {
        case_count: 30,
        severity_level: 4,
      };

      const response = await request(app)
        .put(`/api/v1/outbreaks/${outbreakId}`)
        .send(updateData)
        .expect(200);

      expect(response.body.data.caseCount).toBe(30);
      expect(response.body.data.severityLevel).toBe(4);
    });

    it('should return 404 for non-existent ID', async () => {
      const response = await request(app)
        .put('/api/v1/outbreaks/00000000-0000-0000-0000-000000000000')
        .send({ case_count: 30 })
        .expect(404);

      expect(response.body.error).toBe('Not Found');
    });
  });

  describe('DELETE /api/v1/outbreaks/:id', () => {
    it('should delete outbreak', async () => {
      // Insert test outbreak
      const result = await pool.query(`
        INSERT INTO outbreak_reports (
          disease_type, latitude, longitude, case_count, 
          severity_level, confidence, symptoms, location_name, data_source
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `, ['covid-19', 40.7128, -74.0060, 25, 3, 0.85, ['fever'], 'NYC', 'test']);

      const outbreakId = result.rows[0].id;

      const response = await request(app)
        .delete(`/api/v1/outbreaks/${outbreakId}`)
        .expect(200);

      expect(response.body.message).toBe('Outbreak report deleted successfully');

      // Verify it's deleted
      await request(app)
        .get(`/api/v1/outbreaks/${outbreakId}`)
        .expect(404);
    });

    it('should return 404 for non-existent ID', async () => {
      const response = await request(app)
        .delete('/api/v1/outbreaks/00000000-0000-0000-0000-000000000000')
        .expect(404);

      expect(response.body.error).toBe('Not Found');
    });
  });

  describe('GET /api/v1/outbreaks/stats/summary', () => {
    it('should get outbreak statistics', async () => {
      // Insert test data
      await pool.query(`
        INSERT INTO outbreak_reports (
          disease_type, latitude, longitude, case_count, 
          severity_level, confidence, symptoms, location_name, data_source, created_at
        ) VALUES 
        ('covid-19', 40.7128, -74.0060, 25, 3, 0.85, ARRAY['fever'], 'NYC', 'test', NOW() - INTERVAL '1 day'),
        ('covid-19', 34.0522, -118.2437, 15, 2, 0.75, ARRAY['fever'], 'LA', 'test', NOW() - INTERVAL '2 days'),
        ('influenza', 51.5074, -0.1278, 8, 4, 0.90, ARRAY['rash'], 'London', 'test', NOW() - INTERVAL '1 day')
      `);

      const response = await request(app)
        .get('/api/v1/outbreaks/stats/summary')
        .query({ days_back: 7 })
        .expect(200);

      expect(response.body.data.total_outbreaks).toBeGreaterThanOrEqual(3);
      expect(response.body.data.total_cases).toBeGreaterThanOrEqual(48);
      expect(response.body.data.avg_severity).toBeGreaterThan(0);
      expect(response.body.data.max_severity).toBeGreaterThanOrEqual(4);
      expect(response.body.data.min_severity).toBeGreaterThanOrEqual(2);
    });

    it('should filter by disease type', async () => {
      // Insert test data
      await pool.query(`
        INSERT INTO outbreak_reports (
          disease_type, latitude, longitude, case_count, 
          severity_level, confidence, symptoms, location_name, data_source, created_at
        ) VALUES 
        ('covid-19', 40.7128, -74.0060, 25, 3, 0.85, ARRAY['fever'], 'NYC', 'test', NOW() - INTERVAL '1 day'),
        ('influenza', 34.0522, -118.2437, 15, 2, 0.75, ARRAY['fever'], 'LA', 'test', NOW() - INTERVAL '1 day')
      `);

      const response = await request(app)
        .get('/api/v1/outbreaks/stats/summary')
        .query({ disease_type: 'covid-19', days_back: 7 })
        .expect(200);

      expect(response.body.data.total_outbreaks).toBeGreaterThanOrEqual(1);
      expect(response.body.data.total_cases).toBeGreaterThanOrEqual(25);
    });
  });

  describe('GET /api/v1/outbreaks/nearby/:lat/:lng', () => {
    it('should find nearby outbreaks', async () => {
      // Insert test data
      await pool.query(`
        INSERT INTO outbreak_reports (
          disease_type, latitude, longitude, case_count, 
          severity_level, confidence, symptoms, location_name, data_source
        ) VALUES 
        ('covid-19', 40.7128, -74.0060, 25, 3, 0.85, ARRAY['fever'], 'NYC', 'test'),
        ('covid-19', 40.7589, -73.9851, 15, 2, 0.75, ARRAY['fever'], 'Manhattan', 'test'),
        ('influenza', 34.0522, -118.2437, 8, 4, 0.90, ARRAY['rash'], 'LA', 'test')
      `);

      const response = await request(app)
        .get('/api/v1/outbreaks/nearby/40.7128/-74.0060')
        .query({ radius_km: 10, days_back: 7 })
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
      expect(response.body.data[0].distance_km).toBeLessThanOrEqual(10);
      expect(response.body.meta.center).toEqual({
        lat: 40.7128,
        lng: -74.0060,
      });
    });

    it('should return empty array for no nearby outbreaks', async () => {
      const response = await request(app)
        .get('/api/v1/outbreaks/nearby/0/0')
        .query({ radius_km: 1, days_back: 7 })
        .expect(200);

      expect(response.body.data).toEqual([]);
    });
  });
});
