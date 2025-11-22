import { getPool, getRedisClient } from '../database/connection.js';
import { MLPrediction, GeographicBounds, PredictionDataPoint } from '../../types/index.js';

export interface PredictionRequest {
  region: GeographicBounds;
  horizonDays: number;
  diseaseType?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  version: string;
  disease_type: string;
  accuracy: number;
  last_trained: string;
  status: 'active' | 'training' | 'deprecated';
}

export interface PerformanceMetrics {
  model_id: string;
  mape: number;
  rmse: number;
  accuracy: number;
  last_evaluated: string;
}

export class PredictionService {
  private pool = getPool();
  private redis = getRedisClient();

  async generatePrediction(request: PredictionRequest): Promise<MLPrediction> {
    const { region, horizonDays, diseaseType } = request;
    
    // Check cache first (if Redis is available)
    if (this.redis) {
      const cacheKey = `prediction:${JSON.stringify({ region, horizonDays, diseaseType })}`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        const prediction = JSON.parse(cached);
        return prediction;
      }
    }

    // Generate new prediction
    const prediction = await this.createPrediction(region, horizonDays, diseaseType);
    
    // Cache the result for 1 hour (if Redis is available)
    if (this.redis) {
      const cacheKey = `prediction:${JSON.stringify({ region, horizonDays, diseaseType })}`;
      await this.redis.setex(cacheKey, 3600, JSON.stringify(prediction));
    }
    
