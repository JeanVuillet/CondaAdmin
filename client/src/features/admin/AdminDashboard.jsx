import React, { useState, useEffect } from 'react';
import './AdminDashboard.css';

export default function AdminDashboard({ user }) {
    const [view, setView] = useState('classes'); 
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeClassTab, setActiveClassTab] = useState('TOUS');
    
    // États des Modales
    const [modalMode, setModalMode] = useState(null); 
    const [currentItem, setCurrentItem] = useState(null);
    const [manageItem, setManageItem] = useState(null); 
    
    // États Magic Import
    const [importing, setImporting] = useState(false);
    const [showMagicModal, setShowMagicModal] = useState(false);
    const [magicText, setMagicText] = useState("");
    
    // Données Globales
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

    // --- HANDLERS ---

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
        await fetch(`/api/admin/${collectionMap[view]}/${id}`, { method: 'DELETE' });
        loadData();
    };

    const handlePurge = async () => {
        const targetLabel = view === 'students' && activeClassTab !== 'TOUS' 
            ? `tous les élèves de la classe ${allClasses.find(c=>c._id===activeClassTab)?.name}`
            : `toute la catégorie ${view.toUpperCase()}`;

        if (!confirm(`🚨 ATTENTION : Vous allez supprimer définitivement ${targetLabel}.\n\nConfirmer la purge massive ?`)) return;
        
        setImporting(true);
        try {
            await fetch(`/api/admin/maintenance/purge/${collectionMap[view]}`, {
                method: 'POST',
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ 
                    filterClassId: view === 'students' && activeClassTab !== 'TOUS' ? activeClassTab : null,
                    keepMeId: user.id || user._id 
                })
            });
            alert("✅ Purge terminée.");
            loadData();
        } catch (e) { alert("Erreur purge."); }
        setImporting(false);
    };

    const handleSave = async () => {
        const targetCollection = collectionMap[view];
        let dataToSend = { ...currentItem };
        
        // Logique spéciale Profs
        if (view === 'teachers') {
            dataToSend.taughtSubjects = (dataToSend.taughtSubjects || []).map(s => s._id || s);
            dataToSend.assignedClasses = (dataToSend.assignedClasses || []).map(c => c._id || c);
            
            dataToSend.taughtSubjectsText = allSubjects
                .filter(s => dataToSend.taughtSubjects.includes(s._id))
                .map(s => s.name).join(', ');
            
            dataToSend.assignedClassesText = allClasses
                .filter(c => dataToSend.assignedClasses.includes(c._id))
                .map(c => c.name).join(', ');
        }

        if (view === 'students' && dataToSend.assignedGroups) {
             dataToSend.assignedGroups = dataToSend.assignedGroups.map(g => g._id || g);
        }

        await fetch(`/api/admin/${targetCollection}`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(dataToSend) 
        });
        setModalMode(null); loadData();
    };

    const handleMagicImport = async () => {
        setImporting(true);
        setTimeout(() => {
            setImporting(false);
            setShowMagicModal(false);
            alert("⚠️ Fonction IA en cours de maintenance. Utilisez l'ajout manuel.");
        }, 1000);
    };

    const filteredItems = items.filter(it => {
        const searchMatch = (it.name || it.firstName || "").toLowerCase().includes(searchTerm.toLowerCase()) || (it.lastName || "").toLowerCase().includes(searchTerm.toLowerCase());
        if (view === 'students' && activeClassTab !== 'TOUS') {
            return searchMatch && String(it.classId) === String(activeClassTab);
        }
        return searchMatch;
    });

    // Helper pour ajouter une entité (ID) à une liste dans currentItem
    const addItemToList = (field, id) => {
        if (!id) return;
        const currentList = (currentItem[field] || []).map(x => x._id || x);
        if (!currentList.includes(id)) {
            setCurrentItem({ ...currentItem, [field]: [...currentList, id] });
        }
    };

    // Helper pour retirer une entité
    const removeItemFromList = (field, id) => {
        const currentList = (currentItem[field] || []).map(x => x._id || x);
        setCurrentItem({ ...currentItem, [field]: currentList.filter(x => x !== id) });
    };

    // --- RENDER ---

    return (
        <div className="admin-container animate-in fade-in">
            {importing && <div className="zoom-overlay level-2"><div className="text-white font-black text-2xl animate-pulse">⚙️ TRAITEMENT EN COURS...</div></div>}
            
            {/* TOOLBAR */}
            <div className="admin-toolbar-pill">
                <div className="nav-links">
                    {['classes', 'groups', 'subjects', 'teachers', 'students', 'staff'].map(v => (
                        <button key={v} onClick={() => setView(v)} className={`nav-link ${view === v ? 'active' : ''}`}>{v}</button>
                    ))}
                </div>
                <div className="action-buttons">
                    <button onClick={handlePurge} className="btn-pill btn-clean">🔥 PURGER</button>
                    {(view === 'classes' || view === 'groups' || view === 'students') && ( <button onClick={() => setShowMagicModal(true)} className="btn-pill btn-import">🔮 IA IMPORT</button> )}
                    <button onClick={handleOpenCreate} className="btn-pill btn-add">+ AJOUTER</button>
                </div>
            </div>

            {/* RECHERCHE */}
            <div className="search-container">
                <span className="text-slate-400">🔎</span>
                <input className="search-input" placeholder={`Filtrer dans ${view}...`} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            
            {/* FILTRES ÉLÈVES */}
            {view === 'students' && ( 
                <div className="class-filter-row"> 
                    <button onClick={() => setActiveClassTab('TOUS')} className={`class-chip ${activeClassTab === 'TOUS' ? 'active' : ''}`}>TOUS</button>
                    {allClasses.filter(c=>c.type==='CLASS').map(cls => ( 
                        <button key={cls._id} onClick={() => setActiveClassTab(cls._id)} className={`class-chip ${activeClassTab === cls._id ? 'active' : ''}`}>{cls.name}</button> 
                    ))} 
                </div> 
            )}

            {/* LISTE DES ITEMS */}
            <div className="items-list">
                {loading ? ( <div className="p-20 text-center animate-pulse text-slate-300 font-black uppercase">Chargement...</div> ) : filteredItems.map(it => (
                    <div key={it._id} className="item-card">
                        <div className="item-main">
                            <span className="item-title">
                                {it.name || `${it.firstName} ${it.lastName}`} 
                                {it.level && <span className="badge-niv">NIV {it.level}</span>}
                                {it.currentClass && <span className="badge-niv">{it.currentClass}</span>}
                            </span>
                            <span className="item-sub">
                                {view === 'teachers' 
                                    ? (it.taughtSubjectsText || 'Aucune matière') + ' • ' + (it.assignedClassesText || 'Aucune classe')
                                    : (it.role || it.type || 'DATA')}
                            </span>
                        </div>
                        <div className="item-actions">
                            {(view === 'classes' || view === 'groups') && <button onClick={() => setManageItem(it)} className="btn-action btn-gerer">👥 MEMBRES</button>}
                            <button onClick={() => { setCurrentItem(it); setModalMode('edit'); }} className="btn-action btn-modif">ÉDITER</button>
                            <button onClick={() => handleDelete(it._id)} className="btn-action btn-delete">✕</button>
                        </div>
                    </div>
                ))}
            </div>

            {/* 1. MODALE MEMBRES */}
            {manageItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4" onClick={() => setManageItem(null)}>
                    <div className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-black text-lg uppercase text-slate-700 flex items-center gap-2">
                                <span className="text-2xl">👥</span>
                                <span>MEMBRES : <span className="text-indigo-600">{manageItem.name}</span></span>
                            </h3>
                            <button onClick={() => setManageItem(null)} className="w-8 h-8 rounded-full bg-white hover:bg-red-50 text-slate-400 hover:text-red-500 font-black transition-colors">✕</button>
                        </div>
                        <div className="p-0 h-96 overflow-y-auto custom-scrollbar bg-white">
                            {allStudents.filter(s => String(s.classId) === String(manageItem._id) || (s.assignedGroups && s.assignedGroups.includes(manageItem._id))).length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-4">
                                    <span className="text-6xl grayscale opacity-20">👻</span>
                                    <span className="font-bold text-xs uppercase tracking-widest">Aucun élève dans ce groupe</span>
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50 sticky top-0 z-10 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                        <tr>
                                            <th className="p-4 border-b pl-6">Nom de l'élève</th>
                                            <th className="p-4 border-b text-right pr-6">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {allStudents.filter(s => String(s.classId) === String(manageItem._id) || (s.assignedGroups && s.assignedGroups.includes(manageItem._id))).map(s => (
                                            <tr key={s._id} className="hover:bg-indigo-50/50 transition-colors group cursor-pointer" onClick={() => { setManageItem(null); setCurrentItem(s); setView('students'); setModalMode('edit'); }}>
                                                <td className="p-3 pl-6">
                                                    <div className="font-bold text-slate-700 text-sm">{s.lastName} {s.firstName}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono">{s.email}</div>
                                                </td>
                                                <td className="p-3 text-right pr-6">
                                                    <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[9px] font-black text-slate-400 uppercase group-hover:bg-indigo-600 group-hover:text-white group-hover:border-transparent transition-all">
                                                        Voir Fiche
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                Total : {allStudents.filter(s => String(s.classId) === String(manageItem._id) || (s.assignedGroups && s.assignedGroups.includes(manageItem._id))).length} élèves
                            </span>
                            <button onClick={() => setManageItem(null)} className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold text-xs hover:bg-slate-700 transition-all uppercase tracking-wide">Fermer</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. MODALE CREATE/EDIT */}
            {modalMode && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4" onClick={() => setModalMode(null)}>
                    <div className="bg-white w-full max-w-lg rounded-3xl p-8 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-black uppercase mb-6 text-slate-800">{modalMode === 'create' ? 'Ajouter' : 'Modifier'} {view.slice(0,-1)}</h3>
                        
                        <div className="space-y-4 mb-8">
                            {/* Identité (Tous) */}
                            {(view === 'students' || view === 'teachers' || view === 'staff') && (
                                <div className="grid grid-cols-2 gap-4">
                                    <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm" placeholder="Prénom" value={currentItem.firstName||''} onChange={e=>setCurrentItem({...currentItem, firstName:e.target.value})} />
                                    <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm" placeholder="Nom" value={currentItem.lastName||''} onChange={e=>setCurrentItem({...currentItem, lastName:e.target.value})} />
                                </div>
                            )}
                            
                            {(view === 'classes' || view === 'groups' || view === 'subjects') && (
                                <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm" placeholder="Nom (ex: 6A, MATHS)" value={currentItem.name||''} onChange={e=>setCurrentItem({...currentItem, name:e.target.value})} />
                            )}

                            {/* --- SPÉCIFIQUE : PROFESSEURS --- */}
                            {view === 'teachers' && (
                                <div className="space-y-4">
                                    {/* MATIÈRES (CHIPS) */}
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 pl-1 mb-2 block">Matières</label>
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {(currentItem.taughtSubjects || []).map(id => {
                                                const sub = allSubjects.find(s => s._id === (id._id || id));
                                                if (!sub) return null;
                                                return (
                                                    <span key={sub._id} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-bold border border-indigo-100 flex items-center gap-2">
                                                        {sub.name}
                                                        <button onClick={() => removeItemFromList('taughtSubjects', sub._id)} className="w-4 h-4 rounded-full bg-white hover:bg-red-500 hover:text-white flex items-center justify-center text-slate-400 transition-colors">×</button>
                                                    </span>
                                                );
                                            })}
                                        </div>
                                        <select 
                                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold uppercase text-slate-500"
                                            onChange={(e) => { addItemToList('taughtSubjects', e.target.value); e.target.value=""; }}
                                        >
                                            <option value="">+ Ajouter une matière</option>
                                            {allSubjects.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                                        </select>
                                    </div>

                                    {/* CLASSES (CHIPS) */}
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 pl-1 mb-2 block">Classes</label>
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {(currentItem.assignedClasses || []).map(id => {
                                                const cls = allClasses.find(c => c._id === (id._id || id) && c.type === 'CLASS');
                                                if (!cls) return null;
                                                return (
                                                    <span key={cls._id} className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-bold border border-emerald-100 flex items-center gap-2">
                                                        {cls.name}
                                                        <button onClick={() => removeItemFromList('assignedClasses', cls._id)} className="w-4 h-4 rounded-full bg-white hover:bg-red-500 hover:text-white flex items-center justify-center text-slate-400 transition-colors">×</button>
                                                    </span>
                                                );
                                            })}
                                        </div>
                                        <select 
                                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold uppercase text-slate-500"
                                            onChange={(e) => { addItemToList('assignedClasses', e.target.value); e.target.value=""; }}
                                        >
                                            <option value="">+ Ajouter une classe</option>
                                            {allClasses.filter(c => c.type === 'CLASS').map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                                        </select>
                                    </div>

                                    {/* GROUPES (CHIPS) */}
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 pl-1 mb-2 block">Groupes</label>
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {(currentItem.assignedClasses || []).map(id => {
                                                const grp = allClasses.find(c => c._id === (id._id || id) && c.type === 'GROUP');
                                                if (!grp) return null;
                                                return (
                                                    <span key={grp._id} className="px-3 py-1 bg-purple-50 text-purple-700 rounded-lg text-[10px] font-bold border border-purple-100 flex items-center gap-2">
                                                        {grp.name}
                                                        <button onClick={() => removeItemFromList('assignedClasses', grp._id)} className="w-4 h-4 rounded-full bg-white hover:bg-red-500 hover:text-white flex items-center justify-center text-slate-400 transition-colors">×</button>
                                                    </span>
                                                );
                                            })}
                                        </div>
                                        <select 
                                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold uppercase text-slate-500"
                                            onChange={(e) => { addItemToList('assignedClasses', e.target.value); e.target.value=""; }}
                                        >
                                            <option value="">+ Ajouter un groupe</option>
                                            {allClasses.filter(c => c.type === 'GROUP').map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* --- SPÉCIFIQUE : ÉLÈVES --- */}
                            {view === 'students' && (
                                <>
                                    <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm" placeholder="Email" value={currentItem.email||''} onChange={e=>setCurrentItem({...currentItem, email:e.target.value})} />
                                    
                                    <div className="grid grid-cols-1 gap-2">
                                        <label className="text-[10px] font-black uppercase text-slate-400 pl-1">Classe Principale</label>
                                        <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-600" value={currentItem.classId||''} onChange={e=>setCurrentItem({...currentItem, classId:e.target.value})}>
                                            <option value="">-- Sans Classe --</option>
                                            {allClasses.filter(c=>c.type==='CLASS').map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                                        </select>
                                    </div>

                                    {/* ✅ GROUPES (CHIPS ÉLÈVES) - NOUVELLE VERSION */}
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 pl-1 mb-2 block">Groupes & Options</label>
                                        <div className="flex flex-wrap gap-2 mb-2 p-2 bg-slate-50 rounded-xl min-h-[40px] items-center">
                                            {(currentItem.assignedGroups || []).length === 0 && <span className="text-xs text-slate-300 italic px-2">Aucun groupe</span>}
                                            {(currentItem.assignedGroups || []).map(id => {
                                                const group = allClasses.find(c => c._id === (id._id || id));
                                                if (!group) return null;
                                                return (
                                                    <span key={group._id} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-bold border border-indigo-100 flex items-center gap-2">
                                                        {group.name}
                                                        <button 
                                                            onClick={() => removeItemFromList('assignedGroups', group._id)} 
                                                            className="w-4 h-4 rounded-full bg-white hover:bg-red-500 hover:text-white flex items-center justify-center text-slate-400 transition-colors"
                                                        >
                                                            ×
                                                        </button>
                                                    </span>
                                                );
                                            })}
                                        </div>
                                        <select 
                                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold uppercase text-slate-500 hover:border-indigo-300 transition-all"
                                            onChange={(e) => { addItemToList('assignedGroups', e.target.value); e.target.value=""; }}
                                        >
                                            <option value="">+ Ajouter un groupe</option>
                                            {allClasses.filter(c => c.type === 'GROUP').map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
                                        </select>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex justify-end gap-3">
                            <button onClick={() => setModalMode(null)} className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase text-slate-500 hover:bg-slate-100 transition-colors">Annuler</button>
                            <button onClick={handleSave} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs uppercase hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-200">Enregistrer</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. MODALE MAGIC IMPORT */}
            {showMagicModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4" onClick={() => setShowMagicModal(false)}>
                    <div className="bg-white w-full max-w-3xl rounded-3xl p-8 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-black uppercase mb-2 text-indigo-600">🔮 Magic Import IA</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase mb-6">Collez un tableau Excel ou une liste brute, l'IA s'occupe du reste.</p>
                        <textarea 
                            className="w-full h-64 bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 font-mono text-xs focus:border-indigo-500 outline-none resize-none mb-6"
                            placeholder="Exemple :&#10;Dupont Jean 6A Option Anglais&#10;Durand Marie 6B"
                            value={magicText}
                            onChange={e => setMagicText(e.target.value)}
                        />
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowMagicModal(false)} className="px-5 py-3 rounded-xl font-bold text-xs uppercase text-slate-500 hover:bg-slate-100">Fermer</button>
                            <button onClick={handleMagicImport} className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-black text-xs uppercase hover:shadow-lg hover:scale-105 transition-all">Lancer l'analyse</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}