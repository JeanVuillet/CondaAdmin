const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const MODELS_DIR = path.join(__dirname, 'server', 'models');
const OUTPUT_FILE = 'DB_MAP.md';

console.log("------------------------------------------------");
console.log("🗺️  CARTOGRAPHIE DE LA BASE DE DONNÉES (MONGOOSE)");
console.log("------------------------------------------------");

async function generateMap() {
    // 1. Chargement des modèles
    if (fs.existsSync(MODELS_DIR)) {
        fs.readdirSync(MODELS_DIR).forEach(file => {
            if (file.endsWith('.js')) {
                try {
                    require(path.join(MODELS_DIR, file));
                    console.log(`   📄 Modèle chargé : ${file}`);
                } catch (e) {
                    console.error(`   ❌ Erreur chargement ${file}:`, e.message);
                }
            }
        });
    } else {
        console.error("❌ Dossier server/models introuvable !");
        return;
    }

    // 2. Analyse de la structure
    const modelNames = mongoose.modelNames().sort();
    let markdown = `# 🗺️ STRUCTURE DE LA BASE DE DONNÉES\n`;
    markdown += `Généré le : ${new Date().toLocaleString()}\n\n`;

    console.log(`\n🔍 Analyse de ${modelNames.length} collections...\n`);

    modelNames.forEach(modelName => {
        const Model = mongoose.model(modelName);
        const collectionName = Model.collection.name;
        const schema = Model.schema;

        markdown += `## 📦 Collection : \`${collectionName}\` (Model: ${modelName})\n`;
        markdown += `| Champ | Type | Options |\n`;
        markdown += `| :--- | :--- | :--- |\n`;

        // Parcours des chemins du schéma
        Object.keys(schema.paths).sort().forEach(path => {
            if (path === '__v') return; // On ignore la version key interne

            const pathType = schema.paths[path];
            let type = pathType.instance;
            let options = [];

            // Détection des références (Foreign Keys)
            if (type === 'ObjectID' && pathType.options.ref) {
                type = `🔗 Ref(${pathType.options.ref})`;
            }
            
            // Détection des Array
            if (type === 'Array') {
                if (pathType.caster && pathType.caster.instance) {
                    type = `[${pathType.caster.instance}]`;
                    if (pathType.caster.options.ref) {
                         type = `[🔗 Ref(${pathType.caster.options.ref})]`;
                    }
                } else {
                    type = `[Mixed/Object]`;
                }
            }

            // Options intéressantes
            if (pathType.options.required) options.push("✅ REQ");
            if (pathType.options.unique) options.push("🔑 UNIQUE");
            if (pathType.options.default !== undefined) {
                let def = pathType.options.default;
                if (typeof def === 'function') def = "(func)";
                options.push(`Def: ${def}`);
            }
            if (pathType.options.enum) options.push(`Enum: [${pathType.options.enum.join(', ')}]`);

            markdown += `| **${path}** | \`${type}\` | ${options.join(', ') || '-'} |\n`;
        });
        
        markdown += `\n---\n\n`;
    });

    // 3. Écriture du fichier
    try {
        fs.writeFileSync(OUTPUT_FILE, markdown);
        console.log(`✅ SUCCÈS : Fichier généré -> ${OUTPUT_FILE}`);
        console.log(`   Vous pouvez ouvrir ce fichier pour voir toute la structure.`);
    } catch (e) {
        console.error("❌ Erreur écriture fichier:", e.message);
    }

    // On quitte proprement (pas besoin de connexion DB réelle pour lire les schémas)
    process.exit(0);
}

generateMap();