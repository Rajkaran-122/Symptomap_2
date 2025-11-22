-- Organizations table for multi-tenant support
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

-- Indexes for performance
CREATE INDEX idx_organizations_type ON organizations(type);
CREATE INDEX idx_organizations_region ON organizations(region);
CREATE INDEX idx_organizations_api_key ON organizations(api_key) WHERE api_key IS NOT NULL;

-- RLS policies for organizations
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own organization
CREATE POLICY organizations_select_policy ON organizations
    FOR SELECT USING (
        id IN (
            SELECT organization_id FROM users WHERE id = current_user_id()
        )
    );

-- Policy: Only admins can insert/update organizations
CREATE POLICY organizations_modify_policy ON organizations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = current_user_id() 
            AND role IN ('admin', 'super_admin')
        )
    );