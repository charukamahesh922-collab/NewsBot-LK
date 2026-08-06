// ╔══════════════════════════════════════════════════════════════╗
// ║                    💝 NEWS BOT LK 💝                        ║
// ║                  🦄 QR Login Edition 🦄                    ║
// ║              Developed by Charuka Mahesh                     ║
// ║                  Version: 9.0.1 ✨                           ║
// ╚══════════════════════════════════════════════════════════════╝

// ============================================================
// ERROR HANDLING
// ============================================================
const originalConsoleError = console.error;
function isIgnoredBaileysError(message) {
    if (!message) return false;
    return message.includes('failed to decrypt message') ||
        message.includes('No matching sessions') ||
        message.includes('No session record') ||
        message.includes('transaction failed, rolling back');
}

console.error = function(...args) {
    const msg = args.map(String).join(' ');
    if (isIgnoredBaileysError(msg)) {
        originalConsoleError('[baileys][ignored]', msg);
        return;
    }
    originalConsoleError.apply(console, args);
};

process.on('uncaughtException', (err) => {
    if (isIgnoredBaileysError(err?.message)) return;
    console.error('Uncaught:', err);
});

process.on('unhandledRejection', (reason) => {
    const message = reason?.message || String(reason);
    if (isIgnoredBaileysError(message)) return;
    console.error('UnhandledRejection:', reason);
});

// ============================================================
// IMPORTS
// ============================================================
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const mongoose = require('mongoose');
const config = require('./config');
const fetchAllLatestNews = require('./news/fetchAll');
const { cleanNewsText, isGarbageDescription, fixLineBreaks, formatNewsText, smartTruncate } = require('./news/utils');
const { handleButtonMenu, handleButtonResponse, sendMainMenu, sendSettingsMenu } = require('./modules/menus');

// ============================================================
// VOICE REPLIES
// ============================================================
let voiceReplies = { replies: {} };
try {
    const voiceFilePath = path.join(__dirname, 'voiceReplies.json');
    if (fs.existsSync(voiceFilePath)) {
        voiceReplies = JSON.parse(fs.readFileSync(voiceFilePath, 'utf8'));
        console.log('🎵 Voice replies:', Object.keys(voiceReplies.replies || {}).length, 'triggers');
    }
} catch (e) { console.log('⚠️ voiceReplies.json:', e.message); }

// ============================================================
// CONFIGURATION
// ============================================================
const OWNER_NUMBERS = Array.isArray(config.ownerNumber)
    ? config.ownerNumber.map(n => String(n || '').trim()).filter(Boolean)
    : [String(config.ownerNumber || '')].map(n => n.trim()).filter(Boolean);

const OWNER_CLEAN_NUMBERS = OWNER_NUMBERS.map(n => n.replace(/[^0-9]/g, '')).filter(n => n.length >= 9);

const NEWS_GROUP_JID = config.newsGroupJid;
const CHECK_INTERVAL_MS = config.checkIntervalMs || 120000;
const BOT_LOGO = config.botLogo;
const FALLBACK_IMAGE = config.fallbackImage;
const REACTIONS = config.reactions || ['📰', '🔥', '👍', '💯', '👏'];
const STATUS_EMOJIS = config.statusEmojis || ['🖤', '❤️', '🔥', '👍', '💯'];

const SAVE_FOLDER = path.join(__dirname, 'saved_media');
const STATUS_FOLDER = path.join(__dirname, 'saved_status');
const VV_FOLDER = path.join(__dirname, 'view_once_saved');
[SAVE_FOLDER, STATUS_FOLDER, VV_FOLDER].forEach(f => { if (!fs.existsSync(f)) fs.mkdirSync(f, { recursive: true }); });

// ============================================================
// OWNER IDENTIFICATION
// ============================================================
function extractPhoneFromJid(jid) {
    if (!jid) return '';
    jid = String(jid);
    if (jid === 'status@broadcast') return '';
    const id = jid.split('@')[0].replace(/[^0-9]/g, '');
    if (id.length >= 9) {
        if (id.startsWith('94') && id.length >= 11) return id;
        if (id.length > 12) {
            const phoneMatch = id.match(/94\d{9,10}/);
            if (phoneMatch) return phoneMatch[0];
        }
    }
    return id;
}

function isOwner(senderNumber, senderJid) {
    if (!senderNumber && !senderJid) return false;
    let cleanNumber = String(senderNumber || '').replace(/[^0-9]/g, '');
    if (!cleanNumber && senderJid) {
        cleanNumber = extractPhoneFromJid(senderJid);
    }
    for (const ownerNum of OWNER_CLEAN_NUMBERS) {
        if (cleanNumber === ownerNum) return true;
        if (cleanNumber.length >= 9 && ownerNum.length >= 9 && cleanNumber.slice(-9) === ownerNum.slice(-9)) return true;
        if (cleanNumber.length >= 10 && ownerNum.length >= 10 && cleanNumber.slice(-10) === ownerNum.slice(-10)) return true;
    }
    return false;
}

