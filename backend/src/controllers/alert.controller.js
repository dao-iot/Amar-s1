const alertApiService = require('../services/alert.api.service');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * Controller to handle alert-related HTTP requests
 */
class AlertController {
  /**
   * List all active alerts
   */
  async listActiveAlerts(req, res) {
    try {
      const alerts = await alertApiService.getActiveAlerts();
      return successResponse(res, 'Active alerts fetched successfully', alerts);
    } catch (error) {
      console.error('List Alerts Error:', error);
      return errorResponse(res, 'Internal Server Error');
    }
  }

  /**
   * Get alert by ID
   */
  async getAlert(req, res) {
    try {
      const { id } = req.params;
      const alert = await alertApiService.getAlertById(id);

      if (!alert) {
        return errorResponse(res, 'Alert not found', 404);
      }

      return successResponse(res, 'Alert fetched successfully', alert);
    } catch (error) {
      console.error('Get Alert Error:', error);
      return errorResponse(res, 'Internal Server Error');
    }
  }

  /**
   * Acknowledge alert
   */
  async acknowledge(req, res) {
    try {
      const { id } = req.params;
      const alert = await alertApiService.acknowledgeAlert(id);

      if (!alert) {
        return errorResponse(res, 'Alert not found or already acknowledged', 404);
      }

      console.log(`Alert ${id} acknowledged successfully`);
      
      // Emit WebSocket event for real-time updates
      const broadcaster = require('../websocket/broadcaster');
      if (broadcaster.io) {
        const payload = {
          event: 'alert_acknowledged',
          alert_id: id,
          acknowledged_at: alert.acknowledged_at,
          vehicle_id: alert.vehicle_id,
          timestamp: Date.now()
        };
        
        // Broadcast to all clients
        broadcaster.io.emit('alert_acknowledged', payload);
        
        // Also broadcast to vehicle-specific subscribers
        const subscriptionManager = require('../websocket/subscriptions');
        const subscribers = subscriptionManager.getSubscribers(alert.vehicle_id);
        subscribers.forEach(socketId => {
          broadcaster.io.to(socketId).emit('alert_acknowledged', payload);
        });
      }
      
      return successResponse(res, 'Alert acknowledged successfully', alert);
    } catch (error) {
      console.error('Acknowledge Error:', error);
      return errorResponse(res, 'Internal Server Error');
    }
  }

  /**
   * Get alert statistics for monitoring
   */
  async getAlertStats(req, res) {
    try {
      const stats = await alertApiService.getAlertStats();
      return successResponse(res, 'Alert statistics fetched successfully', stats);
    } catch (error) {
      console.error('Get Alert Stats Error:', error);
      return errorResponse(res, 'Internal Server Error');
    }
  }

  /**
   * Get active alert counts per vehicle
   * Query params: vehicle_id, severity, time_window (minutes)
   */
  async getAlertCountsPerVehicle(req, res) {
    try {
      const { vehicle_id, severity, time_window } = req.query;
      
      const filters = {};
      if (vehicle_id) filters.vehicle_id = vehicle_id;
      if (severity) filters.severity = severity;
      if (time_window) filters.time_window_minutes = parseInt(time_window);

      const counts = await alertApiService.getAlertCountsPerVehicle(filters);
      return successResponse(res, 'Alert counts per vehicle fetched successfully', counts);
    } catch (error) {
      console.error('Get Alert Counts Per Vehicle Error:', error);
      return errorResponse(res, 'Internal Server Error');
    }
  }

  /**
   * Get active alert counts grouped by severity
   * Query params: vehicle_id, time_window (minutes)
   */
  async getAlertCountsBySeverity(req, res) {
    try {
      const { vehicle_id, time_window } = req.query;
      
      const filters = {};
      if (vehicle_id) filters.vehicle_id = vehicle_id;
      if (time_window) filters.time_window_minutes = parseInt(time_window);

      const counts = await alertApiService.getAlertCountsBySeverity(filters);
      return successResponse(res, 'Alert counts by severity fetched successfully', counts);
    } catch (error) {
      console.error('Get Alert Counts By Severity Error:', error);
      return errorResponse(res, 'Internal Server Error');
    }
  }

