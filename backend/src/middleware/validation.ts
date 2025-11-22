import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body, query, or params based on schema
      const dataToValidate = req.method === 'GET' ? req.query : req.body;
      const validatedData = schema.parse(dataToValidate);
      
      // Replace the original data with validated data
      if (req.method === 'GET') {
        req.query = validatedData;
      } else {
        req.body = validatedData;
      }
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));
        
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid request data',
          details: errorMessages,
          timestamp: new Date().toISOString(),
        });
      }
      
      next(error);
    }
  };
};

// Custom validation middleware for specific use cases
export const validateUUID = (paramName: string = 'id') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const id = req.params[paramName];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'Invalid UUID',
        message: `Parameter '${paramName}' must be a valid UUID`,
        timestamp: new Date().toISOString(),
      });
    }
    
    next();
  };
};

export const validateGeographicBounds = (req: Request, res: Response, next: NextFunction) => {
  const { lat_min, lat_max, lng_min, lng_max } = req.query;
  
  if (lat_min !== undefined && lat_max !== undefined) {
    const latMin = parseFloat(lat_min as string);
    const latMax = parseFloat(lat_max as string);
    
    if (isNaN(latMin) || isNaN(latMax) || latMin < -90 || latMax > 90 || latMin >= latMax) {
      return res.status(400).json({
        error: 'Invalid Geographic Bounds',
        message: 'Latitude bounds must be valid numbers between -90 and 90, with min < max',
        timestamp: new Date().toISOString(),
      });
    }
  }
  
  if (lng_min !== undefined && lng_max !== undefined) {
    const lngMin = parseFloat(lng_min as string);
    const lngMax = parseFloat(lng_max as string);
    
    if (isNaN(lngMin) || isNaN(lngMax) || lngMin < -180 || lngMax > 180 || lngMin >= lngMax) {
      return res.status(400).json({
        error: 'Invalid Geographic Bounds',
        message: 'Longitude bounds must be valid numbers between -180 and 180, with min < max',
        timestamp: new Date().toISOString(),
      });
    }
  }
  
  next();
};

export const validatePagination = (req: Request, res: Response, next: NextFunction) => {
  const { page, limit } = req.query;
  
  if (page !== undefined) {
    const pageNum = parseInt(page as string);
    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        error: 'Invalid Pagination',
        message: 'Page must be a positive integer',
        timestamp: new Date().toISOString(),
      });
    }
  }
  
  if (limit !== undefined) {
    const limitNum = parseInt(limit as string);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
      return res.status(400).json({
        error: 'Invalid Pagination',
        message: 'Limit must be a positive integer between 1 and 1000',
        timestamp: new Date().toISOString(),
      });
    }
  }
  
  next();
};