/*
================================================
EV FLEET SIMULATOR - SCALABLE (50-100 VEHICLES)
================================================

PURPOSE:
Stress-test EV Fleet Monitoring Platform with realistic, concurrent telemetry from 50-100 vehicles.

RUN INSTRUCTIONS:
-----------------
1. Ensure backend is running on http://localhost:3000
2. Install dependencies: npm install axios
3. Start simulator: node simulator.js
4. Stop simulator: Ctrl+C (graceful shutdown)

CONFIGURATION:
--------------
Modify these constants below to adjust behavior:

- FLEET_SIZE: Number of vehicles to simulate (default: 50)
- TELEMETRY_INTERVAL: Base interval in ms (default: 2000)
- JITTER_MS: Random delay to prevent burst traffic (default: 300)
- SCENARIO_DISTRIBUTION: Percentage of each scenario type

ARCHITECTURE:
-------------
1. SimulatorConfig → Global configuration
2. VehicleSimulator → Individual EV with state machine
3. FleetManager → Orchestrates all vehicles, handles startup/shutdown
4. Graceful error handling per vehicle (one failure ≠ fleet failure)

================================================
*/

const axios = require('axios');

// ================================================
// SIMULATOR CONFIGURATION (MODIFY HERE)
// ================================================

const CONFIG = {
  // API endpoint
  API_URL: 'http://localhost:3000/api/v1',
  
  // Admin credentials for vehicle registration
  ADMIN_CREDENTIALS: {
    username: 'admin',
    password: 'admin123'
  },
  
  // Fleet size: Total number of vehicles to simulate
  FLEET_SIZE: 50,  // Change to 20, 50, 100, etc.
  
  // Telemetry timing
  TELEMETRY_INTERVAL: 2000,  // Base interval in milliseconds (2 seconds)
  JITTER_MS: 300,            // Random jitter ±300ms to prevent traffic bursts
  
  // Scenario distribution (percentages must sum to 100)
  SCENARIO_DISTRIBUTION: {
    normal: 60,        // 60% normal operation
    low_battery: 20,   // 20% low battery
    overheating: 10,   // 10% overheating
    mixed_anomaly: 10  // 10% mixed anomalies
  },
  
  // Retry logic for failed telemetry
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  
  // Logging verbosity
  LOG_TELEMETRY: false,  // Set to true for detailed per-vehicle logs
  LOG_ALERTS: true,      // Log when alerts are likely triggered
  LOG_ERRORS: true       // Log errors and retries
};

// Global state
let authToken = null;
let activeSimulators = [];

// ================================================
// AUTHENTICATION
// ================================================

/**
 * Authenticate with backend to get JWT token for vehicle registration.
 * Telemetry ingestion does NOT require authentication.
 */
async function authenticate() {
  try {
    const response = await axios.post(
      `${CONFIG.API_URL}/auth/login`, 
      CONFIG.ADMIN_CREDENTIALS
    );
    authToken = response.data.data.token;
    console.log('✓ Authentication successful\n');
    return true;
  } catch (error) {
    console.error('✗ Authentication failed:', error.response?.data?.message || error.message);
    return false;
  }
}

// ================================================
// VEHICLE SIMULATOR CLASS
// ================================================

/**
 * VehicleSimulator: Represents a single EV with realistic behavior.
 * 
 * Each vehicle:
 * - Maintains internal state (speed, SOC, temps, etc.)
 * - Updates state based on assigned scenario
 * - Sends telemetry independently with jitter
 * - Handles network errors gracefully with retry logic
 */
class VehicleSimulator {
  constructor(vehicleId, scenario) {
    this.vehicleId = vehicleId;
    this.scenario = scenario;
    this.intervalId = null;
    this.retryCount = 0;
    this.consecutiveErrors = 0;
    
    // Initialize vehicle state based on scenario
    this.state = this.initializeState(scenario);
  }

