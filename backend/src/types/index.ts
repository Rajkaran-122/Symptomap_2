// Backend Types for SymptoMap MVP

export interface OutbreakCluster {
  id: string;
  latitude: number;
  longitude: number;
  caseCount: number;
  severityLevel: 1 | 2 | 3 | 4 | 5;
  diseaseType: string;
  confidence: number;
  lastUpdated: string;
  symptoms: string[];
  locationName?: string;
}

export interface GeographicBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface MLPrediction {
  id: string;
  region: GeographicBounds;
  predictions: PredictionDataPoint[];
  confidenceScore: number;
  modelVersion: string;
  generatedAt: string;
}

export interface PredictionDataPoint {
  date: string;
  predictedCases: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface ApiResponse<T> {
  data: T;
  meta: {
    total?: number;
    page?: number;
    limit?: number;
    generatedAt: string;
  };
}

export interface ErrorResponse {
  error: string;
  message: string;
  details?: any;
  timestamp: string;
  requestId?: string;
}

export interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  environment: string;
  uptime?: number;
  checks?: Record<string, string>;
}

export interface PerformanceMetrics {
  apiResponseTime: number;
  concurrentUsers: number;
  dataPoints: number;
  systemHealth: {
    database: string;
    redis: string;
    websocket: string;
  };
  outbreakMetrics: {
    totalOutbreaks24h: number;
    totalCases24h: number;
    avgSeverity: number;
    maxSeverity: number;
  };
  timestamp: string;
}

export interface AuditEvent {
  user_id?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  details?: any;
  ip_address?: string;
  user_agent?: string;
}

export interface WebSocketConnection {
  id: string;
  connection_id: string;
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
  subscribed_regions: any[];
  connected_at: string;
  last_ping_at: string;
  disconnected_at?: string;
}

export interface SystemMetric {
  id: string;
  metric_name: string;
  metric_value: number;
  metric_unit?: string;
  tags: Record<string, any>;
  recorded_at: string;
}

// Database row types
export interface OutbreakReportRow {
  id: string;
  disease_type: string;
  latitude: number;
  longitude: number;
  case_count: number;
  severity_level: number;
  confidence: number;
  symptoms: string[];
  location_name?: string;
  data_source: string;
  created_at: Date;
  updated_at: Date;
}

export interface MLPredictionRow {
  id: string;
  region_bounds: string; // JSON string
  disease_type: string;
  model_version: string;
  predictions: string; // JSON string
  confidence_score: number;
  mape?: number;
  rmse?: number;
  created_at: Date;
  expires_at: Date;
}

export interface AuditLogRow {
  id: string;
  user_id?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  details: string; // JSON string
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}

// Service interfaces
export interface OutbreakFilters {
  lat_min?: number;
  lat_max?: number;
  lng_min?: number;
  lng_max?: number;
  days?: number;
  disease_type?: string;
  severity_min?: number;
}

export interface OutbreakStats {
  total_cases: number;
  total_outbreaks: number;
  avg_severity: number;
  max_severity: number;
  min_severity: number;
}

export interface NearbyOutbreak {
  id: string;
  disease_type: string;
  case_count: number;
  severity_level: number;
  distance_km: number;
  created_at: string;
}

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

export interface PerformanceMetricsData {
  model_id: string;
  mape: number;
  rmse: number;
  accuracy: number;
  last_evaluated: string;
}

// Constants
export const SEVERITY_LEVELS = [1, 2, 3, 4, 5] as const;
export const DISEASE_TYPES = ['covid-19', 'influenza', 'measles', 'tuberculosis', 'malaria', 'other'] as const;
export const RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const;

export type SeverityLevel = typeof SEVERITY_LEVELS[number];
export type DiseaseType = typeof DISEASE_TYPES[number];
export type RiskLevel = typeof RISK_LEVELS[number];