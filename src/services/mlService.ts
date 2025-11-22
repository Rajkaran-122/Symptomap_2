import axios from 'axios';

interface PredictionRequest {
  diseaseId: string;
  boundsNorth: number;
  boundsSouth: number;
  boundsEast: number;
  boundsWest: number;
  horizonDays?: number;
  regionName?: string;
}

interface PredictionResponse {
  data: {
    id: string;
    modelVersion: string;
    modelName: string;
    diseaseId: string;
    boundsNorth: number;
    boundsSouth: number;
    boundsEast: number;
    boundsWest: number;
    regionName?: string;
    predictionDate: string;
    horizonDays: number;
    predictedCases: Array<{
      date: string;
      predictedCases: number;
      confidenceInterval: {
        lower: number;
        upper: number;
      };
      riskLevel: 'low' | 'medium' | 'high' | 'critical';
    }>;
    predictedSeverity?: {
      trend: string;
      confidence: number;
    };
    riskFactors?: {
      populationDensity: string;
      mobility: string;
      seasonality: string;
    };
    confidenceScore: number;
    mape?: number;
    rmse?: number;
    rSquared?: number;
    inputFeatures?: Record<string, any>;
    modelParameters?: Record<string, any>;
    trainingDataSize?: number;
    createdAt: string;
    expiresAt: string;
  };
  meta: {
    outbreakId?: string;
    horizonDays: number;
    generatedAt: string;
  };
}

interface OutbreakAnalysisRequest {
  symptoms: string[];
  location: {
    latitude: number;
    longitude: number;
  };
  demographics?: {
    ageGroup?: string;
    gender?: string;
  };
  context?: {
    recentTravel?: boolean;
    exposureHistory?: string[];
  };
}

interface OutbreakAnalysisResponse {
  data: {
    diseaseSuggestions: Array<{
      diseaseId: string;
      diseaseName: string;
      confidence: number;
      probability: number;
      keySymptoms: string[];
      recommendedActions: string[];
    }>;
    riskAssessment: {
      overallRisk: 'low' | 'medium' | 'high' | 'critical';
      riskFactors: string[];
      recommendations: string[];
    };
    nextSteps: string[];
    urgency: 'low' | 'medium' | 'high' | 'critical';
  };
  meta: {
    analysisId: string;
    generatedAt: string;
    modelVersion: string;
  };
}

