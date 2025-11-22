import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation.js';
import { outbreakService } from '../services/outbreakService.js';
import { auditService } from '../services/auditService.js';

const router = Router();

// Validation schemas
const getOutbreaksSchema = z.object({
  lat_min: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
  lat_max: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
  lng_min: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
  lng_max: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
  days: z.string().optional().transform(val => val ? parseInt(val) : 30),
  disease_type: z.string().optional(),
  severity_min: z.string().optional().transform(val => val ? parseInt(val) : undefined),
});

const createOutbreakSchema = z.object({
  disease_type: z.string().min(1).max(50),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  case_count: z.number().int().min(1),
  severity_level: z.number().int().min(1).max(5),
  confidence: z.number().min(0).max(1).optional().default(0.8),
  symptoms: z.array(z.string()).optional().default([]),
  location_name: z.string().max(255).optional(),
  data_source: z.string().max(100).optional().default('user_report'),
});

const updateOutbreakSchema = createOutbreakSchema.partial();

// GET /api/v1/outbreaks - Get outbreak reports with filters
router.get('/', validate(getOutbreaksSchema), async (req, res, next) => {
  try {
    const filters = req.query;
    const outbreaks = await outbreakService.getOutbreaks(filters);
    
    // Log the query for audit
    await auditService.logAuditEvent({
      action: 'outbreaks_query',
      resource_type: 'outbreak_reports',
      details: { filters },
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
    });

    res.json({
      data: outbreaks,
      meta: {
        total: outbreaks.length,
        filters,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/outbreaks - Create new outbreak report
router.post('/', validate(createOutbreakSchema), async (req, res, next) => {
  try {
    const outbreakData = req.body;
    const outbreak = await outbreakService.createOutbreak(outbreakData);
    
    // Log the creation for audit
    await auditService.logAuditEvent({
      action: 'outbreak_created',
      resource_type: 'outbreak_reports',
      resource_id: outbreak.id,
      details: outbreakData,
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
    });

    res.status(201).json({
      data: outbreak,
      message: 'Outbreak report created successfully',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/outbreaks/:id - Get specific outbreak report
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const outbreak = await outbreakService.getOutbreakById(id);
    
    if (!outbreak) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Outbreak report not found',
      });
    }

    res.json({ data: outbreak });
  } catch (error) {
    next(error);
  }
});

// PUT /api/v1/outbreaks/:id - Update outbreak report
router.put('/:id', validate(updateOutbreakSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const outbreak = await outbreakService.updateOutbreak(id, updateData);
    
    if (!outbreak) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Outbreak report not found',
      });
    }

    // Log the update for audit
    await auditService.logAuditEvent({
      action: 'outbreak_updated',
      resource_type: 'outbreak_reports',
      resource_id: id,
      details: updateData,
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
    });

    res.json({
      data: outbreak,
      message: 'Outbreak report updated successfully',
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/outbreaks/:id - Delete outbreak report
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await outbreakService.deleteOutbreak(id);
    
    if (!deleted) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Outbreak report not found',
      });
    }

    // Log the deletion for audit
    await auditService.logAuditEvent({
      action: 'outbreak_deleted',
      resource_type: 'outbreak_reports',
      resource_id: id,
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
    });

    res.json({
      message: 'Outbreak report deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/outbreaks/stats/summary - Get outbreak statistics
router.get('/stats/summary', async (req, res, next) => {
  try {
    const { disease_type, days_back = 30 } = req.query;
    const stats = await outbreakService.getOutbreakStats({
      disease_type: disease_type as string,
      days_back: parseInt(days_back as string),
    });

    res.json({
      data: stats,
      meta: {
        disease_type,
        days_back,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/outbreaks/nearby - Find nearby outbreaks
router.get('/nearby/:lat/:lng', async (req, res, next) => {
  try {
    const { lat, lng } = req.params;
    const { radius_km = 10, days_back = 7 } = req.query;
    
    const nearbyOutbreaks = await outbreakService.findNearbyOutbreaks({
      latitude: parseFloat(lat),
      longitude: parseFloat(lng),
      radius_km: parseFloat(radius_km as string),
      days_back: parseInt(days_back as string),
    });

    res.json({
      data: nearbyOutbreaks,
      meta: {
        center: { lat: parseFloat(lat), lng: parseFloat(lng) },
        radius_km: parseFloat(radius_km as string),
        days_back: parseInt(days_back as string),
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

export { router as outbreakRoutes };