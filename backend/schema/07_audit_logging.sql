-- Comprehensive audit logging for compliance and security
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Event identification
    event_type VARCHAR(100) NOT NULL,
    event_category VARCHAR(50) NOT NULL CHECK (event_category IN ('authentication', 'authorization', 'data_access', 'data_modification', 'system', 'security', 'business')),
    event_action VARCHAR(100) NOT NULL,
    
    -- User and session information
    user_id UUID REFERENCES users(id),
    session_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    
    -- Resource information
    resource_type VARCHAR(100), -- 'outbreak_report', 'user', 'organization', etc.
    resource_id UUID,
    resource_name VARCHAR(255),
    
    -- Request/response details
    request_method VARCHAR(10),
    request_url TEXT,
    request_headers JSONB,
    request_body JSONB,
    response_status INTEGER,
    response_time_ms INTEGER,
    
    -- Event details
    event_data JSONB, -- Additional event-specific data
    outcome VARCHAR(20) CHECK (outcome IN ('success', 'failure', 'error')),
    error_message TEXT,
    error_code VARCHAR(50),
    
    -- Geographic context
    location_country VARCHAR(3),
    location_region VARCHAR(100),
    location_city VARCHAR(100),
    
    -- Compliance fields
    data_classification VARCHAR(20) DEFAULT 'internal' CHECK (data_classification IN ('public', 'internal', 'confidential', 'restricted')),
    retention_period_days INTEGER DEFAULT 2555, -- 7 years for compliance
    
    -- Timestamps
    event_timestamp TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Partitioning by month for performance
-- CREATE TABLE audit_logs_y2024m01 PARTITION OF audit_logs
-- FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Indexes for performance
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_event_category ON audit_logs(event_category);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_event_timestamp ON audit_logs(event_timestamp DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_outcome ON audit_logs(outcome);
CREATE INDEX idx_audit_logs_ip_address ON audit_logs(ip_address);

-- Composite indexes for common queries
CREATE INDEX idx_audit_logs_user_time ON audit_logs(user_id, event_timestamp DESC);
CREATE INDEX idx_audit_logs_type_time ON audit_logs(event_type, event_timestamp DESC);

-- RLS policies for audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own audit logs or admins can see all
CREATE POLICY audit_logs_select_policy ON audit_logs
    FOR SELECT USING (
        user_id = current_user_id() OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = current_user_id() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- Policy: Only system can insert audit logs
CREATE POLICY audit_logs_insert_policy ON audit_logs
    FOR INSERT WITH CHECK (true); -- System inserts only

-- Function to log audit events
CREATE OR REPLACE FUNCTION log_audit_event(
    p_event_type VARCHAR(100),
    p_event_category VARCHAR(50),
    p_event_action VARCHAR(100),
    p_user_id UUID DEFAULT NULL,
    p_session_id VARCHAR(255) DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_resource_type VARCHAR(100) DEFAULT NULL,
    p_resource_id UUID DEFAULT NULL,
    p_resource_name VARCHAR(255) DEFAULT NULL,
    p_request_method VARCHAR(10) DEFAULT NULL,
    p_request_url TEXT DEFAULT NULL,
    p_request_headers JSONB DEFAULT NULL,
    p_request_body JSONB DEFAULT NULL,
    p_response_status INTEGER DEFAULT NULL,
    p_response_time_ms INTEGER DEFAULT NULL,
    p_event_data JSONB DEFAULT NULL,
    p_outcome VARCHAR(20) DEFAULT 'success',
    p_error_message TEXT DEFAULT NULL,
    p_error_code VARCHAR(50) DEFAULT NULL,
    p_data_classification VARCHAR(20) DEFAULT 'internal'
)
RETURNS UUID AS $$
DECLARE
    audit_id UUID;
BEGIN
    INSERT INTO audit_logs (
        event_type, event_category, event_action, user_id, session_id,
        ip_address, user_agent, resource_type, resource_id, resource_name,
        request_method, request_url, request_headers, request_body,
        response_status, response_time_ms, event_data, outcome,
        error_message, error_code, data_classification
    ) VALUES (
        p_event_type, p_event_category, p_event_action, p_user_id, p_session_id,
        p_ip_address, p_user_agent, p_resource_type, p_resource_id, p_resource_name,
        p_request_method, p_request_url, p_request_headers, p_request_body,
        p_response_status, p_response_time_ms, p_event_data, p_outcome,
        p_error_message, p_error_code, p_data_classification
    ) RETURNING id INTO audit_id;
    
    RETURN audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old audit logs
CREATE OR REPLACE FUNCTION cleanup_audit_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
    retention_days INTEGER;
BEGIN
    -- Get retention period from configuration or use default
    retention_days := COALESCE(
        (SELECT value::INTEGER FROM system_config WHERE key = 'audit_retention_days'),
        2555 -- 7 years default
    );
    
    DELETE FROM audit_logs 
    WHERE created_at < NOW() - INTERVAL '1 day' * retention_days;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- System configuration table
CREATE TABLE system_config (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    data_type VARCHAR(20) DEFAULT 'string' CHECK (data_type IN ('string', 'integer', 'boolean', 'json')),
    is_encrypted BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default configuration
INSERT INTO system_config (key, value, description, data_type) VALUES
('audit_retention_days', '2555', 'Number of days to retain audit logs', 'integer'),
('max_failed_login_attempts', '5', 'Maximum failed login attempts before account lockout', 'integer'),
('session_timeout_minutes', '15', 'Session timeout in minutes for HIPAA compliance', 'integer'),
('data_encryption_enabled', 'true', 'Enable data encryption at rest', 'boolean'),
('api_rate_limit_per_hour', '1000', 'API rate limit per user per hour', 'integer');