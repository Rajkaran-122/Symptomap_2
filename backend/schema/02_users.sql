-- Users table with comprehensive role-based access control
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'analyst', 'admin', 'super_admin')),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    last_login TIMESTAMP,
    mfa_secret VARCHAR(32),
    mfa_enabled BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance and security
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_last_login ON users(last_login);
CREATE INDEX idx_users_is_active ON users(is_active);

-- RLS policies for users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own profile and users in their organization
CREATE POLICY users_select_policy ON users
    FOR SELECT USING (
        id = current_user_id() OR 
        organization_id IN (
            SELECT organization_id FROM users WHERE id = current_user_id()
        )
    );

-- Policy: Users can only update their own profile
CREATE POLICY users_update_policy ON users
    FOR UPDATE USING (id = current_user_id());

-- Policy: Only admins can insert/delete users
CREATE POLICY users_modify_policy ON users
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = current_user_id() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- Function to get current user ID from JWT
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID AS $$
BEGIN
    -- This will be populated by the application layer
    RETURN COALESCE(current_setting('app.current_user_id', true)::UUID, '00000000-0000-0000-0000-000000000000'::UUID);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;