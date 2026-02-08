const fs = require('fs');
const path = require('path');
const inputFile = 'update.txt';
const statusFile = 'apply_status.json';

console.log("------------------------------------------------");
console.log("🤖 [CONSTITUTION] apply.js v33 (STABLE) actif.");
console.log("🚀 Protection Write-Crash activée.");
console.log("------------------------------------------------");

function setStatus(status, file = null) {
    try { 
        fs.writeFileSync(statusFile, JSON.stringify({ status, file, timestamp: Date.now() }, null, 2)); 
    } catch (e) {
        console.error("⚠️ Erreur écriture status:", e.message);
    }
}

function applyUpdate() {
    if (!fs.existsSync(inputFile)) return;
    
    let rawContent = "";
    try { 
        rawContent = fs.readFileSync(inputFile, 'utf8'); 
    } catch (e) { 
        console.error("⚠️ Lecture impossible update.txt (occupé?)");
        return; 
    }

    if (rawContent.trim().length < 10) return;

    let processed = false;
    const startRegex = /\[\[\[£\s*FILE\s*:\s*([^£\]\s]+)\s*£\]\]\]/g;
    let startMatch;

    // Protection contre les boucles infinies de lecture
    let filesProcessed = 0;

    while ((startMatch = startRegex.exec(rawContent)) !== null) {
        try {
            const filePath = startMatch[1].trim();
            const contentStartIndex = startMatch.index + startMatch[0].length;
            const endTag = `[[[£ END: ${filePath} £]]]`;
            const endIdx = rawContent.indexOf(endTag);

            if (endIdx !== -1) {
                const fileContent = rawContent.substring(contentStartIndex, endIdx).trim();
                const fullPath = path.join(__dirname, filePath);
                
                // Création récursive des dossiers
                if (!fs.existsSync(path.dirname(fullPath))) {
                    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
                }

                fs.writeFileSync(fullPath, fileContent);
                console.log(`   ✅ ÉCRIT : ${filePath}`);
                processed = true;
                filesProcessed++;
            }
        } catch (err) {
            console.error(`   ❌ ERREUR CRITIQUE SUR FICHIER : ${err.message}`);
        }
    }

    if (processed) {
        try {
            fs.writeFileSync(inputFile, ''); // Vidage atomique
            setStatus('OK');
            console.log(`✨ SYNC TERMINÉE (${filesProcessed} fichiers).`);
        } catch (e) {
            console.error("❌ Impossible de vider update.txt");
        }
    }
}

// Initialisation propre
setStatus('OK');
// Intervalle augmenté légèrement pour stabilité FS
setInterval(applyUpdate, 1500);