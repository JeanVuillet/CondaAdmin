const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// --- 🛠️ ROUTES DE GESTION GÉNÉRIQUES ---

router.get('/classrooms', asyncHandler(async (req, res) => res.json(await mongoose.model('Classroom').find({}).sort({ name: 1 }).lean())));
router.get('/subjects', asyncHandler(async (req, res) => res.json(await mongoose.model('Subject').find({}).sort({ name: 1 }).lean())));
router.get('/students', asyncHandler(async (req, res) => res.json(await mongoose.model('Student').find({}).sort({ lastName: 1 }).lean())));
router.get('/teachers', asyncHandler(async (req, res) => res.json(await mongoose.model('Teacher').find({}).sort({ lastName: 1 }).lean())));
router.get('/admins', asyncHandler(async (req, res) => res.json(await mongoose.model('Admin').find({}).sort({ lastName: 1 }).lean())));

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

    // Sécurité : Si on purge les Admins, on garde l'utilisateur courant
    if (collection === 'admins' && keepMeId) {
        query = { _id: { $ne: keepMeId } };
    }

    // Filtre : Si on purge les étudiants d'une classe précise
    if (collection === 'students' && filterClassId) {
        query = { classId: filterClassId };
    }

    const result = await Model.deleteMany(query);
    res.json({ ok: true, deletedCount: result.deletedCount });
}));

// --- CRUD STANDARD ---
router.post('/:collection', asyncHandler(async (req, res) => {
    const modelMap = { 'classrooms': 'Classroom', 'teachers': 'Teacher', 'students': 'Student', 'subjects': 'Subject', 'admins': 'Admin' };
    const Model = mongoose.model(modelMap[req.params.collection]);
    const result = req.body._id ? await Model.findByIdAndUpdate(req.body._id, req.body, { new: true }) : await Model.create(req.body);
    res.json(result);
}));

router.delete('/:collection/:id', asyncHandler(async (req, res) => {
    const modelMap = { 'classrooms': 'Classroom', 'teachers': 'Teacher', 'students': 'Student', 'subjects': 'Subject', 'admins': 'Admin' };
    await mongoose.model(modelMap[req.params.collection]).findByIdAndDelete(req.params.id);
    res.json({ ok: true });
}));

module.exports = router;