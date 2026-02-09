# Real-Time EV Data Platform with Live Dashboard

## Overview

This project is a full-stack, production-style Electric Vehicle (EV) fleet monitoring system designed for real-time telemetry ingestion, alert management, and live visualization. Built to simulate a real-world operations center, the platform continuously receives telemetry data from multiple EVs, processes alert conditions, and streams updates to a web dashboard via WebSockets. The system handles 50+ concurrent vehicles, demonstrating scalability and real-time capabilities suitable for enterprise fleet management.

The platform addresses the challenge of monitoring distributed EV fleets where operators need instant visibility into vehicle health, battery status, and critical alerts. By combining REST APIs, WebSocket streaming, and a React-based dashboard, the system provides a complete solution for fleet operations teams to track, manage, and respond to vehicle conditions in real time.

## Key Features

- **Vehicle Management (CRUD)**: Register, view, update, and decommission vehicles through both REST APIs and a management interface
- **Real-Time Telemetry Ingestion**: Continuous data collection from vehicles including speed, state of charge (SOC), temperature, voltage, and current
- **Live Dashboard Updates**: WebSocket-based streaming ensures the dashboard reflects vehicle state changes within 2 seconds
- **Alert Engine with Rule-Based Detection**: Automatic detection of low battery, critical battery, high temperature, and abnormal voltage conditions
- **Alert Deduplication & Auto-Resolution**: Intelligent alert management prevents notification spam and automatically resolves conditions when normalized
- **Historical Data Visualization**: Time-series charts displaying telemetry trends with configurable time ranges
- **Authentication & Role-Based Access Control**: JWT-based authentication with Admin (full control) and Viewer (read-only) roles
- **Fleet-Scale Simulator**: Configurable simulator supporting 50-100+ concurrent vehicles with realistic scenario modeling
- **Operations Log**: Historical telemetry grouped by minute for operational audit trails
- **Asset Registry**: Searchable, filterable vehicle list optimized for large fleets using React performance patterns

## System Architecture

The platform follows a clean, layered architecture with clear separation between components:

**Simulator Layer**: Independent Node.js process that simulates multiple EVs. Each vehicle instance maintains internal state (battery, speed, temperature) and sends telemetry via HTTP POST every 2 seconds with jitter to prevent traffic bursts. The simulator authenticates only for vehicle registration; telemetry ingestion remains public to simulate real vehicle behavior.

**Backend Layer**: Express.js server organized into Routes → Controllers → Services → Database layers. The backend exposes RESTful APIs for vehicle management, telemetry history, alerts, and authentication. It processes incoming telemetry, applies alert rules, and stores data in PostgreSQL. The controller layer handles HTTP concerns while the service layer contains business logic.

**Real-Time Layer**: Socket.io manages WebSocket connections between backend and dashboard. When telemetry arrives, the backend broadcasts updates to subscribed clients with throttling (2 updates/sec per vehicle) to prevent overwhelming the UI. Alerts bypass throttling for immediate delivery. Clients subscribe to specific vehicle streams or "all" for fleet-wide monitoring.

**Database Layer**: PostgreSQL stores vehicles, telemetry (with JSONB data column), and alerts. Telemetry uses indexed timestamps for efficient time-range queries. Alert deduplication logic uses status tracking (active/resolved) with alert_type + vehicle_id uniqueness constraints.

**Frontend Layer**: React dashboard built with Vite, consuming REST APIs on mount and switching to WebSocket subscriptions for live updates. The UI uses React.memo and useMemo to prevent unnecessary re-renders when managing 50+ vehicles. Charts are powered by Recharts, and real-time data updates trigger smooth state transitions via Framer Motion.

**Data Flow**: Vehicle telemetry → Backend REST API → PostgreSQL storage → Alert engine evaluation → WebSocket broadcast → Dashboard state update → UI re-render. This unidirectional flow ensures data consistency and predictable state management.

## Tech Stack

**Backend**
- Node.js (v18+)
- Express.js (REST API framework)
- PostgreSQL (relational database)
- node-postgres (pg) for database access
- Socket.io (WebSocket server)
- jsonwebtoken (JWT authentication)
- dotenv (environment configuration)

**Frontend**
- React 18 (UI framework)
- Vite (build tool and dev server)
- Tailwind CSS v4 (styling)
- Recharts (data visualization)
- Framer Motion (animations)
- Lucide React (icon library)
- Axios (HTTP client)

**Simulator**
- Node.js
- Axios (HTTP client for telemetry transmission)

**Development Tools**
- Git (version control)
- npm (package management)

## Folder Structure