  /**
   * Initialize vehicle state with scenario-appropriate starting values
   */
  initializeState(scenario) {
    const baseState = {
      speed: 0,
      motor_rpm: 0,
      battery_voltage: 62.0,
      battery_current: 0,
      soc: 85,
      motor_temp: 30,
      battery_temp: 25,
      temperature: 30
    };

    // Adjust initial state based on scenario
    switch (scenario) {
      case 'low_battery':
        baseState.soc = 15 + Math.random() * 5;  // 15-20%
        break;
      case 'overheating':
        baseState.motor_temp = 75 + Math.random() * 5;  // Start warm
        baseState.temperature = 75 + Math.random() * 5;
        break;
      case 'mixed_anomaly':
        baseState.soc = 30 + Math.random() * 40;  // Varied SOC
        baseState.motor_temp = 50 + Math.random() * 20;
        baseState.temperature = 50 + Math.random() * 20;
        break;
    }

    return baseState;
  }

  /**
   * Update vehicle state based on scenario logic.
   * Each scenario has distinct behavior patterns to trigger different alerts.
   */
  updateState() {
    switch (this.scenario) {
      case 'normal':
        // Normal operation: Steady speed, gradual SOC drain, stable temps
        this.state.speed = 40 + Math.random() * 40;  // 40-80 km/h
        this.state.motor_temp = 60 + Math.random() * 10;  // 60-70°C
        this.state.temperature = 60 + Math.random() * 10;
        this.state.battery_temp = 25 + Math.random() * 5;  // 25-30°C
        this.state.soc = Math.max(50, this.state.soc - 0.03);  // Slow drain, stays above 50%
        break;

      case 'low_battery':
        // Low battery: Reduced speed, faster drain, triggers low_battery alerts
        this.state.speed = 15 + Math.random() * 15;  // 15-30 km/h (struggling)
        this.state.motor_temp = 40 + Math.random() * 5;  // Cooler due to low usage
        this.state.temperature = 40 + Math.random() * 5;
        this.state.battery_temp = 22 + Math.random() * 3;
        this.state.soc = Math.max(0, this.state.soc - 0.15);  // Fast drain → triggers critical_battery
        break;

      case 'overheating':
        // Overheating: High speed, temps climb, triggers high_temperature alerts
        this.state.speed = 80 + Math.random() * 20;  // 80-100 km/h (aggressive driving)
        this.state.motor_temp = Math.min(95, this.state.motor_temp + 0.8);  // Gradually heats up
        this.state.temperature = Math.min(95, this.state.temperature + 0.8);
        this.state.battery_temp = Math.min(50, this.state.battery_temp + 0.5);
        this.state.soc = Math.max(40, this.state.soc - 0.08);  // Moderate drain
        break;

      case 'mixed_anomaly':
        // Mixed anomalies: Erratic behavior, random spikes
        const anomalyRoll = Math.random();
        
        if (anomalyRoll < 0.3) {
          // Temperature spike
          this.state.motor_temp = Math.min(95, this.state.motor_temp + 5);
          this.state.temperature = Math.min(95, this.state.temperature + 5);
        } else if (anomalyRoll < 0.6) {
          // Sudden SOC drop
          this.state.soc = Math.max(5, this.state.soc - 2);
        } else {
          // Voltage/current spike
          this.state.battery_voltage = 45 + Math.random() * 35;  // Unstable
          this.state.battery_current = -20 - Math.random() * 80;  // High draw
        }
        
        this.state.speed = 20 + Math.random() * 60;  // Erratic speed
        this.state.motor_temp = Math.max(30, Math.min(90, this.state.motor_temp + (Math.random() - 0.5) * 3));
        this.state.temperature = this.state.motor_temp;
        break;
    }
    
    // Calculate derived values
    this.state.motor_rpm = Math.floor(this.state.speed * 100);
    
    // Voltage correlates with SOC (realistic battery behavior)
    if (this.scenario !== 'mixed_anomaly') {
      this.state.battery_voltage = 50 + (this.state.soc / 100) * 30;  // 50V @ 0%, 80V @ 100%
    }
    
    // Current proportional to speed (negative = discharge)
    this.state.battery_current = -(this.state.speed * 1.2 + Math.random() * 10);
    
    // Round all values for clean output
    Object.keys(this.state).forEach(key => {
      if (typeof this.state[key] === 'number') {
        this.state[key] = parseFloat(this.state[key].toFixed(1));
      }
    });
  }

