import React, { useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Shield, Lock, User, AlertCircle, Loader2, } from 'lucide-react';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
   
 

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post('/api/v1/auth/login', { username, password });
      
      const { token, role } = response.data.data;
      
      // DESIGN DECISION: Store token for API requests
      localStorage.setItem('ev_token', token);
      localStorage.setItem('ev_user', JSON.stringify({ username, role }));
      
      onLogin(token, role);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ev-dark flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-5">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-ev-blue rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-ev-green rounded-full blur-[100px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md glass-panel p-8 relative z-10 border-white/5 bg-white/[0.02]"
      >
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-ev-blue/10 rounded-2xl border border-ev-blue/20 mb-6 shadow-[0_0_20px_rgba(0,210,255,0.1)]">
            <Shield className="text-ev-blue" size={32} />
          </div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tighter italic">
            FLEET <span className="text-ev-blue">AUTHENTICATOR</span>
          </h1>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.3em] mt-2">Secure Operations Access</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
              <input 
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-sm text-white placeholder:text-slate-700 focus:outline-none focus:border-ev-blue/50 transition-all uppercase tracking-widest font-mono"
                placeholder="OPERATOR ID"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Access Key</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
              <input 
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-sm text-white placeholder:text-slate-700 focus:outline-none focus:border-ev-blue/50 transition-all font-mono"
                placeholder="••••••••"
              />
              
            </div>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-ev-red/10 border border-ev-red/30 p-3 rounded-lg flex items-center gap-3"
            >
              <AlertCircle className="text-ev-red shrink-0" size={16} />
              <p className="text-[10px] font-mono text-ev-red leading-tight uppercase tracking-tight">{error}</p>
            </motion.div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ev-blue text-ev-dark font-black py-4 rounded-lg uppercase tracking-[0.2em] italic text-xs hover:bg-ev-blue/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,210,255,0.3)] disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              'Initialize Access'
            )}
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-white/5">
          <p className="text-[9px] font-mono text-slate-600 text-center uppercase tracking-widest leading-relaxed">
            RESTRICTED ACCESS AREA<br/>
            UNAUTHORIZED ENTRY LOGGED PER PROTOCOL 84-C
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
