const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // ✅ IMPORT CRUCIAL
const AdminExpert = require('./experts/admin.expert'); 
const AdminAI = require('./ai/admin.ai'); 

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

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