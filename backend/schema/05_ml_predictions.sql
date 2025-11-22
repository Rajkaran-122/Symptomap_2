-- ML predictions storage for outbreak forecasting
CREATE TABLE ml_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_version VARCHAR(50) NOT NULL,
    model_name VARCHAR(100) NOT NULL,
    disease_id UUID REFERENCES diseases(id),
    
    -- Geographic bounds for prediction
    bounds_north DECIMAL(10, 7),
    bounds_south DECIMAL(10, 7),
    bounds_east DECIMAL(11, 7),
    bounds_west DECIMAL(11, 7),
    region_name VARCHAR(255),
    
    -- Prediction data
    prediction_date DATE NOT NULL,
    horizon_days INTEGER NOT NULL CHECK (horizon_days BETWEEN 1 AND 30),
    predicted_cases JSONB, -- Daily predictions with confidence intervals
    predicted_severity JSONB, -- Predicted severity trends
    risk_factors JSONB, -- Key risk factors identified
    
    -- Model performance metrics
    confidence_score DECIMAL(3,2) CHECK (confidence_score BETWEEN 0 AND 1),
    mape DECIMAL(5,2), -- Mean Absolute Percentage Error
    rmse DECIMAL(10,2), -- Root Mean Square Error
    r_squared DECIMAL(3,2), -- R-squared value
    
    -- Metadata
    input_features JSONB, -- Features used for prediction
    model_parameters JSONB, -- Model hyperparameters
    training_data_size INTEGER, -- Size of training dataset
    
    -- Cache management
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    
    -- Audit
    created_by UUID REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX idx_ml_predictions_disease_id ON ml_predictions(disease_id);
CREATE INDEX idx_ml_predictions_prediction_date ON ml_predictions(prediction_date);
CREATE INDEX idx_ml_predictions_model_version ON ml_predictions(model_version);
CREATE INDEX idx_ml_predictions_expires_at ON ml_predictions(expires_at);
CREATE INDEX idx_ml_predictions_region ON ml_predictions(region_name);

-- Spatial index for geographic queries
CREATE INDEX idx_ml_predictions_bounds ON ml_predictions 
USING GIST (ST_MakeBox2D(
    ST_Point(bounds_west, bounds_south),
    ST_Point(bounds_east, bounds_north)
));

-- RLS policies for ML predictions
ALTER TABLE ml_predictions ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can read predictions
CREATE POLICY ml_predictions_select_policy ON ml_predictions
    FOR SELECT USING (expires_at > NOW());

-- Policy: Only ML service can insert predictions
CREATE POLICY ml_predictions_insert_policy ON ml_predictions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = current_user_id() 
            AND role IN ('admin', 'super_admin', 'ml_service')
        )
    );

-- Function to clean up expired predictions
CREATE OR REPLACE FUNCTION cleanup_expired_predictions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM ml_predictions WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Automated cleanup job (run daily)
-- SELECT cron.schedule('cleanup-predictions', '0 2 * * *', 'SELECT cleanup_expired_predictions();');