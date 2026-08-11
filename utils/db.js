const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const config = require('../config');

const JSON_DB_FILE = path.join(__dirname, '..', 'database.json');
let useMongo = false;
let Setting, Warning, Ban, Afk, GroupSetting, NewsUrl;

let jsonDb = {
    settings: {
        botMode: 'public',
        prefix: '.',
        autoNewsEnabled: true,
        autoStatusView: true,
        autoStatusReact: true,
        autoStatusSave: false,
        voiceReplyEnabled: true,
        autoBioEnabled: true,
        antiLinkEnabled: false,
        welcomeEnabled: false,
        goodbyeEnabled: false,
        buttonMenuEnabled: true
    },
    warnings: {},
    bans: [],
    afk: {},
    groupSettings: {},
    sentUrls: []
};

function loadJsonDb() {
    try {
        if (fs.existsSync(JSON_DB_FILE)) {
            const d = JSON.parse(fs.readFileSync(JSON_DB_FILE, 'utf8'));
            jsonDb = {
                settings: { ...jsonDb.settings, ...(d.settings || {}) },
                warnings: d.warnings || {},
                bans: d.bans || [],
                afk: d.afk || {},
                groupSettings: d.groupSettings || {},
                sentUrls: d.sentUrls || []
            };
        } else {
            saveJsonDb();
        }
    } catch (e) { 
        saveJsonDb(); 
    }
}

function saveJsonDb() {
    try { 
        fs.writeFileSync(JSON_DB_FILE, JSON.stringify(jsonDb, null, 2)); 
    } catch (e) {}
}

loadJsonDb();

async function connectDatabase() {
    const mongoUrl = config.mongoPublic || config.mongoInternal || '';
    if (mongoUrl && mongoUrl.length > 10) {
        try {
            await mongoose.connect(mongoUrl, {
                dbName: config.dbName || 'newsbot_db',
                serverSelectionTimeoutMS: 5000,
                connectTimeoutMS: 5000
            });

            const settingSchema = new mongoose.Schema({ key: String, value: mongoose.Schema.Types.Mixed, updatedAt: { type: Date, default: Date.now } });
            const warningSchema = new mongoose.Schema({ userId: String, groupId: String, count: { type: Number, default: 1 } });
            const banSchema = new mongoose.Schema({ userId: { type: String, unique: true }, reason: String, bannedAt: { type: Date, default: Date.now } });
            const afkSchema = new mongoose.Schema({ userId: { type: String, unique: true }, reason: String, afkAt: { type: Date, default: Date.now } });
            const groupSettingSchema = new mongoose.Schema({ groupId: { type: String, unique: true }, isMuted: { type: Boolean, default: false } }, { strict: false });
            const newsUrlSchema = new mongoose.Schema({ url: { type: String, unique: true }, sentAt: { type: Date, default: Date.now } });

            // Prevent OverwriteModelError on reconnection
            Setting = mongoose.models.Setting || mongoose.model('Setting', settingSchema);
            Warning = mongoose.models.Warning || mongoose.model('Warning', warningSchema);
            Ban = mongoose.models.Ban || mongoose.model('Ban', banSchema);
            Afk = mongoose.models.Afk || mongoose.model('Afk', afkSchema);
            GroupSetting = mongoose.models.GroupSetting || mongoose.model('GroupSetting', groupSettingSchema);
            NewsUrl = mongoose.models.NewsUrl || mongoose.model('NewsUrl', newsUrlSchema);

            useMongo = true;
            console.log('✅ Connected to MongoDB successfully.');
            return true;
        } catch (e) {
            console.log('⚠️ MongoDB connection failed. Falling back to JSON database.');
            if (mongoose.connection.readyState !== 0) await mongoose.disconnect().catch(() => {});
        }
    }
    useMongo = false;
    loadJsonDb();
    console.log('🗄️ Operating on local JSON DB.');
    return false;
}

