// @signatures: DatabaseViewer, renderCell, handleCellClick
import React, { useState, useEffect } from 'react';
import './DatabaseViewer.css';

export default function DatabaseViewer({ onClose }) {
    const [data, setData] = useState(null);
    const [activeTab, setActiveTab] = useState('');
    const [loading, setLoading] = useState(true);
    // ✅ État pour l'inspection d'une cellule
    const [inspecting, setInspecting] = useState(null);

    useEffect(() => {
        fetch('/api/admin/database-dump')
            .then(res => res.json())
            .then(d => { 
                setData(d); 
                const keys = Object.keys(d || {});
                if (keys.length > 0) setActiveTab(keys[0]);
                setLoading(false); 
            });
    }, []);

    if (loading) return <div className="db-viewer-overlay"><h2 className="text-white font-black animate-pulse">CHARGEMENT BDD...</h2></div>;

    const currentData = data[activeTab] || [];
    const allKeys = new Set();
    currentData.forEach(row => Object.keys(row).forEach(k => { if(k !== '__v') allKeys.add(k); }));
    const columns = Array.from(allKeys);

    const handleCellClick = (val, colName) => {
        if (val === null || val === undefined) return;
        setInspecting({ title: colName, content: val });
    };

    return (
        <div className="db-viewer-overlay" onClick={onClose}>
            {/* 🔍 INSPECTEUR DE CELLULE (MODALE NIVEAU 2) */}
            {inspecting && (
                <div className="db-inspector-overlay" onClick={(e) => { e.stopPropagation(); setInspecting(null); }}>
                    <div className="db-inspector-box animate-in zoom-in" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Détail du champ : {inspecting.title}</span>
                            <button onClick={() => setInspecting(null)} className="text-slate-400 hover:text-slate-900 font-bold">FERMER</button>
                        </div>
                        <pre className="db-inspector-content custom-scrollbar">
                            {typeof inspecting.content === 'object' 
                                ? JSON.stringify(inspecting.content, null, 2) 
                                : String(inspecting.content)}
                        </pre>
                        <button onClick={() => {
                            navigator.clipboard.writeText(typeof inspecting.content === 'object' ? JSON.stringify(inspecting.content) : inspecting.content);
                            alert("Copié !");
                        }} className="mt-4 w-full py-2 bg-slate-100 text-slate-600 rounded-lg font-black text-[10px] uppercase hover:bg-indigo-50">Copier la valeur</button>
                    </div>
                </div>
            )}

            <div className="db-viewer-window" onClick={e => e.stopPropagation()}>
                <div className="db-header">
                    <div>
                        <h2 className="font-black uppercase text-xl text-slate-800">Explorateur MongoDB</h2>
                        <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Mode Interactif : Cliquez sur une case pour l'étendre</span>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 bg-slate-100 rounded-full font-black hover:bg-red-500 hover:text-white transition-all">✕</button>
                </div>
                
                <div className="db-tabs no-scrollbar flex gap-2 p-4 bg-slate-50 border-b overflow-x-auto">
                    {Object.keys(data).sort().map(c => (
                        <button key={c} onClick={() => setActiveTab(c)} className={`px-4 py-2 rounded-xl text-[10px] font-black whitespace-nowrap transition-all ${activeTab === c ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-200'}`}>
                            {c.toUpperCase()} ({data[c]?.length || 0})
                        </button>
                    ))}
                </div>

                <div className="db-table-container flex-1 overflow-auto custom-scrollbar">
                    <table className="db-table-clean">
                        <thead>
                            <tr>
                                {columns.map(col => <th key={col}>{col.toUpperCase()}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {currentData.map((row, i) => (
                                <tr key={i}>
                                    {columns.map(col => {
                                        const val = row[col];
                                        const isObj = typeof val === 'object' && val !== null;
                                        return (
                                            <td key={col} onClick={() => handleCellClick(val, col)} className="db-interactive-cell">
                                                <div className="db-cell-wrapper">
                                                    {isObj ? `{ Object }` : (val === null || val === undefined ? '-' : String(val))}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {currentData.length === 0 && <div className="p-20 text-center text-slate-300 font-bold uppercase italic">Collection vide</div>}
                </div>
            </div>
        </div>
    );
}