  /**
   * Send telemetry to backend with retry logic.
   * Failures are isolated to this vehicle only.
   */
  async sendTelemetry() {
    this.updateState();
    
    const payload = {
      vehicle_id: this.vehicleId,
      timestamp: Date.now(),
      data: { ...this.state }
    };

    try {
      await axios.post(`${CONFIG.API_URL}/telemetry`, payload, {
        timeout: 5000  // 5 second timeout
      });
      
      // Reset error counters on success
      this.retryCount = 0;
      this.consecutiveErrors = 0;
      
      // Optional: Log telemetry (disable for large fleets to reduce noise)
      if (CONFIG.LOG_TELEMETRY) {
        console.log(`[${this.vehicleId}] Speed=${this.state.speed}km/h | SOC=${this.state.soc}% | Temp=${this.state.temperature}°C`);
      }
      
      // Log when alerts are likely triggered
      if (CONFIG.LOG_ALERTS) {
        if (this.state.soc < 5) {
          console.log(`⚠ [${this.vehicleId}] CRITICAL BATTERY: SOC=${this.state.soc}%`);
        } else if (this.state.soc < 15) {
          console.log(`⚠ [${this.vehicleId}] LOW BATTERY: SOC=${this.state.soc}%`);
        }
        
        if (this.state.temperature > 85 || this.state.motor_temp > 85) {
          console.log(`⚠ [${this.vehicleId}] HIGH TEMPERATURE: ${this.state.temperature}°C`);
        }
      }
      
    } catch (error) {
      this.consecutiveErrors++;
      
      if (CONFIG.LOG_ERRORS) {
        console.error(`✗ [${this.vehicleId}] Telemetry failed (attempt ${this.consecutiveErrors}):`, 
          error.response?.data?.message || error.message);
      }
      
      // If too many consecutive errors, this vehicle may be broken
      if (this.consecutiveErrors >= CONFIG.MAX_RETRIES) {
        console.error(`✗ [${this.vehicleId}] Max retries exceeded. This vehicle may have issues.`);
        // Don't stop the simulator - let it keep trying
      }
    }
  }

  /**
   * Start the vehicle simulator with jittered interval.
   * Jitter prevents all vehicles from sending telemetry simultaneously.
   */
  start() {
    // Add random jitter to prevent traffic bursts
    const jitter = Math.floor(Math.random() * CONFIG.JITTER_MS * 2) - CONFIG.JITTER_MS;
    const interval = CONFIG.TELEMETRY_INTERVAL + jitter;
    
    if (CONFIG.LOG_TELEMETRY) {
      console.log(`Starting ${this.vehicleId} | Scenario: ${this.scenario} | Interval: ${interval}ms`);
    }
    
    // Start telemetry loop
    this.intervalId = setInterval(() => this.sendTelemetry(), interval);
  }

  /**
   * Stop the vehicle simulator (for graceful shutdown)
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

// ================================================
// FLEET MANAGER
// ================================================

/**
 * FleetManager: Orchestrates the entire fleet of vehicle simulators.
 * 
 * Responsibilities:
 * - Register all vehicles with backend
 * - Distribute scenarios realistically
 * - Start/stop all simulators
 * - Handle graceful shutdown
 * - Track fleet-level statistics
 */
class FleetManager {
  constructor() {
    this.simulators = [];
    this.stats = {
      total: 0,
      registered: 0,
      running: 0,
      scenarios: {}
    };
  }

