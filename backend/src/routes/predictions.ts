import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation.js';
import { predictionService } from '../services/predictionService.js';
import { auditService } from '../services/auditService.js';

const router = Router();

// Validation schemas
const createPredictionSchema = z.object({
  bounds_north: z.number().min(-90).max(90),
  bounds_south: z.number().min(-90).max(90),
  bounds_east: z.number().min(-180).max(180),
  bounds_west: z.number().min(-180).max(180),
  horizon_days: z.number().int().min(1).max(30).default(7),
  disease_type: z.string().optional(),
});

// POST /api/v1/predictions - Generate ML predictions for a region
router.post('/', validate(createPredictionSchema), async (req, res, next) => {
  try {
    const { bounds_north, bounds_south, bounds_east, bounds_west, horizon_days, disease_type } = req.body;
    
    const region = {
      north: bounds_north,
      south: bounds_south,
      east: bounds_east,
      west: bounds_west,
    };

    // Generate prediction
    const prediction = await predictionService.generatePrediction({
      region,
      horizonDays: horizon_days,
      diseaseType: disease_type,
    });

    // Log the prediction request for audit
    await auditService.logAuditEvent({
      action: 'prediction_generated',
      resource_type: 'ml_predictions',
      resource_id: prediction.id,
      details: { region, horizon_days, disease_type },
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
    });

    res.status(201).json({
      data: prediction,
      message: 'Prediction generated successfully',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/predictions/:id - Get specific prediction result
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const prediction = await predictionService.getPredictionById(id);
    
    if (!prediction) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Prediction not found',
      });
    }

    res.json({ data: prediction });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/predictions/models/list - List available ML models
router.get('/models/list', async (req, res, next) => {
  try {
    const models = await predictionService.listModels();
    
    res.json({
      data: models,
      meta: {
        count: models.length,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/predictions/models/:id/retrain - Retrain a specific model
router.post('/models/:id/retrain', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await predictionService.retrainModel(id);
    
    // Log the retrain request for audit
    await auditService.logAuditEvent({
      action: 'model_retrained',
      resource_type: 'ml_models',
      resource_id: id,
      details: { model_id: id },
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
    });

    res.json({
      data: result,
      message: 'Model retraining initiated',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/predictions/performance/metrics - Get model performance metrics
router.get('/performance/metrics', async (req, res, next) => {
  try {
    const metrics = await predictionService.getPerformanceMetrics();
    
    res.json({
      data: metrics,
      meta: {
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

export { router as predictionRoutes };