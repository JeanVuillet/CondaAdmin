const mongoose = require('mongoose');

const SectionSchema = new mongoose.Schema({
    name: { type: String, required: true },
    color: { type: String, default: '#6366f1' },
    scope: { type: String, enum: ['GLOBAL', 'LEVEL', 'CLASS'], default: 'GLOBAL' },
    target: { type: String, default: null },
    hiddenIn: { type: [String], default: [] }
}, { _id: false });

const TeacherSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    password: { type: String, required: true }, // ⚠️ PAS DE HOOK ICI. Géré par le contrôleur.
    subjectSections: { type: [SectionSchema], default: [] },
    
    taughtSubjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
    assignedClasses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' }],
    taughtSubjectsText: { type: String, default: "" },  
    assignedClassesText: { type: String, default: "" }, 

    isDeveloper: { type: Boolean, default: false },
    driveFolderId: { type: String },
    isTestAccount: { type: Boolean, default: false }
}, { collection: 'teachers' });

TeacherSchema.index({ firstName: 1, lastName: 1 }, { unique: true });

module.exports = mongoose.models.Teacher || mongoose.model('Teacher', TeacherSchema);