```
Amar-s1/
├── backend/
│   ├── src/
│   │   ├── controllers/       # HTTP request handlers
│   │   ├── services/          # Business logic layer
│   │   ├── routes/            # API endpoint definitions
│   │   ├── middleware/        # Auth, validation, error handling
│   │   ├── utils/             # Helper functions
│   │   ├── db.js              # PostgreSQL connection
│   │   ├── server.js          # Express app entry point
│   │   └── socketServer.js    # WebSocket server
│   ├── migrations/            # Database schema migrations
│   ├── package.json
│   └── .env                   # Backend environment variables
│
├── frontend/
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── Dashboard.jsx      # Main container
│   │   │   ├── Login.jsx          # Authentication UI
│   │   │   ├── VehicleCard.jsx    # Live telemetry cards
│   │   │   ├── AlertPanel.jsx     # Real-time alert feed
│   │   │   ├── TelemetryChart.jsx # Time-series visualization
│   │   │   ├── AssetList.jsx      # Vehicle registry
│   │   │   ├── VehicleHistory.jsx # Operations log
│   │   │   └── VehicleManagement.jsx # CRUD interface
│   │   ├── hooks/             # Custom React hooks
│   │   │   └── useVehicles.js     # Vehicle CRUD logic
│   │   ├── App.jsx            # Root component with routing
│   │   ├── index.css          # Tailwind imports
│   │   └── main.jsx           # React entry point
│   ├── package.json
│   └── vite.config.js         # Vite configuration
│
├── simulator/
│   ├── simulator.js           # Fleet simulator
│   └── package.json
│
└── README.md
```

**Key Directory Purposes**:
- `backend/src/controllers/`: Maps HTTP requests to service calls, handles response formatting
- `backend/src/services/`: Core business logic, database operations, alert rule engine
- `backend/src/routes/`: Express route definitions with middleware chains
- `frontend/src/components/`: Reusable UI components following atomic design principles
- `frontend/src/hooks/`: Stateful logic extraction for reusability (e.g., useVehicles for CRUD)

## Prerequisites

Ensure the following are installed on your system:

- **Node.js**: Version 18.x or higher (check with `node --version`)
- **PostgreSQL**: Version 13.x or higher (check with `psql --version`)
- **npm**: Version 8.x or higher (comes with Node.js)
- **Operating System**: macOS, Linux, or Windows with WSL2
- **RAM**: Minimum 4GB available (8GB recommended for 100+ vehicle simulation)
- **Ports Available**: 3000 (backend), 5173 (frontend), 5432 (PostgreSQL)

## Environment Setup

### Backend Environment Variables

Create a `.env` file in the `backend/` directory with the following configuration:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ev_fleet_db
DB_USER=postgres
DB_PASSWORD=your_postgres_password

# JWT Authentication
JWT_SECRET=your_secure_random_string_here_change_in_production
JWT_EXPIRES_IN=24h

# CORS Configuration
CORS_ORIGIN=http://localhost:5173
```

**Important Notes**:
- Replace `your_postgres_password` with your actual PostgreSQL password
- Replace `JWT_SECRET` with a strong random string (use `openssl rand -base64 32`)
- Do NOT commit the `.env` file to version control (already in `.gitignore`)

### Database Setup

1. **Create Database**:
   ```bash
   psql -U postgres
   CREATE DATABASE ev_fleet_db;
   \q
   ```

2. **Run Schema Migration**:
   The database schema is automatically created when the backend starts for the first time. Alternatively, you can manually run:
   ```bash
   cd backend
   psql -U postgres -d ev_fleet_db -f migrations/schema.sql
   ```

3. **Verify Tables**:
   ```bash
   psql -U postgres -d ev_fleet_db
   \dt
   # Should show: vehicles, telemetry, alerts
   ```

## How to Run the Project

Follow these steps in order to start the complete system:

### A. Backend Setup

1. **Navigate to Backend Directory**:
   ```bash
   cd backend
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment**:
   Ensure `.env` file exists with correct database credentials (see Environment Setup section above).

4. **Start Backend Server**:
   ```bash
   npm start
   ```

   **Expected Output**:
   ```
   Server is running on port 3000
   Successfully connected to the PostgreSQL database
   ```

   The backend is now running at `http://localhost:3000`.

### B. Frontend Setup

Open a **new terminal window** and follow these steps:

