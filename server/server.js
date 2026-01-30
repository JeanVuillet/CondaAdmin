const path = require('path');
const fs = require('fs');
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

if (!global.fetch) {
    const fetch = require('node-fetch');
    global.fetch = fetch;
    global.Headers = fetch.Headers;
    global.Request = fetch.Request;
    global.Response = fetch.Response;
}

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;
const SERVER_BOOT_ID = Date.now();

// 1. CHARGEMENT DYNAMIQUE DES MODÈLES RESTANTS (Admin & Core uniquement)
const modelsPath = path.join(__dirname, 'models');
if (fs.existsSync(modelsPath)) {
    fs.readdirSync(modelsPath).forEach(file => {
        if (file.endsWith('.js')) {
            require(path.join(modelsPath, file));
        }
    });
}

app.use(express.json({ limit: '10mb' }));

// 🛡️ 2. ROUTES SYSTÈME CORE
app.get('/api/system/apply-status', (req, res) => {
    const statusFile = path.join(__dirname, '../apply_status.json');
    if (fs.existsSync(statusFile)) {
        try { res.json(JSON.parse(fs.readFileSync(statusFile, 'utf8'))); } catch (e) { res.json({ status: 'OK' }); }
    } else { res.json({ status: 'OK' }); }
});

app.get('/api/system/version', (req, res) => {
    try {
        const vPath = path.join(__dirname, 'version.json');
        if (fs.existsSync(vPath)) {
            const vData = JSON.parse(fs.readFileSync(vPath, 'utf8'));
            return res.json({ hash: String(vData.build || 1) }); 
        }
    } catch (e) {}
    res.json({ hash: '1' });
});

app.get('/api/check-deploy', (req, res) => {
    res.json({ status: "OK", bootId: SERVER_BOOT_ID, db: mongoose.connection.readyState === 1 ? "CONNECTED" : "OFFLINE" });
});

// 3. MONTAGE DES DOMAINES (Restreints à l'administration)
app.use('/api/auth', require('./domains/auth/auth.routes'));
app.use('/api/admin', require('./domains/admin/admin.routes'));
app.use('/api/structure', require('./domains/structure/structure.routes'));

// 4. CONNEXION BDD
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ DATABASE CORE LINKED'))
    .catch(err => console.error("❌ DB CONNECTION ERROR :", err.message));

// 5. SERVICE FRONTEND
const distPath = path.resolve(process.cwd(), 'client', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

app.listen(port, '0.0.0.0', () => console.log(`🚀 ADMIN CORE RUNNING ON PORT ${port}`));