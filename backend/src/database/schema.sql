-- SymptoMap MVP Database Schema
-- Optimized for real-time disease surveillance and outbreak prediction

-- Enable PostGIS extension for geospatial data
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enable TimescaleDB for time-series data
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Outbreak reports table (main data source)
CREATE TABLE outbreak_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disease_type VARCHAR(50) NOT NULL,
    latitude DECIMAL(10,7) NOT NULL,
    longitude DECIMAL(11,7) NOT NULL,
    case_count INTEGER NOT NULL CHECK (case_count > 0),
    severity_level INTEGER NOT NULL CHECK (severity_level BETWEEN 1 AND 5),
    confidence DECIMAL(3,2) NOT NULL DEFAULT 0.8 CHECK (confidence BETWEEN 0 AND 1),
    symptoms TEXT[] DEFAULT '{}',
    location_name VARCHAR(255),
    data_source VARCHAR(100) DEFAULT 'user_report',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Convert to TimescaleDB hypertable for time-series optimization
SELECT create_hypertable('outbreak_reports', 'created_at');

-- Geospatial index for efficient location queries
CREATE INDEX idx_outbreak_reports_location ON outbreak_reports 
USING GIST (ST_Point(longitude, latitude));

-- Composite index for common query patterns
CREATE INDEX idx_outbreak_reports_disease_severity ON outbreak_reports 
(disease_type, severity_level, created_at DESC);

-- Index for time-based queries
CREATE INDEX idx_outbreak_reports_created_at ON outbreak_reports 
(created_at DESC);

-- ML predictions table
CREATE TABLE ml_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_bounds JSONB NOT NULL, -- {north, south, east, west}
    disease_type VARCHAR(50) NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    predictions JSONB NOT NULL, -- Array of prediction data points
    confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score BETWEEN 0 AND 1),
    mape DECIMAL(5,2), -- Mean Absolute Percentage Error
    rmse DECIMAL(10,2), -- Root Mean Square Error
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days')
);

-- Index for prediction lookups
CREATE INDEX idx_ml_predictions_region ON ml_predictions 
USING GIST ((region_bounds::text));

CREATE INDEX idx_ml_predictions_disease_created ON ml_predictions 
(disease_type, created_at DESC);

-- System metrics table for performance monitoring
CREATE TABLE system_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,4) NOT NULL,
    metric_unit VARCHAR(20),
    tags JSONB DEFAULT '{}',
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('system_metrics', 'recorded_at');

-- Index for metrics queries
CREATE INDEX idx_system_metrics_name_time ON system_metrics 
(metric_name, recorded_at DESC);

-- WebSocket connections tracking
CREATE TABLE websocket_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id VARCHAR(100) NOT NULL UNIQUE,
    user_id UUID,
    ip_address INET,
    user_agent TEXT,
    subscribed_regions JSONB DEFAULT '[]',
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_ping_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    disconnected_at TIMESTAMP WITH TIME ZONE
);

-- Index for connection management
CREATE INDEX idx_websocket_connections_active ON websocket_connections 
(connected_at DESC) WHERE disconnected_at IS NULL;

-- Audit log for compliance and debugging
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for audit queries
CREATE INDEX idx_audit_logs_user_action ON audit_logs 
(user_id, action, created_at DESC);

CREATE INDEX idx_audit_logs_resource ON audit_logs 
(resource_type, resource_id, created_at DESC);

