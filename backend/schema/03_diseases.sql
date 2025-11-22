-- Diseases table for disease type management
CREATE TABLE diseases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL CHECK (category IN ('respiratory', 'vector_borne', 'foodborne', 'waterborne', 'zoonotic', 'other')),
    icd_10_code VARCHAR(10),
    icd_11_code VARCHAR(10),
    severity_scale JSONB, -- Custom severity definitions per disease
    symptoms JSONB, -- Array of common symptoms
    incubation_period_days INTEGER,
    transmission_modes JSONB, -- Array of transmission modes
    prevention_measures JSONB, -- Array of prevention measures
    treatment_options JSONB, -- Array of treatment options
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_diseases_category ON diseases(category);
CREATE INDEX idx_diseases_icd_10 ON diseases(icd_10_code);
CREATE INDEX idx_diseases_icd_11 ON diseases(icd_11_code);
CREATE INDEX idx_diseases_is_active ON diseases(is_active);

-- RLS policies for diseases
ALTER TABLE diseases ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can read diseases
CREATE POLICY diseases_select_policy ON diseases
    FOR SELECT USING (is_active = true);

-- Policy: Only admins can modify diseases
CREATE POLICY diseases_modify_policy ON diseases
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = current_user_id() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- Insert common diseases
INSERT INTO diseases (name, category, icd_10_code, symptoms, incubation_period_days, transmission_modes, prevention_measures) VALUES
('COVID-19', 'respiratory', 'U07.1', '["fever", "cough", "shortness of breath", "fatigue", "loss of taste", "loss of smell"]', 14, '["droplet", "airborne", "contact"]', '["vaccination", "mask wearing", "social distancing", "hand hygiene"]'),
('Influenza', 'respiratory', 'J10', '["fever", "cough", "sore throat", "muscle aches", "headache", "fatigue"]', 7, '["droplet", "contact"]', '["annual vaccination", "hand hygiene", "avoiding sick contacts"]'),
('Dengue Fever', 'vector_borne', 'A90', '["high fever", "severe headache", "eye pain", "muscle pain", "rash", "bleeding"]', 7, '["mosquito bite"]', '["mosquito control", "eliminate standing water", "use repellent"]'),
('Food Poisoning', 'foodborne', 'A05', '["nausea", "vomiting", "diarrhea", "abdominal pain", "fever"]', 2, '["contaminated food"]', '["proper food handling", "cooking to safe temperatures", "refrigeration"]'),
('Measles', 'respiratory', 'B05', '["high fever", "cough", "runny nose", "red eyes", "rash"]', 10, '["airborne", "droplet"]', '["MMR vaccination", "isolation of cases"]');