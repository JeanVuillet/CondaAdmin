const mongoose = require('mongoose');
const DriveEngine = require('../../../core/drive.engine');

/**
 * 🧠 EXPERT ADMIN - VERSION 83 (DYNAMIC DUMP)
 * Fonctions de maintenance et diagnostic système.
 * MODIFICATION : Scan dynamique de toutes les collections.
 */
const AdminExpert = {
    // Vérification de la connexion Google Drive
    checkDriveStatus: async () => {
        try {
            return await DriveEngine.testAuth();
        } catch (e) {
            return { ok: false, error: e.message };
        }
    },

    // Dump complet de la BDD pour le visualiseur
    // Utilise mongoose.modelNames() pour ne rien oublier (AccessLog, Bugs, etc.)
    getFullDump: async () => {
        const dump = {};
        const modelNames = mongoose.modelNames(); // Récupère tous les modèles enregistrés
        
        console.log(`📊 [DB DUMP] Extraction de ${modelNames.length} tables : ${modelNames.join(', ')}`);

        for (const name of modelNames) {
            try {
                const Model = mongoose.model(name);
                const collectionName = Model.collection.name; // Nom réel de la collection (ex: 'students')
                
                // On limite à 500 entrées par table pour ne pas saturer le navigateur
                // Tri par _id décroissant pour voir les événements récents en premier
                dump[collectionName] = await Model.find({}).limit(500).sort({ _id: -1 }).lean();
            } catch (e) { 
                console.error(`❌ Dump fail for ${name}:`, e.message);
                dump[`ERROR_${name}`] = [{ error: "Lecture impossible", details: e.message }];
            }
        }
        
        return dump;
    }
};

module.exports = AdminExpert;