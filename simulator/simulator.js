/*
================================================
EV FLEET SIMULATOR - HIGH SCALE EDITION (500 ALERTS/MIN)
================================================

PURPOSE:
Stress-test EV Fleet Monitoring Platform with realistic, concurrent telemetry
generating ~500 alerts per minute through natural rule violations.

TARGET METRICS:
---------------
- Alert Rate: ~500 alerts/minute sustained
- Fleet Size: 250 vehicles
- Telemetry Rate: ~500 packets/second (250 vehicles × 2 packets/sec)
- Alert Sources: low_battery, critical_battery, overheating, mixed_anomalies

RUN INSTRUCTIONS:
-----------------
1. Ensure backend is running on http://localhost:3000
2. Install dependencies: npm install axios
3. Start simulator: node simulator.js
4. Stop simulator: Ctrl+C (graceful shutdown)

CONFIGURATION:
--------------
All scaling parameters are centralized in the CONFIG section below.
Modify TARGET_ALERT_RATE and the system auto-tunes other parameters.

ARCHITECTURE:
-------------
1. SimulatorConfig → Global configuration with scaling targets
2. VehicleSimulator → Individual EV with independent state machine
3. FleetManager → Orchestrates all vehicles, handles startup/shutdown
4. Async telemetry sends with retry backoff (no blocking)
5. Graceful error handling per vehicle (one failure ≠ fleet failure)

================================================
*/

const axios = require('axios');

// ================================================
// SCALING CONFIGURATION - MODIFY TARGETS HERE
// ================================================

/**
 * PRIMARY SCALING TARGET
 * The simulator will tune other parameters to approximate this alert rate.
 * Actual rate depends on alert rule conditions being triggered naturally.
 */
const TARGET_ALERT_RATE = 500; // alerts per minute

/**
 * FLEET CONFIGURATION
 * - FLEET_SIZE: Number of simulated vehicles (200-300 recommended for 500 alerts/min)
 * - TELEMETRY_INTERVAL_MS: Base ms between packets per vehicle (lower = more alerts)
 * - JITTER_MS: Random ±ms to prevent synchronized bursts (keep 200-300ms)
 */
const FLEET_SIZE = 250;           // 250 vehicles for high alert volume
const TELEMETRY_INTERVAL_MS = 500; // 500ms = 2 packets/sec per vehicle
const JITTER_MS = 250;             // ±250ms jitter prevents thundering herd

/**
 * SCENARIO DISTRIBUTION
 * Adjusts the ratio of vehicles in each alert-generating scenario.
 * Higher anomaly ratios = more alerts per vehicle.
 * Must sum to 100.
 */
const SCENARIO_DISTRIBUTION = {
  normal: 20,        // 20% normal (no alerts)
  low_battery: 35,   // 35% low battery (triggers low_battery + critical_battery)
  overheating: 25,   // 25% overheating (triggers high_temperature + critical_temperature)
  mixed_anomaly: 20  // 20% mixed (triggers random alert types)
};

// Validate distribution sums to 100
const totalDist = Object.values(SCENARIO_DISTRIBUTION).reduce((a, b) => a + b, 0);
if (totalDist !== 100) {
  console.error(`ERROR: SCENARIO_DISTRIBUTION must sum to 100, got ${totalDist}`);
  process.exit(1);
}

// ================================================
// SIMULATOR CONFIGURATION OBJECT
// ================================================

