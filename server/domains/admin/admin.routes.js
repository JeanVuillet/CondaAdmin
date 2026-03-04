const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // ✅ IMPORT CRUCIAL
const AdminExpert = require('./experts/admin.expert'); 
const AdminAI = require('./ai/admin.ai'); 

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const slugEmailPart = (value = '') => String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
const buildTeacherEmail = (lastName, firstName) => {
    const nom = slugEmailPart(lastName);
    const prenom = slugEmailPart(firstName);
    if (!nom || !prenom) return '';
    return `${nom}.${prenom}@condamine.edu.ec`;
};
const normalizeToken = (value = '') => String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
const normalizeEmail = (value = '') => String(value).trim().toLowerCase();
const parseCsvLine = (line = '', separator = ';') => {
    const out = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }
        if (ch === separator && !inQuotes) {
            out.push(current.trim());
            current = '';
            continue;
        }
        current += ch;
    }
    out.push(current.trim());
    return out.map(c => c.replace(/^"(.*)"$/, '$1').trim());
};
const getHeaderIndex = (headers, tests) => headers.findIndex(h => tests.some(t => h.includes(t)));

// --- 🛠️ ROUTES DE GESTION GÉNÉRIQUES ---
router.get('/classrooms', asyncHandler(async (req, res) => res.json(await mongoose.model('Classroom').find({}).sort({ name: 1 }).lean())));
router.get('/subjects', asyncHandler(async (req, res) => res.json(await mongoose.model('Subject').find({}).sort({ name: 1 }).lean())));
router.get('/students', asyncHandler(async (req, res) => res.json(await mongoose.model('Student').find({}).sort({ lastName: 1 }).lean())));
router.get('/teachers', asyncHandler(async (req, res) => res.json(await mongoose.model('Teacher').find({}).sort({ lastName: 1 }).lean())));
router.get('/admins', asyncHandler(async (req, res) => res.json(await mongoose.model('Admin').find({}).sort({ lastName: 1 }).lean())));

// --- 🧠 ROUTE INTELLIGENCE ARTIFICIELLE ---
router.post('/import/magic', asyncHandler(async (req, res) => {
    const { text, contextClass } = req.body;
    if (!text) return res.status(400).json({ error: "Aucun texte fourni" });
    try {
        const result = await AdminAI.parseRawStudentData(text, contextClass || "SANS CLASSE");
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: "Erreur IA: " + e.message });
    }
}));

// --- 📥 IMPORT CSV CIBLÉ : AFFECTATION D'UN GROUPE AUX ÉLÈVES ---
router.post('/groups/:groupId/import-csv', asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const { fileName, csvText } = req.body || {};
    if (!fileName || !csvText) {
        return res.status(400).json({ error: "fileName et csvText sont requis." });
    }

    const Classroom = mongoose.model('Classroom');
    const Student = mongoose.model('Student');
    const group = await Classroom.findById(groupId).lean();
    if (!group || group.type !== 'GROUP') {
        return res.status(404).json({ error: "Groupe introuvable." });
    }

    const uploadedBaseName = String(fileName).replace(/\.[^.]+$/, '');
    if (normalizeToken(uploadedBaseName) !== normalizeToken(group.name)) {
        return res.status(400).json({
            error: `Le fichier CSV doit s'appeler "${group.name}.csv". Fichier reçu : "${fileName}".`
        });
    }

    const studentsInGroup = await Student.countDocuments({ assignedGroups: group._id });
    if (studentsInGroup > 0) {
        return res.status(400).json({
            error: `Import refusé : le groupe "${group.name}" contient déjà ${studentsInGroup} élève(s).`
        });
    }

    const lines = String(csvText).split(/\r?\n/).filter(l => l.trim() !== '');
    if (!lines.length) return res.status(400).json({ error: "Fichier CSV vide." });
    const countSemi = (lines[0].match(/;/g) || []).length;
    const countComma = (lines[0].match(/,/g) || []).length;
    const separator = countSemi >= countComma ? ';' : ',';

    const headers = parseCsvLine(lines[0], separator).map(h => normalizeToken(h));
    const emailIdx = getHeaderIndex(headers, ['email', 'e-mail', 'mail']);
    if (emailIdx === -1) {
        return res.status(400).json({
            error: "Colonne EMAIL introuvable dans le CSV."
        });
    }

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i], separator);
        const email = normalizeEmail(cols[emailIdx] || '');
        if (!email || !email.includes('@')) continue;
        rows.push({ email, row: i + 1 });
    }

    if (!rows.length) {
        return res.status(400).json({ error: "Aucune ligne avec EMAIL valide trouvée dans le CSV." });
    }

    const allStudents = await Student.find({}, { _id: 1, email: 1 }).lean();
    const studentMap = new Map();
    allStudents.forEach(s => {
        const key = normalizeEmail(s.email || '');
        if (key) studentMap.set(key, s._id);
    });

    const notFound = [];
    const idsToAssign = [];
    const seen = new Set();
    for (const row of rows) {
        const key = row.email;
        if (seen.has(key)) continue;
        seen.add(key);
        const studentId = studentMap.get(key);
        if (!studentId) {
            notFound.push({ row: row.row, email: row.email });
            continue;
        }
        idsToAssign.push(studentId);
    }

    if (idsToAssign.length) {
        await Student.updateMany(
            { _id: { $in: idsToAssign } },
            { $addToSet: { assignedGroups: group._id } }
        );
    }

    res.json({
        ok: true,
        groupName: group.name,
        importedRows: rows.length,
        assignedCount: idsToAssign.length,
        notFoundCount: notFound.length,
        notFound: notFound.slice(0, 20)
    });
}));

