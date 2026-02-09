import React, { useState } from 'react';
import axios from 'axios';
import { formatRelativeTime } from '../utils/formatters';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, AlertTriangle, Info, CheckCircle2, ChevronRight } from 'lucide-react';
import { cn, severityColors } from '../utils/ui-utils';

const AlertPanel = ({ alerts, onAlertAck, onCorrelate, isAdmin }) => {
  const [acking, setAcking] = useState(null);

  const handleAcknowledge = async (id) => {
    setAcking(id);
    try {
      await axios.post(`/api/v1/alerts/${id}/acknowledge`);
      onAlertAck(id);
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
      alert('Failed to acknowledge alert. Please try again.');
    } finally {
      setAcking(null);
    }
  };

  const getIcon = (severity) => {
    switch (severity) {
      case 'CRITICAL': return <AlertCircle size={16} />;
      case 'WARNING': return <AlertTriangle size={16} />;
      default: return <Info size={16} />;
    }
  };

  return (
    <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-2">
      <AnimatePresence initial={false}>
        {alerts.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-10 glass-panel border-dashed border-white/10"
          >
            <CheckCircle2 size={32} className="text-ev-green mb-2 opacity-50" />
            <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">System Nominal</p>
          </motion.div>
        ) : (
          alerts.map((alert) => (
            <motion.div
              key={alert.alert_id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onClick={() => onCorrelate && onCorrelate(alert)}
              className={cn(
                "group flex items-center justify-between p-3 rounded-lg border glass-panel transition-all hover:bg-white/5 cursor-pointer",
                alert.severity === 'CRITICAL' ? "border-red-500/30" : "border-amber-500/30"
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  "p-2 rounded-md",
                  alert.severity === 'CRITICAL' ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"
                )}>
                  {getIcon(alert.severity)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-tighter text-white">
                      {alert.vehicle_id}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {formatRelativeTime(alert.created_at)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5 leading-tight line-clamp-1 group-hover:line-clamp-none transition-all">
                    {alert.message}
                  </p>
                </div>
              </div>

              {isAdmin && (
                <button 
                  disabled={acking === alert.alert_id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAcknowledge(alert.alert_id);
                  }}
                  className={cn(
                    "flex items-center gap-1 pl-3 pr-2 py-1.5 rounded text-[10px] font-black transition-all ml-4",
                    alert.severity === 'CRITICAL' 
                      ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" 
                      : "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20",
                    acking === alert.alert_id && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {acking === alert.alert_id ? 'WAIT' : 'ACK'}
                  <ChevronRight size={12} />
                </button>
              )}
            </motion.div>
          ))
        )}
      </AnimatePresence>
    </div>
  );
};

export default AlertPanel;