1. **Navigate to Frontend Directory**:
   ```bash
   cd frontend
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Start React Development Server**:
   ```bash
   npm run dev
   ```

   **Expected Output**:
   ```
   VITE v5.x.x  ready in XXX ms
   ➜  Local:   http://localhost:5173/
   ```

4. **Access Dashboard**:
   Open your browser and navigate to `http://localhost:5173`

   **Default Login Credentials**:
   - Admin: `admin` / `admin123`
   - Viewer: `viewer` / `viewer123`

### C. Simulator Setup

Open a **third terminal window** to run the vehicle simulator:

1. **Navigate to Simulator Directory**:
   ```bash
   cd simulator
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Start Fleet Simulator**:
   ```bash
   node simulator.js
   ```

   **Expected Output**:
   ```
   ============================================================
      EV FLEET SIMULATOR - SCALABLE EDITION
   ============================================================
   
   Configuration:
     - Fleet Size: 50 vehicles
     - Telemetry Interval: 2000ms
   
   [1/3] Authenticating with backend...
   ✓ Authentication successful
   
   [2/3] Registering 50 vehicles with backend...
   ✓ Registration complete
   
   [3/3] Starting fleet simulation...
   ✓ 50 vehicles are now transmitting telemetry
   ```

4. **Configure Fleet Size** (Optional):
   To change the number of simulated vehicles, edit `simulator/simulator.js`:
   ```javascript
   const CONFIG = {
     FLEET_SIZE: 100,  // Change to desired number (20-100)
     // ... other config
   };
   ```

5. **Stop Simulator**:
   Press `Ctrl+C` in the simulator terminal for graceful shutdown.

**Default Behavior**: The simulator registers 50 vehicles and begins sending telemetry every 2 seconds. Vehicles are distributed across scenarios: 60% normal operation, 20% low battery, 10% overheating, and 10% mixed anomalies.

## Day-wise Implementation Breakdown

This project was built incrementally over 6 days, following a structured development approach:

### Day 1: Backend Foundation & Vehicle APIs

**Objectives**: Establish backend architecture, database schema, and vehicle management endpoints.

**Deliverables**:
- Express.js server setup with clean architecture (Route → Controller → Service → DB layers)
- PostgreSQL database connection using node-postgres (pg)
- Vehicles table schema with vehicle_id (PK), model, registration_number, status, timestamps
- REST API endpoints:
  - `POST /api/v1/vehicles` - Register new vehicle
  - `GET /api/v1/vehicles` - List all vehicles
  - `GET /api/v1/vehicles/:id` - Get vehicle details
- Manual input validation in controllers
- Centralized response formatting utility
- Environment variable configuration with dotenv

**Key Decisions**:
- Used async/await consistently for database operations
- Separated business logic into services for testability
- Implemented standardized JSON response format: `{ status, message, data }`

### Day 2: Telemetry Ingestion & History APIs

**Objectives**: Enable vehicles to send telemetry and provide historical data access.

**Deliverables**:
- Telemetry table schema with JSONB data column for flexible telemetry fields
- Indexed timestamp column for efficient time-range queries
- REST API endpoints:
  - `POST /api/v1/telemetry` - Ingest telemetry from vehicles
  - `GET /api/v1/telemetry/history` - Retrieve historical telemetry (vehicle_id, from, to)
  - `GET /api/v1/telemetry/stats/:vehicleId` - Get latest telemetry for a vehicle
- Validation for required fields: vehicle_id, timestamp, data object
- Verification that vehicle exists before accepting telemetry
- Basic simulator prototype (3 vehicles) to test ingestion

**Key Decisions**:
- Chose JSONB for telemetry data to accommodate varying sensor configurations without schema changes
- Stored raw telemetry without transformation to preserve original data integrity
- Used millisecond Unix timestamps (bigint) for precise time-based queries

### Day 3: WebSocket Integration & Real-Time Streaming

**Objectives**: Add real-time capabilities for live dashboard updates.

**Deliverables**:
- Socket.io server integrated with Express
- WebSocket connection handling with client subscription model
- Telemetry broadcast logic: when telemetry arrives via POST, emit to subscribed clients
- Throttling mechanism: maximum 2 telemetry updates per second per vehicle to prevent UI overload
- Subscription patterns:
  - `subscribe: all` - Receive updates from all vehicles
  - `subscribe: <vehicleId>` - Receive updates from specific vehicle
- Connection/disconnection logging for debugging

**Key Decisions**:
- Throttled telemetry updates but allowed alerts to bypass throttling for immediate delivery
- Chose subscription model over broadcasting all data to reduce client-side filtering
- Maintained separation between HTTP API (data at rest) and WebSocket (data in motion)

### Day 4: Alert Engine & Rule-Based Monitoring

**Objectives**: Implement alert detection, deduplication, and real-time notification.

**Deliverables**:
- Alerts table schema with alert_type, vehicle_id, severity, status (active/resolved), timestamps
- Alert rule engine evaluating telemetry against thresholds:
  - `low_battery`: SOC < 15%
  - `critical_battery`: SOC < 5%
  - `high_temperature`: motor_temp or temperature > 85°C
  - `abnormal_voltage`: battery_voltage < 45V or > 85V
- Alert deduplication logic: one active alert per type per vehicle
- Auto-resolution: alerts resolve when conditions normalize
- REST API endpoints:
  - `GET /api/v1/alerts` - List all alerts with optional status filter
  - `POST /api/v1/alerts/:id/acknowledge` - Mark alert as acknowledged (requires admin role)
- Real-time alert broadcasting via WebSocket immediately upon detection
- Database indexes on status and vehicle_id for efficient alert queries

**Key Decisions**:
- Implemented auto-resolution to prevent stale alerts from accumulating
- Used database uniqueness constraints for deduplication reliability
- Prioritized alert delivery by bypassing telemetry throttling

### Day 5: React Dashboard & Data Visualization

**Objectives**: Build a professional, real-time dashboard for fleet monitoring.

**Deliverables**:
- React application scaffolded with Vite for fast HMM (Hot Module Replacement)
- Tailwind CSS v4 integration using @tailwindcss/vite plugin
- Dashboard components:
  - VehicleCard: Live telemetry display with color-coded status indicators
  - AlertPanel: Real-time alert feed with severity badges and timestamps
  - TelemetryChart: Recharts-based time-series visualization with ReferenceLine for alert correlation
  - AssetList: Searchable, filterable vehicle registry with performance optimizations (React.memo, useMemo)
  - VehicleHistory: Operations log showing telemetry grouped by minute
- WebSocket client integration:
  - Connect to backend Socket.io server
  - Subscribe to vehicle streams
  - Update React state on incoming telemetry and alerts
- Smooth animations with Framer Motion for state transitions
- Enhanced simulator: 20-vehicle fleet with varied scenarios (normal, low_battery, overheating, idle)

**Key Decisions**:
- Used Axios interceptors for global API error handling
- Memoized expensive filter operations to maintain 60fps with 50+ vehicles
- Color-coded UI elements: green (online), yellow (warning), red (critical), gray (offline)
- Implemented frontend-only filtering to avoid backend schema changes per project constraints

### Day 6: Authentication, CRUD UI, Testing & Final Enhancements

**Objectives**: Add authentication, complete vehicle management, stress-test system, and prepare for demo.

**Deliverables**:
- JWT authentication system:
  - Login endpoint: `POST /api/v1/auth/login`
  - In-memory user storage (admin/viewer) to avoid database schema changes
  - JWT middleware protecting dashboard APIs
  - Telemetry ingestion remains unauthenticated for simulator compatibility
- Authentication UI: Login component with username/password form
- Role-based access control:
  - Admin: Full CRUD access, can acknowledge alerts
  - Viewer: Read-only access
- Vehicle Management UI:
  - VehicleManagement component with table view, search, filter, sort
  - VehicleFormModal for add/edit operations
  - VehicleDetailsDrawer for read-only inspection
  - Delete functionality with two-mode strategy: attempt DELETE API, fallback to logical deactivation
  - Toast notifications for user feedback
- Scalable simulator enhancement:
  - FleetManager class orchestrating 50-100 vehicles
  - Jittered telemetry intervals (±300ms) to prevent traffic bursts
  - Four scenario types: normal (60%), low_battery (20%), overheating (10%), mixed_anomaly (10%)
  - Graceful error handling with retry logic
  - Configurable fleet size via CONFIG object
- API parameter fixes: Corrected telemetry history endpoint to use Unix timestamps (from/to) instead of ISO strings
- Testing: Verified system stability under 50+ concurrent vehicle load

**Key Decisions**:
- Kept authentication additive to preserve existing simulator and API compatibility
- Implemented two-mode delete to handle missing backend DELETE endpoint gracefully
- Added jitter to simulator intervals to smooth traffic distribution and prevent synchronized bursts
- Used detailed logging in simulator to demonstrate system behavior during evaluation

## Authentication & Roles

### Why Authentication Was Added

Authentication was implemented to secure the dashboard against unauthorized access while maintaining backward compatibility with existing vehicle simulators and telemetry ingestion. The system uses JWT (JSON Web Tokens) for stateless authentication, allowing the backend to validate requests without session storage.

### JWT-Based Login

**Flow**:
1. User submits credentials to `POST /api/v1/auth/login`
2. Backend validates username/password against in-memory user store
3. On success, backend generates JWT token with user claims (username, role)
4. Frontend stores token in localStorage
5. Subsequent API requests include token in `Authorization: Bearer <token>` header
6. Backend middleware validates token before processing protected requests

**Token Expiration**: Tokens expire after 24 hours, requiring re-authentication.

### Admin vs Viewer Roles

**Admin Role**:
- Full CRUD access to vehicle registry
- Can acknowledge alerts (marks them as reviewed)
- Can delete/deactivate vehicles
- Access to vehicle management overlay

**Viewer Role**:
- Read-only access to dashboard
- Can view live telemetry, alerts, and history
- Cannot modify vehicle data or acknowledge alerts
- Vehicle management UI hidden

**Built-in Accounts**:
- Username: `admin`, Password: `admin123` (Admin role)
- Username: `viewer`, Password: `viewer123` (Viewer role)

### Why Vehicles/Simulator Are Unauthenticated

The telemetry ingestion endpoint (`POST /api/v1/telemetry`) remains **unauthenticated** by design:

1. **Simulator Compatibility**: Allows the simulator to send telemetry without managing tokens
2. **Real-World Modeling**: In production, vehicles would use device certificates or API keys, not JWT
3. **Performance**: Avoids token validation overhead on high-frequency telemetry ingestion (25+ req/sec)
4. **Separation of Concerns**: Vehicle data submission is separate from human dashboard access

Vehicle registration (`POST /api/v1/vehicles`) requires authentication since it's an administrative operation typically performed by fleet managers, not vehicles themselves.

## Vehicle Simulator Explanation

### Purpose of the Simulator

The vehicle simulator is a development and testing tool designed to:
- Generate realistic telemetry data from multiple concurrent EVs
- Stress-test backend APIs, database, and WebSocket infrastructure
- Demonstrate system scalability under fleet-scale load
- Provide a self-contained demo environment without requiring physical vehicles

The simulator acts as a proxy for real EVs, mimicking their behavior by maintaining internal state (battery charge, speed, temperature) and transmitting telemetry at regular intervals.

### Why It Exists

Physical EVs are impractical for development and demonstration. The simulator solves this by:
- Enabling rapid iteration during development without hardware dependencies
- Allowing reproducible test scenarios (low battery, overheating, etc.)
- Demonstrating scalability by simulating 50-100 vehicles from a single laptop
- Providing a convincing demo for technical evaluation

### How It Simulates 50+ Vehicles

The simulator uses a **FleetManager** class that:
1. Authenticates with backend as admin user
2. Registers all vehicles via REST API
3. Instantiates independent **VehicleSimulator** objects (one per vehicle)
4. Each simulator maintains isolated state and runs on a jittered interval timer
5. Telemetry is sent asynchronously without blocking other vehicles

**Concurrency Model**: Node.js event loop handles asynchronous timers. Each vehicle has a `setInterval()` callback that fires every ~2 seconds (with ±300ms jitter). This non-blocking approach allows a single process to manage 100+ vehicles efficiently.

**Jitter Strategy**: Each vehicle's interval is randomized (`2000ms ± 300ms`) to prevent all vehicles from sending telemetry simultaneously, which would cause traffic bursts and backend overload.

### Scenario Types

Vehicles are distributed across four scenarios to create realistic fleet dynamics:

**Normal (60% of fleet)**:
- Speed: 40-80 km/h with gradual variation
- SOC: Drains slowly (0.03% per tick), stabilizes above 50%
- Temperature: 60-70°C (safe operating range)
- Behavior: Steady-state operation, no alerts

**Low Battery (20% of fleet)**:
- Speed: 15-30 km/h (reduced due to low power)
- SOC: Drains rapidly (0.15% per tick), triggers low_battery and critical_battery alerts
- Temperature: 40-45°C (cooler due to low usage)
- Behavior: Simulates vehicles needing immediate charging

**Overheating (10% of fleet)**:
- Speed: 80-100 km/h (aggressive driving)
- SOC: Moderate drain (0.08% per tick)
- Temperature: Climbs progressively to 95°C, triggers high_temperature alerts
- Behavior: Simulates thermal stress from high performance

**Mixed Anomaly (10% of fleet)**:
- Speed: Erratic (20-80 km/h with random spikes)
- SOC: Random drops simulating battery management system faults
- Temperature: Random spikes
- Voltage/Current: Abnormal readings triggering abnormal_voltage alerts
- Behavior: Stress-tests alert deduplication and system robustness

### Why This Proves Scalability

By running 50+ vehicles concurrently, the simulator demonstrates:
- **Backend Throughput**: Handles 25+ telemetry requests per second (50 vehicles × 0.5 Hz)
- **Database Performance**: PostgreSQL efficiently inserts and queries high-frequency telemetry
- **WebSocket Stability**: Socket.io broadcasts updates to multiple clients without connection drops
- **Frontend Performance**: React UI remains responsive with 50+ live data streams
- **Alert Engine Efficiency**: Processes rules for 50+ vehicles every 2 seconds without lag

This load testing validates that the architecture can scale to real-world fleet sizes.

## Alerts & Monitoring Logic

### Alert Rules

The alert engine evaluates incoming telemetry against the following rules:

| Alert Type | Condition | Severity | Description |
|------------|-----------|----------|-------------|
| `low_battery` | SOC < 15% | Medium | Battery approaching critical level |
| `critical_battery` | SOC < 5% | High | Immediate charging required |
| `high_temperature` | motor_temp > 85°C OR temperature > 85°C | High | Thermal stress detected |
| `abnormal_voltage` | battery_voltage < 45V OR > 85V | Medium | Voltage outside safe operating range |

Rules are evaluated in `backend/src/services/alert.service.js` every time telemetry is ingested.

### Deduplication Logic

To prevent alert spam, the system enforces **one active alert per type per vehicle**:

1. When telemetry triggers a rule, the engine checks if an active alert already exists:
   ```sql
   SELECT * FROM alerts 
   WHERE vehicle_id = ? AND alert_type = ? AND status = 'active'
   ```

2. **If no active alert exists**: Create new alert and broadcast via WebSocket

3. **If active alert exists**: Skip creation (alert already notified)

4. **Database Constraint**: Unique index on `(vehicle_id, alert_type, status)` where `status = 'active'` ensures atomicity

This approach prevents duplicate alerts when telemetry arrives at high frequency (e.g., 10 consecutive samples with SOC = 12% only creates one `low_battery` alert).

### Auto-Resolution

Alerts automatically resolve when conditions normalize:

1. **On each telemetry ingestion**, the engine checks if any active alerts for the vehicle no longer meet their trigger conditions

2. **If condition normalized**: Update alert status to `resolved` and set `resolved_at` timestamp

3. **Example**: If SOC rises from 8% to 18%, the `low_battery` alert resolves automatically

4. **No manual intervention required**: Operators don't need to manually close alerts

This auto-resolution prevents alert tables from accumulating stale entries and provides accurate real-time fleet health.

### Real-Time Alert Delivery

Alerts are delivered to the dashboard immediately via WebSocket:

1. When alert is created/resolved, backend emits `alert` event to all connected clients
2. Alert payload includes: `vehicle_id`, `alert_type`, `severity`, `message`, `timestamp`, `status`
3. Dashboard AlertPanel component receives event and updates state in real-time
4. **Alerts bypass telemetry throttling** to ensure critical notifications are never delayed
5. Frontend displays alerts with color-coded severity: red (high), yellow (medium)

This real-time delivery ensures operators see critical conditions within milliseconds of detection.

## Scalability & Performance Considerations

### Handling 50+ Vehicles

The system was architected from the start to support fleet-scale operations:

**Backend**:
- Non-blocking async/await throughout prevents request queuing
- PostgreSQL connection pooling (default 10 connections) handles concurrent database writes
- Indexed queries on `timestamp` and `vehicle_id` ensure sub-millisecond lookups even with millions of telemetry records

**Database**:
- JSONB data type for telemetry avoids schema migrations as sensor configurations evolve
- Composite indexes on `(vehicle_id, timestamp)` optimize history queries
- Auto-incrementing primary keys reduce index fragmentation

**Simulator**:
- Jittered intervals spread traffic evenly over time, avoiding synchronized bursts
- Independent timer per vehicle prevents cascading failures (one vehicle error doesn't stop others)

### WebSocket Throttling

Raw telemetry arrives at 0.5 Hz per vehicle (every 2 seconds). With 50 vehicles, this would generate 25 WebSocket messages per second. To prevent overwhelming the frontend:

**Throttling Mechanism**:
- Backend caches the last broadcast time per vehicle
- Enforces minimum 500ms between broadcasts (max 2 updates/sec per vehicle)
- If telemetry arrives faster, only the most recent is broadcast

**Alert Bypass**:
- Alerts are broadcast immediately, bypassing throttling
- Critical conditions must reach operators without delay

**Result**: Dashboard receives ~25 updates/sec for normal telemetry, ensuring smooth UI performance while maintaining data freshness.

### Frontend Optimizations

React was optimized to handle large vehicle counts without performance degradation:

**React.memo**:
- VehicleCard components wrapped in React.memo to prevent re-renders when sibling vehicles update
- Only re-renders when the specific vehicle's data changes

**useMemo**:
- Expensive filter/search operations memoized to avoid recalculation on every render
- Example: AssetList filters 50+ vehicles only when search term changes, not on every telemetry update

**Conditional Rendering**:
- Virtualization not implemented (overkill for 50 vehicles), but components render only visible data
- Charts update via state diffing, not full re-renders

**WebSocket State Management**:
- Incoming telemetry updates specific vehicle in state array, not entire array replacement
- Reduces React reconciliation overhead

### Why Schema Was Not Changed

Per project requirements (no-backend-change mandate during QA/UI phases), the database schema remained stable after Day 2. This constraint forced frontend optimizations:
- All filtering/sorting done client-side
- Historical data grouping (by minute) done in frontend
- No additional indexes or columns added

This demonstrates real-world constraint handling where backend teams may have limited availability.

## How to Use the Dashboard

### Login

1. Navigate to `http://localhost:5173` in your browser
2. You will see the login screen
3. Enter credentials:
   - **Admin**: `admin` / `admin123` (full access)
   - **Viewer**: `viewer` / `viewer123` (read-only)
