const db = require('../db');

/**
 * Service to handle alert-related API data retrieval
 */
class AlertApiService {
  /**
   * Fetch all active (unresolved) alerts
   */
  async getActiveAlerts() {
    const query = `
      SELECT * FROM alerts
      WHERE resolved_at IS NULL
      ORDER BY created_at DESC
    `;
    const { rows } = await db.query(query);
    return rows;
  }

  /**
   * Fetch a specific alert by ID
   */
  async getAlertById(alertId) {
    const query = 'SELECT * FROM alerts WHERE alert_id = $1';
    const { rows } = await db.query(query, [alertId]);
    return rows[0];
  }

  /**
   * Mark an alert as acknowledged
   */
  async acknowledgeAlert(alertId) {
    const query = `
      UPDATE alerts
      SET acknowledged_at = NOW()
      WHERE alert_id = $1 AND acknowledged_at IS NULL
      RETURNING *
    `;
    const { rows } = await db.query(query, [alertId]);
    return rows[0];
  }

  /**
   * Get alert statistics for monitoring
   * Returns counts for the last minute, 5 minutes, and total active
   */
  async getAlertStats() {
    const queries = {
      // Active (unresolved) alerts
      active: `SELECT COUNT(*) as count FROM alerts WHERE resolved_at IS NULL`,

      // Alerts created in last minute
      lastMinute: `
        SELECT COUNT(*) as count FROM alerts
        WHERE created_at >= NOW() - INTERVAL '1 minute'
      `,

      // Alerts created in last 5 minutes
      last5Minutes: `
        SELECT COUNT(*) as count FROM alerts
        WHERE created_at >= NOW() - INTERVAL '5 minutes'
      `,

      // Alerts by severity (active)
      bySeverity: `
        SELECT severity, COUNT(*) as count
        FROM alerts
        WHERE resolved_at IS NULL
        GROUP BY severity
      `,

      // Alerts by type (last 5 minutes)
      byType: `
        SELECT alert_type, COUNT(*) as count
        FROM alerts
        WHERE created_at >= NOW() - INTERVAL '5 minutes'
        GROUP BY alert_type
      `,

      // Total alerts created today
      today: `
        SELECT COUNT(*) as count FROM alerts
        WHERE created_at >= CURRENT_DATE
      `
    };

    const results = await Promise.all([
      db.query(queries.active),
      db.query(queries.lastMinute),
      db.query(queries.last5Minutes),
      db.query(queries.bySeverity),
      db.query(queries.byType),
      db.query(queries.today)
    ]);

    return {
      active: parseInt(results[0].rows[0].count),
      lastMinute: parseInt(results[1].rows[0].count),
      last5Minutes: parseInt(results[2].rows[0].count),
      bySeverity: results[3].rows,
      byType: results[4].rows,
      today: parseInt(results[5].rows[0].count)
    };
  }

  /**
   * Get active alert counts per vehicle
   * Returns array of { vehicle_id, alert_count, severities: [] }
   * Optional filters: vehicle_id, severity, time_window_minutes
   */
  async getAlertCountsPerVehicle(filters = {}) {
    const { vehicle_id, severity, time_window_minutes } = filters;
    const conditions = ['resolved_at IS NULL'];
    const params = [];
    let paramIndex = 1;

    if (vehicle_id) {
      conditions.push(`vehicle_id = $${paramIndex++}`);
      params.push(vehicle_id);
    }

    if (severity) {
      conditions.push(`severity = $${paramIndex++}`);
      params.push(severity);
    }

    if (time_window_minutes) {
      conditions.push(`created_at >= NOW() - INTERVAL '${time_window_minutes} minutes'`);
    }

    const whereClause = conditions.join(' AND ');

    const query = `
      SELECT 
        vehicle_id,
        COUNT(*) as alert_count,
        ARRAY_AGG(DISTINCT severity) as severities,
        ARRAY_AGG(DISTINCT alert_type) as alert_types
      FROM alerts
      WHERE ${whereClause}
      GROUP BY vehicle_id
      ORDER BY alert_count DESC
    `;

    const { rows } = await db.query(query, params);
    return rows.map(r => ({
      vehicle_id: r.vehicle_id,
      alert_count: parseInt(r.alert_count),
      severities: r.severities,
      alert_types: r.alert_types
    }));
  }

