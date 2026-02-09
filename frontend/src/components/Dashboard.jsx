import React, { useState, useEffect, useCallback } from 'react';
import socketService from '../services/socket';
import AssetList from './AssetList';
import AlertPanel from './AlertPanel';
import Charts from './Charts';
import VehicleHistory from './VehicleHistory';
import VehicleManagement from './VehicleManagement';
import VehicleCard from './VehicleCard'; // Keeping for detail view
import { formatTime } from '../utils/formatters';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Car, AlertCircle, Radio, Database, ShieldCheck, LogOut } from 'lucide-react';
import { cn } from '../utils/ui-utils';

const Dashboard = ({ user, onLogout }) => {
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [vehicles, setVehicles] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [history, setHistory] = useState({});
  const [correlateTime, setCorrelateTime] = useState(null);
  const [isManagementOpen, setIsManagementOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [vRes, aRes] = await Promise.all([
          axios.get('/api/v1/vehicles'),
          axios.get('/api/v1/alerts')
        ]);
        
        const initialVehicles = {};
        vRes.data.data.forEach(v => {
          initialVehicles[v.vehicle_id] = { ...v, status: v.last_seen ? 'online' : 'offline' };
        });
        setVehicles(initialVehicles);
        setAlerts(aRes.data.data);
      } catch (error) {
        console.error('Initialization error:', error);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const socket = socketService.connect();

    socket.on('connect', () => {
      setConnectionStatus('connected');
      socketService.subscribeToAll();
    });

    socket.on('reconnect_attempt', () => setConnectionStatus('reconnecting'));
    socket.on('disconnect', () => setConnectionStatus('disconnected'));
    socket.on('connect_error', () => setConnectionStatus('disconnected'));

    socket.on('telemetry_update', (data) => {
      setVehicles(prev => ({
        ...prev,
        [data.vehicle_id]: {
          ...prev[data.vehicle_id],
          data: data.data,
          timestamp: data.timestamp,
          status: 'online'
        }
      }));

      setHistory(prev => {
        const vehicleHistory = prev[data.vehicle_id] || [];
        const newPoint = {
          time: formatTime(data.timestamp),
          speed: data.data.speed,
          battery_voltage: data.data.battery_voltage,
          timestamp: data.timestamp
        };
        
        const updated = [...vehicleHistory, newPoint].filter(p => p.timestamp > Date.now() - 300000);
        return { ...prev, [data.vehicle_id]: updated };
      });
    });

    socket.on('new_alert', (data) => {
      setAlerts(prev => [data.alert, ...prev]);
    });

    socket.on('vehicle_status', (data) => {
      setVehicles(prev => ({
        ...prev,
        [data.vehicle_id]: {
          ...prev[data.vehicle_id],
          status: data.status
        }
      }));
    });

    return () => socketService.disconnect();
  }, []);

  const handleAlertAck = useCallback((alertId) => {
    setAlerts(prev => prev.filter(a => a.alert_id !== alertId));
  }, []);

  const handleCorrelate = useCallback((alert) => {
    // 1. Switch to the vehicle that triggered the alert
    setSelectedVehicleId(alert.vehicle_id);
    
    // 2. Set the correlation timestamp (formatted for chart matching)
    setCorrelateTime(formatTime(alert.created_at));
    
    // 3. Optional: Clear correlation after 10s or when new selection happens
    setTimeout(() => setCorrelateTime(null), 10000);
  }, []);

  const handleManagementToggle = () => {
    setIsManagementOpen(prev => !prev);
  };

  const totalVehicles = Object.keys(vehicles).length;
  const onlineCount = Object.values(vehicles).filter(v => v.status === 'online').length;

  const isAdmin = user?.role === 'admin';

  return (
    <div className="min-h-screen bg-ev-dark p-4 md:p-8 overflow-hidden">
      {/* Background Grid Pattern */}
      <div className="fixed inset-0 pointer-events-none opacity-5" 
           style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 relative z-10">
        <div className="flex items-center gap-4">
          <div className="bg-ev-blue/20 p-2 rounded-lg border border-ev-blue/30 shadow-[0_0_15px_rgba(0,210,255,0.2)]">
            <Radio className="text-ev-blue animate-pulse" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-white uppercase italic">
              EV Fleet <span className="text-ev-blue">Operations</span>
            </h1>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.3em]">Command & Control Center v2.0</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {isAdmin && (
            <button 
              onClick={handleManagementToggle}
              className={cn(
                "p-2 rounded-lg border transition-all flex items-center gap-2",
                isManagementOpen 
                  ? "bg-ev-blue/20 border-ev-blue/50 text-ev-blue shadow-[0_0_15px_rgba(0,210,255,0.2)]" 
                  : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
              )}
              title="Fleet Management"
            >
              <Database size={18} />
              <span className="text-[10px] font-black uppercase tracking-widest hidden lg:block">Registry</span>
            </button>
          )}

          <div className="hidden md:flex flex-col items-end mr-2">
            <span className="text-[9px] font-black text-ev-blue uppercase tracking-widest">{user?.role} NODE</span>
            <span className="text-[10px] font-mono text-slate-400 uppercase">{user?.username}</span>
          </div>

          <StatBox label="ACTIVE ASSETS" value={onlineCount} total={totalVehicles} icon={<Car size={14} />} color="text-ev-green" />
          <StatBox label="SYSTEM ALERTS" value={alerts.length} icon={<AlertCircle size={14} />} color={alerts.length > 0 ? "text-ev-red" : "text-ev-blue"} />
          
          <div className={cn(
            "px-4 py-2 rounded-full border flex items-center gap-2 transition-all duration-500",
            connectionStatus === 'connected' ? "bg-ev-green/10 border-ev-green/30 text-ev-green" : "bg-red-500/10 border-red-500/30 text-red-400"
          )}>
            <div className={cn("w-2 h-2 rounded-full", connectionStatus === 'connected' ? "bg-ev-green animate-pulse" : "bg-red-500")} />
            <span className="text-[10px] font-black uppercase tracking-widest">{connectionStatus}</span>
          </div>

          <button 
            onClick={onLogout}
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
            title="Secure Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 relative z-10">
        <AnimatePresence>
          {isManagementOpen && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="fixed inset-0 z-40 p-4 md:p-12 md:pt-32"
            >
              <VehicleManagement user={user} onClose={() => setIsManagementOpen(false)} />
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Left Side: Asset Registry & Alerts */}
        <div className="xl:col-span-4 flex flex-col gap-8 h-[calc(100vh-180px)]">
          {/* Emergency Feed (Top Left) */}
          <section className="flex flex-col flex-[0.4] min-h-[250px]">
            <SectionHeader title="Emergency Feed" icon={<AlertCircle size={14} />} />
            <AlertPanel 
              alerts={alerts} 
              onAlertAck={handleAlertAck} 
              onCorrelate={handleCorrelate} 
              isAdmin={isAdmin}
            />
          </section>

          {/* Asset List Registry (Bottom Left) */}
          <section className="flex-1 flex flex-col overflow-hidden">
            <AssetList 
              vehicles={vehicles}
              selectedId={selectedVehicleId}
              onSelect={setSelectedVehicleId}
              activeAlerts={alerts}
            />
          </section>
        </div>

        {/* Right Side: Detailed Analytics & Status */}
        <div className="xl:col-span-8 h-[calc(100vh-180px)] flex flex-col gap-8">
          <section className="h-full flex flex-col overflow-hidden">
            <SectionHeader 
              title={selectedVehicleId ? `Telemetry Node: ${selectedVehicleId}` : "Select Node for Telemetry"} 
              icon={<Activity size={14} />} 
            />
            <div className="glass-panel p-8 flex-1 border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent overflow-y-auto custom-scrollbar">
              {selectedVehicleId ? (
                <>
                  {/* Summary Card for Active Vehicle */}
                  <div className="mb-8 max-w-sm">
                    <VehicleCard 
                      vehicle={vehicles[selectedVehicleId]} 
                      isSelected={false} 
                      onSelect={() => {}} 
                    />
                  </div>

                  <Charts 
                    vehicleId={selectedVehicleId} 
                    data={history[selectedVehicleId] || []} 
                    highlightTime={correlateTime}
                  />

                  <VehicleHistory vehicleId={selectedVehicleId} />
                  
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-8 pt-8 border-t border-white/5 grid grid-cols-3 gap-8"
                  >
                    <DataNode label="NETWORK STATUS" value="STABLE" icon={<Radio size={12}/>} color="text-ev-green" />
                    <DataNode label="LAST DB SYNC" value={formatTime(vehicles[selectedVehicleId]?.timestamp)} icon={<Database size={12}/>} color="text-slate-400" />
                    <DataNode label="ENCRYPTION" value="AES-256" icon={<ShieldCheck size={12}/>} color="text-ev-blue" />
                  </motion.div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center border-dashed border-2 border-white/5 rounded-2xl">
                  <div className="text-center space-y-4">
                    <Database size={48} className="text-slate-800 mx-auto" />
                    <p className="text-xs font-mono text-slate-600 uppercase tracking-[0.3em]">Awaiting Asset Selection</p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

const StatBox = ({ label, value, total, icon, color }) => (
  <div className="flex flex-col items-end gap-1">
    <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-tighter">
      {icon}
      {label}
    </div>
    <div className={cn("text-xl font-black italic metric-value", color)}>
      {value}{total !== undefined && <span className="text-xs text-slate-600 ml-1">/ {total}</span>}
    </div>
  </div>
);

const SectionHeader = ({ title, icon }) => (
  <div className="flex items-center gap-3 mb-4">
    <div className="w-1 h-4 bg-ev-blue rounded-full shadow-[0_0_10px_#00d2ff]" />
    <h2 className="text-xs font-black uppercase tracking-[0.25em] text-slate-400 flex items-center gap-2">
      {icon}
      {title}
    </h2>
  </div>
);

const DataNode = ({ label, value, icon, color }) => (
  <div>
    <div className="flex items-center gap-2 text-[9px] font-black text-slate-600 mb-1 tracking-widest">
      {icon}
      {label}
    </div>
    <div className={cn("text-xs font-black italic", color)}>{value}</div>
  </div>
);

export default Dashboard;
