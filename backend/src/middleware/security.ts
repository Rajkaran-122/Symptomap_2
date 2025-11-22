import { Request, Response, NextFunction } from 'express';

/**
 * Security headers middleware
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions policy
  res.setHeader('Permissions-Policy', 
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
  );
  
  // Strict transport security (HTTPS only)
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // Content security policy
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: https://api.mapbox.com; " +
    "connect-src 'self' https://api.mapbox.com wss: ws:; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'"
  );

  next();
};

/**
 * IP whitelist middleware
 */
export const ipWhitelist = (allowedIPs: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (allowedIPs.length > 0 && !allowedIPs.includes(clientIP)) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied from this IP address',
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    next();
  };
};

/**
 * Request size limiter
 */
export const requestSizeLimiter = (maxSize: number) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.get('content-length') || '0');
    
    if (contentLength > maxSize) {
      res.status(413).json({
        error: 'Payload Too Large',
        message: `Request size exceeds ${maxSize} bytes`,
        maxSize,
        receivedSize: contentLength,
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    next();
  };
};

/**
 * SQL injection protection middleware
 */
export const sqlInjectionProtection = (req: Request, res: Response, next: NextFunction): void => {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
    /(\b(OR|AND)\s+'.*?'\s*=\s*'.*?')/gi,
    /(\b(OR|AND)\s+".*?"\s*=\s*".*?")/gi,
    /(UNION\s+SELECT)/gi,
    /(SCRIPT\s*>)/gi,
    /(<\s*SCRIPT)/gi,
    /(JAVASCRIPT\s*:)/gi,
    /(ON\w+\s*=)/gi
  ];

  const checkValue = (value: any): boolean => {
    if (typeof value === 'string') {
      return sqlPatterns.some(pattern => pattern.test(value));
    }
    if (Array.isArray(value)) {
      return value.some(checkValue);
    }
    if (value && typeof value === 'object') {
      return Object.values(value).some(checkValue);
    }
    return false;
  };

  // Check query parameters
  if (checkValue(req.query)) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Potentially malicious query parameters detected',
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Check request body
  if (checkValue(req.body)) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Potentially malicious request body detected',
      timestamp: new Date().toISOString()
    });
    return;
  }

  next();
};

/**
 * XSS protection middleware
 */
export const xssProtection = (req: Request, res: Response, next: NextFunction): void => {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
    /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
    /<link\b[^<]*(?:(?!<\/link>)<[^<]*)*<\/link>/gi,
    /<meta\b[^<]*(?:(?!<\/meta>)<[^<]*)*<\/meta>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /onload\s*=/gi,
    /onerror\s*=/gi,
    /onclick\s*=/gi,
    /onmouseover\s*=/gi
  ];

  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      let sanitized = value;
      xssPatterns.forEach(pattern => {
        sanitized = sanitized.replace(pattern, '');
      });
      return sanitized;
    }
    if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    }
    if (value && typeof value === 'object') {
      const sanitized: any = {};
      Object.keys(value).forEach(key => {
        sanitized[key] = sanitizeValue(value[key]);
      });
      return sanitized;
    }
    return value;
  };

  // Sanitize query parameters
  req.query = sanitizeValue(req.query);

  // Sanitize request body
  req.body = sanitizeValue(req.body);

  next();
};

/**
 * Rate limiting by IP
 */
export const ipRateLimit = (maxRequests: number, windowMs: number) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean up old entries
    for (const [key, value] of requests.entries()) {
      if (value.resetTime < now) {
        requests.delete(key);
      }
    }

    const ipRequests = requests.get(ip);
    
    if (!ipRequests) {
      requests.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (ipRequests.resetTime < now) {
      requests.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (ipRequests.count >= maxRequests) {
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded',
        retryAfter: Math.ceil((ipRequests.resetTime - now) / 1000),
        timestamp: new Date().toISOString()
      });
      return;
    }

    ipRequests.count++;
    next();
  };
};

/**
 * API key validation middleware
 */
export const apiKeyValidation = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'API key required',
      timestamp: new Date().toISOString()
    });
    return;
  }

  // In a real implementation, you would validate the API key against a database
  // For now, we'll just check if it's a valid format
  const apiKeyPattern = /^[a-f0-9]{32}$/i;
  if (!apiKeyPattern.test(apiKey)) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key format',
      timestamp: new Date().toISOString()
    });
    return;
  }

  next();
};

/**
 * Request timeout middleware
 */
export const requestTimeout = (timeoutMs: number) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          error: 'Request Timeout',
          message: 'Request took too long to process',
          timeout: timeoutMs,
          timestamp: new Date().toISOString()
        });
      }
    }, timeoutMs);

    // Clear timeout when response is sent
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any) {
      clearTimeout(timeout);
      originalEnd.call(this, chunk, encoding);
    };

    next();
  };
};

/**
 * CORS preflight handler
 */
export const corsPreflight = (req: Request, res: Response, next: NextFunction): void => {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-API-Key');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400'); // 24 hours
    res.status(200).end();
    return;
  }
  
  next();
};
