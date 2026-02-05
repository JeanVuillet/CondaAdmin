import React, { useState, useEffect, useRef } from 'react';
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
    
    // États Magic Import & CSV
    const [importing, setImporting] = useState(false);
    const [showMagicModal, setShowMagicModal] = useState(false);
    const [magicText, setMagicText] = useState("");
    const [magicLog, setMagicLog] = useState("");
    
    // Refs pour upload fichier
    const fileInputRef = useRef(null);
    const classCsvInputRef = useRef(null); 
    const [targetImportClass, setTargetImportClass] = useState(null); 

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

    // --- HANDLERS CLASSIQUES ---
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
        if (view === 'teachers') {
            dataToSend.taughtSubjects = (dataToSend.taughtSubjects || []).map(s => s._id || s);
            dataToSend.assignedClasses = (dataToSend.assignedClasses || []).map(c => c._id || c);
            dataToSend.taughtSubjectsText = allSubjects.filter(s => dataToSend.taughtSubjects.includes(s._id)).map(s => s.name).join(', ');
            dataToSend.assignedClassesText = allClasses.filter(c => dataToSend.assignedClasses.includes(c._id)).map(c => c.name).join(', ');
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

    // --- 📥 NOUVEL IMPORT CSV PAR CLASSE (CIBLÉ & SÉCURISÉ) ---
    const triggerClassImport = (classId) => {
        setTargetImportClass(classId);
        if (classCsvInputRef.current) classCsvInputRef.current.click();
    };

    const handleClassFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file || !targetImportClass) return;

        setImporting(true);
        setShowMagicModal(true); 
        setMagicLog(`📂 Lecture du fichier : ${file.name}...\n`);

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const text = evt.target.result;
                const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");

                if (lines.length < 1) throw new Error("Le fichier est vide.");

                // Ligne 1 (Index 0) pour les En-têtes
                const headerLineIndex = 0; 
                const headerLine = lines[headerLineIndex];
                
                const separator = headerLine.includes(';') ? ';' : ',';
                const headers = headerLine.split(separator).map(h => h.trim().toLowerCase());

                setMagicLog(`📋 En-têtes détectés : ${headers.join(' | ')}\n`);

                // Mapping des colonnes
                const map = {
                    email: headers.findIndex(h => h.includes('mail') || h.includes('courriel') || h.includes('email')),
                    birthDate: headers.findIndex(h => h.includes('naissance') || h.includes('date')),
                    className: headers.findIndex(h => h.includes('classe') || h.includes('division') || h.includes('groupe')) // ✅ Colonne Classe
                };

                if (map.email === -1) throw new Error("Colonne 'Email' (ou Mail/Courriel) introuvable en ligne 1.");

                // Identification de la Classe Cible (Celle du bouton cliqué)
                const classObj = allClasses.find(c => c._id === targetImportClass);
                const targetClassName = classObj ? classObj.name.toUpperCase().trim() : "SANS CLASSE";

                setMagicLog(`🎯 Import vers : ${targetClassName}`);

                let successCount = 0;
                let skippedCount = 0;
                
                // Boucle sur les données (Ligne 2 -> Index 1)
                for (let i = headerLineIndex + 1; i < lines.length; i++) {
                    const lineStr = lines[i];
                    const cols = lineStr.split(separator).map(c => c.trim());

                    // --- 🛡️ SÉCURITÉ : VÉRIFICATION DE LA CLASSE ---
                    if (map.className !== -1) {
                        const fileClass = cols[map.className] ? cols[map.className].toUpperCase().trim() : "";
                        
                        // On vérifie si la classe du fichier correspond à la cible
                        // On ignore si le champ est vide (parfois les lignes sont incomplètes)
                        if (fileClass && fileClass !== targetClassName) {
                            setMagicLog(`⚠️ Ignoré (Ligne ${i+1}) : Classe fichier "${fileClass}" ≠ Cible "${targetClassName}"`);
                            skippedCount++;
                            continue; // ON PASSE À LA LIGNE SUIVANTE
                        }
                    }

                    let email = map.email !== -1 ? cols[map.email] : "";
                    let lastName = "INCONNU";
                    let firstName = "Élève";

                    // LOGIQUE NOM/PRÉNOM via EMAIL
                    if (email && email.includes('@')) {
                        const localPart = email.split('@')[0];
                        const parts = localPart.split('.');
                        
                        if (parts.length > 0) {
                            lastName = parts[0].toUpperCase(); 
                            if (parts.length > 1) {
                                firstName = parts.slice(1).join(' ');
                                firstName = firstName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                            }
                        }
                    } else {
                        if (!email) continue; 
                    }

                    // Génération Password
                    let password = "123456";
                    if (map.birthDate !== -1 && cols[map.birthDate]) {
                        const rawDate = cols[map.birthDate];
                        const digits = rawDate.replace(/\D/g, ''); 
                        if (digits.length >= 6) password = digits;
                    }

                    setMagicLog(`➕ Ajout : ${firstName} ${lastName} (${email})`);

                    await fetch('/api/admin/students', {
                        method: 'POST',
                        headers: {'Content-Type':'application/json'},
                        body: JSON.stringify({
                            firstName,
                            lastName,
                            email: email.toLowerCase(),
                            password,
                            classId: targetImportClass,
                            currentClass: targetClassName,
                            assignedGroups: [] 
                        })
                    });
                    successCount++;
                }

                setMagicLog(`\n🎉 TERMINÉ : ${successCount} importés.`);
                if (skippedCount > 0) setMagicLog(`⚠️ ${skippedCount} élèves ignorés car d'une autre classe.`);

                e.target.value = ""; 
                setTimeout(() => {
                    if (confirm(`Import terminé (${successCount} ajoutés, ${skippedCount} ignorés). Recharger ?`)) {
                        setShowMagicModal(false);
                        setMagicLog("");
                        loadData();
                    }
                }, 1000);

            } catch (err) {
                setMagicLog(`❌ ERREUR : ${err.message}`);
                console.error(err);
                e.target.value = ""; 
            }
        };
        reader.readAsText(file);
    };

    // --- MAGIC IMPORT (IA GÉNÉRIQUE) ---
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => setMagicText(evt.target.result);
        reader.readAsText(file);
    };

    const handleMagicImport = async () => {
        if (!magicText.trim()) return alert("La zone de texte est vide !");
        setImporting(true);
        setMagicLog("🧠 L'IA analyse les données...");
        try {
            const contextClassName = activeClassTab !== 'TOUS' ? allClasses.find(c => c._id === activeClassTab)?.name : "SANS CLASSE";
            const res = await fetch('/api/admin/import/magic', {
                method: 'POST',
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ text: magicText, contextClass: contextClassName })
            });
            if (!res.ok) throw new Error("Erreur serveur IA");
            const parsedList = await res.json();
            if (!Array.isArray(parsedList) || parsedList.length === 0) throw new Error("L'IA n'a pas renvoyé de liste valide.");
            
            setMagicLog(`✅ ${parsedList.length} élèves identifiés. Création...`);
            let count = 0;
            for (const student of parsedList) {
                const targetClass = allClasses.find(c => c.type === 'CLASS' && c.name === student.className);
                const classId = targetClass ? targetClass._id : null;
                const currentClass = targetClass ? targetClass.name : (student.className || "SANS CLASSE");
                let groupIds = [];
                if (student.options && Array.isArray(student.options)) {
                    student.options.forEach(optName => {
                        const grp = allClasses.find(g => g.type === 'GROUP' && g.name.includes(optName.toUpperCase()));
                        if (grp) groupIds.push(grp._id);
                    });
                }
                
                let finalLastName = student.lastName;
                let finalFirstName = student.firstName;
                let finalEmail = student.email;
                if (finalEmail && finalEmail.includes('@')) {
                    const localPart = finalEmail.split('@')[0];
                    const parts = localPart.split('.');
                    if (parts.length >= 2) {
                        finalLastName = parts[0].toUpperCase();
                        finalFirstName = parts.slice(1).join(' ');
                        finalFirstName = finalFirstName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                    }
                } else {
                    finalEmail = `${finalLastName}.${finalFirstName}@condamine.edu.ec`.toLowerCase();
                }
                const finalPassword = student.password && student.password.length >= 6 ? student.password : "123456";
                
                await fetch('/api/admin/students', {
                    method: 'POST',
                    headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({
                        firstName: finalFirstName, lastName: finalLastName, email: finalEmail, password: finalPassword,
                        classId: classId, currentClass: currentClass, assignedGroups: groupIds
                    })
                });
                count++;
                setMagicLog(`🔨 Création : ${finalFirstName} ${finalLastName} (MDP: ${finalPassword})`);
            }
            setMagicLog(`🎉 TERMINÉ ! ${count} élèves importés.`);
            setTimeout(() => { setShowMagicModal(false); setMagicText(""); setMagicLog(""); loadData(); }, 2000);
        } catch (e) {
            setMagicLog("❌ ERREUR CRITIQUE: " + e.message);
        }
        setImporting(false);
    };

    const filteredItems = items.filter(it => {
        const searchMatch = (it.name || it.firstName || "").toLowerCase().includes(searchTerm.toLowerCase()) || (it.lastName || "").toLowerCase().includes(searchTerm.toLowerCase());
        if (view === 'students' && activeClassTab !== 'TOUS') { return searchMatch && String(it.classId) === String(activeClassTab); }
        return searchMatch;
    });

    const addItemToList = (field, id) => {
        if (!id) return;
        const currentList = (currentItem[field] || []).map(x => x._id || x);
        if (!currentList.includes(id)) setCurrentItem({ ...currentItem, [field]: [...currentList, id] });
    };

    const removeItemFromList = (field, id) => {
        const currentList = (currentItem[field] || []).map(x => x._id || x);
        setCurrentItem({ ...currentItem, [field]: currentList.filter(x => x !== id) });
    };

    return (
        <div className="admin-container animate-in fade-in">
            {/* INPUT FILE CACHÉ POUR L'IMPORT CLASSE SPÉCIFIQUE */}
            <input type="file" ref={classCsvInputRef} className="hidden" accept=".csv,.txt" onChange={handleClassFileSelect} />

            {importing && <div className="zoom-overlay level-2">
                <div className="text-white font-black text-2xl flex flex-col items-center gap-4">
                    <div className="animate-spin text-5xl">⚙️</div>
                    <div className="animate-pulse whitespace-pre-line text-center">{magicLog || "TRAITEMENT EN COURS..."}</div>
                </div>
            </div>}
            
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
                            {/* BOUTON IMPORT CSV CIBLÉ SUR LA CLASSE */}
                            {view === 'classes' && (
                                <button onClick={() => triggerClassImport(it._id)} className="btn-import-mini">
                                    📥 IMPORT CSV
                                </button>
                            )}

                            {(view === 'classes' || view === 'groups') && <button onClick={() => setManageItem(it)} className="btn-action btn-gerer">👥 MEMBRES</button>}
                            <button onClick={() => { setCurrentItem(it); setModalMode('edit'); }} className="btn-action btn-modif">ÉDITER</button>
                            <button onClick={() => handleDelete(it._id)} className="btn-action btn-delete">✕</button>
                        </div>
                    </div>
                ))}
            </div>

            {manageItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4" onClick={() => setManageItem(null)}>
                    <div className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center"><h3 className="font-black text-lg">MEMBRES</h3><button onClick={() => setManageItem(null)}>✕</button></div>
                        <div className="p-4 h-96 overflow-y-auto">
                             {allStudents.filter(s => String(s.classId) === String(manageItem._id) || (s.assignedGroups && s.assignedGroups.includes(manageItem._id))).map(s => (
                                <div key={s._id} className="p-2 border-b">{s.firstName} {s.lastName}</div>
                             ))}
                        </div>
                    </div>
                </div>
            )}

            {modalMode && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4" onClick={() => setModalMode(null)}>
                    <div className="bg-white w-full max-w-lg rounded-3xl p-8 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-black uppercase mb-6">{modalMode}</h3>
                        <div className="space-y-4 mb-8">
                             <input className="w-full p-3 border rounded" placeholder="Nom" value={currentItem.name || currentItem.lastName || ''} onChange={e => setCurrentItem({...currentItem, name:e.target.value, lastName:e.target.value})} />
                             {(view === 'students' || view === 'teachers') && <input className="w-full p-3 border rounded" placeholder="Prénom" value={currentItem.firstName||''} onChange={e=>setCurrentItem({...currentItem, firstName:e.target.value})} />}
                        </div>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setModalMode(null)} className="btn-action">Annuler</button>
                            <button onClick={handleSave} className="btn-action bg-indigo-600 text-white">Sauvegarder</button>
                        </div>
                    </div>
                </div>
            )}

            {showMagicModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4" onClick={() => setShowMagicModal(false)}>
                    <div className="bg-white w-full max-w-3xl rounded-3xl p-8 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-black uppercase mb-2 text-indigo-600">🔮 Magic Import IA</h3>
                        <div className="flex justify-between items-center mb-4">
                            <p className="text-xs font-bold text-slate-400 uppercase">Collez du texte ou chargez un fichier CSV/Excel.</p>
                            <input type="file" ref={fileInputRef} className="hidden" accept=".csv,.txt" onChange={handleFileUpload} />
                            <button onClick={() => fileInputRef.current.click()} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-black uppercase hover:bg-slate-200 transition-colors flex items-center gap-2">📂 Charger un fichier CSV</button>
                        </div>
                        {magicLog ? (
                            <div className="w-full h-64 bg-slate-900 text-emerald-400 font-mono text-xs p-4 rounded-2xl overflow-y-auto border-2 border-slate-800">
                                {magicLog.split('\n').map((l, i) => <div key={i}>{l}</div>)}
                            </div>
                        ) : (
                            <textarea 
                                className="w-full h-64 bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 font-mono text-xs focus:border-indigo-500 outline-none resize-none mb-6"
                                placeholder="Exemple :&#10;vuillet.jean@condamine.edu.ec 3A 12/05/2010&#10;dupont.marie@condamine.edu.ec 3B"
                                value={magicText}
                                onChange={e => setMagicText(e.target.value)}
                            />
                        )}
                        <div className="flex justify-end gap-3 mt-4">
                            <button onClick={() => setShowMagicModal(false)} className="px-5 py-3 rounded-xl font-bold text-xs uppercase text-slate-500 hover:bg-slate-100">Fermer</button>
                            {!magicLog && <button onClick={handleMagicImport} className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-black text-xs uppercase hover:shadow-lg hover:scale-105 transition-all">Lancer l'analyse</button>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}