class MLService {
  private baseURL: string;
  private apiKey: string;

  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:8787';
    this.apiKey = process.env.REACT_APP_API_KEY || '';
  }

  /**
   * Get outbreak predictions for a geographic region
   */
  async getPredictions(request: PredictionRequest): Promise<PredictionResponse> {
    try {
      const response = await axios.post(`${this.baseURL}/api/v1/predictions`, request, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout for ML predictions
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching predictions:', error);
      throw new Error('Failed to fetch outbreak predictions');
    }
  }

  /**
   * Analyze symptoms and suggest possible diseases
   */
  async analyzeSymptoms(request: OutbreakAnalysisRequest): Promise<OutbreakAnalysisResponse> {
    try {
      const response = await axios.post(`${this.baseURL}/api/v1/analyze-symptoms`, request, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000 // 15 second timeout for analysis
      });

      return response.data;
    } catch (error) {
      console.error('Error analyzing symptoms:', error);
      throw new Error('Failed to analyze symptoms');
    }
  }

  /**
   * Get model performance metrics
   */
  async getModelMetrics(): Promise<{
    data: {
      models: Array<{
        name: string;
        version: string;
        accuracy: number;
        precision: number;
        recall: number;
        f1Score: number;
        lastTrained: string;
        status: 'active' | 'training' | 'deprecated';
      }>;
      overallPerformance: {
        averageAccuracy: number;
        totalPredictions: number;
        successfulPredictions: number;
        averageLatency: number;
      };
    };
  }> {
    try {
      const response = await axios.get(`${this.baseURL}/api/v1/models/metrics`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching model metrics:', error);
      throw new Error('Failed to fetch model metrics');
    }
  }

  /**
   * Trigger model retraining
   */
  async retrainModel(modelId: string): Promise<{
    data: {
      trainingId: string;
      status: 'started' | 'in_progress' | 'completed' | 'failed';
      estimatedDuration: number;
      startedAt: string;
    };
  }> {
    try {
      const response = await axios.post(`${this.baseURL}/api/v1/models/${modelId}/retrain`, {}, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error triggering model retraining:', error);
      throw new Error('Failed to trigger model retraining');
    }
  }

  /**
   * Get training status
   */
  async getTrainingStatus(trainingId: string): Promise<{
    data: {
      trainingId: string;
      status: 'started' | 'in_progress' | 'completed' | 'failed';
      progress: number; // 0-100
      currentEpoch?: number;
      totalEpochs?: number;
      loss?: number;
      accuracy?: number;
      startedAt: string;
      completedAt?: string;
      error?: string;
    };
  }> {
    try {
      const response = await axios.get(`${this.baseURL}/api/v1/models/training/${trainingId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching training status:', error);
      throw new Error('Failed to fetch training status');
    }
  }

  /**
   * Batch predict multiple outbreaks
   */
  async batchPredict(requests: PredictionRequest[]): Promise<{
    data: {
      predictions: PredictionResponse['data'][];
      summary: {
        totalPredictions: number;
        averageConfidence: number;
        processingTime: number;
      };
    };
  }> {
    try {
      const response = await axios.post(`${this.baseURL}/api/v1/predictions/batch`, {
        requests
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000 // 60 second timeout for batch predictions
      });

      return response.data;
    } catch (error) {
      console.error('Error in batch prediction:', error);
      throw new Error('Failed to perform batch prediction');
    }
  }

  /**
   * Get feature importance for a model
   */
  async getFeatureImportance(modelId: string): Promise<{
    data: {
      features: Array<{
        name: string;
        importance: number;
        description: string;
      }>;
      modelId: string;
      generatedAt: string;
    };
  }> {
    try {
      const response = await axios.get(`${this.baseURL}/api/v1/models/${modelId}/features`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching feature importance:', error);
      throw new Error('Failed to fetch feature importance');
    }
  }

  /**
   * Validate prediction accuracy
   */
  async validatePrediction(predictionId: string, actualData: {
    actualCases: number[];
    actualDates: string[];
  }): Promise<{
    data: {
      predictionId: string;
      mape: number;
      rmse: number;
      rSquared: number;
      accuracy: number;
      validatedAt: string;
    };
  }> {
    try {
      const response = await axios.post(`${this.baseURL}/api/v1/predictions/${predictionId}/validate`, actualData, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error validating prediction:', error);
      throw new Error('Failed to validate prediction');
    }
  }

  /**
   * Get anomaly detection results
   */
  async detectAnomalies(region: {
    boundsNorth: number;
    boundsSouth: number;
    boundsEast: number;
    boundsWest: number;
  }): Promise<{
    data: {
      anomalies: Array<{
        id: string;
        type: 'spatial' | 'temporal' | 'severity' | 'pattern';
        severity: 'low' | 'medium' | 'high' | 'critical';
        description: string;
        location: {
          latitude: number;
          longitude: number;
        };
        detectedAt: string;
        confidence: number;
        recommendations: string[];
      }>;
      summary: {
        totalAnomalies: number;
        criticalCount: number;
        highCount: number;
        mediumCount: number;
        lowCount: number;
      };
    };
  }> {
    try {
      const response = await axios.post(`${this.baseURL}/api/v1/anomalies/detect`, region, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error detecting anomalies:', error);
      throw new Error('Failed to detect anomalies');
    }
  }
}

// Export singleton instance
export const mlService = new MLService();
export default mlService;
