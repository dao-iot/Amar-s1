import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip 
} from 'recharts';
import { 
  AlertCircle, AlertTriangle, Battery, Thermometer, Zap, 
  TrendingUp, Car, Wifi, Radio, Activity
} from 'lucide-react';
import axios from 'axios';
import { cn } from '../utils/ui-utils';
import { formatTime } from '../utils/formatters';

/**
 * AlertVisualizationDashboard - Data Visualization for Real-time Operational Insights
 * 
 * Converts alert noise into actionable insights through:
 * 1. Alerts per Minute (Line Chart) - Time series trend analysis
 * 2. Active Alerts by Type (Donut/Bar) - Categorical breakdown
 * 3. Vehicle Health Distribution - System-wide health overview
 * 4. Top Problem Vehicles - Ranked problem identification
 * 
 * All charts update every few seconds with smooth transitions
 * No chart re-renders per individual alert
 */
const AlertVisualizationDashboard = ({ alerts, vehicles, className }) => {
  const [timeSeriesData, setTimeSeriesData] = useState([]);
  const [vehicleHealthData, setVehicleHealthData] = useState({});
  const [topVehicles, setTopVehicles] = useState([]);
  const [alertTypeData, setAlertTypeData] = useState([]);

  // Fetch time series data every 5 seconds
  useEffect(() => {
    const fetchTimeSeries = async () => {
      try {
        const response = await axios.get('/api/v1/alerts/stats/alerts-per-minute?time_window=30');
        setTimeSeriesData(response.data.data || []);
      } catch (error) {
        console.error('Failed to fetch time series data:', error);
      }
    };

    fetchTimeSeries();
    const interval = setInterval(fetchTimeSeries, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch vehicle health distribution every 5 seconds
  useEffect(() => {
    const fetchHealthData = async () => {
      try {
        const response = await axios.get('/api/v1/alerts/stats/vehicle-health');
        setVehicleHealthData(response.data.data || {});
      } catch (error) {
        console.error('Failed to fetch vehicle health data:', error);
      }
    };

    fetchHealthData();
    const interval = setInterval(fetchHealthData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch top problem vehicles every 5 seconds
  useEffect(() => {
    const fetchTopVehicles = async () => {
      try {
        const response = await axios.get('/api/v1/alerts/stats/top-problem-vehicles?limit=8&time_window=10');
        setTopVehicles(response.data.data || []);
      } catch (error) {
        console.error('Failed to fetch top vehicles data:', error);
      }
    };

    fetchTopVehicles();
    const interval = setInterval(fetchTopVehicles, 5000);
    return () => clearInterval(interval);
  }, []);

  // Process alert type data from existing alerts (updated in real-time)
  useEffect(() => {
    const processAlertTypes = () => {
      const typeMap = new Map();
      
      alerts.forEach(alert => {
        const type = alert.alert_type || 'Unknown';
        if (!typeMap.has(type)) {
          typeMap.set(type, { 
            name: type.replace(/_/g, ' ').toUpperCase(), 
            value: 0, 
            severity: alert.severity 
          });
        }
        typeMap.get(type).value += 1;
      });

      // Categorize common alert types
      const categorized = [];
      const lowBattery = typeMap.get('low_battery') || { name: 'LOW BATTERY', value: 0, severity: 'WARNING' };
      const criticalBattery = typeMap.get('critical_battery') || { name: 'CRITICAL BATTERY', value: 0, severity: 'CRITICAL' };
      const overheating = typeMap.get('high_temperature') || { name: 'OVERHEATING', value: 0, severity: 'CRITICAL' };
      const voltage = typeMap.get('abnormal_voltage') || { name: 'VOLTAGE ANOMALY', value: 0, severity: 'WARNING' };

      if (lowBattery.value > 0) categorized.push(lowBattery);
      if (criticalBattery.value > 0) categorized.push(criticalBattery);
      if (overheating.value > 0) categorized.push(overheating);
      if (voltage.value > 0) categorized.push(voltage);

      // Add other types
      typeMap.forEach((item, key) => {
        if (!['low_battery', 'critical_battery', 'high_temperature', 'abnormal_voltage'].includes(key)) {
          categorized.push(item);
        }
      });

      setAlertTypeData(categorized);
    };

    processAlertTypes();
  }, [alerts]);

  // Calculate current alerts per minute
  const currentAlertRate = useMemo(() => {
    if (alerts.length === 0) return 0;
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    const recentAlerts = alerts.filter(a => new Date(a.created_at) > tenMinutesAgo);
    return Math.round((recentAlerts.length / 10) * 60);
  }, [alerts]);

  // Vehicle health distribution data for pie chart
  const healthDistribution = useMemo(() => {
    const total = Object.keys(vehicles).length;
    if (total === 0) return [];
    
    return [
      { name: 'Healthy', value: vehicleHealthData.healthy || 0, color: '#00ff9d' },
      { name: 'Warning', value: vehicleHealthData.warning || 0, color: '#ffcc00' },
      { name: 'Critical', value: vehicleHealthData.critical || 0, color: '#ff4d4d' },
      { name: 'Offline', value: vehicleHealthData.offline || 0, color: '#64748b' }
    ].filter(item => item.value > 0);
  }, [vehicles, vehicleHealthData]);

  // Colors and styling
  const alertTypeColors = {
    'LOW BATTERY': '#ffcc00',
    'CRITICAL BATTERY': '#ff4d4d',
    'OVERHEATING': '#ff6b6b',
    'VOLTAGE ANOMALY': '#4ecdc4',
    'INFO': '#00d2ff'
  };

  const healthColors = {
    Healthy: '#00ff9d',
    Warning: '#ffcc00', 
    Critical: '#ff4d4d',
    Offline: '#64748b'
  };

  return (
    <div className={cn("grid grid-cols-1 xl:grid-cols-2 gap-6", className)}>
      {/* Alerts Per Minute - Line Chart */}
      <div className="glass-panel p-6 border-white/5 bg-white/[0.02]">
        <ChartHeader 
          title="Alerts Per Minute" 
          icon={<TrendingUp size={16} />}
          value={currentAlertRate}
          label="alerts/min"
        />
        
        <div className="h-64 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeSeriesData}>
              <defs>
                <linearGradient id="colorAlerts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff4d4d" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ff4d4d" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
              <XAxis 
                dataKey="timestamp" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                tickFormatter={(timestamp) => {
                  const date = new Date(timestamp);
                  return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
                }}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 10 }}
              />
              <Tooltip content={<CustomTimeTooltip />} />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#ff4d4d"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorAlerts)"
                isAnimationActive={true}
                animationDuration={800}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        
        {/* Spike Detection */}
        <div className="mt-4 pt-4 border-t border-white/5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-slate-500">SPIKE DETECTION</span>
            <motion.div 
              className={cn(
                "px-2 py-1 rounded text-[9px] font-black",
                currentAlertRate > 300 ? "bg-ev-red/20 text-ev-red" : 
                currentAlertRate > 100 ? "bg-ev-yellow/20 text-ev-yellow" : 
                "bg-ev-green/20 text-ev-green"
              )}
              animate={{ scale: currentAlertRate > 100 ? [1, 1.05, 1] : 1 }}
              transition={{ duration: 1, repeat: currentAlertRate > 100 ? Infinity : 0 }}
            >
              {currentAlertRate > 300 ? 'CRITICAL' : currentAlertRate > 100 ? 'HIGH' : 'NORMAL'}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Active Alerts by Type - Donut Chart */}
      <div className="glass-panel p-6 border-white/5 bg-white/[0.02]">
        <ChartHeader 
          title="Active Alerts by Type" 
          icon={<AlertCircle size={16} />}
          value={alerts.length}
          label="total alerts"
        />
        
        <div className="h-64 mt-4">
          {alertTypeData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={alertTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                  isAnimationActive={true}
                  animationDuration={800}
                >
                  {alertTypeData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={alertTypeColors[entry.name] || '#00d2ff'} 
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <Activity size={32} className="text-ev-green mb-2 opacity-50" />
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                No Active Alerts
              </p>
            </div>
          )}
        </div>

        {/* Alert Type Legend */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          {alertTypeData.slice(0, 4).map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: alertTypeColors[item.name] || '#00d2ff' }}
              />
              <div className="text-[9px]">
                <div className="text-slate-300 font-medium">{item.name}</div>
                <div className="text-slate-500">{item.value} alerts</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Vehicle Health Distribution - Pie Chart */}
      <div className="glass-panel p-6 border-white/5 bg-white/[0.02]">
        <ChartHeader 
          title="Vehicle Health Distribution" 
          icon={<Car size={16} />}
          value={Object.keys(vehicles).length}
          label="total vehicles"
        />
        
        <div className="h-64 mt-4">
          {healthDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={healthDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  isAnimationActive={true}
                  animationDuration={800}
                >
                  {healthDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <Wifi size={32} className="text-ev-green mb-2 opacity-50" />
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                All Vehicles Healthy
              </p>
            </div>
          )}
        </div>

        {/* Health Status Summary */}
        <div className="mt-4 space-y-2">
          {healthDistribution.map((item, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs text-slate-300">{item.name}</span>
              </div>
              <span className="text-sm font-black text-white">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Problem Vehicles - Ranked List */}
      <div className="glass-panel p-6 border-white/5 bg-white/[0.02]">
        <ChartHeader 
          title="Top Problem Vehicles" 
          icon={<Radio size={16} />}
          value={topVehicles.length}
          label="problematic vehicles"
        />
        
        <div className="mt-4 space-y-3 max-h-52 overflow-y-auto custom-scrollbar">
          {topVehicles.length > 0 ? (
            topVehicles.map((vehicle, index) => (
              <motion.div
                key={vehicle.vehicle_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-ev-blue/20 text-ev-blue text-[10px] font-black">
                    {index + 1}
                  </div>
                  <div>
                    <div className="text-xs font-black text-white">{vehicle.vehicle_id}</div>
                    <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                      {vehicle.alert_types?.substring(0, 20)}...
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {vehicle.critical_count > 0 && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-ev-red/20 text-ev-red text-[8px] font-black">
                      <AlertCircle size={8} />
                      {vehicle.critical_count}
                    </div>
                  )}
                  {vehicle.warning_count > 0 && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-ev-yellow/20 text-ev-yellow text-[8px] font-black">
                      <AlertTriangle size={8} />
                      {vehicle.warning_count}
                    </div>
                  )}
                  <div className="text-sm font-black text-white">
                    {vehicle.alert_count}
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-center">
              <Radio size={32} className="text-ev-blue mb-2 opacity-50" />
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                No Problem Vehicles
              </p>
              <p className="text-[9px] text-slate-600 mt-1">
                All vehicles operating normally
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ChartHeader = ({ title, icon, value, label }) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      <div className="p-1.5 rounded bg-white/5">
        {icon}
      </div>
      <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
        {title}
      </h3>
    </div>
    {value !== undefined && (
      <div className="text-right">
        <div className="text-lg font-black text-white">{value}</div>
        <div className="text-[8px] text-slate-500 uppercase tracking-wider">{label}</div>
      </div>
    )}
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-white/10 p-3 rounded shadow-2xl backdrop-blur-md">
        <p className="text-[10px] font-bold text-slate-500 mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-xs font-black" style={{ color: entry.color }}>
            {entry.name || entry.dataKey}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const CustomTimeTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const date = new Date(data.timestamp);
    return (
      <div className="bg-slate-900 border border-white/10 p-3 rounded shadow-2xl backdrop-blur-md">
        <p className="text-[10px] font-bold text-slate-500 mb-1">
          {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
        <p className="text-xs font-black text-ev-red">
          {data.count} alerts
        </p>
      </div>
    );
  }
  return null;
};

export default AlertVisualizationDashboard;