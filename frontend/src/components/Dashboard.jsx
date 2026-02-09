import React, { useState, useEffect, useCallback, useMemo } from 'react';
import socketService from '../services/socket';
import AssetList from './AssetList';
import FleetHealthSummary from './FleetHealthSummary';
import AlertVisualizationDashboard from './AlertVisualizationDashboard';
import EnhancedVehicleAlertPanel from './EnhancedVehicleAlertPanel';
import NonIntrusiveAlertIndicator from './NonIntrusiveAlertIndicator';
import Charts from './Charts';
import VehicleHistory from './VehicleHistory';
import VehicleManagement from './VehicleManagement';
import VehicleCard from './VehicleCard';
import { formatTime } from '../utils/formatters';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Car, AlertCircle, Radio, Database, ShieldCheck, LogOut, LayoutDashboard } from 'lucide-react';
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

        // Validate response data before processing
        const vehicleData = vRes.data?.data || [];
        const alertData = aRes.data?.data || [];

        // Fetch current telemetry for each vehicle
        const vehiclesWithTelemetry = await Promise.all(
          vehicleData.map(async (v) => {
            if (v && v.vehicle_id) {
              try {
                const telemetryRes = await axios.get(`/api/v1/telemetry/current/${v.vehicle_id}`);
                const telemetryData = telemetryRes.data?.data;
                return {
                  ...v,
                  status: v.last_seen ? 'online' : 'offline',
                  data: telemetryData?.data || {}, // Extract the actual telemetry metrics
                  timestamp: telemetryData?.timestamp || v.last_seen
                };
              } catch (error) {
                // If telemetry fetch fails, return vehicle with basic data
                console.warn(`Failed to fetch telemetry for ${v.vehicle_id}:`, error.message);
                return {
                  ...v,
                  status: v.last_seen ? 'online' : 'offline',
                  data: {},
                  timestamp: v.last_seen
                };
              }
            }
            return null;
          })
        );

        const initialVehicles = {};
        vehiclesWithTelemetry
          .filter(v => v && v.vehicle_id)
          .forEach(v => {
            initialVehicles[v.vehicle_id] = v;
          });

        setVehicles(initialVehicles);
        setAlerts(alertData);
      } catch (error) {
        console.error('Initialization error:', error);
        // Don't crash on auth errors - the global interceptor will handle logout
        if (error.response?.status !== 401) {
          // For non-auth errors, we could show a user-friendly message here
        }
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const socket = socketService.connect();
    
    socket.on('connect', () => {
      setConnectionStatus('connected');
      // Subscribe to all vehicle telemetry updates
      socket.emit('subscribe', { vehicle_id: 'all' });
    });
    socket.on('disconnect', () => setConnectionStatus('disconnected'));
    socket.on('connect_error', () => setConnectionStatus('error'));
    
    // Listen for state-based alert updates (not event spam)
    socket.on('alert_state_update', (data) => {
      const newAlert = data.alert;
      setAlerts(prev => {
        // Prevent duplicates
        if (prev.some(a => a.alert_id === newAlert.alert_id)) return prev;
        return [...prev, newAlert];
      });
    });
    
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
        
        // Extract and validate telemetry values
        const speedValue = data.data?.speed;
        const voltageValue = data.data?.battery_voltage;
        const timestamp = data.timestamp;
        
        // Create history point with validated numeric values
        const historyPoint = {
          time: formatTime(timestamp),
          timestamp: timestamp
        };
        
        // Only add fields that have valid numeric values
        if (speedValue !== undefined && speedValue !== null && !isNaN(Number(speedValue))) {
          historyPoint.speed = Number(speedValue);
        }
        
        if (voltageValue !== undefined && voltageValue !== null && !isNaN(Number(voltageValue))) {
          historyPoint.battery_voltage = Number(voltageValue);
        }
        
        // Only add point if we have at least one valid metric
        if (historyPoint.speed !== undefined || historyPoint.battery_voltage !== undefined) {
          const updated = [...vehicleHistory, historyPoint].filter(p => p.timestamp > Date.now() - 300000);
          return { ...prev, [data.vehicle_id]: updated };
        }
        
        return prev;
      });
    });

    socket.on('new_alert', (data) => {
      setAlerts(prev => [data.alert, ...prev]);
    });

    // Listen for alert acknowledgment updates
    socket.on('alert_acknowledged', (data) => {
      handleAlertAcknowledged(data);
    });

    // Listen for alert summary updates
    socket.on('alert_summary', (data) => {
      // This is a periodic summary - we could use it to trigger stats refresh
      // For now, we'll let the components poll their own stats
      console.log('Alert summary received:', data);
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

  // Handle WebSocket alert acknowledgment updates
  const handleAlertAcknowledged = useCallback((data) => {
    setAlerts(prev => prev.map(alert => 
      alert.alert_id === data.alert_id 
        ? { ...alert, acknowledged_at: data.acknowledged_at }
        : alert
    ));
  }, []);

  const handleCorrelate = useCallback((alert) => {
    // Switch to the vehicle that triggered the alert
    setSelectedVehicleId(alert.vehicle_id);
    setCorrelateTime(formatTime(alert.created_at));
    setTimeout(() => setCorrelateTime(null), 10000);
  }, []);

  const handleManagementToggle = () => {
    setIsManagementOpen(prev => !prev);
  };

  // Filter to show only critical vehicles (those with critical alerts)
  const handleViewCritical = useCallback(() => {
    const criticalVehicleIds = new Set(
      alerts.filter(a => a.severity === 'CRITICAL').map(a => a.vehicle_id)
    );
    const firstCritical = Array.from(criticalVehicleIds)[0];
    if (firstCritical) {
      setSelectedVehicleId(firstCritical);
    }
  }, [alerts]);

  const totalVehicles = Object.keys(vehicles).length;
  const onlineCount = Object.values(vehicles).filter(v => v.status === 'online').length;

  // Get alerts for selected vehicle
  const selectedVehicleAlerts = useMemo(() => {
    if (!selectedVehicleId) return [];
    return alerts.filter(a => a.vehicle_id === selectedVehicleId);
  }, [alerts, selectedVehicleId]);

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
          <StatBox label="FLEET HEALTH" value={totalVehicles > 0 ? Math.round((Object.values(vehicles).filter(v => {
            const vehicleAlerts = alerts.filter(a => a.vehicle_id === v.vehicle_id);
            return !vehicleAlerts.some(a => a.severity === 'CRITICAL' || a.severity === 'WARNING');
          }).length / totalVehicles) * 100) : 100} icon={<LayoutDashboard size={14} />} color="text-ev-blue" suffix="%" />
          
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

      <div className="space-y-6 relative z-10">
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

        {/* Top: Fleet Health Summary */}
        <section>
          <FleetHealthSummary 
            alerts={alerts} 
            vehicles={vehicles} 
            className="mb-6"
          />
        </section>

        {/* Top: Alert Visualization Dashboard */}
        <section>
          <AlertVisualizationDashboard 
            alerts={alerts} 
            vehicles={vehicles}
            className="mb-6"
          />
        </section>

        {/* Human Factors Alert Status Indicator */}
        <section className="mb-6">
          <NonIntrusiveAlertIndicator 
            alerts={alerts} 
            vehicles={vehicles}
            className="border-white/5 bg-white/[0.02]"
          />
        </section>

        {/* Bottom: Asset Registry and Vehicle Details */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Left Side: Asset Registry */}
          <div className="xl:col-span-3 flex flex-col gap-6 h-[calc(100vh-380px)]">
            <section className="flex-1 flex flex-col overflow-hidden">
              <AssetList
                vehicles={vehicles}
                selectedId={selectedVehicleId}
                onSelect={setSelectedVehicleId}
                activeAlerts={alerts}
              />
            </section>
          </div>

          {/* Center: Detailed Analytics & Status */}
          <div className="xl:col-span-6 h-[calc(100vh-380px)] flex flex-col gap-6">
            <section className="h-full flex flex-col overflow-hidden">
              <SectionHeader
                title={selectedVehicleId ? `Telemetry Node: ${selectedVehicleId}` : "Select Node for Telemetry"}
                icon={<Activity size={14} />}
              />
              <div className="glass-panel p-6 flex-1 border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent overflow-y-auto custom-scrollbar">
                {selectedVehicleId ? (
                  <>
                    {/* Summary Card for Active Vehicle */}
                    <div className="mb-6 max-w-sm">
                      <VehicleCard
                        vehicle={vehicles[selectedVehicleId]}
                        alerts={selectedVehicleAlerts}
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
                      className="mt-6 pt-6 border-t border-white/5 grid grid-cols-3 gap-6"
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

          {/* Right Side: Vehicle-Specific Alerts */}
          <div className="xl:col-span-3 h-[calc(100vh-380px)] flex flex-col">
            <section className="h-full flex flex-col overflow-hidden">
              <SectionHeader
                title={selectedVehicleId ? "Vehicle Alerts" : "Select Vehicle"}
                icon={<AlertCircle size={14} />}
              />
              {selectedVehicleId ? (
                <EnhancedVehicleAlertPanel
                  vehicleId={selectedVehicleId}
                  alerts={alerts}
                  isAdmin={isAdmin}
                  onAlertAck={handleAlertAck}
                />
              ) : (
                <div className="glass-panel border-white/5 bg-white/[0.02] flex-1 flex items-center justify-center">
                  <div className="text-center px-4">
                    <AlertCircle size={32} className="text-slate-700 mx-auto mb-3" />
                    <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">
                      Select a vehicle to view its alerts
                    </p>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatBox = ({ label, value, total, icon, color, suffix = "" }) => (
  <div className="flex flex-col items-end gap-1">
    <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-tighter">
      {icon}
      {label}
    </div>
    <div className={cn("text-xl font-black italic metric-value", color)}>
      {value}{suffix}{total !== undefined && <span className="text-xs text-slate-600 ml-1">/ {total}</span>}
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
