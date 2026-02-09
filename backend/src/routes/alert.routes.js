const express = require('express');
const alertController = require('../controllers/alert.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// List all active alerts (Authenticated users)
router.get('/', authenticate, (req, res) => alertController.listActiveAlerts(req, res));

// Get alert statistics for monitoring (Authenticated users)
router.get('/stats/monitoring', authenticate, (req, res) => alertController.getAlertStats(req, res));

// Get lightweight alert summary for UI aggregation (Authenticated users)
router.get('/stats/summary', authenticate, (req, res) => alertController.getAlertSummary(req, res));

// Get alerts per minute time series
router.get('/stats/alerts-per-minute', authenticate, (req, res) => alertController.getAlertsPerMinute(req, res));

// Get vehicle health distribution
router.get('/stats/vehicle-health', authenticate, (req, res) => alertController.getVehicleHealthDistribution(req, res));

// Get top problem vehicles
router.get('/stats/top-problem-vehicles', authenticate, (req, res) => alertController.getTopProblemVehicles(req, res));

// Get active alert counts per vehicle (Authenticated users)
// Query params: vehicle_id, severity, time_window
router.get('/stats/per-vehicle', authenticate, (req, res) => alertController.getAlertCountsPerVehicle(req, res));

// Get active alert counts grouped by severity (Authenticated users)
// Query params: vehicle_id, time_window
router.get('/stats/by-severity', authenticate, (req, res) => alertController.getAlertCountsBySeverity(req, res));

// Get active alert counts grouped by alert_type (Authenticated users)
// Query params: vehicle_id, severity, time_window
router.get('/stats/by-type', authenticate, (req, res) => alertController.getAlertCountsByType(req, res));

// Get resolved alerts for a specific vehicle
router.get('/vehicle/:vehicleId/resolved', authenticate, (req, res) => alertController.getResolvedAlertsByVehicle(req, res));

// Get alert details by ID (Authenticated users)
router.get('/:id', authenticate, (req, res) => alertController.getAlert(req, res));

// Acknowledge alert (Admin only)
router.post('/:id/acknowledge', authenticate, authorize(['admin']), (req, res) => alertController.acknowledge(req, res));

module.exports = router;
