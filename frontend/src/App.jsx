import React, { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import Dashboard from './components/Dashboard'
import Login from './components/Login'

// DESIGN DECISION: Global axios interceptor for auth
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('ev_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function App() {
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem('ev_token');
    const user = JSON.parse(localStorage.getItem('ev_user') || '{}');
    return token ? { token, role: user.role } : null;
  });

  // Use a ref to track logout function to avoid stale closure in interceptor
  const logoutRef = useRef();

  const handleLogin = useCallback((token, role) => {
    setAuth({ token, role });
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('ev_token');
    localStorage.removeItem('ev_user');
    setAuth(null);
  }, []);

  // Keep the logout ref up to date
  useEffect(() => {
    logoutRef.current = handleLogout;
  }, [handleLogout]);

  // Global error handler for 401 Unauthorized
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.status === 401) {
          logoutRef.current?.();
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  return (
    <div className="App">
      {!auth ? (
        <Login onLogin={handleLogin} />
      ) : (
        <Dashboard user={auth} onLogout={handleLogout} />
      )}
    </div>
  )
}

export default App
