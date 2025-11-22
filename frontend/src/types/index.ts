// Core MVP Types
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

export interface FilterState {
  diseaseTypes: string[];
  severityLevels: number[];
  timeWindow: TimeWindow;
  bounds?: GeographicBounds;
}

export interface TimeWindow {
  start: Date;
  end: Date;
  days: number;
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

export interface WebSocketEvents {
  'outbreak:created': (outbreak: OutbreakCluster) => void;
  'outbreak:updated': (outbreak: OutbreakCluster) => void;
  'outbreak:deleted': (id: string) => void;
  'map:subscribe': (bounds: GeographicBounds) => void;
  'prediction:ready': (prediction: MLPrediction) => void;
}

export interface MapState {
  outbreaks: OutbreakCluster[];
  predictions: MLPrediction[];
  filters: FilterState;
  timeWindow: TimeWindow;
  isLoading: boolean;
  error: string | null;
  selectedCluster: OutbreakCluster | null;
  isPlaying: boolean;
  playbackSpeed: number;
}

export interface PerformanceMetrics {
  apiResponseTime: number;
  mapRenderTime: number;
  webSocketLatency: number;
  concurrentUsers: number;
  dataPoints: number;
}

// API Response Types
export interface ApiResponse<T> {
  data: T;
  meta: {
    total: number;
    page: number;
    limit: number;
    generatedAt: string;
  };
}

export interface OutbreakApiResponse extends ApiResponse<OutbreakCluster[]> {
  meta: ApiResponse<OutbreakCluster[]>['meta'] & {
    bounds: GeographicBounds;
  };
}

// Component Props
export interface OutbreakMapProps {
  outbreaks: OutbreakCluster[];
  onClusterClick: (cluster: OutbreakCluster) => void;
  filters: FilterState;
  timeWindow: TimeWindow;
  isPlaying: boolean;
  playbackSpeed: number;
}

export interface TimeLapseControlsProps {
  timeWindow: TimeWindow;
  isPlaying: boolean;
  playbackSpeed: number;
  onTimeChange: (timeWindow: TimeWindow) => void;
  onPlayPause: () => void;
  onSpeedChange: (speed: number) => void;
}

export interface PredictionPanelProps {
  predictions: MLPrediction[];
  selectedRegion: GeographicBounds;
  isLoading: boolean;
}

export interface FilterPanelProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  availableDiseaseTypes: string[];
}

// Utility Types
export type SeverityLevel = 1 | 2 | 3 | 4 | 5;
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type DiseaseType = 'covid-19' | 'influenza' | 'measles' | 'tuberculosis' | 'malaria' | 'other';

// Constants
export const SEVERITY_COLORS = {
  1: '#10b981', // green
  2: '#84cc16', // lime
  3: '#f59e0b', // amber
  4: '#ef4444', // red
  5: '#dc2626', // dark red
} as const;

export const RISK_COLORS = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#ef4444',
  critical: '#dc2626',
} as const;

export const DEFAULT_TIME_WINDOW_DAYS = 30;
export const PLAYBACK_SPEEDS = [0.5, 1, 2, 4, 8] as const;
export const MAX_CONCURRENT_USERS = 1000;
export const PERFORMANCE_TARGETS = {
  apiResponseTime: 200, // ms
  mapRenderTime: 50, // ms
  webSocketLatency: 100, // ms
} as const;