    return prediction;
  }

  private async createPrediction(
    region: GeographicBounds, 
    horizonDays: number, 
    diseaseType?: string
  ): Promise<MLPrediction> {
    // Get historical data for the region
    const historicalData = await this.getHistoricalData(region, diseaseType);
    
    // Generate predictions using simple trend analysis
    const predictions = this.generateTrendPredictions(historicalData, horizonDays);
    
    // Calculate confidence score based on data quality and model performance
    const confidenceScore = this.calculateConfidenceScore(historicalData, predictions);
    
    // Create prediction record
    const query = `
      INSERT INTO ml_predictions (
        region_bounds, disease_type, model_version, 
        predictions, confidence_score, expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, created_at
    `;

    const values = [
      JSON.stringify(region),
      diseaseType || 'mixed',
      '1.0.0',
      JSON.stringify(predictions),
      confidenceScore,
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    ];

    const result = await this.pool.query(query, values);
    const { id, created_at } = result.rows[0];

    return {
      id,
      region,
      predictions,
      confidenceScore,
      modelVersion: '1.0.0',
      generatedAt: created_at.toISOString(),
    };
  }

  private async getHistoricalData(region: GeographicBounds, diseaseType?: string): Promise<any[]> {
    let query = `
      SELECT 
        DATE(created_at) as date,
        SUM(case_count) as total_cases,
        AVG(severity_level) as avg_severity,
        COUNT(*) as outbreak_count
      FROM outbreak_reports
      WHERE 
        latitude BETWEEN $1 AND $2
        AND longitude BETWEEN $3 AND $4
        AND created_at >= NOW() - INTERVAL '90 days'
    `;

    const params = [region.south, region.north, region.west, region.east];

    if (diseaseType) {
      query += ` AND disease_type = $5`;
      params.push(diseaseType);
    }

    query += `
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  private generateTrendPredictions(historicalData: any[], horizonDays: number): PredictionDataPoint[] {
    if (historicalData.length < 7) {
      // Not enough data, return conservative predictions
      return this.generateConservativePredictions(horizonDays);
    }

    // Simple linear regression for trend
    const recentData = historicalData.slice(-14); // Last 2 weeks
    const trend = this.calculateTrend(recentData);
    
    const predictions: PredictionDataPoint[] = [];
    const lastDataPoint = recentData[recentData.length - 1];
    const lastDate = new Date(lastDataPoint.date);
    
    for (let i = 1; i <= horizonDays; i++) {
      const predictionDate = new Date(lastDate);
      predictionDate.setDate(lastDate.getDate() + i);
      
      // Apply trend with some randomness
      const baseCases = Math.max(0, lastDataPoint.total_cases + (trend * i));
      const randomFactor = 0.8 + Math.random() * 0.4; // ±20% variation
      const predictedCases = Math.round(baseCases * randomFactor);
      
      // Calculate confidence interval (±30% of prediction)
      const margin = Math.round(predictedCases * 0.3);
      
      // Determine risk level
      const riskLevel = this.determineRiskLevel(predictedCases, lastDataPoint.avg_severity);
      
      predictions.push({
        date: predictionDate.toISOString().split('T')[0],
        predictedCases,
        confidenceInterval: {
          lower: Math.max(0, predictedCases - margin),
          upper: predictedCases + margin,
        },
        riskLevel,
      });
    }
    
    return predictions;
  }

  private generateConservativePredictions(horizonDays: number): PredictionDataPoint[] {
    const predictions: PredictionDataPoint[] = [];
    const today = new Date();
    
    for (let i = 1; i <= horizonDays; i++) {
      const predictionDate = new Date(today);
      predictionDate.setDate(today.getDate() + i);
      
      predictions.push({
        date: predictionDate.toISOString().split('T')[0],
        predictedCases: Math.round(5 + Math.random() * 10), // 5-15 cases
        confidenceInterval: {
          lower: 0,
          upper: 20,
        },
        riskLevel: 'low',
      });
    }
    
    return predictions;
  }

  private calculateTrend(data: any[]): number {
    if (data.length < 2) return 0;
    
    const n = data.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = data.reduce((sum, point) => sum + point.total_cases, 0);
    const sumXY = data.reduce((sum, point, index) => sum + (index * point.total_cases), 0);
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
  }

  private determineRiskLevel(cases: number, avgSeverity: number): 'low' | 'medium' | 'high' | 'critical' {
    const riskScore = cases * (avgSeverity || 2.5);
    
    if (riskScore < 20) return 'low';
    if (riskScore < 50) return 'medium';
    if (riskScore < 100) return 'high';
    return 'critical';
  }

  private calculateConfidenceScore(historicalData: any[], predictions: PredictionDataPoint[]): number {
    if (historicalData.length < 7) return 0.3; // Low confidence with little data
    
    // Base confidence on data quality and consistency
    const dataQuality = Math.min(1, historicalData.length / 30); // More data = higher confidence
    const trendConsistency = this.calculateTrendConsistency(historicalData);
    
    return Math.min(0.95, dataQuality * trendConsistency);
  }

  private calculateTrendConsistency(data: any[]): number {
    if (data.length < 7) return 0.5;
    
    // Calculate variance in daily changes
    const changes = [];
    for (let i = 1; i < data.length; i++) {
      changes.push(data[i].total_cases - data[i - 1].total_cases);
    }
    
    const avgChange = changes.reduce((sum, change) => sum + change, 0) / changes.length;
    const variance = changes.reduce((sum, change) => sum + Math.pow(change - avgChange, 2), 0) / changes.length;
    
    // Lower variance = higher consistency = higher confidence
    return Math.max(0.3, 1 - (variance / 100));
  }

  async getPredictionById(id: string): Promise<MLPrediction | null> {
    const query = `
      SELECT 
        id, region_bounds, disease_type, model_version,
        predictions, confidence_score, created_at
      FROM ml_predictions
      WHERE id = $1 AND expires_at > NOW()
    `;

    const result = await this.pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      region: JSON.parse(row.region_bounds),
      predictions: JSON.parse(row.predictions),
      confidenceScore: parseFloat(row.confidence_score),
      modelVersion: row.model_version,
      generatedAt: row.created_at.toISOString(),
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    // Return mock model information
    return [
      {
        id: 'model-1',
        name: 'COVID-19 Trend Predictor',
        version: '1.0.0',
        disease_type: 'covid-19',
        accuracy: 0.85,
        last_trained: new Date().toISOString(),
        status: 'active',
      },
      {
        id: 'model-2',
        name: 'Influenza Spread Model',
        version: '1.0.0',
        disease_type: 'influenza',
        accuracy: 0.78,
        last_trained: new Date().toISOString(),
        status: 'active',
      },
      {
        id: 'model-3',
        name: 'General Outbreak Predictor',
        version: '1.0.0',
        disease_type: 'mixed',
        accuracy: 0.72,
        last_trained: new Date().toISOString(),
        status: 'active',
      },
    ];
  }

  async retrainModel(modelId: string): Promise<{ status: string; estimated_completion: string }> {
    // Mock retraining process
    const estimatedCompletion = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
    
    return {
      status: 'training_started',
      estimated_completion: estimatedCompletion.toISOString(),
    };
  }

  async getPerformanceMetrics(): Promise<PerformanceMetrics[]> {
    // Return mock performance metrics
    return [
      {
        model_id: 'model-1',
        mape: 15.2,
        rmse: 8.5,
        accuracy: 0.85,
        last_evaluated: new Date().toISOString(),
      },
      {
        model_id: 'model-2',
        mape: 22.1,
        rmse: 12.3,
        accuracy: 0.78,
        last_evaluated: new Date().toISOString(),
      },
      {
        model_id: 'model-3',
        mape: 28.5,
        rmse: 15.7,
        accuracy: 0.72,
        last_evaluated: new Date().toISOString(),
      },
    ];
  }
}

export const predictionService = new PredictionService();

