const mongoose = require('mongoose');
const SubjectSchema = new mongoose.Schema({
    // 🛡️ CONTRAINTE UNIQUE : Impossible d'avoir deux matières avec le même nom
    name: { type: String, required: true, uppercase: true, unique: true },
    
    color: { type: String, default: '#6366f1' },
    icon: String
}, { collection: 'subjects' });
module.exports = mongoose.models.Subject || mongoose.model('Subject', SubjectSchema);