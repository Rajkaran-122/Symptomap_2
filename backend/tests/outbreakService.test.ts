import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { outbreakService } from '../src/services/outbreakService.js';
import { getPool } from '../src/database/connection.js';

describe('OutbreakService', () => {
  let pool: any;

  beforeEach(async () => {
    pool = getPool();
    // Clean up test data
    await pool.query('DELETE FROM outbreak_reports WHERE data_source = $1', ['test']);
  });

  afterEach(async () => {
    // Clean up test data
    await pool.query('DELETE FROM outbreak_reports WHERE data_source = $1', ['test']);
  });

  describe('createOutbreak', () => {
    it('should create a new outbreak report', async () => {
      const outbreakData = {
        diseaseType: 'covid-19',
        latitude: 40.7128,
        longitude: -74.0060,
        caseCount: 25,
        severityLevel: 3,
        confidence: 0.85,
        symptoms: ['fever', 'cough'],
        locationName: 'New York City',
      };

      const result = await outbreakService.createOutbreak(outbreakData);

      expect(result).toMatchObject({
        diseaseType: outbreakData.diseaseType,
        latitude: outbreakData.latitude,
        longitude: outbreakData.longitude,
        caseCount: outbreakData.caseCount,
        severityLevel: outbreakData.severityLevel,
        confidence: outbreakData.confidence,
        symptoms: outbreakData.symptoms,
        locationName: outbreakData.locationName,
      });
      expect(result.id).toBeDefined();
      expect(result.lastUpdated).toBeDefined();
    });

    it('should validate required fields', async () => {
      const invalidData = {
        diseaseType: '',
        latitude: 200, // Invalid latitude
        longitude: -74.0060,
        caseCount: 0, // Invalid case count
        severityLevel: 6, // Invalid severity level
      };

      await expect(outbreakService.createOutbreak(invalidData as any)).rejects.toThrow();
    });
  });

  describe('getOutbreaks', () => {
    beforeEach(async () => {
      // Insert test data
      await pool.query(`
        INSERT INTO outbreak_reports (
          disease_type, latitude, longitude, case_count, 
          severity_level, confidence, symptoms, location_name, data_source
        ) VALUES 
        ('covid-19', 40.7128, -74.0060, 25, 3, 0.85, ARRAY['fever', 'cough'], 'NYC', 'test'),
        ('influenza', 34.0522, -118.2437, 15, 2, 0.75, ARRAY['fever'], 'LA', 'test'),
        ('measles', 51.5074, -0.1278, 8, 4, 0.90, ARRAY['rash'], 'London', 'test')
      `);
    });

    it('should get all outbreaks', async () => {
      const outbreaks = await outbreakService.getOutbreaks({});
      expect(outbreaks.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter by geographic bounds', async () => {
      const outbreaks = await outbreakService.getOutbreaks({
        lat_min: 40.0,
        lat_max: 41.0,
        lng_min: -75.0,
        lng_max: -73.0,
      });
      
      expect(outbreaks.length).toBeGreaterThanOrEqual(1);
      expect(outbreaks[0].latitude).toBeGreaterThanOrEqual(40.0);
      expect(outbreaks[0].latitude).toBeLessThanOrEqual(41.0);
    });

    it('should filter by disease type', async () => {
      const outbreaks = await outbreakService.getOutbreaks({
        disease_type: 'covid-19',
      });
      
      expect(outbreaks.length).toBeGreaterThanOrEqual(1);
      expect(outbreaks.every(o => o.diseaseType === 'covid-19')).toBe(true);
    });

    it('should filter by severity level', async () => {
      const outbreaks = await outbreakService.getOutbreaks({
        severity_min: 3,
      });
      
      expect(outbreaks.length).toBeGreaterThanOrEqual(1);
      expect(outbreaks.every(o => o.severityLevel >= 3)).toBe(true);
    });
  });

  describe('getOutbreakById', () => {
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
      const outbreak = await outbreakService.getOutbreakById(outbreakId);

      expect(outbreak).toBeDefined();
      expect(outbreak!.id).toBe(outbreakId);
      expect(outbreak!.diseaseType).toBe('covid-19');
    });

    it('should return null for non-existent ID', async () => {
      const outbreak = await outbreakService.getOutbreakById('00000000-0000-0000-0000-000000000000');
      expect(outbreak).toBeNull();
    });
  });

  describe('updateOutbreak', () => {
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
      const updatedOutbreak = await outbreakService.updateOutbreak(outbreakId, {
        caseCount: 30,
        severityLevel: 4,
      });

      expect(updatedOutbreak).toBeDefined();
      expect(updatedOutbreak!.caseCount).toBe(30);
      expect(updatedOutbreak!.severityLevel).toBe(4);
    });

    it('should return null for non-existent ID', async () => {
      const updatedOutbreak = await outbreakService.updateOutbreak('00000000-0000-0000-0000-000000000000', {
        caseCount: 30,
      });
      expect(updatedOutbreak).toBeNull();
    });
  });

  describe('deleteOutbreak', () => {
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
      const deleted = await outbreakService.deleteOutbreak(outbreakId);

      expect(deleted).toBe(true);

      // Verify it's deleted
      const outbreak = await outbreakService.getOutbreakById(outbreakId);
      expect(outbreak).toBeNull();
    });

    it('should return false for non-existent ID', async () => {
      const deleted = await outbreakService.deleteOutbreak('00000000-0000-0000-0000-000000000000');
      expect(deleted).toBe(false);
    });
  });

  describe('getOutbreakStats', () => {
    beforeEach(async () => {
      // Insert test data with different dates
      await pool.query(`
        INSERT INTO outbreak_reports (
          disease_type, latitude, longitude, case_count, 
          severity_level, confidence, symptoms, location_name, data_source, created_at
        ) VALUES 
        ('covid-19', 40.7128, -74.0060, 25, 3, 0.85, ARRAY['fever'], 'NYC', 'test', NOW() - INTERVAL '1 day'),
        ('covid-19', 34.0522, -118.2437, 15, 2, 0.75, ARRAY['fever'], 'LA', 'test', NOW() - INTERVAL '2 days'),
        ('influenza', 51.5074, -0.1278, 8, 4, 0.90, ARRAY['rash'], 'London', 'test', NOW() - INTERVAL '1 day')
      `);
    });

    it('should get outbreak statistics', async () => {
      const stats = await outbreakService.getOutbreakStats({ days_back: 7 });
      
      expect(stats.total_outbreaks).toBeGreaterThanOrEqual(3);
      expect(stats.total_cases).toBeGreaterThanOrEqual(48); // 25 + 15 + 8
      expect(stats.avg_severity).toBeGreaterThan(0);
      expect(stats.max_severity).toBeGreaterThanOrEqual(4);
      expect(stats.min_severity).toBeGreaterThanOrEqual(2);
    });

    it('should filter by disease type', async () => {
      const stats = await outbreakService.getOutbreakStats({ 
        disease_type: 'covid-19', 
        days_back: 7 
      });
      
      expect(stats.total_outbreaks).toBeGreaterThanOrEqual(2);
      expect(stats.total_cases).toBeGreaterThanOrEqual(40); // 25 + 15
    });
  });

  describe('findNearbyOutbreaks', () => {
    beforeEach(async () => {
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
    });

    it('should find nearby outbreaks', async () => {
      const nearbyOutbreaks = await outbreakService.findNearbyOutbreaks({
        latitude: 40.7128,
        longitude: -74.0060,
        radius_km: 10,
        days_back: 7,
      });
      
      expect(nearbyOutbreaks.length).toBeGreaterThanOrEqual(2);
      expect(nearbyOutbreaks[0].distance_km).toBeLessThanOrEqual(10);
    });

    it('should return empty array for no nearby outbreaks', async () => {
      const nearbyOutbreaks = await outbreakService.findNearbyOutbreaks({
        latitude: 0,
        longitude: 0,
        radius_km: 1,
        days_back: 7,
      });
      
      expect(nearbyOutbreaks.length).toBe(0);
    });
  });
});
