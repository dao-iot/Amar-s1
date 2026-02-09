import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-white/10 p-2 rounded shadow-2xl backdrop-blur-md">
        <p className="text-[10px] font-bold text-slate-500 mb-1">{payload[0].payload.time}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-xs font-black" style={{ color: entry.color }}>
            {entry.name.toUpperCase()}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const Charts = ({ data, vehicleId }) => {
  if (!vehicleId) {
    return (
      <div className="h-[400px] flex items-center justify-center border border-white/5 rounded-xl bg-white/[0.02]">
        <p className="text-xs font-mono text-slate-500 uppercase tracking-[0.2em] animate-pulse">
          Initialize Asset Selection for Analytics
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <ChartCard title="VELOCITY OVER TIME (KM/H)" data={data} dataKey="speed" color="#00d2ff" />
      <ChartCard title="POTENTIAL GRADIENT (VOLTS)" data={data} dataKey="battery_voltage" color="#ffcc00" domain={['auto', 'auto']} />
    </div>
  );
};

const ChartCard = ({ title, data, dataKey, color, domain = [0, 'auto'] }) => (
  <div className="glass-panel p-6 border-white/5 hover:border-white/10 transition-colors">
    <div className="flex items-center justify-between mb-6">
      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
        {title}
      </h4>
      <div className="flex gap-1">
        <div className="w-8 h-1 bg-white/5 rounded-full" />
        <div className="w-4 h-1 bg-white/10 rounded-full" />
      </div>
    </div>
    
    <div className="h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`color-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={color} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
          <XAxis 
            dataKey="time" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#475569', fontSize: 9, fontWeight: 700 }}
            interval="preserveStartEnd"
          />
          <YAxis 
            hide 
            domain={domain}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area 
            type="monotone" 
            dataKey={dataKey} 
            stroke={color} 
            strokeWidth={3}
            fillOpacity={1} 
            fill={`url(#color-${dataKey})`} 
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </div>
);

export default Charts;
