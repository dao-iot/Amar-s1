const db = require('../db');
const realtimeService = require('./realtime.service');
const alertEvaluator = require('../alerts/evaluator');

/**
 * Service to handle telemetry-related database operations
 */
class TelemetryService {
  /**
   * Save telemetry data and update vehicle's last_seen
   * Optimized for high-throughput: uses individual queries instead of transaction
   * for better concurrency under heavy load.
   */
  async ingestTelemetry(telemetryData) {
    const { vehicle_id, timestamp, data } = telemetryData;

    try {
      // 1. Store telemetry (fire-and-forget, don't block on this)
      const insertQuery = `
        INSERT INTO telemetry (vehicle_id, timestamp, data)
        VALUES ($1, $2, $3)
      `;
      const insertValues = [vehicle_id, timestamp, JSON.stringify(data)];

      // 2. Update vehicle last_seen
      const updateQuery = `
        UPDATE vehicles
        SET last_seen = CURRENT_TIMESTAMP
        WHERE vehicle_id = $1
      `;

      // Execute both queries concurrently for better throughput
      // Note: At high scale, we prioritize throughput over strict consistency
      await Promise.all([
        db.query(insertQuery, insertValues),
        db.query(updateQuery, [vehicle_id])
      ]);

      // 3. Trigger Real-time broadcast and status updates (non-blocking)
      realtimeService.handleIncomingTelemetry(vehicle_id, telemetryData);

      // 4. Evaluate Alert Rules (non-blocking, with error isolation)
      alertEvaluator.evaluate(telemetryData).catch(err => {
        console.error('[AlertEvaluator] Error:', err.message);
      });

      return true;
    } catch (error) {
      console.error('[TelemetryService] Ingestion error:', error.message);
      throw error;
    }
  }

  /**
   * Fetch latest telemetry for a vehicle
   */
  async getLatestTelemetry(vehicleId) {
    const query = `
      SELECT * FROM telemetry 
      WHERE vehicle_id = $1 
      ORDER BY timestamp DESC 
      LIMIT 1
    `;
    const { rows } = await db.query(query, [vehicleId]);
    return rows[0];
  }

  /**
   * Fetch telemetry history within a time range
   */
  async getTelemetryHistory(vehicleId, from, to) {
    const query = `
      SELECT * FROM telemetry 
      WHERE vehicle_id = $1 
      AND timestamp >= $2 
      AND timestamp <= $3 
      ORDER BY timestamp ASC 
      LIMIT 500
    `;
    const { rows } = await db.query(query, [vehicleId, from, to]);
    return rows;
  }

  /**
   * Calculate basic stats per vehicle (optimized)
   */
  async getTelemetryStats() {
    // Simplified query to prevent timeouts - get latest telemetry per vehicle
    const query = `
      SELECT DISTINCT ON (v.vehicle_id) 
        v.vehicle_id,
        v.model,
        (t.data->>'speed')::FLOAT as current_speed,
        (t.data->>'soc')::FLOAT as current_soc,
        (t.data->>'battery_voltage')::FLOAT as current_voltage,
        (t.data->>'battery_temp')::FLOAT as current_temp,
        t.timestamp as last_updated
      FROM vehicles v
      LEFT JOIN telemetry t ON v.vehicle_id = t.vehicle_id
      ORDER BY v.vehicle_id, t.timestamp DESC
    `;
    const { rows } = await db.query(query);
    return rows;
  }
}

module.exports = new TelemetryService();
