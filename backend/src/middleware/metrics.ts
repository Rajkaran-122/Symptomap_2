import { Request, Response, NextFunction } from 'express';
import { getPool } from '../database/connection.js';

// Simple in-memory metrics store (in production, use Prometheus client)
interface Metrics {
  httpRequestsTotal: Map<string, number>;
  httpRequestDuration: Map<string, number[]>;
  websocketConnections: number;
  databaseConnections: number;
  lastUpdated: Date;
}

const metrics: Metrics = {
  httpRequestsTotal: new Map(),
  httpRequestDuration: new Map(),
  websocketConnections: 0,
  databaseConnections: 0,
  lastUpdated: new Date(),
};

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  
  // Override res.end to capture metrics
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - startTime;
    const route = `${req.method} ${req.route?.path || req.path}`;
    const status = res.statusCode.toString();
    
    // Increment request counter
    const key = `${route}:${status}`;
    metrics.httpRequestsTotal.set(key, (metrics.httpRequestsTotal.get(key) || 0) + 1);
    
    // Record duration
    if (!metrics.httpRequestDuration.has(route)) {
      metrics.httpRequestDuration.set(route, []);
    }
    const durations = metrics.httpRequestDuration.get(route)!;
    durations.push(duration);
    
    // Keep only last 1000 measurements
    if (durations.length > 1000) {
      durations.shift();
    }
    
    metrics.lastUpdated = new Date();
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

export const getMetrics = async (): Promise<string> => {
  const pool = getPool();
  
  // Get database connection count
  try {
    const result = await pool.query('SELECT COUNT(*) as connections FROM pg_stat_activity');
    metrics.databaseConnections = parseInt(result.rows[0].connections);
  } catch (error) {
    console.error('Failed to get database metrics:', error);
  }
  
  // Format metrics in Prometheus format
  let prometheusMetrics = '';
  
  // HTTP request metrics
  for (const [key, count] of metrics.httpRequestsTotal) {
    prometheusMetrics += `http_requests_total{route="${key}"} ${count}\n`;
  }
  
  // HTTP duration metrics
  for (const [route, durations] of metrics.httpRequestDuration) {
    if (durations.length > 0) {
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      const sorted = [...durations].sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];
      
      prometheusMetrics += `http_request_duration_seconds{route="${route}",quantile="0.5"} ${p50 / 1000}\n`;
      prometheusMetrics += `http_request_duration_seconds{route="${route}",quantile="0.95"} ${p95 / 1000}\n`;
      prometheusMetrics += `http_request_duration_seconds{route="${route}",quantile="0.99"} ${p99 / 1000}\n`;
      prometheusMetrics += `http_request_duration_seconds_sum{route="${route}"} ${durations.reduce((a, b) => a + b, 0) / 1000}\n`;
      prometheusMetrics += `http_request_duration_seconds_count{route="${route}"} ${durations.length}\n`;
    }
  }
  
  // System metrics
  prometheusMetrics += `websocket_connections_active ${metrics.websocketConnections}\n`;
  prometheusMetrics += `database_connections_active ${metrics.databaseConnections}\n`;
  prometheusMetrics += `system_uptime_seconds ${process.uptime()}\n`;
  
  // Memory metrics
  const memUsage = process.memoryUsage();
  prometheusMetrics += `nodejs_memory_heap_used_bytes ${memUsage.heapUsed}\n`;
  prometheusMetrics += `nodejs_memory_heap_total_bytes ${memUsage.heapTotal}\n`;
  prometheusMetrics += `nodejs_memory_external_bytes ${memUsage.external}\n`;
  prometheusMetrics += `nodejs_memory_rss_bytes ${memUsage.rss}\n`;
  
  return prometheusMetrics;
};

export const updateWebSocketMetrics = (connections: number): void => {
  metrics.websocketConnections = connections;
  metrics.lastUpdated = new Date();
};
