import React, { useState, useEffect, useRef } from 'react';
import Login from './features/auth/Login';
import AdminPage from './features/admin/AdminPage';
import SystemStatus from './components/SystemStatus/SystemStatus';
import './App.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false); 
  const bootIdRef = useRef(null);

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const res = await fetch('/api/check-deploy');
        if (!res.ok) return;
        const data = await res.json();
        
        if (!bootIdRef.current) {
            bootIdRef.current = data.bootId;
            setIsAppReady(true);
        } else if (data.bootId !== bootIdRef.current) {
            setIsSyncing(true);
            setIsAppReady(false);
            setTimeout(() => window.location.reload(), 1000);
        }
      } catch (e) {}
    };
    const timer = setInterval(checkUpdate, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('player');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            // FILTRE DE SÉCURITÉ : Uniquement Admin ou Dev
            if (parsed.role === 'admin' || parsed.isDeveloper) {
                setUser({ ...parsed, id: parsed._id || parsed.id });
            } else {
                localStorage.clear();
            }
        } catch(e) {
            localStorage.clear();
        }
    }
  }, []);

  const handleLogout = () => { 
      localStorage.clear(); 
      setUser(null); 
  };

  if (isSyncing) return (
    <div className="sync-overlay">
        <div className="text-center">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4 mx-auto"></div>
            <h2 className="text-white font-black uppercase tracking-tighter">Synchronisation Core...</h2>
        </div>
    </div>
  );
  
  if (!user) return (
      <div className="app-wrapper">
          <SystemStatus isAppReady={isAppReady} />
          <Login onLoginSuccess={setUser} />
      </div>
  );

  return (
    <div className="app-wrapper">
      <SystemStatus isAppReady={isAppReady} />
      <AdminPage user={user} onLogout={handleLogout} />
    </div>
  );
}