  /**
   * Get active alert counts grouped by severity
   * Optional filters: vehicle_id, time_window_minutes
   */
  async getAlertCountsBySeverity(filters = {}) {
    const { vehicle_id, time_window_minutes } = filters;
    const conditions = ['resolved_at IS NULL'];
    const params = [];
    let paramIndex = 1;

    if (vehicle_id) {
      conditions.push(`vehicle_id = $${paramIndex++}`);
      params.push(vehicle_id);
    }

    if (time_window_minutes) {
      conditions.push(`created_at >= NOW() - INTERVAL '${time_window_minutes} minutes'`);
    }

    const whereClause = conditions.join(' AND ');

    const query = `
      SELECT 
        severity,
        COUNT(*) as count,
        COUNT(DISTINCT vehicle_id) as vehicle_count
      FROM alerts
      WHERE ${whereClause}
      GROUP BY severity
      ORDER BY 
        CASE severity 
          WHEN 'CRITICAL' THEN 1 
          WHEN 'WARNING' THEN 2 
          WHEN 'INFO' THEN 3 
        END
    `;

    const { rows } = await db.query(query, params);
    return rows.map(r => ({
      severity: r.severity,
      count: parseInt(r.count),
      vehicle_count: parseInt(r.vehicle_count)
    }));
  }

  /**
   * Get active alert counts grouped by alert_type
   * Optional filters: vehicle_id, severity, time_window_minutes
   */
  async getAlertCountsByType(filters = {}) {
    const { vehicle_id, severity, time_window_minutes } = filters;
    const conditions = ['resolved_at IS NULL'];
    const params = [];
    let paramIndex = 1;

    if (vehicle_id) {
      conditions.push(`vehicle_id = $${paramIndex++}`);
      params.push(vehicle_id);
    }

    if (severity) {
      conditions.push(`severity = $${paramIndex++}`);
      params.push(severity);
    }

    if (time_window_minutes) {
      conditions.push(`created_at >= NOW() - INTERVAL '${time_window_minutes} minutes'`);
    }

    const whereClause = conditions.join(' AND ');

    const query = `
      SELECT 
        alert_type,
        severity,
        COUNT(*) as count,
        COUNT(DISTINCT vehicle_id) as vehicle_count
      FROM alerts
      WHERE ${whereClause}
      GROUP BY alert_type, severity
      ORDER BY count DESC
    `;

    const { rows } = await db.query(query, params);
    return rows.map(r => ({
      alert_type: r.alert_type,
      severity: r.severity,
      count: parseInt(r.count),
      vehicle_count: parseInt(r.vehicle_count)
    }));
  }

  /**
   * Get lightweight alert summary for UI aggregation
   * Used for WebSocket broadcasts and quick dashboard stats
   */
  async getAlertSummary() {
    const query = `
      WITH active_alerts AS (
        SELECT 
          vehicle_id,
          severity,
          alert_type
        FROM alerts
        WHERE resolved_at IS NULL
      )
      SELECT 
        (SELECT COUNT(*) FROM active_alerts) as total_active_alerts,
        (SELECT COUNT(DISTINCT vehicle_id) FROM active_alerts WHERE severity = 'CRITICAL') as critical_vehicles,
        (SELECT COUNT(DISTINCT vehicle_id) FROM active_alerts WHERE severity = 'WARNING') as warning_vehicles,
        (SELECT COUNT(DISTINCT vehicle_id) FROM active_alerts) as total_vehicles_with_alerts,
        (
          SELECT json_agg(json_build_object('alert_type', alert_type, 'severity', severity, 'count', cnt))
          FROM (
            SELECT alert_type, severity, COUNT(*) as cnt
            FROM active_alerts
            GROUP BY alert_type, severity
            ORDER BY cnt DESC
            LIMIT 10
          ) t
        ) as alert_counts_by_type
      FROM active_alerts
      LIMIT 1
    `;

    const { rows } = await db.query(query);

    if (rows.length === 0) {
      return {
        totalActiveAlerts: 0,
        criticalVehicles: 0,
        warningVehicles: 0,
        totalVehiclesWithAlerts: 0,
        alertCountsByType: []
      };
    }

    const row = rows[0];
    return {
      totalActiveAlerts: parseInt(row.total_active_alerts) || 0,
      criticalVehicles: parseInt(row.critical_vehicles) || 0,
      warningVehicles: parseInt(row.warning_vehicles) || 0,
      totalVehiclesWithAlerts: parseInt(row.total_vehicles_with_alerts) || 0,
      alertCountsByType: row.alert_counts_by_type || []
    };
  }

