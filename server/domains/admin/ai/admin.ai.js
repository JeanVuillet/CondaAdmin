const AIEngine = require('../../../core/ai.engine');

const AdminAI = {
    parseRawStudentData: async (rawText, contextClass) => {
        console.log("🧠 [AI] Analyse Magic Import V300 (Stratégie Séparateur ||||)...");
        
        // On sécurise la taille de l'entrée
        const cleanedText = rawText ? rawText.substring(0, 30000) : "";

        const system = `Tu es un extracteur de données robuste.
        
        MISSION :
        Convertis le texte (CSV, Excel, Liste) en objets JSON individuels.
        
        RÈGLES STRICTES :
        1. SÉPARATEUR : Sépare chaque objet JSON par exactement cette chaîne : "||||"
        2. FORMAT : Ne renvoie PAS un tableau [ ]. Renvoie juste : {objet}||||{objet}||||{objet}
        3. CONTENU : Chaque objet doit avoir : "firstName", "lastName", "email", "className", "options" (Array de strings), "password".
        
        RÈGLES MÉTIER :
        - Email : Si absent, ne rien mettre (le serveur le générera).
        - Nom/Prénom via Email : Si l'email est "dupont.jean@...", alors lastName="DUPONT", firstName="Jean".
        - Password : Si date de naissance (JJ/MM/AAAA) trouvée -> "JJMMAAAA". Sinon "123456".
        - ClassName : Si introuvable dans la ligne, utiliser "${contextClass}".
        
        EXEMPLE DE SORTIE :
        {"lastName":"DUPONT", "firstName":"Jean", "password":"12052010", "className":"6A", "options":[]}||||{"lastName":"DURAND", ...}
        
        RIEN D'AUTRE. PAS DE MARKDOWN. PAS DE TEXTE D'INTRO.`;

        const prompt = `TEXTE BRUT À TRAITER :\n\n${cleanedText}`;

        try {
            let rawResponse = await AIEngine.ask(prompt, system);
            
            // 1. Nettoyage préliminaire
            let clean = rawResponse
                .replace(/```json/g, "")
                .replace(/```/g, "")
                .trim();

            // 2. Découpage par le séparateur magique
            const parts = clean.split('||||');
            
            const validStudents = [];
            let failures = 0;

            for (const part of parts) {
                if (!part.trim()) continue; // Ignore les vides
                
                try {
                    // On nettoie les éventuels sauts de ligne parasites
                    const jsonStr = part.trim();
                    const student = JSON.parse(jsonStr);

                    // Validation minimale
                    if (student.lastName || student.firstName) {
                        // Patch de sécurité : s'assurer que options est un tableau
                        if (!Array.isArray(student.options)) student.options = [];
                        
                        validStudents.push(student);
                    }
                } catch (e) {
                    failures++;
                    console.warn("⚠️ [AI] Echec parsing partiel sur un élément :", part.substring(0, 50) + "...");
                }
            }

            console.log(`🧠 [AI] Succès : ${validStudents.length} élèves extraits (${failures} échecs ignorés).`);
            
            // Si l'IA a quand même renvoyé un tableau JSON standard malgré la consigne (ça arrive), on tente le coup
            if (validStudents.length === 0 && (clean.startsWith('[') || clean.indexOf('[') < 10)) {
                try {
                    const start = clean.indexOf('[');
                    const end = clean.lastIndexOf(']');
                    if (start !== -1 && end !== -1) {
                        const directJson = JSON.parse(clean.substring(start, end + 1));
                        if (Array.isArray(directJson)) return directJson;
                    }
                } catch(e) {}
            }

            return validStudents;

        } catch (e) {
            console.error("❌ AI Parsing Global Crash:", e.message);
            return [];
        }
    }
};

module.exports = AdminAI;