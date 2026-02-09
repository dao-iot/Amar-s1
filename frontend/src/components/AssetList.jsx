import React, { useState, useMemo, useEffect } from 'react';
import { Search, Filter, AlertCircle, AlertTriangle, CheckCircle2, Wifi, Radio, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../utils/ui-utils';

/**
 * Performance-optimized Asset List Item
 * Wrapped in React.memo to prevent re-renders unless its specific props change
 * 
 * UX PRINCIPLE: Shows alert severity indicator on vehicles with issues
 * - Critical alerts show red pulse indicator
 * - Warning alerts show yellow indicator
 * - Healthy vehicles show no indicator
 * - Battery health shows real-time SOC with color-coded status
 */
const AssetListItem = React.memo(({ vehicle, isSelected, onSelect, alertSeverity, alertCount, isEscalated }) => {
  const { vehicle_id, status, data } = vehicle;
  const isOnline = status === 'online';
  const hasCritical = alertSeverity === 'CRITICAL';
  const hasWarning = alertSeverity === 'WARNING';
  
  // Calculate battery health status based on SOC and alert state
  const batteryHealth = React.useMemo(() => {
    const soc = data?.soc;
    if (soc === undefined || soc === null) {
      return { status: 'unknown', color: 'text-slate-500', barColor: 'bg-slate-500', label: '--' };
    }
    
    // Priority 1: Alert-based health (highest precedence)
    if (hasCritical) {
      return { status: 'critical', color: 'text-ev-red', barColor: 'bg-ev-red', label: `${soc}%` };
    }
    
    if (hasWarning) {
      return { status: 'warning', color: 'text-ev-yellow', barColor: 'bg-ev-yellow', label: `${soc}%` };
    }
    
    // Priority 2: SOC-based health thresholds
    if (soc < 15) {
      return { status: 'critical', color: 'text-ev-red', barColor: 'bg-ev-red', label: `${soc}%` };
    }
    
    if (soc < 30) {
      return { status: 'warning', color: 'text-ev-yellow', barColor: 'bg-ev-yellow', label: `${soc}%` };
    }
    
    return { status: 'healthy', color: 'text-ev-green', barColor: 'bg-ev-green', label: `${soc}%` };
  }, [data?.soc, hasCritical, hasWarning]);

  return (
    <div
      onClick={() => onSelect(vehicle_id)}
      className={cn(
        "group flex items-center justify-between p-3 cursor-pointer border-b border-white/5 transition-all",
        "hover:bg-white/[0.03]",
        isSelected ? "bg-ev-blue/10 border-l-2 border-l-ev-blue" : "border-l-2 border-l-transparent",
        hasCritical && !isSelected && "bg-ev-red/5 border-l-ev-red/30"
      )}
    >
      <div className="flex items-center gap-3">
        {/* Connection Status Icon */}
        <div className={cn(
          "p-1.5 rounded-md relative",
          isOnline ? "bg-ev-green/10 text-ev-green" : "bg-slate-800 text-slate-500"
        )}>
          {isOnline ? <Wifi size={12} /> : <Radio size={12} className="opacity-50" />}
          
          {/* Alert Indicator Dot - Human Factors Compliant */}
          {hasCritical && (
            <span className={cn(
              "absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full",
              isEscalated ? "bg-ev-red animate-pulse-fast" : "bg-ev-red"
            )} />
          )}
          {hasWarning && !hasCritical && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-ev-yellow rounded-full" />
          )}
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-xs font-black tracking-tight transition-colors",
              isSelected ? "text-ev-blue" : hasCritical ? "text-ev-red" : "text-slate-300"
            )}>
              {vehicle_id}
            </span>
            
            {/* Alert Severity Badge - State-based, not event-based */}
            {hasCritical && (
              <motion.div
                className={cn(
                  "flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black",
                  isEscalated 
                    ? "bg-ev-red/30 text-ev-red animate-pulse" 
                    : "bg-ev-red/20 text-ev-red"
                )}
              >
                <AlertCircle size={8} />
                <span>{alertCount}</span>
              </motion.div>
            )}
            {hasWarning && !hasCritical && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-ev-yellow/20 text-[8px] font-black text-ev-yellow">
                <AlertTriangle size={8} />
                <span>{alertCount}</span>
              </div>
            )}
          </div>
          <span className={cn(
            "text-[9px] font-mono uppercase tracking-widest",
            hasCritical ? "text-ev-red/70" : "text-slate-500"
          )}>
            {status || 'offline'}
          </span>
        </div>
      </div>

      {/* Battery Health Indicator - Real-time Updates */}
      <div className="flex flex-col items-end gap-1">
        <div className={cn(
          "text-[10px] font-black font-mono transition-colors duration-300",
          batteryHealth.color
        )}>
          {batteryHealth.label}
        </div>
        {/* Visual SOC Bar with Dynamic Color */}
        <div className="w-12 h-1 bg-white/5 rounded-full overflow-hidden">
          <motion.div 
            className={cn(
              "h-full transition-all duration-1000",
              batteryHealth.barColor
            )}
            initial={{ width: 0 }}
            animate={{ width: `${data?.soc || 0}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  // Only re-render if relevant props have changed
  return (
    prevProps.vehicle.vehicle_id === nextProps.vehicle.vehicle_id &&
    prevProps.vehicle.timestamp === nextProps.vehicle.timestamp &&
    prevProps.vehicle.data?.soc === nextProps.vehicle.data?.soc &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.alertSeverity === nextProps.alertSeverity &&
    prevProps.alertCount === nextProps.alertCount &&
    prevProps.isEscalated === nextProps.isEscalated
  );
});

const AssetList = ({ vehicles, selectedId, onSelect, activeAlerts }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'online', 'offline', 'warning', 'critical'

  // Debounce logic for search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  /**
   * PERFORMANCE DECISION: useMemo for Filtering
   * We filter the 50+ assets in memory. Memoization ensures this heavy filtering
   * doesn't happen on every single telemetry tick unless the vehicle count
   * or filter criteria actually change.
   */
  const filteredVehicles = useMemo(() => {
    return Object.values(vehicles).filter(v => {
      // Skip invalid vehicle entries
      if (!v || !v.vehicle_id) return false;

      // 1. Search Filter
      const matchesSearch = v.vehicle_id.toLowerCase().includes(debouncedSearch.toLowerCase());
      if (!matchesSearch) return false;

      // 2. Status/Alert Filter
      const vehicleAlerts = activeAlerts.filter(a => a.vehicle_id === v.vehicle_id);
      
      if (filterStatus === 'online') return v.status === 'online';
      if (filterStatus === 'offline') return v.status !== 'online';
      if (filterStatus === 'warning') return vehicleAlerts.some(a => a.severity === 'WARNING');
      if (filterStatus === 'critical') return vehicleAlerts.some(a => a.severity === 'CRITICAL');
      
      return true;
    });
  }, [vehicles, debouncedSearch, filterStatus, activeAlerts]);

  /**
   * Build a map of vehicle_id -> { severity, count, isEscalated } for alert indicators
   * Shows the highest severity alert for each vehicle
   * Tracks if vehicle just became critical (escalation)
   */
  const vehicleAlertMap = useMemo(() => {
    const map = new Map();
    const escalatedVehicles = new Set(); // Track vehicles that became critical
    
    // First pass: identify current critical vehicles
    const currentCriticalVehicles = new Set();
    activeAlerts
      .filter(a => a.severity === 'CRITICAL' && !a.resolved_at)
      .forEach(a => currentCriticalVehicles.add(a.vehicle_id));
    
    activeAlerts.forEach(a => {
      const existing = map.get(a.vehicle_id);
      if (!existing) {
        map.set(a.vehicle_id, { 
          severity: a.severity, 
          count: 1,
          isEscalated: false // Will be set below
        });
      } else {
        // Keep the highest severity (CRITICAL > WARNING > INFO)
        const severityRank = { CRITICAL: 3, WARNING: 2, INFO: 1 };
        if (severityRank[a.severity] > severityRank[existing.severity]) {
          existing.severity = a.severity;
        }
        existing.count++;
      }
    });
    
    // Second pass: determine if vehicles just became critical
    for (const [vehicleId, alertData] of map.entries()) {
      if (alertData.severity === 'CRITICAL') {
        // Check if this vehicle was not critical before (simplified check)
        // In a real implementation, we'd track state over time
        const isNewCritical = alertData.count <= 3; // Heuristic: first few critical alerts
        if (isNewCritical) {
          alertData.isEscalated = true;
          escalatedVehicles.add(vehicleId);
        }
      }
    }
    
    return { alerts: map, escalatedVehicles };
  }, [activeAlerts]); // Only depend on activeAlerts, not vehicles since we only need alert data

  return (
    <div className="flex flex-col h-full glass-panel border-white/5 bg-white/[0.01]">
      {/* Header & Search */}
      <div className="p-4 border-b border-white/5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
            <Database size={12} className="text-ev-blue" />
            Asset Registry
          </h3>
          <span className="text-[9px] font-mono text-slate-600 bg-white/5 px-2 py-0.5 rounded">
            {filteredVehicles.length} / {Object.keys(vehicles).length}
          </span>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
          <input
            type="text"
            placeholder="SEARCH NODE ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-[10px] font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-ev-blue/50 transition-all uppercase tracking-widest"
          />
        </div>

        {/* Quick Filters */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          <FilterButton 
            active={filterStatus === 'all'} 
            onClick={() => setFilterStatus('all')}
            label="ALL" 
          />
          <FilterButton 
            active={filterStatus === 'online'} 
            onClick={() => setFilterStatus('online')}
            label="LIVE" 
          />
          <FilterButton 
            active={filterStatus === 'warning'} 
            onClick={() => setFilterStatus('warning')}
            label="WARN" 
            variant="warning"
          />
          <FilterButton 
            active={filterStatus === 'critical'} 
            onClick={() => setFilterStatus('critical')}
            label="CRIT" 
            variant="danger"
          />
        </div>
      </div>

      {/* List Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filteredVehicles.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">No matching assets</p>
          </div>
        ) : (
          filteredVehicles.map(vehicle => {
            const alertInfo = vehicleAlertMap.alerts.get(vehicle.vehicle_id);
            return (
              <AssetListItem
                key={`${vehicle.vehicle_id}-${vehicle.timestamp || 0}`} // Include timestamp for real-time updates
                vehicle={vehicle}
                isSelected={selectedId === vehicle.vehicle_id}
                onSelect={onSelect}
                alertSeverity={alertInfo?.severity}
                alertCount={alertInfo?.count || 0}
                isEscalated={alertInfo?.isEscalated || false}
              />
            );
          })
        )}
      </div>
    </div>
  );
};

const FilterButton = ({ active, onClick, label, variant = 'info' }) => (
  <button
    onClick={onClick}
    className={cn(
      "px-2 py-1 rounded text-[7px] font-black tracking-widest transition-all border whitespace-nowrap",
      active 
        ? (variant === 'danger' ? "bg-ev-red/20 border-ev-red/50 text-ev-red" : 
           variant === 'warning' ? "bg-ev-yellow/20 border-ev-yellow/50 text-ev-yellow" :
           "bg-ev-blue/20 border-ev-blue/50 text-ev-blue")
        : "bg-white/5 border-white/5 text-slate-500 hover:bg-white/10"
    )}
  >
    {label}
  </button>
);



export default AssetList;