// ============================================================
// JSON DATABASE
// ============================================================
const JSON_DB_FILE = path.join(__dirname, 'database.json');
let useMongo = false;
let jsonDb = { 
    settings: { botMode: 'public', prefix: '.', autoNewsEnabled: true, autoStatusView: true, autoStatusReact: true, autoStatusSave: false, voiceReplyEnabled: true, autoBioEnabled: true, antiLinkEnabled: false, welcomeEnabled: false, goodbyeEnabled: false }, 
    warnings: {}, bans: [], afk: {}, groupSettings: {}, sentUrls: [] 
};

function loadJsonDb() {
    try { 
        if (fs.existsSync(JSON_DB_FILE)) { 
            const d = JSON.parse(fs.readFileSync(JSON_DB_FILE, 'utf8')); 
            jsonDb = { settings: { ...jsonDb.settings, ...(d.settings || {}) }, warnings: d.warnings || {}, bans: d.bans || [], afk: d.afk || {}, groupSettings: d.groupSettings || {}, sentUrls: d.sentUrls || [] }; 
        } else saveJsonDb(); 
    } catch (e) { saveJsonDb(); }
}
function saveJsonDb() { try { fs.writeFileSync(JSON_DB_FILE, JSON.stringify(jsonDb, null, 2)); } catch (e) {} }
loadJsonDb();

// ============================================================
// MONGODB (OPTIONAL)
// ============================================================
const settingSchema = new mongoose.Schema({ key: String, value: mongoose.Schema.Types.Mixed, updatedAt: { type: Date, default: Date.now } });
const warningSchema = new mongoose.Schema({ userId: String, groupId: String, count: { type: Number, default: 1 } });
const banSchema = new mongoose.Schema({ userId: { type: String, unique: true }, reason: String, bannedAt: { type: Date, default: Date.now } });
const afkSchema = new mongoose.Schema({ userId: { type: String, unique: true }, reason: String, afkAt: { type: Date, default: Date.now } });
const groupSettingSchema = new mongoose.Schema({ groupId: { type: String, unique: true }, isMuted: { type: Boolean, default: false } }, { strict: false });
const newsUrlSchema = new mongoose.Schema({ url: { type: String, unique: true }, sentAt: { type: Date, default: Date.now } });
let Setting, Warning, Ban, Afk, GroupSetting, NewsUrl;

async function connectDatabase() {
    const mongoUrl = config.mongoPublic || config.mongoInternal || '';
    if (mongoUrl && mongoUrl.length > 10) {
        try {
            await mongoose.connect(mongoUrl, { dbName: config.dbName || 'newsbot_db', serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });
            Setting = mongoose.model('Setting', settingSchema); Warning = mongoose.model('Warning', warningSchema);
            Ban = mongoose.model('Ban', banSchema); Afk = mongoose.model('Afk', afkSchema);
            GroupSetting = mongoose.model('GroupSetting', groupSettingSchema); NewsUrl = mongoose.model('NewsUrl', newsUrlSchema);
            useMongo = true; console.log('✅ MongoDB connected'); return true;
        } catch (e) { console.log('⚠️ MongoDB failed, using JSON DB'); }
    }
    useMongo = false; loadJsonDb(); console.log('🗄️ Using JSON Database'); return false;
}

