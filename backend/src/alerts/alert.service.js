const db = require('../db');
const broadcaster = require('../websocket/broadcaster');
const alertStateManager = require('../services/alert.state.manager');

/**
 * Service to handle alert-related database operations and real-time triggers
 * Optimized for high-scale alert generation with in-memory deduplication cache
 */
class AlertService {
  constructor() {
    // In-memory cache for active alerts to reduce DB load
    // Structure: Map<vehicleId_alertType, { alertId, createdAt }>
    this.activeAlertsCache = new Map();

    // Cache TTL: 5 minutes (matches the deduplication window in getExistingAlert)
    this.CACHE_TTL_MS = 5 * 60 * 1000;

    // Statistics for monitoring
    this.stats = {
      cacheHits: 0,
      cacheMisses: 0,
      alertsCreated: 0,
      alertsResolved: 0
    };

    // Periodic cache cleanup and stats logging
    setInterval(() => this.cleanupCache(), 60000); // Every minute
    setInterval(() => this.logStats(), 60000); // Every minute
  }

  /**
   * Generate cache key for vehicle+alertType combination
   */
  getCacheKey(vehicleId, alertType) {
    return `${vehicleId}_${alertType}`;
  }

  /**
   * Check if an alert exists in cache (faster than DB query)
   */
  getCachedAlert(vehicleId, alertType) {
    const key = this.getCacheKey(vehicleId, alertType);
    const cached = this.activeAlertsCache.get(key);

    if (cached) {
      // Check if cache entry is still valid (within TTL)
      const age = Date.now() - cached.createdAt;
      if (age < this.CACHE_TTL_MS) {
        this.stats.cacheHits++;
        return cached;
      } else {
        // Expired - remove from cache
        this.activeAlertsCache.delete(key);
      }
    }

    this.stats.cacheMisses++;
    return null;
  }

  /**
   * Add alert to cache
   */
  setCachedAlert(vehicleId, alertType, alertId) {
    const key = this.getCacheKey(vehicleId, alertType);
    this.activeAlertsCache.set(key, {
      alertId,
      createdAt: Date.now()
    });
  }

  /**
   * Remove alert from cache (when resolved)
   */
  removeCachedAlert(vehicleId, alertType) {
    const key = this.getCacheKey(vehicleId, alertType);
    this.activeAlertsCache.delete(key);
  }

  /**
   * Clean up expired cache entries
   */
  cleanupCache() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, value] of this.activeAlertsCache.entries()) {
      if (now - value.createdAt > this.CACHE_TTL_MS) {
        this.activeAlertsCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[AlertCache] Cleaned up ${cleaned} expired entries. Current size: ${this.activeAlertsCache.size}`);
    }
  }

  /**
   * Log cache statistics
   */
  logStats() {
    const total = this.stats.cacheHits + this.stats.cacheMisses;
    const hitRate = total > 0 ? ((this.stats.cacheHits / total) * 100).toFixed(1) : 0;
    console.log(`[AlertService] Cache: ${this.activeAlertsCache.size} entries | Hit rate: ${hitRate}% (${this.stats.cacheHits}/${total}) | Created: ${this.stats.alertsCreated} | Resolved: ${this.stats.alertsResolved}`);
  }

  /**
   * Create a new alert and broadcast it
   */
  async createAlert(vehicleId, rule, data) {
    const query = `
      INSERT INTO alerts (vehicle_id, alert_type, severity, message, data)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const values = [
      vehicleId,
      rule.type,
      rule.severity,
      rule.message(data),
      JSON.stringify(data)
    ];

    const { rows } = await db.query(query, values);
    const alert = rows[0];

    // Process through state manager for human factors compliance
    const stateResult = alertStateManager.processAlert({
      vehicle_id: vehicleId,
      alert_type: rule.type,
      severity: rule.severity,
      message: rule.message(data)
    });

    // Add to cache for fast deduplication
    this.setCachedAlert(vehicleId, rule.type, alert.alert_id);
    this.stats.alertsCreated++;

    // Broadcast via WebSocket - only if state manager says to notify
    if (stateResult.shouldNotify) {
      this.broadcastAlert(alert, stateResult.visualImpact);
    }
    
    return alert;
  }

  /**
   * Check for an unresolved alert of the same type in the last 5 minutes
   * Uses in-memory cache first, falls back to DB query
   */
  async getExistingAlert(vehicleId, alertType) {
    // First check cache (fast path)
    const cached = this.getCachedAlert(vehicleId, alertType);
    if (cached) {
      return { alert_id: cached.alertId };
    }

    // Cache miss - check database (slow path)
    const query = `
      SELECT * FROM alerts
      WHERE vehicle_id = $1
      AND alert_type = $2
      AND resolved_at IS NULL
      AND created_at >= NOW() - INTERVAL '5 minutes'
      LIMIT 1
    `;
    const { rows } = await db.query(query, [vehicleId, alertType]);

    // If found in DB, add to cache for future lookups
    if (rows[0]) {
      this.setCachedAlert(vehicleId, alertType, rows[0].alert_id);
    }

    return rows[0];
  }

  /**
   * Resolve an existing alert
   * Also removes from cache
   */
  async resolveAlert(vehicleId, alertType) {
    const query = `
      UPDATE alerts
      SET resolved_at = NOW()
      WHERE vehicle_id = $1
      AND alert_type = $2
      AND resolved_at IS NULL
    `;
    const result = await db.query(query, [vehicleId, alertType]);

    // Remove from cache regardless of DB result
    this.removeCachedAlert(vehicleId, alertType);

    if (result.rowCount > 0) {
      this.stats.alertsResolved++;
    }
  }

  /**
   * Broadcast alert via Socket.io with visual impact metadata
   */
  broadcastAlert(alert, visualImpact = null) {
    // broadcaster is already initialized with io in Day 3
    if (broadcaster.io) {
      const payload = {
        event: 'alert_state_update',
        alert: {
          alert_id: alert.alert_id,
          vehicle_id: alert.vehicle_id,
          severity: alert.severity,
          message: alert.message,
          created_at: alert.created_at
        },
        visualImpact // Include human factors metadata
      };
      
      // Broadcast to all clients (or just those subscribed to the vehicle)
      // Following Phase 2 requirement: Clients subscribe to vehicles
      const subscriptionManager = require('../websocket/subscriptions');
      const subscribers = subscriptionManager.getSubscribers(alert.vehicle_id);
      
      subscribers.forEach(socketId => {
        broadcaster.io.to(socketId).emit('alert_state_update', payload);
      });
    }
  }
}

module.exports = new AlertService();
