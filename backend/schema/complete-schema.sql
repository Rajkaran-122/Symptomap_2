-- Create all necessary database schemas for SymptoMap

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS uuid-ossp;
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS collaboration_sessions CASCADE;
DROP TABLE IF EXISTS websocket_connections CASCADE;
DROP TABLE IF EXISTS system_metrics CASCADE;
DROP TABLE IF EXISTS ml_predictions CASCADE;
DROP TABLE IF EXISTS disease_tracking CASCADE;
DROP TABLE IF EXISTS outbreak_reports CASCADE;
DROP TABLE IF EXISTS organization_members CASCADE;
DROP TABLE IF EXISTS disease_profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- 1. Organizations table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('hospital', 'health_dept', 'research', 'government', 'ngo')),
    region VARCHAR(100),
    country VARCHAR(100),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    api_key VARCHAR(255) UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_organizations_type ON organizations(type);
CREATE INDEX idx_organizations_region ON organizations(region);
CREATE INDEX idx_organizations_api_key ON organizations(api_key) WHERE api_key IS NOT NULL;

-- 2. Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- 3. Disease Profiles table
CREATE TABLE disease_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    transmission_type VARCHAR(50),
    severity_level INTEGER CHECK (severity_level BETWEEN 1 AND 5),
    incubation_period INTEGER,
    common_symptoms TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_disease_profiles_name ON disease_profiles(name);

-- 4. Outbreak Reports table
CREATE TABLE outbreak_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disease_id UUID REFERENCES disease_profiles(id),
    organization_id UUID REFERENCES organizations(id),
    latitude DECIMAL(10,7) NOT NULL,
    longitude DECIMAL(11,7) NOT NULL,
    case_count INTEGER NOT NULL CHECK (case_count > 0),
    severity_level INTEGER NOT NULL CHECK (severity_level BETWEEN 1 AND 5),
    confidence DECIMAL(3,2) NOT NULL DEFAULT 0.8 CHECK (confidence BETWEEN 0 AND 1),
    symptoms TEXT[] DEFAULT '{}',
    location_name VARCHAR(255),
    data_source VARCHAR(100) DEFAULT 'user_report',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_outbreak_reports_location ON outbreak_reports (latitude, longitude);
CREATE INDEX idx_outbreak_reports_disease_severity ON outbreak_reports (disease_id, severity_level, created_at DESC);
CREATE INDEX idx_outbreak_reports_created_at ON outbreak_reports (created_at DESC);

-- 5. ML Predictions table
CREATE TABLE ml_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disease_id UUID REFERENCES disease_profiles(id),
    region_bounds JSONB NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    predictions JSONB NOT NULL,
    confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score BETWEEN 0 AND 1),
    mape DECIMAL(5,2),
    rmse DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX idx_ml_predictions_disease_created ON ml_predictions (disease_id, created_at DESC);

-- 6. Disease Tracking table
CREATE TABLE disease_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disease_id UUID NOT NULL REFERENCES disease_profiles(id),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    is_tracked BOOLEAN DEFAULT true,
    tracking_priority INTEGER DEFAULT 5 CHECK (tracking_priority BETWEEN 1 AND 10),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(disease_id, organization_id)
);

CREATE INDEX idx_disease_tracking_org ON disease_tracking(organization_id);

-- 7. System Metrics table
CREATE TABLE system_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,4) NOT NULL,
    metric_unit VARCHAR(20),
    tags JSONB DEFAULT '{}',
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_system_metrics_name_time ON system_metrics (metric_name, recorded_at DESC);

-- 8. WebSocket Connections table
CREATE TABLE websocket_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id VARCHAR(100) NOT NULL UNIQUE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    subscribed_regions JSONB DEFAULT '[]',
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_ping_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    disconnected_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_websocket_connections_active ON websocket_connections (connected_at DESC) WHERE disconnected_at IS NULL;

-- 9. Collaboration Sessions table
CREATE TABLE collaboration_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    session_name VARCHAR(255),
    participants JSONB DEFAULT '[]',
    status VARCHAR(50) DEFAULT 'active',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_collaboration_sessions_org ON collaboration_sessions(organization_id);

-- 10. Audit Logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(255),
    changes JSONB,
    ip_address VARCHAR(45),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_timestamp ON audit_logs (user_id, timestamp DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs (resource_type, resource_id);

-- Create some default disease profiles
INSERT INTO disease_profiles (name, description, transmission_type, severity_level, common_symptoms)
VALUES
    ('COVID-19', 'Coronavirus Disease 2019', 'respiratory', 4, '{"fever","cough","fatigue"}'),
    ('Influenza', 'Seasonal Influenza', 'respiratory', 3, '{"fever","cough","body_aches"}'),
    ('Malaria', 'Parasitic infection', 'vector-borne', 4, '{"fever","chills","headache"}'),
    ('Dengue', 'Dengue fever', 'vector-borne', 3, '{"fever","rash","joint_pain"}'),
    ('Measles', 'Viral infection', 'respiratory', 4, '{"fever","rash","cough"}')
ON CONFLICT DO NOTHING;

-- Grant privileges to symptomap user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO symptomap;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO symptomap;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO symptomap;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO symptomap;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO symptomap;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO symptomap;
