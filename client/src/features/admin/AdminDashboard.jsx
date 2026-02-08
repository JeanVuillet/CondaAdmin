import React, { useState, useEffect, useRef } from 'react';
import './AdminDashboard.css';

export default function AdminDashboard({ user }) {
    const [view, setView] = useState('classes'); 
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeClassTab, setActiveClassTab] = useState('TOUS');
    
    // États des Modales
    const [modalMode, setModalMode] = useState(null); // 'create', 'edit', 'view'
    const [currentItem, setCurrentItem] = useState(null);
    const [viewingClass, setViewingClass] = useState(null);
    const [zoomedItem, setZoomedItem] = useState(null);
    
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
        'administrateurs': 'admins', 
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

    // --- HANDLERS CRUD ---
    const handleOpenCreate = () => {
        let defaults = { 
            name: '', firstName: '', lastName: '', fullName: '', 
            password: '', 
            type: view === 'groups' ? 'GROUP' : 'CLASS', 
            taughtSubjects: [], assignedClasses: [], assignedGroups: [],
            email: '', parentEmail: '', level: '',
            gender: 'M', birthDate: ''
        };
        setCurrentItem(defaults);
        setModalMode('create');
    };

    const handleDelete = async (id) => {
        if (!confirm("⚠️ Confirmer la suppression ?")) return;
        await fetch(`/api/admin/${collectionMap[view]}/${id}`, { method: 'DELETE' });
        loadData();
    };
    
    // --- ♻️ PURGE DE CLASSE ---
    const handlePurgeClass = async (cls) => {
        if (!confirm(`⚠️ DANGER IMMÉDIAT\n\nVous allez supprimer TOUS les élèves de la classe ${cls.name}.\n\nCette action est irréversible.\n\nVoulez-vous vraiment vider cette classe ?`)) return;
        
        const check = prompt(`🔴 SÉCURITÉ : Tapez le nom de la classe "${cls.name}" pour confirmer.`);
        if (check !== cls.name) return alert("Annulé : Nom incorrect.");

        setLoading(true);
        try {
            const res = await fetch('/api/admin/maintenance/purge/students', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ filterClassId: cls._id })
            });
            const data = await res.json();
            alert(`✅ Opération terminée : ${data.deletedCount} élèves supprimés.`);
            loadData();
        } catch(e) { 
            alert("Erreur serveur lors de la purge."); 
        }
        setLoading(false);
    };

    const handleSave = async () => {
        if (modalMode === 'view') return; // Sécurité

        const targetCollection = collectionMap[view];
        let dataToSend = { ...currentItem };
        
        if (view === 'teachers') {
            const subjects = Array.isArray(dataToSend.taughtSubjects) ? dataToSend.taughtSubjects : [];
            const classes = Array.isArray(dataToSend.assignedClasses) ? dataToSend.assignedClasses : [];

            dataToSend.taughtSubjects = subjects;
            dataToSend.assignedClasses = classes;
            
            dataToSend.taughtSubjectsText = allSubjects
                .filter(s => subjects.includes(s._id))
                .map(s => s.name)
                .join(', ');
                
            dataToSend.assignedClassesText = allClasses
                .filter(c => classes.includes(c._id))
                .map(c => c.name)
                .join(', ');
        }

        if (view === 'students') {
             dataToSend.assignedGroups = Array.isArray(dataToSend.assignedGroups) ? dataToSend.assignedGroups : [];
             const mainClass = allClasses.find(c => c._id === dataToSend.classId);
             dataToSend.currentClass = mainClass ? mainClass.name : "SANS CLASSE";
             
             // Validation Unicité Simple (Nom/Prénom requis)
             if (!dataToSend.firstName || !dataToSend.lastName) return alert("Nom et Prénom obligatoires !");
             
             // Si fullName vide, on le génère par défaut
             if (!dataToSend.fullName) {
                 dataToSend.fullName = `${dataToSend.lastName} ${dataToSend.firstName}`;
             }

             // Sécurité Mot de Passe
             if (!dataToSend.password) dataToSend.password = "123456";
        }

        if (view === 'groups') {
            dataToSend.type = 'GROUP'; 
        }

        try {
            const res = await fetch(`/api/admin/${targetCollection}`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(dataToSend) 
            });
            const result = await res.json();
            
            if (result.error || result.code === 11000) {
                alert("❌ ERREUR : Cet élément existe déjà (Nom ou Email en doublon).");
            } else {
                setModalMode(null); loadData();
            }
        } catch (e) {
            alert("Erreur réseau");
        }
    };

    const toggleRelation = (field, id) => {
        if (modalMode === 'view') return; // Bloquer en mode vue
        if (!currentItem) return;
        const currentList = Array.isArray(currentItem[field]) ? [...currentItem[field]] : [];
        if (currentList.includes(id)) {
            setCurrentItem({ ...currentItem, [field]: currentList.filter(x => x !== id) });
        } else {
            setCurrentItem({ ...currentItem, [field]: [...currentList, id] });
        }
    };

    // --- HELPER EMAIL PARSER ---
    const parseEmailToIdentity = (email) => {
        if (!email || !email.includes('@')) return null;
        try {
            const local = email.split('@')[0];
            const parts = local.split(/[._]/); // Split sur point ou underscore
            
            let nom = parts[0].toUpperCase();
            let prenom = parts.length > 1 ? parts[1] : "";
            
            // Capitalize Prénom
            if (prenom) prenom = prenom.charAt(0).toUpperCase() + prenom.slice(1).toLowerCase();
            
            return { lastName: nom, firstName: prenom };
        } catch (e) { return null; }
    };

    // --- 📥 IMPORT CSV (MANUEL) ---
    const triggerClassImport = (classId) => {
        setTargetImportClass(classId);
        if (classCsvInputRef.current) classCsvInputRef.current.click();
    };

    const handleClassFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file || !targetImportClass) return;

        setImporting(true);
        setShowMagicModal(true); 
        setMagicLog(`📂 Lecture : ${file.name}...\n`);

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const text = evt.target.result;
                const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
                if (lines.length < 1) throw new Error("Fichier vide.");

                const headerLineIndex = 0; 
                const headerLine = lines[headerLineIndex];
                const separator = headerLine.includes(';') ? ';' : ',';
                const headers = headerLine.split(separator).map(h => h.trim().toLowerCase());

                setMagicLog(`📋 Détection Colonnes : ${headers.join(' | ')}\n`);

                const map = {
                    email: headers.findIndex(h => h.includes('mail') || h.includes('courriel')),
                    lastName: headers.findIndex(h => h.includes('nom') || h.includes('last')),
                    firstName: headers.findIndex(h => h.includes('prénom') || h.includes('prenom') || h.includes('first')),
                    fullName: headers.findIndex(h => h.includes('full') || h.includes('complet') || h.includes('nom complet')),
                    // ✅ DÉTECTION COLONNE DATE
                    birthDate: headers.findIndex(h => h.includes('date') || h.includes('naissance') || h.includes('birth')),
                    // ✅ DÉTECTION COLONNE SEXE
                    gender: headers.findIndex(h => h.includes('sex') || h.includes('genre') || h.includes('civil')),
                };

                const classObj = allClasses.find(c => c._id === targetImportClass);
                const targetClassName = classObj ? classObj.name.toUpperCase().trim() : "SANS CLASSE";

                setMagicLog(`🎯 Cible : ${targetClassName}`);

                let successCount = 0;
                let errorCount = 0;
                
                for (let i = headerLineIndex + 1; i < lines.length; i++) {
                    const lineStr = lines[i];
                    const cols = lineStr.split(separator).map(c => c.trim());

                    let email = map.email !== -1 ? cols[map.email].toLowerCase() : "";
                    let lastName = map.lastName !== -1 ? cols[map.lastName].toUpperCase() : "INCONNU";
                    let firstName = map.firstName !== -1 ? cols[map.firstName] : "Élève";
                    let fullName = map.fullName !== -1 ? cols[map.fullName] : "";
                    
                    // ✅ 1. Date de Naissance & Mot de Passe
                    let birthDate = map.birthDate !== -1 ? cols[map.birthDate] : "";
                    let password = "123456"; // Défaut
                    
                    if (birthDate && birthDate.length > 5) {
                        // On garde uniquement les chiffres pour le MDP (JJ/MM/AAAA -> JJMMAAAA)
                        const cleanedPass = birthDate.replace(/[^0-9]/g, '');
                        if (cleanedPass.length >= 6) password = cleanedPass;
                    }

                    // ✅ 2. Options : Colonne P (Index 15) uniquement
                    let assignedGroups = [];
                    if (cols[15] && cols[15].trim() !== "") {
                        const rawGroups = cols[15].split(',');
                        rawGroups.forEach(gPart => {
                            const cleanPart = gPart.trim();
                            if (cleanPart) {
                                // Construction du nom strict : CLASSE + " " + NOM_GROUPE_CSV
                                const targetGroupName = `${targetClassName} ${cleanPart}`.toUpperCase();
                                
                                const grp = allClasses.find(c => c.type === 'GROUP' && c.name.toUpperCase() === targetGroupName);
                                if (grp) {
                                    assignedGroups.push(grp._id);
                                } else {
                                    setMagicLog(`❓ Groupe inconnu : ${targetGroupName} (Cherché dans Col P)`);
                                }
                            }
                        });
                    }

                    // ✅ 3. Sexe : Première lettre de la colonne Sexe
                    let gender = 'M';
                    if (map.gender !== -1 && cols[map.gender]) {
                        const rawGender = cols[map.gender].trim().toUpperCase();
                        if (rawGender.length > 0) {
                            gender = rawGender.charAt(0); // M, F, H, etc.
                        }
                    }

                    // 4. Logique Identité (FullName / Email)
                    if (fullName && (lastName === "INCONNU" || !firstName)) {
                        const parts = fullName.trim().split(/\s+/);
                        if (parts.length > 1) {
                            firstName = parts.pop();
                            lastName = parts.join(' ').toUpperCase();
                        } else {
                            lastName = fullName.toUpperCase();
                        }
                    }

                    if (email.includes('@')) {
                         const identity = parseEmailToIdentity(email);
                         if (identity) {
                             lastName = identity.lastName;
                             firstName = identity.firstName;
                         }
                    }

                    if (!fullName && lastName !== "INCONNU") {
                        fullName = `${lastName} ${firstName}`;
                    }

                    if (lastName === "INCONNU" && !email) continue;

                    try {
                        const res = await fetch('/api/admin/students', {
                            method: 'POST',
                            headers: {'Content-Type':'application/json'},
                            body: JSON.stringify({
                                firstName, 
                                lastName,
                                fullName,
                                email: email, 
                                password: password, 
                                classId: targetImportClass, 
                                currentClass: targetClassName, 
                                assignedGroups: assignedGroups, 
                                gender: gender, // ✅ Sexe importé
                                birthDate: birthDate 
                            })
                        });
                        const data = await res.json();
                        if (data.error || data.code === 11000) {
                            setMagicLog(`⚠️ Doublon ignoré : ${lastName} ${firstName}`);
                            errorCount++;
                        } else {
                            successCount++;
                        }
                    } catch (err) { errorCount++; }
                    
                    if(successCount % 5 === 0) setMagicLog(`... ${successCount} traités`);
                }

                setMagicLog(`\n🎉 TERMINÉ : ${successCount} élèves importés.`);
                if (errorCount > 0) setMagicLog(`⚠️ ${errorCount} erreurs/doublons.`);

                e.target.value = ""; 
                setTimeout(() => {
                    if (confirm(`Import terminé (${successCount} ajoutés). Recharger ?`)) {
                        setShowMagicModal(false); setMagicLog(""); loadData();
                    }
                }, 1000);

            } catch (err) {
                setMagicLog(`❌ ERREUR : ${err.message}`);
                e.target.value = ""; 
            }
        };
        reader.readAsText(file);
    };

    // --- MAGIC IMPORT IA ---
    const handleMagicImport = async () => {
        if (!magicText.trim()) return alert("Zone vide !");
        setImporting(true);
        setMagicLog("🧠 Analyse IA en cours...");
        try {
            const contextClassName = activeClassTab !== 'TOUS' ? allClasses.find(c => c._id === activeClassTab)?.name : "SANS CLASSE";
            const res = await fetch('/api/admin/import/magic', {
                method: 'POST', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ text: magicText, contextClass: contextClassName })
            });
            const parsedList = await res.json();
            if (!Array.isArray(parsedList)) throw new Error("Réponse IA invalide.");
            
            setMagicLog(`✅ ${parsedList.length} élèves détectés.`);
            
            for (const student of parsedList) {
                const targetClass = allClasses.find(c => c.type === 'CLASS' && c.name === student.className);
                const classId = targetClass ? targetClass._id : null;
                const currentClass = targetClass ? targetClass.name : (student.className || "SANS CLASSE");
                
                let assignedGroups = [];
                if (student.options && Array.isArray(student.options)) {
                    assignedGroups = student.options.map(optName => {
                        const grp = allClasses.find(c => c.type === 'GROUP' && c.name === optName);
                        return grp ? grp._id : null;
                    }).filter(id => id !== null);
                }

                // Application de la règle email aussi ici si l'IA a raté
                if (student.lastName === "INCONNU" && student.email) {
                    const id = parseEmailToIdentity(student.email);
                    if (id) {
                        student.lastName = id.lastName;
                        student.firstName = id.firstName;
                    }
                }

                // Génération FullName
                const fName = student.fullName || `${student.lastName} ${student.firstName}`;

                const finalRes = await fetch('/api/admin/students', {
                    method: 'POST', headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({
                        firstName: student.firstName || "Inconnu", 
                        lastName: student.lastName || "INCONNU", 
                        fullName: fName,
                        email: student.email || "", 
                        password: student.password || "123456",
                        classId: classId, 
                        currentClass: currentClass, 
                        assignedGroups: assignedGroups,
                        gender: 'M', 
                        birthDate: '' 
                    })
                });
                
                const finalData = await finalRes.json();
                if (finalData.code === 11000) {
                     setMagicLog(`⚠️ Doublon : ${student.firstName} ${student.lastName}`);
                } else {
                     setMagicLog(`🔨 Création : ${student.firstName} ${student.lastName}`);
                }
            }
            setMagicLog(`🎉 Import terminé.`);
            setTimeout(() => { setShowMagicModal(false); setMagicText(""); setMagicLog(""); loadData(); }, 2000);
        } catch (e) { setMagicLog("❌ ERREUR: " + e.message); }
        setImporting(false);
    };

    const filteredItems = items.filter(it => {
        const searchMatch = (it.name || it.firstName || "").toLowerCase().includes(searchTerm.toLowerCase()) || (it.lastName || "").toLowerCase().includes(searchTerm.toLowerCase());
        if (view === 'students' && activeClassTab !== 'TOUS') { return searchMatch && String(it.classId) === String(activeClassTab); }
        return searchMatch;
    });

    return (
        <div className="admin-container animate-in fade-in">
            <input type="file" ref={classCsvInputRef} className="hidden" accept=".csv,.txt" onChange={handleClassFileSelect} />

            {importing && <div className="zoom-overlay level-2">
                <div className="text-white font-black text-2xl flex flex-col items-center gap-4">
                    <div className="animate-spin text-5xl">⚙️</div>
                    <div className="animate-pulse whitespace-pre-line text-center">{magicLog || "TRAITEMENT..."}</div>
                </div>
            </div>}
            
            <div className="admin-toolbar-pill">
                <div className="nav-links">
                    {['classes', 'groups', 'subjects', 'teachers', 'students', 'administrateurs'].map(v => (
                        <button key={v} onClick={() => setView(v)} className={`nav-link ${view === v ? 'active' : ''}`}>{v}</button>
                    ))}
                </div>
                <div className="action-buttons">
                    <button onClick={handleOpenCreate} className="btn-pill btn-add">+ CRÉER</button>
                    <button onClick={() => setShowMagicModal(true)} className="btn-pill btn-import">✨ MAGIC IMPORT</button>
                </div>
            </div>

            <div className="search-container">
                <span className="text-slate-400">🔎</span>
                <input className="search-input" placeholder={`Rechercher dans ${view}...`} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
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
                                    ? (it.taughtSubjectsText || 'Aucune matière') 
                                    : (it.role || it.type || 'DATA')}
                            </span>
                        </div>
                        <div className="item-actions">
                            {(view === 'classes' || view === 'groups') && (
                                <button onClick={() => setViewingClass(it)} className="btn-action btn-list">👥 ÉLÈVES</button>
                            )}

                            {view === 'classes' && (
                                <>
                                    <button onClick={() => triggerClassImport(it._id)} className="btn-import-mini">📥 IMPORT CSV</button>
                                    <button onClick={() => handlePurgeClass(it)} className="btn-action bg-red-50 text-red-600 border border-red-100 hover:bg-red-600 hover:text-white" title="Supprimer tous les élèves">♻️ VIDER</button>
                                </>
                            )}
                            
                            {view === 'students' && (
                                <button onClick={() => setZoomedItem(it)} className="btn-action bg-cyan-50 text-cyan-600 border border-cyan-100 hover:bg-cyan-500 hover:text-white">🔍</button>
                            )}

                            {/* ✅ BOUTON VOIR AJOUTÉ */}
                            <button onClick={() => { setCurrentItem(it); setModalMode('view'); }} className="btn-action btn-view">👁️ VOIR</button>
                            <button onClick={() => { setCurrentItem(it); setModalMode('edit'); }} className="btn-action btn-modif">ÉDITER</button>
                            <button onClick={() => handleDelete(it._id)} className="btn-action btn-delete">✕</button>
                        </div>
                    </div>
                ))}
            </div>

            {/* ... MODALES EXISTANTES (Zoom Item, View Class) ... */}
            {zoomedItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4" onClick={() => setZoomedItem(null)}>
                    <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="bg-indigo-600 p-6 text-white text-center">
                            <div className="text-4xl mb-2">{zoomedItem.gender === 'F' ? '👩' : '👨'}</div>
                            <h2 className="text-2xl font-black uppercase">{zoomedItem.firstName} {zoomedItem.lastName}</h2>
                            <div className="opacity-80 font-bold tracking-widest text-xs mt-1">{zoomedItem.email}</div>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex justify-between border-b pb-2">
                                <span className="text-slate-400 font-bold text-xs uppercase">Classe</span>
                                <span className="font-black text-slate-800">{zoomedItem.currentClass || "N/A"}</span>
                            </div>
                            <div className="flex justify-between border-b pb-2">
                                <span className="text-slate-400 font-bold text-xs uppercase">Groupes</span>
                                <span className="font-black text-slate-800 text-right text-xs">
                                    {(zoomedItem.assignedGroups || []).map(gId => {
                                        const g = allClasses.find(c => c._id === gId);
                                        return g ? g.name : "";
                                    }).filter(Boolean).join(', ') || "Aucun"}
                                </span>
                            </div>
                            <div className="flex justify-between border-b pb-2">
                                <span className="text-slate-400 font-bold text-xs uppercase">Mot de passe</span>
                                <span className="font-mono text-indigo-600 bg-indigo-50 px-2 rounded">{zoomedItem.password}</span>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 text-center">
                            <button onClick={() => setZoomedItem(null)} className="btn-action w-full">FERMER</button>
                        </div>
                    </div>
                </div>
            )}

            {viewingClass && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4" onClick={() => setViewingClass(null)}>
                    <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-black text-lg uppercase text-slate-700">LISTE {viewingClass.name}</h3>
                            <button onClick={() => setViewingClass(null)} className="text-slate-400 hover:text-red-500 font-black">✕</button>
                        </div>
                        <div className="p-0 h-96 overflow-y-auto">
                             {allStudents.filter(s => {
                                 const isMainClass = String(s.classId) === String(viewingClass._id);
                                 const isInGroup = (s.assignedGroups || []).includes(viewingClass._id);
                                 return isMainClass || isInGroup;
                             }).length === 0 
                                ? <div className="p-10 text-center text-slate-300 font-bold uppercase">Aucun élève</div>
                                : allStudents
                                    .filter(s => String(s.classId) === String(viewingClass._id) || (s.assignedGroups || []).includes(viewingClass._id))
                                    .sort((a,b) => a.lastName.localeCompare(b.lastName))
                                    .map(s => (
                                        <div key={s._id} className="p-4 border-b hover:bg-slate-50 flex justify-between items-center">
                                            <div>
                                                <div className="font-bold text-slate-700">{s.lastName} {s.firstName}</div>
                                                <div className="text-[10px] text-slate-400 font-mono">{s.birthDate} • {s.gender}</div>
                                            </div>
                                            <span className="text-xs font-mono text-slate-400">{s.email}</span>
                                        </div>
                                    ))
                             }
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODALE GÉNÉRIQUE (CREATE / EDIT / VIEW) --- */}
            {modalMode && currentItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4" onClick={() => setModalMode(null)}>
                    <div className="bg-white w-full max-w-2xl rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        
                        {/* ✅ TITRE ADAPTATIF */}
                        <h3 className="text-xl font-black uppercase mb-6 text-indigo-600">
                            {modalMode === 'create' ? 'Création' : modalMode === 'edit' ? 'Modification' : 'Consultation'} {view}
                        </h3>
                        
                        <div className="space-y-4 mb-8">
                            
                             {/* SAISIE RAPIDE PAR EMAIL (RÈGLE VUILLET.JEAN) - Caché en mode VIEW */}
                             {(view === 'students' || view === 'teachers') && modalMode !== 'view' && (
                                <div className="mb-6 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                                    <label className="form-label !text-indigo-600 !mt-0 mb-2">⚡ Saisie via Email (Déduit Nom/Prénom)</label>
                                    <input 
                                        className="w-full p-3 border-2 border-indigo-200 rounded-lg bg-white font-bold text-indigo-900 placeholder-indigo-200 focus:border-indigo-500 focus:outline-none" 
                                        placeholder="ex: vuillet.jean@condamine.edu.ec" 
                                        value={currentItem.email || ''}
                                        onChange={e => {
                                            const val = e.target.value;
                                            const newState = { ...currentItem, email: val };
                                            
                                            // Auto-remplissage si format correct
                                            const id = parseEmailToIdentity(val);
                                            if (id) {
                                                newState.lastName = id.lastName;
                                                newState.firstName = id.firstName;
                                            }
                                            setCurrentItem(newState);
                                        }}
                                    />
                                    <div className="text-[10px] text-indigo-400 text-right mt-1 italic">Partie 1 = Nom, Partie 2 = Prénom</div>
                                </div>
                             )}

                             {/* CHAMP NOM COMPLET (INDÉPENDANT) */}
                             {view === 'students' && (
                                <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <label className="form-label !mt-0 mb-2">Nom Complet (Format Libre)</label>
                                    <input 
                                        className="w-full p-3 border rounded-lg bg-white font-bold text-slate-700 disabled:opacity-60 disabled:bg-slate-100"
                                        placeholder="ex: DE LA FONTAINE Jean" 
                                        value={currentItem.fullName || ''}
                                        disabled={modalMode === 'view'}
                                        onChange={e => setCurrentItem({ ...currentItem, fullName: e.target.value })}
                                    />
                                    {modalMode !== 'view' && <div className="text-[10px] text-slate-400 text-right mt-1 italic">Ce champ est indépendant.</div>}
                                </div>
                             )}

                             <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col">
                                    <label className="form-label">Nom / Intitulé</label>
                                    <input 
                                        className="w-full p-3 border rounded font-bold uppercase disabled:opacity-60 disabled:bg-slate-100" 
                                        value={currentItem.lastName || currentItem.name || ''} 
                                        disabled={modalMode === 'view'}
                                        onChange={e => setCurrentItem({...currentItem, lastName:e.target.value, name:e.target.value})} 
                                    />
                                </div>
                                {(view === 'students' || view === 'teachers' || view === 'staff' || view === 'administrateurs') && (
                                    <div className="flex flex-col">
                                        <label className="form-label">Prénom</label>
                                        <input 
                                            className="w-full p-3 border rounded font-bold disabled:opacity-60 disabled:bg-slate-100" 
                                            value={currentItem.firstName||''} 
                                            disabled={modalMode === 'view'}
                                            onChange={e=>setCurrentItem({...currentItem, firstName:e.target.value})} 
                                        />
                                    </div>
                                )}
                             </div>

                             {view === 'teachers' && (
                                <>
                                    <div>
                                        <label className="form-label">Matières enseignées</label>
                                        <div className="selection-grid">
                                            {allSubjects.map(sub => (
                                                <div 
                                                    key={sub._id} 
                                                    onClick={() => toggleRelation('taughtSubjects', sub._id)}
                                                    className={`toggle-chip ${currentItem.taughtSubjects.includes(sub._id) ? 'selected' : ''} ${modalMode === 'view' ? 'disabled' : ''}`}
                                                >
                                                    {sub.name}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="form-label">Classes & Groupes assignés</label>
                                        <div className="selection-grid">
                                            {allClasses.map(cls => (
                                                <div 
                                                    key={cls._id} 
                                                    onClick={() => toggleRelation('assignedClasses', cls._id)}
                                                    className={`toggle-chip ${currentItem.assignedClasses.includes(cls._id) ? 'selected' : ''} ${modalMode === 'view' ? 'disabled' : ''}`}
                                                >
                                                    {cls.type === 'GROUP' ? '🛑' : '🟦'} {cls.name}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                             )}
                             
                             {view === 'students' && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex flex-col">
                                            <label className="form-label">Sexe</label>
                                            <select 
                                                className="w-full p-3 border rounded bg-white disabled:opacity-60 disabled:bg-slate-100" 
                                                value={currentItem.gender || 'M'} 
                                                disabled={modalMode === 'view'}
                                                onChange={e => setCurrentItem({...currentItem, gender:e.target.value})}
                                            >
                                                <option value="M">Homme</option>
                                                <option value="F">Femme</option>
                                            </select>
                                        </div>
                                        <div className="flex flex-col">
                                            <label className="form-label">Classe Principale</label>
                                            <select 
                                                className="w-full p-3 border rounded bg-white font-bold disabled:opacity-60 disabled:bg-slate-100" 
                                                value={currentItem.classId || ''} 
                                                disabled={modalMode === 'view'}
                                                onChange={e => setCurrentItem({...currentItem, classId:e.target.value})}
                                            >
                                                <option value="">-- AUCUNE --</option>
                                                {allClasses.filter(c => c.type === 'CLASS').map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    {/* ✅ AJOUT DATE DE NAISSANCE + PASSWORD AUTO */}
                                    <div className="flex flex-col">
                                        <label className="form-label">Date de Naissance (Format JJ/MM/AAAA)</label>
                                        <input
                                            className="w-full p-3 border rounded bg-white font-bold tracking-widest disabled:opacity-60 disabled:bg-slate-100"
                                            placeholder="ex: 04/11/2005"
                                            value={currentItem.birthDate || ''}
                                            disabled={modalMode === 'view'}
                                            onChange={e => {
                                                const val = e.target.value;
                                                const rawDate = val.replace(/[^0-9]/g, ''); // Garde chiffres pour le MDP
                                                setCurrentItem({
                                                    ...currentItem,
                                                    birthDate: val,
                                                    password: rawDate // Auto Password = JJMMAAAA
                                                });
                                            }}
                                        />
                                        {modalMode !== 'view' && (
                                            <div className="text-[10px] text-emerald-500 text-right mt-1 font-bold uppercase">
                                                Mot de passe généré : {currentItem.password || '(En attente de date)'}
                                            </div>
                                        )}
                                    </div>

                                    {/* FILTRE GROUPE STRICT PAR CLASSE */}
                                    <div>
                                        <label className="form-label">Options & Groupes</label>
                                        {!currentItem.classId ? (
                                            <div className="text-xs text-slate-400 italic pl-2 border-l-2 border-slate-200 py-2">
                                                ⚠️ Sélectionnez d'abord une classe principale pour voir les groupes disponibles.
                                            </div>
                                        ) : (
                                            <div className="selection-grid">
                                                {allClasses
                                                    .filter(c => {
                                                        const currentClassName = allClasses.find(cl => cl._id === currentItem.classId)?.name || "";
                                                        return c.type === 'GROUP' && c.name.startsWith(currentClassName);
                                                    })
                                                    .map(grp => (
                                                    <div 
                                                        key={grp._id} 
                                                        onClick={() => toggleRelation('assignedGroups', grp._id)}
                                                        className={`toggle-chip ${currentItem.assignedGroups?.includes(grp._id) ? 'selected' : ''} ${modalMode === 'view' ? 'disabled' : ''}`}
                                                    >
                                                        {grp.name}
                                                    </div>
                                                ))}
                                                {allClasses.filter(c => {
                                                    const currentClassName = allClasses.find(cl => cl._id === currentItem.classId)?.name || "";
                                                    return c.type === 'GROUP' && c.name.startsWith(currentClassName);
                                                }).length === 0 && (
                                                    <span className="text-xs text-slate-400 italic">Aucun groupe trouvé pour cette classe.</span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mt-4">
                                         <input 
                                            className="w-full p-3 border rounded bg-slate-50 font-mono text-slate-400 disabled:opacity-60" 
                                            placeholder="Mot de Passe" 
                                            value={currentItem.password||''} 
                                            disabled={modalMode === 'view'}
                                            onChange={e=>setCurrentItem({...currentItem, password:e.target.value})} 
                                        />
                                    </div>
                                </>
                             )}

                             {(view === 'classes' || view === 'groups') && (
                                 <div className="flex flex-col">
                                     <label className="form-label">Type de structure</label>
                                     <div className="flex gap-4 mt-2">
                                         <button disabled={modalMode === 'view'} onClick={() => setCurrentItem({...currentItem, type: 'CLASS'})} className={`flex-1 p-3 rounded-xl border-2 font-black ${currentItem.type === 'CLASS' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-400'} ${modalMode === 'view' ? 'opacity-60' : ''}`}>CLASSE (ex: 6A)</button>
                                         <button disabled={modalMode === 'view'} onClick={() => setCurrentItem({...currentItem, type: 'GROUP'})} className={`flex-1 p-3 rounded-xl border-2 font-black ${currentItem.type === 'GROUP' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-400'} ${modalMode === 'view' ? 'opacity-60' : ''}`}>GROUPE (ex: 3B ANGLAIS)</button>
                                     </div>
                                 </div>
                             )}

                             {view === 'administrateurs' && (
                                <div className="grid grid-cols-2 gap-4">
                                     <input 
                                        className="w-full p-3 border rounded bg-slate-50 disabled:opacity-60" 
                                        placeholder="Mot de Passe" 
                                        value={currentItem.password||''} 
                                        disabled={modalMode === 'view'}
                                        onChange={e=>setCurrentItem({...currentItem, password:e.target.value})} 
                                    />
                                </div>
                             )}
                        </div>
                        
                        <div className="flex justify-end gap-3 pt-6 border-t">
                            {modalMode === 'view' ? (
                                <button onClick={() => setModalMode(null)} className="btn-action bg-slate-200 text-slate-600 hover:bg-slate-300">Fermer</button>
                            ) : (
                                <>
                                    <button onClick={() => setModalMode(null)} className="btn-action">Annuler</button>
                                    <button onClick={handleSave} className="btn-action bg-indigo-600 text-white">Sauvegarder</button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showMagicModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4" onClick={() => setShowMagicModal(false)}>
                    <div className="bg-white w-full max-w-3xl rounded-3xl p-8 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-black uppercase mb-2 text-indigo-600">Import Élèves (IA)</h3>
                        <div className="flex justify-between items-center mb-4">
                            <p className="text-xs font-bold text-slate-400 uppercase">Collez une liste brute (Excel, Word, Texte) ou importez un CSV.</p>
                        </div>
                        {magicLog ? (
                            <div className="w-full h-64 bg-slate-900 text-emerald-400 font-mono text-xs p-4 rounded-2xl overflow-y-auto border-2 border-slate-800">
                                {magicLog.split('\n').map((l, i) => <div key={i}>{l}</div>)}
                            </div>
                        ) : (
                            <textarea 
                                className="w-full h-64 bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 font-mono text-xs focus:border-indigo-500 outline-none resize-none mb-6"
                                placeholder="Exemple :&#10;vuillet.jean@ecole.com&#10;Dupont Pierre 6A Option Latin..."
                                value={magicText}
                                onChange={e => setMagicText(e.target.value)}
                            />
                        )}
                        <div className="flex justify-end gap-3 mt-4">
                            <button onClick={() => setShowMagicModal(false)} className="px-5 py-3 rounded-xl font-bold text-xs uppercase text-slate-500 hover:bg-slate-100">Fermer</button>
                            {!magicLog && <button onClick={handleMagicImport} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase">Lancer l'Analyse</button>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}