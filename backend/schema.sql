-- Enterprise Schema for CrashGuard - Updated for BigQuery Integration

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Projects (Tenants)
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    api_key VARCHAR(64) UNIQUE NOT NULL, 
    firebase_project_id VARCHAR(255), -- Link to Firebase
    bigquery_dataset_name VARCHAR(255), -- e.g., 'firebase_crashlytics'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Components (The "Widget Tree" nodes)
CREATE TABLE components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    identifier VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'deprecated')),
    fallback_message TEXT DEFAULT 'Feature unavailable.',
    crash_threshold INT DEFAULT 5, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, identifier)
);

-- 3. Processed Crashes (We pull these from BigQuery, store analysis here)
-- We don't need to store the raw crash log again if BigQuery has it, 
-- but we need a record to link the Gemini analysis to a specific event/group.
CREATE TABLE processed_crashes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    component_id UUID REFERENCES components(id) ON DELETE SET NULL,
    
    firebase_event_id VARCHAR(255), -- ID from BigQuery to avoid duplicates
    issue_id VARCHAR(255), -- 'issue_id' from Crashlytics (groups similar crashes)
    
    error_message TEXT,
    stack_trace TEXT,
    
    analysis_status VARCHAR(50) DEFAULT 'pending',
    gemini_analysis JSONB, -- The Fix suggestion
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Component Locks (Control Plane)
CREATE TABLE component_locks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_id UUID REFERENCES components(id) ON DELETE CASCADE,
    locked_by VARCHAR(50) DEFAULT 'system', 
    reason TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
