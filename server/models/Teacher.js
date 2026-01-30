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
    password: { type: String, required: true },
    subjectSections: { type: [SectionSchema], default: [] },
    
    // Références (IDs)
    taughtSubjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
    assignedClasses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' }],

    // ✅ NOUVELLES COLONNES : Texte en toutes lettres (Dénormalisation)
    taughtSubjectsText: { type: String, default: "" },  // ex: "MATHS, PHYSIQUE"
    assignedClassesText: { type: String, default: "" }, // ex: "6A, 5B, 6A ANGLAIS"

    isDeveloper: { type: Boolean, default: false },
    driveFolderId: { type: String },
    isTestAccount: { type: Boolean, default: false }
}, { collection: 'teachers' });

module.exports = mongoose.models.Teacher || mongoose.model('Teacher', TeacherSchema);