const db = {
    get: async (k, dv) => {
        if (!useMongo || !Setting) return jsonDb.settings[k] ?? dv;
        try { const r = await Setting.findOne({ key: k }); return r ? r.value : dv; } catch { return jsonDb.settings[k] ?? dv; }
    },
    set: async (k, v) => {
        if (!useMongo || !Setting) { jsonDb.settings[k] = v; saveJsonDb(); return true; }
        try { await Setting.updateOne({ key: k }, { $set: { key: k, value: v, updatedAt: new Date() } }, { upsert: true }); return true; } catch { return false; }
    },
    all: async () => {
        if (!useMongo || !Setting) return { ...jsonDb.settings };
        try { const d = await Setting.find({}); const s = {}; d.forEach(x => s[x.key] = x.value); return s; } catch { return { ...jsonDb.settings }; }
    },
    warnGet: async (u, g) => {
        if (!useMongo || !Warning) return jsonDb.warnings[`${u}_${g}`] || 0;
        try { const r = await Warning.findOne({ userId: u, groupId: g }); return r?.count || 0; } catch { return 0; }
    },
    warnAdd: async (u, g) => {
        if (!useMongo || !Warning) { const k = `${u}_${g}`; jsonDb.warnings[k] = (jsonDb.warnings[k] || 0) + 1; saveJsonDb(); return jsonDb.warnings[k]; }
        try { const r = await Warning.findOneAndUpdate({ userId: u, groupId: g }, { $inc: { count: 1 } }, { upsert: true, new: true }); return r?.count || 0; } catch { return 0; }
    },
    warnClear: async (u, g) => {
        if (!useMongo || !Warning) { delete jsonDb.warnings[`${u}_${g}`]; saveJsonDb(); return true; }
        try { await Warning.deleteMany({ userId: u, groupId: g }); return true; } catch { return false; }
    },
    banAdd: async (u, r = '') => {
        if (!useMongo || !Ban) { if (!jsonDb.bans.find(b => b.userId === u)) { jsonDb.bans.push({ userId: u, reason: r, bannedAt: new Date().toISOString() }); saveJsonDb(); } return true; }
        try { await Ban.updateOne({ userId: u }, { $set: { userId: u, reason: r, bannedAt: new Date() } }, { upsert: true }); return true; } catch { return false; }
    },
    banRemove: async (u) => {
        if (!useMongo || !Ban) { jsonDb.bans = jsonDb.bans.filter(b => b.userId !== u); saveJsonDb(); return true; }
        try { await Ban.deleteOne({ userId: u }); return true; } catch { return false; }
    },
    banCheck: async (u) => {
        if (!useMongo || !Ban) return jsonDb.bans.some(b => b.userId === u);
        try { return !!(await Ban.findOne({ userId: u })); } catch { return false; }
    },
    banAll: async () => {
        if (!useMongo || !Ban) return jsonDb.bans || [];
        try { return await Ban.find({}); } catch { return []; }
    },
    afkSet: async (u, r) => {
        if (!useMongo || !Afk) { jsonDb.afk[u] = { userId: u, reason: r, afkAt: new Date().toISOString() }; saveJsonDb(); return true; }
        try { await Afk.updateOne({ userId: u }, { $set: { userId: u, reason: r, afkAt: new Date() } }, { upsert: true }); return true; } catch { return false; }
    },
    afkRemove: async (u) => {
        if (!useMongo || !Afk) { delete jsonDb.afk[u]; saveJsonDb(); return true; }
        try { await Afk.deleteOne({ userId: u }); return true; } catch { return false; }
    },
    afkGet: async (u) => {
        if (!useMongo || !Afk) return jsonDb.afk[u] || null;
        try { return await Afk.findOne({ userId: u }); } catch { return null; }
    },
    groupGet: async (g, k, dv) => {
        if (!useMongo || !GroupSetting) return jsonDb.groupSettings[g]?.[k] ?? dv;
        try { const r = await GroupSetting.findOne({ groupId: g }); return r?.[k] ?? dv; } catch { return dv; }
    },
    groupSet: async (g, k, v) => {
        if (!useMongo || !GroupSetting) { if (!jsonDb.groupSettings[g]) jsonDb.groupSettings[g] = {}; jsonDb.groupSettings[g][k] = v; saveJsonDb(); return true; }
        try { await GroupSetting.updateOne({ groupId: g }, { $set: { [k]: v } }, { upsert: true }); return true; } catch { return false; }
    },
    urlsGet: async () => {
        if (!useMongo || !NewsUrl) return jsonDb.sentUrls || [];
        try { 
            const d = await NewsUrl.find({}); 
            return Array.isArray(d) ? d.map(x => x.url) : []; 
        } catch { 
            return jsonDb.sentUrls || []; 
        }
    },
    urlsAdd: async (url) => {
        if (!useMongo || !NewsUrl) { 
            if (!jsonDb.sentUrls.includes(url)) { 
                jsonDb.sentUrls.push(url); 
                saveJsonDb(); 
            } 
            return true; 
        }
        try { await NewsUrl.updateOne({ url }, { $set: { url, sentAt: new Date() } }, { upsert: true }); return true; } catch { return false; }
    },
    urlsCount: async () => {
        if (!useMongo || !NewsUrl) return jsonDb.sentUrls.length;
        try { return await NewsUrl.countDocuments(); } catch { return jsonDb.sentUrls.length; }
    }
};

module.exports = { db, connectDatabase };
