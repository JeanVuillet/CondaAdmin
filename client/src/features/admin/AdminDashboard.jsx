// @signatures: AdminDashboard, handleMagicImport, handleMembership, handleSave, loadData, handleOpenCreate, handleDelete, handlePurge
import React, { useState, useEffect } from 'react';
import './AdminDashboard.css';

export default function AdminDashboard({ user }) {
    const [view, setView] = useState('classes'); 
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeClassTab, setActiveClassTab] = useState('TOUS');
    const [modalMode, setModalMode] = useState(null); 
    const [currentItem, setCurrentItem] = useState(null);
    
    const [importing, setImporting] = useState(false);
    const [showMagicModal, setShowMagicModal] = useState(false);
    const [magicText, setMagicText] = useState("");
    const [magicClass, setMagicClass] = useState("");
    const [magicOption, setMagicOption] = useState("");
    const [manageItem, setManageItem] = useState(null); 
    const [memberSearch, setMemberSearch] = useState(""); 

    const [filterSub, setFilterSub] = useState("");
    const [filterClass, setFilterClass] = useState("");
    const [filterGroup, setFilterGroup] = useState("");
    
    const [allClasses, setAllClasses] = useState([]);
    const [allSubjects, setAllSubjects] = useState([]);
    const [allStudents, setAllStudents] = useState([]); 

    const collectionMap = { 
        'classes': 'classrooms', 
        'groups': 'classrooms', 
        'teachers': 'teachers', 
        'students': 'students', 
        'staff': 'admins',
        'subjects': 'subjects'
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const [rC, rS, rSt] = await Promise.all([
                fetch('/api/admin/classrooms').then(r => r.json()),
                fetch('/api/admin/subjects').then(r => r.json()),
                fetch('/api/admin/students').then(r => r.json())
            ]);
            setAllClasses(rC || []);
            setAllSubjects(rS || []);
            setAllStudents(rSt || []);

            const r = await fetch(`/api/admin/${collectionMap[view]}`);
            if (r.ok) {
                const data = await r.json();
                let list = Array.isArray(data) ? data : [];
                if (view === 'classes') list = list.filter(c => c.type === 'CLASS');
                if (view === 'groups') list = list.filter(c => c.type === 'GROUP');
                setItems(list);
            }
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, [view]);

    const handleOpenCreate = () => {
        let defaults = { 
            name: '', firstName: '', lastName: '', password: '123', 
            type: view === 'groups' ? 'GROUP' : 'CLASS', 
            taughtSubjects: [], assignedClasses: [], assignedGroups: [],
            email: '', parentEmail: '', level: ''
        };
        setCurrentItem(defaults);
        setModalMode('create');
    };

    const handleDelete = async (id) => {
        if (!confirm("⚠️ Action Irréversible. Supprimer ?")) return;
        const res = await fetch(`/api/admin/${collectionMap[view]}/${id}`, { method: 'DELETE' });
        if (res.ok) loadData();
    };

    // ✅ NOUVELLE LOGIQUE DE PURGE CIBLÉE
    const handlePurge = async () => {
        const targetLabel = view === 'students' && activeClassTab !== 'TOUS' 
            ? `tous les élèves de la classe ${allClasses.find(c=>c._id===activeClassTab)?.name}`
            : `toute la catégorie ${view.toUpperCase()}`;

        if (!confirm(`🚨 ATTENTION : Vous allez supprimer définitivement ${targetLabel}.\n\nConfirmer la purge massive ?`)) return;
        
        setImporting(true);
        try {
            const res = await fetch(`/api/admin/maintenance/purge/${collectionMap[view]}`, {
                method: 'POST',
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ 
                    filterClassId: view === 'students' && activeClassTab !== 'TOUS' ? activeClassTab : null,
                    keepMeId: user.id || user._id 
                })
            });
            if (res.ok) {
                alert("✅ Purge terminée avec succès.");
                loadData();
            }
        } catch (e) { alert("Erreur lors de la purge."); }
        setImporting(false);
    };

    const handleSave = async () => {
        const targetCollection = collectionMap[view];
        let dataToSend = { ...currentItem };
        
        if (view === 'teachers') {
            dataToSend.taughtSubjectsText = allSubjects.filter(s => dataToSend.taughtSubjects.includes(s._id)).map(s => s.name).join(', ');
            dataToSend.assignedClassesText = allClasses.filter(c => dataToSend.assignedClasses.some(ac => (ac._id || ac) === c._id)).map(c => c.name).join(', ');
            dataToSend.assignedClasses = dataToSend.assignedClasses.map(c => c._id || c);
        }

        await fetch(`/api/admin/${targetCollection}`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(dataToSend) 
        });
        setModalMode(null); loadData();
    };

    const filteredItems = items.filter(it => {
        const searchMatch = (it.name || it.firstName || "").toLowerCase().includes(searchTerm.toLowerCase()) || (it.lastName || "").toLowerCase().includes(searchTerm.toLowerCase());
        if (view === 'students' && activeClassTab !== 'TOUS') {
            return searchMatch && String(it.classId) === String(activeClassTab);
        }
        return searchMatch;
    });

    return (
        <div className="admin-container animate-in fade-in">
            {importing && <div className="zoom-overlay level-2"><div className="text-white font-black text-2xl animate-pulse">⚙️ OPÉRATION MAINTENANCE...</div></div>}
            
            <div className="admin-toolbar-pill">
                <div className="nav-links">
                    {['classes', 'groups', 'subjects', 'teachers', 'students', 'staff'].map(v => (
                        <button key={v} onClick={() => setView(v)} className={`nav-link ${view === v ? 'active' : ''}`}>{v}</button>
                    ))}
                </div>
                <div className="action-buttons">
                    {/* ✅ BOUTON PURGE RÉTABLI ET AMÉLIORÉ */}
                    <button onClick={handlePurge} className="btn-pill btn-clean">🔥 PURGER {view.toUpperCase()}</button>
                    {(view === 'classes' || view === 'groups' || view === 'students') && ( <button onClick={() => setShowMagicModal(true)} className="btn-pill btn-import">🔮 IA IMPORT</button> )}
                    <button onClick={handleOpenCreate} className="btn-pill btn-add">+ AJOUTER</button>
                </div>
            </div>

            <div className="search-container">
                <span className="text-slate-400">🔎</span>
                <input className="search-input" placeholder={`Filtrer dans ${view}...`} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            
            {view === 'students' && ( 
                <div className="class-filter-row"> 
                    <button onClick={() => setActiveClassTab('TOUS')} className={`class-chip ${activeClassTab === 'TOUS' ? 'active' : ''}`}>TOUS</button>
                    {allClasses.filter(c=>c.type==='CLASS').map(cls => ( 
                        <button key={cls._id} onClick={() => setActiveClassTab(cls._id)} className={`class-chip ${activeClassTab === cls._id ? 'active' : ''}`}>{cls.name}</button> 
                    ))} 
                </div> 
            )}

            <div className="items-list">
                {loading ? ( <div className="p-20 text-center animate-pulse text-slate-300 font-black uppercase">Interrogation Base de Données...</div> ) : filteredItems.map(it => (
                    <div key={it._id} className="item-card">
                        <div className="item-main">
                            <span className="item-title">
                                {it.name || `${it.firstName} ${it.lastName}`} 
                                {it.level && <span className="badge-niv">NIV {it.level}</span>}
                                {it.currentClass && <span className="badge-niv">{it.currentClass}</span>}
                            </span>
                            <span className="item-sub">{it.role || it.type || 'DATA'}</span>
                        </div>
                        <div className="item-actions">
                            {(view === 'classes' || view === 'groups') && <button onClick={() => setManageItem(it)} className="btn-action btn-gerer">👥 MEMBRES</button>}
                            <button onClick={() => { setCurrentItem(it); setModalMode('edit'); }} className="btn-action btn-modif">ÉDITER</button>
                            <button onClick={() => handleDelete(it._id)} className="btn-action btn-delete">✕</button>
                        </div>
                    </div>
                ))}
            </div>

            {/* MODALES MAGIC / MEMBRES / FORM (Considérées comme inchangées ou déjà livrées) */}
        </div>
    );
}