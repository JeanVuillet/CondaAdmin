import React, { useState, useEffect, useRef } from 'react';
import Login from './features/auth/Login';
import AdminPage from './features/admin/AdminPage';
import ProfPage from './features/prof/ProfPage';
import ElevePage from './features/eleve/ElevePage';
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
            setUser({ ...parsed, id: parsed._id || parsed.id });
        } catch(e) {
            localStorage.removeItem('player');
        }
    }
  }, []);

  const handleLogout = () => { 
      localStorage.clear(); 
      setUser(null); 
  };

  if (isSyncing) return <div className="sync-overlay"><h2 style={{color:'white', fontWeight:900}}>RÉTABLISSEMENT DE LA CONNEXION...</h2></div>;
  
  if (!user) return (
      <div className="app-wrapper">
          <SystemStatus isAppReady={isAppReady} />
          <Login onLoginSuccess={setUser} />
      </div>
  );

  return (
    <div className="app-wrapper">
      <SystemStatus isAppReady={isAppReady} />
      {user.role === 'admin' || user.isDeveloper ? (
          <AdminPage user={user} onLogout={handleLogout} />
      ) : (user.role === 'prof' ? (
          <ProfPage user={user} onLogout={handleLogout} />
      ) : (
          <ElevePage user={user} onLogout={handleLogout} />
      ))}
    </div>
  );
}