const db = {
    get: async (k, dv) => { if (!useMongo || !Setting) return jsonDb.settings[k] ?? dv; try { const r = await Setting.findOne({ key: k }); return r ? r.value : dv; } catch { return jsonDb.settings[k] ?? dv; } },
    set: async (k, v) => { if (!useMongo || !Setting) { jsonDb.settings[k] = v; saveJsonDb(); return true; } try { await Setting.updateOne({ key: k }, { $set: { key: k, value: v, updatedAt: new Date() } }, { upsert: true }); return true; } catch { return false; } },
    all: async () => { if (!useMongo || !Setting) return { ...jsonDb.settings }; try { const d = await Setting.find({}); const s = {}; d.forEach(x => s[x.key] = x.value); return s; } catch { return { ...jsonDb.settings }; } },
    warnAdd: async (u, g) => { if (!useMongo || !Warning) { const k = `${u}_${g}`; jsonDb.warnings[k] = (jsonDb.warnings[k] || 0) + 1; saveJsonDb(); return jsonDb.warnings[k]; } try { const r = await Warning.findOneAndUpdate({ userId: u, groupId: g }, { $inc: { count: 1 } }, { upsert: true, new: true }); return r?.count || 0; } catch { return 0; } },
    warnClear: async (u, g) => { if (!useMongo || !Warning) { delete jsonDb.warnings[`${u}_${g}`]; saveJsonDb(); return true; } try { await Warning.deleteMany({ userId: u, groupId: g }); return true; } catch { return false; } },
    banAdd: async (u, r = '') => { if (!useMongo || !Ban) { if (!jsonDb.bans.find(b => b.userId === u)) { jsonDb.bans.push({ userId: u, reason: r, bannedAt: new Date().toISOString() }); saveJsonDb(); } return true; } try { await Ban.updateOne({ userId: u }, { $set: { userId: u, reason: r, bannedAt: new Date() } }, { upsert: true }); return true; } catch { return false; } },
    banRemove: async (u) => { if (!useMongo || !Ban) { jsonDb.bans = jsonDb.bans.filter(b => b.userId !== u); saveJsonDb(); return true; } try { await Ban.deleteOne({ userId: u }); return true; } catch { return false; } },
    banCheck: async (u) => { if (!useMongo || !Ban) return jsonDb.bans.some(b => b.userId === u); try { return !!(await Ban.findOne({ userId: u })); } catch { return false; } },
    banAll: async () => { if (!useMongo || !Ban) return jsonDb.bans; try { return await Ban.find({}); } catch { return []; } },
    afkSet: async (u, r) => { if (!useMongo || !Afk) { jsonDb.afk[u] = { userId: u, reason: r, afkAt: new Date().toISOString() }; saveJsonDb(); return true; } try { await Afk.updateOne({ userId: u }, { $set: { userId: u, reason: r, afkAt: new Date() } }, { upsert: true }); return true; } catch { return false; } },
    afkRemove: async (u) => { if (!useMongo || !Afk) { delete jsonDb.afk[u]; saveJsonDb(); return true; } try { await Afk.deleteOne({ userId: u }); return true; } catch { return false; } },
    afkGet: async (u) => { if (!useMongo || !Afk) return jsonDb.afk[u] || null; try { return await Afk.findOne({ userId: u }); } catch { return null; } },
    groupGet: async (g, k, dv) => { if (!useMongo || !GroupSetting) return jsonDb.groupSettings[g]?.[k] ?? dv; try { const r = await GroupSetting.findOne({ groupId: g }); return r?.[k] ?? dv; } catch { return dv; } },
    groupSet: async (g, k, v) => { if (!useMongo || !GroupSetting) { if (!jsonDb.groupSettings[g]) jsonDb.groupSettings[g] = {}; jsonDb.groupSettings[g][k] = v; saveJsonDb(); return true; } try { await GroupSetting.updateOne({ groupId: g }, { $set: { [k]: v } }, { upsert: true }); return true; } catch { return false; } },
    urlsGet: async () => { if (!useMongo || !NewsUrl) return jsonDb.sentUrls || []; try { const d = await NewsUrl.find({}); return d.map(x => x.url); } catch { return []; } },
    urlsAdd: async (url) => { if (!useMongo || !NewsUrl) { if (!jsonDb.sentUrls.includes(url)) { jsonDb.sentUrls.push(url); saveJsonDb(); } return true; } try { await NewsUrl.updateOne({ url }, { $set: { url, sentAt: new Date() } }, { upsert: true }); return true; } catch { return false; } },
    urlsCount: async () => { if (!useMongo || !NewsUrl) return jsonDb.sentUrls.length; try { return await NewsUrl.countDocuments(); } catch { return 0; } }
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================
const randEmoji = (a) => a[Math.floor(Math.random() * a.length)];

async function downloadMedia(msg) {
    try { const baileys = await import('@whiskeysockets/baileys'); const buf = await baileys.downloadMediaMessage(msg, 'buffer', {}, { logger: { info: () => {}, error: () => {}, warn: () => {} } }); return (buf && buf.length > 100) ? buf : null; } catch (e) { return null; }
}

async function saveMediaToFile(msg, folder = SAVE_FOLDER) {
    try {
        let rm = msg; let mt = Object.keys(msg.message || {})[0]; if (!mt) return null;
        if (mt.includes('viewOnce') || mt.includes('view_once')) { const im = msg.message[mt]?.message; if (im) { rm = { ...msg, message: im }; mt = Object.keys(im)[0]; } }
        const em = { 'imageMessage': '.jpg', 'videoMessage': '.mp4', 'audioMessage': '.ogg', 'stickerMessage': '.webp' };
        const ext = em[mt] || '.bin';
        const buf = await downloadMedia(rm); if (!buf || buf.length < 100) return null;
        const fn = `media_${Date.now()}${ext}`; const fp = path.join(folder, fn);
        fs.writeFileSync(fp, buf);
        return { buffer: buf, type: mt, ext, filename: fn, filePath: fp };
    } catch (e) { return null; }
}

async function handleVoiceReply(jid, text, msg, isUserOwner) {
    if (isUserOwner) return false;
    if (!await db.get('voiceReplyEnabled', true)) return false;
    if (!voiceReplies.replies || Object.keys(voiceReplies.replies).length === 0) return false;
    const lower = text.toLowerCase(), words = lower.split(/\s+/);
    for (const [trigger, url] of Object.entries(voiceReplies.replies)) {
        const tl = trigger.toLowerCase(); let matched = false;
        if (lower === tl) matched = true; else if (words.includes(tl)) matched = true; else if (tl.includes(' ') && lower.includes(tl)) matched = true;
        if (matched) {
            try {
                const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000 });
                const buf = Buffer.from(res.data);
                if (buf.length > 100) { const sent = await sock.sendMessage(jid, { audio: buf, mimetype: 'audio/mpeg', ptt: true }, { quoted: msg }); await sock.sendMessage(jid, { react: { text: '🎵', key: sent.key } }); return true; }
            } catch (e) {}
            break;
        }
    }
    return false;
}