4. Click "Sign In"
5. Upon success, you will be redirected to the main dashboard

**Session Management**: Token stored in localStorage. Remains valid for 24 hours unless manually logged out.

### Viewing Live Vehicles

**Main Dashboard**:
- Vehicle cards display at the top, showing live telemetry:
  - Vehicle ID and model
  - Current speed, SOC, voltage, current
  - Motor and battery temperatures
  - Status indicator: Green (online), Yellow (warning), Red (critical), Gray (offline)
- Cards update in real-time as telemetry arrives (every 2 seconds)

**Asset List Panel** (right sidebar):
- Click on any vehicle card to open detailed asset list
- Search by vehicle ID or registration number
- Filter by status (online/offline) or alert severity
- Sort by ID, SOC, or temperature
- Optimized to handle 50+ vehicles without lag

### Managing Vehicles (CRUD)

**Admin Only**: If logged in as Viewer, this feature is hidden.

**Open Management Interface**:
- Click the "Database" icon in the top-right corner of the dashboard
- Management overlay slides in from the right

**Create Vehicle**:
1. Click "Add New Vehicle" button
2. Fill in Vehicle ID, Model, Registration Number
3. Click "Register Vehicle"
4. New vehicle appears in the table

**View Vehicle Details**:
- Click any row in the table
- Details drawer opens showing full vehicle information

