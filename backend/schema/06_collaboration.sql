-- Map annotations for collaborative features
CREATE TABLE map_annotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID REFERENCES users(id) NOT NULL,
    
    -- Geographic data
    latitude DECIMAL(10, 7) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude DECIMAL(11, 7) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    radius_meters INTEGER DEFAULT 1000 CHECK (radius_meters > 0),
    
    -- Content
    title VARCHAR(255) NOT NULL,
    description TEXT,
    annotation_type VARCHAR(50) NOT NULL CHECK (annotation_type IN ('warning', 'info', 'analysis', 'question', 'note')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    
    -- Styling
    color VARCHAR(7) DEFAULT '#3B82F6', -- Hex color
    icon VARCHAR(50), -- Icon identifier
    
    -- Sharing settings
    visibility VARCHAR(20) DEFAULT 'private' CHECK (visibility IN ('private', 'team', 'organization', 'public')),
    shared_with UUID[], -- Array of user IDs
    organization_id UUID REFERENCES organizations(id),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_resolved BOOLEAN DEFAULT false,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP,
    
    -- Audit
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_map_annotations_creator ON map_annotations(creator_id);
CREATE INDEX idx_map_annotations_visibility ON map_annotations(visibility);
CREATE INDEX idx_map_annotations_organization ON map_annotations(organization_id);
CREATE INDEX idx_map_annotations_type ON map_annotations(annotation_type);
CREATE INDEX idx_map_annotations_priority ON map_annotations(priority);
CREATE INDEX idx_map_annotations_created_at ON map_annotations(created_at DESC);

-- Spatial index for geographic queries
CREATE INDEX idx_map_annotations_location ON map_annotations 
USING GIST (ST_Point(longitude, latitude));

-- RLS policies for map annotations
ALTER TABLE map_annotations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see annotations they created, shared with them, or public annotations
CREATE POLICY map_annotations_select_policy ON map_annotations
    FOR SELECT USING (
        creator_id = current_user_id() OR
        visibility = 'public' OR
        (visibility = 'organization' AND organization_id IN (
            SELECT organization_id FROM users WHERE id = current_user_id()
        )) OR
        (visibility = 'team' AND current_user_id() = ANY(shared_with)) OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = current_user_id() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- Policy: Users can create annotations
CREATE POLICY map_annotations_insert_policy ON map_annotations
    FOR INSERT WITH CHECK (creator_id = current_user_id());

-- Policy: Users can update their own annotations or if they have admin rights
CREATE POLICY map_annotations_update_policy ON map_annotations
    FOR UPDATE USING (
        creator_id = current_user_id() OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = current_user_id() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- Comments table for annotation discussions
CREATE TABLE annotation_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    annotation_id UUID REFERENCES map_annotations(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) NOT NULL,
    content TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false, -- Internal comments not visible to all users
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for comments
CREATE INDEX idx_annotation_comments_annotation ON annotation_comments(annotation_id);
CREATE INDEX idx_annotation_comments_author ON annotation_comments(author_id);
CREATE INDEX idx_annotation_comments_created_at ON annotation_comments(created_at DESC);

-- RLS policies for comments
ALTER TABLE annotation_comments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see comments on annotations they can see
CREATE POLICY annotation_comments_select_policy ON annotation_comments
    FOR SELECT USING (
        annotation_id IN (
            SELECT id FROM map_annotations WHERE 
            creator_id = current_user_id() OR
            visibility = 'public' OR
            (visibility = 'organization' AND organization_id IN (
                SELECT organization_id FROM users WHERE id = current_user_id()
            )) OR
            (visibility = 'team' AND current_user_id() = ANY(shared_with))
        )
    );

-- Policy: Users can create comments
CREATE POLICY annotation_comments_insert_policy ON annotation_comments
    FOR INSERT WITH CHECK (author_id = current_user_id());

-- Policy: Users can update their own comments
CREATE POLICY annotation_comments_update_policy ON annotation_comments
    FOR UPDATE USING (author_id = current_user_id());