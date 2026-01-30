// @signatures: AdminPage, checkHealth, handleRefresh
import React, { useState, useEffect } from 'react';
import AdminDashboard from './AdminDashboard';
import DatabaseViewer from './components/DatabaseViewer'; // ✅ Importé ici maintenant
import './AdminPage.css';

export default function AdminPage({ user, onLogout }) {
  const [dbStatus, setDbStatus] = useState('LOADING'); 
  const [drive, setDrive] = useState({ ok: false, email: '', loading: true });
  const [showDB, setShowDB] = useState(false); // ✅ État géré ici pour la fusion

  const checkHealth = async () => {
      try {
          const resBoot = await fetch('/api/check-deploy');
          const dataBoot = await resBoot.json();
          setDbStatus(dataBoot.db === "CONNECTED" ? "OK" : "OFFLINE");

          const resDrive = await fetch('/api/admin/drive-check');
          const dataDrive = await resDrive.json();
          setDrive({ ok: dataDrive.ok, email: dataDrive.email, loading: false });
      } catch (e) {
          setDbStatus("OFFLINE");
          setDrive(prev => ({ ...prev, ok: false, loading: false }));
      }
  };

  useEffect(() => {
      checkHealth();
      const timer = setInterval(checkHealth, 10000);
      return () => clearInterval(timer);
  }, []);

  return (
    <div className="admin-page-wrapper">
      <div className="admin-header-bar">
        {/* --- GAUCHE : IDENTITÉ + BOUTON STATUT FUSIONNÉ --- */}
        <div className="flex items-center gap-6">
            <div className="admin-identity">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-black text-slate-800 uppercase tracking-tighter leading-none">
                        {user.firstName} {user.lastName}
                    </h1>
                    
                    {/* ✅ BOUTON-PASTILLE BDD FUSIONNÉ */}
                    <button 
                        onClick={() => setShowDB(true)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 transition-all active:scale-95 ${
                            dbStatus === 'OK' 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-500 hover:text-white' 
                            : (dbStatus === 'LOADING' ? 'bg-slate-50 border-slate-200 text-slate-400' : 'bg-red-50 border-red-200 text-red-600 animate-pulse')
                        }`}
                    >
                        <div className={`w-2 h-2 rounded-full ${dbStatus === 'OK' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                        <span className="text-[10px] font-black uppercase tracking-widest">📊 BDD</span>
                    </button>
                </div>

                <div className="flex items-center gap-3 mt-1.5 ml-0.5">
                    <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${drive.ok ? 'bg-purple-500' : 'bg-slate-300'}`}></div>
                        <span className="text-[9px] font-bold uppercase text-slate-300 tracking-wider">
                            {drive.ok ? `PRO : ${drive.email}` : 'DRIVE DÉCONNECTÉ'}
                        </span>
                    </div>
                </div>
            </div>
        </div>

        {/* --- DROITE : ICONE + DÉCONNEXION --- */}
        <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-xl shadow-lg">🛡️</div>
            <button onClick={onLogout} className="bg-white text-slate-400 hover:text-red-500 px-4 py-2 rounded-xl font-black text-[10px] border border-slate-200 transition-all uppercase tracking-widest">
                Déconnexion
            </button>
        </div>
      </div>
      
      <div className="admin-content-area">
        <AdminDashboard user={user} />
      </div>

      {/* ✅ LA MODALE EST MAINTENANT APPELÉE DEPUIS LE HEADER */}
      {showDB && <DatabaseViewer onClose={() => setShowDB(false)} />}
    </div>
  );
}