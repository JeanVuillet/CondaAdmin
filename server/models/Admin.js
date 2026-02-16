const mongoose = require('mongoose');

const SectionSchema = new mongoose.Schema({
    name: { type: String, required: true },
    color: { type: String, default: '#6366f1' },
    scope: { type: String, enum: ['GLOBAL', 'LEVEL', 'CLASS'], default: 'GLOBAL' },
    target: { type: String, default: null }
}, { _id: false });

const AdminSchema = new mongoose.Schema({
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true, uppercase: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true }, // ⚠️ PAS DE HOOK ICI. Géré par le contrôleur.
    role: { type: String, enum: ['admin', 'developer'], default: 'admin' },
    subjectSections: { type: [SectionSchema], default: [] },
    isDeveloper: { type: Boolean, default: false },
    isTestAccount: { type: Boolean, default: false }
}, { collection: 'admins' });

AdminSchema.index({ firstName: 1, lastName: 1 }, { unique: true });
AdminSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.models.Admin || mongoose.model('Admin', AdminSchema);