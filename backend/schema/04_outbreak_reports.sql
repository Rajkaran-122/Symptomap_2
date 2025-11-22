-- Main outbreak reports table with comprehensive data model
CREATE TABLE outbreak_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disease_id UUID REFERENCES diseases(id) NOT NULL,
    organization_id UUID REFERENCES organizations(id),
    reporter_id UUID REFERENCES users(id),
    
    -- Geographic data with PostGIS support
    latitude DECIMAL(10, 7) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude DECIMAL(11, 7) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    location_name VARCHAR(255),
    administrative_level VARCHAR(50) CHECK (administrative_level IN ('city', 'county', 'state', 'province', 'country')),
    country_code VARCHAR(3), -- ISO 3166-1 alpha-3
    region_code VARCHAR(10),
    
    -- Case data
    case_count INTEGER NOT NULL DEFAULT 1 CHECK (case_count > 0),
    severity_level INTEGER CHECK (severity_level BETWEEN 1 AND 5),
    age_demographics JSONB, -- Age group breakdowns
    gender_demographics JSONB, -- Gender breakdowns
    
    -- Temporal data
    onset_date DATE,
    report_date DATE NOT NULL DEFAULT CURRENT_DATE,
    first_symptom_date DATE,
    
    -- Clinical data
    symptoms JSONB, -- Array of observed symptoms
    risk_factors JSONB, -- Environmental or behavioral factors
    comorbidities JSONB, -- Pre-existing conditions
    treatment_status VARCHAR(50) CHECK (treatment_status IN ('untreated', 'treated', 'recovered', 'deceased')),
    
    -- Data quality and source
    confidence_score DECIMAL(3,2) CHECK (confidence_score BETWEEN 0 AND 1),
    data_source VARCHAR(100) CHECK (data_source IN ('manual', 'emr', 'lab', 'social', 'api', 'import')),
    verification_status VARCHAR(50) DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
    
    -- Additional context
    notes TEXT,
    external_references JSONB, -- Links to external reports or sources
    
    -- Audit fields
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

-- Create spatial index for geographic queries
CREATE INDEX idx_outbreak_reports_location ON outbreak_reports 
USING GIST (ST_Point(longitude, latitude));

-- Performance indexes
CREATE INDEX idx_outbreak_reports_disease_id ON outbreak_reports(disease_id);
CREATE INDEX idx_outbreak_reports_created_at ON outbreak_reports(created_at DESC);
CREATE INDEX idx_outbreak_reports_severity ON outbreak_reports(severity_level);
CREATE INDEX idx_outbreak_reports_organization ON outbreak_reports(organization_id);
CREATE INDEX idx_outbreak_reports_country ON outbreak_reports(country_code);
CREATE INDEX idx_outbreak_reports_confidence ON outbreak_reports(confidence_score);

-- Composite indexes for common queries
CREATE INDEX idx_outbreak_reports_geo_time ON outbreak_reports (created_at DESC, latitude, longitude);
CREATE INDEX idx_outbreak_reports_active ON outbreak_reports (disease_id, severity_level, created_at) 
WHERE severity_level >= 3 AND created_at >= NOW() - INTERVAL '30 days';

-- Convert to hypertable for time-series optimization (TimescaleDB)
-- SELECT create_hypertable('outbreak_reports', 'created_at');

-- RLS policies for outbreak reports
ALTER TABLE outbreak_reports ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see reports from their organization or public reports
CREATE POLICY outbreak_reports_select_policy ON outbreak_reports
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = current_user_id()
        ) OR
        organization_id IS NULL OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = current_user_id() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- Policy: Users can insert reports for their organization
CREATE POLICY outbreak_reports_insert_policy ON outbreak_reports
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = current_user_id()
        ) OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = current_user_id() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- Policy: Users can update reports from their organization
CREATE POLICY outbreak_reports_update_policy ON outbreak_reports
    FOR UPDATE USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = current_user_id()
        ) OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = current_user_id() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- Function to calculate outbreak risk score
CREATE OR REPLACE FUNCTION calculate_outbreak_risk_score(
    p_case_count INTEGER,
    p_severity_level INTEGER,
    p_population_density DECIMAL,
    p_days_since_onset INTEGER,
    p_confidence_score DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
    risk_score DECIMAL;
BEGIN
    -- Base risk from case count and severity
    risk_score := (p_case_count * p_severity_level) / 10.0;
    
    -- Adjust for population density (higher density = higher risk)
    risk_score := risk_score * (1 + (p_population_density / 1000.0));
    
    -- Adjust for time (more recent = higher risk)
    risk_score := risk_score * (1 + (1.0 / GREATEST(p_days_since_onset, 1)));
    
    -- Adjust for confidence (lower confidence = lower risk)
    risk_score := risk_score * p_confidence_score;
    
    -- Normalize to 0-1 scale
    RETURN LEAST(risk_score / 100.0, 1.0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;