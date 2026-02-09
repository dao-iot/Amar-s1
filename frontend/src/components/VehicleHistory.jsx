import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Clock, History, ChevronDown, ListFilter, Thermometer, Zap, Gauge } from 'lucide-react';
import { formatTime } from '../utils/formatters';
import { cn } from '../utils/ui-utils';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Performance Decision: Local grouping of historical data
 * Instead of asking the backend for grouped data (which might require schema changes),
 * we fetch the raw logs and group them by minute in the frontend for a "Timeline" view.
 */
const VehicleHistory = ({ vehicleId }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('15m'); // 5m, 15m, 1h
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!vehicleId) return;

    const fetchHistory = async () => {
      setLoading(true);
      try {
        // Deriving time window based on range selection
        const now = Date.now();
        const duration = range === '5m' ? 5 : range === '15m' ? 15 : 60;
        const startTime = now - duration * 60 * 1000;

        // Backend expects 'from' and 'to' as Unix timestamps (milliseconds)
        const response = await axios.get(`/api/v1/telemetry/history`, {
          params: {
            vehicle_id: vehicleId,
            from: startTime,
            to: now
          }
        });

        setHistory(response.data.data || []);
      } catch (error) {
        console.error('History fetch error:', error);
        // Gracefully handle errors without blocking the UI
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
    // Refresh history every 30s to keep it current without blocking live telemetry socket
    const interval = setInterval(fetchHistory, 30000);
    return () => clearInterval(interval);
  }, [vehicleId, range]);

  /**
   * Data Aggregation Logic:
   * Groups telemetry logs by minute to provide a readable "Operations Log".
   */
  const groupedHistory = useMemo(() => {
    const groups = {};
    history.forEach(log => {
      const date = new Date(log.timestamp);
      const minuteKey = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      
      if (!groups[minuteKey]) {
        groups[minuteKey] = {
          time: minuteKey,
          logs: [],
          avgSoc: 0,
          avgSpeed: 0
        };
      }
      groups[minuteKey].logs.push(log);
    });

    return Object.values(groups).sort((a, b) => b.time.localeCompare(a.time));
  }, [history]);

  if (!vehicleId) return null;

  return (
    <div className="mt-8 border-t border-white/5 pt-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <History size={16} className="text-ev-blue" />
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-300">Operations Log</h3>
        </div>

        <div className="flex gap-2">
          {['5m', '15m', '1h'].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "px-2 py-1 rounded text-[8px] font-black transition-all border",
                range === r 
                  ? "bg-ev-blue/20 border-ev-blue/50 text-ev-blue" 
                  : "bg-white/5 border-white/5 text-slate-600 hover:text-slate-400"
              )}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {loading ? (
          <HistorySkeleton />
        ) : groupedHistory.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-white/5 rounded-xl">
            <Clock size={24} className="text-slate-800 mx-auto mb-2" />
            <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">No historical logs found</p>
          </div>
        ) : (
          groupedHistory.map((group) => (
            <div key={group.time} className="relative pl-6 pb-6 last:pb-0">
              {/* Timeline Connector */}
              <div className="absolute left-[3px] top-2 bottom-0 w-[1px] bg-white/5" />
              <div className="absolute left-0 top-1.5 w-[7px] h-[7px] rounded-full bg-ev-blue shadow-[0_0_8px_#00d2ff]" />

              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-mono font-black text-slate-500">{group.time}</span>
                
                <div className="grid grid-cols-1 gap-2">
                  {group.logs.slice(0, 3).map((log, idx) => (
                    <div key={idx} className="bg-white/[0.02] border border-white/5 p-3 rounded-lg flex items-center justify-between group hover:bg-white/[0.04] transition-all">
                      <div className="flex items-center gap-6">
                        <Metric icon={<Gauge size={10}/>} value={`${log.data.speed} KM/H`} label="VELOCITY" />
                        <Metric icon={<Zap size={10}/>} value={`${log.data.soc}%`} label="CHARGE" />
                        <Metric icon={<Thermometer size={10}/>} value={`${log.data.temperature}°C`} label="THERMAL" />
                      </div>
                      <span className="text-[8px] font-mono text-slate-700">{new Date(log.timestamp).getSeconds()}s</span>
                    </div>
                  ))}
                  {group.logs.length > 3 && (
                    <div className="text-[8px] font-mono text-slate-600 pl-2">
                      + {group.logs.length - 3} MORE ENTRIES IN THIS MINUTE
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const Metric = ({ icon, value, label }) => (
  <div className="flex flex-col gap-0.5">
    <div className="flex items-center gap-1.5 text-[7px] font-black text-slate-600 tracking-widest uppercase">
      {icon}
      {label}
    </div>
    <div className="text-[10px] font-mono font-black text-slate-300">{value}</div>
  </div>
);

const HistorySkeleton = () => (
  <div className="space-y-6 animate-pulse">
    {[1, 2, 3].map(i => (
      <div key={i} className="flex gap-4">
        <div className="w-2 h-2 rounded-full bg-white/5 mt-1" />
        <div className="flex-1 space-y-2">
          <div className="h-2 w-12 bg-white/5 rounded" />
          <div className="h-12 w-full bg-white/5 rounded-lg" />
        </div>
      </div>
    ))}
  </div>
);

export default VehicleHistory;