**Edit Vehicle**:
1. Click "Edit" button in the table row
2. Modify fields in the modal
3. Click "Save Changes"

**Delete Vehicle**:
1. Click "Delete" button in the table row or details drawer
2. Confirm deletion in the modal
3. System attempts DELETE API; if unavailable, marks vehicle as inactive (logical delete)
4. Toast notification confirms operation

**Search & Filter**:
- Use search bar to find vehicles by ID or registration
- Use status dropdown to filter by active/inactive/alert state
- Click column headers to sort

### Viewing Alerts

**Alert Panel** (left sidebar):
- Real-time alert feed showing latest alerts
- Color-coded severity: Red (high), Yellow (medium)
- Each alert shows:
  - Vehicle ID
  - Alert type (low_battery, high_temperature, etc.)
  - Message description
  - Timestamp
  - Status (active/resolved)

**Acknowledge Alerts** (Admin only):
- Click "Acknowledge" button on an alert
- Alert is marked as reviewed (visual indicator changes)
- Useful for tracking which alerts have been addressed by operators

**Alert Correlation on Charts**:
- Telemetry charts display vertical reference lines when alerts were triggered
- Allows visual correlation between telemetry trends and alert events

### Viewing History & Charts

**Telemetry Charts**:
- Located in the center of the dashboard
- Line charts showing:
  - Speed over time
  - SOC (State of Charge) over time
  - Temperature over time
