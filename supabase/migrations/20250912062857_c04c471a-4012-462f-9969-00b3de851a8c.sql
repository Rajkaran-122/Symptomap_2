-- Create symptom_reports table for user-submitted symptoms
CREATE TABLE public.symptom_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_lat DECIMAL(10, 8) NOT NULL,
  location_lng DECIMAL(11, 8) NOT NULL,
  location_city TEXT NOT NULL,
  location_country TEXT NOT NULL,
  symptoms TEXT[] NOT NULL,
  description TEXT NOT NULL,
  severity INTEGER NOT NULL CHECK (severity >= 1 AND severity <= 10),
  age_range TEXT,
  has_recent_travel BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create outbreak_clusters table for detected disease clusters
CREATE TABLE public.outbreak_clusters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  center_lat DECIMAL(10, 8) NOT NULL,
  center_lng DECIMAL(11, 8) NOT NULL,
  radius DECIMAL(8, 6) NOT NULL,
  report_count INTEGER NOT NULL DEFAULT 0,
  dominant_symptoms TEXT[] NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('normal', 'unusual', 'concerning', 'critical')),
  risk_score DECIMAL(5, 2) NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  growth_rate DECIMAL(8, 4) NOT NULL DEFAULT 0,
  location_name TEXT NOT NULL,
  first_detected TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create health_alerts table for notifications to health officials
CREATE TABLE public.health_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cluster_id UUID REFERENCES public.outbreak_clusters(id) ON DELETE CASCADE,
  alert_level TEXT NOT NULL CHECK (alert_level IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  affected_regions TEXT[] NOT NULL,
  estimated_impact TEXT,
  recommended_actions TEXT[],
  is_acknowledged BOOLEAN DEFAULT false,
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Create analysis_cache table for cached OpenAI API responses
CREATE TABLE public.analysis_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  input_hash TEXT NOT NULL UNIQUE, -- Hash of the input for deduplication
  symptoms_text TEXT NOT NULL,
  ai_response JSONB NOT NULL, -- Store the full OpenAI response
  medical_terms TEXT[],
  icd10_codes TEXT[],
  cluster_probability DECIMAL(3, 2) CHECK (cluster_probability >= 0 AND cluster_probability <= 1),
  risk_score DECIMAL(5, 2) CHECK (risk_score >= 0 AND risk_score <= 100),
  model_used TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);

-- Enable Row Level Security on all tables
ALTER TABLE public.symptom_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbreak_clusters ENABLE ROW LEVEL SECURITY;  
ALTER TABLE public.health_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies for symptom_reports (anonymous submissions allowed)
CREATE POLICY "Anyone can insert symptom reports anonymously" 
ON public.symptom_reports 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can read symptom reports for analysis" 
ON public.symptom_reports 
FOR SELECT 
USING (true);

-- RLS Policies for outbreak_clusters (read-only for public)
CREATE POLICY "Anyone can view active outbreak clusters" 
ON public.outbreak_clusters 
FOR SELECT 
USING (is_active = true);

-- RLS Policies for health_alerts (read-only for public, write for authenticated users)
CREATE POLICY "Anyone can view health alerts" 
ON public.health_alerts 
FOR SELECT 
USING (true);

CREATE POLICY "Only authenticated users can manage health alerts" 
ON public.health_alerts 
FOR ALL 
USING (auth.uid() IS NOT NULL);

-- RLS Policies for analysis_cache (system use only)
CREATE POLICY "System can manage analysis cache" 
ON public.analysis_cache 
FOR ALL 
USING (true);

-- Create indexes for performance
CREATE INDEX idx_symptom_reports_location ON public.symptom_reports(location_lat, location_lng);
CREATE INDEX idx_symptom_reports_created_at ON public.symptom_reports(created_at DESC);
CREATE INDEX idx_symptom_reports_symptoms ON public.symptom_reports USING GIN(symptoms);

CREATE INDEX idx_outbreak_clusters_location ON public.outbreak_clusters(center_lat, center_lng);
CREATE INDEX idx_outbreak_clusters_active ON public.outbreak_clusters(is_active, last_updated DESC);
CREATE INDEX idx_outbreak_clusters_severity ON public.outbreak_clusters(severity);

CREATE INDEX idx_health_alerts_level ON public.health_alerts(alert_level);
CREATE INDEX idx_health_alerts_created_at ON public.health_alerts(created_at DESC);
CREATE INDEX idx_health_alerts_cluster_id ON public.health_alerts(cluster_id);

CREATE INDEX idx_analysis_cache_hash ON public.analysis_cache(input_hash);
CREATE INDEX idx_analysis_cache_expires ON public.analysis_cache(expires_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_symptom_reports_updated_at
  BEFORE UPDATE ON public.symptom_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_outbreak_clusters_updated_at
  BEFORE UPDATE ON public.outbreak_clusters  
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to clean expired cache entries
CREATE OR REPLACE FUNCTION public.cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM public.analysis_cache WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SET search_path = public;