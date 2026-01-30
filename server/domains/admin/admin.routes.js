// @signatures: AdminRoutes, database-dump, drive-check
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const AdminAI = require('./ai/admin.ai');
const AdminExpert = require('./experts/admin.expert');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const normalizeClassName = (name) => {
    if (!name) return "UNKNOWN";
    let s = name.toUpperCase().trim();
    s = s.replace(/^(TERMINALE|TERM)\s*/, 'T');
    s = s.replace(/(\d+)\s*(?:E|EME|ÈME|ÉME|ERE|ÈRE|IER|IÈRE|NDE|ND)\s*([A-Z]?)/g, '$1$2');
    s = s.replace(/[\s\-\._]/g, '');
    return s;
};

const guessLevel = (name) => {
    const n = name.toUpperCase();
    if (n.startsWith('T') || n.startsWith('TERM')) return 'TERM';
    const match = n.match(/^(\d+|CP|CE1|CE2|CM1|CM2)/);
    return match ? match[0] : "AUTRE";
};

// --- 🛠️ ROUTES DE DIAGNOSTIC (RESTAURÉES) ---

router.get('/drive-check', asyncHandler(async (req, res) => {
    const DriveEngine = require('../../core/drive.engine');
    res.json(await DriveEngine.testAuth());
}));

router.get('/database-dump', asyncHandler(async (req, res) => {
    // Cette méthode utilise AdminExpert pour scanner toutes les collections
    res.json(await AdminExpert.getFullDump());
}));

// --- ROUTES DE GESTION ---

router.get('/classrooms', asyncHandler(async (req, res) => {
    res.json(await mongoose.model('Classroom').find({}).sort({ name: 1 }).lean());
}));

router.post('/classrooms', asyncHandler(async (req, res) => {
    const name = normalizeClassName(req.body.name);
    const level = req.body.level || guessLevel(name);
    const cls = await mongoose.model('Classroom').findOneAndUpdate(
        { name, type: req.body.type || 'CLASS' },
        { ...req.body, name, level },
        { upsert: true, new: true }
    );
    res.json(cls);
}));

router.post('/import-magic', asyncHandler(async (req, res) => {
    const { rawText, defaultClass, forceOption } = req.body;
    const Classroom = mongoose.model('Classroom');
    const Student = mongoose.model('Student');
    const Enrollment = mongoose.model('Enrollment');
    const AcademicYear = mongoose.model('AcademicYear');

    try {
        const studentsData = await AdminAI.parseRawStudentData(rawText, defaultClass || "UNKNOWN");
        let createdCount = 0;
        let year = await AcademicYear.findOne({ isCurrent: true }) || await AcademicYear.create({ label: "2025-2026", isCurrent: true });

        for (const s of studentsData) {
            let className = normalizeClassName(s.className || defaultClass);
            let level = guessLevel(className);
            let mainClass = await Classroom.findOneAndUpdate({ name: className, type: 'CLASS' }, { name: className, type: 'CLASS', level }, { upsert: true, new: true });
            
            const assignedGroupIds = [];
            const rawOptions = Array.isArray(s.options) ? s.options : [];
            if (forceOption) rawOptions.push(forceOption);

            for (const optName of rawOptions) {
                const groupName = `${className} ${optName.toUpperCase().trim()}`;
                const group = await Classroom.findOneAndUpdate({ name: groupName, type: 'GROUP' }, { name: groupName, type: 'GROUP', level, associatedClasses: [mainClass._id] }, { upsert: true, new: true });
                assignedGroupIds.push(group._id);
            }

            const student = await Student.findOneAndUpdate(
                { firstName: s.firstName, lastName: s.lastName },
                { ...s, fullName: `${s.firstName} ${s.lastName}`, currentClass: className, classId: mainClass._id, assignedGroups: assignedGroupIds },
                { upsert: true, new: true }
            );

            await Enrollment.findOneAndUpdate({ studentId: student._id, yearId: year._id }, { classId: mainClass._id }, { upsert: true });
            createdCount++;
        }
        res.json({ ok: true, message: `${createdCount} élèves importés.` });
    } catch (e) { res.status(500).json({ error: e.message }); }
}));

router.post('/membership', asyncHandler(async (req, res) => {
    const { studentId, targetId, type, action } = req.body;
    const Student = mongoose.model('Student');
    if (action === 'add') {
        if (type === 'CLASS') {
            const cls = await mongoose.model('Classroom').findById(targetId);
            await Student.findByIdAndUpdate(studentId, { classId: targetId, currentClass: cls.name });
        } else {
            await Student.findByIdAndUpdate(studentId, { $addToSet: { assignedGroups: targetId } });
        }
    } else {
        if (type === 'CLASS') await Student.findByIdAndUpdate(studentId, { classId: null });
        else await Student.findByIdAndUpdate(studentId, { $pull: { assignedGroups: targetId } });
    }
    res.json({ ok: true });
}));

router.get('/:collection', asyncHandler(async (req, res) => {
    const map = { 'teachers': 'Teacher', 'students': 'Student', 'subjects': 'Subject', 'staff': 'Admin' };
    const model = map[req.params.collection];
    if (!model) return res.status(404).send();
    res.json(await mongoose.model(model).find({}).sort({ lastName: 1, name: 1 }).lean());
}));

router.post('/:collection', asyncHandler(async (req, res) => {
    const map = { 'teachers': 'Teacher', 'students': 'Student', 'subjects': 'Subject', 'staff': 'Admin' };
    const Model = mongoose.model(map[req.params.collection]);
    const result = req.body._id ? await Model.findByIdAndUpdate(req.body._id, req.body, { new: true }) : await Model.create(req.body);
    res.json(result);
}));

router.delete('/:collection/:id', asyncHandler(async (req, res) => {
    const map = { 'classrooms': 'Classroom', 'teachers': 'Teacher', 'students': 'Student', 'subjects': 'Subject', 'staff': 'Admin' };
    await mongoose.model(map[req.params.collection]).findByIdAndDelete(req.params.id);
    res.json({ ok: true });
}));

module.exports = router;