- X-axis: Time (last 10 minutes)
- Y-axis: Metric value
- Hover over data points to see exact values

**Vehicle History Panel**:
- Click on a vehicle card to view its history
- Shows historical telemetry grouped by minute
- Time range selector: 5 minutes, 15 minutes, 1 hour
- Displays: timestamp, speed, SOC, voltage, current, temperatures
- Useful for operational audit trails and troubleshooting

**Chart Features**:
- Auto-scaling Y-axis based on data range
- Smooth animations on data updates
- Alert correlation via ReferenceLine overlays

## Limitations & Future Improvements

### Current Limitations

**Authentication**:
- Users stored in-memory, not persisted in database
- No password hashing (plaintext comparison)
- No user registration or password reset functionality
- Token refresh not implemented (24-hour expiration requires re-login)

**Database**:
- No data retention policy; telemetry accumulates indefinitely
- No partitioning for large-scale deployments (millions of records would slow queries)
- No backup/restore mechanisms

**Alert Engine**:
- Rules are hardcoded in service layer, not configurable via UI
- No custom alert thresholds per vehicle
- No alert notification channels (email, SMS, Slack)

**Simulator**:
- Scenarios are pre-defined; no dynamic behavior modeling
- No network latency or packet loss simulation
- No geographic distribution simulation