  /**
   * Generate vehicle metadata for registration
   */
  generateVehicleMetadata() {
    const manufacturers = ['Tesla', 'Nissan', 'Tata', 'BYD', 'Rivian', 'Lucid', 'Mahindra', 'Ola', 'Hyundai', 'Kia'];
    const models = ['Model-X', 'Leaf', 'Nexon-EV', 'Atto-3', 'R1T', 'Air', 'XUV400', 'S1-Pro', 'Ioniq-5', 'EV6'];
    
    const vehicles = [];
    for (let i = 1; i <= CONFIG.FLEET_SIZE; i++) {
      const id = i.toString().padStart(3, '0');
      const mfgIdx = (i - 1) % manufacturers.length;
      vehicles.push({
        vehicle_id: `EV${id}`,
        model: `${manufacturers[mfgIdx]} ${models[mfgIdx]}`,
        registration_number: `REG-${id}`
      });
    }
    return vehicles;
  }

  /**
   * Register all vehicles with backend.
   * Requires authentication token.
   */
  async registerVehicles() {
    const vehicles = this.generateVehicleMetadata();
    
    console.log(`\n╔═══════════════════════════════════════════════╗`);
    console.log(`║   REGISTERING ${CONFIG.FLEET_SIZE} VEHICLES WITH BACKEND   ║`);
    console.log(`╚═══════════════════════════════════════════════╝\n`);
    
    let registered = 0;
    let existing = 0;
    let failed = 0;
    
    for (const v of vehicles) {
      try {
        await axios.post(`${CONFIG.API_URL}/vehicles`, v, {
          headers: { Authorization: `Bearer ${authToken}` },
          timeout: 5000
        });
        registered++;
        if (registered % 10 === 0) {
          console.log(`  ✓ Registered ${registered}/${CONFIG.FLEET_SIZE} vehicles...`);
        }
      } catch (e) {
        if (e.response?.status === 409) {
          existing++;
        } else {
          failed++;
          console.error(`  ✗ Failed to register ${v.vehicle_id}:`, e.response?.data?.message || e.message);
        }
      }
    }
    
    console.log(`\n✓ Registration complete:`);
    console.log(`  - Newly registered: ${registered}`);
    console.log(`  - Already existed: ${existing}`);
    if (failed > 0) {
      console.log(`  - Failed: ${failed}`);
    }
    console.log('');
    
    this.stats.registered = registered + existing;
  }

  /**
   * Distribute scenarios across fleet based on configuration percentages.
   */
  assignScenarios() {
    const scenarios = [];
    const dist = CONFIG.SCENARIO_DISTRIBUTION;
    
    // Calculate how many vehicles per scenario
    const counts = {
      normal: Math.floor(CONFIG.FLEET_SIZE * dist.normal / 100),
      low_battery: Math.floor(CONFIG.FLEET_SIZE * dist.low_battery / 100),
      overheating: Math.floor(CONFIG.FLEET_SIZE * dist.overheating / 100),
      mixed_anomaly: Math.floor(CONFIG.FLEET_SIZE * dist.mixed_anomaly / 100)
    };
    
    // Fill any remainder with normal scenarios
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    counts.normal += CONFIG.FLEET_SIZE - total;
    
    // Build scenario array
    Object.entries(counts).forEach(([scenario, count]) => {
      for (let i = 0; i < count; i++) {
        scenarios.push(scenario);
      }
    });
    
    // Shuffle to randomize distribution
    for (let i = scenarios.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [scenarios[i], scenarios[j]] = [scenarios[j], scenarios[i]];
    }
    
    this.stats.scenarios = counts;
    return scenarios;
  }