  /**
   * Get active alert counts grouped by alert_type
   * Query params: vehicle_id, severity, time_window (minutes)
   */
  async getAlertCountsByType(req, res) {
    try {
      const { vehicle_id, severity, time_window } = req.query;
      
      const filters = {};
      if (vehicle_id) filters.vehicle_id = vehicle_id;
      if (severity) filters.severity = severity;
      if (time_window) filters.time_window_minutes = parseInt(time_window);

      const counts = await alertApiService.getAlertCountsByType(filters);
      return successResponse(res, 'Alert counts by type fetched successfully', counts);
    } catch (error) {
      console.error('Get Alert Counts By Type Error:', error);
      return errorResponse(res, 'Internal Server Error');
    }
  }

  /**
   * Get lightweight alert summary for UI aggregation
   */
  async getAlertSummary(req, res) {
    try {
      const summary = await alertApiService.getAlertSummary();
      return successResponse(res, 'Alert summary fetched successfully', summary);
    } catch (error) {
      console.error('Get Alert Summary Error:', error);
      return errorResponse(res, 'Internal Server Error');
    }
  }

  /**
   * Get resolved alerts for a specific vehicle
   * GET /api/v1/alerts/vehicle/:vehicleId/resolved
   */
  async getResolvedAlertsByVehicle(req, res) {
    try {
      const { vehicleId } = req.params;
      const db = require('../db');
      
      // Validate vehicle exists
      const vehicleExists = await db.query(
        'SELECT 1 FROM vehicles WHERE vehicle_id = $1', 
        [vehicleId]
      );
      
      if (vehicleExists.rows.length === 0) {
        return errorResponse(res, 'Vehicle not found', 404);
      }

      // Get resolved alerts for this vehicle (last 24 hours)
      const query = `
        SELECT 
          alert_id,
          vehicle_id,
          alert_type,
          severity,
          message,
          data,
          created_at,
          acknowledged_at,
          resolved_at
        FROM alerts
        WHERE vehicle_id = $1 
          AND resolved_at IS NOT NULL
          AND resolved_at >= NOW() - INTERVAL '24 hours'
        ORDER BY resolved_at DESC
        LIMIT 50
      `;
      
      const { rows } = await db.query(query, [vehicleId]);
      
      return successResponse(res, `Retrieved ${rows.length} resolved alerts for vehicle ${vehicleId}`, rows);
    } catch (error) {
      console.error('Get Resolved Alerts Error:', error);
      return errorResponse(res, 'Internal Server Error');
    }
  }

  /**
   * Get alerts per minute time series data
   * GET /api/v1/alerts/stats/alerts-per-minute
   */
  async getAlertsPerMinute(req, res) {
    try {
      const { time_window } = req.query;
      const timeWindowMinutes = time_window ? parseInt(time_window) : 30;
      
      const data = await alertApiService.getAlertsPerMinute(timeWindowMinutes);
      return successResponse(res, 'Alerts per minute data fetched successfully', data);
    } catch (error) {
      console.error('Get Alerts Per Minute Error:', error);
      return errorResponse(res, 'Internal Server Error');
    }
  }

  /**
   * Get vehicle health distribution
   * GET /api/v1/alerts/stats/vehicle-health
   */
  async getVehicleHealthDistribution(req, res) {
    try {
      const data = await alertApiService.getVehicleHealthDistribution();
      return successResponse(res, 'Vehicle health distribution fetched successfully', data);
    } catch (error) {
      console.error('Get Vehicle Health Distribution Error:', error);
      return errorResponse(res, 'Internal Server Error');
    }
  }

  /**
   * Get top problem vehicles
   * GET /api/v1/alerts/stats/top-problem-vehicles
   */
  async getTopProblemVehicles(req, res) {
    try {
      const { limit, time_window } = req.query;
      const limitCount = limit ? parseInt(limit) : 10;
      const timeWindowMinutes = time_window ? parseInt(time_window) : 10;
      
      const data = await alertApiService.getTopProblemVehicles(limitCount, timeWindowMinutes);
      return successResponse(res, 'Top problem vehicles fetched successfully', data);
    } catch (error) {
      console.error('Get Top Problem Vehicles Error:', error);
      return errorResponse(res, 'Internal Server Error');
    }
  }
}

module.exports = new AlertController();
