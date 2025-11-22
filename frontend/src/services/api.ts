import axios, { AxiosResponse } from 'axios';
import { OutbreakCluster, MLPrediction, GeographicBounds, OutbreakApiResponse } from '@/types';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';
const API_TIMEOUT = 10000; // 10 seconds

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth tokens
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API Service Class
export class SymptoMapAPI {
  // Outbreak endpoints
  static async getOutbreaks(params: {
    lat_min?: number;
    lat_max?: number;
    lng_min?: number;
    lng_max?: number;
    days?: number;
    disease_type?: string;
    severity_min?: number;
  } = {}): Promise<OutbreakApiResponse> {
    const response: AxiosResponse<OutbreakApiResponse> = await apiClient.get('/outbreaks', {
      params: {
        days: 30,
        ...params,
      },
    });
    return response.data;
  }

  static async createOutbreak(outbreak: Omit<OutbreakCluster, 'id' | 'lastUpdated'>): Promise<OutbreakCluster> {
    const response: AxiosResponse<OutbreakCluster> = await apiClient.post('/outbreaks', outbreak);
    return response.data;
  }

  static async updateOutbreak(id: string, outbreak: Partial<OutbreakCluster>): Promise<OutbreakCluster> {
    const response: AxiosResponse<OutbreakCluster> = await apiClient.put(`/outbreaks/${id}`, outbreak);
    return response.data;
  }

  static async deleteOutbreak(id: string): Promise<void> {
    await apiClient.delete(`/outbreaks/${id}`);
  }

  // Prediction endpoints
  static async getPredictions(region: GeographicBounds): Promise<MLPrediction[]> {
    const response: AxiosResponse<MLPrediction[]> = await apiClient.post('/predictions', {
      bounds_north: region.north,
      bounds_south: region.south,
      bounds_east: region.east,
      bounds_west: region.west,
      horizon_days: 7,
    });
    return response.data;
  }

  static async getPredictionById(id: string): Promise<MLPrediction> {
    const response: AxiosResponse<MLPrediction> = await apiClient.get(`/predictions/${id}`);
    return response.data;
  }

  // Health check
  static async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response: AxiosResponse<{ status: string; timestamp: string }> = await apiClient.get('/health');
    return response.data;
  }

  // Performance metrics
  static async getPerformanceMetrics(): Promise<{
    apiResponseTime: number;
    concurrentUsers: number;
    dataPoints: number;
  }> {
    const response: AxiosResponse<{
      apiResponseTime: number;
      concurrentUsers: number;
      dataPoints: number;
    }> = await apiClient.get('/metrics');
    return response.data;
  }
}

// Utility functions
export const createOutbreakFromForm = (formData: {
  latitude: number;
  longitude: number;
  caseCount: number;
  severityLevel: number;
  diseaseType: string;
  symptoms: string[];
  locationName?: string;
}): Omit<OutbreakCluster, 'id' | 'lastUpdated'> => ({
  latitude: formData.latitude,
  longitude: formData.longitude,
  caseCount: formData.caseCount,
  severityLevel: formData.severityLevel as 1 | 2 | 3 | 4 | 5,
  diseaseType: formData.diseaseType,
  confidence: 0.8, // Default confidence
  symptoms: formData.symptoms,
  locationName: formData.locationName,
});

// Error handling utilities
export const handleApiError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    if (error.response) {
      return error.response.data?.message || `Server error: ${error.response.status}`;
    } else if (error.request) {
      return 'Network error: Unable to connect to server';
    }
  }
  return 'An unexpected error occurred';
};

// Performance monitoring
export const measureApiPerformance = async <T>(
  apiCall: () => Promise<T>
): Promise<{ data: T; responseTime: number }> => {
  const startTime = performance.now();
  try {
    const data = await apiCall();
    const responseTime = performance.now() - startTime;
    return { data, responseTime };
  } catch (error) {
    const responseTime = performance.now() - startTime;
    console.error(`API call failed after ${responseTime.toFixed(2)}ms:`, error);
    throw error;
  }
};

export default SymptoMapAPI;

