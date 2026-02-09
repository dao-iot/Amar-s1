import React, { useState, useMemo } from 'react';
import axios from 'axios';
import { formatRelativeTime, formatTime } from '../utils/formatters';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertCircle, AlertTriangle, Info, CheckCircle2, ChevronRight, X, 
  ShieldAlert, Battery, Thermometer, Zap, Clock, CheckCircle 
} from 'lucide-react';
import { cn } from '../utils/ui-utils';

/**
 * EnhancedVehicleAlertPanel - Vehicle-Specific Alert Visibility
 * 
 * UX PRINCIPLE: Alerts are VEHICLE-SPECIFIC, not globally spammed
 * - Alerts NEVER spam the global UI
 * - Alerts visible ONLY when vehicle is selected
 * - Grouped by alert type with consolidated view
 * - Resolved alerts visually muted
 * - Critical alerts visually emphasized
 */
const EnhancedVehicleAlertPanel = ({ vehicleId, alerts, isAdmin, onAlertAck }) => {
  const [acking, setAcking] = useState(null);
  const [expandedType, setExpandedType] = useState(null);
  const [resolvedAlerts, setResolvedAlerts] = useState([]);

  // Fetch resolved alerts when panel opens
  React.useEffect(() => {
    if (vehicleId) {
      const fetchResolvedAlerts = async () => {
        try {
          const response = await axios.get(`/api/v1/alerts/vehicle/${vehicleId}/resolved`);
          setResolvedAlerts(response.data.data || []);
        } catch (error) {
          console.error('Failed to fetch resolved alerts:', error);
        }
      };
      fetchResolvedAlerts();
    }
  }, [vehicleId]);

  // Filter and group alerts for this vehicle
  const { activeAlerts, groupedActiveAlerts, groupedResolvedAlerts } = useMemo(() => {
    if (!vehicleId) return { activeAlerts: [], groupedActiveAlerts: {}, groupedResolvedAlerts: {} };

    // Get all alerts for this vehicle (active + resolved)
    const vehicleAlerts = alerts.filter(a => a.vehicle_id === vehicleId);
    
    // Separate active and resolved
    const active = vehicleAlerts.filter(a => !a.resolved_at);
    const resolved = resolvedAlerts.filter(a => a.vehicle_id === vehicleId);

    // Group by alert type
    const groupByType = (alertList) => {
      const groups = {};
      alertList.forEach(alert => {
        const type = alert.alert_type;
        if (!groups[type]) {
          groups[type] = {
            type: type,
            alerts: [],
            firstTriggered: alert.created_at,
            severity: alert.severity,
            isActive: !alert.resolved_at
          };
        }
        groups[type].alerts.push(alert);
        
        // Track earliest timestamp
        if (new Date(alert.created_at) < new Date(groups[type].firstTriggered)) {
          groups[type].firstTriggered = alert.created_at;
        }
        
        // Track highest severity
        const severityRank = { CRITICAL: 3, WARNING: 2, INFO: 1 };
        if (severityRank[alert.severity] > severityRank[groups[type].severity]) {
          groups[type].severity = alert.severity;
        }
      });
      return groups;
    };

    return {
      activeAlerts: active,
      groupedActiveAlerts: groupByType(active),
      groupedResolvedAlerts: groupByType(resolved)
    };
  }, [alerts, resolvedAlerts, vehicleId]);

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

  // Get status badge for alert group
  const getStatusBadge = (isResolved) => {
    if (isResolved) {
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-ev-green/20 text-ev-green text-[9px] font-black">
          <CheckCircle size={10} />
          RESOLVED
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-ev-red/20 text-ev-red text-[9px] font-black">
        <AlertCircle size={10} />
        ACTIVE
      </span>
    );
  };

  if (!vehicleId) return null;

  const allAlertGroups = [
    ...Object.values(groupedActiveAlerts),
    ...Object.values(groupedResolvedAlerts)
  ].sort((a, b) => {
    // Sort by severity (critical first), then by timestamp
    const severityRank = { CRITICAL: 3, WARNING: 2, INFO: 1 };
    if (severityRank[b.severity] !== severityRank[a.severity]) {
      return severityRank[b.severity] - severityRank[a.severity];
    }
    return new Date(b.firstTriggered) - new Date(a.firstTriggered);
  });

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
          {activeAlerts.length > 0 && (
            <div className="flex items-center gap-2">
              {activeAlerts.filter(a => a.severity === 'CRITICAL').length > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-ev-red/20 text-ev-red animate-pulse">
                  {activeAlerts.filter(a => a.severity === 'CRITICAL').length} CRIT
                </span>
              )}
              {activeAlerts.filter(a => a.severity === 'WARNING').length > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-ev-yellow/20 text-ev-yellow">
                  {activeAlerts.filter(a => a.severity === 'WARNING').length} WARN
                </span>
              )}
            </div>
          )}
        </div>
        <p className="text-xs text-white font-black mt-1">{vehicleId}</p>
      </div>

      {/* Alert Groups List */}
      <div className="flex-1 overflow-y-auto max-h-[400px]">
        <AnimatePresence mode="popLayout">
          {allAlertGroups.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-8 px-4"
            >
              <CheckCircle2 size={24} className="text-ev-green mb-2 opacity-50" />
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest text-center">
                No Alerts Found
              </p>
              <p className="text-[9px] text-slate-600 mt-1 text-center">
                This vehicle has no active or recent alerts
              </p>
            </motion.div>
          ) : (
            <div className="p-3 space-y-3">
              {allAlertGroups.map((group) => (
                <AlertTypeGroup
                  key={`${group.type}-${group.isActive ? 'active' : 'resolved'}`}
                  group={group}
                  isExpanded={expandedType === group.type}
                  onToggle={() => setExpandedType(
                    expandedType === group.type ? null : group.type
                  )}
                  isAdmin={isAdmin}
                  isAcking={acking}
                  onAcknowledge={handleAcknowledge}
                  icon={getAlertIcon(group.type)}
                  getStatusBadge={getStatusBadge}
                />
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Summary Footer */}
      {allAlertGroups.length > 0 && (
        <div className="p-3 border-t border-white/5 bg-white/[0.02]">
          <div className="flex justify-between text-[9px] text-slate-500 font-mono">
            <span>
              {Object.keys(groupedActiveAlerts).length} active alert type{Object.keys(groupedActiveAlerts).length !== 1 ? 's' : ''}
            </span>
            <span>
              {Object.keys(groupedResolvedAlerts).length} resolved
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Alert Type Group Component - Shows consolidated view per alert type
 */
const AlertTypeGroup = ({ 
  group, 
  isExpanded, 
  onToggle, 
  isAdmin, 
  isAcking, 
  onAcknowledge, 
  icon: Icon,
  getStatusBadge
}) => {
  const isCritical = group.severity === 'CRITICAL';
  const isWarning = group.severity === 'WARNING';
  const isResolved = !group.isActive;

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
  }[group.severity.toLowerCase()] || severityConfig.info;

  // Calculate duration for active alerts
  const getDuration = () => {
    if (isResolved) return 'Resolved';
    const firstTrigger = new Date(group.firstTriggered);
    const durationMs = Date.now() - firstTrigger.getTime();
    const minutes = Math.floor(durationMs / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return '< 1m';
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={cn(
        "rounded-lg border overflow-hidden transition-all",
        isResolved 
          ? "opacity-70 bg-slate-800/20 border-slate-700/30" 
          : `${severityConfig.bg} ${severityConfig.border}`,
        isExpanded && "ring-1 ring-white/10"
      )}
    >
      {/* Group Header - Always Visible */}
      <div
        onClick={onToggle}
        className={cn(
          "p-3 cursor-pointer transition-colors",
          !isResolved && "hover:bg-white/5"
        )}
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={cn(
            "p-1.5 rounded shrink-0",
            isResolved ? "bg-slate-700/30 text-slate-500" : `${severityConfig.iconBg} ${severityConfig.text}`
          )}>
            <Icon size={12} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn(
                "text-[9px] font-black px-1.5 py-0.5 rounded",
                isResolved 
                  ? "bg-slate-700/30 text-slate-400" 
                  : (group.alerts.some(a => a.acknowledged_at)
                      ? "bg-slate-700/30 text-slate-500"
                      : `${severityConfig.bg} ${severityConfig.text}`)
              )}>
                {isResolved ? 'RESOLVED' : (group.alerts.some(a => a.acknowledged_at) ? 'ACKNOWLEDGED' : severityConfig.badge)}
              </span>
              {getStatusBadge(isResolved)}
              <span className={cn(
                "text-[9px] font-mono",
                isResolved || group.alerts.some(a => a.acknowledged_at) ? "text-slate-500" : "text-slate-400"
              )}>
                {formatRelativeTime(group.firstTriggered)}
              </span>
            </div>
            
            <p className={cn(
              "text-xs mt-1 leading-snug",
              isResolved || group.alerts.some(a => a.acknowledged_at)
                ? "text-slate-400" 
                : (isCritical ? "text-white font-medium" : "text-slate-300")
            )}>
              {group.type.replace('_', ' ').toUpperCase()} ALERT
            </p>
            
            <div className="flex items-center gap-3 mt-1 text-[9px]">
              <span className={isResolved ? "text-slate-500" : "text-slate-400"}>
                <Clock size={10} className="inline mr-1" />
                {getDuration()}
              </span>
              <span className={isResolved ? "text-slate-500" : "text-slate-400"}>
                {group.alerts.length} occurrence{group.alerts.length !== 1 ? 's' : ''}
              </span>
            </div>
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

      {/* Expanded Details - Alert History */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-0 border-t border-white/5">
              <div className="pt-3">
                <h4 className="text-[10px] font-black text-slate-500 uppercase mb-2">
                  Alert History
                </h4>
                
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {group.alerts.slice(0, 10).map((alert, index) => (
                    <div 
                      key={alert.alert_id} 
                      className="flex items-center justify-between text-[9px] p-2 rounded bg-white/5"
                    >
                      <span className="text-slate-300 font-mono">
                        {formatTime(alert.created_at)}
                      </span>
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[8px] font-black",
                        alert.severity === 'CRITICAL' ? "bg-ev-red/20 text-ev-red" :
                        alert.severity === 'WARNING' ? "bg-ev-yellow/20 text-ev-yellow" :
                        "bg-ev-blue/20 text-ev-blue"
                      )}>
                        {alert.severity}
                      </span>
                    </div>
                  ))}
                  
                  {group.alerts.length > 10 && (
                    <div className="text-center py-2 text-[9px] text-slate-500">
                      +{group.alerts.length - 10} more occurrences
                    </div>
                  )}
                </div>

                {/* Admin Actions for Active Alerts */}
                {!isResolved && isAdmin && !group.alerts.some(a => a.acknowledged_at) && (
                  <div className="pt-3 border-t border-white/5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const firstAlert = group.alerts[0];
                        if (firstAlert) onAcknowledge(firstAlert.alert_id);
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
                      {isAcking ? 'Acknowledging...' : 'Acknowledge All'}
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

export default EnhancedVehicleAlertPanel;