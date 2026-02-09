const subscriptionManager = require('./subscriptions');
const alertApiService = require('../services/alert.api.service');

/**
 * Broadcaster for WebSocket Events with Throttling logic
 * Includes periodic alert summary broadcasts for UI aggregation
 */
class Broadcaster {
  constructor() {
    this.io = null;
    // Map<vehicle_id, last_broadcast_timestamp> for throttling
    this.lastBroadcastTimes = new Map();
    this.THROTTLE_MS = 500; // 2 updates per second
    
    // Summary broadcast configuration
    this.summaryInterval = null;
    this.SUMMARY_BROADCAST_INTERVAL_MS = 3000; // 3 seconds
    this.lastSummary = null;
  }

  /**
   * Initialize with socket.io instance
   * Starts periodic summary broadcasts
   */
  init(io) {
    this.io = io;
    this.startSummaryBroadcasts();
  }

  /**
   * Start periodic lightweight summary broadcasts
   * Emits aggregated alert data every 3 seconds to all connected clients
   */
  startSummaryBroadcasts() {
    // Clear any existing interval
    if (this.summaryInterval) {
      clearInterval(this.summaryInterval);
    }

    this.summaryInterval = setInterval(async () => {
      await this.broadcastAlertSummary();
    }, this.SUMMARY_BROADCAST_INTERVAL_MS);

    console.log('[WebSocket] Alert summary broadcasts started (every 3s)');
  }

  /**
   * Stop periodic summary broadcasts
   */
  stopSummaryBroadcasts() {
    if (this.summaryInterval) {
      clearInterval(this.summaryInterval);
      this.summaryInterval = null;
      console.log('[WebSocket] Alert summary broadcasts stopped');
    }
  }

  /**
   * Broadcast lightweight alert summary to all connected clients
   */
  async broadcastAlertSummary() {
    if (!this.io) return;

    try {
      const summary = await alertApiService.getAlertSummary();
      
      // Only broadcast if summary has changed
      if (JSON.stringify(summary) !== JSON.stringify(this.lastSummary)) {
        this.lastSummary = summary;
        
        const payload = {
          event: 'alert_summary',
          data: summary,
          timestamp: Date.now()
        };

        // Broadcast to all connected clients
        this.io.emit('alert_summary', payload);
      }
    } catch (error) {
      console.error('[WebSocket] Error broadcasting alert summary:', error.message);
    }
  }

  /**
   * Broadcast telemetry update to subscribed clients with throttling
   */
  broadcastTelemetry(vehicleId, telemetry) {
    if (!this.io) return;

    const now = Date.now();
    const lastTime = this.lastBroadcastTimes.get(vehicleId) || 0;

    // Throttling logic: Max 2 updates/sec per vehicle
    if (now - lastTime < this.THROTTLE_MS) {
      return;
    }

    const subscribers = subscriptionManager.getSubscribers(vehicleId);
    if (subscribers.length === 0) return;

    const payload = {
      event: 'telemetry_update',
      vehicle_id: vehicleId,
      data: telemetry.data,
      timestamp: telemetry.timestamp
    };

    subscribers.forEach(socketId => {
      this.io.to(socketId).emit('telemetry_update', payload);
    });

    this.lastBroadcastTimes.set(vehicleId, now);
  }

  /**
   * Broadcast vehicle status changes (online/offline) - No throttling for status
   */
  broadcastStatus(vehicleId, status) {
    if (!this.io) return;

    const subscribers = subscriptionManager.getSubscribers(vehicleId);
    if (subscribers.length === 0) return;

    const payload = {
      event: 'vehicle_status',
      vehicle_id: vehicleId,
      status: status
    };

    subscribers.forEach(socketId => {
      this.io.to(socketId).emit('vehicle_status', payload);
    });
  }
}

module.exports = new Broadcaster();
