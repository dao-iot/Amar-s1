import React from 'react';
import { formatRelativeTime } from '../utils/formatters';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, ShieldCheck, Activity, Zap, Thermometer, Battery as BatteryIcon, Clock } from 'lucide-react';
import { cn, units } from '../utils/ui-utils';

const VehicleCard = ({ vehicle, isSelected, onSelect }) => {
  const { vehicle_id, data, status, timestamp } = vehicle;
  const isOffline = status === 'offline';
  
  // Health score calculation (mock logic)
  const getHealthStatus = () => {
    if (isOffline) return { label: 'OFFLINE', color: 'text-slate-500', bg: 'bg-slate-500/10', border: 'border-slate-500/20' };
    if (data?.soc < 15 || data?.motor_temp > 95) return { label: 'CRITICAL', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' };
    if (data?.soc < 25 || data?.motor_temp > 80) return { label: 'WARNING', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' };
    return { label: 'OPTIMAL', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
  };

  const health = getHealthStatus();

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5, scale: 1.02 }}
      className={cn(
        "relative overflow-hidden cursor-pointer group rounded-xl border transition-all duration-300 p-5 glass-panel",
        isSelected ? "ring-2 ring-ev-blue border-transparent glow-blue" : "hover:border-white/20",
        isOffline && "opacity-60 grayscale-[0.5]"
      )}
      onClick={() => onSelect(vehicle_id)}
    >
      {/* Background Glow Effect */}
      <div className={cn(
        "absolute -right-10 -top-10 w-32 h-32 blur-[60px] opacity-20 rounded-full transition-colors duration-500",
        health.bg.replace('bg-', 'bg-')
      )} />

      {/* Header */}
      <div className="flex justify-between items-start mb-6 relative z-10">
        <div>
          <h3 className="text-xl font-black tracking-tight text-white group-hover:text-ev-blue transition-colors">
            {vehicle_id}
          </h3>
          <p className="text-[10px] text-slate-500 font-mono mt-1 uppercase tracking-widest">
            Fleet Asset Node
          </p>
        </div>
        <div className="flex flex-col items-end">
          <div className={cn("px-2 py-0.5 rounded text-[10px] font-bold mb-2 flex items-center gap-1", health.bg, health.color, "border", health.border)}>
            {health.label === 'OPTIMAL' ? <ShieldCheck size={10} /> : <ShieldAlert size={10} />}
            {health.label}
          </div>
          <div className={cn("pulse-dot", !isOffline ? "before:bg-ev-green" : "before:bg-slate-500")} />
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 relative z-10">
        <MetricItem 
          icon={<Zap size={14} className="text-ev-blue" />}
          label="SPEED"
          value={data?.speed ?? '--'}
          unit={units.speed}
          isWarning={data?.speed > 100}
        />
        <MetricItem 
          icon={<BatteryIcon size={14} className="text-ev-green" />}
          label="CHARGE"
          value={data?.soc ?? '--'}
          unit={units.soc}
          isWarning={data?.soc < 20}
        />
        <MetricItem 
          icon={<Activity size={14} className="text-ev-yellow" />}
          label="VOLTS"
          value={data?.battery_voltage ?? '--'}
          unit={units.voltage}
        />
        <MetricItem 
          icon={<Thermometer size={14} className="text-orange-400" />}
          label="CORE"
          value={data?.motor_temp ?? '--'}
          unit={units.temp}
          isWarning={data?.motor_temp > 80}
        />
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500 font-mono uppercase tracking-wider relative z-10">
        <div className="flex items-center gap-1">
          <Clock size={10} />
          {formatRelativeTime(timestamp)}
        </div>
        <div className="flex gap-1">
          <div className="w-1 h-1 rounded-full bg-ev-blue opacity-50" />
          <div className="w-1 h-1 rounded-full bg-ev-blue opacity-30" />
          <div className="w-1 h-1 rounded-full bg-ev-blue opacity-10" />
        </div>
      </div>
    </motion.div>
  );
};

const MetricItem = ({ icon, label, value, unit, isWarning }) => (
  <div className="space-y-1">
    <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 tracking-tighter">
      {icon}
      {label}
    </div>
    <div className="flex items-baseline gap-0.5">
      <span className={cn(
        "text-lg font-black metric-value",
        isWarning ? "text-ev-red" : "text-slate-200"
      )}>
        {value}
      </span>
      <span className="text-[10px] text-slate-600 font-bold">{unit}</span>
    </div>
  </div>
);

export default VehicleCard;
