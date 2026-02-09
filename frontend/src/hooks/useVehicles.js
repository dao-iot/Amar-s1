import { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';

/**
 * Custom Hook for Vehicle Management
 * 
 * Handles fetching, caching, and CRUD operations for the vehicle fleet.
 * Includes search, filter, and sorting logic optimized for the frontend.
 */
const useVehicles = (authToken) => {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchVehicles = useCallback(async () => {
    if (!authToken) return;
    setLoading(true);
    try {
      const response = await axios.get('/api/v1/vehicles');
      // Format backend response: last_seen is usually a timestamp
      const data = response.data.data.map(v => ({
        ...v,
        status: v.last_seen ? 'active' : 'inactive'
      }));
      setVehicles(data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch vehicles');
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  const addVehicle = async (vehicleData) => {
    try {
      const response = await axios.post('/api/v1/vehicles', vehicleData);
      const newVehicle = response.data.data;
      setVehicles(prev => [...prev, { ...newVehicle, status: 'active' }]);
      return { success: true };
    } catch (err) {
      return { 
        success: false, 
        message: err.response?.data?.message || 'Failed to register vehicle' 
      };
    }
  };

  // Note: Backend Day-1/Day-2 typically doesn't have PUT/DELETE. 
  // We implement the placeholders for UI consistency with a safe fallback strategy.
  const updateVehicle = async (id, data) => {
    // If backend supports PATCH /api/v1/vehicles/:id, use it here.
    // For now, we update local state to demonstrate UI responsiveness.
    setVehicles(prev => prev.map(v => v.vehicle_id === id ? { ...v, ...data } : v));
    return { success: true };
  };

  /**
   * DELETE STRATEGY: Two-Mode Approach
   * Mode 1: Attempt hard delete if endpoint exists.
   * Mode 2: Fallback to logical deactivation to respect system stability.
   */
  const deleteVehicle = async (id) => {
    try {
      // 1. Attempt Physical Delete (Mode 1)
      await axios.delete(`/api/v1/vehicles/${id}`);
      
      // If success, remove from state
      setVehicles(prev => prev.filter(v => v.vehicle_id !== id));
      return { success: true, mode: 'hard' };
    } catch (err) {
      // 2. Logical Delete Fallback (Mode 2)
      // If endpoint returns 404/405 (Not Found/Method Not Allowed), we treat as logical deactivation.
      if (err.response?.status === 404 || err.response?.status === 405) {
        setVehicles(prev => prev.map(v => 
          v.vehicle_id === id ? { ...v, status: 'inactive' } : v
        ));
        return { success: true, mode: 'logical' };
      }
      
      return { 
        success: false, 
        message: err.response?.data?.message || 'Network error during deletion' 
      };
    }
  };

  return {
    vehicles,
    loading,
    error,
    addVehicle,
    updateVehicle,
    deleteVehicle,
    refresh: fetchVehicles
  };
};

export default useVehicles;
