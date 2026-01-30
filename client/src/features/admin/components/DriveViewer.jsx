import React, { useState, useEffect } from 'react';
import './DriveViewer.css';

export default function DriveViewer({ onClose }) {
    const [tree, setTree] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/structure/drive-tree')
            .then(res => res.json())
            .then(d => { setTree(d); setLoading(false); });
    }, []);

    return (
        <div className="drive-viewer-overlay" onClick={onClose}>
            <div className="drive-viewer-window" onClick={e => e.stopPropagation()}>
                <div className="drive-header p-6 bg-slate-900 text-white flex justify-between items-center">
                    <h2 className="font-black uppercase">Archive Cloud Condamine</h2>
                    <button onClick={onClose} className="text-2xl">✕</button>
                </div>
                <div className="p-10 overflow-auto flex-1">
                    {loading ? <div className="animate-pulse text-indigo-600 font-black">SCAN DU DRIVE...</div> : (
                        <div className="space-y-2">
                            {tree?.children?.map(child => (
                                <div key={child.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                    <span className="text-xl">{child.type === 'folder' ? '📁' : '📄'}</span>
                                    <span className="font-bold text-slate-700">{child.name}</span>
                                    <a href={child.link} target="_blank" rel="noreferrer" className="ml-auto text-indigo-500 font-black text-[10px]">OUVRIR</a>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}