export interface SymptomReportDB {
  id: string;
  location_lat: number;
  location_lng: number;
  location_city: string;
  location_country: string;
  symptoms: string[];
  description: string;
  severity: number;
  age_range?: string;
  has_recent_travel: boolean;
  created_at: string;
  updated_at: string;
}

export interface OutbreakClusterDB {
  id: string;
  center_lat: number;
  center_lng: number;
  radius: number;
  report_count: number;
  dominant_symptoms: string[];
  severity: 'normal' | 'unusual' | 'concerning' | 'critical';
  risk_score: number;
  growth_rate: number;
  location_name: string;
  first_detected: string;
  last_updated: string;
  is_active: boolean;
  created_at: string;
}

export interface HealthAlertDB {
  id: string;
  cluster_id?: string;
  alert_level: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affected_regions: string[];
  estimated_impact?: string;
  recommended_actions?: string[];
  is_acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: string;
  created_at: string;
  expires_at?: string;
}

export interface AnalysisCacheDB {
  id: string;
  input_hash: string;
  symptoms_text: string;
  ai_response: any;
  medical_terms?: string[];
  icd10_codes?: string[];
  cluster_probability?: number;
  risk_score?: number;
  model_used: string;
  created_at: string;
  expires_at: string;
}