const CONFIG = {
  // API endpoint
  API_URL: 'http://localhost:3000/api/v1',

  // Admin credentials for vehicle registration
  ADMIN_CREDENTIALS: {
    username: 'admin',
    password: 'admin123'
  },

  // Fleet configuration (from scaling parameters above)
  FLEET_SIZE: FLEET_SIZE,
  TELEMETRY_INTERVAL: TELEMETRY_INTERVAL_MS,
  JITTER_MS: JITTER_MS,

  // Scenario distribution (from scaling parameters above)
  SCENARIO_DISTRIBUTION: SCENARIO_DISTRIBUTION,

  // Retry logic with exponential backoff
  MAX_RETRIES: 5,
  RETRY_DELAY_MS: 500,     // Initial retry delay
  RETRY_BACKOFF_MULTIPLIER: 2,  // Exponential backoff
  CIRCUIT_BREAKER_THRESHOLD: 10, // Pause vehicle after N consecutive errors

  // Logging verbosity (reduce at scale to prevent I/O bottleneck)
  LOG_TELEMETRY: false,    // Disable per-vehicle telemetry logs at scale
  LOG_ALERTS: true,        // Keep alert logging for verification
  LOG_ERRORS: true,        // Keep error logging
  LOG_STATS_INTERVAL: 30,  // Print stats every N seconds

  // Performance tuning
  BATCH_REGISTRATION: true,      // Register vehicles in batches
  REGISTRATION_BATCH_SIZE: 20,   // Vehicles per registration batch
  REGISTRATION_DELAY_MS: 100,    // Delay between batches
  STARTUP_STAGGER_MS: 5,         // ms delay between vehicle starts

  // Scaling targets (for monitoring)
  TARGET_ALERT_RATE: TARGET_ALERT_RATE
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
 * - Handles network errors gracefully with exponential backoff
 * - Implements circuit breaker pattern for resilience
 */
class VehicleSimulator {
  constructor(vehicleId, scenario) {
    this.vehicleId = vehicleId;
    this.scenario = scenario;
    this.intervalId = null;
    this.retryCount = 0;
    this.consecutiveErrors = 0;
    this.circuitOpen = false;
    this.circuitResetTime = null;
    this.isPaused = false;

    // Statistics tracking
    this.stats = {
      packetsSent: 0,
      packetsFailed: 0,
      alertsTriggered: 0
    };

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
   * Check if circuit breaker allows requests
   */
  checkCircuitBreaker() {
    if (this.circuitOpen) {
      const now = Date.now();
      if (this.circuitResetTime && now > this.circuitResetTime) {
        // Reset circuit breaker after cooldown
        this.circuitOpen = false;
        this.consecutiveErrors = 0;
        if (CONFIG.LOG_ERRORS) {
          console.log(`[${this.vehicleId}] Circuit breaker reset, resuming telemetry`);
        }
        return true;
      }
      return false;
    }
    return true;
  }

  /**
   * Send telemetry to backend with retry logic and circuit breaker.
   * Failures are isolated to this vehicle only.
   * Uses exponential backoff for retries.
   */
  async sendTelemetry() {
    // Skip if paused or circuit breaker is open
    if (this.isPaused || !this.checkCircuitBreaker()) {
      return;
    }

    this.updateState();

    const payload = {
      vehicle_id: this.vehicleId,
      timestamp: Date.now(),
      data: { ...this.state }
    };

    let attempt = 0;
    let success = false;

    while (attempt < CONFIG.MAX_RETRIES && !success) {
      try {
        await axios.post(`${CONFIG.API_URL}/telemetry`, payload, {
          timeout: 5000  // 5 second timeout
        });

        // Success - reset error counters
        this.retryCount = 0;
        this.consecutiveErrors = 0;
        this.stats.packetsSent++;
        success = true;

        // Optional: Log telemetry (disable for large fleets to reduce noise)
        if (CONFIG.LOG_TELEMETRY) {
          console.log(`[${this.vehicleId}] Speed=${this.state.speed}km/h | SOC=${this.state.soc}% | Temp=${this.state.temperature}°C`);
        }

        // Log when alerts are likely triggered
        if (CONFIG.LOG_ALERTS) {
          let alertTriggered = false;
          if (this.state.soc < 5) {
            console.log(`⚠ [${this.vehicleId}] CRITICAL BATTERY: SOC=${this.state.soc}%`);
            alertTriggered = true;
          } else if (this.state.soc < 15) {
            console.log(`⚠ [${this.vehicleId}] LOW BATTERY: SOC=${this.state.soc}%`);
            alertTriggered = true;
          }

          if (this.state.temperature > 85 || this.state.motor_temp > 85) {
            console.log(`⚠ [${this.vehicleId}] HIGH TEMPERATURE: ${this.state.temperature}°C`);
            alertTriggered = true;
          }

          if (alertTriggered) {
            this.stats.alertsTriggered++;
          }
        }

      } catch (error) {
        attempt++;
        this.consecutiveErrors++;
        this.stats.packetsFailed++;

        if (CONFIG.LOG_ERRORS) {
          console.error(`✗ [${this.vehicleId}] Telemetry failed (attempt ${attempt}/${CONFIG.MAX_RETRIES}):`,
            error.response?.data?.message || error.message);
        }

        // Exponential backoff before retry
        if (attempt < CONFIG.MAX_RETRIES) {
          const backoffDelay = CONFIG.RETRY_DELAY_MS * Math.pow(CONFIG.RETRY_BACKOFF_MULTIPLIER, attempt - 1);
          await this.sleep(backoffDelay);
        }
      }
    }

    // Circuit breaker logic: if max retries exceeded, open circuit
    if (!success && this.consecutiveErrors >= CONFIG.CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitOpen = true;
      this.circuitResetTime = Date.now() + 30000; // 30 second cooldown
      console.error(`⚠ [${this.vehicleId}] Circuit breaker OPENED due to ${this.consecutiveErrors} consecutive errors. Cooling down for 30s.`);
    }
  }

  /**
   * Utility: Sleep for ms milliseconds
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
 * - Register all vehicles with backend (batched for performance)
 * - Distribute scenarios realistically
 * - Start/stop all simulators
 * - Handle graceful shutdown
 * - Track fleet-level statistics
 * - Monitor alert generation rate
 */
class FleetManager {
  constructor() {
    this.simulators = [];
    this.stats = {
      total: 0,
      registered: 0,
      running: 0,
      scenarios: {},
      startTime: null,
      totalPacketsSent: 0,
      totalPacketsFailed: 0,
      totalAlertsTriggered: 0
    };
    this.statsInterval = null;
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
   * Register all vehicles with backend using batched requests.
   * Batching prevents overwhelming the backend during registration.
   * Requires authentication token.
   */
  async registerVehicles() {
    const vehicles = this.generateVehicleMetadata();

    console.log(`\n╔═══════════════════════════════════════════════════╗`);
    console.log(`║   REGISTERING ${CONFIG.FLEET_SIZE} VEHICLES WITH BACKEND   ║`);
    console.log(`╚═══════════════════════════════════════════════════╝\n`);
    console.log(`Using batch size: ${CONFIG.REGISTRATION_BATCH_SIZE}, delay: ${CONFIG.REGISTRATION_DELAY_MS}ms\n`);

    let registered = 0;
    let existing = 0;
    let failed = 0;

    // Process vehicles in batches
    for (let i = 0; i < vehicles.length; i += CONFIG.REGISTRATION_BATCH_SIZE) {
      const batch = vehicles.slice(i, i + CONFIG.REGISTRATION_BATCH_SIZE);

      // Process batch concurrently with Promise.all
      const batchResults = await Promise.all(
        batch.map(async (v) => {
          try {
            await axios.post(`${CONFIG.API_URL}/vehicles`, v, {
              headers: { Authorization: `Bearer ${authToken}` },
              timeout: 5000
            });
            return { status: 'registered', vehicleId: v.vehicle_id };
          } catch (e) {
            if (e.response?.status === 409) {
              return { status: 'existing', vehicleId: v.vehicle_id };
            } else {
              return { status: 'failed', vehicleId: v.vehicle_id, error: e.response?.data?.message || e.message };
            }
          }
        })
      );

      // Count results
      batchResults.forEach(result => {
        if (result.status === 'registered') registered++;
        else if (result.status === 'existing') existing++;
        else {
          failed++;
          if (CONFIG.LOG_ERRORS) {
            console.error(`  ✗ Failed to register ${result.vehicleId}:`, result.error);
          }
        }
      });

      // Progress update
      const processed = Math.min(i + CONFIG.REGISTRATION_BATCH_SIZE, vehicles.length);
      console.log(`  ✓ Progress: ${processed}/${CONFIG.FLEET_SIZE} vehicles processed...`);

      // Delay between batches to prevent overwhelming backend
      if (i + CONFIG.REGISTRATION_BATCH_SIZE < vehicles.length) {
        await this.sleep(CONFIG.REGISTRATION_DELAY_MS);
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
   * Utility: Sleep for ms milliseconds
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
   * Initialize and start all vehicle simulators with staggered startup
   */
  async startFleet() {
    const scenarios = this.assignScenarios();

    console.log(`\n╔═══════════════════════════════════════════════════╗`);
    console.log(`║      STARTING HIGH-SCALE SIMULATION (${CONFIG.FLEET_SIZE} EVs)     ║`);
    console.log(`╚═══════════════════════════════════════════════════╝\n`);

    console.log(`Target Alert Rate: ~${CONFIG.TARGET_ALERT_RATE} alerts/minute`);
    console.log(`Expected Telemetry: ~${(CONFIG.FLEET_SIZE * 1000 / CONFIG.TELEMETRY_INTERVAL).toFixed(0)} packets/second\n`);

    console.log(`Scenario Distribution:`);
    Object.entries(this.stats.scenarios).forEach(([scenario, count]) => {
      const percentage = ((count / CONFIG.FLEET_SIZE) * 100).toFixed(0);
      console.log(`  - ${scenario.padEnd(15)}: ${count.toString().padStart(3)} vehicles (${percentage}%)`);
    });
    console.log(``);
    console.log(`Telemetry Interval: ${CONFIG.TELEMETRY_INTERVAL}ms ± ${CONFIG.JITTER_MS}ms jitter`);
    console.log(`API Endpoint: ${CONFIG.API_URL}`);
    console.log(``);

    // Create and start all simulators with staggered startup
    for (let i = 1; i <= CONFIG.FLEET_SIZE; i++) {
      const vehicleId = `EV${i.toString().padStart(3, '0')}`;
      const scenario = scenarios[i - 1];

      const simulator = new VehicleSimulator(vehicleId, scenario);
      this.simulators.push(simulator);

      // Stagger startup to avoid initial burst
      await this.sleep(CONFIG.STARTUP_STAGGER_MS);
      simulator.start();

      // Progress indicator every 50 vehicles
      if (i % 50 === 0) {
        console.log(`  ✓ Started ${i}/${CONFIG.FLEET_SIZE} vehicles...`);
      }
    }

    this.stats.running = CONFIG.FLEET_SIZE;
    this.stats.total = CONFIG.FLEET_SIZE;
    this.stats.startTime = Date.now();

    console.log(`\n✓ ${CONFIG.FLEET_SIZE} vehicles are now transmitting telemetry`);
    console.log(`✓ Press Ctrl+C to stop the simulator\n`);
    console.log(`${'='.repeat(60)}\n`);

    // Start statistics monitoring
    this.startStatsMonitoring();
  }

  /**
   * Start periodic statistics logging
   */
  startStatsMonitoring() {
    this.statsInterval = setInterval(() => {
      this.logFleetStats();
    }, CONFIG.LOG_STATS_INTERVAL * 1000);
  }

  /**
   * Log current fleet statistics
   */
  logFleetStats() {
    // Aggregate stats from all simulators
    let totalSent = 0;
    let totalFailed = 0;
    let totalAlerts = 0;
    let circuitOpenCount = 0;

    this.simulators.forEach(sim => {
      totalSent += sim.stats.packetsSent;
      totalFailed += sim.stats.packetsFailed;
      totalAlerts += sim.stats.alertsTriggered;
      if (sim.circuitOpen) circuitOpenCount++;
    });

    const elapsedMinutes = (Date.now() - this.stats.startTime) / 60000;
    const packetRate = elapsedMinutes > 0 ? (totalSent / elapsedMinutes).toFixed(0) : 0;
    const alertRate = elapsedMinutes > 0 ? (totalAlerts / elapsedMinutes).toFixed(0) : 0;

    console.log(`\n[STATS] Elapsed: ${elapsedMinutes.toFixed(1)}min | Packets: ${totalSent} (${packetRate}/min) | Alerts: ${totalAlerts} (${alertRate}/min target: ${CONFIG.TARGET_ALERT_RATE}/min) | Failed: ${totalFailed} | Circuit Open: ${circuitOpenCount}`);
  }

  /**
   * Gracefully stop all simulators and print final stats
   */
  stopFleet() {
    console.log(`\n\n${'='.repeat(60)}`);
    console.log(`Stopping fleet simulation...`);

    // Clear stats interval
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    // Print final stats
    this.logFleetStats();

    // Stop all simulators
    this.simulators.forEach(sim => sim.stop());
    this.stats.running = 0;

    console.log(`\n✓ All ${this.simulators.length} vehicles stopped`);
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
  console.log(`   EV FLEET SIMULATOR - HIGH SCALE EDITION`);
  console.log(`${'='.repeat(60)}`);
  console.log(`\nConfiguration:`);
  console.log(`  - Fleet Size: ${CONFIG.FLEET_SIZE} vehicles`);
  console.log(`  - Telemetry Interval: ${CONFIG.TELEMETRY_INTERVAL}ms (±${CONFIG.JITTER_MS}ms jitter)`);
  console.log(`  - Expected Telemetry: ~${(CONFIG.FLEET_SIZE * 1000 / CONFIG.TELEMETRY_INTERVAL).toFixed(0)} packets/sec`);
  console.log(`  - Target Alert Rate: ~${CONFIG.TARGET_ALERT_RATE} alerts/minute`);
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
    await fleetManager.startFleet();

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
