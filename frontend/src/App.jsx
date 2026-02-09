import React, { useState, useEffect } from 'react'
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

  const handleLogin = (token, role) => {
    setAuth({ token, role });
  };

  const handleLogout = () => {
    localStorage.removeItem('ev_token');
    localStorage.removeItem('ev_user');
    setAuth(null);
  };

  // Global error handler for 401 Unauthorized
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.status === 401) {
          handleLogout();
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
