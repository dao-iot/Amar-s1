/**
 * AlertStateManager - Human Factors Alert Fatigue Prevention
 * 
 * Core Principles:
 * 1. Alerts are STATES, not events
 * 2. Repeated alerts do not re-notify visually
 * 3. Visual emphasis only when:
 *    - Severity escalates (WARNING → CRITICAL)
 *    - New vehicle becomes critical
 * 4. Use: Color intensity, badges, counters, trend indicators
 *    NOT: Toast spam, sound spam, flashing UI
 */

class AlertStateManager {
  constructor() {
    // Track current state of each vehicle's alerts
    // Map<vehicle_id, Map<alert_type, {severity, first_seen, last_updated, count}>>
    this.vehicleAlertStates = new Map();
    
    // Track escalated vehicles (those that became critical)
    this.escalatedVehicles = new Set();
    
    // Track last visual update time to prevent excessive re-rendering
    this.lastVisualUpdate = new Map();
    this.VISUAL_UPDATE_THROTTLE_MS = 2000; // 2 seconds minimum between visual updates
    
    // Alert type categories for grouping
    this.alertCategories = {
      battery: ['low_battery', 'critical_battery'],
      thermal: ['overheating', 'critical_temp'],
      electrical: ['voltage_anomaly', 'current_spike'],
      system: ['offline', 'communication_error']
    };
  }

  /**
   * Process incoming alert and determine if visual notification is needed
   * @param {Object} alert - New alert from evaluator
   * @returns {Object} { shouldNotify: boolean, stateChange: string, visualImpact: Object }
   */
  processAlert(alert) {
    const { vehicle_id, alert_type, severity } = alert;
    const now = Date.now();
    
    // Initialize vehicle state if needed
    if (!this.vehicleAlertStates.has(vehicle_id)) {
      this.vehicleAlertStates.set(vehicle_id, new Map());
    }
    
    const vehicleStates = this.vehicleAlertStates.get(vehicle_id);
    const existingState = vehicleStates.get(alert_type);
    
    // Determine if this is a state change that requires visual attention
    const stateChange = this.analyzeStateChange(existingState, alert);
    
    // Update state tracking
    const newState = {
      severity,
      first_seen: existingState?.first_seen || now,
      last_updated: now,
      count: (existingState?.count || 0) + 1,
      last_notified_severity: existingState?.last_notified_severity || null
    };
    
    vehicleStates.set(alert_type, newState);
    
    // Determine visual impact object for UI
    const visualImpact = this.calculateVisualImpact(vehicle_id, alert_type, newState, stateChange);
    
    // Decide if visual notification is warranted
    const shouldNotify = this.shouldTriggerVisualNotification(vehicle_id, alert_type, stateChange, now);
    
    if (shouldNotify) {
      // Mark that we've notified for this state
      newState.last_notified_severity = severity;
      this.lastVisualUpdate.set(`${vehicle_id}-${alert_type}`, now);
    }
    
    return {
      shouldNotify,
      stateChange,
      visualImpact,
      alertCount: newState.count
    };
  }

  /**
   * Analyze if alert represents a meaningful state change
   */
  analyzeStateChange(existingState, newAlert) {
    if (!existingState) {
      return 'new_alert';
    }
    
    const { severity: newSeverity } = newAlert;
    const { severity: oldSeverity, count } = existingState;
    
    // Severity escalation detection
    const severityRank = { INFO: 1, WARNING: 2, CRITICAL: 3 };
    if (severityRank[newSeverity] > severityRank[oldSeverity]) {
      return 'severity_escalation';
    }
    
    // De-escalation
    if (severityRank[newSeverity] < severityRank[oldSeverity]) {
      return 'severity_deescalation';
    }
    
    // High frequency detection (10+ occurrences)
    if (count >= 10 && count % 10 === 0) {
      return 'persistent_issue';
    }
    
    return 'repeated_alert';
  }

