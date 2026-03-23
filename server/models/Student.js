const mongoose = require('mongoose');

// Schéma pour les croix/bonus (Gamification)
const BehaviorRecordSchema = new mongoose.Schema({
    teacherId: { type: String, required: true },
    subjectId: { type: String },
    crosses: { type: Number, default: 0 },
    bonuses: { type: Number, default: 0 },
    lastCrossDate: { type: Date, default: null },
    weeksToRedemption: { type: Number, default: 3 }
}, { _id: false });

// Schéma pour les notes prof
const NoteSchema = new mongoose.Schema({
    teacherId: { type: String, required: true },
    text: { type: String, default: "" },
    isPositive: { type: Boolean, default: false }
}, { _id: false });

const StudentSchema = new mongoose.Schema({
    // Identité (Règles strictes : Prénom + Nom Unique)
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, uppercase: true, trim: true },
    fullName: { type: String, trim: true }, // ✅ STOCKAGE DU NOM COMPLET
    
    // Attributs
    gender: { type: String, enum: ['M', 'F'], default: 'M' },
    birthDate: { type: String, default: "" }, // Format texte DD/MM/YYYY
    password: { type: String, default: "123456" },
    
    // Contacts
    email: { type: String, lowercase: true, trim: true },
    parentEmail: { type: String, lowercase: true, trim: true },

    // Scolarité
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' },
    currentClass: { type: String }, // Nom de la classe pour affichage rapide
    currentLevel: { type: String },
    assignedGroups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' }],

    // Plan de classe
    seatX: { type: Number, default: 0 }, 
    seatY: { type: Number, default: 0 }, 
    
    // Vie scolaire
    behaviorRecords: { type: [BehaviorRecordSchema], default: [] },
    teacherNotes: { type: [NoteSchema], default: [] },

    // Système Automatique
    punishmentStatus: { type: String, enum: ['NONE', 'PENDING', 'LATE', 'DONE'], default: 'NONE' },
    punishmentDueDate: { type: Date }, 
    activePunishmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Homework' },
    hasReward: { type: Boolean, default: false },

    // Système
    test: { type: String, enum: ['Y', 'N'], default: 'N' },
    isTestAccount: { type: Boolean, default: false },
    lastLogin: { type: Date, default: Date.now }
}, { collection: 'students' });

// 🛡️ CONTRAINTE D'UNICITÉ : Le couple Prénom + Nom doit être unique
// L'email doit aussi être unique s'il est renseigné
StudentSchema.index({ firstName: 1, lastName: 1 }, { unique: true });
StudentSchema.index({ email: 1 }, { unique: true, sparse: true });

// --- MÉTHODES MÉTIER ---
StudentSchema.methods.addCross = async function(teacherId) {
    let record = this.behaviorRecords.find(r => r.teacherId === teacherId);
    if (!record) { record = { teacherId, crosses: 0, bonuses: 0 }; this.behaviorRecords.push(record); }
    record.crosses += 1;
    record.lastCrossDate = new Date();
    if (record.crosses >= 3) {
        this.punishmentStatus = 'PENDING';
        this.punishmentDueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
    return this.save();
};

StudentSchema.methods.addBonus = async function(teacherId) {
    let record = this.behaviorRecords.find(r => r.teacherId === teacherId);
    if (!record) { record = { teacherId, crosses: 0, bonuses: 0 }; this.behaviorRecords.push(record); }
    record.bonuses += 1;
    if (record.bonuses >= 4) this.hasReward = true;
    return this.save();
};

module.exports = mongoose.models.Student || mongoose.model('Student', StudentSchema);