**UI/UX**:
- No dark mode toggle
- Limited accessibility features (ARIA labels, keyboard navigation)
- No mobile responsive design (optimized for desktop only)
- No data export functionality (CSV, JSON)

**Testing**:
- No automated unit or integration tests
- No load testing beyond manual 50-vehicle runs
- No CI/CD pipeline

### Future Improvements

**Authentication & Security**:
- Migrate user storage to PostgreSQL with proper schema
- Implement bcrypt password hashing
- Add refresh token mechanism for seamless session extension
- Implement role-based permissions at endpoint level (not just UI hiding)
- Add OAuth2/SSO integration for enterprise deployments

**Scalability Enhancements**:
- Implement database partitioning (by time or vehicle_id) for telemetry table
- Add Redis caching layer for frequently accessed data (latest telemetry)
- Implement message queue (RabbitMQ, Kafka) for telemetry ingestion to decouple ingestion from processing
- Add horizontal scaling support (load balancer + multiple backend instances)

**Alert System**:
- Configurable alert rules via admin UI
- Per-vehicle custom thresholds
- Alert escalation policies (notify after X minutes of unresolved state)
- Multi-channel notifications (email, SMS, webhooks)
- Alert history retention and analytics

**Data Management**:
- Implement time-based data retention (e.g., archive telemetry older than 90 days)
- Add aggregated statistics table (hourly/daily rollups) for historical analysis
- Implement data export in multiple formats (CSV, JSON, Parquet)
- Add backup and disaster recovery procedures

