// @signatures: AdminDashboard, handleMagicImport, handleMembership, handleSave, loadData, handleOpenCreate
import React, { useState, useEffect } from 'react';
import DriveViewer from './components/DriveViewer';
import './AdminDashboard.css';

export default function AdminDashboard({ user }) {
    const [view, setView] = useState('classes'); 
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeClassTab, setActiveClassTab] = useState('TOUS');
    const [modalMode, setModalMode] = useState(null); 
    const [currentItem, setCurrentItem] = useState(null);
    
    const [showDrive, setShowDrive] = useState(false);
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

            const map = { 'classes': 'classrooms', 'groups': 'classrooms', 'teachers': 'teachers', 'students': 'students', 'staff': 'admins' };
            const r = await fetch(`/api/admin/${map[view]}`);
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

    // ✅ FONCTION RESTAURÉE : Gère l'ouverture du formulaire de création
    const handleOpenCreate = () => {
        let defaults = { 
            name: '', 
            firstName: '', 
            lastName: '', 
            password: '123', 
            type: view === 'groups' ? 'GROUP' : 'CLASS', 
            taughtSubjects: [], 
            assignedClasses: [], 
            assignedGroups: [],
            email: '',
            parentEmail: '',
            level: ''
        };
        setCurrentItem(defaults);
        setModalMode('create');
    };

    const handleSave = async () => {
        const map = { 'classes': 'classrooms', 'groups': 'classrooms', 'teachers': 'teachers', 'students': 'students', 'staff': 'admins' };
        let dataToSend = { ...currentItem };
        
        if (view === 'teachers') {
            dataToSend.taughtSubjectsText = allSubjects.filter(s => dataToSend.taughtSubjects.includes(s._id)).map(s => s.name).join(', ');
            dataToSend.assignedClassesText = allClasses.filter(c => dataToSend.assignedClasses.some(ac => (ac._id || ac) === c._id)).map(c => c.name).join(', ');
            dataToSend.assignedClasses = dataToSend.assignedClasses.map(c => c._id || c);
        }

        await fetch(`/api/admin/${map[view]}`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(dataToSend) 
        });
        setModalMode(null); 
        loadData();
    };

    const handleResetActivities = async () => {
        if (!confirm("⚠️ VOULEZ-VOUS VRAIMENT TOUT EFFACER ?")) return;
        await fetch('/api/admin/maintenance/reset-content', { method: 'DELETE' });
        loadData();
    };

    const filteredItems = items.filter(it => {
        const searchMatch = (it.name || it.firstName || "").toLowerCase().includes(searchTerm.toLowerCase()) || (it.lastName || "").toLowerCase().includes(searchTerm.toLowerCase());
        if (view === 'students' && activeClassTab !== 'TOUS') return searchMatch && it.currentClass === activeClassTab;
        return searchMatch;
    });

    return (
        <div className="admin-container animate-in fade-in">
            {importing && <div className="zoom-overlay level-2"><div className="text-white font-black text-2xl animate-pulse">🔮 TRAITEMENT IA...</div></div>}
            
            {/* MODALE IMPORT MAGIQUE */}
            {showMagicModal && ( 
                <div className="zoom-overlay" onClick={() => setShowMagicModal(false)}> 
                    <div className="zoom-card !w-[800px]" onClick={e => e.stopPropagation()}> 
                        <div className="z-header"><h2 className="text-indigo-600 uppercase">🔮 Importation Magique</h2></div> 
                        <div className="z-body"> 
                            <div className="flex gap-4 mb-4"> 
                                <input className="admin-input flex-1" placeholder="Classe (ex: 6A)" value={magicClass} onChange={e => setMagicClass(e.target.value)} /> 
                                <input className="admin-input flex-1 border-orange-200" placeholder="Option (ex: BFI)" value={magicOption} onChange={e => setMagicOption(e.target.value)} /> 
                            </div> 
                            <textarea className="admin-input !h-[300px] font-mono text-xs" placeholder="Collez ici..." value={magicText} onChange={e => setMagicText(e.target.value)} /> 
                        </div> 
                        <div className="z-footer"> 
                            <button onClick={() => setShowMagicModal(false)} className="flex-1 py-4 bg-slate-100 rounded-xl font-black text-xs">ANNULER</button> 
                            <button onClick={async () => { if(!magicText) return; await fetch('/api/admin/import-magic', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rawText: magicText, defaultClass: magicClass.toUpperCase(), forceOption: magicOption.toUpperCase() }) }); setShowMagicModal(false); loadData(); }} className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-black text-xs">LANCER</button> 
                        </div> 
                    </div> 
                </div> 
            )}

            {/* MODALE GESTION MEMBRES */}
            {manageItem && ( 
                <div className="zoom-overlay" onClick={() => setManageItem(null)}> 
                    <div className="zoom-card" onClick={e => e.stopPropagation()}> 
                        <div className="z-header"><h2 className="text-xl font-black uppercase">Membres : {manageItem.name}</h2></div> 
                        <div className="z-body"> 
                            <div className="member-list custom-scrollbar"> 
                                {allStudents.filter(s => manageItem.type === 'CLASS' ? String(s.classId) === String(manageItem._id) : (s.assignedGroups || []).includes(manageItem._id)).map(s => ( 
                                    <div key={s._id} className="member-row">
                                        <span>{s.firstName} {s.lastName}</span>
                                        <button onClick={async () => { await fetch('/api/admin/membership', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId: s._id, targetId: manageItem._id, type: manageItem.type, action: 'remove' }) }); loadData(); }} className="member-btn-remove">✕</button>
                                    </div> 
                                ))} 
                            </div> 
                            <input className="admin-input" placeholder="Ajouter..." value={memberSearch} onChange={e => setMemberSearch(e.target.value)} /> 
                            {memberSearch.length > 1 && ( 
                                <div className="finder-results-mini"> 
                                    {allStudents.filter(s => (s.firstName + s.lastName).toLowerCase().includes(memberSearch.toLowerCase())).slice(0, 5).map(p => ( 
                                        <div key={p._id} className="finder-row-mini" onClick={async () => { await fetch('/api/admin/membership', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId: p._id, targetId: manageItem._id, type: manageItem.type, action: 'add' }) }); setMemberSearch(""); loadData(); }}>{p.firstName} {p.lastName} <span className="text-indigo-600">+</span></div> 
                                    ))} 
                                </div> 
                            )} 
                        </div> 
                        <div className="z-footer"><button onClick={() => setManageItem(null)} className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl text-xs">FERMER</button></div> 
                    </div> 
                </div> 
            )}

            {/* MODALE FORMULAIRE (CREATE/EDIT) */}
            {modalMode && currentItem && ( 
                <div className="zoom-overlay" onClick={() => setModalMode(null)}> 
                    <div className="zoom-card !w-[1000px] !max-w-none" onClick={e => e.stopPropagation()}> 
                        <div className="z-header"><h2>{modalMode === 'create' ? 'NOUVEAU' : 'MODIFIER'} {view.toUpperCase()}</h2></div> 
                        <div className="z-body space-y-4"> 
                            {view === 'teachers' ? ( 
                                <> 
                                    <div className="flex gap-4"> 
                                        <input className="admin-input flex-1" placeholder="Prénom" value={currentItem.firstName} onChange={e => setCurrentItem({...currentItem, firstName: e.target.value})} /> 
                                        <input className="admin-input flex-1" placeholder="Nom" value={currentItem.lastName} onChange={e => setCurrentItem({...currentItem, lastName: e.target.value})} /> 
                                        <input className="admin-input flex-1" placeholder="Mdp" value={currentItem.password} onChange={e => setCurrentItem({...currentItem, password: e.target.value})} /> 
                                    </div> 
                                    <div className="grid grid-cols-3 gap-6 pt-4 border-t"> 
                                        <div className="col-selector">
                                            <span className="col-title">📚 MATIÈRES</span>
                                            <input className="mini-filter" placeholder="Filtrer..." value={filterSub} onChange={e=>setFilterSub(e.target.value)} />
                                            <div className="scroll-list custom-scrollbar">
                                                {allSubjects.filter(s=>s.name.includes(filterSub.toUpperCase())).map(s=>(
                                                    <button key={s._id} onClick={()=>{ const list = currentItem.taughtSubjects || []; setCurrentItem({...currentItem, taughtSubjects: list.includes(s._id) ? list.filter(x=>x!==s._id) : [...list, s._id]}); }} className={`select-btn ${currentItem.taughtSubjects?.includes(s._id)?'active':''}`}>{s.name}</button>
                                                ))}
                                            </div>
                                        </div> 
                                        <div className="col-selector">
                                            <span className="col-title">🏫 CLASSES</span>
                                            <input className="mini-filter" placeholder="Filtrer..." value={filterClass} onChange={e=>setFilterClass(e.target.value)} />
                                            <div className="scroll-list custom-scrollbar">
                                                {allClasses.filter(c=>c.type==='CLASS'&&c.name.includes(filterClass.toUpperCase())).map(c=>(
                                                    <button key={c._id} onClick={()=>{ const list = currentItem.assignedClasses || []; const isInc = list.some(x=>(x._id||x)===c._id); setCurrentItem({...currentItem, assignedClasses: isInc ? list.filter(x=>(x._id||x)!==c._id) : [...list, c._id]}); }} className={`select-btn ${currentItem.assignedClasses?.some(ac=>(ac._id||ac)===c._id)?'active':''}`}>{c.name}</button>
                                                ))}
                                            </div>
                                        </div> 
                                        <div className="col-selector">
                                            <span className="col-title">👥 GROUPES</span>
                                            <input className="mini-filter" placeholder="Filtrer..." value={filterGroup} onChange={e=>setFilterGroup(e.target.value)} />
                                            <div className="scroll-list custom-scrollbar">
                                                {allClasses.filter(c=>c.type==='GROUP'&&c.name.includes(filterGroup.toUpperCase())).map(c=>(
                                                    <button key={c._id} onClick={()=>{ const list = currentItem.assignedClasses || []; const isInc = list.some(x=>(x._id||x)===c._id); setCurrentItem({...currentItem, assignedClasses: isInc ? list.filter(x=>(x._id||x)!==c._id) : [...list, c._id]}); }} className={`select-btn ${currentItem.assignedClasses?.some(ac=>(ac._id||ac)===c._id)?'active':''}`}>{c.name}</button>
                                                ))}
                                            </div>
                                        </div> 
                                    </div> 
                                </> 
                            ) : ( 
                                <div className="flex gap-4"> 
                                    <input className="admin-input flex-1" placeholder="Nom / Libellé" value={currentItem.name || (currentItem.firstName + ' ' + currentItem.lastName)} onChange={e => { if(view === 'students') return; setCurrentItem({...currentItem, name: e.target.value}); }} /> 
                                </div> 
                            )} 
                        </div> 
                        <div className="z-footer"><button onClick={() => setModalMode(null)} className="flex-1 py-4 bg-slate-100 rounded-xl font-black text-xs">ANNULER</button><button onClick={handleSave} className="flex-1 py-4 bg-[#0f172a] text-white rounded-xl font-black text-xs shadow-xl">ENREGISTRER</button></div> 
                    </div> 
                </div> 
            )}

            {/* BARRE D'OUTILS PRINCIPALE */}
            <div className="admin-toolbar-pill">
                <div className="nav-links">
                    {['classes', 'groups', 'subjects', 'teachers', 'students', 'staff'].map(v => (
                        <button key={v} onClick={() => setView(v)} className={`nav-link ${view === v ? 'active' : ''}`}>{v}</button>
                    ))}
                </div>
                <div className="action-buttons">
                    <button onClick={handleResetActivities} className="btn-pill btn-clean">🔥 VIDER CONTENU</button>
                    {(view === 'classes' || view === 'groups' || view === 'students') && ( <button onClick={() => setShowMagicModal(true)} className="btn-pill btn-import">🔮 IMPORT</button> )}
                    <button onClick={handleOpenCreate} className="btn-pill btn-add">+ AJOUTER</button>
                    <button onClick={() => setShowDrive(true)} className="btn-pill btn-bdd">☁️ DRIVE</button>
                </div>
            </div>

            {/* RECHERCHE & FILTRES */}
            <div className="search-container"><span className="text-xl">🔎</span><input className="search-input" placeholder={`Rechercher dans ${view}...`} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            {view === 'students' && ( <div className="class-filter-row no-scrollbar"> {['TOUS', ...allClasses.filter(c=>c.type==='CLASS').map(c=>c.name)].map(cls => ( <button key={cls} onClick={() => setActiveClassTab(cls)} className={`class-chip ${activeClassTab === cls ? 'active' : ''}`}>{cls}</button> ))} </div> )}

            {/* LISTE DES CARDS */}
            <div className="items-list">
                {loading ? ( <div className="p-20 text-center animate-pulse text-slate-300 font-black uppercase">Chargement...</div> ) : filteredItems.map(it => (
                    <div key={it._id} className="item-card">
                        <div className="item-main">
                            <span className="item-title"> {it.name || `${it.firstName} ${it.lastName}`} {it.level && <span className="badge-niv">NIV {it.level}</span>} {it.currentClass && <span className="badge-niv">{it.currentClass}</span>} </span>
                            <span className="item-sub">{it.role || it.type || 'PROFIL'}</span>
                        </div>
                        <div className="item-actions">
                            {(view === 'classes' || view === 'groups') && <button onClick={() => setManageItem(it)} className="btn-action btn-gerer">👥 GÉRER</button>}
                            <button onClick={() => { setCurrentItem(it); setModalMode('edit'); }} className="btn-action btn-modif">MODIFIER</button>
                            <button onClick={async () => { if(confirm("Supprimer ?")) { await fetch(`/api/admin/${view}/${it._id}`, {method:'DELETE'}); loadData(); } }} className="btn-action btn-delete">✕</button>
                        </div>
                    </div>
                ))}
            </div>

            {showDrive && <DriveViewer onClose={() => setShowDrive(false)} />}
        </div>
    );
}