const mongoose = require('mongoose');
require('dotenv').config();

console.log("------------------------------------------------");
console.log("🕵️‍♂️ SCANNER PROFOND MONGODB (Lecture Directe)");
console.log("------------------------------------------------");

async function scanDB() {
    if (!process.env.MONGODB_URI) {
        console.error("❌ Erreur : MONGODB_URI manquant dans le fichier .env");
        process.exit(1);
    }

    try {
        // 1. Connexion
        console.log("🔌 Connexion à la base de données...");
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ Connecté.");

        const db = mongoose.connection.db;

        // 2. Récupération de la liste brute des collections
        const collections = await db.listCollections().toArray();
        const sortedCollections = collections.map(c => c.name).sort();

        console.log(`\n📦 ${sortedCollections.length} COLLECTIONS TROUVÉES :\n`);

        for (const name of sortedCollections) {
            // Ignorer les collections systèmes internes
            if (name.startsWith('system.')) continue;

            // Compter les documents
            const count = await db.collection(name).countDocuments();
            
            // Récupérer un document pour deviner la structure
            const sample = await db.collection(name).findOne({});
            
            console.log(`📂 COLLECTION : [ ${name.toUpperCase()} ] (${count} documents)`);
            
            if (sample) {
                const keys = Object.keys(sample).filter(k => k !== '__v' && k !== '_id');
                console.log(`   🔑 Champs détectés : ${keys.join(', ')}`);
                
                // Détection de champs spéciaux souvent invisibles
                if (sample.createdAt) console.log(`   🕒 TimeStamp: Oui`);
                if (sample.fileId || sample.gridFsId) console.log(`   💾 Fichiers liés: Oui`);
            } else {
                console.log(`   ⚠️ Collection vide (Structure inconnue)`);
            }
            console.log("   " + "-".repeat(40));
        }

        console.log("\n✨ Scan terminé.");
        process.exit(0);

    } catch (e) {
        console.error("❌ ERREUR FATALE :", e);
        process.exit(1);
    }
}

scanDB();