// ============================================================
// STATUS HANDLER
// ============================================================
let lastStatusTime = 0, lastStatusMessages = [];

async function handleStatus(msg) {
    if (!sock) return;
    try {
        const { key } = msg; if (key.fromMe) return;
        const p = key.participant || key.remoteJid; if (!p) return;
        if (Date.now() - lastStatusTime < 2000) return; lastStatusTime = Date.now();
        lastStatusMessages.push({ msg, timestamp: Date.now(), participant: p });
        if (lastStatusMessages.length > 50) lastStatusMessages = lastStatusMessages.slice(-50);
        if (await db.get('autoStatusView', true)) { await sock.readMessages([key]); console.log('👁️ Status viewed'); }
        if (await db.get('autoStatusReact', true)) {
            const emoji = randEmoji(STATUS_EMOJIS);
            try { await sock.sendMessage(p, { react: { text: emoji, key: key } }); } catch (e) {}
        }
    } catch (e) {}
}

// ============================================================
// SEND NEWS
// ============================================================
async function sendNewsToJid(jid, article, sendReaction = true) {
    if (!sock?.user) return false;
    let desc = article.description || article.title || '📰 Click to read';
    desc = cleanNewsText(desc); if (isGarbageDescription(desc)) desc = article.title;
    desc = fixLineBreaks(desc); desc = smartTruncate(desc, 2500);
    desc = desc.replace(/\. /g, '.\n\n').replace(/\? /g, '?\n\n').replace(/\! /g, '!\n\n').replace(/। /g, '।\n\n');
    desc = desc.split('\n').filter(p => p.trim().length > 0).join('\n\n');

    const capLines = [];
    capLines.push('╭' + '─'.repeat(40) + '╮');
    capLines.push('┃  📰 *' + (article.source || '') + '*');
    if (article.category) capLines.push('┃  📂 ' + article.category);
    capLines.push('╰' + '─'.repeat(40) + '╯');
    capLines.push('');
    capLines.push('📌 *' + article.title + '*');
    capLines.push('');
    capLines.push('─'.repeat(40));
    capLines.push('');
    capLines.push(desc);
    capLines.push('');
    capLines.push('─'.repeat(40));
    if (article.date) { capLines.push(''); capLines.push('📅 ' + article.date); }
    capLines.push('');
    capLines.push('🔗  ' + article.url);
    capLines.push('');
    capLines.push('💝  *NewsBot LK* | Charuka Mahesh');
    const cap = capLines.join('\n');

    try {
        let sent = null;
        const imgUrl = article.image || BOT_LOGO || '';
        if (imgUrl && imgUrl.startsWith('http')) {
            try {
                const ir = await axios.get(imgUrl, { responseType: 'arraybuffer', timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });
                const buf = Buffer.from(ir.data || []);
                if (buf.length > 512) {
                    sent = await sock.sendMessage(jid, { image: buf, caption: cap, mimetype: 'image/jpeg' });
                }
            } catch (e) {}
        }
        if (!sent) {
            sent = await sock.sendMessage(jid, { text: cap });
        }
        if (sent && sendReaction) {
            try { await sock.sendMessage(jid, { react: { text: randEmoji(REACTIONS), key: sent.key } }); } catch (e) {}
        }
        return true;
    } catch (e) {
        try { await sock.sendMessage(jid, { text: cap }); return true; } catch (e2) { return false; }
    }
}

async function sendNewsCommand(jid, isGroup) {
    if (!sock?.user) return;
    await sock.sendMessage(jid, { text: '📰 *Fetching news...* ⏳' });
    try {
        const all = await fetchAllLatestNews();
        if (!all.length) { await sock.sendMessage(jid, { text: '📭 *No news!*' }); return; }
        let s = 0; const max = isGroup ? 5 : 8;
        for (const a of all.slice(0, max)) { if (await sendNewsToJid(jid, a, true)) { s++; await new Promise(r => setTimeout(r, 2000)); } }
        await sock.sendMessage(jid, { text: '✅ *' + s + ' news sent!* 📊 Total: ' + all.length });
    } catch (e) { await sock.sendMessage(jid, { text: '❌ *Error!*' }); }
}

async function checkAndShareAllNewNews() {
    if (!sock?.user) return;
    if (!NEWS_GROUP_JID) return;
    if (await db.groupGet(NEWS_GROUP_JID, 'isMuted', false)) return;
    try {
        const all = await fetchAllLatestNews(); if (!all.length) return;
        const urls = await db.urlsGet();
        if (!urls.length) { for (const i of all) { if (i.url) await db.urlsAdd(i.url); } return; }
        let s = 0;
        for (const i of all) { if (!i.url || urls.includes(i.url)) continue; if (await sendNewsToJid(NEWS_GROUP_JID, i, true)) { await db.urlsAdd(i.url); s++; } await new Promise(r => setTimeout(r, 3000)); }
        if (s > 0) console.log('✅ ' + s + ' news sent');
    } catch (e) {}
}

