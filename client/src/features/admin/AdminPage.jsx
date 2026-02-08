import React, { useState } from 'react'; // Ajout useState
import AdminDashboard from './AdminDashboard';
import DatabaseViewer from './components/DatabaseViewer'; // Réintégration
import './AdminPage.css';

export default function AdminPage({ user, onLogout }) {
  const [showDB, setShowDB] = useState(false);

  return (
    <div className="admin-page-wrapper">
      <div className="admin-header-bar">
        {/* --- IDENTITÉ --- */}
        <div className="flex items-center gap-6">
            <div className="admin-identity">
                <h1 className="text-xl font-black text-slate-800 uppercase tracking-tighter leading-none">
                    {user.firstName} {user.lastName}
                </h1>
                <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                        Administrateur Établissement
                    </span>
                    {/* BOUTON BDD RÉTABLI */}
                    <button 
                        onClick={() => setShowDB(true)}
                        className="bg-slate-100 text-slate-500 hover:bg-indigo-100 hover:text-indigo-600 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border border-slate-200 transition-colors"
                    >
                        📊 Voir BDD
                    </button>
                </div>
            </div>
        </div>

        {/* --- DÉCONNEXION --- */}
        <div className="flex items-center gap-4">
            <button onClick={onLogout} className="bg-white text-slate-400 hover:text-red-500 px-4 py-2 rounded-xl font-black text-[10px] border border-slate-200 transition-all uppercase tracking-widest">
                Déconnexion
            </button>
        </div>
      </div>
      
      <div className="admin-content-area">
        <AdminDashboard user={user} />
      </div>

      {/* MODALE BDD */}
      {showDB && <DatabaseViewer onClose={() => setShowDB(false)} />}
    </div>
  );
}