-- Functions for data management

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_outbreak_reports_updated_at 
    BEFORE UPDATE ON outbreak_reports 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up old data
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete old predictions (older than 7 days)
    DELETE FROM ml_predictions WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Delete old metrics (older than 30 days)
    DELETE FROM system_metrics WHERE recorded_at < NOW() - INTERVAL '30 days';
    
    -- Delete old audit logs (older than 1 year)
    DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '1 year';
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get outbreak statistics
CREATE OR REPLACE FUNCTION get_outbreak_stats(
    p_disease_type VARCHAR DEFAULT NULL,
    p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
    total_cases BIGINT,
    total_outbreaks BIGINT,
    avg_severity DECIMAL,
    max_severity INTEGER,
    min_severity INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        SUM(case_count) as total_cases,
        COUNT(*) as total_outbreaks,
        AVG(severity_level) as avg_severity,
        MAX(severity_level) as max_severity,
        MIN(severity_level) as min_severity
    FROM outbreak_reports
    WHERE 
        (p_disease_type IS NULL OR disease_type = p_disease_type)
        AND created_at >= NOW() - INTERVAL '1 day' * p_days_back;
END;
$$ LANGUAGE plpgsql;

-- Function to find nearby outbreaks
CREATE OR REPLACE FUNCTION find_nearby_outbreaks(
    p_latitude DECIMAL,
    p_longitude DECIMAL,
    p_radius_km DECIMAL DEFAULT 10,
    p_days_back INTEGER DEFAULT 7
)
RETURNS TABLE (
    id UUID,
    disease_type VARCHAR,
    case_count INTEGER,
    severity_level INTEGER,
    distance_km DECIMAL,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id,
        o.disease_type,
        o.case_count,
        o.severity_level,
        ST_Distance(
            ST_Point(p_longitude, p_latitude)::geography,
            ST_Point(o.longitude, o.latitude)::geography
        ) / 1000 as distance_km,
        o.created_at
    FROM outbreak_reports o
    WHERE 
        ST_DWithin(
            ST_Point(p_longitude, p_latitude)::geography,
            ST_Point(o.longitude, o.latitude)::geography,
            p_radius_km * 1000
        )
        AND o.created_at >= NOW() - INTERVAL '1 day' * p_days_back
    ORDER BY distance_km ASC;
END;
$$ LANGUAGE plpgsql;

-- Views for common queries

-- Active outbreaks view (last 24 hours)
CREATE VIEW active_outbreaks AS
SELECT 
    id,
    disease_type,
    latitude,
    longitude,
    case_count,
    severity_level,
    confidence,
    symptoms,
    location_name,
    created_at
FROM outbreak_reports
WHERE created_at >= NOW() - INTERVAL '24 hours';

-- Outbreak summary by disease type
CREATE VIEW outbreak_summary_by_disease AS
SELECT 
    disease_type,
    COUNT(*) as outbreak_count,
    SUM(case_count) as total_cases,
    AVG(severity_level) as avg_severity,
    MAX(severity_level) as max_severity,
    MIN(created_at) as first_report,
    MAX(created_at) as last_report
FROM outbreak_reports
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY disease_type
ORDER BY total_cases DESC;

-- Performance monitoring view
CREATE VIEW system_performance AS
SELECT 
    metric_name,
    AVG(metric_value) as avg_value,
    MAX(metric_value) as max_value,
    MIN(metric_value) as min_value,
    COUNT(*) as sample_count,
    MAX(recorded_at) as last_updated
FROM system_metrics
WHERE recorded_at >= NOW() - INTERVAL '1 hour'
GROUP BY metric_name
ORDER BY metric_name;

-- Row Level Security (RLS) policies for data protection
ALTER TABLE outbreak_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read access to outbreak reports (for public health transparency)
CREATE POLICY outbreak_reports_public_read ON outbreak_reports
    FOR SELECT USING (true);

-- Policy: Allow authenticated users to insert outbreak reports
CREATE POLICY outbreak_reports_authenticated_insert ON outbreak_reports
    FOR INSERT WITH CHECK (true);

-- Policy: Allow read access to predictions
CREATE POLICY ml_predictions_public_read ON ml_predictions
    FOR SELECT USING (true);

-- Policy: Allow read access to audit logs (admin only in production)
CREATE POLICY audit_logs_read ON audit_logs
    FOR SELECT USING (true);

-- Grant permissions
GRANT SELECT ON outbreak_reports TO PUBLIC;
GRANT SELECT ON ml_predictions TO PUBLIC;
GRANT SELECT ON active_outbreaks TO PUBLIC;
GRANT SELECT ON outbreak_summary_by_disease TO PUBLIC;
GRANT SELECT ON system_performance TO PUBLIC;

-- Insert sample data for development
INSERT INTO outbreak_reports (disease_type, latitude, longitude, case_count, severity_level, confidence, symptoms, location_name) VALUES
('covid-19', 40.7128, -74.0060, 25, 3, 0.85, ARRAY['fever', 'cough', 'fatigue'], 'New York City'),
('influenza', 34.0522, -118.2437, 15, 2, 0.75, ARRAY['fever', 'body_aches'], 'Los Angeles'),
('measles', 51.5074, -0.1278, 8, 4, 0.90, ARRAY['rash', 'fever'], 'London'),
('tuberculosis', 35.6762, 139.6503, 12, 3, 0.80, ARRAY['cough', 'weight_loss'], 'Tokyo'),
('malaria', -26.2041, 28.0473, 20, 4, 0.88, ARRAY['fever', 'chills'], 'Johannesburg');

-- Create scheduled job for data cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-old-data', '0 2 * * *', 'SELECT cleanup_old_data();');

