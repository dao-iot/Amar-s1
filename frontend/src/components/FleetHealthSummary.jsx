import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Car, CheckCircle2, AlertTriangle, AlertCircle, Activity } from 'lucide-react';
import { cn } from '../utils/ui-utils';

/**
 * FleetHealthSummary - Top-level Fleet Status Overview
 * 
 * Answers in 5 seconds: "Is the fleet healthy or not?"
 * Shows aggregated fleet metrics at a glance
 */
const FleetHealthSummary = ({ alerts, vehicles, className }) => {
  // Calculate fleet metrics
  const metrics = useMemo(() => {
    const totalVehicles = Object.keys(vehicles).length;
    const onlineVehicles = Object.values(vehicles).filter(v => v.status === 'online').length;
    
    // Group alerts by vehicle and severity
    const vehicleAlerts = new Map();
    alerts.forEach(alert => {
      if (!vehicleAlerts.has(alert.vehicle_id)) {
        vehicleAlerts.set(alert.vehicle_id, { critical: 0, warning: 0, info: 0 });
      }
      const vehicle = vehicleAlerts.get(alert.vehicle_id);
      vehicle[alert.severity.toLowerCase()] = (vehicle[alert.severity.toLowerCase()] || 0) + 1;
    });

    // Count vehicles by health status
    let healthy = 0;
    let warning = 0;
    let critical = 0;

    Object.keys(vehicles).forEach(vehicleId => {
      const vehicleAlert = vehicleAlerts.get(vehicleId);
      if (!vehicleAlert || (vehicleAlert.critical === 0 && vehicleAlert.warning === 0)) {
        healthy++;
      } else if (vehicleAlert.critical > 0) {
        critical++;
      } else if (vehicleAlert.warning > 0) {
        warning++;
      }
    });

    // Health percentage
    const healthPercentage = totalVehicles > 0 ? Math.round((healthy / totalVehicles) * 100) : 100;

    return {
      total: totalVehicles,
      online: onlineVehicles,
      healthy,
      warning,
      critical,
      healthPercentage
    };
  }, [alerts, vehicles]);

  // Determine overall fleet status
  const getFleetStatus = () => {
    if (metrics.critical > 0) {
      return { 
        label: 'DEGRADED', 
        color: 'text-ev-red', 
        bg: 'bg-ev-red/10',
        border: 'border-ev-red/30',
        icon: AlertCircle
      };
    }
    if (metrics.warning > 0) {
      return { 
        label: 'ATTENTION', 
        color: 'text-ev-yellow', 
        bg: 'bg-ev-yellow/10',
        border: 'border-ev-yellow/30',
        icon: AlertTriangle
      };
    }
    return { 
      label: 'NOMINAL', 
      color: 'text-ev-green', 
      bg: 'bg-ev-green/10',
      border: 'border-ev-green/30',
      icon: CheckCircle2
    };
  };

  const status = getFleetStatus();
  const StatusIcon = status.icon;

  return (
    <div className={cn("glass-panel border-white/5 bg-white/[0.02] p-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-ev-blue/20 border border-ev-blue/30">
            <Activity size={20} className="text-ev-blue" />
          </div>
          <div>
            <h2 className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">
              Fleet Health
            </h2>
            <p className="text-[10px] text-slate-500 font-mono mt-1">Real-time Status</p>
          </div>
        </div>
        
        {/* Status Badge */}
        <div className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-black",
          status.bg, status.color, status.border
        )}>
          <StatusIcon size={14} />
          {status.label}
        </div>
      </div>

      {/* Health Percentage */}
      <div className="mb-6">
        <div className="flex items-baseline gap-3 mb-2">
          <span className={cn(
            "text-4xl font-black",
            metrics.healthPercentage >= 90 ? "text-ev-green" :
            metrics.healthPercentage >= 70 ? "text-ev-yellow" : "text-ev-red"
          )}>
            {metrics.healthPercentage}%
          </span>
          <span className="text-[10px] text-slate-500 font-mono">FLEET HEALTH</span>
        </div>
        
        {/* Progress Bar */}
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <motion.div 
            className={cn(
              "h-full rounded-full",
              metrics.healthPercentage >= 90 ? "bg-ev-green" :
              metrics.healthPercentage >= 70 ? "bg-ev-yellow" : "bg-ev-red"
            )}
            initial={{ width: 0 }}
            animate={{ width: `${metrics.healthPercentage}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Vehicle Status Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Total Vehicles */}
        <MetricCard
          label="Total Assets"
          value={metrics.total}
          icon={<Car size={16} />}
          color="text-slate-300"
          bgColor="bg-white/5"
        />
        
        {/* Healthy Vehicles */}
        <MetricCard
          label="Healthy"
          value={metrics.healthy}
          icon={<CheckCircle2 size={16} />}
          color="text-ev-green"
          bgColor="bg-ev-green/10"
          border="border-ev-green/30"
        />
        
        {/* Warning Vehicles */}
        <MetricCard
          label="Warning"
          value={metrics.warning}
          icon={<AlertTriangle size={16} />}
          color="text-ev-yellow"
          bgColor="bg-ev-yellow/10"
          border="border-ev-yellow/30"
        />
        
        {/* Critical Vehicles */}
        <MetricCard
          label="Critical"
          value={metrics.critical}
          icon={<AlertCircle size={16} />}
          color="text-ev-red"
          bgColor="bg-ev-red/10"
          border="border-ev-red/30"
        />
      </div>

      {/* Online Status */}
      <div className="mt-4 pt-4 border-t border-white/5">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-slate-500 font-mono">ONLINE ASSETS</span>
          <span className="text-slate-300 font-black">
            {metrics.online}/{metrics.total}
          </span>
        </div>
        <div className="mt-2 flex gap-1">
          {metrics.total > 0 && (
            <>
              <div 
                className="h-1 bg-ev-green rounded-full"
                style={{ width: `${(metrics.online / metrics.total) * 100}%` }}
              />
              <div 
                className="h-1 bg-slate-700 rounded-full flex-1"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ label, value, icon, color, bgColor, border = "border-white/5" }) => (
  <motion.div
    className={cn(
      "p-3 rounded-lg border transition-all hover:bg-white/5",
      bgColor, border
    )}
    whileHover={{ scale: 1.02 }}
    transition={{ duration: 0.2 }}
  >
    <div className="flex items-center justify-between">
      <div>
        <p className={cn("text-xl font-black", color)}>
          {value}
        </p>
        <p className="text-[9px] text-slate-500 uppercase tracking-wider mt-0.5">
          {label}
        </p>
      </div>
      <div className={color}>
        {icon}
      </div>
    </div>
  </motion.div>
);

export default FleetHealthSummary;