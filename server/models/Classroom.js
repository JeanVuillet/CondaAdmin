const mongoose = require('mongoose');

// Sous-schéma pour le layout (plus sûr qu'un objet imbriqué direct)
const LayoutSchema = new mongoose.Schema({
    separators: { type: [Number], default: [] }
}, { _id: false });

const ClassroomSchema = new mongoose.Schema({
    // 🛡️ CONTRAINTE UNIQUE : Impossible d'avoir deux classes/groupes avec le même nom
    name: { type: String, required: true, uppercase: true, unique: true },
    
    level: { type: String }, 
    
    type: { type: String, enum: ['CLASS', 'GROUP'], default: 'CLASS' },
    associatedClasses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' }],
    yearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear' },

    // Configuration visuelle
    layout: { type: LayoutSchema, default: () => ({ separators: [] }) }
}, { collection: 'classrooms' });

module.exports = mongoose.models.Classroom || mongoose.model('Classroom', ClassroomSchema);