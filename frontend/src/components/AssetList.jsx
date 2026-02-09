import React, { useState, useMemo, useEffect } from 'react';
import { Search, Filter, AlertCircle, CheckCircle2, Wifi, Radio, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../utils/ui-utils';

/**
 * Performance-optimized Asset List Item
 * Wrapped in React.memo to prevent re-renders unless its specific props change
 */
const AssetListItem = React.memo(({ vehicle, isSelected, onSelect, hasAlert }) => {
  const { vehicle_id, status, data } = vehicle;
  const isOnline = status === 'online';

  return (
    <div
      onClick={() => onSelect(vehicle_id)}
      className={cn(
        "group flex items-center justify-between p-3 cursor-pointer border-b border-white/5 transition-all",
        "hover:bg-white/[0.03]",
        isSelected ? "bg-ev-blue/10 border-l-2 border-l-ev-blue" : "border-l-2 border-l-transparent"
      )}
    >
      <div className="flex items-center gap-3">
        {/* Connection Status Icon */}
        <div className={cn(
          "p-1.5 rounded-md",
          isOnline ? "bg-ev-green/10 text-ev-green" : "bg-slate-800 text-slate-500"
        )}>
          {isOnline ? <Wifi size={12} /> : <Radio size={12} className="opacity-50" />}
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-xs font-black tracking-tight transition-colors",
              isSelected ? "text-ev-blue" : "text-slate-300"
            )}>
              {vehicle_id}
            </span>
            {hasAlert && (
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                <AlertCircle size={10} className="text-ev-red" />
              </motion.div>
            )}
          </div>
          <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">
            {status || 'offline'}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
        <div className="text-[10px] font-black text-slate-400 font-mono">
          {data?.soc !== undefined ? `${data.soc}%` : '--'}
        </div>
        {/* Visual SOC Bar */}
        <div className="w-12 h-1 bg-white/5 rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full transition-all duration-1000",
              data?.soc < 20 ? "bg-ev-red" : "bg-ev-green"
            )}
            style={{ width: `${data?.soc || 0}%` }}
          />
        </div>
      </div>
    </div>
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

  const vehicleWithAlertsMap = useMemo(() => {
    const map = new Set();
    activeAlerts.forEach(a => map.add(a.vehicle_id));
    return map;
  }, [activeAlerts]);

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
          filteredVehicles.map(vehicle => (
            <AssetListItem
              key={vehicle.vehicle_id}
              vehicle={vehicle}
              isSelected={selectedId === vehicle.vehicle_id}
              onSelect={onSelect}
              hasAlert={vehicleWithAlertsMap.has(vehicle.vehicle_id)}
            />
          ))
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