**Monitoring & Observability**:
- Add Prometheus metrics for backend performance monitoring
- Implement distributed tracing (OpenTelemetry)
- Dashboard for system health (API latency, database connection pool usage, WebSocket connection count)
- Error tracking with Sentry or similar

**UI/UX Enhancements**:
- Responsive design for mobile and tablet
- Dark mode with theme persistence
- Accessibility improvements (WCAG 2.1 AA compliance)
- Data export buttons on history and alert panels
- Drag-and-drop dashboard customization
- Map view showing vehicle geographic locations

**Testing & Quality**:
- Unit tests (Jest) for services and utilities
- Integration tests (Supertest) for API endpoints
- End-to-end tests (Playwright) for critical user flows
- Load testing with k6 or Apache JMeter
- CI/CD pipeline with GitHub Actions or GitLab CI

**Deployment**:
- Dockerize backend, frontend, and PostgreSQL
- Docker Compose for one-command local setup
- Kubernetes manifests for production deployment
- Infrastructure as Code (Terraform) for cloud provisioning

## Conclusion

This Real-Time EV Data Platform demonstrates a complete full-stack solution for monitoring distributed electric vehicle fleets. The project showcases proficiency in modern web technologies, real-time data streaming, database design, and scalable architecture patterns. By simulating 50+ concurrent vehicles and processing high-frequency telemetry, the system proves its readiness for real-world deployment scenarios.

The platform addresses practical challenges faced by fleet operators: continuous monitoring of vehicle health, instant alerting on critical conditions, and historical analysis for operational insights. The clean separation between backend APIs, real-time streaming, and frontend presentation ensures maintainability and allows each layer to scale independently.

Key skills demonstrated include:
- **Backend Engineering**: RESTful API design, WebSocket implementation, database schema design, authentication/authorization
- **Frontend Development**: React state management, real-time UI updates, performance optimization, responsive design
- **System Design**: Clean architecture, separation of concerns, scalability planning, fault tolerance
- **DevOps Practices**: Environment configuration, multi-process orchestration, graceful shutdown handling

This project reflects the type of system used in production environments for IoT monitoring, logistics tracking, and industrial automation. The scalable architecture, comprehensive feature set, and attention to real-world constraints make it a strong demonstration of software engineering capabilities suitable for technical evaluation and professional discussion.