// --- ♻️ RETIRER UN GROUPE DE TOUS LES ÉLÈVES ---
router.post('/groups/:groupId/clear-students', asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const Classroom = mongoose.model('Classroom');
    const Student = mongoose.model('Student');

    const group = await Classroom.findById(groupId).lean();
    if (!group || group.type !== 'GROUP') {
        return res.status(404).json({ error: "Groupe introuvable." });
    }

    const result = await Student.updateMany(
        { assignedGroups: group._id },
        { $pull: { assignedGroups: group._id } }
    );

    res.json({
        ok: true,
        groupName: group.name,
        modifiedCount: result.modifiedCount || 0
    });
}));

// --- 📊 ROUTE DE DIAGNOSTIC ---
router.get('/database-dump', asyncHandler(async (req, res) => {
    try {
        const dump = await AdminExpert.getFullDump();
        res.json(dump);
    } catch (e) {
        res.status(500).json({ error: "Erreur lors du dump BDD" });
    }
}));

// --- ⚙️ ROUTE DE MAINTENANCE : PURGE MASSIVE ---
router.post('/maintenance/purge/:collection', asyncHandler(async (req, res) => {
    const { collection } = req.params;
    const { filterClassId, keepMeId } = req.body;
    
    const modelMap = {
        'classrooms': 'Classroom',
        'students': 'Student',
        'teachers': 'Teacher',
        'admins': 'Admin',
        'subjects': 'Subject'
    };

    const modelName = modelMap[collection];
    if (!modelName) return res.status(400).json({ error: "Collection inconnue" });

    const Model = mongoose.model(modelName);
    let query = {};

    if (collection === 'admins' && keepMeId) {
        query = { _id: { $ne: keepMeId } };
    }
    if (collection === 'students' && filterClassId && filterClassId !== 'TOUS') {
        query = { classId: filterClassId };
    }

    const result = await Model.deleteMany(query);
    res.json({ ok: true, deletedCount: result.deletedCount });
}));

// --- CRUD STANDARD AVEC HASHAGE MANUEL FORCÉ ---
router.post('/:collection', asyncHandler(async (req, res) => {
    const collection = req.params.collection;
    const modelMap = { 'classrooms': 'Classroom', 'teachers': 'Teacher', 'students': 'Student', 'subjects': 'Subject', 'admins': 'Admin' };
    
    if (!modelMap[collection]) return res.status(400).json({ error: "Collection invalide" });
    const Model = mongoose.model(modelMap[collection]);
    
    try {
        // Validation basique
        if (collection === 'students') {
            if (!req.body.firstName || !req.body.lastName) return res.status(400).json({ error: "Nom et Prénom requis." });
            req.body.firstName = req.body.firstName.trim();
            req.body.lastName = req.body.lastName.trim().toUpperCase();
        }
        if (collection === 'teachers') {
            if (!req.body.firstName || !req.body.lastName) return res.status(400).json({ error: "Nom et Prénom requis." });
            req.body.firstName = req.body.firstName.trim();
            req.body.lastName = req.body.lastName.trim().toUpperCase();
            req.body.email = buildTeacherEmail(req.body.lastName, req.body.firstName);
        }

        // 🔒 LOGIQUE DE HASHAGE MANUELLE (FORCE BRUTE)
        // On vérifie si c'est un Admin ou Prof ET si un mot de passe est envoyé
        if ((collection === 'admins' || collection === 'teachers') && req.body.password && req.body.password.trim() !== "") {
            
            // LOG DE DÉBUG (Regardez votre terminal serveur)
            console.log(`🔒 [SECURE] Hashage demandé pour ${collection}...`);
            console.log(`   Mot de passe reçu (taille): ${req.body.password.length}`);
            
            // On ne re-hash pas si ça ressemble déjà à un hash bcrypt (commence par $2a$)
            if (!req.body.password.startsWith('$2a$')) {
                const salt = await bcrypt.genSalt(10);
                const hash = await bcrypt.hash(req.body.password, salt);
                req.body.password = hash; // On remplace le texte clair par le hash
                console.log(`✅ [SECURE] Mot de passe crypté : ${hash.substring(0, 15)}...`);
            } else {
                console.log(`⚠️ [SECURE] Mot de passe déjà hashé, on ne touche pas.`);
            }
        }

        let result;
        if (req.body._id) {
            // MODE UPDATE
            // findByIdAndUpdate bypass les hooks, MAIS comme on a hashé manuellement ci-dessus, ça marchera !
            result = await Model.findByIdAndUpdate(req.body._id, req.body, { new: true });
        } else {
            // MODE CREATE
            result = await Model.create(req.body);
        }
        
        res.json(result);

    } catch (e) {
        console.error("❌ ERREUR SAVE:", e);
        if (e.code === 11000) {
            return res.status(400).json({ error: "Doublon détecté (Email ou Nom déjà pris)", code: 11000 });
        }
        throw e;
    }
}));

router.delete('/:collection/:id', asyncHandler(async (req, res) => {
    const modelMap = { 'classrooms': 'Classroom', 'teachers': 'Teacher', 'students': 'Student', 'subjects': 'Subject', 'admins': 'Admin' };
    await mongoose.model(modelMap[req.params.collection]).findByIdAndDelete(req.params.id);
    res.json({ ok: true });
}));

module.exports = router;
