import winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';

// Custom format for structured logging
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(info => {
    const { timestamp, level, message, ...extra } = info;
    
    return JSON.stringify({
      '@timestamp': timestamp,
      level,
      message,
      service: 'symptomap-api',
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      traceId: extra.traceId,
      spanId: extra.spanId,
      userId: extra.userId,
      organizationId: extra.organizationId,
      requestId: extra.requestId,
      ...extra
    });
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(info => {
    const { timestamp, level, message, ...extra } = info;
    const extraStr = Object.keys(extra).length ? JSON.stringify(extra, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${extraStr}`;
  })
);

// Transport configuration
const transports: winston.transport[] = [
  new winston.transports.Console({
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.NODE_ENV === 'development' ? consoleFormat : logFormat
  })
];

// Add file transport for production
if (process.env.NODE_ENV === 'production') {
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: logFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: logFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    })
  );
}

// Add Elasticsearch transport if configured
if (process.env.NODE_ENV === 'production' && process.env.ELASTICSEARCH_URL) {
  try {
    transports.push(
      new ElasticsearchTransport({
        level: 'info',
        clientOpts: {
          node: process.env.ELASTICSEARCH_URL,
          auth: {
            username: process.env.ELASTICSEARCH_USERNAME || '',
            password: process.env.ELASTICSEARCH_PASSWORD || ''
          }
        },
        index: 'symptomap-logs',
        indexTemplate: {
          name: 'symptomap-logs-template',
          pattern: 'symptomap-logs-*',
          settings: {
            number_of_shards: 1,
            number_of_replicas: 1
          },
          mappings: {
            properties: {
              '@timestamp': { type: 'date' },
              level: { type: 'keyword' },
              message: { type: 'text' },
              service: { type: 'keyword' },
              version: { type: 'keyword' },
              environment: { type: 'keyword' },
              traceId: { type: 'keyword' },
              spanId: { type: 'keyword' },
              userId: { type: 'keyword' },
              organizationId: { type: 'keyword' },
              requestId: { type: 'keyword' }
            }
          }
        }
      })
    );
  } catch (error) {
    console.warn('Failed to initialize Elasticsearch transport:', error);
  }
}

// Create logger instance
export const logger = winston.createLogger({
  format: logFormat,
  transports,
  exceptionHandlers: transports,
  rejectionHandlers: transports,
  exitOnError: false
});

// Request logging middleware
export const requestLogger = (req: any, res: any, next: any) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const traceId = req.headers['x-trace-id'] as string;
    const requestId = req.requestId;
    
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      traceId,
      requestId,
      userId: req.user?.id,
      organizationId: req.user?.organizationId
    });
  });
  
  next();
};

// Business event logging
export const logBusinessEvent = (
  event: string, 
  data: Record<string, any>, 
  userId?: string,
  organizationId?: string
) => {
  logger.info('Business Event', {
    event,
    data,
    userId,
    organizationId,
    category: 'business_event'
  });
};

// Security event logging
export const logSecurityEvent = (
  event: string,
  details: Record<string, any>,
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
  userId?: string,
  ipAddress?: string
) => {
  logger.warn('Security Event', {
    event,
    details,
    severity,
    userId,
    ipAddress,
    category: 'security_event'
  });
};

// Performance logging
export const logPerformance = (
  operation: string,
  duration: number,
  metadata: Record<string, any> = {}
) => {
  const level = duration > 5000 ? 'warn' : duration > 1000 ? 'info' : 'debug';
  
  logger.log(level, 'Performance Metric', {
    operation,
    duration,
    ...metadata,
    category: 'performance'
  });
};

// Database operation logging
export const logDatabaseOperation = (
  operation: string,
  table: string,
  duration: number,
  rowCount?: number,
  error?: Error
) => {
  const level = error ? 'error' : duration > 1000 ? 'warn' : 'debug';
  
  logger.log(level, 'Database Operation', {
    operation,
    table,
    duration,
    rowCount,
    error: error?.message,
    category: 'database'
  });
};

// ML operation logging
export const logMLOperation = (
  operation: string,
  modelName: string,
  duration: number,
  inputSize?: number,
  outputSize?: number,
  error?: Error
) => {
  const level = error ? 'error' : duration > 5000 ? 'warn' : 'info';
  
  logger.log(level, 'ML Operation', {
    operation,
    modelName,
    duration,
    inputSize,
    outputSize,
    error: error?.message,
    category: 'ml'
  });
};

// Audit logging
export const logAuditEvent = (
  eventType: string,
  eventCategory: string,
  userId?: string,
  resourceType?: string,
  resourceId?: string,
  action?: string,
  oldValues?: Record<string, any>,
  newValues?: Record<string, any>,
  metadata?: Record<string, any>,
  success: boolean = true,
  errorMessage?: string
) => {
  logger.info('Audit Event', {
    eventType,
    eventCategory,
    userId,
    resourceType,
    resourceId,
    action,
    oldValues,
    newValues,
    metadata,
    success,
    errorMessage,
    category: 'audit'
  });
};

// Error logging with context
export const logError = (
  error: Error,
  context: Record<string, any> = {},
  userId?: string,
  requestId?: string
) => {
  logger.error('Application Error', {
    error: error.message,
    stack: error.stack,
    name: error.name,
    userId,
    requestId,
    ...context,
    category: 'error'
  });
};

// System health logging
export const logSystemHealth = (
  component: string,
  status: 'healthy' | 'degraded' | 'unhealthy',
  metrics: Record<string, any> = {}
) => {
  const level = status === 'unhealthy' ? 'error' : status === 'degraded' ? 'warn' : 'info';
  
  logger.log(level, 'System Health', {
    component,
    status,
    metrics,
    category: 'health'
  });
};

// Export logger instance
export default logger;
