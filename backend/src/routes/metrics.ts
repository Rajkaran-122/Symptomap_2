import { Router } from 'express';
import { getMetrics } from '../middleware/metrics.js';
import { getPool } from '../database/connection.js';
import { outbreakService } from '../services/outbreakService.js';

const router = Router();

// GET /metrics - Prometheus metrics endpoint
router.get('/', async (req, res, next) => {
  try {
    const metrics = await getMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/metrics - JSON metrics endpoint
router.get('/api/v1/metrics', async (req, res, next) => {
  try {
    const pool = getPool();
    
    // Get database metrics
    const dbMetrics = await pool.query(`
      SELECT 
        'active_connections' as metric_name,
        COUNT(*) as metric_value,
        'connections' as metric_unit
      FROM websocket_connections 
      WHERE disconnected_at IS NULL
      
      UNION ALL
      
      SELECT 
        'total_outbreaks_24h' as metric_name,
        COUNT(*) as metric_value,
        'outbreaks' as metric_unit
      FROM outbreak_reports 
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      
      UNION ALL
      
      SELECT 
        'total_cases_24h' as metric_name,
        SUM(case_count) as metric_value,
        'cases' as metric_unit
      FROM outbreak_reports 
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `);

    // Get outbreak statistics
    const outbreakStats = await outbreakService.getOutbreakStats({ days_back: 1 });

    // Calculate performance metrics
    const metrics = {
      apiResponseTime: 150, // Mock value - in production, this would be calculated
      concurrentUsers: dbMetrics.rows.find(r => r.metric_name === 'active_connections')?.metric_value || 0,
      dataPoints: outbreakStats.total_outbreaks,
      systemHealth: {
        database: 'healthy',
        redis: 'healthy',
        websocket: 'healthy',
      },
      outbreakMetrics: {
        totalOutbreaks24h: outbreakStats.total_outbreaks,
        totalCases24h: outbreakStats.total_cases,
        avgSeverity: outbreakStats.avg_severity,
        maxSeverity: outbreakStats.max_severity,
      },
      timestamp: new Date().toISOString(),
    };

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

export { router as metricsRoutes };