// ============================================================
// MENUS
// ============================================================
async function sendMenu(jid, isOwner, isAdmin, isGroup, prefix) {
    return sendMainMenu(sock, jid, db, config, isOwner, isAdmin, isGroup, prefix);
}

async function sendStats(jid) {
    const s = await db.all();
    const uc = await db.urlsCount();
    const ve = await db.get('voiceReplyEnabled', true);
    
    const t = [
        '┏' + '━'.repeat(28) + '┓',
        '┃     📊 *STATISTICS* 📊      ┃',
        '┃     💝 *NewsBot LK* 💝      ┃',
        '┗' + '━'.repeat(28) + '┛',
        '',
        '╔' + '═'.repeat(30) + '╗',
        '║       📈 *OVERVIEW*          ║',
        '╚' + '═'.repeat(30) + '╝',
        '  📰 News Shared: *' + uc + '*',
        '  📱 Status Saved: *' + fs.readdirSync(STATUS_FOLDER).length + '*',
        '  💾 Media Saved: *' + fs.readdirSync(SAVE_FOLDER).length + '*',
        '  🔄 Interval: *' + (CHECK_INTERVAL_MS / 1000) + 's*',
        '  📰 Sources: *13*',
        '  📝 Articles/Fetch: *32*',
        '',
        '╔' + '═'.repeat(30) + '╗',
        '║       ⚙️ *STATUS*            ║',
        '╚' + '═'.repeat(30) + '╝',
        '  📰 Auto News: ' + (s.autoNewsEnabled ? '✅ *ON*' : '❌ *OFF*'),
        '  🖤 Auto Status: ' + (s.autoStatusView ? '✅ *ON*' : '❌ *OFF*'),
        '  🎵 Voice: ' + (ve ? '✅ *ON*' : '❌ *OFF*'),
        '  🔗 Anti-Link: ' + (s.antiLinkEnabled ? '✅ *ON*' : '❌ *OFF*'),
        '',
        '🔧 Prefix: *' + (s.prefix || '.') + '*',
        '🗄️ DB: ' + (useMongo ? 'MongoDB' : 'JSON'),
        '',
        '━'.repeat(38),
        '👨‍💻 Charuka Mahesh | v' + (config.version || '9.0.1'),
    ].join('\n');
    
    try {
        const lr = await axios.get(BOT_LOGO, { responseType: 'arraybuffer', timeout: 10000 });
        if (lr.data?.length > 1000) {
            const se = await sock.sendMessage(jid, { image: lr.data, caption: t, mimetype: 'image/png' });
            await sock.sendMessage(jid, { react: { text: '📊', key: se.key } });
        } else {
            const se = await sock.sendMessage(jid, { text: t });
            await sock.sendMessage(jid, { react: { text: '📊', key: se.key } });
        }
    } catch (e) {
        const se = await sock.sendMessage(jid, { text: t });
        await sock.sendMessage(jid, { react: { text: '📊', key: se.key } });
    }
}

async function sendSettings(jid, isOwner) {
    return sendSettingsMenu(sock, jid, db, isOwner, config);
}

// ============================================================
// CONNECTED MESSAGE
// ============================================================
async function sendConnectedMessage() {
    if (!sock || !sock.user) return;
    await new Promise(r => setTimeout(r, 3000));
    try {
        const fullId = sock.user?.id || 'unknown';
        const shortId = String(fullId).split(/[:@]/)[0] || 'unknown';
        const msg = '╔' + '═'.repeat(36) + '╗\n║     💝 *NEWS BOT LK* 💝      ║\n║   🦄 *Connected!* 🦄        ║\n╚' + '═'.repeat(36) + '╯\n\n✅ *Online* | 🆔 ' + shortId + '\n📰 *.menu* | *.news* | *.settings*\n💝 Charuka Mahesh';
        
        const ownerJids = OWNER_CLEAN_NUMBERS.map(num => num + '@s.whatsapp.net');
        for (const ownerJid of ownerJids) {
            try {
                if (BOT_LOGO) {
                    const lr = await axios.get(BOT_LOGO, { responseType: 'arraybuffer', timeout: 10000 });
                    if (lr.data?.length > 1000) {
                        await sock.sendMessage(ownerJid, { image: lr.data, caption: msg, mimetype: 'image/png' });
                        console.log('📨 Connected image sent to:', ownerJid);
                        continue;
                    }
                }
                await sock.sendMessage(ownerJid, { text: msg });
                console.log('📨 Connected text sent to:', ownerJid);
            } catch (e) {
                console.log('⚠️ Failed to send to', ownerJid);
            }
        }
    } catch (e) {}
}

