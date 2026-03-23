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
    const [viewingClass, setViewingClass] = useState(null); // Pour la liste d'élèves
    const [zoomedItem, setZoomedItem] = useState(null);     // Pour le Zoom (Loupe)
    
    // États Import CSV
    const [importing, setImporting] = useState(false);
    const [showMagicModal, setShowMagicModal] = useState(false);
    const [magicLog, setMagicLog] = useState("");
    
    // Refs pour upload fichier
    const classCsvInputRef = useRef(null); 
    const groupCsvInputRef = useRef(null);
    const [targetImportClass, setTargetImportClass] = useState(null); 
    const [targetImportGroup, setTargetImportGroup] = useState(null);

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
            gender: 'M', birthDate: '', test: 'N', isTestAccount: false
        };
        setCurrentItem(defaults);
        setModalMode('create');
    };

    const handleOpenEdit = (item) => {
        const safeItem = { ...item };
        if (!Array.isArray(safeItem.taughtSubjects)) safeItem.taughtSubjects = [];
        if (!Array.isArray(safeItem.assignedClasses)) safeItem.assignedClasses = [];
        if (!Array.isArray(safeItem.assignedGroups)) safeItem.assignedGroups = [];
        // Sécurité : on vide le password pour ne pas écraser le hash
        if (view === 'administrateurs' || view === 'teachers') {
            safeItem.password = ''; 
        }
        if (view === 'students') {
            safeItem.test = (safeItem.test === 'Y' || safeItem.test === 'N') ? safeItem.test : 'N';
            safeItem.isTestAccount = Boolean(safeItem.isTestAccount);
        }
        setCurrentItem(safeItem);
        setModalMode('edit');
    };

    const handleDelete = async (id) => {
        if (!confirm("⚠️ Confirmer la suppression ?")) return;
        await fetch(`/api/admin/${collectionMap[view]}/${id}`, { method: 'DELETE' });
        loadData();
    };
    
    const handlePurgeClass = async (cls) => {
        if (!confirm(`⚠️ DANGER IMMÉDIAT\n\nVous allez supprimer TOUS les élèves de la classe ${cls.name}.\n\nVoulez-vous vraiment vider cette classe ?`)) return;
        const check = prompt(`🔴 SÉCURITÉ : Tapez "${cls.name}" pour confirmer.`);
        if (check !== cls.name) return alert("Annulé.");

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
        } catch(e) { alert("Erreur serveur."); }
        setLoading(false);
    };

    const handleClearGroupStudents = async (group) => {
        if (!confirm(`⚠️ ATTENTION\n\nVous allez retirer le groupe ${group.name} de TOUS les élèves (champ ASSIGNEDGROUPS).\n\nConfirmer ?`)) return;
        const check = prompt(`🔴 SÉCURITÉ : Tapez exactement "${group.name}" pour continuer.`);
        if (check !== group.name) return alert("Annulé.");

        setLoading(true);
        try {
            const res = await fetch(`/api/admin/groups/${group._id}/clear-students`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erreur serveur.");
            alert(`✅ Groupe vidé : ${data.modifiedCount} élève(s) mis à jour.`);
            loadData();
        } catch (e) {
            alert(`❌ ${e.message || "Erreur serveur."}`);
        }
        setLoading(false);
    };

    const handleSave = async () => {
        if (modalMode === 'view') return; 

        const targetCollection = collectionMap[view];
        let dataToSend = { ...currentItem };
        
        if (view === 'teachers') {
            if (!dataToSend.lastName || !dataToSend.firstName) {
                return alert("Nom et Prénom obligatoires pour générer l'email.");
            }
            dataToSend.email = buildTeacherEmail(dataToSend.lastName, dataToSend.firstName);
            const subjects = Array.isArray(dataToSend.taughtSubjects) ? dataToSend.taughtSubjects : [];
            const classes = Array.isArray(dataToSend.assignedClasses) ? dataToSend.assignedClasses : [];
            dataToSend.taughtSubjectsText = allSubjects.filter(s => subjects.includes(s._id)).map(s => s.name).join(', ');
            dataToSend.assignedClassesText = allClasses.filter(c => classes.includes(c._id)).map(c => c.name).join(', ');
        }

        if (view === 'students') {
             if (!dataToSend.firstName || !dataToSend.lastName) return alert("Nom et Prénom obligatoires !");
             if (!dataToSend.fullName) dataToSend.fullName = `${dataToSend.lastName} ${dataToSend.firstName}`;
             dataToSend.test = dataToSend.test === 'Y' ? 'Y' : 'N';
             dataToSend.isTestAccount = Boolean(dataToSend.isTestAccount);
             
             if (!dataToSend.password) {
                 if(dataToSend.birthDate) {
                     const parts = dataToSend.birthDate.split(/[\/\-\.]/);
                     if (parts.length === 3) {
                         dataToSend.password = parts[0].padStart(2,'0') + parts[1].padStart(2,'0') + parts[2];
                     } else {
                         dataToSend.password = "123456";
                     }
                 } else {
                    dataToSend.password = "123456";
                 }
             }
        }

        if (view === 'administrateurs' || view === 'teachers') {
            if (!dataToSend.password || dataToSend.password.trim() === '') {
                delete dataToSend.password; 
            }
            if (view === 'administrateurs' && (!dataToSend.email || !dataToSend.email.includes('@'))) {
                return alert("⚠️ L'email est obligatoire.");
            }
        }

        try {
            const res = await fetch(`/api/admin/${targetCollection}`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(dataToSend) 
            });
            const result = await res.json();
            
            if (result.error || result.code === 11000) {
                alert("❌ ERREUR : Doublon détecté (Email ou Nom/Prénom).");
            } else {
                setModalMode(null); loadData();
            }
        } catch (e) { alert("Erreur réseau"); }
    };

    const toggleRelation = (field, id) => {
        if (modalMode === 'view') return;
        const currentList = Array.isArray(currentItem[field]) ? [...currentItem[field]] : [];
        if (currentList.includes(id)) setCurrentItem({ ...currentItem, [field]: currentList.filter(x => x !== id) });
        else setCurrentItem({ ...currentItem, [field]: [...currentList, id] });
    };

    const parseEmailToIdentity = (email) => {
        if (!email || !email.includes('@')) return null;
        try {
            const local = email.split('@')[0];
            const parts = local.split(/[.]/); 
            let nom = parts[0] ? parts[0].toUpperCase() : "INCONNU";
            let prenom = parts.length > 1 ? parts[1] : "";
            if (prenom) prenom = prenom.charAt(0).toUpperCase() + prenom.slice(1).toLowerCase();
            return { lastName: nom, firstName: prenom };
        } catch (e) { return null; }
    };

    const normalizeEmailToken = (value) => String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase();

    const buildTeacherEmail = (lastName, firstName) => {
        const nom = normalizeEmailToken(lastName);
        const prenom = normalizeEmailToken(firstName);
        if (!nom || !prenom) return '';
        return `${nom}.${prenom}@condamine.edu.ec`;
    };

    const isGroupClassroom = (c) => String(c?.type || '').toUpperCase() === 'GROUP';
    const isMainClassroom = (c) => {
        const t = String(c?.type || '').toUpperCase();
        return t === 'CLASS' || t === '';
    };
    const splitClassCode = (value = '') => {
        const code = String(value || '').trim().toUpperCase().split(/\s+/)[0] || '';
        const levelMatch = code.match(/^\d+/);
        const level = levelMatch ? levelMatch[0] : '';
        const letters = code.slice(level.length).replace(/[^A-Z]/g, '');
        return { level, letters, raw: code };
    };
    const isGroupCompatibleWithClass = (groupName, className) => {
        const cls = String(className || '').trim().toUpperCase();
        const grp = String(groupName || '').trim().toUpperCase();

        // Supporte "2D", "2 D", "2CD", etc.
        const classMatch = cls.match(/^(\d+)\s*([A-Z]+)/);
        const groupMatch = grp.match(/^(\d+)\s*([A-Z]+)/);
        if (!classMatch || !groupMatch) return false;

        // Règle demandée :
        // 1) premier caractère identique (niveau)
        // 2) la lettre de classe (2e caractère de code) est incluse dans les lettres du groupe
        const classFirstChar = classMatch[1].charAt(0);
        const groupFirstChar = groupMatch[1].charAt(0);
        if (classFirstChar !== groupFirstChar) return false;

        const classLetter = classMatch[2].charAt(0);
        const groupLetters = groupMatch[2];
        return groupLetters.includes(classLetter);
    };
    const resolveStudentClassName = (studentItem) => {
        const classRef = studentItem?.classId;
        if (classRef && typeof classRef === 'object') {
            if (classRef.name) return String(classRef.name);
            if (classRef._id) {
                const found = allClasses.find(cl => String(cl._id) === String(classRef._id));
                if (found?.name) return String(found.name);
            }
        }
        if (classRef) {
            const found = allClasses.find(cl => String(cl._id) === String(classRef));
            if (found?.name) return String(found.name);
        }
        if (studentItem?.currentClass) return String(studentItem.currentClass);
        return '';
    };

    // --- 📥 IMPORT CSV ---
    const triggerClassImport = (classId) => {
        setTargetImportClass(classId);
        setTimeout(() => { if (classCsvInputRef.current) classCsvInputRef.current.click(); }, 50);
    };

    const handleClassFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file || !targetImportClass) return;

        const classObj = allClasses.find(c => c._id === targetImportClass);
        const targetClassName = classObj ? classObj.name.toUpperCase().trim() : "SANS CLASSE";
        
        if (!file.name.toUpperCase().includes(targetClassName)) {
            alert(`⛔ FICHIER REJETÉ.\n\nLe fichier doit contenir "${targetClassName}" dans son nom.\nFichier actuel : ${file.name}`);
            e.target.value = ""; return;
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

                const headerLineRaw = lines[0];
                const countSemi = (headerLineRaw.match(/;/g) || []).length;
                const countComma = (headerLineRaw.match(/,/g) || []).length;
                const countTab = (headerLineRaw.match(/\t/g) || []).length;
                let separator = ';';
                if (countComma > countSemi && countComma >= countTab) separator = ',';
                if (countTab > countSemi && countTab > countComma) separator = '\t';
                setMagicLog(`⚙️ Séparateur : "${separator}"`);

                const headersRaw = headerLineRaw.split(separator).map(h => h.trim());
                const normalizeHeader = (h) =>
                    h
                        .toLowerCase()
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '')
                        .replace(/[^a-z0-9]/g, '');
                const headersNorm = headersRaw.map(normalizeHeader);
                
                const map = {
                    email: headersNorm.findIndex(h => h.includes('email') || h.includes('mail') || h.includes('courriel')),
                    fullname: headersNorm.findIndex(h => h.includes('eleve') || h.includes('nomcomplet') || h.includes('nomprenom')),
                    sex: headersNorm.findIndex(h => h.includes('sexe') || h.includes('genre')),
                    birthDate: headersNorm.findIndex(h => h.includes('neele') || h.includes('nele') || h.includes('naissance') || h.includes('datenaissance')),
                };

                const groupCols = [];
                if (headersRaw.length > 12) groupCols.push(12);
                if (headersRaw.length > 13) groupCols.push(13);
                if (headersRaw.length > 14) groupCols.push(14);
                if (headersRaw.length > 15 && headersNorm[15].includes('autre')) {
                    groupCols.push(15);
                    setMagicLog(`✅ Option P détectée.`);
                }

                if (map.email === -1) {
                    const headerPreview = headersRaw.slice(0, 25).join(' | ');
                    throw new Error(`Colonne "Email" introuvable.\nEn-têtes détectés : ${headerPreview}`);
                }

                setMagicLog(`\n🔎 ANALYSE DES GROUPES...`);
                const rowsToProcess = [];
                const neededGroups = new Set();
                const groupNameIdMap = {};
                allClasses.filter(c => c.type === 'GROUP').forEach(g => groupNameIdMap[g.name] = g._id);

                for (let i = 1; i < lines.length; i++) {
                    const cols = lines[i].split(separator).map(c => c.trim().replace(/"/g, ''));
                    const rowGroups = [];
                    groupCols.forEach(idx => {
                        const cellVal = cols[idx];
                        if (cellVal && cellVal.length > 1) {
                            cellVal.split(',').forEach(subVal => {
                                const cleanOpt = subVal.trim().toUpperCase();
                                if (cleanOpt) {
                                    const fullGroupName = `${targetClassName} ${cleanOpt}`;
                                    neededGroups.add(fullGroupName);
                                    rowGroups.push(fullGroupName);
                                }
                            });
                        }
                    });
                    rowsToProcess.push({ cols, rowGroups });
                }

                let createdGroups = 0;
                for (const gName of neededGroups) {
                    if (!groupNameIdMap[gName]) {
                        try {
                            const res = await fetch('/api/admin/classrooms', {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify({ name: gName, type: 'GROUP' })
                            });
                            const newG = await res.json();
                            if (newG._id) {
                                groupNameIdMap[gName] = newG._id;
                                createdGroups++;
                            }
                        } catch(e) {}
                    }
                }
                if (createdGroups > 0) setMagicLog(`✅ ${createdGroups} nouveaux groupes créés.`);

                setMagicLog(`\n🛡️ PRÉPARATION IMPORT ÉLÈVES...`);
                let successCount = 0;
                let errorCount = 0;
                let skippedMissingEmail = 0;
                let skippedInvalidEmail = 0;
                const dataRowCount = Math.max(lines.length - 1, 0);
                
                for (const row of rowsToProcess) {
                    const cols = row.cols;
                    const email = cols[map.email] ? cols[map.email].toLowerCase() : "";
                    if (!email) {
                        skippedMissingEmail++;
                        continue;
                    }
                    if (!email.includes('@')) {
                        skippedInvalidEmail++;
                        continue;
                    }

                    let lastName = "NOM";
                    let firstName = "Prénom";
                    try {
                        const local = email.split('@')[0];
                        const parts = local.split('.');
                        lastName = parts[0].toUpperCase();
                        firstName = parts.length > 1 ? (parts[1].charAt(0).toUpperCase() + parts[1].slice(1).toLowerCase()) : "";
                    } catch(e){}

                    const fullName = (map.fullname !== -1 && cols[map.fullname]) ? cols[map.fullname] : `${lastName} ${firstName}`;
                    
                    let gender = 'M';
                    if (map.sex !== -1 && cols[map.sex]) {
                        const s = cols[map.sex].toUpperCase();
                        if (s.startsWith('F') || s.startsWith('W')) gender = 'F';
                    }

                    let birthDate = (map.birthDate !== -1 && cols[map.birthDate]) ? cols[map.birthDate] : "";
                    let password = "123456";
                    
                    const dateMatch = birthDate.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
                    if (dateMatch) {
                        const day = dateMatch[1].padStart(2,'0');
                        const month = dateMatch[2].padStart(2,'0');
                        let year = dateMatch[3];
                        if (year.length === 2) year = "20" + year;
                        birthDate = `${day}/${month}/${year}`;
                        password = `${day}${month}${year}`;
                    }

                    const assignedGroups = row.rowGroups.map(n => groupNameIdMap[n]).filter(id => id);

                    try {
                        const payload = {
                            firstName, lastName, fullName, email, password,
                            classId: targetImportClass,
                            currentClass: targetClassName,
                            assignedGroups, gender, birthDate, test: 'N'
                        };
                        
                        const res = await fetch('/api/admin/students', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify(payload)
                        });
                        const d = await res.json();
                        if (d.error) errorCount++;
                        else successCount++;
                    } catch(e) { errorCount++; }
                }

                const skippedTotal = skippedMissingEmail + skippedInvalidEmail;
                const summary =
                    `\n🏁 TERMINÉ.\n` +
                    `Lignes lues : ${dataRowCount}\n` +
                    `Succès : ${successCount}\n` +
                    `Erreurs/Doublons : ${errorCount}\n` +
                    `Ignorées (email manquant/invalide) : ${skippedTotal}`;
                setMagicLog(summary);

                if (successCount === 0) {
                    const reasons = [
                        `• Nom de fichier : doit contenir "${targetClassName}"`,
                        `• Colonne "Email" absente ou mal nommée`,
                        `• Emails manquants ou invalides`,
                        `• Élèves déjà existants (doublons)`,
                    ].join('\n');
                    setMagicLog(
                        summary +
                        `\n\n⚠️ AUCUN ÉLÈVE IMPORTÉ.\n` +
                        `Causes fréquentes :\n${reasons}`
                    );
                }
                setTimeout(() => {
                    if (confirm(`Import terminé.\n${successCount} élèves ajoutés.\n${errorCount} ignorés (doublons).\n\nRecharger ?`)) {
                        setShowMagicModal(false); loadData();
                    }
                }, 1000);
            } catch (err) { setMagicLog(`❌ ERREUR FATALE : ${err.message}`); }
            setImporting(false);
            e.target.value = "";
        };
        reader.readAsText(file);
    };

    const triggerGroupImport = (groupId) => {
        setTargetImportGroup(groupId);
        setTimeout(() => { if (groupCsvInputRef.current) groupCsvInputRef.current.click(); }, 50);
    };

    const handleGroupFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file || !targetImportGroup) return;

        const groupObj = allClasses.find(c => c._id === targetImportGroup && c.type === 'GROUP');
        if (!groupObj) {
            alert("Groupe introuvable.");
            e.target.value = "";
            return;
        }

        setImporting(true);
        setShowMagicModal(true);
        setMagicLog(`📂 Import du groupe "${groupObj.name}"...\nVérification du fichier : ${file.name}`);

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const csvText = evt.target.result;
                const res = await fetch(`/api/admin/groups/${targetImportGroup}/import-csv`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fileName: file.name, csvText })
                });
                const result = await res.json();
                if (!res.ok) throw new Error(result.error || "Erreur serveur.");

                const notFoundLines = (result.notFound || [])
                    .map(x => `Ligne ${x.row}: ${x.email || 'EMAIL manquant'}`)
                    .join('\n');
                setMagicLog(
                    `✅ Import terminé (${result.groupName}).\n` +
                    `Lignes lues : ${result.importedRows}\n` +
                    `Élèves affectés : ${result.assignedCount}\n` +
                    `Introuvables : ${result.notFoundCount}` +
                    (notFoundLines ? `\n\nDétails (max 20):\n${notFoundLines}` : '')
                );

                setTimeout(() => {
                    alert(
                        `Import groupe terminé.\n` +
                        `Élèves affectés : ${result.assignedCount}\n` +
                        `Introuvables : ${result.notFoundCount}`
                    );
                    setShowMagicModal(false);
                    loadData();
                }, 700);
            } catch (err) {
                setMagicLog(`❌ Import impossible : ${err.message}`);
                setTimeout(() => alert(`❌ ${err.message}`), 100);
            } finally {
                setImporting(false);
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

    const getTeacherAssignments = (teacher) => {
        const assignedIds = Array.isArray(teacher?.assignedClasses) ? teacher.assignedClasses.map(String) : [];
        const classesFromIds = allClasses
            .filter(c => c.type === 'CLASS' && assignedIds.includes(String(c._id)))
            .map(c => c.name);
        const groupsFromIds = allClasses
            .filter(c => c.type === 'GROUP' && assignedIds.includes(String(c._id)))
            .map(c => c.name);

        const classSet = new Set(classesFromIds);
        const groupSet = new Set(groupsFromIds);
        const fallbackText = typeof teacher?.assignedClassesText === 'string' ? teacher.assignedClassesText : '';
        const fallbackNames = fallbackText.split(',').map(n => n.trim()).filter(Boolean);

        fallbackNames.forEach(name => {
            const exact = allClasses.find(c => c.name === name);
            if (exact) {
                if (exact.type === 'GROUP') groupSet.add(exact.name);
                else classSet.add(exact.name);
            }
        });

        return {
            classes: Array.from(classSet).sort((a, b) => a.localeCompare(b)),
            groups: Array.from(groupSet).sort((a, b) => a.localeCompare(b))
        };
    };

    return (
        <div className="admin-container animate-in fade-in">
            <input type="file" ref={classCsvInputRef} className="hidden" accept=".csv,.txt" onChange={handleClassFileSelect} />
            <input type="file" ref={groupCsvInputRef} className="hidden" accept=".csv,.txt" onChange={handleGroupFileSelect} />

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
                            {/* 1. Bouton ÉLÈVES (Classes/Groupes) */}
                            {(view === 'classes' || view === 'groups') && (
                                <button onClick={() => setViewingClass(it)} className="btn-action btn-list">👥 ÉLÈVES</button>
                            )}

                            {/* 2. Boutons IMPORTS/VIDER (Classes) */}
                            {view === 'classes' && (
                                <>
                                    <button onClick={() => triggerClassImport(it._id)} className="btn-import-mini">📥 IMPORT CSV</button>
                                    <button onClick={() => handlePurgeClass(it)} className="btn-action bg-red-50 text-red-600 border border-red-100 hover:bg-red-600 hover:text-white" title="Vider la classe">♻️ VIDER</button>
                                </>
                            )}
                            {view === 'groups' && (
                                <>
                                    <button onClick={() => triggerGroupImport(it._id)} className="btn-import-mini">📥 IMPORT CSV</button>
                                    <button onClick={() => handleClearGroupStudents(it)} className="btn-action bg-red-50 text-red-600 border border-red-100 hover:bg-red-600 hover:text-white" title="Retirer ce groupe de tous les élèves">♻️ VIDER</button>
                                </>
                            )}
                            
                            {/* 3. Bouton ZOOM (TOUT LE MONDE) */}
                            <button onClick={() => setZoomedItem(it)} className="btn-action bg-cyan-50 text-cyan-600 border border-cyan-100 hover:bg-cyan-500 hover:text-white">🔍</button>

                            {/* 4. Boutons EDIT/DELETE (TOUT LE MONDE) */}
                            <button onClick={() => handleOpenEdit(it)} className="btn-action btn-modif">ÉDITER</button>
                            <button onClick={() => handleDelete(it._id)} className="btn-action btn-delete">✕</button>
                        </div>
                    </div>
                ))}
            </div>

            {/* --- MODALE ZOOM (LOUPE) INTELLIGENTE --- */}
            {zoomedItem && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4" onClick={() => setZoomedItem(null)}>
                    <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="bg-indigo-600 p-6 text-white text-center">
                            {/* ICONE DYNAMIQUE */}
                            <div className="text-4xl mb-2">
                                {zoomedItem.gender === 'F' ? '👩' : 
                                 zoomedItem.gender === 'M' ? '👨' : 
                                 view === 'teachers' ? '🎓' :
                                 view === 'administrateurs' ? '🛡️' : '🏫'}
                            </div>
                            <h2 className="text-2xl font-black uppercase">{zoomedItem.name || `${zoomedItem.firstName} ${zoomedItem.lastName}`}</h2>
                            <div className="opacity-80 font-bold tracking-widest text-xs mt-1">{zoomedItem.email || zoomedItem.type || "DATA"}</div>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* CONTENU DYNAMIQUE SELON LE TYPE */}
                            {zoomedItem.currentClass && (
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-slate-400 font-bold text-xs uppercase">Classe</span>
                                    <span className="font-black text-slate-800">{zoomedItem.currentClass}</span>
                                </div>
                            )}
                            {(zoomedItem.assignedGroups || []).length > 0 && (
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-slate-400 font-bold text-xs uppercase">Groupes</span>
                                    <span className="font-black text-slate-800 text-right text-xs">
                                        {zoomedItem.assignedGroups.map(gId => allClasses.find(c => c._id === gId)?.name).filter(Boolean).join(', ')}
                                    </span>
                                </div>
                            )}
                            {view === 'students' && (
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-slate-400 font-bold text-xs uppercase">Test</span>
                                    <span className="font-black text-slate-800 text-right text-xs">{zoomedItem.test || 'N'}</span>
                                </div>
                            )}
                            {view === 'teachers' && (
                                <>
                                    {(() => {
                                        const { classes, groups } = getTeacherAssignments(zoomedItem);
                                        return (
                                            <>
                                    <div className="flex justify-between border-b pb-2">
                                        <span className="text-slate-400 font-bold text-xs uppercase">Email</span>
                                        <span className="font-black text-slate-800 text-right text-xs max-w-[220px] break-all">{zoomedItem.email || '-'}</span>
                                    </div>
                                    <div className="flex justify-between border-b pb-2">
                                        <span className="text-slate-400 font-bold text-xs uppercase">Nom</span>
                                        <span className="font-black text-slate-800 text-right text-xs">{zoomedItem.lastName || '-'}</span>
                                    </div>
                                    <div className="flex justify-between border-b pb-2">
                                        <span className="text-slate-400 font-bold text-xs uppercase">Prénom</span>
                                        <span className="font-black text-slate-800 text-right text-xs">{zoomedItem.firstName || '-'}</span>
                                    </div>
                                    <div className="flex justify-between border-b pb-2">
                                        <span className="text-slate-400 font-bold text-xs uppercase">Mot de passe</span>
                                        <span className="font-black text-slate-800 text-right text-xs">•••••• (vide = inchangé)</span>
                                    </div>
                                    <div className="flex justify-between border-b pb-2">
                                        <span className="text-slate-400 font-bold text-xs uppercase">Matières</span>
                                        <span className="font-black text-slate-800 text-right text-xs max-w-[220px]">
                                            {(Array.isArray(zoomedItem.taughtSubjects)
                                                ? zoomedItem.taughtSubjects.map(sId => allSubjects.find(s => s._id === sId)?.name).filter(Boolean).join(', ')
                                                : '') || zoomedItem.taughtSubjectsText || 'Aucune matière'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between border-b pb-2">
                                        <span className="text-slate-400 font-bold text-xs uppercase">Classes</span>
                                        <span className="font-black text-slate-800 text-right text-xs max-w-[220px]">
                                            {classes.length ? classes.join(', ') : 'Aucune classe'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between border-b pb-2">
                                        <span className="text-slate-400 font-bold text-xs uppercase">Groupes</span>
                                        <span className="font-black text-slate-800 text-right text-xs max-w-[220px]">
                                            {groups.length ? groups.join(', ') : 'Aucun groupe'}
                                        </span>
                                    </div>
                                            </>
                                        );
                                    })()}
                                </>
                            )}
                            {zoomedItem.taughtSubjectsText && view !== 'teachers' && (
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-slate-400 font-bold text-xs uppercase">Matières</span>
                                    <span className="font-black text-slate-800 text-right text-xs max-w-[200px]">{zoomedItem.taughtSubjectsText}</span>
                                </div>
                            )}
                            {zoomedItem.password && view === 'students' && (
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-slate-400 font-bold text-xs uppercase">Mot de passe</span>
                                    <span className="font-mono text-indigo-600 bg-indigo-50 px-2 rounded">{zoomedItem.password}</span>
                                </div>
                            )}
                            {view === 'administrateurs' && (
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-slate-400 font-bold text-xs uppercase">Rôle</span>
                                    <span className="font-black text-indigo-600">{zoomedItem.role}</span>
                                </div>
                            )}
                        </div>
                        <div className="p-4 bg-slate-50 text-center">
                            <button onClick={() => setZoomedItem(null)} className="btn-action w-full">FERMER</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODALE LISTE ÉLÈVES --- */}
            {viewingClass && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4" onClick={() => setViewingClass(null)}>
                    <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-black text-lg uppercase text-slate-700">LISTE {viewingClass.name}</h3>
                            <button onClick={() => setViewingClass(null)} className="text-slate-400 hover:text-red-500 font-black">✕</button>
                        </div>
                        <div className="p-4 h-96 overflow-y-auto bg-slate-50">
                             {allStudents.filter(s => {
                                 const targetId = String(viewingClass._id);
                                 return String(s.classId) === targetId || (s.assignedGroups || []).map(String).includes(targetId);
                             })
                             .sort((a,b) => a.lastName.localeCompare(b.lastName))
                             .map(s => (
                                 <div key={s._id} className="item-card !p-4 !mb-2 !shadow-sm hover:!bg-white flex justify-between items-center gap-3">
                                     <div className="item-main flex-1 min-w-0">
                                         <span className="item-title text-sm truncate">
                                             {s.gender === 'F' ? '👩' : '👨'} {s.lastName} {s.firstName}
                                         </span>
                                         <span className="item-sub text-xs truncate">{s.email}</span>
                                     </div>
                                     <button
                                         onClick={(e) => {
                                             e.stopPropagation();
                                             setViewingClass(null);
                                             setZoomedItem(s);
                                         }}
                                         className="btn-action !px-3 !py-2 bg-cyan-50 text-cyan-600 border border-cyan-100 hover:bg-cyan-500 hover:text-white shrink-0"
                                         title="Zoom élève"
                                     >🔍</button>
                                 </div>
                             ))}
                             {allStudents.filter(s => String(s.classId) === String(viewingClass._id) || (s.assignedGroups || []).map(String).includes(String(viewingClass._id))).length === 0 && (
                                 <div className="text-center text-slate-400 font-bold italic mt-10">Aucun élève.</div>
                             )}
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODALE CREATE/EDIT --- */}
            {modalMode && currentItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4" onClick={() => setModalMode(null)}>
                    <div className="bg-white w-full max-w-2xl rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-black uppercase mb-6 text-indigo-600">
                            {modalMode === 'create' ? 'Création' : 'Modification'} {view}
                        </h3>
                        <div className="space-y-4 mb-8">
                             {(view === 'students' || view === 'teachers' || view === 'administrateurs') && (
                                <div className="mb-6 p-4 rounded-xl border bg-indigo-50 border-indigo-100">
                                    <label className="form-label !mt-0 mb-2 !text-indigo-600">⚡ Email (Auto-remplissage)</label>
                                    <input 
                                        className="w-full p-3 border-2 rounded-lg font-bold outline-none border-indigo-200 bg-white text-indigo-900 placeholder-indigo-200 focus:border-indigo-500"
                                        placeholder={view === 'teachers' ? "nom.prenom@condamine.edu.ec" : "ex: nom.prenom@ecole.com"} 
                                        value={view === 'teachers' ? (buildTeacherEmail(currentItem.lastName, currentItem.firstName) || currentItem.email || '') : (currentItem.email || '')}
                                        readOnly={view === 'teachers'}
                                        onChange={e => {
                                            if (view === 'teachers') return;
                                            const val = e.target.value;
                                            const newState = { ...currentItem, email: val };
                                            const id = parseEmailToIdentity(val);
                                            if (id) { newState.lastName = id.lastName; newState.firstName = id.firstName; }
                                            setCurrentItem(newState);
                                        }}
                                    />
                                </div>
                             )}

                             {view === 'students' && (
                                <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <label className="form-label !mt-0 mb-2">Nom Complet</label>
                                    <input className="w-full p-3 border rounded-lg bg-white font-bold text-slate-700"
                                        placeholder="Généré..." 
                                        value={currentItem.fullName || `${currentItem.lastName || ''} ${currentItem.firstName || ''}`}
                                        onChange={e => setCurrentItem({ ...currentItem, fullName: e.target.value })}
                                    />
                                </div>
                             )}

                             <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col">
                                    <label className="form-label">Nom / Intitulé</label>
                                    <input className="w-full p-3 border rounded font-bold uppercase" value={currentItem.lastName || currentItem.name || ''} onChange={e => {
                                        const next = {...currentItem, lastName:e.target.value, name:e.target.value};
                                        if (view === 'teachers') next.email = buildTeacherEmail(e.target.value, currentItem.firstName);
                                        setCurrentItem(next);
                                    }} />
                                </div>
                                {(view === 'students' || view === 'teachers' || view === 'administrateurs') && (
                                    <div className="flex flex-col">
                                        <label className="form-label">Prénom</label>
                                        <input className="w-full p-3 border rounded font-bold" value={currentItem.firstName||''} onChange={e=>{
                                            const next = {...currentItem, firstName:e.target.value};
                                            if (view === 'teachers') next.email = buildTeacherEmail(currentItem.lastName, e.target.value);
                                            setCurrentItem(next);
                                        }} />
                                    </div>
                                )}
                             </div>
                             
                             {(view === 'administrateurs' || view === 'teachers') && (
                                <div className="flex flex-col">
                                    <label className="form-label">Mot de Passe {modalMode === 'edit' && '(Vide = Inchangé)'}</label>
                                    <input className="w-full p-3 border rounded font-bold" type="password" placeholder="******" value={currentItem.password || ''} onChange={e => setCurrentItem({...currentItem, password: e.target.value})} />
                                </div>
                             )}

                             {view === 'teachers' && (
                                <>
                                    <div>
                                        <label className="form-label">Classes</label>
                                        <div className="selection-grid">
                                            {allClasses.filter(isMainClassroom).map(cls => (
                                                <div key={cls._id} onClick={() => toggleRelation('assignedClasses', cls._id)} className={`toggle-chip ${currentItem.assignedClasses?.includes(cls._id) ? 'selected' : ''}`}>{cls.name}</div>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="form-label">Groupes</label>
                                        <div className="selection-grid">
                                            {allClasses.filter(isGroupClassroom).map(grp => (
                                                <div key={grp._id} onClick={() => toggleRelation('assignedClasses', grp._id)} className={`toggle-chip ${currentItem.assignedClasses?.includes(grp._id) ? 'selected' : ''}`}>{grp.name}</div>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="form-label">Matières</label>
                                        <div className="selection-grid">
                                            {allSubjects.map(sub => (
                                                <div key={sub._id} onClick={() => toggleRelation('taughtSubjects', sub._id)} className={`toggle-chip ${currentItem.taughtSubjects.includes(sub._id) ? 'selected' : ''}`}>{sub.name}</div>
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
                                            <select className="w-full p-3 border rounded bg-white" value={currentItem.gender || 'M'} onChange={e => setCurrentItem({...currentItem, gender:e.target.value})}>
                                                <option value="M">Homme</option>
                                                <option value="F">Femme</option>
                                            </select>
                                        </div>
                                    <div className="flex flex-col">
                                        <label className="form-label">Classe Principale</label>
                                        <select className="w-full p-3 border rounded bg-white font-bold" value={currentItem.classId || ''} onChange={e => setCurrentItem({...currentItem, classId:e.target.value})}>
                                            <option value="">-- AUCUNE --</option>
                                            {allClasses.filter(c => c.type === 'CLASS').map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex flex-col">
                                    <label className="form-label">Test (Y/N)</label>
                                    <select className="w-full p-3 border rounded bg-white font-bold" value={currentItem.test || 'N'} onChange={e => setCurrentItem({...currentItem, test: e.target.value})}>
                                        <option value="N">N</option>
                                        <option value="Y">Y</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-3">
                                    <input
                                        id="student-is-test-account"
                                        type="checkbox"
                                        checked={Boolean(currentItem.isTestAccount)}
                                        onChange={e => setCurrentItem({ ...currentItem, isTestAccount: e.target.checked })}
                                    />
                                    <label htmlFor="student-is-test-account" className="form-label !m-0">isTestAccount</label>
                                </div>
                                <div className="flex flex-col">
                                    <label className="form-label">Date de Naissance</label>
                                    <input className="w-full p-3 border rounded bg-white font-bold tracking-widest" placeholder="ex: 04/11/2005" value={currentItem.birthDate || ''} onChange={e => { const val = e.target.value; const rawDate = val.replace(/[^0-9]/g, ''); setCurrentItem({ ...currentItem, birthDate: val, password: rawDate }); }} />
                                </div>
                                    <div>
                                        <label className="form-label">Groupes (Options)</label>
                                        <div className="selection-grid">
                                            {allClasses.filter(c => {
                                                if (!isGroupClassroom(c)) return false;
                                                const selectedClassName = resolveStudentClassName(currentItem);
                                                if (!selectedClassName) return true;
                                                return isGroupCompatibleWithClass(c.name, selectedClassName);
                                            }).map(grp => (
                                                <div key={grp._id} onClick={() => toggleRelation('assignedGroups', grp._id)} className={`toggle-chip ${currentItem.assignedGroups?.includes(grp._id) ? 'selected' : ''}`}>{grp.name}</div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="mt-4"><label className="form-label">Mot de Passe</label><input className="w-full p-3 border rounded bg-slate-50 font-mono text-slate-400" value={currentItem.password||''} onChange={e=>setCurrentItem({...currentItem, password:e.target.value})} /></div>
                                </>
                             )}

                             {(view === 'classes' || view === 'groups') && (
                                 <div className="flex flex-col">
                                     <label className="form-label">Type</label>
                                     <div className="flex gap-4 mt-2">
                                         <button onClick={() => setCurrentItem({...currentItem, type: 'CLASS'})} className={`flex-1 p-3 rounded-xl border-2 font-black ${currentItem.type === 'CLASS' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-400'}`}>CLASSE (ex: 6A)</button>
                                         <button onClick={() => setCurrentItem({...currentItem, type: 'GROUP'})} className={`flex-1 p-3 rounded-xl border-2 font-black ${currentItem.type === 'GROUP' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-400'}`}>GROUPE</button>
                                     </div>
                                 </div>
                             )}
                        </div>
                        <div className="flex justify-end gap-3 pt-6 border-t">
                            <button onClick={() => setModalMode(null)} className="btn-action">Annuler</button>
                            <button onClick={handleSave} className="btn-action bg-indigo-600 text-white">Sauvegarder</button>
                        </div>
                    </div>
                </div>
            )}
            
            {showMagicModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4" onClick={() => setShowMagicModal(false)}>
                    <div className="bg-white w-full max-w-3xl rounded-3xl p-8 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-black uppercase mb-2 text-indigo-600">Logs Import CSV</h3>
                        <div className="w-full h-64 bg-slate-900 text-emerald-400 font-mono text-xs p-4 rounded-2xl overflow-y-auto border-2 border-slate-800">{magicLog.split('\n').map((l, i) => <div key={i}>{l}</div>)}</div>
                        <div className="flex justify-end gap-3 mt-4"><button onClick={() => setShowMagicModal(false)} className="px-5 py-3 rounded-xl font-bold text-xs uppercase text-slate-500 hover:bg-slate-100">Fermer</button></div>
                    </div>
                </div>
            )}
        </div>
    );
}