  /**
   * Get alerts per minute time series data for last 30 minutes
   * Returns array of { timestamp, count } for line chart
   */
  async getAlertsPerMinute(timeWindowMinutes = 30) {
    const query = `
      SELECT 
        DATE_TRUNC('minute', created_at) as timestamp,
        COUNT(*) as count
      FROM alerts
      WHERE created_at >= NOW() - INTERVAL '${timeWindowMinutes} minutes'
      GROUP BY DATE_TRUNC('minute', created_at)
      ORDER BY timestamp ASC
    `;
    const { rows } = await db.query(query);
    
    return rows.map(r => ({
      timestamp: r.timestamp.toISOString(),
      count: parseInt(r.count)
    }));
  }

  /**
   * Get vehicle health distribution
   * Returns counts of healthy, warning, critical, and offline vehicles
   */
  async getVehicleHealthDistribution() {
    const query = `
      WITH vehicle_alerts AS (
        SELECT 
          v.vehicle_id,
          v.status,
          COUNT(a.alert_id) as alert_count,
          MAX(CASE WHEN a.severity = 'CRITICAL' THEN 1 ELSE 0 END) as has_critical,
          MAX(CASE WHEN a.severity = 'WARNING' THEN 1 ELSE 0 END) as has_warning
        FROM vehicles v
        LEFT JOIN alerts a ON v.vehicle_id = a.vehicle_id AND a.resolved_at IS NULL
        GROUP BY v.vehicle_id, v.status
      )
      SELECT 
        SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline,
        SUM(CASE WHEN status != 'offline' AND has_critical = 1 THEN 1 ELSE 0 END) as critical,
        SUM(CASE WHEN status != 'offline' AND has_warning = 1 AND has_critical = 0 THEN 1 ELSE 0 END) as warning,
        SUM(CASE WHEN status != 'offline' AND has_critical = 0 AND has_warning = 0 THEN 1 ELSE 0 END) as healthy
      FROM vehicle_alerts
    `;
    const { rows } = await db.query(query);
    
    if (rows.length === 0) {
      return { healthy: 0, warning: 0, critical: 0, offline: 0 };
    }
    
    const row = rows[0];
    return {
      healthy: parseInt(row.healthy) || 0,
      warning: parseInt(row.warning) || 0,
      critical: parseInt(row.critical) || 0,
      offline: parseInt(row.offline) || 0
    };
  }

  /**
   * Get top problem vehicles by alert count in last 10 minutes
   * Returns array of { vehicle_id, alert_count, severity_breakdown }
   */
  async getTopProblemVehicles(limit = 10, timeWindowMinutes = 10) {
    const query = `
      SELECT 
        vehicle_id,
        COUNT(*) as alert_count,
        COUNT(CASE WHEN severity = 'CRITICAL' THEN 1 END) as critical_count,
        COUNT(CASE WHEN severity = 'WARNING' THEN 1 END) as warning_count,
        COUNT(CASE WHEN severity = 'INFO' THEN 1 END) as info_count,
        STRING_AGG(DISTINCT alert_type, ', ') as alert_types
      FROM alerts
      WHERE created_at >= NOW() - INTERVAL '${timeWindowMinutes} minutes'
      GROUP BY vehicle_id
      ORDER BY alert_count DESC
      LIMIT $1
    `;
    const { rows } = await db.query(query, [limit]);
    
    return rows.map(r => ({
      vehicle_id: r.vehicle_id,
      alert_count: parseInt(r.alert_count),
      critical_count: parseInt(r.critical_count),
      warning_count: parseInt(r.warning_count),
      info_count: parseInt(r.info_count),
      alert_types: r.alert_types
    }));
  }
}

module.exports = new AlertApiService();