  /**
   * Calculate visual impact for UI rendering
   */
  calculateVisualImpact(vehicleId, alertType, state, stateChange) {
    const { severity, count, first_seen } = state;
    const durationMs = Date.now() - first_seen;
    
    // Color intensity based on severity and duration
    const getColorIntensity = () => {
      const baseIntensity = { INFO: 0.3, WARNING: 0.6, CRITICAL: 1.0 }[severity];
      const durationFactor = Math.min(durationMs / 300000, 1); // Cap at 5 minutes
      return Math.min(baseIntensity + (durationFactor * 0.4), 1.0);
    };
    
    // Badge type based on state change
    const getBadgeType = () => {
      switch (stateChange) {
        case 'severity_escalation': return 'escalation';
        case 'new_alert': return 'new';
        case 'persistent_issue': return 'persistent';
        default: return 'existing';
      }
    };
    
    // Trend indicator
    const getTrend = () => {
      if (count > 5 && durationMs < 60000) return 'spiking'; // 5+ in 1 minute
      if (count > 10) return 'persistent';
      if (durationMs > 300000) return 'lingering'; // 5+ minutes
      return 'stable';
    };
    
    return {
      vehicleId,
      alertType,
      severity,
      count,
      colorIntensity: getColorIntensity(),
      badgeType: getBadgeType(),
      trend: getTrend(),
      durationFormatted: this.formatDuration(durationMs),
      isEscalated: stateChange === 'severity_escalation',
      isNewCritical: severity === 'CRITICAL' && stateChange === 'new_alert'
    };
  }

  /**
   * Determine if visual notification should be triggered
   */
  shouldTriggerVisualNotification(vehicleId, alertType, stateChange, timestamp) {
    const lastUpdate = this.lastVisualUpdate.get(`${vehicleId}-${alertType}`) || 0;
    
    // Throttle visual updates
    if (timestamp - lastUpdate < this.VISUAL_UPDATE_THROTTLE_MS) {
      return false;
    }
    
    // Always notify on these state changes
    if (['new_alert', 'severity_escalation'].includes(stateChange)) {
      return true;
    }
    
    // Notify on persistent issues (every 10 occurrences)
    if (stateChange === 'persistent_issue') {
      return true;
    }
    
    // For repeated alerts, only notify if it's been quiet for a while
    if (stateChange === 'repeated_alert') {
      return timestamp - lastUpdate > 30000; // 30 seconds
    }
    
    return false;
  }

  /**
   * Mark vehicle as escalated (became critical)
   */
  markVehicleEscalated(vehicleId) {
    this.escalatedVehicles.add(vehicleId);
  }

  /**
   * Check if vehicle is newly critical (for special highlighting)
   */
  isNewlyCriticalVehicle(vehicleId, alerts) {
    const wasEscalated = this.escalatedVehicles.has(vehicleId);
    const hasCritical = alerts.some(a => a.severity === 'CRITICAL' && !a.resolved_at);
    
    if (hasCritical && !wasEscalated) {
      this.markVehicleEscalated(vehicleId);
      return true;
    }
    
    return false;
  }

  /**
   * Get aggregated state summary for UI
   */
  getStateSummary() {
    const summary = {
      totalVehicles: this.vehicleAlertStates.size,
      criticalVehicles: 0,
      warningVehicles: 0,
      escalatedVehicles: Array.from(this.escalatedVehicles),
      alertCounts: {},
      severityDistribution: { CRITICAL: 0, WARNING: 0, INFO: 0 }
    };
    
    for (const [vehicleId, alertStates] of this.vehicleAlertStates.entries()) {
      let vehicleMaxSeverity = 'INFO';
      let hasCritical = false;
      let hasWarning = false;
      
      for (const [alertType, state] of alertStates.entries()) {
        summary.severityDistribution[state.severity]++;
        
        if (state.severity === 'CRITICAL') {
          hasCritical = true;
          vehicleMaxSeverity = 'CRITICAL';
        } else if (state.severity === 'WARNING' && vehicleMaxSeverity !== 'CRITICAL') {
          hasWarning = true;
          vehicleMaxSeverity = 'WARNING';
        }
        
        const key = `${alertType}_${state.severity}`;
        summary.alertCounts[key] = (summary.alertCounts[key] || 0) + state.count;
      }
      
      if (hasCritical) summary.criticalVehicles++;
      else if (hasWarning) summary.warningVehicles++;
    }
    
    return summary;
  }

  /**
   * Format duration for display
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  }

  /**
   * Clean up old states (memory management)
   */
  cleanup() {
    const now = Date.now();
    const EXPIRY_TIME = 3600000; // 1 hour
    
    for (const [vehicleId, alertStates] of this.vehicleAlertStates.entries()) {
      for (const [alertType, state] of alertStates.entries()) {
        if (now - state.last_updated > EXPIRY_TIME) {
          alertStates.delete(alertType);
        }
      }
      
      if (alertStates.size === 0) {
        this.vehicleAlertStates.delete(vehicleId);
        this.escalatedVehicles.delete(vehicleId);
      }
    }
  }
}

module.exports = new AlertStateManager();