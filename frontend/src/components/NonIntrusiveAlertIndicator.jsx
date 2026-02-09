import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertCircle, AlertTriangle, Info, 
  TrendingUp, TrendingDown, Minus,
  Battery, Thermometer, Zap, Activity
} from 'lucide-react';
import { cn } from '../utils/ui-utils';

/**
 * NonIntrusiveAlertIndicator - Human Factors Compliant Alert Display
 * 
 * Implements UX Rules:
 * 1. Alerts are states, not events - Shows aggregated state view
 * 2. Repeated alerts do not re-notify visually - Throttled updates
 * 3. Visual emphasis only when severity escalates or new critical vehicles
 * 4. Uses: Color intensity, badges, counters, trend indicators
 *    NOT: Toast spam, sound spam, flashing UI
 */

const NonIntrusiveAlertIndicator = ({ 
  alerts = [], 
  vehicles = {}, 
  className = "" 
}) => {
  const [alertStates, setAlertStates] = useState({});
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  // Process alerts into human factors compliant state representation
  const processedState = useMemo(() => {
    const state = {
      vehiclesWithAlerts: new Set(),
      severityCounts: { CRITICAL: 0, WARNING: 0, INFO: 0 },
      alertTypeCounts: {},
      escalatedVehicles: new Set(),
      trendingIssues: []
    };

    // Group alerts by vehicle and type
    const vehicleAlerts = {};
    alerts.forEach(alert => {
      if (!alert.resolved_at) {
        const vid = alert.vehicle_id;
        if (!vehicleAlerts[vid]) vehicleAlerts[vid] = [];
        vehicleAlerts[vid].push(alert);
        state.vehiclesWithAlerts.add(vid);
      }
    });

    // Process each vehicle's alerts
    Object.entries(vehicleAlerts).forEach(([vehicleId, vehicleAlertList]) => {
      let maxSeverity = 'INFO';
      const typeCounts = {};
      
      vehicleAlertList.forEach(alert => {
        state.severityCounts[alert.severity]++;
        typeCounts[alert.alert_type] = (typeCounts[alert.alert_type] || 0) + 1;
        
        if (alert.severity === 'CRITICAL') maxSeverity = 'CRITICAL';
        else if (alert.severity === 'WARNING' && maxSeverity !== 'CRITICAL') {
          maxSeverity = 'WARNING';
        }
      });

      // Determine if this vehicle just became critical (escalation)
      const wasCritical = alertStates[vehicleId]?.maxSeverity === 'CRITICAL';
      if (maxSeverity === 'CRITICAL' && !wasCritical) {
        state.escalatedVehicles.add(vehicleId);
      }

      // Update alert type counts
      Object.entries(typeCounts).forEach(([type, count]) => {
        state.alertTypeCounts[type] = (state.alertTypeCounts[type] || 0) + count;
      });
    });

    // Identify trending issues (high frequency alerts)
    state.trendingIssues = Object.entries(state.alertTypeCounts)
      .filter(([type, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    return state;
  }, [alerts, alertStates]);

  // Update state tracking (throttled)
  useEffect(() => {
    const now = Date.now();
    if (now - lastUpdate > 2000) { // 2 second throttle
      setAlertStates(prev => {
        const newState = {};
        alerts.forEach(alert => {
          if (!alert.resolved_at) {
            const key = `${alert.vehicle_id}-${alert.alert_type}`;
            newState[key] = {
              severity: alert.severity,
              count: (prev[key]?.count || 0) + 1,
              lastUpdate: now
            };
          }
        });
        return { ...prev, ...newState };
      });
      setLastUpdate(now);
    }
  }, [alerts, lastUpdate]);

  // Get visual configuration based on severity and state
  const getVisualConfig = (severity, isEscalated, alertCount) => {
    const baseConfig = {
      CRITICAL: {
        color: 'text-ev-red',
        bg: 'bg-ev-red/10',
        border: 'border-ev-red/30',
        intensity: isEscalated ? 1.0 : Math.min(0.7 + (alertCount * 0.05), 1.0)
      },
      WARNING: {
        color: 'text-ev-yellow',
        bg: 'bg-ev-yellow/10',
        border: 'border-ev-yellow/30',
        intensity: Math.min(0.5 + (alertCount * 0.03), 0.8)
      },
      INFO: {
        color: 'text-ev-blue',
        bg: 'bg-ev-blue/10',
        border: 'border-ev-blue/30',
        intensity: Math.min(0.3 + (alertCount * 0.02), 0.6)
      }
    }[severity] || baseConfig.INFO;

    return {
      ...baseConfig,
      pulseAnimation: isEscalated ? 'animate-pulse-fast' : '',
      glowEffect: isEscalated ? 'shadow-[0_0_15px_rgba(255,77,77,0.3)]' : ''
    };
  };

  // Get icon for alert type
  const getAlertIcon = (alertType) => {
    if (alertType?.includes('battery')) return Battery;
    if (alertType?.includes('temp')) return Thermometer;
    if (alertType?.includes('voltage') || alertType?.includes('current')) return Zap;
    return AlertCircle;
  };

  // Get trend icon
  const getTrendIcon = (count) => {
    if (count > 10) return <TrendingUp size={12} className="text-ev-red" />;
    if (count > 5) return <Activity size={12} className="text-ev-yellow" />;
    return <Minus size={12} className="text-slate-500" />;
  };

  const totalAlerts = Object.values(processedState.severityCounts).reduce((a, b) => a + b, 0);
  const criticalVehicles = processedState.severityCounts.CRITICAL;
  const hasEscalations = processedState.escalatedVehicles.size > 0;

  if (totalAlerts === 0) {
    return (
      <div className={cn("glass-panel p-4 border border-ev-green/20 bg-ev-green/5", className)}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-ev-green animate-pulse" />
          <span className="text-[10px] font-mono text-ev-green uppercase tracking-widest">
            System Nominal
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("glass-panel p-4 border space-y-3", className)}>
      {/* Summary Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <AlertTriangle 
              size={16} 
              className={cn(
                criticalVehicles > 0 ? "text-ev-red" : "text-ev-yellow",
                hasEscalations && "animate-pulse"
              )} 
            />
            {hasEscalations && (
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-ev-red rounded-full animate-ping" />
            )}
          </div>
          <div>
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
              Fleet Alert Status
            </h3>
            <div className="flex items-center gap-2 mt-1">
              {criticalVehicles > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-ev-red/20 text-ev-red">
                  {criticalVehicles} CRITICAL
                </span>
              )}
              {processedState.severityCounts.WARNING > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-ev-yellow/20 text-ev-yellow">
                  {processedState.severityCounts.WARNING} WARN
                </span>
              )}
              <span className="text-[9px] text-slate-500">
                {processedState.vehiclesWithAlerts.size} vehicles affected
              </span>
            </div>
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-[10px] font-mono text-slate-500">
            Total: {totalAlerts}
          </div>
          <div className="text-[8px] text-slate-600 uppercase tracking-widest">
            Aggregated View
          </div>
        </div>
      </div>

      {/* Alert Type Breakdown */}
      {Object.entries(processedState.alertTypeCounts).length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
            Alert Types
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(processedState.alertTypeCounts)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 4)
              .map(([type, count]) => {
                const Icon = getAlertIcon(type);
                return (
                  <div 
                    key={type}
                    className="flex items-center gap-2 p-2 rounded bg-white/5 border border-white/5"
                  >
                    <Icon size={12} className="text-slate-400" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[9px] font-mono text-slate-300 uppercase truncate">
                        {type.replace('_', ' ')}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-black text-white">{count}</span>
                        {getTrendIcon(count)}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Escalated Vehicles Highlight */}
      {processedState.escalatedVehicles.size > 0 && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="p-2 rounded border border-ev-red/30 bg-ev-red/5"
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={12} className="text-ev-red animate-pulse" />
            <span className="text-[9px] font-black text-ev-red uppercase">
              New Critical Vehicle{processedState.escalatedVehicles.size > 1 ? 's' : ''}
            </span>
          </div>
          <div className="text-[8px] text-slate-400 mt-1 flex flex-wrap gap-1">
            {Array.from(processedState.escalatedVehicles).slice(0, 3).map(vehicleId => (
              <span key={vehicleId} className="bg-ev-red/20 px-1 py-0.5 rounded">
                {vehicleId}
              </span>
            ))}
            {processedState.escalatedVehicles.size > 3 && (
              <span className="text-slate-500">
                +{processedState.escalatedVehicles.size - 3} more
              </span>
            )}
          </div>
        </motion.div>
      )}

      {/* Trending Issues */}
      {processedState.trendingIssues.length > 0 && (
        <div className="pt-2 border-t border-white/5">
          <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">
            Trending Issues
          </h4>
          <div className="space-y-1">
            {processedState.trendingIssues.map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="text-[9px] text-slate-300">
                  {type.replace('_', ' ').toUpperCase()}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-mono text-slate-400">{count}</span>
                  {getTrendIcon(count)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NonIntrusiveAlertIndicator;