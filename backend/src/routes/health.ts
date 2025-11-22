import { Router } from 'express';
import { getPool, getRedisClient } from '../database/connection.js';

const router = Router();

// GET /api/v1/health - Basic health check
router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
  });
});

// GET /api/v1/health/ready - Readiness probe
router.get('/ready', async (req, res) => {
  try {
    const pool = getPool();
    const redis = getRedisClient();

    // Check database connection
    await pool.query('SELECT 1');
    
    // Check Redis connection
    await redis.ping();

    res.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'healthy',
        redis: 'healthy',
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/v1/health/live - Liveness probe
router.get('/live', (req, res) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

export { router as healthRoutes };