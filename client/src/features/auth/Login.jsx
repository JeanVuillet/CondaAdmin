import React, { useState } from 'react';
import './Login.css';

export default function Login({ onLoginSuccess }) {
  const [fName, setFName] = useState('');
  const [lName, setLName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ 
                role: 'ADMIN', 
                firstName: fName, 
                lastName: lName, 
                password 
            })
        });
        const data = await res.json();
        
        if (res.ok) {
            // Verrouillage final côté client
            if (data.user.role === 'admin' || data.user.isDeveloper) {
                localStorage.setItem('player', JSON.stringify(data.user));
                onLoginSuccess(data.user);
            } else {
                alert("Accès restreint aux administrateurs.");
            }
        } else {
            alert(data.message || "Identifiants administrateur invalides.");
        }
    } catch(e) { 
        alert("Serveur hors ligne."); 
    }
    setLoading(false);
  };

  return (
    <div className="login-screen bg-slate-900">
      <div className="login-card narrow !bg-slate-800 border border-slate-700 shadow-2xl">
        <div className="mb-8">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-3xl shadow-xl shadow-indigo-500/20 mx-auto mb-4">🛡️</div>
            <h1 className="app-logo !text-white !mb-1">Condamine <span className="text-indigo-400">Core</span></h1>
            <p className="app-subtitle !text-slate-400">Terminal d'Administration</p>
        </div>

        <form onSubmit={handleLogin} className="login-inputs">
            <div className="space-y-3">
                <input 
                    className="login-field !bg-slate-700 !border-slate-600 !text-white focus:!border-indigo-500" 
                    placeholder="Prénom" 
                    value={fName} 
                    onChange={e=>setFName(e.target.value)} 
                    required 
                />
                <input 
                    className="login-field !bg-slate-700 !border-slate-600 !text-white focus:!border-indigo-500" 
                    placeholder="Nom" 
                    value={lName} 
                    onChange={e=>setLName(e.target.value)} 
                    required 
                />
                <div className="relative">
                    <input 
                        type={showPass ? "text" : "password"} 
                        className="login-field !bg-slate-700 !border-slate-600 !text-white focus:!border-indigo-500" 
                        placeholder="Mot de passe" 
                        value={password} 
                        onChange={e=>setPassword(e.target.value)} 
                        required 
                    />
                    <button 
                        type="button" 
                        onClick={() => setShowPass(!showPass)} 
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-500 hover:text-indigo-400 uppercase"
                    >
                        {showPass ? "Masquer" : "Voir"}
                    </button>
                </div>
            </div>

            <button className="login-submit-btn !bg-indigo-600 hover:!bg-indigo-500 !mt-6 shadow-lg shadow-indigo-600/10" disabled={loading}>
                {loading ? 'Validation Kernel...' : 'Authentification'}
            </button>
        </form>
        
        <div className="mt-8 flex items-center justify-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em]">
                Project Condamine v2.0 • Admin Console
            </span>
        </div>
      </div>
    </div>
  );
}