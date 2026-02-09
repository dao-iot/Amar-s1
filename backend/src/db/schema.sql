-- Vehicles table to store EV registration details
CREATE TABLE IF NOT EXISTS vehicles (
    vehicle_id VARCHAR(50) PRIMARY KEY, -- Unique identifier for the vehicle (e.g., EV001)
    model VARCHAR(100) NOT NULL,        -- Model of the vehicle (e.g., Tata Nexon EV)
    registration_number VARCHAR(20) NOT NULL, -- Official registration number
    status VARCHAR(20) DEFAULT 'active', -- Current operational status
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Record creation time
    last_seen TIMESTAMP                 -- Last telemetry update time
);

-- Index for faster listing and status filtering
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);

-- Telemetry table (time-series data)
CREATE TABLE IF NOT EXISTS telemetry (
    id BIGSERIAL PRIMARY KEY,
    vehicle_id VARCHAR(50) REFERENCES vehicles(vehicle_id),
    timestamp BIGINT NOT NULL,        -- Unix epoch milliseconds
    data JSONB NOT NULL,              -- Flexible schema for sensor data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_telemetry_vehicle_time ON telemetry(vehicle_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON telemetry(timestamp);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
    alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id VARCHAR(50) REFERENCES vehicles(vehicle_id),
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,    -- INFO, WARNING, CRITICAL
    message TEXT NOT NULL,
    data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP
);

-- Indexes for alerts
CREATE INDEX IF NOT EXISTS idx_alerts_vehicle ON alerts(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_unresolved ON alerts(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_alerts_vehicle_resolved ON alerts(vehicle_id, resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(alert_type);

-- Composite indexes for aggregation queries
CREATE INDEX IF NOT EXISTS idx_alerts_resolved_severity ON alerts(resolved_at, severity) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_alerts_resolved_vehicle ON alerts(resolved_at, vehicle_id) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_alerts_resolved_created ON alerts(resolved_at, created_at) WHERE resolved_at IS NULL;
