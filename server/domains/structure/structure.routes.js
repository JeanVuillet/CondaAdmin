const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveEngine = require('../../core/drive.engine');

// --- ROUTE 1 : ARBORESCENCE DRIVE (Pour DriveViewer.jsx) ---
router.get('/drive-tree', async (req, res) => {
    try {
        // Tentative de récupération réelle si le Drive est connecté
        // Sinon on renvoie une structure vide pour ne pas faire crasher le front
        const authStatus = await DriveEngine.testAuth();
        
        if (!authStatus.ok) {
            return res.json({ 
                name: "Drive Déconnecté", 
                children: [
                    { id: 'err', name: "⚠️ Token Drive manquant ou expiré", type: "file", link: "#" }
                ] 
            });
        }

        // Ici, idéalement on appellerait une méthode récursive du DriveEngine
        // Pour l'instant, on simule une racine pour valider le chargement
        res.json({
            name: "Racine Condamine",
            children: [
                { id: 'root_1', name: "📂 Dossier Établissement (Placeholder)", type: "folder", link: "#" },
                { id: 'root_2', name: "📄 Statut Système.pdf", type: "file", link: "#" }
            ]
        });

    } catch (e) {
        console.error("Erreur Drive Tree:", e);
        res.json({ name: "Erreur", children: [] });
    }
});

// --- ROUTE 2 : DIAGNOSTIC (Pour integrity.test.js) ---
router.get('/diagnostic', async (req, res) => {
    const mode = req.query.mode || 'quick';
    
    const status = {
        db: mongoose.connection.readyState === 1 ? 'OK' : 'DOWN',
        drive: (await DriveEngine.testAuth()).ok ? 'OK' : 'WARNING',
        timestamp: new Date().toISOString()
    };

    if (mode === 'deep') {
        // Simulation d'un check IA
        status.ai_engine = process.env.GEMINI_API_KEY ? 'READY' : 'MISSING_KEY';
    }

    res.json(status);
});

module.exports = router;