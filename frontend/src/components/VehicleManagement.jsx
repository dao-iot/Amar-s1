import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, Search, Filter, ArrowUpDown, MoreVertical, 
  X, Info, Edit2, ShieldAlert, CheckCircle, Clock, Trash2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useVehicles from '../hooks/useVehicles';
import { cn } from '../utils/ui-utils';
import { formatRelativeTime } from '../utils/formatters';

/**
 * Vehicle Management Container
 * 
 * Separates CRUD management from live telemetry dashboard.
 * Visible only to Admin users.
 */
const VehicleManagement = ({ user, onClose }) => {
  const { vehicles, loading, error, addVehicle, updateVehicle, deleteVehicle } = useVehicles(user?.token);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, active, inactive
  const [sortConfig, setSortConfig] = useState({ key: 'vehicle_id', direction: 'asc' });
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState(null);

  const isAdmin = user?.role === 'admin';

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  /**
   * Performance: useMemo for filtering and sorting
   * Ensures the UI stays snappy with 50+ vehicles.
   */
  const filteredVehicles = useMemo(() => {
    return vehicles
      .filter(v => {
        const matchesSearch = v.vehicle_id.toLowerCase().includes(debouncedSearch.toLowerCase()) || 
                             (v.registration_number?.toLowerCase() || '').includes(debouncedSearch.toLowerCase());
        const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        const aVal = a[sortConfig.key] || '';
        const bVal = b[sortConfig.key] || '';
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
  }, [vehicles, debouncedSearch, statusFilter, sortConfig]);

  const toggleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleDelete = async () => {
    if (!selectedVehicle) return;
    setIsDeleting(true);
    const res = await deleteVehicle(selectedVehicle.vehicle_id);
    setIsDeleting(false);
    setIsConfirmOpen(false);
    
    // Performance decision: We stay in the registry view but update the list.
    // If it was a detail drawer that was open, we close it.
    if (res.success) {
      setIsDrawerOpen(false);
      setSelectedVehicle(null);
      
      // Show success notification with mode context
      if (res.mode === 'logical') {
        setToast({ 
          type: 'warning', 
          message: `${selectedVehicle.vehicle_id} marked as INACTIVE. DELETE endpoint not available—using logical deactivation.` 
        });
      } else {
        setToast({ 
          type: 'success', 
          message: `${selectedVehicle.vehicle_id} successfully removed from fleet registry.` 
        });
      }
    } else {
      setToast({ 
        type: 'error', 
        message: res.message || 'Failed to decommission vehicle.' 
      });
    }
  };

  return (
    <div className="flex flex-col h-full glass-panel border-white/5 bg-ev-dark/95 backdrop-blur-xl">
      {/* Header Area */}
      <div className="p-6 border-b border-white/5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white italic tracking-tighter uppercase">
            Asset <span className="text-ev-blue">Registry</span>
          </h2>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.3em] mt-1">Fleet Lifecycle Management</p>
        </div>
        <div className="flex items-center gap-4">
          {isAdmin && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-ev-blue text-ev-dark font-black px-4 py-2 rounded text-[10px] flex items-center gap-2 hover:bg-ev-blue/90 transition-all uppercase tracking-widest shadow-[0_0_15px_rgba(0,210,255,0.2)]"
            >
              <Plus size={14} /> Register Node
            </button>
          )}
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Control Bar */}
      <div className="p-4 bg-white/[0.02] border-b border-white/5 flex flex-wrap gap-4 items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
          <input 
            type="text"
            placeholder="SEARCH BY NODE ID OR REGISTRY NO..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-[10px] font-mono text-white placeholder:text-slate-700 focus:outline-none focus:border-ev-blue/30 transition-all uppercase tracking-widest"
          />
        </div>

        <div className="flex gap-2">
          {['all', 'active', 'inactive'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 py-1.5 rounded text-[9px] font-black transition-all border uppercase tracking-widest",
                statusFilter === s 
                  ? "bg-ev-blue/10 border-ev-blue/30 text-ev-blue" 
                  : "bg-white/5 border-white/5 text-slate-600 hover:text-slate-400"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table Area */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-ev-dark z-20 shadow-sm">
            <tr className="border-b border-white/10">
              <TableHead label="Node ID" sortKey="vehicle_id" currentSort={sortConfig} onSort={toggleSort} />
              <TableHead label="Model" sortKey="model" currentSort={sortConfig} onSort={toggleSort} />
              <TableHead label="Registration" sortKey="registration_number" currentSort={sortConfig} onSort={toggleSort} />
              <TableHead label="Status" />
              <TableHead label="Last Heartbeat" sortKey="last_seen" currentSort={sortConfig} onSort={toggleSort} />
              <th className="p-4 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <TableSkeleton />
            ) : filteredVehicles.length === 0 ? (
              <tr>
                <td colSpan="6" className="p-12 text-center">
                  <p className="text-xs font-mono text-slate-600 uppercase tracking-widest">No assets found in registry</p>
                </td>
              </tr>
            ) : (
              filteredVehicles.map(vehicle => (
                <VehicleRow 
                  key={vehicle.vehicle_id} 
                  vehicle={vehicle} 
                  onView={() => { setSelectedVehicle(vehicle); setIsDrawerOpen(true); }}
                  onEdit={() => { setSelectedVehicle(vehicle); setIsModalOpen(true); }}
                  onDelete={() => { setSelectedVehicle(vehicle); setIsConfirmOpen(true); }}
                  isAdmin={isAdmin}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Stat */}
      <div className="p-4 border-t border-white/5 bg-white/[0.01] flex justify-between items-center">
        <span className="text-[9px] font-mono text-slate-600 uppercase tracking-widest">
          Total Fleet Nodes: {vehicles.length}
        </span>
        <span className="text-[9px] font-mono text-slate-600 uppercase tracking-widest">
          Filtered Assets: {filteredVehicles.length}
        </span>
      </div>

      {/* Modals & Drawers */}
      <AnimatePresence>
        {isModalOpen && (
          <VehicleFormModal 
            onClose={() => { setIsModalOpen(false); setSelectedVehicle(null); }}
            onSubmit={selectedVehicle ? updateVehicle : addVehicle}
            initialData={selectedVehicle}
          />
        )}
        {isDrawerOpen && (
          <VehicleDetailsDrawer 
            vehicle={selectedVehicle} 
            onClose={() => { setIsDrawerOpen(false); setSelectedVehicle(null); }} 
            onDelete={() => setIsConfirmOpen(true)}
            isAdmin={isAdmin}
          />
        )}
        {isConfirmOpen && (
          <ConfirmModal 
            title="Decommission Node"
            message={`Are you sure you want to remove ${selectedVehicle?.vehicle_id} from the active fleet? Historical telemetry data will be preserved, but live tracking will cease.`}
            onConfirm={handleDelete}
            onCancel={() => { setIsConfirmOpen(false); setSelectedVehicle(null); }}
            loading={isDeleting}
          />
        )}
      </AnimatePresence>

      {/* Non-intrusive status indicator - Human Factors Compliant */}
      {toast && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed bottom-8 right-8 z-[80] max-w-xs"
        >
          <div className={cn(
            "glass-panel p-3 border text-[9px] font-mono uppercase tracking-tight",
            toast.type === 'success' && "border-ev-green/30 bg-ev-green/5 text-ev-green",
            toast.type === 'warning' && "border-ev-yellow/30 bg-ev-yellow/5 text-ev-yellow",
            toast.type === 'error' && "border-ev-red/30 bg-ev-red/5 text-ev-red"
          )}>
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full",
                toast.type === 'success' && "bg-ev-green",
                toast.type === 'warning' && "bg-ev-yellow",
                toast.type === 'error' && "bg-ev-red"
              )} />
              {toast.message}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

const TableHead = ({ label, sortKey, currentSort, onSort }) => (
  <th className="p-4 cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => sortKey && onSort(sortKey)}>
    <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
      {label}
      {sortKey && (
        <ArrowUpDown 
          size={12} 
          className={cn(
            "transition-colors",
            currentSort.key === sortKey ? "text-ev-blue" : "text-slate-700 group-hover:text-slate-500"
          )} 
        />
      )}
    </div>
  </th>
);

const VehicleRow = React.memo(({ vehicle, onView, onEdit, onDelete, isAdmin }) => (
  <tr className="hover:bg-white/[0.03] transition-colors group cursor-pointer" onClick={onView}>
    <td className="p-4">
      <div className="flex items-center gap-3">
        <div className={cn("w-1.5 h-1.5 rounded-full", vehicle.status === 'active' ? "bg-ev-green shadow-[0_0_8px_#00ff9d]" : "bg-slate-700")} />
        <span className="text-xs font-black text-white font-mono uppercase">{vehicle.vehicle_id}</span>
      </div>
    </td>
    <td className="p-4 text-[10px] font-mono text-slate-400 uppercase">{vehicle.model || 'N/A'}</td>
    <td className="p-4 text-[10px] font-mono text-slate-400 uppercase tracking-widest">{vehicle.registration_number || 'UNREGISTERED'}</td>
    <td className="p-4">
      <span className={cn(
        "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border",
        vehicle.status === 'active' ? "bg-ev-green/10 border-ev-green/20 text-ev-green" : "bg-slate-800/50 border-white/5 text-slate-500"
      )}>
        {vehicle.status}
      </span>
    </td>
    <td className="p-4 text-[10px] font-mono text-slate-500">{formatRelativeTime(vehicle.last_seen)}</td>
    <td className="p-4 text-right">
      <div className="flex justify-end gap-2">
        {isAdmin && (
          <>
            <button 
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="p-2 rounded hover:bg-white/10 text-slate-600 hover:text-ev-blue transition-all"
            >
              <Edit2 size={14} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-2 rounded hover:bg-white/10 text-slate-600 hover:text-ev-red transition-all"
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>
    </td>
  </tr>
));

const TableSkeleton = () => (
  <>
    {[1, 2, 3, 4, 5].map(i => (
      <tr key={i} className="animate-pulse">
        <td colSpan="6" className="p-4"><div className="h-4 bg-white/5 rounded w-full" /></td>
      </tr>
    ))}
  </>
);

const VehicleFormModal = ({ onClose, onSubmit, initialData }) => {
  const [formData, setFormData] = useState({
    vehicle_id: initialData?.vehicle_id || '',
    model: initialData?.model || '',
    registration_number: initialData?.registration_number || ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSumbit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const res = await onSubmit(initialData ? initialData.vehicle_id : formData, formData);
    if (res.success) onClose();
    else { setError(res.message); setLoading(false); }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md glass-panel p-8 border-white/5 bg-ev-dark shadow-2xl"
      >
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-xl font-black text-white italic tracking-tighter uppercase">
            {initialData ? 'Update' : 'Register'} <span className="text-ev-blue">Node</span>
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={20} /></button>
        </div>

        <form onSubmit={handleSumbit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Unique Identifier</label>
            <input 
              disabled={!!initialData}
              required
              value={formData.vehicle_id}
              onChange={e => setFormData({...formData, vehicle_id: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-sm text-white focus:outline-none focus:border-ev-blue/50 disabled:opacity-50 font-mono uppercase"
              placeholder="e.g., EV-1002"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Manufacturer Model</label>
            <input 
              value={formData.model}
              onChange={e => setFormData({...formData, model: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-sm text-white focus:outline-none focus:border-ev-blue/50 font-mono uppercase"
              placeholder="e.g., MODEL-X"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Registration Plate</label>
            <input 
              value={formData.registration_number}
              onChange={e => setFormData({...formData, registration_number: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-sm text-white focus:outline-none focus:border-ev-blue/50 font-mono uppercase"
              placeholder="e.g., ABC-1234"
            />
          </div>

          {error && (
            <div className="p-3 bg-ev-red/10 border border-ev-red/30 rounded-lg flex items-center gap-2 text-[10px] font-mono text-ev-red uppercase tracking-tight">
              <ShieldAlert size={14} /> {error}
            </div>
          )}

          <button 
            disabled={loading}
            className="w-full bg-ev-blue text-ev-dark font-black py-4 rounded-lg uppercase tracking-widest italic text-xs shadow-lg disabled:opacity-50"
          >
            {loading ? 'Processing Registry...' : initialData ? 'Commit Updates' : 'Initialize Node'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
};

const VehicleDetailsDrawer = ({ vehicle, onClose, onDelete, isAdmin }) => (
  <motion.div 
    initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25 }}
    className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-ev-dark/95 backdrop-blur-xl border-l border-white/10 z-[60] shadow-2xl p-8 flex flex-col"
  >
    <div className="flex justify-between items-center mb-12">
      <div className="flex items-center gap-3">
        <CheckCircle className="text-ev-green" size={20} />
        <div>
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Node Inspection</h3>
          <p className="text-xl font-black text-white italic tracking-tighter uppercase">{vehicle.vehicle_id}</p>
        </div>
      </div>
      <button onClick={onClose} className="p-2 bg-white/5 rounded-full text-slate-500 hover:text-white transition-all"><X size={20} /></button>
    </div>

    <div className="space-y-8 flex-1">
      <DetailSection title="Fleet Metadata">
        <DetailItem label="Model Protocol" value={vehicle.model || 'GENERIC'} />
        <DetailItem label="Registry Plate" value={vehicle.registration_number || 'UNASSIGNED'} />
        <DetailItem label="Current Status" value={vehicle.status.toUpperCase()} highlight={vehicle.status === 'active' ? 'text-ev-green' : 'text-slate-500'} />
      </DetailSection>

      <DetailSection title="Temporal Signatures">
        <DetailItem label="Node Initialization" value={new Date(vehicle.created_at).toLocaleString()} />
        <DetailItem label="Last Active Pulse" value={formatRelativeTime(vehicle.last_seen)} icon={<Clock size={10} />} />
      </DetailSection>

      <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center gap-4 border-dashed py-12">
        <ShieldAlert className="text-slate-800" size={32} />
        <p className="text-[10px] font-mono text-slate-600 uppercase text-center tracking-widest leading-relaxed">
          Historical telemetry logs are<br/>restricted to mission control views.
        </p>
      </div>
    </div>

    <div className="mt-auto space-y-3">
      {isAdmin && (
        <button 
          onClick={onDelete}
          className="w-full flex items-center justify-center gap-2 bg-ev-red/10 border border-ev-red/30 text-ev-red font-black py-4 rounded-lg uppercase tracking-widest text-[10px] hover:bg-ev-red/20 transition-all shadow-[0_0_15px_rgba(255,77,77,0.1)]"
        >
          <Trash2 size={14} /> Decommission Node
        </button>
      )}
      <button onClick={onClose} className="w-full border border-white/10 text-slate-400 font-black py-4 rounded-lg uppercase tracking-widest text-[10px] hover:bg-white/5 transition-all">
        Close Inspection
      </button>
    </div>
  </motion.div>
);

const ConfirmModal = ({ title, message, onConfirm, onCancel, loading }) => (
  <motion.div 
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
  >
    <motion.div 
      initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
      className="w-full max-w-sm glass-panel p-8 border-white/5 bg-ev-dark shadow-2xl text-center"
    >
      <div className="w-16 h-16 bg-ev-red/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-ev-red/20">
        <Trash2 size={24} className="text-ev-red" />
      </div>
      <h3 className="text-lg font-black text-white uppercase tracking-tight mb-2 italic">{title}</h3>
      <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest leading-relaxed mb-8">{message}</p>
      
      <div className="flex gap-4">
        <button 
          onClick={onCancel}
          className="flex-1 border border-white/10 text-slate-500 font-black py-3 rounded-lg uppercase tracking-widest text-[10px] hover:bg-white/5 transition-all"
        >
          Abort
        </button>
        <button 
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 bg-ev-red text-white font-black py-3 rounded-lg uppercase tracking-widest text-[10px] hover:bg-ev-red/90 transition-all shadow-[0_0_20px_rgba(255,77,77,0.3)] disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Confirm'}
        </button>
      </div>
    </motion.div>
  </motion.div>
);

const DetailSection = ({ title, children }) => (
  <div className="space-y-4">
    <h4 className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] border-b border-white/5 pb-2">{title}</h4>
    <div className="grid grid-cols-1 gap-4">{children}</div>
  </div>
);

const DetailItem = ({ label, value, highlight = 'text-white', icon }) => (
  <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5">
    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest block mb-1">{label}</span>
    <span className={cn("text-xs font-mono font-black flex items-center gap-2", highlight)}>
      {icon} {value}
    </span>
  </div>
);

export default VehicleManagement;