  /**
   * Initialize and start all vehicle simulators
   */
  startFleet() {
    const scenarios = this.assignScenarios();
    
    console.log(`\n╔═══════════════════════════════════════════════╗`);
    console.log(`║      STARTING FLEET SIMULATION (${CONFIG.FLEET_SIZE} EVs)     ║`);
    console.log(`╚═══════════════════════════════════════════════╝\n`);
    
    console.log(`Scenario Distribution:`);
    Object.entries(this.stats.scenarios).forEach(([scenario, count]) => {
      const percentage = ((count / CONFIG.FLEET_SIZE) * 100).toFixed(0);
      console.log(`  - ${scenario.padEnd(15)}: ${count.toString().padStart(3)} vehicles (${percentage}%)`);
    });
    console.log(``);
    console.log(`Telemetry Interval: ${CONFIG.TELEMETRY_INTERVAL}ms ± ${CONFIG.JITTER_MS}ms jitter`);
    console.log(`API Endpoint: ${CONFIG.API_URL}`);
    console.log(``);
    
    // Create and start all simulators
    for (let i = 1; i <= CONFIG.FLEET_SIZE; i++) {
      const vehicleId = `EV${i.toString().padStart(3, '0')}`;
      const scenario = scenarios[i - 1];
      
      const simulator = new VehicleSimulator(vehicleId, scenario);
      this.simulators.push(simulator);
      
      // Stagger startup slightly to avoid initial burst
      setTimeout(() => simulator.start(), i * 10);
    }
    
    this.stats.running = CONFIG.FLEET_SIZE;
    this.stats.total = CONFIG.FLEET_SIZE;
    
    console.log(`✓ ${CONFIG.FLEET_SIZE} vehicles are now transmitting telemetry`);
    console.log(`✓ Press Ctrl+C to stop the simulator\n`);
    console.log(`${'='.repeat(60)}\n`);
  }

  /**
   * Gracefully stop all simulators
   */
  stopFleet() {
    console.log(`\n\n${'='.repeat(60)}`);
    console.log(`Stopping fleet simulation...`);
    
    this.simulators.forEach(sim => sim.stop());
    this.stats.running = 0;
    
    console.log(`✓ All ${this.simulators.length} vehicles stopped`);
    console.log(`${'='.repeat(60)}\n`);
  }

  /**
   * Get current fleet statistics
   */
  getStats() {
    return { ...this.stats };
  }
}

// ================================================
// MAIN ENTRY POINT
// ================================================

const fleetManager = new FleetManager();

/**
 * Main orchestration function.
 * Handles authentication, registration, and fleet startup.
 */
async function main() {
  console.clear();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`   EV FLEET SIMULATOR - SCALABLE EDITION`);
  console.log(`${'='.repeat(60)}`);
  console.log(`\nConfiguration:`);
  console.log(`  - Fleet Size: ${CONFIG.FLEET_SIZE} vehicles`);
  console.log(`  - Telemetry Interval: ${CONFIG.TELEMETRY_INTERVAL}ms`);
  console.log(`  - API URL: ${CONFIG.API_URL}`);
  console.log(`${'='.repeat(60)}\n`);
  
  try {
    // Step 1: Authenticate with backend
    console.log(`[1/3] Authenticating with backend...`);
    const authenticated = await authenticate();
    if (!authenticated) {
      console.error('\n✗ Authentication failed. Cannot proceed.\n');
      console.error('Troubleshooting:');
      console.error('  - Ensure backend is running on http://localhost:3000');
      console.error('  - Verify admin credentials are correct\n');
      process.exit(1);
    }
    
    // Step 2: Register all vehicles
    console.log(`[2/3] Registering ${CONFIG.FLEET_SIZE} vehicles with backend...`);
    await fleetManager.registerVehicles();
    
    // Step 3: Start fleet simulation
    console.log(`[3/3] Starting fleet simulation...`);
    fleetManager.startFleet();
    
  } catch (error) {
    console.error('\n✗ Fatal error during startup:', error.message);
    console.error('\nTroubleshooting:');
    console.error('  - Ensure backend is running and accessible');
    console.error('  - Check network connectivity');
    console.error('  - Review error message above\n');
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler.
 * Ensures all simulators stop cleanly on Ctrl+C.
 */
process.on('SIGINT', () => {
  console.log('\n\nReceived SIGINT (Ctrl+C)');
  fleetManager.stopFleet();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\nReceived SIGTERM');
  fleetManager.stopFleet();
  process.exit(0);
});

// Start the simulator
main();