// ============================================================
// MAIN BOT
// ============================================================
let sock = null, reconnectTimer = null, reconnectAttempts = 0, isConnected = false, isShuttingDown = false;
let botJid = null;

async function startBot() {
    if (sock) { try { await sock.end(); } catch(e) {} sock = null; }
    
    const baileys = await import('@whiskeysockets/baileys');
    const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion } = baileys;
    const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'auth_info_baileys'));
    
    const latestVersionInfo = await fetchLatestBaileysVersion();
    const latestVersion = Array.isArray(latestVersionInfo)
        ? latestVersionInfo
        : latestVersionInfo?.version || [2, 3000, 0];
    
    sock = makeWASocket({
        auth: state,
        browser: Browsers.ubuntu('Chrome'),
        markOnlineOnConnect: false,
        connectTimeoutMs: 60000,
        printQRInTerminal: false,
        syncFullHistory: false,
        retryRequestDelayMs: 10000,
        maxRetries: 10,
        defaultQueryTimeoutMs: 120000,
        generateHighQualityLinkPreview: false,
        version: latestVersion,
    });

    sock.ev.on('creds.update', saveCreds);

    // ============================================================
    // CONNECTION HANDLER
    // ============================================================
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('\n📱 Scan QR Code:\n');
            qrcode.generate(qr, { small: true });
            console.log('\n⏳ Waiting for scan...\n');
        }

        if (connection === 'close') {
            isConnected = false;
            sock = null;
            const statusCode = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode || lastDisconnect?.error?.statusCode || lastDisconnect?.error?.code;
            const statusMessage = lastDisconnect?.error?.message || lastDisconnect?.error?.output?.payload?.message || lastDisconnect?.reason || 'unknown';
            console.log(`\n🔌 Connection closed. Status: ${statusCode || 'unknown'} - ${statusMessage}`);
            
            const invalidSessionCodes = [
                DisconnectReason.loggedOut,
                DisconnectReason.connectionReplaced,
                DisconnectReason.badSession,
                DisconnectReason.multideviceMismatch,
            ];

            if (invalidSessionCodes.includes(statusCode)) {
                console.log('❌ Session invalidated, clearing auth state');
                try {
                    fs.rmSync(path.join(__dirname, 'auth_info_baileys'), { recursive: true, force: true });
                } catch (e) {
                    console.error('⚠️ Failed to clear auth state:', e.message || e);
                }
                reconnectAttempts = 0;
                setTimeout(async () => { if (!isShuttingDown) await startBot(); }, 5000);
                return;
            }

            reconnectAttempts += 1;
            if (!isShuttingDown) {
                const delay = Math.min(30000, 5000 * reconnectAttempts);
                console.log(`🔄 Reconnecting in ${delay/1000}s... (attempt ${reconnectAttempts})`);
                if (reconnectTimer) clearTimeout(reconnectTimer);
                reconnectTimer = setTimeout(async () => {
                    reconnectTimer = null;
                    if (!isShuttingDown) await startBot();
                }, delay);
            }
        } 
        else if (connection === 'open') {
            isConnected = true;
            reconnectAttempts = 0;
            if (sock.user) {
                botJid = sock.user.id;
                console.log('\n' + '═'.repeat(60));
                console.log(`  ✅ Bot Connected!`);
                console.log(`  📱 ${String(sock.user.id).split(/[:@]/)[0] || 'Unknown'}`);
                console.log(`  👑 Owners: ${OWNER_CLEAN_NUMBERS.join(', ')}`);
                console.log('═'.repeat(60) + '\n');
                
                setTimeout(() => sendConnectedMessage(), 5000);
                
                setTimeout(async () => {
                    if (await db.get('autoNewsEnabled', true)) {
                        const urls = await db.urlsGet();
                        if (!urls.length) {
                            try {
                                const all = await fetchAllLatestNews();
                                for (const article of all) { if (article.url) await db.urlsAdd(article.url); }
                                console.log('📝 Marked ' + all.length + ' articles as sent');
                            } catch (e) {}
                        }
                    }
                }, 10000);
            }
        }
    });

    // ============================================================
    // MESSAGES HANDLER
    // ============================================================
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type === 'append') return;
        
        for (const msg of messages) {
            try {
                if (!msg.message) continue;
                if (msg.message.protocolMessage) continue;
                if (msg.key?.fromMe) continue;
                
                const jid = msg.key.remoteJid;
                if (!jid) continue;
                
                if (jid === 'status@broadcast') {
                    await handleStatus(msg);
                    continue;
                }
                
                const isGroup = jid?.endsWith('@g.us');
                const sender = msg.key.participant || jid;
                let senderNum = extractPhoneFromJid(sender);
                
                if (isGroup && msg.key.participant) {
                    senderNum = extractPhoneFromJid(msg.key.participant);
                }
                
                const isUserOwner = isOwner(senderNum, sender);
                const isAdmin = isGroup ? await checkAdmin(jid, sender).catch(() => false) : false;
                const prefix = await db.get('prefix', '.');
                
                let rawText = '';
                if (msg.message.conversation) rawText = msg.message.conversation;
                else if (msg.message.extendedTextMessage?.text) rawText = msg.message.extendedTextMessage.text;
                else if (msg.message.imageMessage?.caption) rawText = msg.message.imageMessage.caption;
                else if (msg.message.videoMessage?.caption) rawText = msg.message.videoMessage.caption;
                
                if (!rawText) continue;
                
                const text = rawText.trim();
                const lower = text.toLowerCase();
                
                // Ban check
                if (await db.banCheck(sender) && !isUserOwner) continue;
                
                // Voice replies (skip for owners)
                if (!isGroup && !isUserOwner) {
                    const voiceReplied = await handleVoiceReply(jid, text, msg, false);
                    if (voiceReplied) continue;
                }
                
                // Remove prefix
                let cmd = text;
                if (text.startsWith(prefix)) cmd = text.slice(prefix.length);
                const cmdLower = cmd.toLowerCase().trim();
                
                // ===== COMMANDS =====
                
                if (cmdLower === 'menu' || cmdLower === 'help') {
                    try {
                        await sendMenu(jid, isUserOwner, isAdmin, isGroup, prefix);
                    } catch (e) {
                        await sock.sendMessage(jid, { text: '📋 *Menu*\n\n📰 .news - Latest news\n📊 .stats - Statistics\n⚙️ .settings - Settings\n🎵 .voice on/off - Voice replies\n\n💝 *NewsBot LK*' });
                    }
                    continue;
                }
                
                if (cmdLower === 'news') {
                    await sendNewsCommand(jid, isGroup);
                    continue;
                }
                
                if (cmdLower === 'stats') {
                    await sendStats(jid);
                    continue;
                }
                
                if (cmdLower === 'settings') {
                    try {
                        await sendSettings(jid, isUserOwner);
                    } catch (e) {
                        await sock.sendMessage(jid, { text: '⚙️ *Settings*\n\nPrefix: ' + prefix + '\n\nUse .menu for all commands' });
                    }
                    continue;
                }
                
                if (cmdLower === 'voice on') {
                    await db.set('voiceReplyEnabled', true);
                    await sock.sendMessage(jid, { text: '🎵 *Voice Replies: ON*' });
                    continue;
                }
                
                if (cmdLower === 'voice off') {
                    await db.set('voiceReplyEnabled', false);
                    await sock.sendMessage(jid, { text: '🔇 *Voice Replies: OFF*' });
                    continue;
                }
                
                if (cmdLower === 'status') {
                    const info = `📱 *Status Info*\n\n👁️ Auto View: ${await db.get('autoStatusView', true) ? '✅ ON' : '❌ OFF'}\n💬 Auto React: ${await db.get('autoStatusReact', true) ? '✅ ON' : '❌ OFF'}\n📊 Statuses saved: ${lastStatusMessages.length}`;
                    await sock.sendMessage(jid, { text: info });
                    continue;
                }
                
                if (cmdLower === 'save' || cmdLower === 'ss') {
                    const qm = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                    if (!qm) { await sock.sendMessage(jid, { text: '💡 Reply to media with *save*' }); continue; }
                    const fm = { key: { remoteJid: jid, id: 'save_' + Date.now() }, message: qm };
                    const sv = await saveMediaToFile(fm);
                    await sock.sendMessage(jid, { text: sv ? '💾 *Saved!*' : '❌ *Failed!*' });
                    continue;
                }
                
                if (cmdLower === 'vv') {
                    const qm = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                    if (!qm) { await sock.sendMessage(jid, { text: '💡 Reply to view-once with *vv*' }); continue; }
                    await saveMediaToFile({ key: { remoteJid: jid }, message: qm }, VV_FOLDER);
                    await sock.sendMessage(jid, { text: '✅ *VV Saved!*' });
                    continue;
                }
                
                // ===== GROUP COMMANDS =====
                if (isGroup) {
                    if (cmdLower === 'admins') {
                        try {
                            const m = await sock.groupMetadata(jid);
                            const ad = m.participants.filter(p => p.admin);
                            await sock.sendMessage(jid, { text: '👑 *Admins*\n\n' + ad.map(p => '@' + p.id.split('@')[0]).join('\n'), mentions: ad.map(p => p.id) });
                        } catch(e) {}
                        continue;
                    }
                    
                    if (cmdLower === 'tagall' || cmdLower === 'everyone') {
                        try {
                            const m = await sock.groupMetadata(jid);
                            await sock.sendMessage(jid, { text: '📢 *Everyone!*', mentions: m.participants.map(p => p.id) });
                        } catch(e) {}
                        continue;
                    }
                    
                    if (cmdLower === 'groupinfo' || cmdLower === 'gcinfo') {
                        try {
                            const m = await sock.groupMetadata(jid);
                            await sock.sendMessage(jid, { text: '📋 *' + m.subject + '*\n👥 ' + m.participants.length + ' members\n🆔 `' + jid + '`' });
                        } catch(e) {}
                        continue;
                    }
                    
                    if (cmdLower.startsWith('afk')) {
                        const r = cmdLower.replace('afk', '').trim() || 'AFK';
                        await db.afkSet(sender, r);
                        await sock.sendMessage(jid, { text: '💤 @' + sender.split('@')[0] + ' *AFK:* ' + r, mentions: [sender] });
                        continue;
                    }
                    
                    if (isAdmin || isUserOwner) {
                        if (cmdLower === 'mute') { await db.groupSet(jid, 'isMuted', true); await sock.sendMessage(jid, { text: '🔇 *Muted 30min*' }); setTimeout(async () => { await db.groupSet(jid, 'isMuted', false); }, 1800000); continue; }
                        if (cmdLower === 'unmute') { await db.groupSet(jid, 'isMuted', false); await sock.sendMessage(jid, { text: '🔊 *Unmuted!*' }); continue; }
                    }
                }
                
                // ===== OWNER COMMANDS =====
                if (isUserOwner) {
                    if (cmdLower === 'autonews on') { await db.set('autoNewsEnabled', true); await sock.sendMessage(jid, { text: '📰 *Auto News: ON*' }); continue; }
                    if (cmdLower === 'autonews off') { await db.set('autoNewsEnabled', false); await sock.sendMessage(jid, { text: '📰 *Auto News: OFF*' }); continue; }
                    if (cmdLower === 'autostatus on') { await db.set('autoStatusView', true); await db.set('autoStatusReact', true); await sock.sendMessage(jid, { text: '🖤 *Auto Status: ON*' }); continue; }
                    if (cmdLower === 'autostatus off') { await db.set('autoStatusView', false); await db.set('autoStatusReact', false); await sock.sendMessage(jid, { text: '🖤 *Auto Status: OFF*' }); continue; }
                    if (cmdLower === 'statussave' || cmdLower === 'ssave') {
                        if (lastStatusMessages.length) {
                            const sv = await saveMediaToFile(lastStatusMessages[lastStatusMessages.length - 1].msg, STATUS_FOLDER);
                            await sock.sendMessage(jid, { text: sv ? '💾 *Saved!*' : '❌ *Failed!*' });
                        } else await sock.sendMessage(jid, { text: '📭 No statuses!' });
                        continue;
                    }
                }
                
                // AFK check for mentioned users
                const men = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                for (const m of men) {
                    const a = await db.afkGet(m);
                    if (a) {
                        const mins = Math.floor((Date.now() - new Date(a.afkAt).getTime()) / 60000);
                        await sock.sendMessage(jid, { text: '💤 @' + m.split('@')[0] + ' *AFK:* ' + a.reason + ' (' + mins + 'm)', mentions: [m] });
                    }
                }
                
                // Remove AFK if user sends message
                if (await db.afkGet(sender)) await db.afkRemove(sender);
                
            } catch (e) {}
        }
    });

    // ============================================================
    // GROUP PARTICIPANTS
    // ============================================================
    sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
        if (action === 'add' && await db.get('welcomeEnabled', false)) {
            for (const p of participants) await sock.sendMessage(id, { text: '🎉 *Welcome!*\n👋 @' + p.split('@')[0], mentions: [p] });
        }
        if (action === 'remove' && await db.get('goodbyeEnabled', false)) {
            for (const p of participants) await sock.sendMessage(id, { text: '😢 *Goodbye!*\n👋 @' + p.split('@')[0], mentions: [p] });
        }
    });

    // ============================================================
    // CREDENTIALS
    // ============================================================
    sock.ev.on('creds.update', saveCreds);

    // ============================================================
    // ADMIN CHECK
    // ============================================================
    async function checkAdmin(jid, sender) {
        try { const m = await sock.groupMetadata(jid); return m.participants.find(p => p.id === sender)?.admin != null; } catch { return false; }
    }
}

// ============================================================
// START BOT
// ============================================================
(async () => {
    console.log('\n💝 NewsBot LK v' + (config.version || '9.0.1') + ' 💝');
    console.log('👨‍💻 ' + (config.developer || 'Charuka Mahesh'));
    console.log('👑 Config Owners: ' + OWNER_CLEAN_NUMBERS.join(', '));
    console.log('📱 Using QR Code Authentication\n');
    
    await connectDatabase();
    await db.set('botMode', 'public');
    await db.set('autoStatusSave', false);
    console.log('🌍 Public Mode\n');
    
    await startBot();
    
    setInterval(async () => {
        if (await db.get('autoNewsEnabled', true)) {
            checkAndShareAllNewNews().catch(() => {});
        }
    }, CHECK_INTERVAL_MS);
    
    console.log('🦄💝 Bot Running! 💝🦄\n');
})();

// ============================================================
// SHUTDOWN
// ============================================================
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    isShuttingDown = true;
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    if (sock) { try { await sock.end(); } catch(e) {} sock = null; }
    try { await mongoose.disconnect(); } catch(e) {}
    process.exit(0);
});
