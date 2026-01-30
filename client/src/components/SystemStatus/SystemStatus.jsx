import React, { useState, useEffect, useRef } from 'react';
import './SystemStatus.css';

export default function SystemStatus({ isAppReady }) {
    const [statusData, setStatusData] = useState({ status: 'OK', timestamp: 0 });
    const [visible, setVisible] = useState(false);
    const [isManuallyHidden, setIsManuallyHidden] = useState(false); 
    const [version, setVersion] = useState('?');
    
    const lastTimestampRef = useRef(0);

    useEffect(() => {
        const fetchVersion = async () => {
            try {
                const res = await fetch('/api/system/version');
                const d = await res.json();
                setVersion(d.hash || d.build || "?");
            } catch (e) {}
        };
        if (isAppReady) fetchVersion();
    }, [isAppReady]);

    useEffect(() => {
        const interval = setInterval(async () => {
            if (!isAppReady) return; 
            try {
                const res = await fetch('/api/system/apply-status');
                const data = await res.json();
                setStatusData(data);

                if (data.timestamp !== lastTimestampRef.current) {
                    lastTimestampRef.current = data.timestamp;
                    setIsManuallyHidden(false); 
                    setVisible(true);
                } 
            } catch (e) {}
        }, 3000);
        return () => clearInterval(interval);
    }, [isAppReady]);

    if (!visible || isManuallyHidden) return null;

    return (
        <div className={`system-status-banner-flow bg-indigo-600 show`}>
            <div className="system-status-content-wrapper">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-black/30 px-2 py-0.5 rounded font-black tracking-widest">BUILD #{version}</span>
                    <span className="text-[11px] font-black uppercase">CONSOLE ADMIN OPÉRATIONNELLE</span>
                </div>
                <button onClick={() => setIsManuallyHidden(true)} className="bg-white/10 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black">✕</button>
            </div>
        </div>
    );
}