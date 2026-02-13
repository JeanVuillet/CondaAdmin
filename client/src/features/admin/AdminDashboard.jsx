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
    const [viewingClass, setViewingClass] = useState(null);
    const [zoomedItem, setZoomedItem] = useState(null);
    
    // États Magic Import & CSV
    const [importing, setImporting] = useState(false);
    const [showMagicModal, setShowMagicModal] = useState(false);
    const [magicLog, setMagicLog] = useState("");
    
    // Refs pour upload fichier
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
        if (modalMode === 'view') return; 

        const targetCollection = collectionMap[view];
        let dataToSend = { ...currentItem };
        
        if (view === 'teachers') {
            const subjects = Array.isArray(dataToSend.taughtSubjects) ? dataToSend.taughtSubjects : [];
            const classes = Array.isArray(dataToSend.assignedClasses) ? dataToSend.assignedClasses : [];
            dataToSend.taughtSubjects = subjects;
            dataToSend.assignedClasses = classes;
            dataToSend.taughtSubjectsText = allSubjects.filter(s => subjects.includes(s._id)).map(s => s.name).join(', ');
            dataToSend.assignedClassesText = allClasses.filter(c => classes.includes(c._id)).map(c => c.name).join(', ');
        }

        if (view === 'students') {
             dataToSend.assignedGroups = Array.isArray(dataToSend.assignedGroups) ? dataToSend.assignedGroups : [];
             const mainClass = allClasses.find(c => c._id === dataToSend.classId);
             dataToSend.currentClass = mainClass ? mainClass.name : "SANS CLASSE";
             if (!dataToSend.firstName || !dataToSend.lastName) return alert("Nom et Prénom obligatoires !");
             
             // Assurance Nom Complet
             if (!dataToSend.fullName) dataToSend.fullName = `${dataToSend.lastName} ${dataToSend.firstName}`;
             
             // Assurance Password par défaut (Auto-génération si vide)
             if (!dataToSend.password) {
                 if(dataToSend.birthDate) {
                     // Tentative format JJMMAAAA sur saisie manuelle
                     const parts = dataToSend.birthDate.split(/[\/\-\.]/);
                     if (parts.length === 3) {
                         dataToSend.password = parts[0].padStart(2,'0') + parts[1].padStart(2,'0') + parts[2];
                     } else {
                         dataToSend.password = dataToSend.birthDate.replace(/[^0-9]/g, '');
                     }
                 } else {
                    dataToSend.password = "123456";
                 }
             }
        }

        // ✅ VALIDATION ADMIN : EMAIL OBLIGATOIRE + UNICITÉ NOM/PRÉNOM
        if (view === 'administrateurs') {
            // 1. Email Check
            if (!dataToSend.email || !dataToSend.email.includes('@')) {
                return alert("⚠️ L'email est obligatoire et doit être valide pour un administrateur.");
            }

            // 2. Nom+Prénom Check (Client-Side)
            const duplicateName = items.find(admin => 
                admin._id !== dataToSend._id && // On ne se compare pas à soi-même en édition
                admin.firstName.trim().toLowerCase() === dataToSend.firstName.trim().toLowerCase() &&
                admin.lastName.trim().toLowerCase() === dataToSend.lastName.trim().toLowerCase()
            );

            if (duplicateName) {
                return alert(`⛔ ERREUR : Un administrateur nommé "${dataToSend.firstName} ${dataToSend.lastName}" existe déjà.`);
            }
        }

        if (view === 'groups') dataToSend.type = 'GROUP'; 

        try {
            const res = await fetch(`/api/admin/${targetCollection}`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(dataToSend) 
            });
            const result = await res.json();
            
            if (result.error || result.code === 11000) {
                // Gestion fine des doublons remontés par le serveur
                if (result.keyPattern && result.keyPattern.email) {
                    alert("❌ ERREUR : Cet email est déjà utilisé par un autre administrateur.");
                } else {
                    alert("❌ ERREUR : Cet élément existe déjà (Doublon Prénom+Nom ou Email).");
                }
            } else {
                setModalMode(null); loadData();
            }
        } catch (e) { alert("Erreur réseau"); }
    };

    const toggleRelation = (field, id) => {
        if (modalMode === 'view') return;
        if (!currentItem) return;
        const currentList = Array.isArray(currentItem[field]) ? [...currentItem[field]] : [];
        if (currentList.includes(id)) {
            setCurrentItem({ ...currentItem, [field]: currentList.filter(x => x !== id) });
        } else {
            setCurrentItem({ ...currentItem, [field]: [...currentList, id] });
        }
    };

    const normalizeHeader = (str) => {
        return str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : "";
    };

    const parseEmailToIdentity = (email) => {
        if (!email || !email.includes('@')) return null;
        try {
            const local = email.split('@')[0];
            const parts = local.split(/[.]/); 
            // RÈGLE : Partie 1 = Nom, Partie 2 = Prénom
            let nom = parts[0] ? parts[0].toUpperCase() : "INCONNU";
            let prenom = parts.length > 1 ? parts[1] : "";
            if (prenom) prenom = prenom.charAt(0).toUpperCase() + prenom.slice(1).toLowerCase();
            return { lastName: nom, firstName: prenom };
        } catch (e) { return null; }
    };

    // --- 📥 IMPORT CSV STRICT (RÈGLES ETABLISSEMENT) ---
    const triggerClassImport = (classId) => {
        setTargetImportClass(classId);
        setTimeout(() => {
            if (classCsvInputRef.current) classCsvInputRef.current.click();
        }, 50);
    };

    const handleClassFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file || !targetImportClass) return;

        const classObj = allClasses.find(c => c._id === targetImportClass);
        const targetClassName = classObj ? classObj.name.toUpperCase().trim() : "SANS CLASSE";
        
        // 1. VERIF NOM FICHIER
        if (!file.name.toUpperCase().includes(targetClassName)) {
            alert(`⛔ FICHIER REJETÉ.\n\nRègle : Le fichier doit contenir "${targetClassName}" dans son nom.\nFichier actuel : ${file.name}`);
            e.target.value = ""; 
            return;
        }

        setImporting(true);
        setShowMagicModal(true); 
        setMagicLog(`📂 Lecture fichier : ${file.name}...\n`);

        const reader = new FileReader();
        
        reader.onload = async (evt) => {
            try {
                const text = evt.target.result;
                const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
                if (lines.length < 1) throw new Error("Fichier vide.");

                const headerLineIndex = 0; 
                const headerLineRaw = lines[headerLineIndex];

                // 2. DÉTECTION SÉPARATEUR
                const countSemi = (headerLineRaw.match(/;/g) || []).length;
                const countComma = (headerLineRaw.match(/,/g) || []).length;
                const separator = countSemi >= countComma ? ';' : ',';
                setMagicLog(`⚙️ Séparateur : "${separator}"`);

                const headers = headerLineRaw.split(separator).map(h => normalizeHeader(h));
                setMagicLog(`📋 En-têtes détectés : ${headers.length} colonnes`);

                // 3. MAPPING DES COLONNES
                const map = {
                    email: headers.findIndex(h => h.includes('email') || h.includes('mail')),
                    fullname: headers.findIndex(h => h.includes('eleve') || h.includes('nom complet')),
                    sex: headers.findIndex(h => h.includes('sexe') || h.includes('genre')),
                    birthDate: headers.findIndex(h => h.includes('ne(e) le') || h.includes('ne le') || h.includes('naissance')),
                };

                // RECHERCHE COLONNES GROUPES (M, N, O, P) - Indices 12, 13, 14, 15
                const groupCols = [12, 13, 14]; // M, N, O toujours inclus
                
                // CONDITION POUR LA COLONNE P (15) : Seulement si titre = "Autres options"
                if (headers[15] && headers[15].includes('autre')) {
                    groupCols.push(15);
                    setMagicLog(`✅ Colonne P (Autres options) détectée et activée.`);
                } else {
                    setMagicLog(`ℹ️ Colonne P ignorée (Titre non conforme : "${headers[15] || 'Vide'}")`);
                }

                if (map.email === -1) throw new Error("Colonne 'Email' introuvable (Requise pour nom/prénom).");

                // --- PHASE 1 : ANALYSE ET CRÉATION DES GROUPES MANQUANTS ---
                setMagicLog(`\n🔎 ANALYSE DES GROUPES REQUIS...`);
                const rowsToProcess = [];
                const neededGroups = new Set();

                for (let i = headerLineIndex + 1; i < lines.length; i++) {
                    const lineStr = lines[i];
                    if (!lineStr || lineStr.trim() === "") continue;
                    const cols = lineStr.split(separator).map(c => c.trim().replace(/"/g, ''));
                    
                    const rowGroupNames = [];
                    
                    groupCols.forEach(idx => {
                        const cellContent = cols[idx];
                        if(cellContent && cellContent.length > 1) {
                            // Split par virgule si plusieurs groupes dans une case
                            const parts = cellContent.split(',');
                            parts.forEach(part => {
                                const cleanOptionName = part.trim().toUpperCase();
                                if(cleanOptionName) {
                                    // CONSTRUCTION : CLASSE + " " + GROUPE
                                    const fullGroupName = `${targetClassName} ${cleanOptionName}`;
                                    neededGroups.add(fullGroupName);
                                    rowGroupNames.push(fullGroupName);
                                }
                            });
                        }
                    });
                    rowsToProcess.push({ cols, rowGroupNames });
                }

                // Récupération ID des groupes existants
                const groupNameIdMap = {};
                allClasses.filter(c => c.type === 'GROUP').forEach(g => groupNameIdMap[g.name] = g._id);

                let groupsCreated = 0;
                // Création des manquants
                for (const gName of neededGroups) {
                    if (!groupNameIdMap[gName]) {
                        try {
                            setMagicLog(`🏗️ Création Groupe : ${gName}`);
                            const res = await fetch('/api/admin/classrooms', {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify({ name: gName, type: 'GROUP' })
                            });
                            const newGroup = await res.json();
                            if (newGroup._id) {
                                groupNameIdMap[gName] = newGroup._id;
                                groupsCreated++;
                            }
                        } catch(e) { console.error(e); }
                    }
                }
                if(groupsCreated > 0) setMagicLog(`✅ ${groupsCreated} nouveaux groupes créés en base.`);

                // --- PHASE 2 : SIMULATION & VALIDATION (TOLÉRANCE ZÉRO) ---
                setMagicLog(`\n🛡️ SCAN ANTI-DOUBLONS EN COURS...`);
                
                const preparedPayloads = [];
                const duplicateErrors = [];
                const localEmailSet = new Set(); // Pour doubons internes au fichier
                const localNameSet = new Set();

                for (const row of rowsToProcess) {
                    const cols = row.cols;
                    const assignedGroups = row.rowGroupNames.map(name => groupNameIdMap[name]).filter(id => id);

                    // --- PARSING IDENTITÉ ---
                    let email = cols[map.email] ? cols[map.email].toLowerCase() : "";
                    if (!email || !email.includes('@')) continue; 

                    let firstName = "Prénom";
                    let lastName = "NOM";
                    try {
                        const localPart = email.split('@')[0];
                        const nameParts = localPart.split('.');
                        if (nameParts.length >= 2) {
                            lastName = nameParts[0].toUpperCase();
                            firstName = nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1).toLowerCase();
                        } else {
                            lastName = localPart.toUpperCase();
                            firstName = "";
                        }
                    } catch(e) {}

                    let fullName = (map.fullname !== -1 && cols[map.fullname]) ? cols[map.fullname] : `${lastName} ${firstName}`;
                    
                    // --- ATTRUBUTS ---
                    let gender = 'M';
                    if (map.sex !== -1 && cols[map.sex]) {
                        const firstChar = cols[map.sex].charAt(0).toUpperCase();
                        if (firstChar === 'F' || firstChar === 'W') gender = 'F';
                    }

                    // --- DATES ---
                    let birthDate = (map.birthDate !== -1 && cols[map.birthDate]) ? cols[map.birthDate].trim() : "";
                    let password = "123456"; 
                    if (birthDate) {
                        const parts = birthDate.split(/[\/\-\.]/);
                        if (parts.length === 3) {
                            const d = parts[0].trim().padStart(2, '0');
                            const m = parts[1].trim().padStart(2, '0');
                            let y = parts[2].trim();
                            if(y.length === 2) y = "20" + y;
                            password = `${d}${m}${y}`;
                            birthDate = `${d}/${m}/${y}`;
                        } else {
                            const digits = birthDate.replace(/[^0-9]/g, '');
                            if (digits.length >= 6) password = digits; 
                        }
                    }

                    // 🛑 VÉRIFICATION DOUBLON EN BASE DE DONNÉES
                    const dbDuplicate = allStudents.find(s => 
                        (s.lastName.toUpperCase() === lastName && s.firstName.toLowerCase() === firstName.toLowerCase()) || 
                        (s.email.toLowerCase() === email.toLowerCase())
                    );
                    
                    // 🛑 VÉRIFICATION DOUBLON INTERNE FICHIER
                    const internalDupEmail = localEmailSet.has(email);
                    const internalDupName = localNameSet.has(`${firstName.toLowerCase()}|${lastName.toUpperCase()}`);

                    if (dbDuplicate || internalDupEmail || internalDupName) {
                        const cause = dbDuplicate ? "(Existe déjà en base)" : "(Doublon dans le fichier)";
                        duplicateErrors.push(`🔴 ${firstName} ${lastName} ${cause}`);
                    } else {
                        localEmailSet.add(email);
                        localNameSet.add(`${firstName.toLowerCase()}|${lastName.toUpperCase()}`);
                        
                        preparedPayloads.push({
                            firstName, lastName, fullName, email, password, 
                            classId: targetImportClass, 
                            currentClass: targetClassName, 
                            assignedGroups, gender, birthDate 
                        });
                    }
                }

                // --- POINT DE DÉCISION ---
                if (duplicateErrors.length > 0) {
                    setMagicLog(`\n⛔ IMPORT ANNULÉ : ${duplicateErrors.length} DOUBLONS DÉTECTÉS.`);
                    setMagicLog(`\n--- LISTE DES ERREURS ---\n`);
                    duplicateErrors.forEach(err => setMagicLog(err));
                    setMagicLog(`\n⚠️ Veuillez nettoyer votre fichier ou la base de données avant de réessayer.`);
                    return; // ⛔ STOP ICI, RIEN N'EST ENVOYÉ EN BASE
                }

                // --- PHASE 3 : EXÉCUTION RÉELLE (POST) ---
                setMagicLog(`\n🟢 VALIDATION OK. CRÉATION DE ${preparedPayloads.length} ÉLÈVES...`);
                
                let successCount = 0;
                let errorCount = 0;

                for (const payload of preparedPayloads) {
                    try {
                        const res = await fetch('/api/admin/students', {
                            method: 'POST',
                            headers: {'Content-Type':'application/json'},
                            body: JSON.stringify(payload)
                        });
                        const data = await res.json();
                        if (data.error || data.code === 11000) {
                            errorCount++;
                            setMagicLog(`❌ Erreur technique sur ${payload.firstName} ${payload.lastName}`);
                        } else {
                            successCount++;
                        }
                    } catch (err) { errorCount++; }
                    
                    if((successCount + errorCount) % 5 === 0) setMagicLog(`... ${successCount + errorCount} traités`);
                }

                setMagicLog(`\n🏁 RAPPORT FINAL :\n- Ajoutés : ${successCount}\n- Échecs techniques : ${errorCount}`);

                e.target.value = ""; 
                setTimeout(() => {
                    if (confirm(`SUCCÈS.\n\n${successCount} élèves importés.\n\nRecharger la liste ?`)) {
                        setShowMagicModal(false); setMagicLog(""); loadData();
                    }
                }, 1000);

            } catch (err) {
                setMagicLog(`❌ ERREUR FATALE : ${err.message}`);
                e.target.value = ""; 
            }
        };
        reader.readAsText(file);
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
                    <div className="animate-pulse whitespace-pre-line text-center">{magicLog || "TRAITEMENT EN COURS..."}</div>
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
                                    <button onClick={() => handlePurgeClass(it)} className="btn-action bg-red-50 text-red-600 border border-red-100 hover:bg-red-600 hover:text-white" title="Vider la classe">♻️ VIDER</button>
                                </>
                            )}
                            
                            {view === 'students' && (
                                <button onClick={() => setZoomedItem(it)} className="btn-action bg-cyan-50 text-cyan-600 border border-cyan-100 hover:bg-cyan-500 hover:text-white">🔍</button>
                            )}

                            <button onClick={() => { setCurrentItem(it); setModalMode('view'); }} className="btn-action btn-view">👁️ VOIR</button>
                            <button onClick={() => { setCurrentItem(it); setModalMode('edit'); }} className="btn-action btn-modif">ÉDITER</button>
                            <button onClick={() => handleDelete(it._id)} className="btn-action btn-delete">✕</button>
                        </div>
                    </div>
                ))}
            </div>

            {/* ... MODALES (ZOOM, VIEW, EDIT) ... */}
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

            {modalMode && currentItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4" onClick={() => setModalMode(null)}>
                    <div className="bg-white w-full max-w-2xl rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        
                        <h3 className="text-xl font-black uppercase mb-6 text-indigo-600">
                            {modalMode === 'create' ? 'Création' : modalMode === 'edit' ? 'Modification' : 'Consultation'} {view}
                        </h3>
                        
                        <div className="space-y-4 mb-8">
                             {(view === 'students' || view === 'teachers' || view === 'administrateurs') && (
                                <div className={`mb-6 p-4 rounded-xl border ${modalMode !== 'view' ? 'bg-indigo-50 border-indigo-100' : 'bg-white border-slate-200'}`}>
                                    <label className={`form-label !mt-0 mb-2 ${modalMode !== 'view' ? '!text-indigo-600' : ''}`}>
                                        {modalMode !== 'view' ? '⚡ Saisie via Email (Déduit Nom/Prénom)' : 'Email'}
                                    </label>
                                    <input 
                                        className={`w-full p-3 border-2 rounded-lg font-bold outline-none ${modalMode !== 'view' ? 'border-indigo-200 bg-white text-indigo-900 placeholder-indigo-200 focus:border-indigo-500' : 'border-slate-200 bg-slate-50 text-slate-500'}`}
                                        placeholder="ex: nom.prenom@ecole.com" 
                                        value={currentItem.email || ''}
                                        disabled={modalMode === 'view'}
                                        onChange={e => {
                                            const val = e.target.value;
                                            const newState = { ...currentItem, email: val };
                                            const id = parseEmailToIdentity(val);
                                            if (id) {
                                                newState.lastName = id.lastName;
                                                newState.firstName = id.firstName;
                                            }
                                            setCurrentItem(newState);
                                        }}
                                    />
                                    {modalMode !== 'view' && <div className="text-[10px] text-indigo-400 text-right mt-1 italic">Format attendu : nom.prenom@...</div>}
                                </div>
                             )}

                             {view === 'students' && (
                                <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <label className="form-label !mt-0 mb-2">Nom Complet</label>
                                    <input 
                                        className="w-full p-3 border rounded-lg bg-white font-bold text-slate-700 disabled:opacity-60 disabled:bg-slate-100"
                                        placeholder="Généré automatiquement..." 
                                        value={currentItem.fullName || `${currentItem.lastName || ''} ${currentItem.firstName || ''}`}
                                        disabled={modalMode === 'view'}
                                        onChange={e => setCurrentItem({ ...currentItem, fullName: e.target.value })}
                                    />
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
                             
                             {/* GESTION DES ADMINS */}
                             {view === 'administrateurs' && (
                                <div className="flex flex-col">
                                    <label className="form-label">Mot de Passe</label>
                                    <input 
                                        className="w-full p-3 border rounded font-bold disabled:opacity-60" 
                                        type="text"
                                        value={currentItem.password || ''} 
                                        disabled={modalMode === 'view'}
                                        onChange={e => setCurrentItem({...currentItem, password: e.target.value})} 
                                    />
                                </div>
                             )}

                             {view === 'teachers' && (
                                <>
                                    <div>
                                        <label className="form-label">Matières</label>
                                        <div className="selection-grid">
                                            {allSubjects.map(sub => (
                                                <div key={sub._id} onClick={() => toggleRelation('taughtSubjects', sub._id)} className={`toggle-chip ${currentItem.taughtSubjects.includes(sub._id) ? 'selected' : ''} ${modalMode === 'view' ? 'disabled' : ''}`}>{sub.name}</div>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    {/* SÉPARATION DES CLASSES ET DES GROUPES */}
                                    <div>
                                        <label className="form-label">Classes Principales</label>
                                        <div className="selection-grid">
                                            {allClasses.filter(c => c.type === 'CLASS').map(cls => (
                                                <div key={cls._id} onClick={() => toggleRelation('assignedClasses', cls._id)} className={`toggle-chip ${currentItem.assignedClasses.includes(cls._id) ? 'selected' : ''} ${modalMode === 'view' ? 'disabled' : ''}`}>{cls.name}</div>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    <div className="mt-4">
                                        <label className="form-label">Groupes / Options</label>
                                        <div className="selection-grid">
                                            {allClasses.filter(c => c.type === 'GROUP').map(grp => (
                                                <div key={grp._id} onClick={() => toggleRelation('assignedClasses', grp._id)} className={`toggle-chip ${currentItem.assignedClasses.includes(grp._id) ? 'selected' : ''} ${modalMode === 'view' ? 'disabled' : ''}`}>{grp.name}</div>
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
                                            <select className="w-full p-3 border rounded bg-white disabled:opacity-60" value={currentItem.gender || 'M'} disabled={modalMode === 'view'} onChange={e => setCurrentItem({...currentItem, gender:e.target.value})}>
                                                <option value="M">Homme</option>
                                                <option value="F">Femme</option>
                                            </select>
                                        </div>
                                        <div className="flex flex-col">
                                            <label className="form-label">Classe Principale</label>
                                            <select className="w-full p-3 border rounded bg-white font-bold disabled:opacity-60" value={currentItem.classId || ''} disabled={modalMode === 'view'} onChange={e => setCurrentItem({...currentItem, classId:e.target.value})}>
                                                <option value="">-- AUCUNE --</option>
                                                {allClasses.filter(c => c.type === 'CLASS').map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="flex flex-col">
                                        <label className="form-label">Date de Naissance (jj/mm/aaaa)</label>
                                        <input
                                            className="w-full p-3 border rounded bg-white font-bold tracking-widest disabled:opacity-60"
                                            placeholder="ex: 04/11/2005"
                                            value={currentItem.birthDate || ''}
                                            disabled={modalMode === 'view'}
                                            onChange={e => {
                                                const val = e.target.value;
                                                const rawDate = val.replace(/[^0-9]/g, ''); 
                                                setCurrentItem({
                                                    ...currentItem,
                                                    birthDate: val,
                                                    password: rawDate // Auto-update password
                                                });
                                            }}
                                        />
                                    </div>

                                    <div>
                                        <label className="form-label">Options & Groupes</label>
                                        {!currentItem.classId ? (
                                            <div className="text-xs text-slate-400 italic pl-2 border-l-2 border-slate-200 py-2">
                                                ⚠️ Sélectionnez d'abord une classe principale.
                                            </div>
                                        ) : (
                                            <div className="selection-grid">
                                                {allClasses
                                                    .filter(c => {
                                                        const currentClassName = allClasses.find(cl => cl._id === currentItem.classId)?.name || "";
                                                        return c.type === 'GROUP' && c.name.startsWith(currentClassName);
                                                    })
                                                    .map(grp => (
                                                    <div key={grp._id} onClick={() => toggleRelation('assignedGroups', grp._id)} className={`toggle-chip ${currentItem.assignedGroups?.includes(grp._id) ? 'selected' : ''} ${modalMode === 'view' ? 'disabled' : ''}`}>{grp.name}</div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="mt-4">
                                        <label className="form-label">Mot de Passe (Auto-généré)</label>
                                        <input className="w-full p-3 border rounded bg-slate-50 font-mono text-slate-400 disabled:opacity-60" value={currentItem.password||''} disabled={modalMode === 'view'} onChange={e=>setCurrentItem({...currentItem, password:e.target.value})} />
                                    </div>
                                </>
                             )}

                             {(view === 'classes' || view === 'groups') && (
                                 <div className="flex flex-col">
                                     <label className="form-label">Type</label>
                                     <div className="flex gap-4 mt-2">
                                         <button disabled={modalMode === 'view'} onClick={() => setCurrentItem({...currentItem, type: 'CLASS'})} className={`flex-1 p-3 rounded-xl border-2 font-black ${currentItem.type === 'CLASS' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-400'}`}>CLASSE (ex: 6A)</button>
                                         <button disabled={modalMode === 'view'} onClick={() => setCurrentItem({...currentItem, type: 'GROUP'})} className={`flex-1 p-3 rounded-xl border-2 font-black ${currentItem.type === 'GROUP' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-400'}`}>GROUPE</button>
                                     </div>
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
                        <h3 className="text-xl font-black uppercase mb-2 text-indigo-600">Import Massif (Logs)</h3>
                        <div className="w-full h-64 bg-slate-900 text-emerald-400 font-mono text-xs p-4 rounded-2xl overflow-y-auto border-2 border-slate-800">
                            {magicLog.split('\n').map((l, i) => <div key={i}>{l}</div>)}
                        </div>
                        <div className="flex justify-end gap-3 mt-4">
                            <button onClick={() => setShowMagicModal(false)} className="px-5 py-3 rounded-xl font-bold text-xs uppercase text-slate-500 hover:bg-slate-100">Fermer</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}