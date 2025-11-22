import { Express } from 'express';
import { outbreakRoutes } from './outbreaks.js';
import { predictionRoutes } from './predictions.js';
import { healthRoutes } from './health.js';
import { metricsRoutes } from './metrics.js';

export const setupRoutes = (app: Express): void => {
  // API version prefix
  const apiPrefix = '/api/v1';

  // Mount route modules
  app.use(`${apiPrefix}/outbreaks`, outbreakRoutes);
  app.use(`${apiPrefix}/predictions`, predictionRoutes);
  app.use(`${apiPrefix}/health`, healthRoutes);
  app.use(`${apiPrefix}/metrics`, metricsRoutes);

  // API documentation endpoint
  app.get(`${apiPrefix}/docs`, (req, res) => {
    res.json({
      title: 'SymptoMap API',
      version: '1.0.0',
      description: 'Real-time disease surveillance and outbreak prediction API',
      endpoints: {
        outbreaks: {
          'GET /': 'Get outbreak reports with optional filters',
          'POST /': 'Create a new outbreak report',
          'GET /:id': 'Get specific outbreak report',
          'PUT /:id': 'Update outbreak report',
          'DELETE /:id': 'Delete outbreak report',
        },
        predictions: {
          'POST /': 'Generate ML predictions for a region',
          'GET /:id': 'Get specific prediction result',
        },
        health: {
          'GET /': 'API health check',
          'GET /ready': 'Readiness probe',
          'GET /live': 'Liveness probe',
        },
        metrics: {
          'GET /': 'Get system performance metrics',
        },
      },
      examples: {
        getOutbreaks: {
          url: `${apiPrefix}/outbreaks?lat_min=40.0&lat_max=41.0&lng_min=-74.0&lng_max=-73.0&days=30`,
          description: 'Get outbreaks in New York area for last 30 days',
        },
        createOutbreak: {
          url: `${apiPrefix}/outbreaks`,
          method: 'POST',
          body: {
            disease_type: 'covid-19',
            latitude: 40.7128,
            longitude: -74.0060,
            case_count: 25,
            severity_level: 3,
            symptoms: ['fever', 'cough'],
            location_name: 'New York City',
          },
        },
        getPredictions: {
          url: `${apiPrefix}/predictions`,
          method: 'POST',
          body: {
            bounds_north: 41.0,
            bounds_south: 40.0,
            bounds_east: -73.0,
            bounds_west: -74.0,
            horizon_days: 7,
          },
        },
      },
    });
  });
};

