const AIEngine = require('../../../core/ai.engine');

const AdminAI = {
    parseRawStudentData: async (rawText, contextClass) => {
        console.log("🧠 [AI] Analyse Magic Import V303 (FullName Support)...");
        
        // On sécurise la taille de l'entrée
        const cleanedText = rawText ? rawText.substring(0, 30000) : "";

        const system = `Tu es un expert en gestion de base de données scolaires.
        
        MISSION :
        Convertis le texte (CSV, Excel, Liste) en objets JSON.
        
        RÈGLES D'OR SUR L'IDENTITÉ :
        1. Si un EMAIL est présent, déduis Nom/Prénom de l'email.
        2. Si une colonne "Nom Complet" ou "Fullname" est détectée, utilise-la pour remplir "fullName", "firstName" et "lastName".
        
        RÈGLES DE SORTIE :
        1. SÉPARATEUR : Sépare chaque objet JSON par "||||"
        2. FORMAT : {objet}||||{objet}
        3. CHAMPS : "firstName", "lastName", "fullName", "email", "className", "options" (Array de strings), "password".
        
        INTELLIGENCE :
        - "className" est la classe principale. Si introuvable, utilise "${contextClass}".
        - "options" : Tout ce qui ressemble à un groupe, une langue ou une option.
        `;

        const prompt = `TEXTE BRUT À TRAITER :\n\n${cleanedText}`;

        try {
            let rawResponse = await AIEngine.ask(prompt, system);
            
            // 1. Nettoyage
            let clean = rawResponse
                .replace(/```json/g, "")
                .replace(/```/g, "")
                .trim();

            // 2. Découpage
            const parts = clean.split('||||');
            
            const validStudents = [];
            
            for (const part of parts) {
                if (!part.trim()) continue;
                try {
                    const student = JSON.parse(part.trim());
                    // Sécurité : Si fullName présent mais pas les autres, on découpe
                    if (student.fullName && (!student.lastName || student.lastName === "INCONNU")) {
                         const names = student.fullName.trim().split(/\s+/);
                         if (names.length > 1) {
                             student.firstName = names.pop();
                             student.lastName = names.join(' ').toUpperCase();
                         }
                    }

                    if (student.lastName || student.firstName) {
                        if (!Array.isArray(student.options)) student.options = [];
                        validStudents.push(student);
                    }
                } catch (e) {}
            }

            console.log(`🧠 [AI] Succès : ${validStudents.length} élèves extraits.`);
            return validStudents;

        } catch (e) {
            console.error("❌ AI Parsing Global Crash:", e.message);
            return [];
        }
    }
};

module.exports = AdminAI;