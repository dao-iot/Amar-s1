import React, { useState, useMemo } from 'react';
import axios from 'axios';
import { formatRelativeTime } from '../utils/formatters';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, AlertTriangle, Info, CheckCircle2, ChevronRight, X, ShieldAlert, Battery, Thermometer, Zap } from 'lucide-react';
import { cn } from '../utils/ui-utils';

/**
 * VehicleAlertPanel - Vehicle-Specific Alert View
 * 
 * UX PRINCIPLE: Alerts are VEHICLE-SPECIFIC, not globally spammed
 * - Shows only alerts for the selected vehicle
 * - Displays in vehicle detail context
 * - Clicking a vehicle reveals its alerts
 */
const VehicleAlertPanel = ({ vehicleId, alerts, isAdmin, onAlertAck }) => {
  const [acking, setAcking] = useState(null);
  const [expandedAlert, setExpandedAlert] = useState(null);

  // Filter alerts for this vehicle only
  const vehicleAlerts = useMemo(() => {
    return alerts
      .filter(a => a.vehicle_id === vehicleId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [alerts, vehicleId]);

  // Group alerts by severity
  const groupedAlerts = useMemo(() => {
    return {
      critical: vehicleAlerts.filter(a => a.severity === 'CRITICAL'),
      warning: vehicleAlerts.filter(a => a.severity === 'WARNING'),
      info: vehicleAlerts.filter(a => a.severity === 'INFO')
    };
  }, [vehicleAlerts]);

  const handleAcknowledge = async (alertId) => {
    setAcking(alertId);
    try {
      const response = await axios.post(`/api/v1/alerts/${alertId}/acknowledge`);
      // Only update local state on successful acknowledgment
      if (response.data.status === 'success') {
        onAlertAck(alertId);
      }
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
      alert('Failed to acknowledge alert. Please try again.');
    } finally {
      setAcking(null);
    }
  };

  // Get icon for alert type
  const getAlertIcon = (alertType) => {
    if (alertType?.includes('battery') || alertType?.includes('soc')) return Battery;
    if (alertType?.includes('temp') || alertType?.includes('heat')) return Thermometer;
    if (alertType?.includes('voltage') || alertType?.includes('current')) return Zap;
    return ShieldAlert;
  };

  if (!vehicleId) return null;

  return (
    <div className="glass-panel border-white/5 bg-white/[0.02] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert size={14} className="text-ev-blue" />
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
              Vehicle Alerts
            </h3>
          </div>
          {vehicleAlerts.length > 0 && (
            <div className="flex items-center gap-2">
              {groupedAlerts.critical.length > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-ev-red/20 text-ev-red">
                  {groupedAlerts.critical.length} CRIT
                </span>
              )}
              {groupedAlerts.warning.length > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-ev-yellow/20 text-ev-yellow">
                  {groupedAlerts.warning.length} WARN
                </span>
              )}
            </div>
          )}
        </div>
        <p className="text-xs text-white font-black mt-1">{vehicleId}</p>
      </div>

      {/* Alert List */}
      <div className="flex-1 overflow-y-auto max-h-[300px]">
        <AnimatePresence mode="popLayout">
          {vehicleAlerts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-8 px-4"
            >
              <CheckCircle2 size={24} className="text-ev-green mb-2 opacity-50" />
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest text-center">
                No Active Alerts
              </p>
              <p className="text-[9px] text-slate-600 mt-1 text-center">
                This vehicle is operating normally
              </p>
            </motion.div>
          ) : (
            <div className="p-2 space-y-2">
              {/* Critical Alerts First */}
              {groupedAlerts.critical.map(alert => (
                <AlertItem
                  key={alert.alert_id}
                  alert={alert}
                  isExpanded={expandedAlert === alert.alert_id}
                  onToggle={() => setExpandedAlert(
                    expandedAlert === alert.alert_id ? null : alert.alert_id
                  )}
                  isAdmin={isAdmin}
                  isAcking={acking === alert.alert_id}
                  onAcknowledge={() => handleAcknowledge(alert.alert_id)}
                  icon={getAlertIcon(alert.alert_type)}
                />
              ))}

              {/* Warning Alerts */}
              {groupedAlerts.warning.map(alert => (
                <AlertItem
                  key={alert.alert_id}
                  alert={alert}
                  isExpanded={expandedAlert === alert.alert_id}
                  onToggle={() => setExpandedAlert(
                    expandedAlert === alert.alert_id ? null : alert.alert_id
                  )}
                  isAdmin={isAdmin}
                  isAcking={acking === alert.alert_id}
                  onAcknowledge={() => handleAcknowledge(alert.alert_id)}
                  icon={getAlertIcon(alert.alert_type)}
                />
              ))}

              {/* Info Alerts */}
              {groupedAlerts.info.map(alert => (
                <AlertItem
                  key={alert.alert_id}
                  alert={alert}
                  isExpanded={expandedAlert === alert.alert_id}
                  onToggle={() => setExpandedAlert(
                    expandedAlert === alert.alert_id ? null : alert.alert_id
                  )}
                  isAdmin={isAdmin}
                  isAcking={acking === alert.alert_id}
                  onAcknowledge={() => handleAcknowledge(alert.alert_id)}
                  icon={Info}
                />
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Summary Footer */}
      {vehicleAlerts.length > 0 && (
        <div className="p-3 border-t border-white/5 bg-white/[0.02]">
          <p className="text-[9px] text-slate-500 font-mono text-center">
            {vehicleAlerts.length} active alert{vehicleAlerts.length !== 1 ? 's' : ''} for this vehicle
          </p>
        </div>
      )}
    </div>
  );
};

/**
 * Individual Alert Item Component
 */
const AlertItem = ({ alert, isExpanded, onToggle, isAdmin, isAcking, onAcknowledge, icon: Icon }) => {
  const isCritical = alert.severity === 'CRITICAL';
  const isWarning = alert.severity === 'WARNING';

  const severityConfig = {
    critical: {
      bg: 'bg-ev-red/10',
      border: 'border-ev-red/30',
      text: 'text-ev-red',
      iconBg: 'bg-ev-red/20',
      badge: 'CRIT'
    },
    warning: {
      bg: 'bg-ev-yellow/10',
      border: 'border-ev-yellow/30',
      text: 'text-ev-yellow',
      iconBg: 'bg-ev-yellow/20',
      badge: 'WARN'
    },
    info: {
      bg: 'bg-ev-blue/10',
      border: 'border-ev-blue/30',
      text: 'text-ev-blue',
      iconBg: 'bg-ev-blue/20',
      badge: 'INFO'
    }
  }[alert.severity.toLowerCase()] || severityConfig.info;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={cn(
        "rounded-lg border overflow-hidden transition-all",
        severityConfig.bg, severityConfig.border,
        isExpanded && "ring-1 ring-white/10"
      )}
    >
      {/* Alert Header - Always Visible */}
      <div
        onClick={onToggle}
        className="p-3 cursor-pointer hover:bg-white/5 transition-colors"
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={cn("p-1.5 rounded shrink-0", severityConfig.iconBg, severityConfig.text)}>
            <Icon size={12} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-[9px] font-black px-1 rounded",
                alert.acknowledged_at
                  ? "bg-slate-700/30 text-slate-500"
                  : (severityConfig.bg, severityConfig.text)
              )}>
                {alert.acknowledged_at ? 'ACKNOWLEDGED' : severityConfig.badge}
              </span>
              <span className={cn(
                "text-[9px] font-mono",
                alert.acknowledged_at ? "text-slate-600" : "text-slate-500"
              )}>
                {formatRelativeTime(alert.created_at)}
              </span>
            </div>
            <p className={cn(
              "text-xs mt-1 leading-snug",
              alert.acknowledged_at 
                ? "text-slate-500" 
                : (isCritical ? "text-white font-medium" : "text-slate-300")
            )}>
              {alert.message}
            </p>
          </div>

          {/* Expand/Collapse Indicator */}
          <ChevronRight 
            size={14} 
            className={cn(
              "text-slate-500 transition-transform shrink-0",
              isExpanded && "rotate-90"
            )} 
          />
        </div>
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-0 border-t border-white/5">
              {/* Alert Details */}
              <div className="pt-3 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-[9px]">
                  <div>
                    <span className="text-slate-500">Type:</span>
                    <span className="text-slate-300 ml-1 font-mono">{alert.alert_type}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">ID:</span>
                    <span className="text-slate-300 ml-1 font-mono truncate">{alert.alert_id?.slice(0, 8)}</span>
                  </div>
                </div>

                {/* Admin Actions */}
                {isAdmin && !alert.acknowledged_at && (
                  <div className="pt-2 border-t border-white/5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAcknowledge();
                      }}
                      disabled={isAcking}
                      className={cn(
                        "w-full py-2 rounded text-[10px] font-black uppercase tracking-wider transition-all",
                        isCritical 
                          ? "bg-ev-red/20 text-ev-red hover:bg-ev-red/30" 
                          : "bg-ev-yellow/20 text-ev-yellow hover:bg-ev-yellow/30",
                        isAcking && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {isAcking ? 'Acknowledging...' : 'Acknowledge Alert'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default VehicleAlertPanel;
